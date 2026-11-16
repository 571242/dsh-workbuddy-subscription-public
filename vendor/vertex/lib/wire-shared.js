/**
 * Helpers the two publisher wire translators (Anthropic and Gemini) share:
 * tool-argument parsing, system-text collection, and usage-counter merging.
 *
 * @module dsh-google-vertex/wire-shared
 */
/**
 * Trailing user text used when a `contents` array would otherwise end on a
 * model turn. Google's own CLI sends the same wording for the same 400
 * (gemini-cli PR #29527).
 */
export const CONTINUATION_TEXT = 'Please continue.';
/**
 * Final `contents` guard, applied to the body as it is about to leave.
 *
 * Gemini refuses `streamGenerateContent` with
 * `400 Requests ending with a model turn are not supported`. The turn shape is
 * never wrong when this adapter builds it, but the request that actually
 * arrives is not necessarily the one the builder saw: the harness runs
 * `llm/stream` as a waterfall, and any listener above may rewrite `messages`,
 * a provider switch adds `developer/message` tool deltas, and a retry replays a
 * history whose tail can differ from the first attempt. Each of those can leave
 * the last surviving turn as `model`, and there is no way to know from inside
 * the builder.
 *
 * So the check lives at the boundary, on the finished body, and repairs the two
 * shapes Google's own CLI repairs: a body that opens on a model turn (Vertex
 * wants the dialogue to start with the user) and one that ends on a model turn
 * (the continuation case). Anything else is returned untouched, so a
 * well-formed request is never rewritten.
 *
 * @param contents - the built `contents` array, in dialogue order.
 * @param continuationText - text for the trailing user turn.
 * @returns the same array when already valid, else a repaired copy.
 */
export function sanitizeVertexContents(contents, continuationText) {
    if (!Array.isArray(contents))
        return contents;
    const cleaned = [];
    const hasFnRes = parts => parts.some(p => p && typeof p === 'object' && 'functionResponse' in p);
    const hasNonFnRes = parts => parts.some(p => p && typeof p === 'object' && !('functionResponse' in p));
    const pushTurn = (role, parts) => {
        if (parts.length === 0)
            return;
        const last = cleaned.at(-1);
        // Vertex wants user/model alternation, EXCEPT a `functionResponse` user turn
        // must never be merged with an ordinary text user turn (Vertex rejects a
        // trailing turn that mixes `functionResponse` + `text` with HTTP 400).
        if (last !== undefined && last.role === role && (role === 'model' || hasFnRes(last.parts) === hasFnRes(parts)))
            last.parts.push(...parts);
        else
            cleaned.push({ role, parts: [...parts] });
    };
    for (const msg of contents) {
        // An empty turn carries no signal and Vertex rejects it.
        if (!msg || !Array.isArray(msg.parts) || msg.parts.length === 0)
            continue;
        const role = msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user';
        if (role === 'user' && hasFnRes(msg.parts) && hasNonFnRes(msg.parts)) {
            pushTurn('user', msg.parts.filter(p => p && typeof p === 'object' && 'functionResponse' in p));
            pushTurn('user', msg.parts.filter(p => p && typeof p === 'object' && !('functionResponse' in p)));
        }
        else {
            pushTurn(role, msg.parts);
        }
    }
    if (cleaned.length === 0)
        return contents;
    // The dialogue must open on the user.
    if (cleaned[0].role === 'model')
        cleaned.unshift({ role: 'user', parts: [{ text: continuationText }] });
    // ...and must not end on the model. This is the shape that 400s.
    if (cleaned.at(-1).role === 'model')
        cleaned.push({ role: 'user', parts: [{ text: continuationText }] });
    const unchanged = cleaned.length === contents.length
        && cleaned.every((turn, index) => turn.role === contents[index].role
            && turn.parts.length === contents[index].parts.length
            && turn.parts.every((part, p) => part === contents[index].parts[p]));
    return unchanged ? contents : cleaned;
}
/** Parse a model-produced arguments string into the object the provider requires. */
export function toolInput(argumentsJson) {
    try {
        const parsed = JSON.parse(argumentsJson);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        // The harness assembles these strings from the model's own deltas; an
        // unparseable one is a provider-side truncation, and an empty object keeps
        // the turn revisable instead of failing the whole request.
        return {};
    }
}
/** System-role text the request carries, in assembly order. */
export function systemParts(options) {
    const parts = [];
    if (options.system !== undefined && options.system.length > 0)
        parts.push(options.system);
    for (const message of options.messages) {
        if (message.role !== 'system' && message.role !== 'developer')
            continue;
        for (const block of message.content) {
            if (block.type === 'text' && typeof block.text === 'string' && block.text.length > 0)
                parts.push(block.text);
        }
    }
    return parts;
}
/** A usage counter, ignoring anything the provider sends that is not a number. */
function count(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
/**
 * Read the named counters out of one usage payload, keeping only the ones the
 * provider actually sent.
 * @param raw - the payload's usage member.
 * @param names - the counter names this route reads.
 * @returns only the present, well-formed counters.
 */
export function takeCounters(raw, names) {
    const merged = {};
    if (typeof raw !== 'object' || raw === null)
        return merged;
    const usage = raw;
    for (const name of names) {
        const value = count(usage[name]);
        if (value !== undefined)
            merged[name] = value;
    }
    return merged;
}
