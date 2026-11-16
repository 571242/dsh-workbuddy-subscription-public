/**
 * The MiniMax Code settings card.
 *
 * Markup only: every piece of state, every effect and every request this card
 * makes lives in 'useMinimaxCodeSection.ts', which returns one named shape the
 * JSX below reads. The two files are the split of a single 915-line component —
 * the behaviour is unchanged, and this one should stay render-shaped.
 */
import React from 'react';
import { type MinimaxCodeSectionProps } from './useMinimaxCodeSection.ts';
/**
 * Hours still left on the access token, or null once it has run out.
 *
 * MiniMax Code's token lives about 24 hours, so hours are the unit the card
 * reports; a value worth a fraction of an hour keeps one decimal instead of
 * rounding down to 0.
 */
export declare function remainingHours(expiresAtMs: number | undefined): string | null;
export declare function MinimaxCodeSection({ onModelChange }: MinimaxCodeSectionProps): React.JSX.Element;
//# sourceMappingURL=MinimaxCodeSection.d.ts.map