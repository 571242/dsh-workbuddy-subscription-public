/**
 * GLM（ZCode 账号）线路的上游 I/O：模型目录、配额、订阅列表，外加凭据验活的转出。
 *
 * 本文件有两条互相矛盾、且**不可互相抄**的认证规则，写错任何一处都会得到一个看似合理的
 * 401/鉴权失败，所以它们各自写在自己的函数上方：
 *
 * 1. **模型面**（目录拉取、Anthropic 面、OpenAI 面）用 `Authorization: Bearer {id.secret}`，
 *    Anthropic 面还要**成对**发 `x-api-key`。这两个请求头函数直接委托给
 *    `./mapper-anthropic.ts` 与 `./mapper-openai.ts` 的实现——它们才是发请求的路径，
 *    在这里另写一份就等于给「认证头」留下第二处可以漂移的真相。
 * 2. **配额 / 订阅面**用**裸 Key**，`authorization: <id>.<secret>`，**不加 `Bearer` 前缀**
 *    （逐字证据：`docs/bigmodel-coding-plan-usage-quota.md`，计划 §3.4；官方文档写明
 *    加了 Bearer 会鉴权失败）。`test/glm-coding-plan-client.test.ts` 对此有回归断言。
 *
 * 配额解析的语义照 dsh-web 仓库 `packages/dsh-usage/src/core/adapters.ts` 的 `glmPlan()`
 * 对齐（只读参考，没有复制代码），三条要点都是逐条照抄它的行为：
 *
 * - 上层信封要求 `success === true`，否则不解析；
 * - `TIME_LIMIT` 是 MCP 请求上限，**不是套餐窗口**，跳过；
 * - `unit` 用 `./types.ts` 的 `QUOTA_UNIT_WINDOW` 映射，**未知 unit 一律丢弃**，不发明窗口；
 * - `TOKENS_LIMIT` 的比例取 `percentage`，`CREDIT_LIMIT` 取 `currentValue / usage` 的比例
 *   （两者都不成比例时才退回 `percentage`）。
 */
import type { GlmQuotaSnapshotDto, GlmRegion } from '../../shared/glm-coding-plan-contracts.ts';
import { QUOTA_PATH, SUBSCRIPTION_PATH } from './types.ts';
import { modelsUrl } from './mapper-openai.ts';
import { verifyCodingPlanKey } from './exchange.ts';
import { catalogSize, isGlmModelId, listModelIds, modelsForRegion, type GlmModelEntry } from './model-catalog.ts';
export { listModelIds, catalogSize, modelsForRegion, isGlmModelId, verifyCodingPlanKey };
export type { GlmPlanProbe } from './exchange.ts';
/** 一次上游读的可调项。`fetchFn` / `signal` 供测试注入，`env` 让 `DSH_GLM_*` 覆盖在调用时生效。 */
export interface GlmRequestOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    env?: NodeJS.ProcessEnv;
    /** 单次请求超时；缺省走 `DISCOVERY_TIMEOUT_MS`。 */
    timeoutMs?: number;
}
/**
 * Anthropic 面的请求头（双头：`x-api-key` + `Authorization: Bearer`，同值）。
 *
 * **委托**给 `./mapper-anthropic.ts` 的 `glmAnthropicHeaders`，本文件不复制第二份。
 * 目录拉取与探活都会用它，认证规则只有一处真相。
 */
export declare function glmAnthropicProbeHeaders(codingPlanKey: string): Record<string, string>;
/**
 * OpenAI 兼容面的请求头（只有 `Authorization: Bearer`，**没有** `x-api-key`）。
 *
 * **委托**给 `./mapper-openai.ts` 的 `glmOpenAiHeaders`：双头是 Anthropic 面的性质，
 * 这里多发一个头不会更好，只会让复审误以为两面共用一套认证。
 */
export declare function glmOpenAiProbeHeaders(codingPlanKey: string): Record<string, string>;
/**
 * 配额 / 订阅面的请求头：**裸 Key，不加 `Bearer`**。
 *
 * 逐字证据：`docs/bigmodel-coding-plan-usage-quota.md`（计划 §3.4）——加了 Bearer 前缀会鉴权失败。
 * 这与模型面正好相反，所以这里没有任何「兼容两种写法」的分支：
 * 那种写法在上游表现为一次必然失败的请求，而失败原因（401）不会告诉你前缀多写了。
 *
 * @param codingPlanKey - 兑换链拼出的 `{apiKeyId}.{secretKey}`。空白即抛错，不发一个注定被拒的请求。
 */
