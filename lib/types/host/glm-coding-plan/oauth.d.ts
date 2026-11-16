/**
 * 浏览器 OAuth 登录（ZCode 平台中转轮询）。
 *
 * 这条线**不是**本地回调、也不是 RFC 8628 device code：授权发生在浏览器，
 * 但令牌的落地由 ZCode 平台的服务端中转页完成，本插件只做两件事——
 * 开一次流、按上游给的节奏轮询它（计划 §3.1，证据等级 A：
 * `apps/zcode-cli/packages/adapters/src/auth/cli-oauth.ts:88-238`、
 * `bootstrap/src/auth-login.ts:41`）。
 *
 * 三个必须记住的上游事实：
 *
 * 1. **开流与轮询都用 pollToken 鉴权**，不是 cookie、不是 session：
 *    `POST {ZCODE_API_BASE}/oauth/cli/init` 与
 *    `GET {ZCODE_API_BASE}/oauth/cli/poll/{flow_id}` 的头都是
 *    `Authorization: Bearer <pollToken>`，而 pollToken 是本地生成的
 *    `randomBytes(32).toString('hex')`——它不是登录凭据，只是把一次开流
 *    与它的轮询绑在一起，所以它不进凭据存储。
 * 2. **授权参数里没有 PKCE**（计划 §3.1、`PKCE_SUPPORTED = false`）：
 *    本插件照抄上游形状，不自带 `code_challenge`。
 * 3. **回调由服务端中转页收走**：`{zcode.z.ai}/app/oauth/login?redirect=zcode://oauth/callback`
 *    是一个网页而不是本机端口，所以远程会话 / 防火墙下浏览器照样能把
 *    授权码交到上游手里——这也是「手工粘贴兜底」有意义的原因（见
 *    {@link submitLoginCode}）。
 *
 * 轮询错误语义（计划 §3.1，证据等级 B，逆向实测量化出来的四条，逐条照抄）：
 *
 * - 4xx（**除 408 / 429**）→ 致命
 * - 信封 `code !== 0`      → 致命
 * - 未知 `status`          → 致命
 * - 5xx / 网络错误 / 畸形 200 → 按 pending 重试
 *
 * 分界线是「上游给了没有结论」还是「上游给了结论」：4xx 说「这个流程不行」，
 * 5xx 与畸形 200 只是这一次没拿到结论，重试到 `expires_at` 才是真正的上界。
 */
import type { GlmLoginFlowStatus, GlmRegion } from '../../shared/glm-coding-plan-contracts.ts';
/**
 * 致命的登录失败：重试同一个流程不会改变结果。
 *
 * 计划 §3.1 的三条致命语义（4xx、信封 `code !== 0`、未知 status）都归到这里，
 * 另外开流响应的字段校验失败也是同一类——上游已经给了结论，只是结论是「你发的请求不对」。
 */
export declare class GlmLoginFatalError extends Error {
    constructor(message: string);
}
/** 一次开流的上游响应，字段名来自 `CLI_INIT_RESPONSE_FIELDS`（逐字：`cli-oauth.ts:138,172`）。 */
export interface GlmCliInit {
    flowId: string;
    authorizeUrl: string;
    /** 上游失效时刻（Unix 毫秒，由 `expires_at` 秒换算）。 */
    expiresAt: number;
    /** 上游建议的轮询间隔（秒）；实际间隔还要过 `POLL_MIN_INTERVAL_MS` 下限。 */
    pollIntervalSec: number;
    /** 本次流程的 pollToken，只有开流与轮询会用到它。 */
    pollToken: string;
}
export interface GlmRequestOptions {
    /** 注入的 fetch；测试全部走它，所以本文件离网。 */
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** 环境覆盖（`DSH_GLM_*`），读取时机与 types.ts 的覆盖表一致：调用时读。 */
    env?: NodeJS.ProcessEnv;
}
/**
 * 开一次流：`POST {ZCODE_API_BASE}/oauth/cli/init`。
 *
 * 请求体只有 `{"provider": "zai" | "bigmodel"}`——区域到上游 provider 名的翻译只在这一处
 * （`CLI_PROVIDER_BY_REGION`），翻译错会让开流成功但授权落到另一个部署的账号上。
 */
