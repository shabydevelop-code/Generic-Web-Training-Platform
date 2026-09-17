const HIGHLIGHT_ATTRIBUTE = "data-gwtp-highlighted";
const PICKER_ATTRIBUTE = "data-gwtp-picker-hovered";

let pickerActive = false;
let hoveredElement = null;

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
    return { success: false, message: "The CSS selector is invalid." };
  }

  if (!element) {
    return { success: false, message: "No element matched this selector." };
  }

  element.dataset.gwtpPreviousOutline = element.style.outline;
  element.dataset.gwtpPreviousOutlineOffset = element.style.outlineOffset;
  element.setAttribute(HIGHLIGHT_ATTRIBUTE, "true");
  element.style.outline = "3px solid #2563eb";
  element.style.outlineOffset = "3px";
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

  return { success: true, message: "Element highlighted successfully." };
}

function clearPickerHover() {
  if (!hoveredElement) return;

  hoveredElement.style.outline = hoveredElement.dataset.gwtpPickerPreviousOutline || "";
  hoveredElement.style.outlineOffset = hoveredElement.dataset.gwtpPickerPreviousOutlineOffset || "";
  delete hoveredElement.dataset.gwtpPickerPreviousOutline;
  delete hoveredElement.dataset.gwtpPickerPreviousOutlineOffset;
  hoveredElement.removeAttribute(PICKER_ATTRIBUTE);
  hoveredElement = null;
}

function createSelector(element) {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let part = current.tagName.toLowerCase();

    const stableClass = [...current.classList].find(
      (className) => className && !className.startsWith("gwtp-")
    );

    if (stableClass) {
      part += `.${CSS.escape(stableClass)}`;
    } else if (current.parentElement) {
      const siblings = [...current.parentElement.children].filter(
        (sibling) => sibling.tagName === current.tagName
      );

      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }

    parts.unshift(part);
    const selector = parts.join(" > ");

    try {
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    } catch {
      // Continue building a more specific selector.
    }

    current = current.parentElement;
  }

  return parts.join(" > ");
}

function onPickerMouseOver(event) {
  if (!pickerActive || event.target === hoveredElement) return;

  clearPickerHover();
  hoveredElement = event.target;
  hoveredElement.dataset.gwtpPickerPreviousOutline = hoveredElement.style.outline;
  hoveredElement.dataset.gwtpPickerPreviousOutlineOffset = hoveredElement.style.outlineOffset;
  hoveredElement.setAttribute(PICKER_ATTRIBUTE, "true");
  hoveredElement.style.outline = "3px solid #f59e0b";
  hoveredElement.style.outlineOffset = "2px";
}

function stopElementPicker() {
  if (!pickerActive) return;

  pickerActive = false;
  clearPickerHover();
  document.removeEventListener("mouseover", onPickerMouseOver, true);
  document.removeEventListener("click", onPickerClick, true);
  document.removeEventListener("keydown", onPickerKeyDown, true);
}

function onPickerClick(event) {
  if (!pickerActive) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const element = event.target;
  const selector = createSelector(element);
  const details = {
    tagName: element.tagName.toLowerCase(),
    id: element.id || "",
    selector,
    text: (element.innerText || element.getAttribute("aria-label") || "").trim().slice(0, 120)
  };

  stopElementPicker();
  highlightElement(selector);

  chrome.runtime.sendMessage({
    type: "GWTP_ELEMENT_SELECTED",
    element: details
  });
}

function onPickerKeyDown(event) {
  if (event.key !== "Escape") return;

  stopElementPicker();
  chrome.runtime.sendMessage({ type: "GWTP_ELEMENT_SELECTION_CANCELLED" });
}

function startElementPicker() {
  stopElementPicker();
  clearHighlight();
  pickerActive = true;
  document.addEventListener("mouseover", onPickerMouseOver, true);
  document.addEventListener("click", onPickerClick, true);
  document.addEventListener("keydown", onPickerKeyDown, true);

  return {
    success: true,
    message: "Selection mode active. Click an element on the page or press Escape to cancel."
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GWTP_HIGHLIGHT_ELEMENT") {
    sendResponse(highlightElement(message.selector));
    return;
  }

  if (message?.type === "GWTP_CLEAR_HIGHLIGHT") {
    stopElementPicker();
    clearHighlight();
    sendResponse({ success: true });
    return;
  }

  if (message?.type === "GWTP_START_ELEMENT_PICKER") {
    sendResponse(startElementPicker());
  }
});
