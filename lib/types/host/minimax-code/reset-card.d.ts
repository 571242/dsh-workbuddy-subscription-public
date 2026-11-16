/**
 * The MiniMax Code reset-card ("额度重置卡") surfaces.
 *
 * Three upstream calls, all on the API hosts this line already reads usage from
 * (`QUOTA_HOST_CANDIDATES` in ./types.ts), all authenticated the same way the
 * usage read is:
 *
 * - `GET  /backend/account/reset_card/list?page=1&size=20`
 * - `GET  /backend/account/reset_card/flows?create_time=<ms>&page=1&size=20`
 * - `POST /backend/account/reset_card/use` with `{ source_type, out_biz_no }`
 *
 * Two facts below are load-bearing and were measured, not inferred:
 *
 * 1. `flows` REQUIRES `create_time`. Without it the service answers HTTP 200
 *    with `base_resp.status_code: 2013` ("invalid params"), so the window start
 *    is always sent — 30 days back, which is the window the panel shows.
 *
 * 2. The use call is idempotent on `out_biz_no`, which is a field OF THE CARD.
 *    The client therefore sends the card's own `source_type` and `out_biz_no`
 *    verbatim and generates no request id of its own: a self-minted id would
 *    defeat the de-duplication the service performs and turn one user click into
 *    several cards spent.
 *
 * The desktop client sends these calls with a literal `token:` header; measured,
 * that answers 401. The bearer form used here works, and no `yy` /
 * `x-timestamp` / `x-signature` attribution headers are sent — this package
 * does not forge the official client's identity (see ./types.ts).
 *
 * Parsing is deliberately forgiving: a row with a missing or mistyped field is
 * SKIPPED rather than thrown, because one malformed card must not blank the whole
 * panel. A business failure (`base_resp.status_code !== 0`) is a different thing
 * and is reported, using the same classification the usage read uses.
 */
import type { MinimaxCodeResetCardDto, MinimaxCodeResetCardFlowDto, MinimaxCodeResetCardsDto, MinimaxCodeResetOutcome } from '../../shared/minimax-code-contracts.ts';
import type { MinimaxCodeCredentials } from './token-store.ts';
/** Path of the available-cards read. */
export declare const RESET_CARD_LIST_PATH = "/backend/account/reset_card/list";
/** Path of the flow history read. REQUIRES `create_time`; see the header note. */
export declare const RESET_CARD_FLOWS_PATH = "/backend/account/reset_card/flows";
/** Path that spends a card. */
export declare const RESET_CARD_USE_PATH = "/backend/account/reset_card/use";
/** Page size every read asks for. */
export declare const RESET_CARD_PAGE_SIZE = 20;
/** The flow window the panel shows, and the start `flows` is asked from. */
export declare const RESET_CARD_FLOW_WINDOW_MS: number;
/** Local timeout for one reset-card call. */
export declare const RESET_CARD_TIMEOUT_MS = 15000;
/** Business codes this surface is known to answer with. */
export declare const RESET_CARD_RATE_LIMIT = 1002;
export declare const RESET_CARD_UNAUTHORIZED = 1004;
export declare const RESET_CARD_INVALID_PARAMS = 2013;
/**
 * A reset-card call that failed.
 *
 * `statusCode` is the envelope's `base_resp.status_code` (the platform answers
 * HTTP 200 for a refusal), `httpStatus` the status line when the transport
 * itself refused. Both are kept so the route can answer 401 for an expired token
 * rather than the generic 502 it would otherwise send for an upstream refusal.
 */
export declare class MinimaxCodeResetCardError extends Error {
    readonly httpStatus: number | null;
    readonly statusCode: number | null;
    constructor(message: string, httpStatus: number | null, statusCode: number | null);
}
/**
 * Status line one failure should be reported to the browser with.
 *
 * The envelope codes are mapped rather than flattened, because "rate limited"
 * and "your sign-in expired" ask the user for opposite things: one is a
 * "try in a minute", the other is a refresh this line performs on its own.
 */
export declare function resetCardHttpStatus(error: unknown): number;
/**
 * Headers for one reset-card call.
 *
 * The bearer is the only credential field: measured, the desktop client's
 * literal `token:` header is refused with 401 by these routes. Nothing derived
 * from the token is ever logged, so a failure sentence can name the surface
 * without naming the credential.
 */
export declare function resetCardRequestHeaders(accessToken: string): Record<string, string>;
/** Forget the remembered host (a sign-out, or a test). */
export declare function clearResetCardHost(): void;
/** The remembered winning host, if one has answered. */
export declare function resetCardHost(): string | null;
export interface ResetCardRequestOptions {
    fetchFn?: typeof fetch;
    signal?: AbortSignal;
    /** Clock injection for tests; also decides the flow window start. */
    nowMs?: () => number;
}
/** One card, or undefined when a required field is missing or mistyped. */
export declare function parseResetCard(raw: unknown): MinimaxCodeResetCardDto | undefined;
/**
 * One flow row.
 *
 * `event_type` is a closed vocabulary, and an unknown value is dropped rather
 * than passed through: the contract says GRANT | USE, and a card rendered with a
 * third value would be showing this plugin an assumption it cannot back.
 */
export declare function parseResetCardFlow(raw: unknown): MinimaxCodeResetCardFlowDto | undefined;
/** The available cards from one `list` document. */
export declare function parseResetCardList(payload: unknown): MinimaxCodeResetCardDto[];
/** The flow rows from one `flows` document. */
export declare function parseResetCardFlows(payload: unknown): MinimaxCodeResetCardFlowDto[];
/** The query the flow read is sent with. `create_time` is mandatory. */
export declare function resetCardFlowsQuery(sinceMs: number, page?: number, size?: number): string;
/** The query the list read is sent with. */
export declare function resetCardListQuery(page?: number, size?: number): string;
/**
 * The reset-card panel: the cards still held, plus the recent flow.
 *
 * Two requests, and the asymmetry between them is the point: the LIST is the
 * panel's substance, so a failure of it is reported; the FLOW is context, so its
 * failure degrades to an empty list and the cards still render. A user whose
 * flow read is refused loses a history row, not the button they came to press.
 */
export declare function fetchResetCards(credentials: MinimaxCodeCredentials, options?: ResetCardRequestOptions): Promise<MinimaxCodeResetCardsDto>;
/**
 * Spend one card.
 *
 * The body is exactly two fields, both copied off the card. There is deliberately
 * no request id here: de-duplication is the service's, keyed on `out_biz_no`,
 * and a self-minted id would make a second click spend a second card — the exact
 * harm this line's contract warns about.
 *
 * The returned outcome is passed through rather than collapsed into a boolean,
 * because three of the six values mean "possibly spent, confirm with THIS card"
 * (REPLAYED, LOCK_BUSY, RETRYABLE_FAIL) and the caller has to be able to tell the
 * user to retry the same card instead of another one.
 */
export declare function useResetCard(credentials: MinimaxCodeCredentials, card: {
    sourceType: string;
    outBizNo: string;
}, options?: ResetCardRequestOptions): Promise<MinimaxCodeResetOutcome>;
//# sourceMappingURL=reset-card.d.ts.map