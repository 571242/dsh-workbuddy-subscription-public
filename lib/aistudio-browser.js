/**
 * AI Studio 隧道的浏览器端代理。
 *
 * 职责：在这台机器上养一个浏览器（本地用已装的 Edge/Chrome，云端自动下载
 * chrome-headless-shell），打开 `https://aistudio.google.com/` 建立页面上下文，
 * 然后连回 `/wb/aistudio/ws`，把宿主发来的 `http_request` 用页面里的 `fetch()`
 * 发出去，响应分片再推回隧道。
 *
 * 为什么非得在页面里发：Google 的 CORS 只放行 `https://aistudio.google.com`
 * 这个 Origin，而且请求要带该域的 Cookie、Sec-Fetch-* 与浏览器 TLS 指纹。
 * Node 侧无论怎么拼都差一截。
 *
 * 页面执行与流式回传走 CDP：`Runtime.addBinding` 注册一个回调，页面每读到一块
 * `response.body` 就 `window.__dshEmit(...)` 推出来，Node 侧即时转发，不等整个
 * 响应结束——SSE 的逐字输出因此不会被缓冲掉。
 *
 * @module dsh-workbuddy-subscription/aistudio-browser
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

const AI_STUDIO_ORIGIN = 'https://aistudio.google.com';
const CDP_TIMEOUT_MS = 30_000;
const PAGE_LOAD_TIMEOUT_MS = 45_000;
/** Chrome for Testing 版本：与 AI Studio 的实际前端兼容即可，只是载体。 */
const CHROME_VERSION = '156.0.8078.80';
const BINDING = '__dshAiStudioEmit';

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function runCapture(file, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(file, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', chunk => { stdout += chunk; });
        child.stderr?.on('data', chunk => { stderr += chunk; });
        child.on('error', reject);
        child.on('close', code => resolve({ code, stdout, stderr }));
    });
}

