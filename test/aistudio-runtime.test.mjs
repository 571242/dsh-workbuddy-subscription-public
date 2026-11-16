/**
 * 运行时冒烟：在真实 ESM 环境里加载 aistudio-integration 并驱动每条路由。
 *
 * 宿主依赖 @deepseek-ai/dsh-llm 在本地不存在，所以在 .scratch 里建一个最小桩包，
 * 通过 node --import 的 resolve hook 映射过去。这样能真正执行模块体，
 * 抓出"语法通过但运行时 ReferenceError"的问题（例如漏导入常量）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const stubDir = join(root, '..', '.scratch', 'stub-llm');
const stubFile = join(stubDir, 'index.mjs');

function ensureStub() {
  if (!existsSync(stubDir)) mkdirSync(stubDir, { recursive: true });
  writeFileSync(stubFile, `
export class LlmError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
export const attributionHeaders = () => ({});
export class LlmAdapter {}
export const createUserMessage = (x) => x;
export const ProviderRequestId = {};
export const ReasoningEffortId = {};
export const HarnessError = Error;
export const errorChain = () => [];
export const resolveRetryPolicy = () => undefined;
export const CONTEXT_WINDOW_EXCEEDED_CODE = 'CONTEXT_WINDOW_EXCEEDED';
export const EMPTY_RESPONSE_CODE = 'EMPTY_RESPONSE';
export const QUOTA_EXCEEDED_CODE = 'QUOTA_EXCEEDED';
`, 'utf8');
}

let hooksInstalled = false;
function installResolveHook() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@deepseek-ai/dsh-llm') {
        return { url: pathToFileURL(stubFile).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}

const memoryStore = () => {
  let value = null;
  return {
    async load() { return value; },
    async save(next) { value = structuredClone(next); },
    async clear() { value = null; },
    peek() { return value; },
  };
};

function makeCtx() {
  const routes = new Map();
  return {
    logger: { info() {}, warn() {}, error() {} },
    emit() {},
    webServer: {
      port: 12345,
      register({ path, handler }) { routes.set(path, handler); return () => routes.delete(path); },
    },
    routes,
  };
}

test('module loads and every route answers without ReferenceError', async () => {
  ensureStub();
  installResolveHook();

  const mod = await import(pathToFileURL(join(root, '..', 'lib', 'aistudio-integration.js')).href);
  assert.equal(typeof mod.registerWorkBuddyAiStudio, 'function');

  const ctx = makeCtx();
  const store = memoryStore();
  const claim = { serving: () => true, conflict: () => null, dispose() {} };
  const service = mod.registerWorkBuddyAiStudio(ctx, {
    store,
    fetchFn: async () => new Response('{}', { status: 200 }),
    claimProviderRoute: () => claim,
    isSameOriginMutation: () => true,
    readRequestJson: async (req) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString('utf8');
      return raw === '' ? {} : JSON.parse(raw);
    },
  });
  await service.ready;

  // status 在完全没有账号时也不能抛（这正是上次 DEFAULT_BASE_URL 崩掉的那条路径）
  const st = service.status();
  assert.equal(st.configured, false);
  assert.equal(st.baseUrl, 'https://generativelanguage.googleapis.com');
  assert.deepEqual(st.accounts, []);
  assert.equal(typeof service.dispose, 'function');

  // 加一个 Key（纯离线，不发请求）
  const key = 'AIza000000000000000000000000000007496461';
  const afterAdd = await service.addKeys({ text: `我的主号=${key}` });
  assert.equal(afterAdd.accounts.length, 1);
  assert.equal(afterAdd.configured, true);
  assert.ok(!JSON.stringify(afterAdd).includes(key), '状态里不得出现明文 Key');
  assert.ok(afterAdd.accounts[0].maskedKey.includes('…'));

  // 账号动作
  const afterStrategy = await service.accountAction({ action: 'strategy', strategy: 'round-robin' });
  assert.equal(afterStrategy.rotationStrategy, 'round-robin');
  const afterCooldown = await service.accountAction({ action: 'clear-cooldown', accountId: afterAdd.accounts[0].id });
  assert.equal(afterCooldown.accounts.length, 1);

  // 设置
  const afterSettings = await service.updateSettings({ baseUrl: 'https://gw.example.com', defaultReasoningEffort: 'low' });
  assert.equal(afterSettings.baseUrl, 'https://gw.example.com');
  assert.equal(afterSettings.defaultReasoningEffort, 'low');

  // 模型勾选
  const afterModels = await service.updateModels({ enabledModelIds: ['gemini-2.5-pro'] });
  assert.deepEqual(afterModels.enabledModelIds, ['gemini-2.5-pro']);

  // 隧道：默认关闭；打开后自动生成令牌，但不含在 status 里
  assert.equal(st.tunnel.enabled, false);
  assert.equal(typeof st.tunnel.available, 'boolean');
  const tunnelOn = await service.tunnelAction({ enabled: true });
  assert.equal(tunnelOn.tunnel.enabled, true);
  const secret = service.tunnelSecret();
  assert.ok(secret.token.length >= 20, '打开隧道必须生成令牌');
  assert.ok(secret.url.includes('/wb/aistudio/ws?token='));
  assert.ok(!JSON.stringify(tunnelOn).includes(secret.token), 'status 不得泄露隧道令牌');
  const rotated = service.tunnelSecret().token;
  await service.tunnelAction({ rotateToken: true });
  assert.notEqual(service.tunnelSecret().token, rotated, '重置令牌必须换新');
  const tunnelOff = await service.tunnelAction({ enabled: false });
  assert.equal(tunnelOff.tunnel.enabled, false);

  // 删除
  const afterDelete = await service.accountAction({ action: 'delete', accountId: afterAdd.accounts[0].id });
  assert.equal(afterDelete.accounts.length, 0);

  service.dispose();
  console.log('OK: all aistudio service routes executed');
});
