/**
 * 云端轮询式浏览器登录（**不开本地回调端口**）。
 *
 * 逐字照抄官方三件套：`login-client.ts`（init/poll 的协议与重试）、
 * `login-polling.ts`（轮询循环与截止）、`step-provider/index.ts:268-309`（登录整体）。
 * 状态机外壳照抄 `workbuddy/oauth.ts`（flow / controller / getWebLoginStatus / resetWebLogin），
 * 因为设置卡片跟随的是同一组四个入口。
 *
 * ---------------------------------------------------------------------------
 * 两个值，两种角色，**绝不可混用**（逐字 login-client.ts:11-16）
 * ---------------------------------------------------------------------------
 *
 * - `poll_token` —— 客户端侧唯一的凭据。它**只**出现在 `Authorization: Bearer` 头里，
 *   绝不进 URL、日志或磁盘。
 * - `flow_id` —— 公开标识，会进浏览器地址栏、历史与截图，单独一个兑不出凭据。
 *
 * 本文件把这件事做成结构性的：poll_token 只作为 `pollToken` 参数流向 `request()` 的
 * 头构造那一处（见 `loginHeaders`），URL 由 authBase + 路径 + flow_id 拼成，
 * 两段代码互不相交；uid 与 flow_id 的过滤也各有自己的上限（UID_MAX_LENGTH / FLOW_ID_PATTERN）。
 *
 * ---------------------------------------------------------------------------
 * 这条线路的凭据永不过期、永不刷新
 * ---------------------------------------------------------------------------
 * Step 的 api_key 不是会话令牌（index.ts:363-371），所以：
 *
 * - 凭据形态固定为 {type:'oauth', access, refresh: STATIC_REFRESH_TOKEN, expires: STATIC_EXPIRES_AT}；
 * - `refreshStepCodeCredential` 存在，但**永远抛错**——它存在的意义是让任何「刷新」路径
 *   得到一句明确的拒绝，而不是悄悄拿哨兵去换一次必然失败的新凭据。
 */
import type { StepCodeLoginFlowStatus, StepCodeProfile } from '../../shared/step-code-contracts.ts';
/**
 * 开流请求体里的终端信息（逐字 `StepCliClientInfo`，index.ts:280-285）。
 *
 * **只用于上游审计**，从不参与鉴权：`name` 固定是官方的 'stepcode'，因为服务端
 * 按它识别这条协议；本插件的身份由 `version` 字段如实上报，不冒充官方版本。
 */
export interface StepCodeClientInfo {
    readonly name: string;
    readonly version: string;
    readonly platform: string;
}
/** 客户端名逐字照抄官方（`defaultStepCliClientInfo`，login-client.ts:104-108）。 */
export declare const STEP_CODE_CLIENT_NAME = "stepcode";
/**
 * 接入层没有给版本时上报的版本串。
 *
 * 如实取一个「未知」而不是编一个像真的版本号：上游把它写进审计日志，编造会让
 * 排障时看到一条不存在的客户端版本。接入层（有 `package.json` 的那一层）应传真实版本。
 */
export declare const STEP_CODE_CLIENT_VERSION_UNKNOWN = "0.0.0-unknown";
/** 审计信息（逐字 login-client.ts:104-108：平台取 process.platform-process.arch）。 */
export declare function defaultStepCodeClientInfo(version: string): StepCodeClientInfo;
/**
 * 新的一次登录用的 poll_token：`randomBytes(32).toString('hex')`（逐字 index.ts:278）。
 *
 * 32 字节 = 64 位十六进制，与 `POLL_TOKEN_PATTERN` 对齐。它只进 Authorization 头。
 */
export declare function createStepCodePollToken(): string;
/**
 * 一次登录请求失败的类别（逐字 `StepCliLoginErrorKind`，login-client.ts:70-76）。
 *
 * - `http`：非 2xx，或 2xx 但信封里的 `status` 非 0。
 * - `protocol`：2xx 但形状或字段值不合协议（**永不重试**）。
 * - `transport`：请求根本没拿到响应。
 */
export type StepCodeLoginErrorKind = 'http' | 'protocol' | 'transport';
/** 一条登录请求错误；`httpStatus` 只在 http 类里有意义。 */
export declare class StepCodeLoginRequestError extends Error {
    readonly kind: StepCodeLoginErrorKind;
    readonly httpStatus?: number;
    constructor(kind: StepCodeLoginErrorKind, message: string, options?: {
        readonly httpStatus?: number;
        readonly cause?: unknown;
    });
}
/**
 * 这条错误值不值得自动重试（逐字 `isRetryableStepCliLoginError`，login-client.ts:95-100）。
 *
 * protocol 永不重试（形状不对说明对面不是我们以为的那个服务端）；transport 重试；
 * http 只在 408 / 429 / >=500 时重试。
 */
