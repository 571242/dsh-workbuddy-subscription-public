import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import dgram from 'node:dgram';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Any accidental real transport is a test failure, even if the worker catches it.
const networkAttempts = [];
const originalFetch = globalThis.fetch;
const originalConnect = net.Socket.prototype.connect;
const originalSend = dgram.Socket.prototype.send;
function denyNetwork() {
  networkAttempts.push('unexpected real network access');
  throw new Error('real network is forbidden in this test');
}
globalThis.fetch = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
dgram.Socket.prototype.send = denyNetwork;
test.after(() => {
  globalThis.fetch = originalFetch;
  net.Socket.prototype.connect = originalConnect;
  dgram.Socket.prototype.send = originalSend;
  assert.equal(networkAttempts.length, 0, 'the tested module attempted real network access');
});

const requestedModule = process.env.CREDENTIAL_REFRESH_MODULE;
const moduleUrl = requestedModule
  ? requestedModule.startsWith('file:') ? requestedModule : pathToFileURL(path.resolve(requestedModule)).href
  : new URL('../lib/credential-refresh.js', import.meta.url).href;
const { startCredentialRefresh } = await import(moduleUrl);

const INTERVAL = 30_000;
const MINUTE = 60_000;
const START = 1_700_000_000_000;

async function drain() {
  // All I/O in these fixtures consists of promises; no real timer is used.
  for (let i = 0; i < 40; i++) await Promise.resolve();
}

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function fakeClock() {
  let now = START;
  let handle;
  const errors = [];
  return {
    now: () => now,
    errors,
    get handle() { return handle; },
    setIntervalFn(callback, interval) {
      assert.equal(handle, undefined, 'only one interval is expected');
      handle = {
        callback, interval, next: now + interval, active: true, unrefCalled: false,
        unref() { this.unrefCalled = true; },
      };
      return handle;
    },
    clearIntervalFn(timer) {
      assert.equal(timer, handle);
      timer.active = false;
    },
    async advance(ms) {
      const target = now + ms;
      while (handle?.active && handle.next <= target) {
        now = handle.next;
        handle.next += handle.interval;
        try {
          Promise.resolve(handle.callback()).catch(error => errors.push(error));
        } catch (error) {
          errors.push(error);
        }
        await drain();
      }
      now = target;
      await drain();
      assert.equal(errors.length, 0, 'interval callback rejected');
    },
  };
}

function credentials(label, expires) {
  return { access: `SYNTHETIC_ACCESS_${label}`, refresh: `SYNTHETIC_REFRESH_${label}`, expires };
}

function account(id, expires, options = {}) {
  return { id, credentials: credentials(options.label ?? id, expires), ...options.fields };
}

function response(label, ttlSeconds = 3_600) {
  return {
    ok: true,
    async json() {
      return {
        access_token: `SYNTHETIC_ACCESS_${label}`,
        refresh_token: `SYNTHETIC_REFRESH_${label}`,
        expires_in: ttlSeconds,
      };
    },
  };
}

function fixture(clock, { id = 'antigravity', accounts = [], concurrentRefresh = true, respond, sync } = {}) {
  const rows = structuredClone(accounts);
  const calls = [];
  let reads = 0;
  let syncs = 0;
  const fetchFn = async (url, init) => {
    assert.equal(url, 'https://offline.invalid/oauth/token');
    assert.equal(init.method, 'POST');
    const request = JSON.parse(init.body);
    calls.push({ ...request, at: clock.now() });
    return respond ? respond(request, calls.length) : response(`${id}-${request.id}-new`);
  };
  const core = {
    async read() { reads++; return { accounts: structuredClone(rows) }; },
    isCredentialUsable(row) { return row.authStatus === undefined || row.authStatus === 'ok'; },
    shouldRefreshCredential(row, now) {
      return !row.credentials.access || row.credentials.expires <= now + MINUTE;
    },
    async getFreshCredential(accountId, suppliedFetch) {
      assert.equal(suppliedFetch, fetchFn, 'the provider-specific fake fetch must be forwarded');
      const row = rows.find(item => item.id === accountId);
      assert(row, 'only fixture accounts may be refreshed');
      const expected = structuredClone(row.credentials);
      const result = await suppliedFetch('https://offline.invalid/oauth/token', {
        method: 'POST',
        body: JSON.stringify({ id: accountId, access: expected.access, refresh: expected.refresh }),
      });
      if (!result.ok) throw new Error(await result.text());
      const token = await result.json();
      const current = rows.find(item => item.id === accountId);
      if (!current) throw new Error('fixture account removed');
      // Model the pool's conditional commit: a late reply cannot undo a re-login.
      if (JSON.stringify(current.credentials) !== JSON.stringify(expected)) return structuredClone(current.credentials);
      current.credentials = {
        ...expected,
        access: token.access_token,
        refresh: token.refresh_token,
        expires: clock.now() + token.expires_in * 1_000,
      };
      return structuredClone(current.credentials);
    },
  };
  return {
    rows, calls, core, fetchFn,
    get reads() { return reads; },
    get syncs() { return syncs; },
    provider: {
      id, core, fetchFn, concurrentRefresh,
      async sync() { syncs++; if (sync) await sync(); },
    },
  };
}

