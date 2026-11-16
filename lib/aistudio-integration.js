/**
 * Google AI Studio（Gemini API）渠道：`generativelanguage.googleapis.com` 原生协议 + 多 API Key 账号池。
 *
 * 与同包内的 Vertex 路由的区别只有三处：
 *   1. 鉴权是 `x-goog-api-key`（AI Studio 的 API Key），不是服务账号 bearer token；
 *   2. 端点没有 project/location 段，模型目录来自 `GET /v1beta/models`；
 *   3. 一个 Key 会撞 RPM/RPD 限额，所以这里维护一个账号池：按策略选 Key，
 *      遇 429/RESOURCE_EXHAUSTED 指数退避冷却并当场换号重试，对话不中断。
 *
 * 协议转换复用 `vendor/vertex/lib/gemini.js`：请求体、SSE 翻译、thoughtSignature
 * 回放、用量映射与尾轮修正全部与 Vertex 的 Gemini 路由是同一套，避免两份实现漂移。
 *
 * @module dsh-workbuddy-subscription/aistudio
 */
import { LlmError, attributionHeaders } from '@deepseek-ai/dsh-llm';
import {
    DEFAULT_AI_STUDIO_MODELS,
    DEFAULT_BASE_URL,
    DEFAULT_MAX_TOKENS,
    REASONING_EFFORTS,
    ROTATION_STRATEGIES,
    apiRoot,
    catalogRow,
    maskApiKey,
    modelFromApiEntry,
    normalizeBaseUrl,
    parseAiStudioDocument,
    parseKeyEntries,
} from './aistudio-config.js';
import {
    DEFAULT_GEMINI_MAX_TOKENS,
    GeminiStreamTranslator,
    buildGeminiRequest,
} from '../vendor/vertex/lib/gemini.js';
import { SseRecordReader, parseSseRecord } from '../vendor/vertex/lib/wire.js';
import { CONTINUATION_TEXT, sanitizeVertexContents } from '../vendor/vertex/lib/wire-shared.js';
import { AiStudioTunnel, createTunnelToken } from './aistudio-tunnel.js';
import { AiStudioBrowserService } from './aistudio-browser.js';

export { DEFAULT_BASE_URL, DEFAULT_AI_STUDIO_MODELS, maskApiKey, normalizeBaseUrl, parseAiStudioDocument, parseKeyEntries } from './aistudio-config.js';

/** 设置页路由前缀；`/wb` 命名空间与其余渠道一致，避免与上游插件撞路由。 */
export const AI_STUDIO_PREFIX = '/wb/aistudio/api';
export const AI_STUDIO_LEGACY_PREFIX = '/aistudio/api';
/** 注册进 LLM 运行时的 provider id。 */
export const AI_STUDIO_PROVIDER_ID = 'google-ai-studio';
export const AI_STUDIO_PROVIDER_NAME = 'Google AI Studio';

/** 冷却起点与上限：1 分钟翻倍，封顶 30 分钟。 */
const COOLDOWN_BASE_MS = 60_000;
const COOLDOWN_MAX_MS = 30 * 60_000;
/** 连续失败到这个次数就先冷却，不再每次请求都去撞。 */
const FAILURE_THRESHOLD = 1;
/** 单次请求最多换几个 Key，防止整池失效时的长尾等待。 */
const MAX_FAILOVER_ATTEMPTS = 6;
const MAX_BODY_BYTES = 64 * 1024;
const STREAM_IDLE_TIMEOUT_MS = 120_000;

function cleanText(value, max = 200) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** 一个 Key 的冷却指数退避。 */
function nextCooldown(failCount) {
    const step = Math.max(1, failCount);
    return Math.min(COOLDOWN_BASE_MS * 2 ** (step - 1), COOLDOWN_MAX_MS);
}

/** 把 AI Studio 的 `{error:{code,status,message}}` 归类。 */
function classifyFailure(status, body) {
    let message = '';
    let providerStatus = '';
    try {
        const parsed = JSON.parse(body);
        const error = parsed?.error;
        if (error && typeof error === 'object') {
            message = typeof error.message === 'string' ? error.message : '';
            providerStatus = typeof error.status === 'string' ? error.status : '';
        }
    } catch {
        message = String(body ?? '').slice(0, 200);
    }
    const detail = `${providerStatus} ${message}`;
    const code = status === 401 || status === 403 ? 'AUTH'
        : status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(detail) ? 'RATE_LIMIT'
            : /prompt is too long|input.*too long|context length|too many tokens|exceeds the maximum/i.test(detail) ? 'CONTEXT_WINDOW_EXCEEDED'
                : status === 400 || status === 413 || status === 422 ? 'INVALID_REQUEST'
                    : status >= 500 ? 'SERVER' : 'TRANSPORT';
    return { code, message: message || `HTTP ${status}` };
}

