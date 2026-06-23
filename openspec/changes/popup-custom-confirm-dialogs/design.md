## Context

The popup currently uses native `confirm()` for mode switching, deleting sites, import confirmation, and import mode selection. It also uses native `prompt()` for renaming a site. Chrome prepends extension-origin text to those native dialogs, so the user sees browser-owned chrome instead of a compact product interaction.

The popup already has a restrained product UI with CSS custom properties, 8px radii, visible focus outlines, and compact site-management controls. The dialog work should preserve that vocabulary rather than introducing a new visual system.

## Goals / Non-Goals

**Goals:**
- Provide popup-owned dialog helpers for confirmation, text input, and two-choice decisions.
- Replace all `confirm()` and `prompt()` use in `popup.js`.
- Keep current site-management and import outcomes intact.
- Make the dialog keyboard-accessible with focus management, Escape dismissal, and clear labels.
- Add a regression test that catches native `confirm()` or `prompt()` returning to popup workflows.

**Non-Goals:**
- Replacing one-way `alert()` status/error messages in this change.
- Adding new dependencies or a framework.
- Redesigning the wider popup layout.

## Decisions

- Use a lightweight helper script loaded before `popup.js`.
  - Rationale: The dialog behavior is reusable across confirm, choice, and prompt flows while keeping `popup.js` focused on site workflows.
  - Alternative considered: Inline helper functions in `popup.js`. That would work, but the file is already large and the dialog is a reusable UI primitive.

- Render dialogs dynamically into `document.body`.
  - Rationale: Dynamic rendering avoids permanent hidden markup and keeps state local to the pending dialog promise.
  - Alternative considered: Static hidden dialog markup in `popup.html`. This would add markup that has to support several modes and risks stale field state.

- Use promise-returning APIs: `showPopupConfirm`, `showPopupPrompt`, and `showPopupChoice`.
  - Rationale: Existing handlers are already async, so replacing native blocking calls with `await` keeps call sites readable.
  - Alternative considered: Callback-based APIs. That would make import and rename flows harder to scan.

- Keep the dialog visual language restrained.
  - Rationale: This is a compact utility popup. Dialogs should use existing surface, border, focus, danger, and button tokens with small radii and dense spacing.
  - Alternative considered: A more decorative modal treatment. That would conflict with the product register and make repeated actions feel heavier.

## Risks / Trade-offs

- Native blocking behavior becomes asynchronous -> Update every affected handler to `await` the popup dialog result before mutating data.
- Destructive actions can be easier to mis-click in custom UI -> Use explicit destructive button text and danger styling for deletion/overwrite decisions.
- Focus can be lost in a dynamic popup -> Focus the first meaningful control, return focus to the previously active element after close, and support Escape dismissal.
- Alert dialogs remain native -> This is intentionally scoped; one-way status/error messages can be converted to toast/inline feedback in a later change.
