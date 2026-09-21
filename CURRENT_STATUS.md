# GWTP Current Status

Last updated: 2026-09-22

### Windows Service database location
- The installed Windows Service uses `C:\\ProgramData\\GWTP\\Data\\GWTP.db` through `GWTP_DATA_PATH`; it does not use the repository `database/GWTP.db`.
- The repository database remains the local/interactive fallback when no external data path is configured.
- The Stage 2 sanity-user migration was verified against the actual service database in ProgramData: `sanity.admin`, `sanity.editor`, and `sanity.learner` exist there.
- Future Windows Service migration/debug checks must inspect the ProgramData database to avoid false negatives from checking the repository DB.

### Windows Service deployment reliability
- Fixed `deploy-gwtp-service.bat` service-state parsing: `sc.exe query` exposes the textual state in token 4, not token 3.
- Deployment now treats an already-stopped service as valid and waits on the observed service state rather than relying on the transient return code from `sc.exe stop`.
- This fixes the failure where a cleanly stopped service was incorrectly reported as a deployment failure before published files were copied.

### API role authorization status handling
- Stage 2 sanity testing exposed that role-mismatch endpoint filters were producing HTTP 500 when returning `Results.Forbid()` without an ASP.NET authentication scheme.
- Admin, editor topics, and editor guides filters now return an explicit HTTP 403 response for authenticated users lacking the required role.
- Anonymous or invalid session tokens continue to return HTTP 401.
- Stage 1/2 sanity was re-run after deployment and verified successfully: all 10 checks PASS, including the admin/editor role-separation check returning HTTP 403. Stage 2 is complete; Stage 3 visual E2E is next.

## Repository rule
Every functional or architectural code change must update this file in the same change set. Completed work must not remain documented as pending.

## Current learner architecture
- GWTP owns learning progress; the live application owns business/page state.
- No automatic replay of old clicks or reconstruction of business state.
- Learner navigation uses Previous/Next only.
- Progress advances only after the destination step can actually be displayed.
- `pending-navigation` in `chrome.storage.session` survives postbacks/DOM/frame destruction.
- `GWTP_PAGE_READY` resumes pending navigation and otherwise attempts to restore the active step.
- Business target availability is event/state based. Do not add arbitrary time-based polling for target elements.

## Resume and recovery — implemented and verified
- NotStarted starts at step 1.
- InProgress offers Continue / Start over.
- Completed starts over.
- Continue restores the saved learning position without reconstructing external application state.
- Missing target preserves progress and shows recovery actions.
- Recovery supports Retry, Start Again and Exit Learning.
- Retry rechecks the saved step on the current page without restarting the guide.
- Cross-site recovery was verified: wrong site -> recovery -> navigate to correct site -> Retry.
- Exit clears learner/pending state without reinjecting content scripts.

## Content-script/page transition hardening
- Manifest content scripts cover HTTP/HTTPS pages and frames.
- Content scripts are loaded by the manifest for HTTP/HTTPS pages and all frames; runtime messaging no longer dynamically reinjects the content-script bundle.
- Exit cleanup does not restore/reinject content scripts.
- `restoreActiveStep()` only displays a step when its target exists.
- Duplicate reinjection was identified as the source of repeated top-level declaration errors. Dynamic reinjection was removed, and the Ynet/Google recovery regression was verified with both page and Side Panel consoles clean.
- The legacy `showFirstStep()` 10 x 250 ms timing retry loop was removed. Learner step rendering now makes a single request; missing content-script receivers are restored by the messaging layer, while business target availability remains governed by page/frame readiness and actual DOM availability.

## Step instructions
- A stored `<br>` instruction caused an empty learner bubble.
- Root cause was author validation treating `<br>` as valid content.
- Author validation now requires actual textual instruction content.
- Existing affected DB row was corrected and the original recovery scenario was retested successfully.

## Validation responsibility
- GWTP validation is limited to author-configured learning conditions: `required`, `regex`, `changed`, and `changed_regex`.
- Business rules and business validation remain the responsibility of the live application and must not be duplicated by the extension.
- Business validation may trigger blur/change handlers, postbacks, frame reloads, or DOM replacement. GWTP preserves learning state through those transitions and reacts to page readiness/target availability rather than evaluating the business rule itself.

## Validation — implemented and verified
Current runtime supports:
- `required`
- `regex`
- `changed`
- `changed_regex`

Validation blocks Next when the current value is invalid. Changed-based validation stores a baseline for the active validation session so the learner must actually change the field. `changed_regex` requires both a changed value and a matching format.

The validation regression guide was run end-to-end successfully. Required, Equals, Not Equals, Contains, Changed, and Changed + Regex were verified. `changed_regex` was also created through the normal editor, saved, reloaded, and executed successfully as a learner.

## Progress backend
Backend includes:
- `UserProgress`
- `UserStepProgress`
- `POST /api/learner/progress/start/{guideId}`
- `POST /api/learner/progress/restart/{guideId}`
- `POST /api/learner/progress/move`
- `POST /api/learner/progress/complete/{guideId}`
- `GET /api/learner/progress/steps/{guideId}`
- `GET /api/learner/progress/active`

Reset was verified to delete both guide and step progress as intended.

## Validation regression fixture
- A versioned one-time database migration creates/refreshes the published guide `בדיקת כל חוקי הוולידציה` under `Demo CRM` and records its migration ID in `SchemaMigrations`; it is not re-seeded on every API startup.
- The guide uses the existing local Demo CRM page and contains deterministic scenarios for Required, Equals, Not Equals, Contains, Changed, and Changed + Regex.
- The Changed + Regex phone scenario accepts Israeli-style values both with and without a hyphen (for example `03-5551235` and `050-1234567`) and uses a concise learner instruction.
- The fixture is created through versioned backend migration code rather than by manually replacing `database/GWTP.db`. After the migration ID is recorded, subsequent API startups only perform the migration-ID lookup and do not query/create the guide.

## Repository database rule
- Changes to persistent/test database content must be delivered through GitHub as versioned repository changes.
- Do not distribute a replacement `GWTP.db` as the normal project workflow. The developer should receive repository changes with `git pull origin main`.

- Demo CRM regression: the Customer 360 tier instruction now explicitly tells the learner to choose a tier other than Platinum, matching its validation rule.

## Live-application postback/page-transition regression — verified
- The full `תרגול מלא - Demo CRM` learner guide was run end-to-end across Site, Case, Leads, and Customer 360.
- Cross-page/frame transitions, server-side saves, validation flows, and page/frame reloads preserved learning continuity.
- No replay of previous business actions or loss of learner position was observed.
- The only regression issue found was the Customer 360 tier instruction wording; it was corrected to explicitly require a tier other than Platinum.

- Demo CRM navigation regression was strengthened: the Site -> Case transition now uses the site-specific `#btn-open-case-from-site` control inside `TargetContent` instead of the global `#nav-case` tab. This explicitly tests a navigation step whose source element disappears with the old page before the next Case target is restored.

- Editor step-selection UX improved: opening an existing step now shows its step number in the editor heading and keeps that step card visually selected while it is being edited.

- Navigation continuity was extended for highlighted native links: before a learner follows a highlighted `<a href>` target, GWTP persists forward pending-navigation. The destination `PAGE_READY` still checks that the next step target exists before DB progress moves; GWTP does not replay the business action or use arbitrary waits. This covers the Demo CRM `#btn-open-case-from-site` Site -> Case transition.
- Closing the step editor now re-renders the step list after clearing `editingStepId`, so the editing selection is removed immediately.

- Cross-screen Previous/Next intent is now preserved when the adjacent step target is absent from the current screen. GWTP leaves business navigation to the learner, shows a localized message explaining that the requested step is on another screen, and `PAGE_READY` completes the pending move once that target becomes available. This works in both forward and backward directions without replay or arbitrary waits.

