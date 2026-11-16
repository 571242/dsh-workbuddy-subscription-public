/**
 * Host-side authorization for the models a subagent may run.
 *
 * The `subagent-model-selection` preference is sampled into each Session as a
 * durable route allowlist, but the built-in delegation tool only rejects an
 * explicit route outside that list: a call that omits `provider` or `model`
 * silently falls back to the configured child defaults or to the parent's own
 * route, so a DeepSeek parent could spawn DeepSeek children even though the
 * allowlist authorizes only other models.
 *
 * This guard closes that gap from the plugin plane. Whenever the calling
 * Session (or the nearest ancestor that recorded one) carries an allowlist,
 * every delegation must name an authorized `provider` and `model`; a call that
 * names neither, names only half of the pair, or names a route outside the list
 * is denied before the child starts, with the authorized routes in the reason so
 * the model can call `list_subagent_models` and retry with one of them.
 * @module dsh-chatgpt-subscription/subagent-model-authorization
 */
import type { Context } from '@deepseek-ai/cordis';
import { type SettingsService } from './common/settings-compat.ts';
/** DSH settings namespace owned by the Subagent settings card. */
export declare const SUBAGENT_MODEL_SELECTION_NAMESPACE = "subagent-model-selection";
/** Durable Session event carrying one Session's authorized child routes. */
export declare const SUBAGENT_POLICY_EVENT = "subagent/model-selection-policy";
/** Delegation tools whose child routes this guard authorizes. */
export declare const DEFAULT_DELEGATION_TOOLS: readonly string[];
/**
 * Delegation tools that start their child on the caller's own route by design.
 * `subagent_fork` is the shipped one: it omits `modelSelectionSettings`, so it
 * exposes no route parameters and seeds the child from the parent's own
 * conversation — a child on any other route would discard the inherited prefix
 * and its cache. Inherit mode is what keeps that design honest: the fork still
 * cannot choose, but an allowlist-carrying Session now refuses to let it run on
 * a route the user did not authorize.
 *
 * `spawn_teammate` is the second, for the same reason at one remove. The Agent
 * Teams runtime registers it in the calling agent's own scope, and it creates
 * every child through `ctx.subagents.startContinuable` with no `agentOptions`
 * at all: a teammate inherits the Lead's route and the tool exposes no route
 * parameters. Policing it as an explicit tool would deny every creation with a
 * reason the model cannot act on, so it sits here beside the fork.
 */
export declare const DEFAULT_SUBAGENT_INHERIT_TOOLS: readonly string[];
/**
 * How one delegation tool resolves the child route this guard authorizes.
 *
 * `explicit` — the tool exposes `provider`/`model`, so the call must name the
 * pair and that pair must be on the allowlist.
 * `inherit` — the tool declares no route parameters and starts the child on the
 * caller's own route (the fork backend, whose whole value is reusing the
 * parent's conversation and its cache). The guard then forbids a route override
 * and checks the effective inherited route against the same allowlist, because
 * "the tool cannot choose" is not the same as "the choice is authorized".
 */
export type DelegationToolMode = 'explicit' | 'inherit';
/** One delegation tool name paired with the mode the guard enforces on it. */
export interface DelegationToolPolicy {
    readonly name: string;
    readonly mode: DelegationToolMode;
}
/** One exact provider/model route the user authorized for children. */
export interface AllowedModelRoute {
    readonly provider: string;
    readonly model: string;
}
/** Resolved model-selection preference read from the Host settings document. */
export interface SubagentModelSelectionPreference {
    readonly enabled: boolean;
    readonly allowedModels: readonly AllowedModelRoute[];
}
/** One durable Session record this module reads: its events and its lineage. */
export interface PolicySession {
    eventAt?(seq: number): {
        type?: unknown;
        data?: unknown;
    } | undefined;
    readonly header?: {
        readonly origin?: unknown;
        readonly parentSession?: unknown;
    };
    /**
     * The request header in force after the log's last header snapshot — the
     * route the NEXT request uses. Read only by `inherit` mode, and optional so
     * a minimal durable record still satisfies this interface.
     */
    requestHeader?(): {
        readonly config?: {
            readonly provider?: unknown;
            readonly model?: unknown;
        };
    } | undefined;
}
/** Session lookup the guard walks from the calling agent to its ancestors. */
export interface SessionsResolver {
    get(id: string): PolicySession | undefined;
}
/** Calling agent fields the guard reads. */
export interface AuthorizationAgent {
    readonly session?: PolicySession;
    readonly options?: {
        readonly provider?: unknown;
        readonly model?: unknown;
    };
}
/** What the delegation tool received from the model. */
export interface DelegationArguments {
    readonly provider?: unknown;
    readonly model?: unknown;
}
/** The route an inherit-mode child would run on, as far as it can be resolved. */
export interface InheritedRoute {
    readonly provider?: string;
    readonly model?: string;
    readonly reasoningEffort?: string;
}
/**
 * Parse the allowlist out of a durable route-policy event.
 * @param data - `subagent/model-selection-policy` event payload.
 * @returns every well-formed route, or undefined when the payload carries none.
 */
