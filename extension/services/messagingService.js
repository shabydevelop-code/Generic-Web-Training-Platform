(function () {
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    return tab;
  }

  function isMissingReceiverError(error) {
    return error?.message?.includes("Receiving end does not exist");
  }

  async function restorePageConnection(tabId) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "content/dom/element-finder.js",
        "content/dom/selector-builder.js",
        "content/overlay/highlighter.js",
        "content/overlay/element-picker.js",
        "content/overlay/training-runner.js",
        "content/content-script.js"
      ]
    });
  }

  async function sendToActivePage(message) {
    const tab = await getActiveTab();

    if (!tab?.id) {
      throw new Error("No active browser tab was found.");
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error;
      }

      await restorePageConnection(tab.id);
      return chrome.tabs.sendMessage(tab.id, message);
    }
  }

  window.messagingService = {
    sendToActivePage
  };
})();
