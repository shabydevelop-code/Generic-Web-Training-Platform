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

  // This smoke test only verifies that a guide can start and render guidance.
  // Keep it independent from progress left by later E2E tests by explicitly
  // restarting when the dedicated sanity learner already has saved progress.
  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) {
    await restart.click();
  } else {
    const start = panel.locator("#startLearningButton");
    await expect(start).toBeEnabled();
    await start.click();
  }

  // Restart/start replaces TargetContent, so use FrameLocator rather than
  // enumerating transient Frame objects that can detach during navigation.
  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const overlay = content.locator(".gwtp-training-overlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await expect(overlay.locator("button")).not.toHaveCount(0);
  await expect(content.locator("#site-code")).toHaveCSS("outline-width", "3px");

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

  // Training guidance uses its own !important inline outline and does not use
  // data-gwtp-highlighted (that attribute belongs to the generic highlighter).
  // Prove the move by checking the new target plus the overlay's step-specific
  // navigation state rather than assuming the previous field has no native outline.
  await expect(content.locator("#site-name")).toHaveCSS("outline-width", "3px");
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible();

  const previous = content.locator(".gwtp-training-overlay button").filter({ hasText: /הקודם|Previous/i });
  await expect(previous).toBeEnabled();
  await previous.click();

  await expect(content.locator("#site-code")).toHaveCSS("outline-width", "3px");
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible();

  await panel.close();
  await crm.close();
});


test("learner required validation blocks Next until corrected", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));

  const guide = panel.locator("#learnerGuideSelect option").filter({ hasText: "בדיקת כל חוקי הוולידציה" });
  await expect(guide).toHaveCount(1);
  await panel.locator("#learnerGuideSelect").selectOption(await guide.getAttribute("value"));

  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) await restart.click();
  else await panel.locator("#startLearningButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const overlay = content.locator(".gwtp-training-overlay");
  const siteName = content.locator("#site-name");

  await expect(overlay).toBeVisible({ timeout: 10000 });
  await siteName.fill("");

  const next = overlay.locator("button").filter({ hasText: /הבא|Next/i });
  await next.click();

  await expect(overlay).toBeVisible();
  await expect(siteName).toHaveCSS("outline-width", "3px");
  await expect(overlay).toContainText("יש להזין שם אתר לפני המעבר לשלב הבא.");

  await siteName.fill("Playwright Validation Site");
  await next.click();

  await expect(content.locator("#site-type")).toHaveCSS("outline-width", "3px");
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible();

  await panel.close();
  await crm.close();
});


