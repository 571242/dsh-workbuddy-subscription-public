/**
 * Step Code（Step Plan 订阅）线路的静态事实（host 侧）。
 *
 * 本文件里的每个取值都来自 `docs/step-code-line-plan.md` 的逐字证据或官方 Step-Code 源码，
 * 注释写明「是什么、为什么、证据来自哪」；凡是没有证据能确认的取值，都在注释里标了
 * 「未验证」并说明缺什么。**不另创事实**：本线路不发明端点、不发明字段、不发明档位。
 *
 * 三条必须记住的上游事实：
 *
 * 1. **区域由凭据里的 profile 唯一决定。** `api.stepfun.ai` 与 `api.stepfun.com`
 *    互不通用，国际区凭据打国区端点会被拒（`docs/step-integration.md:87-90`：
 *    the chosen profile … is the single source of the region afterwards）。
 *    所以端点永远从 profile 表里取，不在调用处按「当前设置」拼。
 * 2. **登录是云端轮询，不是本地回调。** CLI 只发 HTTPS 从不监听端口
 *    （`login-client.ts:9-10`：the CLI only makes outbound HTTPS requests and never
 *    listens on a port），所以流程能穿过 SSH、容器与没有浏览器的机器。
 * 3. **凭据永不过期、永不刷新。** Step 的 api_key 不是会话令牌：官方把它存成
 *    `{ type: 'oauth', access: apiKey, refresh: STEP_STATIC_REFRESH_TOKEN,
 *    expires: Number.MAX_SAFE_INTEGER }`（`step-provider/index.ts:363-371`），
 *    而 `refreshStepOAuth` 对任何不是那个哨兵的 refresh 一律抛错。
 *    因此 token store 与号池必须按「静态凭据」处理，且**不得**因为
 *    `expires` 是 MAX_SAFE_INTEGER 就判成异常。
 */
import type { StepCodeProfile, StepCodeReasoningEffort, StepCodeRegion } from '../../shared/step-code-contracts.ts';
export declare const PROVIDER_ID = "step-code";
export declare const PROVIDER_NAME = "Step Code\uFF08Step Plan \u8BA2\u9605\uFF09";
/** 本线路在 host 侧使用的档位名，等于共享契约的线路级词汇表（同一份数组，不另建一份）。 */
export declare const STEP_CODE_EFFORTS: readonly StepCodeReasoningEffort[];
/**
 * 这条线路的凭据是从哪来的。
 *
 * - `browser`：云端轮询的浏览器授权（Step Plan 订阅）。
 * - `apiKey`：用户手动粘贴的开放平台 API Key（按量计费）。
 *
 * 取值逐字来自 `PROFILE_DEFINITIONS.credentialSource`（`step/onboarding.ts:40,52,71,84`）。
 * 它与 profile 是一一对应的常量关系，所以仍然逐行写出来而不是由 profile 推导：
 * 官方自己的注释（`onboarding.ts:23-27`）把「一条 profile 自带它的端点与它的覆盖变量」
 * 写成一条规则，正是为了防止加一个区域时静默继承了另一个区域的端点。
 */
export type StepCodeCredentialSource = 'browser' | 'apiKey';
/** 一条 profile 的全部 host 侧事实。 */
export interface StepCodeProfileHosts {
    /** 凭据来源。 */
    credentialSource: StepCodeCredentialSource;
    /**
     * 模型面 base（**路由前缀**，不带尾部斜杠，也不带版本段）。
     *
     * Step Plan 两条是 `/step_plan`（套餐额度只在这个面生效），平台两条是 `/v1`。
     * 请求路径由 `model-catalog.ts` 的归一化函数在这条 base 上拼出来。
     */
    api: string;
    /** 授权 / 开发者中心源站。登录的 init/poll 与额度面的两个接口都打这里。 */
    auth: string;
    /** 用户拿 API Key 的页面（只用于卡片上给一个「去这里拿」的链接）。 */
    keyPage: string;
    /** 设置卡片上这一行的标题。 */
    title: string;
    /** 设置卡片上这一行的一句话说明。 */
    description: string;
}
/**
 * 四条 profile 的 host 表（逐字证据：`docs/step-integration.md:81-86` 的表，
 * 与 `step/onboarding.ts:33-87` 的 `PROFILE_DEFINITIONS` 互相印证）。
 *
 * `step_plan` 与 `platform_cn` 的 auth 同为 `https://platform.stepfun.com` 不是笔误：
 * Step Plan 只是同一个开发者中心的另一个套餐页，登录面是同一个；
 * 两者的差别只在**模型面**（`/step_plan` 与 `/v1`），也只在**计费方式**。
 */