export declare function parseAllowedRoutes(data: unknown): AllowedModelRoute[] | undefined;
/**
 * Find one Session's recorded allowlist among its durable events.
 * @param session - Session whose log is scanned.
 * @returns the authorized routes, or undefined for a Session that recorded none.
 */
export declare function policyRoutesOf(session: PolicySession | undefined): AllowedModelRoute[] | undefined;
/**
 * Resolve the allowlist a delegation from this agent must respect: the agent's
 * own recorded policy, else the nearest ancestor Session that recorded one
 * (the inheritance the delegation tool applies to child Sessions).
 * @param agent - Calling agent.
 * @param sessions - Session registry used for ancestor lookup.
 * @returns the authorized routes, or undefined when no Session recorded any.
 */
export declare function authorizedRoutesFor(agent: AuthorizationAgent | undefined, sessions: SessionsResolver): AllowedModelRoute[] | undefined;
/**
 * Read the Host preference that owns the allowlist. Values in the stored
 * document are untrusted JSON, so every field is narrowed before use.
 * @param settings - Live settings service, when composed and when it still
 * exposes the register seam (harness 0.1.7 replaced it with forms).
 * @returns the resolved preference, or undefined without a settings service.
 */
export declare function subagentModelSelectionPreference(settings: SettingsService | undefined): SubagentModelSelectionPreference | undefined;
/**
 * Read the route an inherit-mode child would run on: the calling agent's own
 * effective request route. This mirrors the delegation seam's
 * `parentAgentOptionsForDelegation`, where the latest request header owns
 * provider/model after request-time model selection and the creation options
 * remain the fallback before the first request. `AuthorizationAgent.options` is
 * deliberately NOT a fallback while a header exists — after a mid-session model
 * switch the creation options are stale, and trusting them would authorize the
 * route the session no longer uses.
 * @param agent - Calling agent.
 * @returns the inherited route fields, each absent when its source did not supply it.
 */
export declare function inheritedRouteOf(agent: AuthorizationAgent | undefined): InheritedRoute;
/**
 * Resolve the provider/model pair a call actually names, tolerating a model
 * value that already carries its provider prefix.
 *
 * The discovery tool that hands a model to the model renders each route as
 * `provider/model` (`minimax-code/MiniMax-M3.1-Flash-Preview`), and the
 * `model` parameter is documented as "Model id interpreted by provider". A
 * model that copies that line into `model` while naming `provider` separately
 * therefore sends `provider` = `minimax-code` and `model` =
 * `minimax-code/MiniMax-M3.1-Flash-Preview`. That is the single most likely way
 * a correct-looking call is formed, and treating the doubled text as an opaque
 * model id both denies it and — had it been authorized — resolved a model the
 * provider does not have. The prefix is stripped only when the remainder is a
 * non-empty model id.
 *
 * @param provider - Provider the call named, when it named one.
 * @param model - Model the call named, when it named one.
 * @returns the exact pair, or undefined when the call named no complete pair.
 */
export declare function explicitRoutePair(provider: unknown, model: unknown): AllowedModelRoute | undefined;
/**
 * Build the denial reason for a delegation that named no explicit route.
 * A policy-carrying Session requires the model to choose, so the reason names
 * every authorized route and the discovery tool that lists them.
 * @param allowed - Routes the calling Session authorizes.
 * @returns the corrective reason handed back to the model.
 */
