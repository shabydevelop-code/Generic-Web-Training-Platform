function createSelector(element) {
  if (!(element instanceof Element)) {
    return "";
  }

  const isUnique = (selector) => {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };

  const looksGenerated = (value) => {
    if (!value) {
      return true;
    }

    const text = value.trim();

    return (
      text.length > 32 ||
      /^[a-f0-9]{8,}$/i.test(text) ||
      /\d{4,}/.test(text) ||
      /^[A-Za-z]{0,4}\d[A-Za-z0-9_-]{4,}$/.test(text)
    );
  };

  const attributeCandidates = [
    "data-testid",
    "data-test",
    "data-qa",
    "data-cy",
    "name",
    "aria-label",
    "title"
  ];

  for (const attribute of attributeCandidates) {
    const value = element.getAttribute(attribute);

    if (!value || looksGenerated(value)) {
      continue;
    }

    const selector = `${element.tagName.toLowerCase()}[${attribute}="${CSS.escape(value)}"]`;

    if (isUnique(selector)) {
      return selector;
    }
  }

  if (element.id && !looksGenerated(element.id)) {
    const selector = `#${CSS.escape(element.id)}`;

    if (isUnique(selector)) {
      return selector;
    }
  }

  const stableClasses = [...element.classList].filter(
    (className) =>
      className &&
      !className.startsWith("gwtp-") &&
      !looksGenerated(className)
  );

  for (const className of stableClasses) {
    const selector = `${element.tagName.toLowerCase()}.${CSS.escape(className)}`;

    if (isUnique(selector)) {
      return selector;
    }
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let part = current.tagName.toLowerCase();

    const currentId = current.id;
    if (currentId && !looksGenerated(currentId)) {
      const idSelector = `#${CSS.escape(currentId)}`;

      if (isUnique(idSelector)) {
        parts.unshift(idSelector);
        return parts.join(" > ");
      }
    }

    const currentStableClass = [...current.classList].find(
      (className) =>
        className &&
        !className.startsWith("gwtp-") &&
        !looksGenerated(className)
    );

    if (currentStableClass) {
      part += `.${CSS.escape(currentStableClass)}`;
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

    if (isUnique(selector)) {
      return selector;
    }

    current = current.parentElement;
  }

  return parts.join(" > ");
}
