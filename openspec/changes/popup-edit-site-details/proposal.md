## Why

The site action currently says "修改名称" and only edits the display name. Users need one compact edit flow that can update both the site name and the check-in page address without deleting and re-adding the site.

## What Changes

- Rename the site action menu item from "修改名称" to "修改".
- Replace the single-field rename prompt with a popup edit form containing site name and check-in page address fields.
- Reuse the existing site URL parser so edited addresses follow the same validation and normalization rules as adding a site.
- Preserve the site's enabled state, mode, type, and other existing properties while updating name, domain, and page URL.
- Prevent edits that would create duplicate site domains.
- Add regression coverage for the action label and edit helper behavior.

## Capabilities

### New Capabilities
- `popup-site-detail-editing`: Editing a stored site's display name and check-in page address from the popup site action menu.

### Modified Capabilities
- None.

## Impact

- Affected UI: `chrome-extension/popup.js`, `chrome-extension/popup-dialog.js`, and dialog/input styling in `chrome-extension/popup.html`.
- Affected data: stored `userSites` entries may update `name`, `domain`, and `pageUrl`.
- No new runtime dependencies.
