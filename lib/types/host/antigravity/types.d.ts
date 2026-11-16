export declare const PROVIDER_NAME = "Antigravity";
export declare const PROVIDER_ID = "antigravity";
export declare const STREAM_IDLE_TIMEOUT_MS = 300000;
export declare const STREAM_IDLE_TIMEOUT_CODE = "LLM_STREAM_IDLE_TIMEOUT";
export declare const DISCOVERY_TIMEOUT_MS = 8000;
export declare const PROJECT_CACHE_TTL_MS: number;
export declare const MODEL_CACHE_TTL_MS: number;
export declare const OAUTH_CALLBACK_TIMEOUT_MS: number;
export declare const DEFAULT_ENDPOINT = "https://cloudcode-pa.googleapis.com";
export declare const DAILY_ENDPOINT = "https://daily-cloudcode-pa.googleapis.com";
export declare const ENDPOINT_FALLBACKS: string[];
export declare const FREE_TIER_ID = "free-tier";
export declare const ONBOARD_TIMEOUT_MS = 30000;
export declare const ONBOARD_POLL_INTERVAL_MS = 1000;
export declare const DEFAULT_ANTIGRAVITY_VERSION = "2.23.0";
export declare const DEFAULT_ANTIGRAVITY_CL = "998057262";
export declare const REDIRECT_PATH = "/oauth-callback";
export declare const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export declare const TOKEN_URL = "https://oauth2.googleapis.com/token";
export declare const SCOPES: string[];
export declare const DEFAULT_CLIENT_ID: string;
export declare const DEFAULT_CLIENT_SECRET: string;
export declare const ANTIGRAVITY_SYSTEM_INSTRUCTION: string;
export declare const ANTIGRAVITY_NO_PREAMBLE_INSTRUCTION = "CRITICAL: NEVER output rule checks, formatting guidelines, constraint checklists, or thinking/personality preambles in the final response. Output only the final response. This forbids meta commentary only; it does not forbid the short progress lines the next rule requires before tool calls.";
export declare const ANTIGRAVITY_PROGRESS_INSTRUCTION = "Progress and tool execution rule: before EVERY tool call, emit 1-2 short sentences of ordinary, visible assistant text stating what you are about to do and why, written as normal response text the user can read. Never write those sentences only inside your thinking/thought summary: the visible text part must exist, otherwise the progress is not delivered. These progress lines are required and take precedence over the no-preamble rule. Keep them brief, professional, and factual; do not restate the whole plan. Only present the comprehensive final answer and summary in the final turn, after all tool operations are completed.";
export declare const GEMINI_ROLE: {
    readonly user: "user";
    readonly model: "model";
};
export declare const TOOL_CALLING_MODE: {
    readonly none: "NONE";
    readonly any: "ANY";
    readonly auto: "AUTO";
    readonly validated: "VALIDATED";
};
/**
 * How one selectable model reaches its runtime ids.
 *
 * Every entry resolves to exactly ONE runtime id per request. There is
 * deliberately no fallback list: retrying a failed request on a different
 * model (3.8 → 3.7 → 3.6, Pro High → Pro Low) served the user a model they
 * did not pick without telling them, which the official client never does. A
 * runtime id the service rejects now surfaces as that rejection.
 *
 * The runtime ids are the ones `fetchAvailableModels` lists (snapshot of
 * 2026-10-14, client 2.23.0); the display names it publishes beside them are
 * quoted where the mapping is not obvious.
 */
export interface AntigravityRoutingEntry {
    off: string;
    routing: Record<string, string>;
    defaultRequestId: string;
}
export declare const ROUTING: Record<string, AntigravityRoutingEntry>;
export declare const RUNTIME_MAX_OUTPUT_TOKENS: Record<string, number>;
export interface AntigravityModelDef {
    id: string;
    name: string;
    inputModalities: Array<'text' | 'image'>;
    contextWindow: number;
    maxTokens: number;
    reasoningEfforts?: string[];
}
export declare const MODELS: AntigravityModelDef[];
//# sourceMappingURL=types.d.ts.map