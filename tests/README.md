# GWTP Tests

All automated GWTP test infrastructure is centralized under this directory.

## Layout

- `api/` — API/database sanity checks against the installed GWTP API.
- `web/GWTP.Web.GuiTests/` — Playwright browser/extension GUI tests.
- `web/GWTP.Web.TestHost/` — standalone deterministic Web test application owned by the test suite.
- `windows/GWTP.Windows.GuiTests/` — Windows UIA GUI tests.
- `windows/GWTP.Windows.TestHost/` — standalone Windows UIA test application.
- `windows/run-sanity.ps1` — builds the product Windows Runtime plus Windows test projects and runs the GUI suite.
- `TEST_ARCHITECTURE.md` — test ownership and architecture rules.

Product runtime code is not stored under `tests/`. In particular, `windows-runtime/GWTP.Windows.Runtime/` remains production code.

## Run API sanity

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\api\run-sanity.ps1
```

## Run Web GUI sanity

```powershell
cd .\tests\web\GWTP.Web.GuiTests
npm test
```

The Web Test Host is started automatically by Playwright. The installed GWTP API on port 5000 remains a prerequisite.

## Run Windows GUI sanity

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\windows\run-sanity.ps1
```
