/**
 * Explicit evidence registry and runtime capability gate.
 *
 * Preserves legacy exports and inventory TABLE while introducing a strict,
 * verified capability gate. evaluateCapability / requireCapability allow ONLY
 * verified offline-contract or live-validated matching evidence.
 * Requires non-empty provider, wire, model, authMode, and capability.
 * All unverified/unimplemented queries fail closed.
 *
 * @module dsh-chatgpt-subscription/capabilities
 */
/** Whether a documented provider feature is known to work on this route. */
export type CapabilityState = 'supported' | 'unsupported' | 'unknown';
/** Evidence validation tiers. */
export type EvidenceLevel = 'live-validated' | 'offline-contract' | 'unverified';
/** Supported capability features across all routes. */
export type Capability = 'prompt-cache-read' | 'prompt-cache-write' | 'thinking-replay' | 'thinking-control' | 'server-side-compaction' | 'tool-search' | 'append-only-tools' | 'native-image' | 'native-video' | 'multi-agent-server' | 'websocket-transport' | 'zdr';
/** Concrete evidence record for a capability. */
export interface CapabilityEvidenceRecord {
    readonly id: string;
    readonly provider: string;
    readonly wire: string | readonly string[];
    readonly modelSelector: string | readonly string[] | ((modelId: string) => boolean);
    readonly authMode: string | readonly string[];
    readonly capability: Capability;
    readonly status: CapabilityState;
    readonly evidenceLevel: EvidenceLevel;
    readonly implemented: boolean;
    readonly date: string;
    readonly link?: string;
    readonly testPath?: string;
    readonly versionTag?: string;
    readonly notes?: string;
}
/** Target query for capability evaluation. All fields are required. */
export interface CapabilityQuery {
    readonly provider: string;
    readonly wire: string;
    readonly model: string;
    readonly authMode: string;
    readonly capability: Capability;
}
/** Evaluation outcome returned by evaluateCapability. */
export interface CapabilityEvaluation {
    readonly allowed: boolean;
    readonly state: CapabilityState;
    readonly implemented: boolean;
    readonly evidenceLevel?: EvidenceLevel;
    readonly evidence?: CapabilityEvidenceRecord;
    readonly reason?: string;
}
/** Error thrown by requireCapability when a capability contract fails. */
export declare class CapabilityError extends Error {
    readonly query: CapabilityQuery;
    readonly evaluation: CapabilityEvaluation;
    constructor(message: string, query: CapabilityQuery, evaluation: CapabilityEvaluation);
}
/** Known Ollama vision model prefixes per official model documentation. */
export declare const KNOWN_OLLAMA_VISION_PREFIXES: readonly ["llava", "bakllava", "llama3.2-vision", "moondream", "minicpm-v", "qwen2.5-vl", "qwen2-vl"];
/**
 * Matcher for Ollama vision models, aligned with src/host/ollama/types.ts.
 * Checks exact base name before ':' or '/' to prevent partial hijacking (e.g. 'llava-evil').
 */
export declare function isKnownOllamaVisionModel(modelId: string): boolean;
/** Ollama thinking models with level control ('low'|'medium'|'high'). */
export declare const KNOWN_OLLAMA_THINKING_LEVELS_PREFIXES: readonly ["gpt-oss"];
/** Ollama thinking models with boolean control (true|false). */
export declare const KNOWN_OLLAMA_THINKING_BOOLEAN_PREFIXES: readonly ["deepseek-r1", "qwq", "qwen3"];
/** Matcher for Ollama thinking models, aligned with src/host/ollama/types.ts. */
export declare function isKnownOllamaThinkingModel(modelId: string): boolean;
/** Immutable validated capability evidence registry. */
export declare const CAPABILITY_EVIDENCE_REGISTRY: readonly CapabilityEvidenceRecord[];
/** Query evidence records matching the given criteria. Supports optional pure registry argument for tests. */
export declare function queryCapabilityEvidence(query: Partial<CapabilityQuery>, registry?: readonly CapabilityEvidenceRecord[]): readonly CapabilityEvidenceRecord[];
/**
 * Evaluate whether a capability is permitted for a concrete request target.
 * Fails closed if query is missing explicit fields, or lacks matching verified evidence.
 */
export declare function evaluateCapability(query: CapabilityQuery, registry?: readonly CapabilityEvidenceRecord[]): CapabilityEvaluation;
/**
 * Require that a capability is supported and allowed. Throws CapabilityError otherwise.
 */
export declare function requireCapability(query: CapabilityQuery, registry?: readonly CapabilityEvidenceRecord[]): CapabilityEvaluation;
/** Whether Zero Data Retention (ZDR) is supported for this provider, wire, model, and auth mode. */
export declare function supportsZdr(provider: string, wire: string, model?: string, authMode?: string): boolean;
/** Whether Ollama image input is supported for the target model. */
export declare function supportsOllamaImage(model: string, wire?: string, authMode?: string): boolean;
/** Whether Ollama thinking control is supported for the target model. */
export declare function supportsOllamaThinkingControl(model: string, wire?: string, authMode?: string): boolean;
/** State of one capability on one route in legacy inventory. */
export declare function capabilityOf(provider: string, capability: Capability): CapabilityState;
/**
 * Legacy inventory helper, not permission to send a model-specific parameter.
 * Production builders must use evaluateCapability / requireCapability.
 * @deprecated Use evaluateCapability or requireCapability for runtime capability gating.
 */
export declare function maySend(provider: string, capability: Capability): boolean;
/** The whole matrix, for diagnostics and tests. */
export declare function capabilityTable(): Readonly<Record<string, Readonly<Partial<Record<Capability, CapabilityState>>>>>;
//# sourceMappingURL=capabilities.d.ts.map