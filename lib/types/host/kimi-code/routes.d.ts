import type { Context } from '@deepseek-ai/cordis';
import { PROVIDER_ID, PROVIDER_NAME } from './types.ts';
import { FileCredentialStore, FileModelSettingsStore, type KimiCodeCatalogModel, type KimiCodePreferenceStore } from './token-store.ts';
import { KimiCodeAccountPool } from './account-pool.ts';
import { type KimiCodeWebStatus } from '../../shared/kimi-code-contracts.ts';
/**
 * The selection the card should show.
 *
 * A stored list that still equals the shipped default has never been edited, so
 * it cannot know about models the live catalog has since added; treating it as
 * "everything currently offered" keeps a first run from hiding the whole
 * catalog behind an unedited default. Any explicit edit is honoured exactly.
 */
export declare function resolveEnabledModelIds(stored: readonly string[], catalog: readonly KimiCodeCatalogModel[], enabled?: boolean): string[];
export interface KimiCodeStatusOptions {
    fetchFn?: typeof fetch;
    /** Whether this plugin currently owns the provider route; re-read on every status. */
    serving?: boolean | (() => boolean);
    /** Diagnostic when another plugin owns the provider route; re-read on every status. */
    conflict?: string | null | (() => string | null);
    /**
     * Account pool to report on.
     *
     * Only the plugin entry installs one, because it owns the pool's storage; a
     * caller that passes none keeps the single-account behavior.
     */
    accountPool?: KimiCodeAccountPool;
    /**
     * Session whose cache numbers the card should show.
     *
     * Omitted means "no particular conversation", which reports the process
     * aggregate. The cache is per conversation, so a card that names a session
     * is the only way its hit ratio describes something a reader can act on.
     */
    sessionId?: string;
    /**
     * 打开授权页的方式；缺省用 oauth.ts 的平台实现。
     *
     * 这一栏只是给测试留的口子：/login 会走 beginWebLogin，而它的缺省分支会真的
     * spawn 浏览器（本文件的 /login 被十几条用例打中，将来只要有人补一条就会在
     * 跑测试的机器上弹出窗口，而写用例的人不会事先知道）。
     *
     * 生产装配（src/index.ts）不传这个字段，所以**生产行为一点没变**：该开还是开。
     */
    openBrowser?: (url: string) => void;
}
/** Everything the settings card renders: account, quota, and the model catalog. */
export declare function getKimiCodeWebStatus(store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: KimiCodePreferenceStore, options?: KimiCodeStatusOptions, accountPool?: KimiCodeAccountPool | undefined): Promise<KimiCodeWebStatus>;
/** Register the Kimi Code settings routes under `/kimi-code/api`. */
export declare function registerKimiCodeRoutes(ctx: Context, store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: KimiCodePreferenceStore, options?: KimiCodeStatusOptions, accountPool?: KimiCodeAccountPool | undefined): () => void;
export { PROVIDER_ID, PROVIDER_NAME };
//# sourceMappingURL=routes.d.ts.map