/**
 * key 池调度器。所有变更都串行落盘，避免两个设置页请求互相覆盖。
 */
class KeyPool {
    constructor(store) {
        this.store = store;
        this.doc = null;
        this.writing = Promise.resolve();
    }

    async load() {
        if (this.doc !== null) return this.doc;
        const saved = await this.store.load().catch(() => null);
        this.doc = saved ? parseAiStudioDocument(saved) : null;
        return this.doc;
    }

    /** 读-改-写；回调返回 false 表示无需落盘。 */
    async mutate(fn) {
        const run = this.writing.then(async () => {
            const doc = await this.load() ?? parseAiStudioDocument({}) ?? defaultDocument();
            const changed = await fn(doc);
            if (changed !== false) {
                this.doc = doc;
                await this.store.save(doc);
            }
            return doc;
        });
        this.writing = run.catch(() => undefined);
        return run;
    }
}

function defaultDocument() {
    return {
        enabled: true,
        baseUrl: DEFAULT_BASE_URL,
        rotationStrategy: 'sequential',
        primaryAccountId: undefined,
        activeAccountId: undefined,
        accounts: [],
        catalog: [],
        enabledModelIds: null,
        contextWindowOverrides: {},
        defaultReasoningEffort: '',
        roundRobinCursor: 0,
        tunnel: { enabled: false, token: '', browser: false, headless: true },
    };
}

/** 可用 = 未标记失效且不在冷却期。 */
function usable(account, now) {
    return account.authStatus !== 'invalid' && !(Number.isFinite(account.cooldownUntil) && account.cooldownUntil > now);
}

/**
 * 按策略挑一个 Key，返回 `{ account, rest }`。
 *
 * - sequential：主 Key 优先，主 Key 不可用就按加入顺序往下；
 * - round-robin：从游标往后转一圈，跳过冷却；
 * - sticky：钉住 activeAccountId，它不可用了才换。
 */
function pickAccount(doc, now) {
    const list = doc.accounts;
    if (list.length === 0) return null;
    const alive = list.filter(a => usable(a, now));
    if (alive.length === 0) return null;
    if (doc.rotationStrategy === 'round-robin') {
        const start = doc.roundRobinCursor % list.length;
        for (let i = 0; i < list.length; i += 1) {
            const account = list[(start + i) % list.length];
            if (usable(account, now)) {
                doc.roundRobinCursor = (start + i + 1) % list.length;
                return account;
            }
        }
        return null;
    }
    if (doc.rotationStrategy === 'sticky') {
        const pinned = list.find(a => a.id === doc.activeAccountId);
        if (pinned && usable(pinned, now)) return pinned;
    }
    const primary = list.find(a => a.id === doc.primaryAccountId);
    if (primary && usable(primary, now)) return primary;
    return alive[0];
}

/** 排除掉已经试过的 Key 后再挑一个。 */
function pickAccountExcluding(doc, tried, now) {
    const saved = doc.accounts;
    doc.accounts = saved.filter(a => !tried.has(a.id));
    try {
        return pickAccount(doc, now);
    } finally {
        doc.accounts = saved;
    }
}

/** 一个 provider adapter，接口与 `VertexPublisherAdapter` 保持一致（鸭子类型）。 */
class AiStudioAdapter {
    constructor(provider, pool, options) {
        this.provider = provider;
        this.pool = pool;
        this.fetch = options.fetch;
        this.attachments = options.attachments;
        /** WebSocket 隧道；为空表示只走宿主直连。 */
        this.tunnel = options.tunnel ?? null;
        /** 读取当前文档开关，避免把 bool 拷进来过期。 */
        this.tunnelEnabled = options.tunnelEnabled ?? (() => false);
    }

    providerInfo(provider) {
        return { id: provider, name: AI_STUDIO_PROVIDER_NAME };
    }

    providerRetryPolicy() {
        // 429 由本适配器自己换号处理，交给 harness 重试只会重复撞同一个 Key。
        return undefined;
    }

    imageRequestPricing() {
        return undefined;
    }

    /** 目录：优先联网发现的缓存，其次内置兜底。 */
    catalog(doc) {
        return doc.catalog.length > 0 ? doc.catalog : DEFAULT_AI_STUDIO_MODELS.map(m => catalogRow(m));
    }

    async listModels(provider) {
        const doc = await this.pool.load();
        const rows = doc ? this.catalog(doc) : DEFAULT_AI_STUDIO_MODELS.map(m => catalogRow(m));
        return rows.map(row => this.info(provider, row));
    }

    invalidateModels() {
        // 目录刷新走 /catalog/refresh 主动拉取，这里无需缓存失效。
    }

