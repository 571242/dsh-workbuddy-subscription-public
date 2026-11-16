import type { Context } from '@deepseek-ai/cordis';
import { FileCredentialStore, FileModelSettingsStore, type AntigravityPreferenceStore } from './token-store.ts';
import { AccountPoolStore } from './account-pool.ts';
import type { AntigravityWebStatus } from '../../shared/antigravity-contracts.ts';
export declare function getAntigravityWebStatus(store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: AntigravityPreferenceStore, accountPool?: AccountPoolStore, sessionId?: string): Promise<AntigravityWebStatus>;
export declare function registerAntigravityRoutes(ctx: Context, store: FileCredentialStore, modelSettings: FileModelSettingsStore, preferences?: AntigravityPreferenceStore, fetchFn?: typeof fetch, accountPool?: AccountPoolStore): () => void;
//# sourceMappingURL=routes.d.ts.map