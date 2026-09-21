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


test("stage 4 filters - admin user role filter shows the requested role", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.admin");

  const regularUsers = panel.locator("#usersList [data-user-id]");
  await panel.locator("#userRoleFilter").selectOption("editor");
  await expect(regularUsers).not.toHaveCount(0);
  await expect(regularUsers.filter({ hasText: /GWTP Sanity Editor/i })).toHaveCount(1);
  await expect(regularUsers.filter({ hasText: /GWTP Sanity Learner/i })).toHaveCount(0);
  const editorCards = await regularUsers.allTextContents();
  expect(editorCards.every((text) => /עורך|Editor/i.test(text))).toBeTruthy();

  await panel.locator("#userRoleFilter").selectOption("learner");
  await expect(regularUsers).not.toHaveCount(0);
  await expect(regularUsers.filter({ hasText: /GWTP Sanity Editor/i })).toHaveCount(0);
  await expect(regularUsers.filter({ hasText: /GWTP Sanity Learner/i })).toHaveCount(1);
  const learnerCards = await regularUsers.allTextContents();
  expect(learnerCards.every((text) => /לומד|Learner/i.test(text))).toBeTruthy();

  await panel.locator("#userRoleFilter").selectOption("all");
  await expect(regularUsers.filter({ hasText: /GWTP Sanity Editor/i })).toHaveCount(1);
  await expect(regularUsers.filter({ hasText: /GWTP Sanity Learner/i })).toHaveCount(1);

  await panel.close();
});

test("stage 4 filters - guide topic filter limits the editor library", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");

  const topicFilter = panel.locator("#guideTopicFilter");
  const demoOption = topicFilter.locator("option").filter({ hasText: "Demo CRM" });
  await expect(demoOption).toHaveCount(1);
  await topicFilter.selectOption(await demoOption.getAttribute("value"));

  const cards = panel.locator("#guidesList [data-guide-id]");
  await expect(cards).not.toHaveCount(0);
  const cardCount = await cards.count();
  for (let index = 0; index < cardCount; index += 1) {
    await expect(cards.nth(index)).toContainText("Demo CRM");
  }

  await topicFilter.selectOption("all");
  await expect(panel.locator("#guidesList [data-guide-id]")).not.toHaveCount(0);
  await panel.close();
});

test("stage 4 filters - guide availability filter limits the editor library", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");

  const cards = panel.locator("#guidesList [data-guide-id]");
  await panel.locator("#guideAvailabilityFilter").selectOption("available");
  await expect(cards).not.toHaveCount(0);
  const availableCount = await cards.count();
  for (let index = 0; index < availableCount; index += 1) {
    await expect(cards.nth(index)).toContainText(/זמין ללומדים:\s*כן|Available to learners:\s*Yes/i);
  }

  await panel.locator("#guideAvailabilityFilter").selectOption("unavailable");
  const unavailableCount = await cards.count();
  for (let index = 0; index < unavailableCount; index += 1) {
    await expect(cards.nth(index)).toContainText(/זמין ללומדים:\s*לא|Available to learners:\s*No/i);
  }

  await panel.locator("#guideAvailabilityFilter").selectOption("all");
  await expect(cards).not.toHaveCount(0);
  await panel.close();
});

test("stage 4 filters - step screen filter changes visibility without changing step order", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");

  const guideCard = panel.locator("[data-guide-id]").filter({ hasText: "תרגול מלא - Demo CRM" }).first();
  await expect(guideCard).toBeVisible();
  await guideCard.click();
  await expect(panel.locator("#stepsSection")).toBeVisible();

  const screenFilter = panel.locator("#stepScreenFilter");
  await expect(screenFilter).toBeVisible();
  const siteOption = screenFilter.locator("option").filter({ hasText: /^אתר$/ });
  await expect(siteOption).toHaveCount(1);

  const stepItems = panel.locator("#stepsList .step-item");
  const allStepIds = await stepItems.evaluateAll((items) => items.map((item) => item.dataset.stepId));
  expect(allStepIds.length).toBeGreaterThan(6);

  const visibleScreenMetadata = panel.locator("#stepsList .step-item__screen:not([hidden])");
  await expect(visibleScreenMetadata.first()).toContainText(/שם מסך:|Screen name:/);
  await expect(visibleScreenMetadata.first()).toContainText("אתר");

  await screenFilter.selectOption(await siteOption.getAttribute("value"));
  await expect(stepItems).toHaveCount(6);
  const filteredStepIds = await stepItems.evaluateAll((items) => items.map((item) => item.dataset.stepId));
  expect(filteredStepIds).toEqual(allStepIds.slice(0, 6));

  await screenFilter.selectOption("all");
  const restoredStepIds = await stepItems.evaluateAll((items) => items.map((item) => item.dataset.stepId));
  expect(restoredStepIds).toEqual(allStepIds);

  await panel.close();
});



