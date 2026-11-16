/**
 * 对话流里的「进展行」——本插件的主形态。
 *
 * agent 每发一条进展，对话里就多一行：标题行（状态点 + 标题 + 状态词）常显，
 * 正文默认收起，点标题展开。侧栏面板是它的**汇总视图**，这个视图才是用户真正
 * 会一直盯着看的东西。
 *
 * ## 三个阶段的读法
 *
 * `tool.call.toolview` 的 `block` 是阶段相关的（平台在 harness 0.1.7-rc.1 之后
 * 交来 preparing / start / result 三态）：
 * - `phase: 'preparing'` —— 参数还在流式生成，只有前缀视图，没有 `argsRaw`；
 * - `phase: 'start'` —— 参数完整（`argsRaw`），结果还没回来；
 * - `'kind' in block`（`tool-result`）—— 已结算，`isError` 决定是成功还是失败。
 *
 * 参数三个阶段的读法不同，所以 {@link argOf} 先试前缀视图（`args.text`），再退回
 * `argsRaw` 的 JSON 解析——与同目录的 `CodexImageToolView.promptFromBlock` 同款，
 * 因为它要面对的正是同一批阶段形状。
 *
 * 组件只读它真正用到的几个字段，不写 `PropsRuntime<'tool.call.toolview'>`：那个
 * 类型的 owner 面由 ui-tool 合并，本插件不依赖它；反过来，写窄一点也让这份视图
 * 能在没有槽位框架的场合（jsdom 测试）直接渲染。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates/progress-row
 */
import { type ReactNode } from 'react';
import type { ProgressUpdate } from './contracts.ts';
import { type CopySeat } from './updates-panel.tsx';
/**
 * 一次工具调用在当前阶段交来的内容块。
 *
 * 只声明本视图真正读的字段：三个阶段共有 `callId` / `name` / `args`，另外
 * start 阶段有 `argsRaw`，结算后有 `kind` / `isError`。
 */
export interface ProgressRowBlock {
    /** 调用 id，三个阶段不变。 */
    callId?: string;
    /** 线上工具名。 */
    name?: string;
    /** 参数视图：流式阶段给到目前已到的前缀。 */
    args?: {
        /**
         * 读一个字符串参数。
         * @param key - 参数名。
         * @returns 该参数当前的文本；缺失或类型不是字符串时 undefined。
         */
        text?: (key: string) => string | undefined;
    };
    /** 参数已完整时的完整 JSON 文本。 */
    argsRaw?: string;
    /** 已结算时的块判别值。 */
    kind?: string;
    /** 已结算时：这次调用是否失败。 */
    isError?: boolean;
}
/** 状态点的颜色：运行中品牌色、成功绿、失败红。 */
declare const DOT_COLORS: {
    readonly running: "var(--dsw-alias-brand-primary, #4d6bfe)";
    readonly done: "var(--dsw-alias-state-success-primary, #2ba471)";
    readonly error: "var(--dsw-alias-state-error-primary, #d54941)";
};
/** 一行的状态：三选一。 */
export type ProgressRowState = keyof typeof DOT_COLORS;
/**
 * 把一次工具调用折成一行进展。
 * @param block - 当前阶段的内容块。
 * @returns 进展形状（id/时间戳不在参数里，故只取标题与正文）。
 */
export declare function progressOfBlock(block: ProgressRowBlock): Pick<ProgressUpdate, 'title' | 'message'>;
/**
 * 本视图的 props：内容块 + 文案座位。
 *
 * 框架会另外注入 `callId` / `useDisclosure` / `openFile` 等标准座位；本视图一个
 * 都不用，所以这里只声明它读的那两项，多余字段在结构类型下自动兼容。
 */
export type ProgressRowProps = {
    /** 本次调用在当前阶段的内容块。 */
    block: ProgressRowBlock;
} & CopySeat;
/**
 * 对话流里的一行进展。
 * @param props - 内容块与文案座位。
 * @returns 一行进展；标题行常显，正文按交互展开。
 */
export declare function ProgressRow({ block, t }: ProgressRowProps): ReactNode;
export {};
//# sourceMappingURL=progress-row.d.ts.map