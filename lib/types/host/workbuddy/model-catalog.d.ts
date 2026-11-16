/**
 * Model catalog for the WorkBuddy / CodeBuddy subscription.
 *
 * The subscription exposes no `/v1/models`-style listing on the chat host
 * (that path answers 404), but the gateway does publish an **authoritative
 * catalog** at `GET /v3/config`, which the official CLI reads at startup. That
 * payload carries each model's real context window, output cap, image support,
 * and the exact reasoning ladder it accepts — so this route prefers the live
 * catalog and keeps the table below only as an offline fallback.
 *
 * The fallback is a verbatim transcription of a live `/v3/config` read, not
 * hand-written guesses: an earlier revision of this file guessed context
 * windows from vendor marketing and was wrong in both directions (`glm-5.3`
 * and `kimi-k3` are 1M, not 200K/256K).
 *
 * One entry serves both regions, so a model the regions disagree about needs a
 * merged figure. The rule is asymmetric on purpose: the **larger maximum** is
 * kept, while the **served default** and the **output cap** take the **smaller**
 * of the two. Over-declaring either one is a hard failure — DSH would send a
 * request the gateway rejects — whereas under-declaring only compresses a
 * conversation earlier than needed, and both remain overridable per model from
 * the settings card. Measured disagreements (`glm-5.3-flash`, `glm-5.3`,
 * `glm-5.2`, `kimi-k2.8-preview` served 300000/48000/48000/32000 by intl
 * against 1000000/64000/64000/64000 by cn) are reconciled that way.
 *
 * The regions also do not serve the same ids. intl added `glm-5.3-flash` and
 * keeps `gemini-3.5-flash`, `kimi-k3` and the `*-model` aliases to itself; cn
 * keeps `glm-5.3-flash`, `kimi-k3-1` and its own `-x` variants.
 *
 * `regions` is a routing fact, not a preference: asking a region for a model it
 * does not serve answers 400 `code 11102`.
 *
 * A second `code 11102` source was measured and is deliberately NOT filtered
 * out here: the gateway lists models the *current account* is not entitled to
 * call (on a free plan, `glm-5.0`, `glm-4.7`, `glm-4.6`, `glm-4.6v`,
 * `kimi-k2-thinking`, `hy4-preview-x` and `minimax-m2.5` all advertise a context
 * window and then answer 11102). Those entries are kept because the gating is
 * per-account, not per-model — a paid plan may serve them — and because the
 * shipped default selection excludes them anyway. The adapter's failure message
 * names this case so a user knows to pick another model rather than to retry.
 *
 * `credits` is the consumption multiplier the same payload publishes as a
 * string (`x0.79 credits` on cn, `x6.67` on intl), stored here in the bare
 * numeric form the settings card renders. It is kept per region because the two
 * backends do not always agree — measured 2026-10-09, `deepseek-v4.1-flash`
 * is `0.11` on cn against `0.00` on intl — and a key is written only for a
 * region that actually published one (every `gpt-5.x` and `gpt-6-astra` is
 * intl-only, the `minimax` and `glm-5.0`/`glm-4.x` rows carry no intl key).
 * An empty string (`default-model`) means no rate was declared at all, so that
 * row has no `credits` field rather than a zeroed one: a guessed rate on a
 * spend figure is worse than a missing one.
 *
 * `reasoningEfforts` carries the ladder a model accepts, transcribed from the
 * gateway's own declaration. `/v3/config` uses two shapes and they were once
 * conflated, in opposite directions: a lone `{ effort: 'high' }` (no
 * `supportedEfforts`) first became a one-entry ladder, which rejected a
 * caller's explicit `low`; widening it to every level this route can name then
 * advertised `minimal`/`xhigh` on a model that has three. Such a model accepts
 * exactly `low`/`high`/`max` (measured on `deepseek-v4.1-flash`), the same
 * three the gateway declares explicitly for `glm-5.3-flash` and
 * `kimi-k2.8-preview`, and routes any other value into the nearest of them.
 */