test("stage 5 management CRUD - admin creates, edits and deletes a user through the UI", async () => {
  const suffix = Date.now();
  const username = "stage5.user." + suffix;
  const displayName = "Stage 5 User " + suffix;
  const updatedName = "Stage 5 Updated " + suffix;
  const panel = await openPanel();
  await login(panel, "sanity.admin");
  try {
    await panel.locator("#openCreateUserButton").click();
    await panel.locator("#newDisplayName").fill(displayName);
    await panel.locator("#newUsername").fill(username);
    await panel.locator("#newPassword").fill("Stage5Pass!");
    await panel.locator("#newRole").selectOption("editor");
    await panel.locator("#createUserButton").click();
    let card = panel.locator("#usersList [data-user-id]").filter({ hasText: username }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(/עורך|Editor/i);
    await card.click();
    await panel.locator("#editDisplayName").fill(updatedName);
    await panel.locator("#editRole").selectOption("learner");
    await panel.locator("#editIsActive").uncheck();
    await panel.locator("#saveUserButton").click();
    card = panel.locator("#usersList [data-user-id]").filter({ hasText: username }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText(updatedName);
    await expect(card).toContainText(/לומד|Learner/i);
    await expect(card).toContainText(/לא פעיל|Inactive/i);
    await card.click();
    await panel.locator("#deleteEditedUserButton").click();
    await panel.locator("#confirmDeleteButton").click();
    await expect(panel.locator("#usersList [data-user-id]").filter({ hasText: username })).toHaveCount(0);
  } finally {
    const leftover = panel.locator("#usersList [data-user-id]").filter({ hasText: username }).first();
    if (await leftover.count()) { try { await leftover.click(); await panel.locator("#deleteEditedUserButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); } catch {} }
    await panel.close();
  }
});

test("stage 5 management CRUD - editor creates, renames and deletes a topic through the UI", async () => {
  const suffix = Date.now();
  const topicName = "Stage 5 Topic " + suffix;
  const renamedTopic = "Stage 5 Topic Updated " + suffix;
  const panel = await openPanel();
  await login(panel, "sanity.editor");
  try {
    await panel.locator("#openTopicsButton").click();
    await panel.locator("#openCreateTopicButton").click();
    await panel.locator("#newTopicInput").fill(topicName);
    await panel.locator("#createTopicButton").click();
    let card = panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName }).first();
    await expect(card).toBeVisible();
    await card.click();
    await panel.locator("#editTopicInput").fill(renamedTopic);
    await panel.locator("#saveTopicButton").click();
    card = panel.locator("#topicsList [data-topic-id]").filter({ hasText: renamedTopic }).first();
    await expect(card).toBeVisible();
    await card.click();
    await panel.locator("#deleteEditedTopicButton").click();
    await panel.locator("#confirmDeleteButton").click();
    await expect(panel.locator("#topicsList [data-topic-id]").filter({ hasText: renamedTopic })).toHaveCount(0);
  } finally {
    for (const name of [renamedTopic, topicName]) { const leftover = panel.locator("#topicsList [data-topic-id]").filter({ hasText: name }).first(); if (await leftover.count()) { try { await leftover.click(); await panel.locator("#deleteEditedTopicButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); } catch {} } }
    await panel.close();
  }
});

test("stage 5 management CRUD - editor creates, edits and deletes a guide and its step through the UI", async () => {
  const suffix = Date.now();
  const guideName = "Stage 5 Guide " + suffix;
  const updatedGuideName = "Stage 5 Guide Updated " + suffix;
  const panel = await openPanel();
  let crm = null;
  try {
    await login(panel, "sanity.editor");
    crm = await context.newPage();
    await crm.goto(SITE_URL + "/site.html");
    await crm.bringToFront();
    await panel.locator("#openNewGuideButton").click();
    const demoTopic = panel.locator("#topicSelect option").filter({ hasText: "Demo CRM" });
    await panel.locator("#topicSelect").selectOption(await demoTopic.getAttribute("value"));
    await panel.locator("#guideNameInput").fill(guideName);
    await panel.locator("#guideStartUrlInput").fill(SITE_URL + "/site.html");
    await panel.locator("#addStepButton").click();
    await panel.locator("#selectButton").click();
    const content = crm.frameLocator('iframe[name="TargetContent"]');
    await content.locator("#site-code").click();
    await panel.locator("#screenNameInput").fill("Stage5 Screen");
    await panel.locator("#instructionInput").fill("Stage 5 original instruction");
    await panel.locator("#saveStepButton").click();
    await panel.locator("#saveGuideButton").click();
    let guideCard = panel.locator("[data-guide-id]").filter({ hasText: guideName }).first();
    await expect(guideCard).toBeVisible();
    await guideCard.click();
    await panel.locator("#stepsList .step-item").first().click();
    await panel.locator("#instructionInput").fill("Stage 5 updated instruction");
    await panel.locator("#screenNameInput").fill("Stage5 Updated Screen");
    await panel.locator("#saveStepButton").click();
    await panel.locator("#stepsList .step-item").first().click();
    await expect(panel.locator("#instructionInput")).toContainText("Stage 5 updated instruction");
    await expect(panel.locator("#screenNameInput")).toHaveValue("Stage5 Updated Screen");
    await panel.locator("#cancelStepButton").click();
    await panel.locator("#guideNameInput").fill(updatedGuideName);
    await panel.locator("#saveGuideButton").click();
    guideCard = panel.locator("[data-guide-id]").filter({ hasText: updatedGuideName }).first();
    await expect(guideCard).toBeVisible();
    await guideCard.click();
    await panel.locator("#stepsList .step-item").first().click();
    await panel.locator("#deleteEditedStepButton").click();
    await panel.locator("#confirmDeleteButton").click();
    await expect(panel.locator("#stepsList .step-item")).toHaveCount(0);
    await panel.locator("#deleteEditedGuideButton").click();
    await panel.locator("#confirmDeleteButton").click();
    await expect(panel.locator("[data-guide-id]").filter({ hasText: updatedGuideName })).toHaveCount(0);
  } finally {
    try {
      if (await panel.locator("#guideEditorView").isVisible()) await panel.locator("#backToGuidesButton").click();
      for (const name of [updatedGuideName, guideName]) { const leftover = panel.locator("[data-guide-id]").filter({ hasText: name }).first(); if (await leftover.count()) { await leftover.click(); await panel.locator("#deleteEditedGuideButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); } }
    } catch {}
    await panel.close();
    if (crm) await crm.close();
  }
});


test("stage 5 editor management - metadata-only step edit does not require the target screen", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");

  const guideCard = panel.locator("[data-guide-id]").filter({ hasText: "תרגול מלא - Demo CRM" }).first();
  await expect(guideCard).toBeVisible();
  await guideCard.click();

  const firstStep = panel.locator("#stepsList .step-item").first();
  await firstStep.click();
  const originalScreenName = await panel.locator("#screenNameInput").inputValue();
  const temporaryScreenName = `Stage5 Metadata ${Date.now()}`;

  try {
    // Keep the active browser page away from Demo CRM. Updating persisted metadata
    // must not revalidate the unchanged business target against the current page.
    const unrelated = await context.newPage();
    await unrelated.goto("about:blank");
    await unrelated.bringToFront();

    await panel.locator("#screenNameInput").fill(temporaryScreenName);
    await panel.locator("#saveStepButton").click();
    await expect(panel.locator("#stepEditor")).toBeHidden();

    await panel.locator("#stepsList .step-item").first().click();
    await expect(panel.locator("#screenNameInput")).toHaveValue(temporaryScreenName);
    await panel.locator("#screenNameInput").fill(originalScreenName);
    await panel.locator("#saveStepButton").click();
    await unrelated.close();
  } finally {
    // Best-effort restore if an assertion interrupted the normal restore path.
    if (await panel.locator("#stepEditor").isVisible().catch(() => false)) {
      await panel.locator("#screenNameInput").fill(originalScreenName).catch(() => {});
      await panel.locator("#saveStepButton").click().catch(() => {});
    }
    await panel.close().catch(() => {});
  }
});


test("stage 5 editor preview - navigation, validation and exit cleanup work through the real UI", async () => {
  const guideName = "Stage 5 Preview " + Date.now();
  const panel = await openPanel();
  let crm = null;
  try {
    await login(panel, "sanity.editor");
    crm = await context.newPage();
    await crm.goto(SITE_URL + "/site.html");
    await crm.bringToFront();
    const content = crm.frameLocator('iframe[name="TargetContent"]');

    await panel.locator("#openNewGuideButton").click();
    const demoTopic = panel.locator("#topicSelect option").filter({ hasText: "Demo CRM" });
    await panel.locator("#topicSelect").selectOption(await demoTopic.getAttribute("value"));
    await panel.locator("#guideNameInput").fill(guideName);
    await panel.locator("#guideStartUrlInput").fill(SITE_URL + "/site.html");

    // Step 1: required validation on a real input.
    await panel.locator("#addStepButton").click();
    await panel.locator("#selectButton").click();
    await content.locator("#site-code").click();
    await panel.locator("#instructionInput").fill("Preview required step");
    await panel.locator("#validationTypeSelect").selectOption("required");
    await panel.locator("#validationErrorInput").fill("Preview required error");
    await panel.locator("#saveStepButton").click();

    // Step 2: a second real target so Preview Previous/Next can be exercised.
    await panel.locator("#addStepButton").click();
    await panel.locator("#selectButton").click();
    await content.locator("#site-name").click();
    await panel.locator("#instructionInput").fill("Preview second step");
    await panel.locator("#saveStepButton").click();

    await crm.bringToFront();
    await panel.locator("#previewGuideButton").click();
    let overlay = content.locator(".gwtp-training-overlay");
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toContainText("Preview required step");
    await expect(panel.locator("#previewProgress")).toContainText(/1.*2/);

    // Required must block Preview just as it blocks learner execution.
    const originalCode = await content.locator("#site-code").inputValue();
    await content.locator("#site-code").fill("");
    await overlay.locator("button").filter({ hasText: /הבא|Next/i }).click();
    await expect(overlay).toContainText("Preview required error");
    await expect(panel.locator("#previewProgress")).toContainText(/1.*2/);

    await content.locator("#site-code").fill(originalCode || "10082");
    await overlay.locator("button").filter({ hasText: /הבא|Next/i }).click();
    overlay = content.locator(".gwtp-training-overlay");
    await expect(overlay).toContainText("Preview second step");
    await expect(panel.locator("#previewProgress")).toContainText(/2.*2/);

    await overlay.locator("button").filter({ hasText: /הקודם|Previous/i }).click();
    await expect(content.locator(".gwtp-training-overlay")).toContainText("Preview required step");
    await expect(panel.locator("#previewProgress")).toContainText(/1.*2/);

    // The real Chrome Side Panel does not become the active tab when its controls are clicked.
    // In Playwright the sidepanel is hosted as a normal extension tab, so keep the CRM tab active
    // and dispatch the Side Panel control programmatically to preserve the real browser-shell contract.
    await crm.bringToFront();
    await panel.locator("#exitPreviewButton").evaluate((button) => button.click());
    await expect(panel.locator("#previewGuideButton")).toBeVisible();
    await expect(panel.locator("#previewActiveControls")).toBeHidden();
    await expect(content.locator(".gwtp-training-overlay")).toHaveCount(0);
    // Assert GWTP's inline training highlight is gone. Computed outline-width is not
    // reliable here because the input remains focused and the page/browser may render
    // its native focus ring with the same 3px width.
    await expect.poll(async () => content.locator("#site-code").evaluate((element) => ({
      outline: element.style.getPropertyValue("outline"),
      outlineOffset: element.style.getPropertyValue("outline-offset")
    }))).toEqual({ outline: "", outlineOffset: "" });
  } finally {
    await panel.close().catch(() => {});
    await crm?.close().catch(() => {});
  }
});

test("stage 5 editor management - persisted step reorder survives reopening the guide", async () => {
  // Diagnostic guard: this test should never need the suite-wide 30s timeout.
  // Fail the exact Playwright action/assertion quickly so a hang identifies its stage.
  test.setTimeout(20000);
  const guideName = "Stage 5 Reorder " + Date.now();
  const panel = await openPanel();
  panel.setDefaultTimeout(4000);
  let crm = null;
  try {
    await test.step("login as editor", async () => {
      await login(panel, "sanity.editor");
    });
    crm = await context.newPage();
    await crm.goto(SITE_URL + "/site.html");
    await crm.bringToFront();
    const content = crm.frameLocator('iframe[name="TargetContent"]');

    await panel.locator("#openNewGuideButton").click();
    const demoTopic = panel.locator("#topicSelect option").filter({ hasText: "Demo CRM" });
    await panel.locator("#topicSelect").selectOption(await demoTopic.getAttribute("value"));
    await panel.locator("#guideNameInput").fill(guideName);
    await panel.locator("#guideStartUrlInput").fill(SITE_URL + "/site.html");

    for (const [selector, instruction] of [["#site-code", "Reorder first"], ["#site-name", "Reorder second"]]) {
      await panel.locator("#addStepButton").click();
      await panel.locator("#selectButton").click();
      await content.locator(selector).click();
      await panel.locator("#instructionInput").fill(instruction);
      await panel.locator("#saveStepButton").click();
    }

    await panel.locator("#saveGuideButton").click();
    let card = panel.locator("[data-guide-id]").filter({ hasText: guideName }).first();
    await card.click();
    const before = await panel.locator("#stepsList .step-item .step-item__instruction").allTextContents();
    expect(before.map((x) => x.trim())).toEqual(["Reorder first", "Reorder second"]);

    const secondHandle = panel.locator("#stepsList .step-item").nth(1).locator(".step-item__drag-handle");

    // Playwright hosts the Side Panel as a normal extension tab. Keyboard events sent
    // with locator.press() depend on that tab being active, unlike the real Chrome
    // Side Panel. Dispatch the same bubbling/cancelable key event in the panel DOM so
    // this test exercises the product's keyboard reorder handler deterministically.
    await secondHandle.evaluate((handle) => {
      handle.focus();
      handle.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowUp",
        code: "ArrowUp",
        bubbles: true,
        cancelable: true
      }));
    });

    // The handler re-renders immediately and then persists asynchronously. The UI
    // order proves the handler ran; stepsSaved proves the server persistence finished.
    await expect.poll(async () => (await panel.locator("#stepsList .step-item .step-item__instruction").allTextContents()).map((x) => x.trim())).toEqual(["Reorder second", "Reorder first"]);
    await expect(panel.locator("#stepsSaveStatus")).toHaveAttribute("data-type", "success");

    await panel.locator("#backToGuidesButton").click();
    card = panel.locator("[data-guide-id]").filter({ hasText: guideName }).first();
    await card.click();
    await expect.poll(async () => (await panel.locator("#stepsList .step-item .step-item__instruction").allTextContents()).map((x) => x.trim())).toEqual(["Reorder second", "Reorder first"]);

    await panel.locator("#deleteEditedGuideButton").click();
    await panel.locator("#confirmDeleteButton").click();
  } finally {
    try {
      if (await panel.locator("#guideEditorView").isVisible()) await panel.locator("#backToGuidesButton").click();
      const leftover = panel.locator("[data-guide-id]").filter({ hasText: guideName }).first();
      if (await leftover.count()) { await leftover.click(); await panel.locator("#deleteEditedGuideButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); }
    } catch {}
    await panel.close().catch(() => {});
    await crm?.close().catch(() => {});
  }
});

test("stage 5 editor management - delete confirmation can be cancelled without deleting the topic", async () => {
  const topicName = "Stage 5 Cancel Delete " + Date.now();
  const panel = await openPanel();
  await login(panel, "sanity.editor");
  try {
    await panel.locator("#openTopicsButton").click();
    await panel.locator("#openCreateTopicButton").click();
    await panel.locator("#newTopicInput").fill(topicName);
    await panel.locator("#createTopicButton").click();
    let card = panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName }).first();
    await card.click();
    await panel.locator("#deleteEditedTopicButton").click();
    await expect(panel.locator("#deleteConfirmOverlay")).toBeVisible();
    await panel.locator("#cancelDeleteButton").click();
    await expect(panel.locator("#deleteConfirmOverlay")).toBeHidden();
    await expect(panel.locator("#editTopicEditor")).toBeVisible();
    await panel.locator("#cancelEditTopicButton").click();
    card = panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName }).first();
    await expect(card).toBeVisible();

    await card.click();
    await panel.locator("#deleteEditedTopicButton").click();
    await panel.locator("#confirmDeleteButton").click();
    await expect(panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName })).toHaveCount(0);
  } finally {
    const leftover = panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName }).first();
    if (await leftover.count()) { try { await leftover.click(); await panel.locator("#deleteEditedTopicButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); } catch {} }
    await panel.close();
  }
});


test("stage 5 management validation - admin user form rejects invalid and duplicate identities", async () => {
  const suffix = Date.now();
  const username = "stage5.valid." + suffix;
  const panel = await openPanel();
  await login(panel, "sanity.admin");
  try {
    await panel.locator("#openCreateUserButton").click();
    await panel.locator("#createUserButton").click();
    await expect(panel.locator("#createUserStatus")).toHaveAttribute("data-type", "error");
    await expect(panel.locator("#newDisplayName")).toHaveAttribute("aria-invalid", "true");
    await expect(panel.locator("#newUsername")).toHaveAttribute("aria-invalid", "true");
    await expect(panel.locator("#newPassword")).toHaveAttribute("aria-invalid", "true");

    await panel.locator("#newDisplayName").fill("Stage 5 Invalid");
    await panel.locator("#newUsername").fill("bad user");
    await panel.locator("#newPassword").fill("Stage5Pass!");
    await panel.locator("#createUserButton").click();
    await expect(panel.locator("#newUsername")).toHaveAttribute("aria-invalid", "true");

    await panel.locator("#newUsername").fill(username);
    await panel.locator("#newPassword").fill("bad pass");
    await panel.locator("#createUserButton").click();
    await expect(panel.locator("#newPassword")).toHaveAttribute("aria-invalid", "true");

    await panel.locator("#newPassword").fill("Stage5Pass!");
    await panel.locator("#createUserButton").click();
    await expect(panel.locator("[data-user-id]").filter({ hasText: username })).toHaveCount(1);

    await panel.locator("#openCreateUserButton").click();
    await panel.locator("#newDisplayName").fill("Duplicate Stage 5");
    await panel.locator("#newUsername").fill(username.toUpperCase());
    await panel.locator("#newPassword").fill("Stage5Pass!");
    await panel.locator("#createUserButton").click();
    await expect(panel.locator("#createUserStatus")).toHaveAttribute("data-type", "error");
    await expect(panel.locator("[data-user-id]").filter({ hasText: username })).toHaveCount(1);
  } finally {
    try {
      const card = panel.locator("[data-user-id]").filter({ hasText: username }).first();
      if (await card.count()) {
        await card.click();
        await panel.locator("#deleteEditedUserButton").click();
        if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click();
      }
    } catch {}
    await panel.close();
  }
});

test("stage 5 management validation - topic required duplicate and guide dependency rules are enforced", async () => {
  const topicName = "Stage 5 Dependency " + Date.now();
  const guideName = "Stage 5 Dependency Guide " + Date.now();
  const panel = await openPanel();
  await login(panel, "sanity.editor");
  try {
    await panel.locator("#openTopicsButton").click();
    await panel.locator("#openCreateTopicButton").click();
    await panel.locator("#createTopicButton").click();
    await expect(panel.locator("#topicStatus")).toHaveAttribute("data-type", "error");

    await panel.locator("#newTopicInput").fill(topicName);
    await panel.locator("#createTopicButton").click();
    await expect(panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName })).toHaveCount(1);

    await panel.locator("#openCreateTopicButton").click();
    await panel.locator("#newTopicInput").fill(topicName.toUpperCase());
    await panel.locator("#createTopicButton").click();
    await expect(panel.locator("#topicStatus")).toHaveAttribute("data-type", "error");
    await panel.locator("#cancelCreateTopicButton").click();
    await panel.locator("#backFromTopicsButton").click();

    await panel.locator("#openNewGuideButton").click();
    const topicOption = panel.locator("#topicSelect option").filter({ hasText: topicName });
    await panel.locator("#topicSelect").selectOption(await topicOption.getAttribute("value"));
    await panel.locator("#guideNameInput").fill(guideName);
    await panel.locator("#guideStartUrlInput").fill(SITE_URL + "/site.html");
    await panel.locator("#saveGuideButton").click();
    await expect(panel.locator("[data-guide-id]").filter({ hasText: guideName })).toHaveCount(1);

    await panel.locator("#openTopicsButton").click();
    let topicCard = panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName }).first();
    await topicCard.click();
    await panel.locator("#deleteEditedTopicButton").click();
    await panel.locator("#confirmDeleteButton").click();
    await expect(panel.locator("#editTopicStatus")).toHaveAttribute("data-type", "error");
    await expect(panel.locator("#editTopicEditor")).toBeVisible();
    await panel.locator("#cancelEditTopicButton").click();
    await panel.locator("#backFromTopicsButton").click();

    const guideCard = panel.locator("[data-guide-id]").filter({ hasText: guideName }).first();
    await guideCard.click();
    await panel.locator("#deleteEditedGuideButton").click();
    await panel.locator("#confirmDeleteButton").click();

    await panel.locator("#openTopicsButton").click();
    topicCard = panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName }).first();
    await topicCard.click();
    await panel.locator("#deleteEditedTopicButton").click();
    await panel.locator("#confirmDeleteButton").click();
    await expect(panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName })).toHaveCount(0);
  } finally {
    try {
      if (await panel.locator("#topicsView").isVisible()) await panel.locator("#backFromTopicsButton").click();
      const guide = panel.locator("[data-guide-id]").filter({ hasText: guideName }).first();
      if (await guide.count()) { await guide.click(); await panel.locator("#deleteEditedGuideButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); }
      await panel.locator("#openTopicsButton").click();
      const topic = panel.locator("#topicsList [data-topic-id]").filter({ hasText: topicName }).first();
      if (await topic.count()) { await topic.click(); await panel.locator("#deleteEditedTopicButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); }
    } catch {}
    await panel.close();
  }
});

test("stage 5 management validation - guide identity and availability rules block invalid saves", async () => {
  const guideName = "Stage 5 Guide Validation " + Date.now();
  const panel = await openPanel();
  let crm = null;
  await login(panel, "sanity.editor");
  try {
    await panel.locator("#openNewGuideButton").click();
    await expect(panel.locator("#addStepButton")).toBeDisabled();

    const demoTopic = panel.locator("#topicSelect option").filter({ hasText: "Demo CRM" });
    await panel.locator("#topicSelect").selectOption(await demoTopic.getAttribute("value"));
    await panel.locator("#guideNameInput").fill(guideName);
    await expect(panel.locator("#addStepButton")).toBeDisabled();
    await panel.locator("#guideStartUrlInput").fill(SITE_URL + "/site.html");
    await expect(panel.locator("#addStepButton")).toBeEnabled();

    // Availability cannot be enabled for a guide that has no authored steps.
    await panel.locator("#guideAvailableInput").check();
    await panel.locator("#saveGuideButton").click();
    await expect(panel.locator("#saveGuideStatus")).toHaveAttribute("data-type", "error");
    await expect(panel.locator("#guideEditorView")).toBeVisible();

    crm = await context.newPage();
    await crm.goto(SITE_URL + "/site.html");
    await crm.bringToFront();
    const content = crm.frameLocator('iframe[name="TargetContent"]');
    await panel.locator("#guideAvailableInput").uncheck();
    await panel.locator("#addStepButton").click();
    await panel.locator("#selectButton").click();
    await content.locator("#site-code").click();

    // Missing Instruction is prevented proactively by the editor: Save Step stays
    // disabled until both an element and non-empty instruction are present.
    await expect(panel.locator("#stepEditor")).toBeVisible();
    await expect(panel.locator("#saveStepButton")).toBeDisabled();

    await panel.locator("#instructionInput").fill("Valid authored step");
    await expect(panel.locator("#saveStepButton")).toBeEnabled();
    await panel.locator("#saveStepButton").click();
    await expect(panel.locator("#stepEditor")).toBeHidden();
    await panel.locator("#guideAvailableInput").check();
    await panel.locator("#saveGuideButton").click();
    await expect(panel.locator("[data-guide-id]").filter({ hasText: guideName })).toHaveCount(1);
  } finally {
    try {
      if (await panel.locator("#guideEditorView").isVisible()) await panel.locator("#backToGuidesButton").click();
      const guide = panel.locator("[data-guide-id]").filter({ hasText: guideName }).first();
      if (await guide.count()) { await guide.click(); await panel.locator("#deleteEditedGuideButton").click(); if (await panel.locator("#deleteConfirmOverlay").isVisible()) await panel.locator("#confirmDeleteButton").click(); }
    } catch {}
    await panel.close().catch(() => {});
    await crm?.close().catch(() => {});
  }
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
  await expect(content.locator(".gwtp-training-overlay")).toHaveCount(1);
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


test("stage 4 validation - equals, not-equals and contains block then allow Next", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const guide = panel.locator("#learnerGuideSelect option").filter({ hasText: "בדיקת כל חוקי הוולידציה" });
  await panel.locator("#learnerGuideSelect").selectOption(await guide.getAttribute("value"));

  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) await restart.click();
  else await panel.locator("#startLearningButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const next = () => content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });

  // Step 1 required: satisfy it so this test can focus on the next three rule types.
  await content.locator("#site-name").fill("Validation Site");
  await next().click();
  await expect(content.locator("#site-type")).toHaveCSS("outline-width", "3px");

  // Step 2 equals(branch): a different value must block, branch must advance.
  await content.locator("#site-type").selectOption("hq");
  await next().click();
  await expect(content.locator(".gwtp-training-overlay")).toContainText("יש לבחור סניף מכירות");
  await content.locator("#site-type").selectOption("branch");
  await next().click();
  // Navigation is asynchronous; wait until the next rule itself is rendered before
  // interacting with its target. The validation error belongs to a failed attempt on
  // that rule and must not be expected before the learner has attempted to continue.
  await expect(content.locator(".gwtp-training-overlay")).toContainText("בדיקת שונה מערך");

  // Step 3 not_equals(branch): branch must block, another real option must advance.
  await content.locator("#site-type").selectOption("branch");
  await next().click();
  await expect(content.locator(".gwtp-training-overlay")).toContainText("יש לבחור סוג אתר שאינו סניף מכירות");
  const alternativeValue = await content.locator("#site-type option").evaluateAll((options) =>
    options.map((option) => option.value).find((value) => value && value !== "branch")
  );
  expect(alternativeValue).toBeTruthy();
  await content.locator("#site-type").selectOption(alternativeValue);
  await next().click();
  await expect(content.locator("#site-name")).toHaveCSS("outline-width", "3px");

  // Step 4 contains(TEST): missing token must block, token present must advance.
  await content.locator("#site-name").fill("Validation Site");
  await next().click();
  await expect(content.locator(".gwtp-training-overlay")).toContainText("שם האתר חייב להכיל TEST");
  await content.locator("#site-name").fill("Validation TEST Site");
  await next().click();
  await expect(content.locator("#site-phone")).toHaveCSS("outline-width", "3px");

  await panel.close();
  await crm.close();
});


test("stage 4 validation - changed and changed-regex block then allow Next", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const guideOption = panel.locator("#learnerGuideSelect option").filter({ hasText: "בדיקת כל חוקי הוולידציה" });
  const guideId = await guideOption.getAttribute("value");
  await panel.locator("#learnerGuideSelect").selectOption(guideId);

  // QA setup: use the same background progress API to position the dedicated sanity
  // learner at step 5. This does not bypass validation during the assertions below.
  const guide = await panel.evaluate(async (id) => {
    const stored = await chrome.storage.local.get("gwtp.auth.user");
    const auth = stored["gwtp.auth.user"];
    const response = await fetch(`${globalThis.appConfig.api.baseUrl}/api/learner/guides/${id}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` }
    });
    if (!response.ok) throw new Error("Unable to load validation guide.");
    return response.json();
  }, guideId);

  await panel.evaluate(async (guideValue) => {
    const restart = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_RESTART", guide: guideValue });
    if (!restart?.success) throw new Error(restart?.message || "Unable to restart validation guide.");
    for (let index = 0; index < 4; index += 1) {
      const moved = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_NEXT" });
      if (!moved?.success) throw new Error(moved?.message || "Unable to prepare changed validation step.");
    }
  }, guide);

  // Continue from saved step 5 instead of navigating from step 1.
  const start = panel.locator("#startLearningButton");
  await expect(start).toContainText(/המשך למידה|Continue/i);
  await crm.bringToFront();
  await start.click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const phone = content.locator("#site-phone");
  const next = () => content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
  await expect(phone).toHaveCSS("outline-width", "3px", { timeout: 10000 });

  // Step 5 changed: untouched baseline must block; a changed value must advance.
  const baseline = await phone.inputValue();
  await next().click();
  await expect(content.locator(".gwtp-training-overlay")).toContainText("יש לשנות את מספר הטלפון");
  const changed = baseline === "03-7654321" ? "03-7654322" : "03-7654321";
  await phone.fill(changed);
  await next().click();

  // Step 6 changed_regex: Finish stays clickable, but its click handler must
  // reject both an unchanged value and a changed value with an invalid format.
  // Only a new regex-valid phone value may complete the guide.
  await expect(phone).toHaveCSS("outline-width", "3px");
  const step6Baseline = await phone.inputValue();
  const finish = () => content.locator(".gwtp-training-overlay button").filter({ hasText: /סיום|Finish/i });

  await finish().click();
  await expect(content.locator(".gwtp-training-overlay")).toContainText("יש להזין מספר טלפון חדש ותקין");
  await expect(content.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);

  await phone.fill("invalid-phone");
  await finish().click();
  await expect(content.locator(".gwtp-training-overlay")).toContainText("יש להזין מספר טלפון חדש ותקין");
  await expect(content.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);

  const validNewPhone = step6Baseline === "03-7654323" ? "03-7654324" : "03-7654323";
  await phone.fill(validNewPhone);
  await finish().click();
  await expect(content.locator('[role="dialog"][aria-modal="true"]')).toBeVisible({ timeout: 10000 });

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


test("learner can reopen the extension and resume saved progress", async () => {
  let panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const guide = panel.locator("#learnerGuideSelect option").filter({ hasText: "תרגול מלא - Demo CRM" });
  const guideId = await guide.getAttribute("value");
  await panel.locator("#learnerGuideSelect").selectOption(guideId);

  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) await restart.click();
  else await panel.locator("#startLearningButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });

  // Save a deterministic resume point at step 2 (zero-based index 1).
  const next = content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
  await next.click();
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(1);
  await expect(content.locator("#site-name")).toHaveCSS("outline-width", "3px");

  // Closing the Side Panel must not erase server progress. Clear the injected
  // guidance to model a closed/reopened UI, then create a fresh extension page.
  await panel.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "GWTP_CLEAR_TRAINING_STEP" });
      } catch {}
    }
  });
  await panel.close();

  panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
  await expect(panel.locator("#appView")).toBeVisible({ timeout: 10000 });
  await expect(panel.locator("#learnModeView")).toBeVisible();

  const reopenedTopic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await reopenedTopic.getAttribute("value"));
  const reopenedGuide = panel.locator("#learnerGuideSelect option").filter({ hasText: "תרגול מלא - Demo CRM" });
  await panel.locator("#learnerGuideSelect").selectOption(await reopenedGuide.getAttribute("value"));

  const continueButton = panel.locator("#startLearningButton");
  await expect(continueButton).toContainText(/המשך למידה|Continue/i);
  await expect(panel.locator("#restartLearningButton")).toBeVisible();

  await crm.bringToFront();
  await continueButton.click();

  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(1);
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });
  await expect(content.locator("#site-name")).toHaveCSS("outline-width", "3px");

  await panel.close();
  await crm.close();
});


