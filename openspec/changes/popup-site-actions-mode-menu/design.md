## Context

The popup renders each site row dynamically in `chrome-extension/popup.js`. Sites are stored in `chrome.storage.local.userSites` with `mode: 'visit'` for visit-only sites and check-in mode otherwise. The current row actions include a static mode chip, a site-name link, retryable status, optional balance, and a trailing cross delete button.

The popup is a compact product UI. The change should preserve scanning density and the existing row layout while making mode switching and secondary actions explicit.

## Goals / Non-Goals

**Goals:**
- Allow users to toggle a site's mode by clicking the mode chip.
- Confirm before persisting a mode switch.
- Replace the direct delete cross with a three-dot menu containing rename and delete actions.
- Keep action menus keyboard-focusable and visually consistent with the popup.
- Keep export order and all check-in flows unchanged.

**Non-Goals:**
- Redesign the popup layout or color system.
- Add bulk editing.
- Add new site modes.
- Change the behavior of enable/disable toggles, retry status, drag sorting, or site opening.

## Decisions

- Use the existing `mode` field instead of adding a new data model. This preserves import/export compatibility and keeps background logic unchanged.
- Add a small `site-actions.js` helper for pure operations: derive next mode, labels, confirmation text, and sanitized rename values. This gives the new behavior direct unit coverage without requiring browser DOM tests.
- Use native `confirm()` for mode switches and deletion, and native `prompt()` for renaming. This matches the extension's existing confirmation style and avoids introducing modal complexity in a narrow popup.
- Render the three-dot menu as a fixed-position lightweight popup anchored to the button. This avoids clipping inside popup row containers and keeps the row height stable.
- Close the open action menu on outside click, Escape, scroll, and after an action completes. Only one menu is open at a time.

## Risks / Trade-offs

- Native prompt styling is browser-controlled -> acceptable because the existing UI already uses native confirm/alert dialogs and the request prioritizes function over a custom rename dialog.
- A fixed-position menu requires measuring the button -> mitigate by recalculating on open and closing on scroll/resizing-like interactions.
- The mode chip becomes interactive -> mitigate with button semantics, focus styles, title text, and confirmation before saving.
