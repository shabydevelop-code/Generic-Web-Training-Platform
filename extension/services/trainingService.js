(() => {
  const steps = [];

  function createStep({ selector, instruction, element }) {
    if (!selector || !selector.trim()) {
      throw new Error("A selector is required to create a step.");
    }

    if (!instruction || !instruction.trim()) {
      throw new Error("An instruction is required to create a step.");
    }

    const step = {
      id: crypto.randomUUID(),
      order: steps.length + 1,
      selector: selector.trim(),
      instruction: instruction.trim(),
      element: element
        ? {
            tagName: element.tagName || "",
            text: element.text || ""
          }
        : null
    };

    steps.push(step);
    return { ...step };
  }

  function getSteps() {
    return steps.map((step) => ({ ...step }));
  }

  window.trainingService = {
    createStep,
    getSteps
  };
})();
