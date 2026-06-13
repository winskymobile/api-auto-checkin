# Preserve Check-in Records Design

## Context

The Chrome extension stores the latest check-in status in `chrome.storage.local` as
`checkInResults` and the latest run time as `lastCheckInTime`. The popup reads
these values on load and renders the site list from `checkInResults`.

The current bug is that a completed same-day check-in can disappear after closing
and reopening the browser. The investigation found one risky path: the extension
`onInstalled` handler writes `lastCheckInTime: null` and `checkInResults: {}` every
time it runs. That can erase previously persisted state during install/update
events. The popup button also always falls back to the static text `立即签到`,
so it cannot distinguish a previous-day run from a same-day run.

## Requirements

- Preserve same-day check-in records after closing and reopening the browser.
- Keep the site list showing the latest stored `checkInResults`; do not clear the
  list when a new day starts.
- Main button text:
  - No `lastCheckInTime`: `立即签到`.
  - `lastCheckInTime` is today: `立即签到`.
  - `lastCheckInTime` exists but is not today: `今日未签，立即签到`.
- Refresh stored records only when a manual run, scheduled run, or single-site
  retry actually executes.
- If the extension is uninstalled and then reinstalled, records and caches should
  be gone together with Chrome's extension-local storage.
- Keep the existing main check-in flow unchanged.

## Approach

Use the existing storage model and add a small date-aware button state helper.
Do not introduce per-site daily records or daily cleanup.

1. Update installation initialization so it does not overwrite existing
   `lastCheckInTime` or `checkInResults`.
2. Add pure helpers in `checkin-run-state.js`:
   - determine whether an ISO timestamp is the same local calendar day as `now`;
   - derive idle button text from `lastCheckInTime`.
3. Store the popup's latest `lastCheckInTime` in memory and pass it into
   `updateCheckInButtonState`.
4. Keep running and cancelling button labels unchanged.
5. Continue updating `checkInResults` only in existing run paths:
   `executeAllCheckIns`, `executeSingleSiteCheckIn`, cancellation normalization,
   and live run progress.

## Data Flow

- Popup load:
  - sends `getStatus`;
  - receives `lastCheckInTime`, `checkInResults`, `checkInRunState`;
  - renders stats and sites from `checkInResults`;
  - computes button text from `lastCheckInTime`.
- Storage changes:
  - `checkInResults` changes refresh stats and site list;
  - `checkInRunState` changes refresh running/cancel button state;
  - `lastCheckInTime` changes refresh the footer text and idle button text.
- Manual, scheduled, and retry runs:
  - keep their existing execution flow;
  - update records when the run writes progress or final results.

## Error Handling

Invalid or missing `lastCheckInTime` is treated as no usable record and displays
`立即签到`. This avoids blocking first use or showing a misleading "today not
checked" message for corrupted data.

If a run is interrupted, existing normalization still converts transient
`checking` results to failed/interrupted statuses.

## Testing

Add tests before production changes:

- Button text helper returns `立即签到` when there is no history.
- Button text helper returns `立即签到` when the last check-in time is today.
- Button text helper returns `今日未签，立即签到` when the last check-in time is a
  previous local day.
- Installation initialization preserves existing `lastCheckInTime` and
  `checkInResults`.
- Existing run-state tests continue to pass.

Verification will run the focused Node tests first, then the full test suite.