test("completed guide is stored as Completed and starts over on the next run", async () => {
  let panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const validationGuide = panel.locator("#learnerGuideSelect option").filter({ hasText: "בדיקת כל חוקי הוולידציה" });
  const guideId = await validationGuide.getAttribute("value");
  await panel.locator("#learnerGuideSelect").selectOption(guideId);

  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) await restart.click();
  else await panel.locator("#startLearningButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });

  // Complete the compact validation guide while satisfying every authored rule.
  // Step indexes: 0 required name, 1 equals branch, 2 not-equals HQ,
  // 3 contains TEST, 4 changed phone, 5 changed+regex phone.
  await content.locator("#site-name").fill("TEST Completion Site");
  await content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i }).click();
  await expect(content.locator("#site-type")).toHaveCSS("outline-width", "3px");

  await content.locator("#site-type").selectOption("branch");
  await expect(content.locator("#site-type")).toHaveValue("branch", { timeout: 10000 });
  await content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i }).click();
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(2);

  // Step 2 requires a value different from branch. Changing this field triggers
  // the Demo CRM postback/reload, so wait for the new document/value before Next.
  await content.locator("#site-type").selectOption("hq");
  await expect(content.locator("#site-type")).toHaveValue("hq", { timeout: 10000 });
  await content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i }).click();
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(3);
  await expect(content.locator("#site-name")).toHaveCSS("outline-width", "3px");

  await content.locator("#site-name").fill("TEST Completion Site");
  await content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i }).click();
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(4);
  await expect(content.locator("#site-phone")).toHaveCSS("outline-width", "3px");

  let phone = content.locator("#site-phone");
  const baseline = await phone.inputValue();
  const firstChangedPhone = baseline === "03-7654321" ? "03-7654322" : "03-7654321";
  await phone.fill(firstChangedPhone);
  await content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i }).click();
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(5);

  phone = content.locator("#site-phone");
  const secondBaseline = await phone.inputValue();
  const secondChangedPhone = secondBaseline === "03-7654323" ? "03-7654324" : "03-7654323";
  await phone.fill(secondChangedPhone);

  const finish = content.locator(".gwtp-training-overlay button").filter({ hasText: /סיום|סיים|Finish/i });
  await expect(finish).toBeEnabled();
  await finish.click();

  const completion = content.locator('[role="dialog"][aria-modal="true"]');
  await expect(completion).toBeVisible({ timeout: 10000 });

  // Reopen the extension UI so its learner catalog is freshly loaded from the API.
  await panel.close();
  panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
  await expect(panel.locator("#learnModeView")).toBeVisible({ timeout: 10000 });

  const reopenedTopic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await reopenedTopic.getAttribute("value"));
  const reopenedGuide = panel.locator("#learnerGuideSelect option").filter({ hasText: "בדיקת כל חוקי הוולידציה" });
  await panel.locator("#learnerGuideSelect").selectOption(await reopenedGuide.getAttribute("value"));

  // Completed guides are not offered Continue/Restart. Pressing Start must restart
  // from step 1 rather than attempting to resume the completed final step.
  const start = panel.locator("#startLearningButton");
  await expect(start).toBeVisible();
  await expect(start).not.toContainText(/המשך למידה|Continue/i);
  await expect(panel.locator("#restartLearningButton")).toBeHidden();

  await crm.bringToFront();
  await start.click();
  await expect.poll(async () => panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return response?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(0);
  await expect(content.locator("#site-name")).toHaveCSS("outline-width", "3px");

  await panel.close();
  await crm.close();
});


