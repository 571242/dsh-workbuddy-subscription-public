/**
 * Compatibility constants for the ChatGPT-backed Codex flow. The backend and
 * OAuth parameters are not a public third-party API contract, so every such
 * value is isolated here for review and rollback.
 */
export declare const CHATGPT_OAUTH_ISSUER: "https://auth.openai.com";
export declare const CHATGPT_OAUTH_CLIENT_ID: "app_EMoamEEZ73f0CkXaXp7hrann";
export declare const OAUTH_CALLBACK_HOST: "localhost";
export declare const OAUTH_CALLBACK_PORT: 1455;
export declare const OAUTH_CALLBACK_PATH: "/auth/callback";
export declare const OAUTH_REDIRECT_URI: "http://localhost:1455/auth/callback";
export declare const OAUTH_SCOPE: "openid profile email offline_access";
/**
 * The single `originator` this line presents to the Codex backend on every
 * request, and the one OAuth sends during sign-in.
 *
 * This used to be three different values - `opencode` for chat and sign-in,
 * `pi` for the image and search endpoints - which was an archaeological record
 * of when each endpoint was reverse-engineered, not a decision. The Codex
 * backend keys behaviour off this value (`codex_cli_rs` is what the official
 * CLI sends) and treats it as one client identity, so splitting it across three
 * files meant three unrelated failure signatures for one account. Both spellings
 * are known-good against the backend; `opencode` is kept because it is the value
 * the OAuth flow has always presented, and changing the sign-in originator is a
 * different risk from changing the request originator.
 */
export declare const CODEX_ORIGINATOR: "opencode";
/** OAuth presents the same identity the request path does (see above). */
export declare const OAUTH_ORIGINATOR: "opencode";
export declare const OAUTH_LOGIN_TIMEOUT_MS: number;
export declare const TOKEN_REFRESH_MARGIN_MS = 60000;
export declare const ROUTE_PREFIX: "/api/dsh-chatgpt-subscription";
export declare const PLUGIN_VERSION: "0.1.0-alpha.0";
export declare const CODEX_CHATGPT_PROVIDER_ID: "codex-chatgpt";
export { MINIMAX_CODE_PROVIDER_ID, MINIMAX_CODE_ROUTE_PREFIX } from './shared/minimax-code-contracts.ts';
export declare const CODEX_API_BASE: "https://chatgpt.com/backend-api/codex";
export declare const CODEX_RESPONSES_URL: "https://chatgpt.com/backend-api/codex/responses";
export declare const CODEX_IMAGE_GENERATION_URL: "https://chatgpt.com/backend-api/codex/images/generations";
export declare const CODEX_SEARCH_URL: "https://chatgpt.com/backend-api/codex/alpha/search";
export declare const CODEX_USAGE_URL: "https://chatgpt.com/backend-api/wham/usage";
/**
 * The live model listing the subscription serves.
 *
 * Unlike the public `/v1/models`, this endpoint answers the *subscription*
 * entitlement: which models this plan can call, their real context window, and
 * the reasoning levels each one accepts. `client_version` is required and is the
 * same value the official CLI sends.
 */
export declare const CODEX_CLIENT_VERSION: "0.99.0";
export declare const CODEX_MODELS_URL: "https://chatgpt.com/backend-api/codex/models?client_version=0.99.0";
/**
 * Beta gate the Codex backend expects on every responses request.
 *
 * The subscription backend is served under a beta flag, not as stable API:
 * without this header the endpoint is a different (and, on older builds,
 * rejected) surface. Kept as a single constant so the value is reviewable in
 * one place with the rest of the wire contract in `wire-auth.ts`.
 */
export declare const CODEX_OPENAI_BETA: "responses=experimental";
export declare const CODEX_RESET_CREDITS_URL: "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits";
export declare const CODEX_RESET_CREDITS_CONSUME_URL: "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume";
export declare const CODEX_IMAGE_TOOL_NAME: "codex_image_generate";
export declare const CODEX_IMAGE_MODEL: "gpt-image-2";
/**
 * The Antigravity image tool and the runtime it calls.
 *
 * `gemini-3.1-flash-image` is listed by `fetchAvailableModels`, but its product
 * is an image and the harness accepts text-only assistant output, so it is
 * served as a tool (like Codex images) rather than as a chat model.
 */
export declare const ANTIGRAVITY_IMAGE_TOOL_NAME: "antigravity_image_generate";
export declare const ANTIGRAVITY_IMAGE_MODEL: "gemini-3.1-flash-image";
export declare const CODEX_SEARCH_PROVIDER_ID: "codex-subscription";
export declare const CODEX_FETCH_PROVIDER_ID: "codex-subscription";
export declare const QUOTA_CACHE_MS = 60000;
export declare const QUOTA_MIN_UPSTREAM_INTERVAL_MS = 15000;
export declare const OAUTH_AUTHORIZE_URL: "https://auth.openai.com/oauth/authorize";
export declare const OAUTH_TOKEN_URL: "https://auth.openai.com/oauth/token";
//# sourceMappingURL=compat.d.ts.map