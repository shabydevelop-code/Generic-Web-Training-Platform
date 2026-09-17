const selectorInput = document.getElementById("selectorInput");
const selectButton = document.getElementById("selectButton");
const highlightButton = document.getElementById("highlightButton");
const clearButton = document.getElementById("clearButton");
const statusElement = document.getElementById("status");
const selectedElement = document.getElementById("selectedElement");
const selectedTag = document.getElementById("selectedTag");
const selectedSelector = document.getElementById("selectedSelector");

function setStatus(message, type = "info") {
  statusElement.textContent = message;
  statusElement.dataset.type = type;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToActivePage(message) {
  const tab = await getActiveTab();

  if (!tab?.id) {
    throw new Error("No active browser tab was found.");
  }

  return chrome.tabs.sendMessage(tab.id, message);
}

selectButton.addEventListener("click", async () => {
  try {
    const response = await sendToActivePage({ type: "GWTP_START_ELEMENT_PICKER" });
    setStatus(response?.message || "Selection mode active.");
  } catch (error) {
    setStatus(
      "This page cannot currently be controlled. Try a regular http/https page and reload it after updating the extension.",
      "error"
    );
    console.error(error);
  }
});

highlightButton.addEventListener("click", async () => {
  const selector = selectorInput.value.trim();

  if (!selector) {
    setStatus("Enter a CSS selector first.", "error");
    return;
  }

  setStatus("Looking for the element...");

  try {
    const response = await sendToActivePage({
      type: "GWTP_HIGHLIGHT_ELEMENT",
      selector
    });

    setStatus(
      response?.message || "Request completed.",
      response?.success ? "success" : "error"
    );
  } catch (error) {
    setStatus(
      "This page cannot currently be controlled. Try a regular http/https page and reload it after updating the extension.",
      "error"
    );
    console.error(error);
  }
});

clearButton.addEventListener("click", async () => {
  try {
    await sendToActivePage({ type: "GWTP_CLEAR_HIGHLIGHT" });
    selectedElement.hidden = true;
    setStatus("Highlight cleared.", "success");
  } catch (error) {
    setStatus("Could not clear the highlight on this page.", "error");
    console.error(error);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GWTP_ELEMENT_SELECTED") {
    const element = message.element;
    selectorInput.value = element.selector;
    selectedTag.textContent = `<${element.tagName}>${element.text ? ` — ${element.text}` : ""}`;
    selectedSelector.textContent = element.selector;
    selectedElement.hidden = false;
    setStatus("Element selected successfully.", "success");
    return;
  }

  if (message?.type === "GWTP_ELEMENT_SELECTION_CANCELLED") {
    setStatus("Element selection cancelled.");
  }
});