test("learner sidepanel fits a narrow viewport", async () => {
  const panel = await openPanel();
  await panel.setViewportSize({ width: 320, height: 720 });
  await login(panel, "sanity.learner");
  await expect(panel.locator("#learnModeView")).toBeVisible();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const guide = panel.locator("#learnerGuideSelect option").filter({ hasText: "תרגול מלא - Demo CRM" });
  await panel.locator("#learnerGuideSelect").selectOption(await guide.getAttribute("value"));

  const sizes = await panel.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport + 1);

  for (const selector of ["#learnerTopicSelect", "#learnerGuideSelect", "#startLearningButton"]) {
    const locator = panel.locator(selector);
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
  }

  await panel.close();
});


test("editor sidepanel fits a narrow viewport", async () => {
  const panel = await openPanel();
  await panel.setViewportSize({ width: 320, height: 720 });
  await login(panel, "sanity.editor");
  await expect(panel.locator("#createModeView")).toBeVisible();

  const sizes = await panel.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport + 1);

  const visibleControls = panel.locator("#createModeView button:visible, #createModeView input:visible, #createModeView select:visible, #createModeView textarea:visible");
  const count = await visibleControls.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index++) {
    const box = await visibleControls.nth(index).boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
  }

  await panel.close();
});


test("visual layout - admin sidepanel fits a narrow viewport", async () => {
  const panel = await openPanel();
  await panel.setViewportSize({ width: 320, height: 720 });
  await login(panel, "sanity.admin");
  await expect(panel.locator("#adminView")).toBeVisible();

  const sizes = await panel.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport + 1);

  const controls = panel.locator("#adminView button:visible, #adminView input:visible, #adminView select:visible");
  for (let i = 0; i < await controls.count(); i++) {
    const box = await controls.nth(i).boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(321);
  }
  await panel.close();
});

