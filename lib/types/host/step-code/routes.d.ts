/**
 * Step Code（Step Plan 订阅）线路的 web 路由。
 *
 * 路由表与客户端 `src/client/step-code/api.ts` 里那一份是**同一个约定**，两边必须逐条对上：
 *
 * ```
 * GET  /status           -> StepCodeStatusDto（页面的唯一读口）
 * POST /settings         StepCodeSettingsUpdateDto -> StepCodeStatusDto
 * POST /accounts         { action, accountId } / { action:'strategy', strategy } -> StepCodeStatusDto
 * POST /login/start      { profile } -> StepCodeLoginFlowStatus
 * GET  /login/status     -> StepCodeLoginFlowStatus
 * POST /login/cancel     { } -> StepCodeLoginFlowStatus
 * POST /login/manual     { profile, apiKey } -> StepCodeStatusDto（请求体带凭据，不在冻结契约里）
 * POST /adopt            { } -> StepCodeAdoptResultDto
 * POST /connection/test  { } -> StepCodeConnectionDto
 * POST /quota            { } -> StepCodeStatusDto（强制刷新额度）
 * POST /catalog/refresh  { } -> StepCodeStatusDto
 * POST /quota/credential { mode:'password'|'manual'|'clear', account?, password?, token? } -> StepCodeStatusDto
 * ```
 *
 * 信封：除 `/adopt` 与 `/connection/test` 外一律 `{ ok, value }`，因为客户端走的
 * `createLineApi` 会把信封拆掉、直接把 `value` 当 DTO 用；这两条路由的契约把 DTO 定在
 * 顶层，所以它们**直接**返回 DTO（`createLineApi` 对没有布尔 `ok` 的应答原样返回整体）。
 *
 * 同源校验不可省：每个 POST 都过 `isSameOriginMutation`，与兄弟线路同一份实现。
 *
 * 本文件**不持有任何凭据，也不算任何用量**：落盘与兑换交给 token-store / account-pool /
 * oauth / adopt，上游 I/O 交给 client.ts，额度快照的累计交给 adapter.ts 的缓存累计器。
 * 它只做三件事：读设置、组装状态面、把同源的 POST 翻译成对上面那些模块的一次调用。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { AccountRotationStrategy } from '../../shared/account-pool-contracts.ts';
import { type StepCodeAccountSummaryDto, type StepCodeCacheStatsDto, type StepCodeProfile, type StepCodeQuotaCredentialStatusDto, type StepCodeQuotaSnapshotDto, type StepCodeStatusDto } from '../../shared/step-code-contracts.ts';
import { type StepCodeAccountPool } from './account-pool.ts';
import { type StepCodeModelEntry } from './model-catalog.ts';
import { StepCodeModelSettingsStore, StepCodeQuotaCredentialStore, type StepCodeModelSettings, type StepCodePreferenceStore, type StepCodeSettingsPatch } from './token-store.ts';
/** 一个请求寻址的子路径（剥掉契约前缀）。 */
export declare function stepCodeSubPathOf(requestUrl: string): string;
/**
 * 设置来源：register 后端与文件后端形状不同，这里收敛成一个。
 *
 * `status()` 允许是 promise：文件后端要读盘，而卡片每 60 秒轮询一次状态。
 * register 后端同步返回，实现方不必知道自己被允许同步。
 */
export interface StepCodeSettingsSource {
    status(): StepCodeModelSettings | Promise<StepCodeModelSettings>;
    update(patch: StepCodeSettingsPatch): Promise<StepCodeModelSettings>;
}
/** 设置来源：register 后端优先，没有就落回凭据旁边的 JSON 文件。 */
export declare function stepCodeSettingsSource(preferences: StepCodePreferenceStore | undefined, fallback: StepCodeModelSettingsStore): StepCodeSettingsSource;
/**
 * 用平台默认浏览器打开一个 URL（尽力而为）。
 *
 * 与其余各线路同一份形状。启动失败是可恢复的：同一个 URL 始终在登录状态里，
 * 卡片也把它渲染成一个可点的链接，所以这里**永远不抛**。
 */
