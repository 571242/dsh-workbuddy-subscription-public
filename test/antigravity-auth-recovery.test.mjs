import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import dgram from 'node:dgram';
import { Readable } from 'node:stream';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

// Run with ANTIGRAVITY_TEST_BUNDLE=/absolute/path/to/lib/index.js to test an
// installed candidate. Only host services are stubbed; the bundle is imported
// whole, with its real adapter, pool, OAuth and image/quota implementations.
const candidate = process.env.ANTIGRAVITY_TEST_BUNDLE
  ? pathToFileURL(path.resolve(process.env.ANTIGRAVITY_TEST_BUNDLE)).href
  : new URL('../lib/index.js', import.meta.url).href;
const forbidden = [];
globalThis.__agRecoveryForbidden = forbidden;
const original = {
  fetch: globalThis.fetch,
  connect: net.Socket.prototype.connect,
  send: dgram.Socket.prototype.send,
  endpoint: process.env.DSH_ANTIGRAVITY_ENDPOINT,
};
function deny(...args) {
  forbidden.push('unexpected real transport');
  throw new Error('offline test forbids network access');
}
globalThis.fetch = deny;
net.Socket.prototype.connect = deny;
dgram.Socket.prototype.send = deny;
process.env.DSH_ANTIGRAVITY_ENDPOINT = 'https://service.test.invalid';
process.env.DSH_ANTIGRAVITY_CLIENT_ID = 'SYNTHETIC_CLIENT_ID';
process.env.DSH_ANTIGRAVITY_CLIENT_SECRET = 'SYNTHETIC_CLIENT_SECRET';

const stub = source => `data:text/javascript,${encodeURIComponent(source)}`;
const blocked = `const deny = () => { globalThis.__agRecoveryForbidden.push('bundle attempted file or process access'); throw Error('forbidden in offline test'); };`;
const stubs = {
  '@deepseek-ai/schemastery': `const schema = new Proxy(() => schema, { get: () => schema }); export default schema;`,
  '@deepseek-ai/dsh-llm': `
    export class LlmAdapter {}
    export class LlmError extends Error { constructor(message, code, options = {}) { super(message, options); this.code = code; Object.assign(this, options); } }
    export class HarnessError extends LlmError {}
    export const ProviderRequestId = x => x, ReasoningEffortId = x => x;
    export const attributionHeaders = () => ({}), createUserMessage = x => x;
    export const errorChain = e => String(e), resolveRetryPolicy = () => undefined;
    export const CONTEXT_WINDOW_EXCEEDED_CODE = 'CONTEXT_WINDOW_EXCEEDED';
    export const EMPTY_RESPONSE_CODE = 'EMPTY_RESPONSE', QUOTA_EXCEEDED_CODE = 'QUOTA_EXCEEDED';`,
  '@deepseek-ai/dsh-llm/message': `export const boundContextSummary = x => x, createUserMessage = x => x;`,
  '@deepseek-ai/dsh-web': `export class WebError extends Error {}`,
  '@deepseek-ai/dsh-settings': `export const settingsNamespace = x => x;`,
  '@deepseek-ai/dsh-tools': `export const defineTool = value => value;`,
  '@deepseek-ai/dsh-timeout': `
    export const MAX_TIMER_DELAY_MS = 2147483647;
    export const timeoutOf = () => undefined;
    export const idleWatchdog = signal => ({ signal, next: iterator => iterator.next(), pulse() {}, [Symbol.dispose]() {} });`,
  'undici': `${blocked} export const fetch = deny; export class ProxyAgent { constructor() { deny(); } }`,
  './vertex-integration.js': `export const registerWorkBuddyVertex = () => {}, parseVertexDocument = () => {};`,
  './aistudio-integration.js': `export const registerWorkBuddyAiStudio = () => {}, parseAiStudioDocument = () => {}, AI_STUDIO_PROVIDER_ID = 'offline';`,
  'node:child_process': `${blocked} export const execSync = deny, spawn = deny;`,
  'node:fs/promises': `${blocked}
    const absent = target => {
      if (typeof target !== 'string' || !/^MEMORY_ONLY_LEGACY_[0-9]+$/.test(target)) return deny();
      const error = Error('synthetic path does not exist'); error.code = 'ENOENT'; return Promise.reject(error);
    };
    export const chmod = deny, lstat = absent, mkdir = deny, open = deny, readFile = deny, rename = deny, stat = deny, unlink = absent;
    export default { chmod, lstat, mkdir, open, readFile, rename, stat, unlink };`,
  'node:fs': `${blocked} export const constants = {}; export const appendFileSync = deny, copyFileSync = deny, existsSync = deny, mkdirSync = deny, readFileSync = deny, readdirSync = deny, realpathSync = deny, rmSync = deny, statSync = deny, utimesSync = deny, writeFileSync = deny; export default new Proxy({}, {get: () => deny});`,
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === candidate && Object.hasOwn(stubs, specifier)) {
      return { url: stub(stubs[specifier]), shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (url !== candidate) return loaded;
    // Expose the unchanged route registrar so its public HTTP handlers can be tested.
    return { ...loaded, source: `${loaded.source}\nexport { registerAntigravityRoutes as __testAntigravityRoutes };` };
  },
});
let api;
try { api = await import(candidate); } finally { hooks.deregister(); }
const { startCredentialRefresh } = await import(new URL('./credential-refresh.js', candidate));

