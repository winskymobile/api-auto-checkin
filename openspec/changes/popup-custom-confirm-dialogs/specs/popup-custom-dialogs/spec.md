## ADDED Requirements

### Requirement: Popup-owned confirmations
The extension popup SHALL present confirmation, prompt, and two-choice decision flows inside the popup UI instead of using native `confirm()` or `prompt()` dialogs.

#### Scenario: Mode switch confirmation
- **WHEN** the user chooses to switch a site's mode
- **THEN** the popup SHALL show an in-popup confirmation dialog with the same warning content and SHALL only switch the mode after the user confirms

#### Scenario: Delete confirmation
- **WHEN** the user chooses to delete a site
- **THEN** the popup SHALL show an in-popup destructive confirmation dialog and SHALL only delete the site after the user confirms

#### Scenario: Rename prompt
- **WHEN** the user chooses to rename a site
- **THEN** the popup SHALL show an in-popup text input dialog prefilled with the current display name and SHALL only save a non-empty normalized name after the user confirms

#### Scenario: Import confirmation
- **WHEN** an import file contains valid sites
- **THEN** the popup SHALL ask for import confirmation inside the popup before changing stored sites

#### Scenario: Import mode choice
- **WHEN** an import file is confirmed and current sites already exist
- **THEN** the popup SHALL offer the replace and merge import choices inside the popup and SHALL apply the selected mode only after the user chooses one

### Requirement: Dialog accessibility and dismissal
The popup dialog system SHALL provide keyboard-accessible controls, clear dialog semantics, and predictable cancellation behavior.

#### Scenario: Keyboard cancellation
- **WHEN** a popup dialog is open and the user presses Escape
- **THEN** the dialog SHALL close without confirming the action

#### Scenario: Focus handling
- **WHEN** a popup dialog opens
- **THEN** focus SHALL move into the dialog and return to the previously focused control after the dialog closes when possible

#### Scenario: Screen reader semantics
- **WHEN** a popup dialog is rendered
- **THEN** it SHALL expose `role="dialog"`, `aria-modal="true"`, and a labelled title

### Requirement: Native dialog regression guard
The popup implementation SHALL prevent native confirmation and prompt APIs from being used in popup workflows.

#### Scenario: Source-level guard
- **WHEN** regression tests inspect `chrome-extension/popup.js`
- **THEN** they SHALL fail if native `confirm()` or `prompt()` calls are present
