/**
 * GLM（ZCode 账号）线路的 **Anthropic Messages 面**映射。
 *
 * 端点形状（证据等级 A）：请求打 `{apiBaseForRegion(region)}{CHAT_PATH_ANTHROPIC}/v1/messages`，
 * 例如国际区 `https://api.z.ai/api/anthropic/v1/messages`，国区 `https://open.bigmodel.cn/api/anthropic/v1/messages`。
 * 两者逐字来自计划 `3.3 的模型面表（`zcode.z.ai/en/docs/qa` 第 6 条）与 `./types.ts` 的
 * `CHAT_PATH_ANTHROPIC`。
 *
 * 一、认证是**双头**，这是本文件第一个必须做对的事
 *
 * 官方源码注释逐字写着「Anthropic 兼容网关会同时读取 x-api-key 和 Bearer Authorization」
 * （`apps/zcode-cli/packages/adapters/src/model/model-execution.ts:425-437`，计划 `3.3）。
 * 同值各发一份，见 {@link glmAnthropicHeaders}。少发任何一个都会得到 401，而错误正文
 * 说的是「凭据没出现在头部里」（`ERROR_CODE.AUTH_MISSING` = 1001），排查方向会被带偏。
 *
 * 注意这与配额面**正好相反**：`/api/monitor/usage/quota/limit` 要的是裸 Key、
 * **不可**加 Bearer 前缀（`./types.ts` 的 `QUOTA_PATH` 注释）。两处不能互相抄。
 *
 * 二、思考档位必须**跨两套词汇表**收敛
 *
 * DSH 的档位词汇比上游宽（`minimal` / `medium` / `xhigh` 在别的线路上都存在），
 * 而 GLM-5.x 在 Coding Plan 上只接受 `low` / `high` / `max`，其余取值上游直接报错。
 * 因此每个值都要先落到**模型真实梯子**上，见 {@link glmEffortForLadder} 与
 * `./types.ts` 的 `convergeGlmEffort()`。
 *
 * 只排上游那三档会踩本仓库记录过的 bug：`minimal` 属于「未识别」，未识别一律落在中档，
 * 于是 `minimal` 被发成 `high`——模型想得比用户要求的长得多，**更慢而且多计费**。
 *
 * 三、本文件**不伪造模型名**
 *
 * `GenerateOptions.model` 是调用方（模型目录）给的 id，逐字下发。本线路两区模型 id
 * 不一致（计划 R8），任何按前缀猜测或「顺手换成官方名」的改写都会把请求打到上游
 * 不认识的 id 上（`ERROR_CODE.UNKNOWN_MODEL` = 1211）。
 *
 * 四、分块语义照兄弟线路的 Anthropic 面，不另发明
 *
 * 思考 / 文本 / 工具调用是三个独立的 DSH 块：思考文本走 `reasoning-delta`，正文走
 * `text-delta`，工具参数逐字拼接后交给 `tool-call` 块的 `arguments` 字符串
 * （DSH 协议义务：参数保持模型产出的原始 JSON 串）。
 * 参考实现是 `../minimax-code/mapper.ts`（同为 Anthropic 面）与 `../claude/mapper.ts`。
 *
 * 五、思考块的**回放**本文件不做
 *
 * Claude / minimax 两条线会把签名的 thinking 块原样存进 replayState 再回传。本线路
 * 没有这个需求的证据：GLM 的 Anthropic 兼容面是否要求回放签名块，没有任何实测样本。
 * 历史同族实现 `7e40fce` 的 `src/host/zhipu/mapper.ts` 选择「reasoning 块从不回放」。
 * 本文件沿用那一条并在 {@link anthropicAssistantContent} 注明；**未验证**：改成
 * 「回放」是否会被本面接受（需要一条真实多轮会话样本）。
 *
 * 未验证清单（本文件内逐条标注）：
 *
 * 1. `reasoning_effort` 出现在 Anthropic 面上。等级 A 的证据只覆盖 OpenAI 面的
 *    `/api/coding/paas/v4`；本面是同一平台的兼容网关，但它是否读顶层
 *    `reasoning_effort` 没有实测样本。用 `buildGlmAnthropicRequest` 的
 *    `sendReasoningEffort` 开关可整段关掉。
 * 2. `anthropic-version` 头网关是否强制要求。缺一条缺头的 4xx 样本。
 * 3. 网关在 Anthropic 面上发思考增量的词汇。本文件同时认 `thinking_delta` 与
 *    `reasoning_content`，两种都收。
 * 4. 历史里 reasoning 块不回放是否被本面接受（见第五节）。
 */
