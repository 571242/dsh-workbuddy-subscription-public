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
const { buildGeminiRequest } = await import(modulePath);
hooks.deregister();

test('Vertex Gemini preserves tool JSON Schema including const and empty enum', () => {
    const schema = {
        type: 'object',
        properties: {
            action: { type: 'string', const: 'reset' },
            permission: { oneOf: [{ type: 'string', enum: [''] }, { type: 'null' }] },
        },
        required: ['action'],
        additionalProperties: false,
    };
    const request = buildGeminiRequest({
        model: 'gemini-3.5-flash',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'test' }] }],
        tools: [{ name: 'reset', description: 'Reset settings', parameters: schema }],
    }, { maxTokens: 128 });
    const declaration = request.tools[0].functionDeclarations[0];
    assert.deepEqual(declaration.parametersJsonSchema, schema);
    assert.equal('parameters' in declaration, false);
});