import type { WorkBuddyModelCredits, WorkBuddyRegion } from '../../shared/workbuddy-contracts.ts';
export interface WorkBuddyModelEntry {
    id: string;
    name: string;
    /**
     * Context length the gateway serves **by default** for this model.
     *
     * This route sends no explicit context-length parameter, so this is the
     * figure DSH's compaction and overflow decisions must use. It is not always
     * the model's maximum: the gateway reports both (for example
     * `deepseek-v4.1-flash` serves 300000 by default and allows 1000000).
     */
    contextWindow: number;
    /** Largest context length the model accepts when one is requested. */
    maxContextWindow: number;
    /** Output cap requested when the caller omits one. */
    maxTokens: number;
    /** Regions whose backend serves this id. */
    regions: readonly WorkBuddyRegion[];
    /**
     * Consumption multiplier per region, as `/v3/config` publishes it.
     *
     * Optional on purpose: the multiplier is the one field the gateway may omit
     * for a model it otherwise describes (`default-model` ships an empty string),
     * so every catalog literal in this repo — test fixtures and the live parser
     * alike — must stay valid without it. Absent therefore means "nothing usable
     * was published", never "zero": `x0.00` is a real declaration and is kept.
     */
    credits?: WorkBuddyModelCredits;
    /** Whether the model accepts image input. */
    supportsImage: boolean;
    /** Reasoning ladder the model accepts; empty for a non-reasoning model. */
    reasoningEfforts: readonly string[];
    /** Level this route selects when the caller names none. */
    defaultReasoningEffort: string | null;
    /** Whether the model can be asked to skip thinking entirely. */
    canDisableThinking: boolean;
    /** One-line note shown beside the model in the settings card. */
    description: string;
}
/**
 * Models the gateway serves but does not publish in `/v3/config`.
 *
 * The catalog is a published list, not the served one: measured on the
 * international backend, `gpt-6-sol`, `gpt-6-luna` and `gemini-3.8-flash` all
 * answer a normal streaming completion with 200 while being absent from
 * `/v3/config` entirely, and a reachable gateway *replaces* the shipped table
 * with that list. Without these rows the picker would simply never show them, so
 * they are declared here and merged into a live catalog too
 * ({@link withUnpublishedModels}) rather than living in the fallback alone.
 *
 * What each row records, and how it was established, differs by field:
 *
 * - **Existence, the reasoning ladder, image support** were measured against the
 *   live endpoint, not inferred from the name. A rejected level answers 400
 *   `code 11133` with `extError` `400002`; `gpt-6-sol` takes exactly the ladder
 *   `gpt-6-astra` publishes (`minimal` refused, `low`/`medium`/`high`/`xhigh`/
 *   `max` accepted) and both accept a 1x1 PNG.
 * - **Context window, output cap and `canDisableThinking` are inherited from the
 *   published sibling in the same family** — `gpt-6-astra` for `gpt-6-sol` and
 *   `gpt-6-luna`, `gemini-3.5-flash` for `gemini-3.8-flash`. They are marked
 *   here rather than measured because the gateway publishes nothing for these
 *   ids and offers no cheap way to read the real figure: it accepts a
 *   `max_tokens` larger than any published window (even for `gpt-6-astra`, whose
 *   own catalog caps at 128000), so the number is neither enforced nor
 *   discoverable from the request side.
 *
 * Every field stays overridable per model from the settings card, and an
 * inherited window errs low rather than high: over-declaring overflows the
 * gateway mid-session, while under-declaring only compresses earlier.
 */
export declare const UNPUBLISHED_MODELS: readonly WorkBuddyModelEntry[];
/**
 * Offline fallback catalog, transcribed from a live `/v3/config` read.
 *
 * Used when the gateway cannot be reached (first run before sign-in, or a
 * network failure); a reachable gateway always wins.
 */
