/**
 * Persistent snapshot for one provider's live model catalog.
 *
 * The in-memory catalog caches keep a process alive between requests, but they
 * start cold: on the first call after a restart (or a plugin reinstall) the
 * picker and the settings page both wait on the upstream listing before they
 * can render anything, and an unreachable endpoint turns that wait into the
 * full discovery timeout — "the model server is unavailable" on a fresh
 * install. The catalog is not fast-moving data, so the last successful listing
 * is persisted to `<DSH_HOME>/storages/` and rehydrated into the in-memory
 * cache on first use. A snapshot the caller can read is therefore available
 * from the very first call, with no network in the path.
 *
 * Writes are best-effort: persistence is an optimization, never a capability.
 * A read-only home or a locked file must not fail the fetch that produced the
 * snapshot.
 */
/** File name of the persisted snapshot for one catalog. */
export declare function catalogSnapshotPath(name: string): string;
/**
 * How many models one line's catalog holds, for the hub overview's "N/M models".
 *
 * An empty catalog is reported as `null` rather than `0`: "this line has synced
 * nothing yet" and "this line offers no models" are different statements, and
 * only the second one is a fact. The overview hides the model count for a null,
 * which is what a line that has never synced should show.
 */
export declare function catalogTotal(count: number): number | null;
/**
 * Snapshot name for one catalog *and* one credential scope.
 *
 * A persisted snapshot answers before any credential is read — that is the whole
 * point of it — so the file itself has to carry the scope it was fetched under.
 * Otherwise the first call after a restart, for any account, is answered by
 * whatever listing some other scope happened to persist last: a Kimi listing
 * fetched for the mainland-cn endpoint would answer a global caller with models
 * and context windows that region does not serve, and a Command Code listing
 * fetched against one API environment would answer the other.
 *
 * The scope is part of the file name rather than of the payload because a caller
 * that cannot name the account — the harness resolves this catalog with no token
 * at all — still has to find the snapshot its own scope owns.
 *
 * Everything outside `[a-z0-9]` is folded to `_`, so no scope can escape the
 * `storages` directory.
 */
export declare function catalogSnapshotName(base: string, scope: string): string;
/**
 * Read the persisted snapshot for one catalog.
 *
 * Shape errors and unreadable files both return `undefined` — the caller keeps
 * its in-memory state, and the next successful fetch overwrites the file.
 */
export declare function readCatalogSnapshot<T>(name: string, parseModels: (value: unknown) => T[] | undefined): Promise<{
    fetchedAt: number;
    models: T[];
} | undefined>;
/** Persist one snapshot; a failure is logged nowhere and never thrown. */
export declare function writeCatalogSnapshot<T>(name: string, models: T[], fetchedAt: number): Promise<void>;
/**
 * Wait until every snapshot write this process queued has settled.
 *
 * The write is only queued once the caller reaches it, so a caller that is
 * still fetching has not registered one yet: yielding first lets those land
 * before the set is read, and the loop drains anything they queue in turn.
 * Production never calls this — it exists so a test cannot race a write it
 * cannot see.
 */
export declare function flushCatalogSnapshots(): Promise<void>;
/**
 * Warm an in-memory cache from the persisted snapshot when it is fresher than
 * what the cache currently holds. Called lazily on the first cache miss of a
 * process, so a restart serves the previous listing without waiting on the
 * network.
 *
 * @returns the snapshot's `fetchedAt`, or `0` when no usable snapshot exists —
 *   the caller then fetches as before.
 */
export declare function rehydrateCatalogCache<T>(name: string, parseModels: (value: unknown) => T[] | undefined, accept: (fetchedAt: number, models: T[]) => void, currentFetchedAt: number): Promise<number>;
//# sourceMappingURL=catalog-snapshot.d.ts.map