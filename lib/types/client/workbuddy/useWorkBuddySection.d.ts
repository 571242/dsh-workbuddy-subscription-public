import type { AccountRotationStrategy } from '../../shared/account-pool-contracts.ts';
import type { WorkBuddyAccount, WorkBuddyAccountQuota, WorkBuddyAccountSummaryDto, WorkBuddyCheckinSettings, WorkBuddyGuardrailsDto, WorkBuddyModelOption, WorkBuddyOutboundSetting, WorkBuddyReasoningEffort, WorkBuddyWebStatus } from '../../shared/workbuddy-contracts.ts';
import { type AccountPoolLabels } from '../common/account-pool-labels.ts';
/** The seats the settings hub hands the card; both optional, so a bare render works. */
export interface WorkBuddySectionProps {
    onModelChange?: () => void;
    loadModelDirectory?: () => void;
}
interface ConnectionPayload {
    connected: boolean;
    account: WorkBuddyAccount | null;
    latencyMs: number;
    model: string;
    checkedAt: number;
}
/** One selectable default reasoning level, with the models that declare it. */
export interface ReasoningEffortChoice {
    value: WorkBuddyReasoningEffort;
    /** Model names that accept this level, in catalog order. */
    models: string[];
}
/**
 * Reasoning levels the default-effort control may offer.
 *
 * The levels come from what this account's models actually declare — never from
 * the shipped enum alone. The setting is one global default applied to whichever
 * model a conversation uses, so the list is their union; each entry carries the
 * models behind it, and a level only some models accept is labelled as such.
 * Order follows {@link WORKBUDDY_REASONING_EFFORTS}, which is the escalating
 * order the upstream ladder uses.
 */
export declare function reasoningEffortChoices(models: WorkBuddyModelOption[]): ReasoningEffortChoice[];
/**
 * Whether a saved default is unusable for every model on this account.
 *
 * The adapter drops a level the chosen model does not accept instead of sending
 * it, so a value that no model declares silently does nothing. Reporting it is
 * what keeps that from looking like the setting was applied.
 */
export declare function unsupportedReasoningEffort(configured: WorkBuddyReasoningEffort | null | undefined, models: WorkBuddyModelOption[]): WorkBuddyReasoningEffort | null;
/**
 * Everything the card's view consumes, grouped by kind.
 *
 * Returned as one named shape instead of one status blob: a reader can see at a
 * glance what the hook tracks, what it computes from a status answer, and what
 * the view is allowed to ask it to do.
 */
export interface WorkBuddySectionView {
    /** Values that change as the card runs. */
    state: {
        /** Last status answer; null until the first read lands. */
        status: WorkBuddyWebStatus | null;
        /** True until the first status read settles, whatever its outcome. */
        loading: boolean;
        /** Id of the action in flight, or null; every disabled control reads it. */
        busy: string | null;
        /** The failure the card's error strip shows. */
        error: string | null;
        /** Result of the last explicit connection test. */
        connection: ConnectionPayload | null;
        /** Line the host reports while a regional sign-in is being polled. */
        loginProgress: string | null;
        /** One free-text capacity draft per model, keyed by model id. */
        contextDrafts: Record<string, string>;
        /** Model id whose context-window save or restore is in flight. */
        savingModel: string | null;
    };
    /** Facts read straight off the current status answer. */
    derived: {
        /** Every account row the shared pool card lists. */
        poolAccounts: WorkBuddyAccountSummaryDto[];
        /** Levels this account's models declare, each with the models behind it. */
        effortChoices: ReasoningEffortChoice[];
        /** Every catalog model, enabled or not; the effort labels count them. */
        allModels: WorkBuddyModelOption[];
        /**
         * A saved default no current model declares, when there is one.
         *
         * The adapter drops a level the chosen model does not accept, so reporting
         * this is what keeps an inert setting from looking applied.
         */
        strayEffort: WorkBuddyReasoningEffort | null;
        /** Models the context-window editor offers: the enabled ones only. */
        contextModels: WorkBuddyModelOption[];
        /** How many stored overrides exist, whether or not a row still shows them. */
        overrideCount: number;
        /** The displayed account's quota snapshot, when the host has one. */
        quota: WorkBuddyAccountQuota | null | undefined;
        /** Whether a credential is signed in; every authenticated control reads it. */
        authenticated: boolean;
        /**
         * A failed status read with no answer to fall back on.
         *
         * A failed read leaves `status` null, which must NOT be rendered as "no
         * credential found": that claims a credential problem when the real cause is
         * an unreachable route.
         */
        unreachable: boolean;
        /**
         * The line's dictionary, handed to the shared pool card as one object.
         *
         * The hook already owns it for its own sentences, so the view takes the same
         * object from here rather than reaching for a second import.
         */
        poolLabels: AccountPoolLabels;
    };
    /** Everything the view can trigger. */
    actions: {
        /** Start a regional sign-in; its flow is polled until it settles. */
        login(region: 'cn' | 'intl'): Promise<void>;
        /** Re-read the credentials the host can find on this machine. */
        rescan(): Promise<void>;
        /**
         * One account action, whether it is a pool action (`set-primary`, `hide`,
         * `restore`, `relogin`, `clear-cooldown`) or a credential action (`delete`).
         * The host route dispatches on `action`.
         */
        accountAction(action: string, accountId: string): Promise<void>;
        /** Delete one plugin-owned credential, after the user confirms. */
        deleteAccount(accountId: string): Promise<void>;
        setStrategy(strategy: AccountRotationStrategy): Promise<void>;
        testConnection(): Promise<void>;
        refreshQuota(): Promise<void>;
        /** Run the daily check-in for every eligible account, now. */
        checkinNow(): Promise<void>;
        /** Patch the check-in preference; omitted fields keep their stored value. */
        updateCheckin(checkin: Partial<WorkBuddyCheckinSettings>): Promise<void>;
        toggleModel(modelId: string, enabled: boolean): Promise<void>;
        setAllModels(enabled: boolean): Promise<void>;
        updateEffort(effort: WorkBuddyReasoningEffort | null): Promise<void>;
        refreshCatalog(): Promise<void>;
        saveContextWindow(modelId: string): Promise<void>;
        resetContextWindow(modelId: string): Promise<void>;
        resetAllContextWindows(): Promise<void>;
        /** Edit one capacity draft mid-typing; the editor never parses it. */
        updateContextDraft(modelId: string, draft: string): void;
        /** Switch which client identity chat requests present. */
        updateOutboundIdentity(setting: WorkBuddyOutboundSetting): Promise<void>;
        /** Arm, change or clear the local quota guardrails. */
        updateGuardrails(guardrails: Partial<WorkBuddyGuardrailsDto>): Promise<void>;
        /** Store the desktop client's at-rest key so sealed credentials can be read. */
        saveAtRestKey(key: string): Promise<void>;
        /** Forget that key; sealed accounts become unreadable again. */
        clearAtRestKey(): Promise<void>;
    };
}
export declare function useWorkBuddySection({ onModelChange, loadModelDirectory }: WorkBuddySectionProps): WorkBuddySectionView;
export {};
//# sourceMappingURL=useWorkBuddySection.d.ts.map