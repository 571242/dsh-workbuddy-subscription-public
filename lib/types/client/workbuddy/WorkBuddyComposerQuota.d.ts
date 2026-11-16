import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkBuddyWebStatus } from '../../shared/workbuddy-contracts.ts';
import { type ComposerQuotaFacts } from '../common/ComposerQuotaBadge.tsx';
import type { SnapshotStore } from '../store.ts';
import { NS_WORKBUDDY } from './locales.ts';
type Props = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS_WORKBUDDY> & {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory: () => void;
};
/**
 * Pick the most meaningful number for the badge.
 *
 * A bounded allowance is what a user spends down, so it wins over a bare credit
 * balance; the balance shows only when no percentage is reported. The billing
 * payload reports both a cycle meter and a package meter, and the cycle meter
 * is the one that actually resets, so it is preferred when both exist.
 */
export declare function selectBadgeFacts(status: WorkBuddyWebStatus | null): ComposerQuotaFacts | null;
export declare function WorkBuddyComposerQuota({ directory, loadModelDirectory, t }: Props): React.JSX.Element | null;
export {};
//# sourceMappingURL=WorkBuddyComposerQuota.d.ts.map