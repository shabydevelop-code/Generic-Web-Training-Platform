function findElement(selector) {
  try {
    if (selector?.startsWith("gwtp-grid:")) {
      return findGridElement(selector);
    }

    return {
      element: document.querySelector(selector),
      error: null
    };
  } catch {
    return {
      element: null,
      error: "The CSS selector is invalid."
    };
  }
}

function findGridElement(selector) {
  const definition = selector.slice("gwtp-grid:".length);
  const firstSeparator = definition.indexOf("|");
  const secondSeparator = definition.indexOf("|", firstSeparator + 1);

  if (firstSeparator <= 0 || secondSeparator <= firstSeparator) {
    return { element: null, error: "The grid selector is invalid." };
  }

  const tableSelector = definition.slice(0, firstSeparator);
  const columnIndex = Number.parseInt(definition.slice(firstSeparator + 1, secondSeparator), 10);
  const expectedText = JSON.parse(definition.slice(secondSeparator + 1));

  const table = document.querySelector(tableSelector);
  if (!table || !Number.isInteger(columnIndex) || columnIndex < 1) {
    return { element: null, error: null };
  }

  const normalize = (value) => (value || "").trim().replace(/\s+/g, " ");

  for (const row of table.querySelectorAll("tbody tr")) {
    const cell = row.children[columnIndex - 1];
    if (cell && normalize(cell.innerText || cell.textContent) === expectedText) {
      return { element: cell, error: null };
    }
  }

  return { element: null, error: null };
}
