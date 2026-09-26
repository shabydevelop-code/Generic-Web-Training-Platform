(function () {
  const VALIDATION_SESSION_PREFIX = "gwtp:validation-session:";
  let learnerRenderVersion = 0;
  let pendingNavigationResumePromise = null;
  let pendingNavigationResumeQueued = false;
  let pendingNavigationReadyVersion = 0;
  let renderedStepIdentity = null;

  function getStepIdentity(step, stepIndex, mode) {
    const persistedId = step?.id ?? step?.Id;
    const selector = step?.selector || "";
    return `${mode || "learner"}:${persistedId ?? `index-${stepIndex ?? 0}`}:${selector}`;
  }

  async function getActiveTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active browser tab was found.");
    return tab.id;
  }

  async function beginValidationSession(mode, guideId) {
    const user = window.authService?.getCurrentUser?.();
    const userId = user?.id ?? user?.username;
    if (userId == null || userId === "") {
      throw new Error("No authenticated user was found for the validation session.");
    }

    const tabId = await getActiveTabId();
    const sessionId = crypto.randomUUID();
    const context = {
      userId: String(userId),
      tabId,
      guideId: String(guideId || "draft"),
      mode: mode || "learner",
      sessionId
    };
    const sessionKey = `${VALIDATION_SESSION_PREFIX}${tabId}`;

    const stored = await chrome.storage.session.get(null);
    const keys = Object.keys(stored).filter((key) =>
      key.startsWith(`gwtp:validation-state:${context.userId}:${tabId}:`) ||
      key.startsWith(`gwtp:validation-baseline:${context.userId}:${tabId}:`)
    );
    if (keys.length) await chrome.storage.session.remove(keys);
    await chrome.storage.session.set({ [sessionKey]: context });
    return context;
  }

  async function ensureValidationSessionForTab(tabId, mode, guideId) {
    const sessionKey = `${VALIDATION_SESSION_PREFIX}${tabId}`;
    const stored = await chrome.storage.session.get(sessionKey);
    if (stored[sessionKey]) return stored[sessionKey];

    const user = window.authService?.getCurrentUser?.();
    const userId = user?.id ?? user?.username;
    if (userId == null || userId === "") {
      throw new Error("No authenticated user was found for the validation session.");
    }

    const context = {
      userId: String(userId),
      tabId,
      guideId: String(guideId || "draft"),
      mode: mode || "learner",
      sessionId: crypto.randomUUID()
    };
    await chrome.storage.session.set({ [sessionKey]: context });
    return context;
  }

  function waitForTabComplete(tabId) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(handleUpdated);
        reject(new Error("Timed out waiting for the guide start page to load."));
      }, 30000);

      function handleUpdated(updatedTabId, changeInfo, tab) {
        if (updatedTabId !== tabId || changeInfo.status !== "complete") return;

        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(handleUpdated);
        resolve(tab);
      }

      chrome.tabs.onUpdated.addListener(handleUpdated);
    });
  }

  function frameMatchesStep(frameInfo, stepFrame) {
    if (!stepFrame) return frameInfo?.isTop === true;
    if (stepFrame.isTop) return frameInfo?.isTop === true;
    if (frameInfo?.isTop) return false;

    if (stepFrame.url && frameInfo?.href === stepFrame.url) return true;
    if (stepFrame.name && frameInfo?.name === stepFrame.name) return true;

    return false;
  }

  async function sendStepToTargetFrame(message, step) {
    const stepFrame = step?.frame || null;

    if (!stepFrame) {
      return window.messagingService.sendToActivePage(message);
    }

    return window.messagingService.sendToMatchingFrame(
      message,
      (frameInfo) => frameMatchesStep(frameInfo, stepFrame)
    );
  }

  async function clearTrainingAcrossFrames() {
    try {
      await window.messagingService.sendToAllFrames({ type: "GWTP_CLEAR_TRAINING_STEP" });
    } catch {
      // Best-effort cleanup: inaccessible/restricted frames must not block rendering
      // the next guide step in an accessible frame.
    }
  }

  async function showFirstStep(guide, renderVersion = null) {
    const firstStep = guide?.steps?.[0];

    if (!firstStep) {
      throw new Error("The guide does not contain any steps.");
    }

    if (renderVersion != null && renderVersion !== learnerRenderVersion) {
      return { success: false, stale: true };
    }

    const stepIndex = Number.isInteger(guide.stepIndex) ? guide.stepIndex : 0;
    const mode = guide.mode || "learner";
    const stepIdentity = getStepIdentity(firstStep, stepIndex, mode);

    // PAGE_READY/DOM activity can request restoration of the same step repeatedly.
    // Treat it as unchanged only while the overlay still exists in the target
    // document. A full/partial postback can destroy that document while the
    // side panel still remembers the same step identity.
    if (renderedStepIdentity === stepIdentity) {
      try {
        const rendered = await sendStepToTargetFrame({
          type: "GWTP_IS_TRAINING_STEP_RENDERED"
        }, firstStep);
        if (rendered?.success === true) {
          return { success: true, unchanged: true };
        }
      } catch {
        // The old target document/frame may have been replaced. Fall through
        // to the normal availability check and render the step again.
      }
    }

    // Never remove the currently visible step until the replacement target is
    // known to exist. This preserves the current guidance when Next/Previous points
    // to a hidden menu item, another tab, or content that has not rendered yet.
    const available = await canShowStep({
      step: firstStep,
      stepIndex,
      totalSteps: guide.totalSteps || guide.steps.length,
      mode
    });
    if (!available) {
      return { success: false, unavailable: true, message: "Step element was not found on this page." };
    }

    if (renderVersion != null && renderVersion !== learnerRenderVersion) {
      return { success: false, stale: true };
    }

    // The replacement is available. Only now clear stale guidance from every
    // accessible frame, then render the new step.
    await clearTrainingAcrossFrames();

    if (renderVersion != null && renderVersion !== learnerRenderVersion) {
      return { success: false, stale: true };
    }

    const response = await sendStepToTargetFrame({
      type: "GWTP_SHOW_TRAINING_STEP",
      step: firstStep,
      navigation: {
        mode: guide.mode || "learner",
        stepIndex: Number.isInteger(guide.stepIndex) ? guide.stepIndex : 0,
        totalSteps: guide.totalSteps || guide.steps.length,
        direction: window.i18nService.getLanguage() === "he" ? "rtl" : "ltr",
        labels: {
          previous: window.i18nService.translate("previousButton", window.i18nService.getLanguage()),
          next: window.i18nService.translate("nextButton", window.i18nService.getLanguage()),
          finish: window.i18nService.translate("finishButton", window.i18nService.getLanguage()),
          completedTitle: window.i18nService.translate("guideCompletedTitle", window.i18nService.getLanguage()),
          completedMessage: window.i18nService.translate("guideCompletedMessage", window.i18nService.getLanguage()),
          closeCompletion: window.i18nService.translate("closeCompletionButton", window.i18nService.getLanguage())
        },
        allowDetached: Boolean(guide.allowDetached)
      }
    }, firstStep);

    if (renderVersion != null && renderVersion !== learnerRenderVersion) {
      try {
        await sendStepToTargetFrame({ type: "GWTP_CLEAR_TRAINING_STEP" }, firstStep);
      } catch {}
      return { success: false, stale: true };
    }

    if (!response?.success) {
      throw new Error(response?.message || "Could not show the guide step.");
    }

    renderedStepIdentity = stepIdentity;
    return response;
  }

  async function start(guide) {
    await beginValidationSession("learner", guide?.id);
    const firstStep = guide?.steps?.[0];

    if (!firstStep) {
      throw new Error("The guide does not contain any steps.");
    }

    const startResponse = await chrome.runtime.sendMessage({
      type: "GWTP_TRAINING_START",
      guide
    });

    if (!startResponse?.success) {
      throw new Error(startResponse?.message || "Could not start the training session.");
    }
    const stepIndex = Number.isInteger(startResponse.session?.progress?.stepIndex)
      ? startResponse.session.progress.stepIndex
      : 0;
    const step = guide.steps?.[stepIndex];

    if (!step) {
      throw new Error("The saved guide step was not found.");
    }

    return showFirstStep({
      steps: [step],
      stepIndex,
      totalSteps: startResponse.session?.progress?.totalSteps || guide.steps.length
    });
  }

  async function resume(guide) {
    await beginValidationSession("learner", guide?.id);
    if (!guide?.steps?.length) {
      throw new Error("A valid guide with at least one step is required.");
    }

    const startResponse = await chrome.runtime.sendMessage({
      type: "GWTP_TRAINING_START",
      guide
    });

    if (!startResponse?.success) {
      throw new Error(startResponse?.message || "Could not resume the training session.");
    }

    const stepIndex = Number.isInteger(startResponse.session?.progress?.stepIndex)
      ? startResponse.session.progress.stepIndex
      : 0;
    const step = guide.steps?.[stepIndex];
    if (!step) throw new Error("The saved guide step was not found.");

    const current = {
      guideId: guide.id,
      step,
      stepIndex,
      totalSteps: startResponse.session?.progress?.totalSteps || guide.steps.length,
      mode: "learner"
    };

    if (!(await canShowStep(current))) {
      return { success: false, reason: "element-not-found", current };
    }

    const shown = await showCurrentStep(current);
    return { success: shown, current };
  }

  async function retryCurrentStep(current) {
    if (!current?.step) {
      return { success: false, reason: "element-not-found", current: null };
    }

    if (!(await canShowStep(current))) {
      return { success: false, reason: "element-not-found", current };
    }

    // The retry may happen after the learner moved to another tab/page.
    // Rebuild the validation context for the current active tab before rendering.
    await beginValidationSession(current.mode || "learner", current.guideId);

    const shown = await showCurrentStep(current);
    return {
      success: shown,
      reason: shown ? null : "element-not-found",
      current
    };
  }

  async function restart(guide) {
    await beginValidationSession("learner", guide?.id);
    if (!guide?.steps?.length) {
      throw new Error("A valid guide with at least one step is required.");
    }

    const restartResponse = await chrome.runtime.sendMessage({
      type: "GWTP_TRAINING_RESTART",
      guide
    });

    if (!restartResponse?.success) {
      throw new Error(restartResponse?.message || "Could not restart the training session.");
    }

    return showFirstStep({
      steps: [guide.steps[0]],
      stepIndex: 0,
      totalSteps: restartResponse.session?.progress?.totalSteps || guide.steps.length
    });
  }

  async function canShowStep(current) {
    if (!current?.step) return false;

    try {
      const response = await sendStepToTargetFrame({
        type: "GWTP_CAN_SHOW_TRAINING_STEP",
        step: current.step
      }, current.step);
      return response?.success === true;
    } catch {
      return false;
    }
  }

  async function showCurrentStep(current, options = {}) {
    if (!current?.step) return false;
    const renderVersion = ++learnerRenderVersion;

    const result = await showFirstStep({
      steps: [current.step],
      stepIndex: current.stepIndex,
      totalSteps: current.totalSteps || 1,
      mode: current.mode || "learner",
      allowDetached: Boolean(options.allowDetached)
    }, renderVersion);
    return result?.success === true;
  }

  async function preview(guide) {
    if (!guide?.steps?.length) {
      throw new Error("A valid guide with at least one step is required.");
    }

    const firstStep = guide.steps[0];
    if ((firstStep.runtime || "web") === "windows") {
      if (!firstStep.windowsTarget) {
        throw new Error("The Windows step does not contain a target descriptor.");
      }
      const response = await window.windowsBridgeService.showStep(firstStep);
      if (!response?.success) {
        throw new Error(response?.code || "Could not show the Windows guide step.");
      }
      return response;
    }

    await beginValidationSession("preview", guide?.id);
    return showFirstStep({
      steps: [firstStep],
      stepIndex: 0,
      totalSteps: guide.steps.length,
      mode: "preview"
    });
  }

  async function resumePendingNavigationCore() {
    const tabId = await getActiveTabId();
    const pendingResponse = await chrome.runtime.sendMessage({
      type: "GWTP_TRAINING_PENDING_GET",
      tabId
    });
    const pending = pendingResponse?.pending;
    if (!pending || (pending.direction !== 1 && pending.direction !== -1)) return false;

    const currentResponse = await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_GET_CURRENT" });
    const current = currentResponse?.current;
    if (!current?.step || current.stepIndex !== pending.stepIndex) {
      await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_PENDING_CLEAR", tabId });
      return false;
    }

    const peekType = pending.direction === 1
      ? "GWTP_TRAINING_PEEK_NEXT"
      : "GWTP_TRAINING_PEEK_PREVIOUS";
    const moveType = pending.direction === 1
      ? "GWTP_TRAINING_NEXT"
      : "GWTP_TRAINING_PREVIOUS";

    const peekResponse = await chrome.runtime.sendMessage({ type: peekType });
    if (!peekResponse?.success || !peekResponse.current?.step) {
      await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_PENDING_CLEAR", tabId });
      return false;
    }

    // Readiness is event-driven: if the destination target is not available yet,
    // keep the pending intent untouched. A later PAGE_READY from the destination
    // document/frame will trigger another resume attempt.
    if (!(await canShowStep(peekResponse.current))) return false;

    const moveResponse = await chrome.runtime.sendMessage({ type: moveType });
    if (!moveResponse?.success || !moveResponse.current?.step) return false;

    // Cross-document navigation destroys the old frame but the validation session
    // belongs to the browser tab. Ensure the destination content script can resolve
    // that context before showTrainingStep asks for it.
    await ensureValidationSessionForTab(
      tabId,
      moveResponse.current.mode || "learner",
      moveResponse.current.guideId
    );

    await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_PENDING_CLEAR", tabId });
    await showCurrentStep(moveResponse.current);
    return true;
  }


  async function resumePendingNavigation() {
    // PAGE_READY is emitted by every loaded frame. Count every readiness event,
    // including events received while a resume attempt is already running. The
    // active attempt drains all newer readiness versions before it stops, so no
    // destination-frame event is lost without introducing timer-based polling.
    pendingNavigationReadyVersion += 1;

    if (pendingNavigationResumePromise) {
      pendingNavigationResumeQueued = true;
      return pendingNavigationResumePromise;
    }

    pendingNavigationResumePromise = (async () => {
      let resumed = false;
      let processedReadyVersion = 0;

      do {
        pendingNavigationResumeQueued = false;
        processedReadyVersion = pendingNavigationReadyVersion;
        resumed = await resumePendingNavigationCore();
      } while (
        !resumed &&
        (pendingNavigationResumeQueued || processedReadyVersion !== pendingNavigationReadyVersion)
      );

      return resumed;
    })();

    try {
      return await pendingNavigationResumePromise;
    } finally {
      pendingNavigationResumePromise = null;
      pendingNavigationResumeQueued = false;
    }
  }

  async function restoreActiveStep() {
    const restoreVersion = ++learnerRenderVersion;
    const response = await chrome.runtime.sendMessage({
      type: "GWTP_TRAINING_GET_CURRENT"
    });

    if (restoreVersion !== learnerRenderVersion) return false;
    if (!response?.success || !response.current?.step) return false;

    if (!(await canShowStep(response.current))) return false;
    if (restoreVersion !== learnerRenderVersion) return false;

    return showCurrentStep(response.current);
  }

  window.guideRunner = {
    start,
    resume,
    retryCurrentStep,
    restart,
    preview,
    restoreActiveStep,
    resumePendingNavigation,
    showCurrentStep,
    canShowStep
  };
})();
