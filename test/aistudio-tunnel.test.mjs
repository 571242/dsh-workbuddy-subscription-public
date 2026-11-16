/**
 * WebSocket 隧道的端到端自检：起一个真宿主、真握手、真字节流。
 *
 * 不引第三方 ws 依赖，用 Node 24 自带的全局 WebSocket 当客户端，
 * 刚好覆盖了「页面里的浏览器」这一侧真实会走的路径。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { AiStudioTunnel, FrameDecoder, createByteQueue, encodeFrame, tokenMatches, createTunnelToken } from '../lib/aistudio-tunnel.js';

/** 最小 webServer 桩：只实现 registerUpgrade。 */
function stubContext() {
    let handler = null;
    const server = createServer((_, response) => response.end('ok'));
    const ctx = {
        logger: { info() {}, warn() {} },
        webServer: {
            registerUpgrade({ path, handler: fn }) {
                handler = fn;
                server.on('upgrade', (request, socket, head) => {
                    if (new URL(request.url, 'http://x').pathname === path) fn(request, socket, head);
                    else socket.destroy();
                });
                return () => { handler = null; };
            },
        },
    };
    return { ctx, server, handler: () => handler };
}

test('帧编解码：服务端帧不带掩码，长度分档正确', () => {
    const small = encodeFrame(0x1, Buffer.from('hi'));
    assert.equal(small.length, 4);
    assert.equal(small[1], 2);
    const medium = encodeFrame(0x1, Buffer.alloc(300));
    assert.equal(medium[1], 126);
    assert.equal(medium.readUInt16BE(2), 300);
    const large = encodeFrame(0x1, Buffer.alloc(70000));
    assert.equal(large[1], 127);
    assert.equal(Number(large.readBigUInt64BE(2)), 70000);
});

test('FrameDecoder：解析客户端掩码帧与分片', () => {
    const messages = [];
    const decoder = new FrameDecoder({ onText: text => messages.push(text) });
    const payload = Buffer.from('hello tunnel');
    const mask = Buffer.from([1, 2, 3, 4]);
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i & 3];
    const frame = Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
    // 按 3 字节切片喂入，验证跨包重组。
    for (let i = 0; i < frame.length; i += 3) decoder.push(frame.subarray(i, i + 3));
    assert.deepEqual(messages, ['hello tunnel']);
});

test('字节队列：异步消费与结束', async () => {
    const queue = createByteQueue();
    queue.push(Buffer.from('a'));
    queue.push(Buffer.from('b'));
    queue.end();
    const parts = [];
    for await (const chunk of queue) parts.push(Buffer.from(chunk).toString());
    assert.equal(parts.join(''), 'ab');
});

test('tokenMatches：长度不同或为空一律拒绝', () => {
    const token = createTunnelToken();
    assert.equal(tokenMatches(token, token), true);
    assert.equal(tokenMatches(token, `${token}x`), false);
    assert.equal(tokenMatches('', ''), false);
});

test('隧道端到端：握手 → 请求 → 分片回流', async () => {
    const { ctx, server } = stubContext();
    const token = createTunnelToken();
    const tunnel = new AiStudioTunnel(ctx, { getToken: () => token });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;

    const client = new WebSocket(`ws://127.0.0.1:${port}${tunnel.path}?token=${encodeURIComponent(token)}`, {
        headers: { origin: 'https://aistudio.google.com' },
    });
    await once(client, 'open');
    client.send(JSON.stringify({ type: 'hello', payload: { name: 'test-agent', href: 'https://aistudio.google.com/' } }));

    // 浏览器侧：收到请求就回三段流。
    client.addEventListener('message', event => {
        const frame = JSON.parse(event.data);
        if (frame.type !== 'http_request') return;
        client.send(JSON.stringify({ type: 'stream_start', id: frame.id, payload: { status: 200, headers: { 'content-type': 'text/event-stream' } } }));
        client.send(JSON.stringify({ type: 'stream_chunk', id: frame.id, payload: { data: Buffer.from('data: one\n\n').toString('base64') } }));
        client.send(JSON.stringify({ type: 'stream_chunk', id: frame.id, payload: { data: Buffer.from('data: two\n\n').toString('base64') } }));
        client.send(JSON.stringify({ type: 'stream_end', id: frame.id }));
    });

    // 等 hello 落到会话上。
    for (let i = 0; i < 50 && tunnel.status().connections === 0; i += 1) await new Promise(r => setTimeout(r, 20));
    assert.equal(tunnel.status().connected, true);

    const response = await tunnel.request({ method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/x:streamGenerateContent?alt=sse', headers: {}, body: '{}' });
    assert.equal(response.status, 200);
    const chunks = [];
    for await (const chunk of response.body) chunks.push(Buffer.from(chunk).toString());
    assert.equal(chunks.join(''), 'data: one\n\ndata: two\n\n');

    client.close();
    tunnel.dispose();
    server.close();
});

test('隧道离线：没有浏览器时抛 TUNNEL_OFFLINE', async () => {
    const { ctx, server } = stubContext();
    const tunnel = new AiStudioTunnel(ctx, { getToken: () => 'x' });
    await assert.rejects(
        () => tunnel.request({ method: 'POST', url: 'https://example.com', headers: {}, body: '{}' }),
        error => error.code === 'TUNNEL_OFFLINE',
    );
    tunnel.dispose();
    server.close();
});

test('错误令牌：握手被拒', async () => {
    const { ctx, server } = stubContext();
    const tunnel = new AiStudioTunnel(ctx, { getToken: () => 'right-token' });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    const client = new WebSocket(`ws://127.0.0.1:${port}${tunnel.path}?token=wrong`, { headers: { origin: 'https://aistudio.google.com' } });
    const outcome = await new Promise(resolve => {
        client.addEventListener('error', () => resolve('error'), { once: true });
        client.addEventListener('open', () => resolve('open'), { once: true });
    });
    assert.equal(outcome, 'error');
    tunnel.dispose();
    server.close();
});
