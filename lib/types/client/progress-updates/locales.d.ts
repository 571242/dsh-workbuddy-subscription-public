/**
 * 「进展更新」在 locale 服务里的命名空间。
 *
 * 跟着本插件其余线路的命名习惯走（`dsh-kimi-code`、`dsh-step-code`、`dsh-ollama`
 * ……都是「dsh-<线路>」）：新线路并入本插件的字典体系，而不是另开一个与包名无关
 * 的命名空间。
 */
export declare const NS_PROGRESS_UPDATES: "dsh-progress-updates";
/**
 * 中文文案。
 *
 * 键名沿用本插件其余字典的扁平驼峰（`hubTitle`、`imageToolRunning` 那一套），
 * 不另起一套点号命名——同一份 index.tsx 里两种命名风格会让「这条键属于哪张表」
 * 变成要靠记忆的事。
 */
export declare const zh: {
    /** 设置页导航里的那一格，也是侧栏页签的标题。 */
    readonly navTitle: "进展更新";
    readonly progressTitle: "进展更新";
    /** 右侧栏 guide 卡片标题下的一行说明。 */
    readonly progressGuideNote: "agent 汇报的每一步进展，都收在这里";
    readonly markdownCopy: "复制";
    readonly markdownCopied: "已复制";
    readonly markdownFootnotes: "脚注";
    readonly progressLatest: "最新";
    readonly progressCount: "共 {n} 条";
    readonly progressExpand: "展开这条进展";
    readonly progressCollapse: "收起这条进展";
    readonly progressEmptyTitle: "还没有进展更新";
    readonly progressEmptyHint: "agent 开始多步任务后，会在这里汇报它进行到哪一步。";
    readonly rowPending: "进展更新";
    readonly rowRunning: "进行中";
    readonly rowDone: "已汇报";
    readonly rowError: "未发出";
    readonly rowExpand: "展开这条进展的详情";
    readonly rowCollapse: "收起这条进展的详情";
    readonly settingsHint: "进展更新会让 agent 在多步任务中主动汇报进度。打开面板可以看它到目前为止的全部汇报。";
    readonly settingsOpen: "打开进展面板";
    readonly settingsEnabledName: "进展更新";
    readonly settingsEnabledNote: "让 agent 在对话中发布进展更新";
    readonly settingsThresholdName: "催促阈值";
    readonly settingsThresholdNote: "连续这么多轮没有进展时，提醒 agent 汇报一次";
    readonly settingsPanelName: "进展面板";
    readonly settingsPanelNote: "在右侧栏查看本次会话的全部进展";
    readonly settingsUnavailable: "这项设置当前不可修改（宿主没有开放配置表单）";
    readonly settingsSaveFailed: "保存失败，请稍后再试";
};
/** 英文对照，键集与 zh 完全一致。 */
export declare const en: Record<ProgressUpdatesLocaleKey, string>;
/** 与其余线路同形的字典包（四个内置语言 id 都指向那两份）。 */
export declare const dictionaries: {
    zh: {
        /** 设置页导航里的那一格，也是侧栏页签的标题。 */
        readonly navTitle: "进展更新";
        readonly progressTitle: "进展更新";
        /** 右侧栏 guide 卡片标题下的一行说明。 */
        readonly progressGuideNote: "agent 汇报的每一步进展，都收在这里";
        readonly markdownCopy: "复制";
        readonly markdownCopied: "已复制";
        readonly markdownFootnotes: "脚注";
        readonly progressLatest: "最新";
        readonly progressCount: "共 {n} 条";
        readonly progressExpand: "展开这条进展";
        readonly progressCollapse: "收起这条进展";
        readonly progressEmptyTitle: "还没有进展更新";
        readonly progressEmptyHint: "agent 开始多步任务后，会在这里汇报它进行到哪一步。";
        readonly rowPending: "进展更新";
        readonly rowRunning: "进行中";
        readonly rowDone: "已汇报";
        readonly rowError: "未发出";
        readonly rowExpand: "展开这条进展的详情";
        readonly rowCollapse: "收起这条进展的详情";
        readonly settingsHint: "进展更新会让 agent 在多步任务中主动汇报进度。打开面板可以看它到目前为止的全部汇报。";
        readonly settingsOpen: "打开进展面板";
        readonly settingsEnabledName: "进展更新";
        readonly settingsEnabledNote: "让 agent 在对话中发布进展更新";
        readonly settingsThresholdName: "催促阈值";
        readonly settingsThresholdNote: "连续这么多轮没有进展时，提醒 agent 汇报一次";
        readonly settingsPanelName: "进展面板";
        readonly settingsPanelNote: "在右侧栏查看本次会话的全部进展";
        readonly settingsUnavailable: "这项设置当前不可修改（宿主没有开放配置表单）";
        readonly settingsSaveFailed: "保存失败，请稍后再试";
    };
    'zh-CN': {
        /** 设置页导航里的那一格，也是侧栏页签的标题。 */
        readonly navTitle: "进展更新";
        readonly progressTitle: "进展更新";
        /** 右侧栏 guide 卡片标题下的一行说明。 */
        readonly progressGuideNote: "agent 汇报的每一步进展，都收在这里";
        readonly markdownCopy: "复制";
        readonly markdownCopied: "已复制";
        readonly markdownFootnotes: "脚注";
        readonly progressLatest: "最新";
        readonly progressCount: "共 {n} 条";
        readonly progressExpand: "展开这条进展";
        readonly progressCollapse: "收起这条进展";
        readonly progressEmptyTitle: "还没有进展更新";
        readonly progressEmptyHint: "agent 开始多步任务后，会在这里汇报它进行到哪一步。";
        readonly rowPending: "进展更新";
        readonly rowRunning: "进行中";
        readonly rowDone: "已汇报";
        readonly rowError: "未发出";
        readonly rowExpand: "展开这条进展的详情";
        readonly rowCollapse: "收起这条进展的详情";
        readonly settingsHint: "进展更新会让 agent 在多步任务中主动汇报进度。打开面板可以看它到目前为止的全部汇报。";
        readonly settingsOpen: "打开进展面板";
        readonly settingsEnabledName: "进展更新";
        readonly settingsEnabledNote: "让 agent 在对话中发布进展更新";
        readonly settingsThresholdName: "催促阈值";
        readonly settingsThresholdNote: "连续这么多轮没有进展时，提醒 agent 汇报一次";
        readonly settingsPanelName: "进展面板";
        readonly settingsPanelNote: "在右侧栏查看本次会话的全部进展";
        readonly settingsUnavailable: "这项设置当前不可修改（宿主没有开放配置表单）";
        readonly settingsSaveFailed: "保存失败，请稍后再试";
    };
    en: Record<"navTitle" | "progressTitle" | "progressGuideNote" | "markdownCopy" | "markdownCopied" | "markdownFootnotes" | "progressLatest" | "progressCount" | "progressExpand" | "progressCollapse" | "progressEmptyTitle" | "progressEmptyHint" | "rowPending" | "rowRunning" | "rowDone" | "rowError" | "rowExpand" | "rowCollapse" | "settingsHint" | "settingsOpen" | "settingsEnabledName" | "settingsEnabledNote" | "settingsThresholdName" | "settingsThresholdNote" | "settingsPanelName" | "settingsPanelNote" | "settingsUnavailable" | "settingsSaveFailed", string>;
    'en-US': Record<"navTitle" | "progressTitle" | "progressGuideNote" | "markdownCopy" | "markdownCopied" | "markdownFootnotes" | "progressLatest" | "progressCount" | "progressExpand" | "progressCollapse" | "progressEmptyTitle" | "progressEmptyHint" | "rowPending" | "rowRunning" | "rowDone" | "rowError" | "rowExpand" | "rowCollapse" | "settingsHint" | "settingsOpen" | "settingsEnabledName" | "settingsEnabledNote" | "settingsThresholdName" | "settingsThresholdNote" | "settingsPanelName" | "settingsPanelNote" | "settingsUnavailable" | "settingsSaveFailed", string>;
};
/** 本命名空间的字典键联合，供类型化 `t` 座位使用。 */
export type ProgressUpdatesLocaleKey = keyof typeof zh;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** 「进展更新」的界面文案。 */
        'dsh-progress-updates': ProgressUpdatesLocaleKey;
    }
}
//# sourceMappingURL=locales.d.ts.map