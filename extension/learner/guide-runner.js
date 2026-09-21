(function () {
  const VALIDATION_SESSION_PREFIX = "gwtp:validation-session:";
  let learnerRenderVersion = 0;
  let pendingNavigationResumePromise = null;
  let pendingNavigationResumeQueued = false;

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

  async function navigateToStartUrl(startUrl) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error("No active browser tab was found.");
    }

    const loadPromise = waitForTabComplete(tab.id);
    await chrome.tabs.update(tab.id, { url: startUrl });
    await loadPromise;

    return tab.id;
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

  async function showFirstStep(guide, renderVersion = null) {
    const firstStep = guide?.steps?.[0];

    if (!firstStep) {
      throw new Error("The guide does not contain any steps.");
    }

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

    return response;
  }

  async function start(guide) {
    await beginValidationSession("learner", guide?.id);
    if (!guide?.startUrl) {
      throw new Error("The guide start URL is missing.");
    }

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

    await navigateToStartUrl(guide.startUrl);
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
    if (!guide?.startUrl || !guide?.steps?.length) {
      throw new Error("A valid guide with a start URL and at least one step is required.");
    }

    const restartResponse = await chrome.runtime.sendMessage({
      type: "GWTP_TRAINING_RESTART",
      guide
    });

    if (!restartResponse?.success) {
      throw new Error(restartResponse?.message || "Could not restart the training session.");
    }

    await navigateToStartUrl(guide.startUrl);
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
    await beginValidationSession("preview", guide?.id);
    if (!guide?.startUrl || !guide?.steps?.length) {
      throw new Error("A valid guide with a start URL and at least one step is required.");
    }

    await navigateToStartUrl(guide.startUrl);
    return showFirstStep({
      steps: [guide.steps[0]],
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

    if (!(await canShowStep(peekResponse.current))) return false;

    const moveResponse = await chrome.runtime.sendMessage({ type: moveType });
    if (!moveResponse?.success || !moveResponse.current?.step) return false;

    await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_PENDING_CLEAR", tabId });
    await showCurrentStep(moveResponse.current);
    return true;
  }


  async function resumePendingNavigation() {
    // PAGE_READY is emitted by every loaded frame. The top page can become ready
    // before the target content frame, while that frame may report PAGE_READY during
    // the first availability check. Do not collapse that second readiness event:
    // serialize progress mutation, but queue one follow-up check when another frame
    // becomes ready while a resume attempt is still in flight.
    if (pendingNavigationResumePromise) {
      pendingNavigationResumeQueued = true;
      return pendingNavigationResumePromise;
    }

    pendingNavigationResumePromise = (async () => {
      let resumed = false;

      do {
        pendingNavigationResumeQueued = false;
        resumed = await resumePendingNavigationCore();
      } while (!resumed && pendingNavigationResumeQueued);

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
