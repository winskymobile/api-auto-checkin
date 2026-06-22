## ADDED Requirements

### Requirement: Site mode chip switches between automatic check-in and visit mode
The popup SHALL allow users to switch an existing site between automatic check-in mode and visit-only mode by activating the site's `自动` or `访问` mode chip.

#### Scenario: Confirm automatic site switches to visit mode
- **WHEN** a user activates the `自动` chip for a site and confirms the change
- **THEN** the popup saves that site with visit-only mode and re-renders the chip as `访问`

#### Scenario: Confirm visit site switches to automatic mode
- **WHEN** a user activates the `访问` chip for a site and confirms the change
- **THEN** the popup saves that site with automatic check-in mode and re-renders the chip as `自动`

#### Scenario: Cancel mode switch
- **WHEN** a user activates a mode chip and cancels the confirmation
- **THEN** the popup SHALL NOT change the site's stored mode

### Requirement: Site secondary actions are behind a three-dot menu
The popup SHALL replace the trailing direct delete cross with a three-dot action button that opens a menu for secondary site actions.

#### Scenario: Open site action menu
- **WHEN** a user activates the three-dot button on a site row
- **THEN** the popup shows a menu with `修改名称` and `删除`

#### Scenario: Delete from action menu
- **WHEN** a user chooses `删除` from the action menu and confirms deletion
- **THEN** the popup removes the site from storage and re-renders the list

#### Scenario: Rename from action menu
- **WHEN** a user chooses `修改名称`, enters a non-empty name, and confirms the prompt
- **THEN** the popup saves the new site name and re-renders the list

#### Scenario: Cancel rename
- **WHEN** a user cancels the rename prompt or submits only blank text
- **THEN** the popup SHALL NOT change the site's stored name