export declare function quotaRequestHeaders(codingPlanKey: string): Record<string, string>;
/**
 * 配额 URL：`{business}{QUOTA_PATH}`。
 *
 * 走**业务面** host（国区 `bigmodel.cn` / 国际区 `api.z.ai`）而不是模型面：
 * `./types.ts` 的 `businessHost()` 就是这条路的唯一出处。
 *
 * **未验证**：官方文档写「区域 host `https://api.z.ai` 或 `https://bigmodel.cn`，
 * 国区亦可用 `open.bigmodel.cn`」，国区到底哪个是规范入口没有实测样本（计划 D9：无实机账号）。
 * 本文件取 `businessHost()`，需要指向另一个部署时用 `DSH_GLM_*_BUSINESS_HOST` 覆盖。
 */
export declare function quotaUrl(region: GlmRegion, env?: NodeJS.ProcessEnv): string;
/** 订阅列表 URL：`{business}{SUBSCRIPTION_PATH}`（套餐名 / 续费时刻）。 */
export declare function subscriptionUrl(region: GlmRegion, env?: NodeJS.ProcessEnv): string;
export { modelsUrl, QUOTA_PATH, SUBSCRIPTION_PATH };
/**
 * 解析 `/api/coding/paas/v4/models` 的响应。
 *
 * 与随包目录合并的规则（照历史实现 `7e40fce:src/host/zhipu/client.ts` 的 `parseCatalogModels`）：
 * **目录里的能力声明永远是权威，实时列表只补它明确给出的那一个字段**——上下文窗口。
 * 梯子、收不收图、可不可关思考、协议面这四项实时列表都不公布（**未验证**：没有样本证明它会公布），
 * 让它们被列表的沉默改写成「猜」就是本文件存在的反面。
 *
 * **未验证**：列表的字段名。历史实现读 `context_window` / `contextWindow` /
 * `max_input_tokens`，本文件连 `context_length` 一起认；真实响应样本缺一份，
 * 上游若换了字段名，表现是「退回随包目录的窗口值」而不是崩溃。
 */
export declare function parseCatalogListing(payload: unknown, region: GlmRegion): GlmModelEntry[];
/**
 * 拉一次模型目录。
 *
 * 失败**抛错**而不是静默返回空列表：调用方（连接测试）需要知道「没读到」，
 * 而 {@link loadCatalog} 才是那个负责回落随包目录的函数。
 */
export declare function fetchCatalog(region: GlmRegion, codingPlanKey: string, options?: GlmRequestOptions): Promise<GlmModelEntry[]>;
/** 最近一次成功读到的目录；只读缓存，不发请求。 */
export declare function getCachedCatalog(region?: GlmRegion): GlmModelEntry[];
/** 忘记目录缓存（登录、登出、测试）。 */
export declare function clearCachedCatalog(): void;
/**
 * 带 TTL 的目录读，失败时保留上一份快照、再失败则回落到随包目录。
 *
 * 回落链是有顺序的：**同区域的旧快照** → **随包目录（按区域过滤）**。
 * 绝不让另一区域的快照顶替——它的行只声明了来处那个区域，落到调用方的区域过滤上会一行不剩，
 * 结果是「模型选择器空了」而不是「退回随包目录」。
 */
export declare function loadCatalog(region: GlmRegion, codingPlanKey: string, options?: GlmRequestOptions & {
    force?: boolean;
}): Promise<GlmModelEntry[]>;
/** 上游 `limits` 数组里的一行（只保留本线路要用的字段）。 */
export interface GlmQuotaLimitRow {
    type: string;
    unit: number | undefined;
    percentage: number | undefined;
    currentValue: number | undefined;
    usage: number | undefined;
    /** 重置时刻（Unix 毫秒）；上游没给或给了非正值时为 null。 */
    resetsAt: number | null;
}
/**
 * 把 `data.limits` 读成结构化行。
 *
 * 这里**只做搬运不做筛选**：`TIME_LIMIT` 与未知 `unit` 的丢弃发生在
 * {@link parseQuotaSnapshot} 里，留在同一处才能一眼看清「哪些行被丢掉、为什么」。
 *
 * **未验证**：字段名。字段取自历史实现与 dsh-usage 的 `glmPlan()`（`unit` / `type` /
 * `percentage` / `currentValue` / `usage` / `nextResetTime`），没有一份真实响应样本。
 */
