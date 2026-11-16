import type { AccountPoolStatusDto, AccountRotationStrategy } from '../../shared/account-pool-contracts.ts';
import type { MinimaxCodeAccount, MinimaxCodeModelOption, MinimaxCodeQuota, MinimaxCodeReasoningEffort, MinimaxCodeResetCardsDto, MinimaxCodeResetOutcome, MinimaxCodeWebLogin, MinimaxCodeWebStatus } from '../../shared/minimax-code-contracts.ts';
import type { AccountPoolLabels } from '../common/AccountPoolSection.tsx';
import { zh } from './locales.ts';
/** The pool slice the status card renders, absent when the line has no pool. */
export type MinimaxCodePoolStatus = Pick<AccountPoolStatusDto, 'accounts' | 'rotationStrategy'> & {
    activeAccountId?: string;
};
/**
 * The keys this card renders.
 *
 * The provider hub hosts every provider tab inside one settings section whose
 * injected `t` seat is bound to the hub's own namespace, and every sibling tab
 * therefore renders its own dictionary instead of that seat (see KimiCodeSection,
 * WorkBuddySection and CommandCodeSection, none of which declare a locale prop).
 * This card must do the same: its keys are not a subset of the hub's, so using the
 * hub's seat resolves the overlap to ChatGPT wording ("使用 ChatGPT 登录" on the
 * MiniMax tab) and every other key to the literal key text.
 */
export type Translate = (key: keyof typeof zh) => string;
/** The card's own dictionary; stable identity keeps effect dependencies intact. */
export declare const fallbackTranslate: Translate;
/**
 * One reset-card panel read, defensively shaped.
 *
 * The route is new and the card renders whatever it is handed, so a half that
 * answers something else (a stale host, a route that 404s into an error body the
 * reader already raised) must not turn into a render crash on `cards.length`.
 * A missing list is an empty list, which is also the truthful reading: the user
 * can select nothing and the use button stays disabled.
 */
export declare function normalizeResetCards(value: MinimaxCodeResetCardsDto | null | undefined): MinimaxCodeResetCardsDto;
/**
 * What the card tells the user after a spend, one sentence per outcome.
 *
 * The six outcomes are not six flavours of the same answer. Two are certain
 * ("done"), two are refusals (the card is gone — re-read the list), and two are
 * `I did not find out`: the service de-duplicates on the card's own key, so
 * retrying THE SAME card costs nothing while picking another one really does
 * spend a second card. That is why the uncertain sentence names the same card.
 */
export declare function resetOutcomeNotice(outcome: MinimaxCodeResetOutcome, t: Translate): string;
/**
 * Whether an outcome leaves the spent card's fate decided.
 *
 * True for the four outcomes that will not change if the user waits: the card is
 * consumed or it is not usable. False for the two uncertain ones — refreshing
 * there would drop the very row the sentence tells the user to retry with.
 */
export declare function outcomeIsDecided(outcome: MinimaxCodeResetOutcome): boolean;
/**
 * Props this card accepts.
 *
 * Deliberately the same shape every sibling tab declares: the hub hands each tab
 * only the refresh callback. The card does not take the hub's `settings.section`
 * runtime seat or its locale seat, because it renders its own dictionary (see
 * below) and needs none of that scope's other props.
 */
export interface MinimaxCodeSectionProps {
    onModelChange?: () => void;
}
/**
 * Everything the card's view consumes, grouped by kind.
 *
 * Returned as one named shape instead of one status blob: a reader can see at a
 * glance what the hook tracks, what it computes from a status answer, and what
 * the view is allowed to ask it to do.
 */
