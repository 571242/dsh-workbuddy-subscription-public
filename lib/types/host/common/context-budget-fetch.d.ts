/**
 * Recover a rejected input+output budget without dropping model-visible history.
 * Only explicit wire output controls and provider-confirmed counts qualify.
 * HTTP success/SSE, auth, quota, and byte-limit failures retain their old paths.
 */
export declare function fetchWithContextBudgetRecovery(fetchFn: typeof fetch): typeof fetch;
//# sourceMappingURL=context-budget-fetch.d.ts.map