export declare function missingRouteReason(allowed: readonly AllowedModelRoute[]): string;
/**
 * Build the denial reason for a half-specified route. The built-in delegation
 * tool completes such a pair from its own configuration, so this reason names
 * the missing field as well as the authorized routes.
 * @param missing - The half of the pair the call omitted.
 * @param supplied - The half the call did provide.
 * @param allowed - Routes the calling Session authorizes.
 * @returns the corrective reason handed back to the model.
 */
export declare function partialRouteReason(missing: 'provider' | 'model', supplied: string, allowed: readonly AllowedModelRoute[]): string;
/**
 * Build the denial reason for a delegation that would run on an unauthorized
 * route. The reason names the authorized routes so the next call can select one.
 * @param provider - Effective child provider id, when one is known.
 * @param model - Effective child model id, when one is known.
 * @param allowed - Routes the calling Session authorizes.
 * @param explicit - Whether the model named the route in the tool arguments.
 * @returns the corrective reason handed back to the model.
 */
export declare function unauthorizedRouteReason(provider: string | undefined, model: string | undefined, allowed: readonly AllowedModelRoute[], explicit: boolean): string;
/**
 * Build the denial reason for a call that spelled an authorized route the way
 * the discovery tool prints it.
 *
 * `list_subagent_models` renders every route as `provider/model`, and the
 * delegation tool documents `model` as "Model id interpreted by provider". A
 * model that copies the printed line into `model` while also naming `provider`
 * therefore sends a doubled id — the single most likely way a correct-looking
 * call is formed, and the reason a delegation is refused even though the route
 * the user picked is authorized.
 *
 * The id is deliberately NOT accepted here. The guard is the plugin plane, so
 * it cannot rewrite the arguments the delegation tool executes: that tool hands
 * `model` to the adapter verbatim, and the adapter matches it against its own
 * table, where `minimax-code/MiniMax-M3.1-Flash-Preview` is not a model. A
 * guard that accepted the doubled text would turn this clear refusal into a
 * downstream `NO_ADAPTER`/unknown-model failure. Naming the two fields
 * separately is what actually unblocks the call.
 *
 * @param pair - The authorized pair the call described as one string.
 * @param allowed - Routes the calling Session authorizes.
 * @returns the corrective reason handed back to the model.
 */
export declare function prefixedModelReason(pair: AllowedModelRoute, allowed: readonly AllowedModelRoute[]): string;
/**
 * Build the denial reason for an inherit-mode delegation that named a route.
 * The fork backend accepts no route parameters, so a named pair is not a
 * partial override the backend would ignore — it is a request to change the
 * route, which is exactly what an inherit-mode tool exists to prevent.
 * @param toolName - the tool the model called.
 * @param provider - the provider the call named.
 * @param model - the model the call named.
 * @returns the corrective reason handed back to the model.
 */
export declare function inheritOverrideReason(toolName: string, provider: string, model: string): string;
/**
 * Build the denial reason for an inherit-mode delegation whose inherited route
 * is outside the allowlist. Unlike the explicit case this is not something the
 * call can fix by naming a route, so the reason points at the tool that can.
 * @param toolName - the tool the model called.
 * @param provider - the parent route the child would inherit, when known.
 * @param model - the parent model the child would inherit, when known.
 * @param allowed - Routes the calling Session authorizes.
 * @param reasoningEffort - the inherited effort, when the header recorded one.
 * @returns the corrective reason handed back to the model.
 */
export declare function inheritRouteDenialReason(toolName: string, provider: string | undefined, model: string | undefined, allowed: readonly AllowedModelRoute[], reasoningEffort?: string): string;
/** Which Session's recorded allowlist a delegation must respect. */
export type AuthorizationScope = 
/**
 * `session` (default): a Session that recorded an allowlist governs itself
 * and its descendants, matching the delegation tool's durable snapshot; a
 * Session that recorded none keeps the built-in behavior.
 */
'session'
/**
 * `preference`: the current Host preference also governs Sessions that never
 * recorded an allowlist, so the Settings card applies without restarting the
 * Session. A Session that recorded its own routes still outranks it.
 */
 | 'preference';
/**
 * Resolve one tool's enforcement mode from the configured policies. An
 * unconfigured name is `undefined`: the guard does not police it, which is how
 * the plain-name configuration keeps its existing meaning.
 * @param policies - Configured tool policies in precedence order.
 * @param toolName - Tool being dispatched.
 * @returns the first matching mode, or undefined when the guard ignores the tool.
 */
