/**
 * 「进展更新」宿主半边在本插件里的挂载点。
 *
 * 复刻 Kimi Code 的「进展更新」特性：agent 在多步任务中通过一个**不结束回合**的
 * 工具主动向用户汇报进展。本文件挂四样东西：
 *
 * 1. `progress_update` 工具（tools 服务）；
 * 2. 系统提示词引导（systemPrompt 服务，文本用函数形式，开关关闭时返回空串，
 *    因此设置改动立刻生效、无需重启会话）；
 * 3. `tools/post-execute` 上的 8 轮催促：连续带工具调用却没有进展更新时，给模型
 *    追加一条提醒（additionalContexts）；
 * 4. `GET /api/dsh-progress-updates/updates` 只读路由 —— 浏览器半边唯一的取数通道。
 *
 * **可选服务一律走 `ctx.get()`**：Cordis 里没写进 `inject` 的服务名不能直接当
 * 属性读，否则 apply 当场抛 `cannot get property "..." without inject`，整个插件
 * 降级。`sessions`、`sessionProjections`、`systemPrompt`、`webServer` 在本插件
 * 的 inject 里都没有（前者随 harness 是否装 agent-loop 而定，后者的能力由本模块
 * 自己探测），所以它们必须是**调用时**的可选读取，缺了就退化成更弱的实现，而不是
 * 让插件挂不上。
 *
 * @module dsh-chatgpt-subscription/host/progress-updates
 */
/** 一次挂载读到的有效设置（由主入口每次重新解析活引用后交进来）。 */
export interface ProgressUpdatesSettings {
    /** 总开关。 */
    enabled: boolean;
    /** 催促阈值：连续多少轮带工具调用却没有进展更新就提醒一次。 */
    nudgeThreshold: number;
}
/**
 * 设置字段在运行时可能是活引用（volatile）或普通值（手工构造的上下文、测试）。
 *
 * loader 把声明为 `volatile()` 的字段解析成一个 `{ get() }` 活引用，设置保存时
 * 就地写新值并广播 `loader/volatile-update`，**不**重挂插件行；所以这里必须能
 * 跟着引用读到当前值，而不是拿到一份快照。
 */
interface ConfigRef<T> {
    /** 读取当前已提交的值。 */
    get(): T | undefined;
}
/** 一个配置字段：活引用或普通值。 */
export type ProgressUpdatesConfigField<T> = ConfigRef<T> | T | undefined;
/** 主入口交给本模块的配置形状（只取本模块认识的两个字段）。 */
export interface ProgressUpdatesConfigFields {
    /** 总开关字段。 */
    progressUpdates?: ProgressUpdatesConfigField<boolean>;
    /** 催促阈值得字段。 */
    progressUpdatesNudgeThreshold?: ProgressUpdatesConfigField<number>;
}
/**
 * 读取一个配置字段，沿着 volatile 活引用取当前值。
 * @param field - 字段本身。
 * @returns 当前值，或字段缺失时的 undefined。
 */
export declare function readProgressConfigField<T>(field: ProgressUpdatesConfigField<T>): T | undefined;
/**
 * 解析一次读取的有效设置：每次调用都重读活引用，因此设置保存后立刻生效。
 * @param config - 主入口收到的插件配置（活引用或普通值）。
 * @returns 生效的开关与催促阈值。
 */
export declare function resolveProgressUpdatesSettings(config?: ProgressUpdatesConfigFields): ProgressUpdatesSettings;
/** 挂载选项。 */
export interface ProgressUpdatesOptions {
    /**
     * 读取当前设置。
     *
     * 必须是**函数**：loader 会把 volatile 字段替换成活引用，设置保存时就地写新值
     * 而不重挂插件行，所以每次用到设置都要重读一次；apply 时求值一次就存下来的
     * 写法会让开关在会话中途失效。
     */
    settings: () => ProgressUpdatesSettings;
}
/** 本模块读得到的宿主上下文（Cordis Context 结构上满足；测试可用假对象）。 */
export interface ProgressUpdatesContext {
    /** Cordis 的副作用登记：回调返回的 disposer 会随插件卸载执行。 */
    effect?<T>(execute: () => T, label?: string): unknown;
    /** Cordis 的事件总线。 */
    on?(event: string, listener: (...args: never[]) => unknown): () => void;
    /** 服务查找：**调用时**读可选服务，不触发 inject 断言。 */
    get?(name: string): unknown;
}
/**
 * 挂载「进展更新」的宿主半边。
 * @param ctx - 宿主插件上下文。
 * @param options - 挂载选项（设置读取器）。
 * @returns 卸载函数；重复挂载时返回一个空操作。
 */
export declare function installProgressUpdates(ctx: ProgressUpdatesContext, options: ProgressUpdatesOptions): () => void;
export {};
//# sourceMappingURL=index.d.ts.map