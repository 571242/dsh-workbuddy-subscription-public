import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BASE_URL,
  maskApiKey,
  normalizeBaseUrl,
  parseAiStudioDocument,
  parseKeyEntries,
} from '../lib/aistudio-config.js';

test('parseKeyEntries splits lines, commas and aliases, and drops junk', () => {
  const entries = parseKeyEntries([
    'AIza00000000000000000000000000000183744',
    '主号=AIza00000000000000000000000000000860048',
    '  AIza00000000000000000000000000000884892 , 坏行 ,短',
  ].join('\n'));
  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], { apiKey: 'AIza00000000000000000000000000000183744', alias: '' });
  assert.equal(entries[1].alias, '主号');
  assert.equal(entries[2].apiKey, 'AIza00000000000000000000000000000884892');
  assert.ok(entries.every(entry => !/\s/u.test(entry.apiKey)));
});

test('parseKeyEntries never yields duplicate-free garbage for an empty input', () => {
  assert.deepEqual(parseKeyEntries(''), []);
  assert.deepEqual(parseKeyEntries('   \n , ; '), []);
});

test('normalizeBaseUrl defaults, trims slashes and rejects non-http schemes', () => {
  assert.equal(normalizeBaseUrl(''), DEFAULT_BASE_URL);
  assert.equal(normalizeBaseUrl('  '), DEFAULT_BASE_URL);
  assert.equal(normalizeBaseUrl('https://generativelanguage.googleapis.com/'), 'https://generativelanguage.googleapis.com');
  assert.equal(normalizeBaseUrl('https://gw.example.com/api/v1beta/'), 'https://gw.example.com/api/v1beta');
  assert.throws(() => normalizeBaseUrl('file:///etc/passwd'), /http\/https/u);
  assert.throws(() => normalizeBaseUrl('not a url'), /合法地址/u);
});

test('maskApiKey keeps short keys opaque and long keys recognisable', () => {
  assert.equal(maskApiKey('AIzaSyABCDEFGHIJKLMNOP'), 'AIza…MNOP');
  assert.ok(!maskApiKey('AIzaSyABCDEFGHIJKLMNOP').includes('SyABCDEFGH'));
  assert.equal(maskApiKey('short'), '*****');
  assert.equal(maskApiKey(undefined), '****');
});

test('parseAiStudioDocument drops duplicates, bad entries and invalid strategies', () => {
  const doc = parseAiStudioDocument({
    enabled: false,
    baseUrl: 'https://gw.example.com/',
    rotationStrategy: 'nonsense',
    defaultReasoningEffort: 'ultra',
    accounts: [
      { id: 'a', apiKey: 'AIza00000000000000000000000000000183744', alias: '一号' },
      { id: 'b', apiKey: 'AIza00000000000000000000000000000183744' },
      { id: 'c', apiKey: '' },
      { id: 'd', apiKey: 'AIza00000000000000000000000000000042960', cooldownUntil: 1234, failCount: 3 },
    ],
    catalog: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576, maxTokens: 65535 },
      { id: '', name: 'bad' },
    ],
    enabledModelIds: ['gemini-2.5-pro', 'gemini-2.5-pro', 7],
    contextWindowOverrides: { 'gemini-2.5-pro': 2097152, broken: -1 },
  });
  assert.equal(doc.enabled, false);
  assert.equal(doc.baseUrl, 'https://gw.example.com');
  assert.equal(doc.rotationStrategy, 'sequential');
  assert.equal(doc.defaultReasoningEffort, '');
  assert.equal(doc.accounts.length, 2);
  assert.equal(doc.primaryAccountId, 'a');
  assert.equal(doc.catalog.length, 1);
  assert.deepEqual(doc.enabledModelIds, ['gemini-2.5-pro']);
  assert.deepEqual(doc.contextWindowOverrides, { 'gemini-2.5-pro': 2097152 });
});

test('parseAiStudioDocument rejects non-objects and keeps an empty pool valid', () => {
  assert.equal(parseAiStudioDocument(null), null);
  assert.equal(parseAiStudioDocument('x'), null);
  const empty = parseAiStudioDocument({});
  assert.deepEqual(empty.accounts, []);
  assert.equal(empty.enabled, true);
  assert.equal(empty.baseUrl, DEFAULT_BASE_URL);
  assert.equal(empty.enabledModelIds, null);
});
