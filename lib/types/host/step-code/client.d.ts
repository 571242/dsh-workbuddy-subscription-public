/**
 * Step Code 线路的上游 I/O：模型目录 + 开发者中心额度。
 *
 * 本文件只做两件事：**把请求发到上游**，以及**把上游的载荷翻译成本线路的形状**。
 * 传输（发送模型请求、拆流）不在这里——那是 mapper.ts / adapter.ts 的活。
 *
 * ---------------------------------------------------------------------------
 * 三条必须记住的上游事实（逐字证据在每处注释里）
 * ---------------------------------------------------------------------------
 *
 * 1. **base 归一化是幂等循环，不是 endsWith 判断。**
 *    官方 normalizeStepApiBaseUrl（step-provider/index.ts:378-400）反复剥掉尾部的
 *    /v1/messages、/messages、/v1，因为历史配置里出现过**重复后缀**（/v1/v1/messages）：
 *    一次 endsWith 只能修好一层，两层就还剩一层。本文件照抄那个循环。
 *
 * 2. **逐模型详情在域名根的 /v1，不在 /step_plan/v1。**
 *    index.ts:420-426：the subpath variant 404s。所以 stepModelDetailUrl 走
 *    {origin}/v1/models/{id}，而列表走 {归一化 base}/v1/models。
 *    这两条**故意不一样**，合并它们就是那个 404。
 *
 * 3. **额度失败绝不影响模型请求。**
 *    额度面是**非公开接口**（计划 §5、§10 风险 1），上游改一次路径或字段就全失效。
 *    所以额度的一切都返回**值**（StepCodeQuotaRead），没有一条路径把错误抛给调用方
 *    之外的边界：调用方不需要 try/catch 就能安全地把额度塞进状态面。
 *
 * ---------------------------------------------------------------------------
 * 注入缝
 * ---------------------------------------------------------------------------
 * 每个网络函数都接受 fetchFn（默认 fetch）与 env（默认 process.env），
 * 且 env **在调用时**读取（不是模块加载时），这样单测不碰真实网络也不碰真实凭据。
 */
import { type StepCodeProfile, type StepCodeQuotaSnapshotDto, type StepCodeRegion } from '../../shared/step-code-contracts.ts';
export interface StepCodeRequestOptions {
    /** 测试缝。默认 fetch。 */
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** 环境变量读取处。默认 process.env，且**调用时**读取。 */
    env?: NodeJS.ProcessEnv;
}
/** 错误详情去控制字符并截断到 MAX_ERROR_DETAIL_LENGTH（逐字 login-client.ts:39）。 */
export declare function stepCodeErrorDetail(text: string, limit?: number): string;
/**
 * 本线路发上游请求只需要的三件事：一个 key、它属于哪条 profile、（可选）账号标识。
 *
 * 这是**号池凭据的结构化超集**：account-pool.ts 的 StepCodeCredentials 就是它加一个
 * 来源标记，所以本文件的每个函数都能直接吃号池交出来的凭据，而不必认识池。
 */
export interface StepCodeUpstreamCredential {
    readonly apiKey: string;
    readonly profile: StepCodeProfile;
    readonly uid?: string;
}
/**
 * 模型面请求的头（逐字 index.ts:453-456：只有 accept 与 authorization）。
 *
 * 刻意**不加** user-agent：官方目录请求就这两个头，凭空多一个头不会让目录多返回
 * 一个字段，却会让「我们发的与官方一致」这句话变成假的。
 */
export declare function stepCodeModelHeaders(credentials: StepCodeUpstreamCredential): Record<string, string>;
/**
 * 把任意写法的 Step base 归一化成**路由前缀**（不带尾部斜杠、不带版本段）。
 *
 * 逐字照抄官方 normalizeStepApiBaseUrl（index.ts:378-400），包括它的理由：
 * /v1/messages、/messages、/v1 三种尾部**反复**剥，直到剥不动为止。官方的原话是
 * Be tolerant of files produced by an intermediate release that already contained
 * one duplicated suffix——所以用循环而不是 if。
 *
 * 非法 URL 原样返回（与官方一致）：校验是 provider resolver 的职责，而这个导出函数
 * 也会被拿去修复已有配置，坏条目应当留给正常的校验去报错。
 */
