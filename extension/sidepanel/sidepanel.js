const selectorInput = document.getElementById("selectorInput");
const selectButton = document.getElementById("selectButton");
const highlightButton = document.getElementById("highlightButton");
const clearButton = document.getElementById("clearButton");
const statusElement = document.getElementById("status");
const selectedElement = document.getElementById("selectedElement");
const selectedTag = document.getElementById("selectedTag");
const selectedSelector = document.getElementById("selectedSelector");
const stepEditor = document.getElementById("stepEditor");
const instructionInput = document.getElementById("instructionInput");
const saveStepButton = document.getElementById("saveStepButton");
const stepsSection = document.getElementById("stepsSection");
const stepsList = document.getElementById("stepsList");
const learnModeButton = document.getElementById("learnModeButton");
const createModeButton = document.getElementById("createModeButton");
const learnModeView = document.getElementById("learnModeView");
const createModeView = document.getElementById("createModeView");

let currentSelectedElement = null;
let activeStepId = null;

const canRunTraining = window.permissionService.canRunTraining();
const canCreateTraining = window.permissionService.canCreateTraining();

function setMode(mode) {
  const isLearnMode = mode === "learn";

  learnModeView.hidden = !isLearnMode;
  createModeView.hidden = isLearnMode;

  learnModeButton.classList.toggle("mode-switcher__button--active", isLearnMode);
  createModeButton.classList.toggle("mode-switcher__button--active", !isLearnMode);
  learnModeButton.setAttribute("aria-pressed", String(isLearnMode));
  createModeButton.setAttribute("aria-pressed", String(!isLearnMode));
}

function initializeAvailableModes() {
  learnModeButton.hidden = !canRunTraining;
  createModeButton.hidden = !canCreateTraining;

  if (canCreateTraining) {
    setMode("create");
    return;
  }

  if (canRunTraining) {
    setMode("learn");
    return;
  }

  learnModeView.hidden = true;
  createModeView.hidden = true;
}

function setStatus(message, type = "info") {
  statusElement.textContent = message;
  statusElement.dataset.type = type;
}

function markActiveStep(stepId) {
  activeStepId = stepId;

  stepsList.querySelectorAll(".step-item").forEach((item) => {
    const isActive = item.dataset.stepId === stepId;
    item.classList.toggle("step-item--active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
}

async function runStep(step) {
  try {
    const response = await sendToActivePage({
      type: "GWTP_SHOW_TRAINING_STEP",
      step
    });

    if (response?.success) {
      markActiveStep(step.id);
    }

    setStatus(
      response?.message || `Step ${step.order} started.`,
      response?.success ? "success" : "error"
    );
  } catch (error) {
    setStatus("Could not run this step on the current page.", "error");
    console.error(error);
  }
}

function renderSteps() {
  const steps = window.trainingService.getSteps();
  stepsList.replaceChildren();

  if (steps.length === 0) {
    stepsSection.hidden = true;
    return;
  }

  stepsSection.hidden = false;

  steps.forEach((step) => {
    const item = document.createElement("div");
    item.className = "step-item";
    item.dataset.stepId = step.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Run Step ${step.order}`);
    item.setAttribute("aria-pressed", String(step.id === activeStepId));

    if (step.id === activeStepId) {
      item.classList.add("step-item--active");
    }

    const title = document.createElement("strong");
    title.textContent = `Step ${step.order}`;

    const instruction = document.createElement("p");
    instruction.textContent = step.instruction;

    const selector = document.createElement("code");
    selector.textContent = step.selector;

    item.append(title, instruction, selector);
    item.addEventListener("click", () => runStep(step));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        runStep(step);
      }
    });

    stepsList.appendChild(item);
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isMissingReceiverError(error) {
  return error?.message?.includes("Receiving end does not exist");
}

async function sendToActivePage(message) {
  const tab = await getActiveTab();

  if (!tab?.id) {
    throw new Error("No active browser tab was found.");
  }

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      const shouldRetry = isMissingReceiverError(error) && attempt < maxAttempts;

      if (!shouldRetry) {
        throw error;
      }

      await wait(250 * attempt);
    }
  }

  throw new Error("Could not connect to the current page.");
}

learnModeButton.addEventListener("click", () => {
  if (canRunTraining) {
    setMode("learn");
  }
});

createModeButton.addEventListener("click", () => {
  if (canCreateTraining) {
    setMode("create");
  }
});

selectButton.addEventListener("click", async () => {
  try {
    const response = await sendToActivePage({ type: "GWTP_START_ELEMENT_PICKER" });
    setStatus(response?.message || "Selection mode active.");
  } catch (error) {
    setStatus(
      "This page cannot currently be controlled. Try a regular http/https page and reload it after updating the extension.",
      "error"
    );
    console.error(error);
  }
});

highlightButton.addEventListener("click", async () => {
  const selector = selectorInput.value.trim();

  if (!selector) {
    setStatus("Enter a CSS selector first.", "error");
    return;
  }

  setStatus("Looking for the element...");

  try {
    const response = await sendToActivePage({
      type: "GWTP_HIGHLIGHT_ELEMENT",
      selector
    });

    setStatus(
      response?.message || "Request completed.",
      response?.success ? "success" : "error"
    );
  } catch (error) {
    setStatus(
      "This page cannot currently be controlled. Try a regular http/https page and reload it after updating the extension.",
      "error"
    );
    console.error(error);
  }
});

clearButton.addEventListener("click", async () => {
  try {
    await sendToActivePage({ type: "GWTP_CLEAR_HIGHLIGHT" });
    currentSelectedElement = null;
    activeStepId = null;
    selectedElement.hidden = true;
    stepEditor.hidden = true;
    instructionInput.value = "";
    renderSteps();
    setStatus("Highlight cleared.", "success");
  } catch (error) {
    setStatus("Could not clear the highlight on this page.", "error");
    console.error(error);
  }
});

saveStepButton.addEventListener("click", () => {
  const instruction = instructionInput.value.trim();
  const selector = selectorInput.value.trim();

  if (!currentSelectedElement) {
    setStatus("Select an element before saving the step.", "error");
    return;
  }

  if (!instruction) {
    setStatus("Enter an instruction before saving the step.", "error");
    instructionInput.focus();
    return;
  }

  try {
    const step = window.trainingService.createStep({
      selector,
      instruction,
      element: currentSelectedElement
    });

    instructionInput.value = "";
    renderSteps();
    setStatus(`Step ${step.order} saved.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not save the step.", "error");
    console.error(error);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GWTP_ELEMENT_SELECTED") {
    const element = message.element;
    currentSelectedElement = element;
    selectorInput.value = element.selector;
    selectedTag.textContent = `<${element.tagName}>${element.text ? ` — ${element.text}` : ""}`;
    selectedSelector.textContent = element.selector;
    selectedElement.hidden = false;
    stepEditor.hidden = false;
    instructionInput.focus();
    setStatus("Element selected successfully.", "success");
    return;
  }

  if (message?.type === "GWTP_ELEMENT_SELECTION_CANCELLED") {
    setStatus("Element selection cancelled.");
  }
});

initializeAvailableModes();
renderSteps();