function start(t, clock, providers, logs = []) {
  const logger = Object.fromEntries(['warn', 'info', 'error', 'debug', 'log'].map(level => [
    level, (...args) => logs.push(args.map(String).join(' ')),
  ]));
  const worker = startCredentialRefresh(providers.map(item => item.provider), {
    logger, intervalMs: INTERVAL, now: clock.now,
    setIntervalFn: clock.setIntervalFn, clearIntervalFn: clock.clearIntervalFn,
  });
  t.after(() => worker.dispose());
  return worker;
}

test('startup checks immediately and refreshes only usable credentials needing renewal', async t => {
  const clock = fakeClock();
  const ag = fixture(clock, { accounts: [
    account('expired', START - 1),
    account('near', START + 45_000),
    account('fresh', START + 2 * MINUTE),
    account('rejected', START - 1, { fields: { authStatus: 'expired' } }),
  ] });
  const untouched = structuredClone(ag.rows.slice(2));
  const worker = start(t, clock, [ag]);
  await worker.ready;
  assert.equal(ag.syncs, 1);
  assert.equal(ag.reads, 1, 'startup must not wait for the first timer tick');
  assert.deepEqual(ag.calls.map(call => call.id).sort(), ['expired', 'near']);
  assert.deepEqual(ag.rows.slice(2), untouched, 'fresh or rejected accounts must not be changed');
  assert(clock.handle.unrefCalled);
  assert.equal(clock.handle.interval, INTERVAL);
});

test('a permanently slow account cannot block another account that becomes due next round', async t => {
  const clock = fakeClock();
  const first = deferred();
  t.after(() => first.resolve(response('slow-released')));
  const ag = fixture(clock, {
    accounts: [account('slow', START - 1), account('later', START + 75_000)],
    respond: request => request.id === 'slow' ? first.promise : response('later-refreshed'),
  });
  const worker = start(t, clock, [ag]);
  await drain();
  assert.deepEqual(ag.calls.map(call => call.id), ['slow']);
  await clock.advance(INTERVAL);
  assert.deepEqual(ag.calls.map(call => call.id), ['slow', 'later']);
  assert.equal(ag.rows[1].credentials.access, 'SYNTHETIC_ACCESS_later-refreshed');
  await clock.advance(3 * INTERVAL);
  assert.equal(ag.calls.filter(call => call.id === 'slow').length, 1);
  first.resolve(response('slow-released'));
  await worker.ready;
});

test('a hanging Antigravity account does not delay or modify WorkBuddy', async t => {
  const clock = fakeClock();
  const pending = deferred();
  t.after(() => pending.resolve(response('ag-released')));
  const ag = fixture(clock, {
    accounts: [account('shared-id', START - 1, { label: 'ag-old' })],
    respond: () => pending.promise,
  });
  const wb = fixture(clock, {
    id: 'workbuddy', concurrentRefresh: false,
    accounts: [account('shared-id', START - 1, { label: 'wb-old' })],
  });
  const agBefore = structuredClone(ag.rows);
  const worker = start(t, clock, [ag, wb]);
  await drain();
  assert.equal(ag.calls.length, 1);
  assert.equal(wb.calls.length, 1);
  assert.equal(wb.syncs, 1);
  assert.deepEqual(ag.rows, agBefore);
  assert.equal(wb.rows[0].credentials.access, 'SYNTHETIC_ACCESS_workbuddy-shared-id-new');
  pending.resolve(response('ag-released'));
  await worker.ready;
});

