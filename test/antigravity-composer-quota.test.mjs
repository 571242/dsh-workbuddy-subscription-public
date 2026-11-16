import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bundle = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
function region(name) {
    const marker = `//#region src/client/${name}`;
    const start = bundle.indexOf(marker);
    assert.notEqual(start, -1, `missing bundle region: ${marker}`);
    const end = bundle.indexOf('//#endregion', start);
    assert.notEqual(end, -1, `missing bundle region end: ${marker}`);
    return bundle.slice(start, end);
}
const source = [
    'common/line-api.ts',
    'common/ComposerQuotaBadge.tsx',
    'antigravity/AntigravityComposerQuota.tsx',
].map(region).join('\n');
const quota = remainingFraction => ({
    groups: [{ displayName: 'Gemini', buckets: [{ displayName: '5 hour', remainingFraction }] }],
});
const status = (remainingFraction, quotaError = null) => ({ authenticated: true, quota: quota(remainingFraction), quotaError });
const success = value => ({ body: { ok: true, value } });
const flush = () => new Promise(resolve => setImmediate(resolve));

function mockApi(responses) {
    const calls = [];
    const pending = [...responses];
    return {
        calls,
        pending,
        async fetch(url, init = {}) {
            calls.push([init.method ?? 'GET', url]);
            assert.ok(pending.length, `unexpected request: ${url}`);
            const { status: code = 200, body } = pending.shift();
            return { ok: code >= 200 && code < 300, status: code, text: async () => JSON.stringify(body) };
        },
    };
}

function mount(fetch) {
    const slots = [];
    const effects = [];
    let index = 0;
    let rendered = false;
    const react = {
        useState(initial) {
            const position = index++;
            if (!(position in slots)) slots[position] = initial;
            return [slots[position], value => { slots[position] = typeof value === 'function' ? value(slots[position]) : value; }];
        },
        useRef(initial) {
            const position = index++;
            return slots[position] ??= { current: initial };
        },
        useMemo: compute => compute(),
        useCallback: callback => callback,
        useEffect(effect) { if (!rendered) effects.push(effect); },
    };
    const context = vm.createContext({
        react,
        react_jsx_runtime: { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
        useStore: () => ({ current: { provider: 'antigravity', model: 'gemini-test' } }),
        window: { setInterval: () => 1, clearInterval() {} },
        document: { visibilityState: 'visible' },
        fetch,
    });
    vm.runInContext(`${source}\nglobalThis.Component = AntigravityComposerQuota;`, context);
    const props = { directory: {}, loadModelDirectory() {}, t: () => 'Antigravity' };
    function render() {
        index = 0;
        const element = context.Component(props);
        return element.type(element.props);
    }
    assert.equal(render(), null);
    rendered = true;
    const cleanups = effects.map(effect => effect());
    return { render, unmount: () => cleanups.forEach(cleanup => cleanup?.()) };
}

function assertBadge(badge, text, level, title) {
    assert.equal(badge.type, 'span');
    assert.equal(badge.props['data-level'], level);
    assert.equal(badge.props.title, title);
    assert.equal(badge.props['aria-label'], title);
    assert.equal(badge.props.children[0].props.children, 'Antigravity');
    assert.equal(badge.props.children[1].props.children, text);
}

const statusUrl = '/wb/antigravity/api/status';
const quotaUrl = '/wb/antigravity/api/quota';

test('status quotaError overrides cached quota in the composer badge', async () => {
    const api = mockApi([success(status(0.8, '额度读取失败：测试错误'))]);
    const widget = mount(api.fetch);
    await flush();
    assertBadge(widget.render(), '—', 'warning', '[Antigravity] 额度读取失败：测试错误');
    assert.deepEqual(api.calls, [['GET', statusUrl]]);
    assert.equal(api.pending.length, 0);
    widget.unmount();
});

test('failed manual quota POST reloads status error and a later successful refresh recovers', async () => {
    const api = mockApi([
        success(status(0.8)),
        { status: 503, body: { ok: false, error: 'POST failed' } },
        success(status(0.8, 'status reports quota failure')),
        success({ authenticated: true, quota: quota(0.65) }),
    ]);
    const widget = mount(api.fetch);
    await flush();
    assertBadge(widget.render(), '80%', 'normal', '[Antigravity] Gemini - 5 hour: 剩余 80%，点击刷新');

    widget.render().props.onClick();
    assert.equal(widget.render().props.children[1].props.children, '…');
    await flush();
    const failed = widget.render();
    assertBadge(failed, '—', 'warning', '[Antigravity] status reports quota failure');
    assert.deepEqual(api.calls, [['GET', statusUrl], ['POST', quotaUrl], ['GET', statusUrl]]);

    failed.props.onClick();
    await flush();
    assertBadge(widget.render(), '65%', 'normal', '[Antigravity] Gemini - 5 hour: 剩余 65%，点击刷新');
    assert.deepEqual(api.calls, [['GET', statusUrl], ['POST', quotaUrl], ['GET', statusUrl], ['POST', quotaUrl]]);
    assert.equal(api.pending.length, 0);
    widget.unmount();
});