    async resolveModel(provider, model) {
        const doc = await this.pool.load();
        if (!doc || doc.accounts.length === 0) {
            throw new LlmError('请先在「自制渠道 → Google AI Studio」中添加至少一个 API Key。', 'MISSING_CREDENTIAL');
        }
        const row = this.catalog(doc).find(entry => entry.id === model) ?? catalogRow({ id: model });
        const contextWindow = doc.contextWindowOverrides[model] ?? row.contextWindow;
        return {
            ...this.info(provider, row),
            context: { contextWindow },
            defaultMaxTokens: row.maxTokens,
        };
    }

    info(provider, row) {
        return {
            provider,
            id: row.id,
            name: row.name,
            description: 'Google AI Studio 原生 Gemini 接口（多 Key 账号池）。',
            inputModalities: ['text'],
        };
    }

    async prepareCall(provider, model, signal) {
        return {
            model: await this.resolveModel(provider, model, signal),
            stream: options => this.stream(options),
        };
    }

    stream(options) {
        return streamAiStudio(this, options);
    }
}

/** 组装请求体：复用 Vertex 的 Gemini 构造，再补 AI Studio 的 thinkingConfig。 */
function buildBody(options, doc, row) {
    const body = buildGeminiRequest(options, { maxTokens: row?.maxTokens ?? DEFAULT_GEMINI_MAX_TOKENS });
    const effort = doc.defaultReasoningEffort;
    const model = options.model ?? '';
    if (effort !== '' && body.generationConfig) {
        // Gemini 3 用 thinkingLevel，2.5 用 thinkingBudget；其余模型不下发，免得 400。
        if (/^gemini-3(?:\.\d+)?/i.test(model)) {
            body.generationConfig.thinkingConfig = { thinkingLevel: effort === 'high' ? 'high' : 'low' };
        } else if (/^gemini-2\.5/i.test(model)) {
            const budget = effort === 'low' ? 1024 : effort === 'medium' ? 8192 : 24576;
            body.generationConfig.thinkingConfig = { thinkingBudget: budget };
        }
    }
    if (Array.isArray(body.contents)) body.contents = sanitizeVertexContents(body.contents, CONTINUATION_TEXT);
    return body;
}

/**
 * 发一次请求，优先走浏览器隧道。
 *
 * 两条路的返回形状统一成 `{status, ok, headers, body, text()}`，后面的流解析完全
 * 不用区分来源。隧道只是「出网的腿」，请求体与鉴权仍是账号池里那把 Key——
 * 于是配额记在用户自己的项目上，而出口 IP、Cookie、TLS 指纹是网页那一侧。
 */
async function openAiStudioResponse(adapter, { endpoint, headers, payload, signal }) {
    const tunnel = adapter.tunnel;
    if (tunnel !== null && adapter.tunnelEnabled() && tunnel.status().connected) {
        try {
            const tunnelled = await tunnel.request({ method: 'POST', url: endpoint, headers, body: payload, signal });
            const body = tunnelled.body;
            return {
                status: tunnelled.status,
                ok: tunnelled.status >= 200 && tunnelled.status < 300,
                headers: tunnelled.headers,
                body,
                text: async () => {
                    const chunks = [];
                    for await (const chunk of body) chunks.push(Buffer.from(chunk));
                    return Buffer.concat(chunks).toString('utf8');
                },
                via: 'tunnel',
                dispose: tunnelled.dispose,
            };
        } catch (error) {
            if (error?.code === 'TUNNEL_OFFLINE') {
                // 浏览器掉线：这一次直连，别让用户白等。下次调用会重新判断。
                adapter.tunnelNotedOffline = true;
            } else {
                throw error;
            }
        }
    }
    const response = await adapter.fetch(endpoint, {
        method: 'POST',
        headers,
        body: payload,
        signal,
    });
    return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        body: response.body,
        text: () => response.text(),
        via: 'direct',
        dispose: () => undefined,
    };
}