test.after(() => {
  globalThis.fetch = original.fetch;
  net.Socket.prototype.connect = original.connect;
  dgram.Socket.prototype.send = original.send;
  if (original.endpoint === undefined) delete process.env.DSH_ANTIGRAVITY_ENDPOINT;
  else process.env.DSH_ANTIGRAVITY_ENDPOINT = original.endpoint;
  delete globalThis.__agRecoveryForbidden;
  assert.deepEqual(forbidden, [], 'candidate attempted a real network, file, or child-process operation');
});

const NOW = 1_800_000_000_000;
const signal = () => new AbortController().signal;
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const credentials = (id, expires = NOW + 7_200_000) => ({
  access: `access-${id}`, access_token: `access-${id}`,
  refresh: `refresh-${id}`, refresh_token: `refresh-${id}`,
  expires, expires_at: expires, projectId: `project-${id}`, email: `${id}@example.test`,
});
const account = (id, expires, isPrimary = false) => ({
  id, alias: id, addedAt: NOW - 1, isPrimary,
  credentials: credentials(id, expires), email: `${id}@example.test`, projectId: `project-${id}`,
});
const tokenReply = (access = 'access-renewed', refresh = 'refresh-renewed') =>
  Response.json({ access_token: access, refresh_token: refresh, expires_in: 3600 });
