# GWTP Test Architecture

## Goal

Organize regression coverage by the capability being verified, not by the web page that happens to be open during the test. Demo CRM is an integration fixture, not a default host for unrelated GWTP tests.

## Test families

### 1. Backend / API

Owns server behavior without browser UI concerns.

- Infrastructure and health
- Authentication and authorization
- Users CRUD
- Topics CRUD
- Guides CRUD
- Steps CRUD
- Learner progress persistence and API contracts

API CRUD does not replace UI CRUD.

### 2. Extension UI

Owns user-visible Side Panel behavior.

- Login/logout UI and role-specific views
- Users CRUD through Admin UI
- Topics CRUD through Editor UI
- Guides CRUD through Editor UI
- Steps CRUD through Editor UI
- Filters, reorder, publish/availability and form states
- Localization, RTL/LTR and accessibility of extension controls

### 3. Authoring / Learner Runtime

Owns GWTP behavior while authoring or running a guide.

- Element Picker
- Preview
- Validation authoring and execution
- Start, Continue/Resume, Restart, Complete and Exit
- Next/Previous
- Recovery from missing targets
- Runtime progress synchronization

These tests should prefer a small deterministic fixture unless the behavior explicitly depends on a business application.

### 4. On-Page Engine

Owns interaction with arbitrary modern web pages.

- Selector resolution and highlight
- SPA state changes
- DOM replacement
- Dynamic iframe creation
- Targets inside frames
- Native document navigation

`dynamic-app.html` is the preferred fixture for these behaviors.

### 5. Business-System Integration (Demo CRM)

Demo CRM is reserved for behaviors that genuinely require server-backed/business-system semantics.

- Server postback/reload
- Real server save followed by reload
- Cross-screen business navigation such as Site -> Case
- Frame reload caused by the host application
- Server-rendered/server-sorted Grid behavior
- Business application interactions whose behavior cannot be represented faithfully by the deterministic fixture

## Deterministic fixtures

- `site/gwtp-test-fixture.html` is the lightweight fixture for generic Extension UI, authoring, validation and learner-runtime scenarios. It intentionally has no CRM API calls, postbacks, frames or business behavior.
- `site/dynamic-app.html` owns modern-web behavior such as SPA changes, DOM replacement, dynamic frames and real navigation.
- Demo CRM pages are reserved for business-system integration coverage.

## Duplication rules

Overlap is justified when different layers are being verified. For example, `POST /api/topics` and creating a Topic through the Editor UI are separate requirements.

A test should not use Demo CRM merely because a convenient seeded element or guide already exists there. If the assertion is about GWTP UI, accessibility, generic validation, lifecycle, or generic DOM behavior, prefer an extension-only or deterministic on-page fixture.

Long setup flows should not repeatedly re-test earlier capabilities just to reach the assertion under test. Shared fixture/setup helpers may establish prerequisite state directly when that prerequisite already has dedicated coverage.

## Refactor order

1. Keep genuine Demo CRM integration tests unchanged: server save/reload, Site -> Case, postback/frame reload and server-side Grid.
2. Move generic Guide/Step CRUD, Preview and validation scenarios to `gwtp-test-fixture.html`.
3. Move generic learner lifecycle/resilience scenarios to the deterministic fixture where they do not depend on CRM behavior.
4. Keep SPA/DOM/dynamic-frame/native-navigation coverage on `dynamic-app.html`.
5. Move accessibility and visual assertions away from Demo CRM unless the target-page integration itself is what is being asserted.
6. Only after migration, remove redundant setup paths and re-evaluate the total test count.

## Refactor policy

Refactor incrementally. Preserve coverage first; reduce runtime/count only after ownership is clear. After each slice, run the affected tests, then the complete Playwright regression. Demo CRM tests that prove genuine integration behavior remain end-to-end.
