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
        throw error;
      }
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, message, options.frameId != null ? { frameId: options.frameId } : undefined);
    } catch (error) {
      if (!isMissingReceiverError(error)) {
        throw error;
      }

      throw error;
    }
  }

  async function sendToAllFrames(message, options = {}) {
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
        results.push({ frameId: frame.frameId, frameInfo: frame.result, error: error.message });
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

      throw error;
    }
  }

  window.messagingService = {
    sendToActivePage,
    sendToAllFrames,
    sendToMatchingFrame
  };
})();