import { LlmError, type ContentBlock, type GenerateOptions, type OutboundContentBlock, type StreamChunk } from '../common/llm-compat.ts';
import { type ResolvedRequestImages } from '../common/request-images.ts';
import type { GlmReasoningEffort, GlmRegion } from '../../shared/glm-coding-plan-contracts.ts';
/**
 * Anthropic Messages 协议版本头。
 *
 * 取值来自 Anthropic 公开协议常量，兄弟线路同值（`../kimi-code/client.ts:129` 的
 * `'anthropic-version': '2023-06-01'`）。本线路网关是否**强制**要求这个头没有任何实测
 * 样本（**未验证**，缺一条缺头的 4xx 样本），但发一个正确版本号的成本是零，所以照发。
 */
export declare const GLM_ANTHROPIC_VERSION = "2023-06-01";
/**
 * 本线路「这个选项在 Anthropic 面上送不出去」的稳定错误码。
 *
 * 语义与 harness 的 `HarnessError.code` 一致：稳定的机器可路由码，不要去解析 message。
 * 存在的理由是**不许静默忽略**——一个送不出去的选项如果被悄悄丢掉，用户看到的是一个
 * 「按默认设置跑」的回合，而不是一次能指认到具体选项的失败。
 * 这条码不在任何线路的重试集合里（各线路 `retryableCodes` 只含 RATE_LIMIT / SERVER /
 * TIMEOUT / TRANSPORT 等），所以抛出后不会被重试策略放大。
 */
export declare const UNSUPPORTED_OPTION_CODE = "UNSUPPORTED_OPTION";
/**
 * Anthropic 面的完整 URL：`{模型面 base}{CHAT_PATH_ANTHROPIC}/v1/messages`。
 *
 * base 取 `./types.ts` 的 `apiBaseForRegion`（国际区 `https://api.z.ai`、
 * 国区 `https://open.bigmodel.cn`，都受 `DSH_GLM_*_API_HOST` 覆盖），路径前缀取同文件
 * 的 `CHAT_PATH_ANTHROPIC`。区域是**凭据的属性**（计划 `1、`3.3），所以调用方必须把
 * 账号的区域传进来，而不是让这里去猜——猜错的代价是拿另一区的主机去验一把本区 Key，
 * 得到的是明确鉴权失败。
 *
 * @param region - 账号所属部署。
 * @param env - 环境变量表，默认 `process.env`（覆盖值在调用时读取，便于测试注入）。
 */
export declare function glmAnthropicUrl(region: GlmRegion, env?: NodeJS.ProcessEnv): string;
/**
 * Anthropic 面请求头，认证是**双头**且同值。
 *
 * `x-api-key` 与 `Authorization: Bearer <key>` 各发一份：官方源码逐字写明这个兼容网关
 * 同时读取两者（`model/model-execution.ts:425-437`，计划 `3.3）。只发一个的后果是
 * 401 `AUTH_MISSING`(1001)，而那一条正文说的是「凭据没出现在头部里」，会把排查引向
 * 凭据存储而不是认证头。
 *
 * `extra` 覆盖不了认证三件套（两个认证头 + 协议版本头）：它们不是「调用方想改就改」的
 * 普通头，而是本面必须成对出现的协议事实，让一个 `extra` 把双头拆成不同值或只留一个，
 * 造出来的故障比不带 extra 更难查。
 *
 * @param apiKey - Coding Plan Key（兑换链拼出的 `{apiKey}.{secretKey}`）。空白即抛 AUTH。
 * @param extra - 追加请求头（调试、代理）。不能改写认证三件套。
 */
export declare function glmAnthropicHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string>;
/**
 * 把 DSH 的档位收敛到该模型真实接受的梯子上。
 *
 * 跨两套词汇表排名（`none`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max` 与上游的三档
 * 一起排）之后取最近一档，平手向上取——与本仓库其余各线路的收敛一致，宁可多想一点，
 * 也不要少想。排名表在 `./types.ts` 的 `convergeGlmEffort()` 内，本文件不复制一份。
 *
 * 三个返回值含义不同，都不是「猜」：
 *
 * - `ladder` 为空 → `null`：该模型不接受思考档位，调用方据此**不发**任何档位字段，
 *   而不是发一个模型不认的值。
 * - 调用方没指定档位 → `null`：模型的服务端默认生效，映射层不代它选。
 * - 其余 → 模型梯子上真实存在的那一档。
 *
 * @param ladder - 模型目录为该模型声明的真实梯子（`GlmModelOption.reasoningEfforts`）。
 * @param requested - 调用方给的档位（DSH 的 `ReasoningEffortId`，可为空）。
 */
