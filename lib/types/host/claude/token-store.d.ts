/**
 * Credential and model-settings persistence for the Claude subscription line.
 *
 * ---------------------------------------------------------------------------
 * WHY ACCOUNT IDENTITY HAS TWO LAYERS
 * ---------------------------------------------------------------------------
 *
 * A subscription credential is not stable text. Every refresh returns a NEW
 * refresh token, and signing in to the same account a second time mints yet
 * another one. The obvious key — a hash of the refresh token — therefore says
 * "new account" for what is the same account, and one ghost row appears per
 * refresh and per re-login. That is the defect this module exists to prevent.
 *
 * A stored account therefore carries two distinct things:
 *
 * 1. `internalId` — minted exactly once, at the first save of an account, as
 *    `cl_` + ten random bytes in hex. It never changes for the lifetime of the
 *    record, and it is the ONLY key routing may use: set-primary, delete and
 *    re-login all address a record by this id.
 * 2. `identityKeys` — an append-only set of ALIASES derived from the credential
 *    itself: `uuid:<account.uuid>`, `email:<address>`, and — only when neither
 *    of those is available — `seed:<sha256(refreshToken).slice(0,16)>`. Every save
 *    MERGES the freshly derived keys into the stored set: a key is never
 *    replaced, never dropped, and never re-derived from a token that rotated.
 *
 * Both spellings of the account's address (`email_address`, the wire's own, and
 * `emailAddress`) and both of the account's uuid spellings are read, because a
 * silently missed field here is precisely the ghost-account failure above. Keys
 * are lower-cased on the way in for the same reason: an address that differs only
 * in case is one account.
 *
 * ---------------------------------------------------------------------------
 * THE KNOWN, ACCEPTED LIMITATION: `seed:` CANNOT RECOGNISE A RE-LOGIN
 * ---------------------------------------------------------------------------
 *
 * `seed:` is a digest of the refresh token, so the SAME account signing in again
 * produces a DIFFERENT seed and is stored as a SECOND record. Nothing can tell
 * those two records apart from two genuinely different accounts: neither states
 * a uuid or an address, and the tokens they hold have nothing in common.
 *
 * This is a real limitation, and it is deliberately NOT papered over with an id
 * that pretends to be stable — an id derived from a rotating token is exactly
 * the bug this design removes. The remedy is the one the settings card must
 * offer: a MANUAL MERGE, where the user marks two rows as one account and the
 * surviving record merges the other's keys. Nothing in this module guesses it.
 * A provider whose exchange always returns a uuid or an address never reaches
 * this case; only a credential stating neither does.
 *
 * A second, narrower case follows from the same rule and is worth stating
 * outright: matching requires a SHARED alias, so a sign-in that states only a
 * uuid and a later one that states only an address for the very same account are
 * two records. They become one the moment any single save states both — which is
 * why {@link identityKeysFor} collects everything a credential offers rather
 * than stopping at the first field it finds — and otherwise the same manual
 * merge applies.
 *
 * ---------------------------------------------------------------------------
 * STORAGE
 * ---------------------------------------------------------------------------
 *
 * Encryption is the platform's own and identical to the sibling provider lines:
 * Windows CurrentUser DPAPI (`<file>.dpapi`), the macOS login Keychain, and the
 * Linux Secret Service through `secret-tool`. There is no plaintext fallback — a
 * platform with none of the three throws rather than writing bearer tokens in
 * the clear. The plaintext JSON beside the encrypted file is only ever a
 * MIGRATION SOURCE: it is read once, written back encrypted, verified by
 * reading the ciphertext back, and only then deleted. A failed verification
 * throws and leaves the previous good data untouched.
 *
 * Mutations are serialised per absolute path, so a token refresh, a settings
 * save and a re-login cannot interleave into a read-modify-write that loses an
 * account.
 */
import { type ClaudeCacheTtl } from './types.ts';
import type { CredentialStore } from '../token-store.ts';
import { type ContextWindowOverridePatch } from '../common/context-window-overrides.ts';
/** Namespace the model settings live in when the harness still registers one. */
export declare const CLAUDE_PREFERENCES_NAMESPACE = "dsh-claude";
/** Prefix of every internal account id. */
export declare const INTERNAL_ID_PREFIX = "cl_";
/** The OAuth scope that makes a credential a *subscription* credential. */
export declare const SUBSCRIPTION_INFERENCE_SCOPE = "user:inference";
/** Revision of the on-disk credential document. */
export declare const CREDENTIAL_DOCUMENT_VERSION = 1;
/** Account facts the exchange states about the signed-in user. */
export interface ClaudeAccountInfo {
    /** Stable account uuid the exchange reports, when it reports one. */
    uuid?: string;
    /** Account address, as the wire spells it. */
    email_address?: string;
    /** The same address, as a hand-written credential spells it. */
    emailAddress?: string;
}
/**
 * One stored subscription credential.
 *
 * `scopes` is not decoration: `user:inference` is what makes the token usable
 * against /v1/messages at all, so its absence means this is not a subscription
 * credential and is refused rather than tried. See
 * {@link isSubscriptionCredential}.
 */
