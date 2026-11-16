import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import test from 'node:test';
import vm from 'node:vm';

// Execute the shipped regions, not copies of their permission or retry logic.
const bundle = readFileSync(process.env.ANTIGRAVITY_TEST_BUNDLE || new URL('../lib/index.js', import.meta.url), 'utf8');
function region(name) {
  const marker = `//#region src/host/${name}.ts`;
  const start = bundle.indexOf(marker);
  assert.notEqual(start, -1, `missing bundle region: ${marker}`);
  const end = bundle.indexOf('//#endregion', start);
  assert.notEqual(end, -1, `missing region end: ${marker}`);
  return bundle.slice(start, end);
}

class TestError extends Error {
  constructor(message, code, options = {}) {
    super(message, options);
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
  }
}

const endpoints = ['https://first.invalid', 'https://second.invalid'];
const appeal = 'https://forms.gle/ANTIGRAVITY_APPEAL';
const tosError = {
  code: 403,
  status: 'PERMISSION_DENIED',
  message: 'The account is disabled.',
  details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'TOS_VIOLATION', metadata: { appeal_url: appeal } }],
};
const ordinaryError = { code: 403, status: 'PERMISSION_DENIED', message: 'Project access denied', details: [{ reason: 'ACCESS_DENIED' }] };
const model = { id: 'gemini-test', name: 'test', inputModalities: ['text'], contextWindow: 128000, maxTokens: 1024 };
const chatOptions = { model: model.id, messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] };

function runtime(now = () => Date.now()) {
  class TestDate extends Date {
    static now() { return now(); }
  }
  const context = vm.createContext({
    AbortSignal, Buffer, Date: TestDate, Error, Map, Math, Set, TextDecoder, URL,
    process: { env: {}, platform: 'win32', arch: 'x64' },
    fetch: () => { throw new Error('unexpected real fetch'); },
    ENDPOINT_FALLBACKS: endpoints,
    DISCOVERY_TIMEOUT_MS$6: 8000,
    FREE_TIER_ID: 'free-tier',
    PROVIDER_ID$8: 'antigravity',
    ANTIGRAVITY_IMAGE_MODEL: 'gemini-test-image',
    ANTIGRAVITY_SYSTEM_INSTRUCTION: 'test',
    ANTIGRAVITY_NO_PREAMBLE_INSTRUCTION: 'test',
    ANTIGRAVITY_PROGRESS_INSTRUCTION: 'test',
    GEMINI_ROLE: { user: 'user', model: 'model' },
    TOOL_CALLING_MODE: { none: 'NONE', any: 'ANY', auto: 'AUTO', validated: 'VALIDATED' },
    ROUTING: {},
    RUNTIME_MAX_OUTPUT_TOKENS: {},
    MODELS: [],
    poolRotationStrategy: () => 'sticky',
    getCacheStats$1: () => ({ requests: 0 }),
    LlmAdapter: class {},
    LlmError: TestError,
    LlmError$1: TestError,
    HarnessError: TestError,
    CONTEXT_OVERFLOW_CODE: 'CONTEXT_OVERFLOW',
    normalizeGenerateOptions: options => options,
    quotaFamilyForModel: id => id.startsWith('claude-') ? 'claude-gpt' : 'gemini',
    recordCacheRequest() {},
    recordCacheUsage() {},
    isHttpContextOverflow: () => false,
    isContextOverflow: () => false,
    toToolCallId: id => id,
    errorChain: error => String(error),
  });
  const code = [
    'antigravity/port-constants', 'antigravity/oauth', 'antigravity/catalog-limits',
    'antigravity/mapper', 'antigravity/adapter', 'antigravity/image-tool',
    'common/quota-refresh', 'antigravity/routes',
  ].map(region).join('\n');
  vm.runInContext(code, context, { filename: 'antigravity-bundle-regions.js' });
  return vm.runInContext('({ AntigravityAdapter, requestImage, postJson, fetchAccountQuota, loadCodeAssistDetail, discoverAntigravityProject, registerAntigravityRoutes, getCachedQuota: getCachedQuota$1 })', context);
}

