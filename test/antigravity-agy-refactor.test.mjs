import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const bundlePath = new URL('../lib/index.js', import.meta.url);
const bundle = fs.readFileSync(bundlePath, 'utf8');

function extractRegion(name) {
  const start = bundle.indexOf(`//#region src/host/${name}`);
  assert.ok(start >= 0, `missing region ${name}`);
  const end = bundle.indexOf('//#endregion', start);
  assert.ok(end > start, `unterminated region ${name}`);
  return bundle.slice(start, end + '//#endregion'.length);
}

function extractSection(anchor) {
  const idx = bundle.indexOf(anchor);
  assert.ok(idx >= 0, `missing anchor ${anchor}`);
  const start = bundle.lastIndexOf('//#region', idx);
  const end = bundle.indexOf('//#endregion', idx);
  return bundle.slice(start, end + '//#endregion'.length);
}

class FakeLlmError extends Error {
  constructor(message, code, extra = {}) {
    super(message, extra);
    this.code = code;
    Object.assign(this, extra);
  }
}

function loadSandbox(customEnv = {}) {
  let now = 1_800_000_000_000;
  class FakeDate extends Date {
    static now() { return now; }
  }
  const calls = [];
  let responder = async () => new Response('not mocked', { status: 500 });
  const fakeFetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return responder(String(url), init, calls.length);
  };
  const ctx = vm.createContext({
    AbortSignal, Buffer, Date: FakeDate, Error, Map, Math, Set, TextDecoder, URL, URLSearchParams$1: URLSearchParams,
    structuredClone, createHash, randomBytes, randomUUID, path,
    isDeepStrictEqual: (a, b) => isDeepStrictEqual(structuredClone(a), structuredClone(b)),
    process: { platform: 'win32', arch: 'x64', env: { ...customEnv } },
    fetch: fakeFetch,
    setTimeout, clearTimeout,
    LlmAdapter: class {},
    LlmError: FakeLlmError,
    LlmError$1: FakeLlmError,
    HarnessError: FakeLlmError,
    ReasoningEffortId: x => x,
    CONTEXT_OVERFLOW_CODE: 'CONTEXT_OVERFLOW',
    ANTIGRAVITY_IMAGE_MODEL: 'gemini-3.1-flash-image',
    ANTIGRAVITY_IMAGE_TOOL_NAME: 'antigravity_image_generate',
    PLUGIN_MESSAGE_SOURCE_KIND: 'plugin-notice',
    outputReservation: () => ({}),
    defineTool: x => x,
    createUserMessage$1: x => x,
    normalizeGenerateOptions: x => x,
    offloadOldestRequestImages$4: x => x,
    resolveRequestImages$4: async () => new Map(),
    NO_RESOLVED_IMAGES$6: new Map(),
    sanitizeText$8: x => x,
    toToolCallId: x => x,
    errorChain: e => String(e),
    isHttpContextOverflow: () => false,
    isContextOverflow: () => false,
  });

  const code = [
    extractSection('const MIN_COOLDOWN_MS ='),
    extractRegion('antigravity/types'),
    extractSection('function parseAntigravityCredentials('),
    extractRegion('antigravity/port-constants'),
    extractRegion('antigravity/oauth'),
    extractRegion('antigravity/catalog-limits'),
    extractRegion('antigravity/tool-schema'),
    extractRegion('antigravity/mapper'),
    extractRegion('antigravity/cache-stats'),
    extractRegion('antigravity/account-pool'),
    extractRegion('antigravity/adapter'),
    extractRegion('antigravity/image-tool'),
  ].join('\n');

  vm.runInContext(code, ctx, { filename: 'ag-refactor-sandbox.js' });
  const exports = vm.runInContext(`({
    ANTIGRAVITY_SYSTEM_INSTRUCTION,
    FALLBACK_PROJECT_ID,
    MODELS,
    ROUTING,
    antigravityHeaders,
    antigravityControlPlaneHeaders,
    buildRequest: buildRequest$2,
    buildImageRequest,
    quotaFamilyForModel,
    AccountPoolStore,
    AntigravityAdapter,
    accountQuotaCache,
  })`, ctx);

  return {
    ...exports,
    calls,
    fakeFetch,
    setResponder(fn) { responder = fn; },
    advanceTime(ms) { now += ms; },
    getNow() { return now; },
  };
}

function makeMemoryPool(sb, initialAccounts) {
  let state = {
    version: 1,
    rotationStrategy: 'sticky',
    accounts: structuredClone(initialAccounts),
  };
  const backend = {
    storage: { kind: 'memory', encrypted: true },
    async load() { return structuredClone(state); },
    async save(next) { state = structuredClone(next); },
    async clear() { state = { version: 1, rotationStrategy: 'sticky', accounts: [] }; },
  };
  const legacy = { async read() { return null; }, async write() {}, async delete() {}, path() { return 'mem'; } };
  return new sb.AccountPoolStore('MEM_POOL', backend, legacy);
}

