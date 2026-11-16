/**
 * Plugin-owned JSON storage for the preferences the settings document cannot hold.
 *
 * Harness 0.1.7 removed the register-based settings API, so the in-memory
 * fallback this plugin used without a settings service would forget every
 * selection at exit. The replacement keeps the same synchronous `get()`/`update()`/
 * `watch()` contract the settings scope offers, hydrates once from a JSON file
 * under the harness home, and writes atomically so a crash cannot leave a
 * half-written document behind.
 * @module dsh-chatgpt-subscription/file-preferences
 */
import type z from '@deepseek-ai/schemastery';
import type { SettingsScope, SettingsWatch } from './settings-compat.ts';
/** Where the plugin keeps the preferences that have no settings namespace to live in. */
export declare function preferencesPath(): string;
/** One JSON document, validated and shaped by a schemastery schema. */
export declare class FilePreferencesStore<T extends object> implements SettingsScope<T> {
    private readonly schema;
    private readonly filePath;
    private readonly legacy?;
    private value;
    private loaded;
    private writing;
    private readonly listeners;
    /**
     * @param schema - Schema the document is validated and defaulted with.
     * @param filePath - Document location; defaults to {@link preferencesPath}.
     * @param legacy - One-shot source seeded into an absent or default-only
     * document, so preferences a generation kept in the harness's own settings
     * document are not lost when that document stops being written.
     */
    constructor(schema: z<T>, filePath?: string, legacy?: (() => Promise<object | undefined>) | undefined);
    /** Current snapshot; the shipped defaults until {@link hydrate} lands. */
    get(): T;
    /** Load and validate the file once; a missing or corrupt document keeps the defaults. */
    hydrate(): Promise<void>;
    update(patch: Partial<T>): Promise<T>;
    watch(callback: SettingsWatch<T>): () => void;
    /** Validate one candidate document, throwing the schema's error when it is invalid. */
    private normalize;
    private read;
    /** The validated document, or `undefined` when the file is absent or rejected. */
    private readDocument;
    /** Publish one document, telling listeners only when it differs from the snapshot. */
    private adopt;
    private notify;
    private write;
}
//# sourceMappingURL=file-preferences.d.ts.map