export interface MinimaxCodeSectionView {
    /** Values that change as the card runs. */
    state: {
        /** Last status answer; null until the first read lands. */
        status: MinimaxCodeWebStatus | null;
        /** True until the first status read settles, whatever its outcome. */
        loading: boolean;
        /** Id of the action in flight, or null; every disabled control reads it. */
        busy: string | null;
        /** The failure the card's error strip shows. */
        error: string | null;
        /** The device-code flow being polled, when one is running. */
        flow: MinimaxCodeWebLogin | null;
        /** Whether the user code was just copied, so the button can say so. */
        copied: boolean;
        /** Result of the last explicit connection test, as one sentence. */
        connectionNotice: string | null;
        /** One free-text capacity draft per model, keyed by model id. */
        contextDrafts: Record<string, string>;
        /** Model id whose context-window save or restore is in flight. */
        savingModel: string | null;
        /** The pool slice read beside the status; undefined when the line has no pool. */
        pool: MinimaxCodePoolStatus | undefined;
        /**
         * The reset-card panel: cards still held plus the last 30 days of flow.
         *
         * Null until the first read settles. A read that fails is not an error the
         * user can act on, so it renders as an explanation rather than a banner.
         */
        resetCards: MinimaxCodeResetCardsDto | null;
        /** Sentence describing the last spend, kept until the next one replaces it. */
        resetNotice: string | null;
        /** The card the user picked but has not spent yet; null when none is. */
        selectedResetCardId: string | null;
    };
    /** Facts read straight off the current status answer. */
    derived: {
        /** Whether the line holds a usable credential. */
        authenticated: boolean;
        /** The signed-in account, when the host reports one. */
        account: MinimaxCodeAccount | undefined;
        /** The displayed account's usage snapshot, when the host has one. */
        quota: MinimaxCodeQuota | undefined;
        /** Every catalog row, in catalog order. */
        models: MinimaxCodeModelOption[];
        /** Models the context-window editor offers: the enabled ones only. */
        contextModels: MinimaxCodeModelOption[];
        /** How many stored overrides exist, whether or not a row still shows them. */
        overrideCount: number;
        /** The cards the panel read, already normalised to a list. */
        resetCardList: MinimaxCodeResetCardsDto['cards'];
        /** The 30-day flow the panel read, already normalised to a list. */
        resetCardFlows: MinimaxCodeResetCardsDto['flows'];
        /**
         * The line's label set, handed to the shared pool card as one object.
         *
         * The hook resolves it for its own sentences too, so the view takes the
         * assembled labels from here rather than reaching for a second binding.
         */
        poolLabels: AccountPoolLabels;
    };
    /** Everything the view can trigger. */
    actions: {
        /** Start a device-code sign-in. */
        login(): Promise<void>;
        cancelLogin(): Promise<void>;
        /** Copy the flow's user code; the button says so for two seconds. */
        copyCode(): Promise<void>;
        logout(): Promise<void>;
        /** One account-level action on the shared pool card. */
        poolAction(action: 'set-primary' | 'delete' | 'clear-cooldown' | 'relogin', accountId: string): Promise<void>;
        setStrategy(strategy: AccountRotationStrategy): Promise<void>;
        toggleModel(modelId: string, checked: boolean): void;
        setAllModels(selectAll: boolean): void;
        /** Flip the check-in scheduler's own switch. */
        setCheckinEnabled(enabled: boolean): Promise<void>;
        /** Run one check-in pass now. */
        runCheckinNow(): Promise<void>;
        updateEffort(effort: MinimaxCodeReasoningEffort | null): Promise<void>;
        saveContextWindow(modelId: string): Promise<void>;
        resetContextWindow(modelId: string): Promise<void>;
        resetAllContextWindows(): Promise<void>;
        refreshQuota(): Promise<void>;
        /** Re-read the reset-card panel on demand. */
        refreshResetCards(): Promise<void>;
        /** Pick (or clear) the card the use button would spend. */
        selectResetCard(cardId: string | null): void;
        /** Confirm, spend the selected card, then re-read the panel and the usage. */
        useResetCard(cardId: string): Promise<void>;
        testConnection(): Promise<void>;
        /** Edit one capacity draft mid-typing; the editor never parses it. */
        updateContextDraft(modelId: string, draft: string): void;
    };
}
export declare function useMinimaxCodeSection({ onModelChange }: MinimaxCodeSectionProps): MinimaxCodeSectionView;
//# sourceMappingURL=useMinimaxCodeSection.d.ts.map