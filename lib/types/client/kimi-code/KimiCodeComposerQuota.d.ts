import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { KimiCodeWebStatus } from '../../shared/kimi-code-contracts.ts';
import { type ComposerQuotaFacts } from '../common/ComposerQuotaBadge.tsx';
import type { SnapshotStore } from '../store.ts';
import { NS_KIMI_CODE } from './locales.ts';
type Props = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS_KIMI_CODE> & {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory: () => void;
};
/**
 * Pick the most meaningful number for the badge.
 *
 * The shortest window is the one a user spends down first and the one that
 * blocks work soonest, so it wins over the longer pools; the 7-day allowance
 * shows only when no 5-hour window is reported.
 */
export declare function selectBadgeFacts(status: KimiCodeWebStatus | null): ComposerQuotaFacts | null;
export declare function KimiCodeComposerQuota({ directory, loadModelDirectory, t }: Props): React.JSX.Element | null;
export {};
//# sourceMappingURL=KimiCodeComposerQuota.d.ts.map