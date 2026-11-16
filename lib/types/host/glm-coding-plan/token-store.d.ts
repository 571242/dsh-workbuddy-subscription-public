/**
 * GLM（ZCode 账号）线路的凭据 / 模型设置 / 偏好三件套。
 *
 * 本线路**自己拥有**它的凭据文件：不像 minimax-code 那样读桌面客户端的 auth.json，
 * 也不像 claude 那样把一份 adopt 快照当权威。浏览器 OAuth 登录与 adopt 走的是同一条
 * 兑换链（计划 D4），两者产出**同一种** `GlmCodingPlanKey`，所以下游（号池、适配器）
 * 不必区分来源——除了**一件**事：
 *
 * - adopt 来的账号**永不可刷新**。它只是本机 ZCode 客户端登录态的一份拷贝，
 *   上游那边才是权威；计划 §3.6 又明确「没有 refresh 接口」，所以拷贝一旦落后，
 *   唯一能做的是让它失效并让用户重新登录，而不是花钱去刷新它。
 * - 浏览器登录来的账号可以在 access_token 仍然有效时被上游拒绝之后**重新兑换**一把
 *   Coding Plan Key（兑换链的输入就是 access_token），这不算「刷新」，是重跑一次链。
 *
 * 这条区别必须落在**凭据本身**上而不是落在号池的某个内存标记上：号池文件会被重新读、
 * 会被另一处代码改写，一个只活在内存里的判断会在重启后消失，于是 adopt 账号被刷新一次
 * ——那是一次拿别人的登录态去花额度的请求。因此这里用 adopt.ts 自己的判别式字段
 * （`adopted: true` + `source: 'zcode-client'` + `codingPlan`）落盘，
 * `isAdoptedZcodeCredential()` 对**整份凭据对象**直接给出答案。
 *
 * 三件套的分工与兄弟线路一致：凭据走 DPAPI / Keychain / Secret Service；
 * 模型设置是明文 JSON，带写后回读校验；偏好在 harness 还提供 register 接缝时注册进
 * 设置文档，没有就落回那个 JSON 文件。
 */
import type { CredentialStore } from '../token-store.ts';
import { type ContextWindowOverridePatch } from '../common/context-window-overrides.ts';
import type { GlmReasoningEffort } from '../../shared/glm-coding-plan-contracts.ts';
import { listModelIds } from './model-catalog.ts';
import { ZCODE_CREDENTIAL_SOURCE, type GlmAdoptedCredential } from './adopt.ts';
import type { GlmCliCredentials } from './oauth.ts';
import type { GlmCodingPlanKey } from './exchange.ts';
/** 本线路在设置文档里注册的命名空间。 */
export declare const GLM_CODING_PLAN_PREFERENCES_NAMESPACE = "dsh-glm-coding-plan";
/**
 * 这份凭据是「登进来的」还是「捡回来的」。
 *
 * 它不是一个偏好设置：它决定号池敢不敢对这份凭据动任何写操作，所以与凭据同生共死。
 */
export type GlmCodingPlanCredentialOrigin = 'browser' | 'adopt';
/**
 * 一份可服务请求的 Coding Plan 凭据。
 *
 * 真正发请求用的是 `codingPlan.codingPlanKey`（`{apiKeyId}.{secretKey}`）：模型面把它
 * 放进 Bearer / x-api-key，配额面把它**裸着**放进 authorization（两种写法的证据见
 * `mapper-anthropic.ts` 与 `client.ts` 的注释）。其余字段分三类：
 *
 * - 兑换链的输入与留档（accessToken 等）：重新兑换一把 Key 时唯一的输入；
 * - 非机密的账号事实（userId / email）：卡片渲染用；
 * - adopt 判别式（`adopted` / `source` / `sourcePath`）：见文件头。
 *
 * 区域不另存一份：它由 `codingPlan.region` 决定，而区域是**凭据的属性**（计划 §3.3），
 * 一个池里可以同时有两区账号。
 */
