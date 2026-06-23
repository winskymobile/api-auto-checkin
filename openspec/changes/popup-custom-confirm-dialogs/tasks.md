## 1. Regression Coverage

- [x] 1.1 Add a Node regression test that fails while popup workflows still use native `confirm()` or `prompt()`.

## 2. Dialog UI

- [x] 2.1 Add popup dialog styling and load a reusable dialog helper before `popup.js`.
- [x] 2.2 Implement confirm, prompt, and two-choice dialog helpers with keyboard dismissal and focus return.

## 3. Workflow Integration

- [x] 3.1 Replace mode switch, delete, and import confirmation calls with popup confirm dialogs.
- [x] 3.2 Replace site rename prompt with the popup prompt dialog.
- [x] 3.3 Replace import replace/merge selection with the popup choice dialog.

## 4. Verification

- [x] 4.1 Run regression tests and JavaScript syntax checks.
- [x] 4.2 Confirm OpenSpec tasks are complete and note pre-existing non-change diffs.