export declare function glmEffortForLadder(ladder: readonly string[], requested: string | undefined | null): GlmReasoningEffort | null;
/** 一次请求的思考控制。 */
export interface GlmThinkingControl {
    /** 要写进请求体的字段；为空表示这条请求不带任何思考控制。 */
    fields: Record<string, unknown>;
    /** 模型这次会不会思考。用于判断与思考互斥的选项（例如 temperature）。 */
    thinking: boolean;
}
/**
 * 请求体里的思考控制字段。
 *
 * `thinking: { type: 'enabled' }` 是**恒常发出**的一半：历史同族实现逐字记过
 * 「`thinking` 的默认是 enabled，GLM-5.3 / GLM-5.3-FLASH / GLM-4.7 把
 * `thinking.type: "disabled"` 当错误拒绝」（`7e40fce` 的 `src/host/zhipu/mapper.ts`
 * 头注释），所以本线路任何模型都不发关闭值。
 *
 * `reasoning_effort` 是选深度的一半，取 {@link glmEffortForLadder} 的收敛结果。
 *
 * **未验证**：`reasoning_effort` 落在 Anthropic 面上。等级 A 的证据（计划 `3.3、
 * `9ad8a53` 的 `CODING_EFFORTS`）只覆盖 OpenAI 面 `/api/coding/paas/v4`；本面是同一个
 * 平台的兼容网关，但它是否读顶层 `reasoning_effort` 没有实测样本，缺一次真实请求。
 * 之所以仍然默认发：另一个候选（Anthropic 原生的 `thinking.budget_tokens`）表达不了
 * 三档梯子，而 `sendReasoningEffort: false` 是一个出口而不是修复。
 *
 * @param ladder - 模型真实梯子。
 * @param requested - 调用方给的档位。
 * @param sendReasoningEffort - 是否把收敛后的档位发成顶层字段，默认 true。
 */
export declare function glmThinkingControl(ladder: readonly string[], requested: string | undefined | null, sendReasoningEffort?: boolean): GlmThinkingControl;
/** 本面这一次请求的构建选项。 */
export interface GlmAnthropicRequestOptions {
    /** 模型目录为该模型声明的真实思考梯子。空数组 = 该模型不接受思考档位。 */
    ladder?: readonly string[];
    /** 这次请求读到的图片（`resolveRequestImages` 的产物）。 */
    images?: ResolvedRequestImages;
    /** 是否把收敛后的档位发成顶层 `reasoning_effort`，默认 true。见 {@link glmThinkingControl}。 */
    sendReasoningEffort?: boolean;
    /** 调用方不指定输出上限时用的值，默认 `./types.ts` 的 `DEFAULT_MAX_TOKENS`。 */
    defaultMaxTokens?: number;
}
/**
 * 构造一个 Anthropic Messages 请求体。
 *
 * 字段顺序对服务端无意义，只是读起来顺。
 *
 * @param options - harness 归一化后的会话（`normalizeGenerateOptions` 的产物）。
 * @param request - 该模型的档位梯子与已读图片。
 */
export declare function buildGlmAnthropicRequest(options: GenerateOptions, request?: GlmAnthropicRequestOptions): Record<string, unknown>;
/** 一个跨多个 content-block 增量累积的工具调用。 */
interface PendingToolCall {
    /** 这个调用占的 DSH 块下标。 */
    index: number;
    id: string;
    name: string;
    /** 逐字拼接的 partial_json 片段。 */
    arguments: string;
}
/** 一个正在接收增量的思考块。 */
interface PendingThinking {
    index: number;
    kind: 'thinking' | 'redacted_thinking';
    text: string;
    signature: string;
    data: string;
}
/** 一个 Messages 响应的累积状态。 */
export interface GlmAnthropicStreamState {
    /** 按 DSH 下标排列的已发块；块一开就占位。 */
    blocks: OutboundContentBlock[];
    /** wire content index -> 正在接收文本的那个块。 */
    openText: Map<number, {
        index: number;
        text: string;
    }>;
    /** wire content index -> 累积中的工具调用。 */
    toolCalls: Map<number, PendingToolCall>;
    /** wire content index -> 打开着的思考块。 */
    pending: Map<number, PendingThinking>;
    hasContent: boolean;
    hasToolCall: boolean;
    /** wire 的 `stop_reason`，逐字保留。 */
    finishReason: string | null;
    /** 带内 `error` 事件的原始对象，记下来供适配层判断此刻还能不能安全重试。 */
    streamError?: Record<string, unknown>;
    sawMessageStart: boolean;
    sawMessageStop: boolean;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    /** 结束之前是否真的见过 usage；没见过就不发 usage 块（零值 usage 是谎报）。 */
    sawUsage: boolean;
    finished: boolean;
}
/** 新的一次响应的流状态。 */
export declare function createGlmAnthropicStreamState(): GlmAnthropicStreamState;
/**
 * 冲掉所有打开的块，然后发 usage，最后发终止的 finish。
 *
 * 顺序是协议义务：**usage 必须在 finish 之前，finish 之后不得再有任何块**
 * （DSH 的 `StreamChunk` 文档逐字这么写）。所以本函数把 usage 排在 finish 前一行，
 * 而 {@link processGlmAnthropicStreamLine} 一旦 `finished` 为真就返回空数组——
 * 迟到的增量不会变成 finish 之后的块。
 *
 * 幂等：`message_stop` 已经关过流，适配层在响应体结束后再调一次是空操作而不是第二个 finish。
 * 本函数**不**判断流是否完整，那是 {@link assertGlmStreamComplete} 的事。
 */