export interface GlmCodingPlanCredentials {
    /** 兑换链产物（已含验活）。 */
    codingPlan: GlmCodingPlanKey;
    origin: GlmCodingPlanCredentialOrigin;
    /** OAuth access_token：重新兑换 Coding Plan Key 的唯一输入。 */
    accessToken: string;
    /** 上游同包下发，但**没有**对应的刷新接口（计划 §3.6），只留档与诊断。 */
    refreshToken: string | null;
    userId: string | null;
    email: string | null;
    displayName: string | null;
    /** 本插件接管这份登录态的时刻（Unix 毫秒）。 */
    authenticatedAt: number;
    /**
     * 判别式，取字面量 `true`。`isAdoptedZcodeCredential()` 读的就是它加上 `source` 与
     * `codingPlan`；一个布尔比一句注释更难被忽略，而这条判断一旦失效就是一次越权刷新。
     */
    adopted?: true;
    /** 恒为 `ZCODE_CREDENTIAL_SOURCE`（'zcode-client'）。 */
    source?: typeof ZCODE_CREDENTIAL_SOURCE;
    /** 读的是哪个文件，卡片照它显示。 */
    sourcePath?: string;
}
/**
 * 校验并归一化一份落盘的凭据。
 *
 * 缺的字段一律拒绝而不是补默认值：缺 `codingPlanKey` 的凭据发出去一定是一次 401，
 * 而「给它编一个失效时刻」只会让号池相信它还能用。
 */
export declare function parseGlmCodingPlanCredentials(value: unknown): GlmCodingPlanCredentials;
/** 一份凭据是不是 adopt 快照（号池据此拒绝刷新它）。 */
export declare function isAdoptedCredential(credentials: GlmCodingPlanCredentials): boolean;
/**
 * 浏览器登录的凭据 → 落盘形态。
 *
 * 兑换链已经跑完并验过活，这里只做形状转换。登录的部署与兑换的部署必须一致：
 * 区域是凭据的属性，而 `codingPlan.region` 记的是兑换那一侧的事实。
 */
export declare function credentialsFromCliLogin(session: GlmCliCredentials, codingPlan: GlmCodingPlanKey): GlmCodingPlanCredentials;
/**
 * adopt 来的凭据 → 落盘形态。
 *
 * 判别式与 `sourcePath` 一并写入，让 `isAdoptedZcodeCredential()` 在**任何一次读回**之后
 * 仍然给出同一个答案——这是「永不可刷新」能跨重启成立的全部原因。
 */
export declare function credentialsFromAdopt(adopted: GlmAdoptedCredential): GlmCodingPlanCredentials;
/** 凭据文件路径（本线路自己拥有；号池把主账号镜像到这里）。 */
export declare function credentialPath(): string;
/** 模型设置文件路径。 */
export declare function modelSettingsPath(): string;
/**
 * 加密凭据存储；明文 JSON 只是迁移来源。
 *
 * 与 kimi-code 同构：读回加密值之后立刻删掉明文（一份别的进程能读到的凭据副本不该留着），
 * 写入之后回读比对，避免「写成功了但下一次启动读到的是别的东西」。
 */
export declare class GlmCodingPlanCredentialStore {
    private readonly filePath;
    private readonly backend;
    constructor(filePath?: string, backend?: CredentialStore<GlmCodingPlanCredentials>);
    /** 人可读的存储位置说明（Windows DPAPI / macOS Keychain / Linux Secret Service）。 */
    path(): string;
    private serialize;
    private removeLegacy;
    private saveVerified;
    read(): Promise<GlmCodingPlanCredentials | null>;
    write(credentials: GlmCodingPlanCredentials): Promise<void>;
    delete(): Promise<void>;
}
/**
 * 本线路设置文档里**用户自己**的那一半。
 *
 * 随包目录 `GLM_MODEL_CATALOG` 刻意不存：它跟着代码走，存一份副本会让一个落后一个
 * 版本的设置文件读到这份构建已经不再服务的模型列表。
 */
