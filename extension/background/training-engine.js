const GWTP_AUTH_STORAGE_KEY = "gwtp.auth.user";

async function getAuthSession() {
  const stored = await chrome.storage.local.get(GWTP_AUTH_STORAGE_KEY);
  return stored[GWTP_AUTH_STORAGE_KEY] || null;
}

async function apiRequest(path, options = {}) {
  const auth = await getAuthSession();
  if (!auth?.accessToken) throw new Error("No authenticated learner session.");

  const baseUrl = globalThis.appConfig.api.baseUrl.replace(/\/$/, "");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${auth.accessToken}`);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(baseUrl + path, { ...options, headers });
  if (!response.ok) throw new Error(`GWTP API request failed with status ${response.status}.`);

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

async function getGuide(guideId) {
  return apiRequest(`/api/learner/guides/${guideId}`);
}

async function startTrainingSession(guide) {
  if (!guide?.id || !guide?.steps?.length) {
    throw new Error("A valid guide with at least one step is required.");
  }

  const progress = await apiRequest(`/api/learner/progress/start/${guide.id}`, {
    method: "POST"
  });

  return { guide, progress };
}

async function restartTrainingSession(guide) {
  if (!guide?.id || !guide?.steps?.length) {
    throw new Error("A valid guide with at least one step is required.");
  }

  const progress = await apiRequest(`/api/learner/progress/restart/${guide.id}`, {
    method: "POST"
  });

  return { guide, progress };
}

async function getCurrentTrainingStep() {
  const progress = await apiRequest("/api/learner/progress/active");
  if (!progress?.active) return null;

  const guide = await getGuide(progress.guideId);
  const step = guide.steps?.[progress.stepIndex];
  if (!step) return null;

  return {
    guideId: progress.guideId,
    stepIndex: progress.stepIndex,
    totalSteps: progress.totalSteps,
    step
  };
}

async function moveTrainingStep(direction) {
  const current = await getCurrentTrainingStep();
  if (!current) throw new Error("No active training session.");

  const progress = await apiRequest("/api/learner/progress/move", {
    method: "POST",
    body: JSON.stringify({
      guideId: current.guideId,
      direction
    })
  });

  const guide = await getGuide(progress.guideId);
  const step = guide.steps?.[progress.stepIndex];
  if (!step) throw new Error("The requested guide step was not found.");

  return {
    guideId: progress.guideId,
    stepIndex: progress.stepIndex,
    totalSteps: progress.totalSteps,
    step
  };
}

async function completeTraining() {
  const current = await getCurrentTrainingStep();
  if (!current) throw new Error("No active training session.");

  await apiRequest(`/api/learner/progress/complete/${current.guideId}`, {
    method: "POST"
  });

  return { guideId: current.guideId, completed: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GWTP_VALIDATION_SESSION_GET") {
    const tabId = _sender?.tab?.id;
    if (!Number.isInteger(tabId)) {
      sendResponse({ success: false, message: "Validation session requires a browser tab context." });
      return;
    }

    const sessionKey = `gwtp:validation-session:${tabId}`;
    chrome.storage.session.get(sessionKey)
      .then((stored) => sendResponse({
        success: true,
        context: stored[sessionKey] || null
      }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_VALIDATION_STATE_GET_OR_CREATE") {
    const key = String(message.key || "");
    if (!key.startsWith("gwtp:validation-state:")) {
      sendResponse({ success: false, message: "Invalid validation state key." });
      return;
    }

    chrome.storage.session.get(key)
      .then(async (stored) => {
        if (Object.prototype.hasOwnProperty.call(stored, key)) {
          sendResponse({ success: true, state: stored[key] });
          return;
        }

        const state = {
          baseline: String(message.baseline ?? ""),
          satisfied: false
        };
        await chrome.storage.session.set({ [key]: state });
        sendResponse({ success: true, state });
      })
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_VALIDATION_STATE_SATISFY") {
    const key = String(message.key || "");
    if (!key.startsWith("gwtp:validation-state:")) {
      sendResponse({ success: false, message: "Invalid validation state key." });
      return;
    }

    chrome.storage.session.get(key)
      .then(async (stored) => {
        const current = stored[key];
        if (!current) {
          sendResponse({ success: false, message: "Validation state was not initialized." });
          return;
        }

        const state = { ...current, satisfied: true };
        await chrome.storage.session.set({ [key]: state });
        sendResponse({ success: true, state });
      })
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_START") {
    startTrainingSession(message.guide)
      .then((session) => sendResponse({ success: true, session }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_RESTART") {
    restartTrainingSession(message.guide)
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

  if (message?.type === "GWTP_TRAINING_COMPLETE") {
    completeTraining()
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true;
  }

  if (message?.type === "GWTP_TRAINING_STOP") {
    sendResponse({ success: true });
  }
});
