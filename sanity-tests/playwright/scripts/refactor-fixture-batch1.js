const fs = require("fs");
const path = require("path");

const testFile = path.resolve(__dirname, "../tests/extension-smoke.spec.js");
let source = fs.readFileSync(testFile, "utf8");

function updateTest(testName, transform) {
  const marker = `test("${testName}"`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Test not found: ${testName}`);

  const next = source.indexOf("\ntest(\"", start + marker.length);
  const end = next < 0 ? source.length : next;
  const original = source.slice(start, end);
  const updated = transform(original);
  if (updated === original) throw new Error(`No changes produced for: ${testName}`);
  source = source.slice(0, start) + updated + source.slice(end);
}

function migrateEditorFixture(block) {
  let updated = block;
  updated = updated.replace(/\bcrm\b/g, "fixture");
  updated = updated.replaceAll('SITE_URL + "/site.html"', 'SITE_URL + "/gwtp-test-fixture.html"');
  updated = updated.replaceAll('const content = fixture.frameLocator(\'iframe[name="TargetContent"]\');', "const content = fixture;");
  updated = updated.replaceAll('"#site-code"', '"#fixture-code"');
  updated = updated.replaceAll('"#site-name"', '"#fixture-name"');
  updated = updated.replaceAll("CRM tab", "fixture tab");
  return updated;
}

updateTest(
  "stage 5 management CRUD - editor creates, edits and deletes a guide and its step through the UI",
  migrateEditorFixture
);

updateTest(
  "stage 5 editor preview - navigation, validation and exit cleanup work through the real UI",
  migrateEditorFixture
);

updateTest(
  "stage 5 editor management - persisted step reorder survives reopening the guide",
  migrateEditorFixture
);

for (const required of [
  'fixture.goto(SITE_URL + "/gwtp-test-fixture.html")',
  'content.locator("#fixture-code")',
  'content.locator("#fixture-name")'
]) {
  if (!source.includes(required)) throw new Error(`Expected migrated content missing: ${required}`);
}

fs.writeFileSync(testFile, source, "utf8");
console.log("Migrated Stage 5 Guide/Step CRUD, Preview and Reorder tests to gwtp-test-fixture.html.");
