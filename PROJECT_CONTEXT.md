# GWTP Project Context

## Working model
- GitHub repository is the source of truth: `shabydevelop-code/Generic-Web-Training-Platform`.
- Local working copy: `C:\\yossi\\ChatGpt\\Generic-Web-Training-Platform`.
- ChatGPT inspects and updates the GitHub repository; the developer syncs changes with `git pull`.
- Do not use ZIP delivery for normal project changes.
- Database changes and test fixtures must be delivered through versioned GitHub repository changes. Do not use manual replacement of `database/GWTP.db` as the normal workflow; the developer should receive them with `git pull origin main`.
- One-time database content changes should use versioned migrations recorded in `SchemaMigrations`; do not keep permanent startup seed logic that repeatedly checks whether test/demo content exists.
- Inspect current repository files before changing code.
- When changing Editor/Admin management UI or behavior in the extension (Topics, Guides, Steps, Users, filters, validation, authoring, publish/availability, Preview, or related management flows), review the relevant Playwright E2E coverage in the same change set. Update or add tests when the behavior/DOM contract changes, run the targeted affected test group first, then run the full regression before considering the change verified. A UI change is not complete if its existing management tests are knowingly stale or broken.
- Work incrementally and avoid partial-code patches when a complete coherent change is required.

## Product
Generic Web Training Platform is a Chrome/Edge side-panel extension for authoring and running guided training over live web applications.

Main capabilities include element selection/highlighting, guide steps, Write/Click/None actions, validation, Previous/Next navigation, learner/editor/admin roles, learner preview, Topics, Guides and Users.

Backend: .NET API + SQLite.
Local API: `http://localhost:5000`.
Database:
- Interactive/local development fallback: `database/GWTP.db` in the repository when `GWTP_DATA_PATH` is not configured.
- Installed Windows Service: `C:\\ProgramData\\GWTP\\Data\\GWTP.db`, supplied through `GWTP_DATA_PATH`.
- When diagnosing the Windows Service, always inspect the ProgramData database rather than the repository database.

## UI rules
- Hebrew and English must be supported cleanly, including RTL/LTR separation.
- Do not mix interface languages unnecessarily.
- Keep spacing consistent across forms, cards, controls and sections; avoid one-off margin fixes when a shared spacing rule can be used.
- Maintain the established visual hierarchy and component behavior.
- UI text should be localized through the existing i18n mechanism.
- Learners see published guides only; editor Preview may run unpublished guides.
- Tabs/screens should be lazy-loaded where applicable rather than rendering all application screens at startup.
- Admin user management includes a role filter for All / Editors / Learners; administrators remain in their dedicated section.
- Editor guide library includes client-side filters for Topic and learner Availability over the existing guides API result.
- Editor guide steps include a Screen filter populated from explicit `ScreenName` values. This filter changes list visibility only; it must not change `StepOrder` or persisted guide data.

## Learner navigation architecture
- During an active guide, the learner moves only with Previous/Next; there is no arbitrary step jumping.
- GWTP owns learning progress. The external live application owns its business/session/page state.
- GWTP must not automatically reconstruct business state by replaying old clicks.
- Existing `pending-navigation` logic handles live DOM destruction/postbacks during active training.
- Progress must not advance until the destination step can actually be shown.
- Input validation can block Next.

## Resume design
- No previous progress: start at step 1.
- InProgress: offer Continue from saved step or Start over.
- Completed: start over rather than Resume.
- Continue uses the saved progress position but does not attempt to reconstruct the external application's previous business state.
- If the saved step target is not available on the current screen, preserve progress and report that the required element is unavailable.
- The learner can navigate the live application manually and retry.
- Start over resets only the selected guide's learning progress and begins at step 1.

## Missing element behavior
- A missing target must never silently advance progress.
- Do not use arbitrary time-based polling to wait for business target elements. Active navigation waits on page/frame readiness and checks actual target availability before advancing progress.
- Learner-facing state: explain that the required element is not available on the current screen and offer Retry / Exit guide.
- Editor Preview may additionally expose technical selector information.
- The existing active-navigation/postback mechanism should remain separate from old-session Resume.

## Code architecture
- Prefer global/architectural solutions over local hacks.
- Keep responsibilities separated between side panel UI, learner runner, content/overlay logic, background training engine, services and backend.
- Preserve existing server-side progress infrastructure unless a backend change is actually required.


## Repository maintenance rule
- Every functional or architectural code change must update `CURRENT_STATUS.md` in the same change set so the repository status remains the source of truth.
- `CURRENT_STATUS.md` must describe what is implemented and verified, what remains open, and the immediate next task.
- Do not leave completed work described as pending.


## Validation responsibility
- GWTP validates only learning-specific conditions explicitly configured by the guide author, such as `required`, `regex`, `changed`, and `changed_regex`.
- Business validation belongs to the live business application. GWTP must not duplicate, infer, or replace business rules enforced by systems such as PeopleSoft.
- If blur, change, click, or another learner action triggers business validation, a postback, frame reload, or DOM replacement, GWTP must allow the business application to perform that validation and preserve the learning/navigation state across the transition.
- GWTP should react to the resulting page/DOM state through the existing page-ready, target-availability, and pending-navigation architecture rather than deciding whether the business validation itself succeeded.