export declare const FALLBACK_MODELS: readonly WorkBuddyModelEntry[];
/**
 * Models the picker offers on a fresh install.
 *
 * Deliberately short: the catalog holds every id the subscription serves, and
 * the picker is far more usable with the handful of general-purpose models. The
 * card lets a user add the rest, and a first-run default expands to everything
 * the account's region can actually call.
 */
export declare const DEFAULT_VISIBLE_MODEL_IDS: readonly string[];
/** Every id the fallback knows, in declaration order. */
export declare const WORKBUDDY_MODEL_IDS: readonly string[];
/**
 * Add the served-but-unpublished models to a live `/v3/config` catalog.
 *
 * A reachable gateway replaces the shipped table with the list it publishes, so
 * a model it serves without listing ({@link UNPUBLISHED_MODELS}) would drop out
 * of the picker the moment the catalog loads. Merging here keeps it offered.
 *
 * A published entry always wins: the gateway is the authority on anything it
 * does describe, so these rows only fill ids the payload is silent about.
 */
export declare function withUnpublishedModels(catalog: readonly WorkBuddyModelEntry[], region: WorkBuddyRegion): WorkBuddyModelEntry[];
/**
 * Resolve one entry from a catalog.
 *
 * An unknown id resolves to a synthetic text-only entry rather than the first
 * catalog row: reporting a real model's capabilities for an id it does not
 * describe would mis-declare image support and route a request to a 400.
 */
export declare function resolveWorkBuddyModel(id: string, catalog?: readonly WorkBuddyModelEntry[]): WorkBuddyModelEntry;
/** Whether one catalog knows this exact id. */
export declare function isWorkBuddyModelId(id: unknown, catalog?: readonly WorkBuddyModelEntry[]): id is string;
/** The vendor family one model belongs to. */
export declare function workBuddyModelVendor(id: string): string;
/**
 * Group a list so every vendor's models sit together.
 *
 * Families appear in the order their first model does — the catalog decides
 * which vendor leads, not this function — and each family is ordered newest
 * generation first.
 */
export declare function groupWorkBuddyModelsByVendor<T extends {
    id: string;
}>(models: readonly T[]): T[];
/**
 * Models an account in `region` can actually call, grouped by vendor.
 *
 * Grouped here rather than in the settings card because this is also what the
 * request path resolves against: one ordering rule, so the picker and the
 * adapter can never disagree about which models a region offers.
 */
export declare function modelsForRegion(region: WorkBuddyRegion, catalog?: readonly WorkBuddyModelEntry[]): WorkBuddyModelEntry[];
/** Whether one model accepts image input. */
export declare function workBuddyModelSupportsImage(id: string, catalog?: readonly WorkBuddyModelEntry[]): boolean;
/**
 * Reasoning ladder one model accepts, plus `none` when its trace can be turned off.
 *
 * The ladder in the catalog is what the model ACCEPTS, so `none` never appears
 * in it; `canDisableThinking` is the separate statement that switching thinking
 * off is allowed, and this is the single place that turns it into the one level
 * the picker can offer. Callers that need the ladder alone read the entry.
 */
export declare function workBuddyReasoningEfforts(id: string, catalog?: readonly WorkBuddyModelEntry[]): readonly string[];
/**
 * Consumption multiplier per region one model publishes.
 *
 * Read through {@link resolveWorkBuddyModel} like the other accessors, so an id
 * no catalog describes reports `{}` — "no rate published" rather than a rate
 * of zero.
 */
export declare function workBuddyModelCredits(id: string, catalog?: readonly WorkBuddyModelEntry[]): WorkBuddyModelCredits;
/** Output cap requested when the caller omits one. */
export declare function maxOutputTokensFor(id: string, catalog?: readonly WorkBuddyModelEntry[]): number;
/** Context window assumed when no override is saved. */
export declare function defaultContextWindowFor(id: string, catalog?: readonly WorkBuddyModelEntry[]): number;
//# sourceMappingURL=model-catalog.d.ts.map