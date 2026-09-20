const HIGHLIGHT_ATTRIBUTE = "data-gwtp-highlighted";
const GWTP_HIGHLIGHT_ACCENT = globalThis.gwtpVisualConfig?.guidanceAccent || "#D6008F";

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

  const result = findElement(selector);

  if (result.error) {
    return { success: false, message: result.error };
  }

  if (!result.element) {
    return { success: false, message: "No element matched this selector." };
  }

  const element = result.element;
  element.dataset.gwtpPreviousOutline = element.style.outline;
  element.dataset.gwtpPreviousOutlineOffset = element.style.outlineOffset;
  element.setAttribute(HIGHLIGHT_ATTRIBUTE, "true");
  element.style.outline = `3px solid ${GWTP_HIGHLIGHT_ACCENT}`;
  element.style.outlineOffset = "3px";
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

  return { success: true, message: "Element highlighted successfully." };
}