export declare function delegationModeOf(policies: readonly DelegationToolPolicy[], toolName: string): DelegationToolMode | undefined;
/**
 * Resolve the effective allowlist that governs delegations from this agent:
 * empty when the Host preference explicitly disables enforcement, otherwise
 * the Session's (or nearest subagent ancestor's) recorded policy, falling
 * back to the live preference only under `preference` scope.
 * @param agent - Calling agent.
 * @param preference - Current Host preference, when the settings service exists.
 * @param sessions - Session registry used for ancestor lookup.
 * @param scope - Whether an unrecorded Session falls back to the preference.
 * @returns the authorized routes in force for this agent, or an empty list when unrestricted.
 */
export declare function effectiveAllowedRoutes(agent: AuthorizationAgent | undefined, preference: SubagentModelSelectionPreference | undefined, sessions: SessionsResolver, scope?: AuthorizationScope): readonly AllowedModelRoute[];
/**
 * Append the Session's authorized `{ provider, model }` pairs to a successful
 * `list_subagent_models` result when the calling Session is governed by an
 * allowlist.
 *
 * Calling `list_subagent_models({})` upstream returns only provider names
 * (`minimax-code — MiniMax Code`), and calling it with `provider` prints
 * `<provider>/<model>` without stating that the output is already filtered to
 * the Session allowlist. Appending the exact split `{ provider, model }` pairs
 * here lets even a single `list_subagent_models({})` call hand the model every
 * authorized route in the form `subagent` expects, eliminating any reason to
 * search local config files or source code for the allowlist.
 * @param output - Original text returned by `list_subagent_models`.
 * @param allowed - Routes the calling Session authorizes.
 * @returns the output with the Session allowlist summary appended.
 */
export declare function enrichListSubagentModelsOutput(output: string, allowed: readonly AllowedModelRoute[]): string;
/**
 * Rewrite the upstream `list_subagent_models` and `subagent` tool/parameter
 * descriptions when the calling Session enforces an allowlist.
 *
 * Upstream `dsh-tool-subagent` ships static descriptions stating that
 * `"Catalog membership is advisory: an adapter may accept an unlisted model id."`
 * and `"Child LLM selection is optional. Omit provider, model, and reasoning_effort..."`.
 * In an allowlist-governed Session both statements are false and actively
 * mislead the dispatcher into either omitting `provider`/`model` or distrusting
 * `list_subagent_models` and hunting through local files for the "real" allowlist.
 * @param text - Tool description, parameter description, or rendered `tools:sdk` section text.
 * @param allowed - Routes the calling Session authorizes.
 * @returns the text with the misleading upstream sentences replaced by the Session's exact policy.
 */
export declare function rewriteAuthorizedToolDescriptions(text: string, allowed: readonly AllowedModelRoute[]): string;
/** Minimal shape of a prompt assembly passed through `system-prompt/assemble`. */
interface MutablePromptAssembly {
    readonly sections?: readonly {
        readonly name?: unknown;
        readonly text?: unknown;
    }[];
    readonly tools?: readonly {
        readonly name?: unknown;
        readonly description?: unknown;
        readonly parameters?: unknown;
    }[];
}
/**
 * Rewrite one assembled prompt's `tools:sdk` section and native tool schemas
 * when the target Agent's Session enforces a subagent model allowlist.
 * @param assembly - Assembled prompt from `system-prompt/assemble`.
 * @param allowed - Routes the calling Session authorizes.
 * @param toolNames - Explicit-route delegation tool names.
 * @returns the updated assembly, or the original object when nothing changed.
 */
export declare function rewriteAuthorizedPromptAssembly<T extends MutablePromptAssembly>(assembly: T, allowed: readonly AllowedModelRoute[], toolNames?: readonly string[]): T;
/**
 * Decide whether one delegation call may start its child.
 * @param agent - Calling agent.
 * @param toolName - Tool being dispatched.
 * @param args - Parsed tool arguments.
 * @param preference - Current Host preference, when the settings service exists.
 * @param sessions - Session registry used for ancestor lookup.
 * @param toolNames - Delegation tool names this guard authorizes (explicit mode).
 * @param scope - Whether an unrecorded Session falls back to the preference.
 * @param inheritToolNames - Delegation tools that start a child on the caller's own route.
 * @returns a denial reason, or undefined to leave the call untouched.
 */