test('a hanging WorkBuddy refresh does not block a newly due Antigravity account', async t => {
  const clock = fakeClock();
  const pending = deferred();
  t.after(() => pending.resolve(response('wb-released')));
  const ag = fixture(clock, { accounts: [account('ag', START + 75_000)] });
  const wb = fixture(clock, {
    id: 'workbuddy', concurrentRefresh: false,
    accounts: [account('wb', START - 1)], respond: () => pending.promise,
  });
  const worker = start(t, clock, [ag, wb]);
  await drain();
  assert.equal(wb.calls.length, 1);
  assert.equal(ag.calls.length, 0);
  await clock.advance(INTERVAL);
  assert.equal(ag.calls.length, 1);
  assert.equal(ag.rows[0].credentials.access, 'SYNTHETIC_ACCESS_antigravity-ag-new');
  assert.equal(wb.calls.length, 1);
  pending.resolve(response('wb-released'));
  await worker.ready;
});

test('overlapping ticks single-flight the same account and credential generation', async t => {
  const clock = fakeClock();
  const pending = deferred();
  t.after(() => pending.resolve(response('single-released')));
  const ag = fixture(clock, { accounts: [account('one', START - 1)], respond: () => pending.promise });
  const worker = start(t, clock, [ag]);
  await drain();
  const ticks = [worker.tick(), worker.tick(), worker.tick()];
  await drain();
  await clock.advance(4 * INTERVAL);
  assert.equal(ag.calls.length, 1, 'a pending generation must not be exchanged twice');
  pending.resolve(response('single-released'));
  await Promise.all([worker.ready, ...ticks]);
  assert.equal(ag.calls.length, 1);
});

test('failure backs off, retries later, and a re-login generation bypasses the old backoff', async t => {
  const clock = fakeClock();
  const logs = [];
  const ag = fixture(clock, {
    accounts: [account('one', START - 1, { label: 'old-login' })],
    respond: request => {
      if (request.refresh === 'SYNTHETIC_REFRESH_old-login') {
        throw new Error(`offline failure ${request.access} ${request.refresh}`);
      }
      return response('new-login-refreshed');
    },
  });
  const worker = start(t, clock, [ag], logs);
  await worker.ready;
  assert.equal(ag.calls.length, 1);
  await clock.advance(INTERVAL);
  assert.equal(ag.calls.length, 1, 'first failure must not be retried on the next tick');
  for (let elapsed = INTERVAL; elapsed < 60 * MINUTE && ag.calls.length < 2; elapsed += INTERVAL) {
    await clock.advance(INTERVAL);
  }
  assert.equal(ag.calls.length, 2, 'the failed generation must eventually be retried');
  await clock.advance(INTERVAL);
  assert.equal(ag.calls.length, 2, 'the repeated failure must also back off');
  ag.rows[0].credentials = credentials('relogin', clock.now() - 1);
  await clock.advance(INTERVAL);
  assert.equal(ag.calls.length, 3, 'a new login must not inherit the old generation backoff');
  assert.equal(ag.calls[2].refresh, 'SYNTHETIC_REFRESH_relogin');
  assert.equal(ag.rows[0].credentials.access, 'SYNTHETIC_ACCESS_new-login-refreshed');
  assert(logs.length >= 2, 'failures should be reported without exposing credentials');
});

test('re-login can refresh a new generation while the old generation is still hung', async t => {
  const clock = fakeClock();
  const oldFlight = deferred();
  t.after(() => oldFlight.resolve(response('old-late')));
  const ag = fixture(clock, {
    accounts: [account('one', START - 1, { label: 'old-flight' })],
    respond: request => request.refresh === 'SYNTHETIC_REFRESH_old-flight'
      ? oldFlight.promise : response('new-generation'),
  });
  const worker = start(t, clock, [ag]);
  await drain();
  assert.equal(ag.calls.length, 1);
  ag.rows[0].credentials = credentials('new-flight', clock.now() - 1);
  await clock.advance(INTERVAL);
  assert.equal(ag.calls.length, 2, 'a hung old credential generation must not lock a new login');
  assert.equal(ag.calls[1].refresh, 'SYNTHETIC_REFRESH_new-flight');
  assert.equal(ag.rows[0].credentials.access, 'SYNTHETIC_ACCESS_new-generation');
  oldFlight.resolve(response('old-late'));
  await worker.ready;
  assert.equal(ag.rows[0].credentials.access, 'SYNTHETIC_ACCESS_new-generation', 'late old responses must not overwrite re-login');
});

