import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bundle = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
const source = bundle.slice(
    bundle.indexOf('//#region src/client/quota.ts'),
    bundle.indexOf('//#region src/client/CodexImageToolView.tsx'),
);
const quota = usedPercent => ({ buckets: [{ id: 'codex', name: 'Codex', windows: [{ usedPercent, windowDurationMins: 300 }] }] });
const flush = () => new Promise(resolve => setImmediate(resolve));

function mount(api) {
    const slots = [];
    const effects = [];
    let index = 0;
    let rendered = false;
    let timer;
    let cleared = false;
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
        useStore: () => ({ current: { provider: 'codex-chatgpt', model: 'gpt-6.1-sol' } }),
        CODEX_CHATGPT_PROVIDER_ID: 'codex-chatgpt',
        window: { setInterval: callback => { timer = callback; return 1; }, clearInterval: () => { cleared = true; } },
        document: { visibilityState: 'visible' },
        Intl, Error,
    });
    vm.runInContext(`${source}\nglobalThis.Component = CodexComposerQuota;`, context);
    const props = { api, directory: {}, loadModelDirectory() {}, t: key => key };
    function render() {
        index = 0;
        const element = context.Component(props);
        rendered = true;
        return element;
    }
    render();
    const cleanups = effects.map(effect => effect());
    return { render, poll: () => timer(), unmount: () => cleanups.forEach(cleanup => cleanup?.()), wasCleared: () => cleared };
}

test('composer quota is an accessible refresh button and deduplicates rapid clicks', async () => {
    let requests = 0;
    let resolve;
    const widget = mount({
        status: async () => ({ preferences: { quickQuotaVisible: true }, quota: quota(20) }),
        refreshQuota() { requests++; return new Promise(done => { resolve = done; }); },
    });
    await flush();
    const button = widget.render();
    assert.equal(button.type, 'button');
    assert.equal(button.props.type, 'button');
    assert.equal(button.props.children[1].props.children, '80%');
    button.props.onClick();
    button.props.onClick();
    assert.equal(requests, 1);
    const pending = widget.render();
    assert.equal(pending.props.disabled, true);
    assert.equal(pending.props['aria-busy'], true);
    assert.equal(pending.props.children[1].props.children, 'quickQuotaRefreshing');
    resolve(quota(35));
    await flush();
    const updated = widget.render();
    assert.equal(updated.props.disabled, false);
    assert.equal(updated.props.children[1].props.children, '65%');
    widget.unmount();
    assert.equal(widget.wasCleared(), true);
});

test('failed manual or periodic refresh keeps the last successful quota and permits retry', async () => {
    let fail = true;
    const widget = mount({
        status: async () => {
            if (!fail) throw new Error('status unavailable');
            return { preferences: { quickQuotaVisible: true }, quota: quota(10) };
        },
        refreshQuota: async () => {
            if (fail) throw new Error('upstream unavailable');
            return quota(40);
        },
    });
    await flush();
    widget.render().props.onClick();
    await flush();
    const failed = widget.render();
    assert.equal(failed.props.children[1].props.children, '90%');
    assert.equal(failed.props.title, 'upstream unavailable');
    assert.equal(failed.props.disabled, false);
    fail = false;
    failed.props.onClick();
    await flush();
    assert.equal(widget.render().props.children[1].props.children, '60%');
    widget.poll();
    await flush();
    assert.equal(widget.render().props.children[1].props.children, '60%');
    widget.unmount();
});
