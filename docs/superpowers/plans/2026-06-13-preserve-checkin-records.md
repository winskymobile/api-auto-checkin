# Preserve Check-in Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve stored check-in records across browser restarts while changing only the main popup button text when the latest run is from a previous day.

**Architecture:** Keep the existing `chrome.storage.local` data model. Add pure helpers for date-aware button text and install-time storage defaults, then wire those helpers into the popup and background service worker without changing the main check-in execution flow.

**Tech Stack:** Chrome Manifest V3 extension, plain JavaScript, Node.js built-in `node:test` and `node:assert/strict`.

---

## File Structure

- Modify: `chrome-extension/checkin-run-state.js`
  - Owns check-in run-state helpers used by both popup and tests.
  - Add date comparison and idle button label helpers.
- Modify: `tests/checkin-run-state.test.js`
  - Covers the new button label behavior.
- Create: `chrome-extension/extension-storage.js`
  - Owns pure install-time storage-default logic.
- Create: `tests/extension-storage.test.js`
  - Covers install defaults without requiring Chrome APIs.
- Modify: `chrome-extension/background.js`
  - Imports `extension-storage.js`.
  - Uses missing-key defaults during `onInstalled` instead of overwriting existing records.
- Modify: `chrome-extension/popup.js`
  - Tracks `lastCheckInTime` from status/storage changes.
  - Uses the new helper for idle button text.

---

### Task 1: Add Date-Aware Button Text Helper

**Files:**
- Modify: `tests/checkin-run-state.test.js`
- Modify: `chrome-extension/checkin-run-state.js`

- [ ] **Step 1: Write the failing tests**

Update the import block in `tests/checkin-run-state.test.js` to include the new helpers:

```js
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
```

Append these tests to `tests/checkin-run-state.test.js`:

```js
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/checkin-run-state.test.js
```

Expected: FAIL because `getIdleCheckInButtonText` and `isSameLocalDate` are not exported functions yet.

- [ ] **Step 3: Implement the minimal helper code**

In `chrome-extension/checkin-run-state.js`, add these constants and functions after `getCheckInRunState`:

```js
  const DEFAULT_IDLE_CHECK_IN_BUTTON_TEXT = '立即签到';
  const STALE_IDLE_CHECK_IN_BUTTON_TEXT = '今日未签，立即签到';

  function isSameLocalDate(value, now = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const referenceDate = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(date.getTime()) || Number.isNaN(referenceDate.getTime())) return false;

    return date.getFullYear() === referenceDate.getFullYear() &&
      date.getMonth() === referenceDate.getMonth() &&
      date.getDate() === referenceDate.getDate();
  }

  function getIdleCheckInButtonText(lastCheckInTime, now = new Date()) {
    if (!lastCheckInTime) return DEFAULT_IDLE_CHECK_IN_BUTTON_TEXT;
    return isSameLocalDate(lastCheckInTime, now)
      ? DEFAULT_IDLE_CHECK_IN_BUTTON_TEXT
      : STALE_IDLE_CHECK_IN_BUTTON_TEXT;
  }
```

Add these root exports near the existing root exports:

```js
  root.isSameLocalDate = isSameLocalDate;
  root.getIdleCheckInButtonText = getIdleCheckInButtonText;
```

Add these CommonJS exports in the `module.exports` object:

```js
      isSameLocalDate,
      getIdleCheckInButtonText
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
node --test tests/checkin-run-state.test.js
```

Expected: PASS with all `checkin-run-state` tests passing.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add chrome-extension/checkin-run-state.js tests/checkin-run-state.test.js
git commit -m "feat: add check-in button date helper"
```

---

### Task 2: Preserve Existing Storage During Extension Install Events

**Files:**
- Create: `tests/extension-storage.test.js`
- Create: `chrome-extension/extension-storage.js`
- Modify: `chrome-extension/background.js`

- [ ] **Step 1: Write the failing storage-default tests**

Create `tests/extension-storage.test.js`:

```js
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
node --test tests/extension-storage.test.js
```

Expected: FAIL with `Cannot find module '../chrome-extension/extension-storage.js'`.

- [ ] **Step 3: Implement the storage-default helper**

Create `chrome-extension/extension-storage.js`:

```js
(function(root) {
  function hasOwnStorageKey(storage, key) {
    return Object.prototype.hasOwnProperty.call(storage || {}, key);
  }

  function buildMissingInstallStorageDefaults(existingStorage = {}) {
    const defaults = {};
    if (!hasOwnStorageKey(existingStorage, 'lastCheckInTime')) {
      defaults.lastCheckInTime = null;
    }
    if (!hasOwnStorageKey(existingStorage, 'checkInResults')) {
      defaults.checkInResults = {};
    }
    return defaults;
  }

  root.buildMissingInstallStorageDefaults = buildMissingInstallStorageDefaults;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      buildMissingInstallStorageDefaults
    };
  }
})(typeof self !== 'undefined' ? self : globalThis);
```

- [ ] **Step 4: Wire the helper into the background service worker**

Change the first line of `chrome-extension/background.js` from:

```js
importScripts('schedule.js', 'config.js', 'auth-headers.js', 'checkin-result.js', 'newapi-auth.js', 'zenapi-auth.js', 'tab-options.js', 'site-name.js', 'page-status.js', 'checkin-run-state.js', 'balance.js');
```

to:

```js
importScripts('schedule.js', 'config.js', 'auth-headers.js', 'checkin-result.js', 'newapi-auth.js', 'zenapi-auth.js', 'tab-options.js', 'site-name.js', 'page-status.js', 'checkin-run-state.js', 'balance.js', 'extension-storage.js');
```

Replace the `onInstalled` listener in `chrome-extension/background.js` with:

```js
chrome.runtime.onInstalled.addListener(() => {
  console.log('公益站自动签到助手已安装');

  scheduleDailyCheckIn();
  initializeInstallStorageDefaults().catch((error) => {
    console.error('初始化签到存储失败:', error);
  });
});
```

Add this function immediately after the `onInstalled` listener:

```js
async function initializeInstallStorageDefaults() {
  const existingStorage = await chrome.storage.local.get(['lastCheckInTime', 'checkInResults']);
  const defaults = buildMissingInstallStorageDefaults(existingStorage);
  if (Object.keys(defaults).length > 0) {
    await chrome.storage.local.set(defaults);
  }
}
```

- [ ] **Step 5: Run the focused storage test and verify it passes**

Run:

```bash
node --test tests/extension-storage.test.js
```

Expected: PASS with all `extension-storage` tests passing.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add chrome-extension/extension-storage.js chrome-extension/background.js tests/extension-storage.test.js
git commit -m "fix: preserve check-in storage on install events"
```