export declare const PROFILE_HOSTS: Readonly<Record<StepCodeProfile, StepCodeProfileHosts>>;
/** 开发者中心上的 CLI 登录路由前缀（逐字：`login-client.ts:22`）。 */
export declare const CLI_LOGIN_PATH_PREFIX = "/api/stdhttp/v1/cli-login";
/**
 * 授权中转页路径（逐字：`login-client.ts:23`）。
 *
 * 授权页 URL **由客户端自己拼**：`{authBase}/cli-login-remote?flow_id=<flow_id>`。
 * 服务端即便返回了 authorize_url 也不采信——官方 `initStepCliLogin` 用 `new URL(path, origin)`
 * 加上 URLSearchParams 自己拼（`login-client.ts:139-141`），因为服务端给的那个值
 * 是从 CLI 看过去的（重定向到 CLI 而不是浏览器），对「人在浏览器里点」这件事没有意义。
 */
export declare const CLI_LOGIN_AUTHORIZE_PATH = "/cli-login-remote";
/** 开流端点：`POST {auth}{CLI_LOGIN_PATH_PREFIX}/init`。 */
export declare const CLI_INIT_PATH: string;
/** 轮询端点前缀：`GET {auth}{CLI_LOGIN_PATH_PREFIX}/poll/{flow_id}`。 */
export declare const CLI_POLL_PATH: string;
/**
 * poll_token 的熵长度：`randomBytes(32).toString('hex')`（逐字：`step-provider/index.ts:344`）。
 *
 * 32 字节 = 64 位十六进制字符。它是**本线路客户端侧唯一的凭据**：只出现在
 * `Authorization: Bearer` 头里，绝不进 URL、日志或磁盘（`login-client.ts:11-16`）。
 * `flow_id` 相反：它是公开标识，会进浏览器地址栏、历史与截图，单独一个兑不出凭据。
 */
export declare const POLL_TOKEN_ENTROPY_BYTES = 32;
/** poll_token 的形状（64 位 hex，64 个字符）。 */
export declare const POLL_TOKEN_PATTERN: RegExp;
/**
 * `flow_id` 的形状（逐字：`login-client.ts:36`）。
 *
 * 它会被插进轮询请求的路径里，所以必须收成一个不透明令牌：只允许字母数字、点、下划线、
 * 连字符，长度 1-128。不合法时是 **protocol** 类错误（不重试）——形状不对说明对面不是
 * 我们以为的那个服务端，重发多少次都是一样的错。
 */
export declare const FLOW_ID_PATTERN: RegExp;
/** 开流响应字段（逐字：`login-client.ts:130-142` 的读取与校验）。 */
export declare const CLI_INIT_RESPONSE_FIELDS: {
    readonly flowId: "flow_id";
    readonly pollIntervalSec: "poll_interval_sec";
    /** Unix **秒**（不是毫秒）。 */
    readonly expiresAt: "expires_at";
};
/** 就绪载荷字段（逐字：`login-client.ts:180-197`）。 */
export declare const CLI_READY_FIELDS: {
    readonly state: "state";
    readonly credential: "credential";
    readonly apiKey: "api_key";
    readonly uid: "uid";
    readonly reason: "reason";
};
/** 轮询的三种合法 state（逐字：`login-client.ts:170-186`）。 */
export declare const CLI_POLL_STATE: {
    readonly pending: "pending";
    readonly ready: "ready";
    readonly failed: "failed";
};
/**
 * `state=failed` 时**只有字面量 `denied`** 归为「用户在浏览器里拒绝了授权。
 *
 * 其余 reason 一律归为「未知失败」（逐字：`login-client.ts:172-178`）。
 * 这样分是因为两者的下一步不同：denied 是用户明确拒绝，再点一次登录可能就对了；
 * 未知失败更可能是上游的问题或流程已过期，重试同样的动作多半还是同样的错。
 */
export declare const CLI_FAILURE_DENIED = "denied";
/** 错误详情（`desc`）去控制字符之后的最大长度（逐字：`login-client.ts:39`）。 */
export declare const MAX_ERROR_DETAIL_LENGTH = 240;
/**
 * `uid` 的形状与长度上限（逐字：`login-client.ts:330`）。
 *
 * 它会被写进本机的凭据存储，所以先在这里收窄再落盘；不合格的**整个丢弃**而不是截断——
 * 截断出来的 uid 有可能与另一个账号撞上，而撞上的后果是号池里两行指向同一个身份。
 */
