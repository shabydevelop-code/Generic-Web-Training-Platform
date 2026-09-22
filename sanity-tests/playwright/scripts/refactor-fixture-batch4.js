const fs = require("fs");
const path = require("path");

const specPath = path.resolve(__dirname, "../tests/extension-smoke.spec.js");
let source = fs.readFileSync(specPath, "utf8");

function getBlock(testTitle, nextTitle) {
  const startNeedle = `test("${testTitle}"`;
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Test not found: ${testTitle}`);
  const end = nextTitle ? source.indexOf(`\ntest("${nextTitle}"`, start + startNeedle.length) : source.indexOf("\ntest(\"", start + startNeedle.length);
  if (end < 0) throw new Error(`Unable to find end of test: ${testTitle}`);
  return { start, end, text: source.slice(start, end) };
}

function replaceBlock(testTitle, nextTitle, transform) {
  const block = getBlock(testTitle, nextTitle);
  const updated = transform(block.text);
  source = source.slice(0, block.start) + updated + source.slice(block.end);
}

// These validation tests still use the seeded validation guide. Batch 4 deliberately
// moves only its target document from the framed Demo CRM page to the deterministic
// fixture while preserving the validation rules under test. Because the seeded guide
// selectors are CRM-specific, translate target selectors inside each test to the
// equivalent fixture controls and use the top-level page instead of TargetContent.
function migrateValidationBlock(block) {
  let out = block;
  out = out.replaceAll('await crm.goto(`${SITE_URL}/site.html`);', 'await crm.goto(`${SITE_URL}/gwtp-test-fixture.html`);');
  out = out.replaceAll("const content = crm.frameLocator('iframe[name=\"TargetContent\"]');", "const content = crm;");
  out = out.replaceAll('"#site-name"', '"#fixture-name"');
  out = out.replaceAll('"#site-type"', '"#fixture-type"');
  out = out.replaceAll('"#site-phone"', '"#fixture-phone"');
  return out;
}

replaceBlock(
  "learner required validation blocks Next until corrected",
  "stage 4 validation - equals, not-equals and contains block then allow Next",
  migrateValidationBlock
);
replaceBlock(
  "stage 4 validation - equals, not-equals and contains block then allow Next",
  "stage 4 validation - changed and changed-regex block then allow Next",
  migrateValidationBlock
);
replaceBlock(
  "stage 4 validation - changed and changed-regex block then allow Next",
  "learner continues automatically across the Site to Case page transition",
  migrateValidationBlock
);

fs.writeFileSync(specPath, source, "utf8");
console.log("Batch 4 applied: validation runtime tests target the deterministic fixture document.");
console.log("Run the three validation tests before committing; if seeded guide navigation forces site.html, the next refactor step is to make the validation guide itself test-owned.");
