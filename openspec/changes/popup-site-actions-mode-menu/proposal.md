## Why

The site list currently exposes mode as static text and deletion as a trailing cross button. Users need to switch a site between automatic check-in and visit-only mode without re-adding it, and deletion should move behind a small action menu so accidental removal is less likely.

## What Changes

- Make the `自动` / `访问` mode tag clickable.
- Require a second confirmation before changing a site's mode.
- Persist the switched mode in the existing `userSites` configuration.
- Replace the trailing cross delete button with a three-dot action button.
- Add an action menu with `修改名称` and `删除`.
- Keep existing check-in, visit, ordering, import/export, enable/disable, and open-site flows unchanged.

## Capabilities

### New Capabilities
- `popup-site-list-actions`: Covers mode switching, per-site action menu, site renaming, and deletion access from the popup site list.

### Modified Capabilities

## Impact

- Affected UI files: `chrome-extension/popup.html`, `chrome-extension/popup.js`.
- New focused helper/test surface: `chrome-extension/site-actions.js`, `tests/site-actions.test.js`.
- No new external dependencies.
- Existing stored `userSites` data shape is reused; no migration is required.