test("learner continues automatically across the Site to Case page transition", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const guide = panel.locator("#learnerGuideSelect option").filter({ hasText: "תרגול מלא - Demo CRM" });
  await panel.locator("#learnerGuideSelect").selectOption(await guide.getAttribute("value"));

  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) await restart.click();
  else await panel.locator("#startLearningButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  let overlay = content.locator(".gwtp-training-overlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });

  // Move from step 1 through step 6. Step 3 requires a changed phone value and
  // step 4 requires site type branch; satisfy those authored validations.
  for (let step = 1; step < 6; step++) {
    if (step === 3) {
      const phone = content.locator("#site-phone");
      const currentPhone = await phone.inputValue();
      const changedPhone = currentPhone === "03-7654321" ? "03-7654322" : "03-7654321";
      await phone.fill(changedPhone);
    }
    if (step === 4) {
      await content.locator("#site-type").selectOption("branch");
      await expect(content.locator("#site-type")).toHaveValue("branch", { timeout: 10000 });
    }

    overlay = content.locator(".gwtp-training-overlay");
    const next = overlay.locator("button").filter({ hasText: /הבא|Next/i });
    await expect(next).toBeEnabled();
    await next.click();

    // Do not race the runner. The target for the following step may already be
    // highlighted while the asynchronous progress move is still being persisted.
    // Advance the test only after the engine confirms the new current step.
    await expect.poll(async () => panel.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
      return response?.current?.stepIndex ?? null;
    }), {
      message: `GWTP progress did not advance after Site step ${step}`,
      timeout: 10000
    }).toBe(step);
  }

  // Verify the engine itself reached the native-link step before testing the
  // cross-document handoff. A rendered step can otherwise be stale if an earlier
  // business postback interrupted progress synchronization.
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), {
    message: "GWTP progress did not reach the Site→Case link step before navigation",
    timeout: 10000
  }).toBe(5);

  const openCase = content.locator("#btn-open-case-from-site");
  await expect(openCase).toHaveCSS("outline-width", "3px");

  // The native link targets _top. GWTP persists the forward learning intent before
  // the document is destroyed; PAGE_READY on case.html must then resume at step 7.
  await openCase.click();

  await expect(crm).toHaveURL(/\/case\.html(?:[?#].*)?$/, { timeout: 10000 });

  // Diagnose the cross-document handoff independently from rendering. The server
  // progress must advance from zero-based stepIndex 5 (Site link) to 6 (Case field).
  // If this fails, the pending-navigation handoff did not resume. If it passes but
  // the overlay assertion below fails, the defect is isolated to destination render.
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), {
    message: "GWTP progress did not advance to the Case step after navigation",
    timeout: 10000
  }).toBe(6);

  const caseContent = crm.frameLocator('iframe[name="TargetContent"]');
  await expect(caseContent.locator("#case-category")).toBeVisible({ timeout: 10000 });
  await expect(caseContent.locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });
  await expect(caseContent.locator("#case-category")).toHaveCSS("outline-width", "3px");

  await panel.close();
  await crm.close();
});


test("learner survives a real Site server save and reload", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const guide = panel.locator("#learnerGuideSelect option").filter({ hasText: "תרגול מלא - Demo CRM" });
  await panel.locator("#learnerGuideSelect").selectOption(await guide.getAttribute("value"));

  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) await restart.click();
  else await panel.locator("#startLearningButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });

  // Advance deterministically to the Save Site step (zero-based index 4).
  for (let step = 1; step <= 4; step++) {
    if (step === 3) {
      const phone = content.locator("#site-phone");
      const currentPhone = await phone.inputValue();
      const changedPhone = currentPhone === "03-7654321" ? "03-7654322" : "03-7654321";
      await phone.fill(changedPhone);
    }
    if (step === 4) {
      await content.locator("#site-type").selectOption("branch");
      await expect(content.locator("#site-type")).toHaveValue("branch", { timeout: 10000 });
    }

    const next = content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
    await expect(next).toBeEnabled();
    await next.click();

    await expect.poll(async () => panel.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
      return response?.current?.stepIndex ?? null;
    }), {
      message: `GWTP progress did not advance after Site step ${step}`,
      timeout: 10000
    }).toBe(step);
  }

  const save = content.locator("#btn-save-site");
  await expect(save).toHaveCSS("outline-width", "3px");

  const frameBeforeSave = crm.frames().find((frame) => frame.name() === "TargetContent");
  expect(frameBeforeSave).toBeTruthy();
  const oldUrl = frameBeforeSave.url();

  // This is the real Demo CRM business action: PUT /api/sites/77402 followed by
  // location.reload() inside TargetContent. GWTP must keep step 5 active.
  const saveResponsePromise = crm.waitForResponse((response) =>
    response.url().includes("/api/sites/77402") &&
    response.request().method() === "PUT"
  );
  await save.click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.ok(), "Demo CRM Site save must succeed").toBeTruthy();

  await expect.poll(() => {
    const frame = crm.frames().find((item) => item.name() === "TargetContent");
    return frame?.url() || "";
  }, {
    message: "TargetContent did not return after the Site save reload",
    timeout: 10000
  }).toBe(oldUrl);

  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), {
    message: "GWTP progress changed during the Site save reload",
    timeout: 10000
  }).toBe(4);

  await expect(content.locator("#btn-save-site")).toHaveCSS("outline-width", "3px", { timeout: 10000 });
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });

  await panel.close();
  await crm.close();
});
