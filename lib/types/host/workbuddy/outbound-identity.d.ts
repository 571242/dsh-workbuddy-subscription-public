/**
 * Outbound client identities this route can present.
 *
 * The subscription gateway gates on client identity, and it gates DIFFERENTLY
 * per surface: measured on this route, `CodeBuddyIDE` is rejected by
 * `/v3/config` with 400 `code 12403` ("check ua") and 401'd outright by the
 * international chat endpoint, which is why the CLI identity is what the line
 * ships and has always used.
 *
 * Two more identities exist on the same backend, and workbuddy2api-hub has
 * captured what the real clients send (their `wb_identity.py`, measured
 * 2026-10-16 with mitmproxy against the international desktop build 5.8.4):
 *
 *   desktop   `WorkBuddy/5.8.4 workbuddy-ai/5.8.4 CLI/2.161.0`
 *             + `X-IDE-Type/Name: WorkBuddy`, `X-IDE-Version`, `X-Agent-Intent: craft`
 *             + `X-Agent-Purpose: conversation`, `X-Agent-Type: main`, trace headers
 *   vscode    `VSCode/1.119.0 WorkBuddy/4.9.29177644`
 *             + `X-IDE-Type/Name: VSCode`, `X-IDE-Version`, `X-Product-Version`, `X-Env-ID`
 *   cli       `CLI/<v> CodeBuddy/<v>` + `X-IDE-Type/Name: CLI`
 *
 * `cli` is deliberately kept byte-identical to what this line sends today
 * (including the `CodeBuddyIDE` IDE name, which is what was actually measured
 * to work here) so the default cannot regress; the other two are opt-in
 * attempts.
 *
 * Quota is NOT per identity: the subscription meters an account × model over a
 * 24h window (429 `code 6004`), so switching identity cannot create allowance.
 * What it can do is give each account a stable, plausible client — the same
 * reason the gateway projects one device per account.
 */
import type { WorkBuddyOutboundProduct, WorkBuddyOutboundSetting } from '../../shared/workbuddy-contracts.ts';
export type { WorkBuddyOutboundProduct, WorkBuddyOutboundSetting };
/** Everything the settings card may offer, in display order. */
export declare const OUTBOUND_PRODUCTS: readonly WorkBuddyOutboundProduct[];
/** Shipped default: the identity this line already ships and measured working. */
export declare const DEFAULT_OUTBOUND_SETTING: WorkBuddyOutboundSetting;
/** Narrow a stored or patched value into a supported preference. */
export declare function normalizeOutboundSetting(value: unknown): WorkBuddyOutboundSetting;
/**
 * Which identity one account uses.
 *
 * `auto` assigns by hashing the account key, so an account keeps the same
 * client for its whole life — the one property that matters for a device
 * fingerprint — while a pool as a whole spreads over the available clients.
 */
export declare function resolveOutboundProduct(setting: WorkBuddyOutboundSetting, accountKey: string): WorkBuddyOutboundProduct;
/**
 * A stable pseudo-device id for one account.
 *
 * Same derivation as the measured clients (`derive_id`: md5 of `salt:uid`
 * reshaped into a UUID), so the value is a well-formed v4-shaped machine id
 * that never changes for an account and never collides between accounts. A
 * per-PROCESS id would be worse than none here: it would present every account
 * in the pool as the same machine.
 */
export declare function deriveMachineId(uid: string): string;
/** Identity-specific headers and user agent for one request. */
export interface OutboundIdentity {
    product: WorkBuddyOutboundProduct;
    userAgent: string;
    /** Extra or overriding headers; `conversation` supplies the ids already minted. */
    headers(conversation: Readonly<Record<string, string>>): Record<string, string>;
}
/** Resolve the identity block for one product on one region. */
export declare function outboundIdentity(product: WorkBuddyOutboundProduct, region: 'cn' | 'intl', uid: string): OutboundIdentity;
//# sourceMappingURL=outbound-identity.d.ts.map