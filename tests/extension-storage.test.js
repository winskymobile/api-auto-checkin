const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMissingInstallStorageDefaults
} = require('../chrome-extension/extension-storage.js');

test('builds install defaults when record keys are missing', () => {
  assert.deepEqual(buildMissingInstallStorageDefaults({}), {
    lastCheckInTime: null,
    checkInResults: {}
  });
});

test('preserves existing check-in time and results during install events', () => {
  const existing = {
    lastCheckInTime: '2026-06-13T01:30:00.000Z',
    checkInResults: {
      example_com: { status: 'already', message: '今日已签到' }
    }
  };

  assert.deepEqual(buildMissingInstallStorageDefaults(existing), {});
});

test('fills only the missing install storage key', () => {
  assert.deepEqual(buildMissingInstallStorageDefaults({
    lastCheckInTime: '2026-06-13T01:30:00.000Z'
  }), {
    checkInResults: {}
  });
});