export declare function requestCliInit(region: GlmRegion, options?: GlmRequestOptions): Promise<GlmCliInit>;
/** 一次登录成功后的凭据。host 侧专用，**不进任何共享契约**。 */
export interface GlmCliCredentials {
    region: GlmRegion;
    /** 兑换链的输入（计划 §3.2）：它是 `POST /api/auth/z/login` 的 `token`。 */
    accessToken: string;
    /**
     * 上游同包下发的 refresh_token。
     *
     * **没有**对应的刷新接口（计划 §3.6：官方 `oauthService.ts:972-975` 直接抛错），
     * 所以这个值只做留档与诊断，**不要**据此实现任何刷新路径。
     */
    refreshToken: string | null;
    /**
     * 就绪载荷里的 `token`（ZCode 平台自己的 JWT）。
     *
     * 本线路不拿它做任何鉴权，只留档：计划 §9 明确记录 `data.token` 的完整 payload
     * 未验证，缺一份真实的解码样本。
     */
    zcodeToken: string | null;
    userId: string | null;
    email: string | null;
    displayName: string | null;
    /** 上游给了头像地址时只记「有」，不落原始字节。 */
    hasAvatar: boolean;
    authenticatedAt: number;
}
/** 一次轮询的结论。致命不是一个结论，是一个异常（{@link GlmLoginFatalError}）。 */
export type GlmPollOutcome = {
    kind: 'pending';
    progress: string;
} | {
    kind: 'ready';
    credentials: GlmCliCredentials;
};
/**
 * 轮询一次：`GET {ZCODE_API_BASE}/oauth/cli/poll/{flow_id}`。
 *
 * 返回值只有 pending / ready 两种；「该停了」的情况按计划 §3.1 分三类抛出：
 * 4xx（除 408/429）与未知 status 抛 {@link GlmLoginFatalError}，
 * 而 5xx、网络错误与畸形 200 都返回 pending——这四种在上游眼里都是「这次没有结论」。
 */
export declare function pollCliFlow(flow: {
    flowId: string;
    pollToken: string;
    region: GlmRegion;
}, options?: GlmRequestOptions): Promise<GlmPollOutcome>;
/**
 * 截止时刻：`min(now + 5min, expires_at * 1000)`（逐字：`auth-login.ts:41`）。
 *
 * 取小者的理由写在 `OAUTH_FLOW_TIMEOUT_MS` 的注释里：`expires_at` 才是上游真正的失效时刻，
 * 本地 5 分钟只是兜底。
 */
export declare function flowDeadlineMs(now: number, expiresAt: number): number;
/** 轮询间隔：`max(1000ms, poll_interval_sec * 1000)`（逐字：`cli-oauth.ts:106-115`）。 */
export declare function pollIntervalMs(pollIntervalSec: number): number;
/** 一次登录流程的对外状态：冻结契约的 `GlmLoginFlowStatus` 加上本插件自己的会话 id。 */
export interface GlmWebLogin extends GlmLoginFlowStatus {
    /**
     * 本次流程的会话 id。卡片轮询与取消都用它；
     * `GlmLoginFlowStatus` 里没有这个字段，因为「会话 id」是 host 的实现细节，
     * 不该出现在共享契约里。
     */
    loginId: string;
    /** 就绪时的凭据；其它状态为 null。这个字段**不出这个模块**。 */
    credentials: GlmCliCredentials | null;
}
/** 登录选项。 */
export interface BeginWebLoginOptions extends GlmRequestOptions {
    region?: GlmRegion;
    /** 打开浏览器的方式；缺省用本平台的 `openBrowser`。测试注入一个空函数即可。 */
    openBrowser?: (url: string) => void;
}
/**
 * 开一次浏览器登录：开流 → 尽力打开授权页 → 落一条 pending 状态。
 *
 * 这里**不开轮询循环**：卡片通过 `/login/poll` 显式驱动，host 自己在后台轮询的话，
 * 用户关掉设置页之后还会继续打上游。
 */