---

### Task 3: Wire Date-Aware Button Text Into the Popup

**Files:**
- Modify: `chrome-extension/popup.js`

- [ ] **Step 1: Track the latest stored check-in time**

At the top of `chrome-extension/popup.js`, change:

```js
let currentRunState = { running: false };
let addingSite = false;
const sitesRenderGuard = createLatestRenderGuard();
```

to:

```js
let currentRunState = { running: false };
let latestLastCheckInTime = null;
let addingSite = false;
const sitesRenderGuard = createLatestRenderGuard();
```

- [ ] **Step 2: Capture `lastCheckInTime` before initial button rendering**

Inside `loadStatus()`, replace the response handling block with:

```js
    if (response) {
      const results = response.checkInResults || {};
      latestLastCheckInTime = response.lastCheckInTime || null;
      currentRunState = getCheckInRunState({ checkInRunState: response.checkInRunState });
      updateStats(results);
      renderSites(results);
    }
    if (response?.lastCheckInTime) {
      document.getElementById('lastCheck').textContent =
        `上次签到: ${formatDateTime(new Date(response.lastCheckInTime))}`;
    }
```

- [ ] **Step 3: Update cached time and button state when storage changes**

In `handleStorageChange`, replace:

```js
  if (changes.lastCheckInTime?.newValue) {
    document.getElementById('lastCheck').textContent =
      `上次签到: ${formatDateTime(new Date(changes.lastCheckInTime.newValue))}`;
  }
```

with:

```js
  if (changes.lastCheckInTime) {
    latestLastCheckInTime = changes.lastCheckInTime.newValue || null;
    if (changes.lastCheckInTime.newValue) {
      document.getElementById('lastCheck').textContent =
        `上次签到: ${formatDateTime(new Date(changes.lastCheckInTime.newValue))}`;
    } else {
      document.getElementById('lastCheck').textContent = '暂无签到记录';
    }
    updateCheckInButtonState();
  }
```

- [ ] **Step 4: Keep popup cache current after manual and retry runs complete**

In `handleManualCheckIn`, replace:

```js
    if (!response.running) {
      document.getElementById('lastCheck').textContent = `上次签到: ${formatDateTime(new Date())}`;
    }
```

with:

```js
    if (!response.running) {
      latestLastCheckInTime = new Date().toISOString();
      document.getElementById('lastCheck').textContent =
        `上次签到: ${formatDateTime(new Date(latestLastCheckInTime))}`;
      updateCheckInButtonState();
    }
```

In `handleRetrySite`, replace:

```js
    if (!response.running) {
      document.getElementById('lastCheck').textContent = `上次签到: ${formatDateTime(new Date())}`;
    }
```

with:

```js
    if (!response.running) {
      latestLastCheckInTime = new Date().toISOString();
      document.getElementById('lastCheck').textContent =
        `上次签到: ${formatDateTime(new Date(latestLastCheckInTime))}`;
      updateCheckInButtonState();
    }
```

- [ ] **Step 5: Use the date-aware helper for idle button text**

In `updateCheckInButtonState`, replace:

```js
  btnText.textContent = cancelling ? '正在终止...' : (running ? '签到中，点击终止' : '立即签到');
```

with:

```js
  btnText.textContent = cancelling
    ? '正在终止...'
    : (running ? '签到中，点击终止' : getIdleCheckInButtonText(latestLastCheckInTime));
```

- [ ] **Step 6: Run focused tests for affected helpers**

Run:

```bash
node --test tests/checkin-run-state.test.js tests/extension-storage.test.js
```

Expected: PASS with both focused test files passing.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add chrome-extension/popup.js
git commit -m "fix: show stale daily check-in button text"
```

---

### Task 4: Full Verification

**Files:**
- Read: `docs/superpowers/specs/2026-06-13-preserve-checkin-records-design.md`
- Read: `git diff HEAD~3..HEAD`

- [ ] **Step 1: Run the full test suite**

Run:

```bash
node --test tests/*.test.js
```

Expected: PASS with all repository tests passing.

- [ ] **Step 2: Verify requirements against the spec**

Check the final code against these requirements:

```text
Same-day check-in records are not cleared on popup or browser reopen.
The site list keeps latest checkInResults when the day changes.
No lastCheckInTime displays the idle button text 立即签到.
Same-day lastCheckInTime displays the idle button text 立即签到.
Previous-day lastCheckInTime displays 今日未签，立即签到.
Manual, scheduled, and retry runs keep the existing result-refresh flow.
Extension uninstall and reinstall still clears data through Chrome extension-local storage.
```

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: implementation files are committed; the pre-existing zip files remain untracked.
