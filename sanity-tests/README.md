# GWTP Sanity Tests

This directory contains repeatable smoke/sanity checks for the local GWTP stack.

## Stage 1

The first runner is intentionally non-destructive. It verifies:

- API health endpoint.
- SQLite/database health endpoint and schema availability.
- Demo site availability.
- Learner catalog rejects anonymous requests.
- Admin users API rejects anonymous requests.
- Invalid credentials are rejected.

It does not create, update, delete, publish, or reset production/development data.

## Run

Start the installed GWTP API service and the local Demo CRM site, then from the repository root run:

```powershell
powershell -ExecutionPolicy Bypass -File .\sanity-tests\gwtp-sanity.ps1
```

Optional endpoints:

```powershell
powershell -ExecutionPolicy Bypass -File .\sanity-tests\gwtp-sanity.ps1 -ApiBaseUrl "http://localhost:5000" -SiteBaseUrl "http://localhost:5100"
```

The command exits with code 0 when all checks pass and code 1 when any check fails, so it can later be reused by CI or deployment scripts.

## Stage 2

The runner also performs read-only authenticated checks using the development admin account:

- Admin login returns an access token and admin role.
- Admin can read the protected users API.
- Admin is rejected by the editor-only topics API, verifying role separation.
- An authenticated active user can read the learner catalog.

The defaults are `admin/admin` for the local development fixture. Different credentials can be supplied with `-AdminUsername` and `-AdminPassword`.

Stage 2 deliberately remains read-only. The next stage is visual browser/extension end-to-end sanity testing. Any later destructive API tests must use disposable fixtures and clean up after themselves.
