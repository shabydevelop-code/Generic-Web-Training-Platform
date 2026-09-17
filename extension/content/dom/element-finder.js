function findElement(selector) {
  try {
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