const failure = status => Response.json({ error: { code: status, message: `synthetic ${status}` } }, { status });
const textFrame = { response: { candidates: [{ content: { parts: [{ text: 'OK' }] }, finishReason: 'STOP' }] } };
const imageFrame = { response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }] }, finishReason: 'STOP' }] } };
const sse = frame => new Response(`data: ${JSON.stringify(frame)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
const quotaPaths = ['loadCodeAssist', 'retrieveUserQuotaSummary', 'fetchAvailableModels'];
function quotaReply(method) {
  if (method === quotaPaths[0]) return Response.json({ projectId: 'project-alpha', currentTier: { name: 'Test' } });
  if (method === quotaPaths[1]) return Response.json({ groups: [{ displayName: 'Gemini', buckets: [{ displayName: 'test', remainingFraction: 0.5 }] }] });
  if (method === quotaPaths[2]) return Response.json({ models: { 'gemini-test': { displayName: 'Test model' } } });
  throw new Error(`unexpected quota method ${method}`);
}
let fixtureId = 0;
function fixture({ rows = [account('alpha', undefined, true)], legacy, model, token, directFallback = false, poolReadError = false, nullPool = false } = {}) {
  let data = nullPool ? null : { version: 1, rotationStrategy: 'sticky', activeAccountId: rows[0]?.id, accounts: structuredClone(rows) };
  let mirror = structuredClone(legacy ?? rows.find(row => row.isPrimary)?.credentials ?? null);
  let mutateAfterRead;
  let readMutations = 0, legacyReads = 0, legacyDeletes = 0, legacyReadError = false;
  const saves = [], mirrors = [], calls = [], unexpected = [];
  const backend = {
    async load() {
      if (poolReadError) throw new Error('BACKEND_SECRET_CANARY access-alpha refresh-alpha');
      const snapshot = structuredClone(data);
      if (mutateAfterRead) { mutateAfterRead(data); mutateAfterRead = undefined; readMutations++; }
      return snapshot;
    },
    async save(value) { data = structuredClone(value); saves.push(structuredClone(value)); },
  };
  const credentialBackend = {
    async load() { legacyReads++; if (legacyReadError) throw new Error('synthetic legacy read failure'); return structuredClone(mirror); },
    async save(value) { mirror = structuredClone(value); mirrors.push(structuredClone(value)); },
    async clear() { legacyDeletes++; mirror = null; },
  };
  const identity = ++fixtureId;
  const store = directFallback ? new api.FileCredentialStore(`MEMORY_ONLY_LEGACY_${identity}`, credentialBackend) : {
    async read() { legacyReads++; if (legacyReadError) throw new Error('synthetic legacy read failure'); return structuredClone(mirror); },
    async write(value) { mirror = structuredClone(value); mirrors.push(structuredClone(value)); },
    async delete() { legacyDeletes++; mirror = null; },
    path() { return 'memory-only'; },
  };
  const settings = {
    async read() { return { enabledModelIds: [], catalogModels: [], contextWindowOverrides: {} }; },
    async setCatalogModels() {},
  };
  const fetchFn = async (url, init = {}) => {
    const target = new URL(String(url));
    const params = new URLSearchParams(typeof init.body === 'string' ? init.body : '');
    if (params.get('grant_type') === 'refresh_token') {
      const call = { kind: 'token', refresh: params.get('refresh_token'), method: init.method };
      calls.push(call);
      return token ? token(call) : tokenReply();
    }
    if (target.origin === 'https://service.test.invalid' && target.pathname.startsWith('/v1internal:')) {
      const method = target.pathname.slice('/v1internal:'.length);
      const call = { kind: 'request', method, authorization: new Headers(init.headers).get('authorization'), body: JSON.parse(init.body), signal: init.signal };
      calls.push(call);
      if (model) return model(call);
      return method === 'streamGenerateContent' ? sse(call.body.requestType === 'image_gen' ? imageFrame : textFrame) : quotaReply(method);
    }
    unexpected.push(String(url));
    throw new Error(`unexpected synthetic request: ${url}`);
  };
  let failedPicks = 0, emptyReads = 0;
  const pool = directFallback ? {
    async getEffectiveAccountFor() { failedPicks++; throw new Error('synthetic empty pool'); },
    async read() { emptyReads++; return { accounts: [] }; },
  } : new api.AccountPoolStore(`MEMORY_ONLY_POOL_${identity}`, backend, store);
  const adapter = new api.AntigravityAdapter(store, settings, undefined, { fetchFn }, pool);
  return { pool, adapter, store, backend, settings, fetchFn, calls, saves, mirrors, unexpected, directFallback,
    data: () => structuredClone(data), mirror: () => structuredClone(mirror),
    failPoolReads: () => { poolReadError = true; }, failLegacyReads: () => { legacyReadError = true; },
    mutatePoolAfterNextRead: fn => { mutateAfterRead = fn; },
    legacyCounts: () => ({ reads: legacyReads, deletes: legacyDeletes }),
    readMutations: () => readMutations, fallbackCounts: () => ({ failedPicks, emptyReads }),
    requestCalls: () => calls.filter(call => call.kind === 'request'),
    tokenCalls: () => calls.filter(call => call.kind === 'token') };
}
async function chat(h) {
  const result = [];
  for await (const chunk of h.adapter.stream({
    model: 'gemini-test', messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }], signal: signal(),
  })) result.push(chunk);
  return result.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join('');
}
async function image(h) {
  const attachments = {
    imageLimits: { mediaTypes: ['image/png'], maxImageBytes: 1024, maxMessageImageBytes: 1024, maxImagesPerMessage: 1 },
    async saveImage({ data, mediaType, name }) { return { attachmentId: 'synthetic-image', data, mediaType, name, bytes: data.length, width: 1, height: 1 }; },
  };
  return api.createAntigravityImageTool(h.pool, h.store, attachments, { fetchFn: h.fetchFn })
    .execute({ prompt: 'draw' }, { signal: signal() });
}
async function quota(h) {
  api.clearCachedQuota();
  return api.fetchAccountQuota(h.store, h.settings, h.fetchFn, true, h.directFallback ? undefined : h.pool);
}
function clock(t) {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
}
function assertNoUnexpected(h) { assert.deepEqual(h.unexpected, []); }

for (const kind of ['chat', 'image']) {
  const invoke = kind === 'chat' ? chat : image;
  test(`${kind}: first request after downtime refreshes and persists the expired account`, async t => {
    clock(t);
    const h = fixture({ rows: [account('alpha', NOW + 120_000, true)] });
    t.mock.timers.setTime(NOW + 3_600_000);
    await invoke(h);
    assert.deepEqual(h.calls.map(call => call.kind), ['token', 'request']);
    assert.equal(h.tokenCalls()[0].refresh, 'refresh-alpha');
    assert.equal(h.requestCalls()[0].authorization, 'Bearer access-renewed');
    assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-renewed');
    assert.equal(h.mirror().access, 'access-renewed');
    assert.ok(h.saves.some(save => save.accounts[0].credentials.access === 'access-renewed'));
    assertNoUnexpected(h);
  });

  test(`${kind}: nonempty HTTP 401 renews the rejected account and retries once with the same body`, async t => {
    clock(t);
    let count = 0;
    const h = fixture({ rows: [account('alpha', undefined, true), account('beta')], model: call =>
      ++count === 1 ? failure(401) : sse(kind === 'chat' ? textFrame : imageFrame) });
    await invoke(h);
    assert.deepEqual(h.tokenCalls().map(call => call.refresh), ['refresh-alpha']);
    assert.deepEqual(h.requestCalls().map(call => call.authorization), ['Bearer access-alpha', 'Bearer access-renewed']);
    assert.deepEqual(h.requestCalls()[1].body, h.requestCalls()[0].body);
    assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-renewed');
    assert.equal(h.data().accounts[1].credentials.refresh, 'refresh-beta');
    assertNoUnexpected(h);
  });

  test(`${kind}: repeated 401 stops after one refresh and one retry`, async t => {
    clock(t);
    const h = fixture({ model: () => failure(401) });
    await assert.rejects(invoke(h));
    assert.equal(h.tokenCalls().length, 1);
    assert.deepEqual(h.requestCalls().map(call => call.authorization), ['Bearer access-alpha', 'Bearer access-renewed']);
    assertNoUnexpected(h);
  });

  test(`${kind}: a failed refresh does not retry the request or replace the credentials`, async t => {
    clock(t);
    const h = fixture({ model: () => failure(401), token: () => Response.json({ error: 'invalid_grant' }, { status: 400 }) });
    const before = structuredClone(h.data().accounts[0].credentials);
    await assert.rejects(invoke(h), { code: 'INVALID_GRANT' });
    assert.equal(h.tokenCalls().length, 1);
    assert.equal(h.requestCalls().length, 1);
    assert.deepEqual(h.data().accounts[0].credentials, before);
    assert.deepEqual(h.mirror(), before);
    assertNoUnexpected(h);
  });

  for (const status of [403, 429, 503]) {
    test(`${kind}: ${status} never triggers OAuth refresh`, async t => {
      clock(t);
      const h = fixture({ model: () => failure(status) });
      await assert.rejects(invoke(h));
      assert.equal(h.tokenCalls().length, 0);
      assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-alpha');
      assertNoUnexpected(h);
    });
  }
}

test('overlapping 401 responses share one refresh and both requests use the new bearer', { timeout: 3000 }, async t => {
  clock(t);
  const both = deferred(), started = deferred(), gate = deferred();
  let oldCalls = 0;
  const h = fixture({
    model: call => {
      if (call.authorization === 'Bearer access-alpha') { if (++oldCalls === 2) both.resolve(); return failure(401); }
      return sse(textFrame);
    },
    token: async () => { started.resolve(); await gate.promise; return tokenReply(); },
  });
  const requests = [chat(h), chat(h)];
  try {
    await Promise.all([both.promise, started.promise]);
    await tick();
    assert.equal(h.tokenCalls().length, 1);
    gate.resolve();
    assert.deepEqual(await Promise.all(requests), ['OK', 'OK']);
    assert.equal(h.tokenCalls().length, 1);
    assert.equal(h.requestCalls().filter(call => call.authorization === 'Bearer access-alpha').length, 2);
    assert.equal(h.requestCalls().filter(call => call.authorization === 'Bearer access-renewed').length, 2);
    assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-renewed');
    assertNoUnexpected(h);
  } finally { gate.resolve(); await Promise.allSettled(requests); }
});

test('a late 401 reuses a credential another request already renewed', { timeout: 3000 }, async t => {
  clock(t);
  const twoStarted = deferred(), late = deferred();
  let oldCalls = 0;
  const h = fixture({ model: async call => {
    if (call.authorization !== 'Bearer access-alpha') return sse(textFrame);
    oldCalls++;
    if (oldCalls === 2) { twoStarted.resolve(); await late.promise; }
    return failure(401);
  } });
  const first = chat(h), second = chat(h);
  try {
    await twoStarted.promise;
    await Promise.race([first, second]);
    assert.equal(h.tokenCalls().length, 1);
    late.resolve();
    assert.deepEqual(await Promise.all([first, second]), ['OK', 'OK']);
    assert.equal(h.tokenCalls().length, 1);
    assert.equal(h.requestCalls().filter(call => call.authorization === 'Bearer access-renewed').length, 2);
    assertNoUnexpected(h);
  } finally { late.resolve(); await Promise.allSettled([first, second]); }
});

test('changing the selected account before a 401 still refreshes the account that sent the request', { timeout: 3000 }, async t => {
  clock(t);
  const started = deferred(), gate = deferred();
  const h = fixture({ rows: [account('alpha', undefined, true), account('beta')], model: async call => {
    if (call.authorization === 'Bearer access-alpha') { started.resolve(); await gate.promise; return failure(401); }
    return sse(textFrame);
  } });
  const pending = chat(h);
  try {
    await started.promise;
    await h.pool.setPrimary('beta');
    gate.resolve();
    assert.equal(await pending, 'OK');
    assert.deepEqual(h.tokenCalls().map(call => call.refresh), ['refresh-alpha']);
    assert.deepEqual(h.requestCalls().map(call => call.authorization), ['Bearer access-alpha', 'Bearer access-renewed']);
    assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-renewed');
    assert.equal(h.data().accounts[1].credentials.refresh, 'refresh-beta');
    assert.equal(h.data().activeAccountId, 'beta');
    assertNoUnexpected(h);
  } finally { gate.resolve(); await Promise.allSettled([pending]); }
});

for (const change of ['relogin', 'delete']) {
  test(`a 401 refresh in flight cannot undo ${change}`, { timeout: 3000 }, async t => {
    clock(t);
    const started = deferred(), gate = deferred();
    const h = fixture({ rows: [account('alpha', undefined, true), account('beta')],
      model: call => call.authorization === 'Bearer access-alpha' ? failure(401) : sse(textFrame),
      token: async () => { started.resolve(); await gate.promise; return tokenReply('access-stale', 'refresh-stale'); } });
    const pending = chat(h);
    try {
      await started.promise;
      if (change === 'relogin') await h.pool.core.updateAccountCredentials('alpha', credentials('replacement'));
      else await h.pool.deleteAccount('alpha');
      gate.resolve();
      const result = await Promise.allSettled([pending]);
      const current = h.data().accounts.find(row => row.id === 'alpha');
      if (change === 'relogin') {
        assert.equal(result[0].status, 'fulfilled');
        assert.equal(current.credentials.refresh, 'refresh-replacement');
        assert.equal(h.requestCalls().at(-1).authorization, 'Bearer access-replacement');
      } else assert.equal(current, undefined);
      assert.equal(JSON.stringify(h.data()).includes('refresh-stale'), false);
      assert.equal(h.requestCalls().some(call => call.authorization === 'Bearer access-stale'), false);
      assertNoUnexpected(h);
    } finally { gate.resolve(); await Promise.allSettled([pending]); }
  });
}

test('legacy single-account pool projection recovers on 401 without reading a real store', async t => {
  clock(t);
  let requests = 0;
  const h = fixture({ rows: [], legacy: credentials('alpha'), model: () => ++requests === 1 ? failure(401) : sse(textFrame) });
  assert.equal(await chat(h), 'OK');
  assert.deepEqual(h.tokenCalls().map(call => call.refresh), ['refresh-alpha']);
  assert.deepEqual(h.requestCalls().map(call => call.authorization), ['Bearer access-alpha', 'Bearer access-renewed']);
  assert.equal(h.mirror().refresh, 'refresh-renewed');
  assertNoUnexpected(h);
});

for (const target of quotaPaths) {
  test(`quota/catalog ${target}: 401 refreshes once and continues with the new bearer`, async t => {
    clock(t);
    let rejected = false;
    const h = fixture({ model: call => {
      if (call.method === target && !rejected) { rejected = true; return failure(401); }
      return quotaReply(call.method);
    } });
    const result = await quota(h);
    assert.equal(result.projectId, 'project-alpha');
    assert.equal(result.groups[0].buckets[0].remainingFraction, 0.5);
    assert.equal(result.models[0].modelId, 'gemini-test');
    assert.deepEqual(h.tokenCalls().map(call => call.refresh), ['refresh-alpha']);
    const requests = h.requestCalls();
    const refused = requests.findIndex(call => call.method === target && call.authorization === 'Bearer access-alpha');
    assert.ok(refused >= 0);
    assert.equal(requests[refused + 1].method, target);
    assert.equal(requests[refused + 1].authorization, 'Bearer access-renewed');
    assert.equal(requests.slice(refused + 1).every(call => call.authorization === 'Bearer access-renewed'), true);
    assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-renewed');
    assertNoUnexpected(h);
  });
}

for (const status of [403, 429]) {
  test(`quota/catalog: ${status} does not refresh credentials`, async t => {
    clock(t);
    const h = fixture({ model: () => failure(status) });
    await assert.rejects(quota(h));
    assert.equal(h.tokenCalls().length, 0);
    assertNoUnexpected(h);
  });
}

// Unlike the acc_primary projection above, this pool really fails selection and
// then reports no accounts, so chat/image must use their direct legacy fallback.
for (const [kind, invoke] of [['chat', chat], ['image', image]]) {
  test(`direct legacy ${kind}: expired credential is refreshed and stored`, async t => {
    clock(t);
    const h = fixture({ rows: [], legacy: credentials('alpha', NOW + 120_000), directFallback: true });
    t.mock.timers.setTime(NOW + 3_600_000);
    await invoke(h);
    assert.deepEqual(h.fallbackCounts(), { failedPicks: 1, emptyReads: 1 });
    assert.deepEqual(h.calls.map(call => call.kind), ['token', 'request']);
    assert.equal(h.tokenCalls()[0].refresh, 'refresh-alpha');
    assert.equal(h.requestCalls()[0].authorization, 'Bearer access-renewed');
    assert.equal(h.mirror().refresh, 'refresh-renewed');
    assert.equal(h.data().accounts.length, 0);
    assert.equal(h.saves.length, 0);
    assertNoUnexpected(h);
  });

  test(`direct legacy ${kind}: 401 refreshes once and retries the same request`, async t => {
    clock(t);
    let attempts = 0;
    const h = fixture({ rows: [], legacy: credentials('alpha'), directFallback: true,
      model: () => ++attempts === 1 ? failure(401) : sse(kind === 'chat' ? textFrame : imageFrame) });
    await invoke(h);
    assert.deepEqual(h.fallbackCounts(), { failedPicks: 1, emptyReads: 1 });
    assert.deepEqual(h.requestCalls().map(call => call.authorization), ['Bearer access-alpha', 'Bearer access-renewed']);
    assert.deepEqual(h.requestCalls()[0].body, h.requestCalls()[1].body);
    assert.deepEqual(h.tokenCalls().map(call => call.refresh), ['refresh-alpha']);
    assert.equal(h.mirror().refresh, 'refresh-renewed');
    assert.equal(h.saves.length, 0);
    assertNoUnexpected(h);
  });

  test(`direct legacy ${kind}: a repeated 401 stops after one retry`, async t => {
    clock(t);
    const h = fixture({ rows: [], legacy: credentials('alpha'), directFallback: true, model: () => failure(401) });
    await assert.rejects(invoke(h), { code: kind === 'chat' ? 'PROVIDER_ERROR' : 'ANTIGRAVITY_IMAGE_FAILED' });
    assert.deepEqual(h.requestCalls().map(call => call.authorization), ['Bearer access-alpha', 'Bearer access-renewed']);
    assert.equal(h.tokenCalls().length, 1);
    assert.deepEqual(h.fallbackCounts(), { failedPicks: 1, emptyReads: 1 });
    assertNoUnexpected(h);
  });

  test(`direct legacy ${kind}: invalid grant has a safe code and leaves credentials intact`, async t => {
    clock(t);
    const h = fixture({ rows: [], legacy: credentials('alpha'), directFallback: true,
      model: () => failure(401), token: () => Response.json({ error: 'invalid_grant', error_description: 'SECRET_CANARY' }, { status: 400 }) });
    const before = h.mirror();
    await assert.rejects(invoke(h), error => {
      assert.equal(error.code, 'INVALID_GRANT');
      assert.doesNotMatch(String(error.stack), /SECRET_CANARY|refresh-alpha|SYNTHETIC_CLIENT_SECRET/);
      return true;
    });
    assert.deepEqual(h.mirror(), before);
    assert.equal(h.tokenCalls().length, 1);
    assert.equal(h.requestCalls().length, 1);
    assert.equal(h.mirrors.length, 0);
    assertNoUnexpected(h);
  });
}

for (const change of ['replacement', 'delete']) {
  test(`direct legacy: an in-flight refresh cannot undo ${change}`, { timeout: 3000 }, async t => {
    clock(t);
    const started = deferred(), gate = deferred();
    const h = fixture({ rows: [], legacy: credentials('alpha'), directFallback: true,
      model: call => call.authorization === 'Bearer access-alpha' ? failure(401) : sse(textFrame),
      token: async () => { started.resolve(); await gate.promise; return tokenReply('access-stale', 'refresh-stale'); } });
    const pending = chat(h);
    pending.catch(() => {});
    try {
      await started.promise;
      if (change === 'replacement') await h.store.write(credentials('replacement'));
      else await h.store.delete();
      gate.resolve();
      const result = await Promise.allSettled([pending]);
      if (change === 'replacement') {
        assert.equal(result[0].status, 'fulfilled');
        assert.equal(h.mirror().refresh, 'refresh-replacement');
        assert.equal(h.requestCalls().at(-1).authorization, 'Bearer access-replacement');
      } else {
        assert.equal(result[0].status, 'rejected');
        assert.equal(h.mirror(), null);
      }
      assert.equal(h.mirrors.some(value => value.refresh === 'refresh-stale'), false);
      assert.equal(h.requestCalls().some(call => call.authorization === 'Bearer access-stale'), false);
      assertNoUnexpected(h);
    } finally { gate.resolve(); await Promise.allSettled([pending]); }
  });
}

const kinds = [['chat', chat], ['image', image], ['quota', quota]];
function successfulRequest(call) {
  return call.method === 'streamGenerateContent'
    ? sse(call.body.requestType === 'image_gen' ? imageFrame : textFrame)
    : quotaReply(call.method);
}
function changedExpiry() {
  return { ...credentials('alpha'), expires: NOW + 8_000_000, expires_at: NOW + 8_000_000 };
}
function changedAccess() {
  return { ...credentials('alpha'), access: 'access-replacement', access_token: 'access-replacement' };
}
async function updateCredential(h, value) {
  if (h.directFallback) await h.store.write(value);
  else await h.pool.core.updateAccountCredentials('alpha', value);
}

for (const directFallback of [false, true]) for (const [kind, invoke] of kinds) {
  for (const changed of ['expiry', 'access']) {
    test(`${directFallback ? 'direct legacy' : 'pool'} ${kind}: ${changed}-only update before 401 uses the correct bearer`, async t => {
      clock(t);
      let first = true;
      const h = fixture({ ...(directFallback ? { rows: [], legacy: credentials('alpha') } : {}), directFallback,
        model: async call => {
          if (first) {
            first = false;
            await updateCredential(h, changed === 'expiry' ? changedExpiry() : changedAccess());
            return failure(401);
          }
          return successfulRequest(call);
        } });
      await invoke(h);
      assert.equal(h.requestCalls()[0].authorization, 'Bearer access-alpha');
      assert.equal(h.requestCalls()[1].authorization, changed === 'expiry' ? 'Bearer access-renewed' : 'Bearer access-replacement');
      assert.equal(h.tokenCalls().length, changed === 'expiry' ? 1 : 0);
      if (directFallback && kind !== 'quota') assert.deepEqual(h.fallbackCounts(), { failedPicks: 1, emptyReads: 1 });
      assertNoUnexpected(h);
    });
  }
}

for (const [kind, invoke] of kinds) {
  test(`pool ${kind}: expiry changes between recovery reads do not reuse the rejected bearer`, async t => {
    clock(t);
    let first = true;
    const h = fixture({ model: call => {
      if (first) {
        first = false;
        h.mutatePoolAfterNextRead(data => { data.accounts[0].credentials = changedExpiry(); });
        return failure(401);
      }
      return successfulRequest(call);
    } });
    await invoke(h);
    assert.equal(h.readMutations(), 1, 'the pool changed after its first recovery read');
    assert.equal(h.tokenCalls().length, 1);
    assert.equal(h.requestCalls()[1].authorization, 'Bearer access-renewed');
    assertNoUnexpected(h);
  });
}

for (const directFallback of [false, true]) {
  test(`${directFallback ? 'direct legacy' : 'pool'}: concurrent 401s after expiry metadata update share refresh`, { timeout: 3000 }, async t => {
    clock(t);
    const both = deferred(), refusals = deferred(), refreshStarted = deferred(), refreshGate = deferred();
    let old = 0;
    const h = fixture({ ...(directFallback ? { rows: [], legacy: credentials('alpha') } : {}), directFallback,
      model: async call => {
        if (call.authorization === 'Bearer access-alpha') {
          if (++old === 2) both.resolve();
          await refusals.promise;
          return failure(401);
        }
        return successfulRequest(call);
      },
      token: async () => { refreshStarted.resolve(); await refreshGate.promise; return tokenReply(); } });
    const pending = Promise.all([chat(h), image(h)]);
    pending.catch(() => {});
    try {
      await both.promise;
      await updateCredential(h, changedExpiry());
      refusals.resolve();
      await Promise.race([refreshStarted.promise, pending.then(() => { throw new Error('no refresh occurred'); })]);
      await tick();
      assert.equal(h.tokenCalls().length, 1);
      refreshGate.resolve();
      await pending;
      assert.equal(h.tokenCalls().length, 1);
      assert.equal(h.requestCalls().filter(call => call.authorization === 'Bearer access-renewed').length, 2);
      assertNoUnexpected(h);
    } finally { refusals.resolve(); refreshGate.resolve(); await Promise.allSettled([pending]); }
  });

  test(`${directFallback ? 'direct legacy' : 'pool'}: metadata-only change keeps rotated refresh and retries with new bearer`, { timeout: 3000 }, async t => {
    clock(t);
    const started = deferred(), gate = deferred();
    const h = fixture({ ...(directFallback ? { rows: [], legacy: credentials('alpha') } : {}), directFallback,
      model: call => call.authorization === 'Bearer access-alpha' ? failure(401) : successfulRequest(call),
      token: async () => { started.resolve(); await gate.promise; return tokenReply('access-stale', 'refresh-stale'); } });
    const pending = chat(h);
    pending.catch(() => {});
    try {
      await started.promise;
      await updateCredential(h, changedExpiry());
      gate.resolve();
      assert.equal(await pending, 'OK');
      assert.equal(h.tokenCalls().length, 1);
      assert.deepEqual(h.requestCalls().map(call => call.authorization), ['Bearer access-alpha', 'Bearer access-stale']);
      const current = directFallback ? h.mirror() : h.data().accounts[0].credentials;
      assert.equal(current.access, 'access-stale');
      assert.equal(current.refresh, 'refresh-stale');
      assert.notEqual(current.expires, changedExpiry().expires, 'expiry must come from the OAuth response');
      assert.equal(current.email, 'alpha@example.test', 'unrelated latest metadata is preserved');
      assertNoUnexpected(h);
    } finally { gate.resolve(); await Promise.allSettled([pending]); }
  });

  test(`${directFallback ? 'direct legacy' : 'pool'}: rotated refresh survives a second exchange; stale cannot overwrite relogin`, { timeout: 3000 }, async t => {
    clock(t);
    const started = deferred(), gate = deferred();
    const h = fixture({ ...(directFallback ? { rows: [], legacy: credentials('alpha') } : {}), directFallback,
      model: call => call.authorization === 'Bearer access-alpha' ? failure(401) : successfulRequest(call),
      token: async call => { started.resolve(); await gate.promise;
        assert.equal(call.refresh, 'refresh-alpha', 'the first exchange uses the stored refresh');
        return tokenReply('access-stale', 'refresh-stale'); } });
    const pending = chat(h);
    pending.catch(() => {});
    try {
      await started.promise;
      await updateCredential(h, changedExpiry());
      gate.resolve();
      await pending;
      const stored = directFallback ? h.mirror() : h.data().accounts[0].credentials;
      assert.equal(stored.refresh, 'refresh-stale');
      // A later expiry-driven refresh must present the rotated token, not the old one.
      const expired = { ...stored, expires: NOW - 1, expires_at: NOW - 1 };
      const h2 = fixture({ ...(directFallback ? { rows: [], legacy: expired } : { rows: [{ ...account('alpha'), credentials: expired }] }), directFallback,
        token: async call => { assert.equal(call.refresh, 'refresh-stale'); return tokenReply('access-next', 'refresh-next'); } });
      await chat(h2);
      const next = directFallback ? h2.mirror() : h2.data().accounts[0].credentials;
      assert.equal(next.refresh, 'refresh-next');
      assert.equal(next.access, 'access-next');
      assertNoUnexpected(h);
      assertNoUnexpected(h2);
    } finally { gate.resolve(); await Promise.allSettled([pending]); }
  });

  test(`${directFallback ? 'direct legacy' : 'pool'}: an in-flight refresh cannot overwrite a changed refresh token or delete`, { timeout: 3000 }, async t => {
    clock(t);
    const started = deferred(), gate = deferred();
    const h = fixture({ ...(directFallback ? { rows: [], legacy: credentials('alpha') } : {}), directFallback,
      model: call => call.authorization === 'Bearer access-alpha' ? failure(401) : successfulRequest(call),
      token: async () => { started.resolve(); await gate.promise; return tokenReply('access-stale', 'refresh-stale'); } });
    const pending = chat(h);
    pending.catch(() => {});
    try {
      await started.promise;
      const replacement = { ...credentials('alpha'), refresh: 'refresh-replacement', refresh_token: 'refresh-replacement' };
      await updateCredential(h, replacement);
      gate.resolve();
      await Promise.allSettled([pending]);
      const current = directFallback ? h.mirror() : h.data().accounts[0].credentials;
      assert.equal(current.refresh, 'refresh-replacement');
      assert.equal(JSON.stringify(h.data()).includes('refresh-stale'), false);
      assertNoUnexpected(h);
    } finally { gate.resolve(); await Promise.allSettled([pending]); }
  });
}

for (const [kind, invoke] of kinds) {
  test(`pool read failure: ${kind} expired request never refreshes or overwrites accounts`, async t => {
    clock(t);
    const h = fixture({ rows: [account('alpha', NOW - 1, true), account('beta', NOW - 1)], poolReadError: true });
    const before = h.data(), mirror = h.mirror();
    await assert.rejects(invoke(h), error => {
      assert.doesNotMatch(String(error.stack), /BACKEND_SECRET_CANARY|access-alpha|refresh-alpha/);
      return true;
    });
    assert.deepEqual(h.data(), before);
    assert.deepEqual(h.mirror(), mirror);
    assert.equal(h.legacyCounts().reads, 0);
    assert.equal(h.tokenCalls().length, 0);
    assert.equal(h.requestCalls().length, 0);
    assert.equal(h.saves.length, 0);
    assert.equal(h.mirrors.length, 0);
    assertNoUnexpected(h);
  });

  test(`pool read failure: ${kind} 401 recovery never refreshes or overwrites accounts`, async t => {
    clock(t);
    let before, mirror, saveCount, mirrorCount, legacyReads;
    const h = fixture({ rows: [account('alpha', undefined, true), account('beta')], model: () => {
      before = h.data(); mirror = h.mirror(); saveCount = h.saves.length; mirrorCount = h.mirrors.length;
      legacyReads = h.legacyCounts().reads; h.failPoolReads(); return failure(401);
    } });
    await assert.rejects(invoke(h), error => {
      assert.doesNotMatch(String(error.stack), /BACKEND_SECRET_CANARY|access-alpha|refresh-alpha/);
      return true;
    });
    assert.ok(before, 'a request must reach the synthetic 401 first');
    assert.deepEqual(h.data(), before);
    assert.deepEqual(h.mirror(), mirror);
    assert.equal(h.legacyCounts().reads, legacyReads);
    assert.equal(h.tokenCalls().length, 0);
    assert.equal(h.requestCalls().length, 1);
    assert.equal(h.saves.length, saveCount);
    assert.equal(h.mirrors.length, mirrorCount);
    assertNoUnexpected(h);
  });
}

test('pool read failure: background scan never refreshes or overwrites accounts', async t => {
  clock(t);
  const h = fixture({ rows: [account('alpha', NOW - 1, true), account('beta', NOW - 1)], poolReadError: true });
  const before = h.data(), mirror = h.mirror(), logs = [];
  const worker = startCredentialRefresh([{ id: 'antigravity', core: h.pool.core, fetchFn: h.fetchFn, concurrentRefresh: true }], {
    now: () => NOW, logger: { warn: text => logs.push(String(text)) },
    setIntervalFn: () => ({ unref() {} }), clearIntervalFn() {},
  });
  try { await worker.ready; } finally { worker.dispose(); }
  assert.deepEqual(h.data(), before);
  assert.deepEqual(h.mirror(), mirror);
  assert.equal(h.legacyCounts().reads, 0);
  assert.equal(h.tokenCalls().length, 0);
  assert.equal(h.saves.length, 0);
  assert.equal(h.mirrors.length, 0);
  assert.ok(logs.length);
  assert.doesNotMatch(logs.join('\n'), /BACKEND_SECRET_CANARY|access-alpha|refresh-alpha|SYNTHETIC_CLIENT_SECRET/);
  assertNoUnexpected(h);
});

test('a genuinely absent pool still migrates and refreshes a legacy account', async t => {
  clock(t);
  const h = fixture({ rows: [], nullPool: true, legacy: credentials('alpha', NOW - 1) });
  assert.equal(await chat(h), 'OK');
  assert.deepEqual(h.tokenCalls().map(call => call.refresh), ['refresh-alpha']);
  assert.equal(h.requestCalls()[0].authorization, 'Bearer access-renewed');
  assert.equal(h.data().accounts.length, 1);
  assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-renewed');
  assert.equal(h.mirror().refresh, 'refresh-renewed');
  assertNoUnexpected(h);
});

test('absent pool plus legacy credential read failure is not reported as an empty account', async t => {
  clock(t);
  const h = fixture({ rows: [], nullPool: true, legacy: credentials('alpha') });
  h.failLegacyReads();
  await assert.rejects(h.pool.read());
  assert.equal(h.data(), null);
  assert.equal(h.saves.length, 0);
  assert.equal(h.mirrors.length, 0);
  assert.equal(h.legacyCounts().deletes, 0);
});

async function route(h, name, method) {
  let handler;
  const dispose = api.__testAntigravityRoutes({ webServer: { register(value) { handler = value.handler; return () => {}; } } },
    h.store, h.settings, undefined, h.fetchFn, h.pool);
  const request = Readable.from(method === 'POST' ? ['{}'] : []);
  Object.assign(request, { method, url: `/wb/antigravity/api/${name}`, headers: { host: '127.0.0.1:3210', origin: 'http://127.0.0.1:3210' } });
  let status, value;
  try { await handler(request, { writeHead(code) { status = code; }, end(body) { value = JSON.parse(body); } }); }
  finally { dispose(); }
  return { status, value };
}

for (const name of ['logout', 'status']) {
  test(`pool read failure: ${name} route reports error and preserves credentials`, async t => {
    clock(t);
    const h = fixture({ rows: [account('alpha', undefined, true), account('beta')], poolReadError: true });
    const before = h.data(), mirror = h.mirror();
    const result = await route(h, name, name === 'logout' ? 'POST' : 'GET');
    assert.equal(result.status, 500);
    assert.equal(result.value.ok, false);
    assert.doesNotMatch(JSON.stringify(result.value), /BACKEND_SECRET_CANARY|access-alpha|refresh-alpha|SYNTHETIC_CLIENT_SECRET/);
    assert.deepEqual(h.data(), before);
    assert.deepEqual(h.mirror(), mirror);
    assert.equal(h.legacyCounts().deletes, 0);
    assert.equal(h.tokenCalls().length, 0);
    assert.equal(h.saves.length, 0);
    assert.equal(h.mirrors.length, 0);
    assertNoUnexpected(h);
  });
}

test('legacy credential read failure is sanitized on the status route', async t => {
  clock(t);
  const h = fixture({ rows: [], nullPool: true, legacy: credentials('alpha') });
  h.failLegacyReads();
  const result = await route(h, 'status', 'GET');
  assert.equal(result.status, 500);
  assert.equal(result.value.ok, false);
  assert.doesNotMatch(JSON.stringify(result.value), /synthetic legacy read failure|access-alpha|refresh-alpha/);
  assert.equal(h.saves.length, 0);
  assert.equal(h.legacyCounts().deletes, 0);
});
