# Stage 3 - Playwright browser/extension sanity

This stage launches Chromium with the unpacked GWTP extension and performs browser-level smoke checks against the installed GWTP API and local Demo CRM.

## Prerequisites

- GWTP Windows Service is running on `http://localhost:5000`.
- Demo CRM is running on `http://localhost:5100`.
- Node.js/npm is installed.

## First-time setup

From `sanity-tests/playwright`:

```powershell
npm install
npx playwright install chromium
```

## Run

```powershell
npm test
```

The initial Stage 3 suite verifies stack availability, loads the unpacked extension in Chromium, opens its Side Panel document, and verifies role-specific UI for the dedicated `sanity.learner`, `sanity.editor`, and `sanity.admin` fixtures.

The suite is intentionally read-only at this stage. It does not create, edit, delete, publish, or reset application data.


## Real Chrome Side Panel boundary

The automated Playwright suite opens the extension document directly at
`chrome-extension://<extension-id>/sidepanel/sidepanel.html`. This exercises the
same Side Panel HTML/CSS/JavaScript, but it does not render Chrome's browser-level
Side Panel container.

The runtime wiring for the real Side Panel is part of the extension itself:
`manifest.json` declares `side_panel.default_path`, requests the `sidePanel`
permission, and the service worker configures the extension action to open the
panel. Browser chrome is outside the normal page DOM controlled by Playwright,
so the actual Chrome Side Panel shell remains a release smoke check rather than
a DOM E2E assertion.

### Real Side Panel release smoke check

1. Load/reload the unpacked extension from `extension/`.
2. Open Demo CRM in the active tab.
3. Click the GWTP extension action and confirm Chrome opens GWTP in its Side Panel.
4. Confirm login and the role-specific view fit the real panel without horizontal clipping.
5. Start a learner guide and confirm the guidance appears on the active Demo CRM tab.
6. Close and reopen the Side Panel and confirm the saved learner state is offered correctly.

Keep this smoke check outside customer deployment artifacts; `sanity-tests/` is development/QA only.