- Fixed duplicate cross-screen progress moves caused by near-simultaneous `GWTP_PAGE_READY` events from the top document and child frames. `resumePendingNavigation()` is now serialized so a pending Previous/Next intent can be consumed only once at a time and advances exactly one step.

- Guide steps now support an optional explicit `ScreenName`. The editor auto-fills a new step from the previous step's screen name for convenience, but saves the value explicitly on every step; reopening a step shows its stored value. The API/SQLite schema persist `ScreenName`, existing guides remain compatible when it is empty, and the Demo CRM full guide receives screen names through the versioned migration `20260921_demo_guide_screen_names`.
- Learner recovery and cross-screen Previous/Next guidance use the destination step's `ScreenName` when available (for example, "פניה"), with the existing generic message as fallback.

## Server deployment architecture
- `GWTP.Api` is now Windows-Service aware through `UseWindowsService`, while preserving normal interactive `dotnet run` development behavior.
- This is the first step toward running the API as an independently managed, always-on central service rather than a console process manually started by the extension user.
- The API now supports a service-safe `GWTP_DATA_PATH`; when omitted, normal repository-based development behavior is preserved.
- `install-gwtp-service.bat` publishes the API to `%ProgramData%\\GWTP\\Api`, copies the initial SQLite/schema data to `%ProgramData%\\GWTP\\Data` without overwriting existing service data, registers an automatic Windows Service, and binds it to `127.0.0.1:5000`.
- `uninstall-gwtp-service.bat` removes the service while preserving its database data.
- The local Windows Service deployment was installed and verified successfully: `/api/health` returned `GWTP.Api / ok`, and the browser extension successfully connected and operated through the service-backed API/database without `dotnet run`.
- `deploy-gwtp-service.bat` provides the normal backend update path after Git changes: publish to a staging directory, stop the installed service, replace the published API files, restart the service, and require a successful `/api/health` response. Persistent service data under `%ProgramData%\\GWTP\\Data` is not replaced by deployment.

## Guide library UX
- Existing guide cards now present their metadata as separate, aligned rows for topic, step count, and learner availability instead of combining topic/steps on one line.
- Learner availability is shown explicitly as localized Yes/No (כן/לא), using the existing `isAvailable` value already returned by the guides API.
- The guide library now includes compact filters for topic and learner availability. Filtering is client-side over the existing guides API response and preserves the established guide cards.
- The guide editor step list now includes a Screen filter populated from the explicit `ScreenName` values used by the guide. The filter affects only list visibility; it does not change step order or persisted guide data.

## Login validation UX
- Username and password are marked as required on the login screen using the shared red `required-marker` styling used by the rest of the extension.
- Login rejects missing fields and invalid username syntax locally before any API request. Username validation matches the currently implemented account rule: 5–30 characters using letters, digits, `.` or `_`.
- Login applies the same password format rule used for account creation before any API request: 6–20 characters with no whitespace.
- Only locally valid credentials are sent to the authentication API; credential correctness remains server-side.

## Session UX
- The Hebrew logout action is labeled `יציאה מהמערכת` to distinguish account logout from `יציאה מהלמידה`.

## Learner selection UX
- Changing the learner topic now clears any recovery/error state that belonged to the previously selected guide, so a stale "step not found" panel is not shown under a newly selected topic.

