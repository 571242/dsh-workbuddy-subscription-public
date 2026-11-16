/**
 * GLM（ZCode 账号）线路的 **OpenAI 兼容面**（协议 B）线映射。
 *
 * 上游面是 Coding Plan 专用的 OpenAI Chat Completions 形状，地址为
 * `{apiBaseForRegion(region)}` + `CHAT_PATH_OPENAI`（= `/api/coding/paas/v4`），
 * 实际调用 `/api/coding/paas/v4/chat/completions` 与 `/api/coding/paas/v4/models`。
 *
 * **刻意不是 `/api/paas/v4`**：那是通用开放平台面，官方文档的 Common mistakes 段写明
 * 走那个面套餐额度不会正确生效（计划 §3.3，证据等级 A）。也就是说发错前缀不会报错，
 * 用户只会看到「明明买了套餐却在扣余额」，所以前缀由 `./types.ts` 的常量固定，不在此处拼。
 *
 * 本文件吸收的四处与 OpenAI 默认形状不同的地方，每一处都有来源：
 *
 * 1. **思考在 `delta.reasoning_content`**，不是 OpenAI 的 `reasoning_summary`，
 *    落到 DSH 的 reasoning block。逐字来源：本仓库历史提交 `9ad8a53` 的
 *    `src/host/zhipu/mapper.ts` 实测转录。
 * 2. **`reasoning_effort` 只接受模型自己的梯子**（GLM-5.x 为 `low`/`high`/`max`），
 *    别的取值上游直接报错（业务码 1214 INVALID_PARAM，见 `ERROR_CODE` 表）。
 *    DSH 的档位词汇更宽（`minimal`/`medium`/`xhigh` 在别的线路上都存在），
 *    因此每个取值先经 `convergeGlmEffort()` 落到梯子上再发。该函数跨两套词汇表排名，
 *    `none`/`minimal` 也有位置可落——只排三档会把 `minimal` 误升成 `high`，
 *    那正是本仓库历史记录过的 bug（见 `./types.ts` 的 `convergeGlmEffort` 注释）。
 * 3. **不发 `thinking.type`**。`thinking` 的默认是 enabled，而 GLM-5.3 /
 *    GLM-5.3-FLASH / GLM-4.7 把 `thinking.type: "disabled"` 当**错误**，
 *    所以本线路任何模型都不发关闭值，直接省略该字段（同上，历史 mapper 注释）。
 * 4. **不发 `stream_options`**。上游的流式文档里 usage 对象是随末帧到的，
 *    该字段也不在文档化的请求 schema 里；给这个 API 发一个未文档化的字段，
 *    代价可能只是一个毫无收益的 400（同上，历史 mapper 注释）。
 *
 * **未验证**：以上第 1-4 条全部来自 `9ad8a53` 的历史实测转录，本轮**没有实机账号**
 * （计划 D9、R1），因此没有一次 live 复核。缺的是一份真实 SSE 帧样本与一份真实 400 响应样本。
 * 结构性的部分（字段名、认证头形状）证据等级 A；行为性的部分（哪些取值会被拒）
 * 只到「历史实测记录」这一层。
 */
import { LlmError, type GenerateOptions, type OutboundContentBlock, type StreamChunk } from '../common/llm-compat.ts';
import type { GlmRegion } from '../../shared/glm-coding-plan-contracts.ts';
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment';
/**
 * 本文件自己用的失败码：调用方要求了一件这个面做不到的事。
 *
 * 与上游那张业务码表不是一回事——`ERROR_CODE` 说的是上游说了什么，
 * 这一个说的是本线路在发请求之前就知道做不到。处置因此不同：后者不该重试，
 * 也不该让用户以为「上游出问题了」，而是换模型或换调用方式。
 *
 * 取值是 harness 的**通用码** `UNSUPPORTED_OPTION`，不是本线路自造的：harness 自己的
 * provider 就在用同一个串（`packages/llm/llm-pi-ai/src/adapter.ts:335` 抛的是
 * `new LlmError('llm-pi-ai does not support GenerateOptions.stop', 'UNSUPPORTED_OPTION')`），
 * 本线路的 Anthropic 面（`mapper-anthropic.ts`）也用同一个串。
 *
 * 所以两个面共用一个码：装配层要判断「这个面做不到这件事」时，只有一个词要认，
 * 而不是先问是哪个面。自造一个带线路前缀的码会让调用方多学一个词，
 * 也会让同一个线路的两面出现两个说法。
 */
