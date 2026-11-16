/**
 * Provider and vendor brand marks for the hub overview cards and the shared
 * model checklist.
 *
 * The artwork lives in brand-svg.ts as inline strings (extracted from the
 * vendored combine lockups); this module adds the presentation: a rounded,
 * brand-tinted tile for provider cards, a bare mark for model rows, and the
 * ordered model-id → vendor rules. A model no rule claims draws no mark at
 * all — a wrong vendor's mark reads as a wrong answer, not a missing one
 * (the same principle claude-style's brand.js documents).
 */
import { type BrandMarkKey } from './brand-svg.ts';
export type HubProviderId = 'chatgpt' | 'antigravity' | 'command-code' | 'kimi-code' | 'workbuddy' | 'minimax-code' | 'glm-coding-plan' | 'claude' | 'ollama' | 'step-code';
/** 一张标记的键：BRAND_MARKS 的全部键，加上本文件自带的键。 */
export type ProviderMarkKey = BrandMarkKey | 'glm' | 'step-code';
interface ProviderBrand {
    /** Key into BRAND_MARKS (or LOCAL_MARKS); absent for monogram-only providers. */
    mark?: ProviderMarkKey;
    /**
     * Text color for artwork that draws in currentColor (OpenAI's knot, Kimi's
     * K, Claude's mark). Self-colored artwork (gradients, multi-fill marks)
     * leaves this undefined.
     */
    color?: string;
    /** Brand color the tile's tinted background is mixed from. */
    tile: string;
    /** Monogram for providers without vendored artwork. */
    monogram?: string;
}
export declare const PROVIDER_BRANDS: Record<HubProviderId, ProviderBrand>;
/** One brand mark at a given box size; the artwork is decorative. */
export declare function BrandMark({ mark, color, size }: {
    mark: ProviderMarkKey;
    color?: string;
    size?: number;
}): React.JSX.Element;
/**
 * The overview card's logo tile: the mark centered on a rounded square tinted
 * with the brand color, in the QQ-mail idiom. The tile element doubles as the
 * fallback surface for monogram providers.
 */
export declare function BrandTile({ id, size }: {
    id: HubProviderId;
    size?: number;
}): React.JSX.Element;
export declare function modelBrandMark(modelId: string): ProviderMarkKey | null;
export {};
//# sourceMappingURL=brand-icons.d.ts.map