export declare function parseQuotaLimits(payload: unknown): GlmQuotaLimitRow[];
/** 解析配额快照时由调用方补上的东西（订阅列表读到的部分）。 */
export interface GlmQuotaParseOptions {
    /** 订阅列表给出的展示套餐名。 */
    planName?: string | null;
    /** 订阅列表给出的续费时刻（Unix 毫秒）。 */
    renewsAt?: number | null;
    /** 本次读取时刻（Unix 毫秒）。 */
    now?: number;
    /** 实际应答的端点路径，供设置卡片诊断。 */
    sources?: readonly string[];
}
/**
 * 解析一次配额响应成 `GlmQuotaSnapshotDto`；不可解析时返回 null。
 *
 * 与参考实现 `glmPlan()` 一致的四条：
 *
 * 1. 上层信封必须 `success === true`，否则不解析（这个端点会用 HTTP 200 回一个业务失败）；
 * 2. `TIME_LIMIT` 是 MCP 请求上限，**不是套餐窗口**，跳过；
 * 3. `unit` 走封闭映射，**未知编号丢弃**；
 * 4. 剩下的行里 `TOKENS_LIMIT` 取 `percentage`、`CREDIT_LIMIT` 取 `currentValue/usage`。
 *
 * 另外两个本仓库自己的决定：
 *
 * - **同一个窗口键只保留第一行**。上游若给了两行 unit 3，画出来就是两条一模一样的额度条，
 *   而第二条可能是别的计量口径；宁可少画一条，也不把两种口径混成一条。
 * - **一个窗口都没有时返回 null**（参考实现同样把「无窗口」当成没有快照）。
 *   一份没有窗口的快照会在卡片上渲染成「什么都没消耗」，那比不显示更糟。
 */
export declare function parseQuotaSnapshot(payload: unknown, options?: GlmQuotaParseOptions): GlmQuotaSnapshotDto | null;
/** `data.level` 是不是本线路认识的机器档位（lite / pro / max）。 */
export declare function isGlmPlanLevel(value: unknown): value is string;
/** 订阅列表读到的套餐事实。 */
export interface GlmSubscriptionPlan {
    planName: string | null;
    renewsAt: number | null;
}
/**
 * 解析订阅列表 → 套餐名 / 续费时刻。
 *
 * **尽力而为**：读不到套餐名不影响配额窗口（它们来自另一个端点），
 * 所以本函数的任何不确定都只表现为 null，不会让整张配额卡片失败。
 *
 * **未验证**：字段名。读法取自历史实现（`planName` / `name` / `productName`、
 * `expireTime` / `expiredTime` / `renewTime`，`data` 可以是对象也可以是数组），
 * 没有一份真实响应样本；上游换字段名时表现为「卡片上没有套餐名」，而不是崩溃。
 */
export declare function parseSubscriptionPlan(payload: unknown): GlmSubscriptionPlan;
/** 一次配额读的结果。失败以 `error` 呈现，不以异常呈现。 */
export interface GlmQuotaRead {
    snapshot: GlmQuotaSnapshotDto | null;
    /** 面向用户的失败原因；成功时为 null。与 `GlmStatusDto.quotaError` 是同一个位置。 */
    error: string | null;
    /** 这次是否直接命中缓存。 */
    fromCache: boolean;
}
/** 最近一次读到的快照，不发请求。 */
export declare function getCachedQuota(): GlmQuotaSnapshotDto | null;
/**
 * 只返回**属于这个账号**的快照，不发请求。
 *
 * 配额跟着账号走：轮转决定了下一个请求花哪个账号的额度，所以一份快照只描述它被读取时
 * 那个账号的消耗。缺省 / 空 id 退回「最新一次读」，那是页面级卡片要的语义。
 */
export declare function getCachedQuotaFor(accountId?: string | null): GlmQuotaSnapshotDto | null;
/** 忘记配额缓存（登出、换账号、测试）。不给 id 就全清。 */
export declare function clearCachedQuota(accountId?: string | null): void;
/** 读订阅列表；失败一律降级成「没有套餐名」，配额窗口不受影响。 */
export declare function fetchSubscriptionPlan(region: GlmRegion, codingPlanKey: string, options?: GlmRequestOptions): Promise<GlmSubscriptionPlan | null>;
/**
 * 读一次配额，返回快照或一句失败原因。
 *
 * 走缓存：命中 `QUOTA_CACHE_TTL_MS` 内的同账号结果直接返回（设置卡片在轮询这个接口）。
 * 订阅列表是**尽力而为**的第二段：它只补套餐名与续费时刻，失败不影响已经拿到的窗口。
 *
 * 为什么不抛异常而用 `error`：卡片的降级契约是「没有数字 + 一句原因」
 * （`GlmStatusDto.quota` 可空、`quotaError` 与它并列），抛异常会把同一个决定
 * 推给七个调用点各写一遍。需要「没读到就算失败」的调用方（连接测试）用
 * {@link verifyCodingPlanKey}，它本来就会抛。
 *
 * @param accountId - 这次读是为哪个池内账号做的；缓存按它分桶。
 * @throws 只有一种：凭据是空白。那是调用方的 bug（不该把空凭据发到网络上），
 *   所以它同步抛出，与「上游读失败返回 `error`」那条路径分开。
 */
export declare function fetchGlmQuota(region: GlmRegion, codingPlanKey: string, options?: GlmRequestOptions & {
    accountId?: string;
    force?: boolean;
}): Promise<GlmQuotaRead>;
//# sourceMappingURL=client.d.ts.map