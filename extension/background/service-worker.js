import "../config/app-config.js";
import "./training-engine.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});


chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "start-element-picker") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const frames = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => ({
        href: window.location.href,
        isTop: window.top === window
      })
    });

    let started = false;
    for (const frame of frames) {
      try {
        const response = await chrome.tabs.sendMessage(
          tab.id,
          { type: "GWTP_START_ELEMENT_PICKER" },
          { frameId: frame.frameId }
        );
        started ||= response?.success === true;
      } catch {
        // A single inaccessible/unready frame must not block the other frames.
      }
    }

    if (started) {
      chrome.runtime.sendMessage({ type: "GWTP_ELEMENT_PICKER_STARTED_BY_COMMAND" }).catch(() => {});
    }
  } catch {
    // Browser-internal and otherwise restricted pages cannot run the picker.
  }
});
