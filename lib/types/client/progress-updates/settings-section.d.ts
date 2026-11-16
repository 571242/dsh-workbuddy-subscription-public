/**
 * 设置页里的「进展更新」分区：一句说明 + 三行卡片（开关 / 催促阈值 / 进展面板）。
 *
 * ## 视觉来源
 *
 * 结构与排版照订阅服务那套 hub 设置页（`../hub/hub-styles.ts` 的 `dsh-hub-card*`
 * 与 `../hub/HubOverview.tsx` 的三行布局）：左侧一个方块标记，中间名称 + 一行
 * 说明，右侧控件。CSS 逐条抄进 `./styles.ts`（方案 B：不做跨包同步）。
 *
 * ## 单级，没有二级页面
 *
 * 三行都停在当前页：开关和数字输入直接写设置，第三行是「打开」按钮 + chevron，
 * 点它按 kind 打开右侧栏的进展面板，然后把设置弹层收起来——面板在设置弹层底下，
 * 不关掉的话用户还是看不见它。
 *
 * ## 数据
 *
 * 开关与阈值经 {@link ProgressSettingsForm} 读写（见 `./settings-binding.ts`）：写入
 * 走宿主共享设置表单，两条字段在宿主 `Config` schema 里都是 `volatile()`，保存即
 * 生效，不需要重启插件行。表单通道缺席（没有设置服务的部署）时控件渲染成禁用态，
 * 并在说明行写明原因——宁可不给点，也不做一个存不住的假开关。
 *
 * 文案全部走 locale（本插件 `dsh-progress-updates` 命名空间），组件本身不出现
 * 硬编码文案。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates/settings-section
 */
import { type ReactNode } from 'react';
import { type CopySeat } from './updates-panel.tsx';
import type { ProgressSettingsForm } from './settings-binding.ts';
/** 入口注入给设置页的座位：按 kind 打开侧栏面板。 */
export interface ProgressUpdatesSettingsInjected {
    /** 打开右侧栏的进展面板（阶段一注册的那个 kind）。 */
    openPanel: () => void;
    /** 设置表单通道；缺席表示这个部署没有可用的设置服务。 */
    settings?: ProgressSettingsForm;
}
/** 设置壳交来的 owner 面：关掉设置面板。 */
export interface SettingsShellProps {
    /** 关掉设置面板（开关状态由壳持有）。 */
    close: () => void;
}
/** 组件 props：壳的关闭回调 + 注入的打开动作与表单 + 可选文案座位。 */
export type ProgressUpdatesSettingsProps = ProgressUpdatesSettingsInjected & SettingsShellProps & CopySeat;
/** 阈值的允许范围，与宿主 schema（`min(1).max(50)`）一致。 */
export declare const NUDGE_THRESHOLD_MIN = 1;
/** 阈值上限。 */
export declare const NUDGE_THRESHOLD_MAX = 50;
/** 宿主 schema 里的默认阈值（`NUDGE_THRESHOLD`，两处同一个数）。 */
export declare const NUDGE_THRESHOLD_DEFAULT = 8;
/**
 * 进展更新的设置分区：三行卡片。
 * @param props - 壳的关闭回调、注入的打开动作与表单、文案座位。
 * @returns 设置页里的这一页。
 */
export declare function ProgressUpdatesSettingsSection(props: ProgressUpdatesSettingsProps): ReactNode;
//# sourceMappingURL=settings-section.d.ts.map