export declare const STYLE_ID = "dsh-glm-coding-plan-settings-style";
/**
 * GLM（ZCode 账号）卡片独有的样式。
 *
 * 共享样式一律不重复声明：模型清单（.dsh-mcl-*）由 common/model-checklist-styles.ts
 * 负责，账号卡与配额条（.dsha-account-*）由 common/styles.ts 负责，基础控件
 * （.dsha-page / .dsha-group / .dsha-row / 胶囊等）由兄弟线路的安装器负责。
 * 本文件只声明没有兄弟线路共用过的东西：登录流程块、兜底入口行与手工粘贴面板、
 * 等宽文本、模型行右侧的窗口数字，以及「导入的登录态」徽标。
 *
 * 两区登录入口复用的 .dsha-account-add-actions 由 workbuddy/styles.ts 声明；
 * Claude 卡片同样直接用它而不在自己文件里重复声明，本卡沿用同一做法。
 */
export declare function installGlmCodingPlanStyles(): void;
//# sourceMappingURL=styles.d.ts.map