import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { registerHooks } from 'node:module';
import { Readable } from 'node:stream';

// `@deepseek-ai/dsh-llm` ships inside the DSH Host, not this repository, so the
// suite substitutes the stub for every module that imports it.
const llmStub = new URL('./helpers/dsh-llm-stub.mjs', import.meta.url).href;
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        return specifier === '@deepseek-ai/dsh-llm'
            ? { url: llmStub, shortCircuit: true }
            : nextResolve(specifier, context);
    },
});
const { parseVertexDocument, registerWorkBuddyVertex, VERTEX_ROUTES } = await import('../lib/vertex-integration.js');
hooks.deregister();
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { type: 'service_account', project_id: 'vertex-test-123', client_email: 'test@vertex-test-123.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' };
function fixture({ saved = null, saveError = false } = {}) {
    const registered = new Map();
    let handler;
    let writes = 0;
    let calls = 0;
    const integration = registerWorkBuddyVertex({ webServer: { register: route => { handler = route.handler; return () => {}; } } }, {
        store: { load: async () => saved, save: async next => { if (saveError) throw Error('save failed'); saved = next; writes++; } },
        fetchFn: async (url, init) => {
            calls++;
            if (String(url).includes('oauth2.googleapis.com')) {
                const jwt = new URLSearchParams(init.body).get('assertion');
                const [header, claims, signature] = jwt.split('.');
                assert(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url')));
                assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).iss, account.client_email);
                return Response.json({ access_token: 'test-token', expires_in: 3600 });
            }
            if (String(url).includes('streamGenerateContent')) {
                assert.equal(init.headers.authorization, 'Bearer test-token');
                const body = JSON.parse(init.body);
                assert.equal(body.contents[0].parts[0].text, 'Reply with OK only.');
                return new Response('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }], role: 'model' }, finishReason: 'STOP' }] }) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
            }
            return Response.json({ publisherModels: [] });
        },
        claimProviderRoute: (_ctx, options) => { registered.set(options.providerId, options.adapter); return { serving: () => true, conflict: () => null, dispose: () => registered.delete(options.providerId) }; },
        isSameOriginMutation: request => request.headers.origin === 'http://localhost',
        readRequestJson: async request => { let body = ''; for await (const part of request) body += part; return JSON.parse(body || '{}'); },
    });
    return { integration, registered, writes: () => writes, calls: () => calls, handler: () => handler };
}
test('rejects malformed account, region, project and non-Google token endpoint', () => {
    assert.throws(() => parseVertexDocument({ account: { ...account, type: 'authorized_user' } }));
    assert.throws(() => parseVertexDocument({ account: { ...account, token_uri: 'https://evil.test/token' } }));
    assert.throws(() => parseVertexDocument({ account, location: 'https://evil.test' }));
    assert.throws(() => parseVertexDocument({ account, project: '../elsewhere' }));
    assert.equal(parseVertexDocument({ account }).location, 'global');
});
test('import activates both routes, status never exposes key, stream and JWT work', async () => {
    const f = fixture();
    await f.integration.ready;
    assert.deepEqual(await f.registered.get(VERTEX_ROUTES[0]).listModels(VERTEX_ROUTES[0]), []);
    await f.integration.importAccount({ json: JSON.stringify(account) });
    assert.equal(f.writes(), 1);
    assert.equal(f.integration.status().configured, true);
    assert(!JSON.stringify(f.integration.status()).includes('PRIVATE KEY'));
    assert((await f.registered.get(VERTEX_ROUTES[1]).listModels(VERTEX_ROUTES[1])).length > 0);
    assert.match((await f.integration.test()).message, /OK/);
    assert.equal(f.calls(), 3);
    f.integration.dispose();
    assert.equal(f.registered.size, 0);
});
test('failed validation or encrypted save does not replace an existing account', async () => {
    const saved = parseVertexDocument({ account });
    const f = fixture({ saved, saveError: true });
    await f.integration.ready;
    await assert.rejects(f.integration.importAccount({ json: '{broken' }));
    await assert.rejects(f.integration.importAccount({ json: JSON.stringify({ ...account, project_id: 'different-456' }) }), /save failed/);
    assert.equal(f.integration.status().project, account.project_id);
    assert.equal(f.writes(), 0);
    f.integration.dispose();
});
test('cross-origin import is rejected before reading credentials', async () => {
    const f = fixture();
    let status;
    let payload;
    const request = Readable.from([JSON.stringify({ json: JSON.stringify(account) })]);
    Object.assign(request, { url: '/workbuddy/vertex/api/import', method: 'POST', headers: { origin: 'https://evil.test' } });
    await f.handler()(request, { writeHead: code => { status = code; }, end: body => { payload = JSON.parse(body); } });
    assert.equal(status, 403);
    assert.equal(payload.ok, false);
    assert.equal(f.writes(), 0);
    f.integration.dispose();
});
