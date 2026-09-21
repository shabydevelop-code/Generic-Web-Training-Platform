const GWTP_GUIDANCE_ACCENT = globalThis.gwtpVisualConfig?.guidanceAccent || "#D6008F";
const GWTP_GUIDANCE_ACCENT_SHADOW = globalThis.gwtpVisualConfig?.guidanceAccentShadow || "rgba(214, 0, 143, 0.14)";

let gwtpTrainingOverlay = null;
let gwtpTrainingTarget = null;
let gwtpTrainingStepKey = null;
let gwtpTrainingInitialValue = null;
let gwtpTrainingTargetObserver = null;

function clearTrainingStep() {
  if (gwtpTrainingTargetObserver) {
    gwtpTrainingTargetObserver.disconnect();
    gwtpTrainingTargetObserver = null;
  }

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

  if (!target && !navigation.allowDetached) {
    return { success: false, message: "Step element was not found on this page." };
  }

  const applyTrainingTargetHighlight = (element) => {
    if (gwtpTrainingTarget && gwtpTrainingTarget !== element) {
      gwtpTrainingTarget.style.removeProperty("outline");
      gwtpTrainingTarget.style.removeProperty("outline-offset");
    }

    gwtpTrainingTarget = element;
    element.style.setProperty("outline", `3px solid ${GWTP_GUIDANCE_ACCENT}`, "important");
    element.style.setProperty("outline-offset", "3px", "important");
  };

  if (target) {
    applyTrainingTargetHighlight(target);
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }

  // A highlighted native link may destroy this document before the learner can press
  // the overlay's Next button. Persist only the learning intent here; PAGE_READY on
  // the destination still verifies that the next step actually exists before moving
  // progress. No business action is replayed by GWTP.
  if (
    target instanceof HTMLAnchorElement &&
    target.href &&
    navigation.mode !== "preview" &&
    Number.isInteger(navigation.stepIndex)
  ) {
    let nativeLinkPendingPromise = null;

    const persistNativeLinkIntent = () => {
      if (!nativeLinkPendingPromise) {
        nativeLinkPendingPromise = chrome.runtime.sendMessage({
          type: "GWTP_TRAINING_PENDING_SET",
          pending: {
            direction: 1,
            stepIndex: navigation.stepIndex
          }
        }).catch(() => null);
      }
      return nativeLinkPendingPromise;
    };

    target.addEventListener("pointerdown", persistNativeLinkIntent, { once: true });
    target.addEventListener("keydown", (event) => {
      if (event.key === "Enter") persistNativeLinkIntent();
    }, { once: true });

    // A fast native navigation can destroy the frame before an asynchronous
    // runtime message sent from pointerdown reaches chrome.storage.session.
    // For ordinary unmodified link activation, delay only the browser navigation
    // until the learning intent is durably stored. The business action itself is
    // still performed exactly once and is never replayed by GWTP.
    target.addEventListener("click", async (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      const pendingResponse = await persistNativeLinkIntent();
      if (!pendingResponse?.success) return;

      const href = target.href;
      const linkTarget = (target.getAttribute("target") || "_self").toLowerCase();

      if (linkTarget === "_top") {
        window.top.location.assign(href);
      } else if (linkTarget === "_parent") {
        window.parent.location.assign(href);
      } else if (linkTarget === "_blank") {
        window.open(href, "_blank");
      } else {
        window.location.assign(href);
      }
    }, { once: true });
  }

  if (target && step.selector.startsWith("gwtp-grid:")) {
    gwtpTrainingTargetObserver = new MutationObserver(() => {
      if (!gwtpTrainingOverlay) return;
      const refreshedResult = findElement(step.selector);
      if (!refreshedResult.error && refreshedResult.element && refreshedResult.element !== gwtpTrainingTarget) {
        applyTrainingTargetHighlight(refreshedResult.element);
      }
    });
    gwtpTrainingTargetObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const overlay = document.createElement("div");
  overlay.className = "gwtp-training-overlay";
  overlay.setAttribute("role", "region");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-atomic", "true");
  overlay.setAttribute("aria-label", navigation.labels?.guidanceRegion || "Training guidance");
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
  dragHandle.setAttribute("role", "button");
  dragHandle.tabIndex = 0;
  dragHandle.setAttribute("aria-label", navigation.labels?.moveGuidance || "Move guidance");
  dragHandle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight");
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

    // pointerdown is prevented below to keep dragging stable, so explicitly focus
    // the handle first. This also makes arrow-key movement work immediately after
    // the learner clicks/touches the drag handle.
    dragHandle.focus({ preventScroll: true });
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
  dragHandle.addEventListener("focus", () => {
    dragHandle.style.outline = "2px solid #2563eb";
    dragHandle.style.outlineOffset = "2px";
  });
  dragHandle.addEventListener("blur", () => {
    dragHandle.style.outline = "none";
  });
  dragHandle.addEventListener("keydown", (event) => {
    const offsets = {
      ArrowUp: [0, -10],
      ArrowDown: [0, 10],
      ArrowLeft: [-10, 0],
      ArrowRight: [10, 0]
    };
    const offset = offsets[event.key];
    if (!offset) return;

    event.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const position = clampOverlayPosition(rect.left + offset[0], rect.top + offset[1]);
    overlay.style.left = `${position.left}px`;
    overlay.style.top = `${position.top}px`;
  });

  const instructionHost = document.createElement("div");
  instructionHost.id = `gwtp-training-instruction-${Date.now()}`;
  instructionHost.setAttribute("role", "status");
  instructionHost.setAttribute("aria-live", "polite");
  instructionHost.setAttribute("aria-atomic", "true");
  instructionHost.style.display = "block";
  instructionHost.style.minHeight = "1px";
  instructionHost.style.color = "#172033";
  instructionHost.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  instructionHost.style.fontWeight = "500";
  instructionHost.style.fontSize = "14px";
  instructionHost.style.lineHeight = "1.55";
  instructionHost.style.direction = navigation.direction || "ltr";

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

  const instructionHtml = String(step.instruction || "").trim();
  if (instructionHtml) {
    instructionHost.innerHTML = sanitizeInstructionHtml(instructionHtml);
  } else {
    instructionHost.textContent = `Step ${step.order || ""}`;
  }

  const validationError = document.createElement("div");
  validationError.id = `gwtp-training-error-${Date.now()}`;
  validationError.setAttribute("role", "alert");
  validationError.setAttribute("aria-live", "assertive");
  validationError.setAttribute("aria-atomic", "true");
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
    if (!target) return "";
    if (target instanceof HTMLSelectElement) {
      const selectedOption = target.options[target.selectedIndex];
      return String(selectedOption?.value ?? target.value ?? "");
    }
    if ("value" in target) return String(target.value ?? "");
    if (target.isContentEditable) return target.textContent || "";
    return target.textContent || "";
  };

  const sessionResponse = await chrome.runtime.sendMessage({ type: "GWTP_VALIDATION_SESSION_GET" });
  const validationContext = sessionResponse?.context;
  if (!validationContext) {
    clearTrainingStep();
    return { success: false, message: "Validation session context was not found." };
  }

  const stepKey = [
    validationContext.userId,
    validationContext.tabId,
    validationContext.sessionId,
    validationContext.guideId,
    navigation.mode || validationContext.mode || "learner",
    Number.isInteger(navigation.stepIndex) ? navigation.stepIndex : 0,
    step.selector
  ].join(":");

  let validationState = null;
  const usesChangedValidation =
    step.validation?.engine === "changed" || step.validation?.engine === "changed_regex";
  const validationStateKey = `gwtp:validation-state:${stepKey}`;

  if (gwtpTrainingStepKey !== stepKey) {
    gwtpTrainingStepKey = stepKey;

    if (usesChangedValidation) {
      const stateResponse = await chrome.runtime.sendMessage({
        type: "GWTP_VALIDATION_STATE_GET_OR_CREATE",
        key: validationStateKey,
        baseline: getTargetValue()
      });
      validationState = stateResponse?.state || {
        baseline: getTargetValue(),
        satisfied: false
      };
      gwtpTrainingInitialValue = validationState.baseline;
    } else {
      gwtpTrainingInitialValue = getTargetValue();
    }
  } else if (usesChangedValidation) {
    const stateResponse = await chrome.runtime.sendMessage({
      type: "GWTP_VALIDATION_STATE_GET_OR_CREATE",
      key: validationStateKey,
      baseline: gwtpTrainingInitialValue ?? getTargetValue()
    });
    validationState = stateResponse?.state || {
      baseline: gwtpTrainingInitialValue ?? getTargetValue(),
      satisfied: false
    };
  }

  const initialTargetValue = gwtpTrainingInitialValue;

  // Only attach visible training UI after the validation context is fully ready.
  // This prevents partial/empty bubbles when a page transition interrupts setup.
  overlay.appendChild(instructionHost);

  const validateCurrentStep = async () => {
    const validation = step.validation;
    if (!validation?.expression) return true;

    if (usesChangedValidation) {
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
      if (!isValid) {
        target?.focus?.();
        return false;
      }

      if (!validationState?.satisfied) {
        const satisfiedResponse = await chrome.runtime.sendMessage({
          type: "GWTP_VALIDATION_STATE_SATISFY",
          key: validationStateKey
        });
        if (!satisfiedResponse?.success) return false;
        validationState = satisfiedResponse.state;
      }
      return true;
    }

    if (validation.engine === "required") {
      const isValid = getTargetValue().trim().length > 0;
      validationError.style.display = isValid ? "none" : "block";
      validationError.textContent = isValid ? "" : (validation.errorMessage || "");
      return isValid;
    }

    if (validation.engine && validation.engine !== "regex") return true;

    try {
      const isValid = new RegExp(validation.expression).test(getTargetValue());
      validationError.style.display = isValid ? "none" : "block";
      validationError.textContent = isValid ? "" : (validation.errorMessage || "");
      if (!isValid) {
        target?.focus?.();
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
      let pendingNavigationPromise = null;
      let focusBeforeNavigation = null;

      button.addEventListener("pointerdown", (event) => {
        if (action !== "GWTP_TRAINING_NEXT" && action !== "GWTP_TRAINING_PREVIOUS") return;

        // Keep focus on the business field until the pending intent is durably stored.
        // Otherwise its blur/change handler may start a postback and destroy this frame
        // before chrome.storage.session has received the navigation intent.
        event.preventDefault();
        focusBeforeNavigation = document.activeElement;
        pendingNavigationPromise = chrome.runtime.sendMessage({
          type: "GWTP_TRAINING_PENDING_SET",
          pending: {
            direction: action === "GWTP_TRAINING_NEXT" ? 1 : -1,
            stepIndex: Number.isInteger(navigation.stepIndex) ? navigation.stepIndex : 0
          }
        });
      });
      button.addEventListener("keydown", (event) => {
        if (
          (event.key !== "Enter" && event.key !== " ") ||
          (action !== "GWTP_TRAINING_NEXT" && action !== "GWTP_TRAINING_PREVIOUS")
        ) return;

        focusBeforeNavigation = document.activeElement;
        pendingNavigationPromise = chrome.runtime.sendMessage({
          type: "GWTP_TRAINING_PENDING_SET",
          pending: {
            direction: action === "GWTP_TRAINING_NEXT" ? 1 : -1,
            stepIndex: Number.isInteger(navigation.stepIndex) ? navigation.stepIndex : 0
          }
        });
      });

      button.addEventListener("click", async () => {
        if (pendingNavigationPromise) {
          const pendingResponse = await pendingNavigationPromise.catch(() => null);
          pendingNavigationPromise = null;
          if (!pendingResponse?.success) return;
        }

        if ((action === "GWTP_TRAINING_NEXT" || action === "GWTP_PREVIEW_NEXT") && !(await validateCurrentStep())) {
          if (action === "GWTP_TRAINING_NEXT") {
            chrome.runtime.sendMessage({ type: "GWTP_TRAINING_PENDING_CLEAR" }).catch(() => {});
          }
          return;
        }

        // Only after validation and pending-state persistence do we allow blur/change.
        // A business-system postback may unload this frame immediately after this call;
        // PAGE_READY will then resume the stored navigation.
        if (
          (action === "GWTP_TRAINING_NEXT" || action === "GWTP_TRAINING_PREVIOUS") &&
          focusBeforeNavigation &&
          focusBeforeNavigation !== button &&
          typeof focusBeforeNavigation.blur === "function"
        ) {
          focusBeforeNavigation.blur();
          focusBeforeNavigation = null;
        }

        button.disabled = true;

        const moveStep = () => chrome.runtime.sendMessage({ type: action }).then((response) => {
          if (!response?.success || !response.current?.step) {
            button.disabled = false;
            return;
          }

          gwtpTrainingStepKey = null;
          gwtpTrainingInitialValue = null;
          clearTrainingStep();
          clearHighlight();

          if (!isPreview) {
            chrome.runtime.sendMessage({ type: "GWTP_TRAINING_PENDING_CLEAR" }).catch(() => {});
          }
          chrome.runtime.sendMessage({
            type: isPreview ? "GWTP_PREVIEW_STEP_CHANGED" : "GWTP_TRAINING_STEP_CHANGED",
            current: response.current
          }).catch(() => {});
        }).catch(() => {
          button.disabled = false;
        });

        const guardedLearnerAction =
          action === "GWTP_TRAINING_NEXT" || action === "GWTP_TRAINING_PREVIOUS";

        if (!guardedLearnerAction) {
          moveStep();
          return;
        }

        const peekType = action === "GWTP_TRAINING_NEXT"
          ? "GWTP_TRAINING_PEEK_NEXT"
          : "GWTP_TRAINING_PEEK_PREVIOUS";

        chrome.runtime.sendMessage({ type: peekType }).then(async (peekResponse) => {
          if (!peekResponse?.success || !peekResponse.current?.step) {
            button.disabled = false;
            return;
          }

          const availability = await chrome.runtime.sendMessage({
            type: "GWTP_CHECK_NEXT_STEP_AVAILABLE",
            current: peekResponse.current
          });

          if (!availability?.success) {
            // Keep the pending learning intent. The live application owns navigation;
            // when the learner reaches a page where the requested step exists,
            // GWTP_PAGE_READY will resume the move in the requested direction.
            validationError.style.display = "block";
            validationError.textContent = availability?.message || "";
            button.disabled = false;
            return;
          }

          validationError.style.display = "none";
          validationError.textContent = "";

          moveStep();
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
    finishButton.addEventListener("click", async () => {
      if (!(await validateCurrentStep())) return;
      finishButton.disabled = true;
      chrome.runtime.sendMessage({ type: isPreview ? "GWTP_PREVIEW_COMPLETE" : "GWTP_TRAINING_COMPLETE" }).then((response) => {
        if (response?.success) {
          chrome.runtime.sendMessage({
            type: isPreview ? "GWTP_PREVIEW_COMPLETED" : "GWTP_TRAINING_COMPLETED",
            guideId: response.result?.guideId
          }).catch(() => {});
          gwtpTrainingStepKey = null;
          gwtpTrainingInitialValue = null;
          clearTrainingStep();
          clearHighlight();

          const completion = document.createElement("div");
          completion.setAttribute("role", "dialog");
          completion.setAttribute("aria-modal", "true");
          completion.setAttribute("aria-live", "polite");
          completion.tabIndex = -1;
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
          title.id = `gwtp-completion-title-${Date.now()}`;
          title.textContent = navigation.labels?.completedTitle || "";
          completion.setAttribute("aria-labelledby", title.id);
          title.style.display = "block";
          title.style.fontSize = "18px";
          title.style.lineHeight = "1.4";
          title.style.fontWeight = "700";

          const message = document.createElement("p");
          message.id = `gwtp-completion-message-${Date.now()}`;
          message.textContent = navigation.labels?.completedMessage || "";
          completion.setAttribute("aria-describedby", message.id);
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
          const closeCompletion = () => completion.remove();
          closeButton.addEventListener("click", closeCompletion);
          completion.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closeCompletion();
              return;
            }

            if (event.key === "Tab") {
              event.preventDefault();
              closeButton.focus();
            }
          });

          completion.append(successMark, title, message, closeButton);
          document.documentElement.appendChild(completion);
          closeButton.focus();
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
  overlay.setAttribute("aria-describedby", instructionHost.id);

  document.documentElement.appendChild(overlay);
  gwtpTrainingOverlay = overlay;

  const positionOverlay = () => {
    if (!gwtpTrainingOverlay) return;

    if (!gwtpTrainingTarget) {
      const overlayRect = gwtpTrainingOverlay.getBoundingClientRect();
      const gap = 14;
      gwtpTrainingOverlay.style.top = `${gap}px`;
      gwtpTrainingOverlay.style.left = `${Math.max(gap, window.innerWidth - overlayRect.width - gap)}px`;
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