function accountPool() {
  const selected = [];
  const cooldowns = [];
  const probes = [];
  const pool = {
    selected, cooldowns, probes,
    async getEffectiveAccountFor(family, excluded) {
      const id = ['one', 'two'].find(candidate => !excluded.has(candidate));
      assert.ok(id, 'unexpected extra account selection');
      selected.push({ id, family });
      return { account: { id }, token: `ACCESS_${id.toUpperCase()}`, projectId: 'project-test' };
    },
    async read() { return { accounts: [{ id: 'one' }, { id: 'two' }] }; },
    markFamilyCooldown(id, family, delay, reason) { cooldowns.push({ id, family, delay, reason }); },
    async hasAnotherAvailableAccountFor(family, excluded) {
      probes.push(family);
      return !excluded.has('two');
    },
    core: { async getFreshCredential() { return { access: 'ACCESS_ONE', projectId: 'project-test' }; } },
  };
  return pool;
}

function mockFetch(handler) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const parsed = new URL(url);
    assert.ok(endpoints.includes(parsed.origin), `unexpected network target: ${url}`);
    calls.push({ url: String(url), endpoint: parsed.origin, path: parsed.pathname, authorization: init.headers?.Authorization });
    return handler(calls.at(-1), calls.length);
  };
  return { calls, fetchFn };
}

function errorResponse(status, error = ordinaryError, headers = {}) {
  return Response.json({ error }, { status, headers });
}

