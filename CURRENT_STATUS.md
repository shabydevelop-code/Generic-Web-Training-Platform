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
- Connection restoration probes the content-ready marker before reinjection.
- Exit cleanup does not restore/reinject content scripts.
- `restoreActiveStep()` only displays a step when its target exists.
- Duplicate reinjection was identified as the source of repeated top-level declaration errors and was hardened.
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

## Validation — implemented, but regression coverage is still open
Current runtime supports:
- `required`
- `regex`
- `changed`
- `changed_regex`

Validation blocks Next when the current value is invalid. Changed-based validation stores a baseline for the active validation session so the learner must actually change the field. `changed_regex` requires both a changed value and a matching format.

Previously implemented/tested examples included changed-value behavior and a phone-format `changed_regex` scenario. However, validation work was interrupted by learner progress/Resume/recovery work. A systematic regression pass of all validation modes and their behavior across postback/page restoration has not yet been completed.

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

## Immediate next tasks
1. Pull and restart the API, then run the validation regression guide end-to-end.
2. Resolve the authoring/API discrepancy for `changed_regex`: runtime supports it, but the normal editor/backend validation path does not yet expose/accept it.

- Messaging connection restoration is now frame-idempotent: all-frame recovery probes each frame and injects the content bundle only into frames where GWTP is not already ready.
