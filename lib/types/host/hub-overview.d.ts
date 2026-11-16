/**
 * The hub overview route: one read-only answer that summarizes every
 * subscription line, so the settings page's opening screen renders all of its
 * provider cards from a single request instead of fanning out to eight status
 * endpoints.
 *
 * Aggregation is assembled here but the facts are not: each line owns its
 * `read` closure (built in src/index.ts where that line's stores are in
 * scope), so this module never learns how a line stores accounts or what
 * "enabled" means for it. The route is GET-only and carries no secrets, so it
 * needs no same-origin mutation guard.
 */
import type { Context } from '@deepseek-ai/cordis';
import { HUB_OVERVIEW_PATH } from '../shared/hub-contracts.ts';
import type { HubProviderSummaryDto } from '../shared/hub-contracts.ts';
export { HUB_OVERVIEW_PATH };
/** One line's contribution to the overview; the read closure is the line's own. */
export interface HubSummarySource {
    /** Client descriptor key the card is rendered from, e.g. 'chatgpt'. */
    id: string;
    providerId: string;
    canToggle: boolean;
    read(): Promise<Omit<HubProviderSummaryDto, 'id' | 'providerId' | 'canToggle'>>;
}
export declare function registerHubOverviewRoutes(ctx: Context, sources: readonly HubSummarySource[]): () => void;
//# sourceMappingURL=hub-overview.d.ts.map