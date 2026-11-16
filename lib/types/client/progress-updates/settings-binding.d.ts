/**
 * 「进展更新」设置卡片的**数据通道**：把本插件 Config 里的两个字段接到共享设置表单上。
 *
 * ## 和源实现（独立插件 dsh-progress-updates）的区别
 *
 * 那边绑的是一个**自己的命名空间** `dsh-progress-updates` 的 `enabled` /
 * `nudgeThreshold`。搬进本插件之后设置项已经并进了本插件的 Config，字段名是
 * `progressUpdates` / `progressUpdatesNudgeThreshold`（见 `src/index.ts` 的
 * `Config` schema），两个都是 `volatile()`——保存即生效、不重挂插件行。
 * 所以这里绑的是**本插件自己的 profile 条目**，字段名也必须逐字对上：表单写入
 * 走的是条目配置的根字段路径，写错一个字母就是写到别处（或者被 schema 拒掉）。
 *
 * ## 条目 id 从哪来
 *
 * 0.1.7 之后的设置面按 profile 条目 id 寻址一张表单（`ctx.configForms.get(entryId)`），
 * 而插件只知道自己的名字。条目 id 随安装形态而变：独立安装是 `cordis.patch.yml`
 * 那行的 `id: dsh-chatgpt-subscription`；聚合安装（dsh-web-all 一类）会套一层
 * 家族前缀。所以这里**先问镜像**：`describe()` 会把每个活跃条目的解析值都列出来，
 * 谁的值里带 `progressUpdates` 这个键，谁就是本插件的那一条——这比硬编码一串
 * 候选 id 更准，而且不含任何允许清单。
 *
 * 镜像还没答上来时先按第一个候选绑定，镜像一答上来就重绑到它真正服务的那一个。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates/settings-binding
 */
import type { ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client';
/**
 * 本卡片驱动的两个字段。
 *
 * 名字与 `src/index.ts` 的 `Config` schema **逐字一致**（`progressUpdates` /
 * `progressUpdatesNudgeThreshold`），不是源实现那套 `enabled` / `nudgeThreshold`。
 */
export interface ProgressUpdatesSettingsValues {
    /** 总开关。 */
    progressUpdates?: boolean;
    /** 催促阈值：连续多少轮无进展就提醒一次。 */
    progressUpdatesNudgeThreshold?: number;
}
/** 表单可写的那两个字段名（联合类型，写错名字编译期就报）。 */
export type ProgressUpdatesField = keyof ProgressUpdatesSettingsValues & ('progressUpdates' | 'progressUpdatesNudgeThreshold');
/**
 * 候选条目 id，按可能性从高到低。
 *
 * 第一项来自 `cordis.patch.yml` 的行 id（独立安装的唯一形态）；后两项是聚合安装
 * 可能套的前缀。镜像答上来之后不再用这张表的顺序，改用"值里带 `progressUpdates`
 * 的那一条"。
 */
export declare const PROGRESS_SETTINGS_ENTRY_IDS: readonly string[];
/** 卡片真正用到的那几个成员，外加一个释放函数。 */
export interface ProgressSettingsForm {
    /** 当前快照（引用必须稳定，供 useSyncExternalStore 使用）。 */
    getSnapshot(): ConfigFormSnapshot<ProgressUpdatesSettingsValues>;
    /** 订阅快照变化。 */
    subscribe(listener: () => void): () => void;
    /** 写一个根字段；返回宿主是否接受。 */
    set(field: ProgressUpdatesField, value: boolean | number): Promise<boolean>;
    /** 释放镜像订阅与内部表单订阅（插件卸载时调用）。 */
    dispose(): void;
}
/**
 * 创建本插件设置卡片的表单。
 *
 * 共享表单服务缺席时返回 undefined：调用方据此把开关渲染成只读（禁用），
 * 而不是造一个点了存不住的假开关。
 * @param ctx - 浏览器根上下文。
 * @returns 表单通道，或 undefined（这个部署没有设置服务）。
 */
export declare function createProgressSettingsForm(ctx: {
    get(name: string): unknown;
}): ProgressSettingsForm | undefined;
//# sourceMappingURL=settings-binding.d.ts.map