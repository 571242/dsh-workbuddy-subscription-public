import type { CredentialStore } from '../token-store.ts';
import type { OllamaCatalogModel } from './types.ts';
/**
 * One stored Ollama credential.
 *
 * Ollama cloud authenticates with a static API key rather than the rotating
 * OAuth pair the other lines in this plugin store, so there is no refresh token
 * and nothing expires: per docs/api/authentication, keys do not expire and are
 * revoked from the account settings page. That is the whole credential, and it
 * is why a pool account here is "a key a user pasted" rather than "a session this
 * plugin established".
 *
 * The key is host-only and never crosses to a browser; a settings card renders
 * the alias and status, never this value.
 */
export interface OllamaCredentials {
    /** Bearer key from https://ollama.com/settings/keys. Host-only. */
    apiKey: string;
    /** User-chosen label so several keys are distinguishable. */
    alias?: string;
    /** Unix milliseconds the key was added to the pool. */
    addedAt?: number;
}
export interface OllamaModelSettings {
    enabled: boolean;
    /**
     * The user's model filter: null is "no filter" — every catalogued model,
     * including ones a later sync adds. An array is an explicit selection, and
     * an empty one switches every model off.
     */
    enabledModelIds: string[] | null;
    catalogModels: OllamaCatalogModel[];
    defaultReasoningEffort: string | null;
}
export interface OllamaPreferenceStore {
    status(): OllamaModelSettings;
    update(patch: {
        enabled?: boolean;
        enabledModelIds?: string[] | null;
        defaultReasoningEffort?: string | null;
    }): Promise<OllamaModelSettings>;
}
export declare function credentialPath(): string;
export declare function modelSettingsPath(): string;
export declare function parseOllamaCredentials(value: unknown): OllamaCredentials;
/** Encrypted credential store for the single-key (no pool) configuration. */
export declare class FileCredentialStore {
    private readonly filePath;
    private readonly backend;
    constructor(filePath?: string, backend?: CredentialStore<OllamaCredentials>);
    path(): string;
    read(): Promise<OllamaCredentials | null>;
    write(credentials: OllamaCredentials): Promise<void>;
    clear(): Promise<void>;
}
/**
 * Model settings, bound to the DSH settings document when the harness offers one
 * and to a JSON file beside it otherwise.
 */
export declare class FileModelSettingsStore implements OllamaPreferenceStore {
    private readonly filePath;
    private cached;
    private loadPromise;
    constructor(filePath?: string);
    path(): string;
    status(): OllamaModelSettings;
    read(): Promise<OllamaModelSettings>;
    private load;
    write(settings: OllamaModelSettings): Promise<void>;
    update(patch: {
        enabled?: boolean;
        enabledModelIds?: string[] | null;
        defaultReasoningEffort?: string | null;
    }): Promise<OllamaModelSettings>;
    /** Record a catalog sync without touching the user's enabled selection. */
    storeCatalog(models: OllamaCatalogModel[]): Promise<OllamaModelSettings>;
}
//# sourceMappingURL=token-store.d.ts.map