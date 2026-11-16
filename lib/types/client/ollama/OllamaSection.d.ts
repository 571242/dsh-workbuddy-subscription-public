import React from 'react';
/**
 * A token count short enough to sit in an account card.
 *
 * Exact below a thousand, then thousands, then millions. A six-figure number with
 * no grouping is unreadable at card width, and these are running totals that only
 * ever grow, so rounding is fine but commas are not optional.
 */
export declare function formatTokens(value: number): string;
interface Props {
    onModelChange?: () => void;
    loadModelDirectory?: () => void;
}
/**
 * The Ollama tab.
 *
 * Deliberately thin. The account card, its badges and the rotation picker are
 * the shared {@link AccountPoolSection}, so this line looks
 * like every other provider tab by construction rather than by imitation; only
 * what is genuinely Ollama's - pasting a key, syncing the catalog, and the
 * documented service limits - is written here.
 */
export declare function OllamaSection(props: Props): React.ReactElement;
export {};
//# sourceMappingURL=OllamaSection.d.ts.map