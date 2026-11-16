/**
 * Google AI Studio 的 WebSocket 隧道（宿主侧）。
 *
 * 请求不再由 Node 进程直接出网，而是打包成 `http_request` 帧交给浏览器页面里的
 * 伴随脚本执行 `fetch()`，状态、响应头、响应体分片沿同一条 WebSocket 回流。
 * 于是出网方是浏览器：带页面 Cookie、带浏览器 TLS/HTTP 栈、走浏览器所在网络的
 * 出口 IP（云端就是东京那台机器的无头 Chromium）。
 *
 * 帧协议（JSON 文本帧，字段与 CLIProxyAPI 的 wsrelay 同构，便于抓包对照）：
 *
 *   browser → host   hello          {name, version, href, ua}
 *   host → browser   http_request   {id, method, url, headers, body}
 *   browser → host   stream_start   {id, status, headers}
 *   browser → host   stream_chunk   {id, data(base64)}
 *   browser → host   stream_end     {id}
 *   browser → host   error          {id, error}
 *   host → browser   cancel_request {id}
 *   both             ping / pong
 *
 * RFC 6455 编解码是手写的：插件不能新增 `ws` 依赖，而 `ws` 也不在插件自己的
 * node_modules 里。只实现服务端需要的那部分（客户端帧必掩码、支持分片与控制帧）。
 *
 * @module dsh-workbuddy-subscription/aistudio-tunnel
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const AI_STUDIO_TUNNEL_PATH = '/wb/aistudio/ws';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
/** 单帧上限：Gemini 请求体远小于此，超过按异常连接处理。 */
const MAX_FRAME_BYTES = 64 * 1024 * 1024;
/** 单个请求在途分片的上限，防止浏览器卡死把宿主内存吃光。 */
const MAX_STREAM_BYTES = 64 * 1024 * 1024;
const HEARTBEAT_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
/** 浏览器接到 http_request 后必须先回 stream_start，否则认为它挂了。 */
const CONNECT_TIMEOUT_MS = 25_000;

const OP_CONTINUATION = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

/** 生成隧道令牌：存在加密文档里，只有宿主与伴随脚本知道。 */
export function createTunnelToken() {
    return randomBytes(24).toString('base64url');
}

