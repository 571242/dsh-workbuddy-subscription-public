import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type GuardOptions } from './host/reasoning-collapse-guard/index.ts';
import { type NoAnswerResumeOptions } from './host/no-answer-resume/index.ts';
/**
 * 运行期配置形状：标了 `volatile()` 的字段在 loader 解析之后是**活引用**。
 *
 * 这一份是插件体在 `apply` 里真正拿到的形状，也是 {@link Config} schema 的输出
 * 类型；{@link ConfigInput} 才是 profile 里写的普通值。
 */
export interface Config {
    /** Independent web fetch selection; auto preserves proxy/search-driven selection.
     * Plugin mode uses the plugin destination policy, not DSH DNS pinning, even without a proxy. */
    fetchProvider?: 'auto' | 'plugin' | 'dsh';
    /** Plugin fetch decoded character limit (positive safe integer); the DSH tool may truncate again. */
    fetchMaxBodyChars?: number;
    /** Plugin fetch response byte limit (positive safe integer). */
    fetchMaxResponseBytes?: number;
    /**
     * Whether to sync this package's bundled agent presets into the
     * harness-home preset root (`<dshHome>/.agent-presets`) at startup, making
     * them selectable for new sessions on any machine that installs the plugin.
     * Default `true`. Only the preset ids this package ships are ever written
     * or retired; presets the user authored are never touched.
     */
    syncAgentPresets?: boolean;
    /**
     * Whether the Subagent model allowlist also governs the route a delegation
     * that selects no model would inherit from its parent. Default `true`; set
     * `false` to leave inherited routes to the built-in delegation tool.
     */
    subagentModelAuthorization?: boolean;
    /** Delegation tool names the authorization guard recognizes (default `subagent`). */
    subagentModelTools?: string[];
    /**
     * Delegation tools that always run their child on the calling agent's route
     * and therefore expose no `provider`/`model` (default `['subagent_fork']`).
     * An allowlist-carrying Session then still denies the call when the inherited
     * route is not authorized, instead of silently running an unauthorized child.
     * Set `[]` to leave these tools on the built-in behavior.
     */
    subagentModelInheritTools?: string[];
    /**
     * `session` (default) enforces the allowlist a Session recorded, matching the
     * delegation tool's snapshot; `preference` also enforces the current Settings
     * card allowlist for Sessions that recorded none.
     */
    subagentModelScope?: 'session' | 'preference';
    /**
     * Reasoning-collapse guard tuning. **Disabled by default**: the guard is
     * shipped and fully wired, but this line no longer installs it unless a
     * deployment explicitly opts in. Set the key to an object (`{}` accepts the
     * shipped defaults) to turn the break back on; `false` keeps it off.
     */
    reasoningCollapseGuard?: GuardOptions | false;
    /**
     * Resume a turn that ended without an answer or a tool call. Omit the key
     * (or set it to `false`) to leave the turn failed; the shipped defaults
     * apply otherwise.
     */
    noAnswerResume?: NoAnswerResumeOptions | false;
    /**
     * Idle budget for one Codex Responses stream, in milliseconds.
     *
     * Counted on transport activity rather than on visible chunks, so status
     * frames and truncated reasoning keep the connection alive. `0` is not a
     * disable switch: the floor is 1ms, and a real stall still times out.
     */
    codexStreamIdleTimeoutMs?: number;
    /**
     * 「进展更新」总开关。打开后 agent 可以用 `progress_update` 工具在不结束回
     * 合的前提下主动汇报多步任务的进展，网页在对话流里显示成一行，右侧栏面板汇
     * 总。默认关闭：这是一条会改变模型行为的提示词，必须由部署人显式打开。
     *
     * 声明成 {@link Volatile} 是因为 schema 里标了 `volatile()`：loader 把这个字段
     * 解析成一个活引用交进 `apply`，设置一保存就就地写新值、不重挂插件行。
     */
    progressUpdates?: Volatile<boolean>;
    /**
     * 进展更新的催促阈值：连续这么多轮带工具调用却没有进展更新时，给模型追加一
     * 条提醒。默认 8（与 `NUDGE_THRESHOLD` 同一个数，两处不会漂移）。
     */
    progressUpdatesNudgeThreshold?: Volatile<number>;
}
/**
 * profile 里写的配置形状：volatile 字段在这里仍是普通值。
 *
 * 两者必须分开声明——schemastery 的 `z<S, T>` 是「输入 / 输出」二元组，写成一个
 * 合并的接口会让 schema 与声明互相矛盾（`volatile()` 的字段输出是引用，输入是
 * 值）。分开放还有一个好处：测试与部署方写配置时用的是 {@link ConfigInput}，
 * 手写活引用不会被误认为合法部署配置。
 */
