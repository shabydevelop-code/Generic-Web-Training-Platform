(function () {
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

  async function showFirstStep(guide) {
    const firstStep = guide?.steps?.[0];

    if (!firstStep) {
      throw new Error("The guide does not contain any steps.");
    }

    // document_idle content scripts can initialize just after the tab reports complete.
    let lastError;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await sendStepToTargetFrame({
          type: "GWTP_SHOW_TRAINING_STEP",
          step: firstStep,
          navigation: {
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
            }
          }
        }, firstStep);

        if (response?.success) return response;
        lastError = new Error(response?.message || "Could not start the first guide step.");
      } catch (error) {
        lastError = error;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw lastError || new Error("Could not start the first guide step.");
  }

  async function start(guide) {
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

  async function restoreActiveStep() {
    const response = await chrome.runtime.sendMessage({
      type: "GWTP_TRAINING_GET_CURRENT"
    });

    if (!response?.success || !response.current?.step) return false;

    await showFirstStep({
      steps: [response.current.step],
      stepIndex: response.current.stepIndex,
      totalSteps: response.current.totalSteps || 1
    });
    return true;
  }

  window.guideRunner = {
    start,
    restoreActiveStep
  };
})();