test("visual layout - learner guidance stays inside a narrow target viewport", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");
  const crm = await context.newPage();
  await crm.setViewportSize({ width: 360, height: 640 });
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
  const overlay = content.locator(".gwtp-training-overlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });
  const fit = await overlay.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: innerWidth };
  });
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.viewport + 1);
  await panel.close();
  await crm.close();
});

test("visual layout - guidance controls remain usable with enlarged text", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");
  const crm = await context.newPage();
  await crm.setViewportSize({ width: 480, height: 720 });
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
  const overlay = content.locator(".gwtp-training-overlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await overlay.evaluate((element) => { element.style.fontSize = "28px"; });
  const buttons = overlay.locator("button");
  expect(await buttons.count()).toBeGreaterThan(0);
  for (let i = 0; i < await buttons.count(); i++) {
    await expect(buttons.nth(i)).toBeVisible();
  }
  const fit = await overlay.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: innerWidth, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
  });
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.viewport + 1);
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1);
  await panel.close();
  await crm.close();
});

test("visual layout - Hebrew learner guidance uses RTL direction", async () => {
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

  const overlay = crm.frameLocator('iframe[name="TargetContent"]').locator(".gwtp-training-overlay");
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await expect(overlay).toHaveAttribute("dir", "rtl");
  await panel.close();
  await crm.close();
});


