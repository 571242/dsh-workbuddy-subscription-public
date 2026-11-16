import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { ClaudeWebStatus } from '../../shared/claude-contracts.ts';
import { type ComposerQuotaFacts } from '../common/ComposerQuotaBadge.tsx';
import type { SnapshotStore } from '../store.ts';
import { NS_CLAUDE } from './locales.ts';
type Props = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS_CLAUDE> & {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory: () => void;
};
/**
 * Pick the most meaningful number for the badge.
 *
 * A subscription is bounded by several windows at once — a 5-hour one and a
 * weekly one, and sometimes a per-model weekly one as well. They are not
 * interchangeable: the short window can be spent while the long one has room and
 * the reverse, so the TIGHTEST *remaining* percentage is what the badge shows
 * and its own label names the tooltip. Choosing "the shortest window" instead
 * would be a guess about which one runs out first, and the payload already
 * answers that.
 *
 * NOTE ON DIRECTION: the wire reports `usedPercent`, which is PERCENT USED, so
 * remaining is 100 - used. A window at 0% used is the normal empty state and
 * grades as 'normal', not as an error.
 */
export declare function selectBadgeFacts(status: ClaudeWebStatus | null): ComposerQuotaFacts | null;
export declare function ClaudeComposerQuota({ directory, loadModelDirectory, t }: Props): React.JSX.Element | null;
export {};
//# sourceMappingURL=ClaudeComposerQuota.d.ts.map