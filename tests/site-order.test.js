const test = require('node:test');
const assert = require('node:assert/strict');

const {
  reorderSitesByDomains
} = require('../chrome-extension/site-order.js');

test('reorders sites by dragged UI domain order', () => {
  const sites = [
    { domain: 'a.example.com', enabled: true },
    { domain: 'b.example.com', enabled: true },
    { domain: 'c.example.com', enabled: false }
  ];

  const ordered = reorderSitesByDomains(sites, [
    'c.example.com',
    'a.example.com'
  ]);

  assert.deepEqual(ordered.map(site => site.domain), [
    'c.example.com',
    'a.example.com',
    'b.example.com'
  ]);
  assert.equal(ordered[0], sites[2]);
  assert.equal(ordered[1], sites[0]);
  assert.equal(ordered[2], sites[1]);
});

test('ignores missing and duplicate dragged domains when reordering sites', () => {
  const sites = [
    { domain: 'a.example.com', enabled: true },
    { domain: 'b.example.com', enabled: true },
    { domain: 'c.example.com', enabled: true }
  ];

  const ordered = reorderSitesByDomains(sites, [
    'missing.example.com',
    'B.EXAMPLE.COM',
    'b.example.com',
    '',
    'a.example.com'
  ]);

  assert.deepEqual(ordered.map(site => site.domain), [
    'b.example.com',
    'a.example.com',
    'c.example.com'
  ]);
});
