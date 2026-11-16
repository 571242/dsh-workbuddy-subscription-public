/**
 * Step Code（Step Plan 订阅）线路的 DSH 适配器。
 *
 * 形状与 GLM / WorkBuddy 同构（`extends LlmAdapter`：`listModels` / `resolveModel` /
 * `prepareCall` / `stream` / `catalog` / `credentialFor`），但它**不碰任何协议细节**：
 *
 * - 请求体、流解析、用量与错误分类全部来自 `./mapper.ts`；
 * - URL 全部来自 `./client.ts`（`stepChatCompletionsUrl` / `stepModelCatalogUrl`）；
 * - 目录的归一化全部来自 `./model-catalog.ts`。
 *
 * 也就是说本文件只回答三件事：**这一行请求用哪个目录行**、**用哪把凭据**、
 * **失败之后换不换账号**。任何一份 URL 拼接或 JSON 解析在这里出现第二遍，
 * 就等于给线路造了第二条会漂移的真相。
 *
 * 三处刻意如此：
 *
 * 1. **凭据只在 `credentialFor()` 一处取。** 有号池时轮转，没有池时读单凭据存储
 *    （无头 host 与测试的形态）。两条路径都**不刷新**：Step 的 api_key 永不过期，
 *    号池的 refresh 钩子恒抛 `StepCodeCredentialRefreshError`，所以这里没有「捕获后重登」
 *    这种分支——上游撤销一把 Key 的唯一诚实的处置是 401 时的 `markAuthFailed`。
 * 2. **请求路径不联网。** 目录只读 `client.ts` 的进程内缓存，随包目录兜底；
 *    实时目录是 `/catalog/refresh` 与登录/adopt 的产物。
 * 3. **缓存用量在本进程累计。** 累计器住在本文件（流的末端是唯一知道用量帧的地方），
 *    `/status` 由 `readStepCodeCacheStats()` 读它；路由不另算第二套口径。
 */
