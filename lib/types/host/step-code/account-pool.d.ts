/**
 * Step Code 线路的号池：共享 `AccountPoolCore` 之上的薄封装。
 *
 * 存储、序列化、可用性、轮转、429 冷却都由 `src/host/common/account-pool.ts` 管；
 * 本文件只回答「Step 这条线的凭据长什么样、谁能被刷新、身份怎么算、卡片怎么装配」。
 *
 * 四个与兄弟线路不同的地方，各有理由：
 *
 * 1. **两区可以同时在池里。** 区域是凭据的属性（计划 §1），一区铸造的 Key 被另一区拒绝，
 *    所以去重键里必须带区域：否则同一个账号名在两个部署上会被合并成一行，
 *    然后那一行的凭据被拿去打另一个区的主机——一次不会被任何本地检查发现的串区。
 * 2. **凭据永不过期、永不刷新。** `needsRefresh` 恒为 false，`refresh` **一定抛错**；
 *    `expiresAt` 恒为 `STATIC_EXPIRES_AT`（Number.MAX_SAFE_INTEGER）且刻意**不**实现
 *    `expiresAt` 钩子——把一个「永不过期」写成卡片上的 expiresAt 会让人以为它会过期。
 *    适配器收到 401 时 markAuthFailed，那才是上游自己说的失效。
 * 3. **adopt 快照可删。** 与 codex/claude/glm 不同：本插件只读 `~/.stepcode/auth.json`，
 *    从不写它；删掉池里的一行只是删掉本插件自己的加密记录，用户的 stepcode 会话不动。
 *    所以这里没有 glm 那条「adopt 账号不可删」的规则。
 * 4. **额度装配复用共享的 `quotaWindow()` / `poolQuota()`**，不另写第三份。
 *    窗口长度取 types.ts 的 QUOTA_WINDOW_MINUTES（共享窗口 DTO 里没有窗口 key，
 *    那是线路自己的桥），`label` 传空串（窗口名的规范在客户端字典里），
 *    `usedPercent` 为 null 的窗口由 `quotaWindow()` 丢弃（null 不是 0%，是「未说明」）。
 */
import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import type { AccountRotationStrategy, PoolAccountQuotaDto } from '../../shared/account-pool-contracts.ts';
import { type StepCodeAccountSummaryDto, type StepCodeProfile, type StepCodeQuotaSnapshotDto, type StepCodeRegion, type StepCodeStatusDto } from '../../shared/step-code-contracts.ts';
import { type StepCodeStoredCredential } from './oauth.ts';
/**
 * 号池里存的一份凭据。
 *
 * 它是 `oauth.ts` 的 `StepCodeStoredCredential` 加两个**来源**标记：
 *
 * - `adopted`：这一份是本机 stepcode 登录态的拷贝（卡片的来源标记）。
 * - `sourcePath`：读到它的确切文件，卡片可以显示给用户。
 *
 * 凭据本身（access / refresh / expires / profile / uid）与 OAuth 模块装配的完全一致，
 * 因为它们**就是**同一个东西：Step 的 api_key 不分来源，池里也不该分。
 */
