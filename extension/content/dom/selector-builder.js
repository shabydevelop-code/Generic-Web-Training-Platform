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
