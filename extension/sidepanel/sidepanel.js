const selectorInput = document.getElementById("selectorInput");
const highlightButton = document.getElementById("highlightButton");
const clearButton = document.getElementById("clearButton");
const statusElement = document.getElementById("status");

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
      "This page cannot currently be controlled. Try a regular http/https page and reload it after installing the extension.",
      "error"
    );
    console.error(error);
  }
});

clearButton.addEventListener("click", async () => {
  try {
    await sendToActivePage({ type: "GWTP_CLEAR_HIGHLIGHT" });
    setStatus("Highlight cleared.", "success");
  } catch (error) {
    setStatus("Could not clear the highlight on this page.", "error");
    console.error(error);
  }
});
