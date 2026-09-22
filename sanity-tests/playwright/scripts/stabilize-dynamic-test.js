const fs = require("fs");
const path = require("path");

const specPath = path.resolve(__dirname, "../tests/extension-smoke.spec.js");
let source = fs.readFileSync(specPath, "utf8");

const oldBlock = `  await app.locator("#replace-frame").click();
  const frame = app.frameLocator('iframe[name="DynamicContent"]');
  await expect(frame.locator("#frame-target")).toBeVisible();
  await app.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i }).click();
  await expect(frame.locator("#frame-target")).toHaveCSS("outline-width", "3px");`;

const newBlock = `  await app.locator("#replace-frame").click();
  const frame = app.frameLocator('iframe[name="DynamicContent"]');
  await expect(frame.locator("#frame-target")).toBeVisible();

  // The host frame can exist before GWTP has consumed the frame PAGE_READY event.
  // Wait for the training state to confirm that the current step is still the
  // frame-creation action and that its overlay survived before advancing. This
  // synchronizes on observable GWTP state instead of using an arbitrary delay.
  await expect.poll(async () => panel.evaluate(async () => {
    const result = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    return result?.current?.stepIndex ?? null;
  }), { timeout: 10000 }).toBe(3);
  const frameCreationNext = app.locator(".gwtp-training-overlay button").filter({ hasText: /הבא|Next/i });
  await expect(frameCreationNext).toBeVisible({ timeout: 10000 });
  await frameCreationNext.click();
  await expect(frame.locator("#frame-target")).toHaveCSS("outline-width", "3px");`;

if (!source.includes(oldBlock)) {
  throw new Error("Expected dynamic-frame test block was not found; no changes were made.");
}
source = source.replace(oldBlock, newBlock);
fs.writeFileSync(specPath, source, "utf8");
console.log("Dynamic frame test stabilized using observable GWTP state; no sleeps added.");