export interface ClaudeCredentials {
    /** Bearer access token. Host-only; never sent to a browser. */
    accessToken: string;
    /** Rotating refresh token. Host-only. */
    refreshToken: string;
    /** Unix milliseconds the access token stops being valid. */
    expiresAt: number;
    /** OAuth scopes the exchange granted. */
    scopes?: string[];
    /** Subscription tier the exchange reported, when it reported one. */
    subscriptionType?: string;
    /** Account facts the exchange reported, when it reported any. */
    account?: ClaudeAccountInfo;
}
/**
 * One account record in the credential document.
 *
 * The index signature is deliberate: a later chunk may hang its own fields on a
 * record (an alias, an added-at stamp, a primary flag), and a save from this
 * module must carry them through instead of silently dropping them. Nothing
 * here reads them.
 */
export interface ClaudeAccountRecord {
    /** Immutable routing key. See the module comment. */
    internalId: string;
    /** Append-only alias set. Never empty in practice; see {@link mergeIdentityKeys}. */
    identityKeys: string[];
    credentials: ClaudeCredentials;
    [key: string]: unknown;
}
/** Whole credential file: every signed-in account, in insertion order. */
export interface ClaudeCredentialDocument {
    /** Format revision, so a later chunk can migrate without guessing. */
    version: number;
    accounts: ClaudeAccountRecord[];
    [key: string]: unknown;
}
/** Persisted model settings for this line. */
export interface ClaudeModelSettings {
    enabled?: boolean;
    enabledModelIds: string[];
    contextWindowOverrides: Record<string, number>;
    defaultReasoningEffort: string | null;
    /**
     * Prompt-cache tier the line asks for. `null` means "follow the official
     * subscription client", which is the one-hour tier while a plan is drawing
     * on included usage.
     */
    cacheTtl: ClaudeCacheTtl | null;
    /** Account pinned in the card, by {@link ClaudeAccountRecord.internalId}. */
    selectedAccountId: string | null;
}
/**
 * One settings patch. `null` in an override map drops that override, and a
 * field left out keeps its stored value.
 */
export interface ClaudeSettingsPatch {
    enabled?: boolean;
    enabledModelIds?: string[];
    /** `null` deletes one override and falls back to the catalog default. */
    contextWindowOverrides?: ContextWindowOverridePatch;
    defaultReasoningEffort?: string | null;
    /** `null` restores the subscription default (the one-hour tier). */
    cacheTtl?: ClaudeCacheTtl | null;
    selectedAccountId?: string | null;
}
/** The preference surface the routes and the settings card talk to. */
export interface ClaudePreferenceStore {
    status(): ClaudeModelSettings;
    update(patch: ClaudeSettingsPatch): Promise<ClaudeModelSettings>;
}
/** A fresh settings document, with a copy of the default model list. */
export declare function defaultClaudeSettings(): ClaudeModelSettings;
/** Mint an internal id. Called once per record; never derived from a token. */
export declare function createInternalId(): string;
/**
 * Whether a value has the shape of an internal id this module minted.
 *
 * A shape test for the settings card and for tests — NOT a gate on the stored
 * document, which keeps a foreign id verbatim rather than discarding the account
 * it names.
 */
export declare function isClaudeAccountId(value: unknown): value is string;
/**
 * Whether a credential is a *subscription* credential.
 *
 * The exchange can hand back a token that authenticates but is not entitled to
 * the routes this provider exists to serve; `user:inference` is the scope that
 * separates the two, so its absence is a refusal rather than a retry.
 */
export declare function isSubscriptionCredential(credentials: Pick<ClaudeCredentials, 'scopes'>): boolean;
/**
 * Aliases one credential states about its account.
 *
 * Order is deliberate — uuid, then address — because {@link mergeIdentityKeys}
 * appends in this order and a stable order keeps the stored file diffable. The
 * `seed:` fallback is emitted ONLY when neither of the other two exists: a
 * seed is not identity, it is a fingerprint of a token that rotates, and mixing
 * it into a set that already has real identity would add noise that changes on
 * every refresh.
 */
export declare function identityKeysFor(credentials: Pick<ClaudeCredentials, 'refreshToken' | 'account'>): string[];
/**
 * Union of two alias sets, existing first.
 *
 * Append-only in both directions: a key already present is kept where it is, a
 * new key is appended, and an exact duplicate is not repeated. Nothing is ever
 * removed — including a `seed:` a credential has since outgrown, because a user
 * who signs in with the same token again would otherwise get a ghost row.
 */