export declare function normalizeStepApiBaseUrl(value: string): string;
/**
 * 一条 profile 的模型面 base（**已归一化**的路由前缀）。
 *
 * 取值来自 apiBaseForProfile（含环境变量覆盖），归一化在这里做掉，于是所有调用点
 * 拼路径时不会把版本段发两次。
 */
export declare function stepApiRoutePrefix(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/**
 * OpenAI 风格 base（.../v1），逐字照抄官方 stepOpenAiBaseUrl（index.ts:410-412）。
 *
 * step_plan → https://api.stepfun.com/step_plan/v1；platform_cn → .../v1。
 */
export declare function stepOpenAiBaseUrl(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/** 对话请求 URL：{归一化 base}/v1/chat/completions。 */
export declare function stepChatCompletionsUrl(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/** 目录请求 URL：{归一化 base}/v1/models。 */
export declare function stepModelCatalogUrl(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/**
 * 逐模型详情的 base：**域名根的 /v1**（逐字 index.ts:414-426）。
 *
 * 反直觉但是必须：/step_plan/v1/models/{id} 会 404。解析不出域名时退回归一化 base，
 * 与官方一致（官方那句 Falls back to the input if it is not a valid URL）。
 */
export declare function stepModelDetailBaseUrl(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/** 逐模型详情 URL：{域名根}/v1/models/{encodeURIComponent(id)}。 */
export declare function stepModelDetailUrl(profile: StepCodeProfile, modelId: string, env?: NodeJS.ProcessEnv): string;
/**
 * 目录里的一条模型，**只含端点真的报了的字段**。
 *
 * modelType / maxInputTokens / description 允许缺失是刻意的：计划 §10 风险 2 明说这些
 * 字段都不在官方文档里，**一律按可能缺失处理**。能力**不从模型名推断**（计划 §3）。
 */
export interface StepCodeCatalogEntry {
    readonly id: string;
    readonly name: string;
    readonly modelType?: string;
    readonly maxInputTokens?: number;
    readonly reasoning: boolean;
    readonly vision: boolean;
    /** reasoning_effort_support_list；空数组表示端点没声明或一个都不支持。 */
    readonly efforts: readonly string[];
    readonly description: string | null;
}
/**
 * 解析 GET {base}/v1/models 的载荷。
 *
 * 逐字照抄官方 fetchStepModels 的读法（index.ts:462-494），三条规则各有理由：
 *
 * - **id 必填，缺失就跳过**（index.ts:470）：没有 id 的条目既无法被请求也无法被选中。
 * - **model_type 的过滤是二元的**（index.ts:481-486）：只保留**存在该字段**的条目里
 *   USABLE_MODEL_TYPES 的两个字面量；**全部条目都不带该字段时整表不过滤**——
 *   那是更老的/别的端点，向后兼容比过滤更重要。
 * - **按 id 去重**（index.ts:487-491）：同一 id 出现两次时取第一次。
 *
 * 纯函数、导出：格式规则可以脱离文件系统与网络被测试。
 */
export declare function parseStepModelCatalog(payload: unknown): StepCodeCatalogEntry[];
/** 无凭据 / 失败 / 离线时目录为空：调用方回落随包表，而不是抛错。 */
export declare function fetchStepModelCatalog(credentials: StepCodeUpstreamCredential, options?: StepCodeRequestOptions): Promise<StepCodeCatalogEntry[]>;
/** 本进程当前记住的目录（纯内存读，不触发任何网络请求）。 */
export declare function getCachedStepModelCatalog(profile?: StepCodeProfile): readonly StepCodeCatalogEntry[];
/** 清掉内存目录、快照 scope 与在飞的去重。 */
export declare function clearCachedStepModelCatalog(): void;
/**
 * TTL 缓存 + in-flight 去重 + 磁盘快照的目录读取。
 *
 * 三层各解决一件事，照抄 workbuddy/client.ts:397-491：
 *
 * - **TTL**：目录不是快变数据，半小时的陈旧比一次网络往返划算。
 * - **in-flight 去重**：同一个 profile 上并发的两个调用共用一次请求。
 * - **磁盘快照**（catalog-snapshot.ts）：冷启动不等网络。快照按 profile 分文件，
 *   所以国际区的列表不会把国区调用方喂成空。
 *
 * force: true 跳过缓存与快照直接重取（设置卡片的「刷新」按钮用）。
 */
export declare function loadStepModelCatalog(credentials: StepCodeUpstreamCredential, options?: StepCodeRequestOptions & {
    force?: boolean;
}): Promise<StepCodeCatalogEntry[]>;
/**
 * 逐模型档位：GET {域名根}/v1/models/{id} 的顶层 reasoning_effort_support_list。
 *
 * 逐字照抄官方 fetchStepModelEfforts（index.ts:532-552）：**任何**失败都返回
 * undefined 而不是抛错或返回空数组——「没取到」与「这个模型一个档位都不支持」是两句
 * 话，前者不能被后者冒充。
 *
 * 注意它读的是**顶层**字段，不是 data 里的一份列表（官方就这么读）。
 */
export declare function fetchStepModelEfforts(credentials: StepCodeUpstreamCredential, modelId: string, options?: StepCodeRequestOptions): Promise<string[] | undefined>;
/**
 * 老式载荷的 reset 时间字段名（逐字：计划 §5 的「+ *_reset_time」）。
 *
 * types.ts 的 QUOTA_LEGACY_FIELDS 只收了两个 left_rate，没收它们的 reset 字段名，
 * 所以这两个常量暂住本文件；**待上提到 types.ts**（避免下个波次再抄一遍）。
 */
export declare const STEP_QUOTA_LEGACY_RESET_FIELDS: {
    readonly fiveHour: "five_hour_reset_time";
    readonly weekly: "weekly_reset_time";
};
/**
 * 套餐状态里的套餐名 / 续费时刻候选字段。
 *
 * ⚠ **未验证**：GetStepPlanStatus 的响应形状没有任何公开文档，本表按常见写法列了几种，
 * 取到第一个非空值就用，取不到就是 null（卡片少一个字段，而不是显示一个编的值）。
 * 待上提到 types.ts。
 */
export declare const STEP_QUOTA_STATUS_FIELDS: {
    readonly planName: readonly ["plan_name", "package_name", "product_name", "name"];
    readonly renewAt: readonly ["renew_time", "renew_at", "expire_time", "expires_at"];
};
/** OASIS 匿名设备 Cookie 名（逐字：计划 §5 的 GET {auth} 取 INGRESSCOOKIE）。 */
export declare const OASIS_INGRESS_COOKIE = "INGRESSCOOKIE";
/** 额度凭据的来源，与冻结契约的 StepCodeQuotaCredentialStatusDto['source'] 同一组取值。 */
export type StepCodeQuotaCredentialSource = 'auto' | 'manual';
/**
 * 开发者中心的额度凭据：Oasis-Token + 与它成对的 Oasis-Webid。
 *
 * **两个字段必须一起流动**：服务端要求 Oasis-Webid 等于该 token 的 device_id claim，
 * 否则报「token is embezzled」（计划 §10 风险 5）。所以它不是「一个 token 加一个可以
 * 随便填的头」，而是一对凭据。
 *
 * ⚠ 它等价于一次账号登录，**永远不过 host → client 的边界**；下发的是
 * StepCodeQuotaCredentialStatusDto 那张「有没有、从哪来」的切片。
 */
export interface StepCodeQuotaCredential {
    readonly token: string;
    readonly deviceId: string;
    readonly source: StepCodeQuotaCredentialSource;
    /** 非机密：登录用到的账号，仅供卡片显示是哪一路凭据在服务。 */
    readonly account?: string;
    /** 过期时刻（Unix 毫秒）；上游未给出时为 null。 */
    readonly expiresAt?: number | null;
}
/**
 * 从 token 的 JWT 载荷里取 device_id claim；取不出（不是 JWT / 没有这个 claim）时
 * 返回 undefined。**在本地解码**，token 绝不发给任何地方去解析（照 codex-adopt.ts）。
 *
 * 找不到签名密钥，也就不验证签名——这里只是把服务端已经签过的那句话读出来用。
 */
export declare function oasisDeviceIdFromToken(token: string): string | undefined;
/**
 * 手动粘贴兜底：用户在浏览器开发者工具里复制 Oasis-Token，deviceId 顺带从 token 里解。
 *
 * 解不出 device_id 时**直接失败**，而不是让用户随便填一个：填错的上游会报
 * 「token is embezzled」，那比这里一句「这个 token 里没有 device_id」难查得多。
 */
export declare function manualStepCodeQuotaCredential(token: string, options?: {
    account?: string;
}): StepCodeQuotaCredential;
/** 自动登录失败时给卡片的一句话：降级到手动粘贴，而不是让用户反复重试密码。 */
export declare const OASIS_MANUAL_PASTE_HINT = "\u81EA\u52A8\u767B\u5F55\u5931\u8D25\u3002\u8BF7\u6253\u5F00 Step \u5F00\u53D1\u8005\u4E2D\u5FC3\uFF0C\u5728\u6D4F\u89C8\u5668\u5F00\u53D1\u8005\u5DE5\u5177\u91CC\u590D\u5236 Oasis-Token \u5E76\u7C98\u8D34\u5230\u8BBE\u7F6E\u9875\u3002";
/**
 * 自动登录失败时抛出的错误：带一句「下一步做什么」，而不是把上游原文丢给用户。
 */
export declare class OasisSignInError extends Error {
    /** 面向用户的下一步（手动粘贴兜底）。 */
    readonly hint: string;
    constructor(message: string);
}
export interface StepCodeOasisSignInInput {
    /** 走哪个区域的开发者中心（profile 唯一决定）。 */
    readonly profile: StepCodeProfile;
    /** 账号（手机号 / 邮箱，按 Step 的登录口径）。 */
    readonly account: string;
    readonly password: string;
    readonly fetchFn?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly env?: NodeJS.ProcessEnv;
}
/**
 * 账号密码换 Oasis-Token，三步（逐字：计划 §5）。
 *
 * 1. `GET {authBase}` 取 `Set-Cookie: INGRESSCOOKIE=…`（网关的匿名 cookie）。
 * 2. `POST …/PassportService/RegisterDevice` 注册设备，换匿名 token。
 * 3. `POST …/PassportService/SignInByPassword` 用账号密码换 Oasis-Token。
 *
 * 失败一律抛 {@link OasisSignInError}：调用方据此降级到「手动粘贴」（计划 §5）。
 * 账号密码**只出现在这一步的请求体里**，不写日志、不落盘、不进任何返回值。
 *
 * ⚠ 请求体字段名**未验证**（这两个接口不属于任何公开契约），按常见写法给最小集合。
 */
export declare function signInOasisQuotaCredential(input: StepCodeOasisSignInInput): Promise<StepCodeQuotaCredential>;
/**
 * 把多次应答合成一份载荷（浅合并，后者覆盖前者）。
 *
 * 两个接口是分开打的，而套餐名/续费时刻只在一个里、额度窗口只在另一个里；
 * 合成之后再判定，才不会因为「先打的那个不认识」就把一代套餐判成 unknown。
 */
export declare function mergeStepQuotaPayloads(...payloads: readonly unknown[]): Record<string, unknown>;
export interface StepCodeQuotaParseContext {
    /** 读到的开发者中心属于哪个区域（由 profile 唯一决定）。 */
    readonly region: StepCodeRegion;
    /** 实际应答过的端点路径，供设置卡片诊断（计划 §5：sources 记实际打过的路径）。 */
    readonly sources: readonly string[];
    /** 本次读取时刻；缺省用现在。 */
    readonly fetchedAt?: number;
}
/**
 * 把 devcenter 载荷翻译成 StepCodeQuotaSnapshotDto。
 *
 * **按载荷形状判定两代套餐，不单信 plan_family**（计划 §5 的加粗句）：
 *
 * - 老式：顶层 five_hour_usage_left_rate / weekly_usage_left_rate + *_reset_time。
 * - 新式：plan_credit_rate_limit.{subscription_credit_left_rate, topup_credit_left_rate,
 *   credit_buckets[]}，桶的每项是 {credit_total, credit_residual, expire_at, next_reset_at}。
 *
 * 两代都认不出来时 kind = 'unknown'，**不发明**第三条形状。
 * 数字字段三种写法（int / float / 数字字符串）、时间戳两种形态（数字 / 字符串）都收，
 * 见本文件顶部的 asNumber / asTimestampMs。
 *
 * 纯函数、导出：形状规则可以脱离网络被测试。
 */
export declare function parseStepQuotaSnapshot(payload: unknown, context: StepCodeQuotaParseContext): StepCodeQuotaSnapshotDto;
/**
 * 一次额度读取的结果。
 *
 * 刻意**不**是 throw：额度面是非公开接口，而它的失败绝不能影响模型请求
 *（计划 §5、§10 风险 1）。调用方拿到 {ok:false, error} 就能把失败写进状态面，
 * 不必把 try/catch 铺到每个调用点。
 */
export type StepCodeQuotaRead = {
    readonly ok: true;
    readonly snapshot: StepCodeQuotaSnapshotDto;
} | {
    readonly ok: false;
    readonly error: string;
};
/**
 * 读一次额度；两个接口都失败时返回 {ok:false}，**不抛**。
 *
 * 先打 QueryStepPlanRateLimit（额度窗口 / Credit 池），再打 GetStepPlanStatus
 *（套餐名与续费时刻）。第二个打不通不影响第一个的结果：它只补展示字段。
 * sources 记的是**实际应答过**的路径，而不是打算要打的路径。
 */
export declare function readStepQuota(quotaCredential: StepCodeQuotaCredential, profile: StepCodeProfile, options?: StepCodeRequestOptions): Promise<StepCodeQuotaRead>;
/**
 * 额度快照的缓存键。
 *
 * **额度跟着账号走**（共享号池契约的原话）：一次轮转决定哪个账号花下一次请求，
 * 线路级的一份读数描述的是「恰好轮到的那个账号」。所以键里带账号标识；
 * 账号标识缺失时退回 profile —— 代价是两个都没有 uid 的账号共用一份读数，
 * 那仍然是「我们只知道这么多」，不是编的数字。
 */
export declare function stepCodeQuotaCacheKey(profile: StepCodeProfile, accountId?: string | null): string;
/** 本进程为某个账号记住的最新额度快照（纯内存读，从不发请求）。 */
export declare function getCachedStepQuotaFor(accountId?: string | null): StepCodeQuotaSnapshotDto | undefined;
/** 一次成功读取之后由调用方登记（键与 stepCodeQuotaCacheKey 一致）。 */
export declare function rememberStepQuotaSnapshot(accountId: string, snapshot: StepCodeQuotaSnapshotDto): void;
/** 清掉额度缓存与在飞去重（登录/切号时调用）。 */
export declare function clearCachedStepQuota(): void;
/**
 * 带 TTL 与 in-flight 去重的额度读取。
 *
 * TTL = QUOTA_CACHE_TTL_MS；force: true 跳过缓存（设置卡片的「刷新」）。
 * 失败**不缓存**：非公开接口改版后恢复得很快，缓存住一个失败只会让用户多等一个 TTL。
 */
export declare function loadStepQuota(quotaCredential: StepCodeQuotaCredential, profile: StepCodeProfile, options?: StepCodeRequestOptions & {
    force?: boolean;
    cacheKey?: string;
}): Promise<StepCodeQuotaRead>;
//# sourceMappingURL=client.d.ts.map