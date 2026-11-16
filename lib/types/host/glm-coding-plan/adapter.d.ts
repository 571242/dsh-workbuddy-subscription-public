/**
 * GLM（ZCode 账号）线路的 DSH 适配器。
 *
 * 它做的是这一轮里**唯一**一件两个交付模块都做不了的事：
 *
 * > 按 `GlmModelOption.wire` 把一次请求送到对应的协议面。
 *
 * 目录逐行声明协议（计划 D3），所以这里不猜：`wire` 为 `anthropic` 就走
 * `mapper-anthropic.ts` 的 Messages 线，`openai` 就走 `mapper-openai.ts` 的
 * Chat Completions 线，`null`（目录没有转录过的 id）**拒绝这个模型**——挑错的表现是
 * 1212 `WRONG_METHOD`，比直接拒绝更难排查。
 *
 * 另外两件事也刻意留在这里而不是散进两个 mapper：
 *
 * - **ladder 由本层传入**：`glmEffortForLadder` / `buildChatRequest` 只收敛，不查目录。
 *   梯子来自 `GlmModelOption.reasoningEfforts`，空数组 = 该模型完全不发思考控制
 *   （**有意语义**，不是 bug）。
 * - **冷却键看状态码 429 与正文里的重置时刻**，而不是只看 `code`。冻结的错误码表里
 *   七条 429 有五条是额度类（`USAGE_LIMIT` / `PLAN_LIMIT` / `NO_BALANCE` / `PLAN_EXPIRED` /
 *   `MODEL_NOT_IN_PLAN`），它们不可重试，而「`code === 'RATE_LIMIT'` 才冷却」会让
 *   **已用尽的窗口永远不被冷却**——号池会一遍又一遍把同一个已用尽账号派出去。
 */
import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type LlmProviderInfo, type LlmResolvedModelInfo, type PreparedAdapterCall, type ResolvedRetryPolicy, type StreamChunk } from '@deepseek-ai/dsh-llm';
import { type GenerateOptions as NormalizedGenerateOptions } from '../common/llm-compat.ts';
import { type AttachmentImageReader, type ResolvedRequestImages } from '../common/request-images.ts';
import { type GlmModelEntry } from './model-catalog.ts';
import { GlmCodingPlanCredentialStore, GlmCodingPlanModelSettingsStore, type GlmCodingPlanPreferenceStore } from './token-store.ts';
import type { GlmCodingPlanAccountPool } from './account-pool.ts';
import type { GlmRegion, GlmWire } from '../../shared/glm-coding-plan-contracts.ts';
/**
 * 这条路由的瞬时故障重试策略。
 *
 * 可重试的集合与兄弟线路逐字一致：RATE_LIMIT（真的背压）、SERVER（上游 5xx）、
 * TRANSPORT（没有应答的连接）、TIMEOUT（卡住的流，由空闲看门狗负责）。
 *
 * 刻意不在集合里：AUTH（被拒的 Key 每次都一样）、QUOTA（额度用尽，等窗口重置）、
 * PROVIDER_ERROR（400 或套餐拒绝）、ABORTED（调用方自己取消）。
 */
export declare const GLM_CODING_PLAN_RETRY_POLICY_CONFIG: {
    mode: 'normal';
    maxRetries: number;
    retryableCodes: string[];
    backoff: {
        initialDelayMs: number;
        maxDelayMs: number;
        jitterRatio: number;
    };
};
/** 上游没有给 `Retry-After`、正文也没有重置时刻时，一次冷却按多久算。 */
export declare const GLM_POOL_COOLDOWN_MS: number;
/**
 * 从一份 429 正文里取窗口重置时刻（Unix 毫秒）。
 *
 * 它**不做分类**——分类是两个 mapper 各自唯一的一份，本文件只取一个时间：
 * 「这个账号要到什么时候才能再用」是号池需要的，而「这是不是限流」不是。
 *
 * **未验证**：字段名。上游的配额响应里出现过 `nextResetTime` 与 `resetTime`，
 * 429 正文用什么字段没有样本，所以这里只认这几个已知拼写，认不出就返回 undefined，
 * 由调用方回落到 `Retry-After` 或默认冷却时长。
 */