/** 找一个空闲的本地端口给 CDP。 */
async function freePort() {
    const net = await import('node:net');
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

/** 本机可用的 Chromium 系浏览器。 */
function candidateBrowsers() {
    if (process.platform === 'win32') {
        const roots = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA];
        const list = [];
        for (const root of roots.filter(Boolean)) {
            list.push(join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
            list.push(join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
        }
        return list;
    }
    if (process.platform === 'darwin') {
        return [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ];
    }
    return [
        process.env.DSH_AISTUDIO_CHROME ?? '',
        '/opt/aistudio-browser/chrome-headless-shell-linux-arm64/chrome-headless-shell',
        '/opt/aistudio-browser/chrome-headless-shell-linux-x64/chrome-headless-shell',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
    ].filter(Boolean);
}

async function exists(path) {
    try { await access(path, fsConstants.X_OK); return true; } catch { return false; }
}

/** 云端：把 chrome-headless-shell 下到 DSH_HOME，只下一次。 */
async function ensureManagedChromium(root, logger) {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const platform = process.platform === 'linux' ? 'linux' : process.platform === 'darwin' ? 'mac' : null;
    if (platform === null) return null;
    const folder = join(root, `chrome-headless-shell-${platform}-${arch}`);
    const binary = join(folder, 'chrome-headless-shell');
    if (await exists(binary)) return binary;
    const zipUrl = `https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/${platform}-${arch}/chrome-headless-shell-${platform}-${arch}.zip`;
    const zipPath = `${folder}.zip`;
    await mkdir(dirname(folder), { recursive: true });
    logger?.info?.(`[dsh-workbuddy] downloading headless chromium (${arch}) ...`);
    const response = await fetch(zipUrl);
    if (!response.ok || response.body === null) throw new Error(`下载无头浏览器失败（HTTP ${response.status}）。`);
    await pipeline(response.body, createWriteStream(zipPath));
    await mkdir(folder, { recursive: true });
    const unzip = await runCapture('unzip', ['-q', '-o', zipPath, '-d', folder]);
    if (unzip.code !== 0) throw new Error(`解压无头浏览器失败：${unzip.stderr.slice(0, 300)}`);
    const nested = join(folder, `chrome-headless-shell-${platform}-${arch}`, 'chrome-headless-shell');
    if (await exists(nested)) {
        // 官方包多一层目录，摊平它。
        const moved = await runCapture('bash', ['-lc', `mv "${nested}" "${binary}" && rm -rf "${join(folder, `chrome-headless-shell-${platform}-${arch}`)}"`]);
        if (moved.code !== 0) throw new Error('整理无头浏览器目录失败。');
    }
    await chmod(binary, 0o755).catch(() => undefined);
    await rm(zipPath, { force: true }).catch(() => undefined);
    if (!(await exists(binary))) throw new Error('无头浏览器解压后找不到可执行文件。');
    return binary;
}

/** 极简 CDP 客户端：一条 WebSocket，按 id 收响应，按 sessionId 分流事件。 */
class Cdp {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Set();
        socket.addEventListener('message', event => {
            let message;
            try { message = JSON.parse(typeof event.data === 'string' ? event.data : ''); } catch { return; }
            if (message.id !== undefined && this.pending.has(message.id)) {
                const { resolve, reject } = this.pending.get(message.id);
                this.pending.delete(message.id);
                if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
                else resolve(message.result);
                return;
            }
            for (const listener of this.listeners) listener(message);
        });
    }

    static async connect(url) {
        const socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('CDP 连接超时')), CDP_TIMEOUT_MS);
            socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
            socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP 连接失败')); }, { once: true });
        });
        return new Cdp(socket);
    }

    send(method, params = {}, sessionId) {
        const id = this.nextId++;
        const payload = { id, method, params };
        if (sessionId !== undefined) payload.sessionId = sessionId;
        this.socket.send(JSON.stringify(payload));
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP 调用超时：${method}`));
            }, CDP_TIMEOUT_MS);
            this.pending.set(id, {
                resolve: value => { clearTimeout(timer); resolve(value); },
                reject: error => { clearTimeout(timer); reject(error); },
            });
        });
    }

    on(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    close() {
        try { this.socket.close(); } catch { /* 已关闭 */ }
    }
}

/** 注入到页面里执行的转发函数。必须在页面上下文里求值。 */
async function pageRelay(spec, requestId, bindingName) {
    const emit = (payload) => {
        try { window[bindingName](JSON.stringify(payload)); } catch { /* 页面已卸载 */ }
    };
    const toBase64 = (bytes) => {
        let binary = '';
        const step = 0x8000;
        for (let index = 0; index < bytes.length; index += step) {
            binary += String.fromCharCode.apply(null, bytes.subarray(index, index + step));
        }
        return btoa(binary);
    };
    try {
        const response = await fetch(spec.url, {
            method: spec.method || 'POST',
            headers: spec.headers || {},
            body: spec.body === undefined || spec.body === null ? undefined : spec.body,
            credentials: 'include',
            mode: 'cors',
            redirect: 'follow',
            cache: 'no-store',
        });
        emit({ t: 'start', id: requestId, status: response.status, headers: Object.fromEntries(response.headers.entries()) });
        if (response.body === null) {
            emit({ t: 'end', id: requestId });
            return;
        }
        const reader = response.body.getReader();
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.length > 0) emit({ t: 'chunk', id: requestId, data: toBase64(value) });
        }
        emit({ t: 'end', id: requestId });
    } catch (error) {
        emit({ t: 'error', id: requestId, error: String(error && error.message ? error.message : error) });
    }
}

/**
 * 浏览器代理：养浏览器 + 连隧道 + 转发。
 */
export class AiStudioBrowser {
    constructor(options = {}) {
        this.logger = options.logger;
        this.home = options.home ?? join(process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'), 'storages');
        this.profileDir = join(this.home, 'aistudio-browser-profile');
        this.token = options.getToken ?? (() => '');
        this.tunnelUrl = options.getTunnelUrl ?? (() => '');
        this.headless = options.headless !== false;
        this.binary = null;
        this.child = null;
        this.cdp = null;
        this.debugPort = 0;
        this.targetId = null;
        this.sessionId = null;
        this.tunnel = null;
        this.state = 'stopped';
        this.lastError = null;
        this.startedAt = null;
        this.pageUrl = null;
        this.requests = 0;
        this.reconnectTimer = null;
        this.stopping = false;
    }

    status() {
        return {
            state: this.state,
            headless: this.headless,
            startedAt: this.startedAt,
            pageUrl: this.pageUrl,
            requests: this.requests,
            browser: this.binary ? this.binary.split(/[\\/]/).pop() : null,
            profileDir: this.profileDir,
            error: this.lastError,
        };
    }

    async resolveBrowser() {
        for (const candidate of candidateBrowsers()) {
            if (await exists(candidate)) return candidate;
        }
        const managed = await ensureManagedChromium(this.home, this.logger);
        if (managed !== null) return managed;
        throw new Error('这台机器上没有可用的 Chromium 系浏览器，也无法自动下载。');
    }

    async start() {
        if (this.state === 'running' || this.state === 'starting') return this.status();
        this.stopping = false;
        this.state = 'starting';
        this.lastError = null;
        try {
            this.binary ??= await this.resolveBrowser();
            await mkdir(this.profileDir, { recursive: true });
            const port = await freePort();
            const args = [
                `--remote-debugging-port=${port}`,
                `--user-data-dir=${this.profileDir}`,
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-features=Translate,MediaRouter,OptimizationHints',
                '--window-size=1280,900',
                'about:blank',
            ];
            if (this.headless) args.unshift('--headless=new', '--disable-gpu', '--hide-scrollbars');
            if (process.platform === 'linux') args.unshift('--no-sandbox', '--disable-dev-shm-usage');
            this.logger?.info?.(`[dsh-workbuddy] launching ${this.binary} (headless=${this.headless})`);
            this.child = spawn(this.binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
            this.child.stderr?.on('data', chunk => {
                const text = String(chunk);
                if (/DevTools listening/i.test(text)) return;
                if (/ERROR|error/.test(text)) this.logger?.warn?.(`[dsh-workbuddy] browser: ${text.trim().slice(0, 300)}`);
            });
            this.child.on('exit', code => {
                if (this.stopping) return;
                this.logger?.warn?.(`[dsh-workbuddy] browser exited with ${code}`);
                this.state = 'stopped';
                this.child = null;
                this.scheduleReconnect(2000);
            });

            const endpoint = await this.waitForCdp(port);
            this.debugPort = port;
            this.browserEndpoint = endpoint;
            await this.openPage();
            this.state = 'running';
            this.startedAt = Date.now();
            this.connectTunnel();
            return this.status();
        } catch (error) {
            this.state = 'failed';
            this.lastError = error instanceof Error ? error.message : String(error);
            this.logger?.warn?.(`[dsh-workbuddy] aistudio browser failed: ${this.lastError}`);
            await this.stop().catch(() => undefined);
            this.state = 'failed';
            throw error;
        }
    }

    async waitForCdp(port) {
        const deadline = Date.now() + CDP_TIMEOUT_MS;
        while (Date.now() < deadline) {
            try {
                const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) });
                if (response.ok) {
                    const info = await response.json();
                    if (typeof info.webSocketDebuggerUrl === 'string') return info.webSocketDebuggerUrl;
                }
            } catch { /* 还没起来 */ }
            await delay(250);
        }
        throw new Error('浏览器调试端口没有就绪。');
    }

    /**
     * 开页面并连上它。
     *
     * 刻意走「页面级 WebSocket」而不是 browser 级 + flatten 会话：`chrome-headless-shell`
     * （云端用的就是它）不实现 Target 域的扁平会话，`Runtime.enable` 会直接报
     * `wasn't found`。页面级连接在完整 Chromium 与 headless-shell 上都可用。
     */
    async openPage() {
        const created = await this.cdpJson('PUT', '/json/new?about:blank');
        if (typeof created?.webSocketDebuggerUrl !== 'string') throw new Error('浏览器没有返回页面调试地址。');
        this.targetId = created.id ?? null;
        this.cdp = await Cdp.connect(created.webSocketDebuggerUrl);
        this.sessionId = undefined;
        await this.cdp.send('Page.enable');
        await this.cdp.send('Runtime.enable');
        await this.cdp.send('Runtime.addBinding', { name: BINDING });
        this.cdp.on(message => {
            if (message.method === 'Runtime.bindingCalled' && message.params?.name === BINDING) {
                this.onPageMessage(message.params?.payload);
            }
        });
        await this.cdp.send('Page.navigate', { url: `${AI_STUDIO_ORIGIN}/` });
        this.pageUrl = `${AI_STUDIO_ORIGIN}/`;
        await delay(2500);
    }

    /** 调试端口的 HTTP 接口（/json/new 等）。 */
    async cdpJson(method, path) {
        const response = await fetch(`http://127.0.0.1:${this.debugPort}${path}`, {
            method,
            signal: AbortSignal.timeout(CDP_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`浏览器调试接口返回 HTTP ${response.status}`);
        const text = await response.text();
        return text === '' ? {} : JSON.parse(text);
    }

    /** 页面推回来的一段结果 → 立刻转成隧道帧。中间不做整包缓冲，SSE 才能逐字出。 */
    onPageMessage(raw) {
        if (typeof raw !== 'string') return;
        let message;
        try { message = JSON.parse(raw); } catch { return; }
        if (typeof message.id !== 'string') return;
        if (message.t === 'start') {
            this.sendToTunnel({ type: 'stream_start', id: message.id, payload: { status: message.status ?? 0, headers: message.headers ?? {} } });
            return;
        }
        if (message.t === 'chunk' && typeof message.data === 'string') {
            this.sendToTunnel({ type: 'stream_chunk', id: message.id, payload: { data: message.data } });
            return;
        }
        if (message.t === 'end') {
            this.sendToTunnel({ type: 'stream_end', id: message.id });
            return;
        }
        if (message.t === 'error') {
            this.sendToTunnel({ type: 'error', id: message.id, payload: { error: String(message.error ?? '页面请求失败') } });
        }
    }

    connectTunnel() {
        if (this.stopping) return;
        const url = this.tunnelUrl();
        if (!url) return;
        try {
            this.tunnel = new WebSocket(url);
        } catch (error) {
            this.logger?.warn?.(`[dsh-workbuddy] tunnel dial failed: ${error instanceof Error ? error.message : String(error)}`);
            this.scheduleReconnect(3000);
            return;
        }
        this.jobs = this.jobs ?? new Map();
        this.tunnel.addEventListener('open', () => {
            this.logger?.info?.('[dsh-workbuddy] page agent attached to tunnel');
            this.tunnel.send(JSON.stringify({
                type: 'hello',
                payload: {
                    name: 'dsh-workbuddy-page-agent',
                    version: '1.0.0',
                    href: this.pageUrl ?? '',
                    ua: process.version,
                },
            }));
        });
        this.tunnel.addEventListener('message', event => {
            let frame;
            try { frame = JSON.parse(typeof event.data === 'string' ? event.data : ''); } catch { return; }
            if (frame?.type === 'ping') {
                this.tunnel.send(JSON.stringify({ type: 'pong', payload: { t: Date.now() } }));
                return;
            }
            if (frame?.type === 'http_request') void this.relay(frame.id, frame.payload ?? {});
        });
        this.tunnel.addEventListener('close', () => {
            this.tunnel = null;
            if (!this.stopping) this.scheduleReconnect(3000);
        });
        this.tunnel.addEventListener('error', () => {
            try { this.tunnel?.close(); } catch { /* noop */ }
        });
    }

    scheduleReconnect(ms) {
        if (this.stopping || this.reconnectTimer !== null) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.stopping) return;
            if (this.state === 'running') this.connectTunnel();
            else if (this.state === 'stopped') void this.start().catch(() => undefined);
        }, ms);
        this.reconnectTimer.unref?.();
    }

    async relay(id, spec) {
        this.requests += 1;
        try {
            if (this.cdp === null) throw new Error('浏览器未就绪');
            const expression = `(${pageRelay.toString()})(${JSON.stringify(spec)}, ${JSON.stringify(id)}, ${JSON.stringify(BINDING)})`;
            await this.cdp.send('Runtime.evaluate', { expression, awaitPromise: false, returnByValue: false });
        } catch (error) {
            this.sendToTunnel({ type: 'error', id, payload: { error: error instanceof Error ? error.message : String(error) } });
        }
    }

    sendToTunnel(frame) {
        try { this.tunnel?.send(JSON.stringify(frame)); } catch { /* 连接已断 */ }
    }

    async stop() {
        this.stopping = true;
        this.state = 'stopped';
        if (this.reconnectTimer !== null) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        try { this.tunnel?.close(); } catch { /* noop */ }
        this.tunnel = null;
        this.cdp?.close();
        this.cdp = null;
        this.sessionId = null;
        this.targetId = null;
        if (this.child !== null) {
            const child = this.child;
            this.child = null;
            try { child.kill('SIGTERM'); } catch { /* noop */ }
            await delay(600);
            try { child.kill('SIGKILL'); } catch { /* noop */ }
        }
        this.startedAt = null;
        this.jobs?.clear();
        return this.status();
    }

    /** 打开一个可见窗口，让用户登录 Google；关掉窗口后自动回到无头。 */
    async openLogin() {
        await this.stop();
        this.headless = false;
        await this.start();
        this.logger?.info?.('[dsh-workbuddy] login window opened; close it after signing in');
        return this.status();
    }

    /** 读当前 profile 的 Cookie（给云端做一次性登录迁移）。 */
    async exportCookies() {
        if (this.cdp === null) throw new Error('浏览器没有运行。');
        const { cookies } = await this.cdp.send('Network.getAllCookies');
        return (cookies ?? []).filter(cookie => /google\.com$/.test(String(cookie.domain).replace(/^\./, '')));
    }

    /** 把 Cookie 灌进当前 profile。 */
    async importCookies(cookies) {
        if (this.cdp === null) throw new Error('浏览器没有运行。');
        if (!Array.isArray(cookies) || cookies.length === 0) throw new Error('Cookie 列表为空。');
        await this.cdp.send('Network.enable');
        await this.cdp.send('Network.setCookies', { cookies });
        await this.cdp.send('Page.reload', { ignoreCache: false });
        return { imported: cookies.length };
    }
}

/** 由宿主调用的单例包装：惰性创建、串行启停。 */
export class AiStudioBrowserService {
    constructor(options) {
        this.options = options;
        this.browser = null;
        this.queue = Promise.resolve();
    }

    current() {
        return this.browser;
    }

    serialize(task) {
        const next = this.queue.then(task, task);
        this.queue = next.catch(() => undefined);
        return next;
    }

    ensure() {
        this.browser ??= new AiStudioBrowser(this.options);
        return this.browser;
    }

    status() {
        return this.browser === null ? { state: 'stopped', headless: true } : this.browser.status();
    }

    start() { return this.serialize(async () => this.ensure().start()); }
    stop() { return this.serialize(async () => this.browser === null ? { state: 'stopped' } : this.browser.stop()); }
    login() { return this.serialize(async () => this.ensure().openLogin()); }
    exportCookies() { return this.serialize(async () => {
        if (this.browser === null) throw new Error('浏览器没有运行。');
        return { cookies: await this.browser.exportCookies() };
    }); }
    importCookies(cookies) { return this.serialize(async () => {
        if (this.browser === null) throw new Error('浏览器没有运行。');
        return this.browser.importCookies(cookies);
    }); }
}