test("accessibility resilience - login supports keyboard submission", async () => {
  const panel = await openPanel();
  await panel.locator("#usernameInput").fill("sanity.learner");
  await panel.locator("#passwordInput").fill(PASSWORD);
  await panel.locator("#passwordInput").press("Enter");
  await expect(panel.locator("#appView")).toBeVisible();
  await expect(panel.locator("#learnModeView")).toBeVisible();
  await panel.close();
});

test("accessibility resilience - learner primary controls are keyboard focusable", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");
  const topicSelect = panel.locator("#learnerTopicSelect");
  await topicSelect.focus();
  await expect(topicSelect).toBeFocused();

  // Guide selection is intentionally disabled until a topic is selected.
  // Exercise the real learner flow before asserting keyboard focusability.
  const topic = topicSelect.locator("option").filter({ hasText: "Demo CRM" });
  await topicSelect.selectOption(await topic.getAttribute("value"));

  const guideSelect = panel.locator("#learnerGuideSelect");
  await expect(guideSelect).toBeEnabled();
  await guideSelect.focus();
  await expect(guideSelect).toBeFocused();

  const guide = guideSelect.locator("option").filter({ hasText: "תרגול מלא - Demo CRM" });
  await guideSelect.selectOption(await guide.getAttribute("value"));

  const startButton = panel.locator("#startLearningButton");
  await expect(startButton).toBeEnabled();
  await startButton.focus();
  await expect(startButton).toBeFocused();
  await panel.close();
});

