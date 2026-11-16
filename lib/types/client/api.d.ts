import type { LoginEventDto, LoginStartDto, PluginStatusDto, QuotaStatusDto, ConnectionTestDto, SubscriptionPreferencesDto, SubscriptionPreferencesUpdateDto } from '../shared/contracts.ts';
export declare class SubscriptionApi {
    status(): Promise<PluginStatusDto>;
    startLogin(): Promise<LoginStartDto>;
    cancelLogin(loginId: string): Promise<{
        cancelled: boolean;
    }>;
    /** Sign out one pooled account; without an id, the active one. */
    logout(accountId?: string): Promise<{
        authenticated: false;
    }>;
    /**
     * One account-pool action, returning the refreshed status.
     *
     * The host answers with the same envelope the status route uses, so the card
     * never has to guess what the pool looks like after a change.
     */
    accountAction(action: 'set-primary' | 'set-alias' | 'delete' | 'clear-cooldown' | 'strategy' | 'relogin', body?: {
        accountId?: string;
        alias?: string;
        strategy?: string;
    }): Promise<PluginStatusDto>;
    /**
     * Import this machine's Codex CLI sign-in, answering with the refreshed status.
     *
     * The body names the source rather than the URL carrying it, so the host can
     * refuse a sign-in it does not import with a sentence instead of a silent
     * no-op. The type is 'codex' alone on purpose: Claude Code and MiniMax Code are
     * imported from their own provider settings, and a union here would invite a
     * call the host always answers with a 400.
     */
    adoptLocalLogin(source: 'codex'): Promise<PluginStatusDto>;
    /** Forget every imported snapshot. The CLIs' own files are never touched. */
    disableAdoptedLocalLogins(): Promise<PluginStatusDto>;
    refresh(): Promise<PluginStatusDto>;
    refreshQuota(): Promise<QuotaStatusDto>;
    useResetCredit(): Promise<QuotaStatusDto>;
    testConnection(): Promise<ConnectionTestDto>;
    updatePreferences(patch: SubscriptionPreferencesUpdateDto): Promise<SubscriptionPreferencesDto>;
    events(loginId: string): EventSource;
}
export declare function parseLoginEvent(event: MessageEvent<string>): LoginEventDto | null;
//# sourceMappingURL=api.d.ts.map