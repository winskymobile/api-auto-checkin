## Why

Chrome prepends extension-origin text to native `confirm()` and `prompt()` dialogs, which makes site-management confirmations feel noisy and less integrated with the popup. Moving these interactions into the popup keeps the workflow compact, readable, and consistent with the extension UI.

## What Changes

- Replace native confirmation dialogs in `popup.js` with an in-popup dialog component.
- Replace the native rename prompt with the same popup dialog system so site actions no longer show browser-owned prompt chrome.
- Support binary confirmations, destructive confirmations, text input, and two-action choices needed by import conflict handling.
- Preserve existing action outcomes for mode switching, deleting, renaming, and importing sites.
- Add regression coverage that prevents native `confirm()` and `prompt()` from returning to popup workflows.

## Capabilities

### New Capabilities
- `popup-custom-dialogs`: Popup-owned modal dialogs for confirmations, prompts, and two-choice decisions in site-management workflows.

### Modified Capabilities
- None.

## Impact

- Affected UI: `chrome-extension/popup.html`, `chrome-extension/popup.js`, and a new popup dialog helper script.
- Affected behavior: mode switch confirmation, delete confirmation, rename input, import confirmation, and import merge/replace choice.
- No new runtime dependencies.