export interface StepCodeCredentials extends StepCodeStoredCredential {
    adopted?: true;
    sourcePath?: string;
}
/** 一个池内账号行。凭据整个随行存放；其余是卡片渲染用的非机密事实。 */
export interface StepCodePoolAccount extends PoolAccountShape<StepCodeCredentials> {
    /** 账号所属区域；由凭据的 profile 决定，这里是给它做索引用。 */
    region: StepCodeRegion;
    /** 这份凭据的来源（浏览器授权 / 手动粘贴 / adopt），供卡片显示。 */
    source: StepCodeCredentialSource;
    /** 控制台侧的账号显示名（非机密）。 */
    accountName?: string;
}
/** 凭据来源，逐字取自 types.ts 的 PROFILE_HOSTS[].credentialSource 之外的用户动作。 */
export type StepCodeCredentialSource = 'browser' | 'apiKey' | 'adopt';
/** 号池切片：共享摘要 + 本线路的 profile 与区域。 */
export type StepCodeAccountSummary = StepCodeAccountSummaryDto;
/** 本线路自己的加密号池文件。与凭据文件分开：池可以有多行，凭据文件只有主账号一份。 */
export declare function stepCodePoolPath(): string;
/** keychain / Secret Service 的服务名。与其它线路各用各的，互不相干。 */
export declare const STEP_CODE_POOL_KEYCHAIN_SERVICE = "dsh-step-code-pool";
/**
 * 身份：两个凭据什么时候是同一个上游账号。
 *
 * 组成是「区域 + uid」，两段都非机密，也都不随重新登录而变（Step 的 api_key 每次登录
 * 都可能换一把新的，拿 api_key 当键会让同一个账号每次登录都长成新账号，号池无限增长）。
 *
 * 没有 uid 时退回「区域 + api_key 的 SHA-256 前 16 字节」：那是**指纹**，不是身份，
 * 但它至少保证同一把 Key 落到同一行；两段全空才返回 undefined，那时核心自己生成
 * `acc_<random>`，把这一行**新增**而不是与某个无关凭据合并。
 */
export declare function stepCodePoolIdentity(credentials: StepCodeCredentials): string | undefined;
/**
 * 校验并归一化一份凭据。
 *
 * 规则刻意收得比 OAuth 模块更紧（`access` 必须非空、`expires` 必须等于静态值），
 * 因为池里的一行是**要被直接发去上游**的：一份半截的凭据会让号池把一个必然 401 的请求
 * 当成可路由的账号打出去。
 */
export declare function parseStepCodeCredentials(value: unknown): StepCodeCredentials;
/**
 * 校验并归一化整份号池文档。
 *
 * 凭据重新过一遍 `parseStepCodeCredentials`，所以一行不可能装着一份 store 会拒绝写回的形状。
 * `region` / `source` 必须显式恢复：行上的这两个字段是索引，丢了会让卡片把国区账号画成国际区。
 * 一行凭据读不通就**丢弃这一行**而不是整体报错——`read()` 会吞掉一次加载失败并回落，
 * 抛错等于让一行坏数据带走整个池。
 */
export declare function parseStepCodePoolData(value: unknown): PoolData<StepCodePoolAccount>;
/**
 * 额度快照 → 号池卡片渲染的形状。
 *
 * 每个窗口**按长度**而不是按一个字符串来标注：窗口名的规范在客户端字典里，host 没有
 * 资格下发展示文案，而知道自己长度的窗口可以让共享卡片直接从长度推出名字。
 * `usedPercent` 为 null 的窗口由 `quotaWindow()` 丢掉——null 不是 0%，是「未说明」，
 * 画成一条进度条等于谎报用量。
 */
export declare function stepCodePoolQuota(snapshot: StepCodeQuotaSnapshotDto | null | undefined): PoolAccountQuotaDto | undefined;
/** 本线路号池的构造选项。全部可选：生产按池文件路径构造平台后端。 */
export interface StepCodeAccountPoolOptions {
    /** 测试缝；生产按池文件路径构造平台后端（DPAPI / Keychain / SecretService）。 */
    backend?: CredentialStore<PoolData<StepCodePoolAccount>>;
    /** 本池接受的账号数上限。 */
    maxAccounts?: number;
    /** 用户在设置里钉住的账号；钉住的账号冷却时自动让位给轮转（核心自己处理）。 */
    preferAccountId?: () => string | null;
}
/**
 * 对一份凭据提出的刷新。
 *
 * 它**永远不会成功**，而**必须**是一个显式错误而不是一次静默的空操作：核心的刷新路径
 * 会把这个错误报给用户，而静默返回旧凭据会让一次注定失败的请求看起来像成功了。
 * 逐字照抄官方 refreshStepOAuth（index.ts:316-321）的拒绝语义。
 */
