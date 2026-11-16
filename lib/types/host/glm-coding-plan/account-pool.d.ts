/**
 * GLM（ZCode 账号）线路的号池。
 *
 * 走共享的 `AccountPoolCore`：存储、序列化、可用性、轮转、429 冷却都��它管，
 * 本文件只回答「GLM 这条线的凭据长什么样、谁能被刷新、配额怎么装配」。
 *
 * 三个与兄弟线路不同的地方，各有理由：
 *
 * 1. **两区可以同时在池里**。区域是凭据的属性（计划 §1、§3.3），一区铸造的 Key 被另一区拒绝，
 *    所以去重键里必须带区域，否则两个部署上同一个邮箱会被合并成一行，
 *    然后那一行的凭据被拿去打另一个区的主机——一次不会被任何本地检查发现的串区。
 * 2. **adopt 来的账号永不可刷新**。它只是本机 ZCode 客户端登录态的一份拷贝，
 *    上游才是权威；计划 §3.6 又没有 refresh 接口。`needsRefresh` 对它恒为 false，
 *    `refresh` 直接拒绝，而卡片上它标记为 `removable: false`——删掉它等于删掉用户的
 *    ZCode 客户端登录态，那不是本插件的文件。
 * 3. **配额装配调用共享的 `quotaWindow()` / `poolQuota()`**，不另写第三份。
 *    窗口长度取 `types.ts` 的 `QUOTA_WINDOW_MINUTES`（共享的窗口 DTO 里没有窗口 key，
 *    那是线路自己的桥），`label` 传空串（窗口名的规范在客户端字典里），
 *    `usedPercent` 为 null 的窗口由 `quotaWindow()` 丢弃（null 不是 0%，是「未说明」）。
 */
import { AccountPoolCore, type PoolAccountShape, type PoolData } from '../common/account-pool.ts';
import type { CredentialStore } from '../token-store.ts';
import { GlmCodingPlanCredentialStore, type GlmCodingPlanCredentials } from './token-store.ts';
import type { GlmAdoptedCredential } from './adopt.ts';
import type { GlmAccountSummaryDto, GlmQuotaSnapshotDto, GlmRegion } from '../../shared/glm-coding-plan-contracts.ts';
import type { AccountRotationStrategy, PoolAccountQuotaDto } from '../../shared/account-pool-contracts.ts';
/** 一个池内账号行。凭据整个随行存放；其余是卡片渲染用的非机密事实。 */
export interface GlmCodingPlanPoolAccount extends PoolAccountShape<GlmCodingPlanCredentials> {
    /** 账号所属部署；由凭据决定，这里是给它做索引用。 */
    region: GlmRegion;
    /** 浏览器登录 / adopt 捡回。 */
    origin: GlmCodingPlanCredentials['origin'];
    /** 兑换链解析出的默认机构 id（非机密，用于诊断两区是否串号）。 */
    organizationId?: string;
    /** 控制台侧的机构名 / 用户邮箱。 */
    accountName?: string;
    email?: string;
}
/** 号池切片：共享摘要 + 本线路的区域与来源。 */
export interface GlmCodingPlanAccountSummary extends GlmAccountSummaryDto {
    /** 这份快照是不是从本机 ZCode 客户端捡回来的（捡回来的永不可刷新，也不可删除）。 */
    adopted?: boolean;
}
/** 本线路自己拥有的加密号池文件。与凭据文件分开：池可以有多行，凭据文件只有主账号一份。 */
export declare function glmCodingPlanPoolPath(): string;
/**
 * 身份：两个凭据什么时候是同一个上游账号。
 *
 * 组成是「区域 + 机构 + 上游 user_id」，三段都非机密，且都不随重新兑换而变：
 * `codingPlanKey` 每次兑换都可能换一把新的（同名 Key 被轮转时就换），拿它当键会让
 * 同一个账号在每次轮转后看起来都是新账号，于是号池无限增长。
 *
 * user_id 缺失时退回机构 + 邮箱，再退回机构 + apiKeyId（apiKeyId 是 `{id}.{secret}` 的 id 段，
 * 非机密且由本线路自己建的那把 Key 给出）。三段全空才返回 undefined：那时没有稳定的东西可键，
 * 核心会自己生成 `acc_<random>`，把这一行**新增**而不是与某个无关凭据合并。
 */
export declare function glmCodingPlanPoolIdentity(credentials: GlmCodingPlanCredentials): string | undefined;
/**
 * 校验并归一化整份号池文档。
 *
 * 凭据重新过一遍 token-store 的校验器，所以一行不可能装着一份 store 会拒绝写回的形状。
 * `region` / `origin` 必须显式恢复：行上的这两个字段是索引，丢了会让卡片把国区账号画成国际区。
 * 一行凭据读不通就**丢弃这一行**而不是整体报错——`read()` 会吞掉一次加载失败并回落，
 * 抛错等于让一行坏数据带走整个池。
 */
