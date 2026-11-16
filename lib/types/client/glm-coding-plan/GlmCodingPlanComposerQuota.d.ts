import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type GlmStatusDto } from '../../shared/glm-coding-plan-contracts.ts';
import { type ComposerQuotaFacts } from '../common/ComposerQuotaBadge.tsx';
import type { SnapshotStore } from '../store.ts';
import { NS_GLM_CODING_PLAN, type GlmCodingPlanLocaleKey } from './locales.ts';
type Props = PropsRuntime<'conversation.input.right'> & PropsLocale<typeof NS_GLM_CODING_PLAN> & {
    directory: SnapshotStore<ModelDirectoryState>;
    loadModelDirectory: () => void;
};
/**
 * 胶囊显示「最紧的那个窗口」的剩余百分比。
 *
 * 三个窗口（5 小时 / 1 周 / 1 月）互相独立地重置，用户当下真正被卡住的是**已用比例
 * 最高**的那一个：另外两个可能还剩一大半。所以这里不平均、不取最小剩余，而是取最大
 * 已用；已用相等时取更短的窗口——重置更早的那个才是当下的瓶颈。
 *
 * 窗口名不硬编码：键映射成窗口长度后交给共享的 quotaWindowLabel 本地化
 * （5 小时 / 1 周 / 1 月 / 5 hours / 1 week / 1 month）。
 *
 * 没有快照、没有窗口、或全部窗口都没有百分比时返回 null，即**不渲染胶囊**：
 * 契约允许 quota 为 null，装一个占位数字比不显示更像坏了。
 */
export declare function selectBadgeFacts(status: GlmStatusDto | null, lookup?: (key: GlmCodingPlanLocaleKey) => string): ComposerQuotaFacts | null;
export declare function GlmCodingPlanComposerQuota({ directory, loadModelDirectory, t }: Props): React.JSX.Element | null;
export {};
//# sourceMappingURL=GlmCodingPlanComposerQuota.d.ts.map