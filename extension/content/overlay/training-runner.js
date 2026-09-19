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
  overlay.style.maxWidth = "340px";
  overlay.style.padding = "16px 16px 14px";
  overlay.style.border = "2px solid #2563eb";
  overlay.style.borderTop = "3px solid #2563eb";
  overlay.style.borderRadius = "12px";
  overlay.style.background = "#ffffff";
  overlay.style.boxShadow = "0 10px 28px rgba(15, 23, 42, 0.22), 0 2px 7px rgba(37, 99, 235, 0.12)";
  overlay.style.color = "#172033";
  overlay.style.font = "14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const instruction = document.createElement("div");
  instruction.style.fontWeight = "500";
  instruction.style.fontSize = "14px";
  instruction.style.lineHeight = "1.55";

  const sanitizeInstructionHtml = (html) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    const allowedTags = new Set(["STRONG", "B", "EM", "I", "U", "BR", "UL", "OL", "LI", "P", "DIV"]);

    const cleanNode = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType !== Node.ELEMENT_NODE) return;
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          return;
        }
        [...child.attributes].forEach((attribute) => child.removeAttribute(attribute.name));
        cleanNode(child);
      });
    };

    cleanNode(template.content);
    return template.innerHTML;
  };

  if (step.instruction) {
    instruction.innerHTML = sanitizeInstructionHtml(step.instruction);
  } else {
    instruction.textContent = `Step ${step.order || ""}`;
  }
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
          chrome.runtime.sendMessage({
            type: "GWTP_TRAINING_COMPLETED",
            guideId: response.result?.guideId
          }).catch(() => {});

          clearTrainingStep();
          clearHighlight();

          const completion = document.createElement("div");
          completion.style.position = "fixed";
          completion.style.zIndex = "2147483647";
          completion.style.left = "50%";
          completion.style.top = "50%";
          completion.style.transform = "translate(-50%, -50%)";
          completion.style.width = "min(360px, calc(100vw - 32px))";
          completion.style.boxSizing = "border-box";
          completion.style.padding = "28px 24px 24px";
          completion.style.border = "1px solid #e4e7ec";
          completion.style.borderRadius = "16px";
          completion.style.background = "#ffffff";
          completion.style.boxShadow = "0 18px 48px rgba(16, 24, 40, 0.18)";
          completion.style.color = "#172033";
          completion.style.textAlign = "center";
          completion.style.font = "14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          completion.dir = navigation.direction || "ltr";

          const successMark = document.createElement("div");
          successMark.textContent = "✓";
          successMark.setAttribute("aria-hidden", "true");
          successMark.style.display = "flex";
          successMark.style.alignItems = "center";
          successMark.style.justifyContent = "center";
          successMark.style.width = "48px";
          successMark.style.height = "48px";
          successMark.style.margin = "0 auto 16px";
          successMark.style.borderRadius = "50%";
          successMark.style.background = "#ecfdf3";
          successMark.style.color = "#067647";
          successMark.style.fontSize = "25px";
          successMark.style.fontWeight = "700";

          const title = document.createElement("strong");
          title.textContent = navigation.labels?.completedTitle || "";
          title.style.display = "block";
          title.style.fontSize = "18px";
          title.style.lineHeight = "1.4";
          title.style.fontWeight = "700";

          const message = document.createElement("p");
          message.textContent = navigation.labels?.completedMessage || "";
          message.style.margin = "8px 0 22px";
          message.style.color = "#667085";
          message.style.fontSize = "14px";

          const closeButton = document.createElement("button");
          closeButton.type = "button";
          closeButton.textContent = navigation.labels?.closeCompletion || "";
          closeButton.style.display = "block";
          closeButton.style.width = "100%";
          closeButton.style.padding = "10px 16px";
          closeButton.style.border = "1px solid #2563eb";
          closeButton.style.borderRadius = "8px";
          closeButton.style.background = "#2563eb";
          closeButton.style.color = "#ffffff";
          closeButton.style.font = "600 14px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          closeButton.style.cursor = "pointer";
          closeButton.addEventListener("mouseenter", () => {
            closeButton.style.background = "#1d4ed8";
          });
          closeButton.addEventListener("mouseleave", () => {
            closeButton.style.background = "#2563eb";
          });
          closeButton.addEventListener("click", () => completion.remove());

          completion.append(successMark, title, message, closeButton);
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
    const gap = 14;

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
