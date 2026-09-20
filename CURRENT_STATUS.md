# GWTP Current Status

Last updated: 2026-09-20

## Current focus
Implement safe learner Resume together with missing-element handling, while preserving the existing live-navigation/postback mechanism.

## Existing progress infrastructure
Backend already contains:
- `UserProgress`
- `UserStepProgress`
- `POST /api/learner/progress/start/{guideId}`
- `POST /api/learner/progress/restart/{guideId}`
- `POST /api/learner/progress/move`
- `POST /api/learner/progress/complete/{guideId}`
- `GET /api/learner/progress/steps/{guideId}`
- `GET /api/learner/progress/active`

Reset was verified to delete `UserStepProgress` rows.

## Existing extension behavior verified
Relevant files:
- `extension/learner/guide-runner.js`
- `extension/background/training-engine.js`
- `extension/content/overlay/training-runner.js`
- `extension/sidepanel/sidepanel.js`

The active-guide navigation mechanism already:
1. peeks at the next/previous step,
2. checks whether that step can be displayed,
3. moves progress only after availability succeeds.

A `pending-navigation` value in `chrome.storage.session` survives business-system postbacks/DOM destruction. On `GWTP_PAGE_READY`, `resumePendingNavigation()` attempts to continue once the destination element becomes available.

Current `GWTP_PAGE_READY` flow in the learner side panel is:
- `resumePendingNavigation()`
- if nothing resumed, `restoreActiveStep()`.

Current `restoreActiveStep()` uses `allowDetached: true`, so an overlay can be restored without its target element. This behavior must be reconsidered for old-session Resume.

## Current start behavior to change
`handleStartLearning()` currently treats both `InProgress` and `Completed` as restart conditions and calls `guideRunner.restart(guide)`. This intentionally starts again at step 1.

Target behavior:
- NotStarted -> start at step 1.
- InProgress -> show Continue from saved step / Start over.
- Completed -> start over.
- Continue -> attempt saved step without resetting DB progress.
- Missing target during Resume -> keep progress, show Retry / Exit.
- Start over -> restart selected guide only.

## Important distinction
Do not replace or break the existing `pending-navigation` mechanism. It solves a different problem: a DOM/page transition occurring while an active guide is running.

The new Resume flow solves re-entry into an older InProgress guide where the live application may no longer be on the correct screen or may have changed.

## Next implementation task
Implement the Resume choice and missing-element state as one coherent change, reusing existing APIs and navigation infrastructure where possible. Avoid PageState models, automatic click replay, or business-state reconstruction.
