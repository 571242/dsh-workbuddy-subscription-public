export declare const STYLE_ID = "dsh-step-code-settings-style";
/**
 * Step Code（Step Plan 订阅）卡片独有的样式。
 *
 * 共享样式一律不重复声明：模型清单（.dsh-mcl-*）由 common/model-checklist-styles.ts
 * 负责，账号卡与其配额条（.dsha-account-*）由 common/styles.ts 负责，基础控件
 * （.dsha-page / .dsha-group / .dsha-row / 计量条 .dsha-meter-* 等）由兄弟线路的安装器
 * 负责；本卡直接用它们，不在这里再写一遍。.dsha-account-add-actions 同样沿用
 * workbuddy/styles.ts 的那份声明。
 *
 * 本文件只声明三样别处没有的东西：
 *
 *   1. 本线路自己的登录相关块：登录流程块（临时内容）、兜底入口行与手工粘贴面板、
 *      等宽文本、模型行右侧的窗口数字；
 *   2. **线路级额度**的形状：老式窗口与 Credit 桶各有各的行与条，以及快照卡里那几行
 *      事实用的紧凑网格（.dshsc-fact-grid）。账号卡里的 .dsha-account-quota-* 是共享
 *      组件的，不在这里重复；
 *   3. 两处版面纪律所需的类：**补充说明的折叠区**（.dshsc-details）与**额度凭据的输入
 *      网格**（.dshsc-cred-grid）。网格窄屏回落成单列，媒体查询照抄 common/styles.ts
 *      里 max-width:560px 的现成写法。
 *
 * 折叠区不删信息：每一句说明仍然在 DOM 与 textContent 里，只是默认不占版面；正文因此
 * 只留「标题 → 一句话 → 控件 → 折叠的补充说明」。
 *
 * 前缀统一 .dshsc-（Step Code），不与任何兄弟线路的选择器相撞。
 */
export declare function installStepCodeStyles(): void;
//# sourceMappingURL=styles.d.ts.map