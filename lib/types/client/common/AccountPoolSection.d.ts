import React, { type ReactNode } from 'react';
import type { AccountPoolStatusDto, AccountRotationStrategy, PoolAccountSummaryDto } from '../../shared/account-pool-contracts.ts';
import { type AccountPoolLabels } from './account-pool-labels.ts';
export type { AccountPoolLabels } from './account-pool-labels.ts';
export interface AccountPoolSectionProps<TAccount extends PoolAccountSummaryDto = PoolAccountSummaryDto> extends Omit<Pick<AccountPoolStatusDto, 'activeAccountId' | 'rotationStrategy'>, 'accounts'> {
    accounts: TAccount[];
    /** Label set of the hosting tab; see {@link AccountPoolLabels}. */
    labels: AccountPoolLabels;
    /** Action currently in flight, used to disable every control at once. */
    busy: string | null;
    /** Overrides the login button text while a sign-in flow is running. */
    loginBusyLabel?: string;
    onLogin(): void;
    /**
     * Replaces the single header button with the provider's own entry points.
     *
     * WorkBuddy signs in against two regional deployments, so one "add account"
     * button cannot express it; every other line keeps the default button.
     */
    renderLoginActions?(): ReactNode;
    onSetPrimary(accountId: string): void;
    onDelete(accountId: string): void;
    onClearCooldown(accountId: string): void;
    /** Offered on an account whose credential no longer authenticates. */
    onRelogin?(accountId: string): void;
    onSetStrategy(strategy: AccountRotationStrategy): void;
    /** Provider-specific detail rows, rendered before the shared ones. */
    renderDetails?(account: TAccount): ReactNode;
    /**
     * Whether this line has a quota concept at all.
     *
     * Quota follows the account, so an account the host never read shows "no
     * quota read yet" instead of nothing — but only on a line that reads quota in
     * the first place. A line without one (Ollama: spend, no allowance) leaves
     * this off and its rows stay silent about quota.
     */
    showQuota?: boolean;
    /**
     * Provider-specific per-account buttons, rendered before the shared ones.
     *
     * Used by a line that adopts accounts it does not own: hiding or restoring
     * an externally-managed account replaces the delete it must never offer.
     */
    renderAccountActions?(account: TAccount): ReactNode;
    /** Extra controls inside the group, after the account list. */
    children?: ReactNode;
}
/** Format one account timestamp the way every tab renders it. */
export declare function formatAccountDate(ms?: number): string;
/** Whole minutes left in a cooldown, never below one. */
export declare function cooldownMinutesLeft(cooldownUntil: number, now?: number): number;
/** Whether one account currently carries a live 429 cooldown. */
export declare function isCoolingDown(account: PoolAccountSummaryDto, now?: number): boolean;
/**
 * The account-management group every provider tab renders.
 *
 * One component rather than four near-identical blocks: the account card, its
 * badges and the rotation-strategy picker are identical across providers, and
 * only the identity details differ.
 *
 * Credential storage is deliberately NOT shown here. Where the host keeps a
 * token is not a setting a user can act on, and rendering it as a labeled row
 * invited exactly that reading; several lines' notices went further and printed
 * the credential file's path.
 */
export declare function AccountPoolSection<TAccount extends PoolAccountSummaryDto = PoolAccountSummaryDto>(props: AccountPoolSectionProps<TAccount>): React.ReactElement;
//# sourceMappingURL=AccountPoolSection.d.ts.map