const PICKER_ATTRIBUTE = "data-gwtp-picker-hovered";

let pickerActive = false;
let hoveredElement = null;

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

  hoveredElement.style.setProperty(
    "outline",
    hoveredElement.dataset.gwtpPickerPreviousOutline || "",
    hoveredElement.dataset.gwtpPickerPreviousOutlinePriority || ""
  );
  hoveredElement.style.setProperty(
    "outline-offset",
    hoveredElement.dataset.gwtpPickerPreviousOutlineOffset || "",
    hoveredElement.dataset.gwtpPickerPreviousOutlineOffsetPriority || ""
  );
  delete hoveredElement.dataset.gwtpPickerPreviousOutline;
  delete hoveredElement.dataset.gwtpPickerPreviousOutlinePriority;
  delete hoveredElement.dataset.gwtpPickerPreviousOutlineOffset;
  delete hoveredElement.dataset.gwtpPickerPreviousOutlineOffsetPriority;
  hoveredElement.removeAttribute(PICKER_ATTRIBUTE);
  hoveredElement = null;
}

function onPickerMouseOver(event) {
  if (!pickerActive || event.target === hoveredElement) return;

  clearPickerHover();
  hoveredElement = event.target;
  hoveredElement.dataset.gwtpPickerPreviousOutline = hoveredElement.style.getPropertyValue("outline");
  hoveredElement.dataset.gwtpPickerPreviousOutlinePriority = hoveredElement.style.getPropertyPriority("outline");
  hoveredElement.dataset.gwtpPickerPreviousOutlineOffset = hoveredElement.style.getPropertyValue("outline-offset");
  hoveredElement.dataset.gwtpPickerPreviousOutlineOffsetPriority = hoveredElement.style.getPropertyPriority("outline-offset");
  hoveredElement.setAttribute(PICKER_ATTRIBUTE, "true");
  hoveredElement.style.setProperty("outline", "3px solid #f59e0b", "important");
  hoveredElement.style.setProperty("outline-offset", "2px", "important");
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
    text: (element.innerText || element.getAttribute("aria-label") || "").trim().slice(0, 120),
    frame: getFrameContext()
  };

  stopElementPicker();
  highlightElement(selector);

  chrome.runtime.sendMessage({
    type: "GWTP_ELEMENT_SELECTED",
    element: details
  }).catch(() => {});
}

function onPickerKeyDown(event) {
  if (event.key !== "Escape") return;

  stopElementPicker();
  chrome.runtime.sendMessage({ type: "GWTP_ELEMENT_SELECTION_CANCELLED" }).catch(() => {});
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
