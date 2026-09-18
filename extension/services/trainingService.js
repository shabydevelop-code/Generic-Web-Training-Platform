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

  function updateStep(id, { selector, instruction, element }) {
    const index = steps.findIndex((step) => step.id === id);
    if (index < 0) throw new Error("Step not found.");
    if (!selector || !selector.trim()) throw new Error("A selector is required to update a step.");
    if (!instruction || !instruction.trim()) throw new Error("An instruction is required to update a step.");

    steps[index] = {
      ...steps[index],
      selector: selector.trim(),
      instruction: instruction.trim(),
      element: element
        ? { tagName: element.tagName || "", text: element.text || "" }
        : steps[index].element
    };
    return { ...steps[index] };
  }

  function deleteStep(id) {
    const index = steps.findIndex((step) => step.id === id);
    if (index < 0) return false;
    steps.splice(index, 1);
    steps.forEach((step, stepIndex) => {
      step.order = stepIndex + 1;
    });
    return true;
  }

  function getSteps() {
    return steps.map((step) => ({ ...step }));
  }

  window.trainingService = {
    createStep,
    updateStep,
    deleteStep,
    getSteps
  };
})();
