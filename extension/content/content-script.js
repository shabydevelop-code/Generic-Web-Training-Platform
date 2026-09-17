const HIGHLIGHT_ATTRIBUTE = "data-gwtp-highlighted";

function clearHighlight() {
  const highlightedElements = document.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}]`);

  highlightedElements.forEach((element) => {
    element.style.outline = element.dataset.gwtpPreviousOutline || "";
    element.style.outlineOffset = element.dataset.gwtpPreviousOutlineOffset || "";

    delete element.dataset.gwtpPreviousOutline;
    delete element.dataset.gwtpPreviousOutlineOffset;
    element.removeAttribute(HIGHLIGHT_ATTRIBUTE);
  });
}

function highlightElement(selector) {
  clearHighlight();

  let element;

  try {
    element = document.querySelector(selector);
  } catch {
    return {
      success: false,
      message: "The CSS selector is invalid."
    };
  }

  if (!element) {
    return {
      success: false,
      message: "No element matched this selector."
    };
  }

  element.dataset.gwtpPreviousOutline = element.style.outline;
  element.dataset.gwtpPreviousOutlineOffset = element.style.outlineOffset;
  element.setAttribute(HIGHLIGHT_ATTRIBUTE, "true");

  element.style.outline = "3px solid #2563eb";
  element.style.outlineOffset = "3px";
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

  return {
    success: true,
    message: "Element highlighted successfully."
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GWTP_HIGHLIGHT_ELEMENT") {
    sendResponse(highlightElement(message.selector));
    return;
  }

  if (message?.type === "GWTP_CLEAR_HIGHLIGHT") {
    clearHighlight();
    sendResponse({ success: true });
  }
});