test('a late old-generation failure cannot erase the new generation short-TTL backoff', async t => {
  const clock = fakeClock();
  const oldFlight = deferred();
  t.after(() => oldFlight.resolve({ ok: false, async text() { return 'old request failed'; } }));
  const ag = fixture(clock, {
    accounts: [account('one', START - 1, { label: 'old-failure' })],
    respond: request => request.refresh === 'SYNTHETIC_REFRESH_old-failure'
      ? oldFlight.promise : response('new-short', 10),
  });
  const worker = start(t, clock, [ag]);
  await drain();
  ag.rows[0].credentials = credentials('relogin-short', clock.now() - 1);
  await clock.advance(INTERVAL);
  assert.equal(ag.calls.length, 2);
  oldFlight.resolve({ ok: false, async text() { return 'old request failed'; } });
  await worker.ready;
  await clock.advance(INTERVAL);
  assert.equal(ag.calls.length, 2, 'an obsolete failure must not release the new generation backoff');
  assert.equal(ag.rows[0].credentials.access, 'SYNTHETIC_ACCESS_new-short');
});

test('a successful short-TTL credential does not trigger a tight refresh loop', async t => {
  const clock = fakeClock();
  const ag = fixture(clock, {
    accounts: [account('short', START - 1)],
    respond: (_request, count) => response(`short-${count}`, 10),
  });
  const worker = start(t, clock, [ag]);
  await worker.ready;
  assert.equal(ag.calls.length, 1);
  await clock.advance(4 * MINUTE);
  assert(ag.calls.length <= 2, 'short TTL must not refresh on every 30-second scan');
  for (let elapsed = 4 * MINUTE; elapsed < 60 * MINUTE && ag.calls.length < 2; elapsed += INTERVAL) {
    await clock.advance(INTERVAL);
  }
  assert(ag.calls.length >= 2, 'short-TTL refresh must eventually become eligible again');
  const resumedCount = ag.calls.length;
  await clock.advance(4 * MINUTE);
  assert(ag.calls.length - resumedCount <= 2, 'short TTL must remain rate-limited after retry');
});

test('dispose clears the fake timer and prevents future checks, including a blocked startup scan', async t => {
  const clock = fakeClock();
  const gate = deferred();
  t.after(() => gate.resolve());
  const ag = fixture(clock, { accounts: [account('one', START - 1)], sync: () => gate.promise });
  const worker = start(t, clock, [ag]);
  await drain();
  assert.equal(ag.syncs, 1);
  worker.dispose();
  assert.equal(clock.handle.active, false);
  gate.resolve();
  await worker.ready;
  await worker.tick();
  await clock.advance(5 * MINUTE);
  assert.equal(ag.reads, 0);
  assert.equal(ag.calls.length, 0);
  assert.equal(ag.syncs, 1);
});

test('dispose does not schedule retries after an in-flight refresh fails', async t => {
  const clock = fakeClock();
  const gate = deferred();
  const logs = [];
  t.after(() => gate.resolve({ ok: false, async text() { return 'disposed'; } }));
  const ag = fixture(clock, { accounts: [account('one', START - 1)], respond: () => gate.promise });
  const worker = start(t, clock, [ag], logs);
  await drain();
  assert.equal(ag.calls.length, 1);
  worker.dispose();
  gate.resolve({ ok: false, async text() { return 'disposed'; } });
  await worker.ready;
  await worker.tick();
  await clock.advance(20 * MINUTE);
  assert.equal(ag.calls.length, 1);
  assert.equal(logs.length, 0, 'a completion after disposal should not schedule or report a retry');
});

test('failure logs from both providers never contain synthetic credentials', async t => {
  const clock = fakeClock();
  const logs = [];
  const ag = fixture(clock, {
    accounts: [account('ag', START - 1, { label: 'log-ag' })],
    respond: request => { throw new Error(`server said ${request.access} ${request.refresh}`); },
  });
  const wb = fixture(clock, {
    id: 'workbuddy', concurrentRefresh: false,
    accounts: [account('wb', START - 1, { label: 'log-wb' })],
    respond: request => { throw new Error(`server said ${request.access} ${request.refresh}`); },
  });
  const secrets = ag.rows.concat(wb.rows).flatMap(row => [row.credentials.access, row.credentials.refresh]);
  const worker = start(t, clock, [ag, wb], logs);
  await worker.ready;
  assert.equal(ag.calls.length, 1);
  assert.equal(wb.calls.length, 1);
  assert(logs.length >= 2, 'both mocked failures should be logged');
  for (const secret of secrets) {
    assert.equal(logs.some(line => line.includes(secret)), false, 'a synthetic credential appeared in a log');
  }
});
