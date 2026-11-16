import type { KimiCodeReasoningEffort, KimiCodeRegion, KimiCodeThinkingType } from '../../shared/kimi-code-contracts.ts';
import type { CredentialStore } from '../token-store.ts';
import { type ContextWindowOverridePatch } from '../common/context-window-overrides.ts';
import { DEFAULT_OAUTH_HOST, type KimiCacheTtl } from './types.ts';
export declare const KIMI_CODE_PREFERENCES_NAMESPACE = "dsh-kimi-code";
export type { KimiCodeReasoningEffort };
/**
 * One stored Kimi Code credential.
 *
 * Kimi Code is an OAuth subscription: the bearer pair rotates, so both tokens
 * are kept and the access token is refreshed shortly before it expires. The
 * remaining fields are non-secret account facts the settings card renders
 * without another round trip.
 */
export interface KimiCodeCredentials {
    /** Bearer access token for the coding API. Host-only; never sent to a browser. */
    accessToken: string;
    /** Rotating refresh token. Host-only. */
    refreshToken: string;
    /** Unix milliseconds the access token stops being valid. */
    expiresAt: number;
    /** Lifetime the token endpoint reported, in seconds. */
    expiresIn: number;
    scope?: string;
    tokenType?: string;
    /** Region the credential was issued in; decides which hosts are used. */
    region: KimiCodeRegion;
    /** OAuth host the credential came from, so a refresh targets the same one. */
    oauthHost: string;
    /** Coding API base URL the credential was issued for, without /v1. */
    baseUrl: string;
    userId?: string;
    nickname?: string;
    email?: string;
    planName?: string;
    /** Unix milliseconds the credential was obtained. */
    authenticatedAt?: number;
}
export interface KimiCodeCatalogModel {
    id: string;
    name?: string;
    contextWindow?: number;
    reasoningEfforts?: string[];
    defaultReasoningEffort?: string;
    inputModalities?: Array<'text' | 'image' | 'video'>;
    protocol?: 'openai' | 'anthropic';
    /** Whether the model also accepts video input (reported; DSH cannot send it). */
    supportsVideo?: boolean;
    /** One-line description from the official model table. */
    description?: string;
    /** Subscription tier the model needs, when not every member has it. */
    minimumPlan?: string | null;
    /**
     * Whether the model supports dynamically loaded tools.
     *
     * K3 advertises this: extra tool definitions can be injected mid-conversation
     * as a system message carrying a `tools` array, keeping the top-level list
     * small and stable. DSH has no equivalent concept, so this is reported for
     * information rather than acted on.
     */
    supportsDynamicTools?: boolean;
    /**
     * Server-declared toggle support for thinking.
     *
     * The three-state declaration, and the one that wins over the older
     * `supports_reasoning` boolean: `only` means the model reasons at every
     * level and cannot be turned off, `no` means it does not reason at all, and
     * `both` means it can be toggled. A model declaring `only` must not be
     * offered a `none` effort, because the service rejects one.
     *
     * Absent on older servers, where the effort list alone is the evidence.
     */
    thinkingType?: KimiCodeThinkingType;
    /**
     * Largest prompt the model accepts, when it is smaller than the window.
     *
     * A model can have a 1M window and a lower input cap. The window still
     * bounds the completion budget, but prompt budgeting has to use this, or a
     * session is allowed to grow past what the endpoint will accept and the
     * request fails instead of compacting first.
     */
    maxInputTokens?: number;
    /**
     * Whether the model accepts tool declarations at all.
     *
     * Absent means the server said nothing, which is not the same as a denial —
     * the parser keeps that distinction, so a silent listing does not disable
     * tools on a model that still takes them.
     */
    supportsToolUse?: boolean;
}
export interface KimiCodeModelSettings {
    enabled?: boolean;
    enabledModelIds: string[];
    catalogModels: KimiCodeCatalogModel[];
    contextWindowOverrides: Record<string, number>;
    defaultReasoningEffort: KimiCodeReasoningEffort | null;
    /**
     * Prompt-cache tier this line asks for. `null` sends no cache field at all,
     * which leaves the service on its own default behaviour — the request this
     * line sent before the setting existed, byte for byte.
     */
    cacheTtl: KimiCacheTtl | null;
}
export interface KimiCodePreferenceStore {
    status(): KimiCodeModelSettings;
    update(patch: {
        enabled?: boolean;
        enabledModelIds?: string[];
        /** `null` deletes one override and falls back to the catalog default. */
        contextWindowOverrides?: ContextWindowOverridePatch;
        defaultReasoningEffort?: KimiCodeReasoningEffort | null;
        /** `null` clears the tier, returning to "send no cache field". */
        cacheTtl?: KimiCacheTtl | null;
    }): Promise<KimiCodeModelSettings>;
}
/**
 * Bind the model selection to the DSH settings document when the harness still
 * offers one, and to the JSON file beside it otherwise: a harness without the
 * register seam (0.1.7, and a headless test) reads that file back on boot.
 */
export declare function registerKimiCodePreferenceStore(settings?: unknown, fallbackStore?: FileModelSettingsStore): KimiCodePreferenceStore;
export declare function credentialPath(): string;
export declare function modelSettingsPath(): string;
/** File the install channel uses to pin a region before the first login. */
export declare function regionMarkerPath(): string;
/**
 * Stable per-installation device id the managed service expects.
 *
 * The official client writes this once and reuses it; it is not a secret, only
 * an identity marker, so it lives beside the other plugin state.
 */
export declare function deviceIdPath(): string;
export declare function parseKimiCodeCredentials(value: unknown): KimiCodeCredentials;
/** Encrypted credential store; the plaintext JSON is only a migration source. */
export declare class FileCredentialStore {
    private readonly filePath;
    private readonly backend;
    constructor(filePath?: string, backend?: CredentialStore<KimiCodeCredentials>);
    path(): string;
    private serialize;
    private removeLegacy;
    private saveVerified;
    read(): Promise<KimiCodeCredentials | null>;
    write(credentials: KimiCodeCredentials): Promise<void>;
    delete(): Promise<void>;
}
/** Plain-JSON model settings used when the settings service is unavailable. */
export declare class FileModelSettingsStore {
    private readonly filePath;
    constructor(filePath?: string);
    path(): string;
    read(): Promise<KimiCodeModelSettings>;
    write(settings: KimiCodeModelSettings): Promise<void>;
    updateSettings(patch: {
        enabled?: boolean;
        enabledModelIds?: string[];
        /** `null` deletes one override and falls back to the catalog default. */
        contextWindowOverrides?: ContextWindowOverridePatch;
        defaultReasoningEffort?: KimiCodeReasoningEffort | null;
        /** `null` clears the tier, returning to "send no cache field". */
        cacheTtl?: KimiCacheTtl | null;
    }): Promise<KimiCodeModelSettings>;
    setCatalogModels(catalogModels: KimiCodeCatalogModel[], options?: {
        enabledModelIds?: string[];
    }): Promise<KimiCodeModelSettings>;
}
/**
 * Resolve the region this installation belongs to.
 *
 * Read locally, never probed: an environment pin wins, then the marker file the
 * install channel may have written, then the default. A region only selects
 * hosts, so an unknown marker is ignored rather than fatal.
 */
export declare function resolveRegion(env?: NodeJS.ProcessEnv): Promise<KimiCodeRegion>;
/** Remember a region choice so a later status call reports the same one. */
export declare function persistRegion(region: KimiCodeRegion): Promise<void>;
export { DEFAULT_OAUTH_HOST };
//# sourceMappingURL=token-store.d.ts.map