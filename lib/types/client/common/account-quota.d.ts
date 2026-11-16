/**
 * The quota block that lives INSIDE one account row.
 *
 * Quota follows the account: a rotation decides which account spends the next
 * request, so a line-level quota figure describes whichever account happened to
 * be active when it was read. The host therefore reports each account's own
 * newest snapshot on that account's summary, and this renders it where the
 * account is — beside its alias, its cooldown and its last-used time.
 *
 * Every line disagrees about the wire (buckets, groups, meters, ISO strings,
 * unix seconds, remaining fractions) and agrees about the shape the host
 * normalizes into: a labeled window, a consumed share, and usually a moment it
 * reopens. Nothing here fetches: an account whose quota was never read shows
 * that it was never read, which is a different statement from "nothing used".
 */
import type { PoolAccountQuotaDto, PoolAccountQuotaWindowDto } from '../../shared/account-pool-contracts.ts';
import { type AccountPoolLabels } from './account-pool-labels.ts';
/** The label keys this block needs, all of them already on every tab's set. */
export type AccountQuotaLabels = Pick<AccountPoolLabels, 'accountQuota' | 'quotaNone' | 'quotaSnapshot' | 'quotaResets' | 'quotaExhausted' | 'quotaWindow' | 'quotaUsed'>;
/**
 * Percent with at most one decimal.
 *
 * A share that is not a finite number renders as `0%` rather than `NaN%`. Every
 * caller has already tested `Number.isFinite` and skips the row, so this is the
 * last line of defence, not a claim about an unmeasured window.
 */
export declare function formatQuotaPercent(value: number): string;
/**
 * When a window reopens, in the reader's own words.
 *
 * Always a distance. The page's own quota block counts down ("7天 3时"), and a
 * row that switched to an absolute date past a threshold described the same
 * window two different ways inside one card. Days carry a long window, hours
 * the short ones, minutes the last stretch.
 */
export declare function formatQuotaReset(resetsAt: number | null | undefined, now?: number): string;
/**
 * When the snapshot was read.
 *
 * A time alone reads as "just now" — which is a lie about a snapshot taken
 * yesterday, and the card's whole promise is that this is what we last saw.
 */
export declare function formatQuotaSnapshot(fetchedAt: number, now?: number): string;
/** A window's name: the line's own label, else its length, else a generic one. */
export declare function quotaWindowLabel(window: PoolAccountQuotaWindowDto, labels: AccountQuotaLabels): string;
/**
 * One account's quota, or the honest statement that none was ever read.
 *
 * `showEmpty` lets the hosting card stay quiet on a line that has no quota to
 * speak of, while still saying "not read yet" for an account the line does read
 * (its active one, or any account once a sibling has a snapshot).
 */
export declare function AccountQuota(props: {
    quota: PoolAccountQuotaDto | undefined;
    labels: AccountQuotaLabels;
    /** True to render the "no quota read yet" line instead of nothing. */
    showEmpty: boolean;
    now?: number;
}): React.JSX.Element | null;
//# sourceMappingURL=account-quota.d.ts.map