test('wire identity: official two-sentence persona, 4 clean headers, agent-<uuid> requestId, rising-fact-p41fc fallback', () => {
  const sb = loadSandbox();
  assert.equal(
    sb.ANTIGRAVITY_SYSTEM_INSTRUCTION,
    'You are Antigravity, a powerful agentic AI coding assistant designed by the Google Deepmind team working on Advanced Agentic Coding. You are pair programming with a USER to solve their coding task.',
  );
  assert.equal(sb.FALLBACK_PROJECT_ID, 'rising-fact-p41fc');

  const headers = sb.antigravityHeaders('tok_test');
  assert.deepEqual(Object.keys(headers).sort(), ['Accept', 'Authorization', 'Content-Type', 'User-Agent']);
  assert.match(headers['User-Agent'], /^antigravity\/hub\/2\.29\.0 \(aidev_client; os_type=windows; arch=amd64; cl=1013060670\)$/);

  const cpHeaders = sb.antigravityControlPlaneHeaders('tok_test');
  assert.match(cpHeaders['User-Agent'], /google-api-nodejs-client\/10\.3\.0$/);
  assert.equal(cpHeaders['X-Goog-Api-Client'], 'gl-node/22.21.1');

  const body = sb.buildRequest(
    { messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], system: 'Custom DSH prompt' },
    { id: 'gemini-3.8-flash' },
    sb.FALLBACK_PROJECT_ID,
    'gemini-3.8-flash-tiered',
    'medium',
  );
  assert.match(body.requestId, /^agent-[0-9a-f-]{36}$/i);
  assert.equal(body.project, 'rising-fact-p41fc');
  assert.equal(body.request.systemInstruction.parts.length, 2);
  assert.equal(body.request.systemInstruction.parts[0].text, sb.ANTIGRAVITY_SYSTEM_INSTRUCTION);
  assert.equal(body.request.systemInstruction.parts[1].text, 'Custom DSH prompt');
  assert.ok(!JSON.stringify(body).includes('[ignore]'), 'must not include anti-fingerprint trigger [ignore]');

  const imgBody = sb.buildImageRequest('a cat', sb.FALLBACK_PROJECT_ID, '16:9', '2K');
  assert.match(imgBody.requestId, /^agent-[0-9a-f-]{36}$/i);
  assert.deepEqual({ ...imgBody.request.generationConfig.imageConfig }, { aspectRatio: '16:9', imageSize: '2K' });
});

test('catalog cleanup: retired Gemini 3.5/3.6/3.7 Flash removed from picker but safely routed to 3.8-flash-tiered', () => {
  const sb = loadSandbox();
  const ids = sb.MODELS.map(m => m.id);
  assert.ok(!ids.includes('gemini-3.7-flash'));
  assert.ok(!ids.includes('gemini-3.6-flash'));
  assert.ok(!ids.includes('gemini-3.5-flash'));
  assert.ok(ids.includes('gemini-3.8-flash'));
  assert.ok(ids.includes('gemini-4-argon'));
  assert.ok(ids.includes('claude-sonnet-5-5'));
  assert.equal(sb.ROUTING['gemini-3.7-flash'].defaultRequestId, 'gemini-3.8-flash-tiered');
  assert.equal(sb.ROUTING['gemini-3.6-flash'].defaultRequestId, 'gemini-3.8-flash-tiered');
  assert.equal(sb.ROUTING['gemini-3.5-flash'].defaultRequestId, 'gemini-3.8-flash-tiered');
});

test('3-bucket family isolation (dsh-agy-link parity): Argon, Gemini, and Claude/GPT cool down independently', async () => {
  const sb = loadSandbox();
  assert.equal(sb.quotaFamilyForModel('gemini-4-argon'), 'argon');
  assert.equal(sb.quotaFamilyForModel('gemini-3.8-flash'), 'gemini');
  assert.equal(sb.quotaFamilyForModel('claude-sonnet-5-5'), 'claude-gpt');
  assert.equal(sb.quotaFamilyForModel('gpt-oss-120b'), 'claude-gpt');

  const now = sb.getNow();
  const pool = makeMemoryPool(sb, [{
    id: 'acc_1', alias: 'One', isPrimary: true, addedAt: now - 1000,
    credentials: { access: 'tok_1', refresh: 'ref_1', expires: now + 3_600_000 },
  }]);

  pool.markFamilyCooldown('acc_1', 'argon', 600_000, '429 Argon');
  await assert.rejects(pool.getEffectiveAccountFor('argon', undefined, sb.fakeFetch), /Gemini 4 Argon/);
  const geminiPick = await pool.getEffectiveAccountFor('gemini', undefined, sb.fakeFetch);
  assert.equal(geminiPick.account.id, 'acc_1');
  const claudePick = await pool.getEffectiveAccountFor('claude-gpt', undefined, sb.fakeFetch);
  assert.equal(claudePick.account.id, 'acc_1');
});

