import type { OllamaWebStatus } from '../../shared/ollama-contracts.ts';
/**
 * The Ollama settings API, as the card uses it.
 *
 * Deliberately the same envelope and the same fetch shape every other provider
 * section uses, so the shared account-pool card and this helper read alike.
 */
export declare class OllamaApi {
    status(): Promise<OllamaWebStatus>;
    /**
     * One pool action, returning the refreshed status.
     *
     * The host answers with the same envelope the status route uses, so the card
     * never has to guess what the pool looks like after a change.
     */
    accountAction(action: 'add' | 'set-primary' | 'set-alias' | 'delete' | 'clear-cooldown' | 'strategy', body?: {
        accountId?: string;
        alias?: string;
        strategy?: string;
        apiKey?: string;
    }): Promise<OllamaWebStatus>;
    refreshCatalog(): Promise<{
        models: unknown[];
    }>;
    /**
     * Store the default thinking level, answering with the refreshed status.
     *
     * '/settings' replies with the stored settings document rather than with the
     * status the card renders, so the status is re-read behind the write. That is
     * the same shape {@link refreshCatalog} needs, and it is why the return type is
     * a status: handing the settings document to the renderer would blank the
     * model list the user just configured.
     *
     * null is a real value ('do not specify'), not an absent one, so it is sent
     * explicitly rather than left out of the body.
     */
    setDefaultReasoningEffort(effort: string | null): Promise<OllamaWebStatus>;
    /**
     * Replace the enabled-model selection.
     *
     * The whole list is sent rather than a single id's new state, because the card
     * offers bulk select and unselect and would otherwise have to read the current
     * selection before it could answer 'turn this one off'.
     */
    setEnabledModels(enabledModelIds: string[] | null): Promise<{
        enabledModelIds: string[] | null;
    }>;
}
//# sourceMappingURL=api.d.ts.map