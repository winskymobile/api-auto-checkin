## Context

The site action menu currently includes a "修改名称" item that opens a one-field rename prompt. The popup now has a custom dialog system, so this flow can become a compact in-popup edit form without reintroducing native browser prompts.

Sites are stored as simplified `userSites` entries. Adding a site already uses `parseSiteInput()` to normalize check-in page input into `domain` and optional `pageUrl`, and saved configs later use `pageUrl` as the visit/check-in page when present. Editing should reuse that path to keep behavior consistent.

## Goals / Non-Goals

**Goals:**
- Change the action menu item label from "修改名称" to "修改".
- Let users edit both display name and check-in page address from the same popup dialog.
- Validate the edited address with `parseSiteInput()` and reject duplicate domains.
- Preserve existing site properties such as enabled state, mode, and type.
- Keep validation feedback inside the popup dialog.

**Non-Goals:**
- Editing site mode/type in the same dialog.
- Bulk editing multiple sites.
- Migrating existing stored sites.
- Replacing one-way `alert()` messages outside this edit flow.

## Decisions

- Extend the custom dialog helper with `showPopupForm`.
  - Rationale: The edit flow needs two fields and inline validation; a generic form dialog keeps the UI primitive reusable and consistent.
  - Alternative considered: Use two sequential prompts. That would be slower and would not meet the single-edit-flow requirement.

- Add a pure `buildEditedSiteConfig()` helper in `site-actions.js`.
  - Rationale: It centralizes name/address normalization and duplicate detection, and it can be tested without Chrome APIs.
  - Alternative considered: Inline logic in `popup.js`. That would work but would make validation harder to test and easier to duplicate later.

- Prefill the address field with `getSitePageUrl(site)`.
  - Rationale: Users see and edit the actual check-in page the extension will open, including default paths for older domain-only sites.
  - Alternative considered: Show only the stored raw `pageUrl` when present. That would leave older sites with a blank or ambiguous field.

- Keep the dialog visually aligned with existing popup inputs.
  - Rationale: The user specifically requested matching input styling; adding a second field should feel like the existing add-site form.

## Risks / Trade-offs

- Changing the domain can make previous check-in results no longer line up with the edited site -> Re-render after save; historical result cleanup is out of scope.
- Parsing can normalize user-entered URLs -> Display the normalized value after save through the existing site rendering.
- Duplicate detection by domain ignores path differences -> This matches current storage de-duplication behavior and prevents ambiguous duplicate site entries.
