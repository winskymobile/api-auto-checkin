const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCheckInRunningState,
  clearCheckInRunningState,
  countEnabledSites,
  getCheckInRunState,
  isCheckInRunningState,
  canStartCheckIn,
  canClickCheckInButton,
  clearResultBalances,
  markSiteChecking,
  normalizeCheckInResultsForRun,
  isSameLocalDate,
  getIdleCheckInButtonText
} = require('../chrome-extension/checkin-run-state.js');

test('builds and recognizes persisted check-in running state', () => {
  const state = buildCheckInRunningState({ total: 3, source: 'manual' });

  assert.equal(isCheckInRunningState(state), true);
  assert.equal(state.running, true);
  assert.equal(state.total, 3);
  assert.equal(state.current, 0);
  assert.equal(state.source, 'manual');
  assert.equal(typeof state.startedAt, 'string');
});

test('marks the currently running site in stored results', () => {
  const results = markSiteChecking({
    a: { status: 'success', message: 'ok' }
  }, 'b');

  assert.deepEqual(results, {
    a: { status: 'success', message: 'ok' },
    b: { status: 'checking', message: '签到中' }
  });
});

test('clears transient checking results after a run finishes', () => {
  const results = normalizeCheckInResultsForRun({
    a: { status: 'checking', message: '签到中' },
    b: { status: 'invalid', message: '站点页面失效' }
  });

  assert.deepEqual(results, {
    a: { status: 'failed', message: '签到中断' },
    b: { status: 'invalid', message: '站点页面失效' }
  });
});

test('clears balances from previous run results', () => {
  assert.deepEqual(clearResultBalances({
    a: { status: 'success', message: 'ok', balance: '$1.00' },
    b: { status: 'failed', message: 'no' }
  }), {
    a: { status: 'success', message: 'ok' },
    b: { status: 'failed', message: 'no' }
  });
});

test('clears a persisted running state', () => {
  const cleared = clearCheckInRunningState(buildCheckInRunningState({ total: 1 }));

  assert.equal(getCheckInRunState({ checkInRunState: cleared }).running, false);
});

test('requires at least one enabled site before a check-in can start', () => {
  assert.equal(countEnabledSites([]), 0);
  assert.equal(countEnabledSites([
    { domain: 'a.example', enabled: false },
    { domain: 'b.example', enabled: false }
  ]), 0);
  assert.equal(countEnabledSites([
    { domain: 'a.example' },
    { domain: 'b.example', enabled: false }
  ]), 1);

  assert.equal(canStartCheckIn([], { running: false }), false);
  assert.equal(canStartCheckIn([{ domain: 'a.example', enabled: false }], { running: false }), false);
  assert.equal(canStartCheckIn([{ domain: 'a.example' }], { running: true }), false);
  assert.equal(canStartCheckIn([{ domain: 'a.example' }], { running: false }), true);
});

test('keeps the main check-in button clickable while a run is active', () => {
  assert.equal(canStartCheckIn([{ domain: 'a.example' }], { running: true }), false);
  assert.equal(canClickCheckInButton([], { running: false }), false);
  assert.equal(canClickCheckInButton([{ domain: 'a.example', enabled: false }], { running: false }), false);
  assert.equal(canClickCheckInButton([{ domain: 'a.example' }], { running: false }), true);
  assert.equal(canClickCheckInButton([{ domain: 'a.example' }], { running: true }), true);
});

test('uses immediate check-in button text when there is no history', () => {
  const now = new Date(2026, 5, 13, 10, 0, 0, 0);

  assert.equal(getIdleCheckInButtonText(null, now), '立即签到');
  assert.equal(getIdleCheckInButtonText('', now), '立即签到');
});

test('uses immediate check-in button text when last check-in is today', () => {
  const now = new Date(2026, 5, 13, 22, 30, 0, 0);
  const lastCheckInTime = new Date(2026, 5, 13, 8, 5, 0, 0).toISOString();

  assert.equal(isSameLocalDate(lastCheckInTime, now), true);
  assert.equal(getIdleCheckInButtonText(lastCheckInTime, now), '立即签到');
});

test('uses today-not-checked button text when last check-in is from a previous local day', () => {
  const now = new Date(2026, 5, 13, 0, 30, 0, 0);
  const lastCheckInTime = new Date(2026, 5, 12, 23, 59, 0, 0).toISOString();

  assert.equal(isSameLocalDate(lastCheckInTime, now), false);
  assert.equal(getIdleCheckInButtonText(lastCheckInTime, now), '今日未签，立即签到');
});
