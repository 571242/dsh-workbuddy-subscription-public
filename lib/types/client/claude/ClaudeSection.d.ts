/**
 * The Claude subscription settings card.
 *
 * Markup only: every piece of state, every effect and every request this card
 * makes lives in 'useClaudeSection.ts', which returns one named shape the JSX
 * below reads. The two files are the split of a single 900-line component — the
 * behaviour is unchanged, and this one should stay render-shaped.
 */
import React from 'react';
import { type ClaudeSectionProps } from './useClaudeSection.ts';
export declare function ClaudeSection({ onModelChange, loadModelDirectory }: ClaudeSectionProps): React.ReactElement;
//# sourceMappingURL=ClaudeSection.d.ts.map