import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CommandCodeWebStatus } from '../../shared/command-code-contracts.ts';
import { type ComposerQuotaFacts } from '../common/ComposerQuotaBadge.tsx';
import type { SnapshotStore } from '../store.ts';
import { NS_COMMAND_CODE } from './locales.ts';
type Props = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS_COMMAND_CODE> & {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory: () => void;
};
/**
 * Pick the most meaningful number for the badge.
 *
 * A bounded usage window is the number a user actually spends down, so it wins
 * over a credit balance; the balance shows only when no window is reported.
 */
export declare function selectBadgeFacts(status: CommandCodeWebStatus | null): ComposerQuotaFacts | null;
export declare function CommandCodeComposerQuota({ directory, loadModelDirectory, t }: Props): React.JSX.Element | null;
export {};
//# sourceMappingURL=CommandCodeComposerQuota.d.ts.map