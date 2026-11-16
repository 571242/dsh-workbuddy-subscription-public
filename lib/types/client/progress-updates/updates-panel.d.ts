/**
 * 进展更新面板：把 `progress_update` 工具产生的进展按时间顺序列出来。
 *
 * 交互照 Kimi Code：**最新一条默认展开，更早的自动收起，点标题可切换**。
 * 每条只显示一行标题；展开时才渲染详情正文（保留换行，不做完整 Markdown
 * 渲染 —— 契约里限定的就是「一段正文 + 少量 bullet」）。
 *
 * 数据源：纯展示组件只认一个 `updates` 数组 prop（见 {@link UpdatesPanelProps}）。
 * 真实的取数通道是宿主路由 `GET /api/dsh-progress-updates/updates?session=<id>`，
 * 浏览器半边的轮询客户端在 `./host-source.ts`（`createHostProgressSource`），它
 * 把结果包成 {@link ProgressSnapshotSource} 交给入口。{@link EMPTY_SOURCE} 只剩
 * 两个用途：没有会话身份时的兜底，以及测试里的空快照参照。
 *
 * 文案全部走 locale（本插件 `dsh-progress-updates` 命名空间），文件里不出现
 * 硬编码中文。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates/updates-panel
 */
import { type ReactNode } from 'react';
import type { ProgressUpdate } from './contracts.ts';
import { NS_PROGRESS_UPDATES, type ProgressUpdatesLocaleKey } from './locales.ts';
/**
 * 注入的文案座位。
 *
 * 框架在声明了 `locale` 的注册里总会给 `t`；这里标成可选是为了让同一份组件
 * 也能在没有 locale 座位的场合（jsdom 测试、故事预览）直接渲染，缺省时走
 * {@link fallbackTranslate}。参数收得更宽不影响槽位注册处的类型检查。
 */
export type CopySeat = {
    /** 命名空间化的翻译函数；缺席时走本文件的中文兜底。 */
    t?: (key: ProgressUpdatesLocaleKey) => string;
};
/**
 * 兜底翻译：只在本组件被渲染在 slot 框架之外时用到（jsdom 测试、故事预览）。
 * 走同一份 zh 字典，因此不存在第二套文案。框架内渲染时用注入的 `t` 座位，
 * 这样第三方语言包也能生效。
 * @param key - `dsh-progress-updates` 命名空间的键。
 * @param params - `{name}` 模板参数。
 * @returns 该键的文案；缺键时回退为键本身。
 */
export declare function fallbackTranslate(key: string, params?: Record<string, unknown>): string;
/**
 * 把 `{name}` 占位符换成实参。
 *
 * 单独成一个函数，是因为**两条取值路径都要用它**：没有 locale 服务的兜底字典，
 * 和有服务时的当前语言字典。早先只有兜底那条做了替换，于是真实部署里
 * 「共 {n} 条」原样上屏。
 * @param template - 含占位符的模板。
 * @param params - 各占位符的实参。
 * @returns 替换后的文本；没有 params 时原样返回。
 */
export declare function interpolate(template: string, params?: Record<string, unknown>): string;
/** 面板的数据源面：一份只读快照 + 变更订阅。 */
export interface ProgressSnapshotSource {
    /**
     * 读取当前快照；必须返回稳定引用（同一次变更内多次读取返回同一对象），
     * 否则 `useSyncExternalStore` 会判为无限更新。
     */
    getSnapshot(): readonly ProgressUpdate[];
    /** 订阅变更，返回退订函数。 */
    subscribe(listener: () => void): () => void;
}
/** 一份空进展快照。 */
export declare const EMPTY_UPDATES: readonly ProgressUpdate[];
/**
 * 空数据源：恒为空数组，永不通知变更。
 *
 * 它是一份**真正的空态**（不是伪造出来的假数据流）：真实的取数通道是
 * `./host-source.ts` 的轮询客户端，只有拿不到任何来源时才回退到这里。
 */
export declare const EMPTY_SOURCE: ProgressSnapshotSource;
/**
 * 把一份可观察的裸快照（宿主路由的轮询结果，或任何别的读取通道）包成面板要的
 * 数据源。
 * @param read - 读取当前进展列表（必须返回稳定引用）。
 * @param listen - 订阅变更，返回退订函数。
 * @returns 面板可消费的数据源。
 */
export declare function createSnapshotSource(read: () => readonly ProgressUpdate[], listen: (listener: () => void) => () => void): ProgressSnapshotSource;
/** 组件 props：只有一份进展数组，外加可选的注入文案座位。 */
export type UpdatesPanelProps = {
    /** 已展示的进展，按产生顺序排列（最后一条是最新）。 */
    updates: readonly ProgressUpdate[];
} & CopySeat;
/**
 * 侧栏进展面板（纯展示）。
 * @param props - 进展数组与可选的注入文案座位。
 * @returns 进展列表；没有进展时渲染占位空态。
 */
export declare function ProgressUpdatesPanel({ updates, t }: UpdatesPanelProps): ReactNode;
/** 面板正文收到的注入面：一个已绑定的数据源。 */
export interface ProgressPanelInjected {
    /** 侧栏面板的进展数据源。 */
    source: ProgressSnapshotSource;
}
/**
 * 面板正文的槽位组件：把注入的数据源接到纯展示组件上。
 *
 * 用 `useSyncExternalStore` 订阅而不是直接读一次快照：轮询源每次拿到新进展都会
 * 通知，这里自动重渲染；展示组件本身不关心数据是怎么来的。
 * @param props - 框架注入的数据源与文案座位。
 * @returns 进展面板。
 */
export declare function ProgressUpdatesTab(props: ProgressPanelInjected & CopySeat): ReactNode;
/**
 * 页签标题的槽位组件：标签条上显示的那几个字。
 * @param props - 框架注入的文案座位。
 * @returns 面板标题文本。
 */
export declare function ProgressUpdatesTabTitle({ t }: CopySeat): ReactNode;
/** 本模块的命名空间，供注册处引用。 */
export { NS_PROGRESS_UPDATES };
//# sourceMappingURL=updates-panel.d.ts.map