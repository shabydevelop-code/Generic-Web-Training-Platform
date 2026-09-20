const GWTP_GUIDANCE_ACCENT = globalThis.gwtpVisualConfig?.guidanceAccent || "#D6008F";
const GWTP_GUIDANCE_ACCENT_SHADOW = globalThis.gwtpVisualConfig?.guidanceAccentShadow || "rgba(214, 0, 143, 0.14)";

let gwtpTrainingOverlay = null;
let gwtpTrainingTarget = null;
let gwtpTrainingStepKey = null;
let gwtpTrainingInitialValue = null;

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

async function showTrainingStep(step, navigation = {}) {
  clearTrainingStep();
  clearHighlight();

  if (!step?.selector) {
    return { success: false, message: "Step selector is missing." };
  }

  const targetResult = findElement(step.selector);

  if (targetResult.error) {
    return { success: false, message: targetResult.error };
  }

  const target = targetResult.element;

  if (!target) {
    return { success: false, message: "Step element was not found on this page." };
  }

  gwtpTrainingTarget = target;
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  target.style.setProperty("outline", `3px solid ${GWTP_GUIDANCE_ACCENT}`, "important");
  target.style.setProperty("outline-offset", "3px", "important");

  const overlay = document.createElement("div");
  overlay.className = "gwtp-training-overlay";
  overlay.style.position = "fixed";
  overlay.style.zIndex = "2147483647";
  overlay.style.maxWidth = "340px";
  overlay.style.padding = "16px 16px 14px";
  overlay.style.border = `2px solid ${GWTP_GUIDANCE_ACCENT}`;
  overlay.style.borderTop = `3px solid ${GWTP_GUIDANCE_ACCENT}`;
  overlay.style.borderRadius = "12px";
  overlay.style.background = "#ffffff";
  overlay.style.boxShadow = `0 10px 28px rgba(15, 23, 42, 0.22), 0 2px 7px ${GWTP_GUIDANCE_ACCENT_SHADOW}`;
  overlay.style.color = "#172033";
  overlay.style.font = "14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const dragHandle = document.createElement("div");
  dragHandle.setAttribute("aria-hidden", "true");
  dragHandle.style.height = "14px";
  dragHandle.style.margin = "-10px -10px 8px";
  dragHandle.style.cursor = "move";
  dragHandle.style.borderRadius = "6px";
  dragHandle.style.touchAction = "none";
  dragHandle.style.display = "grid";
  dragHandle.style.gridTemplateColumns = "repeat(3, 4px)";
  dragHandle.style.gridTemplateRows = "repeat(2, 4px)";
  dragHandle.style.justifyContent = "center";
  dragHandle.style.alignContent = "center";
  dragHandle.style.gap = "3px";

  for (let index = 0; index < 6; index++) {
    const dot = document.createElement("span");
    dot.style.width = "4px";
    dot.style.height = "4px";
    dot.style.borderRadius = "50%";
    dot.style.background = "#94a3b8";
    dot.style.pointerEvents = "none";
    dragHandle.appendChild(dot);
  }

  overlay.appendChild(dragHandle);

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const clampOverlayPosition = (left, top) => {
    const rect = overlay.getBoundingClientRect();
    const margin = 8;
    return {
      left: Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin))
    };
  };

  dragHandle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const rect = overlay.getBoundingClientRect();
    isDragging = true;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    dragHandle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  dragHandle.addEventListener("pointermove", (event) => {
    if (!isDragging) return;

    const position = clampOverlayPosition(
      event.clientX - dragOffsetX,
      event.clientY - dragOffsetY
    );

    overlay.style.left = `${position.left}px`;
    overlay.style.top = `${position.top}px`;
  });

  const stopDragging = (event) => {
    if (!isDragging) return;
    isDragging = false;

    if (dragHandle.hasPointerCapture(event.pointerId)) {
      dragHandle.releasePointerCapture(event.pointerId);
    }
  };

  dragHandle.addEventListener("pointerup", stopDragging);
  dragHandle.addEventListener("pointercancel", stopDragging);

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

  const validationError = document.createElement("div");
  validationError.setAttribute("role", "alert");
  validationError.style.display = "none";
  validationError.style.marginTop = "10px";
  validationError.style.padding = "8px 10px";
  validationError.style.borderRadius = "7px";
  validationError.style.background = "#fef3f2";
  validationError.style.color = "#b42318";
  validationError.style.fontSize = "13px";
  validationError.style.fontWeight = "600";
  overlay.appendChild(validationError);

  const getTargetValue = () => {
    if (target instanceof HTMLSelectElement) {
      const selectedOption = target.options[target.selectedIndex];
      return String(selectedOption?.value ?? target.value ?? "");
    }
    if ("value" in target) return String(target.value ?? "");
    if (target.isContentEditable) return target.textContent || "";
    return target.textContent || "";
  };

  const sessionState = await chrome.storage.session.get("gwtp.validation.session");
  const validationSessionId = sessionState["gwtp.validation.session"] || "default";
  const stepKey = [
    validationSessionId,
    navigation.mode || "learner",
    Number.isInteger(navigation.stepIndex) ? navigation.stepIndex : 0,
    step.selector
  ].join("|");

  if (gwtpTrainingStepKey !== stepKey) {
    gwtpTrainingStepKey = stepKey;

    if (step.validation?.engine === "changed" || step.validation?.engine === "changed_regex") {
      const storageKey = `gwtp:validation-baseline:${stepKey}`;
      const stored = await chrome.storage.session.get(storageKey);

      if (Object.prototype.hasOwnProperty.call(stored, storageKey)) {
        gwtpTrainingInitialValue = stored[storageKey];
      } else {
        gwtpTrainingInitialValue = getTargetValue();
        await chrome.storage.session.set({ [storageKey]: gwtpTrainingInitialValue });
      }
    } else {
      gwtpTrainingInitialValue = getTargetValue();
    }
  }

  const initialTargetValue = gwtpTrainingInitialValue;

  const clearValidationBaseline = async () => {
    if (step.validation?.engine !== "changed" && step.validation?.engine !== "changed_regex") return;
    await chrome.storage.session.remove(`gwtp:validation-baseline:${stepKey}`);
  };

  const validateCurrentStep = () => {
    const validation = step.validation;
    if (!validation?.expression) return true;

    if (validation.engine === "changed" || validation.engine === "changed_regex") {
      const currentValue = getTargetValue();
      const changed = currentValue !== initialTargetValue;
      let formatValid = true;

      if (validation.engine === "changed_regex") {
        try {
          formatValid = new RegExp(validation.expression).test(currentValue);
        } catch {
          formatValid = false;
        }
      }

      const isValid = changed && formatValid;
      validationError.style.display = isValid ? "none" : "block";
      validationError.textContent = isValid ? "" : (validation.errorMessage || "");
      if (!isValid) target.focus?.();
      return isValid;
    }

    if (validation.engine && validation.engine !== "regex") return true;

    try {
      const isValid = new RegExp(validation.expression).test(getTargetValue());
      validationError.style.display = isValid ? "none" : "block";
      validationError.textContent = isValid ? "" : (validation.errorMessage || "");
      if (!isValid) {
        target.focus?.();
        return false;
      }
      return true;
    } catch {
      validationError.style.display = "block";
      validationError.textContent = validation.errorMessage || "";
      return false;
    }
  };

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.justifyContent = "center";
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
        if ((action === "GWTP_TRAINING_NEXT" || action === "GWTP_PREVIEW_NEXT") && !validateCurrentStep()) return;
        button.disabled = true;

        chrome.runtime.sendMessage({ type: action }).then((response) => {
          if (!response?.success || !response.current?.step) {
            button.disabled = false;
            return;
          }

          clearValidationBaseline().catch(() => {});
          gwtpTrainingStepKey = null;
          gwtpTrainingInitialValue = null;
          clearTrainingStep();
          clearHighlight();

          chrome.runtime.sendMessage({
            type: isPreview ? "GWTP_PREVIEW_STEP_CHANGED" : "GWTP_TRAINING_STEP_CHANGED",
            current: response.current
          }).catch(() => {});
        }).catch(() => {
          button.disabled = false;
        });
      });
    }

    return button;
  };

  const stepIndex = Number.isInteger(navigation.stepIndex) ? navigation.stepIndex : 0;
  const totalSteps = navigation.totalSteps || 1;

  overlay.dir = navigation.direction || "ltr";

  const isPreview = navigation.mode === "preview";

  controls.appendChild(createButton(
    navigation.labels?.previous || "",
    isPreview ? "GWTP_PREVIEW_PREVIOUS" : "GWTP_TRAINING_PREVIOUS",
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
      if (!validateCurrentStep()) return;
      finishButton.disabled = true;
      chrome.runtime.sendMessage({ type: isPreview ? "GWTP_PREVIEW_COMPLETE" : "GWTP_TRAINING_COMPLETE" }).then((response) => {
        if (response?.success) {
          chrome.runtime.sendMessage({
            type: isPreview ? "GWTP_PREVIEW_COMPLETED" : "GWTP_TRAINING_COMPLETED",
            guideId: response.result?.guideId
          }).catch(() => {});

          clearValidationBaseline().catch(() => {});
          gwtpTrainingStepKey = null;
          gwtpTrainingInitialValue = null;
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
      isPreview ? "GWTP_PREVIEW_NEXT" : "GWTP_TRAINING_NEXT",
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
