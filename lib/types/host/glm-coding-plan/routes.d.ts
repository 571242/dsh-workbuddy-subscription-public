/**
 * GLM（ZCode 账号）线路的 web 路由。
 *
 * 路由表与客户端 `src/client/glm-coding-plan/api.ts` 里那一份是**同一个约定**，两边必须逐条对上：
 *
 * ```
 * GET  /status           -> GlmStatusDto（页面的唯一读口）
 * POST /settings         GlmSettingsUpdateDto -> GlmStatusDto
 * POST /accounts         { action, accountId } / { action:'strategy', strategy } -> GlmStatusDto
 * POST /login/start      { region } -> GlmLoginFlowStatus
 * GET  /login/status     -> GlmLoginFlowStatus
 * POST /login/cancel     { region } -> GlmLoginFlowStatus
 * POST /login/manual     { region, code } -> GlmStatusDto
 * POST /adopt            { region } -> GlmAdoptResultDto
 * POST /connection/test  -> GlmConnectionDto
 * POST /quota            -> GlmStatusDto（强制刷新配额）
 * POST /catalog/refresh  -> GlmStatusDto
 * ```
 *
 * 信封：除 `/adopt` 与 `/connection/test` 外一律 `{ ok, value }`，因为客户端走的
 * `createLineApi` 会把信封拆掉、直接把 `value` 当 DTO 用；这两条路由的契约把 DTO 定在
 * 顶层，所以它们**直接**返回 DTO（`createLineApi` 对没有布尔 `ok` 的应答原样返回整体）。
 *
 * 同源校验不可省：每个 POST 都过 `isSameOriginMutation`，与兄弟线路同一份实现。
 * 本文件不持有任何凭据，所有落盘与兑换都交给 token-store / account-pool / oauth / adopt。
 */
import type { Context } from '@deepseek-ai/cordis';
import { type GlmStatusDto } from '../../shared/glm-coding-plan-contracts.ts';
import { type GlmWebLogin } from './oauth.ts';
import { type GlmCodingPlanCredentials, type GlmCodingPlanModelSettings, type GlmCodingPlanModelSettingsStore, type GlmCodingPlanPreferenceStore, type GlmCodingPlanSettingsPatch } from './token-store.ts';
/** 设置来源：register 后端优先，没有就落回凭据旁边的 JSON 文件。 */
export declare function glmCodingPlanSettingsSource(preferences: GlmCodingPlanPreferenceStore | undefined, fallback: GlmCodingPlanModelSettingsStore): GlmCodingPlanSettingsSource;
import { type GlmCodingPlanAccountPool } from './account-pool.ts';
/** 一个请求寻址的子路径（剥掉契约前缀）。 */
export declare function glmSubPathOf(requestUrl: string): string;
export interface GlmCodingPlanRouteOptions {
    fetchFn?: typeof fetch;
    /** 本插件是否正在服务这条 Provider 路由；每次状态都重新读。 */
    serving?: boolean | (() => boolean);
    /** 路由被别的适配器占用时的诊断文案；每次状态都重新读。 */
    conflict?: string | null | (() => string | null);
    /** 号池；本进程装了才有。 */
    accountPool?: GlmCodingPlanAccountPool;
    /**
     * 打开授权页的方式；缺省是**什么都不做**。
     *
     * 卡片（client/glm-coding-plan/useGlmCodingPlanSection.ts 的 window.open）才是
     * 唯一开浏览器的地方。host 再开一次就是同一场登录弹出两个一模一样的页面——
     * 兄弟线路 claude / command-code 早就把这条收敛掉了，这里的缺省跟着它们走。
     *
     * 这一栏存在的理由是测试：/login/start 一共被十几条路由用例打中，显式传入一个
     * 空函数就把这条外部副作用整个摘掉；只有显式传入时才用传入的那一份。
     */
    openBrowser?: (url: string) => void;
}
/**
 * 设置来源：register 后端与文件后端形状不同，这里收敛成一个。
 *
 * `status()` 允许是 promise：文件后端要读盘，而卡片每次轮询都会问一次状态。
 * register 后端同步返回，实现方不必知道自己被允许同步。
 */
export interface GlmCodingPlanSettingsSource {
    status(): GlmCodingPlanModelSettings | Promise<GlmCodingPlanModelSettings>;
    update(patch: GlmCodingPlanSettingsPatch): Promise<GlmCodingPlanModelSettings>;
}
/** 设置卡片渲染的模型总数（hub overview 与状态共用同一份读数）。 */
export declare function glmCatalogSize(): number;
export interface GlmStatusSources {
    options: GlmCodingPlanRouteOptions;
    settings: GlmCodingPlanSettingsSource;
    /** 登录流程的公开状态（凭据不出这一层）。 */
    latestLogin: GlmWebLogin | null;
    /** 正在跑的配额刷新；缺省表示没有。 */
    quotaRefreshing: boolean;
    /** 上一次配额读失败的原因；读到快照时为 null。缺省表示没有失败可报。 */
    quotaError?: string | null;
    /** 本次读到的账号（卡片渲染用，不带任何凭据）。 */
    account: GlmCodingPlanCredentials | null;
}
/**
 * 组装 `GlmStatusDto`。
 *
 * 号池读不出来不能带倒整张卡：连接那一半仍然值得渲染，只是账号列表是空的。
 */
export declare function getGlmCodingPlanStatus(sources: GlmStatusSources): Promise<GlmStatusDto>;
/**
 * 注册本线路的路由。
 *
 * `store` 只用来读「当前该显示哪个账号」与存储位置说明；真正的路由与轮转在号池，
 * 真正���落盘在 token-store，两者都不在本文件里做。
 */
export declare function registerGlmCodingPlanRoutes(ctx: Context, settings: GlmCodingPlanSettingsSource, options?: GlmCodingPlanRouteOptions): () => void;
//# sourceMappingURL=routes.d.ts.map