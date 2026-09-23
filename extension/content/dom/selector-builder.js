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
      text.length > 28 ||
      /^[a-f0-9]{8,}$/i.test(text) ||
      /\d{4,}/.test(text) ||
      /^[A-Za-z]{0,4}\d[A-Za-z0-9_-]{4,}$/.test(text) ||
      /^_[A-Za-z0-9_-]{16,}$/.test(text) ||
      /[A-Za-z0-9]{12,}[_-]\d+$/.test(text)
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

  const selectorForStableAttributes = (candidate) => {
    for (const attribute of attributeCandidates) {
      const value = candidate.getAttribute(attribute);

      if (!value || looksGenerated(value)) {
        continue;
      }

      const selector = `${candidate.tagName.toLowerCase()}[${attribute}="${CSS.escape(value)}"]`;

      if (isUnique(selector)) {
        return selector;
      }
    }

    return "";
  };

  const semanticLinkSelector = (candidate) => {
    const link = candidate.closest("a[href]");
    if (!link) return "";

    const rawHref = link.getAttribute("href") || "";
    if (!rawHref || rawHref.startsWith("javascript:") || rawHref === "#") return "";

    // Prefer the destination URL without its query/hash. Search engines and SPAs
    // frequently add volatile tracking parameters while the destination remains stable.
    let stableHref = rawHref;
    try {
      const url = new URL(rawHref, document.baseURI);
      url.search = "";
      url.hash = "";
      stableHref = url.href;
    } catch {
      stableHref = rawHref.split(/[?#]/, 1)[0];
    }

    if (!stableHref || looksGenerated(stableHref)) return "";

    const exact = `a[href="${CSS.escape(rawHref)}"]`;
    if (isUnique(exact)) return exact;

    const stablePrefix = `a[href^="${CSS.escape(stableHref)}"]`;
    if (isUnique(stablePrefix)) return stablePrefix;

    return "";
  };

  const directAttributeSelector = selectorForStableAttributes(element);
  if (directAttributeSelector) {
    return directAttributeSelector;
  }

  if (element.id && !looksGenerated(element.id)) {
    const selector = `#${CSS.escape(element.id)}`;

    if (isUnique(selector)) {
      return selector;
    }
  }

  const linkSelector = semanticLinkSelector(element);
  if (linkSelector) {
    return linkSelector;
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

  // Table/grid cells need a selector that survives row reordering.
  // Prefer a stable table identity + a stable column position + unique cell text.
  const cell = element.closest("td, th");
  const table = cell?.closest("table");

  if (cell && table) {
    const tableSelector = (() => {
      if (table.id && !looksGenerated(table.id)) {
        const selector = `#${CSS.escape(table.id)}`;
        if (isUnique(selector)) return selector;
      }

      for (const attribute of attributeCandidates) {
        const value = table.getAttribute(attribute);
        if (!value || looksGenerated(value)) continue;
        const selector = `table[${attribute}="${CSS.escape(value)}"]`;
        if (isUnique(selector)) return selector;
      }

      const stableClass = [...table.classList].find(
        (className) => className && !className.startsWith("gwtp-") && !looksGenerated(className)
      );
      if (stableClass) {
        const selector = `table.${CSS.escape(stableClass)}`;
        if (isUnique(selector)) return selector;
      }

      return "";
    })();

    const row = cell.closest("tr");
    const cellText = (cell.innerText || cell.textContent || "").trim().replace(/\s+/g, " ");
    const columnIndex = row ? [...row.children].indexOf(cell) + 1 : 0;

    if (tableSelector && cellText && columnIndex > 0) {
      const escapedText = JSON.stringify(cellText);
      const gridSelector = `gwtp-grid:${tableSelector}|${columnIndex}|${escapedText}`;
      return gridSelector;
    }
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    let part = current.tagName.toLowerCase();

    const currentAttributeSelector = selectorForStableAttributes(current);
    if (currentAttributeSelector) {
      parts.unshift(currentAttributeSelector);
      return parts.join(" > ");
    }

    const currentId = current.id;
    if (currentId && !looksGenerated(currentId)) {
      const idSelector = `#${CSS.escape(currentId)}`;

      if (isUnique(idSelector)) {
        parts.unshift(idSelector);
        return parts.join(" > ");
      }
    }

    const currentLinkSelector = semanticLinkSelector(current);
    if (currentLinkSelector) {
      return currentLinkSelector;
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
