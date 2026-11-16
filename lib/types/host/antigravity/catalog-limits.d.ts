import { type AntigravityModelDef } from './types.ts';
import type { AntigravityCatalogModel } from './token-store.ts';
/** Every runtime id one selectable model can send, in routing order. */
export declare function runtimeIdsFor(modelId: string): string[];
export interface AntigravityModelLimits {
    contextWindow: number;
    maxTokens: number;
}
/**
 * The limits one selectable model advertises, preferring what
 * `fetchAvailableModels` reported over the built-in table.
 *
 * One selectable model fans out to several runtime ids (one per effort), and
 * the harness sizes a conversation once for all of them, so the smallest
 * reported value wins: a conversation sized for the largest would overflow the
 * moment the user drops to an effort whose runtime is smaller. A runtime the
 * catalog is silent about leaves the built-in value in force, which is also all
 * there is before the first catalog refresh.
 */
export declare function effectiveModelLimits(model: Pick<AntigravityModelDef, 'id' | 'contextWindow' | 'maxTokens'>, catalog: readonly AntigravityCatalogModel[] | undefined): AntigravityModelLimits;
/** The output ceiling the catalog reported for one runtime id, if it did. */
export declare function catalogMaxOutputFor(runtimeId: string, catalog: readonly AntigravityCatalogModel[] | undefined): number | undefined;
//# sourceMappingURL=catalog-limits.d.ts.map