function sseResponse(frame) {
  return new Response(`data: ${JSON.stringify(frame)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
}

const chatFrame = { response: { candidates: [{ content: { parts: [{ text: 'hello from SSE' }] }, finishReason: 'STOP' }] } };
const imageFrame = { response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AQIDBA==' } }] }, finishReason: 'STOP' }] } };
const signal = () => new AbortController().signal;

async function invoke(kind, api, pool, fetchFn, requestSignal = signal()) {
  if (kind === 'image') return api.requestImage(pool, {}, fetchFn, 'draw a test', '1:1', requestSignal);
  const adapter = new api.AntigravityAdapter({}, {}, undefined, { fetchFn }, pool);
  const chunks = [];
  for await (const chunk of adapter.requestStream(chatOptions, model, requestSignal, undefined, [])) chunks.push(chunk);
  return chunks;
}

function assertTos(error) {
  assert.match(String(error.message), /TOS_VIOLATION/);
  assert.match(String(error.message), /申诉|停用/);
  assert.ok(String(error.message).includes(appeal), 'Google appeal URL must reach the caller');
  return true;
}

function assertOrdinary403(error) {
  assert.match(String(error.message), /Project access denied/);
  assert.doesNotMatch(String(error.message), /TOS_VIOLATION|停用|申诉/);
  return true;
}

for (const kind of ['chat', 'image']) {
  test(`${kind}: TOS 403 reports the appeal and never changes endpoint or account`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch(() => errorResponse(403, tosError));
    await assert.rejects(invoke(kind, api, pool, fetchFn), assertTos);
    assert.deepEqual(calls.map(call => [call.endpoint, call.authorization]), [[endpoints[0], 'Bearer ACCESS_ONE']]);
    assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
    assert.deepEqual(pool.cooldowns, []);
    assert.deepEqual(pool.probes, []);
  });

  test(`${kind}: an ordinary 403 remains an ordinary permission failure`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch(() => errorResponse(403));
    await assert.rejects(invoke(kind, api, pool, fetchFn), assertOrdinary403);
    assert.equal(calls.length, 1);
    assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
    assert.deepEqual(pool.cooldowns, []);
  });

  test(`${kind}: 429 stays on the endpoint, cools the family and rotates accounts`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch((_call, count) => count === 1
      ? errorResponse(429, { code: 429, message: 'quota exhausted' }, { 'retry-after': '2' })
      : sseResponse(kind === 'chat' ? chatFrame : imageFrame));
    const result = await invoke(kind, api, pool, fetchFn);
    assert.deepEqual(calls.map(call => [call.endpoint, call.authorization]), [
      [endpoints[0], 'Bearer ACCESS_ONE'], [endpoints[0], 'Bearer ACCESS_TWO'],
    ]);
    assert.deepEqual(pool.selected.map(entry => entry.id), ['one', 'two']);
    assert.deepEqual(pool.cooldowns.map(({ id, family, delay }) => ({ id, family, delay })), [{ id: 'one', family: 'gemini', delay: 2000 }]);
    if (kind === 'chat') assert.equal(result.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join(''), 'hello from SSE');
    else assert.equal(result.images[0].data, 'AQIDBA==');
  });

  test(`${kind}: 429 reports rate limiting after both accounts are exhausted`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch(() => errorResponse(429, { code: 429, message: 'quota exhausted' }));
    await assert.rejects(invoke(kind, api, pool, fetchFn), error => {
      assert.equal(error.code, kind === 'chat' ? 'RATE_LIMIT' : 'ANTIGRAVITY_IMAGE_RATE_LIMITED');
      assert.match(error.message, /429|rate limit/i);
      return true;
    });
    assert.deepEqual(calls.map(call => [call.endpoint, call.authorization]), [
      [endpoints[0], 'Bearer ACCESS_ONE'], [endpoints[0], 'Bearer ACCESS_TWO'],
    ]);
    assert.deepEqual(pool.cooldowns.map(({ id, family }) => ({ id, family })), [
      { id: 'one', family: 'gemini' }, { id: 'two', family: 'gemini' },
    ]);
  });

  test(`${kind}: 5xx still falls back to the next endpoint`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch((_call, count) => count === 1
      ? errorResponse(503, { code: 503, message: 'unavailable' })
      : sseResponse(kind === 'chat' ? chatFrame : imageFrame));
    const result = await invoke(kind, api, pool, fetchFn);
    assert.deepEqual(calls.map(call => call.endpoint), endpoints);
    assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
    assert.equal(kind === 'chat' ? result.some(chunk => chunk.type === 'finish') : result.images.length === 1, true);
  });

  test(`${kind}: a never-ending 503 body does not block fallback`, async () => {
    const api = runtime(), pool = accountPool();
    const abort = new AbortController();
    let controller;
    let closed = false;
    const body = new ReadableStream({
      start(stream) {
        controller = stream;
        stream.enqueue(new TextEncoder().encode('upstream unavailable'));
      },
      cancel() { closed = true; },
    });
    const { calls, fetchFn } = mockFetch((_call, count) => count === 1
      ? new Response(body, { status: 503 })
      : sseResponse(kind === 'chat' ? chatFrame : imageFrame));
    let timer;
    const request = invoke(kind, api, pool, fetchFn, abort.signal);
    try {
      const result = await Promise.race([
        request,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('fallback blocked on an unfinished 503 body')), 1000); }),
      ]);
      assert.deepEqual(calls.map(call => call.endpoint), endpoints);
      assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
      if (kind === 'chat') assert.equal(result.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join(''), 'hello from SSE');
      else assert.equal(result.images[0].data, 'AQIDBA==');
    } finally {
      clearTimeout(timer);
      abort.abort();
      if (!closed) {
        try { controller.error(new Error('test cleanup')); } catch {}
      }
      await request.catch(() => {});
    }
  });

  test(`${kind}: exhausted 5xx retains the last upstream response text`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch((_call, count) => errorResponse(503, {
      code: 503, message: count === 1 ? 'first endpoint down' : 'last endpoint down',
    }));
    await assert.rejects(invoke(kind, api, pool, fetchFn), /last endpoint down/);
    assert.deepEqual(calls.map(call => call.endpoint), endpoints);
    assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
  });

  test(`${kind}: a network failure after 503 preserves the earlier response`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch((_call, count) => {
      if (count === 1) return errorResponse(503, { code: 503, message: 'first endpoint diagnostic' });
      throw new Error('simulated connection reset');
    });
    await assert.rejects(invoke(kind, api, pool, fetchFn), /first endpoint diagnostic/);
    assert.deepEqual(calls.map(call => call.endpoint), endpoints);
    assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
  });

  for (const [label, frame] of [
    ['root', { error: tosError }],
    ['nested', { response: { error: tosError } }],
  ]) {
    test(`${kind}: ${label} SSE error retains TOS reason and appeal`, async () => {
      const api = runtime(), pool = accountPool();
      const { calls, fetchFn } = mockFetch(() => sseResponse(frame));
      await assert.rejects(invoke(kind, api, pool, fetchFn), assertTos);
      assert.equal(calls.length, 1);
      assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
      assert.deepEqual(pool.cooldowns, []);
    });
  }

  test(`${kind}: SSE error without TOS reason remains ordinary`, async () => {
    const api = runtime(), pool = accountPool();
    const { calls, fetchFn } = mockFetch(() => sseResponse({ error: ordinaryError }));
    await assert.rejects(invoke(kind, api, pool, fetchFn), assertOrdinary403);
    assert.equal(calls.length, 1);
    assert.deepEqual(pool.selected.map(entry => entry.id), ['one']);
  });
}

test('chat: split UTF-8 SSE chunks are decoded and emitted normally', async () => {
  const api = runtime(), pool = accountPool();
  const wire = new TextEncoder().encode(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: '你好' }] }, finishReason: 'STOP' }] } })}\n\ndata: [DONE]\n\n`);
  const split = wire.indexOf(0xe4) + 1;
  assert.ok(split > 0);
  const { fetchFn } = mockFetch(() => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(wire.slice(0, split));
      controller.enqueue(wire.slice(split, split + 1));
      controller.enqueue(wire.slice(split + 1));
      controller.close();
    },
  }), { headers: { 'content-type': 'text/event-stream' } }));
  const chunks = await invoke('chat', api, pool, fetchFn);
  assert.equal(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.text).join(''), '你好');
  assert.equal(chunks.filter(chunk => chunk.type === 'finish').length, 1);
});

