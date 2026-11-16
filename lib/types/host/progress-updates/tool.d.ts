/**
 * 模型可见的 progress_update 工具。
 *
 * 这是一个**不结束回合**的工具：它只把一条进展推给用户界面，随后模型继续
 * 干活。开关关闭时工具照常注册（否则工具清单会在会话中途变化），但 execute
 * 直接返回 `displayed:false` 而不是抛错——一条被关掉的汇报不该变成一次失败
 * 的工具调用。
 *
 * @module dsh-chatgpt-subscription/host/progress-updates/tool
 */
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { type ProgressUpdate } from './store.ts';
/** 注册的工具名。冻结契约的一部分，不要改动。 */
export declare const NOTIFY_USER_TOOL = "progress_update";
/** 工具关闭时返回给模型的文本（canonical 输出的 render，而不是抛错）。 */
export declare const DISABLED_OUTPUT_TEXT = "Progress updates are disabled; the update was not displayed.";
/** 工具描述的最终全文。 */
export declare const PROGRESS_UPDATE_DESCRIPTION: string;
/** 一条进展被接受之后，宿主侧要把新状态往回推（路由与面板据此渲染）。 */
export interface ProgressUpdateSink {
    /** 追加一条进展；返回它是否被真正展示。 */
    push(update: ProgressUpdate): boolean;
}
/** 工具执行结果：canonical JSON，冻结契约的一部分。 */
export interface ProgressUpdateResult {
    /** 这条进展是否真的展示给了用户。 */
    displayed: boolean;
}
/**
 * 构造 progress_update 工具。
 * @param deps - 依赖：当前开关与进展接收端。
 * @returns 可注册的工具定义。
 */
export declare function createProgressUpdateTool(deps: {
    /** 读取当前开关状态（每次调用重新求值）。 */
    isEnabled: () => boolean;
    /** 进展接收端；未接线时返回 undefined，此时报告不会展示。 */
    sink?: () => ProgressUpdateSink | undefined;
    /** 当前会话标识，写进进展的 source 字段。 */
    sourceOf?: (exec: unknown) => string | undefined;
}): ToolDefinition;
//# sourceMappingURL=tool.d.ts.map