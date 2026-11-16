/**
 * 浏览器半边的**真实取数通道**：轮询宿主路由，把结果包成面板认的快照源。
 *
 * ## 为什么是 HTTP
 *
 * 宿主半边（`src/host/progress-updates/`）跑在 DSH 宿主进程里，浏览器半边跑在
 * 用户浏览器的另一个运行时里：两者之间没有共享对象、没有事件总线，只有同源
 * HTTP。所以这里的数据来源只有一条 —— `GET /api/dsh-progress-updates/updates`
 * （宿主那一侧的注册见 `src/host/progress-updates/routes.ts`，路径是冻结契约，
 * 搬家时不能顺手改名，否则面板读到的是 404）。**不读对话流**：进展是 agent 自己
 * 汇报的，不是从消息流里刮出来的。
 *
 * ## 生命周期（谁在什么时候轮询）
 *
 * 轮询不是常驻的。{@link createHostProgressSource} 返回的源在**第一个订阅者到来
 * 时**才开始轮询，**最后一个订阅者离开时**停表并清空定时器。面板只在页签打开、
 * 页签正文组件挂载时才订阅（`useSyncExternalStore`），所以页签关着就完全不发请求。
 *
 * 页面切到后台（`document.hidden`）时也停表，回到前台立刻补一次再继续 —— 和
 * `dsh-usage` 的设置页同一个节奏。判断不出可见性时退化成固定间隔轮询，见
 * {@link isDocumentVisible}。
 *
 * ## 失败策略
 *
 * 403 / 500 / 网络错误 / 超时 / JSON 坏掉 —— 一律**吞掉**，保留最后一份成功快照，
 * 不抛错、不白屏。面板因此永远显示"已知的最新状态"，而不是因为一次抖动整块消失。
 * 首次请求就失败时快照是空数组，面板渲染正常的空态。
 *
 * @module @eddyskywalker/dsh-chatgpt-subscription/client/progress-updates/host-source
 */
import type { ProgressUpdate } from './contracts.ts';
import type { ProgressSnapshotSource } from './updates-panel.tsx';
/**
 * 本路由族的前缀（**文档相对**，不带前导斜杠）。
 *
 * 宿主那边注册的是绝对路径 `/api/dsh-progress-updates/updates`；浏览器这边必须写
 * 成不带前导斜杠的相对路径：GUI 以 `<base href="./">` 提供，子路径部署时相对路径
 * 才会解析到该部署的入口目录下，前导斜杠会逃逸出这个前缀、永远打不到路由
 * （同 dsh-usage / dsh-git-graph 的处理）。
 */
