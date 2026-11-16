import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { SnapshotStore } from '../store.ts';
export interface ComposerQuotaFacts {
    /** The number the badge shows, already formatted. */
    text: string;
    /** What the hover and the screen reader say. */
    tooltip: string;
    level: 'normal' | 'warning' | 'danger';
}
/** The shared grading: 5% or less is critical, 20% or less warns. */
export declare function quotaLevel(remainingPercent: number): ComposerQuotaFacts['level'];
export interface ComposerQuotaBadgeProps<Status extends {
    authenticated: boolean;
}> {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory(): void;
    /** The provider id this badge speaks for; it renders for no other. */
    providerId: string;
    /** One status read; `true` asks the host for a forced refresh. */
    readStatus(refresh: boolean): Promise<Status>;
    /**
     * The line's own number picker; null means there is nothing to show.
     *
     * `modelId` is the conversation's selected model, which one line needs: its
     * allowance is reported per model group, so the number to show depends on
     * which group that model belongs to.
     */
    selectFacts(status: Status | null, modelId: string | undefined): ComposerQuotaFacts | null;
    /** Label in front of the number, from the line's own dictionary. */
    label: string;
}
export declare function ComposerQuotaBadge<Status extends {
    authenticated: boolean;
}>(props: ComposerQuotaBadgeProps<Status>): React.JSX.Element | null;
//# sourceMappingURL=ComposerQuotaBadge.d.ts.map