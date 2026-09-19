# Generic Web Training Platform

A generic browser-based training platform for guiding users through web applications using a Chrome/Edge extension and Side Panel.

## Current milestone

Milestone 1 proves the basic extension communication flow:

`Side Panel -> Content Script -> Web page DOM`

The first capability is intentionally small: enter a CSS selector in the Side Panel and highlight the matching element on the current page.

## Architecture direction

The project will grow incrementally toward a generic Guide Engine. Site-specific training content will remain separate from the generic execution engine.

For now, only the minimum extension foundation is implemented.

## Load locally

### Chrome
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` directory.
5. Open a normal web page and click the extension icon to open the Side Panel.

### Edge
1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension` directory.
5. Open a normal web page and click the extension icon to open the Side Panel.

> Browser-internal pages such as `chrome://` and `edge://` cannot be manipulated by the content script.


## UI form conventions

- Every form field must be wrapped in a shared `.form-field` container.
- Vertical spacing between consecutive fields is controlled by the shared CSS rule `.form-field + .form-field`; do not add one-off margins for individual fields.
- A label and its input/select/textarea are treated as one visual unit.
- New form fields must preserve the existing spacing rhythm in both LTR and RTL layouts.
- Technical values whose natural direction is LTR, such as URLs, must remain LTR in every interface language.