export interface ConfigInput {
    /** Independent web fetch selection; auto preserves proxy/search-driven selection.
     * Plugin mode uses the plugin destination policy, not DSH DNS pinning, even without a proxy. */
    fetchProvider?: 'auto' | 'plugin' | 'dsh';
    /** Plugin fetch decoded character limit (positive safe integer); the DSH tool may truncate again. */
    fetchMaxBodyChars?: number;
    /** Plugin fetch response byte limit (positive safe integer). */
    fetchMaxResponseBytes?: number;
    /** Whether to sync this package's bundled agent presets into the harness-home preset root. */
    syncAgentPresets?: boolean;
    /** Whether the Subagent model allowlist also governs the route a delegation would inherit. */
    subagentModelAuthorization?: boolean;
    /** Delegation tool names the authorization guard recognizes (default `subagent`). */
    subagentModelTools?: string[];
    /** Delegation tools that always run their child on the calling agent's route. */
    subagentModelInheritTools?: string[];
    /** `session` (default) enforces the recorded allowlist; `preference` also enforces the current card. */
    subagentModelScope?: 'session' | 'preference';
    /** Reasoning-collapse guard tuning; `false` keeps the guard off. */
    reasoningCollapseGuard?: GuardOptions | false;
    /** Resume a turn that ended without an answer or a tool call; `false` leaves it failed. */
    noAnswerResume?: NoAnswerResumeOptions | false;
    /** Idle budget for one Codex Responses stream, in milliseconds. */
    codexStreamIdleTimeoutMs?: number;
    /** 「进展更新」总开关（默认关闭，打开后往系统提示词里加入引导节）。 */
    progressUpdates?: boolean;
    /** 进展更新的催促阈值（默认 8）。 */
    progressUpdatesNudgeThreshold?: number;
}
export declare const Config: z<ConfigInput, Config>;
export declare const inject: string[];
export declare function apply(ctx: Context, pluginConfig?: Config): void;
export { RELAY_PROBE_ENV, RELAY_PROBE_FILE_ENV, RELAY_PROBE_FILE_NAME, RELAY_PROBE_MAX_BYTES, RELAY_SOURCE_KINDS, RelayProbe, createFileRelayProbeSink, installRelayProbe, relayProbeEnabled, relayProbeEnvFile, relayProbeEnvValue, relayProbeLogPath, } from './host/relay-probe.ts';
export type { AgentsLookup, ProbeAgent, ProbeEvent, ProbeSession, RelayProbeContext, RelayProbeOptions, RelayProbeSink, } from './host/relay-probe.ts';
export { DEFAULT_GUARD_OPTIONS, RESUME_HINT, RESUME_HINT_STRICT, collapseScore, installReasoningCollapseGuard, resolveGuardOptions, } from './host/reasoning-collapse-guard/index.ts';
export type { GuardAgentLike, GuardChunk, GuardOptions, GuardStreamOptions, ReasoningCollapseContext, ResolvedGuardOptions, } from './host/reasoning-collapse-guard/index.ts';
export { ProxyManager, detectSystemProxy } from './host/proxy-manager.ts';
export { DEFAULT_SUBAGENT_INHERIT_TOOLS, SUBAGENT_MODEL_SELECTION_NAMESPACE, SUBAGENT_POLICY_EVENT, authorizedRoutesFor, createSubagentAuthorization, delegationDenialReason, delegationModeOf, inheritOverrideReason, inheritRouteDenialReason, inheritedRouteOf, installSubagentModelAuthorization, normalizeDelegationToolNames, normalizeInheritToolNames, parseAllowedRoutes, policyRoutesOf, subagentModelSelectionPreference, unauthorizedRouteReason, validateAuthorizationScope, validateDelegationToolNames, validateInheritToolNames, } from './host/subagent-model-authorization.ts';
export { auditChildRoutes, auditedRoutesOf, childRoutesOf, effectiveRouteOf, readChildDescriptor, violationText, } from './host/subagent-route-audit.ts';
export type { AuditedRoute, AuditedSession, AuditedSessions, ChildRouteFinding, RouteViolation, } from './host/subagent-route-audit.ts';
export { OAuthService } from './host/oauth-service.ts';
export { CodexAccountPool, codexPoolPath, parseCodexPoolData, type CodexPoolAccount, type CodexTokenRefresher, } from './host/codex-account-pool.ts';
export { AccountPoolCore, normalizeRotationStrategy } from './host/common/account-pool.ts';
export { dshHomeDir } from './host/common/home.ts';
export { CodexChatGptAdapter } from './host/adapter.ts';
export { createCodexImageTool } from './host/codex-images.ts';
export { createAntigravityImageTool } from './host/antigravity/image-tool.ts';
export { createCodexSearchProvider } from './host/codex-search.ts';
export { createCodexFetchProvider } from './host/codex-fetch.ts';
export { SearchProviderSwitcher, type SearchProviderSwitcherStatus } from './host/search-provider-switcher.ts';
export { ResponsesClient, parseResponsesStream } from './host/responses-client.ts';
export { UsageService, mapCodexUsage, parseCodexUsage } from './host/usage-service.ts';
export { createPlatformTokenStore } from './host/platform-token-store.ts';
export { MacKeychainTokenStore } from './host/token-store-macos.ts';
export { LinuxFileTokenStore } from './host/token-store-linux.ts';
export { WindowsDpapiTokenStore } from './host/token-store-windows.ts';
export type { TokenStore, StoredOAuthCredentials } from './host/token-store.ts';
export { AntigravityAdapter } from './host/antigravity/adapter.ts';
export { CommandCodeAccountPool, commandCodePoolPath, commandCodeAccountKey, parseCommandCodePoolData, type CommandCodePoolAccount, type CommandCodeAccountSummaryDto, } from './host/command-code/account-pool.ts';
export { CommandCodeAdapter } from './host/command-code/adapter.ts';
export { FileCredentialStore as CommandCodeCredentialStore, FileModelSettingsStore as CommandCodeModelSettingsStore, credentialPath as commandCodeCredentialPath, modelSettingsPath as commandCodeModelSettingsPath, registerCommandCodePreferenceStore, } from './host/command-code/token-store.ts';
export { beginWebLogin as startCommandCodeLogin, getWebLoginStatus as getCommandCodeLoginStatus, saveApiKey as saveCommandCodeApiKey, } from './host/command-code/oauth.ts';
export { getCommandCodeWebStatus, registerCommandCodeRoutes } from './host/command-code/routes.ts';
export { fetchAccountQuota as fetchCommandCodeQuota, clearCachedQuota as clearCommandCodeQuota, getCachedQuota as getCommandCodeQuota, loadProviderModels as loadCommandCodeModels, } from './host/command-code/client.ts';
export { KimiCodeAdapter, classifyKimiFailure, KIMI_CODE_RETRY_POLICY_CONFIG } from './host/kimi-code/adapter.ts';
export { FileCredentialStore as KimiCodeCredentialStore, FileModelSettingsStore as KimiCodeModelSettingsStore, credentialPath as kimiCodeCredentialPath, modelSettingsPath as kimiCodeModelSettingsPath, registerKimiCodePreferenceStore, resolveRegion as resolveKimiCodeRegion, } from './host/kimi-code/token-store.ts';
export { beginWebLogin as beginKimiCodeLogin, ensureAccessToken as ensureKimiCodeAccessToken, getWebLoginStatus as getKimiCodeLoginStatus, refreshAccessToken as refreshKimiCodeToken, requestDeviceAuthorization as requestKimiCodeDeviceAuthorization, } from './host/kimi-code/oauth.ts';
export { fetchAccountQuota as fetchKimiCodeQuota, fetchUserInfo as fetchKimiCodeUserInfo, loadProviderModels as loadKimiCodeModels, clearCachedQuota as clearKimiCodeQuota, getCachedQuota as getKimiCodeQuota, } from './host/kimi-code/client.ts';
export { getKimiCodeWebStatus, registerKimiCodeRoutes } from './host/kimi-code/routes.ts';
export { WorkBuddyAdapter, classifyFailure as classifyWorkBuddyFailure } from './host/workbuddy/adapter.ts';
export { FileCredentialStore as WorkBuddyCredentialStore, FileModelSettingsStore as WorkBuddyModelSettingsStore, codeBuddyAuthDir, modelSettingsPath as workBuddyModelSettingsPath, parseCredentialFile as parseWorkBuddyCredential, registerWorkBuddyPreferenceStore, scanCredentials as scanWorkBuddyCredentials, } from './host/workbuddy/token-store.ts';
export { fetchAccountQuota as fetchWorkBuddyQuota, clearCachedQuota as clearWorkBuddyQuota, getCachedQuota as getWorkBuddyQuota, clearCachedCatalog as clearWorkBuddyCatalog, loadConfigCatalog as loadWorkBuddyModels, parseConfigModels as parseWorkBuddyConfigModels, refreshCredentials as refreshWorkBuddyCredentials, parseBilling as parseWorkBuddyBilling, } from './host/workbuddy/client.ts';
export { getWorkBuddyWebStatus, registerWorkBuddyRoutes } from './host/workbuddy/routes.ts';
export { WorkBuddyCheckinService } from './host/workbuddy/checkin.ts';
export { MinimaxCodeCheckinService } from './host/minimax-code/checkin.ts';
export { FALLBACK_MODELS as WORKBUDDY_MODELS, WORKBUDDY_MODEL_IDS, resolveWorkBuddyModel, modelsForRegion as workBuddyModelsForRegion, } from './host/workbuddy/model-catalog.ts';
export { ClaudeAdapter, codeForFailure as claudeCodeForFailure, toLlmError as claudeToLlmError, } from './host/claude/adapter.ts';
export { ClaudeAccountPool, claudePoolPath, parseClaudePoolData, adoptedPoolAccountKey, isAdoptedPoolCredential, type ClaudePoolAccount, type ClaudeAccountSummaryDto, } from './host/claude/account-pool.ts';
export { FileCredentialStore as ClaudeCredentialStore, FileModelSettingsStore as ClaudeModelSettingsStore, credentialPath as claudeCredentialPath, modelSettingsPath as claudeModelSettingsPath, parseClaudeCredentials, parseClaudeCredentialDocument, registerClaudePreferenceStore, type ClaudeCredentials, type ClaudeModelSettings, type ClaudePreferenceStore, } from './host/claude/token-store.ts';
export { beginLogin as beginClaudeLogin, cancelLogin as cancelClaudeLogin, ensureAccessToken as ensureClaudeAccessToken, getLoginStatus as getClaudeLoginStatus, refreshAccessToken as refreshClaudeToken, resolveLoginInput as resolveClaudeLoginInput, submitLoginInput as submitClaudeLoginInput, } from './host/claude/oauth.ts';
export { claudeCodeCredentialPaths, claudeCodeCredentialPresence, isAdoptedClaudeCredential, isAdoptedCredentialExpired, readClaudeCodeCredentials, ADOPTED_CREDENTIAL_EXPIRED_HINT as CLAUDE_ADOPTED_CREDENTIAL_EXPIRED_HINT, } from './host/claude/adopt.ts';
export { clearCachedCatalog as clearClaudeCatalog, clearCachedQuota as clearClaudeQuota, classifyFailure as classifyClaudeFailure, fetchAccountQuota as fetchClaudeQuota, getCachedQuota as getClaudeQuota, loadCatalog as loadClaudeCatalog, parseUsagePayload as parseClaudeUsagePayload, probeConnection as probeClaudeConnection, } from './host/claude/client.ts';
export { getClaudeWebStatus, registerClaudeRoutes, ROUTE_PREFIX as CLAUDE_ROUTE_PREFIX, buildClaudeModelOptions as buildClaudeModelOptions, resolveEnabledModelIds as resolveClaudeEnabledModelIds, } from './host/claude/routes.ts';
export { CLAUDE_MODELS, CLAUDE_MODEL_IDS, DEFAULT_VISIBLE_MODEL_IDS as CLAUDE_DEFAULT_VISIBLE_MODELS, FALLBACK_MODELS as CLAUDE_FALLBACK_MODELS, claudeModelCanDisableThinking, claudeModelSupportsImage, claudeModelSupportsTemperature, claudeReasoningEfforts, claudeThinkingMode, defaultContextWindowFor as claudeDefaultContextWindow, maxOutputTokensFor as claudeMaxOutputTokens, resolveClaudeModel, type ClaudeModelEntry, } from './host/claude/model-catalog.ts';
export { API_BASE as CLAUDE_API_BASE, MESSAGES_PATH as CLAUDE_MESSAGES_PATH, PROVIDER_ID as CLAUDE_PROVIDER_ID, PROVIDER_NAME as CLAUDE_PROVIDER_NAME, QUOTA_CACHE_TTL_MS as CLAUDE_QUOTA_CACHE_TTL_MS, claudeCliVersion, setClaudeCliVersion, } from './host/claude/types.ts';
export { CLAUDE_REASONING_EFFORTS, isClaudeReasoningEffort, type ClaudeAccountQuota, type ClaudeConnectionDto, type ClaudeLoginFlowDto, type ClaudeModelOption, type ClaudeQuotaWindow, type ClaudeReasoningEffort, type ClaudeSettingsUpdateDto, type ClaudeWebStatus, } from './shared/claude-contracts.ts';
export { KimiCodeAccountPool, kimiCodePoolPath, parseKimiCodePoolData, type KimiCodePoolAccount, } from './host/kimi-code/account-pool.ts';
export { KIMI_CODE_MODELS, kimiCodeModelDef, } from './host/kimi-code/model-catalog.ts';
export { FileCredentialStore, FileModelSettingsStore, credentialPath, modelSettingsPath, } from './host/antigravity/token-store.ts';
export { AccountPoolStore } from './host/antigravity/account-pool.ts';
export { GlmCodingPlanAdapter, GLM_CODING_PLAN_RETRY_POLICY_CONFIG, GLM_POOL_COOLDOWN_MS, buildGlmRequestPlan, glmCooldownDecision, readGlmResetAt, type GlmRequestPlan, } from './host/glm-coding-plan/adapter.ts';
export { GlmAdoptedCredentialRefreshError, GlmCodingPlanAccountPool, glmCodingPlanPoolIdentity, glmCodingPlanPoolPath, glmCodingPlanPoolQuota, glmCodingPlanPoolStatus, parseGlmCodingPlanPoolData, type GlmCodingPlanAccountSummary, type GlmCodingPlanPoolAccount, type GlmCodingPlanPoolStatus, } from './host/glm-coding-plan/account-pool.ts';
export { GLM_CODING_PLAN_PREFERENCES_NAMESPACE, GlmCodingPlanCredentialStore, GlmCodingPlanModelSettingsStore, credentialPath as glmCodingPlanCredentialPath, credentialsFromAdopt, credentialsFromCliLogin, isAdoptedCredential as isAdoptedGlmCodingPlanCredential, mergeGlmCodingPlanSettings, modelSettingsPath as glmCodingPlanModelSettingsPath, parseGlmCodingPlanCredentials, registerGlmCodingPlanPreferenceStore, type GlmCodingPlanCredentialOrigin, type GlmCodingPlanCredentials, type GlmCodingPlanModelSettings, type GlmCodingPlanPreferenceStore, type GlmCodingPlanSettingsPatch, } from './host/glm-coding-plan/token-store.ts';
export { getGlmCodingPlanStatus, glmCatalogSize, glmCodingPlanSettingsSource, glmSubPathOf, registerGlmCodingPlanRoutes, type GlmCodingPlanRouteOptions, type GlmCodingPlanSettingsSource, } from './host/glm-coding-plan/routes.ts';
export { GLM_MODEL_CATALOG, GLM_MODEL_IDS, catalogModelOptions, catalogSize as glmCodingPlanCatalogCount, modelsForRegion as glmCodingPlanModelsForRegion, resolveGlmModel, type GlmModelEntry as GlmCodingPlanModelEntry, } from './host/glm-coding-plan/model-catalog.ts';
export { PROVIDER_ID as GLM_CODING_PLAN_ROUTE_PROVIDER_ID, PROVIDER_NAME as GLM_CODING_PLAN_ROUTE_PROVIDER_NAME, QUOTA_WINDOW_MINUTES as GLM_CODING_PLAN_QUOTA_WINDOW_MINUTES, authorizeUrl as glmCodingPlanAuthorizeUrl, convergeGlmEffort, isGlmReasoningEffort, normalizeRegion as normalizeGlmCodingPlanRegion, } from './host/glm-coding-plan/types.ts';
export { adoptZcodeSignIn as adoptGlmZcodeSignIn, isAdoptedZcodeCredential as isAdoptedGlmZcodeCredential, zcodeCredentialsPath, } from './host/glm-coding-plan/adopt.ts';
export { fetchGlmQuota, getCachedQuota as getCachedGlmCodingPlanQuota, loadCatalog as loadGlmCodingPlanCatalog, verifyCodingPlanKey as verifyGlmCodingPlanKey, } from './host/glm-coding-plan/client.ts';
export { loginAndSave, beginWebLogin, refreshAntigravityToken } from './host/antigravity/oauth.ts';
export { clearCachedQuota, fetchAccountQuota, getCachedQuota } from './host/antigravity/client.ts';
export { MinimaxCodeAdapter, classifyMinimaxFailure, MINIMAX_CODE_RETRY_POLICY_CONFIG } from './host/minimax-code/adapter.ts';
export { MinimaxCodeAccountPool, minimaxCodePoolPath, minimaxCodePoolIdentity, minimaxCodePoolStatus, parseMinimaxCodePoolData, createMinimaxCodeAccountsHandler, type MinimaxCodePoolAccount, type MinimaxCodeAccountSummaryDto, } from './host/minimax-code/account-pool.ts';
export { MinimaxCodeCredentialStore, MinimaxCodeModelSettingsStore, authJsonPath as minimaxCodeAuthJsonPath, authStateJsonPath as minimaxCodeAuthStateJsonPath, credentialIsFresh as minimaxCodeCredentialIsFresh, minimaxHomeDir as minimaxCodeHomeDir, modelSettingsPath as minimaxCodeModelSettingsPath, parseMinimaxCodeCredentials, pluginCredentialPath as minimaxCodePluginCredentialPath, registerMinimaxCodePreferenceStore, type MinimaxCodeCredentialSource, type MinimaxCodeCredentials, type MinimaxCodeModelSettings, type MinimaxCodePreferenceStore, } from './host/minimax-code/token-store.ts';
export { accountFromCredentials as minimaxCodeAccountFromCredentials, beginWebLogin as beginMinimaxCodeLogin, cancelWebLogin as cancelMinimaxCodeLogin, ensureAccessToken as ensureMinimaxCodeAccessToken, getWebLogin as getMinimaxCodeLogin, isRefreshTokenRejected as isMinimaxCodeRefreshTokenRejected, pollWebLogin as pollMinimaxCodeLogin, refreshAccessToken as refreshMinimaxCodeToken, requestDeviceAuthorization as requestMinimaxCodeDeviceAuthorization, resetWebLogins as resetMinimaxCodeLogins, revokeToken as revokeMinimaxCodeToken, createPkcePair as createMinimaxCodePkcePair, type DeviceAuthorization as MinimaxCodeDeviceAuthorization, type MinimaxToken, } from './host/minimax-code/oauth.ts';
export { PROBE_MODEL as MINIMAX_CODE_PROBE_MODEL, catalogSize as minimaxCodeCatalogSize, createMessage as createMinimaxCodeMessage, describeCredentials as describeMinimaxCodeCredentials, listModelIds as listMinimaxCodeModelIds, modelRequestHeaders as minimaxCodeModelRequestHeaders, parseAnthropicUsage as parseMinimaxCodeUsage, testConnection as testMinimaxCodeConnection, summarizeFailureBody as summarizeMinimaxCodeFailureBody, clearCachedQuota as clearMinimaxCodeQuota, fetchTokenPlanQuota as fetchMinimaxCodeQuota, getCachedQuota as getMinimaxCodeQuota, parseTokenPlanQuota as parseMinimaxCodeQuota, quotaRequestHeaders as minimaxCodeQuotaRequestHeaders, resolveQuotaCounts as resolveMinimaxCodeQuotaCounts, type MinimaxProbeResult, type MinimaxUsage, } from './host/minimax-code/client.ts';
export { MINIMAX_CODE_MODELS, buildMinimaxCodeModelOptions, contextWindowForModel, effortForModel as minimaxCodeEffortForModel, isThinkingDisabledEffort, minimaxCodeModelDef, minimaxCodeModelIds, minimaxCodeModelName, resolveMinimaxCodeEnabledModelIds, type MinimaxCodeCatalogModel, type MinimaxCodeThinkingMode, } from './host/minimax-code/model-catalog.ts';
export { assertRequestBodyFits as assertMinimaxCodeBodyFits, assertStreamComplete as assertMinimaxCodeStreamComplete, buildMinimaxRequest, clampOutputToContext as clampMinimaxCodeOutputToContext, closeMinimaxStream, createStreamState as createMinimaxCodeStreamState, DEFAULT_MAX_MESSAGE_BODY_BYTES as MINIMAX_CODE_MAX_MESSAGE_BODY_BYTES, maxMessageBodyBytes as minimaxCodeMaxMessageBodyBytes, maxOutputTokensFor as minimaxCodeMaxOutputTokens, processMinimaxStreamLine, outputConfigFor as minimaxCodeOutputConfig, type MinimaxStreamState, } from './host/minimax-code/mapper.ts';
export { getMinimaxCodeWebStatus, registerMinimaxCodeRoutes, subPathOf as minimaxCodeSubPathOf, } from './host/minimax-code/routes.ts';
export { AGENT_LLM_PREFIX as MINIMAX_CODE_AGENT_LLM_PREFIX, MESSAGES_PATH as MINIMAX_CODE_MESSAGES_PATH, REGION_HOSTS as MINIMAX_CODE_REGION_HOSTS, accountHost as minimaxCodeAccountHost, agentBaseUrl as minimaxCodeAgentBaseUrl, isMinimaxCodeReasoningEffort, quotaHostCandidates as minimaxCodeQuotaHostCandidates, tokenPlanRemainsUrl as minimaxCodeTokenPlanRemainsUrl, messagesUrl as minimaxCodeMessagesUrl, redactToken as redactMinimaxCodeToken, } from './host/minimax-code/types.ts';
export { MINIMAX_CODE_PROVIDER_ID, MINIMAX_CODE_PROVIDER_NAME, MINIMAX_CODE_REASONING_EFFORTS, MINIMAX_CODE_ROUTE_PREFIX, type MinimaxCodeAccount, type MinimaxCodeCredentialStorage, type MinimaxCodeModelOption, type MinimaxCodeQuota, type MinimaxCodeReasoningEffort, type MinimaxCodeRegion, type MinimaxCodeThinkingModeDto, type MinimaxCodeWebLogin, type MinimaxCodeWebStatus, } from './shared/minimax-code-contracts.ts';
export { StepCodeAdapter, STEP_CODE_POOL_COOLDOWN_MS, STEP_CODE_RETRY_POLICY_CONFIG, cachedStepCodeModelCatalog, readStepCodeCacheStats, rememberStepCodeCacheUsage, stepCodeCatalogSize, stepCodeModelCatalogFrom, type StepCodeAdapterOptions, type StepCodePickedCredential, } from './host/step-code/adapter.ts';
export { StepCodeAccountPool, StepCodeCredentialRefreshError, stepCodePoolIdentity, stepCodePoolPath, stepCodePoolQuota, stepCodePoolStatus, stepCodePoolStatusSlice, type StepCodePoolAccount, type StepCodePoolStatus, } from './host/step-code/account-pool.ts';
export { getStepCodeStatus, registerStepCodeRoutes, stepCodeSettingsSource, stepCodeSubPathOf, type StepCodePoolSlice, type StepCodeRouteOptions, type StepCodeSettingsSource, type StepCodeStatusSources, } from './host/step-code/routes.ts';
export { StepCodeCredentialStore, StepCodeModelSettingsStore, StepCodeQuotaCredentialStore, credentialPath as stepCodeCredentialPath, modelSettingsPath as stepCodeModelSettingsPath, quotaCredentialPath as stepCodeQuotaCredentialPath, registerStepCodePreferenceStore, type StepCodeCredentials, type StepCodeModelSettings, type StepCodePreferenceStore, type StepCodeQuotaCredential, type StepCodeSettingsPatch, } from './host/step-code/token-store.ts';
export { STEP_CODE_PROVIDER_ID, STEP_CODE_PROVIDER_NAME, STEP_CODE_ROUTE_PREFIX, STEP_CODE_PROFILES, type StepCodeAccountSummaryDto, type StepCodeAdoptResultDto, type StepCodeCacheStatsDto, type StepCodeConnectionDto, type StepCodeLoginFlowStatus, type StepCodeModelOption, type StepCodeProfile, type StepCodeQuotaSnapshotDto, type StepCodeReasoningEffort, type StepCodeStatusDto, } from './shared/step-code-contracts.ts';
//# sourceMappingURL=index.d.ts.map