export declare function mergeIdentityKeys(existing: readonly string[], incoming: readonly string[]): string[];
/**
 * Validate and normalize one credential, strictly.
 *
 * Every field is rebuilt from a validated value rather than carried over from
 * the input, so nothing a caller happens to attach — an `undefined`-valued key
 * among it — can make the encrypted write fail its own read-back comparison.
 * A wrong shape throws; nothing is guessed, and in particular a credential with
 * no `user:inference` scope is refused here (see {@link isSubscriptionCredential}).
 */
export declare function parseClaudeCredentials(value: unknown): ClaudeCredentials;
/**
 * Validate one whole credential document, migrating the pre-two-layer shape.
 *
 * A bare credential object — one token pair, no account envelope — is what an
 * earlier build wrote, and it is accepted as a one-account document so an
 * existing sign-in survives the upgrade instead of forcing a re-login. The
 * record it becomes is minted an internal id right here, at the moment it is
 * first read.
 */
export declare function parseClaudeCredentialDocument(value: unknown): ClaudeCredentialDocument;
/**
 * Validate one settings document.
 *
 * Unlike the credential parse this one is lenient by design: settings are
 * preferences, and a hand-edited or half-written value must degrade to the
 * shipped default for that one field instead of unlinking the user's model
 * choice entirely. Being lenient is also what lets a document written by an
 * EARLIER build keep working: this reader picks the fields it knows and ignores
 * every other key rather than rejecting the document for stating one, so a file
 * still carrying a key this build no longer has is read successfully and every
 * field it does have survives. Rejecting unknown keys here would answer "not
 * signed in" for a user whose model selection is sitting intact on disk.
 * The settings route's zod schema has the same property for its own store:
 * schemastery strips undeclared keys instead of failing on them.
 */
export declare function parseClaudeModelSettings(value: unknown): ClaudeModelSettings;
export declare function credentialPath(): string;
export declare function modelSettingsPath(): string;
/**
 * Encrypted credential store; the plaintext JSON is only a migration source.
 *
 * Every mutation goes through {@link saveVerified}: encrypt, read the ciphertext
 * back, compare, and only then remove the plaintext. A verification failure
 * throws and leaves both the ciphertext and the plaintext as they were, so the
 * previous good data is never destroyed by a failed write.
 */
export declare class FileCredentialStore {
    private readonly filePath;
    private readonly backend;
    constructor(filePath?: string, backend?: CredentialStore<ClaudeCredentialDocument>);
    /** Human-readable location, in the form the settings card reports it. */
    path(): string;
    /**
     * Test seam and extension point: the one place an id is minted.
     *
     * Overridable so a test can make the id deterministic without reaching into
     * the randomness, and so a later chunk can mint ids through the same path.
     */
    protected createAccountId(): string;
    private serialize;
    private removeLegacy;
    private saveVerified;
    /** Unserialized body shared by {@link read} and the mutations above it. */
    private readDocument;
    read(): Promise<ClaudeCredentialDocument | null>;
    listAccounts(): Promise<ClaudeAccountRecord[]>;
    /**
     * Store one credential, merging it into the account it belongs to.
     *
     * The merge is the whole point of the two-layer design: the same account
     * saving a SECOND, rotated refresh token is matched by the uuid or address
     * alias it still carries, so it updates the existing record — same
     * `internalId`, union of aliases — instead of adding a ghost row. Pass
     * `options.internalId` to address a record directly; that is what a re-login
     * whose token states no identity uses, and it is the only way to fold such a
     * credential onto a record the user picked by hand.
     */
    saveAccount(credentials: ClaudeCredentials, options?: {
        internalId?: string;
    }): Promise<ClaudeAccountRecord>;
    write(document: ClaudeCredentialDocument): Promise<void>;
    delete(): Promise<void>;
    /** Drop exactly one account, by its immutable id. Returns whether it existed. */
    deleteAccount(internalId: string): Promise<boolean>;
}
/** Plain-JSON model settings used when the settings service is unavailable. */
export declare class FileModelSettingsStore {
    private readonly filePath;
    constructor(filePath?: string);
    path(): string;
    read(): Promise<ClaudeModelSettings>;
    write(settings: ClaudeModelSettings): Promise<void>;
    /**
     * Read-modify-write under the same per-path lock the credentials use.
     *
     * Without it two patches landing together each read the same document and the
     * second write silently discards the first — a lost model selection, with no
     * error anywhere.
     */
    updateSettings(patch: ClaudeSettingsPatch): Promise<ClaudeModelSettings>;
}
/**
 * Bind the model selection to the DSH settings document when the harness still
 * offers one, and to the JSON file beside the credentials otherwise: a harness
 * without the register seam (0.1.7, and a headless test) reads that file back on
 * boot.
 */
export declare function registerClaudePreferenceStore(settings?: unknown, fallbackStore?: FileModelSettingsStore): ClaudePreferenceStore;
//# sourceMappingURL=token-store.d.ts.map