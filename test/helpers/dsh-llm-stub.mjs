/**
 * Minimal stand-in for `@deepseek-ai/dsh-llm` in tests.
 *
 * `vertex.test.mjs` exercises the real `registerWorkBuddyVertex` wiring, so the
 * modules it pulls in (`vertex-integration.js`, `adapter.js`, `wire.js`) must
 * resolve the harness package. It only exists inside a running DSH Host, not in
 * this repository's `node_modules`, so the test suite supplies this stub instead
 * of the real library.
 *
 * Only the surface those modules actually touch is defined here. Growing it is
 * deliberate: a name the production code starts importing but this file does not
 * export fails loudly at import time rather than silently weakening a test.
 */

/** Base class the production adapter extends; the tests never use its behaviour. */
export class LlmAdapter {}

/** Error carrying the harness's string code, as `vertex-integration.js` constructs it. */
export class LlmError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'LlmError';
        this.code = code;
    }
}

/** User message factory; the shape is what `buildGeminiRequest` reads. */
export function createUserMessage({ content }) {
    return { role: 'user', content };
}

/** Attribution headers are opaque to these tests; an empty set keeps requests valid. */
export function attributionHeaders() {
    return {};
}

export const CONTEXT_WINDOW_EXCEEDED_CODE = 'CONTEXT_WINDOW_EXCEEDED';
export const EMPTY_RESPONSE_CODE = 'EMPTY_RESPONSE';
export const QUOTA_EXCEEDED_CODE = 'QUOTA_EXCEEDED';
