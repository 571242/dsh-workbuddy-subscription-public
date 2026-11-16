/**
 * 兑换链：OAuth access_token → 可用的 Coding Plan Key（计划 §3.2，证据等级 B）。
 *
 * 链路逐字照三个独立实现（TriDefender/zcode-api、Sakuralaaa/z-code-2api、CLIProxyAPI 插件生态）
 * 同构实现的那一条，四个端点与两种字段形状都记在 `EXCHANGE_PATHS` 的注释里：
 *
 *     access_token
 *       -> [仅国际区] POST {business}/api/auth/z/login  {token}                    => 业务 JWT + expires_in
 *       -> GET  {business}/api/biz/customer/getCustomerInfo                            => 默认机构 orgId / 默认项目 projectId
 *       -> GET/POST {business}/api/biz/v1/organization/{org}/projects/{proj}/api_keys   => 找或建一把 Key
 *       -> GET  .../api_keys/copy/{apiKeyId}                                          => secretKey
 *       -> {apiKeyId}.{secretKey}                                                      => Coding Plan Key
 *
 * **两区的鉴权形状本来就不一样**，这不是实现上的瑕疵（逐字：TriDefender/zcode-api
 * `src/auth/resolver.ts` 的两个分支）：
 *
 * - 国际区（`zai`）：先 `POST /api/auth/z/login` 换业务 JWT，之后所有 `/api/biz/*`
 *   带 `Authorization: Bearer <bizToken>`。
 * - 国区（`bigmodel`）：**跳过 z/login**，直接拿 OAuth access_token 当 `Authorization`
 *   头（裸值，不加 `Bearer`）打 `/api/biz/*`；host 是 `https://bigmodel.cn`
 *   （`open.bigmodel.cn` 是**模型面**的 host，别混用）。
 *
 * 推论：国区这一层**没有**业务 JWT，所以 `biz-token-cache.ts` 只服务于国际区。
 *
 * 三条必须写下来的纪律：
 *
 * 1. **本线路用自己的 Key 名**（`GLM_KEY_NAME` = `dsh-glm-coding-plan`）：
 *    社区实现用 `zcode-api-key`，撞名会导致本线路登录时轮转或删除官方 ZCode 客户端
 *    正在使用的那把 Key（计划 §3.2）。
 * 2. **落盘前必须验一次**：拿配额接口探一次 Coding Plan 面（裸 Key、无 Bearer，
 *    逐字证据 `docs/bigmodel-coding-plan-usage-quota.md`）。账号没有套餐就在**登录阶段**
 *    报错，而不是等到某次对话里以一个莫名其妙的 429 暴露出来。
 * 3. **国区这一段未验证**（计划 R5 / §9）：三个同构实现都以国际区为主，
 *    国区的业务面形状是否同构没有实测。失败时必须给出可操作报错，不得静默。
 *
 * 参考实现的许可证是 null / AGPL-3.0，所以这里**只读协议、照协议重写**，没有复制任何代码。
 */
import type { GlmAllowanceKind, GlmRegion } from '../../shared/glm-coding-plan-contracts.ts';
/**
 * 国区兑换链的未验证声明。
 *
 * 任何国区失败都要把它带上：一句「兑换失败」对用户毫无指导意义，
 * 而「国区兑换链未经验证」能直接告诉他下一步是换国际区，还是用 `DSH_GLM_*` 覆盖指向实测过的部署。
 */
export declare const CN_EXCHANGE_UNVERIFIED_NOTICE: string;
/** 兑换链的任何一步失败。 */
export declare class GlmExchangeError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/**
 * 兑换链跑通了，但这把 Key 不能服务 Coding Plan 面。
 *
 * 单独一类是因为处置不同：这不是「再试一次」能解决的，也不是链路的 bug，
 * 而是这个账号没有套餐 / 套餐已失效 / 没有建 Key 的权限，必须让用户在登录阶段就看到。
 */
