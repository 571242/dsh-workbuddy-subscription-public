import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { MinimaxCodeWebStatus } from '../../shared/minimax-code-contracts.ts';
import { type ComposerQuotaFacts } from '../common/ComposerQuotaBadge.tsx';
import type { SnapshotStore } from '../store.ts';
import { NS_MINIMAX_CODE } from './locales.ts';
type Props = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS_MINIMAX_CODE> & {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory: () => void;
};
/**
 * Pick the badge facts for one status answer, or nothing at all.
 *
 * Quota is optional in the contract, and the usage read is allowed to fail (the
 * endpoint is undocumented and which host serves this subscription is
 * unmeasured), so a status without quota means the badge has nothing to say: it
 * is not rendered, rather than showing a placeholder that would read as a broken
 * meter. Callers must treat null as "hide the badge".
 */
export declare function selectBadgeFacts(status: MinimaxCodeWebStatus | null): ComposerQuotaFacts | null;
export declare function MinimaxCodeComposerQuota({ directory, loadModelDirectory, t }: Props): React.JSX.Element | null;
export {};
//# sourceMappingURL=MinimaxCodeComposerQuota.d.ts.map