const fs = require("fs");
const path = require("path");

const specPath = path.resolve(__dirname, "../tests/extension-smoke.spec.js");
let source = fs.readFileSync(specPath, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  source = source.replace(oldText, newText);
}

replaceOnce(
`async function requireHealthyStack(request) {
  const api = await request.get(\`${'${API_URL}'}/api/health\`);
  expect(api.ok(), "GWTP API must be running before Stage 3").toBeTruthy();

  const site = await request.get(\`${'${SITE_URL}'}/site.html\`);
  expect(site.ok(), "Demo CRM must be running before Stage 3").toBeTruthy();
}`,
`async function requireHealthyStack(request) {
  const api = await request.get(\`${'${API_URL}'}/api/health\`);
  expect(api.ok(), "GWTP API must be running before Playwright tests").toBeTruthy();

  const fixture = await request.get(\`${'${SITE_URL}'}/gwtp-test-fixture.html\`);
  expect(fixture.ok(), "GWTP test fixture server must be running before Playwright tests").toBeTruthy();
}`,
"global health prerequisite"
);

// This Stage 5 guide validation test only needs a reachable StartUrl; it does not
// exercise CRM postback, frames, business navigation, or server-side grid behavior.
const testName = 'test("stage 5 management validation - guide identity and availability rules block invalid saves"';
const start = source.indexOf(testName);
if (start < 0) throw new Error("guide validation test not found");
const next = source.indexOf('\ntest("', start + testName.length);
if (next < 0) throw new Error("unable to find end of guide validation test");
let block = source.slice(start, next);
const oldUrl = '`${SITE_URL}/site.html`';
const occurrences = block.split(oldUrl).length - 1;
if (occurrences < 1) throw new Error("guide validation test has no Demo CRM StartUrl to migrate");
block = block.split(oldUrl).join('`${SITE_URL}/gwtp-test-fixture.html`');
source = source.slice(0, start) + block + source.slice(next);

fs.writeFileSync(specPath, source, "utf8");
console.log("Batch 2 applied: generic health check uses the deterministic fixture and Stage 5 guide validation no longer targets Demo CRM.");
