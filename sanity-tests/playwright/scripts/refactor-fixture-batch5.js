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
  throw new Error("Temporary fixture helpers are missing.");
}

replaceTest("stage 6 resilience batch - repeated PAGE_READY signals do not duplicate or advance guidance", `test("stage 6 resilience batch - repeated PAGE_READY signals do not duplicate or advance generic guidance", async () => {
  const editor = await openPanel();
  await login(editor, "sanity.editor");
  const setup = await createTemporaryFixtureGuide(editor, \`GWTP PAGE_READY \${Date.now()}\`, [
    { selector: "#fixture-code", instruction: "Fixture code", screenName: "Fixture", frame: null, validation: null }
  ]);
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
    await expect(fixture.locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });

    await panel.evaluate(async () => {
      await Promise.all([
        chrome.runtime.sendMessage({ type: "GWTP_PAGE_READY" }),
        chrome.runtime.sendMessage({ type: "GWTP_PAGE_READY" }),
        chrome.runtime.sendMessage({ type: "GWTP_PAGE_READY" })
      ]);
    });

    await expect.poll(async () => panel.evaluate(async () => (await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" }))?.current?.stepIndex ?? null), { timeout: 10000 }).toBe(0);
    await expect(fixture.locator(".gwtp-training-overlay")).toHaveCount(1);
    await panel.close();
    await fixture.close();
  } finally {
    const cleanup = await openPanel();
    await login(cleanup, "sanity.editor");
    await deleteTemporaryFixtureGuide(cleanup, setup);
    await cleanup.close();
  }
});`);

replaceTest("stage 6 resilience batch - rapid duplicate Next does not skip a learner step", `test("stage 6 resilience batch - rapid duplicate Next does not skip a generic learner step", async () => {
  const editor = await openPanel();
  await login(editor, "sanity.editor");
  const setup = await createTemporaryFixtureGuide(editor, \`GWTP Duplicate Next \${Date.now()}\`, [
    { selector: "#fixture-code", instruction: "Fixture code", screenName: "Fixture", frame: null, validation: null },
    { selector: "#fixture-name", instruction: "Fixture name", screenName: "Fixture", frame: null, validation: null },
    { selector: "#fixture-phone", instruction: "Fixture phone", screenName: "Fixture", frame: null, validation: null }
  ]);
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

    const next = fixture.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
    await expect(next).toBeVisible({ timeout: 10000 });
    await next.evaluate((button) => { button.click(); button.click(); });

    await expect.poll(async () => panel.evaluate(async () => (await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" }))?.current?.stepIndex ?? null), { timeout: 10000 }).toBe(1);
    await expect(fixture.locator("#fixture-name")).toHaveCSS("outline-width", "3px");
    await panel.close();
    await fixture.close();
  } finally {
    const cleanup = await openPanel();
    await login(cleanup, "sanity.editor");
    await deleteTemporaryFixtureGuide(cleanup, setup);
    await cleanup.close();
  }
});`);

fs.writeFileSync(specPath, source, "utf8");
console.log("Batch 5 applied: PAGE_READY idempotency and duplicate Next resilience tests now use generic temporary fixture guides.");
