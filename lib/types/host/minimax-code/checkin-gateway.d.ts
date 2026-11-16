/**
 * Wire half of the MiniMax Code daily check-in.
 *
 * Everything in this file is measured against, or ported from, the official
 * client's own open source (`MiniMax-AI/minimax-code`, MIT):
 * `packages/tui/src/checkin/http-gateway.ts` does the two check-in calls and
 * `packages/tui/src/runtime/public-gateway.ts` builds the request. The wire
 * shape was additionally verified live against the CN deployment with this
 * machine's own credential (see the 0.2.0-rc.1-era probe notes in the
 * changelog): `GET signin/status` and `POST signin/claim` answer exactly the
 * shapes validated below, and a duplicate claim answers
 * `claim_result: 2` (AlreadyClaimed) rather than an error.
 *
 * The `yy` / `x-timestamp` / `x-signature` headers are the same first-party
 * attribution literals this package's `types.ts` product-token note discusses.
 * The official source's own comment calls them wire-protocol constants that
 * are "not credentials or a security boundary" — authorization is the Bearer
 * token. Unlike the quota read (where they are optional and stay off by
 * default), the check-in gateway refuses requests without them, so this
 * feature cannot exist without sending them; that trade is recorded in the
 * changelog and was made explicitly, not by default. The User-Agent stays the
 * plugin's own honest one — it is NOT part of the signed surface.
 */
import type { MinimaxCodeRegion } from '../../shared/minimax-code-contracts.ts';
/** Activity status surface; answers whether today is claimable or claimed. */
export declare const SIGNIN_STATUS_PATH = "/minimax-cloud/api/v1/signin/status";
/** Check-in surface; credits are granted by posting here once a day. */
export declare const SIGNIN_CLAIM_PATH = "/minimax-cloud/api/v1/signin/claim";
/** Account identity surface; resolves the realUserID the query string needs. */
export declare const USER_INFO_PATH = "/v1/api/user/info";
/** Day status values the panel reports. Mirrors the official SigninDayStatus. */
export declare const SIGNIN_DAY_UPCOMING = 1;
export declare const SIGNIN_DAY_CLAIMABLE = 2;
export declare const SIGNIN_DAY_CLAIMED = 3;
export declare const SIGNIN_DAY_DISABLED = 4;
/** Claim outcomes the service reports. Mirrors the official SigninClaimResult. */
export declare const SIGNIN_CLAIM_FRESH = 1;
export declare const SIGNIN_CLAIM_ALREADY = 2;
export declare const CHECKIN_TIMEOUT_MS = 30000;
/** Origin the official client uses for this surface, per region. */
export declare function checkinGatewayOrigin(region: MinimaxCodeRegion): string;
export interface SigninDayItem {
    day_no: number;
    points: number;
    bonus_points?: number;
    status: number;
    is_today: boolean;
}
export interface SigninPanel {
    scene: number;
    days: SigninDayItem[];
}
export interface ClaimSigninData {
    claim_id: string;
    claim_result: number;
    day_no: number;
    points: number;
    expire_at_ms: number;
    panel: SigninPanel;
}
/** Identity the check-in needs beyond the access token. */
export interface MinimaxCodeAccountIdentity {
    realUserID: string;
    userName?: string;
    subUserName?: string;
    userEmail?: string;
}
/**
 * Validate one panel response. Ported from the official
 * `validateSigninPanel`: exactly seven days, day numbers 1..7 without
 * repeats, at most one claimable and at most one "today". A panel that fails
 * this is a wire surprise, and treating it as "nothing to do" would silently
 * skip the day, so validation throws.
 */
export declare function validateSigninPanel(value: unknown): SigninPanel;
/** Validate one claim response. Ported from the official `validateClaimSigninData`. */
export declare function validateClaimSigninData(value: unknown): ClaimSigninData;
/**
 * The consecutive-claimed count ending today, from one panel.
 *
 * Ported from the official `getCurrentSigninStreak`: when today is claimed it
 * counts; when today is still claimable the streak up to yesterday is what a
 * claim would extend, so that is what the card shows.
 */
export declare function currentSigninStreak(days: readonly SigninDayItem[]): number;
export interface CheckinHttpOptions {
    fetchFn?: typeof fetch;
    /** Clock injection for tests. */
    nowMs?: () => number;
    /** `desktop_version` the request reports; the plugin version in production. */
    appVersion?: string;
    signal?: AbortSignal;
}
export declare class MinimaxCodeCheckinHttpError extends Error {
    readonly status: number | null;
    constructor(message: string, status: number | null);
}
/**
 * Resolve the account's realUserID (and display fields) through the identity
 * surface. The check-in query string needs realUserID and the OAuth document
 * does not carry it, so it is resolved once per scheduler pass and cached in
 * the check-in state afterwards.
 */
export declare function fetchAccountIdentity(accessToken: string, region: MinimaxCodeRegion, options?: CheckinHttpOptions): Promise<MinimaxCodeAccountIdentity>;
/** Read the seven-day panel; throws on transport, HTTP, or shape failures. */
export declare function fetchSigninPanel(accessToken: string, realUserID: string, region: MinimaxCodeRegion, options?: CheckinHttpOptions): Promise<SigninPanel>;
/** Claim today's credit; the response carries the fresh panel. */
export declare function claimSignin(accessToken: string, realUserID: string, region: MinimaxCodeRegion, options?: CheckinHttpOptions): Promise<ClaimSigninData>;
//# sourceMappingURL=checkin-gateway.d.ts.map