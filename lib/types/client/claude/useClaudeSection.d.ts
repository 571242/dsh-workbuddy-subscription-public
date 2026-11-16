import type { AccountRotationStrategy } from '../../shared/account-pool-contracts.ts';
import type { ClaudeAccountQuota, ClaudeAccountSummaryDto, ClaudeCacheTtl, ClaudeConnectionDto, ClaudeLoginFlowDto, ClaudeModelOption, ClaudeQuotaWindow, ClaudeReasoningEffort, ClaudeWebStatus } from '../../shared/claude-contracts.ts';
import { zh } from './locales.ts';
/** The seats the settings hub hands the card; both optional, so a bare render works. */
export interface ClaudeSectionProps {
    onModelChange?: () => void;
    loadModelDirectory?: () => void;
}
/**
 * Everything the card's view consumes, grouped by kind.
 *
 * Returned as one named shape instead of one status blob: a reader can see at a
 * glance what the hook tracks, what it computes from a status answer, and what
 * the view is allowed to ask it to do.
 */
export interface ClaudeSectionView {
    /** Values that change as the card runs. */
    state: {
        /** Last status answer; null until the first read lands. */
        status: ClaudeWebStatus | null;
        /** True until the first status read settles, whatever its outcome. */
        loading: boolean;
        /** Id of the action in flight, or null; every disabled control reads it. */
        busy: string | null;
        /** The failure the card's error strip shows. */
        error: string | null;
        /** The sign-in flow being polled, when one is running. */
        flow: ClaudeLoginFlowDto | null;
        /** Result of the last explicit connection test. */
        connection: ClaudeConnectionDto | null;
        /** What the user has typed into the manual-paste box. */
        pasteValue: string;
        /** One free-text capacity draft per model, keyed by model id. */
        contextDrafts: Record<string, string>;
        /** Model id whose context-window save or restore is in flight. */
        savingModel: string | null;
    };
    /** Facts read straight off the current status answer. */
    derived: {
        /** Every account row the shared pool card lists. */
        accounts: ClaudeAccountSummaryDto[];
        /** Whether any row is a snapshot of a sign-in this plugin does not own. */
        hasAdopted: boolean;
        /** Models the context-window editor offers: the enabled ones only. */
        contextModels: ClaudeModelOption[];
        /** How many stored overrides exist, whether or not a row still shows them. */
        overrideCount: number;
        /** The displayed account's quota snapshot, when the host has one. */
        quota: ClaudeAccountQuota | null | undefined;
        /** Windows of that snapshot, shortest first. */
        windows: ClaudeQuotaWindow[];
        /**
         * The line's dictionary, handed to the shared pool card as one object.
         *
         * The hook already owns it for its own sentences, so the view takes the same
         * object from here rather than reaching for a second import.
         */
        poolLabels: typeof zh;
    };
    /** Everything the view can trigger. */
    actions: {
        /** Start a sign-in; opens the authorize page when the flow carries one. */
        login(): Promise<void>;
        cancelLogin(): Promise<void>;
        /** Finish a manual-mode sign-in with the pasted code. */
        submitPaste(): Promise<void>;
        /** Add the local Claude Code sign-in as a snapshot. */
        adopt(): Promise<void>;
        /** Forget every imported snapshot, or one of them. */
        stopImporting(accountId?: string): Promise<void>;
        /** One account-level action on the shared pool card. */
        accountAction(action: 'set-primary' | 'delete' | 'clear-cooldown', accountId: string): Promise<void>;
        setStrategy(strategy: AccountRotationStrategy): Promise<void>;
        /** Re-authorize ONE account; the returned flow starts the polling above. */
        relogin(accountId: string): void;
        refreshQuota(): Promise<void>;
        refreshCatalog(): Promise<void>;
        testConnection(): Promise<void>;
        toggleModel(modelId: string, checked: boolean): void;
        setAllModels(selectAll: boolean): void;
        updateEffort(effort: ClaudeReasoningEffort | null): Promise<void>;
        updateCacheTtl(ttl: ClaudeCacheTtl | null): Promise<void>;
        saveContextWindow(modelId: string): Promise<void>;
        resetContextWindow(modelId: string): Promise<void>;
        resetAllContextWindows(): Promise<void>;
        /** Edit one capacity draft mid-typing; the editor never parses it. */
        updateContextDraft(modelId: string, draft: string): void;
        /** Edit the manual-paste box. */
        setPasteValue(value: string): void;
    };
}
export declare function useClaudeSection({ onModelChange, loadModelDirectory }: ClaudeSectionProps): ClaudeSectionView;
//# sourceMappingURL=useClaudeSection.d.ts.map