export declare function isRetryableStepCodeLoginError(error: unknown): boolean;
/**
 * 一次登录请求的响应体上限：64 KiB（逐字 login-client.ts:32）。
 *
 * 两个响应都是小 JSON；不设上限时，一个坏掉或恶意的端点可以把内存吃光。
 */
export declare const STEP_CODE_MAX_RESPONSE_BYTES: number;
/** 开流成功后的三件事（逐字 StepCliLoginInit，login-client.ts:49-57）。 */
export interface StepCodeLoginInit {
    /** 公开标识：会进浏览器地址栏，单独一个兑不出凭据。 */
    readonly flowId: string;
    /** 永远由客户端自己拼；服务端可能返回的 authorize_url 被**忽略**（见下）。 */
    readonly authorizeUrl: string;
    /** 已 clamp 到 <= 60。 */
    readonly pollIntervalSec: number;
    /** 上游硬截止，Unix **秒**。 */
    readonly expiresAt: number;
}
export interface StepCodeCliLoginInitInput {
    readonly profile: StepCodeProfile;
    readonly pollToken: string;
    readonly client: StepCodeClientInfo;
    readonly fetchFn?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly env?: NodeJS.ProcessEnv;
}
/**
 * POST {authBase}/api/stdhttp/v1/cli-login/init。
 *
 * 请求体（逐字 index.ts:126-135）：profile、**origin**（授权中心的源站，不是模型面）、
 * client 审计信息。
 *
 * 授权页 URL **客户端自己拼**（逐字 login-client.ts:139-141）：服务端可能返回
 * authorize_url，但那个值是从 CLI 看过去的（重定向到 CLI 而不是浏览器），
 * 对「人在浏览器里点」这件事没有意义，所以只认自己拼的。
 *
 * 响应校验三件事，缺一即 protocol 错误：flow_id 合 FLOW_ID_PATTERN、
 * poll_interval_sec >= 1、expires_at > 0。
 */
export declare function initStepCodeCliLogin(input: StepCodeCliLoginInitInput): Promise<StepCodeLoginInit>;
/** 一次轮询的三种结果（逐字 StepCliLoginPoll，login-client.ts:61-68）。 */
export type StepCodeLoginPoll = {
    readonly state: 'pending';
} | {
    readonly state: 'ready';
    readonly apiKey: string;
    readonly uid?: string;
} | {
    readonly state: 'failed';
    readonly reason: 'denied' | 'unknown';
};
export interface StepCodeCliLoginPollInput {
    readonly profile: StepCodeProfile;
    readonly pollToken: string;
    readonly flowId: string;
    readonly fetchFn?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly env?: NodeJS.ProcessEnv;
}
/**
 * GET {authBase}/api/stdhttp/v1/cli-login/poll/{encodeURIComponent(flow_id)}。
 *
 * 三种 state 各自的下一步不同，所以分开建模：
 *
 * - pending：继续等。
 * - ready：取 credential.api_key（必须非空）与**顶层**可选 uid。
 * - failed：**只有字面 denied** 归为「用户在浏览器里拒绝了」；其余 reason 一律
 *   归为「未知失败」——两者的下一步不同（再点一次 vs 等上游恢复）。
 * - 其它 state：protocol 错误（对面不是我们以为的那个服务端）。
 *
 * 逐字照抄 login-client.ts:174-209，包括 flow_id 的二次校验：形状不对的 flow_id
 * 说明 URL 被污染或上游改版，重发多少次都一样。
 */
export declare function pollStepCodeCliLogin(input: StepCodeCliLoginPollInput): Promise<StepCodeLoginPoll>;
export interface WaitForStepCodeLoginInput {
    readonly init: StepCodeLoginInit;
    readonly profile: StepCodeProfile;
    readonly pollToken: string;
    readonly fetchFn?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly env?: NodeJS.ProcessEnv; /**
     * 外层登录自己的截止（Unix 毫秒）。可选。
     *
     * 官方只有服务端 expires_at 一个截止（login-polling.ts:20-25），而外层登录另有
     * 一个本地总时限；两个都实现时取**先到者**，否则本地时限形同虚设。
     */
    readonly localDeadline?: number;
}
/**
 * 轮询直到拿到凭据、用户拒绝，或到达截止。
 *
 * 逐字照抄 login-polling.ts:21-51，包括它的两条：
 *
 * - 间隔 clamp 到 [1s, 60s]：上游可以让我们慢一点，但不能让一次轮询停几分钟。
 * - 截止 = init.expiresAt * 1000（服务端的硬截止），不是本地猜测的时长；
 *   外层登录（beginStepCodeLogin）另有自己的总时限，两者取先到者。
 *
 * 重试判定走 isRetryableStepCodeLoginError：可重试的错误被吞掉继续下一轮，
 * 不可重试的直接抛出。
 */
