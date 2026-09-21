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
