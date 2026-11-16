/** The aggregated, read-only overview the hub's opening screen renders. */
export declare const HUB_OVERVIEW_PATH: "/api/dsh-chatgpt-subscription/hub/overview";
/** One provider line as the hub's overview card renders it. */
export interface HubProviderSummaryDto {
    /** Client descriptor key, e.g. 'chatgpt', 'kimi-code', 'ollama'. */
    id: string;
    /** LLM route id the line serves, e.g. 'codex-chatgpt', 'workbuddy-subscription'. */
    providerId: string;
    /**
     * Whether the line has an "enable this provider" switch at all.
     *
     * Ollama has none (a key line is always servable), so its card renders no
     * switch instead of a frozen one.
     */
    canToggle: boolean;
    /** Whether the line currently serves its route. Always true when `canToggle` is false. */
    enabled: boolean;
    /** Signed-in / stored accounts the pool currently holds. */
    accountCount: number;
    /** Whether at least one account can authenticate right now. */
    authenticated: boolean;
    /**
     * Enabled model count, when the line can determine it locally.
     *
     * Lines whose catalog only exists upstream report null rather than guessing,
     * and the card simply omits the model annotation.
     */
    enabledModelCount: number | null;
    /** Total catalog size when locally known; null otherwise. */
    totalModelCount: number | null;
    /** True when this line's summary could not be read and the counts are placeholders. */
    error?: boolean;
}
export interface HubOverviewDto {
    providers: HubProviderSummaryDto[];
}
//# sourceMappingURL=hub-contracts.d.ts.map