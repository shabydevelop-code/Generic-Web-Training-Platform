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
- Testing priority: user-visible behavior must be verified primarily through GUI/browser E2E using the same public UI path as the user. Direct API/backend tests are appropriate when the behavior under test is specifically a backend responsibility (for example HTTP authentication/authorization, API contracts, migrations/schema, database constraints, or behavior with no UI surface). Source-level assertions may protect architectural invariants, but they must not be treated as proof that a user-visible feature works end to end. Test fixture setup may use APIs only when the setup itself is not the behavior being tested.
- Work incrementally and avoid partial-code patches when a complete coherent change is required.

### Async UI / E2E race prevention
- Treat failures that appear only in the full Playwright suite but pass in isolation as a signal to investigate asynchronous state leakage, overlapping requests, lifecycle events, shared browser/extension state, or stale DOM renders before changing assertions or increasing timeouts.
- Do not use arbitrary sleeps or larger timeouts to hide races. Synchronize tests with observable GUI state (for example visible + enabled controls, target availability, page/frame readiness) and fix product-side races when stale asynchronous work can mutate the UI.
- Any async UI loader that can be triggered again before a previous invocation finishes (filters, login initialization, reloads, navigation/lifecycle events) must prevent an older response from overwriting or appending to newer state. Use an explicit latest-request/generation guard, cancellation mechanism, or equivalent ownership rule.
- Clear/render timing matters: clearing a list before an awaited request does not prevent duplicates when two loads overlap; both can later append. The request that is still current should own the final clear/render operation after the await.
- Regression lesson (2026-09-24): Admin login started `loadAdminUsers()`, while an immediate role-filter change started a second load. Both calls cleared the list before awaiting `/api/users`, then both appended results when their responses returned, so Playwright observed two `GWTP Sanity Editor` cards although SQLite contained one user. The fix added a monotonically increasing load generation and discards stale responses before rendering. A separate dynamic-iframe regression showed the same general principle on lifecycle state: wait for the post-`PAGE_READY` overlay to be stable and Next to be enabled rather than racing a transient disabled/detached control.


## Product
### Product naming
- GWTP = **Generic Workplace Training Platform**.
- The former expansion **Generic Web Training Platform** is retired because Web is now one supported runtime rather than the scope of the whole product.
- Existing technical identifiers that already use the `GWTP` acronym remain unchanged.

GWTP stands for Generic Workplace Training Platform. It is a generic workplace-training platform whose learner controller is the Chrome/Edge side-panel extension and whose runtimes can guide both live Web applications and Windows desktop applications.

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
- Guide steps may explicitly use `TargetType=none` for instruction-only guidance. These steps require an instruction but no selector/frame, cannot carry element validation, and render guidance without highlighting a page element.

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
- Architecture and shared behavioral contracts take precedence over local UX fixes. Before introducing role-, screen-, or runtime-specific behavior, first determine whether the behavior belongs to a shared domain/execution concept.
- Prefer one shared model, state transition, and execution flow when Learner, Editor Preview, Web, or Windows are expressing the same domain behavior. Presentation may differ only when a concrete functional requirement requires it; visual inconvenience alone is not a reason to fork the underlying flow.
- Solve problems in this order: (1) preserve domain invariants and the shared architecture, (2) preserve responsibility boundaries and state ownership, (3) reuse the shared execution contract, (4) adapt presentation/UX, and only then (5) introduce a specialized path when the shared model cannot satisfy a real requirement.
- Editor Preview is a simulation mode of the learner execution contract, not a separate training product flow. It should reuse learner-visible lifecycle behavior wherever the semantics are the same, while isolating only side effects such as LearnerProgress persistence.
- When a local fix appears easier than a shared architectural solution, explicitly evaluate the shared solution first. Do not duplicate state, lifecycle logic, or UI behavior merely to fix one view.
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


## Cross-runtime guide start and step ownership

- Guides do not own or launch a start URL/application. StartUrl is retired.
- Every guide has a required StartInstruction shown before a new Start or Start Again. It prepares the learner to open/navigate to the relevant work environment.
- The start instruction is guide metadata, not a progress step: it has no target/validation and Resume does not replay it.
- Web-only, Windows-only, and mixed Web/Windows guides remain a target architecture requirement. Step-level runtime/Windows target identity will be introduced together so the model does not encode a partial Windows step.
- Runtime transitions are environment-driven. A Web business action may launch a Windows application (or vice versa); GWTP waits for the next step's runtime/target instead of launching or replaying the business action itself.

