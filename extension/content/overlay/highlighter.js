const HIGHLIGHT_ATTRIBUTE = "data-gwtp-highlighted";
const GWTP_HIGHLIGHT_ACCENT = globalThis.gwtpVisualConfig?.guidanceAccent || "#D6008F";

function clearHighlight() {
  const highlightedElements = document.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}]`);

  highlightedElements.forEach((element) => {
    const previousOutline = element.dataset.gwtpPreviousOutline || "";
    const previousOutlinePriority = element.dataset.gwtpPreviousOutlinePriority || "";
    const previousOutlineOffset = element.dataset.gwtpPreviousOutlineOffset || "";
    const previousOutlineOffsetPriority = element.dataset.gwtpPreviousOutlineOffsetPriority || "";

    element.style.setProperty("outline", previousOutline, previousOutlinePriority);
    element.style.setProperty("outline-offset", previousOutlineOffset, previousOutlineOffsetPriority);

    delete element.dataset.gwtpPreviousOutline;
    delete element.dataset.gwtpPreviousOutlinePriority;
    delete element.dataset.gwtpPreviousOutlineOffset;
    delete element.dataset.gwtpPreviousOutlineOffsetPriority;
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
  element.dataset.gwtpPreviousOutline = element.style.getPropertyValue("outline");
  element.dataset.gwtpPreviousOutlinePriority = element.style.getPropertyPriority("outline");
  element.dataset.gwtpPreviousOutlineOffset = element.style.getPropertyValue("outline-offset");
  element.dataset.gwtpPreviousOutlineOffsetPriority = element.style.getPropertyPriority("outline-offset");
  element.setAttribute(HIGHLIGHT_ATTRIBUTE, "true");
  element.style.setProperty("outline", `3px solid ${GWTP_HIGHLIGHT_ACCENT}`, "important");
  element.style.setProperty("outline-offset", "3px", "important");
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

  return { success: true, message: "Element highlighted successfully." };
}
