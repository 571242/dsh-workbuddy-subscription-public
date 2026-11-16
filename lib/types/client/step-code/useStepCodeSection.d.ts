import type { AccountRotationStrategy } from '../../shared/account-pool-contracts.ts';
import { type StepCodeAccountSummaryDto, type StepCodeAdoptResultDto, type StepCodeConnectionDto, type StepCodeLoginFlowStatus, type StepCodeModelOption, type StepCodeProfile, type StepCodeQuotaCredentialStatusDto, type StepCodeQuotaSnapshotDto, type StepCodeReasoningEffort, type StepCodeStatusDto } from '../../shared/step-code-contracts.ts';
import type { AccountPoolLabels } from '../common/AccountPoolSection.tsx';
import { zh } from './locales.ts';
/** 卡片渲染的键。与兄弟卡片一样用自己的字典，不复用 hub 挂在 settings.section 上的座位。 */
export type Translate = (key: keyof typeof zh) => string;
/** 本卡片的字典；身份稳定，依赖它的 effect 才不会每次渲染重建。 */
export declare const fallbackTranslate: Translate;
/**
 * 本线路的缓存统计（本机自报，token 维度）。
 *
 * 契约没有把它写进 StepCodeStatusDto —— 冻结时缓存用量仍在 mapper 与 cache-stats 侧，
 * 所以这里声明一个**只读**的形状，并由 readCacheStats 在运行时从 status 上取：host
 * 一旦下发，卡片直接有数据；还没下发时读侧显示占位而不是 0%。
 *
 * 三个数都是 token，没有金额：官方模型表里四个 cost 键全是 0（STEP_CODE_PRICING_STATUS
 * = 'undocumented-zero'），拿 0 当单价算出「省了 0 元」是正确但无用。
 */
export interface StepCodeCacheStats {
    /** 本进程累计的缓存读入 token（字段口径见 STEP_CODE_CACHE_READ_FIELD_ORDER）。 */
    cacheReadTokens: number;
    /** 本进程累计的**未命中**输入 token（prompt 减去缓存读入的部分）。 */
    missedInputTokens: number;
    /** 写侧 token，在本线路恒为 0；卡片按 STEP_CODE_CACHE_WRITE_NOTE 标注而不画条。 */
    cacheWriteTokens: number;
    /** 这些数字覆盖了几次请求；没有它就不知道样本有多大。 */
    requests: number | null;
}
/**
 * 从一份 status 里取缓存统计；取不到返回 null。
 *
 * 返回 null 而不是零值对象，是因为「上游没报」与「报了个 0」在卡片上必须长得不一样：
 * 前者显示占位符，后者显示真实的 0%。
 */
export declare function readCacheStats(status: StepCodeStatusDto | null): StepCodeCacheStats | null;
/**
 * 缓存命中率 = 缓存读入 /（缓存读入 + 未命中输入）。
 *
 * 分母为 0（还没有任何请求，或上游只报了输出 token）时返回 **null**，卡片据此画占位符：
 * 把「没有样本」写成 0% 是谎报——它说的是「一个都没命中」，而事实是「还不知道」。
 */
export declare function cacheHitRatio(stats: StepCodeCacheStats | null): number | null;
/** 写侧的线路常量；卡片用它渲染说明，而不是渲染一条永远为 0 的进度条。 */
export declare const CACHE_WRITE_NOTE = "always-zero-on-this-route";
export interface StepCodeSectionProps {
    onModelChange?: () => void;
}
/** 账号卡片上的一个动作。 */
export type StepCodeAccountAction = 'set-primary' | 'delete' | 'clear-cooldown' | 'relogin';
/** 额度凭据的三种提交方式（对应 host 的 /quota/credential 的 mode）。 */
export type StepCodeQuotaCredentialMode = 'password' | 'manual' | 'clear';
/** 视图可以消费的全部内容，按「会变的事实 / 从答案派生的 / 能触发的」分组。 */
export interface StepCodeSectionView {
    state: {
        status: StepCodeStatusDto | null;
        loading: boolean;
        busy: string | null;
        error: string | null;
        connection: StepCodeConnectionDto | null;
        adoptResult: StepCodeAdoptResultDto | null;
        /** 手工粘贴的 Platform API Key；提交后立即清空，只在这一行的受控输入里存在。 */
        pasteValue: string;
        /** 「手工粘贴」与「导入」按哪个 profile 发起。 */
        profile: StepCodeProfile;
        /** 手工粘贴兜底是否展开（没有进行中的流程时默认收起）。 */
        pasteOpen: boolean;
        contextDrafts: Record<string, string>;
        savingModel: string | null;
        /** 额度凭据：开放平台账号（非机密）与两条一次性输入。 */
        quotaAccount: string;
        quotaPassword: string;
        quotaToken: string;
    };
    derived: {
        accounts: StepCodeAccountSummaryDto[];
        models: StepCodeModelOption[];
        /** 上下文窗口编辑器的行：只有勾选了的模型才有可覆盖的窗口。 */
        contextModels: StepCodeModelOption[];
        overrideCount: number;
        login: StepCodeLoginFlowStatus | null;
        quota: StepCodeQuotaSnapshotDto | null;
        authenticated: boolean;
        poolLabels: AccountPoolLabels;
        /** 缓存统计；host 未下发时为 null（卡片显示占位而不是 0%）。 */
        cache: StepCodeCacheStats | null;
        /** 缓存命中率；没有样本时为 null。 */
        cacheHitRatio: number | null;
        /** 额度凭据的**状态**（有没有、从哪来），不是凭据本身。 */
        quotaCredential: StepCodeQuotaCredentialStatusDto | null;
    };
    actions: {
        setProfile(profile: StepCodeProfile): void;
        login(profile: StepCodeProfile): Promise<void>;
        cancelLogin(): Promise<void>;
        submitPaste(): Promise<void>;
        setPasteValue(value: string): void;
        togglePaste(): void;
        adopt(): Promise<void>;
        clearAdoptResult(): void;
        accountAction(action: StepCodeAccountAction, accountId: string): Promise<void>;
        setStrategy(strategy: AccountRotationStrategy): Promise<void>;
        toggleModel(modelId: string, enabled: boolean): void;
        setAllModels(enabled: boolean): void;
        saveContextWindow(modelId: string): Promise<void>;
        resetContextWindow(modelId: string): Promise<void>;
        resetAllContextWindows(): Promise<void>;
        updateContextDraft(modelId: string, draft: string): void;
        setDefaultReasoningEffort(effort: StepCodeReasoningEffort | null): Promise<void>;
        setCacheRequestParams(enabled: boolean): Promise<void>;
        refreshQuota(): Promise<void>;
        refreshCatalog(): Promise<void>;
        testConnection(): Promise<void>;
        setQuotaAccount(value: string): void;
        setQuotaPassword(value: string): void;
        setQuotaToken(value: string): void;
        submitQuotaPassword(): Promise<void>;
        submitQuotaToken(): Promise<void>;
        clearQuotaCredential(): Promise<void>;
    };
}
export declare function useStepCodeSection({ onModelChange }?: StepCodeSectionProps): StepCodeSectionView;
//# sourceMappingURL=useStepCodeSection.d.ts.map