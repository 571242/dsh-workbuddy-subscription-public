/**
 * 进展更新设置卡片的样式。
 *
 * ## 来源（方案 B：逐字抄进本插件，不做跨包同步机制）
 *
 * 结构与取值抄自同目录之外的订阅服务 hub 设置页（`../hub/hub-styles.ts` 的
 * `dsh-hub-card*` 系列）：左侧方块 + 名称/说明两行 + 右侧控件，只有一条上边框、
 * 行与行靠各自的下边框连成整列。规则逐条照搬，只把类名前缀 `dsh-hub-` 换成
 * `dsh-progress-`，与那边互不覆盖。
 *
 * **枢纽改版了要人工同步**：两份文本没有构建期脚本或 CI 门禁比对。订阅服务调整
 * 这三行卡片的尺寸、间距、hover 或开关态时，这份文件不会自己跟上。
 *
 * ## 为什么是字符串而不是 CSS Modules
 *
 * 本插件其余线路（hub / antigravity / claude / kimi-code / step-code ……）全部走
 * `common/plugin-style.ts` 的 `installPluginStyle`：它把 CSS 作为一张带
 * `data-plugin` 归属的 <style> 注入，模块系统因此不会把这张表认领成别人的、
 * 也不会顺手删掉。CSS Modules 的 lightningcss 编译这条链路不在本插件的 tsdown
 * 配置里，所以这里与邻居保持一致，而不是把源实现的 `*.module.css` 搬过来。
 *
 * ## 配色
 *
 * 一律走 `--dsw-alias-*` 主题 token（每个都带明色兜底），暗色主题因此不需要
 * 单独一支分支。写死的只有开关滑块投影与品牌方块淡染这类"结构色"。
 */
/** 这张表的 `data-plugin-css` 子名。 */
export declare const STYLE_NAME = "progress-updates";
/**
 * 安装「进展更新」设置卡片的样式表（幂等；标签归文档所有，卸载时不移除）。
 * @returns 空操作释放函数（与邻居同形）。
 */
export declare function installProgressUpdatesStyles(): () => void;
//# sourceMappingURL=styles.d.ts.map