## Accessibility
- An initial accessibility audit was performed across the Side Panel, learner guidance overlay, Element Picker, and learner flow. The extension has a useful accessibility baseline but is not yet considered fully WCAG 2.2 AA verified.
- Accessibility hardening phase 1 has started in the Side Panel.
- Native buttons, inputs, selects, textareas, custom role=button controls, and contenteditable controls now receive a consistent visible keyboard focus indicator.
- The rich-text instruction editor now has a visible focus-within state, is marked required for assistive technology, and is associated with its status/error region.
- Login fields are associated with the login status region for assistive technology.
- The delete/reset confirmation dialog now has an accessible description, moves focus into the dialog, traps Tab/Shift+Tab inside it, closes with Escape, and returns focus to the control that opened it when possible.
- Field-level validation semantics are now implemented for the main Side Panel forms. Invalid login, user-management, guide-details, instruction, and validation-builder fields receive `aria-invalid="true"` and are associated with their existing status/error region through `aria-describedby`. The invalid state is cleared when the user edits/corrects the affected control.
- Invalid fields also receive a visible error border/ring so the state is not communicated only through status text.
- Learner guidance overlays now expose explicit assistive semantics: the guidance container is a live region, the current instruction is a polite status announcement, and validation failures remain assertive alerts.
- The learning-completion card is now an accessible modal dialog with title/description associations. Focus moves to its Close button when it opens, Tab remains within the dialog, and Escape closes it.
- The normal step overlay intentionally does not steal keyboard focus from the highlighted business control; this preserves form-entry and postback behavior while allowing screen readers to announce new guidance through the live region.
- Keyboard parity is implemented for learner guidance movement and learner navigation. Element Picker remains primarily pointer-based: browser Side Panel focus cannot be transferred reliably into the live page, so full keyboard element picking is intentionally deferred rather than adding a complex virtual-navigation layer. Manual CSS selector entry remains the keyboard-accessible authoring fallback.
- Learner Previous/Next pending-navigation persistence now also runs for keyboard activation (Enter/Space), preserving the same postback-safe navigation intent used by pointer activation.
- Highlighted native links now persist forward learning intent on keyboard Enter as well as pointerdown, so cross-screen learner navigation is not mouse-dependent.
- Static contrast review of the Side Panel palette has started. Primary text, secondary text (#667085), links/actions, success/error text, and white-on-primary button text meet the normal-text 4.5:1 target on their established light backgrounds. The rich-text empty-state placeholder used #98a2b3 on white (about 2.58:1), so it was strengthened to #667085 (about 4.97:1).
- A second static accessibility audit of the current extension source was completed on 2026-09-21. The codebase has a strong baseline (native controls, visible focus, field error semantics, dialog focus management, learner live regions, keyboard learner navigation), but it is not yet valid to describe the extension as fully accessibility/WCAG 2.2 AA verified without runtime assistive-technology and reflow testing.
- Accessibility-only authoring labels are localized through the existing HE/EN i18n service, including the rich-text toolbar/buttons and generated step action labels. Element Picker keyboard parity remains intentionally deferred.
- Remaining accessibility work includes live contrast verification for rendered states, narrow-viewport/reflow verification for the Side Panel, zoom/reflow verification for extension UI injected into web pages, screen-reader regression testing.

## Accessibility regression checks
For every accessibility change, verify the affected behavior with keyboard-only interaction before continuing:
- Focus visibility: use Tab and Shift+Tab throughout the Side Panel and confirm the active control always has a visible focus indicator.
- Confirmation dialog: open any delete/reset confirmation; confirm focus enters the dialog, Tab/Shift+Tab cannot leave it, Escape closes it, and focus returns to the opening control.
- Rich-text editor: Tab to the instruction editor and its formatting controls; confirm both the toolbar controls and editor have visible focus.
- Login: navigate username -> password -> Continue using the keyboard and verify validation/status feedback remains exposed without requiring the mouse.
- Field errors: submit intentionally invalid values in Login, Create/Edit User, Guide Details, and Step/Validation editing. Confirm the invalid field receives the red error state and focus where applicable; then edit the field and confirm the invalid visual state clears.
- Browser accessibility inspection: for an invalid field, inspect its accessibility attributes and confirm `aria-invalid="true"` and `aria-describedby` points to the visible status/error element.
- Learner guidance: start a guide and move through several steps. Confirm the highlighted business field retains normal keyboard interaction and the guidance bubble does not forcibly take focus.
- Learner validation: trigger a step validation failure and confirm the visible validation message appears while focus returns to/remains usable on the relevant business field.
- Completion dialog: finish a guide using the keyboard. Confirm focus moves to Close, Tab does not escape the completion dialog, Escape closes it, and the dialog has no effect on the live application's page state.
- Screen-reader check (when available): verify that moving to a new step announces the new instruction and that validation failures are announced as alerts.
- Guidance movement: Tab to the bubble's drag handle and move it with all four arrow keys. Clicking the drag handle also explicitly gives it keyboard focus, so arrow-key movement must work immediately after clicking it. Confirm the bubble stays within the viewport and mouse dragging still works.
- Element Picker: verify pointer-based selection and Escape cancellation still work. Do not treat Side Panel-to-page Tab focus transfer as supported. Verify that an editor can alternatively enter/test a CSS selector without using the picker.
- Keyboard learner navigation: run a guide using Tab plus Enter/Space on Previous/Next. Include a cross-screen/postback transition and confirm progress advances exactly once and resumes on the correct destination step.
- Highlighted link navigation: focus a highlighted native link with Tab and activate it with Enter. Confirm the destination page resumes the expected next learning step.
- Contrast: inspect normal text, secondary text, buttons, statuses, placeholders, focus indicators, disabled states, and learner guidance against their actual rendered backgrounds. Do not rely on color alone for state/error meaning.
- Reflow: do not use ordinary webpage zoom as a Side Panel conformance test because Chrome hosts it as a separate extension page in browser side-panel UI. Test the Side Panel at narrow available widths (target 320 CSS px where the user agent permits) and with relevant OS/display scaling; confirm content remains readable/reachable, controls do not overlap or clip, and extension UI does not introduce unnecessary two-dimensional scrolling. Separately test learner guidance and other extension UI injected into normal web pages under browser text/page enlargement, including 200% text enlargement and the 320 CSS px Reflow target where testable.
Later accessibility phases must add their own concrete regression checks to this section.

## Automated sanity testing
- A repeatable non-destructive Stage 1/2 sanity runner now exists at `sanity-tests/gwtp-sanity.ps1`.
- It verifies API health, database health/schema availability, Demo CRM site availability, anonymous authorization boundaries for learner/admin APIs, and rejection of invalid credentials.
- Stage 2 adds read-only authenticated checks: dedicated sanity-admin login/token/role, protected users access, editor-only role separation, and authenticated learner catalog access.
- Versioned migration `20260921_sanity_test_users_v1` creates isolated `sanity.admin`, `sanity.editor`, and `sanity.learner` fixtures with deterministic test credentials so sanity runs do not depend on passwords or state of normal working accounts.
- The runner does not create/update/delete guides, users, topics, or learner progress and is safe to run against the normal local development stack.
- It returns process exit code 0 on full success and 1 on any failure, allowing later CI/deployment integration.
- `sanity-tests/README.md` documents execution and the staged plan. The next sanity stage is visual browser/extension end-to-end coverage; destructive API fixture tests can be added later only where they provide additional value.

## Stage 3 Playwright E2E foundation
- Added `sanity-tests/playwright` with a dedicated Playwright configuration and read-only Chromium extension smoke suite.
- The suite preflights GWTP API and Demo CRM availability, loads the unpacked Manifest V3 extension, resolves its runtime extension ID, and opens the real Side Panel document.
- Initial coverage verifies the Demo CRM receives the GWTP content script and checks role-specific UI boundaries for `sanity.learner`, `sanity.editor`, and `sanity.admin`.
- Stage 3 currently requires a headed Chromium run because extension loading is part of the test environment.
- No application data is mutated by the initial suite.
- Added the first real learner E2E smoke: Playwright opens Demo CRM, logs in as the sanity learner, selects `Demo CRM` / `תרגול מלא - Demo CRM`, starts learning, and verifies that a visible guidance overlay and highlighted target are rendered in the live CRM frame.
- Initial Stage 3 Playwright foundation was executed locally on 2026-09-21 and verified successfully: 4/4 PASS (Demo CRM/content-script readiness, learner role UI, editor role UI, admin role UI).
- First real learner Playwright E2E was then executed successfully: total suite 5/5 PASS. The learner test logs in, selects `Demo CRM` / `תרגול מלא - Demo CRM`, starts the guide against the active Demo CRM tab, and verifies visible guidance plus target highlighting.
- Learner navigation E2E verified locally: total suite 6/6 PASS. The dedicated sanity learner is restarted at step 1; `Next` moves guidance from `#site-code` to `#site-name`, and `Previous` moves it back. The assertion follows the actual training-runner implementation, which applies its own inline outline rather than the generic highlighter's `data-gwtp-highlighted` marker.
- Playwright/browser sanity assets are development/QA-only and must not be included in the future customer installation/package.

## Immediate next tasks
1. Verify `deploy-gwtp-service.bat` on the next backend code change; the initial Windows Service installation and extension connectivity are already verified.
2. Expand the now-verified 5/5 Stage 3 Playwright suite through learner navigation behavior: Next/Previous, validation blocking, cross-screen/frame transitions, recovery, and completion. Keep all Playwright/test tooling development-only and outside the future customer package.
3. Continue accessibility runtime verification separately with reflow and screen-reader regression testing.

- Stage 3 validation E2E verified locally: the dedicated validation guide clears the required site-name field, verifies Next remains blocked with the authored validation error, then supplies a value and verifies advancement to site-type. Playwright suite is now 7/7 PASS.

- Stage 3 cross-page/frame E2E added: restart the full Demo CRM guide, advance through Site steps while satisfying authored validations, activate `#btn-open-case-from-site`, verify top-level navigation to `case.html`, then verify PAGE_READY/pending-navigation automatically resumes guidance on `#case-category` inside the new TargetContent frame. Pending local execution; Playwright suite now contains 8 tests.

- Stage 3 cross-page E2E exposed a real native-link race: the highlighted link could unload its frame before the asynchronous pending-navigation write reached `chrome.storage.session`, leaving the destination without guidance. `training-runner.js` now persists the learner intent first and delays only ordinary unmodified native-link navigation until persistence succeeds; the business link is activated exactly once and GWTP still does not replay business actions. Cross-page test requires rerun.

- Follow-up on the Stage 3 Site→Case failure: the remaining race was in `guide-runner.js`. Top-frame and `TargetContent` `GWTP_PAGE_READY` events could overlap; serialization made the iframe readiness event reuse the earlier top-frame attempt, so the target frame was never checked after it became ready. Pending-navigation resume now queues one follow-up availability check for readiness events arriving while a resume is in flight, while still serializing the actual progress move. Awaiting Playwright rerun.

- Second Site→Case Stage 3 diagnosis: destination rendering also depends on the tab-scoped validation session. Cross-document navigation can reach the pending-navigation move with no usable validation context for the newly loaded content frame, causing `showTrainingStep` to abort before attaching the overlay. `guide-runner.js` now ensures the tab validation context exists before rendering the resumed destination step. Awaiting Playwright rerun; current confirmed result remains 7/8.

- Stage 3 Site→Case failure remains reproducible after the validation-context safeguard. The Playwright test now separates handoff progress from destination rendering: after `case.html` loads it polls the real training engine for zero-based stepIndex 6, verifies `#case-category` exists, and only then checks the guidance overlay. This diagnostic boundary will identify whether the remaining defect is pending-navigation/progress or destination rendering. Awaiting rerun; confirmed suite remains 7/8.

- Stage 3 Site→Case diagnostic rerun showed engine progress at zero-based stepIndex 2 after navigation, so the failure predates the Site→Case handoff. The E2E now asserts engine progress reaches stepIndex 5 before clicking the highlighted native link; this will isolate which Site-step transition first diverges instead of applying further speculative runtime fixes. Awaiting rerun; confirmed suite remains 7/8.

- Stage 3 Site→Case diagnosis: the Playwright loop was racing asynchronous learner progress. It could click the newly rendered overlay before the previous `/progress/move` had become the engine's current step, producing a visually advanced target while progress remained at stepIndex 2. The E2E now waits for `GWTP_TRAINING_GET_CURRENT` after every Site-step Next before proceeding. This is a test synchronization correction, not a runtime workaround. Awaiting 8/8 rerun.

- Stage 3 Playwright suite verified locally at **8/8 PASS**. The Site→Case test now confirms synchronized Site-step progress, native top-level navigation to `case.html`, pending-navigation advancement to zero-based stepIndex 6, and visible guidance/highlight on `#case-category` inside the new `TargetContent` frame.

- Stage 3 test 9 added (pending local verification): `learner survives a real Site server save and reload`. It drives the full Demo CRM guide to `#btn-save-site`, executes the real business save (`PUT /api/sites/77402`), verifies the response succeeds and `TargetContent` reloads, confirms learner progress remains on zero-based stepIndex 4, and verifies the Save guidance/highlight is restored after reload.

- Stage 3 test 9 itself passed locally, confirming the real Site save/reload path. The same 9-test run exposed order/state coupling in test 5: the dedicated sanity learner can retain progress from prior runs, so the generic guide-start smoke test could attempt Start from stale progress and fail to render. Test 5 now restarts the selected full guide when restart is available, otherwise starts normally, making the smoke test independent of persisted learner progress. Awaiting rerun; latest observed run was 8/9 with test 9 PASS.

- Stage 3 rerun exposed two test-fixture issues, not a new runtime regression: (1) test 5 enumerated transient Playwright `Frame` objects while restart was replacing `TargetContent`, causing `Frame was detached`; it now uses a stable `frameLocator`. (2) tests 8/9 hard-coded the Changed-validation phone value to `03-7654321`; the real Site save in test 9 persists that value, so later suite runs could set the field to its existing baseline and correctly fail Changed validation at stepIndex 2. Those tests now read the current phone value and choose a different valid value deterministically. Awaiting rerun; prior run was 6/9.

- Stage 3 Playwright suite verified locally at **9/9 PASS** after making the tests independent of iframe replacement and persisted Demo CRM phone data. Test 9 confirms a real Site server save, TargetContent reload, preserved learner progress, and restored guidance/highlight.

- Stage 3 test 10 added (pending local verification): `learner can reopen the extension and resume saved progress`. It restarts the full Demo CRM guide, advances to zero-based stepIndex 1 (`#site-name`), closes the extension page without resetting server progress, opens a fresh sidepanel document using the persisted authenticated session, verifies `Continue Learning` plus `Restart` are offered, resumes, and verifies both engine progress and visible guidance return to `#site-name`.

- Stage 3 Playwright suite verified locally at **10/10 PASS**. Test 10 confirms persisted learner progress survives closing/reopening the extension UI, the learner is offered Continue/Restart, and Continue restores zero-based stepIndex 1 with visible guidance on `#site-name` without replaying prior business actions.

- Stage 3 test 11 added (pending local verification): completion lifecycle using the compact validation guide. The test satisfies all six authored validation steps, presses Finish, verifies the completion dialog, reopens the extension to force a fresh learner catalog read, verifies a completed guide is no longer offered Continue/Restart, starts it again, and confirms progress restarts at zero-based stepIndex 0 with step-1 guidance visible.

- Stage 3 test 11 first local run reached 10/11 PASS. The completion test failure was isolated to test setup: its `not_equals branch` step incorrectly selected `branch`, so the runtime correctly kept progress at stepIndex 2. The E2E now selects `hq`, waits for the Demo CRM field/postback state, and explicitly synchronizes progress at stepIndex 3 and 4 before continuing. Pending re-verification.

- Stage 3 Playwright suite verified locally at **11/11 PASS**. Test 11 confirms the completion lifecycle end-to-end: all authored validations can be satisfied, Finish persists completion, the completion dialog appears, a fresh learner catalog does not offer Continue/Restart for the completed guide, and starting it again restarts at zero-based stepIndex 0.

- Stage 3 test 12 added (pending local verification): learner Side Panel narrow-width reflow at 320x720. It verifies there is no horizontal document overflow and that the topic selector, guide selector, and primary learning action remain visible and fully inside the viewport.

- Stage 3 Playwright suite verified locally at **12/12 PASS**. Test 12 confirms the learner Side Panel fits a 320x720 viewport without horizontal document overflow and keeps the topic selector, guide selector, and primary learning action fully visible inside the viewport.

- Stage 3 test 13 added (pending local verification): editor Side Panel narrow-width layout at 320x720. It verifies no horizontal document overflow and checks every visible editor button/input/select/textarea remains within the viewport.

- Stage 3 test 13 verified locally: **PASS**. The editor Side Panel at 320x720 has no horizontal document overflow and all visible editor form controls/actions remain inside the viewport. Full suite regression remains 12/12 from the preceding run; test 13 was intentionally verified point-by-point.

- Stage 3 visual-layout batch added (pending local verification): four grouped Playwright tests named `visual layout - ...`: Admin Side Panel at 320x720, learner guidance containment in a 360px target viewport, guidance controls/overflow under enlarged text, and Hebrew learner guidance RTL direction. Run them together with `npx playwright test -g "visual layout"`.

- Stage 3 visual-layout batch verified locally: **4/4 PASS**. The real Chrome Side Panel boundary was reviewed: the runtime is correctly wired through `side_panel.default_path`, the `sidePanel` permission, and `openPanelOnActionClick`; Playwright's normal DOM automation tests the same sidepanel document in an extension tab but does not control Chrome's browser-level Side Panel shell. A six-step real Side Panel release smoke check is now documented in `sanity-tests/playwright/README.md`; it remains QA-only and must not ship in customer artifacts.

- Final Stage 3 accessibility/resilience batch added (pending local verification): four grouped tests named `accessibility resilience - ...` covering keyboard login submission, learner primary-control focusability, completion-dialog focus trap/Escape behavior, and recovery/Exit behavior after leaving the guide target context. Run with `npx playwright test -g "accessibility resilience"`; after this batch passes, run the complete Stage 3 regression once.

- Accessibility/resilience batch first run: **3/4 PASS**. The keyboard-focus test failure was a test-flow issue, not a runtime defect: `#learnerGuideSelect` is intentionally disabled until a topic is selected. The test now follows the real learner dependency chain (focus topic → select Demo CRM → verify/focus guide → select guide → verify/focus Start) before asserting focusability. Re-run the grouped accessibility/resilience batch.

- Final Stage 3 accessibility/resilience batch verified locally: **4/4 PASS**. Stage 3 now proceeds to one complete Playwright regression run before closure.

- **Stage 3 CLOSED / PASS**: complete Playwright regression verified locally with **21/21 tests passing** (40.2s). Coverage includes role isolation, real Demo CRM learner execution, navigation, validations, postback/reload durability, resume/completion, narrow-layout/RTL/enlarged-text checks, and accessibility/resilience checks. The browser-level Chrome Side Panel shell remains the documented release smoke check because it is outside normal Playwright page DOM automation. Stage 4 is the next project phase.

- **Stage 4 started — Grid/Table integration.** Repository inspection confirmed existing grid support already exists in the selector architecture: `selector-builder.js` emits `gwtp-grid:<table>|<column>|<cell-text>` selectors for table cells so identity survives row reordering, and `element-finder.js` resolves them against current `tbody` rows. Demo CRM Customer 360 already performs server-side sorting through `/api/customers/10082?sort=...&direction=...`. First Stage 4 E2E added (pending local verification): it verifies a real server sort request, row reordering, and successful resolution of the same stable GWTP grid selector after rerender. Run with `npx playwright test -g "stage 4 grid"`.

- Stage 4 Grid E2E first local run exposed a **test-context defect**, not a runtime Grid defect: Playwright `locator.evaluate()` executes in the page main world, where the extension content-script helper `findElement()` is intentionally not visible. Test updated to invoke the existing GWTP resolver through `chrome.scripting.executeScript` in the extension/content-script context and matching `TargetContent` frame. Runtime code unchanged. Re-run `npx playwright test -g "stage 4 grid"`.

- Stage 4 Grid E2E second local run exposed another **test-harness context issue**: the test attempted `chrome.tabs.query` from the Demo CRM page, where extension APIs are unavailable. Test corrected to avoid extension APIs from the site page; it now verifies the stable `gwtp-grid` selector contract against the real rerendered table DOM before/after the server-side sort. Runtime remains unchanged. Re-run the Stage 4 Grid test.

- **Stage 4 Grid checkpoint VERIFIED / PASS (2026-09-21):** `npx playwright test -g "stage 4 grid"` → **1/1 passed (4.6s)**. Confirmed Demo CRM Customer 360 server-side sorting issues the expected backend request, rerenders/reorders rows, and the stable GWTP grid selector contract continues to identify the same logical cell after sorting. No runtime change was required for this checkpoint.

- Stage 4 Grid learner E2E added (pending local verification): uses the existing full Demo CRM guide Grid step, prepares sanity learner progress to that step, renders real learner guidance on the Customer 360 grid, triggers real server-side status sorting/rerender, then restores the current step through the existing runner and verifies the newly rendered logical cell is highlighted again. No new Grid runtime mechanism was added; this test verifies the existing stable-grid-selector + learner-render path end-to-end. Run `npx playwright test -g "stage 4 grid"` (now expected 2 tests).

- **Stage 4 Grid learner checkpoint VERIFIED / PASS (2026-09-21):** `npx playwright test -g "stage 4 grid"` → **2/2 passed (6.8s)**. Verified both the stable Grid selector across real server-side sorting/rerender and the real learner guidance path: an active Grid step can be restored after the table DOM is replaced, resolving/highlighting the newly rendered logical cell and keeping the training overlay available.

- Stage 4 Grid editor-authoring E2E added (pending local verification): opens the existing Demo CRM guide in the real editor, creates an unsaved step, uses the real element picker on the Customer 360 status cell, expects `gwtp-grid:#c360-summary-table|4|\"בטיפול מומחה\"`, performs real server-side status sorting, then re-highlights through the editor messaging path to prove the authored selector still resolves after row reorder/rerender. The guide is not saved or mutated by this QA test. Grid group now contains 3 tests.

- Stage 4 Grid editor-picker first local run: 2/3 Grid tests passed. The third failure was a QA assertion that over-specified the table identity as `#c360-summary-table`; the real picker correctly authored `table.ps-table`, which is unique and stable on the page. Test expectation now accepts either valid stable table identity and continues to verify post-sort resolution/highlighting. Runtime code unchanged; rerun pending.

- **Stage 4 Grid authoring + learner checkpoint VERIFIED / PASS (2026-09-21):** `npx playwright test -g "stage 4 grid"` → **3/3 passed (9.1s)**. Coverage now verifies server-side sorting/rerender, stable Grid resolution, real learner guidance restoration, and real editor Element Picker authoring of a stable `gwtp-grid` selector that still resolves/highlights after row reorder. Grid checkpoint is complete; next Stage 4 focus is additional validation coverage.

- Stage 4 validation E2E expansion added (pending local verification): two grouped learner tests now cover the remaining authored validation rules beyond the existing `required` test — `equals`, `not_equals`, `contains`, `changed`, and `changed_regex`. Each rule is tested for a blocked Next path and a corrected/valid path; `changed_regex` additionally checks changed-but-invalid input before accepting a new matching phone value. No new validation feature was added; this is regression coverage of existing runtime behavior.

- Stage 4 validation first grouped run: 0/2 due to two QA-assumption errors, not yet classified as runtime defects. `site-type` has real values `hq`, `branch`, `warehouse` (test incorrectly used nonexistent `office`), now corrected to `hq`. The final `changed_regex` step uses the completion/Finish control rather than ordinary Next semantics; test now verifies Finish remains disabled for unchanged/changed-invalid values and becomes enabled only for a new regex-valid phone value. Runtime unchanged; rerun pending.

- Stage 4 validation rerun: grouped `equals`/`not_equals`/`contains` test PASS. `changed` progressed successfully into final `changed_regex`; remaining failure was a QA expectation mismatch: runtime intentionally leaves Finish enabled and validates on click. Test corrected to assert unchanged and changed-invalid clicks show the authored error and do not complete, while a changed regex-valid value completes. Runtime unchanged; final rerun pending.

- Stage 4 validation rerun: `equals`/`not_equals`/`contains` remains PASS; `changed` and both invalid `changed_regex` paths also reached the expected behavior. The final assertion used a nonexistent `.gwtp-completion-dialog` class; runtime creates the completion modal via its accessibility contract (`role=dialog`, `aria-modal=true`). Test now locates that real contract. No runtime change; rerun pending.

- **Stage 4 validation checkpoint VERIFIED / PASS (2026-09-21):** `npx playwright test -g "stage 4 validation"` → **2/2 passed (9.2s)**. Together with the existing `required` E2E, all currently authored validation rule types are now covered: `required`, `equals`, `not_equals`, `contains`, `changed`, and `changed_regex`, including blocked and corrected paths. No runtime changes were required for this checkpoint.

- Stage 4 Editor→Learner lifecycle E2E added (pending local verification): real editor creates a new unpublished Demo CRM guide, authors a step via the real Element Picker, verifies Preview works while unpublished, saves it, verifies a learner cannot see it, publishes it through the editor availability control, verifies a fresh learner can discover/start it and receive real guidance, then deletes the QA guide so repeated runs do not leave fixtures. Run `npx playwright test -g "stage 4 lifecycle"`.

- Stage 4 lifecycle first local run reached the real Element Picker successfully. The picker authored `input[name="code"]` for the Site Code field instead of the test's over-specific `#site-code` expectation. Both are valid stable selectors for that field, so the QA assertion was corrected to accept either stable identity. Runtime code was not changed; lifecycle test remains pending rerun.

- **Playwright mechanism audit (2026-09-21):** reviewed all 27 current E2E tests with Demo CRM treated as a fixture, not the product under test. Role isolation, learner navigation/progress/resume/completion, validation, responsive/RTL/accessibility/recovery tests already assert GWTP behavior contracts. Stage 4 lifecycle was corrected to accept whatever non-empty selector the real picker authors and prove that GWTP resolves/highlights it, rather than asserting a Demo CRM-specific selector string. Grid editor coverage was likewise relaxed from exact serialized selector identity to the generic `gwtp-grid:` contract plus post-rerender resolution/highlighting. Demo-specific values/selectors remain only where needed to create deterministic fixture conditions or identify the expected logical target. Runtime unchanged. Full/local verification pending.

- Stage 4 lifecycle rerun exposed a QA-test interaction, not a product failure: the generic selector-resolution probe used `GWTP_HIGHLIGHT_ELEMENT`, then immediately started Preview. Preview legitimately created training guidance while the probe's temporary highlight state had not been cleared, producing two guidance overlays in the test frame. The test now explicitly clears the temporary probe/highlight through the public `GWTP_CLEAR_HIGHLIGHT` message before Preview. Runtime unchanged; rerun pending.

- Stage 4 lifecycle duplicate-overlay investigation: the added generic selector probe was removed entirely. The real Element Picker already proves authoring by returning a non-empty selector, while the immediately following real Preview and later learner execution are the stronger generic proof that the authored selector resolves. Calling a separate highlight probe before Preview could trigger messaging reconnection/PAGE_READY timing and was redundant. Lifecycle Preview now explicitly asserts exactly one training overlay, so a genuine duplicate-render runtime defect will fail rather than be masked. Runtime unchanged; rerun pending.

- Stage 4 lifecycle duplicate-overlay failure confirmed a real Preview runtime race, not a Demo CRM-specific test assumption: Preview set its session active before start-URL navigation completed, while top/frame `GWTP_PAGE_READY` events independently restored the same preview step. Concurrent renders could both pass cleanup before either attached its overlay, leaving two guidance bubbles. Fixed globally in `sidepanel.js`: PAGE_READY restore is suppressed while initial Preview navigation/render is in progress, and later Preview PAGE_READY restores are serialized/queued. Lifecycle E2E now requires exactly one overlay. Rerun pending.

- **Stage 4 Editor→Learner lifecycle VERIFIED / PASS (2026-09-21):** targeted Playwright lifecycle rerun passed **1/1 (8.5s)** after the global Preview PAGE_READY race fix. Verified real editor authoring with Element Picker, unpublished Preview, unpublished guide hidden from learner catalog, publish/availability exposure, learner discovery/start, real guidance rendering, and cleanup. The lifecycle assertion remains mechanism-focused: the picker may author any valid non-empty selector; successful Preview/learner rendering proves resolution rather than coupling the test to a Demo CRM selector string. Next checkpoint: full Playwright regression across all current tests.

- Full Playwright regression after Stage 4 lifecycle/Preview fix: **26/27 passed**; only the grouped equals/not-equals/contains validation test failed. Failure showed the test interacted with the next rule before asynchronous step-change rendering had completed, so the second click advanced from the previous rule and the assertion observed the following contains step. This is a test synchronization issue, not evidence of a validation runtime failure: the same validation checkpoint had passed targeted 2/2 and all other regression tests passed. The test now waits for the next rule's guidance after the successful equals transition before exercising not-equals. Runtime unchanged; full rerun pending.

- Second full-regression run remained **26/27** and exposed a real generic learner-render race rather than a fixture assertion issue. After a successful validation move, `GWTP_TRAINING_STEP_CHANGED` can arrive while another restore/render path is still resolving. `showCurrentStep()` invalidates stale renders by version, but concurrent callers can still clear the newly attached instruction content, producing a controls-only overlay (observed as `הקודםהבא`). Fixed globally in `sidepanel.js` by serializing learner step-change renders and coalescing a queued latest step instead of allowing overlapping `showCurrentStep` calls. Demo CRM data/selectors unchanged. Full regression rerun pending.

- Third full-regression run remained **26/27**. Root cause of the repeated validation assertion is now confirmed: guidance instruction HTML was rendered inside a **closed Shadow DOM**, so Playwright/ordinary DOM text APIs correctly saw only the light-DOM navigation controls (`הקודםהבא`) even though the instruction was visually present. This was not a validation-step transition failure. The guidance instruction host already sanitizes author HTML with a strict tag allowlist and strips all attributes, so the unnecessary closed Shadow root was removed and the sanitized instruction is now rendered directly in the overlay DOM. This improves testability and accessibility/DOM semantics without weakening instruction sanitization. Full regression rerun pending.

- Targeted equals validation rerun after exposing instruction text failed again, but now the visible guidance proved the actual defect: one successful learner Next could advance more than one step (the assertion expected the equals error while guidance had already reached not-equals and then contains). Root cause is an ordering race in `training-runner.js`: after `GWTP_TRAINING_NEXT` succeeds, the code previously fired `GWTP_TRAINING_PENDING_CLEAR` without awaiting it and immediately emitted `GWTP_TRAINING_STEP_CHANGED`. A readiness/restore path could still observe the old pending intent and resume the same move again. Fixed globally by clearing the completed pending-navigation intent first and only then notifying the new learner step. Targeted validation rerun pending.

- Repeated targeted equals failure exposed the earlier root cause: learner Next/Previous persisted `pending-navigation` on pointerdown **before validation**. Therefore an intentionally invalid click (for example equals expecting `branch` while the field is `hq`) briefly created a valid resumable move intent; concurrent PAGE_READY/restore handling could consume it before the validation-failure path asynchronously cleared it, advancing despite failed validation. Fixed globally in `training-runner.js`: pointerdown/keyboard now only capture the business field focus; validation runs first; only a successful validation persists the navigation intent, awaits durable storage, and then permits blur/postback/navigation. This preserves the postback-safety contract without allowing failed validation to create a pending move. Targeted validation rerun pending.

- Follow-up targeted equals run confirms the pending-intent race is fixed: after satisfying equals, GWTP now lands on the not-equals step and remains there. The remaining failure was an incorrect E2E expectation that demanded the not-equals **validation error before any invalid attempt had been made**. The test now waits for the not-equals rule guidance first, then deliberately submits the invalid value and asserts its validation error. Runtime unchanged by this follow-up; targeted rerun pending.

- Targeted Stage 4 equals/not-equals/contains validation rerun after the pending-intent fix and corrected transition assertion: **1/1 passed (6.7s)**. The previously failing path is now verified. Full 27-test Playwright regression is the remaining closure check.

- **Stage 4 full Playwright regression VERIFIED / PASS (2026-09-21): 27/27 passed (56.6s).** This closes the current Stage 4 regression checkpoint after the lifecycle/Preview, Grid, validation, learner pending-navigation, and guidance-DOM fixes. All current browser E2E tests pass together. The real Chrome Side Panel browser-shell release smoke check remains a separate manual release boundary as documented in the Playwright README.

- Stage 4 closure hardening batch prepared (pending local verification): lifecycle E2E now covers unpublished hidden → publish visible/runnable → unpublish hidden again; lifecycle-created QA guides are cleaned in `finally` after persistence so assertion failures do not normally leave fixtures; Playwright `node_modules`, reports, test-results and blob-report outputs are now ignored by Git. Deployment boundary reviewed: `deploy-gwtp-service.bat` publishes only `server/GWTP.Api/GWTP.Api.csproj` into a temporary API staging directory and mirrors that directory to `%ProgramData%\\GWTP\\Api`, so `sanity-tests` is not part of the deployed API artifact. Next verification: targeted lifecycle test, then full Playwright regression.

- Stage 4 hardened lifecycle targeted verification: **1/1 passed (9.5s)**. Verified unpublished hidden → published visible/runnable → unpublished hidden again, with the new resilient cleanup path in place. Final closure check is a complete Playwright regression.

- **Stage 4 CLOSED / PASS (2026-09-22): final hardened Playwright regression 27/27 passed (58.4s).** Closure includes Grid authoring/runtime resilience, complete authored-validation coverage, Editor Preview/publish/unpublish → Learner lifecycle, resilient lifecycle fixture cleanup, pending-navigation/postback correctness, accessibility/layout regression, and QA/deployment artifact separation. The real Chrome Side Panel browser-shell smoke check remains a documented release-time boundary. Stage 5 is the next project phase.

- Stage 4 filter regression batch added (pending local verification): four Playwright E2E tests now cover Admin user-role filtering, Editor guide Topic filtering, Editor guide Availability filtering, and guide-step Screen filtering. The Screen test also verifies filtering is visibility-only by restoring the exact original step sequence after returning to All screens. `PROJECT_CONTEXT.md` now records all four filter contracts so they remain part of the repository source of truth. Run `npx playwright test -g "stage 4 filters"` before the next full regression.

- Stage 4 filter targeted run (2026-09-22): Topic and Availability tests passed; the initial Admin-role and Step-Screen tests exposed test-assertion defects rather than runtime filter failures. Admin filtering can legitimately return multiple editor/learner accounts, so the test now verifies every visible regular-user card has the selected role while checking the sanity accounts explicitly. Step cards contain nested `<strong>` elements inside instruction content, so the Screen test now counts `.step-item` cards and compares their stable `data-step-id` sequence instead of counting all descendant `strong` elements. Corrected filter batch was re-run successfully: 4/4 PASS (7.0s).

- Stage 4 filter regression checkpoint verified (2026-09-22): all four targeted filter E2E tests PASS (4/4, 7.0s): Admin role, Guide Topic, Guide Availability, and Step Screen/order-preservation.

- Stage 4 post-filter full regression verified (2026-09-22): 31/31 Playwright tests PASS (1.0m). This includes the four filter regressions plus all previously closed Stage 4 validation, lifecycle, Grid, navigation, accessibility, layout, resume, completion, and postback coverage. Stage 4 remains CLOSED / PASS; Stage 5 is the next project phase.

- **Stage 5 Management CRUD E2E started (2026-09-22; pending local verification):** added three UI-driven Playwright lifecycle tests that deliberately use the extension management interface rather than direct API setup for the behavior under test. Admin test covers create user → verify role → edit display name/role/active state → delete. Topic test covers create → rename → delete. Guide/Step test covers create guide → author a real picked step → persist → reopen/edit persisted instruction and ScreenName → persist/reopen verification → delete persisted step → delete guide. All generated entities use unique timestamped names and best-effort UI cleanup. First checkpoint VERIFIED: `npx playwright test -g "stage 5 management CRUD"` passed 3/3 (10.2s).

- **Stage 5 Management CRUD targeted checkpoint VERIFIED / PASS (2026-09-22): 3/3 passed (10.2s).** Verified UI-driven User CRUD, Topic CRUD, and Guide + persisted Step create/edit/reopen/delete lifecycle. Next checkpoint is the complete Playwright regression including these new management tests.

- **Stage 5 Editor-management second E2E batch added (2026-09-22; pending local verification):** added dedicated Preview coverage for a two-step unsaved editor guide: real target rendering, Preview progress 1/2→2/2, required validation blocking Next, successful Next, Previous, Exit Preview, overlay removal and highlight cleanup. Added persisted two-step reorder coverage using the editor's keyboard-accessible reorder control and reopen verification, plus delete-confirmation Cancel coverage proving an entity is preserved until deletion is explicitly confirmed. Run `npx playwright test -g "stage 5 editor"` as the next targeted checkpoint. Full regression remains deferred until this management batch is verified.

- **Stage 5 editor batch first run (2026-09-22):** 2/3 passed. Persisted step reorder and delete-confirmation Cancel passed. Preview flow reached Exit Preview correctly in Side Panel state, but cleanup assertion failed because the Playwright harness hosts the Side Panel as a normal extension tab; bringing that tab forward changed Chrome's active tab, so `sendToAllFrames` targeted the extension tab rather than the Demo CRM. This differs from the real Chrome Side Panel shell, which does not replace the active web tab. The test was corrected to keep Demo CRM active while programmatically dispatching the Side Panel Exit control; no production runtime change was made. Targeted 3-test rerun pending.

- **Stage 5 Preview cleanup defect found on second targeted run (2026-09-22):** 2/3 passed again. Exit Preview now correctly removes the training overlay, proving the active-tab harness correction works, but the selected target retained a 3px outline. Root cause: the same element could still carry the editor picker's `data-gwtp-highlighted` state; `clearTrainingStep()` removed the training outline but did not clear that independent picker-highlight state. Runtime fix: when the active training target also carries the picker highlight marker, `clearTrainingStep()` delegates to `clearHighlight()`, restoring/removing the stored outline state before releasing the training target. Targeted Stage 5 editor rerun pending; do not mark the batch verified yet.

- **Stage 5 editor batch third run diagnosis (2026-09-22):** delete-confirmation Cancel passed. Preview overlay cleanup passed, but the final test assertion still read a computed 3px outline on the focused input. The assertion was too broad: computed outline can include the page/browser native focus ring even after GWTP has removed its inline training highlight. The test now verifies the actual GWTP-owned inline `outline` and `outline-offset` properties are empty after Exit Preview. The persisted reorder test also hit the global 30s timeout in this run after previously passing in ~3s; no product defect is concluded from that isolated timeout. Rerun the targeted editor batch to distinguish transient timing from a reproducible reorder issue.

- **Stage 5 Editor-management targeted checkpoint VERIFIED / PASS (2026-09-22): 3/3 passed (11.2s).** Verified dedicated Editor Preview navigation/required-validation/Previous/Exit cleanup, persisted step reorder across guide reopen, and delete-confirmation Cancel behavior. This closes the second Stage 5 targeted batch; full regression remains pending until the remaining planned management-validation/dependency coverage is assessed.

- **Stage 5 management validation/dependency E2E batch added (2026-09-22; pending local verification):** three targeted tests now cover Admin User required fields, invalid username characters, invalid password whitespace, case-insensitive duplicate username rejection and cleanup; Topic required/duplicate validation plus referential-integrity behavior that blocks deleting a Topic while a Guide is assigned and permits deletion after the Guide is removed; Guide authoring guards for incomplete identity, availability-without-steps rejection, Step instruction-required validation, and successful available Guide save once a valid Step exists. Run `npx playwright test -g "stage 5 management validation"` before full regression.

- **Stage 5 management-validation first run (2026-09-22): 2/3 passed.** User-form validation and Topic duplicate/dependency protection passed. Guide/Step validation timed out because the test attempted to click `Save Step` while the product correctly keeps that button disabled when Instruction is empty. Test corrected to assert the proactive disabled state, then fill Instruction, assert the button becomes enabled, and continue the valid-save path. No production change was required; targeted rerun pending.

- **Stage 5 management-validation targeted checkpoint VERIFIED / PASS (2026-09-22): 3/3 passed (10.9s).** Verified Admin User required/format/password/duplicate-identity guards, Topic required/duplicate and Guide-dependency deletion protection, and Guide/Step authoring guards including availability-without-steps plus proactive required-Instruction enforcement. Stage 5 now has 9 targeted tests verified across CRUD, Editor Preview/management integrity, and management validation/dependencies. Full Playwright regression remains pending.

- **Stage 5 full-regression attempt (2026-09-22): 39/40 passed (1.9m).** The only failure was `stage 5 editor management - persisted step reorder survives reopening the guide`, which hit the global 30s test timeout without an assertion/call-site failure. The same test previously passed in the targeted 3/3 Editor batch (11.2s total), while all other 39 tests passed in this full run. Stage 5 is therefore NOT closed yet. Investigation is focused on the reorder test's asynchronous persistence/timing path under the full suite; do not mask it by globally increasing the timeout.

- **Stage 5 reorder regression synchronization fix (2026-09-22; pending verification):** the flaky persisted-reorder E2E now explicitly starts waiting for the guide-steps `PUT /api/guides/{id}/steps` before sending the keyboard reorder command, verifies the response succeeds and the Editor reports `stepsSaved`, and only then leaves/reopens the Guide. This removes the test race between the UI reorder and its asynchronous persistence without increasing the global timeout or changing production behavior. Targeted reorder rerun required before another full regression.

- **Stage 5 reorder isolated rerun after network-wait change (2026-09-22): still timed out at 30.2s.** Because the run emitted no assertion/call-site failure, the test was still waiting inside its interaction path. The test harness has now been corrected for the same Side-Panel-as-tab boundary already identified in Preview testing: instead of Playwright `locator.press("ArrowUp")`, which depends on the extension tab being the active browser page, it dispatches the same bubbling/cancelable `keydown` event directly to the drag handle in the panel DOM. Verification remains product-facing: immediate reordered UI, `stepsSaved` success after async persistence, then guide reopen and persisted-order check. Production code and global timeout remain unchanged; isolated rerun pending.

- **Stage 5 reorder diagnostic hardening (2026-09-22; pending rerun):** the isolated reorder test still timed out after 30.1s even after deterministic DOM keyboard dispatch, so generic waiting is no longer useful. The test now uses a 20s test ceiling and a 4s default Playwright action/assertion timeout for the Side Panel, with an explicit login diagnostic step. The purpose is to force the next failure to identify the exact blocked locator/action instead of ending only with the suite-wide 30s timeout. This is diagnostic test-only instrumentation; production behavior is unchanged.

- **Stage 5 persisted-reorder isolated checkpoint VERIFIED / PASS (2026-09-22): 1/1 passed (10.3s).** With the fast diagnostic guard in place, the complete persisted-reorder path succeeded: authoring, keyboard reorder handler, asynchronous step persistence, guide reopen, and persisted order. The earlier 30s hangs are not currently reproducible in the isolated test. Full 40-test regression is still required before Stage 5 can close.

- **Stage 5 CLOSED / PASS (2026-09-22): full Playwright regression 40/40 passed (1.5m).** This closes the Management CRUD E2E stage after the verified targeted batches for User/Topic/Guide/Step CRUD, Editor Preview and management integrity, management validation/dependencies, and persisted Step reorder. The final full suite also re-verified all previously closed Stage 3/4 learner, validation, navigation/postback, resume/completion, layout/accessibility, lifecycle, filter, and Grid coverage. The real Chrome browser-shell Side Panel smoke remains a release-time boundary outside normal Playwright page-DOM automation.

## Stage 6 — Release/readiness verification

- **Stage 6 started (2026-09-22).** Repository review after Stage 5 closure found no unclosed functional E2E milestone in the current roadmap. The remaining explicit verification boundaries are release/readiness checks that normal Playwright page-DOM automation cannot fully prove.
- Stage 6 scope is therefore release/readiness verification rather than adding product behavior: (1) real Chrome browser-shell Side Panel smoke using the documented six-step checklist, and (2) remaining runtime accessibility verification called out by the existing accessibility audit (rendered-state contrast/reflow/zoom and screen-reader checks).
- The real Side Panel smoke remains intentionally manual because Playwright opens the Side Panel document as an extension tab and cannot assert Chrome's browser-level Side Panel container. Do not weaken this boundary by treating the existing 40/40 page-DOM regression as proof of browser-shell behavior.
- Element Picker full keyboard parity remains intentionally deferred by the existing architecture decision; manual CSS selector entry remains the keyboard-accessible authoring fallback and is not a Stage 6 blocker.
- **Immediate next checkpoint:** execute the documented real Chrome Side Panel six-step smoke against the current 40/40 build, record each result, then assess the remaining runtime accessibility checks. Stage 6 remains OPEN until these release/readiness boundaries are explicitly verified.

- **Editor Step-card ScreenName metadata added (2026-09-22; pending targeted verification):** step cards now show the localized `Screen name: <value>` / `שם מסך: <value>` metadata directly below the step header when the persisted `ScreenName` is non-empty. Empty ScreenName values do not add visual metadata. Styling keeps it secondary to the step title/instruction. The existing Stage 4 Screen-filter E2E now also verifies the metadata is rendered from the Demo CRM ScreenName data. Run `npx playwright test -g "stage 4 filters - step screen"` before continuing the Stage 6 release smoke.

- **Editor off-screen Step metadata editing fixed (2026-09-22; pending targeted verification):** updating an existing Step no longer requires the live application to be on that Step's target screen when the target itself is unchanged. The Editor now performs live target validation for new Steps and when the persisted selector/frame target changes; metadata-only edits such as ScreenName, Instruction, or authored Validation can be saved from another application screen. This preserves target validation when an author selects/replaces an element while removing the unnecessary coupling between guide maintenance and external business-page state. Added a Stage 5 E2E regression that edits/restores ScreenName while an unrelated browser page is active. Run `npx playwright test -g "metadata-only step edit"` as the targeted verification.

- **Editor off-screen Step metadata targeted checkpoint VERIFIED / PASS (2026-09-22):** the dedicated `metadata-only step edit` Playwright regression passed after the target-validation separation change. Existing persisted Step metadata can therefore be updated while another application screen/page is active, without requiring the unchanged target element to be present. Broader Editor regression remains the next checkpoint before returning to Stage 6 release/readiness smoke.

- **Editor off-screen highlight error handling hardened (2026-09-22; pending targeted re-verification):** opening an existing Step still attempts best-effort highlighting on the active application page, but a page without a GWTP content-script receiver can no longer surface an unhandled `Could not establish connection. Receiving end does not exist.` rejection from the Step-card click/keyboard handler. Step editing remains available independently of highlight availability. The off-screen metadata E2E now also opens the Step while an unrelated page is active and asserts that no matching page error is emitted.

- **Editor off-screen highlight/metadata targeted checkpoint VERIFIED / PASS (2026-09-22):** the updated `metadata-only step edit` regression passed after hardening Step-card highlight handling. This verifies that an existing Step can be opened and its metadata saved while an unrelated page is active without an unhandled missing-receiver error. Broader Stage 5 Editor regression is the next checkpoint before resuming Stage 6 release/readiness smoke.

- **Stage 5 Editor regression after off-screen metadata/highlight changes VERIFIED / PASS (2026-09-22):** the targeted `stage 5 editor` Playwright group passed after the ScreenName card metadata, off-screen metadata editing, and best-effort highlight error-handling changes. Editor regression is clear; Stage 6 release/readiness verification can resume.

- **Element Picker feedback localization fixed (2026-09-22; pending targeted verification):** Editor Element Picker status/error messages are no longer hard-coded English. `Selection mode active`, picker-start failure, and page-control-unavailable feedback now use the shared HE/EN i18n service. The off-screen Editor Playwright regression now also triggers picker startup on an unrelated page and verifies Hebrew failure feedback with no leaked English message. Run `npx playwright test -g "metadata-only step edit"` before broader Editor regression.

- **Element Picker localization targeted checkpoint VERIFIED / PASS (2026-09-22):** `metadata-only step edit` passed with the new HE/EN picker feedback assertion. The previously hard-coded `Could not start selection mode.` path is now regression-covered. Broader Stage 5 Editor regression remains the next checkpoint before current post-change build is considered regression-verified.

- **Element Picker error UX corrected (2026-09-22; pending targeted verification):** picker feedback now renders in a dedicated live status immediately below the Editor's Select Element button instead of the generic Step status at the bottom of the form. Failure copy now explains the primary recovery action (reload the target page and retry), while browser-internal-page limitations are retained for transport/control failures. This addresses normal http/https pages such as Google that may have been open across an extension reload. Playwright now asserts the localized failure is visible in the picker area and does not leak into the generic Step status. Run `npx playwright test -g "metadata-only step edit"`.

- **Element Picker error UX targeted checkpoint VERIFIED / PASS (2026-09-22):** after reloading the extension and target page, Element Picker works on the target web page and the updated picker-area feedback flow is confirmed. The related targeted Playwright checkpoint was also reported working; proceed to broader Editor/full regression before final post-change verification.

- **Post-Editor-change full regression VERIFIED / PASS (2026-09-22):** the full `npm test` regression passed after the ScreenName metadata display, off-screen Step metadata editing, missing-receiver highlight hardening, Element Picker localization, and picker-status UX changes. Current automated regression is clear; Stage 6 release/readiness verification resumes from the real Chrome Side Panel smoke.