export declare const UID_PATTERN: RegExp;
export declare const UID_MAX_LENGTH = 64;
/**
 * 单次登录 HTTP 请求的超时：15 秒（逐字：`login-client.ts:27`）。
 *
 * 官方给的理由是：a stuck request must leave time for retries within the login deadline——
 * 卡住的单次请求必须给登录总时限里的重试留出余量。所以它是 15s 而不是「反正有总超时」。
 */
export declare const LOGIN_REQUEST_TIMEOUT_MS = 15000;
/**
 * 登录总超时：默认 10 分钟（逐字：`step-provider/index.ts:70`）。
 *
 * 它只是**外层上界**；真正决定轮询何时结束的是开流响应里的 `expires_at`
 * （`login-polling.ts:21`：the outer login owns the local timeout; this loop only
 * needs the server expiry）。两个都实现，取小的那个先到就停。
 * 可由 `STEP_OAUTH_TIMEOUT_MS` 覆盖（见本文件末尾的覆盖表）。
 */
export declare const LOGIN_FLOW_TIMEOUT_MS: number;
/**
 * 轮询间隔的客户端 clamp 上界：60 秒（逐字：`login-client.ts:39` 的 `MAX_POLL_INTERVAL_SEC`）。
 *
 * 下界 1 秒（`login-polling.ts:6` 的 `MIN_STEP_POLL_INTERVAL_MS`）来自上游自己
 * 只校验「不小于 1 秒」，它同时也是防打爆上游的底线。
 */
export declare const POLL_MIN_INTERVAL_MS = 1000;
export declare const POLL_MAX_INTERVAL_SEC = 60;
/**
 * 本线路凭据的 refresh 哨兵。
 *
 * 逐字：官方 `STEP_STATIC_REFRESH_TOKEN = 'step-static-credential'`
 * （`step-provider/index.ts:81`），且 `refreshStepOAuth` 对任何不是它的 refresh 直接抛错。
 * 落盘时原样保留这个常量，是为了让这份凭据**能被别人认出来**——包括本插件自己的号池。
 */
export declare const STATIC_REFRESH_TOKEN = "step-static-credential";
/**
 * 本线路凭据的 `expires`：`Number.MAX_SAFE_INTEGER`（逐字：`step-provider/index.ts:367`）。
 *
 * 为什么不是 `Infinity`：JSON 存不下 `Infinity`，而这份凭据要落盘。
 * 读回时**不得**把这个值当成「已过期的怪数据」——它是「永不过期」的写法。
 */
export declare const STATIC_EXPIRES_AT: number;
/**
 * 四个 profile **全部**走 OpenAI Chat Completions。
 *
 * 逐字（`step-provider/index.ts:86-92`）：All Step profile URLs speak the OpenAI Chat
 * Completions API (`{baseUrl}/chat/completions`)，随包基线与从 `{base}/models` 发现的
 * 模型共用这一个方言。所以本线路没有「逐模型声明协议面」那一维——
 * 与 glm-coding-plan 不同，不要给它加一个选错的可能。
 */
export declare const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";
/**
 * 模型列表路径：`GET {归一化 base}/v1/models`。
 *
 * 逐字（`step-provider/index.ts:406-411`）：`stepOpenAiBaseUrl` 在归一化后的 base 上
 * 补 `/v1`，而发现用的就是那个 base 的 `models`。
 */
export declare const MODELS_PATH = "/v1/models";
/**
 * 逐模型详情的 base：**域名根的 `/v1`**，不是 `{base}/v1`。
 *
 * 逐字（`step-provider/index.ts:414-420`）：The detail endpoint lives at the domain-root
 * `/v1`，即使 profile 是 `step_plan`（它的列表 base 是 `.../step_plan/v1`），
 * 带子路径的那个变体会 404。这是一个**反直觉但必须照抄**的端点位置。
 */
export declare const MODEL_DETAIL_BASE_PATH = "/v1";
/**
 * 目录里保留的 `model_type`。
 *
 * 逐字（`step-provider/index.ts:99-100`）：Step 是 coding agent，只保留可对话的类型——
 * 大语言模型与路由模型；网页搜索、TTS、ASR、实时语音、文生图等一律滤掉。
 * 这两个中文字面量**逐字照抄**，因为它们就是上游 `model_type` 的取值。
 */
