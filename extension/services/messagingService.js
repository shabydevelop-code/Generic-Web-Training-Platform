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

  const contentFiles = [
    "config/visual-config.js",
    "content/dom/element-finder.js",
    "content/dom/selector-builder.js",
    "content/overlay/highlighter.js",
    "content/overlay/element-picker.js",
    "content/overlay/training-runner.js",
    "content/content-script.js"
  ];

  async function restorePageConnection(tabId, allFrames = false) {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames },
      files: contentFiles
    });
  }

  async function sendToActivePage(message, options = {}) {
    const tab = await getActiveTab();

    if (!tab?.id) {
      throw new Error("No active browser tab was found.");
    }

    const allFrames = options.allFrames === true;

    if (allFrames) {
      try {
        const responses = await chrome.tabs.sendMessage(tab.id, message);
        return responses;
      } catch (error) {
        if (!isMissingReceiverError(error)) throw error;
        await restorePageConnection(tab.id, true);
        return chrome.tabs.sendMessage(tab.id, message);
      }
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, message, options.frameId != null ? { frameId: options.frameId } : undefined);
    } catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error;
      }

      await restorePageConnection(tab.id, false);
      return chrome.tabs.sendMessage(tab.id, message, options.frameId != null ? { frameId: options.frameId } : undefined);
    }
  }

  async function sendToAllFrames(message) {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active browser tab was found.");

    const frames = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => ({ href: location.href, isTop: window.top === window, name: window.name || "" })
    });

    const results = [];
    for (const frame of frames) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, message, { frameId: frame.frameId });
        results.push({ frameId: frame.frameId, frameInfo: frame.result, response });
      } catch (error) {
        if (isMissingReceiverError(error)) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [frame.frameId] },
            files: contentFiles
          });
          const response = await chrome.tabs.sendMessage(tab.id, message, { frameId: frame.frameId });
          results.push({ frameId: frame.frameId, response });
        } else {
          results.push({ frameId: frame.frameId, frameInfo: frame.result, error: error.message });
        }
      }
    }
    return results;
  }

  async function sendToMatchingFrame(message, matcher) {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active browser tab was found.");

    const frames = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => ({ href: location.href, isTop: window.top === window, name: window.name || "" })
    });

    const frame = frames.find((item) => matcher(item.result));
    if (!frame) return null;

    try {
      return await chrome.tabs.sendMessage(tab.id, message, { frameId: frame.frameId });
    } catch (error) {
      if (!isMissingReceiverError(error)) throw error;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frame.frameId] },
        files: contentFiles
      });

      return chrome.tabs.sendMessage(tab.id, message, { frameId: frame.frameId });
    }
  }

  window.messagingService = {
    sendToActivePage,
    sendToAllFrames,
    sendToMatchingFrame
  };
})();