for (const target of ['postJson', 'login']) {
  async function call(api, fetchFn) {
    return target === 'postJson'
      ? api.postJson('/v1internal:retrieveUserQuotaSummary', 'ACCESS_ONE', {}, fetchFn)
      : api.discoverAntigravityProject('ACCESS_ONE', fetchFn, signal());
  }
  for (const [name, status, error, check] of [
    ['TOS 403', 403, tosError, assertTos],
    ['ordinary 403', 403, ordinaryError, assertOrdinary403],
    ['429', 429, { code: 429, message: 'quota exhausted' }, error => { assert.match(String(error.message), /429|quota/i); return true; }],
  ]) {
    test(`${target}: ${name} stops at the first endpoint`, async () => {
      const api = runtime();
      const { calls, fetchFn } = mockFetch(() => errorResponse(status, error));
      await assert.rejects(call(api, fetchFn), check);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].endpoint, endpoints[0]);
    });
  }
  test(`${target}: 5xx still falls back`, async () => {
    const api = runtime();
    const { calls, fetchFn } = mockFetch((_call, count) => count === 1
      ? errorResponse(503, { code: 503, message: 'unavailable' })
      : Response.json({ projectId: 'project-recovered' }));
    const result = await call(api, fetchFn);
    assert.deepEqual(calls.map(call => call.endpoint), endpoints);
    assert.equal(target === 'postJson' ? result.data.projectId : result, 'project-recovered');
  });
}

const quotaPaths = ['/v1internal:loadCodeAssist', '/v1internal:retrieveUserQuotaSummary', '/v1internal:fetchAvailableModels'];
function quotaSuccess(path) {
  if (path === quotaPaths[0]) return Response.json({ projectId: 'project-test', currentTier: { name: 'Test plan' } });
  if (path === quotaPaths[1]) return Response.json({ groups: [{ displayName: 'Gemini', buckets: [{ displayName: 'requests', remainingFraction: 0.5 }] }] });
  assert.equal(path, quotaPaths[2]);
  return Response.json({ models: { 'gemini-test': { displayName: 'Test model' } } });
}

for (const [failedIndex, failedPath] of quotaPaths.entries()) {
  test(`quota: TOS from ${failedPath} stops later RPCs and a retry recovers`, async () => {
    const api = runtime(), pool = accountPool();
    let failing = true;
    const { calls, fetchFn } = mockFetch(call => failing && call.path === failedPath
      ? errorResponse(403, tosError)
      : quotaSuccess(call.path));
    await assert.rejects(api.fetchAccountQuota({}, undefined, fetchFn, true, pool), assertTos);
    assert.deepEqual(calls.map(call => call.path), quotaPaths.slice(0, failedIndex + 1));
    assert.equal(api.getCachedQuota(), undefined, 'a failed refresh must not cache an empty success');
    failing = false;
    const snapshot = await api.fetchAccountQuota({}, undefined, fetchFn, true, pool);
    assert.deepEqual(calls.slice(failedIndex + 1).map(call => call.path), quotaPaths);
    assert.equal(snapshot.projectId, 'project-test');
    assert.equal(snapshot.groups[0].buckets[0].remainingFraction, 0.5);
    assert.equal(snapshot.models[0].modelId, 'gemini-test');
  });
}

test('quota: ordinary 403 is not described as a disabled account', async () => {
  const api = runtime(), pool = accountPool();
  const { calls, fetchFn } = mockFetch(() => errorResponse(403));
  await assert.rejects(api.fetchAccountQuota({}, undefined, fetchFn, true, pool), assertOrdinary403);
  assert.deepEqual(calls.map(call => call.path), [quotaPaths[0]]);
});