export declare function waitForStepCodeLogin(input: WaitForStepCodeLoginInput): Promise<{
    readonly apiKey: string;
    readonly uid?: string;
}>;
/**
 * 本线路落盘用的凭据形态（逐字 index.ts:301-306 的 OAuthCredentials）。
 *
 * 三个字段各有其存在的理由：
 *
 * - refresh 是**静态哨兵**（STATIC_REFRESH_TOKEN）。它不是可用的 refresh token，
 *   而是「这份凭据没有刷新链」的显式声明——官方 refreshStepOAuth 见到不是它的
 *   refresh 就抛错，所以任何别的进程/版本都能认出这份凭据。
 * - expires 恒为 STATIC_EXPIRES_AT（Number.MAX_SAFE_INTEGER）。它是「永不过期」的写法，
 *   **不是**异常数据：读回时不得把它当成坏值（JSON 存不下 Infinity，所以取 MAX）。
 * - profile 是区域的唯一来源（计划 §1）：api.stepfun.ai 与 api.stepfun.com 互不通用。
 */
export interface StepCodeStoredCredential {
    readonly type: 'oauth';
    readonly access: string;
    readonly refresh: string;
    readonly expires: number;
    readonly profile: StepCodeProfile;
    readonly uid?: string;
}
/** 从一次成功登录的结果造出凭据（uid 不合格时已经被丢掉，这里只做装配）。 */
export declare function stepCodeCredentialFromLogin(profile: StepCodeProfile, ready: {
    readonly apiKey: string;
    readonly uid?: string;
}): StepCodeStoredCredential;
/**
 * 手动粘贴 Platform API Key（按量计费的两条 profile）造出的凭据。
 *
 * 形状与浏览器登录**完全一致**：同一条线路上两种来源的凭据在池里不该被区别对待
 *（Step 的 api_key 本身就不分来源）。
 */
export declare function stepCodeCredentialFromApiKey(profile: StepCodeProfile, apiKey: string, uid?: string): StepCodeStoredCredential;
/** 一份值是不是本线路的凭据形态。 */
export declare function isStepCodeStoredCredential(value: unknown): value is StepCodeStoredCredential;
/** 凭据不可刷新的那句说明（号池与路由共用同一句）。 */
export declare const STEP_CODE_CREDENTIAL_NOT_REFRESHABLE: string;
/**
 * 「刷新」这条路径的**显式拒绝**。
 *
 * 它必须是一个被拒绝的 Promise 而不是一次静默的空操作：调用方（号池的 refresh 钩子、
 * 适配器的 401 处理）会把错误报给用户，而静默返回旧凭据会让一次注定失败的请求
 * 看起来像成功了。逐字照抄官方 refreshStepOAuth（index.ts:316-321）的拒绝语义。
 */
export declare function refreshStepCodeCredential(credential: StepCodeStoredCredential): Promise<StepCodeStoredCredential>;
/** 卡片轮询的状态切片。返回副本，调用方改不到内部状态。 */
export declare function getStepCodeLoginStatus(): StepCodeLoginFlowStatus;
/** 取消进行中的流程并回到 idle（设置卡片的「取消」）。 */
export declare function resetStepCodeLogin(): void;
/** 看看有没有一份已经拿到、还没被取走的凭据（纯内存读）。 */
export declare function peekStepCodeLoginCredential(): StepCodeStoredCredential | null;
/** 取走那份凭据并清空（同一份凭据只该被落盘一次）。 */
export declare function takeStepCodeLoginCredential(): StepCodeStoredCredential | null;
export interface StepCodeLoginOptions {
    /** 测试缝。默认 fetch。 */
    fetchFn?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    /** 审计信息；缺省用 version 造一个（version 缺省是 unknown）。 */
    client?: StepCodeClientInfo;
    version?: string;
    /**
     * 完成的登录写到哪里（接入层传号池或凭据存储的保存函数）。
     *
     * 没有它时凭据只是留在内存里，等 takeStepCodeLoginCredential() 取走——
     * 本模块**不持有凭据存储**，所以不替接入层猜该写哪儿。
     */
    onSave?: (credential: StepCodeStoredCredential) => Promise<unknown>;
    /** 本地总时限；缺省 10 分钟，可由 STEP_OAUTH_TIMEOUT_MS 覆盖。 */
    timeoutMs?: number;
}
/**
 * 开始一次云端轮询登录：**不开本地端口**，用户去浏览器里人工确认。
 *
 * 流程跑在 host 上（controller + flow），设置卡片只跟随 getStepCodeLoginStatus——
 * 与其余各线路的登录面同构。
 *
 * 两个截止取先到者：上游的 expires_at（硬截止，逐字 login-polling.ts:20-25）
 * 与本地总时限（默认 10 分钟，可由 STEP_OAUTH_TIMEOUT_MS 覆盖）。
 */
export declare function beginStepCodeLogin(profile: StepCodeProfile, options?: StepCodeLoginOptions): Promise<StepCodeLoginFlowStatus>;
//# sourceMappingURL=oauth.d.ts.map