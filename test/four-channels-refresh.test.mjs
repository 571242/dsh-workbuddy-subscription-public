import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateKeyPairSync, verify } from 'node:crypto';
import { registerHooks } from 'node:module';
import { Readable } from 'node:stream';

const llmStub = new URL('./helpers/dsh-llm-stub.mjs', import.meta.url).href;
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        return specifier === '@deepseek-ai/dsh-llm'
            ? { url: llmStub, shortCircuit: true }
            : nextResolve(specifier, context);
    },
});
const { registerWorkBuddyVertex, VERTEX_PREFIX } = await import('../lib/vertex-integration.js');
hooks.deregister();

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = {
    type: 'service_account',
    project_id: 'vertex-test-123',
    client_email: 'test@vertex-test-123.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    token_uri: 'https://oauth2.googleapis.com/token',
};

test('Vertex catalog/refresh discovers dynamic Gemini models and settings toggle updates enabled state', async () => {
    let saved = null;
    const routes = new Map();
    const registered = new Map();
    let emitted = 0;

    const integration = registerWorkBuddyVertex(
        {
            webServer: {
                register: route => {
                    routes.set(route.path, route.handler);
                    return () => routes.delete(route.path);
                },
            },
            emit: event => {
                if (event === 'llm/adapters-updated') emitted++;
            },
        },
        {
            store: {
                load: async () => saved,
                save: async next => {
                    saved = next;
                },
            },
            fetchFn: async (url, init) => {
                if (String(url).includes('oauth2.googleapis.com')) {
                    const jwt = new URLSearchParams(init.body).get('assertion');
                    const [header, claims, signature] = jwt.split('.');
                    assert(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url')));
                    return Response.json({ access_token: 'test-token', expires_in: 3600 });
                }
                if (String(url).includes('publishers/google/models')) {
                    return Response.json({
                        publisherModels: [
                            { name: 'publishers/google/models/gemini-3.5-flash' },
                            { name: 'publishers/google/models/gemini-4-ultra-preview' },
                        ],
                    });
                }
                return Response.json({});
            },
            claimProviderRoute: (_ctx, options) => {
                registered.set(options.providerId, options.adapter);
                return { serving: () => true, conflict: () => null, dispose: () => registered.delete(options.providerId) };
            },
            isSameOriginMutation: request => request.headers.origin === 'http://localhost',
            readRequestJson: async request => {
                let body = '';
                for await (const part of request) body += part;
                return JSON.parse(body || '{}');
            },
        },
    );

    await integration.ready;
    await integration.importAccount({ json: JSON.stringify(account) });
    assert.equal(integration.status().enabled, true);

    // Refresh catalog via route
    let code = 0;
    let payload = null;
    const reqRefresh = Readable.from(['{}']);
    Object.assign(reqRefresh, {
        url: `${VERTEX_PREFIX}/catalog/refresh`,
        method: 'POST',
        headers: { origin: 'http://localhost' },
    });
    await routes.get(VERTEX_PREFIX)(reqRefresh, {
        writeHead: c => { code = c; },
        end: b => { payload = JSON.parse(b); },
    });
    assert.equal(code, 200);
    assert.equal(payload.ok, true);
    assert(payload.value.models.includes('gemini-4-ultra-preview'));

    // Disable Vertex channel via settings route
    const reqToggle = Readable.from([JSON.stringify({ enabled: false })]);
    Object.assign(reqToggle, {
        url: `${VERTEX_PREFIX}/settings`,
        method: 'POST',
        headers: { origin: 'http://localhost' },
    });
    await routes.get(VERTEX_PREFIX)(reqToggle, {
        writeHead: c => { code = c; },
        end: b => { payload = JSON.parse(b); },
    });
    assert.equal(code, 200);
    assert.equal(payload.value.enabled, false);
    assert.deepEqual(await registered.get('google-vertex-gemini').listModels('google-vertex-gemini'), []);
    assert(emitted >= 2);

    integration.dispose();
});

test('Host and Client bundles wire all 4 channels and manual catalog refresh endpoints', () => {
    const indexBundle = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8');
    const clientBundle = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

    // 1. All 4 channels in LOCAL_EXCLUSIVE_PROVIDER_ROUTES
    for (const providerId of [
        'codex-chatgpt',
        'antigravity',
        'workbuddy-subscription',
        'google-vertex-gemini',
        'google-vertex-anthropic',
    ]) {
        assert(indexBundle.includes(`"${providerId}"`), `index.js missing ${providerId}`);
    }

    // 2. Backported 0.52.0 improvements present in index.js
    assert(indexBundle.includes('"gpt-6.1-terra"'), 'index.js missing gpt-6.1-terra');
    assert(indexBundle.includes('function toolCallIdOf('), 'index.js missing 0.48.4 toolCallIdOf fix');
    assert(indexBundle.includes('function isDestroyedClientError('), 'index.js missing 0.44.0 proxy destroyed-client recovery');
    assert(indexBundle.includes('function isPreConnectionFailure$2('), 'index.js missing 0.46.1 Codex pre-connection retry');
    assert(indexBundle.includes('Antigravity stream failed:'), 'index.js missing 0.40.2 Antigravity streamFailure');
    assert(indexBundle.includes('const DESKTOP_VERSION_CN = "5.9.3"'), 'index.js missing 0.47.0 WorkBuddy 5.9.3 UA');

    // 3. Catalog refresh routes for all 4 channels
    assert(indexBundle.includes('${ROUTE_PREFIX$5}/catalog/refresh'), 'index.js missing ChatGPT catalog/refresh route');
    assert(indexBundle.includes('path === "quota" || path === "catalog/refresh"'), 'index.js missing Antigravity catalog/refresh route');
    assert(indexBundle.includes('if (path === "catalog/refresh")'), 'index.js missing WorkBuddy catalog/refresh route');

    // 4. Client 4-channel Hub & refreshCatalog buttons
    assert(clientBundle.includes('name: "ChatGPT"'));
    assert(clientBundle.includes('name: "Antigravity"'));
    assert(clientBundle.includes('name: "WorkBuddy 订阅"'));
    assert(clientBundle.includes('name: "Vertex AI 服务账号"'));
    assert(!clientBundle.includes('id: "command-code",\n\t\t\t\tname: "Command Code"'), 'client.js should not list Command Code in HUB_PROVIDERS');
    assert(/refreshCatalog\(\)\s*\{\s*return post\$4\(`\$\{ROUTE_PREFIX\}\/catalog\/refresh`,\s*\{\}\);\s*\}/.test(clientBundle), 'client.js missing ChatGPT refreshCatalog API');
    assert(clientBundle.includes('api$13.request("/catalog/refresh"'), 'client.js missing Antigravity refreshCatalog call');
    assert(clientBundle.includes('vertexApi.request("/catalog/refresh"'), 'client.js missing Vertex refreshCatalog call');
});