export declare function readGlmResetAt(body: unknown): number | undefined;
/**
 * 一次 429 该不该冷却这个账号、冷却多久。
 *
 * 判据是**状态码 429**，而不是错误码：冻结的 `ERROR_CODE` 表里七条 429 中五条是额度类，
 * 它们分别映射到 `QUOTA` / `PROVIDER_ERROR`，只认 `code === 'RATE_LIMIT'` 会让
 * 「窗口已用尽」永远走不到冷却这一步——而那恰恰是最需要冷却的场景。
 *
 * 时长按可靠度依次取：正文里的重置时刻 → `Retry-After` → 默认 5 分钟。
 * 重置时刻是唯一能让「等窗口重开再试」变成事实的那个数。
 */
export declare function glmCooldownDecision(input: {
    status: number;
    headers?: Headers;
    body?: unknown;
}): {
    cooldown: boolean;
    durationMs: number;
    reason: string;
};
/**
 * 一次请求的线路形状：URL、请求头、请求体，以及它走了哪个协议面。
 *
 * 做成一个**纯函数**而不是把构建过程埋进流里，是为了「两个 mapper 按 wire 正确路由」
 * 与「ladder 正确传入」这两条验收点能被直接断言：它们是这个函数的输出，不是
 * 一次网络往返的副产品。
 */
export interface GlmRequestPlan {
    /** 实际走的协议面；调用方据此选流解析器。 */
    wire: GlmWire;
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}
/**
 * 构造一次请求。**不联网、不读设置**，所以可以被单独测。
 *
 * @param options - harness 归一化后的会话。
 * @param request - 区域、目录行、已读图片与环境覆盖。
 */
export declare function buildGlmRequestPlan(options: NormalizedGenerateOptions, request: {
    region: GlmRegion;
    entry: GlmModelEntry;
    images?: ResolvedRequestImages;
    env?: NodeJS.ProcessEnv;
}): GlmRequestPlan;
export interface GlmCodingPlanAdapterOptions {
    fetchFn?: typeof fetch;
    attachments?: AttachmentImageReader;
    /** 多账号号池；缺省走单凭据路径（无头 host 与测试）。 */
    accountPool?: GlmCodingPlanAccountPool;
}
/**
 * GLM（ZCode 账号）线路的 LlmAdapter 实现。
 *
 * 目录在进程内缓存优先：请求路径上不去打上游拉目录（那会让每一次请求都多一个往返，
 * 而且卡片打开时就能把目录同步好），实时目录只作为 `/catalog/refresh` 的产物存在。
 */
export declare class GlmCodingPlanAdapter extends LlmAdapter {
    private readonly store;
    private readonly modelSettings;
    private readonly preferences;
    private readonly accountPool;
    private readonly options;
    constructor(store?: GlmCodingPlanCredentialStore, modelSettings?: GlmCodingPlanModelSettingsStore, preferences?: GlmCodingPlanPreferenceStore, options?: GlmCodingPlanAdapterOptions);
    providerInfo(provider: string): LlmProviderInfo;
    providerRetryPolicy(): ResolvedRetryPolicy;
    imageRequestPricing(): undefined;
    private settings;
    /**
     * 这个部署能调的模型。
     *
     * 进程内缓存优先、随包目录兜底：**请求路径上绝不联网**。
     * 实时目录只由 `/catalog/refresh` 与连接测试拉取，落进 `client.ts` 的缓存。
     */
    private catalog;
    /**
     * 这一行请求用哪份凭据。
     *
     * 有池时轮转；没有池时读单凭据存储（无头 host 与测试的形态）。
     * 两条路径都不主动刷新：Coding Plan Key 不声明失效时刻（见 account-pool 的 needsRefresh）。
     */
    private credentialFor;
    listModels(provider?: string): Promise<readonly LlmModelInfo[]>;
    resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    /**
     * 一次请求的完整往返：选账号 → 定协议面 → 发 → 解析流。
     *
     * 账号轮转的循环只有一处：一次 429 或一次 AUTH 会把那个账号移出本次请求，
     * 由另一个账号来发**同一份**请求体。没有池时这个循环只跑一次。
     */
    private requestStream;
}
//# sourceMappingURL=adapter.d.ts.map