/**
 * 右侧栏 guide 页里「进展更新」那一格用的彩色标记。
 *
 * 为什么自带颜色：guide 的图标槽位收的是 `ComponentType<IconProps>`，平台自家的
 * 那几个（`plugin-artwork.tsx` 的 PluginArtworkTerminal / Loop / Subagent / Search）
 * 都**不骑 currentColor**，各自带品牌色与渐变——截图里那四格的颜色差异就是这么来的。
 * 所以这里照它们的样子画：36×36 viewBox、{size, className}、固定调色板。
 *
 * 图形语义：一条向上的折线（进展）加一个末端的箭头，与对话流里那一行的「状态点 +
 * 标题」互为同一件事的两种画法。渐变用 useId 生成前缀，避免同页多实例时
 * `url(#…)` 全部解析到第一个实例。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates/guide-artwork
 */
/** 图标组件的入参，与平台 `IconProps` 同形（本包不依赖 ui-primitives 的运行时包）。 */
export interface GuideArtworkProps {
    /** 边长（px）。guide 里平台传 36。 */
    size?: number;
    /** 追加的类名。 */
    className?: string;
}
/**
 * 「进展更新」的彩色标记：一条攀升的折线，末端带箭头。
 * @param props - 尺寸与类名。
 * @returns 36×36 的彩色 SVG。
 */
export declare function ProgressUpdatesArtwork({ size, className }: GuideArtworkProps): React.JSX.Element;
//# sourceMappingURL=guide-artwork.d.ts.map