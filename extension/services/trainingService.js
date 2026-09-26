(() => {
  const steps = [];

  function createStep({ selector = "", instruction, screenName = "", element, validation = null, targetType = "element" }) {
    const normalizedTargetType = targetType === "none" ? "none" : "element";
    if (normalizedTargetType === "element" && (!selector || !selector.trim())) {
      throw new Error("A selector is required to create an element step.");
    }

    if (!instruction || !instruction.trim()) {
      throw new Error("An instruction is required to create a step.");
    }

    const step = {
      id: crypto.randomUUID(),
      order: steps.length + 1,
      selector: normalizedTargetType === "none" ? "" : selector.trim(),
      targetType: normalizedTargetType,
      instruction: instruction.trim(),
      screenName: screenName.trim(),
      element: element
        ? {
            tagName: element.tagName || "",
            text: element.text || "",
            frame: element.frame ? { ...element.frame } : null
          }
        : null,
      validation: validation ? { ...validation } : null
    };

    steps.push(step);
    return { ...step };
  }

  function updateStep(id, { selector = "", instruction, screenName = "", element, validation = null, targetType = "element" }) {
    const index = steps.findIndex((step) => step.id === id);
    if (index < 0) throw new Error("Step not found.");
    const normalizedTargetType = targetType === "none" ? "none" : "element";
    if (normalizedTargetType === "element" && (!selector || !selector.trim())) throw new Error("A selector is required to update an element step.");
    if (!instruction || !instruction.trim()) throw new Error("An instruction is required to update a step.");

    steps[index] = {
      ...steps[index],
      selector: normalizedTargetType === "none" ? "" : selector.trim(),
      targetType: normalizedTargetType,
      instruction: instruction.trim(),
      screenName: screenName.trim(),
      element: normalizedTargetType === "none"
        ? null
        : (element
          ? { tagName: element.tagName || "", text: element.text || "", frame: element.frame ? { ...element.frame } : null }
          : steps[index].element),
      validation: normalizedTargetType === "none" ? null : (validation ? { ...validation } : null)
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
        selector: (step.selector || "").trim(),
        targetType: step.targetType === "none" ? "none" : "element",
        runtime: step.runtime === "windows" ? "windows" : "web",
        windowsTarget: step.windowsTarget ? structuredClone(step.windowsTarget) : null,
        instruction: step.instruction.trim(),
        screenName: (step.screenName || "").trim(),
        element: step.targetType === "none" ? null : {
          tagName: "",
          text: "",
          frame: step.frame ? { ...step.frame } : null
        },
        validation: step.targetType === "none" ? null : (step.validation ? { ...step.validation } : null)
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
