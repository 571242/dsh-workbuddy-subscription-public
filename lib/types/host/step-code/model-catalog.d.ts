/**
 * Step Code（Step Plan 订阅）线路的模型目录：URL 归一化、目录解析、能力装配。
 *
 * 存在的原因是本线路的一条硬规则，与 glm 线路那条同源而结论相反：
 * **能力不得从模型名推断，而目录完全靠运行时发现**。
 *
 * ## 随包目录为什么是空的
 *
 * 官方 Step-Code 的随包目录字面量就是空的，注释写得很直白（`step-provider/index.ts:148-152`）：
 *
 * > No built-in baseline: the Step catalog is discovered entirely from `{base}/v1/models`
 * > after login. When discovery is unavailable (offline / logged out / request failure)
 * > the list stays empty.
 *
 * 所以这里**不造**一张随包模型表。没有证据的 model id 进目录，等于让用户在没读过任何
 * 声明的情况下就用上一个未知能力的模型；把一个未知能力的模型渲染成「未声明模型」行
 * （见 {@link undeclaredStepCodeModelEntry}）至少是诚实的。
 *
 * 真正保证「取不到目录时选择器不为空」的，是 {@link undeclaredStepCodeModelEntry}：
 * 上游给什么 id 就以未声明行进入目录，不猜窗口、不认图、不发档位。
 *
 * ## 本文件与官方实现的对应
 *
 * 本文件把官方那几段**分散**在 `step-provider/index.ts` 里的东西收在一起
 * （归一化、发现、逐模型装配），并把它们暴露成后面几个波次可以直接 import 的函数：
 *
 * - {@link normalizeStepCodeApiBaseUrl} ← `normalizeStepApiBaseUrl`（`index.ts:378-401`）
 * - {@link stepCodeOpenAiBaseUrl} ← `stepOpenAiBaseUrl`（`index.ts:411`）
 * - {@link stepCodeModelsDetailBaseUrl} ← `stepModelsDetailBaseUrl`（`index.ts:420`）
 * - {@link parseStepCodeModelListing} ← `fetchStepModels` 的解析与过滤部分
 * - {@link undeclaredStepCodeModelEntry} ← `stepModelConfig` 的全部字段缺省路径
 */
import type { StepCodeModelOption, StepCodeProfile, StepCodeReasoningEffort } from '../../shared/step-code-contracts.ts';
/**
 * 把一个 Step 端点归一化到「路由前缀」。
 *
 * Step 的配置（以及旧版 models.json）接受三种写法：带版本的操作 URL（`/v1/messages`）、
 * `/messages` 操作、以及 `/v1` 父路径。把这些尾部段循环剥掉，调用方才能在同一个值上
 * 按当前方言补上正确的后缀而不把版本段发两次。
 *
 * **幂等**是官方的明确要求（`index.ts:382-387`）：某个中间版本产出的文件里可能已经
 * 有一个重复的后缀（`/v1/v1/messages`），而这个函数也被用来修这样的存量文件。
 * 所以它不是「剥一层」而是「循环剥到剥不动」，对任意多个残留的版本 / 操作段都收敛。
 *
 * 解析不了的输入原样返回：修复 models.json 里一个畸形的自定义条目时，
 * 那个条目必须保持原样，好让正常的校验去报它的问题，而不是在这里被静默改写。
 *
 * @param value - 任意一个 Step 模型面端点写法。
 * @returns 去掉尾部版本 / 操作段之后的路由前缀。
 */
export declare function normalizeStepCodeApiBaseUrl(value: string): string;
/**
 * OpenAI 风格的 base（`.../v1`），供 chat 与目录发现共用。
 *
 * `apiBase` 传进来时通常已经归一化过（尾部 `/v1` 已剥），所以补一个 `/v1`
 * 对四条 profile 都对：
 *
 * - `step_plan`    → `https://api.stepfun.com/step_plan/v1`
 * - `platform_cn`  → `https://api.stepfun.com/v1`
 *
 * chat 请求在这个 base 上拼 `/chat/completions`，目录发现拼 `/models`。
 * 这里再归一化一次是**有意的**：调用方可能直接传了环境变量里的原始值。
 */
export declare function stepCodeOpenAiBaseUrl(apiBase: string): string;
/**
 * 逐模型详情查询的 base：**域名根的 `/v1`**。
 *
 * 这一处的端点位置是反直觉的：profile 是 `step_plan` 时目录在 `.../step_plan/v1/models`，
 * 但详情在 `https://api.stepfun.com/v1/models/{id}`——带子路径的那个变体会 404
 * （逐字：`index.ts:414-419`）。所以这里取 `origin` 而不是路径。
 *
 * 不是合法 URL 时原样返回（与归一化函数同样的理由：让它保持可校验）。
 */