export declare class GlmCodingPlanUnavailableError extends Error {
    constructor(message: string);
}
/** 兑换链跑通并验过之后的结果。host 侧专用，不进共享契约。 */
export interface GlmCodingPlanKey {
    region: GlmRegion;
    /** `{apiKeyId}.{secretKey}`：配额接口要的就是这个裸值（不可加 Bearer）。 */
    codingPlanKey: string;
    apiKeyId: string;
    secretKey: string;
    /** Key 名，便于诊断「是不是本线路建的」。 */
    keyName: string;
    /** 本次是新建的还是复用了已存在的同名 Key。 */
    keyCreated: boolean;
    organizationId: string;
    projectId: string;
    /** 控制台侧的机构名，仅用于诊断与卡片展示。 */
    accountName: string | null;
    /**
     * 业务 JWT（控制台口径：zcodejwttoken），落盘给 `biz-token-cache.ts` 用。
     *
     * 国区没有这一层（它拿裸 access_token 直接打 `/api/biz/*`），所以那里是 null。
     */
    bizToken: string | null;
    /** 业务 JWT 的失效时刻（Unix 毫秒）；国区为 null。 */
    bizTokenExpiresAt: number | null;
    /** 验活时读到的套餐机器档位（lite / pro / max），上游没给则为 null。 */
    planLevel: string | null;
    /**
     * 验活认定的额度类型。落盘后由设置卡片如实显示，**不假装**免费额度是付费套餐。
     *
     * 缺省取 'unknown' 而不是必填：旧凭据文件里没有这个键，解析时补成 unknown
     * （见 `token-store.ts`），因此它必须允许「读不到」。
     */
    allowance?: GlmAllowanceKind;
}
export interface GlmExchangeOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    env?: NodeJS.ProcessEnv;
    /** 单次请求超时；缺省走 `DISCOVERY_TIMEOUT_MS`（20s）。 */
    timeoutMs?: number;
}
/** 业务 JWT（控制台口径：zcodejwttoken）及其失效时刻。 */
export interface GlmBizToken {
    token: string;
    /** 上游给的 `expires_in`（秒）；上游没给时按 JWT 自身的 `exp` 折算。 */
    expiresInSec: number;
    expiresAt: number;
}
/**
 * `POST {business}/api/auth/z/login`，体 `{"token": <oauth access_token>}`。
 *
 * 请求**不带** Authorization 头：access_token 在体里，这是三个同构实现一致的做法。
 * 响应取 `access_token`（同构实现还兼容 `accessToken` 与 `data.access_token`，本线路同样容忍）。
 *
 * `expires_in` 是业务 JWT 缓存的唯一时间来源（计划 §3.6：官方按「提前 120 秒 + 0~60 秒抖动」重取）。
 * 上游漏给时退回 JWT 自身的 `exp`；两者都没有就报错——一个不知道什么时候过期的缓存
 * 等于没有缓存，只会在长会话中途把用户踢出去。
 *
 * **只有国际区会调这个端点**：国区按逆向实现的 bigmodel 分支直接用裸 access_token
 * 打 `/api/biz/*`，根本不经过 z/login（见文件头注释）。留成导出函数是为了让 W6 与测试
 * 都能单独调它，而不是为了两区共用。
 */
export declare function loginBizToken(accessToken: string, region: GlmRegion, options?: GlmExchangeOptions): Promise<GlmBizToken>;
/** 默认机构与默认项目。 */
export interface GlmCustomerScope {
    organizationId: string;
    projectId: string;
    organizationName: string | null;
    projectName: string | null;
}
/**
 * `GET {business}/api/biz/customer/getCustomerInfo`：定位默认机构与默认项目。
 *
 * 找不到标记文案时退回列表第一项（同构实现的做法）：宁可猜一个，也不要让用户去回答
 * 「你的机构叫什么」——那条交互在本插件里不存在，而列表非空本身就说明账号有机构。
 * 列表为空才是真失败。
 */
export declare function resolveCustomerScope(region: GlmRegion, authorization: string, options?: GlmExchangeOptions): Promise<GlmCustomerScope>;
/** 一把 api key 的最小形状。 */
export interface GlmApiKeyRef {
    apiKeyId: string;
    created: boolean;
}
/**
 * 在该机构该项目下找一把本线路的 Key，没有就建一把。
 *
 * 找的条件是**名字等于** `keyName()`（默认 `GLM_KEY_NAME`）：撞名的代价是
 * 官方客户端正在用的那把 Key 被轮转或删除（计划 §3.2）。
 * 列表调用失败不直接判死而是继续走新建——同构实现也是这么做的，
 * 因为「列不出来」与「没有建 Key 的权限」是两回事，后者才值得报错。
 */