export declare const USABLE_MODEL_TYPES: readonly string[];
/**
 * 目录没给的字段的兜底值（逐字：`step-provider/index.ts:103-107`）。
 *
 * `cost` 四个键全 0 不是笔误：上游没填过这张表。所以本线路的用量卡片
 * **只展示 token，不展示金额**（见共享契约的 `STEP_CODE_PRICING_STATUS`）。
 */
export declare const MODEL_DEFAULTS: {
    readonly reasoning: false;
    readonly cost: {
        readonly input: 0;
        readonly output: 0;
        readonly cacheRead: 0;
        readonly cacheWrite: 0;
    };
    readonly contextWindow: 256000;
};
/** 上下文窗口的兜底值：256000（逐字：`MODEL_DEFAULTS.contextWindow`）。 */
export declare const DEFAULT_CONTEXT_WINDOW: 256000;
/**
 * 目录没声明输出上限时的兜底：**等于上下文窗口**。
 *
 * 逐字（`step-provider/index.ts:124-126`）：The endpoint reports no max-output;
 * default it to the input window。所以「调用方不指定时的输出上限」不是一个独立常量，
 * 它是上下文窗口的派生值——本线路不给它写死一个数。
 */
export declare function defaultMaxTokens(contextWindow?: number): number;
/**
 * 开发者中心 Dashboard 的两个额度接口。
 *
 * ⚠ **这是非公开接口**（`/api/step.openapi.devcenter.Dashboard/…`，不属于任何公开契约），
 * 上游随时可能改路径或字段。所以它们与登录控制面分开放，且**每一段都要能单独降级**：
 * 额度失败（含上游改版）不得影响模型请求（计划 §5、§10 风险 1）。
 *
 * 逐字来源：计划 §5 的端点矩阵（第三方已实现的公开形态），与
 * `docs/step-integration.md` 里开发者中心的登录说明互相印证。
 */
export declare const QUOTA_PATHS: {
    /** 额度窗口 / Credit 池。 */
    readonly rateLimit: "/api/step.openapi.devcenter.Dashboard/QueryStepPlanRateLimit";
    /** 套餐状态（套餐名与续费时刻）。 */
    readonly planStatus: "/api/step.openapi.devcenter.Dashboard/GetStepPlanStatus";
};
/**
 * 账号密码换 Oasis-Token 的三步。
 *
 * 逐字：`GET {auth}` 取 `INGRESSCOOKIE` → `POST …/RegisterDevice` 拿匿名 token →
 * `POST …/SignInByPassword` 换 Oasis-Token。
 *
 * ⚠ **账号密码过手是本线路唯一的合规/稳定性风险点**，必须在 README 与设置页明示（计划 §5）。
 * 自动登录失败一律降级到「手动粘贴 Oasis-Token」，不得反复重试密码。
 */
export declare const QUOTA_AUTH_PATHS: {
    /** 匿名设备注册（换匿名 token）。 */
    readonly registerDevice: "/passport/proto.api.passport.v1.PassportService/RegisterDevice";
    /** 账号密码换 Oasis-Token。 */
    readonly signInByPassword: "/passport/proto.api.passport.v1.PassportService/SignInByPassword";
};
/**
 * 额度面的鉴权 Cookie（逐字：计划 §5）。
 *
 * `Oasis-Webid` 必须与该 token 的 `device_id` claim 一致，否则服务端报
 * 「token is embezzled」（计划 §10 风险 5）。所以它**不是一个可以随便填的请求头**，
 * 而是一对必须一起读一起存的凭据。
 */
