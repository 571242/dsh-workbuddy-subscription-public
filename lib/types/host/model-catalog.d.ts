import type { LlmModelInfo, LlmResolvedModelInfo } from '@deepseek-ai/dsh-llm';
import type { CodexCatalogEntry } from './codex-catalog.ts';
import type { SubscriptionPreferenceStore } from './preferences.ts';
export declare const PROVIDER_ID: "codex-chatgpt";
export declare const PROVIDER_NAME: "Codex\uFF08ChatGPT \u8BA2\u9605\uFF09";
export declare function listCodexModels(preferences?: SubscriptionPreferenceStore, live?: readonly CodexCatalogEntry[]): LlmModelInfo[];
export declare function resolveCodexModel(model: string, preferences?: SubscriptionPreferenceStore, live?: readonly CodexCatalogEntry[]): LlmResolvedModelInfo;
//# sourceMappingURL=model-catalog.d.ts.map