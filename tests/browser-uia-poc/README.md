# Browser UIA POC

Disposable feasibility probe for using Windows UI Automation against ordinary Chrome/Edge without the GWTP Extension or CDP.

## Boundaries

- No browser extension.
- No CDP or remote-debugging flags.
- No production Runtime, API, database, or existing test-suite dependency.
- Everything experimental is isolated under `tests/browser-uia-poc/`.

## Run

Open Chrome or Edge normally, navigate to a web page, then run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\tests\browser-uia-poc\run-poc.ps1
```

Click **Pick browser element**, move over an element inside the page, and left-click.

The POC captures only UI Automation information exposed by the browser. It can:

- highlight the selected UIA element;
- capture process/control/name/AutomationId plus a bounded ancestor path;
- use **Find again** for coordinate-free rediscovery;
- fail safely when rediscovery returns zero or multiple matches;
- use **Read value** through ValuePattern/TextPattern when exposed.

This first stage tests basic exposure, rediscovery, and readable state. A successful highlight alone is not evidence that UIA can replace the Extension. If this stage is viable, later experiments should cover scroll tracking, refresh, SPA navigation/DOM replacement, tabs/windows, frames, and zoom/DPI.

## Removal

Delete `tests/browser-uia-poc/` and remove its status note. Production code does not reference this experiment.