import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment';
import { type AttachmentImageReader } from '../common/request-images.ts';
import { type StepCodeCacheUsage } from './cache-stats.ts';
import { type StepCodeCatalogEntry, type StepCodeUpstreamCredential } from './client.ts';
import { type StepCodeModelEntry } from './model-catalog.ts';
import { StepCodeCredentialStore, StepCodeModelSettingsStore, type StepCodePreferenceStore } from './token-store.ts';
import type { StepCodeAccountPool } from './account-pool.ts';
import { PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import type { StepCodeCacheStatsDto, StepCodeProfile } from '../../shared/step-code-contracts.ts';
/**
 * 这条路由的瞬时故障重试策略，与兄弟线路逐字一致。
 *
 * 刻意不在集合里：AUTH（被拒的 Key 每次都一样，而它只能重新授权）、
 * PROVIDER_ERROR（400 或套餐拒绝）、ABORTED（调用方自己取消）。
 */
export declare const STEP_CODE_RETRY_POLICY_CONFIG: {
    mode: 'normal';
    maxRetries: number;
    retryableCodes: string[];
    backoff: {
        initialDelayMs: number;
        maxDelayMs: number;
        jitterRatio: number;
    };
};
/** 上游没有给 `Retry-After` 时，一次 429 按 5 分钟冷却。 */
export declare const STEP_CODE_POOL_COOLDOWN_MS: number;
/**
 * 目录缓存 → 能力行。
 *
 * `client.ts` 的缓存装的是 `StepCodeCatalogEntry`（**只含端点真的报了的字段**），
 * 而请求面与设置面要的是 `model-catalog.ts` 的 `StepCodeModelEntry`。
 * 这里把前者还原成上游载荷再交给 {@link parseStepCodeModelListing}，而不是自己映射一遍：
 * 档位表、`model_type` 过滤、上下文窗口兜底与 hint 生成都因此只有**一份**实现。
 *
 * 还原是等价的：缓存条目里每个字段都对应上游记录里的同名键，
 * 而 `model_type` 的过滤在 `client.ts` 已经按同一条规则做过一次，
 * 再跑一遍得到同一份集合（缓存里要么全带 `model_type` 要么全不带）。
 */
export declare function stepCodeModelCatalogFrom(entries: readonly StepCodeCatalogEntry[]): StepCodeModelEntry[];
/**
 * 这个部署能调的模型：**进程内缓存优先、随包目录兜底，请求路径上绝不联网**。
 *
 * 实时目录只由 `/catalog/refresh` 与登录/adopt 产生（见 `routes.ts`），
 * 卡片打开时就能把它同步好；让每一次模型解析都去打上游只会把设置页变成一条压测。
 */
export declare function cachedStepCodeModelCatalog(profile?: StepCodeProfile): readonly StepCodeModelEntry[];
/** 设置卡片渲染的模型总数（hub 概览与状态共用同一份读数）。 */
export declare function stepCodeCatalogSize(): number;
/**
 * 记下一次请求的用量（流读到终止帧之后调用）。
 *
 * 口径全部借自 `cache-stats.ts` 的 {@link promptTokensOf}——它是本线路对
 * 「聚合 prompt = 未命中 + 缓存读入 + 缓存写入」的唯一写法，这里不再复述一遍。
 */
export declare function rememberStepCodeCacheUsage(usage: StepCodeCacheUsage): void;
/**
 * 卡片要的那份切片；**尚无样本时返回 undefined**。
 *
 * 「还没有样本」与「样本全都没命中」必须能被区分：契约里 `cacheStats` 是可选的，
 * 客户端把缺失渲染成占位符、把 0 渲染成真实的 0%，所以这里绝不下发一个全 0 的对象。
 */
export declare function readStepCodeCacheStats(): StepCodeCacheStatsDto | undefined;
/** 一行请求要用的凭据：发请求只需要 `client.ts` 认得的那三件事。 */
export interface StepCodePickedCredential {
    /** 号池里的账号 id；无池（单凭据路径）时为 null。 */
    accountId: string | null;
    credentials: StepCodeUpstreamCredential;
}
export interface StepCodeAdapterOptions {
    fetchFn?: typeof fetch;
    attachments?: AttachmentImageReader;
    /** 多账号号池；缺省走单凭据路径（无头 host 与测试）。 */
    accountPool?: StepCodeAccountPool;
}
/**
 * Step Code（Step Plan 订阅）线路的 LlmAdapter 实现。
 *
 * 请求面只有一个：四条 profile 全部走 OpenAI Chat Completions（官方
 * `STEP_MODEL_API = "openai-completions"` 对所有模型一视同仁），所以本文件里
 * **没有**协议面判定——而 region 也不在这里拼，URL 由 `client.ts` 从凭据的 profile 得出。
 */
export declare class StepCodeAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly preferences;
    private readonly accountPool;
    private readonly options;
    constructor(store?: StepCodeCredentialStore, modelSettings?: StepCodeModelSettingsStore, preferences?: StepCodePreferenceStore, options?: StepCodeAdapterOptions);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(): undefined;
    imageRequestTarget(_provider: string, _model: string, image: ImageAttachmentRef): {
        width: number;
        height: number;
        maxBytes: number;
    };
    private settings;
    /** 这个部署的目录行（缓存优先，请求路径不联网）。 */
    private catalog;
    /**
     * 这一行请求用哪份凭据。
     *
     * 有池时轮转；没有池时读单凭据存储（无头 host 与测试的形态）。
     * 两条路径都**不刷新**：Step 的 api_key 永不过期，号池的 refresh 钩子恒抛
     * `StepCodeCredentialRefreshError`，所以这里不存在「刷新失败后再试一次」的分支。
     */
    private credentialFor;
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    /**
     * 一次请求的完整往返：选账号 → 定目录行 → 发 → 解析流。
     *
     * 账号轮转的循环只有一处：一次 429 或一次 AUTH 会把那个账号移出本次请求，
     * 由另一个账号来发**同一份**请求体。没有池时这个循环只跑一次。
     */
    private requestStream;
}
export { PROVIDER_ID, PROVIDER_NAME };
//# sourceMappingURL=adapter.d.ts.map