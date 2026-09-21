const PICKER_ATTRIBUTE = "data-gwtp-picker-hovered";

let pickerActive = false;
let hoveredElement = null;
let keyboardPickerElement = null;
let keyboardPickerOriginalTabIndex = null;

function getFrameContext() {
  const isTop = window.top === window;
  let frameElement = null;

  try {
    frameElement = window.frameElement;
  } catch {
    frameElement = null;
  }

  return {
    isTop,
    url: window.location.href,
    name: window.name || "",
    elementId: frameElement?.id || "",
    elementName: frameElement?.getAttribute?.("name") || "",
    elementTitle: frameElement?.getAttribute?.("title") || ""
  };
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

  if (keyboardPickerElement) {
    if (keyboardPickerOriginalTabIndex == null) {
      keyboardPickerElement.removeAttribute("tabindex");
    } else {
      keyboardPickerElement.setAttribute("tabindex", keyboardPickerOriginalTabIndex);
    }
    keyboardPickerElement = null;
    keyboardPickerOriginalTabIndex = null;
  }
  document.removeEventListener("mouseover", onPickerMouseOver, true);
  document.removeEventListener("click", onPickerClick, true);
  document.removeEventListener("keydown", onPickerKeyDown, true);
}

function onPickerClick(event) {
  if (!pickerActive) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  selectPickerElement(event.target);
}

function selectPickerElement(element) {
  if (!(element instanceof Element)) return false;

  const selector = createSelector(element);
  const details = {
    tagName: element.tagName.toLowerCase(),
    id: element.id || "",
    selector,
    text: (element.innerText || element.getAttribute("aria-label") || "").trim().slice(0, 120),
    frame: getFrameContext()
  };

  stopElementPicker();
  highlightElement(selector);

  chrome.runtime.sendMessage({
    type: "GWTP_ELEMENT_SELECTED",
    element: details
  }).catch(() => {});

  return true;
}

function onPickerKeyDown(event) {
  if (!pickerActive) return;

  if (event.key === "Escape") {
    stopElementPicker();
    chrome.runtime.sendMessage({ type: "GWTP_ELEMENT_SELECTION_CANCELLED" }).catch(() => {});
    return;
  }

  if (event.key !== "Enter") return;

  const focusedElement = document.activeElement;
  if (!focusedElement || focusedElement === document.body || focusedElement === document.documentElement) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  selectPickerElement(focusedElement);
}

function startElementPicker(options = {}) {
  stopElementPicker();
  clearHighlight();
  pickerActive = true;
  document.addEventListener("mouseover", onPickerMouseOver, true);
  document.addEventListener("click", onPickerClick, true);
  document.addEventListener("keydown", onPickerKeyDown, true);

  if (options.keyboardStart === true) {
    const candidates = [...document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [contenteditable="true"], [tabindex]'
    )].filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
      if (element.matches("[disabled], [inert]")) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return element.getClientRects().length > 0;
    });

    const first = candidates[0] || document.body;
    if (first instanceof HTMLElement) {
      keyboardPickerElement = first;
      keyboardPickerOriginalTabIndex = first.getAttribute("tabindex");
      if (!first.matches('a[href], button, input, select, textarea, [contenteditable="true"], [tabindex]')) {
        first.tabIndex = 0;
      }
      first.focus({ preventScroll: false });
      first.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  return {
    success: true,
    message: options.keyboardStart === true
      ? "Keyboard selection mode active. Focus moved to the page. Use Tab or Shift+Tab, press Enter to select, or Escape to cancel."
      : "Selection mode active. Click an element, or focus it with the keyboard and press Enter. Press Escape to cancel."
  };
}