export declare const UNSUPPORTED_OPTION_CODE = "UNSUPPORTED_OPTION";
/** 上游 Chat Completions 路径，接在 `CHAT_PATH_OPENAI` 之后。 */
export declare const CHAT_COMPLETIONS_SEGMENT = "/chat/completions";
/** 上游模型清单路径，接在同一个 `CHAT_PATH_OPENAI` 之后。 */
export declare const MODELS_SEGMENT = "/models";
/** 本面一个完整请求的 URL：`{apiBase}{CHAT_PATH_OPENAI}/chat/completions`。 */
export declare function chatCompletionsUrl(region: GlmRegion, env?: NodeJS.ProcessEnv): string;
/** 本面模型清单的 URL：`{apiBase}{CHAT_PATH_OPENAI}/models`。 */
export declare function modelsUrl(region: GlmRegion, env?: NodeJS.ProcessEnv): string;
/**
 * OpenAI 兼容面的请求头。
 *
 * 认证是 `Authorization: Bearer {credential}`，credential 是兑换链换出来的
 * `{id}.{secret}` Coding Plan Key（计划 §3.2、§3.3）。
 *
 * **刻意不发 `x-api-key`**：双头是 **Anthropic 兼容面**的性质，官方源码注释逐字写着
 * 「Anthropic 兼容网关会同时读取 x-api-key 和 Bearer Authorization」
 * （`model/model-execution.ts:425-437`，计划 §3.3）。本面只读 Bearer，
 * 多发一个头不会更好，只会让日后复审误以为两面共用一套认证。
 *
 * 配额接口则**反过来**用裸 Key、不加 Bearer（见 `./types.ts` 的 `QUOTA_PATH` 注释），
 * 那是另一条路，不归本文件管。
 */
export declare function glmOpenAiHeaders(credential: string, extra?: Record<string, string>): Record<string, string>;
/**
 * 调用方（适配器）交给本映射的**逐模型**能力声明。
 *
 * 存在的原因是一条硬规则：**能力不得从模型名推断**（计划 §1、§7）——
 * 历史草案记录过 `glm-5.3-flash` 收图而 `glm-5.3` 不收、`glm-5.2` 两个档位而
 * `glm-5.3` 三个。所以本文件只读声明，绝不看 `options.model` 里的字符串。
 */
export interface GlmOpenAiModelRoute {
    /**
     * 该模型真实接受的思考档位梯子（目录逐行给出）。
     *
     * 空数组表示它不接受 `reasoning_effort`，此时本文件**不发**该字段：
     * `convergeGlmEffort` 对空梯子返回 null，调用方据此不发，而不是发一个模型不认的值。
     */
    readonly reasoningEfforts: readonly string[];
    /** 是否接受 image 输入。 */
    readonly supportsImages: boolean;
    /**
     * 调用方未给 `maxTokens` 时本线路请求的输出上限。
     *
     * 缺省取 `DEFAULT_MAX_TOKENS`，那个常量在 `./types.ts` 里已标注**未验证**
     * （它不是任何 GLM-5.x 模型的官方上限，只是历史兜底值）。
     */
    readonly defaultMaxTokens?: number;
}
/**
 * 目录尚未落地时使用的保守声明。
 *
 * 两项都取「什么都不发」的一侧：梯子为空 → 不发 `reasoning_effort`（让上游用自己的默认），
 * 不认图 → 请求里的图片按「读不出来」明说，而不是发一个上游会拒的 `image_url`。
 * 这不是对能力的判断，是「没有声明就不主张」。
 */
export declare const UNDECLARED_MODEL_ROUTE: GlmOpenAiModelRoute;
/** 本面需要的附件接缝：一个持久图片的已验证字节。 */
export type AttachmentImageReader = Pick<AttachmentStore, 'readImage'>;
/** 一个请求内已解析的持久图片，或「已证明读不出来」。 */
export type ResolvedRequestImage = {
    readonly kind: 'inline';
    readonly mediaType: string;
    readonly data: string;
} | {
    readonly kind: 'unavailable';
};
/** 按持久附件 id 索引的图片；由一次请求构建消费。 */
export type ResolvedRequestImages = ReadonlyMap<string, ResolvedRequestImage>;
/**
 * 一次请求允许携带的 base64 图片上限：12 MB。
 *
 * 取本仓库其余 OpenAI 形状线路的同一个值（`workbuddy` / `zhipu` 的同名常量），
 * 理由是让图文与工具 schema 留在同一个 body 里。
 *
 * **未验证**：GLM Coding Plan 这个面对单请求图片字节的真实上限没有实测样本，
 * 缺一份超限请求的真实响应。W5 的客户端一旦拿到真实 413/1214 响应即可调整此值。
 */