test('quota: 429 stops immediately without falling back or caching success', async () => {
  const api = runtime(), pool = accountPool();
  const { calls, fetchFn } = mockFetch(() => errorResponse(429, { code: 429, message: 'quota exhausted' }));
  await assert.rejects(api.fetchAccountQuota({}, undefined, fetchFn, true, pool), /429|quota/i);
  assert.deepEqual(calls.map(call => [call.endpoint, call.path]), [[endpoints[0], quotaPaths[0]]]);
  assert.equal(api.getCachedQuota(), undefined);
});

test('quota: exhausted 5xx falls back per RPC but does not cache empty success', async () => {
  const api = runtime(), pool = accountPool();
  const { calls, fetchFn } = mockFetch(() => errorResponse(503, { code: 503, message: 'unavailable' }));
  await assert.rejects(api.fetchAccountQuota({}, undefined, fetchFn, true, pool));
  assert.deepEqual(calls.map(call => [call.endpoint, call.path]), quotaPaths.flatMap(path => endpoints.map(endpoint => [endpoint, path])));
  assert.equal(api.getCachedQuota(), undefined);
});

function routeHarness(api, fetchFn) {
  const pool = accountPool();
  let activeId = 'one';
  pool.listAccounts = async () => [{ id: 'one' }, { id: 'two' }];
  pool.read = async () => ({ accounts: [{ id: 'one' }, { id: 'two' }], activeAccountId: activeId });
  pool.setPrimary = async id => { activeId = id; };
  pool.core.getFreshCredential = async () => ({ access: `ACCESS_${activeId.toUpperCase()}`, projectId: 'project-test' });
  const store = { read: async () => ({ access: 'ACCESS_TEST' }), path: () => '/memory-only' };
  const settings = {
    read: async () => ({ enabledModelIds: [], catalogModels: [], contextWindowOverrides: {} }),
    setCatalogModels: async () => {},
  };
  let handler;
  api.registerAntigravityRoutes({ webServer: { register(route) { handler = route.handler; return () => {}; } } }, store, settings, undefined, fetchFn, pool);
  assert.equal(typeof handler, 'function');
  return async (path, method = 'GET', body) => {
    const request = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
    request.method = method;
    request.url = `/wb/antigravity/api/${path}`;
    let status, result;
    await handler(request, {
      writeHead(code) { status = code; },
      end(text) { result = JSON.parse(text); },
    });
    return { status, ...result };
  };
}

test('status: automatic TOS is visible and polling stays stopped until account switch', async () => {
  const api = runtime();
  const { calls, fetchFn } = mockFetch(() => errorResponse(403, tosError));
  const request = routeHarness(api, fetchFn);
  const initial = await request('status');
  assert.equal(initial.status, 200);
  assertTos({ message: initial.value.quotaError });
  assert.equal(calls.length, 1);
  const repeated = await request('status');
  assert.equal(repeated.value.quotaError, initial.value.quotaError);
  assert.equal(calls.length, 1, 'status must not retry the disabled account');
  const changed = await request('accounts', 'POST', { action: 'set-primary', accountId: 'two' });
  assert.equal(changed.status, 200);
  assert.equal(changed.value.activeAccountId, 'two');
  const next = await request('status');
  assertTos({ message: next.value.quotaError });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].authorization, 'Bearer ACCESS_TWO');
  await request('status');
  assert.equal(calls.length, 2);
});

for (const cached of [false, true]) {
  test(`status: old-account TOS cannot suppress the new account (${cached ? 'background refresh' : 'cold start'})`, async () => {
    let now = 1_700_000_000_000;
    const api = runtime(() => now);
    let started;
    const hasStarted = new Promise(resolve => { started = resolve; });
    let release;
    const oldResponse = new Promise(resolve => { release = resolve; });
    let holdOld = !cached;
    const { calls, fetchFn } = mockFetch(call => {
      if (holdOld && call.authorization === 'Bearer ACCESS_ONE') {
        started();
        return oldResponse;
      }
      return quotaSuccess(call.path);
    });
    const request = routeHarness(api, fetchFn);
    if (cached) {
      const initial = await request('quota', 'POST');
      assert.equal(initial.status, 200);
      holdOld = true;
      now += 121_000;
    }
    const oldStatus = request('status');
    await hasStarted;
    const changed = await request('accounts', 'POST', { action: 'set-primary', accountId: 'two' });
    assert.equal(changed.status, 200);
    release(errorResponse(403, tosError));
    await oldStatus;
    // Give the real background refresh's promise/finally handlers a chance to settle.
    await new Promise(resolve => setImmediate(resolve));
    const fresh = await request('status');
    assert.equal(fresh.status, 200);
    assert.equal(fresh.value.activeAccountId, 'two');
    assert.equal(fresh.value.quotaError, null, 'the old account error must not reach the new account');
    assert.equal(fresh.value.quota.groups[0].buckets[0].remainingFraction, 0.5);
    assert.deepEqual(calls.filter(call => call.authorization === 'Bearer ACCESS_TWO').map(call => call.path), quotaPaths);
    assert.equal((await request('status')).value.quotaError, null);
  });
}