export declare function closeGlmAnthropicStream(state: GlmAnthropicStreamState): StreamChunk[];
/**
 * 流没有走到终止事件 = 被截断的回复，不是完整答案。
 *
 * 已经发出的内容只是模型没说完那句话的前缀，把它冲成一个干净 stop 就是把一次截断
 * 报成一次成功——这正是这条检查存在的理由。
 */
export declare function assertGlmStreamComplete(state: GlmAnthropicStreamState): void;
/** 这一路流有没有带出任何内容。 */
export declare function glmStreamHasContent(state: GlmAnthropicStreamState): boolean;
/**
 * 把一条 Messages SSE 行喂进状态，返回这一行该发出的 DSH 块。
 *
 * 忽略不携带内容的行：SSE 注释（心跳）、`event:` 名字行（载荷自带的 `type` 才是权威）、
 * 空行与本构建不认识的事件类型。`error` 事件**抛错**：回复已经结束，
 * 继续把它冲成一个干净 stop 等于把错误答案报成成功答案。
 *
 * @param line - 一行 SSE 文本（不要求带换行）。
 * @param state - 本次响应的累积状态。
 */
export declare function processGlmAnthropicStreamLine(line: string, state: GlmAnthropicStreamState): StreamChunk[];
/** 一次上游失败的机器可读判读结果。 */
export interface GlmUpstreamErrorVerdict {
    /** 该转成哪一个 `LlmError.code`（重试策略按它判读）。 */
    llmCode: string;
    /**
     * 这一类失败值不值得重试。
     *
     * 判据来自 `./types.ts` 的 `ERROR_CODE` 注释：可重试的只有 `RATE_LIMITED`（退避后重试，
     * 号池可换账号）与 `OVERLOADED`（瞬时过载）；其余全部不可重试——重试一次确定的失败
     * 只会把它拖成多次，并在额度类错误上多烧一次额度。
     * `USAGE_LIMIT` / `PLAN_LIMIT` 带重置时刻，正确处置是等窗口重置而不是立刻重试。
     */
    retryable: boolean;
    /** 正文给出的业务码；没有则是 null。 */
    businessCode: number | null;
    /** HTTP 状态；调用方没给则是 null。 */
    status: number | null;
    /** 面向人的处置说明。 */
    disposition: string;
}
/**
 * 把一次上游失败判读成机器可路由的结论。
 *
 * 分类**不能停在状态行**：多个真实条件共用同一个 HTTP 状态（表里 429 有六条，
 * 401 有三条），所以正文里的业务码才是判据，状态行只在本面没给出业务码时兜底。
 *
 * 两个兜底方向都是有意选的：
 *
 * - 未知 5xx → 可重试（传输面故障，语义上与 OVERLOADED 同族）。
 * - 未知 429 → **不可重试**。本表里六条 429 里有五条是额度类，立即重试只会继续失败，
 *   还会多烧一次额度；宁可让调用方等一下也不要把它变成重试风暴。
 *
 * @param input - HTTP 状态（可选）与上游正文（可选）。
 */
export declare function classifyGlmUpstreamError(input: {
    status?: number | undefined;
    body?: unknown;
}): GlmUpstreamErrorVerdict;
/**
 * 构造一次上游失败（不抛，交给调用方决定抛点）。
 *
 * 让调用方（适配层）既拿到 `LlmError` 的稳定 code，又拿到「这次到底该不该重试」的
 * 判读结果——两者不是一回事：code 决定路由，retryable 决定重试策略。
 *
 * @param input - HTTP 状态（可选）与上游正文（可选）。
 */
export declare function glmUpstreamError(input: {
    status?: number | undefined;
    body?: unknown;
}): LlmError;
export type { ContentBlock };
//# sourceMappingURL=mapper-anthropic.d.ts.map