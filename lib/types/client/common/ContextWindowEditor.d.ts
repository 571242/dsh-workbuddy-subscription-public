export interface ContextWindowRow {
    /** Model id: the row key, the name's tooltip, and what the callbacks receive. */
    id: string;
    name: string;
    /**
     * The free-text draft the card owns. The editor never parses it and never
     * falls back to a default, because a half-typed value has to survive a render.
     */
    draft: string;
    /** Window figure shown beside the name; the cards that show one format it themselves. */
    meta?: string;
    /** `aria-label` of this row's input; the one card that labels it with nothing omits it. */
    inputLabel?: string;
    /**
     * Whether the host stores an override for this model. A model with none has
     * nothing to drop, so its restore button stays disabled.
     */
    hasOverride: boolean;
    /** True while this row's save or restore request is in flight. */
    saving: boolean;
}
export interface ContextWindowLabels {
    /** Unit rendered after every capacity input. */
    tokens: string;
    save: string;
    saving: string;
    reset: string;
    resetAll: string;
    /** Sentence shown while no enabled model has a row. */
    empty: string;
}
/** The slice of a line's status payload the draft seeding reads. */
export interface ContextWindowStatus {
    models: readonly {
        id: string;
        defaultContextWindow: number;
    }[];
    contextWindowOverrides: Record<string, number>;
}
/**
 * Seed one draft per model from a status payload, so the input shows the stored
 * override and falls back to the catalog length.
 *
 * Run after a model toggle too: a model that was just enabled has no draft yet,
 * and only enabled models get a row — without this, its row would render an
 * empty input that a save would then reject as unparsable.
 */
export declare function contextDraftsFor(status: ContextWindowStatus): Record<string, string>;
interface Props {
    rows: ContextWindowRow[];
    labels: ContextWindowLabels;
    /** Disables the batch restore while any other request is in flight. */
    busy: boolean;
    /**
     * Counts every stored override, including keys left by models the picker no
     * longer lists — which is why the batch button can be live while no visible
     * row offers a restore.
     */
    overrideCount: number;
    /** Class the meta figure wears; each line draws it from its own stylesheet. */
    metaClassName?: string;
    onDraftChange(id: string, draft: string): void;
    onCommit(id: string): void;
    onReset(id: string): void;
    onResetAll(): void;
}
export declare function ContextWindowEditor({ rows, labels, busy, overrideCount, metaClassName, onDraftChange, onCommit, onReset, onResetAll, }: Props): React.JSX.Element;
export {};
//# sourceMappingURL=ContextWindowEditor.d.ts.map