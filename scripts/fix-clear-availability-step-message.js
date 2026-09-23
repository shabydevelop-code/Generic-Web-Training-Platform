const fs = require("fs");
const path = require("path");

const sidepanelPath = path.resolve(__dirname, "../extension/sidepanel/sidepanel.js");
const testPath = path.resolve(__dirname, "../sanity-tests/playwright/tests/extension-smoke.spec.js");

let sidepanel = fs.readFileSync(sidepanelPath, "utf8");
const oldValidity = `function updateGuideEditorValidity() {
  const hasTopic = Boolean(topicSelect.value);
  const hasGuideName = Boolean(guideNameInput.value.trim());
  const hasStartUrl = Boolean(guideStartUrlInput.value.trim());
  const guideIdentityValid = hasTopic && hasGuideName && hasStartUrl;

  addStepButton.disabled = !guideIdentityValid;`;
const newValidity = `function updateGuideEditorValidity() {
  const hasTopic = Boolean(topicSelect.value);
  const hasGuideName = Boolean(guideNameInput.value.trim());
  const hasStartUrl = Boolean(guideStartUrlInput.value.trim());
  const guideIdentityValid = hasTopic && hasGuideName && hasStartUrl;
  const steps = window.trainingService.getSteps();
  const language = window.i18nService.getLanguage();

  // The availability error is only valid while the guide has no steps.
  // Clear it as soon as the first step exists, without clearing unrelated statuses.
  if (
    steps.length > 0 &&
    saveGuideStatus.textContent === window.i18nService.translate("availableGuideRequiresStep", language)
  ) {
    saveGuideStatus.textContent = "";
    saveGuideStatus.removeAttribute("data-type");
  }

  addStepButton.disabled = !guideIdentityValid;`;
if (!sidepanel.includes(oldValidity)) throw new Error("updateGuideEditorValidity block not found");
sidepanel = sidepanel.replace(oldValidity, newValidity);
fs.writeFileSync(sidepanelPath, sidepanel, "utf8");

let test = fs.readFileSync(testPath, "utf8");
const oldTest = `    await panel.locator("#guideAvailableInput").uncheck();
    await panel.locator("#addStepButton").click();`;
const newTest = `    await panel.locator("#addStepButton").click();`;
if (!test.includes(oldTest)) throw new Error("availability test setup block not found");
test = test.replace(oldTest, newTest);

const oldAssertion = `    await panel.locator("#saveStepButton").click();
    await expect(panel.locator("#stepEditor")).toBeHidden();
    await panel.locator("#guideAvailableInput").check();
    await panel.locator("#saveGuideButton").click();`;
const newAssertion = `    await panel.locator("#saveStepButton").click();
    await expect(panel.locator("#stepEditor")).toBeHidden();
    await expect(panel.locator("#saveGuideStatus")).toHaveText("");
    await expect(panel.locator("#saveGuideStatus")).not.toHaveAttribute("data-type", "error");
    await expect(panel.locator("#guideAvailableInput")).toBeChecked();
    await panel.locator("#saveGuideButton").click();`;
if (!test.includes(oldAssertion)) throw new Error("availability test assertion block not found");
test = test.replace(oldAssertion, newAssertion);
fs.writeFileSync(testPath, test, "utf8");

console.log("Availability-step message behavior and regression test updated.");
