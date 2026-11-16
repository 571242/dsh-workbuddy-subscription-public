/**
 * 业务 JWT 缓存（计划 §3.6）。
 *
 * 这一层的存在理由是上游的**两个坏消息**里的好消息：
 *
 * 1. OAuth access_token **不能刷新**——官方 `oauthService.ts:972-975` 对刷新直接抛
 *    「OAuth 暂未提供 refresh token 交换接口，请重新登录」，两个 adapter 也都没实现
 *    `refreshToken()`（计划 §3.6、R3）。所以 access_token 过期只能重登。
 * 2. 业务 JWT **可以重取**：`POST {business}/api/auth/z/login` 拿 access_token 再换一次，
 *    响应带 `expires_in`。官方自己按「提前 120 秒 + 0~60 秒随机抖动」重取
 *    （`zai-business-token-cache.ts:64-73`，证据等级 A）。
 *
 * 不自己缓存这一层的后果很具体：access_token 还在，业务 JWT 却先过期，
 * 用户在一个长会话的中途被踢出登录态，而上游明确说了它不会帮你续。
 *
 * **这一层只服务国际区。** 逐字：TriDefender/zcode-api 的 bigmodel 分支（国区）
 * 跳过 `/api/auth/z/login`，直接拿裸 OAuth access_token 打 `/api/biz/*`——
 * 国区压根没有业务 JWT 可缓存。所以本缓存对国区账号直接报错，而不是去
 * bigmodel.cn 反复打一个那条链路根本不用的端点。
 *
 * 抖动的作用是防尖峰：同一批登录的多个账号会在同一秒一起到期，没有抖动就是一次尖峰。
 *
 * 并发处置照 kimi-code 的单飞写法（`ensureAccessToken`）：同一账号的并发调用共享一次重取，
 * 否则一次工具调用风暴会在到期瞬间打出 N 个 `z/login`。
 */
import type { GlmRegion } from '../../shared/glm-coding-plan-contracts.ts';
import { type GlmExchangeOptions } from './exchange.ts';
/** 缓存里的一条业务 JWT。host 侧专用，不进共享契约。 */
export interface GlmBizTokenEntry {
    token: string;
    /** 失效时刻（Unix 毫秒），来自 `expires_in`。 */
    expiresAt: number;
    /** 上游给的 `expires_in`（秒），只做诊断用。 */
    expiresInSec: number;
    /** 取到它的时刻（Unix 毫秒）。 */
    fetchedAt: number;
}
/**
 * 重取时刻的随机抖动秒数：`[0, 60)`（逐字：`zai-business-token-cache.ts:64-73`）。
 *
 * 抽成带 `random` 入参的函数是为了让测试能钉住抖动值——用真实随机数的话，
 * 「提前量是 120~180 秒」这条断言每次跑都可能落在边界附近。
 */
export declare function refreshJitterSeconds(random?: () => number): number;
/**
 * 提前量：120 秒（官方固定值）+ 本次抽到的抖动秒数。
 *
 * 提前量不随 `expires_in` 变化：官方用的是固定 120 秒，本线路照抄。
 * 只在一处算、每条缓存各自持有一个抖动值，是为了同一账号的判断在整段生命周期里稳定，
 * 否则每次调用重抽抖动会让「还有 130 秒就不刷新」的判定随机翻面。
 */
export declare function refreshThresholdMs(jitterSeconds: number): number;
/** 一个账号的身份：缓存按它分桶，两区账号各自一份。 */
export interface GlmBizTokenIdentity {
    /** 账号的稳定键（号池里的 accountId 或登录会话 id）。 */
    accountKey: string;
    region: GlmRegion;
}
/**
 * 一个账号的业务 JWT 缓存。
 *
 * 实例化而不是模块级单例：一个号池可以同时持有两区多个账号（计划 §1、§8.2），
 * 单例只能存一份那种凭据，而区域是凭据的属性，混在一份里等于允许串区。
 *
 * 但**重取**是跨实例单飞的（见文件末尾的 `inFlightBizTokenFetches`）：
 * 两个持有同一账号的组件各自建了缓存对象时，仍然只该打一次上游。
 */
export declare class GlmBizTokenCache {
    readonly accountKey: string;
    readonly region: GlmRegion;
    private readonly flightKey;
    private entry;
    private readonly jitterSeconds;
    private readonly thresholdMs;
    constructor(identity: GlmBizTokenIdentity, options?: {
        random?: () => number;
    });
    /** 本缓存抽到的抖动秒数（诊断用，也让测试能断言抖动确实落在 0~60）。 */
    get jitter(): number;
    /** 当前缓存里有没有一条还没到提前量的业务 JWT。 */
    peek(now?: number): GlmBizTokenEntry | null;
    /** 直接放进去一条（登录或 adopt 拿到业务 JWT 时用）。 */
    put(entry: GlmBizTokenEntry): void;
    /** 丢掉缓存。access_token 重登之后必须调，否则会继续用上一段登录态的 JWT。 */
    clear(): void;
    /** 有效期判定：剩余时间严格大于提前量才算新鲜。 */
    private isFresh;
    /**
     * 返回一条可用的业务 JWT，必要时重取。
     *
     * 重取失败不写缓存：宁可让这一次调用失败，也不能拿一条没验证过的 JWT 顶上去。
     */
    ensure(input: {
        accessToken: string;
    }, options?: GlmExchangeOptions): Promise<GlmBizTokenEntry>;
}
/** 测试缝：忘掉所有在飞的重取。 */
export declare function resetInFlightBizTokenFetches(): void;
//# sourceMappingURL=biz-token-cache.d.ts.map