let gwtpTrainingOverlay = null;
let gwtpTrainingTarget = null;

function clearTrainingStep() {
  if (gwtpTrainingOverlay) {
    gwtpTrainingOverlay.remove();
    gwtpTrainingOverlay = null;
  }

  if (gwtpTrainingTarget) {
    gwtpTrainingTarget.style.removeProperty("outline");
    gwtpTrainingTarget.style.removeProperty("outline-offset");
    gwtpTrainingTarget = null;
  }
}

function showTrainingStep(step, navigation = {}) {
  clearTrainingStep();
  clearHighlight();

  if (!step?.selector) {
    return { success: false, message: "Step selector is missing." };
  }

  let target;

  try {
    target = document.querySelector(step.selector);
  } catch {
    return { success: false, message: "Step selector is invalid." };
  }

  if (!target) {
    return { success: false, message: "Step element was not found on this page." };
  }

  gwtpTrainingTarget = target;
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  target.style.setProperty("outline", "3px solid #2563eb", "important");
  target.style.setProperty("outline-offset", "3px", "important");

  const overlay = document.createElement("div");
  overlay.className = "gwtp-training-overlay";
  overlay.style.position = "fixed";
  overlay.style.zIndex = "2147483647";
  overlay.style.maxWidth = "320px";
  overlay.style.padding = "12px 14px";
  overlay.style.border = "1px solid #d0d5dd";
  overlay.style.borderRadius = "10px";
  overlay.style.background = "#ffffff";
  overlay.style.boxShadow = "0 8px 24px rgba(16, 24, 40, 0.18)";
  overlay.style.color = "#172033";
  overlay.style.font = "14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const instruction = document.createElement("div");
  instruction.textContent = step.instruction || `Step ${step.order || ""}`;
  overlay.appendChild(instruction);

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.justifyContent = "space-between";
  controls.style.gap = "8px";
  controls.style.marginTop = "12px";

  const createButton = (label, action, disabled) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.style.padding = "6px 10px";
    button.style.border = "1px solid #d0d5dd";
    button.style.borderRadius = "7px";
    button.style.background = disabled ? "#f2f4f7" : "#ffffff";
    button.style.cursor = disabled ? "default" : "pointer";

    if (!disabled) {
      button.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: action }).then((response) => {
          if (!response?.success || !response.current?.step) return;

          showTrainingStep(response.current.step, {
            ...navigation,
            stepIndex: response.current.stepIndex
          });
        });
      });
    }

    return button;
  };

  const stepIndex = Number.isInteger(navigation.stepIndex) ? navigation.stepIndex : 0;
  const totalSteps = navigation.totalSteps || 1;

  overlay.dir = navigation.direction || "ltr";

  controls.appendChild(createButton(
    navigation.labels?.previous || "",
    "GWTP_TRAINING_PREVIOUS",
    stepIndex === 0
  ));
  if (stepIndex >= totalSteps - 1) {
    const finishButton = document.createElement("button");
    finishButton.type = "button";
    finishButton.textContent = navigation.labels?.finish || "";
    finishButton.style.padding = "6px 10px";
    finishButton.style.border = "1px solid #d0d5dd";
    finishButton.style.borderRadius = "7px";
    finishButton.style.background = "#ffffff";
    finishButton.style.cursor = "pointer";
    finishButton.addEventListener("click", () => {
      finishButton.disabled = true;
      chrome.runtime.sendMessage({ type: "GWTP_TRAINING_COMPLETE" }).then((response) => {
        if (response?.success) {
          clearTrainingStep();
          clearHighlight();

          const completion = document.createElement("div");
          completion.style.position = "fixed";
          completion.style.zIndex = "2147483647";
          completion.style.left = "50%";
          completion.style.top = "50%";
          completion.style.transform = "translate(-50%, -50%)";
          completion.style.maxWidth = "360px";
          completion.style.padding = "20px";
          completion.style.border = "1px solid #d0d5dd";
          completion.style.borderRadius = "12px";
          completion.style.background = "#ffffff";
          completion.style.boxShadow = "0 12px 32px rgba(16, 24, 40, 0.2)";
          completion.style.color = "#172033";
          completion.style.font = "14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          completion.dir = navigation.direction || "ltr";

          const title = document.createElement("strong");
          title.textContent = navigation.labels?.completedTitle || "";
          title.style.display = "block";
          title.style.fontSize = "16px";

          const message = document.createElement("p");
          message.textContent = navigation.labels?.completedMessage || "";
          message.style.margin = "8px 0 16px";

          const closeButton = document.createElement("button");
          closeButton.type = "button";
          closeButton.textContent = navigation.labels?.closeCompletion || "";
          closeButton.style.padding = "6px 12px";
          closeButton.addEventListener("click", () => completion.remove());

          completion.append(title, message, closeButton);
          document.documentElement.appendChild(completion);
          return;
        }

        finishButton.disabled = false;
      });
    });
    controls.appendChild(finishButton);
  } else {
    controls.appendChild(createButton(
      navigation.labels?.next || "",
      "GWTP_TRAINING_NEXT",
      false
    ));
  }
  overlay.appendChild(controls);

  document.documentElement.appendChild(overlay);
  gwtpTrainingOverlay = overlay;

  const positionOverlay = () => {
    if (!gwtpTrainingOverlay || !gwtpTrainingTarget) {
      return;
    }

    const rect = gwtpTrainingTarget.getBoundingClientRect();
    const overlayRect = gwtpTrainingOverlay.getBoundingClientRect();
    const gap = 10;

    let top = rect.bottom + gap;
    if (top + overlayRect.height > window.innerHeight - gap) {
      top = Math.max(gap, rect.top - overlayRect.height - gap);
    }

    let left = rect.left;
    left = Math.max(gap, Math.min(left, window.innerWidth - overlayRect.width - gap));

    gwtpTrainingOverlay.style.top = `${top}px`;
    gwtpTrainingOverlay.style.left = `${left}px`;
  };

  requestAnimationFrame(positionOverlay);

  return { success: true, message: `Step ${step.order || ""} is running.` };
}
