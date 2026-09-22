const fs = require("fs");
const path = require("path");

const specPath = path.resolve(__dirname, "../tests/extension-smoke.spec.js");
let source = fs.readFileSync(specPath, "utf8");

function replaceTest(name, replacement) {
  const marker = `test("${name}"`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Test not found: ${name}`);
  const next = source.indexOf('\ntest("', start + marker.length);
  if (next < 0) throw new Error(`Unable to find test boundary: ${name}`);
  source = source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(next + 1);
}

if (!source.includes("async function createTemporaryFixtureGuide")) {
  throw new Error("Batch 3 helper createTemporaryFixtureGuide is missing; pull/apply committed Batch 3 first.");
}

const steps = `[
    { selector: "#fixture-name", instruction: "Required", screenName: "Fixture", frame: null, validation: { type: "required", message: "יש להזין שם אתר לפני המעבר לשלב הבא." } },
    { selector: "#fixture-type", instruction: "Equals", screenName: "Fixture", frame: null, validation: { type: "equals", value: "branch", message: "יש לבחור סניף מכירות" } },
    { selector: "#fixture-type", instruction: "Not equals", screenName: "Fixture", frame: null, validation: { type: "not_equals", value: "branch", message: "יש לבחור סוג אתר שאינו סניף מכירות" } },
    { selector: "#fixture-name", instruction: "Contains", screenName: "Fixture", frame: null, validation: { type: "contains", value: "TEST", message: "שם האתר חייב להכיל TEST" } },
    { selector: "#fixture-phone", instruction: "Changed", screenName: "Fixture", frame: null, validation: { type: "changed", message: "יש לשנות את מספר הטלפון" } },
    { selector: "#fixture-phone", instruction: "Changed regex", screenName: "Fixture", frame: null, validation: { type: "changed_regex", value: "^03-[0-9]{7}$", message: "יש להזין מספר טלפון תקין ושונה" } }
  ]`;

replaceTest("learner required validation blocks Next until corrected", `test("learner required validation blocks Next until corrected", async () => {
  const editor = await openPanel();
  await login(editor, "sanity.editor");
  const setup = await createTemporaryFixtureGuide(editor, \`GWTP Validation Required \${Date.now()}\`, ${steps});
  try {
    await editor.close();
    const panel = await openPanel();
    await login(panel, "sanity.learner");
    const fixture = await context.newPage();
    await fixture.goto(\`\${SITE_URL}/gwtp-test-fixture.html\`);
    await fixture.bringToFront();
    await panel.locator("#learnerTopicSelect").selectOption(String(setup.topicId));
    await panel.locator("#learnerGuideSelect").selectOption(String(setup.guideId));
    await panel.locator("#startLearningButton").click();
    const overlay = fixture.locator(".gwtp-training-overlay");
    const name = fixture.locator("#fixture-name");
    await expect(overlay).toBeVisible({ timeout: 10000 });
    await name.fill("");
    await overlay.locator("button").filter({ hasText: /הבא|Next/i }).click();
    await expect(overlay).toContainText("יש להזין שם אתר לפני המעבר לשלב הבא.");
    await name.fill("Playwright Validation Site");
    await overlay.locator("button").filter({ hasText: /הבא|Next/i }).click();
    await expect(fixture.locator("#fixture-type")).toHaveCSS("outline-width", "3px");
    await panel.close(); await fixture.close();
  } finally {
    const cleanup = await openPanel(); await login(cleanup, "sanity.editor");
    await deleteTemporaryFixtureGuide(cleanup, setup); await cleanup.close();
  }
});`);

replaceTest("stage 4 validation - equals, not-equals and contains block then allow Next", `test("stage 4 validation - equals, not-equals and contains block then allow Next", async () => {
  const editor = await openPanel(); await login(editor, "sanity.editor");
  const setup = await createTemporaryFixtureGuide(editor, \`GWTP Validation Rules \${Date.now()}\`, ${steps});
  try {
    await editor.close();
    const panel = await openPanel(); await login(panel, "sanity.learner");
    const fixture = await context.newPage(); await fixture.goto(\`\${SITE_URL}/gwtp-test-fixture.html\`); await fixture.bringToFront();
    await panel.locator("#learnerTopicSelect").selectOption(String(setup.topicId));
    await panel.locator("#learnerGuideSelect").selectOption(String(setup.guideId));
    await panel.locator("#startLearningButton").click();
    const next = () => fixture.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
    await fixture.locator("#fixture-name").fill("Validation Site"); await next().click();
    await fixture.locator("#fixture-type").selectOption("hq"); await next().click();
    await expect(fixture.locator(".gwtp-training-overlay")).toContainText("יש לבחור סניף מכירות");
    await fixture.locator("#fixture-type").selectOption("branch"); await next().click();
    await fixture.locator("#fixture-type").selectOption("branch"); await next().click();
    await expect(fixture.locator(".gwtp-training-overlay")).toContainText("יש לבחור סוג אתר שאינו סניף מכירות");
    await fixture.locator("#fixture-type").selectOption("hq"); await next().click();
    await fixture.locator("#fixture-name").fill("Validation Site"); await next().click();
    await expect(fixture.locator(".gwtp-training-overlay")).toContainText("שם האתר חייב להכיל TEST");
    await fixture.locator("#fixture-name").fill("Validation TEST Site"); await next().click();
    await expect(fixture.locator("#fixture-phone")).toHaveCSS("outline-width", "3px");
    await panel.close(); await fixture.close();
  } finally {
    const cleanup = await openPanel(); await login(cleanup, "sanity.editor");
    await deleteTemporaryFixtureGuide(cleanup, setup); await cleanup.close();
  }
});`);

replaceTest("stage 4 validation - changed and changed-regex block then allow Next", `test("stage 4 validation - changed and changed-regex block then allow Next", async () => {
  const editor = await openPanel(); await login(editor, "sanity.editor");
  const setup = await createTemporaryFixtureGuide(editor, \`GWTP Validation Changed \${Date.now()}\`, ${steps});
  try {
    const guide = await editor.evaluate(async (id) => {
      const auth = (await chrome.storage.local.get("gwtp.auth.user"))["gwtp.auth.user"];
      const response = await fetch(\`\${globalThis.appConfig.api.baseUrl}/api/learner/guides/\${id}\`, { headers: { Authorization: \`Bearer \${auth.accessToken}\` } });
      if (!response.ok) throw new Error("Unable to load temporary validation guide."); return response.json();
    }, setup.guideId);
    await editor.close();
    const panel = await openPanel(); await login(panel, "sanity.learner");
    const fixture = await context.newPage(); await fixture.goto(\`\${SITE_URL}/gwtp-test-fixture.html\`); await fixture.bringToFront();
    await panel.locator("#learnerTopicSelect").selectOption(String(setup.topicId)); await panel.locator("#learnerGuideSelect").selectOption(String(setup.guideId));
    await panel.evaluate(async (guideValue) => {
      const restart = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_RESTART", guide: guideValue }); if (!restart?.success) throw new Error(restart?.message || "restart failed");
      for (let i = 0; i < 4; i += 1) { const moved = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_NEXT" }); if (!moved?.success) throw new Error(moved?.message || "prepare failed"); }
    }, guide);
    await fixture.bringToFront(); await panel.locator("#startLearningButton").click();
    const phone = fixture.locator("#fixture-phone"); const next = () => fixture.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
    await expect(phone).toHaveCSS("outline-width", "3px", { timeout: 10000 });
    const baseline = await phone.inputValue(); await next().click(); await expect(fixture.locator(".gwtp-training-overlay")).toContainText("יש לשנות את מספר הטלפון");
    const changed = baseline === "03-7654321" ? "03-7654322" : "03-7654321"; await phone.fill(changed); await next().click();
    const finish = () => fixture.locator(".gwtp-training-overlay button").filter({ hasText: /סיום|Finish/i });
    await finish().click(); await expect(fixture.locator(".gwtp-training-overlay")).toContainText("יש להזין מספר טלפון תקין ושונה");
    await phone.fill("invalid"); await finish().click(); await expect(fixture.locator(".gwtp-training-overlay")).toContainText("יש להזין מספר טלפון תקין ושונה");
    await phone.fill("03-7654323"); await finish().click(); await expect(fixture.locator(".gwtp-training-overlay")).toHaveCount(0);
    await panel.close(); await fixture.close();
  } finally {
    const cleanup = await openPanel(); await login(cleanup, "sanity.editor"); await deleteTemporaryFixtureGuide(cleanup, setup); await cleanup.close();
  }
});`);

fs.writeFileSync(specPath, source, "utf8");
console.log("Corrected Batch 4 applied: validation tests now own a temporary fixture guide and no longer depend on Demo CRM validation data.");
