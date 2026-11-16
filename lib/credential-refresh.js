import { createHash } from 'node:crypto';

// Keep idle subscriptions fresh; provider pools retain refresh locking and persistence.
export function startCredentialRefresh(providers, { logger, intervalMs = 30_000, setIntervalFn = setInterval, clearIntervalFn = clearInterval, now = Date.now } = {}) {
  let stopped = false;
  let pending;
  const independent = providers.filter(provider => provider.concurrentRefresh);
  const legacy = providers.filter(provider => !provider.concurrentRefresh);
  const states = new Map(independent.map(provider => [provider, { scan: undefined, flights: new Map(), retries: new Map(), generations: new Map() }]));
  const generation = credentials => createHash('sha256').update(JSON.stringify(credentials)).digest('hex');

  const scan = provider => {
    const state = states.get(provider);
    if (state.scan) return state.scan;
    state.scan = (async () => {
      const tasks = [];
      try {
        await provider.sync?.();
        if (stopped) return tasks;
        const accounts = (await provider.core.read()).accounts;
        const ids = new Set(accounts.map(account => account.id));
        for (const id of state.retries.keys()) if (!ids.has(id)) state.retries.delete(id);
        for (const id of state.generations.keys()) if (!ids.has(id)) state.generations.delete(id);
        for (const account of accounts) {
          if (stopped) break;
          try {
            const key = generation(account.credentials);
            state.generations.set(account.id, key);
            if (!provider.core.isCredentialUsable(account) || !provider.core.shouldRefreshCredential(account, now())) continue;
            const previous = state.retries.get(account.id);
            let flights = state.flights.get(account.id);
            if (flights?.has(key) || previous?.key === key && previous.until > now()) continue;
            if (!flights) state.flights.set(account.id, flights = new Map());
            const task = Promise.resolve().then(async () => {
              if (stopped) return;
              try {
                const fresh = await provider.core.getFreshCredential(account.id, provider.fetchFn);
                if (stopped || state.generations.get(account.id) !== key) return;
                if (fresh && provider.core.shouldRefreshCredential({ ...account, credentials: fresh }, now())) {
                  state.retries.set(account.id, { key: generation(fresh), until: now() + 15 * 60_000, failures: 0 });
                } else state.retries.delete(account.id);
              } catch {
                if (stopped || state.generations.get(account.id) !== key) return;
                const failures = previous?.key === key ? previous.failures + 1 : 1;
                state.retries.set(account.id, { key, until: now() + Math.min(15 * 60_000, 2 * 60_000 * 2 ** Math.min(failures - 1, 3)), failures });
                logger?.warn(`[credential-refresh] ${provider.id}: account refresh failed; will retry`);
              }
            }).finally(() => {
              if (flights.get(key) === task) flights.delete(key);
              if (flights.size === 0 && state.flights.get(account.id) === flights) state.flights.delete(account.id);
            });
            flights.set(key, task);
            tasks.push(task);
          } catch {
            logger?.warn(`[credential-refresh] ${provider.id}: account credential check failed; will retry`);
          }
        }
      } catch {
        logger?.warn(`[credential-refresh] ${provider.id}: credential check failed; will retry`);
      }
      return tasks;
    })().finally(() => { state.scan = undefined; });
    return state.scan;
  };

  const tick = () => {
    if (stopped) return Promise.resolve();
    const independentTasks = independent.map(provider => scan(provider).then(tasks => Promise.allSettled(tasks)));
    if (!pending) {
      pending = (async () => {
        for (const provider of legacy) {
          if (stopped) break;
          try {
            await provider.sync?.();
            const accounts = (await provider.core.read()).accounts;
            for (const account of accounts) {
              if (stopped) break;
              if (!provider.core.isCredentialUsable(account) || !provider.core.shouldRefreshCredential(account, now())) continue;
              try {
                await provider.core.getFreshCredential(account.id, provider.fetchFn);
              } catch {
                logger?.warn(`[credential-refresh] ${provider.id}: account refresh failed; will retry`);
              }
            }
          } catch {
            logger?.warn(`[credential-refresh] ${provider.id}: credential check failed; will retry`);
          }
        }
      })().finally(() => { pending = undefined; });
    }
    return independent.length ? Promise.all([pending, ...independentTasks]) : pending;
  };
  const timer = setIntervalFn(tick, intervalMs);
  timer.unref?.();
  const ready = tick();
  return { ready, tick, dispose() { stopped = true; clearIntervalFn(timer); } };
}
