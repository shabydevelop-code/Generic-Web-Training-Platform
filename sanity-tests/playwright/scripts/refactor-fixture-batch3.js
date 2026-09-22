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

const helperAnchor = "async function login(page, username) {";
const helperStart = source.indexOf(helperAnchor);
if (helperStart < 0) throw new Error("login helper not found");
const beforeAll = source.indexOf("\ntest.beforeAll", helperStart);
if (beforeAll < 0) throw new Error("beforeAll anchor not found");

const helper = `
async function createTemporaryFixtureGuide(panel, name, steps) {
  const auth = await panel.evaluate(async () => (await chrome.storage.local.get("gwtp.auth.user"))["gwtp.auth.user"]);
  return panel.evaluate(async ({ token, name, siteUrl, steps }) => {
    const headers = { Authorization: \`Bearer \${token}\`, "Content-Type": "application/json" };
    const requestJson = async (url, options = {}) => {
      const response = await fetch(\`\${globalThis.appConfig.api.baseUrl}\${url}\`, { headers, ...options });
      if (!response.ok) throw new Error(\`\${options.method || "GET"} \${url} failed: \${response.status} \${await response.text()}\`);
      return response.status === 204 ? null : response.json();
    };
    const topic = await requestJson("/api/topics", { method: "POST", body: JSON.stringify({ name }) });
    const guide = await requestJson("/api/guides", {
      method: "POST",
      body: JSON.stringify({ topicId: topic.id, name, startUrl: \`\${siteUrl}/gwtp-test-fixture.html\`, isAvailable: true, steps })
    });
    return { token, topicId: topic.id, guideId: guide.id };
  }, { token: auth.accessToken, name, siteUrl: SITE_URL, steps });
}

async function deleteTemporaryFixtureGuide(panel, setup) {
  await panel.evaluate(async ({ token, guideId, topicId }) => {
    const headers = { Authorization: \`Bearer \${token}\` };
    await fetch(\`\${globalThis.appConfig.api.baseUrl}/api/guides/\${guideId}\`, { method: "DELETE", headers });
    await fetch(\`\${globalThis.appConfig.api.baseUrl}/api/topics/\${topicId}\`, { method: "DELETE", headers });
  }, setup);
}
`;

if (!source.includes("async function createTemporaryFixtureGuide")) {
  source = source.slice(0, beforeAll) + helper + source.slice(beforeAll);
}

replaceTest("learner can start a real Demo CRM guide and receives visible guidance", `test("learner can start a generic guide and receives visible guidance", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");
  const name = \`GWTP Learner Start \${Date.now()}\`;
  const setup = await createTemporaryFixtureGuide(panel, name, [
    { selector: "#fixture-code", instruction: "Start fixture guidance", screenName: "Fixture", frame: null, validation: null }
  ]);

  try {
    await panel.close();
    const learner = await openPanel();
    await login(learner, "sanity.learner");
    const fixture = await context.newPage();
    await fixture.goto(\`\${SITE_URL}/gwtp-test-fixture.html\`);
    await fixture.bringToFront();

    await learner.locator("#learnerTopicSelect").selectOption(String(setup.topicId));
    await learner.locator("#learnerGuideSelect").selectOption(String(setup.guideId));
    await learner.locator("#startLearningButton").click();

    const overlay = fixture.locator(".gwtp-training-overlay");
    await expect(overlay).toBeVisible({ timeout: 10000 });
    await expect(overlay.locator("button")).not.toHaveCount(0);
    await expect(fixture.locator("#fixture-code")).toHaveCSS("outline-width", "3px");

    await learner.close();
    await fixture.close();
  } finally {
    const cleanup = await openPanel();
    await login(cleanup, "sanity.editor");
    await deleteTemporaryFixtureGuide(cleanup, setup);
    await cleanup.close();
  }
});`);

replaceTest("learner Next and Previous move between real Demo CRM steps", `test("learner Next and Previous move between generic fixture steps", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");
  const name = \`GWTP Learner Navigation \${Date.now()}\`;
  const setup = await createTemporaryFixtureGuide(panel, name, [
    { selector: "#fixture-code", instruction: "Fixture code", screenName: "Fixture", frame: null, validation: null },
    { selector: "#fixture-name", instruction: "Fixture name", screenName: "Fixture", frame: null, validation: null }
  ]);

  try {
    await panel.close();
    const learner = await openPanel();
    await login(learner, "sanity.learner");
    const fixture = await context.newPage();
    await fixture.goto(\`\${SITE_URL}/gwtp-test-fixture.html\`);
    await fixture.bringToFront();

    await learner.locator("#learnerTopicSelect").selectOption(String(setup.topicId));
    await learner.locator("#learnerGuideSelect").selectOption(String(setup.guideId));
    await learner.locator("#startLearningButton").click();

    const overlay = fixture.locator(".gwtp-training-overlay");
    await expect(fixture.locator("#fixture-code")).toHaveCSS("outline-width", "3px", { timeout: 10000 });
    await overlay.locator("button").filter({ hasText: /הבא|Next/i }).click();
    await expect(fixture.locator("#fixture-name")).toHaveCSS("outline-width", "3px");

    await fixture.locator(".gwtp-training-overlay button").filter({ hasText: /הקודם|Previous/i }).click();
    await expect(fixture.locator("#fixture-code")).toHaveCSS("outline-width", "3px");
    await expect(fixture.locator(".gwtp-training-overlay")).toBeVisible();

    await learner.close();
    await fixture.close();
  } finally {
    const cleanup = await openPanel();
    await login(cleanup, "sanity.editor");
    await deleteTemporaryFixtureGuide(cleanup, setup);
    await cleanup.close();
  }
});`);

fs.writeFileSync(specPath, source, "utf8");
console.log("Batch 3 applied: generic learner start and Next/Previous tests now use temporary deterministic fixture guides.");
