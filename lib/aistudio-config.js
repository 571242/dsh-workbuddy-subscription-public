/**
 * Google AI Studio 的纯函数层：配置规整、Key 解析、脱敏、目录读取。
 *
 * 单独一层的原因：这些函数要在没有 DSH 宿主（`@deepseek-ai/dsh-llm`）的
 * 单元测试里直接跑，而适配器本身必须 import 宿主的 LlmError。协议与 I/O
 * 留在 `aistudio-integration.js`，这里只处理数据。
 *
 * @module dsh-workbuddy-subscription/aistudio-config
 */

/** 官方端点；用户可改成 Gemini Balance / New-API 之类的反代网关。 */
export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';

/** 内置兜底目录：联网发现失败时仍能选模型。 */
export const DEFAULT_AI_STUDIO_MODELS = [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
];

/** Gemini 的上下文与输出上限默认值，与 Vertex 路由保持一致。 */
export const DEFAULT_CONTEXT_WINDOW = 1_048_576;
export const DEFAULT_MAX_TOKENS = 65_535;

export const ROTATION_STRATEGIES = new Set(['sequential', 'round-robin', 'sticky']);
export const REASONING_EFFORTS = new Set(['', 'low', 'medium', 'high']);

/** 目录里点名不要的变体：嵌入、语音、生图、Live API。 */
const NON_TEXT_SEGMENTS = new Set(['embedding', 'tts', 'image', 'live', 'audio', 'aqa']);

