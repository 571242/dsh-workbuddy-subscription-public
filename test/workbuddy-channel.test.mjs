import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { fetchWithWorkBuddyChannelRecovery, moveWorkBuddySystemToUser } from '../lib/workbuddy-channel.js';

const request = {
  model: 'deepseek-v4.1-flash', stream: true, max_tokens: 32,
  messages: [
    {role:'system',content:'Original system instructions.'},
    {role:'developer',content:'Developer instructions.'},
    {role:'user',content:'Hello',name:'user'},
    {role:'assistant',content:'',tool_calls:[{id:'call-1',type:'function',function:{name:'test',arguments:'{}'}}]},
    {role:'tool',tool_call_id:'call-1',content:'Tool result'},
    {role:'user',content:'Continue'}
  ],
  tools: [{type:'function',function:{name:'test',parameters:{type:'object'}}}]
};
const refusal = () => new Response(JSON.stringify({code:11128,msg:'Illegal API invocation from an unapproved channel'}), {status:400});

test('moves system text without losing tools, history or wire options', () => {
  const before = JSON.stringify(request);
  const moved = JSON.parse(moveWorkBuddySystemToUser(before));
  assert.equal(JSON.stringify(request), before);
  assert.deepEqual(moved.messages[0],{role:'system',content:'You are a helpful assistant.'});
  assert.equal(moved.messages[1].content,'Original system instructions.\n\nDeveloper instructions.\n\nHello');
  assert.equal(moved.messages[1].name,'user');
  assert.deepEqual(moved.messages.slice(2),request.messages.slice(3));
  assert.deepEqual(moved.tools,request.tools);
  assert.equal(moved.model,request.model);
  assert.equal(moved.max_tokens,request.max_tokens);
});

test('unsafe or inapplicable transformations are skipped', () => {
  for (const body of ['invalid','null','{}',JSON.stringify({messages:[null]}),JSON.stringify({messages:[{role:'user',content:'hi'}]}),JSON.stringify({messages:[{role:'system',content:'s'},{role:'user',content:[{type:'text',text:'hi'}]}]})]) assert.equal(moveWorkBuddySystemToUser(body),null);
});

test('success and non-channel failures are never retried', async () => {
  for (const response of [new Response('data: [DONE]\n\n'),new Response('{"code":11102}',{status:400}),new Response('bad gateway',{status:502})]) {
    let calls=0;
    const result=await fetchWithWorkBuddyChannelRecovery(async()=>{calls++;return response;})('https://test.invalid',{body:JSON.stringify(request)});
    assert.equal(result,response);
    assert.equal(calls,1);
    if (!response.ok) assert.ok((await response.text()).length>0);
  }
});

test('11128 retries once with the same URL, authorization and signal',async()=>{
  const calls=[];
  const signal=new AbortController().signal;
  const headers={authorization:'Bearer test-only'};
  const result=await fetchWithWorkBuddyChannelRecovery(async(url,init)=>{calls.push({url,...init});return calls.length===1?refusal():new Response('data: [DONE]\n\n');})('https://test.invalid/v2/chat/completions',{method:'POST',headers,signal,body:JSON.stringify(request)});
  assert.ok(result.ok);
  assert.equal(calls.length,2);
  assert.equal(calls[1].headers,headers);
  assert.equal(calls[1].signal,signal);
  assert.equal(calls[1].url,calls[0].url);
  assert.notEqual(calls[1].body,calls[0].body);
});

test('persistent 11128 remains readable and cannot loop',async()=>{
  let calls=0;
  const result=await fetchWithWorkBuddyChannelRecovery(async()=>{calls++;return refusal();})('https://test.invalid',{body:JSON.stringify(request)});
  assert.equal(calls,2);
  assert.equal(result.status,400);
  assert.equal((await result.json()).code,11128);
});

test('aborted calls do not retry',async()=>{
  const controller=new AbortController();
  controller.abort();
  let calls=0;
  await assert.rejects(fetchWithWorkBuddyChannelRecovery(async()=>{calls++;return refusal();})('https://test.invalid',{body:JSON.stringify(request),signal:controller.signal}),{name:'AbortError'});
  assert.equal(calls,1);
});

test('channel refusals do not become credential failures even with HTTP 403',()=>{
  const bundle=fs.readFileSync(new URL('../lib/index.js',import.meta.url),'utf8');
  const start=bundle.indexOf('function classifyFailure$1(');
  const end=bundle.indexOf('\n/**',start);
  class LlmError extends Error{constructor(message,code){super(message);this.code=code;}}
  const context=vm.createContext({LlmError,PROVIDER_NAME$3:'WorkBuddy',readErrorCode:text=>JSON.parse(text).code});
  vm.runInContext(bundle.slice(start,end),context);
  for (const status of [400,401,403]) {
    const error=vm.runInContext(`classifyFailure$1(${status},'{"code":11128}')`,context);
    assert.equal(error.code,'PROVIDER_ERROR');
  }
  assert.ok(bundle.includes('if (readErrorCode(refusedDetail) === 11128 || renewed'));
});

test('chat and connection probe share recovery and never dump authorization',()=>{
  const bundle=fs.readFileSync(new URL('../lib/index.js',import.meta.url),'utf8');
  assert.ok(bundle.includes('fetchWithWorkBuddyChannelRecovery(fetchWithContextBudgetRecovery(fetchFn))'));
  assert.ok(bundle.includes('const probe = await fetchWithWorkBuddyChannelRecovery(fetchFn)'));
  assert.ok(!bundle.includes('wb-last-request.json'));
  assert.ok(!bundle.includes('wb-last-refusal.json'));
});
