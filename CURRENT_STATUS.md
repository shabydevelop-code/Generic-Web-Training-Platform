# GWTP Current Status

Last updated: 2026-09-21

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

## Immediate next tasks
1. Verify `deploy-gwtp-service.bat` on the next backend code change; the initial Windows Service installation and extension connectivity are already verified.
2. Continue accessibility verification with contrast measurement, 200%/400% zoom and reflow testing, then screen-reader regression testing.
