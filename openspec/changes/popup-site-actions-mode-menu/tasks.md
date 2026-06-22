## 1. Planning Artifacts

- [x] 1.1 Create OpenSpec proposal, design, and requirement spec for popup site actions.
- [x] 1.2 Add lightweight `PRODUCT.md` context for product UI work.

## 2. Test-First Helper Coverage

- [x] 2.1 Add `tests/site-actions.test.js` covering mode labels, mode transitions, confirmation text, and rename sanitization.
- [x] 2.2 Run `node --test tests/site-actions.test.js` and confirm the new tests fail before implementation.

## 3. Helper Implementation

- [x] 3.1 Add `chrome-extension/site-actions.js` with pure helpers for mode chip state and rename normalization.
- [x] 3.2 Run `node --test tests/site-actions.test.js` and confirm the helper tests pass.

## 4. Popup UI Implementation

- [x] 4.1 Load `site-actions.js` before `popup.js` in `chrome-extension/popup.html`.
- [x] 4.2 Convert the mode chip from a static span to a button with confirmation-backed mode switching.
- [x] 4.3 Replace the trailing delete cross with a three-dot menu button and menu rendering.
- [x] 4.4 Add rename handling using the existing `userSites` storage and list re-render flow.
- [x] 4.5 Update popup CSS for clickable chips, action buttons, and the fixed action menu.

## 5. Verification

- [x] 5.1 Run the focused helper tests.
- [x] 5.2 Run the full Node test suite.
- [x] 5.3 Run JavaScript syntax checks for touched extension scripts.
- [x] 5.4 Run `git diff --check`.
- [x] 5.5 Validate the OpenSpec change.
