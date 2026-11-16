/**
 * The WorkBuddy subscription settings card.
 *
 * Markup only: every piece of state, every effect and every request this card
 * makes lives in 'useWorkBuddySection.ts', which returns one named shape the JSX
 * below reads. The two files are the split of a single 885-line component — the
 * behaviour is unchanged, and this one should stay render-shaped.
 */
import React from 'react';
import type { WorkBuddyModelCredits, WorkBuddyRegion } from '../../shared/workbuddy-contracts.ts';
import { type WorkBuddySectionProps } from './useWorkBuddySection.ts';
/**
 * The consumption rate of one model, as the settings row states it.
 *
 * The gateway publishes one rate per region and the official CodeBuddy picker
 * spells it beside a model as `6.67x`; the row uses the same shape behind the
 * section's own label. Which rates reach the row depends on what the card knows
 * about the account, and the two cases are deliberately different:
 *
 * - A KNOWN region shows that region's rate and nothing else. Borrowing the
 *   sibling region's number would state a price this account never pays —
 *   measured 2026-10-09, `deepseek-v4.1-flash` is `0.11` on cn against `0.00`
 *   on intl, and the backends reject a model asked of the wrong region anyway.
 * - An UNKNOWN region (no account read back yet) shows both rates when the
 *   backends disagree, so the row is honest about the range instead of picking
 *   one of them. When they agree there is nothing to disambiguate.
 *
 * The two-region form is assembled entirely from the caller's labels: the
 * qualifier comes from `labels.region(value, key)` and the join from
 * `labels.pair(first, second)`, so the dictionary owns the region nouns, the
 * bracket glyphs AND the separator. Nothing about the two-region string is
 * spelled in this file, which is the point — the glyphs differ per language
 * (`倍率 0.11x（国区） / 0.00x（国际区）` in Chinese,
 * `Multiplier 0.11x (China) / 0.00x (International)` in English) and a
 * separator chosen here would be right in at most one of them.
 *
 * `null` means "this row states no rate"; the caller drops it from the hint
 * array rather than rendering a placeholder, because a guessed rate on a spend
 * figure is worse than a missing one. `'0.00'` is a declaration — this model
 * consumes no allowance — so it renders like any other value.
 */
export declare function creditMultiplierHint(credits: WorkBuddyModelCredits | undefined, region: WorkBuddyRegion | null, labels: {
    multiplier: string;
    region: (value: string, key: WorkBuddyRegion) => string;
    pair: (first: string, second: string) => string;
}): string | null;
/** Mask a UIN so the card shows identity without publishing the full number. */
export declare function maskUin(uin?: string | null): string;
export declare function WorkBuddySection({ onModelChange, loadModelDirectory }: WorkBuddySectionProps): React.ReactElement;
//# sourceMappingURL=WorkBuddySection.d.ts.map