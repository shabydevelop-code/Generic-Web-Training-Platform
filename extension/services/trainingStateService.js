(function () {
  const STORAGE_KEY = "gwtpActiveTraining";

  async function setActiveStep(guideId, stepIndex, step) {
    await chrome.storage.session.set({
      [STORAGE_KEY]: { trainingActive: true, guideId, stepIndex, step }
    });
  }

  async function getActiveTraining() {
    const result = await chrome.storage.session.get(STORAGE_KEY);
    return result[STORAGE_KEY] || null;
  }

  async function clear() {
    await chrome.storage.session.remove(STORAGE_KEY);
  }

  window.trainingStateService = { setActiveStep, getActiveTraining, clear };
})();