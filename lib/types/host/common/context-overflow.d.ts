/** Stable code understood by Harness overflow recovery, including older hosts. */
export declare const CONTEXT_OVERFLOW_CODE = "CONTEXT_WINDOW_EXCEEDED";
/** Inspect provider error fields only; never classify request bodies or successful output. */
export declare function isContextOverflow(error: unknown): boolean;
/** Only request-rejection statuses can be reclassified as context overflow. */
export declare function isHttpContextOverflow(status: number, error: unknown): boolean;
//# sourceMappingURL=context-overflow.d.ts.map