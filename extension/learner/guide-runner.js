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

  async function showFirstStep(guide) {
    const firstStep = guide?.steps?.[0];

    if (!firstStep) {
      throw new Error("The guide does not contain any steps.");
    }

    // document_idle content scripts can initialize just after the tab reports complete.
    let lastError;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const response = await window.messagingService.sendToActivePage({
          type: "GWTP_SHOW_TRAINING_STEP",
          step: firstStep
        });

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

    await window.trainingStateService.setActiveStep(guide.id, 0, firstStep);
    await navigateToStartUrl(guide.startUrl);
    return showFirstStep(guide);
  }

  async function restoreActiveStep() {
    const activeTraining = await window.trainingStateService.getActiveTraining();

    if (!activeTraining?.trainingActive || !activeTraining.step) return false;

    await showFirstStep({ steps: [activeTraining.step] });
    return true;
  }

  window.guideRunner = {
    start,
    restoreActiveStep
  };
})();
