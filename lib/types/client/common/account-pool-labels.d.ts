/**
 * Labels every provider tab's account-pool card renders.
 *
 * They live here rather than in each provider's locale file so the four tabs
 * cannot drift apart in wording, ordering or meaning. The active locale is the
 * one the host already selects per provider; each `locales.ts` spreads the set
 * it needs and may override individual keys.
 */
/** Labels the shared card needs, in the order its markup uses them. */
export interface AccountPoolLabels {
    accountPool: string;
    addAccount: string;
    /** `{count}` is replaced with the number of signed-in accounts. */
    accountCount: string;
    primaryAccount: string;
    activeAccount: string;
    setPrimary: string;
    deleteAccount: string;
    cooling: string;
    /** `{minutes}` is replaced with the remaining cooldown in whole minutes. */
    cooldownLeft: string;
    clearCooldown: string;
    needsRelogin: string;
    relogin: string;
    rotationStrategy: string;
    strategySequential: string;
    strategyRoundRobin: string;
    strategySticky: string;
    noAccounts: string;
    email: string;
    expires: string;
    lastUsed: string;
    accountId: string;
    /** Legend of the per-account quota block. */
    accountQuota: string;
    /** Shown when no quota was ever read for that account. */
    quotaNone: string;
    /** `{time}` is replaced with the snapshot's read time. */
    quotaSnapshot: string;
    /** Prefix of a window's reset moment, e.g. `重置 3 小时后`. */
    quotaResets: string;
    /** Drawn in place of a percentage once a window is spent. */
    quotaExhausted: string;
    /** Fallback window name when the line gave neither a label nor a length. */
    quotaWindow: string;
    /** Read out by a screen reader beside the bar's percentage. */
    quotaUsed: string;
    /** Explains that the page-level facts belong to the current account only. */
    quotaFactsScope: string;
    /** The composer badge's own label, in front of its number. */
    composerLabel: string;
}
/** Chinese labels; the wording the Antigravity card shipped with. */
export declare const accountPoolZh: AccountPoolLabels;
/** English labels for the ChatGPT tab, which is the bilingual one. */
export declare const accountPoolEn: AccountPoolLabels;
/** Replace `{name}` placeholders in one label. */
export declare function formatPoolLabel(template: string, values: Record<string, string | number>): string;
//# sourceMappingURL=account-pool-labels.d.ts.map