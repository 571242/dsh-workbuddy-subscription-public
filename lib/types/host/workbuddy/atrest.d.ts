/**
 * `$wbEncrypted` at-rest credential envelope.
 *
 * The CodeBuddy/WorkBuddy desktop client stopped writing plaintext tokens on
 * 2026-09-24: `auth.accessToken` / `auth.refreshToken` became
 * `{"$wbEncrypted": 1, "envelope": base64}` (the domestic build also seals
 * `nickname` / `phoneNumber`). Reading such a file the way this plugin used to
 * yields the envelope TEXT as the bearer token, so every request answers 401 —
 * the adoption path has to decrypt before it can use the credential.
 *
 * The scheme below is transcribed from the client's `packages/at-rest-crypto`
 * as reimplemented by workbuddy2api-hub (`wb_atrest.py`, MIT); the framing
 * constants are the part that must match byte for byte:
 *
 *     key      = sha256(atRestSecretKey as an ASCII string)   # the protector key
 *     keyId    = sha256(key).hex[0..16]                       # `protectorKeyId`
 *     AAD      = "WB-AAD\0" | 0x01 | LP(fileMagic) | LP("sym-v1")
 *                | u32(suite) | LP(keyId) | framingCode | 0x00 | 0x00
 *     envelope = base64(JSON{suite, keyId, nonce, authTag, ciphertext})  # AES-256-GCM
 *     framing  : the keyblob's wrapped master key is `WBEF1`/1, a sealed `.info`
 *                field is `WBEV1`/2 — the SAME protector key opens both.
 *
 * Key material never leaves the process and is never logged: the user pastes it
 * once, it is stored through the platform credential store (DPAPI / Keychain /
 * Secret Service), and every read re-validates it against the client's own
 * keyblob when that file exists.
 */
/** Field name the client uses to mark a sealed value. */
export declare const ENVELOPE_KEY = "$wbEncrypted";
/** Framing kinds and the code each carries in the AAD. */
declare const FRAMING: {
    readonly file: {
        readonly magic: "WBEF1";
        readonly code: 1;
    };
    readonly field: {
        readonly magic: "WBEV1";
        readonly code: 2;
    };
};
type Framing = keyof typeof FRAMING;
/** Every failure the at-rest path can report to a user. */
export declare class AtRestError extends Error {
    constructor(message: string);
}
/** The GCM associated data, byte-identical to the client's. */
export declare function associatedData(keyId: string, suite: number, framing: Framing): Buffer;
/** `protectorKeyId` / `envelope.keyId`: the first 16 hex characters of sha256(key). */
export declare function deriveKeyId(key: Buffer): string;
/**
 * Whether a value is a sealed envelope rather than plaintext.
 *
 * Older clients sometimes stored the whole envelope as a JSON STRING in the
 * field, so that shape is recognised too.
 */
export declare function isSealedValue(value: unknown): boolean;
interface SealedEnvelope {
    suite: number;
    keyId: string;
    nonce: Buffer;
    authTag: Buffer;
    ciphertext: Buffer;
}
/** Split one envelope into its GCM parts. */
export declare function parseEnvelope(value: unknown): SealedEnvelope;
/** Open one envelope with the protector key, returning the plaintext bytes. */
export declare function openEnvelope(key: Buffer, value: unknown, framing: Framing): Buffer;
/** Decrypt a field that may be sealed, leaving plaintext values untouched. */
export declare function openSealedField(key: Buffer, value: unknown): string;
/**
 * Normalise a pasted secret into the 32-byte protector key.
 *
 * Two spellings are accepted, neither requiring the user to compute anything:
 * a 64-character hex protector key (used as-is), or the 44-character base64
 * `atRestSecretKey` the client carries in its payload — that one is hashed as
 * the STRING, which is what produces the protector key.
 */
export declare function parseKeyText(text: string): Buffer;
/** Path of the client's keyblob, or null when the client is not installed here. */
export declare function keyBlobPath(): string | null;
/**
 * Validate a protector key against the client's own keyblob.
 *
 * This is the check that turns a typo into an error instead of a mystery: the
 * key must match the `static-v1` slot's `protectorKeyId` and must unwrap a
 * 32-byte master whose derived id matches the blob's own `keyId`. Returns
 * `false` when there is no keyblob to check against (the desktop client is not
 * installed on this machine) — absence of evidence, not evidence of a bad key.
 */
export declare function verifyKeyAgainstKeyBlob(key: Buffer): Promise<boolean>;
/** Install the protector key for this process (already persisted by the caller). */
export declare function setActiveAtRestKey(key: Buffer | null): void;
/** The protector key this process holds, if any. */
export declare function activeAtRestKey(): Buffer | null;
/** Whether sealed credentials can be opened right now. */
export declare function hasAtRestKey(): boolean;
export {};
//# sourceMappingURL=atrest.d.ts.map