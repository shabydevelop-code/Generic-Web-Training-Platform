# GWTP Current Status

Last updated: 2026-09-20

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

## Immediate next tasks
1. Review remaining editor/learner UX gaps before adding new capabilities.
