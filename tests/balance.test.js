const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractBalanceFromCheckInResult,
  extractBalanceFromData,
  extractSub2ApiBalanceFromTexts,
  extractBalanceFromText,
  formatBalanceValue
} = require('../chrome-extension/balance.js');

test('formats numeric balances for display', () => {
  assert.equal(formatBalanceValue(12), '12');
  assert.equal(formatBalanceValue(12.345), '12.35');
  assert.equal(formatBalanceValue('¥8.00'), '¥8.00');
});

test('formats New API quota values as account balance', () => {
  assert.equal(formatBalanceValue(500000, 'quota'), '$1.00');
});

test('extracts balance from common response fields', () => {
  assert.equal(extractBalanceFromData({ data: { balance: 3.5 } }), '3.50');
  assert.equal(extractBalanceFromData({ data: { user: { quota: 1250000 } } }), '$2.50');
  assert.equal(extractBalanceFromData({ ok: true, reward: 0.5 }), null);
});

test('extracts balance from page text only when a balance label exists', () => {
  assert.equal(extractBalanceFromText('账户余额 $9.88\n今日签到成功'), '$9.88');
  assert.equal(extractBalanceFromText('签到成功，获得 $0.50'), null);
});

test('uses fallback page balance when check-in response has no balance', () => {
  assert.equal(extractBalanceFromCheckInResult({
    data: { success: true, message: 'ok' },
    balance: '$6.66'
  }), '$6.66');
});

test('extracts Sub2API balance from page value candidates', () => {
  assert.equal(extractSub2ApiBalanceFromTexts([
    '每日签到',
    '$8.88',
    'Token 1000'
  ]), '$8.88');
  assert.equal(extractSub2ApiBalanceFromTexts([
    '',
    '余额：12.50'
  ]), '12.50');
});