/** 一次流式调用：换 Key、看状态码、翻译 SSE。 */
async function* streamAiStudio(adapter, options) {
    const doc = await adapter.pool.load();
    if (!doc) {
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'MISSING_CREDENTIAL', message: '请先在「自制渠道 → Google AI Studio」中添加至少一个 API Key。' } } };
        return;
    }
    if (doc.enabled === false) {
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'PROVIDER_ERROR', message: 'Google AI Studio 渠道已关闭。' } } };
        return;
    }
    const model = options.model ?? '';
    const row = adapter.catalog(doc).find(entry => entry.id === model) ?? catalogRow({ id: model });
    const root = apiRoot(doc.baseUrl);
    const endpoint = `${root}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const body = buildBody(options, doc, row);
    const payload = JSON.stringify(body);
    const tried = new Set();
    let lastFailure = null;

    for (let attempt = 0; attempt < MAX_FAILOVER_ATTEMPTS; attempt += 1) {
        const account = attempt === 0 ? pickAccount(doc, Date.now()) : pickAccountExcluding(doc, tried, Date.now());
        if (!account) break;
        tried.add(account.id);

        const controller = new AbortController();
        const signal = options.signal === undefined ? controller.signal : AbortSignal.any([options.signal, controller.signal]);
        let idleTimedOut = false;
        let timer = setTimeout(() => {
            idleTimedOut = true;
            controller.abort('ai-studio: stream idle timeout');
        }, STREAM_IDLE_TIMEOUT_MS);
        const arm = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                idleTimedOut = true;
                controller.abort('ai-studio: stream idle timeout');
            }, STREAM_IDLE_TIMEOUT_MS);
        };

        try {
            let response;
            try {
                response = await openAiStudioResponse(adapter, {
                    endpoint,
                    headers: {
                        'content-type': 'application/json',
                        'accept': 'text/event-stream',
                        'x-goog-api-key': account.apiKey,
                        ...attributionHeaders(),
                    },
                    payload,
                    signal,
                });
            } catch (error) {
                clearTimeout(timer);
                if (idleTimedOut) {
                    yield { type: 'finish', reason: { kind: 'error', failure: { code: 'TIMEOUT', message: 'Google AI Studio 流式响应超时。' } } };
                    return;
                }
                if (options.signal?.aborted === true) {
                    yield { type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: '请求已取消。' } } };
                    return;
                }
                yield { type: 'finish', reason: { kind: 'error', failure: { code: 'TRANSPORT', message: `Google AI Studio 请求失败：${error instanceof Error ? error.message : String(error)}` } } };
                return;
            }

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                clearTimeout(timer);
                const failure = classifyFailure(response.status, text);
                // 这个 Key 不能用了：记账 → 换下一个；只有全池都不可用才把错误抛给用户。
                await adapter.pool.mutate(current => {
                    const target = current.accounts.find(entry => entry.id === account.id);
                    if (!target) return false;
                    target.lastUsedAt = Date.now();
                    if (failure.code === 'AUTH') {
                        target.authStatus = 'invalid';
                        target.authReason = failure.message;
                    } else {
                        target.failCount = (target.failCount ?? 0) + 1;
                        if (target.failCount >= FAILURE_THRESHOLD) {
                            target.cooldownUntil = Date.now() + nextCooldown(target.failCount);
                        }
                    }
                    if (current.activeAccountId === target.id) current.activeAccountId = undefined;
                    return true;
                }).catch(() => undefined);
                lastFailure = failure;
                if (failure.code === 'RATE_LIMIT' || failure.code === 'AUTH') continue;
                yield { type: 'finish', reason: { kind: 'error', failure } };
                return;
            }

            // 成功：清冷却、记活跃号。
            adapter.pool.mutate(current => {
                const target = current.accounts.find(entry => entry.id === account.id);
                if (!target) return false;
                target.lastUsedAt = Date.now();
                target.failCount = 0;
                target.cooldownUntil = undefined;
                target.authStatus = 'ok';
                target.authReason = undefined;
                if (current.rotationStrategy === 'sticky') current.activeAccountId = target.id;
                return true;
            }).catch(() => undefined);

            if (response.body === null) {
                clearTimeout(timer);
                yield { type: 'finish', reason: { kind: 'error', failure: { code: 'TRANSPORT', message: 'Google AI Studio 响应没有正文。' } } };
                return;
            }

            const translator = new GeminiStreamTranslator(model);
            let failed = false;
            try {
                const reader = new SseRecordReader(response.body, { armIdle: arm, clearIdle: () => {} });
                try {
                    for (let records = await reader.read(); records !== undefined; records = await reader.read()) {
                        arm();
                        for (const record of records) {
                            const event = parseSseRecord(record);
                            if (event === undefined) continue;
                            yield* translator.handle(event);
                            if (translator.terminal) {
                                failed = true;
                                break;
                            }
                        }
                        if (failed) break;
                    }
                } finally {
                    await reader.close();
                }
            } catch (error) {
                if (translator.terminal) return;
                if (idleTimedOut) {
                    yield { type: 'finish', reason: { kind: 'error', failure: { code: 'TIMEOUT', message: 'Google AI Studio 流式响应超时。' } } };
                    return;
                }
                yield { type: 'finish', reason: { kind: 'error', failure: { code: 'TRANSPORT', message: `Google AI Studio 流读取失败：${error instanceof Error ? error.message : String(error)}` } } };
                return;
            } finally {
                clearTimeout(timer);
                response.dispose?.();
            }
            if (failed) return;
            if (!(translator.sawFinish ?? translator.terminal)) {
                yield { type: 'finish', reason: { kind: 'error', failure: { code: 'TRANSPORT', message: `google-ai-studio: 模型 "${model}" 的流在 finishReason 之前结束。` } } };
                return;
            }
            yield* translator.finish?.() ?? [];
            return;
        } finally {
            clearTimeout(timer);
        }
    }

    yield {
        type: 'finish',
        reason: {
            kind: 'error',
            failure: lastFailure ?? { code: 'RATE_LIMIT', message: '账号池里没有可用 Key（全部失效或仍在冷却中）。' },
        },
    };
}

/** 拉一次官方模型目录。 */
async function fetchCatalog(doc, fetchFn, signal) {
    const root = apiRoot(doc.baseUrl);
    const key = pickAccount(doc, Date.now())?.apiKey;
    if (!key) throw new Error('账号池里没有可用 Key，无法拉取模型目录。');
    const response = await fetchFn(`${root}/models?pageSize=1000`, {
        method: 'GET',
        headers: { 'x-goog-api-key': key, accept: 'application/json', ...attributionHeaders() },
        ...signal === undefined ? {} : { signal },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        const failure = classifyFailure(response.status, text);
        throw new Error(`拉取模型目录失败（HTTP ${response.status}）：${failure.message}`);
    }
    const payload = await response.json();
    const list = [];
    for (const entry of payload?.models ?? []) {
        const name = typeof entry?.name === 'string' ? entry.name : '';
        const id = name.startsWith('models/') ? name.slice(7) : name;
        if (id === '' || !id.startsWith('gemini-')) continue;
        if (id.split('-').some(segment => NON_TEXT_SEGMENTS.has(segment))) continue;
        const methods = entry?.supportedGenerationMethods;
        if (Array.isArray(methods) && !methods.includes('generateContent')) continue;
        list.push(catalogRow({
            id,
            name: cleanText(entry?.displayName, 120) || id,
            contextWindow: entry?.inputTokenLimit,
            maxTokens: entry?.outputTokenLimit,
        }));
    }
    return list.filter(Boolean);
}

/**
 * 注册整个渠道：adapter + 设置页 HTTP 路由。
 *
 * @param ctx - harness 上下文（只用到 webServer / logger / emit）。
 * @param options - store、fetchFn、claimProviderRoute、isSameOriginMutation、readRequestJson。
 */
export function registerWorkBuddyAiStudio(ctx, options) {
    const { store, fetchFn = fetch, claimProviderRoute, isSameOriginMutation, readRequestJson } = options;
    const pool = new KeyPool(store);
    let error = null;
    let disposed = false;

    const ready = pool.load().catch(cause => {
        error = 'AI Studio 加密凭据读取失败，请重新添加 API Key。';
        ctx.logger?.warn?.(`[dsh-workbuddy] aistudio credential read failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    });

    /** 隧道：进程内一条 upgrade 路由，浏览器从页面连回来。 */
    const tunnel = new AiStudioTunnel(ctx, {
        getToken: () => pool.doc?.tunnel?.token ?? '',
        onChange: () => ctx.emit?.('llm/adapters-updated'),
    });
    /** 本机/云端的无头浏览器代理；由设置页开关拉起。 */
    const browser = new AiStudioBrowserService({
        logger: ctx.logger,
        getToken: () => pool.doc?.tunnel?.token ?? '',
        getTunnelUrl: () => {
            const token = pool.doc?.tunnel?.token ?? '';
            const port = ctx.webServer.port;
            return token === '' || port === undefined ? '' : `ws://127.0.0.1:${port}${tunnel.path}?token=${encodeURIComponent(token)}`;
        },
        headless: true,
    });
    /** 开关要跟着文档走：启动时若上次是开的，自动接上。 */
    const syncBrowser = () => {
        const enabled = pool.doc?.tunnel?.browser === true && pool.doc?.tunnel?.enabled === true;
        if (enabled) browser.start().catch(cause => ctx.logger?.warn?.(`[dsh-workbuddy] browser start failed: ${cause instanceof Error ? cause.message : String(cause)}`));
        else if (browser.current() !== null) browser.stop().catch(() => undefined);
    };
    ready.then(syncBrowser).catch(() => undefined);

    const adapter = new AiStudioAdapter(AI_STUDIO_PROVIDER_ID, pool, {
        fetch: fetchFn,
        attachments: options.attachments,
        tunnel,
        tunnelEnabled: () => pool.doc?.tunnel?.enabled === true,
    });

    const claim = claimProviderRoute(ctx, {
        providerId: AI_STUDIO_PROVIDER_ID,
        label: AI_STUDIO_PROVIDER_NAME,
        adapter,
    });

    /** 设置页状态：绝不含明文 Key。 */
    function status() {
        const doc = pool.doc;
        const tunnelStatus = tunnel.status();
        const browserStatus = browser.status();
        const tunnelInfo = {
            enabled: doc?.tunnel?.enabled === true,
            browser: doc?.tunnel?.browser === true,
            headless: doc?.tunnel?.headless !== false,
            available: tunnelStatus.available,
            path: tunnel.path,
            connected: tunnelStatus.connected,
            connections: tunnelStatus.connections,
            client: tunnelStatus.client,
            agent: browserStatus,
        };
        if (!doc) {
            return {
                enabled: false, configured: false, authenticated: false,
                baseUrl: DEFAULT_BASE_URL, rotationStrategy: 'sequential',
                activeAccountId: undefined, primaryAccountId: undefined,
                accounts: [], models: [], enabledModelIds: null, contextWindowOverrides: {},
                defaultReasoningEffort: '', serving: claim.serving(),
                tunnel: tunnelInfo,
                error: error ?? claim.conflict() ?? null,
            };
        }
        const catalog = adapter.catalog(doc);
        const enabledIds = doc.enabledModelIds === null ? catalog.map(m => m.id) : doc.enabledModelIds;
        const now = Date.now();
        return {
            enabled: doc.enabled !== false,
            configured: doc.accounts.length > 0,
            authenticated: doc.accounts.some(a => usable(a, now)),
            baseUrl: doc.baseUrl,
            rotationStrategy: doc.rotationStrategy,
            activeAccountId: doc.activeAccountId ?? doc.primaryAccountId,
            primaryAccountId: doc.primaryAccountId,
            accounts: doc.accounts.map(account => ({
                id: account.id,
                alias: account.alias || maskApiKey(account.apiKey),
                maskedKey: maskApiKey(account.apiKey),
                isPrimary: account.id === doc.primaryAccountId,
                authStatus: account.authStatus,
                authFailedReason: account.authReason,
                cooldownUntil: account.cooldownUntil,
                lastUsedAt: account.lastUsedAt,
                createdAt: account.createdAt,
                removable: true,
            })),
            models: catalog.map(row => ({
                id: row.id,
                name: row.name,
                enabled: enabledIds.includes(row.id),
                defaultContextWindow: row.contextWindow,
            })),
            enabledModelIds: enabledIds,
            contextWindowOverrides: doc.contextWindowOverrides,
            defaultReasoningEffort: doc.defaultReasoningEffort,
            serving: claim.serving(),
            tunnel: tunnelInfo,
            error: error ?? claim.conflict() ?? null,
        };
    }

    async function addKeys(body) {
        await ready;
        const entries = [];
        if (typeof body?.text === 'string' && body.text.trim() !== '') entries.push(...parseKeyEntries(body.text));
        else if (typeof body?.apiKey === 'string' && body.apiKey.trim() !== '') entries.push({ apiKey: body.apiKey.trim(), alias: cleanText(body.alias, 80) });
        if (entries.length === 0) throw new Error('没有解析到有效 Key。每行一个，可写成「备注=AIza...」。');
        await pool.mutate(doc => {
            const existing = new Set(doc.accounts.map(a => a.apiKey));
            for (const entry of entries) {
                if (existing.has(entry.apiKey)) continue;
                existing.add(entry.apiKey);
                doc.accounts.push({
                    id: `key-${Date.now().toString(36)}-${doc.accounts.length + 1}`,
                    apiKey: entry.apiKey,
                    alias: entry.alias,
                    createdAt: Date.now(),
                    failCount: 0,
                    authStatus: 'ok',
                });
            }
            doc.primaryAccountId ??= doc.accounts[0]?.id;
            return true;
        });
        ctx.emit?.('llm/adapters-updated');
        return status();
    }

    async function accountAction(body) {
        await ready;
        const action = cleanText(body?.action, 40);
        const accountId = cleanText(body?.accountId, 80);
        if (action === 'strategy') {
            const strategy = cleanText(body?.strategy, 20);
            if (!ROTATION_STRATEGIES.has(strategy)) throw new Error('调度策略无效。');
            await pool.mutate(doc => { doc.rotationStrategy = strategy; return true; });
            return status();
        }
        if (accountId === '') throw new Error('缺少 accountId。');
        await pool.mutate(doc => {
            const index = doc.accounts.findIndex(a => a.id === accountId);
            if (index < 0) throw new Error('找不到该账号。');
            if (action === 'delete') {
                doc.accounts.splice(index, 1);
                if (doc.primaryAccountId === accountId) doc.primaryAccountId = doc.accounts[0]?.id;
                if (doc.activeAccountId === accountId) doc.activeAccountId = undefined;
                return true;
            }
            if (action === 'set-primary') {
                doc.primaryAccountId = accountId;
                return true;
            }
            if (action === 'clear-cooldown') {
                const target = doc.accounts[index];
                target.cooldownUntil = undefined;
                target.failCount = 0;
                target.authStatus = 'ok';
                target.authReason = undefined;
                return true;
            }
            throw new Error('未知操作。');
        });
        ctx.emit?.('llm/adapters-updated');
        return status();
    }

    async function updateSettings(body) {
        await ready;
        await pool.mutate(doc => {
            if (typeof body?.enabled === 'boolean') doc.enabled = body.enabled;
            if (typeof body?.baseUrl === 'string') doc.baseUrl = normalizeBaseUrl(body.baseUrl);
            if (typeof body?.defaultReasoningEffort === 'string') {
                const effort = cleanText(body.defaultReasoningEffort, 20);
                if (!REASONING_EFFORTS.has(effort)) throw new Error('思考深度无效。');
                doc.defaultReasoningEffort = effort;
            }
            if (body?.contextWindowOverrides && typeof body.contextWindowOverrides === 'object') {
                for (const [id, size] of Object.entries(body.contextWindowOverrides)) {
                    if (size === null || size === undefined) delete doc.contextWindowOverrides[id];
                    else if (Number.isFinite(size) && size > 0) doc.contextWindowOverrides[id] = Math.floor(size);
                    else throw new Error(`上下文容量无效：${id}`);
                }
            }
            return true;
        });
        ctx.emit?.('llm/adapters-updated');
        return status();
    }

    async function updateModels(body) {
        await ready;
        if (!Array.isArray(body?.enabledModelIds)) throw new Error('enabledModelIds 必须是数组。');
        await pool.mutate(doc => {
            doc.enabledModelIds = [...new Set(body.enabledModelIds.filter(id => typeof id === 'string' && id !== ''))];
            return true;
        });
        ctx.emit?.('llm/adapters-updated');
        return status();
    }

    async function refreshCatalog() {
        await ready;
        const doc = pool.doc;
        if (!doc) throw new Error('请先添加 API Key。');
        const list = await fetchCatalog(doc, fetchFn, AbortSignal.timeout(20_000));
        if (list.length === 0) throw new Error('官方目录没有返回可用的 Gemini 对话模型。');
        await pool.mutate(current => { current.catalog = list; return true; });
        ctx.emit?.('llm/adapters-updated');
        return status();
    }

    /**
     * 隧道开关。
     *
     * `enabled` 打开后请求优先走浏览器；`browser` 决定是否由程序自己养那个浏览器。
     * 首次打开时顺手生成令牌——没有令牌，任何页面都连不进来。
     */
    async function tunnelAction(body) {
        await ready;
        await pool.mutate(doc => {
            const current = doc.tunnel ?? { enabled: false, token: '', browser: false, headless: true };
            const next = { ...current };
            if (typeof body?.enabled === 'boolean') next.enabled = body.enabled;
            if (typeof body?.browser === 'boolean') next.browser = body.browser;
            if (typeof body?.headless === 'boolean') next.headless = body.headless;
            if (typeof body?.rotateToken === 'boolean' && body.rotateToken) next.token = createTunnelToken();
            if (next.token === '') next.token = createTunnelToken();
            // 开浏览器必然要开隧道；关隧道自然也要收掉浏览器。
            if (next.browser) next.enabled = true;
            if (!next.enabled) next.browser = false;
            doc.tunnel = next;
            return true;
        });
        syncBrowser();
        return status();
    }

    /** 当前令牌只给设置页用；换条路泄露不了账号 Key。 */
    function tunnelSecret() {
        const doc = pool.doc;
        if (!doc?.tunnel) return { token: '', url: '' };
        const port = ctx.webServer.port;
        const token = doc.tunnel.token;
        return {
            token,
            url: port === undefined ? '' : `ws://127.0.0.1:${port}${tunnel.path}?token=${encodeURIComponent(token)}`,
        };
    }

    /** 让本机浏览器打开 AI Studio 登录页；登完关掉窗口就回到无头。 */
    async function tunnelLogin() {
        await ready;
        return browser.login();
    }

    async function tunnelCookies(body) {
        await ready;
        if (Array.isArray(body?.cookies)) {
            if (body.cookies.length === 0) throw new Error('Cookie 列表为空。');
            return browser.importCookies(body.cookies);
        }
        return browser.exportCookies();
    }

    /** 隧道自检：让浏览器取一次模型目录，证明页面上下文真的通。 */
    async function tunnelTest() {
        await ready;
        const doc = pool.doc;
        if (!doc) throw new Error('请先添加 API Key。');
        if (doc.tunnel?.enabled !== true) throw new Error('隧道还没打开。');
        if (!tunnel.status().connected) throw new Error('还没有浏览器连上隧道。');
        const account = pickAccount(doc, Date.now());
        if (!account) throw new Error('账号池里没有可用 Key。');
        const response = await tunnel.request({
            method: 'GET',
            url: `${apiRoot(doc.baseUrl)}/models?pageSize=5`,
            headers: { 'x-goog-api-key': account.apiKey, accept: 'application/json', ...attributionHeaders() },
            signal: AbortSignal.timeout(45_000),
        });
        const text = await (async () => {
            const chunks = [];
            for await (const chunk of response.body) chunks.push(Buffer.from(chunk));
            return Buffer.concat(chunks).toString('utf8');
        })();
        response.dispose?.();
        if (response.status !== 200) throw new Error(`隧道返回 HTTP ${response.status}：${text.slice(0, 200)}`);
        const payload = JSON.parse(text);
        return { message: `隧道连通，页面侧取到 ${payload?.models?.length ?? 0} 个模型。` };
    }

    async function test() {
        await ready;
        const doc = pool.doc;
        if (!doc) throw new Error('请先添加 API Key。');
        const usableRows = adapter.catalog(doc);
        const enabled = doc.enabledModelIds === null ? usableRows : usableRows.filter(row => doc.enabledModelIds.includes(row.id));
        const model = enabled.find(row => /flash/i.test(row.id))?.id ?? enabled[0]?.id ?? usableRows[0]?.id;
        if (!model) throw new Error('没有可测试的模型。');
        let text = '';
        let finished = false;
        for await (const chunk of adapter.stream({
            model,
            messages: [{ role: 'user', content: [{ type: 'text', text: 'Reply with OK only.' }] }],
            tools: [],
            maxTokens: 128,
            signal: AbortSignal.timeout(60_000),
        })) {
            if (chunk.type === 'text-delta') text += chunk.text ?? chunk.delta ?? '';
            if (chunk.type === 'finish') {
                if (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted') {
                    throw new Error(chunk.reason.failure?.message ?? 'Google AI Studio 请求失败。');
                }
                finished = true;
            }
        }
        if (!finished || text.trim() === '') throw new Error('Google AI Studio 未返回有效文本。');
        return { message: `鉴权及 ${model} 实际调用成功：${text.trim().slice(0, 100)}` };
    }

    function send(response, statusCode, body) {
        response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(body));
    }

    const routeHandler = prefix => async (request, response) => {
        const route = new URL(request.url || '/', 'http://dsh.local').pathname.slice(prefix.length).replace(/^\//, '');
        try {
            await ready;
            if (request.method === 'GET' && route === 'status') return send(response, 200, { ok: true, value: status() });
            if (request.method !== 'POST') return send(response, 405, { ok: false, error: 'Method Not Allowed' });
            if (!isSameOriginMutation(request)) return send(response, 403, { ok: false, error: 'Cross-origin request rejected.' });
            if (route === 'keys') return send(response, 200, { ok: true, value: await addKeys(await readRequestJson(request)) });
            if (route === 'accounts') return send(response, 200, { ok: true, value: await accountAction(await readRequestJson(request)) });
            if (route === 'settings') return send(response, 200, { ok: true, value: await updateSettings(await readRequestJson(request)) });
            if (route === 'models') return send(response, 200, { ok: true, value: await updateModels(await readRequestJson(request)) });
            if (route === 'catalog/refresh') return send(response, 200, { ok: true, value: await refreshCatalog() });
            if (route === 'test') return send(response, 200, { ok: true, value: await test() });
            if (route === 'tunnel') return send(response, 200, { ok: true, value: await tunnelAction(await readRequestJson(request)) });
            if (route === 'tunnel/secret') return send(response, 200, { ok: true, value: tunnelSecret() });
            if (route === 'tunnel/login') return send(response, 200, { ok: true, value: await tunnelLogin() });
            if (route === 'tunnel/cookies') return send(response, 200, { ok: true, value: await tunnelCookies(await readRequestJson(request)) });
            if (route === 'tunnel/test') return send(response, 200, { ok: true, value: await tunnelTest() });
            return send(response, 404, { ok: false, error: 'Not Found' });
        } catch (cause) {
            let message = cause instanceof Error ? cause.message : 'Google AI Studio 操作失败。';
            // 绝不回显 Key 明文。
            if (/AIza[0-9A-Za-z_-]{10,}/.test(message)) message = '请求失败：请检查 API Key 是否有效。';
            send(response, 400, { ok: false, error: message });
        }
    };

    const disposePrimary = ctx.webServer.register({ kind: 'prefix', path: AI_STUDIO_PREFIX, handler: routeHandler(AI_STUDIO_PREFIX) });
    let disposeLegacy = () => {};
    try {
        disposeLegacy = ctx.webServer.register({ kind: 'prefix', path: AI_STUDIO_LEGACY_PREFIX, handler: routeHandler(AI_STUDIO_LEGACY_PREFIX) }) ?? (() => {});
    } catch { /* 与上游插件共存时从路由可能已存在 */ }

    return {
        ready, status, addKeys, accountAction, updateSettings, updateModels, refreshCatalog, test,
        tunnelAction, tunnelSecret, tunnelLogin, tunnelCookies, tunnelTest,
        dispose() {
            disposed = true;
            disposePrimary();
            disposeLegacy();
            claim.dispose();
            browser.stop().catch(() => undefined);
            tunnel.dispose();
        },
    };
}