function cleanText(value, max = 200) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** 只留 http/https，去掉尾部斜杠；非法地址直接报错，免得把 Key 发到奇怪的地方。 */
export function normalizeBaseUrl(raw) {
    const text = cleanText(raw, 500);
    if (text === '') return DEFAULT_BASE_URL;
    let url;
    try {
        url = new URL(text);
    } catch {
        throw new Error('Base URL 不是合法地址，例如 https://generativelanguage.googleapis.com');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('Base URL 只支持 http/https。');
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** 把 base 统一成能直接拼 `/models` 的 API 根。 */
export function apiRoot(baseUrl) {
    return /\/v1(?:alpha|beta)\d*$/i.test(baseUrl) ? baseUrl : `${baseUrl}/v1beta`;
}

/** 脱敏展示：保留前后各 4 位，永不回传明文 Key。 */
export function maskApiKey(key) {
    const text = String(key ?? '');
    if (text.length <= 10) return '*'.repeat(Math.max(4, text.length));
    return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

/** 目录条目 → 选择器行；官方目录给的容量优先，缺了才用默认。 */
export function catalogRow(raw) {
    const id = typeof raw?.id === 'string' ? raw.id : '';
    if (id === '') return null;
    return {
        id,
        name: cleanText(raw?.name, 120) || id,
        contextWindow: Number.isFinite(raw?.contextWindow) && raw.contextWindow > 0 ? Math.floor(raw.contextWindow) : DEFAULT_CONTEXT_WINDOW,
        maxTokens: Number.isFinite(raw?.maxTokens) && raw.maxTokens > 0 ? Math.floor(raw.maxTokens) : DEFAULT_MAX_TOKENS,
    };
}

/** 官方目录的原始条目 → 内部行；滤掉非对话模型。 */
export function modelFromApiEntry(entry) {
    const name = typeof entry?.name === 'string' ? entry.name : '';
    const id = name.startsWith('models/') ? name.slice(7) : name;
    if (id === '' || !id.startsWith('gemini-')) return null;
    if (id.split('-').some(segment => NON_TEXT_SEGMENTS.has(segment))) return null;
    const methods = entry?.supportedGenerationMethods;
    if (Array.isArray(methods) && !methods.includes('generateContent')) return null;
    return catalogRow({
        id,
        name: cleanText(entry?.displayName, 120) || id,
        contextWindow: entry?.inputTokenLimit,
        maxTokens: entry?.outputTokenLimit,
    });
}

/**
 * 校验并规整一份持久化文档。
 *
 * 账号池整份加密落盘（Windows DPAPI / macOS Keychain / Linux Secret Service），
 * 这里只管结构；任何越界值都回落到安全默认，避免坏文件把设置页打白。
 */
export function parseAiStudioDocument(value) {
    if (!value || typeof value !== 'object') return null;
    const rawAccounts = Array.isArray(value.accounts) ? value.accounts : [];
    const seen = new Set();
    const accounts = [];
    for (const entry of rawAccounts) {
        if (!entry || typeof entry !== 'object') continue;
        const apiKey = cleanText(entry.apiKey, 500);
        if (apiKey === '' || seen.has(apiKey)) continue;
        seen.add(apiKey);
        accounts.push({
            id: cleanText(entry.id, 80) || `key-${accounts.length + 1}`,
            apiKey,
            alias: cleanText(entry.alias, 80),
            createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
            lastUsedAt: Number.isFinite(entry.lastUsedAt) ? entry.lastUsedAt : undefined,
            failCount: Number.isFinite(entry.failCount) && entry.failCount > 0 ? Math.floor(entry.failCount) : 0,
            cooldownUntil: Number.isFinite(entry.cooldownUntil) ? entry.cooldownUntil : undefined,
            authStatus: entry.authStatus === 'invalid' ? 'invalid' : 'ok',
            authReason: cleanText(entry.authReason, 200) || undefined,
        });
    }
    const primaryId = cleanText(value.primaryAccountId, 80);
    const catalog = (Array.isArray(value.catalog) ? value.catalog : []).map(catalogRow).filter(Boolean);
    const enabledModelIds = Array.isArray(value.enabledModelIds)
        ? [...new Set(value.enabledModelIds.filter(id => typeof id === 'string' && id !== ''))]
        : null;
    const overrides = {};
    if (value.contextWindowOverrides && typeof value.contextWindowOverrides === 'object') {
        for (const [id, size] of Object.entries(value.contextWindowOverrides)) {
            if (typeof id === 'string' && Number.isFinite(size) && size > 0) overrides[id] = Math.floor(size);
        }
    }
    const effort = cleanText(value.defaultReasoningEffort, 20);
    return {
        enabled: value.enabled !== false,
        baseUrl: normalizeBaseUrl(value.baseUrl),
        rotationStrategy: ROTATION_STRATEGIES.has(value.rotationStrategy) ? value.rotationStrategy : 'sequential',
        primaryAccountId: accounts.some(a => a.id === primaryId) ? primaryId : accounts[0]?.id,
        activeAccountId: accounts.some(a => a.id === cleanText(value.activeAccountId, 80)) ? cleanText(value.activeAccountId, 80) : undefined,
        accounts,
        catalog,
        enabledModelIds,
        contextWindowOverrides: overrides,
        defaultReasoningEffort: REASONING_EFFORTS.has(effort) ? effort : '',
        roundRobinCursor: Number.isFinite(value.roundRobinCursor) ? Math.max(0, Math.floor(value.roundRobinCursor)) : 0,
        tunnel: parseTunnelDocument(value.tunnel),
    };
}

/**
 * 隧道配置。
 *
 * `enabled` 是用户开关；`token` 是伴随脚本连进来要出示的令牌；`browser` 是这台
 * 机器上那个无头浏览器代理的开关。三者分开，是因为云端和本地用法不同：云端
 * 打开 browser，本地可能只是用自己装的浏览器插件连过来。
 */
export function parseTunnelDocument(value) {
    const raw = value && typeof value === 'object' ? value : {};
    return {
        enabled: raw.enabled === true,
        token: cleanText(raw.token, 200),
        browser: raw.browser === true,
        headless: raw.headless !== false,
    };
}


/** 从一段粘贴文本里拆出 `备注=Key` 或纯 Key；逗号、换行、分号都算分隔。 */
export function parseKeyEntries(text) {
    const out = [];
    for (const line of String(text ?? '').split(/[\r\n,;]+/u)) {
        const item = line.trim();
        if (item === '') continue;
        const eq = item.indexOf('=');
        const alias = eq > 0 ? item.slice(0, eq).trim() : '';
        const key = (eq > 0 ? item.slice(eq + 1) : item).trim();
        if (key === '' || /\s/u.test(key) || key.length < 12) continue;
        out.push({ apiKey: key, alias });
    }
    return out;
}
