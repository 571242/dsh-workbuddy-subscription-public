/**
 * 进展正文的轻量 Markdown 渲染。
 *
 * ## 为什么不复用平台的 MarkdownText
 *
 * 平台的渲染器在 `@deepseek-ai/dsh-client-ui-primitives` 里，那个包的 `lib` 是
 * **浏览器构建产物**：顶层静态 `import css from './StateDot.module.css'`。Node 的 ESM
 * 加载器先于任何 vite 插件与 alias 生效，所以只要本包在测试里 import 它，整个测试
 * 文件就 `Unknown file extension ".css"`。那是「只被 shell 加载」的包，不该被别的包
 * 在 Node 里 require。
 *
 * ## 这个渲染器覆盖什么
 *
 * 这里做的是模型汇报时**实际会写**的那一小撮：
 *
 * - 段落（空行分隔，段内换行保留）
 * - `-` / `*` / `•` 开头的无序列表，以及 `1.` 开头的有序列表
 * - GFM 表格（表头行 + 分隔行 + 数据行，支持 `:---` / `:---:` / `---:` 对齐）
 * - 行内 `code`
 * - `**粗体**`
 * - `###` 标题（最多三级）
 *
 * 表格是**后补**的：早先版本把它当「超出契约」排除了，结果模型写出来的管道符表格
 * 整块落进段落分支、原样上屏（用户直接看到一堆竖线）。渲染一个表格的代价只是
 * 一次前瞻扫描，远小于它被读错造成的损失。
 *
 * 仍然刻意**不做**图片、链接、原始 HTML、脚注与围栏代码块：这些要么需要安全过滤，
 * 要么属于「进展汇报」这个场景不需要的重型排版。渲染结果全是 React 元素，不经过
 * `dangerouslySetInnerHTML`，因此没有注入面。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates/markdown-lite
 */
import type { ReactNode } from 'react';
/** 表格里一列的对齐方式；GFM 分隔行的 `:---` / `:---:` / `---:` 决定。 */
export type ColumnAlign = 'left' | 'center' | 'right';
/** 块级解析的一个中间行类型。 */
type Block = {
    kind: 'p';
    lines: string[];
} | {
    kind: 'ul';
    items: string[];
} | {
    kind: 'ol';
    items: string[];
} | {
    kind: 'h';
    level: number;
    text: string;
} | {
    kind: 'table';
    header: string[];
    aligns: ColumnAlign[];
    rows: string[][];
};
/**
 * 一行表格 → 单元格数组。
 *
 * 先按未转义的 `|` 切，再剥掉首尾因为 `| a | b |` 这种写法留下的空单元；
 * `\|` 是单元格里的字面量竖线，切之前先换成占位符，切完再换回来。
 * @param line - 表格的一行原文。
 * @returns 去掉两侧空白的单元格。
 */
export declare function splitRow(line: string): string[];
/**
 * 分隔行的每个单元格 → 对齐方式。
 * @param line - 分隔行原文。
 * @returns 与列一一对应的对齐方式；缺省 left。
 */
export declare function alignmentsOf(line: string): ColumnAlign[];
/**
 * 把正文切成块。
 * @param source - Markdown 原文。
 * @returns 按出现顺序排列的块。
 */
export declare function parseBlocks(source: string): Block[];
/**
 * 把一条进展的正文渲染成 React 元素。
 * @param props - 正文原文。
 * @returns 块级元素；空正文渲染空片段。
 */
export declare function MarkdownLite({ text }: {
    text: string;
}): ReactNode;
export {};
//# sourceMappingURL=markdown-lite.d.ts.map