export declare const QUOTA_COOKIE_NAMES: {
    readonly token: "Oasis-Token";
    readonly webid: "Oasis-Webid";
};
/** 开发者中心额外要求的两个头（逐字：计划 §5）。 */
export declare const QUOTA_HEADERS: {
    readonly appid: "oasis-appid";
    readonly platform: "oasis-platform";
    /** `oasis-webid` 既作请求头也作 Cookie 名，两处同一个字符串。 */
    readonly webid: "oasis-webid";
};
/**
 * `oasis-appid` 的取值：Oasis 网关注册的应用 id，**不是** `'web'`。
 *
 * 这个值由实测确定，不是猜的（2026-10-12 用真实请求打
 * `POST {authBase}/passport/proto.api.passport.v1.PassportService/RegisterDevice`）：
 *
 * ```
 * oasis-appid: web     -> HTTP 500  {"code":"internal","message":"app configuration is missing"}
 * oasis-appid: 10300   -> HTTP 200  {"accessToken":{...},"refreshToken":{...},"registry":{"appId":10300,...}}
 * ```
 *
 * 服务端拿这个头去查应用配置，查不到就报 `app configuration is missing`；而
 * `10300` 是它认的 id（响应里的 `registry.appId` 会把这个值回显出来，可据此复核）。
 * 它与 `oasis-platform` 的 `'web'` 是**两个不同的头**，早期实现把两者填成同一个值，
 * 于是每一步都 500——错误信息里看不出是哪个头的问题，只有对照一个能登录的客户端
 * （CodexBar 的 StepFun 实现，`appID = "10300"`）才能定案。
 */
export declare const OASIS_APP_ID: "10300";
/** 少了它 `RegisterDevice` 只返回 500，所以它是额度凭据流程的必需头，不是可选装饰。 */
export declare const OASIS_PLATFORM: "web";
/**
 * 额度面的两代载荷字段名。
 *
 * 逐字（计划 §5）：
 *
 * - **老式**：`five_hour_usage_left_rate` / `weekly_usage_left_rate` + 对应的 reset 时间。
 * - **新式**：`plan_family = 2` + `plan_credit_rate_limit.{subscription_credit_left_rate,
 *   topup_credit_left_rate, credit_buckets[]}`。
 *
 * 为什么逐条抄而不是抽象成一张表：这两代字段是**两份独立的上游事实**，
 * 它们之间的关系是「服务端换了一代」，不是「同一份数据的两种写法」。
 *
 * **判定规则**：按载荷形状判定，**不单信 `plan_family`**（计划 §5 的加粗句）。
 * `plan_family` 是一个可以先于载荷改版的字段，只认它就会把一份带
 * `credit_buckets` 但 `plan_family` 还没更新的新响应读成老式——
 * 代价是额度卡片显示「5 小时窗口」而用户实际在用 Credit 池。
 */
export declare const QUOTA_LEGACY_FIELDS: {
    readonly fiveHour: "five_hour_usage_left_rate";
    readonly weekly: "weekly_usage_left_rate";
};
export declare const QUOTA_CREDIT_FIELDS: {
    readonly planFamily: "plan_family";
    /** 新式套餐的 `plan_family` 取值。 */
    readonly creditPlanFamily: 2;
    readonly root: "plan_credit_rate_limit";
    readonly subscription: "subscription_credit_left_rate";
    readonly topup: "topup_credit_left_rate";
    readonly buckets: "credit_buckets";
};
/**
 * 每个额度窗口的名义长度（分钟），键就是线路自己的窗口标识。
 *
 * W6 装配 `PoolAccountQuotaDto` 时用这张表：共享的 `PoolAccountQuotaWindowDto`
 * 只有 `label` / `usedPercent` / `windowDurationMins` / `resetsAt`，**没有窗口 key**，
 * 所以长度是线路自己的 `key` 映射过去的唯一一座桥（同一条先例见 glm-coding-plan 的
 * `QUOTA_WINDOW_MINUTES` 与 minimax-code 的 `WINDOW_MINUTES`）。
 *
 * 装配时另有三条规则，它们不在本文件实现，但必须照做（由
 * `src/host/common/account-quota.ts` 的 `quotaWindow()` / `poolQuota()` 实现）：
 *
 * 1. `label` 一律传空字符串——窗口名的规范在客户端字典里，host 没有资格下发展示文案。
 * 2. `usedPercent` 为 null 的窗口必须丢弃——null 不是 0%，是「未说明」。
 * 3. Credit 池**不是窗口**，它装进 `creditBuckets`，不要硬塞进 `windows` 画成进度条。
 *
 * 取值：
 *
 * - `five-hour` = 300。逐字：老式载荷的字段名就是 5 小时窗口。
 * - `weekly` = 10_080。逐字：字段名是周窗口。
 * - `credit` = 43_200。**未验证**：Credit 是按月失效的池，上游给的是每个桶自己的
 *   `expiresAt`，**没有**声明池的长度；43200（30 天）是按词义取的，
 *   缺一份真实 Credit 响应的样本。取错的后果只影响卡片上的窗口名文案，
 *   不影响额度数字本身，所以按词义取并在此标注。
 */
