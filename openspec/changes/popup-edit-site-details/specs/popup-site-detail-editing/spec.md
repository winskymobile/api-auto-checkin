## ADDED Requirements

### Requirement: Site action edit entry
The popup SHALL expose a site action menu item labelled "修改" for editing a site's stored details.

#### Scenario: Edit action label
- **WHEN** the user opens a site's action menu
- **THEN** the edit action SHALL be labelled "修改"

### Requirement: Site detail edit form
The popup SHALL allow users to edit both the site display name and check-in page address from one popup-owned dialog.

#### Scenario: Edit form fields
- **WHEN** the user clicks the "修改" action
- **THEN** the popup SHALL show a dialog with fields for "站点名称" and "签到页地址"

#### Scenario: Prefilled edit form
- **WHEN** the edit dialog opens
- **THEN** the name field SHALL be prefilled with the current display name and the address field SHALL be prefilled with the effective site page URL

#### Scenario: Successful edit
- **WHEN** the user enters a non-empty name and a valid check-in page address and saves
- **THEN** the popup SHALL update the stored site name, domain, and page URL while preserving enabled state, mode, and type

### Requirement: Site detail edit validation
The popup SHALL validate edited site details before saving.

#### Scenario: Empty name
- **WHEN** the user tries to save with an empty site name
- **THEN** the dialog SHALL remain open and show an inline validation message

#### Scenario: Invalid address
- **WHEN** the user tries to save with an invalid check-in page address
- **THEN** the dialog SHALL remain open and show an inline validation message

#### Scenario: Duplicate domain
- **WHEN** the edited address resolves to another existing site's domain
- **THEN** the dialog SHALL remain open and show an inline validation message without changing stored sites
