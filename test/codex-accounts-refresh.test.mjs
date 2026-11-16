import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const bundle = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8');
const NOW = 1_800_000_000_000;
const jwt = claims => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test`;
const credential = (member, extra = {}) => ({
  accessToken: jwt({ 'https://api.openai.com/auth': { chatgpt_account_id: 'team-shared', chatgpt_user_id: member } }),
  refreshToken: `refresh-${member}`,
  accountId: 'team-shared',
  email: `${member}@example.test`,
  expiresAt: NOW + 3_600_000,
  ...extra,
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
function section(startText) {
  const start = bundle.indexOf(startText);
  assert(start >= 0, `Missing bundle section: ${startText}`);
  const end = bundle.indexOf('\n//#endregion', start);
  assert(end > start);
  return bundle.slice(start, end);
}
function runtime(fetchFn = async () => { throw new Error('Unexpected test network call'); }) {
  const timers = [];
  const cleared = [];
  let now = NOW;
  const timeouts = [];
  const warnings = [];
  class LlmError extends Error {
    constructor(message, code, details = {}) { super(message); this.code = code; Object.assign(this, details); }
  }
  const context = vm.createContext({
    Buffer, URLSearchParams, AbortController, createHash, randomBytes, path,
    Date: class extends Date { static now() { return now; } },
    process: { platform: 'win32', env: {} },
    dshHomeDir: () => 'F:\\TEST-ONLY-NO-IO',
    structuredClone,
    // Compare data, not the VM/host realm prototypes.
    isDeepStrictEqual: (a, b) => isDeepStrictEqual(structuredClone(a), structuredClone(b)),
    LlmError, ConcurrencyGate: class {},
    TOKEN_REFRESH_MARGIN_MS: 60_000,
    CODEX_CLI_CREDENTIAL_SOURCE: 'codex',
    ADOPTED_CODEX_CREDENTIAL_EXPIRED_HINT: 'CLI snapshot expired',
    isAdoptedCodexCredentialExpired: value => value.expiresAt <= now,
    OAUTH_TOKEN_URL$1: 'https://oauth.test.invalid/token',
    CHATGPT_OAUTH_CLIENT_ID: 'test-client',
    fetch: fetchFn,
    AbortSignal: {
      any: signals => AbortSignal.any(signals),
      timeout: ms => { timeouts.push(ms); return AbortSignal.timeout(ms); },
    },
    setInterval: () => { throw new Error('Credential refresh must not poll'); },
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cancelled: false, unreferenced: false, unref() { this.unreferenced = true; } };
      timers.push(timer);
      return timer;
    },
    clearTimeout: timer => { if (timer !== undefined) { timer.cancelled = true; cleared.push(timer); } },
  });
  vm.runInContext([
    section('function parseStoredCredentials('),
    section('const MIN_COOLDOWN_MS ='),
    section('var OAuthServiceError ='),
    section('function isAdoptedCodexPoolCredential('),
  ].join('\n'), context);
  const api = vm.runInContext('({ CodexAccountPool, OAuthService, codexAccountKey, refreshKey })', context);
  let data = null;
  let mirror = null;
  const saves = [];
  const store = {
    storage: { kind: 'test-memory', encrypted: false },
    load: async () => structuredClone(mirror),
    save: async value => { mirror = structuredClone(value); saves.push(structuredClone(value)); },
    clear: async () => { mirror = null; },
  };
  const backend = {
    load: async () => structuredClone(data),
    save: async value => { data = structuredClone(value); },
  };
  const pool = new api.CodexAccountPool({ store, backend });
  const oauth = new api.OAuthService(store, {
    pool, fetchFn, now: () => now,
    logger: { info() {}, warn: message => warnings.push(message) },
  });
  return { ...api, pool, oauth, timers, cleared, timeouts, warnings, saves, advance: ms => { now += ms; }, mirror: () => mirror };
}

test('same Team members stay separate; same member re-login preserves row id and alias', async () => {
  const { pool } = runtime();
  const original = await pool.addAccount(credential('alice'), 'My Alice');
  await pool.addAccount(credential('bob'), 'My Bob');
  await pool.addAccount(credential('carol'), 'My Carol');
  const relogged = await pool.addAccount(credential('alice', { refreshToken: 'new-alice-grant' }));
  const data = await pool.read();
  assert.equal(data.accounts.length, 3);
  assert.equal(relogged.id, original.id);
  assert.equal(relogged.alias, 'My Alice');
  assert.equal(data.accounts.find(a => a.id === original.id).credentials.refreshToken, 'new-alice-grant');
  assert.equal(data.accounts.find(a => a.alias === 'My Bob').credentials.refreshToken, 'refresh-bob');
});

test('identity uses stable JWT user id, normalized email fallback, and never workspace-only', async () => {
  const { pool, codexAccountKey } = runtime();
  const noClaims = { accessToken: 'opaque', refreshToken: 'grant-one', accountId: 'team-shared', email: ' Person@Example.Test ', expiresAt: NOW + 100_000 };
  const first = await pool.addAccount(noClaims, 'Saved alias');
  const same = await pool.addAccount({ ...noClaims, email: 'person@example.test', refreshToken: 'grant-two' });
  assert.equal(same.id, first.id);
  assert.equal(same.alias, 'Saved alias');
  assert.notEqual(codexAccountKey(noClaims), codexAccountKey({ ...noClaims, accountId: 'another-team' }));
  assert.equal(codexAccountKey({ ...noClaims, email: undefined }), undefined);
  const missing = { ...noClaims, email: undefined };
  await pool.addAccount(missing);
  await pool.addAccount({ ...missing, refreshToken: 'grant-three' });
  assert.equal((await pool.read()).accounts.length, 3);
  const stable = credential('stable', { idToken: jwt({ sub: 'subject-old' }) });
  assert.equal(codexAccountKey(stable), codexAccountKey({ ...stable, idToken: jwt({ sub: 'subject-new' }) }));
  assert.notEqual(codexAccountKey(credential('different-one')), codexAccountKey(credential('different-two', { email: 'different-one@example.test' })));
});

test('default capacity remains 20 and re-login at capacity updates in place', async () => {
  const { pool } = runtime();
  const first = await pool.addAccount(credential('member-0'), 'First');
  for (let i = 1; i < 20; i++) await pool.addAccount(credential(`member-${i}`));
  await assert.rejects(pool.addAccount(credential('member-20')), /20/);
  const renewed = await pool.addAccount(credential('member-0', { refreshToken: 'new-grant' }));
  assert.equal(renewed.id, first.id);
  assert.equal(renewed.alias, 'First');
  assert.equal((await pool.read()).accounts.length, 20);
});

test('OAuth singleflight shares only an identical grant, never a Team workspace', async () => {
  const gate = deferred();
  const calls = [];
  const { oauth, refreshKey, timeouts } = runtime(async (_url, init) => {
    const token = new URLSearchParams(init.body).get('refresh_token');
    calls.push(token);
    assert.ok(init.signal);
    await gate.promise;
    return Response.json({ access_token: `access-${token}`, refresh_token: `${token}-rotated`, expires_in: 3600 });
  });
  const alice = credential('alice');
  const bob = credential('bob');
  assert.notEqual(refreshKey(alice), refreshKey(bob));
  assert.equal(refreshKey(alice), refreshKey({ ...alice, accountId: 'different-workspace' }));
  const tasks = [oauth.refreshAccount(alice), oauth.refreshAccount(alice), oauth.refreshAccount(bob)];
  assert.deepEqual(calls, ['refresh-alice', 'refresh-bob']);
  gate.resolve();
  const [a, same, b] = await Promise.all(tasks);
  assert.equal(a.refreshToken, 'refresh-alice-rotated');
  assert.equal(same.refreshToken, a.refreshToken);
  assert.equal(b.refreshToken, 'refresh-bob-rotated');
  assert.equal(oauth.refreshInFlight.size, 0);
  assert.deepEqual(timeouts, [30_000, 30_000]);
  oauth.dispose();
});

test('background starts explicitly, checks every managed due account and isolates failures', async () => {
  const calls = [];
  const r = runtime(async (_url, init) => {
    const token = new URLSearchParams(init.body).get('refresh_token');
    calls.push(token);
    if (token === 'refresh-bad') return Response.json({ error: 'invalid_grant' }, { status: 400 });
    return Response.json({ access_token: `next-${token}`, refresh_token: `next-${token}`, expires_in: 3600 });
  });
  const primary = await r.pool.addAccount(credential('good', { expiresAt: NOW + 300_000 }));
  await r.pool.addAccount(credential('bad', { expiresAt: NOW - 1000 }));
  await r.pool.addAccount(credential('later', { expiresAt: NOW + 7_200_000 }));
  await r.pool.addAccount(credential('cli', { expiresAt: NOW - 1000, adopted: true, source: 'codex' }));
  assert.equal(r.timers.length, 0);
  assert.deepEqual(calls, []);
  r.oauth.startBackgroundRefresh();
  r.oauth.startBackgroundRefresh();
  const results = await r.oauth.backgroundRefreshPromise;
  assert.equal(r.timers.length, 1);
  assert.equal(r.timers[0].ms, 3_300_000);
  assert.equal(r.timers[0].unreferenced, true);
  assert.deepEqual(calls.sort(), ['refresh-bad', 'refresh-good']);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const data = await r.pool.read();
  assert.equal(data.accounts.length, 4);
  assert.equal(data.accounts.find(a => a.credentials.email === 'bad@example.test').authStatus, 'expired');
  assert.equal(data.accounts.find(a => a.credentials.email === 'cli@example.test').credentials.refreshToken, 'refresh-cli');
  assert.equal(data.accounts.find(a => a.id === primary.id).credentials.refreshToken, 'next-refresh-good');
  assert.equal(r.mirror().refreshToken, 'next-refresh-good');
  assert.equal(calls.length, 2);
  assert.equal(r.timers.at(-1).ms, 3_300_000);
  r.oauth.dispose();
  r.oauth.dispose();
  assert.equal(r.timers.at(-1).cancelled, true);
  assert.equal(r.oauth.backgroundRefreshTimer, undefined);
});

test('background and foreground join one flight; stale generation cannot force a second refresh', async () => {
  const gate = deferred();
  const began = deferred();
  let calls = 0;
  const r = runtime(async () => {
    calls++;
    began.resolve();
    await gate.promise;
    return Response.json({ access_token: 'new-access', refresh_token: 'rotated-once', expires_in: 3600 });
  });
  await r.pool.addAccount(credential('alice', { expiresAt: NOW + 30_000 }));
  const row = (await r.pool.read()).accounts[0];
  r.oauth.startBackgroundRefresh();
  await began.promise;
  const foreground = r.pool.getFreshCredential(row.id);
  const overlappingTick = r.oauth.refreshManagedAccounts();
  gate.resolve();
  const [fresh] = await Promise.all([foreground, r.oauth.backgroundRefreshPromise, overlappingTick]);
  assert.equal(fresh.refreshToken, 'rotated-once');
  assert.equal(calls, 1);
  const staleResult = await r.pool.freshAccount(row, r.oauth.fetchFn, true);
  assert.equal(staleResult.credentials.refreshToken, 'rotated-once');
  assert.equal(calls, 1);
  r.oauth.dispose();
});

test('non-primary refresh does not replace legacy primary mirror; primary refresh does', async () => {
  const r = runtime(async (_url, init) => {
    const token = new URLSearchParams(init.body).get('refresh_token');
    return Response.json({ access_token: `next-${token}`, refresh_token: `next-${token}`, expires_in: 3600 });
  });
  const primary = await r.pool.addAccount(credential('alice'));
  const second = await r.pool.addAccount(credential('bob'));
  assert.equal(r.mirror().refreshToken, 'refresh-alice');
  await r.pool.renewCredential(second.id);
  assert.equal(r.mirror().refreshToken, 'refresh-alice');
  await r.pool.renewCredential(primary.id);
  assert.equal(r.mirror().refreshToken, 'next-refresh-alice');
  r.oauth.dispose();
});

test('a deleted row stays deleted after its refresh returns', async () => {
  const began = deferred();
  const gate = deferred();
  const r = runtime(async () => {
    began.resolve();
    await gate.promise;
    return Response.json({ access_token: 'late-access', refresh_token: 'late-grant', expires_in: 3600 });
  });
  await r.pool.addAccount(credential('alice'));
  const other = await r.pool.addAccount(credential('bob'));
  const original = (await r.pool.read()).accounts[0];
  const task = r.pool.freshAccount(original, r.oauth.fetchFn, true);
  await began.promise;
  await r.pool.deleteAccount(original.id);
  gate.resolve();
  await assert.rejects(task);
  assert.deepEqual((await r.pool.read()).accounts.map(a => a.id), [other.id]);
  assert.equal(r.mirror().refreshToken, 'refresh-bob');
  r.oauth.dispose();
});

test('dispose aborts active background fetch without deleting managed credentials', async () => {
  const began = deferred();
  let signal;
  const r = runtime(async (_url, init) => {
    signal = init.signal;
    began.resolve();
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  const row = await r.pool.addAccount(credential('alice', { expiresAt: NOW + 10_000 }));
  r.oauth.startBackgroundRefresh();
  const pending = r.oauth.backgroundRefreshPromise;
  await began.promise;
  r.oauth.dispose();
  await pending;
  assert.equal(signal.aborted, true);
  assert.equal(r.oauth.backgroundRefreshTimer, undefined);
  const data = await r.pool.read();
  assert.equal(data.accounts.length, 1);
  assert.equal(data.accounts[0].id, row.id);
  assert.equal(data.accounts[0].credentials.refreshToken, 'refresh-alice');
  assert.equal(data.accounts[0].authStatus, undefined);
});

test('long-lived credentials schedule exactly before expiry without periodic polling', async () => {
  let calls = 0;
  const r = runtime(async () => {
    calls++;
    return Response.json({ access_token: 'new-access', refresh_token: 'renewed', expires_in: 864000 });
  });
  const lifetime = 10 * 86_400_000;
  await r.pool.addAccount(credential('alice', { expiresAt: NOW + lifetime }));
  r.oauth.startBackgroundRefresh();
  await r.oauth.backgroundRefreshPromise;
  assert.equal(calls, 0);
  assert.equal(r.timers.length, 1);
  const wakeup = r.timers[0];
  assert.equal(wakeup.ms, lifetime - 300_000);
  assert.equal(wakeup.unreferenced, true);
  r.advance(wakeup.ms);
  wakeup.fn();
  await r.oauth.backgroundRefreshPromise;
  assert.equal(calls, 1);
  assert.equal(r.timers.at(-1).ms, lifetime - 300_000);
  r.oauth.dispose();
});

test('adding an earlier account re-arms expiry scheduling and an empty pool does not poll', async () => {
  const r = runtime();
  r.oauth.startBackgroundRefresh();
  await r.oauth.backgroundRefreshPromise;
  assert.equal(r.timers.length, 0);
  await r.pool.addAccount(credential('alice', { expiresAt: NOW + 8 * 86_400_000 }));
  assert.equal(r.timers.at(-1).ms, 0);
  r.timers.at(-1).fn();
  await r.oauth.backgroundRefreshPromise;
  const original = r.timers.at(-1);
  assert.equal(original.ms, 8 * 86_400_000 - 300_000);
  await r.pool.addAccount(credential('bob', { expiresAt: NOW + 3_600_000 }));
  assert.equal(original.cancelled, true);
  assert.equal(r.timers.at(-1).ms, 0);
  r.timers.at(-1).fn();
  await r.oauth.backgroundRefreshPromise;
  assert.equal(r.timers.at(-1).ms, 3_300_000);
  r.oauth.dispose();
});

test('temporary refresh failure backs off without postponing another account deadline', async () => {
  const calls = [];
  const r = runtime(async (_url, init) => {
    calls.push(new URLSearchParams(init.body).get('refresh_token'));
    throw new Error('network unavailable');
  });
  await r.pool.addAccount(credential('alice', { expiresAt: NOW + 100_000 }));
  await r.pool.addAccount(credential('bob', { expiresAt: NOW + 400_000 }));
  r.oauth.startBackgroundRefresh();
  await r.oauth.backgroundRefreshPromise;
  assert.equal(r.timers.at(-1).ms, 100_000);
  r.advance(100_000);
  r.timers.at(-1).fn();
  await r.oauth.backgroundRefreshPromise;
  assert.deepEqual(calls, ['refresh-alice', 'refresh-bob']);
  assert.equal(r.timers.at(-1).ms, 800_000);
  assert.equal((await r.pool.read()).accounts.length, 2);
  r.oauth.dispose();
});

test('unusually short refreshed lifetimes do not create an immediate refresh loop', async () => {
  let calls = 0;
  const r = runtime(async () => {
    calls++;
    return Response.json({ access_token: 'short-lived', refresh_token: 'next-grant', expires_in: 60 });
  });
  await r.pool.addAccount(credential('alice', { expiresAt: NOW + 1000 }));
  r.oauth.startBackgroundRefresh();
  await r.oauth.backgroundRefreshPromise;
  assert.equal(calls, 1);
  assert.equal(r.timers.at(-1).ms, 900_000);
  r.oauth.dispose();
});

test('apply starts background refresh after OAuth construction and existing disposal owns cleanup', () => {
  const apply = bundle.slice(bundle.indexOf('function apply(ctx, pluginConfig'));
  const created = apply.indexOf('const oauth = new OAuthService(');
  const started = apply.indexOf('oauth.startBackgroundRefresh();');
  assert(created >= 0 && started > created);
  assert(started < apply.indexOf('const usage = new UsageService('));
  assert.ok(apply.includes('oauth.dispose();'));
  assert.ok(bundle.includes('"storages", "codex-pool.json"'));
  assert.ok(bundle.includes('"storages", "dsh-chatgpt-subscription", "oauth.dpapi"'));
});
