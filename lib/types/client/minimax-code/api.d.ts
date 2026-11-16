/**
 * The MiniMax Code routes the settings card consumes.
 *
 * This module used to carry its own reader — the last one left after
 * `common/line-api.ts` took the other nine — and it still carried the predicate
 * the shared reader dropped: a 2xx answer of `{ ok: false, error }` with no
 * `value` was handed back as a payload instead of raising. Delegating is
 * therefore not only de-duplication: it is what makes this line answer a
 * failure exactly like its siblings.
 *
 * The names stay as they were so the hook that consumes them does not have to
 * change with the reader.
 */
import { type MinimaxCodeResetCardsDto, type MinimaxCodeResetResultDto } from '../../shared/minimax-code-contracts.ts';
export declare const request: <T>(path: string, init?: RequestInit) => Promise<T>;
export declare const get: <T>(path: string) => Promise<T>;
export declare const post: <T>(path: string, body?: object) => Promise<T>;
export declare function messageOf(cause: unknown): string;
/**
 * The reset-card panel: the cards still held, plus the recent flow.
 *
 * Goes through the shared reader, so a host half that is older than this one
 * produces the reader's "restart DSH" sentence rather than a bare parse crash.
 */
export declare function fetchResetCards(): Promise<MinimaxCodeResetCardsDto>;
/**
 * Spend one card.
 *
 * The body carries the `cardId` and nothing else — deliberately. The card's
 * idempotency key is a field the service de-duplicates on, so letting the
 * browser supply one would let a client spend a card it never read. The host
 * looks the card up and sends the key it found.
 */
export declare function useResetCard(cardId: string): Promise<MinimaxCodeResetResultDto>;
//# sourceMappingURL=api.d.ts.map