export declare function stepCodeModelsDetailBaseUrl(apiBase: string): string;
/** chat completions 的完整 URL（OpenAI 兼容面，全部四条 profile 走这一条）。 */
export declare function stepCodeChatCompletionsUrl(apiBase: string): string;
/** 模型列表的完整 URL。 */
export declare function stepCodeModelsUrl(apiBase: string): string;
/** 一行模型能力。与 `StepCodeModelOption` 同义，去掉的只是「用户设置」那一半（见 {@link catalogModelOptions}）。 */
export interface StepCodeModelEntry {
    id: string;
    name: string;
    /** 一句话能力描述：思考形态 / 可选档位 / 输入模态 / 上下文窗口。由 {@link describeStepCodeModel} 生成。 */
    hint: string;
    /** 服务该模型线的 profile。同一个 id 在四条 profile 上的可用性可能不同。 */
    profiles: readonly StepCodeProfile[];
    /**
     * 该模型**真实**接受的思考档位梯子（mapper 会把它当 ladder 传给收敛函数）。
     *
     * **空数组是有意语义**：该模型完全不发思考控制字段
     * （`convergeStepCodeEffort` 对空梯子返回 null，mapper 据此不发出 `reasoning_effort`）。
     * 这不是「忘了填」，是「不发」。
     */
    reasoningEfforts: readonly StepCodeReasoningEffort[];
    /** 思考能否关闭。与上一条**正交**：档位非空而本项为 false = 恒定开启。 */
    thinkingDisableable: boolean;
    /** 是否接受 image 输入。 */
    supportsImages: boolean;
    /** 目录报的 `max_input_tokens`，也就是上下文窗口。 */
    defaultContextWindow: number;
    /** 调用方不指定输出上限时本线路请求的输出上限；端点不报，默认等于上下文窗口。 */
    defaultMaxTokens: number;
    /** 官方描述；没有逐字来源时为 null（不编文案）。 */
    description: string | null;
}
/** 一行能力去掉 `hint` 的样子：hint 由 {@link withHint} 从其余字段生成，不手写。 */
export type StepCodeModelFacts = Omit<StepCodeModelEntry, 'hint'>;
/**
 * 解析上游 `GET {base}/v1/models` 的应答。
 *
 * 接受 `{ data: [...] }`（OpenAI 形状）与裸数组两种形状：两个都要认，是因为
 * 「目录空掉」与「目录里多了奇怪的条目」同样难排查，而多认一种形状的代价是零。
 *
 * 无 id 的条目被丢弃而不是给一个占位 id：一个没有 id 的模型行在选择器里无法被请求，
 * 留着只是让用户点一个必然失败的东西。
 *
 * @param payload - 上游应答解析后的 JSON。
 * @returns 能力行，顺序与上游一致；解析不出任何东西时是空数组。
 */
export declare function parseStepCodeModelListing(payload: unknown): StepCodeModelEntry[];
/**
 * 随包发布的目录：**空**。
 *
 * 理由与取值见文件头：官方就没有随包基线（`STEP_MODELS = []`，`index.ts:154`），
 * 本线路也不编一张。它在代码里仍然作为常量导出，是为了让「随包目录存在且为空」
 * 这件事本身是一个可以被断言的事实，而不是「忘了写这个文件」。
 *
 * 留空**不会**让选择器变空：取不到目录时目录由 {@link undeclaredStepCodeModelEntry}
 * 的未声明行撑住（上游给什么 id 就以什么 id 出现），而两者都没有时线路只是不暴露模型。
 */
export declare const STEP_CODE_MODEL_CATALOG: readonly StepCodeModelEntry[];
/** 随包目录里的全部 id（恒为空数组；保留导出形状是为了让调用方的类型推导稳定）。 */
export declare const STEP_CODE_MODEL_IDS: readonly string[];
/**
 * 首次安装默认勾选的模型。
 *
 * 恒为空：因为随包目录是空的（见上），而真实目录在登录后才由运行时发现。
 * token-store 把它作为默认值的唯一来源——默认值取自**随包**目录而不是运行时目录，
 * 是为了让「用户没选过」与「用户选了运行时目录里的某个 id」这两件事不互相污染
 * （同 glm 线路把 `GLM_MODEL_CATALOG` 排除在设置文档之外的同一条理由）。
 */
export declare const DEFAULT_VISIBLE_MODEL_IDS: readonly string[];
/**
 * 未知模型的**未声明**行。
 *
 * 什么时候会有：上游目录里出现了本线路没有逐字能力的 id（发了新模型，或本仓库还没跟上）。
 * 这时最诚实的做法是什么都不主张：
 *
 * - `reasoningEfforts: []` → `convergeStepCodeEffort` 返回 null，mapper 一个字段都不发；
 * - `supportsImages: false` → 请求里的图片按「读不出来」明说，而不是发一个上游会拒的 image_url；
 * - `thinkingDisableable: true` → 目录没声明「恒定开启」，那就永远不发关闭值；
 * - 上下文窗口只有在上游明确报了 `max_input_tokens` 时才用它的值，否则用兜底值。
 *
 * 但本线路**不**因此把 id 藏起来：这是与 glm 线路不同的一处决定。
 * 那里未声明行默认不勾选，是因为那行的 `wire` 是 `null`——调它必然拿到 1212；
 * 这里的协议面是固定的（四条 profile 全是 OpenAI Chat Completions），调它是合法的，
 * 只是能力未知。所以未声明行**默认可见**，只是文案点明它是未声明的。
 */
