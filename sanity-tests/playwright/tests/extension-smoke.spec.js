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
  await page.evaluate(async () => {
    localStorage.clear();
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  });
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


test("learner can start a real Demo CRM guide and receives visible guidance", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  // A real Chrome Side Panel does not become the active browser tab. Opening the
  // extension document as a normal Playwright tab does, so restore a normal web
  // tab as active before starting the guide. guideRunner intentionally targets
  // chrome.tabs.query({ active: true, currentWindow: true }).
  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topicOptions = panel.locator("#learnerTopicSelect option");
  const demoTopic = topicOptions.filter({ hasText: "Demo CRM" });
  await expect(demoTopic).toHaveCount(1);
  await panel.locator("#learnerTopicSelect").selectOption(await demoTopic.getAttribute("value"));

  const guideOptions = panel.locator("#learnerGuideSelect option");
  const fullGuide = guideOptions.filter({ hasText: "תרגול מלא - Demo CRM" });
  await expect(fullGuide).toHaveCount(1);
  await panel.locator("#learnerGuideSelect").selectOption(await fullGuide.getAttribute("value"));

  const start = panel.locator("#startLearningButton");
  await expect(start).toBeEnabled();
  await start.click();

  await expect.poll(async () => {
    for (const frame of crm.frames()) {
      if (await frame.locator(".gwtp-training-overlay").count()) return true;
    }
    return false;
  }, { timeout: 10000 }).toBeTruthy();

  let overlayFrame = null;
  for (const frame of crm.frames()) {
    if (await frame.locator(".gwtp-training-overlay").count()) {
      overlayFrame = frame;
      break;
    }
  }

  const overlay = overlayFrame.locator(".gwtp-training-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("button")).not.toHaveCount(0);

  const highlighted = await overlayFrame.locator("*").evaluateAll((elements) =>
    elements.some((element) => getComputedStyle(element).outlineStyle !== "none" &&
      getComputedStyle(element).outlineWidth === "3px")
  );
  expect(highlighted).toBeTruthy();

  await panel.close();
  await crm.close();
});


test("learner Next and Previous move between real Demo CRM steps", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const demoTopic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await demoTopic.getAttribute("value"));
  const fullGuide = panel.locator("#learnerGuideSelect option").filter({ hasText: "תרגול מלא - Demo CRM" });
  await panel.locator("#learnerGuideSelect").selectOption(await fullGuide.getAttribute("value"));

  // Always begin this navigation test from step 1 even if the dedicated sanity
  // learner retained progress from an earlier E2E run.
  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) {
    await restart.click();
  } else {
    await panel.locator("#startLearningButton").click();
  }

  // Restart/start navigates the active CRM tab to the guide StartUrl. That
  // navigation replaces the iframe document, so resolve TargetContent only after
  // the navigation has settled instead of retaining a stale Frame object.
  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const overlay = content.locator(".gwtp-training-overlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await expect(content.locator("#site-code")).toHaveCSS("outline-width", "3px");

  const next = overlay.locator("button").filter({ hasText: /הבא|Next/i });
  await expect(next).toBeEnabled();
  await next.click();

  await expect(content.locator("#site-name")).toHaveAttribute("data-gwtp-highlighted", "true");
  await expect(content.locator("#site-code")).not.toHaveAttribute("data-gwtp-highlighted", "true");

  const previous = content.locator(".gwtp-training-overlay button").filter({ hasText: /הקודם|Previous/i });
  await expect(previous).toBeEnabled();
  await previous.click();

  await expect(content.locator("#site-code")).toHaveAttribute("data-gwtp-highlighted", "true");
  await expect(content.locator("#site-name")).not.toHaveAttribute("data-gwtp-highlighted", "true");

  await panel.close();
  await crm.close();
});