export declare function beginWebLogin(options?: BeginWebLoginOptions): Promise<GlmWebLogin>;
/** 读某次登录（或最近一次）的公开状态。 */
export declare function getWebLoginStatus(loginId?: string): GlmWebLogin | null;
/** 取消一次登录，让后续轮询无从恢复。 */
export declare function cancelWebLogin(loginId?: string): boolean;
/** 测试缝：忘掉所有会话与最近一次流程。 */
export declare function resetWebLogins(): void;
export interface PollWebLoginOptions extends GlmRequestOptions {
    /**
     * 就绪后把凭据交出去（W6 在这里落盘并把账号加进号池）。
     *
     * 本模块**不持有凭据存储**，所以持久化失败不吞：吞掉的话卡片会显示
     * 「登录成功」而凭据根本没落盘。
     */
    onAuthenticated?: (credentials: GlmCliCredentials) => Promise<void> | void;
}
/**
 * 轮询一次，把状态机往前推一格。
 *
 * 三种停下来的方式都返回状态而不抛：卡片轮询的语义是「读状态」，
 * 让它去 catch 异常只会把「上游说了不行」显示成 500。
 */
export declare function pollWebLogin(loginId: string, options?: PollWebLoginOptions): Promise<GlmWebLogin>;
/**
 * 从用户粘回来的东西里取出授权码。
 *
 * 两种输入都是自然的（照 9ad8a53 那份 `extractAuthorizationCode` 的思路）：
 * 地址栏里回不来的那串裸 code，以及整条回调 URL。
 * 回调 URL 有两个易错点，都在这里兜住：自定义 scheme（`zcode://oauth/callback?code=…`）
 * 的 query 一样能解析，而有些浏览器把参数放进 fragment（`#code=…`）。
 * 认不出来的输入返回空串——宁可让调用方报「这不像授权码」，也不要把它当 code 提交上去。
 */
export declare function extractAuthorizationCode(raw: string): string;
/**
 * 从回调里取 `error` / `error_description`。
 *
 * 用户在授权页点「拒绝」时，上游会把错误塞进回调而不是给我们一个 code。
 * 那是用户的明确决定，不该被当成「还在等」，所以单独读出来判致命。
 */
export declare function extractAuthorizationError(raw: string): string;
/**
 * 用户把 code（或整条回调 URL）粘回来时调用。
 *
 * 存在的理由：防火墙或远程会话下浏览器可能走不到中转页，这时卡片会一直 pending 到超时，
 * 而用户手上明明已经有一个 code。
 *
 * 它做的事是**强制立刻复查一次平台流程**，不是自己拿 code 去换 token——
 * 授权码是服务端中转页（`{zcode.z.ai}/app/oauth/login?redirect=zcode://oauth/callback`）
 * 用同一个 code 换掉的，计划 §3.1 只逐字记录了 `cli/init` 与 `cli/poll` 两个端点，
 * 客户端直换端点**未验证**。所以 code 在本插件里的唯一作用是「上游可能已经就绪了，去看一眼」。
 *
 * @throws 没有进行中的流程，或粘贴内容里既没有 code 也没有 error。
 */
export declare function submitLoginCode(raw: string, options?: {
    loginId?: string;
}): GlmWebLogin;
/**
 * 用平台默认浏览器打开一个 URL。
 *
 * 与其余各线路同一份形状（kimi-code / claude / command-code / antigravity 都有一份）。
 * 全部按尽力而为处理：调用方永远会展示同一个 URL，所以启动失败是可恢复的。
 */
export declare function openBrowser(url: string): void;
//# sourceMappingURL=oauth.d.ts.map