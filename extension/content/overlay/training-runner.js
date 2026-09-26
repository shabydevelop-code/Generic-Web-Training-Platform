const GWTP_GUIDANCE_ACCENT = globalThis.gwtpVisualConfig?.guidanceAccent || "#D6008F";
const GWTP_GUIDANCE_ACCENT_SHADOW = globalThis.gwtpVisualConfig?.guidanceAccentShadow || "rgba(214, 0, 143, 0.14)";

let gwtpTrainingOverlay = null;
let gwtpTrainingTarget = null;
let gwtpTrainingStepKey = null;
let gwtpTrainingInitialValue = null;
let gwtpTrainingTargetObserver = null;
let gwtpTrainingPositionCleanup = null;
let gwtpTrainingNavigationCleanup = null;

function clearTrainingStep() {
  if (gwtpTrainingNavigationCleanup) {
    gwtpTrainingNavigationCleanup();
    gwtpTrainingNavigationCleanup = null;
  }

  if (gwtpTrainingPositionCleanup) {
    gwtpTrainingPositionCleanup();
    gwtpTrainingPositionCleanup = null;
  }

  if (gwtpTrainingTargetObserver) {
    gwtpTrainingTargetObserver.disconnect();
    gwtpTrainingTargetObserver = null;
  }

  if (gwtpTrainingOverlay) {
    gwtpTrainingOverlay.remove();
    gwtpTrainingOverlay = null;
  }

  if (gwtpTrainingTarget) {
    // A training target can also still carry the editor picker's highlight marker.
    // Restore/remove that highlight state as well so Exit Preview cannot leave a
    // stale outline behind after the training overlay itself has been cleared.
    if (gwtpTrainingTarget.hasAttribute("data-gwtp-highlighted")) {
      clearHighlight();
    } else {
      gwtpTrainingTarget.style.removeProperty("outline");
      gwtpTrainingTarget.style.removeProperty("outline-offset");
    }
    gwtpTrainingTarget = null;
  }
}

