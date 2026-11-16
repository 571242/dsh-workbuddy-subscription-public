/**
 * 系统提示词引导：让模型知道「多步任务里要主动汇报进展」这件事该怎么用。
 *
 * 文本用函数形式提供（而不是静态字符串）：开关关闭时返回空串，装配期就地
 * 抹掉引导，不需要重启会话、也不需要重挂插件行。
 *
 * @module dsh-chatgpt-subscription/host/progress-updates/prompt
 */
/**
 * 本模块提示词分节的名称，全局唯一（重复注册会抛错）。
 *
 * 保留原插件的 `plugin:progress-updates` 拼写：会话里已有的分节名不能因为搬家
 * 而变成第二个分节。
 */
export declare const PROGRESS_SECTION_NAME = "plugin:progress-updates";
/**
 * 引导词在提示词里的排序位。插件族占用的区间在部署人设之后、SDK 的
 * PLAN_POLICY(500) 之前；这里取 220，紧跟 ssh(150) 与 task-board(200) 之后，
 * 不与它们并列。
 */
export declare const PROGRESS_SECTION_ORDER = 220;
/**
 * 引导词正文。写法对齐 Kimi 的「进展更新」：先说清多步任务早期的思路，再报
 * 有意义的结论、阶段判断、长等待与阻塞；每条给一行标题，细节放正文；不重复
 * 没有变化的状态。
 */
export declare const PROGRESS_GUIDANCE: string;
/**
 * 生成提示词分节的文本提供者。
 * @param isEnabled - 读取当前开关状态的函数（每次装配重新求值）。
 * @returns 开关打开时返回引导词，关闭时返回空串。
 */
export declare function progressSectionText(isEnabled: () => boolean): () => string;
//# sourceMappingURL=prompt.d.ts.map