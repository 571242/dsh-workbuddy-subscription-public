import { createPrivateKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { LlmAdapter, LlmError, createUserMessage } from '@deepseek-ai/dsh-llm';
import { parseServiceAccount, ServiceAccountTokens } from '../vendor/vertex/lib/auth.js';
import { GoogleVertexAnthropicAdapter } from '../vendor/vertex/lib/adapter.js';
import { GoogleVertexGeminiAdapter } from '../vendor/vertex/lib/gemini_adapter.js';
import { DEFAULT_MODELS, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS } from '../vendor/vertex/lib/index.js';
import { DEFAULT_GEMINI_MODELS, DEFAULT_GEMINI_MAX_TOKENS } from '../vendor/vertex/lib/gemini.js';
import { fetchGeminiModels } from '../vendor/vertex/lib/discovery.js';

export const VERTEX_PREFIX = '/wb/workbuddy/vertex/api';
export const VERTEX_LEGACY_PREFIX = '/workbuddy/vertex/api';
export const VERTEX_ROUTES = ['google-vertex-gemini', 'google-vertex-anthropic'];
const MAX_JSON_BYTES = 64 * 1024;

export function parseVertexDocument(value) {
    if (!value || typeof value !== 'object' || !value.account || value.account.type !== 'service_account') {
        throw new Error('请选择 Google Cloud service_account 类型的 JSON 账号文件。');
    }
    const account = parseServiceAccount(JSON.stringify(value.account), '导入的账号');
    if (account.token_uri && account.token_uri !== 'https://oauth2.googleapis.com/token') {
        throw new Error('只允许 Google 官方 OAuth 令牌端点。');
    }
    account.token_uri = 'https://oauth2.googleapis.com/token';
    const key = createPrivateKey(account.private_key);
    if (key.asymmetricKeyType !== 'rsa') throw new Error('服务账号必须使用 RSA 私钥。');
    const project = value.project ?? account.project_id;
    if (typeof project !== 'string' || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) {
        throw new Error('服务账号缺少有效的 project_id。');
    }
    const location = value.location ?? 'global';
    if (typeof location !== 'string' || !/^(global|[a-z]+-[a-z]+[0-9]+)$/.test(location)) {
        throw new Error('Vertex 区域无效，例如 global、us-central1。');
    }
    const enabled = value.enabled !== false;
    return { account: { ...account, type: 'service_account' }, project, location, enabled };
}

// Stable route ownership lets an import replace credentials without reloading WorkBuddy.
class VertexRouteAdapter extends LlmAdapter {
    constructor(index, current, ready, isEnabled = () => true) {
        super();
        this.index = index;
        this.current = current;
        this.ready = ready;
        this.isEnabled = isEnabled;
    }
    providerInfo(provider) {
        return { id: provider, name: this.index === 0 ? 'Google Vertex AI (Gemini)' : 'Google Vertex AI (Claude)' };
    }
    async listModels(provider) {
        await this.ready;
        if (!this.isEnabled()) return [];
        return this.current()?.[this.index].listModels(provider) ?? [];
    }
    async resolveModel(...args) {
        await this.ready;
        const adapter = this.current()?.[this.index];
        if (!adapter) throw new LlmError('请先在「自制渠道」设置中导入 Vertex 服务账号。', 'MISSING_CREDENTIAL');
        return adapter.resolveModel(...args);
    }
    async prepareCall(...args) {
        await this.resolveModel(...args);
        return this.current()[this.index].prepareCall(...args);
    }
}

export function registerWorkBuddyVertex(ctx, options) {
    const { store, fetchFn = fetch, claimProviderRoute, isSameOriginMutation, readRequestJson } = options;
    let document = null;
    let adapters = null;
    let tokens = null;
    let discoveredGeminiModels = null;
    let error = null;
    let disposed = false;
    let writing = false;
    function build(next) {
        const common = {
            serviceAccount: next.account, project: next.project, location: next.location,
            streamIdleTimeoutMs: 120000,
        };
        const nextTokens = new ServiceAccountTokens(next.account, { fetch: fetchFn });
        const transport = { fetch: fetchFn, tokens: nextTokens };
        return {
            tokens: nextTokens,
            adapters: [
                new GoogleVertexGeminiAdapter({ ...common, models: DEFAULT_GEMINI_MODELS, maxTokens: DEFAULT_GEMINI_MAX_TOKENS }, {
                    ...transport,
                    discover: async () => {
                        const list = await fetchGeminiModels(next.location, nextTokens, fetchFn, AbortSignal.timeout(15000));
                        if (Array.isArray(list) && list.length > 0) discoveredGeminiModels = list;
                        return list;
                    },
                }),
                new GoogleVertexAnthropicAdapter({ ...common, models: DEFAULT_MODELS, contextWindow: DEFAULT_CONTEXT_WINDOW, maxTokens: DEFAULT_MAX_TOKENS }, transport),
            ],
        };
    }
    function activate(next, built) {
        document = next;
        adapters = built.adapters;
        tokens = built.tokens;
        discoveredGeminiModels = null;
        error = null;
    }
    const ready = store.load().then(saved => {
        if (saved && !disposed) {
            const next = parseVertexDocument(saved);
            activate(next, build(next));
        }
    }).catch(() => {
        error = 'Vertex 加密账号读取失败，请重新导入。';
    });
    const claims = VERTEX_ROUTES.map((providerId, index) => claimProviderRoute(ctx, {
        providerId, label: 'WorkBuddy Vertex AI', adapter: new VertexRouteAdapter(index, () => adapters, ready, () => document === null || document.enabled !== false),
    }));
    function currentModelIds() {
        if (!document) return [];
        const geminiList = Array.isArray(discoveredGeminiModels) && discoveredGeminiModels.length > 0 ? discoveredGeminiModels : DEFAULT_GEMINI_MODELS;
        return [...geminiList, ...DEFAULT_MODELS].map(model => model.id);
    }
    function status() {
        const models = currentModelIds();
        return {
            enabled: document?.enabled !== false,
            configured: document !== null,
            project: document?.project ?? null,
            clientEmail: document?.account.client_email ?? null,
            location: document?.location ?? 'global',
            models,
            serving: claims.every(claim => claim.serving()),
            error: error ?? claims.map(claim => claim.conflict()).find(Boolean) ?? null,
        };
    }
    async function importAccount(body) {
        await ready;
        if (writing) throw new Error('另一个账号正在保存，请稍后重试。');
        writing = true;
        try {
            if (!body || typeof body !== 'object') throw new Error('导入参数无效。');
            let raw;
            if (typeof body.filePath === 'string' && body.filePath.trim()) {
                const filePath = body.filePath.trim();
                if (!isAbsolute(filePath) || !filePath.toLowerCase().endsWith('.json')) throw new Error('请输入 JSON 文件的绝对路径。');
                raw = await readFile(filePath, 'utf8');
            } else raw = body.json;
            if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_JSON_BYTES) throw new Error('账号 JSON 为空或超过 64 KB。');
            let account;
            try { account = JSON.parse(raw.replace(/^\uFEFF/, '')); }
            catch { throw new Error('账号文件不是有效的 JSON。'); }
            const next = parseVertexDocument({ account, location: body.location, project: body.project, enabled: document?.enabled !== false });
            const built = build(next);
            await store.save(next);
            if (!disposed) activate(next, built);
            ctx.emit?.('llm/adapters-updated');
            return status();
        } finally { writing = false; }
    }
    async function updateSettings(body) {
        await ready;
        if (!body || typeof body !== 'object') throw new Error('设置参数无效。');
        if (document && typeof body.enabled === 'boolean') {
            document = { ...document, enabled: body.enabled };
            await store.save(document);
            ctx.emit?.('llm/adapters-updated');
        }
        return status();
    }
    async function refreshCatalog() {
        await ready;
        if (!adapters) throw new Error('请先导入 Vertex 服务账号。');
        adapters[0]?.invalidateModels?.();
        adapters[1]?.invalidateModels?.();
        const geminiModels = await adapters[0].listModels(VERTEX_ROUTES[0]);
        const claudeModels = await adapters[1].listModels(VERTEX_ROUTES[1]);
        if (Array.isArray(geminiModels) && geminiModels.length > 0) {
            discoveredGeminiModels = geminiModels.map(m => ({ id: m.id, name: m.name }));
        }
        ctx.emit?.('llm/adapters-updated');
        return {
            ...status(),
            models: [...geminiModels, ...claudeModels].map(m => m.id),
        };
    }
    async function test() {
        await ready;
        if (!adapters) throw new Error('请先导入 Vertex 服务账号。');
        const adapter = adapters[0];
        await tokens.get(AbortSignal.timeout(20000));
        const models = await adapter.listModels(VERTEX_ROUTES[0]);
        if (Array.isArray(models) && models.length > 0) {
            discoveredGeminiModels = models.map(m => ({ id: m.id, name: m.name }));
        }
        const model = models.filter(entry => /^gemini-\d+(?:\.\d+)?-flash$/.test(entry.id))
            .sort((left, right) => right.id.localeCompare(left.id, undefined, { numeric: true }))[0]?.id ?? DEFAULT_GEMINI_MODELS[0].id;
        let text = '';
        let finished = false;
        for await (const chunk of adapter.stream({
            provider: VERTEX_ROUTES[0], model,
            messages: [createUserMessage({ content: [{ type: 'text', text: 'Reply with OK only.' }] })],
            tools: [], maxTokens: 128, signal: AbortSignal.timeout(45000),
        })) {
            if (chunk.type === 'text-delta') text += chunk.text ?? chunk.delta ?? '';
            if (chunk.type === 'finish') {
                if (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted') {
                    throw new Error(chunk.reason.failure?.message ?? 'Vertex 请求失败。');
                }
                finished = true;
            }
        }
        if (!finished || !text.trim()) throw new Error('Vertex 未返回有效文本。');
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
            if (route === 'import') return send(response, 200, { ok: true, value: await importAccount(await readRequestJson(request)) });
            if (route === 'settings') return send(response, 200, { ok: true, value: await updateSettings(await readRequestJson(request)) });
            if (route === 'catalog/refresh') return send(response, 200, { ok: true, value: await refreshCatalog() });
            if (route === 'test') return send(response, 200, { ok: true, value: await test() });
            return send(response, 404, { ok: false, error: 'Not Found' });
        } catch (cause) {
            // Never echo malformed JSON, private keys, or token response payloads.
            let message = cause instanceof Error ? cause.message : 'Vertex 操作失败。';
            if (/PRIVATE KEY|access_token|invalid_grant/.test(message)) message = 'Google 拒绝该服务账号凭据，请检查密钥是否有效、已撤销或系统时间是否正确。';
            send(response, 400, { ok: false, error: message });
        }
    };
    const disposePrimary = ctx.webServer.register({ kind: 'prefix', path: VERTEX_PREFIX, handler: routeHandler(VERTEX_PREFIX) });
    let disposeLegacy = () => {};
    try {
        disposeLegacy = ctx.webServer.register({ kind: 'prefix', path: VERTEX_LEGACY_PREFIX, handler: routeHandler(VERTEX_LEGACY_PREFIX) }) ?? (() => {});
    } catch {}
    return {
        ready, status, importAccount, updateSettings, refreshCatalog, test,
        dispose() { disposed = true; disposePrimary(); disposeLegacy(); claims.forEach(claim => claim.dispose()); },
    };
}
