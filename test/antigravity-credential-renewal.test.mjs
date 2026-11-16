import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

// The alternate bundle and its sibling worker are tested together; no credential
// files, servers, network clients, or production modules are loaded by this test.
const bundlePath = process.env.ANTIGRAVITY_TEST_BUNDLE
  ? path.resolve(process.env.ANTIGRAVITY_TEST_BUNDLE)
  : fileURLToPath(new URL('../lib/index.js', import.meta.url));
const bundle = fs.readFileSync(bundlePath, 'utf8');
const workerSource = fs.readFileSync(path.join(path.dirname(bundlePath), 'credential-refresh.js'), 'utf8')
  .replace(/^import\s+\{\s*createHash\s*\}\s+from\s+['"]node:crypto['"];\s*/m, '')
  .replace(/\bexport\s+function\s+startCredentialRefresh\b/, 'function startCredentialRefresh');
const NOW = 1_800_000_000_000;
const TOKEN_URL = 'https://oauth.test.invalid/token';
const QUOTA_ORIGIN = 'https://quota.test.invalid';
const CANARY = 'SYNTHETIC_SECRET_CANARY_58b3d';

function section(marker) {
  const start = bundle.indexOf(marker);
  assert.notEqual(start, -1, `missing bundle section: ${marker}`);
  const end = bundle.indexOf('\n//#endregion', start);
  assert.ok(end > start, `missing section end: ${marker}`);
  return bundle.slice(start, end);
}
function region(name) { return section(`//#region src/host/${name}.ts`); }
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function credential(id, expires = NOW + 3_600_000) {
  return { access: `access-${id}`, access_token: `access-${id}`, refresh: `refresh-${id}`,
    refresh_token: `refresh-${id}`, expires, expires_at: expires,
    projectId: `project-${id}`, email: `${id}@example.test` };
}
function account(id, expires, isPrimary = false) {
  const credentials = credential(id, expires);
  return { id, alias: `alias-${id}`, addedAt: NOW - 1000, isPrimary, credentials,
    email: credentials.email, projectId: credentials.projectId };
}
function tokenResponse(access, refresh) {
  return Response.json({ access_token: access, ...(refresh === undefined ? {} : { refresh_token: refresh }), expires_in: 3600 });
}

function harness({ accounts = [account('alpha', undefined, true), account('beta')], token, quota } = {}) {
  let now = NOW;
  let poolData = { version: 1, rotationStrategy: 'sticky', activeAccountId: accounts[0]?.id, accounts: structuredClone(accounts) };
  let legacy = structuredClone(accounts.find(row => row.isPrimary)?.credentials ?? null);
  const saves = [], mirrors = [], calls = [], warnings = [], timers = [];
  const backend = {
    async load() { return structuredClone(poolData); },
    async save(data) { poolData = structuredClone(data); saves.push(structuredClone(data)); },
  };
  const store = {
    async read() { return structuredClone(legacy); },
    async write(data) { legacy = structuredClone(data); mirrors.push(structuredClone(data)); },
    async delete() { legacy = null; },
    path() { return 'memory-only'; },
  };
  // All requests terminate here. No reference to Node's fetch or a network API is exposed.
  const syntheticFetch = async (url, init = {}) => {
    const target = String(url);
    if (target === TOKEN_URL) {
      const params = new URLSearchParams(init.body);
      const call = { kind: 'token', target, method: init.method, grant: params.get('grant_type'), refresh: params.get('refresh_token') };
      calls.push(call);
      if (!token) throw new Error('synthetic token response not configured');
      return token(call, calls.length);
    }
    if (target.startsWith(`${QUOTA_ORIGIN}/`)) {
      const call = { kind: 'quota', target, authorization: init.headers?.Authorization };
      calls.push(call);
      if (!quota) throw new Error('synthetic quota response not configured');
      return quota(call, calls.length);
    }
    throw new Error(`synthetic fetch blocked unexpected URL: ${target}`);
  };
  class LlmError extends Error {
    constructor(message, code, details = {}) { super(message); this.code = code; Object.assign(this, details); }
  }
  const context = vm.createContext({
    AbortSignal, Buffer, URL, URLSearchParams$1: URLSearchParams, structuredClone, createHash, randomBytes, path, LlmError, Error,
    Date: class extends Date { static now() { return now; } },
    process: { platform: 'win32', arch: 'x64', env: {} },
    isDeepStrictEqual: (a, b) => isDeepStrictEqual(structuredClone(a), structuredClone(b)),
    fetch: syntheticFetch, TOKEN_URL, DEFAULT_CLIENT_ID: 'SYNTHETIC_CLIENT', DEFAULT_CLIENT_SECRET: 'SYNTHETIC_CLIENT_SECRET',
    ENDPOINT_FALLBACKS: [QUOTA_ORIGIN], DISCOVERY_TIMEOUT_MS$6: 8000, FREE_TIER_ID: 'free-tier',
    MODELS: [], ROUTING: {}, getCacheStats$1: () => ({ requests: 0 }),
    setInterval: () => { throw new Error('real interval forbidden'); },
    clearInterval: () => { throw new Error('real interval forbidden'); },
  });
  const source = [
    section('const MIN_COOLDOWN_MS ='),
    section('function parseAntigravityCredentials('),
    region('antigravity/port-constants'),
    region('antigravity/oauth'),
    region('antigravity/catalog-limits'),
    region('antigravity/account-pool'),
    region('common/same-origin'),
    region('common/quota-refresh'),
    region('antigravity/routes'),
    workerSource,
  ].join('\n');
  vm.runInContext(source, context, { filename: 'synthetic-antigravity-regions.js' });
  const api = vm.runInContext('({ AccountPoolStore, registerAntigravityRoutes, startCredentialRefresh })', context);
  const pool = new api.AccountPoolStore('MEMORY_ONLY_ANTIGRAVITY_POOL', backend, store);
  const settings = { async read() { return { enabledModelIds: [], catalogModels: [], contextWindowOverrides: {} }; } };
  let handler;
  api.registerAntigravityRoutes({ webServer: { register(route) { handler = route.handler; return () => {}; } } },
    store, settings, undefined, syntheticFetch, pool);
  assert.equal(typeof handler, 'function');
  async function request(route, method = 'GET', body, headers = { host: '127.0.0.1:3210', origin: 'http://127.0.0.1:3210' }) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    Object.assign(req, { method, url: `/wb/antigravity/api/${route}`, headers });
    let status, result;
    await handler(req, { writeHead(code) { status = code; }, end(text) { result = JSON.parse(text); } });
    assert.equal(typeof status, 'number', 'route must reply');
    return { status, ...result };
  }
  function startWorker() {
    return api.startCredentialRefresh([{ id: 'antigravity', core: pool.core, fetchFn: syntheticFetch, concurrentRefresh: true }], {
      now: () => now,
      logger: { warn: message => warnings.push(String(message)) },
      setIntervalFn(fn, interval) { const timer = { fn, interval, unref() {} }; timers.push(timer); return timer; },
      clearIntervalFn(timer) { timer.cleared = true; },
    });
  }
  return { api, pool, backend, store, request, startWorker, syntheticFetch, calls, saves, mirrors, warnings, timers,
    advance(ms) { now += ms; }, data: () => structuredClone(poolData), legacy: () => structuredClone(legacy) };
}

const refresh = accountId => ({ action: 'refresh-credential', accountId });
const flush = () => new Promise(resolve => setImmediate(resolve));

test('manual route forces the named non-primary account, rotates both token fields and preserves the primary', async () => {
  const h = harness({ token: call => tokenResponse(`new-${call.refresh}`, `rotated-${call.refresh}`) });
  const before = h.data();
  assert.equal((await h.pool.core.getFreshCredential('beta', h.syntheticFetch)).access, 'access-beta');
  assert.equal(h.calls.length, 0, 'the target begins unexpired');
  const result = await h.request('accounts', 'POST', refresh('beta'));
  assert.equal(result.status, 200);
  assert.equal(result.ok, true);
  assert.deepEqual(h.calls.map(({ kind, method, grant, refresh: value }) => [kind, method, grant, value]),
    [['token', 'POST', 'refresh_token', 'refresh-beta']]);
  const after = h.data();
  assert.deepEqual(after.accounts[0], before.accounts[0]);
  const renewed = after.accounts[1].credentials;
  assert.equal(renewed.access, 'new-refresh-beta');
  assert.equal(renewed.access_token, renewed.access);
  assert.equal(renewed.refresh, 'rotated-refresh-beta');
  assert.equal(renewed.refresh_token, renewed.refresh);
  assert.equal(renewed.projectId, 'project-beta');
  assert.equal(renewed.expires, NOW + 3_600_000 - 300_000);
  assert.equal(renewed.expires_at, renewed.expires);
  assert.equal(after.activeAccountId, 'alpha');
  assert.equal(h.legacy().refresh, 'refresh-alpha');
  assert.equal(h.saves.length, 1);
  assert.equal(h.mirrors.length, 0);
  for (const secret of ['access-alpha', 'refresh-alpha', 'access-beta', 'refresh-beta', renewed.access, renewed.refresh]) {
    assert.equal(JSON.stringify(result).includes(secret), false, 'public route response must not expose tokens');
  }
});

test('manual route validates origin and account ID before renewing', async () => {
  const h = harness({ token: () => tokenResponse('new', 'rotated') });
  for (const headers of [
    { host: '127.0.0.1:3210', origin: 'https://foreign.example' },
    { host: '127.0.0.1:3210', origin: 'null' },
    { host: 'example.test:3210' },
    { origin: 'http://127.0.0.1:3210' },
  ]) {
    const result = await h.request('accounts', 'POST', refresh('beta'), headers);
    assert.equal(result.status, 403);
    assert.equal(result.code, 'CROSS_ORIGIN');
  }
  for (const id of [undefined, '', '   ', 5]) {
    const result = await h.request('accounts', 'POST', refresh(id));
    assert.equal(result.status, 400);
    assert.equal(result.code, 'INVALID_ACCOUNT_ID');
  }
  const missing = await h.request('accounts', 'POST', refresh('not-found'));
  assert.equal(missing.status, 404);
  assert.equal(missing.code, 'ACCOUNT_NOT_FOUND');
  assert.equal(h.calls.length, 0);
  assert.equal(h.saves.length, 0);
  const desktop = await h.request('accounts', 'POST', refresh('beta'), { host: '127.0.0.1:3210' });
  assert.equal(desktop.status, 200, 'loopback desktop forwarding without Origin remains supported');
  assert.equal(h.calls.length, 1);
});

test('background, foreground and concurrent manual renewals share one generation and one commit', { timeout: 3000 }, async () => {
  const started = deferred(), gate = deferred();
  const h = harness({ accounts: [account('alpha', NOW - 1, true)], token: async () => {
    started.resolve(); await gate.promise; return tokenResponse('shared-access', 'shared-rotated');
  } });
  const worker = h.startWorker();
  try {
    await started.promise;
    const normal = h.pool.core.getFreshCredential('alpha', h.syntheticFetch);
    const manualOne = h.request('accounts', 'POST', refresh('alpha'));
    const manualTwo = h.request('accounts', 'POST', refresh('alpha'));
    const tick = worker.tick();
    await flush();
    assert.equal(h.calls.length, 1, 'all callers must join the same exchange before it completes');
    gate.resolve();
    const [fresh, first, second] = await Promise.all([normal, manualOne, manualTwo, worker.ready, tick]);
    assert.equal(fresh.refresh, 'shared-rotated');
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(h.calls.length, 1);
    assert.equal(h.saves.length, 1);
    assert.equal(h.mirrors.length, 1);
    assert.equal(h.legacy().refresh_token, 'shared-rotated');
    assert.equal(h.data().accounts[0].credentials.access, 'shared-access');
  } finally { gate.resolve(); worker.dispose(); }
  assert.equal(h.timers[0].cleared, true);
});

test('different accounts refresh concurrently and reversed commits retain both rotated grants', { timeout: 3000 }, async () => {
  const bothStarted = deferred(), gates = { 'refresh-alpha': deferred(), 'refresh-beta': deferred() };
  const h = harness({ accounts: [account('alpha', NOW - 1, true), account('beta', NOW - 1)], token: async call => {
    if (h.calls.length === 2) bothStarted.resolve();
    await gates[call.refresh].promise;
    return tokenResponse(`next-${call.refresh}`, `rotated-${call.refresh}`);
  } });
  const worker = h.startWorker();
  try {
    await bothStarted.promise;
    assert.equal(h.calls.length, 2);
    gates['refresh-beta'].resolve();
    await flush();
    assert.equal(h.data().accounts[1].credentials.refresh, 'rotated-refresh-beta', 'healthy account commits while another exchange is blocked');
    assert.equal(h.data().accounts[0].credentials.refresh, 'refresh-alpha');
    gates['refresh-alpha'].resolve();
    await worker.ready;
    const rows = h.data().accounts;
    assert.equal(rows[0].credentials.refresh, 'rotated-refresh-alpha');
    assert.equal(rows[1].credentials.refresh, 'rotated-refresh-beta');
    assert.equal(h.saves.length, 2);
    assert.equal(h.mirrors.length, 1);
    assert.equal(h.legacy().refresh, 'rotated-refresh-alpha');
  } finally { gates['refresh-alpha'].resolve(); gates['refresh-beta'].resolve(); worker.dispose(); }
});

test('a late refresh cannot overwrite newer credentials or restore a deleted account', { timeout: 3000 }, async () => {
  for (const change of ['relogin', 'delete']) {
    const started = deferred(), gate = deferred();
    const h = harness({ token: async () => { started.resolve(); await gate.promise; return tokenResponse('stale-access', 'stale-refresh'); } });
    const pending = h.request('accounts', 'POST', refresh('beta'));
    try {
      await started.promise;
      if (change === 'relogin') await h.pool.core.updateAccountCredentials('beta', credential('replacement'));
      else await h.pool.deleteAccount('beta');
      gate.resolve();
      const response = await pending;
      const target = h.data().accounts.find(row => row.id === 'beta');
      if (change === 'relogin') {
        assert.equal(response.status, 200);
        assert.equal(target.credentials.refresh, 'refresh-replacement');
      } else {
        assert.equal(target, undefined);
        assert.notEqual(response.status, 200);
      }
      assert.equal(JSON.stringify(h.data()).includes('stale-refresh'), false);
    } finally { gate.resolve(); await pending; }
  }
});

test('missing or blank rotated refresh tokens retain the existing refresh token', async () => {
  for (const rotated of [undefined, '', '  ', 123, null]) {
    const h = harness({ token: () => tokenResponse('replacement-access', rotated) });
    const result = await h.request('accounts', 'POST', refresh('beta'));
    assert.equal(result.status, 200);
    const value = h.data().accounts[1].credentials;
    assert.equal(value.refresh, 'refresh-beta');
    assert.equal(value.refresh_token, 'refresh-beta');
    assert.equal(value.access, 'replacement-access');
  }
});

test('invalid access tokens and expiry values never overwrite existing credentials', async () => {
  for (const body of [
    {}, { access_token: '' }, { access_token: '   ' }, { access_token: 42 },
    { access_token: 'valid', expires_in: 0 }, { access_token: 'valid', expires_in: -1 },
    { access_token: 'valid', expires_in: '3600' }, { access_token: 'valid', expires_in: null },
    { access_token: 'valid', expires_in: 1e308 },
  ]) {
    const h = harness({ token: () => Response.json({ ...body, refresh_token: 'should-not-commit' }) });
    const before = h.data();
    const response = await h.request('accounts', 'POST', refresh('beta'));
    assert.equal(response.status, 502, JSON.stringify(body));
    assert.equal(response.code, 'TOKEN_RESPONSE_INVALID');
    assert.deepEqual(h.data(), before);
    assert.equal(h.saves.length, 0);
    assert.equal(h.mirrors.length, 0);
  }
});

test('OAuth and route failures do not leak canary secrets into responses or worker logs', async () => {
  for (const failure of ['network', 'invalid-grant', 'invalid-client', 'upstream', 'bad-json']) {
    const h = harness({ accounts: [account('alpha', NOW - 1, true)], token: () => {
      if (failure === 'network') throw new Error(CANARY);
      if (failure === 'invalid-grant') return Response.json({ error: 'invalid_grant', error_description: CANARY }, { status: 400 });
      if (failure === 'invalid-client') return Response.json({ error: 'invalid_client', error_description: CANARY }, { status: 401 });
      if (failure === 'upstream') return Response.json({ error: CANARY }, { status: 500 });
      return new Response(CANARY, { status: 200 });
    } });
    const before = h.data();
    const response = await h.request('accounts', 'POST', refresh('alpha'));
    const expected = { network: [503, 'TOKEN_NETWORK_ERROR'], 'invalid-grant': [401, 'INVALID_GRANT'],
      'invalid-client': [502, 'INVALID_CLIENT'], upstream: [502, 'TOKEN_UPSTREAM_ERROR'], 'bad-json': [502, 'TOKEN_RESPONSE_INVALID'] }[failure];
    assert.deepEqual([response.status, response.code], expected);
    assert.equal(JSON.stringify(response).includes(CANARY), false);
    assert.deepEqual(h.data(), before);
    assert.equal(h.saves.length, 0);
    const worker = h.startWorker();
    try {
      await worker.ready;
      assert.equal(h.warnings.length, 1);
      assert.equal(JSON.stringify(h.warnings).includes(CANARY), false);
      assert.deepEqual(h.data(), before);
    } finally { worker.dispose(); }
  }
});

test('background worker skips fresh accounts, backs off a failed generation, and retries after the deadline', async () => {
  const h = harness({ accounts: [account('alpha', NOW - 1, true), account('beta')], token: (_call, count) =>
    count === 1 ? Response.json({ error: 'invalid_grant', detail: CANARY }, { status: 400 }) : tokenResponse('recovered', 'recovered-refresh') });
  const worker = h.startWorker();
  try {
    await worker.ready;
    assert.deepEqual(h.calls.map(call => call.refresh), ['refresh-alpha']);
    await worker.tick();
    assert.equal(h.calls.length, 1);
    h.advance(120_000);
    await worker.tick();
    assert.deepEqual(h.calls.map(call => call.refresh), ['refresh-alpha', 'refresh-alpha']);
    assert.equal(h.data().accounts[0].credentials.refresh, 'recovered-refresh');
    assert.equal(h.data().accounts[1].credentials.refresh, 'refresh-beta');
    assert.equal(h.warnings.length, 1);
    assert.equal(JSON.stringify(h.warnings).includes(CANARY), false);
  } finally { worker.dispose(); }
  await worker.tick();
  assert.equal(h.calls.length, 2);
});

test('a successful manual credential refresh preserves the TOS quota latch', async () => {
  const h = harness({ token: () => tokenResponse('fresh-access', 'fresh-refresh'), quota: () => Response.json({
    error: { code: 403, message: 'disabled', details: [{ reason: 'TOS_VIOLATION' }] },
  }, { status: 403 }) });
  const initial = await h.request('status');
  assert.equal(initial.status, 200);
  assert.match(initial.value.quotaError, /TOS_VIOLATION/);
  assert.equal(h.calls.filter(call => call.kind === 'quota').length, 1);
  const renewed = await h.request('accounts', 'POST', refresh('alpha'));
  assert.equal(renewed.status, 200);
  assert.match(renewed.value.quotaError, /TOS_VIOLATION/);
  assert.equal(h.data().accounts[0].credentials.refresh, 'fresh-refresh');
  const again = await h.request('status');
  assert.equal(again.status, 200);
  assert.match(again.value.quotaError, /TOS_VIOLATION/);
  assert.equal(h.calls.filter(call => call.kind === 'quota').length, 1, 'renewal must not restart quota polling for a TOS-disabled account');
  assert.equal(h.calls.filter(call => call.kind === 'token').length, 1);
});
