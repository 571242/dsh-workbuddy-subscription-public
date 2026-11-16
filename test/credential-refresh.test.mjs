import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { startCredentialRefresh } from '../lib/credential-refresh.js';
const bundle = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8');
function section(start) {
  const at = bundle.indexOf(start);
  assert(at >= 0, start);
  return bundle.slice(at, bundle.indexOf('\n//#endregion', at));
}
test('idle refresh starts immediately, skips valid/rejected rows and survives failures', async () => {
  let callback, cleared = false, syncs = 0;
  const calls = [], warnings = [];
  const core = {
    read: async () => ({ accounts: [{id:'fresh'}, {id:'expired'}, {id:'rejected'}] }),
    isCredentialUsable: a => a.id !== 'rejected',
    shouldRefreshCredential: a => a.id !== 'fresh',
    getFreshCredential: async id => { calls.push(id); if(calls.length === 1) throw Error('transient'); },
  };
  const worker = startCredentialRefresh([{id:'test', core, sync:async()=>{syncs++;}}], {
    logger:{warn:v=>warnings.push(v)},
    setIntervalFn: fn => {callback=fn; return {unref(){}};}, clearIntervalFn:()=>{cleared=true;},
  });
  await worker.ready;
  await callback();
  assert.deepEqual(calls, ['expired','expired']);
  assert.equal(syncs, 2);
  assert.equal(warnings.length, 1);
  worker.dispose();
  await worker.tick();
  assert(cleared);
  assert.equal(syncs, 2);
});
test('overlapping timer ticks share a single operation', async () => {
  let release, reads=0;
  const wait = new Promise(r=>{release=r;});
  const worker=startCredentialRefresh([{id:'test',core:{read:async()=>{reads++;await wait;return {accounts:[]};}}}],{
    setIntervalFn:()=>({unref(){}}),clearIntervalFn(){},
  });
  const a=worker.tick(), b=worker.tick();
  assert.equal(a,b);
  release(); await worker.ready;
  assert.equal(reads,1); worker.dispose();
});
function storeRuntime() {
  const ctx=vm.createContext({Map,Date,fetch,structuredClone,
    isExpired:c=>c.expiresAt <= Date.now()+60000,
    workBuddyAccountId:c=>c.uid,
  });
  vm.runInContext(section('var FileCredentialStore$4 = class'),ctx);
  return vm.runInContext('FileCredentialStore$4',ctx);
}
test('WorkBuddy adopts advanced local generation before refreshing stale snapshot', async () => {
  const Store=storeRuntime();
  const current={uid:'one',accessToken:'new',refreshToken:'rotated',expiresAt:Date.now()+3600000,source:'managed'};
  const store=new Store('unused',0,{list:async()=>[current]});
  store.list=async()=>[current];
  const actual=await store.ensureFresh({...current,accessToken:'old',expiresAt:1},()=>{throw Error('old refresh token used');},true);
  assert.equal(actual.accessToken,'new');
});
test('WorkBuddy concurrent forced and normal refresh share lock and persist managed token', async () => {
  const Store=storeRuntime();let writes=0,calls=0,release;
  const old={uid:'one',accessToken:'old',expiresAt:1,source:'managed'};
  const store=new Store('unused',0,{update:async()=>{writes++;}});store.list=async()=>[old];
  const wait=new Promise(r=>{release=r;});
  const refresh=async c=>{calls++;await wait;return {...c,accessToken:'new',expiresAt:Date.now()+3600000};};
  const a=store.ensureFresh(old,refresh),b=store.ensureFresh(old,refresh,true);
  release();const results=await Promise.all([a,b]);
  assert.equal(calls,1);assert.equal(writes,1);assert.equal(results[1].accessToken,'new');
});
test('WorkBuddy pool imports managed accounts and mirrors committed credentials', async () => {
  class Core {
    constructor(hooks){this.hooks=hooks;this.data={accounts:[]};}
    async updatePool(fn){return fn(this.data);}
    addAccountToPool(data,credentials){data.accounts.push({id:credentials.uid,credentials});}
    async listAccounts(){return this.data.accounts;}
  }
  const ctx=vm.createContext({AccountPoolCore:Core,Map,Set,Date,fetch,
    PROVIDER_ID$3:'workbuddy',PROVIDER_NAME$3:'WorkBuddy',workBuddyPoolPath:()=>'/test',parseWorkBuddyPoolData:x=>x,
    workBuddyAccountId:c=>c.uid,defaultAliasFor$2:()=>'',isExpired:c=>c.expiresAt< Date.now(),
    withResolvedIdentity:x=>x,workBuddyAccountIdAliases:c=>[c.uid],isMarkedFailed:()=>false,
  });
  vm.runInContext(section('var WorkBuddyAccountPool = class'),ctx);
  const Pool=vm.runInContext('WorkBuddyAccountPool',ctx);
  const fresh={uid:'one',source:'managed',accessToken:'new',expiresAt:Date.now()+3600000};let saved;
  const pool=new Pool({store:{list:async()=>[fresh],addManaged:async c=>{saved=c;}}});
  await pool.syncDesktopAccounts();
  assert.equal(pool.data.accounts.length,1);assert.equal(pool.data.accounts[0].credentials.source,'managed');
  await pool.hooks.credentialsCommitted({credentials:fresh});assert.equal(saved,fresh);
  const live=await pool.hooks.liveCredentialsFor({id:'one',credentials:{accessToken:'old',expiresAt:1}});
  assert(live.advanced);
});
test('Antigravity settings refresh uses the same account pool as model requests', () => {
  // Quota requests must remember the selected account so a later 401 renews
  // that same account, even if the active account changes in the meantime.
  assert(bundle.includes('accountPool.core.getFreshCredential(selected?.id, fetchFn)'));
  assert(bundle.includes('fetchAccountQuota(store, modelSettings, fetchFn, true, accountPool)'));
  assert(bundle.includes('fetchAccountQuota(store, modelSettings, fetchFn, false, accountPool)'));
  assert(bundle.includes('credentialRefresh.dispose()'));
});
