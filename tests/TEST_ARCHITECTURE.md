# GWTP Test Architecture

## Goal

Organize regression coverage by the capability being verified, not by the web page that happens to be open during the test. The standalone Web Test Host is the default host for Web runtime tests; product/demo applications are not test infrastructure.

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

### 5. Host-system behavior

Server-backed host behaviors such as save/reload, postback-like navigation, frame reload and server-rendered Grid behavior are represented by the standalone Web Test Host. The automated Web suite must not depend on Demo CRM as its execution host.

## Deterministic fixtures

- `tests/web/GWTP.Web.TestHost/wwwroot/gwtp-test-fixture.html` is the lightweight fixture for generic Extension UI, authoring, validation and learner-runtime scenarios. It intentionally has no CRM API calls, postbacks, frames or business behavior.
- `tests/web/GWTP.Web.TestHost/wwwroot/dynamic-app.html` owns modern-web behavior such as SPA changes, DOM replacement, dynamic frames and real navigation.
- The customer-facing Demo application under `site/` is not part of automated test infrastructure. Equivalent server-backed integration behaviors required by automated tests belong in the standalone Web Test Host.

## Duplication rules

Overlap is justified when different layers are being verified. For example, `POST /api/topics` and creating a Topic through the Editor UI are separate requirements.

A test should not use Demo CRM merely because a convenient seeded element or guide already exists there. If the assertion is about GWTP UI, accessibility, generic validation, lifecycle, or generic DOM behavior, prefer an extension-only or deterministic on-page fixture.

Long setup flows should not repeatedly re-test earlier capabilities just to reach the assertion under test. Shared fixture/setup helpers may establish prerequisite state directly when that prerequisite already has dedicated coverage.

## Current ownership

1. Generic Guide/Step CRUD, Preview and validation scenarios belong to `gwtp-test-fixture.html`.
2. Generic learner lifecycle/resilience scenarios use deterministic Web Test Host fixtures.
3. SPA/DOM/dynamic-frame/native-navigation coverage belongs to `dynamic-app.html`.
4. Server-backed save/reload, postback/frame reload and Grid behavior are represented inside the standalone Web Test Host.
5. Accessibility and visual assertions should use deterministic fixtures unless host-system integration itself is the behavior under test.
6. The customer-facing Demo application under `site/` remains available for demonstrations and manual product scenarios, not as the automated suite's execution dependency.

## Refactor policy

Refactor incrementally. Preserve coverage first; reduce runtime/count only after ownership is clear. After each slice, run the affected tests, then the complete Playwright regression. Host-system integration tests remain end-to-end against the standalone Web Test Host.