/**
 * 用系统默认程序打开一个 URL。
 *
 * 它**不是**默认行为（见下面 `registerStepCodeRoutes` 里那句「缺省不开浏览器」）：
 * 授权页由设置卡片自己打开，host 只在显式注入 `openBrowser` 时才代劳——需要这种行为的
 * 部署可以直接把这个函数作为注入口传进去，而不是让每条线路各自复制一份 spawn 逻辑。
 */
export declare function openPlatformBrowser(url: string): void;
export interface StepCodeRouteOptions {
    fetchFn?: typeof fetch;
    /** 本插件是否正在服务这条 Provider 路由；每次状态都重新读。 */
    serving?: boolean | (() => boolean);
    /** 路由被别的适配器占用时的诊断文案；每次状态都重新读。 */
    conflict?: string | null | (() => string | null);
    /** 号池；本进程装了才有。 */
    accountPool?: StepCodeAccountPool;
    /** 额度凭据的存储；缺省按平台加密矩阵落在自己的文件上。 */
    quotaCredentialStore?: StepCodeQuotaCredentialStore;
    /**
     * 打开授权页的方式；缺省用平台默认浏览器。
     *
     * 显式传入一个空函数就把这条外部副作用整个摘掉（测试的用法，与 GLM 的注入口同形）。
     * 卡片自己也会 `window.open` 同一个链接，所以注入空函数就能只留一处开浏览器的地方。
     */
    openBrowser?: (url: string) => void;
    /** 环境变量读取处；缺省 process.env，且**调用时**读取。 */
    env?: NodeJS.ProcessEnv;
}
/** 号池切片的收紧形状（本线路状态面实际持有的那一部分）。 */
export interface StepCodePoolSlice {
    accounts: StepCodeAccountSummaryDto[];
    rotationStrategy: AccountRotationStrategy;
    activeAccountId?: string;
}
export interface StepCodeStatusSources {
    options: StepCodeRouteOptions;
    settings: StepCodeSettingsSource;
    /** 下一次登录要用的 profile（区域由它唯一决定）。 */
    profile: StepCodeProfile;
    /** 号池切片：唯一装配它的地方是 account-pool 的 stepCodePoolStatusSlice（这里只收紧形状）。 */
    pool: StepCodePoolSlice;
    /** 本次读到的账号（卡片渲染用，不带任何凭据）。 */
    account: StepCodeAccountSummaryDto | null;
    /** 这个部署当前的模型目录（缓存读，轮询不联网）。 */
    catalog: readonly StepCodeModelEntry[];
    /** 本进程为当前账号记住的额度快照。 */
    quota: StepCodeQuotaSnapshotDto | null;
    /** 额度凭据的状态切片。 */
    quotaCredential: StepCodeQuotaCredentialStatusDto;
    /** 本次应答背后是否正在刷新额度。 */
    quotaRefreshing: boolean;
    /** 上一次额度读失败的原因；没有快照可渲染时为 null。 */
    quotaError: string | null;
    /** 本进程累计的缓存用量；尚无样本时为 undefined（客户端据此渲染占位符）。 */
    cacheStats: StepCodeCacheStatsDto | undefined;
}
/**
 * 组装 `StepCodeStatusDto`。
 *
 * 号池读不出来不能带倒整张卡：连接那一半仍然值得渲染，只是账号列表是空的。
 */
export declare function getStepCodeStatus(sources: StepCodeStatusSources): Promise<StepCodeStatusDto>;
/**
 * 注册本线路的路由。
 *
 * 本文件不持有凭据：账号的落盘与轮转在号池，额度凭据在它自己那份加密存储里，
 * 而线路凭据由号池镜像。设置的唯一写入点是 `POST /settings`。
 */
export declare function registerStepCodeRoutes(ctx: Context, settings: StepCodeSettingsSource, options?: StepCodeRouteOptions): () => void;
//# sourceMappingURL=routes.d.ts.map