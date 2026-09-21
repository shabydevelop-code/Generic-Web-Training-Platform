const { test, expect, chromium } = require("@playwright/test");
const path = require("path");

const EXTENSION_PATH = path.resolve(__dirname, "../../../extension");
const API_URL = "http://localhost:5000";
const SITE_URL = "http://localhost:5100";
const PASSWORD = "Sanity2026!";

let context;
let extensionId;

async function requireHealthyStack(request) {
  const api = await request.get(`${API_URL}/api/health`);
  expect(api.ok(), "GWTP API must be running before Stage 3").toBeTruthy();

  const site = await request.get(`${SITE_URL}/site.html`);
  expect(site.ok(), "Demo CRM must be running before Stage 3").toBeTruthy();
}

async function openPanel() {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#loginView")).toBeVisible();
  return page;
}

async function login(page, username) {
  await page.locator("#usernameInput").fill(username);
  await page.locator("#passwordInput").fill(PASSWORD);
  await page.locator("#loginButton").click();
  await expect(page.locator("#appView")).toBeVisible();
  await expect(page.locator("#loginView")).toBeHidden();
}

test.beforeAll(async ({ request }) => {
  await requireHealthyStack(request);

  context = await chromium.launchPersistentContext("", {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker");
  extensionId = new URL(serviceWorker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
});

test("Demo CRM loads with the GWTP content script", async () => {
  const page = await context.newPage();
  await page.goto(`${SITE_URL}/site.html`);
  await expect(page).toHaveTitle(/.+/);

  const contentScriptReady = await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "document.documentElement.dataset.gwtpMainWorldProbe = String(globalThis.__GWTP_CONTENT_READY__ === true);";
    document.documentElement.appendChild(script);
    script.remove();
    const isolatedWorldIsWorking = document.documentElement.dataset.gwtpMainWorldProbe === "false";
    delete document.documentElement.dataset.gwtpMainWorldProbe;
    return isolatedWorldIsWorking;
  });
  expect(contentScriptReady).toBeTruthy();
  await page.close();
});

test("learner sees only learner UI after login", async () => {
  const page = await openPanel();
  await login(page, "sanity.learner");

  await expect(page.locator("#learnModeView")).toBeVisible();
  await expect(page.locator("#createModeView")).toBeHidden();
  await expect(page.locator("#adminView")).toBeHidden();
  await expect(page.locator("#currentUserRole")).toContainText(/לומד|Learner/i);
  await expect(page.locator("#learnerTopicSelect option")).not.toHaveCount(0);

  await page.close();
});

test("editor sees authoring UI and not learner/admin UI", async () => {
  const page = await openPanel();
  await login(page, "sanity.editor");

  await expect(page.locator("#createModeView")).toBeVisible();
  await expect(page.locator("#learnModeView")).toBeHidden();
  await expect(page.locator("#adminView")).toBeHidden();
  await expect(page.locator("#guideLibraryView")).toBeVisible();
  await expect(page.locator("#currentUserRole")).toContainText(/עורך|Editor/i);

  await page.close();
});

test("admin sees administration UI only", async () => {
  const page = await openPanel();
  await login(page, "sanity.admin");

  await expect(page.locator("#adminView")).toBeVisible();
  await expect(page.locator("#createModeView")).toBeHidden();
  await expect(page.locator("#learnModeView")).toBeHidden();
  await expect(page.locator("#currentUserRole")).toContainText(/מנהל|Admin/i);
  await expect(page.locator("#adminUsersList")).toBeVisible();
  await expect(page.locator("#usersList")).toBeVisible();

  await page.close();
});