export declare const QUOTA_WINDOW_MINUTES: Readonly<Record<'five-hour' | 'weekly' | 'credit', number>>;
/** stepcode 客户端的配置目录名（逐字：`step/environment.ts:6` 的 `STEPCODE_CONFIG_DIR`）。 */
export declare const STEPCODE_CONFIG_DIR = ".stepcode";
/** 本机 stepcode 客户端的凭据文件名（逐字：`step/auth.ts:19` 的 `getStepAuthPath`）。 */
export declare const STEPCODE_AUTH_FILE = "auth.json";
/**
 * adopt 要读的四个路径，按优先级排列（逐字：`step/auth.ts:29-45` 的 `getLegacyStepAuthPaths`）。
 *
 * 官方那条注释解释了顺序为什么这样：canonical root 那个文件排在最前，
 * 因为它是「需要就地归一化的旧 StepCode 凭据形状」，剩下的路径覆盖上一个版本
 * 写下的 Pi 形状文件。
 *
 * 本插件**只读**：只在用户显式点导入时读，绝不写入或删除 stepcode 的任何文件
 * （与 claude / codex / glm 的 adopt 语义一致）。
 */
export declare const STEPCODE_ADOPT_PATHS: readonly string[];
/**
 * adopt 必须认出的两种旧形状。
 *
 * - `legacy-product-shape`：`{ apiKey, profile, uid }`——StepCode 自己写的老文件。
 * - `pi-shaped`：`{ step: { type: 'oauth', access, refresh, expires, profile, uid } }`——
 *   通用 coding-agent 的 auth.json 按 provider id 分条的形状。
 *
 * 官方把前者叫「product-owned `{ apiKey, ... }` object」，把后者归到 Pi 形状
 * （`step/auth.ts:75-77`）。本插件两种都读，但**只读**：官方的做法是就地改写成规范形状，
 * 本插件不做那一步——改写别人的文件是一次没有授权的写操作。
 */
export declare const STEPCODE_ADOPT_SHAPES: readonly ["legacy-product-shape", "pi-shaped"];
/** 本线路读 stepcode 登录态时的文件权限期望（`0600`）。 */
export declare const STEPCODE_AUTH_FILE_MODE = 384;
/** 单次上游业务 / 模型请求的超时。 */
export declare const CHAT_TIMEOUT_MS = 300000;
/** 模型目录 / 额度发现阶段的超时。 */
export declare const DISCOVERY_TIMEOUT_MS = 20000;
/** 额度快照的进程内缓存 TTL。 */
export declare const QUOTA_CACHE_TTL_MS: number;
/** 模型目录的进程内缓存 TTL。 */
export declare const CATALOG_CACHE_TTL_MS: number;
/**
 * Step 服务端的自动前缀缓存：**前缀 ≥ 256 token 即可命中**，LRU 淘汰
 * （计划 §4.1 的官方文档事实）。
 *
 * 这是**服务端行为**，不是请求参数：客户端既不能声明也不能延长它。
 * 它只在本线路内部的缓存诊断里当噪声地板使用（本波不落代码，波次 2B 实现）。
 */
export declare const CACHE_MIN_PREFIX_TOKENS = 256;
/**
 * 本插件在 `User-Agent` 里报的身份。
 *
 * 如实报成这个第三方插件，不冒充官方客户端：base URL 与头部词汇是上游公开契约，
 * 而冒用官方客户端身份既不诚实也可能构成违约（同 glm 线路的 `USER_AGENT` 注释）。
 */
export declare const USER_AGENT = "dsh-chatgpt-subscription (+https://github.com/Aa728848/dsh-chatgpt-subscription)";
/**
 * 把一个档位收敛到某个模型真实梯子上的最近一档。
 *
 * 平手向上取，与其余各线路的收敛一致（宁可多想一点，也不要少想）。
 * 梯子为空（该模型不接受 `reasoning_effort`）时返回 null，调用方据此**不发**档位字段，
 * 而不是发一个模型不认的值。
 *
 * @param effort - DSH 侧的档位名（未知值按中档处理）。
 * @param ladder - 目录为该模型声明的真实档位；空数组表示「不发任何思考控制字段」。
 */