export declare function parseGlmCodingPlanPoolData(value: unknown): PoolData<GlmCodingPlanPoolAccount>;
/**
 * 配额快照 → 号池卡片渲染的形状。
 *
 * 每个窗口**按长度**而不是按一个字符串来标注：窗口名的规范在客户端字典里，host 没有资格
 * 下发展示文案，而知道自己长度的窗口可以让共享卡片直接从长度推出名字。
 * `usedPercent` 为 null 的窗口由 `quotaWindow()` 丢掉——null 不是 0%，是「未说明」，
 * 画成一条进度条等于谎报用量。
 */
export declare function glmCodingPlanPoolQuota(snapshot: GlmQuotaSnapshotDto | null | undefined): PoolAccountQuotaDto | undefined;
/** 本线路的号池。 */
export interface GlmCodingPlanAccountPoolOptions {
    /** 凭据存储：号池把主账号镜像进去，也在号池为空时用它投影出一个账号。 */
    store?: GlmCodingPlanCredentialStore;
    /** 测试缝；生产按池文件路径构造平台后端。 */
    backend?: CredentialStore<PoolData<GlmCodingPlanPoolAccount>>;
    /** 本池接受的账号数上限。 */
    maxAccounts?: number;
    /** 用户在设置里钉住的账号；钉住的账号冷却时自动让位给轮转（核心自己处理）。 */
    preferAccountId?: () => string | null;
}
/**
 * 对一份 adopt 快照的凭据提出的刷新。
 *
 * 它永远不会成功，而**必须**是一个显式错误而不是一次静默的空操作：调用方（核心的刷新路径）
 * 会把这个错误报给用户，而静默返回旧凭据会让一次注定失败的请求看起来像成功了。
 */
export declare class GlmAdoptedCredentialRefreshError extends Error {
    constructor();
}
export declare class GlmCodingPlanAccountPool extends AccountPoolCore<GlmCodingPlanCredentials, GlmCodingPlanPoolAccount, GlmCodingPlanAccountSummary> {
    private readonly store;
    constructor(options?: GlmCodingPlanAccountPoolOptions);
    /**
     * 把一份 adopt 快照收进号池。
     *
     * 快照本身已经跑过兑换链并验过活，所以这里只做形状转换；账号仍以
     * {@link glmCodingPlanPoolIdentity} 的身份落进池，重复 adopt 同一次登录只会更新同一行。
     */
    addAdoptedCredential(adopted: GlmAdoptedCredential, alias?: string): Promise<GlmCodingPlanPoolAccount>;
    /**
     * 移除一个账号（事务内）。
     *
     * adopt 来的账号被拒绝：它对应的是 ZCode 客户端自己的登录态文件，删掉它等于把用户
     * 从那个客户端里登出，而那不是本插件有权做的事。卡片上它是 `removable: false`。
     */
    protected deleteAccountFromPool(data: PoolData<GlmCodingPlanPoolAccount>, accountId: string): void;
    /**
     * 适配器取下一个账号用的入口。
     *
     * 核心在这里做轮转、冷却、可用性判断与（被拒绝的）刷新；本方法只多给适配器一件事：
     * 一次请求内换过账号时，把试过的账号排除掉。
     */
    getEffectiveCredential(excludeIds?: ReadonlySet<string>, fetchFn?: typeof fetch): Promise<{
        account: GlmCodingPlanPoolAccount;
        credentials: GlmCodingPlanCredentials;
    }>;
    /**
     * 一次配额读属于哪个账号，连同读它用的凭据。
     *
     * 写在这里而不是路由里，是因为它是线路形状的：路由需要的是凭据**和**这次读所属的账号，
     * 这样快照才能记在它描述的那一行上，不会被一次轮转画到另一行名下。
     * 选谁读是核心自己对「没有指名账号的调用方」的规则，这里照抄那三行，
     * 因为核心只通过 `getFreshCredential` 暴露凭据本身。
     */
    getQuotaReadTarget(fetchFn?: typeof fetch): Promise<{
        accountId: string;
        credentials: GlmCodingPlanCredentials;
    }>;
    /** 本池镜像主账号进去的那份凭据存储。 */
    mirrorStore(): GlmCodingPlanCredentialStore;
}
/** 状态应答里的号池切片。 */
export interface GlmCodingPlanPoolStatus {
    accounts: GlmCodingPlanAccountSummary[];
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
export declare function glmCodingPlanPoolStatus(pool: GlmCodingPlanAccountPool | undefined): Promise<GlmCodingPlanPoolStatus>;
//# sourceMappingURL=account-pool.d.ts.map