export declare const MAX_REQUEST_IMAGE_BYTES: number;
/**
 * 一次请求的图片字节超出 {@link MAX_REQUEST_IMAGE_BYTES} 时，把最老的内联图片换成占位文本。
 *
 * 持久历史不动，只改即将发出的那一份请求。
 */
export declare function offloadOldestRequestImages(options: GenerateOptions): GenerateOptions;
/**
 * 读出一次请求携带的每一个 `{ type: 'image', attachment }` 块。
 *
 * 读不出来的图片解析成 `unavailable` 而不是凭空消失，这样模型被明确告知图没了，
 * 而不是对着空白作答。
 */
export declare function resolveRequestImages(options: GenerateOptions, attachments: AttachmentImageReader | undefined, signal?: AbortSignal): Promise<ResolvedRequestImages>;
/** 去掉上游网关会拒或会忽略的 JSON-Schema 元关键字。 */
export declare function stripMetaSchema(schema: unknown): Record<string, unknown>;
/**
 * 构造一份 `/api/coding/paas/v4/chat/completions` 的 body。
 *
 * `reasoning_effort` 先经 `convergeGlmEffort()` 收敛到目录声明的梯子上：
 * DSH 的词汇比上游宽，而上游收到不认识的档位会直接报 1214。
 * 梯子为空时**不发**该字段，而不是发一个模型不认的值。
 *
 * `thinking` 与 `stream_options` 一律**不发**，理由见文件头第 3、4 条。
 */
export declare function buildChatRequest(options: GenerateOptions, images?: ResolvedRequestImages, route?: GlmOpenAiModelRoute): Record<string, unknown>;
/**
 * 从一份响应正文里读出平台自己的数字业务码。
 *
 * 分类**不能停在状态行**：同一个 429 覆盖了已用尽的窗口、失效的套餐和
 * 单模型授权缺口（见 `./types.ts` 的 `ERROR_CODE` 表注释），它们要不同的处置。
 */
export declare function readGlmErrorCode(detail: string): number | null;
export declare function classifyGlmOpenAiFailure(status: number, detail: string, headers?: Headers): LlmError;
interface PendingToolCall {
    blockIndex: number;
    id: string;
    name: string;
    arguments: string;
    started: boolean;
}
/** 一次流式响应的累积状态。 */
export interface GlmOpenAiStreamState {
    blocks: OutboundContentBlock[];
    current: {
        index: number;
        type: 'text' | 'reasoning';
        text: string;
    } | null;
    /** 线上工具下标 -> 累积中的调用。 */
    toolCalls: Map<number, PendingToolCall>;
    hasContent: boolean;
    hasToolCall: boolean;
    finishReason: string | null;
    /** `[DONE]` 哨兵到了。 */
    done: boolean;
    /** 终止块已经发出过。 */
    finished: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    reasoningTokens: number;
    sawUsage: boolean;
}
export declare function createStreamState(): GlmOpenAiStreamState;
/** 喂进来一条 `/chat/completions` 的 SSE 行。 */
export declare function processStreamLine(line: string, state: GlmOpenAiStreamState): StreamChunk[];
/**
 * 冲掉所有打开的块，然后**先发 usage、再发 finish**。
 *
 * 顺序是硬要求：DSH 的执行器按 finish 结算一次调用，usage 排在它后面就来不及入账。
 */
export declare function closeStream(state: GlmOpenAiStreamState): StreamChunk[];
/**
 * 一条流在没有终局事件的情况下结束，那是**被截断**，不是答完了。
 *
 * 这个端点总是以 `finish_reason` 或 `[DONE]` 收尾，所以两者都没有意味着
 * 连接在答案中途断了，半截文本不能当成完成的回复呈现。
 */
export declare function assertStreamComplete(state: GlmOpenAiStreamState): void;
export {};
//# sourceMappingURL=mapper-openai.d.ts.map