export declare function undeclaredStepCodeModelEntry(id: string, options?: {
    contextWindow?: number;
    profiles?: readonly StepCodeProfile[];
}): StepCodeModelEntry;
/**
 * 查一行模型能力；给定目录里没有时返回**未声明行**而不是 undefined。
 *
 * 返回未声明行而不是空，是为了让调用方只需要处理一种东西：每个 id 都有一份
 * 「不主张什么」的声明，不必另开一条「找不到模型」的分支。
 */
export declare function resolveStepCodeModel(id: string, catalog?: readonly StepCodeModelEntry[]): StepCodeModelEntry;
/** 该模型真实接受的思考档位；不在目录里时是空数组（即「不发任何思考控制字段」）。 */
export declare function stepCodeReasoningEfforts(id: string, catalog?: readonly StepCodeModelEntry[]): readonly StepCodeReasoningEffort[];
/** 该模型是否接受图片输入；不在目录里时为 false（不认图比乱认图安全）。 */
export declare function stepCodeModelSupportsImages(id: string, catalog?: readonly StepCodeModelEntry[]): boolean;
/** 该模型的输出上限；不在目录里时取「等于上下文窗口」。 */
export declare function maxOutputTokensFor(id: string, catalog?: readonly StepCodeModelEntry[]): number;
/** 该模型的上下文窗口；不在目录里时取 {@link DEFAULT_CONTEXT_WINDOW}。 */
export declare function defaultContextWindowFor(id: string, catalog?: readonly StepCodeModelEntry[]): number;
/** 目录里的全部 id。 */
export declare function listModelIds(catalog?: readonly StepCodeModelEntry[]): string[];
/** 目录条目数，供 hub 概览显示「M 个模型可用」。 */
export declare function catalogSize(catalog?: readonly StepCodeModelEntry[]): number;
/**
 * {@link catalogSize} 的别名。
 *
 * 存在的唯一理由是名字歧义：本线路的「随包目录」恒为空，所以下游看到 `catalog` 时
 * 需要能一眼分清它指随包表还是运行时发现的表（运行时表要传进来，随包表不用）。
 * 两个名字指向同一个函数，不是两份逻辑。
 */
export declare const catalogTotal: typeof catalogSize;
/** 一条 profile 能调的模型（`profiles` 是路由事实：不在列表里的不要发过去）。 */
export declare function modelsForProfile(profile: StepCodeProfile, catalog?: readonly StepCodeModelEntry[]): StepCodeModelEntry[];
/**
 * 从一行能力生成设置卡上的一句话描述（四个要素：思考形态 / 档位 / 输入模态 / 上下文窗口）。
 *
 * 由数据生成而不是逐行手写，是为了让文案**不可能与能力表漂移**：手写文案出过
 * 「三个档位」的模型实际只有两档这种事故，而这几个字段都要被 mapper 当成事实使用。
 *
 * @param entry - 能力行。
 * @param prefix - 可选前缀（未声明行用「未声明模型」点明这不是已核实的声明）。
 */
export declare function describeStepCodeModel(entry: StepCodeModelEntry, prefix?: string): string;
/** 用户设置对目录装配的两处覆盖。 */
export interface StepCodeCatalogOptionOverrides {
    /**
     * 用户勾选的模型 id。
     *
     * **缺省或空数组 = 不过滤（全选）**；非空 = 显式选择（含只有一项）。
     *
     * 为什么是这两条而不是三态（`null` = 不过滤）：冻结契约里的
     * `StepCodeSettingsUpdateDto.enabledModelIds` 是 `string[]`，没有 null 这一格；
     * 而本线路的目录是**登录后才运行时发现**的，一个刚装上还没登录的用户手里
     * 必然只有一个空数组。把空数组读成「一个都不启用」会让设置页在用户还没登录时
     * 就显示成「已禁用全部模型」——那是关于目录的谎报，目录这时根本还不存在。
     * 真要把模型全关，关线路总开关（`enabled`）是明确且语义正确的那一个动作。
     */
    enabledModelIds?: readonly string[];
    /** 逐模型上下文窗口覆盖；null / 非正数表示用目录默认值。 */
    contextWindowOverrides?: Readonly<Record<string, number | null | undefined>>;
}
/**
 * 把目录装配成设置面的模型行。
 *
 * `hint` 在这里生成（而不是写死在表里），所以「文案与能力表一致」是结构保证的：
 * 表里改一次档位或图片支持，卡片上的那句话就跟着变。
 *
 * 未声明行**默认可见**（与 glm 线路相反，理由见 {@link undeclaredStepCodeModelEntry}）：
 * 本线路的协议面是固定的，调用它是合法的，未知的只是能力。
 */
export declare function catalogModelOptions(catalog?: readonly StepCodeModelEntry[], overrides?: StepCodeCatalogOptionOverrides): StepCodeModelOption[];
//# sourceMappingURL=model-catalog.d.ts.map