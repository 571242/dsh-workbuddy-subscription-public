/**
 * 宿主对浏览器暴露的只读 HTTP 路由。
 *
 * 这是**唯一**能把进展送到浏览器的通道：浏览器半边是另一个运行时（独立 bundle，
 * 跑在用户浏览器里），拿不到宿主进程的任何对象或 globalThis 状态，因此只能走
 * 同源 HTTP。
 *
 * 路径固定在 `/api/dsh-progress-updates/updates`：客户端半边的取数常量就是从
 * 这个形状写死的，搬家时不能顺手改名，否则面板读到的是 404。
 *
 * @module dsh-chatgpt-subscription/host/progress-updates/routes
 */
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { ProgressUpdate } from './store.ts';
/** 本路由族的前缀。 */
export declare const PROGRESS_API_PREFIX = "/api/dsh-progress-updates";
/** 进展读取路由的完整路径。 */
export declare const PROGRESS_UPDATES_PATH: string;
/**
 * 一条会话进展的读取面：路由只读它，不关心它怎么被写。
 */
export interface ProgressUpdatesReader {
    /**
     * 读取一个会话当前的进展列表。
     * @param sessionId - 会话 id；调用方可用空串表示"当前/默认"。
     * @returns 该会话的进展（按时间顺序，最多 MAX_UPDATES 条）。
     */
    updatesOf(sessionId: string): readonly ProgressUpdate[];
}
/**
 * 进展读取路由：`GET /api/dsh-progress-updates/updates?session=<id>`。
 *
 * 返回 `{ updates: ProgressUpdate[] }`。响应带 no-store：这个列表随 agent 干活
 * 实时变化，缓存住就等于展示过期进展。
 * @param reader - 进展读取面。
 * @returns 可注册的 route。
 */
export declare function makeProgressUpdatesRoute(reader: ProgressUpdatesReader): WebRoute;
//# sourceMappingURL=routes.d.ts.map