export declare function convergeStepCodeEffort(effort: string, ladder: readonly string[]): StepCodeReasoningEffort | null;
/**
 * 覆盖表。理由是额度面与凭证的解析都是上游第一方 / 非公开接口，
 * 它们都可能在上游一次变更后整体失效（计划 §10）；覆盖让回滚变成改一个环境变量，
 * 而不是发一个版本。**命名照官方**，这样从官方那边搬过来的排障命令可以直接用。
 *
 * 优先级是**有意的**，照抄官方 `step-provider/index.ts:151-168` 的两个数组顺序：
 *
 * - api base：`STEP_PROVIDER_API_URL` > `STEP_API_URL` > `STEP_BASE_URL` >
 *   `STEPFUN_MESSAGES_ENDPOINT`。最后一位是历史 StepCode 用的端点覆盖，
 *   它**可能带完整的 `/v1/messages`**，所以它排在最后且必须经过归一化。
 * - auth base：`STEP_PROVIDER_AUTH_URL` > `STEP_AUTH_URL`。
 * - key：`STEP_API_KEY`；登录超时：`STEP_OAUTH_TIMEOUT_MS`。
 *
 * 读取一律发生在**调用时**（不是模块加载时），这样改环境变量立即生效、也便于测试注入。
 */
export declare const ENV_OVERRIDES: {
    readonly apiBaseUrl: readonly ["STEP_PROVIDER_API_URL", "STEP_API_URL", "STEP_BASE_URL", "STEPFUN_MESSAGES_ENDPOINT"];
    readonly authBaseUrl: readonly ["STEP_PROVIDER_AUTH_URL", "STEP_AUTH_URL"];
    readonly apiKey: "STEP_API_KEY";
    readonly loginTimeoutMs: "STEP_OAUTH_TIMEOUT_MS";
};
/**
 * 一条 profile 的模型面 base（**已归一化**，不带尾部斜杠、不带版本段）。
 *
 * 归一化在 host 侧就做掉，理由是官方的 `resolveStepProviderOptions` 也在注册时归一化
 * （`step-provider/index.ts:203`）：调用点拿到的一定是「路由前缀」，
 * 于是拼 `/v1/chat/completions`、`/v1/models` 时不会把版本段发两次。
 * 覆盖值原样接受，所以指向反代根的部署可以直接写反代地址。
 */
export declare function apiBaseForProfile(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/** 一条 profile 的授权 / 开发者中心源站（不带尾部斜杠）。 */
export declare function authBaseForProfile(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/** 用户拿 API Key 的页面（只用于卡片上的一个链接，不参与任何请求）。 */
export declare function keyPageForProfile(profile: StepCodeProfile, env?: NodeJS.ProcessEnv): string;
/** 环境变量里显式给出的 api key（`STEP_API_KEY`）；没有则 undefined。 */
export declare function apiKeyOverride(env?: NodeJS.ProcessEnv): string | undefined;
/** 登录总超时（`STEP_OAUTH_TIMEOUT_MS`）；未设置或非法时用出厂值。 */
export declare function loginTimeoutMs(env?: NodeJS.ProcessEnv): number;
/**
 * 认不出区域时的默认 profile。
 *
 * 刻意取 `step_plan`（国区）而不是国际区：国内用户占绝大多数，而回落猜错的代价
 * 落在调用方身上——用错的端点会拿到明确的鉴权失败，而不是静默串区。
 *
 * 更重要的是这条回落**只出现在「凭据没自述 profile」时**。正常路径上区域永远由
 * `stepCodeRegionOf(profile)` 决定，不经过这里。
 */
export declare const DEFAULT_PROFILE: StepCodeProfile;
/**
 * 一个 host 属于哪个区域。
 *
 * 判据分两层，是有意的：先按「整串等于（或以其为根）某个已知 host」匹配，
 * 覆盖值也参与这一步——部署把某区指到反代之后，host 上已经看不到原域名，
 * 只按域名片段判断会把反代地址错判成国际区；再退回按域名片段判断；
 * 两条都不命中才回落 `DEFAULT_PROFILE`。
 *
 * 同一条先例见 glm-coding-plan 的 `regionForHost`，注释里那句「猜错的代价落在调用方身上」
 * 在这里同样成立：本函数只回答「凭据没自述区域时猜一个」。
 */
export declare function regionForHost(host: string | undefined): StepCodeRegion;
/** 把自由输入的 profile 名规整到本线路认识的四条；认不出来时返回 undefined。 */
export declare function normalizeProfile(value: unknown): StepCodeProfile | undefined;
//# sourceMappingURL=types.d.ts.map