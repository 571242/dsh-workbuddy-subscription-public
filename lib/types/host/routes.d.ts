import type { Context } from '@deepseek-ai/cordis';
import type { FetchConfigurationDto, SubagentRouteAuditDto } from '../shared/contracts.ts';
import type { CodexAccountPool } from './codex-account-pool.ts';
import { OAuthService } from './oauth-service.ts';
import { type SubscriptionPreferenceStore } from './preferences.ts';
import type { ProxyManager } from './proxy-manager.ts';
import type { SearchProviderSwitcher } from './search-provider-switcher.ts';
import { UsageService } from './usage-service.ts';
/** Read-only audit provider the optional route serves. */
export type RouteAuditReader = (sessionId: string) => Promise<SubagentRouteAuditDto>;
/**
 * Test seam for the adopt routes: the paths the Codex reader consults.
 *
 * Present for the same reason the Claude line carries 'adoptPaths': the reader
 * resolves its own path from CODEX_HOME, and a test must point it at a fixture
 * rather than at the machine it is running on. Production callers take the default.
 */
export interface RouteAdoptOptions {
    adoptPaths?: readonly string[];
}
export declare function registerRoutes(ctx: Context, oauth: OAuthService, usage: UsageService, preferences: SubscriptionPreferenceStore, proxyManager?: ProxyManager, searchSwitcher?: SearchProviderSwitcher, routeAudit?: RouteAuditReader, accountPool?: CodexAccountPool, fetchConfiguration?: FetchConfigurationDto, adopt?: RouteAdoptOptions): () => void;
//# sourceMappingURL=routes.d.ts.map