/** 常量时间比较，别让人拿令牌去试探。 */
export function tokenMatches(expected, actual) {
    const a = Buffer.from(String(expected ?? ''), 'utf8');
    const b = Buffer.from(String(actual ?? ''), 'utf8');
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

/** 服务端 → 浏览器：不掩码。 */
export function encodeFrame(opcode, payload) {
    const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const length = body.length;
    let head;
    if (length < 126) {
        head = Buffer.alloc(2);
        head[1] = length;
    } else if (length < 65536) {
        head = Buffer.alloc(4);
        head[1] = 126;
        head.writeUInt16BE(length, 2);
    } else {
        head = Buffer.alloc(10);
        head[1] = 127;
        head.writeBigUInt64BE(BigInt(length), 2);
    }
    head[0] = 0x80 | opcode;
    return Buffer.concat([head, body]);
}

/** 增量帧解码器：`push()` 喂字节，完整消息经回调交出去。 */
export class FrameDecoder {
    constructor(handlers) {
        this.handlers = handlers;
        this.buffer = Buffer.alloc(0);
        this.fragments = [];
        this.fragmentOpcode = 0;
        this.closed = false;
    }

    fail(message) {
        if (this.closed) return;
        this.closed = true;
        this.handlers.onError?.(new Error(message));
    }

    push(chunk) {
        if (this.closed) return;
        this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
        for (;;) {
            if (this.buffer.length < 2) return;
            const first = this.buffer[0];
            const second = this.buffer[1];
            const fin = (first & 0x80) !== 0;
            const opcode = first & 0x0f;
            const masked = (second & 0x80) !== 0;
            let length = second & 0x7f;
            let offset = 2;
            if (length === 126) {
                if (this.buffer.length < 4) return;
                length = this.buffer.readUInt16BE(2);
                offset = 4;
            } else if (length === 127) {
                if (this.buffer.length < 10) return;
                const big = this.buffer.readBigUInt64BE(2);
                if (big > BigInt(MAX_FRAME_BYTES)) return this.fail(`帧过大：${big} 字节`);
                length = Number(big);
                offset = 10;
            }
            if (length > MAX_FRAME_BYTES) return this.fail(`帧过大：${length} 字节`);
            const maskOffset = offset;
            if (masked) offset += 4;
            if (this.buffer.length < offset + length) return;

            let payload = this.buffer.subarray(offset, offset + length);
            if (masked) {
                const mask = this.buffer.subarray(maskOffset, maskOffset + 4);
                const copy = Buffer.allocUnsafe(length);
                for (let i = 0; i < length; i += 1) copy[i] = payload[i] ^ mask[i & 3];
                payload = copy;
            } else {
                payload = Buffer.from(payload);
            }
            this.buffer = this.buffer.subarray(offset + length);

            if (opcode === OP_PING) { this.handlers.onPing?.(payload); continue; }
            if (opcode === OP_PONG) { this.handlers.onPong?.(payload); continue; }
            if (opcode === OP_CLOSE) {
                this.closed = true;
                this.handlers.onClose?.(payload);
                return;
            }
            if (opcode === OP_CONTINUATION) {
                if (this.fragmentOpcode === 0) return this.fail('收到没有起始帧的续帧');
                this.fragments.push(payload);
                if (fin) {
                    const whole = Buffer.concat(this.fragments);
                    const kind = this.fragmentOpcode;
                    this.fragments = [];
                    this.fragmentOpcode = 0;
                    this.deliver(kind, whole);
                }
                continue;
            }
            if (opcode !== OP_TEXT && opcode !== OP_BINARY) return this.fail(`未知 opcode ${opcode}`);
            if (!fin) {
                this.fragmentOpcode = opcode;
                this.fragments = [payload];
                continue;
            }
            this.deliver(opcode, payload);
        }
    }

    deliver(opcode, payload) {
        if (opcode === OP_BINARY) this.handlers.onBinary?.(payload);
        else this.handlers.onText?.(payload.toString('utf8'));
    }
}

/** 字节流队列 → 异步可迭代对象，`SseRecordReader` 可以直接消费。 */
export function createByteQueue() {
    const items = [];
    let bytes = 0;
    let wake = null;
    let ended = false;
    let failure = null;

    const pump = () => {
        if (wake === null) return;
        const resume = wake;
        if (items.length > 0) {
            wake = null;
            const value = items.shift();
            bytes -= value.length;
            resume.resolve({ value, done: false });
        } else if (failure !== null) {
            wake = null;
            const error = failure;
            failure = null;
            resume.reject(error);
        } else if (ended) {
            wake = null;
            resume.resolve({ value: undefined, done: true });
        }
    };

    const queue = {
        push(value) {
            if (ended) return;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            items.push(chunk);
            bytes += chunk.length;
            if (bytes > MAX_STREAM_BYTES) {
                failure = new Error('隧道响应体超过上限。');
                ended = true;
                items.length = 0;
                bytes = 0;
            }
            pump();
        },
        end() {
            if (ended) return;
            ended = true;
            pump();
        },
        fail(error) {
            if (ended) return;
            failure = error;
            ended = true;
            items.length = 0;
            bytes = 0;
            pump();
        },
        [Symbol.asyncIterator]() {
            return {
                next() {
                    if (items.length > 0) {
                        const value = items.shift();
                        bytes -= value.length;
                        return Promise.resolve({ value, done: false });
                    }
                    if (failure !== null) {
                        const error = failure;
                        failure = null;
                        return Promise.reject(error);
                    }
                    if (ended) return Promise.resolve({ value: undefined, done: true });
                    return new Promise((resolve, reject) => { wake = { resolve, reject }; });
                },
                return() {
                    ended = true;
                    items.length = 0;
                    bytes = 0;
                    pump();
                    return Promise.resolve({ value: undefined, done: true });
                },
            };
        },
    };
    return queue;
}

/** 一条已认证的浏览器连接。 */
class TunnelSession {
    constructor(socket) {
        this.socket = socket;
        this.id = randomBytes(6).toString('hex');
        this.openedAt = Date.now();
        this.lastSeen = Date.now();
        this.info = { name: 'browser', version: '', href: '', ua: '' };
        this.jobs = new Map();
        this.closed = false;
        this.decoder = new FrameDecoder({
            onText: text => this.onText(text),
            onPing: payload => this.write(OP_PONG, payload),
            onPong: () => { this.lastSeen = Date.now(); },
            onClose: () => this.close('客户端关闭'),
            onError: error => this.close(error.message),
        });
        socket.on('data', chunk => {
            this.lastSeen = Date.now();
            this.decoder.push(chunk);
        });
        socket.on('error', () => this.close('socket error'));
        socket.on('close', () => this.close('socket closed'));
        socket.setNoDelay?.(true);
        this.timer = setInterval(() => {
            if (Date.now() - this.lastSeen > HEARTBEAT_TIMEOUT_MS) return this.close('心跳超时');
            this.write(OP_PING, Buffer.from(String(Date.now())));
        }, HEARTBEAT_MS);
        this.timer.unref?.();
    }

    write(opcode, payload) {
        if (this.closed) return;
        try {
            this.socket.write(encodeFrame(opcode, payload));
        } catch {
            this.close('写入失败');
        }
    }

    send(type, payload, id) {
        const frame = { type, payload: payload ?? {} };
        if (id !== undefined) frame.id = id;
        this.write(OP_TEXT, Buffer.from(JSON.stringify(frame), 'utf8'));
    }

    onText(text) {
        let message;
        try { message = JSON.parse(text); } catch { return; }
        if (!message || typeof message !== 'object') return;
        const type = typeof message.type === 'string' ? message.type : '';
        const payload = message.payload && typeof message.payload === 'object' ? message.payload : {};
        if (type === 'hello') {
            this.info = {
                name: typeof payload.name === 'string' ? payload.name.slice(0, 80) : 'browser',
                version: typeof payload.version === 'string' ? payload.version.slice(0, 40) : '',
                href: typeof payload.href === 'string' ? payload.href.slice(0, 300) : '',
                ua: typeof payload.ua === 'string' ? payload.ua.slice(0, 300) : '',
            };
            this.onReady?.(this);
            return;
        }
        if (type === 'ping') return this.send('pong', { t: Date.now() });
        if (type === 'pong') { this.lastSeen = Date.now(); return; }
        const id = typeof message.id === 'string' ? message.id : '';
        const job = id === '' ? undefined : this.jobs.get(id);
        if (!job) return;
        if (type === 'stream_start') job.start(payload);
        else if (type === 'stream_chunk') { if (typeof payload.data === 'string') job.push(Buffer.from(payload.data, 'base64')); }
        else if (type === 'stream_end') job.end();
        else if (type === 'error') job.fail(new Error(typeof payload.error === 'string' ? payload.error : '浏览器执行请求失败'));
    }

    /**
     * 发一次隧道请求。
     * @returns {{id:string, started:Promise<{status:number,headers:object,body:any}>, cancel:Function, dispose:Function}}
     */
    request(spec, options = {}) {
        const id = randomBytes(9).toString('hex');
        const queue = createByteQueue();
        let resolveStart;
        let rejectStart;
        const started = new Promise((resolve, reject) => { resolveStart = resolve; rejectStart = reject; });
        let settled = false;
        const job = {
            start: payload => {
                settled = true;
                resolveStart({
                    status: Number.isFinite(payload?.status) ? payload.status : 0,
                    headers: payload?.headers && typeof payload.headers === 'object' ? payload.headers : {},
                    body: queue,
                });
            },
            push: chunk => queue.push(chunk),
            end: () => { queue.end(); this.jobs.delete(id); },
            fail: error => {
                queue.fail(error);
                if (!settled) { settled = true; rejectStart(error); }
                this.jobs.delete(id);
            },
        };
        this.jobs.set(id, job);
        this.send('http_request', spec, id);

        const signal = options.signal;
        const onAbort = () => {
            this.send('cancel_request', {}, id);
            job.fail(new Error('请求已取消'));
        };
        if (signal !== undefined) {
            if (signal.aborted === true) queueMicrotask(onAbort);
            else signal.addEventListener('abort', onAbort, { once: true });
        }
        return {
            id,
            started,
            cancel: () => { signal?.removeEventListener?.('abort', onAbort); onAbort(); },
            dispose: () => signal?.removeEventListener?.('abort', onAbort),
        };
    }

    close(reason) {
        if (this.closed) return;
        this.closed = true;
        clearInterval(this.timer);
        for (const job of [...this.jobs.values()]) job.fail(new Error(`隧道断开：${reason}`));
        this.jobs.clear();
        try { this.socket.destroy(); } catch { /* 已经没了 */ }
        this.onGone?.(this);
    }
}

/** 隧道服务：一条 upgrade 路由 + 会话表 + 同步调用入口。 */
export class AiStudioTunnel {
    constructor(ctx, options = {}) {
        this.ctx = ctx;
        this.path = options.path ?? AI_STUDIO_TUNNEL_PATH;
        this.sessions = new Set();
        this.disposed = false;
        this.logger = ctx.logger;
        this.getToken = options.getToken ?? (() => '');
        this.onChange = options.onChange ?? (() => {});
        this.handler = (request, socket, head) => this.handleUpgrade(request, socket, head);
        // 旧版宿主只有 register，没有 upgrade 通道；降级成「隧道不可用」，不能拖垮整个渠道。
        this.available = typeof ctx.webServer?.registerUpgrade === 'function';
        this.disposeRoute = () => {};
        if (this.available) {
            try {
                this.disposeRoute = ctx.webServer.registerUpgrade({ path: this.path, handler: this.handler }) ?? (() => {});
            } catch (cause) {
                // 路由已被别的插件实例占用：隧道停用，但渠道本身照常工作。
                this.available = false;
                this.logger?.warn?.(`[dsh-workbuddy] AI Studio 隧道路由注册失败（${cause instanceof Error ? cause.message : String(cause)}），隧道已停用。`);
            }
        } else {
            this.logger?.warn?.('[dsh-workbuddy] 当前宿主的 webServer 不支持 WebSocket upgrade，AI Studio 隧道已停用。');
        }
    }

    live() {
        const now = Date.now();
        return [...this.sessions].filter(session => !session.closed && now - session.lastSeen < HEARTBEAT_TIMEOUT_MS);
    }

    status() {
        const live = this.live();
        const best = live[live.length - 1];
        return {
            available: this.available,
            connected: live.length > 0,
            connections: live.length,
            path: this.path,
            client: best ? { ...best.info, connectedAt: best.openedAt } : null,
        };
    }

    handleUpgrade(request, socket, head) {
        if (this.disposed) return void socket.destroy();
        let url;
        try { url = new URL(request.url ?? '/', 'http://dsh.local'); } catch { return void socket.destroy(); }

        const token = url.searchParams.get('token') ?? request.headers['x-aistudio-token'] ?? '';
        if (!tokenMatches(this.getToken(), token)) {
            this.logger?.warn?.('[dsh-workbuddy] aistudio tunnel rejected: bad token');
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
            return void socket.destroy();
        }
        const key = request.headers['sec-websocket-key'];
        if (typeof key !== 'string' || key === '' || String(request.headers['sec-websocket-version'] ?? '') !== '13') {
            socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
            return void socket.destroy();
        }
        const origin = String(request.headers.origin ?? '');
        const allowed = origin === ''
            || /^https:\/\/([a-z0-9-]+\.)*aistudio\.google\.com$/i.test(origin)
            || /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origin);
        if (!allowed) {
            this.logger?.warn?.(`[dsh-workbuddy] aistudio tunnel rejected origin: ${origin}`);
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
            return void socket.destroy();
        }

        socket.write([
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${createHash('sha1').update(key + WS_GUID).digest('base64')}`,
            '', '',
        ].join('\r\n'));
        if (head !== undefined && head.length > 0) socket.unshift(head);

        const session = new TunnelSession(socket);
        session.onGone = gone => {
            this.sessions.delete(gone);
            this.onChange();
        };
        session.onReady = () => this.onChange();
        this.sessions.add(session);
        this.onChange();
        this.logger?.info?.(`[dsh-workbuddy] aistudio tunnel connected (${this.sessions.size} total)`);
    }

    /**
     * 走隧道发一次请求。没有浏览器在线时抛 `TUNNEL_OFFLINE`，调用方回落直连。
     */
    async request({ method = 'POST', url, headers = {}, body, signal }) {
        const live = this.live();
        if (live.length === 0) {
            const error = new Error('AI Studio 隧道没有可用的浏览器连接。');
            error.code = 'TUNNEL_OFFLINE';
            throw error;
        }
        const session = live[live.length - 1];
        const job = session.request({ method, url, headers, body: typeof body === 'string' ? body : undefined }, { signal });
        try {
            const started = await withTimeout(job.started, CONNECT_TIMEOUT_MS, '浏览器没有回应请求');
            return { status: started.status, headers: started.headers, body: started.body, dispose: job.dispose, cancel: job.cancel };
        } catch (error) {
            job.dispose();
            job.cancel();
            throw error;
        }
    }

    dispose() {
        this.disposed = true;
        for (const session of [...this.sessions]) session.close('插件卸载');
        this.sessions.clear();
        try { this.disposeRoute?.(); } catch { /* 幂等 */ }
    }
}

function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
        timer.unref?.();
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** 把 `fetch` 的 `Response` 包装成隧道同构的 `{status, headers, body}`。 */
export function responseToStream(response) {
    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: response.body === null ? createByteQueue() : response.body,
    };
}