for (const outcome of ['TOS', 'success']) {
  test(`quota: old manual ${outcome} after account switch cannot poison new status`, async () => {
    const api = runtime();
    let started;
    const hasStarted = new Promise(resolve => { started = resolve; });
    let release;
    const oldResponse = new Promise(resolve => { release = resolve; });
    let held = false;
    const { calls, fetchFn } = mockFetch(call => {
      if (!held && call.authorization === 'Bearer ACCESS_ONE') {
        held = true;
        started();
        return oldResponse;
      }
      return quotaSuccess(call.path);
    });
    const request = routeHarness(api, fetchFn);
    const manual = request('quota', 'POST');
    await hasStarted;
    const changed = await request('accounts', 'POST', { action: 'set-primary', accountId: 'two' });
    assert.equal(changed.status, 200);
    release(outcome === 'TOS' ? errorResponse(403, tosError) : quotaSuccess(quotaPaths[0]));
    const old = await manual;
    assert.notEqual(old.status, 200, 'stale quota must not be returned as belonging to the new account');
    const fresh = await request('status');
    assert.equal(fresh.status, 200);
    assert.equal(fresh.value.activeAccountId, 'two');
    assert.equal(fresh.value.quotaError, null, 'stale manual result must not block or taint the new account');
    assert.equal(fresh.value.quota.groups[0].buckets[0].remainingFraction, 0.5);
    assert.deepEqual(calls.filter(call => call.authorization === 'Bearer ACCESS_TWO').map(call => call.path), quotaPaths);
  });
}

test('status: a failed manual quota refresh stops polling; manual success resets it', async () => {
  let now = 1_700_000_000_000;
  const api = runtime(() => now);
  let failing = true;
  const { calls, fetchFn } = mockFetch(call => failing ? errorResponse(403, tosError) : quotaSuccess(call.path));
  const request = routeHarness(api, fetchFn);
  const manualFailure = await request('quota', 'POST');
  assert.equal(manualFailure.status, 500);
  assertTos({ message: manualFailure.error });
  assert.equal(calls.length, 1);
  const stopped = await request('status');
  assertTos({ message: stopped.value.quotaError });
  await request('status');
  assert.equal(calls.length, 1, 'manual TOS failure must also suppress status polling');
  failing = false;
  const manualSuccess = await request('quota', 'POST');
  assert.equal(manualSuccess.status, 200);
  assert.equal(manualSuccess.value.quota.groups[0].buckets[0].remainingFraction, 0.5);
  assert.equal(calls.length, 4);
  const recovered = await request('status');
  assert.equal(recovered.value.quotaError, null);
  assert.equal(calls.length, 4, 'fresh quota should be served from cache');
  now += 121_000;
  await request('status');
  for (let i = 0; i < 20 && calls.length < 7; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 7, 'automatic polling must resume when the successful snapshot expires');
  assert.equal((await request('status')).value.quotaError, null);
});

test('quota: one unavailable RPC does not prevent the other data from loading', async () => {
  const api = runtime(), pool = accountPool();
  const { calls, fetchFn } = mockFetch(call => call.path === quotaPaths[0]
    ? errorResponse(503, { code: 503, message: 'unavailable' })
    : quotaSuccess(call.path));
  const snapshot = await api.fetchAccountQuota({}, undefined, fetchFn, true, pool);
  assert.deepEqual(calls.map(call => [call.endpoint, call.path]), [
    [endpoints[0], quotaPaths[0]], [endpoints[1], quotaPaths[0]],
    [endpoints[0], quotaPaths[1]], [endpoints[0], quotaPaths[2]],
  ]);
  assert.equal(snapshot.groups[0].buckets[0].remainingFraction, 0.5);
  assert.equal(snapshot.models[0].modelId, 'gemini-test');
});
