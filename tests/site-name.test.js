const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeFetchedSiteName,
  pickSiteDisplayName,
  shouldAutoFetchSiteName
} = require('../chrome-extension/site-name.js');

test('fetches a site name when name is missing or still equals the domain', () => {
  assert.equal(shouldAutoFetchSiteName({ domain: 'example.com' }), true);
  assert.equal(shouldAutoFetchSiteName({ domain: 'example.com', name: '' }), true);
  assert.equal(shouldAutoFetchSiteName({ domain: 'example.com', name: 'example.com' }), true);
});

test('does not fetch a site name when a custom name is already set', () => {
  assert.equal(shouldAutoFetchSiteName({ domain: 'example.com', name: 'Example API' }), false);
});

test('normalizes fetched site names and ignores the domain itself', () => {
  assert.equal(normalizeFetchedSiteName('  Example   API  ', 'example.com'), 'Example API');
  assert.equal(normalizeFetchedSiteName('每日签到 - Example API', 'example.com'), 'Example API');
  assert.equal(normalizeFetchedSiteName('example.com', 'example.com'), null);
  assert.equal(normalizeFetchedSiteName('', 'example.com'), null);
});

test('prefers explicit site metadata over page titles', () => {
  assert.equal(pickSiteDisplayName({
    ogSiteName: 'Example API',
    applicationName: 'App Name',
    title: 'Profile - Example'
  }, 'example.com'), 'Example API');
});
