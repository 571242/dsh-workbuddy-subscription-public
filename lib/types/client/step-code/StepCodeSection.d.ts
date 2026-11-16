/**
 * Step Code（Step Plan 订阅）设置卡片。
 *
 * 纯渲染：状态、副作用与请求都在 'useStepCodeSection.ts'，两者之间只通过一个具名结构
 * 交接（GLM / WorkBuddy / MiniMax Code 同款分工）。
 *
 * 本文件没有新建任何 UI 组件：进入入口（hub 卡片）在 hub/providers.tsx，账号池与它的
 * 配额条在 AccountPoolSection，模型勾选在 ModelChecklist，上下文窗口在
 * ContextWindowEditor，输入框胶囊在 StepCodeComposerQuota.tsx。
 *
 * 两条它自己负责的渲染规则：
 *
 *   1. **能力只画契约里的字段**：图片输入、思考档位、上下文窗口全部来自 host 生成的
 *      hint，客户端不按模型名推断任何一项；同一事实只呈现一次——勾选列表的行已经带了
 *      那句话，所以下面不再另起一块把已勾选模型的能力重列一遍；
 *   2. **缓存只画 token 维度**：读入量与命中率一条条，没数据就是占位符；写侧在本线路
 *      恒为 0，用 STEP_CODE_CACHE_WRITE_NOTE 标注而不是画一条永远是 0 的进度条；
 *      单价未文档化，因此整页不出现任何金额。
 *
 * 版面纪律（全卡适用）：**每个分组标题下最多留一行说明**，其余原句收进 .dshsc-details
 * 折叠区（moreNotes 辅助函数），阅读顺序因此固定为「标题 → 一句话 → 控件 → 折叠的补充
 * 说明」。实现坐标（读侧字段优先级链、端点路径、plan_family 的机器值）不留在正文：
 * 它们解释的是这份数据怎么来的，而不是用户现在该做什么——但也绝不删除，一律进折叠区。
 */
import React from 'react';
import { type StepCodeSectionProps } from './useStepCodeSection.ts';
export declare function StepCodeSection({ onModelChange }?: StepCodeSectionProps): React.JSX.Element;
//# sourceMappingURL=StepCodeSection.d.ts.map