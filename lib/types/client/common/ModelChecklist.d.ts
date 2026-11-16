export interface ModelChecklistItem {
    id: string;
    name: string;
    /** One quiet line under the name (e.g. the context window); omit when none. */
    hint?: string;
    enabled: boolean;
}
export interface ModelChecklistLabels {
    selectAll: string;
    clearAll: string;
    /**
     * `{count}` and `{total}` are replaced with the enabled/total numbers.
     * Optional: a provider dictionary without the key gets the bare "3/8" form.
     */
    countTemplate?: string;
    /** aria-label of the list itself; omit when the section header already names it. */
    list?: string;
}
interface Props {
    items: ModelChecklistItem[];
    /** Disables every row and the header buttons while a commit is in flight. */
    busy: boolean;
    onToggle(id: string, enabled: boolean): void;
    onToggleAll(enabled: boolean): void;
    labels: ModelChecklistLabels;
}
export declare function ModelChecklist({ items, busy, onToggle, onToggleAll, labels }: Props): React.JSX.Element;
export {};
//# sourceMappingURL=ModelChecklist.d.ts.map