export declare function delegationDenialReason(agent: AuthorizationAgent | undefined, toolName: string, args: unknown, preference: SubagentModelSelectionPreference | undefined, sessions: SessionsResolver, toolNames?: readonly string[], scope?: AuthorizationScope, inheritToolNames?: readonly string[]): string | undefined;
/** Runtime inputs the guard closes over. */
export interface SubagentAuthorizationOptions {
    /** Live settings service, when composed; absent leaves recorded policies in charge. */
    readonly settings?: SettingsService;
    /** Session registry used for ancestor lookup. */
    readonly sessions: SessionsResolver;
    /** Exact delegation tool names this guard authorizes (explicit route selection). */
    readonly toolNames: readonly string[];
    /** Delegation tools that run their child on the caller's own route. */
    readonly inheritToolNames?: readonly string[];
    /** Whether an unrecorded Session falls back to the current preference. */
    readonly scope?: AuthorizationScope;
}
/** The exact guard signature the Host tool registry evaluates. */
export type DelegationGuard = (agent: AuthorizationAgent | undefined, toolName: string, args: unknown) => string | undefined;
/**
 * Build the monotonic tool guard for one deployment. The Host preference is
 * sampled from the live settings document on every call, because a settings
 * edit must not rebuild the guard the way it cannot rebuild a Session.
 * @param options - settings, session registry, and delegation tool names.
 * @returns a guard that denies delegations outside the Session allowlist.
 */
export declare function createSubagentAuthorization(options: SubagentAuthorizationOptions): DelegationGuard;
/** Delegation names this guard recognizes when configuration omits them. */
export declare function normalizeDelegationToolNames(value: unknown): string[];
/**
 * Normalize the configured inherit-mode names. Unlike
 * {@link normalizeDelegationToolNames}, an empty array is a deliberate opt-out
 * (`[]`) rather than a request for the default, and `undefined` selects the
 * shipped default.
 * @param value - Candidate configuration value.
 * @returns the exact inherit-mode names this guard enforces.
 */
export declare function normalizeInheritToolNames(value: unknown): string[];
/**
 * Validate the configured inherit-mode names. Emptiness is legal here — it
 * disables inherit enforcement — but a malformed entry is not.
 * @param toolNames - Candidate inherit-mode delegation tool names.
 * @returns the exact names this guard enforces in inherit mode.
 */
export declare function validateInheritToolNames(toolNames: readonly string[]): string[];
/**
 * Validate the plugin configuration that owns this guard.
 * @param toolNames - Candidate delegation tool names.
 * @returns the exact names this guard authorizes.
 */
export declare function validateDelegationToolNames(toolNames: readonly string[]): string[];
/** Configuration accepted by {@link installSubagentModelAuthorization}. */
export interface SubagentModelAuthorizationConfig {
    /** Delegation tool names the guard authorizes (explicit route selection). */
    readonly toolNames?: readonly string[];
    /** Delegation tools that run their child on the caller's own route. */
    readonly inheritToolNames?: readonly string[];
    /** Whether an unrecorded Session falls back to the current preference. */
    readonly scope?: AuthorizationScope;
}
/**
 * Register the monotonic guard on the Host tool registry, and — when the Host
 * context exposes Cordis events — enrich `list_subagent_models` output with the
 * Session's split `{ provider, model }` routes and rewrite the misleading
 * upstream optional/advisory wording in assembled prompts.
 * @param ctx - Host context carrying `tools` (and optionally `settings` / `on`).
 * @param sessions - Session registry used for ancestor lookup.
 * @param config - Enforcement toggle and delegation tool names.
 * @returns the exact disposer that unregisters the guard and listeners.
 */
export declare function installSubagentModelAuthorization(ctx: Context, sessions: SessionsResolver, config?: SubagentModelAuthorizationConfig): () => void;
/**
 * Validate the configured authorization scope.
 * @param scope - Candidate scope from deployment configuration.
 * @returns the exact scope this guard enforces.
 */
export declare function validateAuthorizationScope(scope: unknown): AuthorizationScope;
export {};
//# sourceMappingURL=subagent-model-authorization.d.ts.map