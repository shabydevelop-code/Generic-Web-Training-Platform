const GWTP_TRAINING_STORAGE_KEY = "gwtpActiveTraining";

async function getTrainingSession() {
  const result = await chrome.storage.session.get(GWTP_TRAINING_STORAGE_KEY);
  return result[GWTP_TRAINING_STORAGE_KEY] || null;
}

async function saveTrainingSession(session) {
  await chrome.storage.session.set({ [GWTP_TRAINING_STORAGE_KEY]: session });
  return session;
}

async function startTrainingSession(guide) {
  const firstStep = guide?.steps?.[0];

  if (!guide?.id || !firstStep) {
    throw new Error("A valid guide with at least one step is required.");
  }

  return saveTrainingSession({
    trainingActive: true,
    guideId: guide.id,
    currentStepIndex: 0,
    steps: guide.steps
  });
}

async function clearTrainingSession() {
  await chrome.storage.session.remove(GWTP_TRAINING_STORAGE_KEY);
}

async function getCurrentTrainingStep() {
  const session = await getTrainingSession();

  if (!session?.trainingActive) return null;

  const step = session.steps?.[session.currentStepIndex];
  if (!step) return null;

  return {
    guideId: session.guideId,
    stepIndex: session.currentStepIndex,
    step
  };
}

async function moveTrainingStep(direction) {
  const session = await getTrainingSession();

  if (!session?.trainingActive) {
    throw new Error("No active training session.");
  }

  const nextIndex = session.currentStepIndex + direction;

  if (nextIndex < 0 || nextIndex >= session.steps.length) {
    return getCurrentTrainingStep();
  }

  session.currentStepIndex = nextIndex;
  await saveTrainingSession(session);
  return getCurrentTrainingStep();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GWTP_TRAINING_START") {
    startTrainingSession(message.guide)
      .then((session) => sendResponse({ success: true, session }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_GET_SESSION") {
    getTrainingSession()
      .then((session) => sendResponse({ success: true, session }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_GET_CURRENT") {
    getCurrentTrainingStep()
      .then((current) => sendResponse({ success: true, current }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_NEXT") {
    moveTrainingStep(1)
      .then((current) => sendResponse({ success: true, current }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_PREVIOUS") {
    moveTrainingStep(-1)
      .then((current) => sendResponse({ success: true, current }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_STOP") {
    clearTrainingSession()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }
});