async function showTrainingStep(step, navigation = {}) {
  clearTrainingStep();
  clearHighlight();

  const instructionOnly = step?.targetType === "none";
  if (!instructionOnly && !step?.selector) {
    return { success: false, message: "Step selector is missing." };
  }

  const targetResult = instructionOnly ? { element: null } : findElement(step.selector);

  if (targetResult.error) {
    return { success: false, message: targetResult.error };
  }

  const target = targetResult.element;

  if (!instructionOnly && !target && !navigation.allowDetached) {
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

  // Do not intercept or replay host-page clicks. Some web applications use links
  // as JavaScript menu triggers (for example, app launchers). GWTP keeps business
  // interactions owned entirely by the host application.
  //
  // A genuine navigation may destroy this document before the learner can press
  // Next. Record only the learning intent on activation; never preventDefault,
  // synthesize a click, or navigate on the host application's behalf. If the
  // activation does not navigate, the pending intent is harmless: progress is not
  // mutated until a later PAGE_READY exposes the adjacent authored target.
  const nativeNavigationAnchor = target?.closest?.("a[href]");
  const nativeNavigationHref = nativeNavigationAnchor?.getAttribute("href")?.trim() || "";
  const canDestroyDocumentThroughNativeNavigation =
    Boolean(nativeNavigationAnchor) &&
    nativeNavigationHref !== "" &&
    nativeNavigationHref !== "#" &&
    !nativeNavigationHref.toLowerCase().startsWith("javascript:") &&
    (nativeNavigationAnchor.target || "").toLowerCase() !== "_blank";

  if (
    canDestroyDocumentThroughNativeNavigation &&
    Number.isInteger(navigation.stepIndex)
  ) {
    let activationPendingStored = false;

    const persistActivationIntent = () => {
      if (activationPendingStored) return;
      activationPendingStored = true;

      const pendingRequest = navigation.mode === "preview"
        // Preview has no learner progress/persisted pending record. PEEK is enough:
        // the Side Panel records previewPendingDirection before this document can
        // unload, and destination PAGE_READY commits that adjacent step.
        ? chrome.runtime.sendMessage({ type: "GWTP_PREVIEW_PEEK_NEXT" })
        : chrome.runtime.sendMessage({
            type: "GWTP_TRAINING_PENDING_SET",
            pending: {
              direction: 1,
              stepIndex: navigation.stepIndex
            }
          });

      pendingRequest.catch(() => {
        activationPendingStored = false;
      });
    };

    const handleNavigationKeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") persistActivationIntent();
    };

    nativeNavigationAnchor.addEventListener("pointerdown", persistActivationIntent);
    nativeNavigationAnchor.addEventListener("keydown", handleNavigationKeydown);

    // The link belongs to this authored step only. When Next/Previous replaces
    // the step (including with an instruction-only bubble), remove the host-page
    // activation listeners so a later click on the old link cannot advance the
    // new current step.
    gwtpTrainingNavigationCleanup = () => {
      nativeNavigationAnchor.removeEventListener("pointerdown", persistActivationIntent);
      nativeNavigationAnchor.removeEventListener("keydown", handleNavigationKeydown);
    };
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
    step.targetType || "element",
    step.selector || ""
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
      let navigationInProgress = false;
      let focusBeforeNavigation = null;

      button.addEventListener("pointerdown", (event) => {
        if (action !== "GWTP_TRAINING_NEXT" && action !== "GWTP_TRAINING_PREVIOUS") return;

        // Keep focus on the business field until validation has run. Persisting a
        // pending move on pointerdown is unsafe: a validation failure must not leave
        // a resumable navigation intent behind for PAGE_READY/restore to consume.
        event.preventDefault();
        focusBeforeNavigation = document.activeElement;
      });
      button.addEventListener("keydown", (event) => {
        if (
          (event.key !== "Enter" && event.key !== " ") ||
          (action !== "GWTP_TRAINING_NEXT" && action !== "GWTP_TRAINING_PREVIOUS")
        ) return;

        focusBeforeNavigation = document.activeElement;
      });

      button.addEventListener("click", async () => {
        // A physical double-click can dispatch the second click while the first
        // asynchronous validation/pending-navigation path is still awaiting Chrome
        // messaging. Disable the whole navigation transaction synchronously so one
        // rendered control can mutate learner progress at most once.
        if (navigationInProgress) return;
        navigationInProgress = true;
        button.disabled = true;

        if (pendingNavigationPromise) {
          const pendingResponse = await pendingNavigationPromise.catch(() => null);
          pendingNavigationPromise = null;
          if (!pendingResponse?.success) {
            navigationInProgress = false;
            button.disabled = false;
            return;
          }
        }

        if ((action === "GWTP_TRAINING_NEXT" || action === "GWTP_PREVIEW_NEXT") && !(await validateCurrentStep())) {
          navigationInProgress = false;
          button.disabled = false;
          return;
        }

        const isForward = action === "GWTP_TRAINING_NEXT" || action === "GWTP_PREVIEW_NEXT";
        const isBackward = action === "GWTP_TRAINING_PREVIOUS" || action === "GWTP_PREVIEW_PREVIOUS";
        const isLearnerNavigation = action === "GWTP_TRAINING_NEXT" || action === "GWTP_TRAINING_PREVIOUS";

        if (isLearnerNavigation) {
          pendingNavigationPromise = chrome.runtime.sendMessage({
            type: "GWTP_TRAINING_PENDING_SET",
            pending: {
              direction: isForward ? 1 : -1,
              stepIndex: Number.isInteger(navigation.stepIndex) ? navigation.stepIndex : 0
            }
          });
          const pendingResponse = await pendingNavigationPromise.catch(() => null);
          pendingNavigationPromise = null;
          if (!pendingResponse?.success) {
            navigationInProgress = false;
            button.disabled = false;
            return;
          }
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

        const moveStep = () => chrome.runtime.sendMessage({ type: action }).then((response) => {
          if (!response?.success || !response.current?.step) {
            navigationInProgress = false;
            button.disabled = false;
            return;
          }

          gwtpTrainingStepKey = null;
          gwtpTrainingInitialValue = null;
          clearTrainingStep();
          clearHighlight();

          const notifyStepChanged = () => chrome.runtime.sendMessage({
            type: isPreview ? "GWTP_PREVIEW_STEP_CHANGED" : "GWTP_TRAINING_STEP_CHANGED",
            current: response.current
          }).catch(() => {});

          if (isPreview) {
            notifyStepChanged();
            return;
          }

          // Do not leave the just-completed navigation intent visible while the
          // new step is being rendered. PAGE_READY/restore paths use this key to
          // decide whether a move still needs to be resumed; clearing it first
          // prevents the same successful click from being applied a second time.
          chrome.runtime.sendMessage({ type: "GWTP_TRAINING_PENDING_CLEAR" })
            .catch(() => null)
            .then(notifyStepChanged);
        }).catch(() => {
          navigationInProgress = false;
          button.disabled = false;
        });

        const guardedStepAction = isForward || isBackward;

        if (!guardedStepAction) {
          moveStep();
          return;
        }

        const peekType = isPreview
          ? (isForward ? "GWTP_PREVIEW_PEEK_NEXT" : "GWTP_PREVIEW_PEEK_PREVIOUS")
          : (isForward ? "GWTP_TRAINING_PEEK_NEXT" : "GWTP_TRAINING_PEEK_PREVIOUS");

        chrome.runtime.sendMessage({ type: peekType }).then(async (peekResponse) => {
          if (!peekResponse?.success || !peekResponse.current?.step) {
            navigationInProgress = false;
            button.disabled = false;
            return;
          }

          const availability = await chrome.runtime.sendMessage({
            type: "GWTP_CHECK_NEXT_STEP_AVAILABLE",
            current: peekResponse.current
          });

          if (!availability?.success) {
            // Keep the current bubble visible. Learner mode may also retain its
            // pending navigation intent for PAGE_READY; Preview has no persisted
            // learner progress and simply waits for the editor to expose the target.
            validationError.style.display = "block";
            validationError.textContent = availability?.message || "";
            navigationInProgress = false;
            button.disabled = false;
            return;
          }

          validationError.style.display = "none";
          validationError.textContent = "";

          moveStep();
        }).catch(() => {
          navigationInProgress = false;
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
      if (instructionOnly) {
        gwtpTrainingOverlay.style.top = `${Math.max(gap, (window.innerHeight - overlayRect.height) / 2)}px`;
        gwtpTrainingOverlay.style.left = `${Math.max(gap, (window.innerWidth - overlayRect.width) / 2)}px`;
      } else {
        gwtpTrainingOverlay.style.top = `${gap}px`;
        gwtpTrainingOverlay.style.left = `${Math.max(gap, window.innerWidth - overlayRect.width - gap)}px`;
      }
      return;
    }

    const rect = gwtpTrainingTarget.getBoundingClientRect();
    const overlayRect = gwtpTrainingOverlay.getBoundingClientRect();
    const viewportGap = 14;
    const verticalGap = 16;
    const horizontalGap = 28;

    const centeredLeft = rect.left + (rect.width - overlayRect.width) / 2;
    const centeredTop = rect.top + (rect.height - overlayRect.height) / 2;
    const candidates = [
      { side: "below", top: rect.bottom + verticalGap, left: centeredLeft },
      { side: "above", top: rect.top - overlayRect.height - verticalGap, left: centeredLeft },
      { side: "right", top: centeredTop, left: rect.right + horizontalGap },
      { side: "left", top: centeredTop, left: rect.left - overlayRect.width - horizontalGap }
    ];

    const fitsViewport = (candidate) =>
      candidate.top >= viewportGap &&
      candidate.left >= viewportGap &&
      candidate.top + overlayRect.height <= window.innerHeight - viewportGap &&
      candidate.left + overlayRect.width <= window.innerWidth - viewportGap;

    const doesNotOverlapTarget = (candidate) => {
      const candidateRight = candidate.left + overlayRect.width;
      const candidateBottom = candidate.top + overlayRect.height;
      return (
        candidateBottom <= rect.top - verticalGap ||
        candidate.top >= rect.bottom + verticalGap ||
        candidateRight <= rect.left - horizontalGap ||
        candidate.left >= rect.right + horizontalGap
      );
    };

    // Keep placement deterministic and target-safe. Prefer below, then above,
    // right and left. A candidate is valid only when it fits the viewport and
    // preserves the full gap from the highlighted target.
    const chosen = candidates.find(
      (candidate) => fitsViewport(candidate) && doesNotOverlapTarget(candidate)
    );

    let top;
    let left;

    if (chosen) {
      top = chosen.top;
      left = chosen.left;
    } else {
      // Last resort: clamp inside the viewport, then keep the overlay away from
      // the target whenever one axis still provides enough room.
      top = Math.max(viewportGap, Math.min(rect.bottom + verticalGap, window.innerHeight - overlayRect.height - viewportGap));
      left = Math.max(viewportGap, Math.min(centeredLeft, window.innerWidth - overlayRect.width - viewportGap));

      const fallback = { top, left };
      if (!doesNotOverlapTarget(fallback)) {
        const aboveTop = rect.top - overlayRect.height - verticalGap;
        const rightLeft = rect.right + horizontalGap;
        const leftLeft = rect.left - overlayRect.width - horizontalGap;

        if (aboveTop >= viewportGap) {
          top = aboveTop;
        } else if (rightLeft + overlayRect.width <= window.innerWidth - viewportGap) {
          top = Math.max(viewportGap, Math.min(centeredTop, window.innerHeight - overlayRect.height - viewportGap));
          left = rightLeft;
        } else if (leftLeft >= viewportGap) {
          top = Math.max(viewportGap, Math.min(centeredTop, window.innerHeight - overlayRect.height - viewportGap));
          left = leftLeft;
        }
      }
    }

    left = Math.max(viewportGap, Math.min(left, window.innerWidth - overlayRect.width - viewportGap));

    gwtpTrainingOverlay.style.top = `${top}px`;
    gwtpTrainingOverlay.style.left = `${left}px`;
  };

  let positionFrame = null;
  let manuallyPositioned = false;

  const schedulePositionOverlay = () => {
    if (positionFrame !== null) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = null;
      if (!manuallyPositioned && !isDragging) positionOverlay();
    });
  };

  const markManualPosition = () => {
    manuallyPositioned = true;
  };

  dragHandle.addEventListener("pointerdown", markManualPosition);
  dragHandle.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      markManualPosition();
    }
  });

  // Scroll events do not bubble, but capture receives scrolling from window and
  // nested scroll containers. Resize covers viewport changes. Keep one RAF update
  // per frame and remove both listeners when the step is cleared.
  window.addEventListener("scroll", schedulePositionOverlay, true);
  window.addEventListener("resize", schedulePositionOverlay);

  gwtpTrainingPositionCleanup = () => {
    window.removeEventListener("scroll", schedulePositionOverlay, true);
    window.removeEventListener("resize", schedulePositionOverlay);
    if (positionFrame !== null) {
      cancelAnimationFrame(positionFrame);
      positionFrame = null;
    }
  };

  schedulePositionOverlay();

  return { success: true, message: `Step ${step.order || ""} is running.` };
}