### Shared guide-start execution contract
- StartInstruction belongs to guide execution, not to the Learner view or Editor view.
- Fresh Learner Start, Learner Start Again, and Editor Preview must use the same modal presentation and the same explicit confirmation/cancel interaction before step 1.
- The execution modes diverge only after confirmation: Learner execution may create/update LearnerProgress, while Editor Preview remains local and must not create or mutate LearnerProgress.
- Resume from InProgress restores the saved step directly and does not replay StartInstruction.
- Keep this start contract shared across future Web, Windows, and mixed-runtime execution rather than creating runtime- or role-specific start UX.

## Shared Web + Windows step contract (2026-09-26)

- Runtime ownership belongs to each GuideStep, not to Guide and not to TargetType. Supported runtime values are `web` and `windows`; a guide's Web/Windows/Hybrid classification is derived from its steps rather than persisted as a manually selected guide type.
- `TargetType` keeps its existing semantic meaning: `element` or `none`. It must never be reused as the runtime/platform discriminator.
- A GuideStep has runtime-neutral learning fields (order, instruction, screen name, target type, validation) plus a runtime-specific target descriptor when `TargetType=element`.
- Web element targeting remains Web-specific data: CSS selector plus frame identity. These fields must not become requirements for Windows steps.
- Windows element targeting must use a Windows/UIA descriptor rather than overloading the Web selector. The current Windows runtime proves the initial identity ingredients (process name, AutomationId, Name, ControlType, current-session process scoping), but hierarchy/fallback identity still needs to be hardened before the persisted Windows target DTO/schema is finalized.
- Instruction-only steps (`TargetType=none`) require no element target. Their runtime still matters because it determines which runtime presents the guidance during a mixed guide.
- Do not add a database migration merely to introduce a runtime field while the Windows target DTO is unresolved. Define the typed target contract first, then migrate DB/API/Editor/runtime coherently in one production-compatible slice.
- Existing Web guides must migrate compatibly to runtime `web`; no editor-authored manual Guide.Platform field is planned.

## Production Windows Target Descriptor frozen (2026-09-26)

- The first production Windows target contract is now defined in `WINDOWS_TARGET_DESCRIPTOR.md` and supersedes the earlier "descriptor unresolved" state.
- Persisted Windows identity is: ProcessName + separate top-level Window descriptor + Element descriptor + an ordered nearest-to-farthest meaningful ancestor path.
- Element ControlType is required. AutomationId is the preferred stable discriminator; Name is a strict fallback only when that descriptor has no authored AutomationId. When AutomationId exists, Name is diagnostic metadata and a runtime Name change must not invalidate the target.
- Do not persist PID, HWND, SessionId, bounds, RuntimeId or other transient process/window state. Current Windows SessionId remains runtime scoping only.
- Resolution must be deterministic and fail safe: zero matches => unavailable/pending; multiple indistinguishable matches => ambiguous/pending; never select an arbitrary target.
- The next implementation slice is now DB/API/Editor/runtime integration of the frozen shared GuideStep runtime + typed target contract, with compatible migration of existing Web steps to runtime `web`.


## Shared step persistence implemented (2026-09-26)

- The main API/database now persists GuideStep `Runtime` and typed `WindowsTarget` data. Existing databases are upgraded at API startup; existing/blank runtime values normalize to `web`.
- Fresh schema defines `Runtime TEXT NOT NULL DEFAULT 'web'` with `web|windows` values and a separate nullable `WindowsTarget` JSON payload. Web Selector/FrameTarget remain separate legacy-compatible Web fields.
- API request/response DTOs now carry `runtime` and `windowsTarget`. Runtime-specific validation requires a selector for Web element steps and a valid Windows descriptor for Windows element steps; Windows targets cannot smuggle Web selector/frame identity.
- Instruction-only steps remain targetless but still carry runtime.
- The Editor's in-memory step model and save paths round-trip runtime/WindowsTarget so future Windows data is not erased by guide reorder/metadata saves before Windows authoring UI is added.
- Database health exposes whether the two migration columns exist, and `gwtp-sanity.ps1` requires both.
- Windows authoring UI and Windows execution handoff are not implemented by this persistence slice. The next slice is the Editor/Windows-runtime bridge and GUI authoring flow.