test('expiry-first rotation & quota benching & per-account proxyUrl', async () => {
  const sb = loadSandbox();
  const now = sb.getNow();
  const pool = makeMemoryPool(sb, [
    {
      id: 'acc_late', alias: 'Late', isPrimary: true, addedAt: now - 2000,
      credentials: { access: 'tok_late', refresh: 'ref_late', expires: now + 3_600_000 },
    },
    {
      id: 'acc_soon', alias: 'Soon', isPrimary: false, addedAt: now - 1000,
      credentials: { access: 'tok_soon', refresh: 'ref_soon', expires: now + 3_600_000 },
    },
  ]);
  await pool.setStrategy('expiry-first');
  await pool.setAccountProxy('acc_soon', 'http://127.0.0.1:7899');

  sb.accountQuotaCache.set('acc_late', {
    fetchedAt: now,
    groups: [{ displayName: 'Gemini Models', buckets: [{ window: 'weekly', remainingFraction: 0.8, resetTime: new Date(now + 5 * 86400_000).toISOString() }] }],
  });
  sb.accountQuotaCache.set('acc_soon', {
    fetchedAt: now,
    groups: [{ displayName: 'Gemini Models', buckets: [{ window: 'weekly', remainingFraction: 0.8, resetTime: new Date(now + 1 * 86400_000).toISOString() }] }],
  });

  const picked = await pool.getEffectiveAccountFor('gemini', undefined, sb.fakeFetch);
  assert.equal(picked.account.id, 'acc_soon', 'should pick account whose weekly window expires soonest');
  assert.equal(picked.account.proxyUrl, 'http://127.0.0.1:7899');

  // If acc_soon is exhausted (remainingFraction = 0), bench it automatically and pick acc_late
  sb.accountQuotaCache.set('acc_soon', {
    fetchedAt: now,
    groups: [{ displayName: 'Gemini Models', buckets: [{ window: '5h', remainingFraction: 0, resetTime: new Date(now + 3600_000).toISOString() }] }],
  });
  const fallback = await pool.getEffectiveAccountFor('gemini', undefined, sb.fakeFetch);
  assert.equal(fallback.account.id, 'acc_late');
});

test('bare 429 uses short 5s transient avoidance instead of 15-min lock, and <=15s Retry-After waits out automatically', async () => {
  const sb = loadSandbox({ DSH_ANTIGRAVITY_ENDPOINT: 'https://daily-cloudcode-pa.googleapis.com' });
  const now = sb.getNow();
  const pool = makeMemoryPool(sb, [{
    id: 'acc_single', alias: 'Single', isPrimary: true, addedAt: now - 1000,
    credentials: { access: 'tok_single', refresh: 'ref_single', expires: now + 3_600_000, projectId: 'proj_1' },
  }]);
  const adapter = new sb.AntigravityAdapter({}, {}, undefined, { fetchFn: sb.fakeFetch }, pool);
  const model = { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', inputModalities: ['text'], contextWindow: 1048576, maxTokens: 65536 };
  const opts = { model: 'gemini-3.8-flash', messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }] };

  // 1) Bare 429 without Retry-After -> cools only 5s (not 15m), so advancing 6s unlocks immediately
  sb.setResponder(async () => Response.json({ error: { code: 429, message: 'Resource has been exhausted' } }, { status: 429 }));
  await assert.rejects(async () => {
    for await (const _ of adapter.requestStream(opts, model, new AbortController().signal, undefined, [])) {}
  }, err => err.code === 'RATE_LIMIT');
  assert.ok(pool.shortestFamilyCooldownMs('gemini') <= 5000);
  sb.advanceTime(6000);
  assert.equal(pool.shortestFamilyCooldownMs('gemini'), null, 'account unlocked after 6s');

  // 2) Short Retry-After (1s) on single account -> waits out in-place and succeeds on automatic replay!
  let attempt = 0;
  sb.setResponder(async () => {
    attempt += 1;
    if (attempt === 1) {
      return Response.json({ error: { code: 429, message: 'short rate limit' } }, { status: 429, headers: { 'retry-after': '1' } });
    }
    const frame = { response: { candidates: [{ content: { parts: [{ text: 'RECOVERED_OK' }] }, finishReason: 'STOP' }] } };
    return new Response(`data: ${JSON.stringify(frame)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  });
  const chunks = [];
  for await (const c of adapter.requestStream(opts, model, new AbortController().signal, undefined, [])) chunks.push(c);
  assert.equal(attempt, 2);
  assert.equal(chunks.filter(c => c.type === 'text-delta').map(c => c.text).join(''), 'RECOVERED_OK');
});