export declare const PROGRESS_UPDATES_PATH = "api/dsh-progress-updates/updates";
/** 轮询间隔（毫秒）。进展更新是人读的一行行文字，2 秒足够跟手，也不至于压宿主。 */
export declare const PROGRESS_POLL_MS = 2000;
/** 单次请求的硬上限；宿主卡住时不能把请求越堆越多。 */
export declare const PROGRESS_FETCH_TIMEOUT_MS = 8000;
/** 路由返回的响应体形状（与宿主的 `{ updates }` 对齐）。 */
export interface ProgressUpdatesResponse {
    /** 该会话的进展，按产生顺序排列。 */
    updates: ProgressUpdate[];
}
/** 定时器宿主的最小形状；抽出来是为了测试能塞假时钟。 */
export interface ProgressTimers {
    /** 起一个重复定时器，返回句柄。 */
    setInterval: (handler: () => void, ms: number) => unknown;
    /** 清掉重复定时器。 */
    clearInterval: (handle: unknown) => void;
    /** 起一个一次性定时器，返回句柄。 */
    setTimeout: (handler: () => void, ms: number) => unknown;
    /** 清掉一次性定时器。 */
    clearTimeout: (handle: unknown) => void;
}
/** 取数客户端的可注入依赖（测试用它塞假 fetch / 假时钟 / 假可见性）。 */
export interface ProgressFetchDeps {
    /**
     * fetch 实现；缺省时**每次请求**现取 `globalThis.fetch`。
     *
     * 现取而不是在工厂里抓一份闭包，是为了让测试可以在 apply 之后替换
     * `globalThis.fetch`，也为了让某些在 fetch 外面包一层鉴权的宿主环境生效。
     */
    fetch?: typeof globalThis.fetch;
    /** 轮询间隔（毫秒），缺省 {@link PROGRESS_POLL_MS}。 */
    pollMs?: number;
    /** 单次请求超时（毫秒），缺省 {@link PROGRESS_FETCH_TIMEOUT_MS}。 */
    timeoutMs?: number;
    /** 是否可见（缺省读 `document.visibilityState`）；不可见时停表。 */
    isVisible?: () => boolean;
    /** 定时器宿主，缺省 {@link DEFAULT_TIMERS}。 */
    timers?: ProgressTimers;
    /** 解析响应体，缺省按 {@link ProgressUpdatesResponse} 取 `updates`。 */
    decode?: (body: unknown) => readonly ProgressUpdate[];
    /** 观测一次失败（错误已被吞掉，只为测试与诊断）。 */
    onError?: (error: unknown) => void;
}
/** 面板数据源 + 一个显式停止入口（apply 卸载时调用）。 */
export interface HostProgressSource extends ProgressSnapshotSource {
    /**
     * 停止轮询并清空监听（幂等，且**是终态**）。
     *
     * 停止之后新的订阅者不会让它重新起表：卸载路径上可能还有一次迟到重订阅，
     * 那时重新起表就等于给一个已经卸载的插件留下常驻定时器。快照仍然可读。
     */
    stop(): void;
}
/**
 * 判断页面当前是否可见。
 *
 * 只在明确拿到 `hidden` 时判为不可见：恒为 `prerender` 的嵌入式 WebView、或者
 * 压根没有 `document` 的运行环境都会落到"可见"这一侧 —— **退化行为是继续按固定
 * 间隔轮询**，而不是静默停摆（面板停摆比多轮询几次糟糕得多）。
 * @returns 是否应该继续轮询。
 */
export declare function isDocumentVisible(): boolean;
/**
 * 拼出这次请求的地址。
 *
 * 拿得到会话 id 就带上 `?session=<id>`（宿主按会话分桶）；拿不到（槽位没有把
 * sessionId 传下来）就**退化到不带参数**的请求 —— 宿主对空 session 的语义是
 * "当前/合并桶"（`src/host/progress-updates/index.ts` 的 `updatesOf('')` 回退到
 * `session` 桶），因此单会话部署下仍能拿到进展。
 * @param sessionId - 当前会话 id，空串/undefined 表示退化。
 * @returns 文档相对的请求地址。
 */
export declare function progressUpdatesUrl(sessionId?: string): string;
/**
 * 起一个轮询数据源：真正发 `GET` 请求，把结果喂给面板。
 *
 * 语义要点：
 * - 惰性：没有订阅者时不发任何请求（页签关着 = 零流量）；
 * - 稳定引用：两次成功请求之间 `getSnapshot()` 返回**同一个数组对象**，
 *   `useSyncExternalStore` 不会判成无限更新；新快照内容不变时也沿用旧引用；
 * - 吞错：任何失败都只是"这次没更新"，最后一份快照原样保留。
 *
 * @param sessionId - 当前会话 id（可能为空：见 {@link progressUpdatesUrl} 的退化说明）。
 * @param deps - 可注入依赖（fetch、定时器、可见性、间隔）。
 * @returns 面板数据源 + 显式停止入口。
 */
export declare function createHostProgressSource(sessionId?: string, deps?: ProgressFetchDeps): HostProgressSource;
//# sourceMappingURL=host-source.d.ts.map