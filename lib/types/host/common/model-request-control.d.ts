import { ConcurrencyGate } from './concurrency-gate.ts';
export declare const CONTROLLED_PROVIDERS: readonly ["codex-chatgpt", "claude", "antigravity", "kimi-code", "minimax-code", "command-code", "workbuddy", "ollama", "glm-coding-plan", "step-code"];
export type ControlledProvider = typeof CONTROLLED_PROVIDERS[number];
export interface ModelRequestLimits {
    /** Per credential limits, not guessed subscription entitlements. Zero disables. */
    default?: number;
    providers?: Partial<Record<ControlledProvider, number>>;
    queueTimeoutMs?: number;
}
/** Explicit deployment configuration. Invalid values fail closed at startup. */
export declare function readModelRequestLimits(env?: NodeJS.ProcessEnv): ModelRequestLimits;
/** Only generation POSTs are limited; token refresh/catalog/quota must never wait behind them. */
export declare function isModelRequest(input: Parameters<typeof fetch>[0], init?: RequestInit): boolean;
export interface ModelRequestControlOptions {
    provider: ControlledProvider;
    limits: ModelRequestLimits;
    gate?: ConcurrencyGate;
}
/** Hold a slot until EOF, cancel, abort or failure, never merely until response headers. */
export declare function createControlledModelFetch(baseFetch: typeof fetch, options: ModelRequestControlOptions): typeof fetch;
//# sourceMappingURL=model-request-control.d.ts.map