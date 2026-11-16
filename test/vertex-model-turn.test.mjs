import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const llmStub = 'data:text/javascript,export const CONTEXT_WINDOW_EXCEEDED_CODE="CONTEXT_WINDOW_EXCEEDED", EMPTY_RESPONSE_CODE="EMPTY_RESPONSE", QUOTA_EXCEEDED_CODE="QUOTA_EXCEEDED", attributionHeaders=()=>({});';
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        return specifier === '@deepseek-ai/dsh-llm'
            ? { url: llmStub, shortCircuit: true }
            : nextResolve(specifier, context);
    },
});
const { sanitizeVertexContents, CONTINUATION_TEXT } = await import('../vendor/vertex/lib/wire-shared.js');
const { GoogleVertexGeminiAdapter } = await import('../vendor/vertex/lib/gemini_adapter.js');
const { buildGeminiRequest } = await import('../vendor/vertex/lib/gemini.js');
hooks.deregister();

const text = value => ({ role: 'user', parts: [{ text: value }] });
const model = value => ({ role: 'model', parts: [{ text: value }] });
const call = name => ({ role: 'model', parts: [{ functionCall: { name, args: {} } }] });
const response = name => ({ role: 'user', parts: [{ functionResponse: { name, response: { result: 'ok' } } }] });

/**
 * Vertex refuses `streamGenerateContent` with
 * `400 Requests ending with a model turn are not supported`. The guard must fix
 * both illegal boundaries and leave a valid body untouched.
 */
test('a body ending on a model turn gains a continuation user turn', () => {
    const repaired = sanitizeVertexContents([text('hi'), model('done')], CONTINUATION_TEXT);
    assert.equal(repaired.at(-1).role, 'user');
    assert.deepEqual(repaired.at(-1).parts, [{ text: CONTINUATION_TEXT }]);
    assert.equal(repaired.length, 3);
});

test('a body opening on a model turn gains a leading user turn', () => {
    const repaired = sanitizeVertexContents([model('orphan'), text('hi')], CONTINUATION_TEXT);
    assert.equal(repaired[0].role, 'user');
    assert.deepEqual(repaired[0].parts, [{ text: CONTINUATION_TEXT }]);
});

test('empty turns are dropped and repeated roles are merged', () => {
    const repaired = sanitizeVertexContents([
        text('a'),
        { role: 'user', parts: [] },
        text('b'),
        model('c'),
    ], CONTINUATION_TEXT);
    // empty turn dropped, the two user turns merged, then the trailing model turn
    // still gets the continuation user turn appended.
    assert.equal(repaired.length, 3);
    assert.deepEqual(repaired[0].parts.map(p => p.text), ['a', 'b']);
    assert.equal(repaired[1].role, 'model');
    assert.equal(repaired[2].role, 'user');
});

test('a valid body is returned untouched, by identity', () => {
    const contents = [text('hi'), model('done'), text('go on')];
    assert.equal(sanitizeVertexContents(contents, CONTINUATION_TEXT), contents);
});

test('a tool-result tail is already valid and must not be rewritten', () => {
    const contents = [text('hi'), call('read'), response('read')];
    assert.equal(sanitizeVertexContents(contents, CONTINUATION_TEXT), contents);
    assert.equal(contents.at(-1).role, 'user');
});

test('a tool-result turn and a subsequent user text turn are never merged into one turn', () => {
    const req = buildGeminiRequest({
        model: 'gemini-4-argon',
        messages: [
            { role: 'user', content: [{ type: 'text', text: 'start' }] },
            { role: 'assistant', content: [{ type: 'tool-call', id: 'c1', name: 'edit', arguments: '{}' }], source: { kind: 'model', provider: 'google-vertex-gemini', model: 'gemini-4-argon' } },
            { role: 'tool', toolCallId: 'c1', content: [{ type: 'text', text: 'updated' }] },
            { role: 'user', content: [{ type: 'text', text: 'Agent subagent sent a message: done' }] },
        ],
        tools: [],
    }, { maxTokens: 64 });
    const sanitized = sanitizeVertexContents(req.contents, CONTINUATION_TEXT);
    assert.equal(sanitized.length, 4);
    assert.equal('functionResponse' in sanitized[2].parts[0], true);
    assert.equal(sanitized[2].parts.length, 1);
    assert.deepEqual(sanitized[3].parts, [{ text: 'Agent subagent sent a message: done' }]);
});

test('a mixed functionResponse+text user turn is split into two distinct user turns', () => {
    const mixed = [
        text('hi'),
        call('read'),
        { role: 'user', parts: [{ functionResponse: { name: 'read', response: { result: 'ok' } } }, { text: 'steer' }] },
    ];
    const repaired = sanitizeVertexContents(mixed, CONTINUATION_TEXT);
    assert.equal(repaired.length, 4);
    assert.equal('functionResponse' in repaired[2].parts[0], true);
    assert.deepEqual(repaired[3].parts, [{ text: 'steer' }]);
});

test('the continuation text matches the wording Google\'s own CLI sends', () => {
    assert.equal(CONTINUATION_TEXT, 'Please continue.');
});

/**
 * The guard is only useful at the send boundary. This drives the real adapter
 * and inspects the bytes it would have posted: an upstream projection handed it
 * a model-ending history, and the body must still leave with a user tail.
 */
test('the adapter repairs a model-ending body before it reaches the wire', async () => {
    let posted;
    const fetchFn = async (_url, init) => {
        posted = JSON.parse(init.body);
        return new Response('data: {"candidates":[{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}\n\n', {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
        });
    };
    const adapter = new GoogleVertexGeminiAdapter({
        serviceAccount: { client_email: 'x', private_key: 'x', token_uri: 'x' },
        project: 'p', location: 'global',
        models: [{ id: 'gemini-4-argon', name: 'Gemini 4 Argon' }],
        maxTokens: 4096, streamIdleTimeoutMs: 20000,
    }, { fetch: fetchFn, tokens: { get: async () => 'token' } });

    // A history the harness handed down after its own projection: the trailing
    // user turn carried only an image, so nothing textual survived upstream.
    // `toolResultParts` then projects that tool message to zero parts, which is
    // exactly the shape that leaves the body ending on the model turn.
    const messages = [
        { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        { role: 'assistant', content: [{ type: 'tool-call', id: 'call_1', name: 'read', arguments: '{}' }], source: { kind: 'model', provider: 'google-vertex-gemini', model: 'gemini-4-argon' } },
        { role: 'tool', toolCallId: 'call_1', content: [{ type: 'image', attachment: { attachmentId: 'sha256:abc' } }] },
    ];
    for await (const _ of adapter.stream({ provider: 'google-vertex-gemini', model: 'gemini-4-argon', messages, tools: [], maxTokens: 64 })) {
        // drain
    }
    assert.ok(posted, 'the adapter reached the fetch call');
    assert.notEqual(posted.contents.at(-1).role, 'model', 'a model-ending body must never reach Vertex');
    assert.equal(posted.contents.at(-1).role, 'user');
});
