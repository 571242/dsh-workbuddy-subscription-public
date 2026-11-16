/**
 * 「进展更新」浏览器半边的挂载点 —— 本插件的一个子模块，由
 * `src/client/index.tsx` 调用 {@link installProgressUpdatesClient}。
 *
 * 复刻 Kimi Code 的「进展更新」在网页里的那一半。挂四样东西：
 *
 * 1. **对话流的进展行**（主形态）：给 `progress_update` 工具注册
 *    `tool.call.toolview` 视图，agent 每发一条进展，对话里就多一行；
 * 2. 侧栏页签的**类型**（阶段一，`ctx.sidebarRightTabs.register`）——
 *    没有它，下面的正文与标题注册得再对，面板也永远打不开；
 * 3. 侧栏页签的正文与标题（阶段二，`sidebar.right.pane.tab` /
 *    `sidebar.right.pane.tab.title`），键都是阶段一的 id；
 * 4. 设置页里的「进展更新」分区（`settings.section`，**独立一格**，不与订阅服务
 *    那格合并），点击「打开进展面板」调 `ctx.sidebarRight.openTab(kind)`。
 *
 * 字典与样式**不在这里登记**：`src/client/index.tsx` 像其余每条线路一样，自己
 * `ctx.locale.register(NS_PROGRESS_UPDATES, …)` 并安装样式表，本模块只挂槽位
 * ——同一个命名空间注册两次在真实 locale 服务里会抛重复登记，那是会被吞掉但毫无
 * 意义的第二次调用。
 *
 * ## 三段式依赖与降级
 *
 * ui-sidebar-right 不一定装着：页签类型注册与打开面板都在「服务在不在」的检查
 * 之后才做，缺了它就只留对话流行与设置页（按钮点了没反应而不是报错）。对话流视图
 * 本身只依赖 slots，所以它一定挂得上。
 *
 * ## 数据从哪来
 *
 * 侧栏面板**不读对话流**，它的数据只来自宿主半边的
 * `GET /api/dsh-progress-updates/updates?session=<id>` 路由
 * （`src/host/progress-updates/routes.ts`）。宿主与浏览器是两个运行时，中间只有
 * 同源 HTTP，所以浏览器这边必须**主动去读** —— 轮询客户端在 `./host-source.ts`。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type ProgressSnapshotSource } from './updates-panel.tsx';
import { type ProgressSettingsForm } from './settings-binding.ts';
/**
 * 本实现在右侧栏页签系统里的身份：它既是阶段一 `sidebarRightTabs` 里的 `id`，
 * 也是阶段二两处 keyed 槽位注册用的键。
 */
export declare const PANEL_TAB_ID = "@eddyskywalker/dsh-chatgpt-subscription/progress-updates";
/**
 * 页签类型判别值（`kind`）：`ctx.sidebarRight.openTab` 用它点名。语义上是
 * 「一类页签」，所以与上面的身份分开写。
 */
export declare const PANEL_TAB_KIND = "progress-updates";
/**
 * 设置页那一格的 id。
 *
 * **独立一格**：本插件的订阅服务 hub 注册的是 `subscription-hub`（order 45），
 * 进展更新不进那一格——用户要求它是一个单独的分区。
 */
export declare const SETTINGS_SECTION_ID = "progress-updates";
/**
 * 导航顺序：**150**，排在所有既有条目之后。
 *
 * 既有 order 分布（plugin 侧 `subscription-hub` = 45；平台侧 general=0、
 * models=10、plugins=15、agent-presets=20、account=-10）。150 远在这条线之外，
 * 既不会撞号，也不会把订阅服务那一格挤到别的位置——新条目只往后拿号。
 */
export declare const SETTINGS_SECTION_ORDER = 150;
/** 浏览器半边的挂载参数。 */
export interface ProgressUpdatesClientOptions {
    /**
     * 面板数据源；**显式传入时优先**（测试、将来替换取数实现都走这里）。
     * 缺省时按会话各建一份宿主路由轮询源，见 {@link createHostProgressSource}。
     */
    source?: ProgressSnapshotSource;
    /**
     * 打开侧栏面板的通道；缺省时读 `ctx.sidebarRight`。测试注入一个假通道来断言
     * 「按钮真的调了 openTab」。
     */
    openPanel?: (kind: string) => void;
    /**
     * 设置表单通道；缺省时从 `ctx.configForms` 现取。测试注入一个假的来断言
     * 「开关写的是本插件 Config 的那两个字段」。
     */
    settings?: ProgressSettingsForm;
}
/**
 * 挂载「进展更新」的浏览器半边。
 *
 * 失败策略与家族其它模块一致：槽位/页签注册失败只吞掉、不抛出 —— web shell 在
 * 插件 apply 抛错时会整页启动失败，外部插件不能把 GUI 带下水。
 * @param ctx - 浏览器根上下文。
 * @param options - 可选的数据源、打开面板通道与设置表单通道。
 */
export declare function installProgressUpdatesClient(ctx: ClientContext, options?: ProgressUpdatesClientOptions): void;
//# sourceMappingURL=index.d.ts.map