import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { AntigravityQuotaGroup, AntigravityWebStatus } from '../../shared/antigravity-contracts.ts';
import { type ComposerQuotaFacts } from '../common/ComposerQuotaBadge.tsx';
import type { SnapshotStore } from '../store.ts';
import { NS_ANTIGRAVITY } from './locales.ts';
type Props = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS_ANTIGRAVITY> & {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory: () => void;
};
/**
 * The bucket this badge should speak for, or null when it cannot speak for one.
 *
 * The service reports the same allowances under separate model groups, and a
 * bucket the service never measured must not be published as "0% left". So the
 * badge skips it and takes the next measured one in the group, and shows nothing
 * at all when the group has none. Falling back to another group's numbers would
 * label one allowance with another's reading.
 *
 * Exported for its own regression test; the badge is its only caller.
 */
export declare function selectQuotaBucketForModel(groups: AntigravityQuotaGroup[], modelId?: string): {
    groupName: string;
    bucketName: string;
    remainingPercent: number;
    resetTime: string | undefined;
} | null;
/** The allowance the selected model actually draws on, as the badge's facts. */
export declare function selectBadgeFacts(status: AntigravityWebStatus | null, modelId?: string): ComposerQuotaFacts;
export declare function AntigravityComposerQuota({ directory, loadModelDirectory, t }: Props): React.JSX.Element | null;
export {};
//# sourceMappingURL=AntigravityComposerQuota.d.ts.map