export declare function findOrCreateApiKey(region: GlmRegion, authorization: string, scope: {
    organizationId: string;
    projectId: string;
}, options?: GlmExchangeOptions & {
    name?: string;
}): Promise<GlmApiKeyRef>;
/**
 * `GET .../api_keys/copy/{apiKeyId}`：取 secretKey。
 *
 * secret 只在这个端点出现一次，所以每次兑换都要再取一次，没有可依赖的缓存。
 * 缺 secret 是硬失败：Coding Plan Key 的形状就是 `id.secret`（计划 §3.2、D4），
 * 拿半把 Key 去配额接口只会得到一个没有出处的 401。
 */
export declare function copyApiKeySecret(region: GlmRegion, authorization: string, scope: {
    organizationId: string;
    projectId: string;
    apiKeyId: string;
}, options?: GlmExchangeOptions): Promise<string>;
/** 探一次 Coding Plan 面的结果。 */
export interface GlmPlanProbe {
    planLevel: string | null;
    /**
     * 这次探活认定的额度类型。
     *
     * `plan` = 配额面给出了付费套餐的机器档位；`free-trial` = 配额面明确按套餐/额度维度
     * 拒了它（凭据有效）；`unknown` = 分不出是「key 坏了」还是「没有付费套餐」，
     * 而本线路在分不出时**选择放行**。
     */
    allowance: GlmAllowanceKind;
}
/**
 * 落盘前的验活：`GET {business}/api/monitor/usage/quota/limit`。
 *
 * 头是 `authorization: <id>.<secret>` **裸值**——加了 Bearer 会鉴权失败，
 * 这与模型面正好相反（逐字：`docs/bigmodel-coding-plan-usage-quota.md`，证据等级 A）。
 *
 * 这一步的价值分两半，而两半的**处置相反**：
 *
 * - 凭据本身坏了（业务码落在 `BAD_CREDENTIAL_REASONS`）→ 登录阶段就失败。一把废 Key
 *   进对话只会让用户在某次请求里以一个莫名其妙的 401 暴露出来。
 * - 凭据有效但**没有付费套餐**（业务码落在 `NO_PLAN_REASONS`，或裸 401/403 分不出）→
 *   **放行**，并把额度类型如实记成 `free-trial` / `unknown`。官方文档（逐字：
 *   zcode.z.ai/cn/docs/configuration）写明新用户注册即自动获得 5 天、每天 800 万 token 的
 *   「体验套餐：无需付费」，所以「没有付费 Coding Plan」不等于「没有额度」——硬拒在登录阶段
 *   等于把免费额度的新用户全部挡在门外。额度耗尽时上游回 429，那是可恢复的。
 */
export declare function verifyCodingPlanKey(region: GlmRegion, codingPlanKey: string, options?: GlmExchangeOptions): Promise<GlmPlanProbe>;
/**
 * 这一层之后 `/api/biz/*` 该带的头。
 *
 * 两区不同，逐字照 TriDefender/zcode-api 的两个分支：国际区换出业务 JWT 再带
 * `Bearer`，国区**跳过换**、直接用裸 access_token。
 */
export declare function resolveBizAuthorization(accessToken: string, region: GlmRegion, options?: GlmExchangeOptions): Promise<{
    authorization: string;
    bizToken: string | null;
    bizTokenExpiresAt: number | null;
}>;
/**
 * 走完整条兑换链并验活。
 *
 * 调用方（W6）拿到的是一把**已经证明凭据有效**的 Coding Plan Key：
 * 任何一步没过都不返回 Key，失败一律以异常形式给出可读原因。
 *
 * 注意「证明可用」这句话现在的口径：它证明的是**这把 Key 会被上游认出来**，
 * 不是「账号有付费套餐」。没有付费套餐（含体验额度）的账号同样在这里成功返回，
 * 额度类型记在 `allowance` 上。
 *
 * @throws {@link GlmCodingPlanUnavailableError} 链路通但这把 Key 不能服务 Coding Plan
 * @throws {@link GlmExchangeError} 链路本身没走通
 */
export declare function exchangeForCodingPlanKey(accessToken: string, region: GlmRegion, options?: GlmExchangeOptions): Promise<GlmCodingPlanKey>;
//# sourceMappingURL=exchange.d.ts.map