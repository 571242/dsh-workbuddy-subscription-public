/**
 * GLM（ZCode 账号）设置卡片。
 *
 * 纯渲染：状态、副作用与请求都在 'useGlmCodingPlanSection.ts'，两者之间只通过
 * 一个具名结构交接（WorkBuddySection / MinimaxCodeSection 同款分工）。
 *
 * 三条需求方的 UI 硬要求由现成共享组件承担，本文件没有新建任何 UI 组件：
 *
 *   1. 进入入口（hub 卡片：图标 + 名称 + 「N 个账号 / M/N 个模型可用」+ 开关 + chevron）
 *      —— hub/providers.tsx 的 descriptor + hub/HubOverview.tsx，点进来就是本卡片；
 *   2. 配额显示额度（标签 + 进度条 + 百分比 + 「N 天后重置」）
 *      —— AccountPoolSection 的 showQuota + common/account-quota.tsx，
 *      窗口名由共享组件按 windowDurationMins 本地化（5 小时 / 1 周 / 1 月），
 *      所以本页的配额区只画「没有账号卡进度条可画」的那些事实；
 *   3. 模型选择（品牌图标 + 模型名 + 一句话描述 + 行尾勾）
 *      —— common/ModelChecklist.tsx，hint 直接用契约里的 GlmModelOption.hint
 *      （host 由随包目录生成，客户端不从模型名推断任何能力）。
 */
import React from 'react';
import { type GlmCodingPlanSectionProps } from './useGlmCodingPlanSection.ts';
export declare function GlmCodingPlanSection({ onModelChange }?: GlmCodingPlanSectionProps): React.JSX.Element;
//# sourceMappingURL=GlmCodingPlanSection.d.ts.map