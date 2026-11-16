import type { AccountRotationStrategy } from '../../shared/account-pool-contracts.ts';
import { type GlmAccountSummaryDto, type GlmAdoptResultDto, type GlmConnectionDto, type GlmLoginFlowStatus, type GlmModelOption, type GlmQuotaSnapshotDto, type GlmRegion, type GlmStatusDto } from '../../shared/glm-coding-plan-contracts.ts';
import type { AccountPoolLabels } from '../common/AccountPoolSection.tsx';
import { zh } from './locales.ts';
/** 卡片渲染的键。与兄弟卡片一样用自己的字典，不复用 hub 挂在 settings.section 上的座位。 */
export type Translate = (key: keyof typeof zh) => string;
/** 本卡片的字典；身份稳定，依赖它的 effect 才不会每次渲染重建。 */
export declare const fallbackTranslate: Translate;
export interface GlmCodingPlanSectionProps {
    onModelChange?: () => void;
}
/** 账号卡片上的一个动作。 */
export type GlmAccountAction = 'set-primary' | 'delete' | 'clear-cooldown' | 'relogin';
/** 视图可以消费的全部内容，按「会变的事实 / 从答案派生的 / 能触发的」分组。 */
export interface GlmCodingPlanSectionView {
    state: {
        status: GlmStatusDto | null;
        loading: boolean;
        busy: string | null;
        error: string | null;
        connection: GlmConnectionDto | null;
        adoptResult: GlmAdoptResultDto | null;
        pasteValue: string;
        /** 「导入」与「手工粘贴」按哪个区域发起；两个登录按钮各自固定区域，不读它。 */
        region: GlmRegion;
        /** 手工粘贴兜底是否展开（没有进行中的流程时默认收起）。 */
        pasteOpen: boolean;
        contextDrafts: Record<string, string>;
        savingModel: string | null;
    };
    derived: {
        accounts: GlmAccountSummaryDto[];
        models: GlmModelOption[];
        /** 上下文窗口编辑器的行：只有勾选了的模型才有可覆盖的窗口。 */
        contextModels: GlmModelOption[];
        overrideCount: number;
        login: GlmLoginFlowStatus | null;
        quota: GlmQuotaSnapshotDto | null;
        authenticated: boolean;
        poolLabels: AccountPoolLabels;
    };
    actions: {
        setRegion(region: GlmRegion): void;
        login(region: GlmRegion): Promise<void>;
        cancelLogin(): Promise<void>;
        submitPaste(): Promise<void>;
        setPasteValue(value: string): void;
        togglePaste(): void;
        adopt(): Promise<void>;
        clearAdoptResult(): void;
        accountAction(action: GlmAccountAction, accountId: string): Promise<void>;
        setStrategy(strategy: AccountRotationStrategy): Promise<void>;
        toggleModel(modelId: string, enabled: boolean): void;
        setAllModels(enabled: boolean): void;
        saveContextWindow(modelId: string): Promise<void>;
        resetContextWindow(modelId: string): Promise<void>;
        resetAllContextWindows(): Promise<void>;
        updateContextDraft(modelId: string, draft: string): void;
        refreshQuota(): Promise<void>;
        refreshCatalog(): Promise<void>;
        testConnection(): Promise<void>;
    };
}
export declare function useGlmCodingPlanSection({ onModelChange }?: GlmCodingPlanSectionProps): GlmCodingPlanSectionView;
//# sourceMappingURL=useGlmCodingPlanSection.d.ts.map