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

  function moveStep(id, direction) {
    const index = steps.findIndex((step) => step.id === id);
    if (index < 0) return false;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) return false;

    [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
    steps.forEach((step, stepIndex) => {
      step.order = stepIndex + 1;
    });
    return true;
  }

  function getSteps() {
    return steps.map((step) => ({ ...step }));
  }

  function replaceSteps(newSteps) {
    steps.length = 0;

    newSteps.forEach((step, index) => {
      steps.push({
        id: crypto.randomUUID(),
        order: index + 1,
        selector: step.selector.trim(),
        instruction: step.instruction.trim(),
        element: null
      });
    });

    return getSteps();
  }

  function clearSteps() {
    steps.length = 0;
  }

  window.trainingService = {
    createStep,
    updateStep,
    deleteStep,
    moveStep,
    getSteps,
    replaceSteps,
    clearSteps
  };
})();
