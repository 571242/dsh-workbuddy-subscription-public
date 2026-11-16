import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const llmStub = 'data:text/javascript,export const CONTEXT_WINDOW_EXCEEDED_CODE="CONTEXT_WINDOW_EXCEEDED", EMPTY_RESPONSE_CODE="EMPTY_RESPONSE", QUOTA_EXCEEDED_CODE="QUOTA_EXCEEDED";';
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        return specifier === '@deepseek-ai/dsh-llm'
            ? { url: llmStub, shortCircuit: true }
            : nextResolve(specifier, context);
    },
});
const modulePath = process.env.VERTEX_GEMINI_MODULE ?? '../vendor/vertex/lib/gemini.js';
const { buildGeminiRequest, SKIP_THOUGHT_SIGNATURE_VALIDATOR } = await import(modulePath);
hooks.deregister();

const CONFIG = { maxTokens: 4096 };
const TOOL_CALL = { type: 'tool-call', id: 'call_abc', name: 'read', arguments: '{"file_path":"a.txt"}' };

/** One assistant message carrying a tool call, as the harness records it. */
function assistant({ provider, model, replayState }) {
    return {
        role: 'assistant',
        content: [{ ...TOOL_CALL }],
        source: { kind: 'model', provider, model, ...(replayState === undefined ? {} : { replayState }) },
    };
}

/** The `functionCall` parts of the built request, in order. */
function functionCallParts(request) {
    return request.contents.flatMap(turn => turn.parts).filter(part => part.functionCall !== undefined);
}

test('a cross-model tool call is replayed with the documented placeholder signature', () => {
    // A call another provider made: no signature exists for this Vertex model.
    const request = buildGeminiRequest({
        model: 'gemini-4-argon',
        messages: [
            { role: 'user', content: [{ type: 'text', text: 'continue' }] },
            assistant({ provider: 'codex-chatgpt', model: 'gpt-6.1-terra' }),
            { role: 'tool', toolCallId: 'call_abc', content: [{ type: 'text', text: 'file body' }] },
        ],
        tools: [],
    }, CONFIG);
    const [call] = functionCallParts(request);
    assert.equal(call.functionCall.name, 'read');
    assert.equal(call.thoughtSignature, SKIP_THOUGHT_SIGNATURE_VALIDATOR);
    assert.equal(SKIP_THOUGHT_SIGNATURE_VALIDATOR, 'skip_thought_signature_validator');
});

test('a tool call with no replay envelope still gets the placeholder', () => {
    const request = buildGeminiRequest({
        model: 'gemini-4-argon',
        messages: [assistant({ provider: 'google-vertex-gemini', model: 'gemini-4-argon' })],
        tools: [],
    }, CONFIG);
    assert.equal(functionCallParts(request)[0].thoughtSignature, SKIP_THOUGHT_SIGNATURE_VALIDATOR);
});

test('the model\'s own signature is echoed verbatim, never replaced by the placeholder', () => {
    const signature = 'CvcQAdHtim/pKv/c0ClPFkYA==';
    const request = buildGeminiRequest({
        model: 'gemini-4-argon',
        messages: [assistant({
            provider: 'google-vertex-gemini',
            model: 'gemini-4-argon',
            replayState: {
                response: { kind: 'google-vertex-gemini', version: 1, model: 'gemini-4-argon' },
                blocks: [{ type: 'tool-call', thoughtSignature: signature }],
            },
        })],
        tools: [],
    }, CONFIG);
    assert.equal(functionCallParts(request)[0].thoughtSignature, signature);
});

test('a signature from another model is not echoed, so the call takes the placeholder', () => {
    const request = buildGeminiRequest({
        model: 'gemini-4-argon',
        messages: [assistant({
            provider: 'google-vertex-gemini',
            model: 'gemini-3.5-flash',
            replayState: {
                response: { kind: 'google-vertex-gemini', version: 1, model: 'gemini-3.5-flash' },
                blocks: [{ type: 'tool-call', thoughtSignature: 'CvcQAdHtim/pKv/c0ClPFkYA==' }],
            },
        })],
        tools: [],
    }, CONFIG);
    assert.equal(functionCallParts(request)[0].thoughtSignature, SKIP_THOUGHT_SIGNATURE_VALIDATOR);
});

test('text parts never carry a fabricated signature', () => {
    const request = buildGeminiRequest({
        model: 'gemini-4-argon',
        messages: [assistant({ provider: 'codex-chatgpt', model: 'gpt-6.1-terra' })],
        tools: [],
    }, CONFIG);
    for (const part of request.contents.flatMap(turn => turn.parts)) {
        if (part.functionCall === undefined) assert.equal('thoughtSignature' in part, false);
    }
});