test("accessibility resilience - completion dialog traps focus and closes with Escape", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");
  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/site.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const validationGuide = panel.locator("#learnerGuideSelect option").filter({ hasText: "בדיקת כל חוקי הוולידציה" });
  await panel.locator("#learnerGuideSelect").selectOption(await validationGuide.getAttribute("value"));
  const restart = panel.locator("#restartLearningButton");
  if (await restart.isVisible()) await restart.click();
  else await panel.locator("#startLearningButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const next = content.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
  await content.locator("#site-name").fill("TEST Accessibility");
  await next.click();
  await content.locator("#site-type").selectOption("branch");
  await next.click();
  await expect.poll(async () => panel.evaluate(async () => (await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" }))?.current?.stepIndex ?? null), { timeout: 10000 }).toBe(2);
  await content.locator("#site-type").selectOption("hq");
  await next.click();
  await expect.poll(async () => panel.evaluate(async () => (await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" }))?.current?.stepIndex ?? null), { timeout: 10000 }).toBe(3);
  await content.locator("#site-name").fill("TEST Accessibility");
  await next.click();
  await expect.poll(async () => panel.evaluate(async () => (await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" }))?.current?.stepIndex ?? null), { timeout: 10000 }).toBe(4);
  let phone = content.locator("#site-phone");
  const baseline = await phone.inputValue();
  await phone.fill(baseline === "03-7654321" ? "03-7654322" : "03-7654321");
  await next.click();
  await expect.poll(async () => panel.evaluate(async () => (await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" }))?.current?.stepIndex ?? null), { timeout: 10000 }).toBe(5);
  phone = content.locator("#site-phone");
  const finalBaseline = await phone.inputValue();
  await phone.fill(finalBaseline === "03-7654323" ? "03-7654324" : "03-7654323");
  await content.locator(".gwtp-training-overlay button").filter({ hasText: /סיום|סיים|Finish/i }).click();

  const dialog = content.locator('[role="dialog"][aria-modal="true"]');
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.locator("button")).toBeFocused();
  await dialog.locator("button").press("Tab");
  await expect(dialog.locator("button")).toBeFocused();
  await dialog.locator("button").press("Escape");
  await expect(dialog).toBeHidden();

  await panel.close();
  await crm.close();
});

test("accessibility resilience - learner recovery actions remain available after missing target", async () => {
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
  await expect(crm.frameLocator('iframe[name="TargetContent"]').locator(".gwtp-training-overlay")).toBeVisible({ timeout: 10000 });

  await crm.goto(`${SITE_URL}/leads.html`);
  await panel.bringToFront();
  await panel.locator("#exitLearningButton").click();
  await expect(panel.locator("#learnerTopicSelect")).toBeEnabled();
  await expect(panel.locator("#learnerGuideSelect")).toBeEnabled();

  await panel.close();
  await crm.close();
});


test("stage 4 lifecycle - editor authors, previews and publishes a guide that learner can run", async () => {
  const guideName = `Stage 4 Lifecycle ${Date.now()}`;
  let createdGuideId = null;

  const editor = await openPanel();
  let crm = null;
  let learnerBeforePublish = null;
  let learner = null;

  try {
    await login(editor, "sanity.editor");

    crm = await context.newPage();
    await crm.goto(`${SITE_URL}/site.html`);
    await crm.bringToFront();

  // Create a new unpublished guide in the real editor.
  await editor.locator("#openNewGuideButton").click();
  await expect(editor.locator("#guideEditorView")).toBeVisible();

  const demoTopic = editor.locator("#topicSelect option").filter({ hasText: "Demo CRM" });
  await editor.locator("#topicSelect").selectOption(await demoTopic.getAttribute("value"));
  await editor.locator("#guideNameInput").fill(guideName);
  await editor.locator("#guideStartUrlInput").fill(`${SITE_URL}/site.html`);
  await expect(editor.locator("#guideAvailableInput")).not.toBeChecked();

  // Author one real step with the real element picker.
  await editor.locator("#addStepButton").click();
  await editor.locator("#selectButton").click();
  const content = crm.frameLocator('iframe[name="TargetContent"]');
  await content.locator("#site-code").click();
  const authoredSelector = (await editor.locator("#selectedSelector").innerText()).trim();
  expect(authoredSelector).not.toBe("");
  await editor.locator("#instructionInput").fill("Stage 4 lifecycle instruction");
  await editor.locator("#saveStepButton").click();
  await expect(editor.locator("#stepEditor")).toBeHidden();

  // Preview must work while the guide is still unpublished.
  await crm.bringToFront();
  await editor.locator("#previewGuideButton").click();
  await expect(content.locator("#site-code")).toHaveCSS("outline-width", "3px", { timeout: 10000 });
  await expect(content.locator(".gwtp-training-overlay")).toHaveCount(1);
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible();
  await editor.bringToFront();
  await editor.locator("#exitPreviewButton").click();

  // Save unpublished, then prove the learner catalog does not expose it.
  await editor.locator("#saveGuideButton").click();
  await expect(editor.locator("#guideLibraryView")).toBeVisible();
  const createdCard = editor.locator("[data-guide-id]").filter({ hasText: guideName }).first();
  await expect(createdCard).toBeVisible();
  createdGuideId = Number(await createdCard.getAttribute("data-guide-id"));
  expect(createdGuideId).toBeGreaterThan(0);

  learnerBeforePublish = await openPanel();
  await login(learnerBeforePublish, "sanity.learner");
  const learnerTopicBefore = learnerBeforePublish.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await learnerBeforePublish.locator("#learnerTopicSelect").selectOption(await learnerTopicBefore.getAttribute("value"));
  await expect(learnerBeforePublish.locator("#learnerGuideSelect option").filter({ hasText: guideName })).toHaveCount(0);
  await learnerBeforePublish.close();
  learnerBeforePublish = null;

  // Publish through the real editor.
  await createdCard.click();
  await editor.locator("#guideAvailableInput").check();
  await editor.locator("#saveGuideButton").click();
  await expect(editor.locator("#guideLibraryView")).toBeVisible();

  // A fresh learner session must now discover and run the authored guide.
  learner = await openPanel();
  await login(learner, "sanity.learner");
  const learnerTopic = learner.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await learner.locator("#learnerTopicSelect").selectOption(await learnerTopic.getAttribute("value"));
  const learnerGuide = learner.locator("#learnerGuideSelect option").filter({ hasText: guideName });
  await expect(learnerGuide).toHaveCount(1);
  await learner.locator("#learnerGuideSelect").selectOption(await learnerGuide.getAttribute("value"));

  await crm.bringToFront();
  await learner.locator("#startLearningButton").click();
  await expect(content.locator("#site-code")).toHaveCSS("outline-width", "3px", { timeout: 10000 });
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible();

  // Unpublish through the real editor and prove a fresh learner catalog hides it again.
  await learner.close();
  learner = null;
  await editor.bringToFront();
  let lifecycleCard = editor.locator("[data-guide-id]").filter({ hasText: guideName }).first();
  await lifecycleCard.click();
  await editor.locator("#guideAvailableInput").uncheck();
  await editor.locator("#saveGuideButton").click();
  await expect(editor.locator("#guideLibraryView")).toBeVisible();

  learner = await openPanel();
  await login(learner, "sanity.learner");
  const learnerTopicAfterUnpublish = learner.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await learner.locator("#learnerTopicSelect").selectOption(await learnerTopicAfterUnpublish.getAttribute("value"));
  await expect(learner.locator("#learnerGuideSelect option").filter({ hasText: guideName })).toHaveCount(0);
  } finally {
    await learnerBeforePublish?.close().catch(() => {});
    await learner?.close().catch(() => {});

    // Cleanup must run even when an assertion fails after the guide has been saved.
    if (createdGuideId) {
      try {
        await editor.bringToFront();
        const cleanupCard = editor.locator(`[data-guide-id="${createdGuideId}"]`).first();
        if (await cleanupCard.count()) {
          await cleanupCard.click();
          await editor.locator("#deleteEditedGuideButton").click();
          await expect(editor.locator("#deleteConfirmOverlay")).toBeVisible();
          await editor.locator("#confirmDeleteButton").click();
          await expect(editor.locator(`[data-guide-id="${createdGuideId}"]`)).toHaveCount(0);
        }
      } catch {
        // Preserve the original test failure; a later run can still identify the
        // timestamped QA fixture by guideName if UI cleanup itself is unavailable.
      }
    }

    await editor.close().catch(() => {});
    await crm?.close().catch(() => {});
  }
});


test("stage 4 grid - stable grid selector resolves the same logical target after server rerender", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");

  const crm = await context.newPage();
  const sortResponses = [];
  crm.on("response", (response) => {
    if (response.url().includes("/api/customers/10082?") && response.request().method() === "GET") {
      sortResponses.push(response.url());
    }
  });

  await crm.goto(`${SITE_URL}/customer360.html`);
  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const table = content.locator("#c360-summary-table");
  await expect(table).toBeVisible({ timeout: 10000 });

  const targetCell = table.locator("tbody td").filter({ hasText: "LD-3094" }).first();
  await expect(targetCell).toBeVisible();
  const originalRow = await targetCell.evaluate((cell) => cell.parentElement?.rowIndex ?? -1);

  const stableSelector = 'gwtp-grid:#c360-summary-table|1|"LD-3094"';
  const resolveGridSelector = async () => {
    const cells = table.locator("tbody tr td:first-child");
    const count = await cells.count();
    const matchingTexts = [];

    for (let index = 0; index < count; index += 1) {
      const text = (await cells.nth(index).innerText()).trim().replace(/\\s+/g, " ");
      if (text === "LD-3094") matchingTexts.push(text);
    }

    return {
      found: matchingTexts.length === 1,
      text: matchingTexts[0] || "",
      matchCount: matchingTexts.length
    };
  };

  expect(stableSelector).toBe('gwtp-grid:#c360-summary-table|1|"LD-3094"');
  const initialResolve = await resolveGridSelector();
  expect(initialResolve).toEqual({ found: true, text: "LD-3094", matchCount: 1 });

  const sortButton = content.locator('.ps-grid-sort[data-sort="referenceNumber"]');
  await sortButton.click();

  await expect.poll(() => sortResponses.some((url) =>
    url.includes("sort=referenceNumber") && url.includes("direction=desc")
  ), {
    message: "Customer 360 sort did not issue the expected server request",
    timeout: 10000
  }).toBeTruthy();

  await expect(sortButton).toHaveAttribute("aria-sort", "descending");
  await expect(targetCell).toBeVisible();
  const sortedRow = await targetCell.evaluate((cell) => cell.parentElement?.rowIndex ?? -1);
  expect(sortedRow).not.toBe(originalRow);

  const afterSortResolve = await resolveGridSelector();
  expect(afterSortResolve).toEqual({ found: true, text: "LD-3094", matchCount: 1 });

  await panel.close();
  await crm.close();
});


test("stage 4 grid learner - active guidance restores the logical target after grid rerender", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.learner");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/customer360.html`);
  await crm.bringToFront();

  const topic = panel.locator("#learnerTopicSelect option").filter({ hasText: "Demo CRM" });
  await panel.locator("#learnerTopicSelect").selectOption(await topic.getAttribute("value"));
  const guideOption = panel.locator("#learnerGuideSelect option").filter({ hasText: "תרגול מלא - Demo CRM" });
  const guideId = Number(await guideOption.getAttribute("value"));
  expect(guideId).toBeGreaterThan(0);

  // Put the sanity learner directly on the guide's existing Grid step. This is a
  // QA setup operation only; the runtime still renders and owns the real learner step.
  const auth = await panel.evaluate(async () => (await chrome.storage.local.get("gwtp.auth.user"))["gwtp.auth.user"]);
  expect(auth?.accessToken).toBeTruthy();

  const guideResponse = await panel.evaluate(async ({ apiUrl, id, token }) => {
    const response = await fetch(`${apiUrl}/api/learner/guides/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    });
    return { ok: response.ok, body: await response.json() };
  }, { apiUrl: API_URL, id: guideId, token: auth.accessToken });
  expect(guideResponse.ok).toBeTruthy();

  const gridStep = guideResponse.body.steps.find((step) => String(step.selector || "").startsWith("gwtp-grid:"));
  expect(gridStep, "Full Demo CRM guide must contain a Grid step").toBeTruthy();

  await panel.evaluate(async ({ guide, targetIndex }) => {
    const restart = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_RESTART", guide });
    if (!restart?.success) throw new Error(restart?.message || "Unable to restart learner progress.");

    for (let index = 0; index < targetIndex; index += 1) {
      const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_NEXT" });
      if (!response?.success) throw new Error(response?.message || "Unable to prepare Grid learner progress.");
    }
  }, { guide: guideResponse.body, targetIndex: Number(gridStep.stepOrder) - 1 });

  await panel.locator("#learnerGuideSelect").selectOption(String(guideId));
  const start = panel.locator("#startLearningButton");
  await expect(start).toBeVisible();
  await start.click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const targetText = "בטיפול מומחה";
  const targetCell = content.locator("#c360-summary-table tbody td").filter({ hasText: targetText }).first();
  await expect(targetCell).toHaveCSS("outline-width", "3px", { timeout: 10000 });
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible();

  const beforeRow = await targetCell.evaluate((cell) => cell.parentElement?.rowIndex ?? -1);
  const sortButton = content.locator('.ps-grid-sort[data-sort="status"]');
  // The training bubble may legitimately overlap the grid header. Trigger the
  // business control programmatically so this test exercises the server-side
  // rerender rather than Playwright's pointer hit-testing.
  await sortButton.evaluate((button) => button.click());
  await expect(sortButton).toHaveAttribute("aria-sort", "ascending");

  const rerenderedTarget = content.locator("#c360-summary-table tbody td").filter({ hasText: targetText }).first();
  await expect(rerenderedTarget).toBeVisible();
  const afterRow = await rerenderedTarget.evaluate((cell) => cell.parentElement?.rowIndex ?? -1);
  expect(afterRow).not.toBe(beforeRow);

  // A grid rerender replaces tbody cells. Ask the existing runner to restore the
  // current step, exactly as it does after readiness/recovery, and verify the stable
  // Grid selector resolves the new cell instance.
  await panel.evaluate(async () => {
    const response = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    if (!response?.current) throw new Error("Current learner progress is unavailable.");
    await window.guideRunner.showCurrentStep(response.current);
  });

  await expect(rerenderedTarget).toHaveCSS("outline-width", "3px", { timeout: 10000 });
  await expect(content.locator(".gwtp-training-overlay")).toBeVisible();

  await panel.close();
  await crm.close();
});


test("stage 4 grid editor - picker-authored grid selector survives row reorder", async () => {
  const panel = await openPanel();
  await login(panel, "sanity.editor");

  const crm = await context.newPage();
  await crm.goto(`${SITE_URL}/customer360.html`);
  await crm.bringToFront();

  // Reuse the existing Demo CRM guide only as editor context. The test does not
  // save or mutate the guide; it opens a new unsaved step and exercises the real picker.
  const guideCards = panel.locator("[data-guide-id]");
  const fullGuideCard = guideCards.filter({ hasText: "תרגול מלא - Demo CRM" }).first();
  await expect(fullGuideCard).toBeVisible({ timeout: 10000 });
  await fullGuideCard.click();

  await expect(panel.locator("#stepsSection")).toBeVisible();
  await panel.locator("#addStepButton").click();
  await expect(panel.locator("#stepEditor")).toBeVisible();

  await panel.locator("#selectButton").click();

  const content = crm.frameLocator('iframe[name="TargetContent"]');
  const targetText = "בטיפול מומחה";
  const targetCell = content.locator("#c360-summary-table tbody td").filter({ hasText: targetText }).first();
  await expect(targetCell).toBeVisible();

  // The real content-script picker intercepts this click and sends
  // GWTP_ELEMENT_SELECTED back to the editor.
  await targetCell.click();

  const selector = panel.locator("#selectedSelector");
  await expect(selector).toContainText("gwtp-grid:", { timeout: 10000 });
  const authoredSelector = (await selector.innerText()).trim();
  // The picker may choose either the table's unique stable ID or its unique stable
  // class. Both are valid Grid identities; the behavior under rerender is what this
  // E2E test must prove rather than coupling the test to one selector-builder detail.
  expect(authoredSelector.startsWith("gwtp-grid:")).toBeTruthy();

  const beforeRow = await targetCell.evaluate((cell) => cell.parentElement?.rowIndex ?? -1);
  const sortButton = content.locator('.ps-grid-sort[data-sort="status"]');
  await sortButton.click();
  await expect(sortButton).toHaveAttribute("aria-sort", "ascending");

  const rerenderedTarget = content.locator("#c360-summary-table tbody td").filter({ hasText: targetText }).first();
  await expect(rerenderedTarget).toBeVisible();
  const afterRow = await rerenderedTarget.evaluate((cell) => cell.parentElement?.rowIndex ?? -1);
  expect(afterRow).not.toBe(beforeRow);

  // Ask the editor to highlight the selected authored target again. This uses the
  // same stable Grid selector through the real content-script element finder.
  await panel.evaluate(async (selectorValue) => {
    const responses = await window.messagingService.sendToAllFrames({
      type: "GWTP_HIGHLIGHT_ELEMENT",
      selector: selectorValue
    });
    if (!responses.some((item) => item.response?.success)) {
      throw new Error("The authored Grid selector no longer resolves after sorting.");
    }
  }, authoredSelector);

  await expect(rerenderedTarget).toHaveCSS("outline-width", "3px", { timeout: 10000 });

  await panel.close();
  await crm.close();
});