export interface GlmCodingPlanModelSettings {
    /** 线路总开关。只有显式 false 才是关闭。 */
    enabled?: boolean;
    /** DSH 提供给会话模型选择器的目录 id。 */
    enabledModelIds: string[];
    /** 逐模型上下文窗口覆盖；缺省用目录声明值。 */
    contextWindowOverrides: Record<string, number>;
    /** 会话没指定档位时用的档位；null 表示各模型用自己的默认。 */
    defaultReasoningEffort: GlmReasoningEffort | null;
    /** 手动指定下一个请求使用的账号；null 交回号池调度。 */
    selectedAccountId: string | null;
}
/**
 * 一个设置补丁。
 *
 * `contextWindowOverrides` 是补丁而不是整张表：`null` 必须能作为一个**值**活下来，
 * 它是卡片上的「恢复目录默认」，删掉恰好一个键。
 */
export interface GlmCodingPlanSettingsPatch {
    enabled?: boolean;
    enabledModelIds?: string[];
    contextWindowOverrides?: ContextWindowOverridePatch;
    defaultReasoningEffort?: GlmReasoningEffort | null;
    selectedAccountId?: string | null;
}
/**
 * 路由与适配器共用的接缝。
 *
 * `status()` 同步：它在模型选择器查询与卡片轮询上被调用，两者都只需要一份快照；
 * 把它做成 promise 会让每一条热路径都去等一次磁盘读，而它的变化速度是人的速度。
 */
export interface GlmCodingPlanPreferenceStore {
    /**
     * 文件后端是异步预热的，所以 `status()` 在那次读落定之前先回答出厂默认值。
     * 启动时按偏好行动的一方必须先 await 它，否则它行动在默认值而不是用户的选择上。
     */
    ready(): Promise<void>;
    status(): GlmCodingPlanModelSettings;
    update(patch: GlmCodingPlanSettingsPatch): Promise<GlmCodingPlanModelSettings>;
}
/**
 * 把一个补丁应用到一份设置文档上。
 *
 * 合并逻辑住在两个 store 之外：register 后端必须用与文件后端**同一套**规则归一化 scope 的值，
 * 同一份逻辑写两遍就是两条存储路径第一次学到新字段时开始漂移的方式。
 */
export declare function mergeGlmCodingPlanSettings(current: GlmCodingPlanModelSettings, patch: GlmCodingPlanSettingsPatch): GlmCodingPlanModelSettings;
/**
 * 凭据旁边的设置文件。
 *
 * 没有 register 接缝的 harness（0.1.7，以及无头 host）启动时读的就是它，所以它必须扛得住崩溃：
 * 写入走「临时文件 + rename」，写完立刻回读比对再报告成功。
 */
export declare class GlmCodingPlanModelSettingsStore {
    private readonly filePath;
    constructor(filePath?: string);
    path(): string;
    read(): Promise<GlmCodingPlanModelSettings>;
    write(settings: GlmCodingPlanModelSettings): Promise<void>;
    /**
     * 在与凭据写入同一条按路径排队的锁里做「读-改-写」。
     *
     * 没有它，两个同时落地的补丁各读同一份文档，后一个写会把前一个悄悄丢掉——
     * 一次没有任何报错的模型选择丢失。
     */
    updateSettings(patch: GlmCodingPlanSettingsPatch): Promise<GlmCodingPlanModelSettings>;
}
/**
 * 把模型选择绑到 DSH 设置文档（harness 还提供 register 接缝时），
 * 否则绑到凭据旁边的 JSON 文件。
 */
export declare function registerGlmCodingPlanPreferenceStore(settings?: unknown, fallbackStore?: GlmCodingPlanModelSettingsStore): GlmCodingPlanPreferenceStore;
export { listModelIds };
//# sourceMappingURL=token-store.d.ts.map