(() => {
  const steps = [];

  function createStep({ selector, instruction, screenName = "", element, validation = null }) {
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
      screenName: screenName.trim(),
      element: element
        ? {
            tagName: element.tagName || "",
            text: element.text || "",
            frame: element.frame ? { ...element.frame } : null
          }
        : null,
      validation: validation ? { ...validation } : null,
      interactionType: "auto"
    };

    steps.push(step);
    return { ...step };
  }

  function updateStep(id, { selector, instruction, screenName = "", element, validation = null }) {
    const index = steps.findIndex((step) => step.id === id);
    if (index < 0) throw new Error("Step not found.");
    if (!selector || !selector.trim()) throw new Error("A selector is required to update a step.");
    if (!instruction || !instruction.trim()) throw new Error("An instruction is required to update a step.");

    steps[index] = {
      ...steps[index],
      selector: selector.trim(),
      instruction: instruction.trim(),
      screenName: screenName.trim(),
      element: element
        ? { tagName: element.tagName || "", text: element.text || "", frame: element.frame ? { ...element.frame } : null }
        : steps[index].element,
      validation: validation ? { ...validation } : null,
      interactionType: "auto"
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

  function reorderStep(id, targetId, placeAfter = false) {
    const sourceIndex = steps.findIndex((step) => step.id === id);
    if (sourceIndex < 0) return false;

    const [movedStep] = steps.splice(sourceIndex, 1);
    let targetIndex = steps.findIndex((step) => step.id === targetId);

    if (targetIndex < 0) {
      steps.splice(sourceIndex, 0, movedStep);
      return false;
    }

    if (placeAfter) targetIndex += 1;
    steps.splice(targetIndex, 0, movedStep);
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
        id: step.id ?? crypto.randomUUID(),
        persistedId: step.id ?? null,
        order: index + 1,
        selector: step.selector.trim(),
        instruction: step.instruction.trim(),
        screenName: (step.screenName || "").trim(),
        element: {
          tagName: "",
          text: "",
          frame: step.frame ? { ...step.frame } : null
        },
        validation: step.validation ? { ...step.validation } : null,
        interactionType: step.interactionType || "auto"
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
    reorderStep,
    getSteps,
    replaceSteps,
    clearSteps
  };
})();