export declare class StepCodeCredentialRefreshError extends Error {
    constructor();
}
/** 本线路的号池。凭据类型是本线路自己的，静态凭据不刷新。 */
export declare class StepCodeAccountPool extends AccountPoolCore<StepCodeCredentials, StepCodePoolAccount, StepCodeAccountSummary> {
    constructor(options?: StepCodeAccountPoolOptions);
    /**
     * 把一份 adopt 快照收进号池。
     *
     * 快照已经跑过 `adopt.ts` 的解析（形状、占位符、profile 都已确认），这里只补来源标记；
     * 账号仍以 `stepCodePoolIdentity` 的身份落进池，重复 adopt 同一次登录只会更新同一行。
     */
    addAdoptedCredential(adopted: {
        readonly credentials: StepCodeStoredCredential;
        readonly sourcePath?: string;
    }, alias?: string): Promise<StepCodePoolAccount>;
    /**
     * 手动粘贴 Platform API Key 的入口（形状与登录完全一致，见 `stepCodeCredentialFromApiKey`）。
     */
    addApiKeyCredential(credentials: StepCodeStoredCredential, alias?: string): Promise<StepCodePoolAccount>;
    /**
     * 适配器取下一个账号用的入口。
     *
     * 核心在这里做轮转、冷却、可用性判断与（被拒绝的）刷新；本方法只多给适配器一件事：
     * 一次请求内换过账号时，把试过的账号排除掉。
     */
    getEffectiveCredential(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: StepCodePoolAccount;
        credentials: StepCodeCredentials;
    }>;
    /**
     * 一次额度读属于哪个账号，连同读它用的凭据。
     *
     * 写在这里而不是路由里，是因为它是线路形状的：路由需要的是凭据**和**这次读所属的账号，
     * 这样快照才能记在它描述的那一行上，不会被一次轮转画到另一行名下。
     * 选谁读是核心自己对「没有指名账号的调用方」的规则，这里照抄那三行，
     * 因为核心只通过 `getFreshCredential` 暴露凭据本身。
     */
    getQuotaReadTarget(fetchFn?: typeof fetch): Promise<{
        accountId: string;
        profile: StepCodeProfile;
        region: StepCodeRegion;
        credentials: StepCodeCredentials;
    }>;
}
/** 状态应答里的号池切片。 */
export interface StepCodePoolStatus {
    accounts: StepCodeAccountSummary[];
    activeAccountId?: string;
    rotationStrategy: AccountRotationStrategy;
    /** 本进程是否装上了号池。 */
    poolInstalled: boolean;
}
/**
 * 读状态应答的号池切片。
 *
 * 读不出来的号池不能带倒整张卡：连接那一半仍然值得渲染，只是账号列表是空的。
 */
export declare function stepCodePoolStatus(pool: StepCodeAccountPool | undefined): Promise<StepCodePoolStatus>;
/**
 * 把池状态装配成 `StepCodeStatusDto` 的号池切片。
 *
 * 这是**唯一**装配号池切片的地方（照抄 glm 的 `glmCodingPlanPoolStatus` + 同族先例）：
 * 一旦卡片、hub 汇总与适配器各装配一次，三处就会在「activeAccountId 缺失时给不给"
 * activeAccountId: undefined"」这种细节上漂移。
 *
 * 两个刻意的省略：
 *
 * - `activeAccountId` 只在**真的读到**时下发（共享 DTO 的 enabledModelIds 语义同源：
 *   缺省 = 没有钉住，而不是「钉住了 undefined」）。
 * - 读不出来的池给空列表而不是抛错：连接那一半仍然值得渲染。
 */
export declare function stepCodePoolStatusSlice(pool: StepCodeAccountPool | undefined): Promise<Pick<StepCodeStatusDto, 'accounts' | 'rotationStrategy' | 'activeAccountId'>>;
//# sourceMappingURL=account-pool.d.ts.map