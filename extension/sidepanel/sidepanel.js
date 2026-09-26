const selectorInput = document.getElementById("selectorInput");
const screenNameInput = document.getElementById("screenNameInput");
const selectButton = document.getElementById("selectButton");
let elementPickerActive = false;
const addStepButton = document.getElementById("addStepButton");
const cancelStepButton = document.getElementById("cancelStepButton");
const topicSelect = document.getElementById("topicSelect");
const openCreateTopicButton = document.getElementById("openCreateTopicButton");
const createTopicEditor = document.getElementById("createTopicEditor");
const cancelCreateTopicButton = document.getElementById("cancelCreateTopicButton");
const newTopicInput = document.getElementById("newTopicInput");
const createTopicButton = document.getElementById("createTopicButton");
const topicStatus = document.getElementById("topicStatus");
const guideNameInput = document.getElementById("guideNameInput");
const guideStartInstructionInput = document.getElementById("guideStartInstructionInput");
const saveGuideButton = document.getElementById("saveGuideButton");
const saveGuideStatus = document.getElementById("saveGuideStatus");
const statusElement = document.getElementById("status");
const selectedElement = document.getElementById("selectedElement");
const instructionOnlyInput = document.getElementById("instructionOnlyInput");
const stepRuntimeSelect = document.getElementById("stepRuntimeSelect");
const selectedTag = document.getElementById("selectedTag");
const selectedSelector = document.getElementById("selectedSelector");
const selectedFrame = document.getElementById("selectedFrame");
const removeSelectedElementButton = document.getElementById("removeSelectedElementButton");
const stepEditor = document.getElementById("stepEditor");
const instructionInput = document.getElementById("instructionInput");
const richTextToolbarButtons = document.querySelectorAll("[data-rich-command]");
const validationTypeSelect = document.getElementById("validationTypeSelect");
const validationValueField = document.getElementById("validationValueField");
const validationValueLabel = document.getElementById("validationValueLabel");
const validationValueInput = document.getElementById("validationValueInput");
const validationErrorField = document.getElementById("validationErrorField");
const validationErrorInput = document.getElementById("validationErrorInput");

function sanitizeInstructionHtml(html) {
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
  return template.innerHTML.trim();
}

function clearInstructionInput() {
  instructionInput.replaceChildren();
}

function setInstructionHtml(html) {
  instructionInput.innerHTML = sanitizeInstructionHtml(html || "");
}

function getInstructionHtml() {
  return sanitizeInstructionHtml(instructionInput.innerHTML);
}

function hasInstructionContent() {
  return instructionInput.textContent.replace(/\u00a0/g, " ").trim().length > 0;
}
const saveStepButton = document.getElementById("saveStepButton");
const stepEditorTitle = document.querySelector("#stepEditor h2");
const stepsSection = document.getElementById("stepsSection");
const stepsList = document.getElementById("stepsList");
const stepsSaveStatus = document.getElementById("stepsSaveStatus");
let stepsSaveStatusTimer = null;
const learnModeView = document.getElementById("learnModeView");
const learnerTopicSelect = document.getElementById("learnerTopicSelect");
const learnerGuideSelect = document.getElementById("learnerGuideSelect");
const startLearningButton = document.getElementById("startLearningButton");
const restartLearningButton = document.getElementById("restartLearningButton");
const learnerStartInstructionPanel = document.getElementById("learnerStartInstructionPanel");
const learnerStartInstructionText = document.getElementById("learnerStartInstructionText");
const confirmStartInstructionButton = document.getElementById("confirmStartInstructionButton");
const cancelStartInstructionButton = document.getElementById("cancelStartInstructionButton");
const exitLearningButton = document.getElementById("exitLearningButton");
const learnerRecoveryPanel = document.getElementById("learnerRecoveryPanel");
const learnerRecoveryMessage = document.getElementById("learnerRecoveryMessage");
const retryLearningButton = document.getElementById("retryLearningButton");
const recoveryRestartLearningButton = document.getElementById("recoveryRestartLearningButton");
const recoveryExitLearningButton = document.getElementById("recoveryExitLearningButton");
let learnerSessionActive = false;
let learnerRecoveryCurrentStep = null;
const learnerStatus = document.getElementById("learnerStatus");
let learnerCatalog = [];
const createModeView = document.getElementById("createModeView");
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const usernameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const loginButton = document.getElementById("loginButton");
const loginStatus = document.getElementById("loginStatus");
const logoutButton = document.getElementById("logoutButton");
const currentUserIdentity = document.getElementById("currentUserIdentity");
const currentUserName = document.getElementById("currentUserName");
const currentUserRole = document.getElementById("currentUserRole");
const adminButton = document.getElementById("adminButton");
const adminView = document.getElementById("adminView");
const usersList = document.getElementById("usersList");
const adminUsersList = document.getElementById("adminUsersList");
const adminUsersSection = document.getElementById("adminUsersSection");
const regularUsersSection = document.getElementById("regularUsersSection");
const userRoleFilter = document.getElementById("userRoleFilter");
const usersStatus = document.getElementById("usersStatus");
const newDisplayName = document.getElementById("newDisplayName");
const newUsername = document.getElementById("newUsername");
const newPassword = document.getElementById("newPassword");
const newRole = document.getElementById("newRole");
const createUserButton = document.getElementById("createUserButton");
const createUserStatus = document.getElementById("createUserStatus");
const createUserCard = document.getElementById("createUserCard");
const openCreateUserButton = document.getElementById("openCreateUserButton");
const closeCreateUserButton = document.getElementById("closeCreateUserButton");
const editUserCard = document.getElementById("editUserCard");
const editUsername = document.getElementById("editUsername");
const editDisplayName = document.getElementById("editDisplayName");
const editRole = document.getElementById("editRole");
const editRoleSection = document.getElementById("editRoleSection");
const editNewPassword = document.getElementById("editNewPassword");
const editIsActive = document.getElementById("editIsActive");
const editActiveSection = document.getElementById("editActiveSection");
const saveUserButton = document.getElementById("saveUserButton");
const cancelEditUserButton = document.getElementById("cancelEditUserButton");
const editUserStatus = document.getElementById("editUserStatus");
const editUserDeleteSection = document.getElementById("editUserDeleteSection");
const resetUserLearningButton = document.getElementById("resetUserLearningButton");
const deleteEditedUserButton = document.getElementById("deleteEditedUserButton");
let editingUserSnapshot = null;
const topicsView = document.getElementById("topicsView");
const topicsList = document.getElementById("topicsList");
const openTopicsButton = document.getElementById("openTopicsButton");
const backFromTopicsButton = document.getElementById("backFromTopicsButton");
const editTopicEditor = document.getElementById("editTopicEditor");
const editTopicInput = document.getElementById("editTopicInput");
const saveTopicButton = document.getElementById("saveTopicButton");
const cancelEditTopicButton = document.getElementById("cancelEditTopicButton");
const editTopicStatus = document.getElementById("editTopicStatus");
const editTopicDeleteSection = document.getElementById("editTopicDeleteSection");
const deleteEditedTopicButton = document.getElementById("deleteEditedTopicButton");
let editingTopicSnapshot = null;
let editingTopicId = null;
const guideLibraryView = document.getElementById("guideLibraryView");
const guideEditorView = document.getElementById("guideEditorView");
const guidesList = document.getElementById("guidesList");
const guidesStatus = document.getElementById("guidesStatus");
const guideTopicFilter = document.getElementById("guideTopicFilter");
const guideAvailabilityFilter = document.getElementById("guideAvailabilityFilter");
const stepScreenFilterWrap = document.getElementById("stepScreenFilterWrap");
const stepScreenFilter = document.getElementById("stepScreenFilter");
const stepsFilterStatus = document.getElementById("stepsFilterStatus");
const openNewGuideButton = document.getElementById("openNewGuideButton");
const backToGuidesButton = document.getElementById("backToGuidesButton");
const guideAvailableInput = document.getElementById("guideAvailableInput");
const guideEditorTitle = document.getElementById("guideEditorTitle");
const guideEditorDescription = document.getElementById("guideEditorDescription");
const editGuideDeleteSection = document.getElementById("editGuideDeleteSection");
const previewGuideButton = document.getElementById("previewGuideButton");
const previewActiveControls = document.getElementById("previewActiveControls");
const previewProgress = document.getElementById("previewProgress");
const exitPreviewButton = document.getElementById("exitPreviewButton");
let previewSession = null;
let previewStarting = false;
let startInstructionCancelPending = null;
let previewRestorePromise = null;
let previewRestoreQueued = false;
let previewPendingDirection = null;
let learnerStepRenderPromise = null;
let learnerStepRenderQueuedCurrent = null;

function renderLearnerStepSerialized(current) {
  if (!current?.step) return Promise.resolve(false);

  if (learnerStepRenderPromise) {
    learnerStepRenderQueuedCurrent = current;
    return learnerStepRenderPromise;
  }

  learnerStepRenderPromise = (async () => {
    let nextCurrent = current;
    let result = false;

    do {
      learnerStepRenderQueuedCurrent = null;
      result = await window.guideRunner.showCurrentStep(nextCurrent);
      nextCurrent = learnerStepRenderQueuedCurrent;
    } while (nextCurrent);

    return result;
  })();

  return learnerStepRenderPromise.finally(() => {
    learnerStepRenderPromise = null;
    learnerStepRenderQueuedCurrent = null;
  });
}
const deleteEditedGuideButton = document.getElementById("deleteEditedGuideButton");
let editingGuideSnapshot = null;
const editStepDeleteSection = document.getElementById("editStepDeleteSection");
const deleteEditedStepButton = document.getElementById("deleteEditedStepButton");
let editingStepSnapshot = null;
const deleteConfirmOverlay = document.getElementById("deleteConfirmOverlay");
const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
const cancelDeleteButton = document.getElementById("cancelDeleteButton");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");
let pendingDeleteAction = null;
let deleteConfirmationReturnFocus = null;

let currentSelectedElement = null;
let currentWindowsTarget = null;
let activeStepId = null;
let adminModeActive = false;
let editingUserId = null;
let editingStepId = null;
let editingGuideId = null;

function setFieldInvalid(field, invalid, statusElement = null) {
  if (!field) return;
  if (invalid) {
    field.setAttribute("aria-invalid", "true");
    if (statusElement?.id) field.setAttribute("aria-describedby", statusElement.id);
  } else {
    field.removeAttribute("aria-invalid");
  }
}

function clearFieldInvalid(...fields) {
  fields.forEach((field) => setFieldInvalid(field, false));
}



function checkStepAvailability(current) {
  return window.guideRunner.canShowStep(current)
    .then((success) => ({
      success,
      message: success
        ? ""
        : window.i18nService.translate("stepTargetUnavailable", window.i18nService.getLanguage())
    }))
    .catch(() => ({
      success: false,
      message: window.i18nService.translate("stepTargetUnavailable", window.i18nService.getLanguage())
    }));
}

function updatePreviewUi() {
  const active = Boolean(previewSession);
  previewGuideButton.hidden = active;
  previewActiveControls.hidden = !active;
  guideEditorView.classList.toggle("preview-active", active);
  guideEditorView.setAttribute("aria-readonly", active ? "true" : "false");

  if (active) {
    const language = window.i18nService.getLanguage();
    previewProgress.textContent = window.i18nService
      .translate("previewActiveStatus", language)
      .replace("{current}", String(previewSession.stepIndex + 1))
      .replace("{total}", String(previewSession.steps.length));
  }
}

function buildPreviewGuide() {
  return {
    id: editingGuideId,
    name: guideNameInput.value.trim(),
    startInstruction: guideStartInstructionInput.value.trim(),
    steps: window.trainingService.getSteps().map((step) => ({
      ...step,
      frame: step.element?.frame || step.frame || null
    }))
  };
}

async function startGuidePreview() {
  const guide = buildPreviewGuide();
  const language = window.i18nService.getLanguage();

  if (!guide.startInstruction || guide.steps.length === 0) {
    saveGuideStatus.textContent = window.i18nService.translate("previewStartError", language);
    saveGuideStatus.dataset.type = "error";
    return;
  }

  previewGuideButton.disabled = true;
  previewStarting = true;
  try {
    if (!(await showStartInstruction(guide))) {
      return;
    }

    previewSession = { ...guide, stepIndex: 0 };
    previewPendingDirection = null;
    updatePreviewUi();
    await window.guideRunner.preview(guide);
  } catch (error) {
    previewSession = null;
    updatePreviewUi();
    saveGuideStatus.textContent = window.i18nService.translate("previewStartError", language);
    saveGuideStatus.dataset.type = "error";
    console.error(error);
  } finally {
    previewStarting = false;
    previewGuideButton.disabled = false;
  }
}

async function exitGuidePreview() {
  try {
    await window.windowsBridgeService.clearStep();
  } catch (error) {
    console.info("GWTP Windows preview cleanup skipped:", error);
  }

  if (previewStarting && startInstructionCancelPending) {
    startInstructionCancelPending();
  }
  previewStarting = false;
  previewGuideButton.disabled = false;

  try {
    await window.messagingService.sendToAllFrames(
      { type: "GWTP_CLEAR_TRAINING_STEP" },
      { restoreConnection: false }
    );
  } catch (error) {
    console.info("GWTP preview cleanup skipped:", error);
  }
  previewSession = null;
  updatePreviewUi();
}

function updateAuthenticatedView() {
  const role = window.authService.getCurrentRole();
  const isAdmin = role === "admin";
  const isEditor = role === "editor";
  const isLearner = role === "learner";

  const currentUser = window.authService.getCurrentUser();
  const language = window.i18nService.getLanguage();
  const roleLabel = window.i18nService.translate(`${role}Role`, language);
  currentUserName.textContent = currentUser?.displayName || currentUser?.username || "";
  currentUserRole.textContent = `${window.i18nService.translate("currentRoleLabel", language)}: ${roleLabel}`;

  adminButton.hidden = true;
  adminView.hidden = !isAdmin;
  createModeView.hidden = !isEditor;
  learnModeView.hidden = !isLearner;
}


async function loadLearnerCatalog() {
  if (window.authService.getCurrentRole() !== "learner") return;

  const language = window.i18nService.getLanguage();
  learnerCatalog = [];
  learnerSessionActive = false;
  learnerTopicSelect.replaceChildren();
  learnerGuideSelect.replaceChildren();
  learnerTopicSelect.disabled = false;
  learnerGuideSelect.disabled = true;
  startLearningButton.disabled = true;
  restartLearningButton.hidden = true;
  learnerStatus.textContent = window.i18nService.translate("loadingLearnerCatalog", language);
  learnerStatus.dataset.type = "info";

  const topicPlaceholder = document.createElement("option");
  topicPlaceholder.value = "";
  topicPlaceholder.textContent = window.i18nService.translate("learnerTopicPlaceholder", language);
  learnerTopicSelect.appendChild(topicPlaceholder);

  const guidePlaceholder = document.createElement("option");
  guidePlaceholder.value = "";
  guidePlaceholder.textContent = window.i18nService.translate("learnerGuidePlaceholder", language);
  learnerGuideSelect.appendChild(guidePlaceholder);

  try {
    learnerCatalog = await window.apiService.request("/api/learner/catalog");

    learnerCatalog.forEach((topic) => {
      const option = document.createElement("option");
      option.value = String(topic.id);
      option.textContent = topic.name;
      learnerTopicSelect.appendChild(option);
    });

    if (learnerCatalog.length === 1) {
      learnerTopicSelect.value = String(learnerCatalog[0].id);
      handleLearnerTopicChange();
      learnerGuideSelect.value = "";
      handleLearnerGuideChange();
    }

    learnerStatus.textContent = learnerCatalog.length === 0
      ? window.i18nService.translate("noPublishedGuides", language)
      : "";
    learnerStatus.dataset.type = learnerCatalog.length === 0 ? "info" : "";
  } catch (error) {
    learnerStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "learnerCatalogLoadError",
      language
    );
    learnerStatus.dataset.type = "error";
  }
}

function handleLearnerTopicChange() {
  const language = window.i18nService.getLanguage();
  const topicId = Number(learnerTopicSelect.value);
  const topic = learnerCatalog.find((item) => item.id === topicId);

  learnerGuideSelect.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = window.i18nService.translate("learnerGuidePlaceholder", language);
  learnerGuideSelect.appendChild(placeholder);

  if (!topic) {
    learnerGuideSelect.disabled = true;
    startLearningButton.disabled = true;
    return;
  }

  topic.guides.forEach((guide) => {
    const option = document.createElement("option");
    option.value = String(guide.id);
    const statusKey = guide.progressStatus === "Completed"
      ? "guideStatusCompleted"
      : null;
    option.textContent = statusKey
      ? `${guide.name} — ${window.i18nService.translate(statusKey, language)}`
      : guide.name;
    learnerGuideSelect.appendChild(option);
  });

  learnerGuideSelect.disabled = false;

  if (topic.guides.length === 1) {
    learnerGuideSelect.value = String(topic.guides[0].id);
    handleLearnerGuideChange();
  } else {
    startLearningButton.disabled = true;
  }
}

function handleLearnerGuideChange() {
  const guideId = Number(learnerGuideSelect.value);
  startLearningButton.disabled = !guideId;

  if (!guideId) {
    startLearningButton.textContent = window.i18nService.translate("startLearningButton", window.i18nService.getLanguage());
    restartLearningButton.hidden = true;
    exitLearningButton.hidden = true;
    return;
  }

  if (learnerSessionActive) {
    startLearningButton.hidden = true;
    restartLearningButton.hidden = true;
    exitLearningButton.hidden = false;
    learnerTopicSelect.disabled = true;
    learnerGuideSelect.disabled = true;
    return;
  }

  startLearningButton.hidden = false;
  exitLearningButton.hidden = true;
  learnerTopicSelect.disabled = false;
  learnerGuideSelect.disabled = false;

  const topicId = Number(learnerTopicSelect.value);
  const topic = learnerCatalog.find((item) => item.id === topicId);
  const guide = topic?.guides?.find((item) => item.id === guideId);
  const language = window.i18nService.getLanguage();
  const inProgress = guide?.progressStatus === "InProgress";
  startLearningButton.textContent = window.i18nService.translate(
    inProgress ? "continueLearningButton" : "startLearningButton",
    language
  );
  restartLearningButton.hidden = !inProgress;
}

function refreshSelectedLearnerGuideUi() {
  const selectedGuideId = Number(learnerGuideSelect.value);
  const selectedTopicId = Number(learnerTopicSelect.value);
  handleLearnerTopicChange();

  if (selectedGuideId) {
    learnerGuideSelect.value = String(selectedGuideId);
    handleLearnerGuideChange();
  } else if (selectedTopicId) {
    learnerTopicSelect.value = String(selectedTopicId);
  }
}

function hideLearnerRecovery() {
  learnerRecoveryPanel.hidden = true;
  learnerRecoveryMessage.textContent = "";
  learnerRecoveryCurrentStep = null;

  if (!learnerSessionActive) {
    startLearningButton.hidden = false;
    const guideId = Number(learnerGuideSelect.value);
    const topic = learnerCatalog.find((item) => item.id === Number(learnerTopicSelect.value));
    const guide = topic?.guides?.find((item) => item.id === guideId);
    restartLearningButton.hidden = guide?.progressStatus !== "InProgress";
  }
}

function showLearnerRecovery(current = null) {
  learnerRecoveryCurrentStep = current;
  const language = window.i18nService.getLanguage();
  const screenName = current?.step?.screenName?.trim();
  learnerRecoveryMessage.textContent = screenName
    ? window.i18nService.translate("resumeElementNotFoundWithScreen", language).replace("{screen}", screenName)
    : window.i18nService.translate("resumeElementNotFound", language);
  startLearningButton.hidden = true;
  restartLearningButton.hidden = true;
  exitLearningButton.hidden = true;
  learnerRecoveryPanel.hidden = false;
  learnerStatus.textContent = "";
  learnerStatus.removeAttribute("data-type");
}

async function handleRetryLearning() {
  const current = learnerRecoveryCurrentStep;
  if (!current) return;

  retryLearningButton.disabled = true;
  try {
    const result = await window.guideRunner.retryCurrentStep(current);
    if (!result?.success) return;

    learnerRecoveryPanel.hidden = true;
    learnerRecoveryMessage.textContent = "";
    learnerRecoveryCurrentStep = null;
    learnerSessionActive = true;
    handleLearnerGuideChange();
  } catch (error) {
    console.error("Could not retry learner step.", error);
  } finally {
    retryLearningButton.disabled = false;
  }
}

function showStartInstruction(guide) {
  const instruction = String(guide?.startInstruction || "").trim();
  if (!instruction) return Promise.reject(new Error("The guide start instruction is missing."));

  learnerStartInstructionText.textContent = instruction;
  learnerStartInstructionPanel.hidden = false;
  confirmStartInstructionButton.focus();

  return new Promise((resolve) => {
    const finish = (confirmed) => {
      learnerStartInstructionPanel.hidden = true;
      confirmStartInstructionButton.removeEventListener("click", confirm);
      cancelStartInstructionButton.removeEventListener("click", cancel);
      if (startInstructionCancelPending === cancel) {
        startInstructionCancelPending = null;
      }
      resolve(confirmed);
    };
    const confirm = () => finish(true);
    const cancel = () => finish(false);
    startInstructionCancelPending = cancel;
    confirmStartInstructionButton.addEventListener("click", confirm);
    cancelStartInstructionButton.addEventListener("click", cancel);
  });
}

async function handleRestartLearning() {
  hideLearnerRecovery();
  const guideId = Number(learnerGuideSelect.value);
  const language = window.i18nService.getLanguage();
  if (!guideId) return;

  restartLearningButton.disabled = true;
  startLearningButton.disabled = true;
  learnerStatus.textContent = window.i18nService.translate("startingGuide", language);
  learnerStatus.dataset.type = "info";

  try {
    const guide = await window.apiService.request(`/api/learner/guides/${guideId}`);
    if (!(await showStartInstruction(guide))) {
      learnerStatus.textContent = "";
      learnerStatus.removeAttribute("data-type");
      return;
    }
    await window.guideRunner.restart(guide);
    learnerSessionActive = true;

    const topic = learnerCatalog.find((item) => item.id === Number(learnerTopicSelect.value));
    const catalogGuide = topic?.guides?.find((item) => item.id === guideId);
    if (catalogGuide) {
      catalogGuide.progressStatus = "InProgress";
      refreshSelectedLearnerGuideUi();
    }

    learnerStatus.textContent = "";
    learnerStatus.removeAttribute("data-type");
  } catch (error) {
    console.error("Could not restart learner guide.", error);
    learnerStatus.textContent = window.i18nService.translate("guideStartError", language);
    learnerStatus.dataset.type = "error";
  } finally {
    startLearningButton.disabled = !learnerGuideSelect.value;
    restartLearningButton.disabled = false;
  }
}

async function handleStartLearning() {
  hideLearnerRecovery();
  const guideId = Number(learnerGuideSelect.value);
  const language = window.i18nService.getLanguage();

  if (!guideId) return;

  startLearningButton.disabled = true;
  learnerStatus.textContent = window.i18nService.translate("startingGuide", language);
  learnerStatus.dataset.type = "info";

  try {
    const guide = await window.apiService.request(`/api/learner/guides/${guideId}`);
    const topic = learnerCatalog.find((item) => item.id === Number(learnerTopicSelect.value));
    const catalogGuide = topic?.guides?.find((item) => item.id === guideId);
    const isInProgress = catalogGuide?.progressStatus === "InProgress";
    const isCompleted = catalogGuide?.progressStatus === "Completed";

    if (isInProgress) {
      const resumeResult = await window.guideRunner.resume(guide);
      if (!resumeResult?.success && resumeResult?.reason === "element-not-found") {
        showLearnerRecovery(resumeResult.current);
        return;
      }
      if (!resumeResult?.success) {
        throw new Error("Could not resume the saved guide step.");
      }
    } else if (isCompleted) {
      if (!(await showStartInstruction(guide))) {
      learnerStatus.textContent = "";
      learnerStatus.removeAttribute("data-type");
      return;
    }
      await window.guideRunner.restart(guide);
    } else {
      if (!(await showStartInstruction(guide))) {
      learnerStatus.textContent = "";
      learnerStatus.removeAttribute("data-type");
      return;
    }
      await window.guideRunner.start(guide);
    }
    learnerSessionActive = true;

    if (catalogGuide) {
      catalogGuide.progressStatus = "InProgress";
      refreshSelectedLearnerGuideUi();
    }

    learnerStatus.textContent = "";
    learnerStatus.removeAttribute("data-type");
  } catch (error) {
    console.error("Could not start learner guide.", error);
    learnerStatus.textContent = window.i18nService.translate("guideStartError", language);
    learnerStatus.dataset.type = "error";
  } finally {
    startLearningButton.disabled = !learnerGuideSelect.value;
  }
}

async function handleExitLearning() {
  try {
    await window.messagingService.sendToAllFrames(
      { type: "GWTP_CLEAR_TRAINING_STEP" },
      { restoreConnection: false }
    );
  } catch (error) {
    console.info("GWTP learner overlay cleanup skipped:", error);
  }

  await chrome.runtime.sendMessage({ type: "GWTP_TRAINING_STOP" });
  learnerSessionActive = false;

  learnerTopicSelect.disabled = false;
  learnerGuideSelect.disabled = !learnerTopicSelect.value;
  hideLearnerRecovery();
  handleLearnerGuideChange();
}

function openTopicEditor(topic) {
  closeTopicCreator();
  backFromTopicsButton.hidden = true;
  editingTopicId = topic.id;
  editingTopicSnapshot = topic;
  topicsList.querySelectorAll(".topic-card").forEach((card) => card.classList.toggle("entity-card--active", card.dataset.topicId === String(topic.id)));
  editTopicInput.value = topic.name;
  editTopicEditor.hidden = false;
  topicStatus.textContent = "";
  editTopicStatus.textContent = "";
  editTopicStatus.removeAttribute("data-type");
  editTopicInput.focus();
}

function closeTopicEditor() {
  editingTopicId = null;
  editingTopicSnapshot = null;
  topicsList.querySelectorAll(".entity-card--active").forEach((card) => card.classList.remove("entity-card--active"));
  editTopicInput.value = "";
  editTopicEditor.hidden = true;
  backFromTopicsButton.hidden = false;
  editTopicStatus.textContent = "";
  editTopicStatus.removeAttribute("data-type");
}

async function handleSaveTopic() {
  const language = window.i18nService.getLanguage();
  const name = editTopicInput.value.trim();

  editTopicStatus.textContent = "";
  editTopicStatus.removeAttribute("data-type");

  if (!editingTopicId || !name) {
    editTopicStatus.textContent = window.i18nService.translate("topicNameRequired", language);
    editTopicStatus.dataset.type = "error";
    editTopicInput.focus();
    return;
  }

  saveTopicButton.disabled = true;

  try {
    await window.apiService.request(`/api/topics/${editingTopicId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    await loadTopics();
    closeTopicEditor();
    topicStatus.textContent = window.i18nService.translate("topicUpdated", language);
    topicStatus.dataset.type = "success";
  } catch (error) {
    editTopicStatus.textContent = window.i18nService.translate(
      error?.status === 409 ? "topicExists" :
      error?.status === 401 ? "sessionExpired" :
      error?.status == null ? "serverUnavailable" :
      "topicUpdateError",
      language
    );
    editTopicStatus.dataset.type = "error";
  } finally {
    saveTopicButton.disabled = false;
  }
}

function handleDeleteTopic(topic) {
  const language = window.i18nService.getLanguage();
  const message = window.i18nService.translate("confirmDeleteTopic", language).replace("{name}", topic.name);
  requestDeleteConfirmation(message, async () => {
    try {
      await window.apiService.request(`/api/topics/${topic.id}`, { method: "DELETE" });

      if (editingTopicId === topic.id) {
        closeTopicEditor();
      }

      await loadTopics();
      topicStatus.textContent = window.i18nService.translate("topicDeleted", language);
      topicStatus.dataset.type = "success";
    } catch (error) {
      const errorMessage = window.i18nService.translate(
        error?.status === 409 ? "topicHasGuides" : error?.status == null ? "serverUnavailable" : "topicDeleteError",
        language
      );
      editTopicStatus.textContent = errorMessage;
      editTopicStatus.dataset.type = "error";
      closeDeleteConfirmation();
    }
  });
}

function requestDeleteConfirmation(message, action) {
  deleteConfirmMessage.textContent = message;
  pendingDeleteAction = action;
  deleteConfirmationReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  deleteConfirmOverlay.hidden = false;
  confirmDeleteButton.focus();
}

function closeDeleteConfirmation() {
  deleteConfirmOverlay.hidden = true;
  pendingDeleteAction = null;

  const returnFocus = deleteConfirmationReturnFocus;
  deleteConfirmationReturnFocus = null;
  if (returnFocus?.isConnected && !returnFocus.hidden) {
    returnFocus.focus();
  }
}

function handleDeleteConfirmationKeydown(event) {
  if (deleteConfirmOverlay.hidden) return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeDeleteConfirmation();
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = [...deleteConfirmOverlay.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.hidden);

  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function confirmPendingDelete() {
  if (!pendingDeleteAction) return;
  const action = pendingDeleteAction;
  confirmDeleteButton.disabled = true;

  try {
    await action();
    closeDeleteConfirmation();
  } finally {
    confirmDeleteButton.disabled = false;
  }
}

async function loadGuides() {
  if (window.authService.getCurrentRole() !== "editor") return;

  guidesList.replaceChildren();
  const language = window.i18nService.getLanguage();
  const selectedTopic = guideTopicFilter.value || "all";
  const selectedAvailability = guideAvailabilityFilter.value || "all";
  guidesStatus.textContent = window.i18nService.translate("loadingGuides", language);
  guidesStatus.dataset.type = "info";

  try {
    const guides = await window.apiService.request("/api/guides");

    const topicNames = [...new Set(guides.map((guide) => guide.topicName).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, language));

    guideTopicFilter.replaceChildren();
    const allTopicsOption = document.createElement("option");
    allTopicsOption.value = "all";
    allTopicsOption.textContent = window.i18nService.translate("filterAllTopics", language);
    guideTopicFilter.appendChild(allTopicsOption);
    topicNames.forEach((topicName) => {
      const option = document.createElement("option");
      option.value = topicName;
      option.textContent = topicName;
      guideTopicFilter.appendChild(option);
    });
    guideTopicFilter.value = topicNames.includes(selectedTopic) ? selectedTopic : "all";

    const activeTopic = guideTopicFilter.value;
    const filteredGuides = guides.filter((guide) => {
      const topicMatches = activeTopic === "all" || guide.topicName === activeTopic;
      const availabilityMatches =
        selectedAvailability === "all" ||
        (selectedAvailability === "available" && guide.isAvailable) ||
        (selectedAvailability === "unavailable" && !guide.isAvailable);
      return topicMatches && availabilityMatches;
    });

    filteredGuides.forEach((guide) => {
      const item = document.createElement("div");
      item.className = "guide-item";

      const name = document.createElement("strong");
      name.textContent = guide.name;

      const meta = document.createElement("div");
      meta.className = "guide-item__meta";

      const topicMeta = document.createElement("span");
      topicMeta.className = "guide-item__meta-row";
      topicMeta.textContent = `${window.i18nService.translate("guideTopicMetaLabel", language)}: ${guide.topicName}`;

      const stepsMeta = document.createElement("span");
      stepsMeta.className = "guide-item__meta-row";
      stepsMeta.textContent = `${window.i18nService.translate("guideStepsMetaLabel", language)}: ${guide.stepCount}`;

      const availabilityMeta = document.createElement("span");
      availabilityMeta.className = "guide-item__meta-row";
      availabilityMeta.textContent = `${window.i18nService.translate("guideAvailabilityMetaLabel", language)}: ${window.i18nService.translate(
        guide.isAvailable ? "guideAvailabilityYes" : "guideAvailabilityNo",
        language
      )}`;

      meta.append(topicMeta, stepsMeta, availabilityMeta);

      item.dataset.guideId = String(guide.id);
      item.classList.add("entity-card--clickable");
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.addEventListener("click", () => openExistingGuide(guide.id));
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openExistingGuide(guide.id);
        }
      });

      item.append(name, meta);
      guidesList.appendChild(item);
    });

    if (guides.length === 0) {
      guidesStatus.textContent = window.i18nService.translate("noGuides", language);
    } else if (filteredGuides.length === 0) {
      guidesStatus.textContent = window.i18nService.translate("noGuidesForFilter", language);
    } else {
      guidesStatus.textContent = "";
      guidesStatus.removeAttribute("data-type");
    }
  } catch (error) {
    guidesStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "guidesLoadError",
      language
    );
    guidesStatus.dataset.type = "error";
  }
}

async function handleDeleteGuide(guideId) {
  const language = window.i18nService.getLanguage();
  try {
    await window.apiService.request(`/api/guides/${guideId}`, { method: "DELETE" });
    await loadGuides();
    guidesStatus.textContent = window.i18nService.translate("guideDeleted", language);
    guidesStatus.dataset.type = "success";
  } catch (error) {
    guidesStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "guideDeleteError",
      language
    );
    guidesStatus.dataset.type = "error";
    closeDeleteConfirmation();
  }
}

async function openExistingGuide(guideId) {
  const language = window.i18nService.getLanguage();
  guidesStatus.textContent = window.i18nService.translate("loadingGuide", language);
  guidesStatus.dataset.type = "info";

  try {
    const guide = await window.apiService.request(`/api/guides/${guideId}`);

    editingGuideId = guide.id;
    editingGuideSnapshot = guide;
    saveGuideButton.textContent = window.i18nService.translate("updateGuideButton", language);
    guideEditorTitle.textContent = window.i18nService.translate("guideEditorTitle", language);
    guideEditorDescription.textContent = window.i18nService.translate("guideEditorDescription", language);
    editGuideDeleteSection.hidden = false;
    guideAvailableInput.checked = Boolean(guide.isAvailable);
    topicSelect.value = String(guide.topicId);
    guideNameInput.value = guide.name;
    guideStartInstructionInput.value = guide.startInstruction || "";
    window.trainingService.replaceSteps(guide.steps || []);
    activeStepId = null;
    editingStepId = null;

    renderSteps();
    updateGuideEditorValidity();
    guidesStatus.textContent = "";
    guideLibraryView.hidden = true;
    guideEditorView.hidden = false;
  } catch (error) {
    guidesStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "guideLoadError",
      language
    );
    guidesStatus.dataset.type = "error";
  }
}

function openTopics() {
  guideLibraryView.hidden = true;
  guideEditorView.hidden = true;
  topicsView.hidden = false;
  topicStatus.textContent = "";
  topicStatus.removeAttribute("data-type");
  loadTopics();
}

function closeTopics() {
  closeTopicCreator();
  topicsView.hidden = true;
  guideLibraryView.hidden = false;
  loadGuides();
}

function openNewGuide() {
  const language = window.i18nService.getLanguage();
  editingGuideId = null;
  editingGuideSnapshot = null;
  saveGuideButton.textContent = window.i18nService.translate("saveGuideButton", language);
  guideEditorTitle.textContent = window.i18nService.translate("newGuideEditorTitle", language);
  guideEditorDescription.textContent = window.i18nService.translate("newGuideEditorDescription", language);
  editGuideDeleteSection.hidden = true;
  guideAvailableInput.checked = false;
  topicsView.hidden = true;
  topicSelect.value = "";
  guideNameInput.value = "";
  guideStartInstructionInput.value = window.i18nService.translate("guideStartInstructionDefault", language);
  window.trainingService.clearSteps();
  activeStepId = null;
  editingStepId = null;
  renderSteps();
  updateGuideEditorValidity();
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  guideLibraryView.hidden = true;
  guideEditorView.hidden = false;
}

function showGuideLibrary() {
  exitGuidePreview();
  closeStepCreator();
  topicsView.hidden = true;
  guideEditorView.hidden = true;
  guideLibraryView.hidden = false;
  loadGuides();
}

function openCreateUser() {
  closeUserEditor();
  createUserStatus.textContent = "";
  createUserCard.hidden = false;
  newDisplayName.focus();
}

function closeCreateUser() {
  createUserCard.hidden = true;
  createUserStatus.textContent = "";
}

async function handleCreateUser() {
  const username = newUsername.value.trim();
  const displayName = newDisplayName.value.trim();
  const password = newPassword.value;
  const role = newRole.value;
  const language = window.i18nService.getLanguage();

  clearFieldInvalid(newDisplayName, newUsername, newPassword, newRole);
  if (!displayName || !username || !password) {
    setFieldInvalid(newDisplayName, !displayName, createUserStatus);
    setFieldInvalid(newUsername, !username, createUserStatus);
    setFieldInvalid(newPassword, !password, createUserStatus);
    createUserStatus.textContent = window.i18nService.translate("createUserRequired", language);
    createUserStatus.dataset.type = "error";
    return;
  }

  if (username.length < 5 || username.length > 30) {
    setFieldInvalid(newUsername, true, createUserStatus);
    createUserStatus.textContent = window.i18nService.translate("usernameLengthInvalid", language);
    createUserStatus.dataset.type = "error";
    newUsername.focus();
    return;
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    setFieldInvalid(newUsername, true, createUserStatus);
    createUserStatus.textContent = window.i18nService.translate("usernameInvalidCharacters", language);
    createUserStatus.dataset.type = "error";
    newUsername.focus();
    return;
  }

  if (password.length < 6 || password.length > 20 || /\s/.test(password)) {
    setFieldInvalid(newPassword, true, createUserStatus);
    createUserStatus.textContent = window.i18nService.translate("passwordRequirementsInvalid", language);
    createUserStatus.dataset.type = "error";
    newPassword.focus();
    return;
  }

  createUserButton.disabled = true;
  createUserStatus.textContent = "";

  try {
    await window.apiService.request("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.toLowerCase(), displayName, password, role })
    });

    newDisplayName.value = "";
    newUsername.value = "";
    newPassword.value = "";
    newRole.value = "editor";
    createUserStatus.textContent = window.i18nService.translate("userCreated", language);
    createUserStatus.dataset.type = "success";
    await loadAdminUsers();
    closeCreateUser();
  } catch (error) {
    const key =
      error?.status === 409
        ? "usernameExists"
        : error?.status == null
          ? "serverUnavailable"
          : "createUserError";

    createUserStatus.textContent = window.i18nService.translate(key, language);
    createUserStatus.dataset.type = "error";
  } finally {
    createUserButton.disabled = false;
  }
}

function openUserEditor(user) {
  closeCreateUser();
  editingUserId = user.id;
  editingUserSnapshot = user;
  usersList.querySelectorAll(".user-item").forEach((card) => {
    card.classList.toggle("user-item--active", card.dataset.userId === String(user.id));
  });
  editUsername.textContent = user.username;
  editDisplayName.value = user.displayName || "";
  const isAdminUser = user.roles?.includes("admin");
  editRole.value = isAdminUser ? "editor" : (user.roles?.[0] || "learner");
  editRoleSection.hidden = isAdminUser;
  editNewPassword.value = "";
  editIsActive.checked = user.isActive;
  editActiveSection.hidden = isAdminUser;
  editUserDeleteSection.hidden = isAdminUser;
  editUserStatus.textContent = "";
  editUserCard.hidden = false;
  editUserCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeUserEditor() {
  editingUserId = null;
  editingUserSnapshot = null;
  usersList.querySelectorAll(".user-item--active").forEach((card) => card.classList.remove("user-item--active"));
  editUserCard.hidden = true;
  editNewPassword.value = "";
  editUserStatus.textContent = "";
}

function clearEditUserFeedback() {
  clearFieldInvalid(editDisplayName, editNewPassword, editRole);
  editUserStatus.textContent = "";
  editUserStatus.removeAttribute("data-type");
}

async function handleSaveUser() {
  if (editingUserId == null) return;

  const language = window.i18nService.getLanguage();
  const displayName = editDisplayName.value.trim();
  const newUserPassword = editNewPassword.value;

  clearFieldInvalid(editDisplayName, editNewPassword, editRole);
  if (newUserPassword && (newUserPassword.length < 6 || newUserPassword.length > 20 || /\s/.test(newUserPassword))) {
    setFieldInvalid(editNewPassword, true, editUserStatus);
    editUserStatus.textContent = window.i18nService.translate("passwordRequirementsInvalid", language);
    editUserStatus.dataset.type = "error";
    editNewPassword.focus();
    return;
  }


  if (!displayName) {
    setFieldInvalid(editDisplayName, true, editUserStatus);
    editUserStatus.textContent = window.i18nService.translate("editUserDisplayNameRequired", language);
    editUserStatus.dataset.type = "error";
    editDisplayName.focus();
    return;
  }

  saveUserButton.disabled = true;

  try {
    const updatedUser = await window.apiService.request(`/api/users/${editingUserId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName,
        role: editRole.value,
        isActive: editIsActive.checked,
        newPassword: editNewPassword.value
      })
    });

    if (editingUserId === window.authService.getCurrentUser()?.id) {
      await window.authService.updateCurrentUser(updatedUser);
      updateAuthenticatedView();
    }

    await loadAdminUsers();
    closeUserEditor();
  } catch (error) {
    editUserStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "updateUserError",
      language
    );
    editUserStatus.dataset.type = "error";
  } finally {
    saveUserButton.disabled = false;
  }
}

let adminUsersLoadGeneration = 0;

async function loadAdminUsers() {
  if (window.authService.getCurrentRole() !== "admin") return;

  const loadGeneration = ++adminUsersLoadGeneration;

  const language = window.i18nService.getLanguage();
  usersStatus.textContent = window.i18nService.translate("loadingUsers", language);
  usersStatus.dataset.type = "info";
  usersList.replaceChildren();
  adminUsersList.replaceChildren();

  try {
    const users = await window.apiService.request("/api/users");

    // A role-filter change can start another load while the initial login load
    // is still awaiting the API. Only the newest request may render results.
    if (loadGeneration !== adminUsersLoadGeneration) return;

    usersList.replaceChildren();
    adminUsersList.replaceChildren();

    const selectedRole = userRoleFilter.value || "all";
    const adminUsers = users.filter((user) => Array.isArray(user.roles) && user.roles.includes("admin"));
    const regularUsers = users.filter((user) => {
      const roles = Array.isArray(user.roles) ? user.roles : [];
      if (roles.includes("admin")) return false;
      return selectedRole === "all" || roles.includes(selectedRole);
    });

    const renderUser = (user, targetList) => {
      const item = document.createElement("div");
      item.className = "user-item";
      item.dataset.userId = String(user.id);
      if (user.id === editingUserId) item.classList.add("user-item--active");
      const isAdminUser = Array.isArray(user.roles) && user.roles.includes("admin");

      const identity = document.createElement("div");
      identity.className = "user-item__identity";
      const name = document.createElement("strong");
      name.textContent = user.displayName || user.username;
      identity.append(name);

      if (user.displayName) {
        const username = document.createElement("span");
        username.textContent = user.username;
        identity.append(username);
      }

      const meta = document.createElement("div");
      meta.className = "user-item__meta";

      const role = document.createElement("span");
      role.textContent = Array.isArray(user.roles) && user.roles.length
        ? user.roles.map((userRole) => window.i18nService.translate(`${userRole}Role`, language)).join(", ")
        : "—";

      const state = document.createElement("span");
      state.textContent = window.i18nService.translate(user.isActive ? "userActive" : "userInactive", language);
      meta.append(role, state);

      if (!isAdminUser || user.id === window.authService.getCurrentUser()?.id) {
        item.classList.add("user-item--clickable");
        item.setAttribute("role", "button");
        item.tabIndex = 0;
        item.addEventListener("click", () => openUserEditor(user));
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openUserEditor(user);
          }
        });
      }

      item.append(identity, meta);
      targetList.appendChild(item);
    };

    adminUsers.forEach((user) => renderUser(user, adminUsersList));
    regularUsers.forEach((user) => renderUser(user, usersList));

    adminUsersSection.hidden = adminUsers.length === 0;
    regularUsersSection.hidden = regularUsers.length === 0;

    if (users.length === 0) {
      usersStatus.textContent = window.i18nService.translate("noUsers", language);
    } else if (regularUsers.length === 0 && selectedRole !== "all") {
      usersStatus.textContent = window.i18nService.translate("noUsersForFilter", language);
    } else {
      usersStatus.textContent = "";
    }
  } catch (error) {
    usersStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "usersLoadError",
      language
    );
    usersStatus.dataset.type = "error";
  }
}

async function handleDeleteUser(userId) {
  const language = window.i18nService.getLanguage();
  try {
    await window.apiService.request(`/api/users/${userId}`, { method: "DELETE" });
    await loadAdminUsers();
    usersStatus.textContent = window.i18nService.translate("userDeleted", language);
    usersStatus.dataset.type = "success";
  } catch (error) {
    usersStatus.textContent = window.i18nService.translate(
      error?.status === 409 ? "adminDeleteBlocked" : error?.status == null ? "serverUnavailable" : "userDeleteError",
      language
    );
    usersStatus.dataset.type = "error";
    closeDeleteConfirmation();
  }
}

async function loadTopics() {
  if (window.authService.getCurrentRole() !== "editor") return;

  const language = window.i18nService.getLanguage();
  topicSelect.replaceChildren();
  topicsList.replaceChildren();

  try {
    const topics = await window.apiService.request("/api/topics");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = window.i18nService.translate("selectTopicPlaceholder", language);
    topicSelect.appendChild(placeholder);

    topics.forEach((topic) => {
      const option = document.createElement("option");
      option.value = String(topic.id);
      option.textContent = topic.name;
      topicSelect.appendChild(option);

      const card = document.createElement("div");
      card.className = "topic-card";

      const name = document.createElement("strong");
      name.className = "topic-card__name";
      name.textContent = topic.name;

      card.dataset.topicId = String(topic.id);
      card.classList.add("entity-card--clickable");
      if (topic.id === editingTopicId) card.classList.add("entity-card--active");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.addEventListener("click", () => openTopicEditor(topic));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openTopicEditor(topic);
        }
      });

      card.append(name);
      topicsList.appendChild(card);
    });

    if (topics.length === 0) {
      const empty = document.createElement("p");
      empty.className = "description";
      empty.textContent = window.i18nService.translate("noTopics", language);
      topicsList.appendChild(empty);
    }
  } catch (error) {
    topicStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "topicsLoadError",
      language
    );
    topicStatus.dataset.type = "error";
  }
}

function openTopicCreator() {
  closeTopicEditor();
  backFromTopicsButton.hidden = true;
  topicStatus.textContent = "";
  topicStatus.removeAttribute("data-type");
  createTopicEditor.hidden = false;
  openCreateTopicButton.hidden = true;
  newTopicInput.focus();
}

function closeTopicCreator() {
  newTopicInput.value = "";
  createTopicEditor.hidden = true;
  openCreateTopicButton.hidden = false;
  backFromTopicsButton.hidden = false;
}

async function handleCreateTopic() {
  const name = newTopicInput.value.trim();
  const language = window.i18nService.getLanguage();

  if (!name) {
    topicStatus.textContent = window.i18nService.translate("topicNameRequired", language);
    topicStatus.dataset.type = "error";
    newTopicInput.focus();
    return;
  }

  createTopicButton.disabled = true;
  topicStatus.textContent = "";

  try {
    const topic = await window.apiService.request("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    await loadTopics();
    closeTopicCreator();
    topicStatus.textContent = window.i18nService.translate("topicCreated", language);
    topicStatus.dataset.type = "success";
  } catch (error) {
    const key = error?.status === 409
      ? "topicExists"
      : error?.status == null
        ? "serverUnavailable"
        : "topicCreateError";
    topicStatus.textContent = window.i18nService.translate(key, language);
    topicStatus.dataset.type = "error";
  } finally {
    createTopicButton.disabled = false;
  }
}

function hasGuideDefinitionChanges() {
  if (!editingGuideId || !editingGuideSnapshot) return true;

  return (
    Number(topicSelect.value) !== Number(editingGuideSnapshot.topicId) ||
    guideNameInput.value.trim() !== String(editingGuideSnapshot.name || "").trim() ||
    guideStartInstructionInput.value.trim() !== String(editingGuideSnapshot.startInstruction || "").trim() ||
    guideAvailableInput.checked !== Boolean(editingGuideSnapshot.isAvailable)
  );
}

function updateGuideEditorValidity() {
  const hasTopic = Boolean(topicSelect.value);
  const hasGuideName = Boolean(guideNameInput.value.trim());
  const hasStartInstruction = Boolean(guideStartInstructionInput.value.trim());
  const guideIdentityValid = hasTopic && hasGuideName && hasStartInstruction;
  const steps = window.trainingService.getSteps();
  const language = window.i18nService.getLanguage();

  // Clear the stale availability error once the guide has at least one step.
  if (
    steps.length > 0 &&
    saveGuideStatus.textContent === window.i18nService.translate("availableGuideRequiresStep", language)
  ) {
    saveGuideStatus.textContent = "";
    saveGuideStatus.removeAttribute("data-type");
  }

  addStepButton.disabled = !guideIdentityValid;

  // Existing guides only enable "Update guide" when guide-level settings changed.
  // Step operations are persisted independently and must not mark the guide settings dirty.
  saveGuideButton.disabled = Boolean(editingGuideId) && !hasGuideDefinitionChanges();

  return guideIdentityValid;
}

function renderSelectedFrame(element) {
  const language = window.i18nService.getLanguage();
  const frame = element?.frame || null;
  const label = window.i18nService.translate("selectedFrameLabel", language);

  if (!frame || frame.isTop) {
    selectedFrame.textContent = `${label}: ${window.i18nService.translate("selectedFrameTop", language)}`;
    return;
  }

  const frameName = frame.name || frame.elementName || frame.elementId || frame.elementTitle || "Frame";
  selectedFrame.textContent = `${label}: ${frameName}`;
}

function escapeRegexValue(value) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, (match) => "\\" + match);
}

function updateValidationBuilder() {
  const language = window.i18nService.getLanguage();
  const type = validationTypeSelect.value;
  const needsValue = type === "equals" || type === "not_equals" || type === "contains" || type === "changed_regex";
  const enabled = type !== "none";
  validationValueField.hidden = !needsValue;
  validationErrorField.hidden = !enabled;
  validationValueLabel.textContent = window.i18nService.translate(type === "changed_regex" ? "validationPatternLabel" : "validationValueLabel", language);
}

function resetValidationBuilder() {
  validationTypeSelect.value = "none";
  validationValueInput.value = "";
  validationErrorInput.value = "";
  updateValidationBuilder();
}

function loadValidationBuilder(validation) {
  if (!validation?.expression) { resetValidationBuilder(); return; }
  const supportedType = ["required", "changed", "equals", "not_equals", "contains", "changed_regex"].includes(validation.builderType)
    ? validation.builderType
    : "none";
  validationTypeSelect.value = supportedType;
  validationValueInput.value = supportedType === "none" ? "" : (validation.builderValue || validation.expression);
  validationErrorInput.value = validation.errorMessage || "";
  updateValidationBuilder();
}

function buildStepValidation() {
  const type = validationTypeSelect.value;
  if (type === "none") return null;
  const language = window.i18nService.getLanguage();
  const value = validationValueInput.value;
  const errorMessage = validationErrorInput.value.trim();
  if (!errorMessage) throw new Error(window.i18nService.translate("validationErrorRequired", language));
  let expression = "";
  if (type === "required") {
    expression = "^(?=.*\\S).+$";
  } else if (type === "changed") {
    expression = "__changed__";
  } else {
    if (!value) throw new Error(window.i18nService.translate("validationValueRequired", language));
    if (type === "changed_regex") {
      try { new RegExp(value); } catch { throw new Error(window.i18nService.translate("validationPatternInvalid", language)); }
      expression = value;
    }
    if (type === "equals") expression = "^" + escapeRegexValue(value) + "$";
    if (type === "not_equals") expression = "^(?!" + escapeRegexValue(value) + "$).+$";
    if (type === "contains") expression = ".*" + escapeRegexValue(value) + ".*";
  }
  return { engine: type === "changed" ? "changed" : (type === "changed_regex" ? "changed_regex" : "regex"), expression, errorMessage, builderType: type, builderValue: (type === "required" || type === "changed") ? "" : value };
}
function updateStepSaveValidity() {
  const validationType = validationTypeSelect.value;
  const validationNeedsValue = validationType === "equals" || validationType === "not_equals" || validationType === "contains" || validationType === "changed_regex";
  const validationComplete =
    validationType === "none" ||
    (Boolean(validationErrorInput.value.trim()) && (!validationNeedsValue || Boolean(validationValueInput.value)));

  const instructionOnly = instructionOnlyInput.checked;
  const runtime = stepRuntimeSelect.value === "windows" ? "windows" : "web";
  const targetMissing = !instructionOnly && (
    runtime === "windows"
      ? !currentWindowsTarget
      : (!currentSelectedElement || !selectorInput.value.trim())
  );
  saveStepButton.disabled =
    targetMissing ||
    !hasInstructionContent() ||
    (!instructionOnly && !validationComplete);
}

async function validateSelectedStepElement() {
  if (stepRuntimeSelect.value === "windows") return Boolean(currentWindowsTarget);
  if (!currentSelectedElement || !selectorInput.value.trim()) return false;

  const message = {
    type: "GWTP_VALIDATE_ELEMENT",
    selector: selectorInput.value.trim()
  };
  const stepFrame = currentSelectedElement.frame || null;

  try {
    if (stepFrame) {
      const response = await window.messagingService.sendToMatchingFrame(
        message,
        (frameInfo) => frameMatchesStep(frameInfo, stepFrame)
      );
      return response?.success === true;
    }

    const responses = await window.messagingService.sendToAllFrames(message);
    return responses.some((item) => item.response?.success === true);
  } catch {
    return false;
  }
}

function clearPageTrainingVisuals() {
  window.messagingService.sendToAllFrames({ type: "GWTP_CLEAR_HIGHLIGHT" }).catch((error) => {
    console.debug("Could not clear page training visuals.", error);
  });
  activeStepId = null;
  markActiveStep(null);
}

function frameMatchesStep(frameInfo, stepFrame) {
  if (!stepFrame) return frameInfo?.isTop === true;
  if (stepFrame.isTop) return frameInfo?.isTop === true;
  if (frameInfo?.isTop) return false;

  if (stepFrame.url && frameInfo?.href === stepFrame.url) return true;
  if (stepFrame.name && frameInfo?.name === stepFrame.name) return true;

  return false;
}

async function highlightEditorStep(step) {
  // Card selection is editor state and does not depend on whether the target element exists on the current URL.
  markActiveStep(step.id);

  if (step.targetType === "none" || step.runtime === "windows") {
    await window.messagingService.sendToAllFrames({ type: "GWTP_CLEAR_HIGHLIGHT" }).catch(() => {});
    elementPickerStatus.textContent = "";
    delete elementPickerStatus.dataset.type;
    return;
  }

  const stepFrame = step.element?.frame || null;

  await window.messagingService.sendToAllFrames({ type: "GWTP_CLEAR_HIGHLIGHT" }).catch(() => {});

  let matched = false;

  if (stepFrame) {
    const response = await window.messagingService.sendToMatchingFrame(
      {
        type: "GWTP_HIGHLIGHT_ELEMENT",
        selector: step.selector
      },
      (frameInfo) => frameMatchesStep(frameInfo, stepFrame)
    );
    matched = response?.success === true;
  }

  // Frame metadata is a routing hint, not a hard requirement. Older persisted
  // steps may not contain the current frame metadata shape, and a page can
  // legitimately recreate or rename frames. If the preferred frame did not
  // resolve the selector, search every accessible frame before reporting that
  // the element is missing.
  if (!matched) {
    const responses = await window.messagingService.sendToAllFrames({
      type: "GWTP_HIGHLIGHT_ELEMENT",
      selector: step.selector
    });
    matched = responses.some((item) => item.response?.success);
  }

  if (matched) {
    elementPickerStatus.textContent = "";
    delete elementPickerStatus.dataset.type;
    return;
  }

  const language = window.i18nService.getLanguage();
  elementPickerStatus.textContent = window.i18nService.translate("selectedElementNotFound", language);
  elementPickerStatus.dataset.type = "error";
}

function closeStepCreator() {
  if (elementPickerActive) cancelElementPicker(false);
  else setElementPickerActive(false);
  clearPageTrainingVisuals();
  editingStepId = null;
  editingStepSnapshot = null;
  renderSteps();
  saveStepButton.textContent = window.i18nService.translate("saveStepButton", window.i18nService.getLanguage());
  editStepDeleteSection.hidden = true;
  currentSelectedElement = null;
  currentWindowsTarget = null;
  selectorInput.value = "";
  stepRuntimeSelect.value = "web";
  instructionOnlyInput.checked = false;
  screenNameInput.value = "";
  clearInstructionInput();
  resetValidationBuilder();
  selectedElement.hidden = true;
  stepEditor.hidden = true;
  selectButton.hidden = true;
  addStepButton.hidden = false;
  statusElement.textContent = "";
  statusElement.removeAttribute("data-type");
}

function openStepCreator() {
  if (!updateGuideEditorValidity()) return;
  setElementPickerActive(false);

  editingStepId = null;
  editingStepSnapshot = null;
  stepEditorTitle.textContent = window.i18nService.translate("stepEditorTitle", window.i18nService.getLanguage());
  saveStepButton.textContent = window.i18nService.translate("saveStepButton", window.i18nService.getLanguage());
  editStepDeleteSection.hidden = true;
  currentSelectedElement = null;
  currentWindowsTarget = null;
  selectorInput.value = "";
  stepRuntimeSelect.value = "web";
  instructionOnlyInput.checked = false;
  selectButton.disabled = false;
  validationTypeSelect.disabled = false;
  const existingSteps = window.trainingService.getSteps();
  screenNameInput.value = existingSteps.length
    ? (existingSteps[existingSteps.length - 1].screenName || "")
    : "";
  clearInstructionInput();
  resetValidationBuilder();
  selectedElement.hidden = true;
  stepEditor.hidden = false;
  selectButton.hidden = false;
  addStepButton.hidden = true;
  statusElement.textContent = "";
  statusElement.removeAttribute("data-type");
  updateStepSaveValidity();
}

function openStepEditor(step) {
  if (!updateGuideEditorValidity()) return;
  if (elementPickerActive) cancelElementPicker(false);
  else setElementPickerActive(false);

  editingStepId = step.id;
  editingStepSnapshot = step;
  const language = window.i18nService.getLanguage();
  const stepLabel = window.i18nService.translate("stepLabel", language).replace("{number}", step.order);
  stepEditorTitle.textContent = `${window.i18nService.translate("editStepEditorTitle", language)} — ${stepLabel}`;
  renderSteps();
  saveStepButton.textContent = window.i18nService.translate("updateStepButton", window.i18nService.getLanguage());
  editStepDeleteSection.hidden = false;
  const instructionOnly = step.targetType === "none";
  const runtime = step.runtime === "windows" ? "windows" : "web";
  stepRuntimeSelect.value = runtime;
  instructionOnlyInput.checked = instructionOnly;
  currentWindowsTarget = instructionOnly || runtime !== "windows" ? null : (step.windowsTarget || null);
  currentSelectedElement = instructionOnly || runtime === "windows" ? null : (step.element || {
    tagName: "",
    text: ""
  });
  selectorInput.value = instructionOnly || runtime === "windows" ? "" : step.selector;
  selectButton.disabled = instructionOnly;
  selectButton.hidden = instructionOnly;
  validationTypeSelect.disabled = instructionOnly;
  screenNameInput.value = step.screenName || "";
  setInstructionHtml(step.instruction);
  loadValidationBuilder(step.validation);
  if (runtime === "windows" && currentWindowsTarget) {
    selectedTag.textContent = currentWindowsTarget.element?.name || currentWindowsTarget.element?.automationId || currentWindowsTarget.element?.controlType || "";
    selectedSelector.textContent = `${currentWindowsTarget.processName} · ${currentWindowsTarget.element?.controlType || ""}`;
    selectedFrame.textContent = currentWindowsTarget.window?.name || currentWindowsTarget.window?.automationId || "";
  } else {
    selectedTag.textContent = step.element?.tagName ? `<${step.element.tagName}>${step.element.text ? ` — ${step.element.text}` : ""}` : "";
    selectedSelector.textContent = step.selector;
    if (!instructionOnly) renderSelectedFrame(currentSelectedElement);
  }
  selectedElement.hidden = instructionOnly;
  stepEditor.hidden = false;
  addStepButton.hidden = true;
  statusElement.textContent = "";
  statusElement.removeAttribute("data-type");
  updateStepSaveValidity();
  instructionInput.focus();
}

async function deleteDraftStep(stepId) {
  window.trainingService.deleteStep(stepId);
  if (activeStepId === stepId) activeStepId = null;
  renderSteps();
  updateGuideEditorValidity();

  if (editingGuideId && !(await persistStepChanges())) return;

  if (editingStepId === stepId) closeStepCreator();
}

function setStepsSaveStatus(key = "", type = "info", autoClear = false) {
  clearTimeout(stepsSaveStatusTimer);

  if (!key) {
    stepsSaveStatus.textContent = "";
    stepsSaveStatus.removeAttribute("data-type");
    return;
  }

  stepsSaveStatus.textContent = window.i18nService.translate(key, window.i18nService.getLanguage());
  stepsSaveStatus.dataset.type = type;

  if (autoClear) {
    stepsSaveStatusTimer = setTimeout(() => {
      stepsSaveStatus.textContent = "";
      stepsSaveStatus.removeAttribute("data-type");
    }, 2500);
  }
}

async function persistStepChanges() {
  if (!editingGuideId) return true;

  setStepsSaveStatus("stepsSaving", "info");

  try {
    const steps = window.trainingService.getSteps();
    await window.apiService.request(`/api/guides/${editingGuideId}/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        steps.map((step) => ({
          id: step.persistedId || null,
          selector: step.selector,
          targetType: step.targetType || "element",
          runtime: step.runtime || "web",
          windowsTarget: step.runtime === "windows" ? (step.windowsTarget || null) : null,
          instruction: step.instruction,
          screenName: step.screenName || null,
          frame: step.targetType === "none" ? null : (step.element?.frame || null),
          validation: step.targetType === "none" ? null : (step.validation || null)
        }))
      )
    });
    setStepsSaveStatus("stepsSaved", "success", true);
    return true;
  } catch (error) {
    setStepsSaveStatus("stepsSaveFailed", "error");
    console.error(error);
    return false;
  }
}

function setStatus(message, type = "info") {
  statusElement.textContent = message;
  statusElement.dataset.type = type;
}

function markActiveStep(stepId) {
  activeStepId = stepId;

  stepsList.querySelectorAll(".step-item").forEach((item) => {
    const isActive = item.dataset.stepId === stepId;
    item.classList.toggle("step-item--active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
}

async function runStep(step) {
  try {
    const response = await window.messagingService.sendToActivePage({
      type: "GWTP_SHOW_TRAINING_STEP",
      step
    });

    if (response?.success) {
      markActiveStep(step.id);
    }

    setStatus(
      response?.message || `Step ${step.order} started.`,
      response?.success ? "success" : "error"
    );
  } catch (error) {
    setStatus("Could not run this step on the current page.", "error");
    console.error(error);
  }
}

function renderSteps() {
  const steps = window.trainingService.getSteps();
  const language = window.i18nService.getLanguage();
  const selectedScreen = stepScreenFilter.value || "all";
  const screenNames = [...new Set(steps.map((step) => (step.screenName || "").trim()).filter(Boolean))];

  stepScreenFilter.replaceChildren();
  const allScreensOption = document.createElement("option");
  allScreensOption.value = "all";
  allScreensOption.textContent = window.i18nService.translate("filterAllScreens", language);
  stepScreenFilter.appendChild(allScreensOption);
  screenNames.forEach((screenName) => {
    const option = document.createElement("option");
    option.value = screenName;
    option.textContent = screenName;
    stepScreenFilter.appendChild(option);
  });
  stepScreenFilter.value = screenNames.includes(selectedScreen) ? selectedScreen : "all";
  stepScreenFilterWrap.hidden = screenNames.length === 0;

  const visibleSteps = stepScreenFilter.value === "all"
    ? steps
    : steps.filter((step) => (step.screenName || "").trim() === stepScreenFilter.value);

  stepsList.replaceChildren();
  stepsSection.hidden = false;
  stepsFilterStatus.textContent = "";

  if (steps.length === 0) return;
  if (visibleSteps.length === 0) {
    stepsFilterStatus.textContent = window.i18nService.translate("noStepsForFilter", language);
    return;
  }

  let draggedStepId = null;

  const persistReorder = async () => {
    renderSteps();
    await persistStepChanges();
  };

  visibleSteps.forEach((step) => {
    const item = document.createElement("div");
    item.className = "step-item";
    item.dataset.stepId = step.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", window.i18nService.translate("runStepLabel", language).replace("{number}", step.order));
    item.setAttribute("aria-pressed", String(step.id === activeStepId));

    if (step.id === activeStepId) item.classList.add("step-item--active");
    if (step.id === editingStepId) item.classList.add("step-item--editing");

    const header = document.createElement("div");
    header.className = "step-item__header";

    const title = document.createElement("strong");
    title.textContent = window.i18nService.translate("stepLabel", language).replace("{number}", step.order);

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "step-item__drag-handle";
    dragHandle.textContent = "⠿";
    dragHandle.draggable = true;
    dragHandle.title = window.i18nService.translate("reorderStep", language);
    dragHandle.setAttribute("aria-label", dragHandle.title);

    dragHandle.addEventListener("click", (event) => event.stopPropagation());
    dragHandle.addEventListener("keydown", async (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      if (!window.trainingService.moveStep(step.id, direction)) return;
      await persistReorder();
      const movedHandle = stepsList.querySelector(`[data-step-id="${step.id}"] .step-item__drag-handle`);
      movedHandle?.focus();
    });

    dragHandle.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      draggedStepId = step.id;
      item.classList.add("step-item--dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", step.id);
    });

    dragHandle.addEventListener("dragend", () => {
      draggedStepId = null;
      item.classList.remove("step-item--dragging");
      stepsList.querySelectorAll(".step-item--drop-before, .step-item--drop-after")
        .forEach((card) => card.classList.remove("step-item--drop-before", "step-item--drop-after"));
    });

    header.append(title, dragHandle);

    const screenName = (step.screenName || "").trim();
    const screen = document.createElement("div");
    screen.className = "step-item__screen";
    screen.textContent = screenName
      ? `${window.i18nService.translate("screenNameLabel", language)}: ${screenName}`
      : "";
    screen.hidden = !screenName;

    const instruction = document.createElement("div");
    instruction.className = "step-item__instruction";
    instruction.innerHTML = sanitizeInstructionHtml(step.instruction || "");

    const selector = document.createElement("code");
    selector.textContent = step.targetType === "none"
      ? window.i18nService.translate("instructionOnlyStepLabel", language)
      : step.runtime === "windows"
        ? `${window.i18nService.translate("windowsTargetLabel", language)}: ${step.windowsTarget?.processName || ""} · ${step.windowsTarget?.element?.controlType || ""}`
        : step.selector;

    item.append(header, screen, instruction, selector);

    item.addEventListener("dragover", (event) => {
      if (!draggedStepId || draggedStepId === step.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rect = item.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      item.classList.toggle("step-item--drop-before", !placeAfter);
      item.classList.toggle("step-item--drop-after", placeAfter);
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("step-item--drop-before", "step-item--drop-after");
    });

    item.addEventListener("drop", async (event) => {
      if (!draggedStepId || draggedStepId === step.id) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = item.getBoundingClientRect();
      const placeAfter = event.clientY > rect.top + rect.height / 2;
      if (!window.trainingService.reorderStep(draggedStepId, step.id, placeAfter)) return;
      draggedStepId = null;
      await persistReorder();
    });

    item.addEventListener("click", () => {
      openStepEditor(step);
      // Highlighting is best-effort editor feedback. The current application tab
      // may intentionally be on another screen (or have no GWTP content script),
      // so never let a missing receiver become an unhandled promise rejection.
      highlightEditorStep(step).catch((error) => {
        if (!window.messagingService.isUnsupportedPageError(error)) {
          console.info("GWTP editor highlight skipped:", error);
        }
      });
    });
    item.addEventListener("keydown", (event) => {
      if (event.target !== item) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openStepEditor(step);
        highlightEditorStep(step).catch((error) => {
          if (!window.messagingService.isUnsupportedPageError(error)) {
            console.info("GWTP editor highlight skipped:", error);
          }
        });
      }
    });

    stepsList.appendChild(item);
  });
}

function setElementPickerActive(active) {
  elementPickerActive = active;
  const language = window.i18nService.getLanguage();
  const inactiveKey = stepRuntimeSelect.value === "windows" ? "selectWindowsElementButton" : "selectElementButton";
  selectButton.textContent = window.i18nService.translate(
    active ? "cancelElementSelectionButton" : inactiveKey,
    language
  );
  selectButton.classList.toggle("button--primary", !active);
}

async function cancelElementPicker(showStatus = true) {
  if (stepRuntimeSelect.value === "windows") {
    window.windowsBridgeService.cancelPick();
  } else {
    await window.messagingService.sendToAllFrames({ type: "GWTP_CANCEL_ELEMENT_PICKER" }).catch(() => {});
  }
  setElementPickerActive(false);
  if (showStatus) {
    elementPickerStatus.textContent = window.i18nService.translate("elementSelectionCancelled", window.i18nService.getLanguage());
    elementPickerStatus.dataset.type = "info";
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !elementPickerActive) return;
  event.preventDefault();
  event.stopPropagation();
  cancelElementPicker(true);
});

selectButton.addEventListener("click", async () => {
  const language = window.i18nService.getLanguage();
  const setElementPickerStatus = (messageKey, type) => {
    elementPickerStatus.textContent = window.i18nService.translate(messageKey, language);
    elementPickerStatus.dataset.type = type;
  };

  if (elementPickerActive) {
    await cancelElementPicker(true);
    return;
  }

  elementPickerStatus.textContent = "";
  delete elementPickerStatus.dataset.type;

  try {
    await window.messagingService.sendToAllFrames({ type: "GWTP_CLEAR_HIGHLIGHT" }).catch(() => {});
    activeStepId = null;
    markActiveStep(null);

    if (stepRuntimeSelect.value === "windows") {
      setElementPickerActive(true);
      setElementPickerStatus("windowsSelectionModeActive", "info");
      const target = await window.windowsBridgeService.pickTarget();
      setElementPickerActive(false);
      if (!target) {
        setElementPickerStatus("elementSelectionCancelled", "info");
        return;
      }

      currentSelectedElement = null;
      currentWindowsTarget = target;
      selectorInput.value = "";
      selectedTag.textContent = target.element?.name || target.element?.automationId || target.element?.controlType || "";
      selectedSelector.textContent = `${target.processName} · ${target.element?.controlType || ""}`;
      selectedFrame.textContent = target.window?.name || target.window?.automationId || "";
      selectedElement.hidden = false;
      updateStepSaveValidity();
      setElementPickerStatus("windowsElementSelectedSuccess", "success");
      return;
    }

    const responses = await window.messagingService.sendToAllFrames({ type: "GWTP_START_ELEMENT_PICKER" });
    const started = responses.some((item) => item.response?.success);
    setElementPickerActive(started);
    setElementPickerStatus(started ? "selectionModeActive" : "selectionModeStartError", started ? "info" : "error");
  } catch (error) {
    setElementPickerActive(false);
    if (stepRuntimeSelect.value === "windows") {
      setElementPickerStatus("windowsRuntimeUnavailable", "error");
    } else {
      setElementPickerStatus("pageControlUnavailable", "error");
      if (!window.messagingService.isUnsupportedPageError(error)) console.error(error);
    }
  }
});

async function persistExistingGuide() {
  if (!editingGuideId) return;

  const topicId = Number(topicSelect.value);
  const guideName = guideNameInput.value.trim();
  const startInstruction = guideStartInstructionInput.value.trim();
  const steps = window.trainingService.getSteps();

  if (!topicId || !guideName || !startInstruction) {
    throw new Error("Guide details are incomplete.");
  }

  await window.apiService.request(`/api/guides/${editingGuideId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topicId,
      name: guideName,
      startInstruction,
      isAvailable: guideAvailableInput.checked,
      steps: steps.map((step) => ({
        id: step.persistedId || null,
        selector: step.selector,
        targetType: step.targetType || "element",
        runtime: step.runtime || "web",
        windowsTarget: step.runtime === "windows" ? (step.windowsTarget || null) : null,
        instruction: step.instruction,
        frame: step.targetType === "none" || step.runtime === "windows" ? null : (step.element?.frame || null),
        validation: step.targetType === "none" ? null : (step.validation || null)
      }))
    })
  });
}

saveStepButton.addEventListener("click", async () => {
  const language = window.i18nService.getLanguage();

  clearFieldInvalid(topicSelect, guideNameInput, instructionInput, validationValueInput, validationErrorInput);
  if (!topicSelect.value) {
    setFieldInvalid(topicSelect, true, statusElement);
    setStatus(window.i18nService.translate("guideTopicRequired", language), "error");
    topicSelect.focus();
    return;
  }

  if (!guideNameInput.value.trim()) {
    setFieldInvalid(guideNameInput, true, statusElement);
    setStatus(window.i18nService.translate("guideNameRequired", language), "error");
    guideNameInput.focus();
    return;
  }

  const instruction = getInstructionHtml();
  const instructionOnly = instructionOnlyInput.checked;
  const runtime = stepRuntimeSelect.value === "windows" ? "windows" : "web";
  const selector = instructionOnly || runtime === "windows" ? "" : selectorInput.value.trim();
  const screenName = screenNameInput.value.trim();

  if (!instructionOnly && runtime === "web" && !currentSelectedElement) {
    setStatus(window.i18nService.translate("stepElementRequired", language), "error");
    return;
  }

  if (!hasInstructionContent()) {
    setFieldInvalid(instructionInput, true, statusElement);
    setStatus(window.i18nService.translate("stepInstructionRequired", language), "error");
    instructionInput.focus();
    return;
  }

  // A persisted step may be edited from any application screen. Revalidate the
  // live-page target only when creating a step or when the author actually changed
  // the selected target. Metadata-only edits (ScreenName, instruction, validation)
  // must not require the original business screen to be open.
  const originalSelector = editingStepSnapshot?.selector || "";
  const originalFrame = editingStepSnapshot?.element?.frame || editingStepSnapshot?.frame || null;
  const selectedFrameValue = currentSelectedElement?.frame || null;
  const originalTargetType = editingStepSnapshot?.targetType || "element";
  const targetChanged = !editingStepId
    || (instructionOnly ? "none" : "element") !== originalTargetType
    || selector !== originalSelector
    || runtime !== (editingStepSnapshot?.runtime === "windows" ? "windows" : "web")
    || JSON.stringify(selectedFrameValue) !== JSON.stringify(originalFrame)
    || JSON.stringify(currentWindowsTarget) !== JSON.stringify(editingStepSnapshot?.windowsTarget || null);

  if (!instructionOnly && targetChanged && !(await validateSelectedStepElement())) {
    setStatus(window.i18nService.translate("stepElementInvalid", language), "error");
    return;
  }

  let validation;
  try {
    validation = instructionOnly ? null : buildStepValidation();
  } catch (error) {
    const validationType = validationTypeSelect.value;
    const needsValue = ["equals", "not_equals", "contains", "changed_regex"].includes(validationType);
    if (needsValue && !validationValueInput.value) setFieldInvalid(validationValueInput, true, statusElement);
    if (validationType !== "none" && !validationErrorInput.value.trim()) setFieldInvalid(validationErrorInput, true, statusElement);
    setStatus(error.message, "error");
    return;
  }

  try {
    const step = editingStepId
      ? window.trainingService.updateStep(editingStepId, {
          selector,
          targetType: instructionOnly ? "none" : "element",
          runtime,
          windowsTarget: instructionOnly || runtime !== "windows" ? null : currentWindowsTarget,
          instruction,
          screenName,
          element: instructionOnly ? null : currentSelectedElement,
          validation
        })
      : window.trainingService.createStep({
          selector,
          targetType: instructionOnly ? "none" : "element",
          runtime,
          windowsTarget: instructionOnly || runtime !== "windows" ? null : currentWindowsTarget,
          instruction,
          screenName,
          element: instructionOnly ? null : currentSelectedElement,
          validation
        });

    renderSteps();
    updateGuideEditorValidity();

    if (editingGuideId && !(await persistStepChanges())) {
      return;
    }

    closeStepCreator();
    setStatus(
      window.i18nService.translate(editingStepId ? "updateStepButton" : "saveStepButton", language),
      "success"
    );
  } catch (error) {
    setStatus(error.message || "Could not save the step.", "error");
    console.error(error);
  }
});

function applyInlineFormat(tagName) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  if (!instructionInput.contains(range.commonAncestorContainer)) return;

  const selector = tagName === "strong" ? "strong, b" : tagName;
  const existing = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer.closest(selector)
    : range.commonAncestorContainer.parentElement?.closest(selector);

  if (existing && instructionInput.contains(existing)) {
    existing.replaceWith(...existing.childNodes);
    selection.removeAllRanges();
    return;
  }

  const element = document.createElement(tagName);
  try {
    range.surroundContents(element);
  } catch {
    const fragment = range.extractContents();
    element.appendChild(fragment);
    range.insertNode(element);
  }

  selection.removeAllRanges();
  const formattedRange = document.createRange();
  formattedRange.selectNodeContents(element);
  selection.addRange(formattedRange);
}

function applyListFormat(tagName) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (!instructionInput.contains(range.commonAncestorContainer)) return;

  const text = selection.toString() || range.commonAncestorContainer.textContent || "";
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return;

  const list = document.createElement(tagName);
  lines.forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    list.appendChild(item);
  });

  range.deleteContents();
  range.insertNode(list);
  selection.removeAllRanges();
}

instructionInput.addEventListener("input", updateStepSaveValidity);
instructionOnlyInput.addEventListener("change", () => {
  const instructionOnly = instructionOnlyInput.checked;
  if (instructionOnly && elementPickerActive) cancelElementPicker(false);
  selectButton.disabled = instructionOnly;
  selectButton.hidden = instructionOnly;
  validationTypeSelect.disabled = instructionOnly;
  if (instructionOnly) {
    currentSelectedElement = null;
    currentWindowsTarget = null;
    selectorInput.value = "";
    selectedElement.hidden = true;
    elementPickerStatus.textContent = "";
    delete elementPickerStatus.dataset.type;
    clearPageTrainingVisuals();
    resetValidationBuilder();
  } else {
    selectButton.hidden = false;
  }
  updateStepSaveValidity();
});
stepRuntimeSelect.addEventListener("change", async () => {
  if (elementPickerActive) await cancelElementPicker(false);
  currentSelectedElement = null;
  currentWindowsTarget = null;
  selectorInput.value = "";
  selectedTag.textContent = "";
  selectedSelector.textContent = "";
  selectedFrame.textContent = "";
  selectedElement.hidden = true;
  elementPickerStatus.textContent = "";
  delete elementPickerStatus.dataset.type;
  setElementPickerActive(false);
  clearPageTrainingVisuals();
  updateStepSaveValidity();
});

validationTypeSelect.addEventListener("change", () => { updateValidationBuilder(); updateStepSaveValidity(); });
validationValueInput.addEventListener("input", updateStepSaveValidity);
validationErrorInput.addEventListener("input", updateStepSaveValidity);

removeSelectedElementButton.addEventListener("click", () => {
  currentSelectedElement = null;
  currentWindowsTarget = null;
  selectorInput.value = "";
  selectedTag.textContent = "";
  selectedSelector.textContent = "";
  selectedFrame.textContent = "";
  selectedElement.hidden = true;
  updateStepSaveValidity();
  setStatus(window.i18nService.translate("stepElementRequired", window.i18nService.getLanguage()), "error");
});

richTextToolbarButtons.forEach((button) => {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    const command = button.dataset.richCommand;
    if (command === "bold") applyInlineFormat("strong");
    else if (command === "italic") applyInlineFormat("em");
    else if (command === "underline") applyInlineFormat("u");
    else if (command === "insertUnorderedList") applyListFormat("ul");
    else if (command === "insertOrderedList") applyListFormat("ol");
  });
});

saveGuideButton.addEventListener("click", async () => {
  const topicId = Number(topicSelect.value);
  const guideName = guideNameInput.value.trim();
  const startInstruction = guideStartInstructionInput.value.trim();
  const steps = window.trainingService.getSteps();
  const language = window.i18nService.getLanguage();

  clearFieldInvalid(topicSelect, guideNameInput, guideStartInstructionInput);
  if (!topicId) {
    setFieldInvalid(topicSelect, true, saveGuideStatus);
    saveGuideStatus.textContent = window.i18nService.translate("guideTopicRequired", language);
    saveGuideStatus.dataset.type = "error";
    topicSelect.focus();
    return;
  }

  if (!guideName) {
    setFieldInvalid(guideNameInput, true, saveGuideStatus);
    saveGuideStatus.textContent = window.i18nService.translate("guideNameRequired", language);
    saveGuideStatus.dataset.type = "error";
    guideNameInput.focus();
    return;
  }

  if (!startInstruction) {
    setFieldInvalid(guideStartInstructionInput, true, saveGuideStatus);
    saveGuideStatus.textContent = window.i18nService.translate("guideStartInstructionRequired", language);
    saveGuideStatus.dataset.type = "error";
    guideStartInstructionInput.focus();
    return;
  }

  if (guideAvailableInput.checked && steps.length === 0) {
    saveGuideStatus.textContent = window.i18nService.translate("availableGuideRequiresStep", language);
    saveGuideStatus.dataset.type = "error";
    return;
  }

  saveGuideButton.disabled = true;
  saveGuideStatus.textContent = "";

  try {
    const guidePath = editingGuideId ? `/api/guides/${editingGuideId}` : "/api/guides";
    const guideMethod = editingGuideId ? "PUT" : "POST";

    const savedGuide = await window.apiService.request(guidePath, {
      method: guideMethod,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId,
        name: guideName,
        startInstruction: startInstruction || null,
        isAvailable: guideAvailableInput.checked,
        steps: steps.map((step) => ({
          id: step.persistedId || null,
          selector: step.selector,
          targetType: step.targetType || "element",
          runtime: step.runtime || "web",
          windowsTarget: step.runtime === "windows" ? (step.windowsTarget || null) : null,
          instruction: step.instruction,
          screenName: step.screenName || null,
          frame: step.targetType === "none" ? null : (step.element?.frame || null),
          validation: step.targetType === "none" ? null : (step.validation || null)
        }))
      })
    });

    if (!editingGuideId && savedGuide?.id) {
      editingGuideId = savedGuide.id;
    }

    await loadGuides();
    showGuideLibrary();
  } catch (error) {
    saveGuideStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "guideSaveError",
      language
    );
    saveGuideStatus.dataset.type = "error";
  } finally {
    saveGuideButton.disabled = false;
  }
});

guideStartInstructionInput.addEventListener("input", () => {
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  updateGuideEditorValidity();
});

guideNameInput.addEventListener("input", () => {
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  updateGuideEditorValidity();

  if (window.trainingService.getSteps().length > 0 && !guideNameInput.value.trim()) {
    saveGuideStatus.textContent = window.i18nService.translate("guideNameRequired", window.i18nService.getLanguage());
    saveGuideStatus.dataset.type = "error";
  }
});

guideAvailableInput.addEventListener("change", () => {
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  updateGuideEditorValidity();
});

topicSelect.addEventListener("change", () => {
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  updateGuideEditorValidity();

  if (window.trainingService.getSteps().length > 0 && !topicSelect.value) {
    saveGuideStatus.textContent = window.i18nService.translate("guideTopicRequired", window.i18nService.getLanguage());
    saveGuideStatus.dataset.type = "error";
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GWTP_ELEMENT_PICKER_STARTED_BY_COMMAND") {
    if (!editingStepId && stepEditor.hidden) return;
    if (stepRuntimeSelect.value === "windows") {
      window.messagingService.sendToAllFrames({ type: "GWTP_CANCEL_ELEMENT_PICKER" }).catch(() => {});
      return;
    }
    setElementPickerActive(true);
    elementPickerStatus.textContent = window.i18nService.translate("selectionModeActive", window.i18nService.getLanguage());
    elementPickerStatus.dataset.type = "info";
    return;
  }

  if (message?.type === "GWTP_ELEMENT_SELECTED") {
    if (stepRuntimeSelect.value === "windows") return;
    setElementPickerActive(false);
    const element = message.element;
    currentWindowsTarget = null;
    currentSelectedElement = element;
    selectorInput.value = element.selector;
    selectedTag.textContent = `<${element.tagName}>${element.text ? ` — ${element.text}` : ""}`;
    selectedSelector.textContent = element.selector;
    renderSelectedFrame(element);
    selectedElement.hidden = false;
    stepEditor.hidden = false;
    updateStepSaveValidity();
    instructionInput.focus();
    setStatus(window.i18nService.translate("elementSelectedSuccess", window.i18nService.getLanguage()), "success");
    return;
  }

  if (message?.type === "GWTP_ELEMENT_SELECTION_CANCELLED") {
    setElementPickerActive(false);
    elementPickerStatus.textContent = window.i18nService.translate("elementSelectionCancelled", window.i18nService.getLanguage());
    elementPickerStatus.dataset.type = "info";
  }
});


async function handleLogin() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  const language = window.i18nService.getLanguage();

  clearFieldInvalid(usernameInput, passwordInput);
  if (!username || !password) {
    setFieldInvalid(usernameInput, !username, loginStatus);
    setFieldInvalid(passwordInput, !password, loginStatus);
    loginStatus.textContent = window.i18nService.translate("loginRequiredFields", language);
    loginStatus.dataset.type = "error";
    (!username ? usernameInput : passwordInput).focus();
    return;
  }

  if (username.length < 5 || username.length > 30) {
    setFieldInvalid(usernameInput, true, loginStatus);
    loginStatus.textContent = window.i18nService.translate("usernameLengthInvalid", language);
    loginStatus.dataset.type = "error";
    usernameInput.focus();
    return;
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    setFieldInvalid(usernameInput, true, loginStatus);
    loginStatus.textContent = window.i18nService.translate("usernameInvalidCharacters", language);
    loginStatus.dataset.type = "error";
    usernameInput.focus();
    return;
  }

  if (password.length < 6 || password.length > 20 || /\\s/.test(password)) {
    setFieldInvalid(passwordInput, true, loginStatus);
    loginStatus.textContent = window.i18nService.translate("passwordRequirementsInvalid", language);
    loginStatus.dataset.type = "error";
    passwordInput.focus();
    return;
  }

  const result = await window.authService.authenticate(username.toLowerCase(), password);

  if (!result.success) {
    const messageKey =
      result.reason === "serverUnavailable"
        ? "serverUnavailable"
        : result.reason === "serverError"
          ? "serverError"
          : "invalidPassword";

    loginStatus.textContent = window.i18nService.translate(messageKey, window.i18nService.getLanguage());
    loginStatus.dataset.type = "error";

    if (result.reason === "invalidCredentials") {
      setFieldInvalid(usernameInput, true, loginStatus);
      setFieldInvalid(passwordInput, true, loginStatus);
      passwordInput.select();
    }

    return;
  }

  clearFieldInvalid(usernameInput, passwordInput);
  loginStatus.textContent = "";
  passwordInput.value = "";
  loginView.hidden = true;
  appView.hidden = false;
  adminModeActive = false;
  updateAuthenticatedView();
  await loadAdminUsers();
  await loadTopics();
  await loadGuides();
  await loadLearnerCatalog();
}

function resetTransientUiStateForLogout() {
  editingGuideId = null;
  editingGuideSnapshot = null;
  activeStepId = null;
  editingStepId = null;
  previewSession = null;
  learnerCatalog = [];
  learnerSessionActive = false;

  window.trainingService.clearSteps();

  topicSelect.value = "";
  guideNameInput.value = "";
  guideStartInstructionInput.value = "";
  guideAvailableInput.checked = false;

  closeStepCreator();
  closeTopicCreator();
  closeUserEditor();
  closeCreateUser();

  topicsView.hidden = true;
  guideEditorView.hidden = true;
  guideLibraryView.hidden = false;

  learnerTopicSelect.replaceChildren();
  learnerGuideSelect.replaceChildren();
  startLearningButton.disabled = true;
  restartLearningButton.hidden = true;
  exitLearningButton.hidden = true;

  renderSteps();
  updatePreviewUi();
  updateGuideEditorValidity();

  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  setStepsSaveStatus();
}

async function handleLogout() {
  try {
    await window.messagingService.sendToActivePage({
      type: "GWTP_CLEAR_HIGHLIGHT"
    });
  } catch (error) {
    if (!window.messagingService.isUnsupportedPageError(error)) {
      console.info("GWTP page cleanup skipped during logout:", error);
    }
  }

  await chrome.runtime.sendMessage({
    type: "GWTP_TRAINING_STOP"
  });
  await window.authService.logout();
  resetTransientUiStateForLogout();
  appView.hidden = true;
  adminModeActive = false;
  adminButton.hidden = true;
  adminView.hidden = true;
  createModeView.hidden = true;
  learnModeView.hidden = true;
  loginView.hidden = false;
  loginStatus.textContent = "";
  usernameInput.value = "";
  passwordInput.value = "";
  usernameInput.focus();
}

learnerTopicSelect.addEventListener("change", () => {
  // Recovery belongs to the previously selected learning context.
  // Changing topic starts a fresh selection context, so stale recovery UI
  // must not remain visible for the newly selected topic/guide.
  hideLearnerRecovery();
  learnerStatus.textContent = "";
  learnerStatus.removeAttribute("data-type");
  handleLearnerTopicChange();
});
learnerGuideSelect.addEventListener("change", handleLearnerGuideChange);
userRoleFilter.addEventListener("change", () => {
  closeUserEditor();
  loadAdminUsers();
});
guideTopicFilter.addEventListener("change", loadGuides);
guideAvailabilityFilter.addEventListener("change", loadGuides);
stepScreenFilter.addEventListener("change", renderSteps);
startLearningButton.addEventListener("click", handleStartLearning);
restartLearningButton.addEventListener("click", handleRestartLearning);
exitLearningButton.addEventListener("click", handleExitLearning);
retryLearningButton.addEventListener("click", handleRetryLearning);
recoveryRestartLearningButton.addEventListener("click", handleRestartLearning);
recoveryExitLearningButton.addEventListener("click", handleExitLearning);
openTopicsButton.addEventListener("click", openTopics);
backFromTopicsButton.addEventListener("click", closeTopics);
cancelDeleteButton.addEventListener("click", closeDeleteConfirmation);
confirmDeleteButton.addEventListener("click", confirmPendingDelete);
deleteConfirmOverlay.addEventListener("click", (event) => {
  if (event.target === deleteConfirmOverlay) closeDeleteConfirmation();
});
deleteConfirmOverlay.addEventListener("keydown", handleDeleteConfirmationKeydown);
openNewGuideButton.addEventListener("click", openNewGuide);
previewGuideButton.addEventListener("click", startGuidePreview);
exitPreviewButton.addEventListener("click", exitGuidePreview);
backToGuidesButton.addEventListener("click", showGuideLibrary);
addStepButton.addEventListener("click", openStepCreator);
cancelStepButton.addEventListener("click", closeStepCreator);
openCreateTopicButton.addEventListener("click", openTopicCreator);
saveTopicButton.addEventListener("click", handleSaveTopic);
cancelEditTopicButton.addEventListener("click", closeTopicEditor);
editTopicInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleSaveTopic();
});
cancelCreateTopicButton.addEventListener("click", closeTopicCreator);
createTopicButton.addEventListener("click", handleCreateTopic);
newTopicInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleCreateTopic();
});
openCreateUserButton.addEventListener("click", openCreateUser);
closeCreateUserButton.addEventListener("click", closeCreateUser);
createUserButton.addEventListener("click", handleCreateUser);
saveUserButton.addEventListener("click", handleSaveUser);
deleteEditedTopicButton.addEventListener("click", () => {
  if (editingTopicSnapshot) handleDeleteTopic(editingTopicSnapshot);
});
deleteEditedGuideButton.addEventListener("click", () => {
  if (!editingGuideSnapshot) return;
  const language = window.i18nService.getLanguage();
  const message = window.i18nService.translate("confirmDeleteGuide", language).replace("{name}", editingGuideSnapshot.name);
  requestDeleteConfirmation(message, async () => {
    await handleDeleteGuide(editingGuideSnapshot.id);
    showGuideLibrary();
  });
});
deleteEditedStepButton.addEventListener("click", () => {
  if (!editingStepSnapshot) return;
  const stepId = editingStepSnapshot.id;
  requestDeleteConfirmation(
    window.i18nService.translate("confirmDeleteStep", window.i18nService.getLanguage()),
    async () => await deleteDraftStep(stepId)
  );
});

resetUserLearningButton.addEventListener("click", () => {
  if (!editingUserSnapshot) return;
  const language = window.i18nService.getLanguage();
  const name = editingUserSnapshot.displayName || editingUserSnapshot.username;
  const message = window.i18nService.translate("confirmResetLearningActivity", language).replace("{name}", name);

  requestDeleteConfirmation(message, async () => {
    resetUserLearningButton.disabled = true;
    try {
      await window.apiService.request(`/api/users/${editingUserSnapshot.id}/learning-activity`, {
        method: "DELETE"
      });
      editUserStatus.textContent = window.i18nService.translate("learningActivityReset", language);
      editUserStatus.dataset.type = "success";
    } catch (error) {
      editUserStatus.textContent = window.i18nService.translate("learningActivityResetError", language);
      editUserStatus.dataset.type = "error";
      console.error(error);
    } finally {
      resetUserLearningButton.disabled = false;
    }
  });
});

deleteEditedUserButton.addEventListener("click", () => {
  if (!editingUserSnapshot) return;
  const language = window.i18nService.getLanguage();
  const message = window.i18nService.translate("confirmDeleteUser", language)
    .replace("{name}", editingUserSnapshot.displayName || editingUserSnapshot.username);
  requestDeleteConfirmation(message, async () => {
    await handleDeleteUser(editingUserSnapshot.id);
    closeUserEditor();
  });
});
cancelEditUserButton.addEventListener("click", closeUserEditor);
editDisplayName.addEventListener("input", clearEditUserFeedback);
editNewPassword.addEventListener("input", clearEditUserFeedback);
editRole.addEventListener("change", clearEditUserFeedback);
editIsActive.addEventListener("change", clearEditUserFeedback);
logoutButton.addEventListener("click", handleLogout);
loginButton.addEventListener("click", handleLogin);
usernameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    passwordInput.focus();
  }
});
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleLogin();
  }
});
usernameInput.addEventListener("input", () => setFieldInvalid(usernameInput, false));
passwordInput.addEventListener("input", () => setFieldInvalid(passwordInput, false));
newDisplayName.addEventListener("input", () => setFieldInvalid(newDisplayName, false));
newUsername.addEventListener("input", () => setFieldInvalid(newUsername, false));
newPassword.addEventListener("input", () => setFieldInvalid(newPassword, false));
topicSelect.addEventListener("change", () => setFieldInvalid(topicSelect, false));
guideNameInput.addEventListener("input", () => setFieldInvalid(guideNameInput, false));
guideStartInstructionInput.addEventListener("input", () => setFieldInvalid(guideStartInstructionInput, false));
instructionInput.addEventListener("input", () => setFieldInvalid(instructionInput, false));
validationValueInput.addEventListener("input", () => setFieldInvalid(validationValueInput, false));
validationErrorInput.addEventListener("input", () => setFieldInvalid(validationErrorInput, false));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const role = window.authService.getCurrentRole();

  if (role === "editor" && previewSession) {
    if (message?.type === "GWTP_PAGE_READY") {
      // Starting Preview already navigates and renders the first step itself.
      // PAGE_READY is emitted by the top page and its frames during that navigation;
      // rendering from those events as well can race and create duplicate overlays.
      if (previewStarting) return;

      const restorePreviewStep = async () => {
        if (previewPendingDirection && previewSession) {
          const nextIndex = Math.max(
            0,
            Math.min(previewSession.steps.length - 1, previewSession.stepIndex + previewPendingDirection)
          );
          const pendingCurrent = {
            step: previewSession.steps[nextIndex],
            stepIndex: nextIndex,
            totalSteps: previewSession.steps.length,
            mode: "preview"
          };

          if (pendingCurrent.step && await window.guideRunner.canShowStep(pendingCurrent)) {
            previewSession.stepIndex = nextIndex;
            previewPendingDirection = null;
            updatePreviewUi();
            await window.guideRunner.showCurrentStep(pendingCurrent);
            return;
          }
        }

        const current = {
          step: previewSession?.steps?.[previewSession.stepIndex],
          stepIndex: previewSession?.stepIndex,
          totalSteps: previewSession?.steps?.length,
          mode: "preview"
        };
        if (!current.step) return;
        await window.guideRunner.showCurrentStep(current);
      };

      if (previewRestorePromise) {
        previewRestoreQueued = true;
        return;
      }

      previewRestorePromise = (async () => {
        do {
          previewRestoreQueued = false;
          await restorePreviewStep();
        } while (previewRestoreQueued && previewSession);
      })();

      previewRestorePromise
        .catch((error) => {
          console.info("GWTP preview restore skipped:", error);
        })
        .finally(() => {
          previewRestorePromise = null;
          previewRestoreQueued = false;
        });
      return;
    }

    if (message?.type === "GWTP_PREVIEW_PEEK_NEXT" || message?.type === "GWTP_PREVIEW_PEEK_PREVIOUS") {
      const direction = message.type === "GWTP_PREVIEW_PEEK_NEXT" ? 1 : -1;
      previewPendingDirection = direction;
      const stepIndex = Math.max(0, Math.min(previewSession.steps.length - 1, previewSession.stepIndex + direction));
      sendResponse({
        success: true,
        current: {
          step: previewSession.steps[stepIndex],
          stepIndex,
          totalSteps: previewSession.steps.length,
          mode: "preview"
        }
      });
      return;
    }

    if (message?.type === "GWTP_PREVIEW_NEXT" || message?.type === "GWTP_PREVIEW_PREVIOUS") {
      const direction = message.type === "GWTP_PREVIEW_NEXT" ? 1 : -1;
      previewSession.stepIndex = Math.max(0, Math.min(previewSession.steps.length - 1, previewSession.stepIndex + direction));
      previewPendingDirection = null;
      updatePreviewUi();
      sendResponse({
        success: true,
        current: {
          step: previewSession.steps[previewSession.stepIndex],
          stepIndex: previewSession.stepIndex,
          totalSteps: previewSession.steps.length,
          mode: "preview"
        }
      });
      return;
    }

    if (message?.type === "GWTP_CHECK_NEXT_STEP_AVAILABLE") {
      checkStepAvailability(message.current).then(sendResponse);
      return true;
    }

    if (message?.type === "GWTP_PREVIEW_COMPLETE") {
      sendResponse({ success: true, result: { preview: true } });
      return;
    }

    if (message?.type === "GWTP_PREVIEW_COMPLETED") {
      previewSession = null;
      updatePreviewUi();
      return;
    }

    if (message?.type === "GWTP_PREVIEW_STEP_CHANGED" && message.current?.mode === "preview") {
      window.guideRunner.showCurrentStep(message.current).catch((error) => {
        console.info("GWTP preview step change skipped:", error);
      });
      return;
    }
  }

  if (role !== "learner") return;

  if (message?.type === "GWTP_CHECK_NEXT_STEP_AVAILABLE") {
    checkStepAvailability(message.current).then(sendResponse);
    return true;
  }

  if (message?.type === "GWTP_PAGE_READY") {
    if (!learnerSessionActive) return;
    window.guideRunner.resumePendingNavigation()
      .then((resumed) => {
        if (resumed) return;
        return window.guideRunner.restoreActiveStep();
      })
      .catch((error) => {
        console.info("GWTP active step restore skipped:", error);
      });
    return;
  }

  if (message?.type === "GWTP_TRAINING_STEP_CHANGED") {
    renderLearnerStepSerialized(message.current).catch((error) => {
      console.info("GWTP learner step change skipped:", error);
    });
    return;
  }

  if (message?.type === "GWTP_TRAINING_COMPLETED") {
    learnerSessionActive = false;
    const guideId = Number(message.guideId);
    const topic = learnerCatalog.find((item) => item.guides?.some((guide) => guide.id === guideId));
    const guide = topic?.guides?.find((item) => item.id === guideId);

    if (guide) {
      guide.progressStatus = "Completed";
      if (Number(learnerGuideSelect.value) === guideId) {
        refreshSelectedLearnerGuideUi();
      }
    }
  }
});

async function verifyApiConnection() {
  try {
    const health = await window.apiService.healthCheck();
    console.info("GWTP API connected:", health);
    return true;
  } catch {
    console.info("GWTP API is unavailable.");
    return false;
  }
}

async function initializePanel() {
  window.i18nService.initialize();
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  activeStepId = null;
  updateGuideEditorValidity();
  renderSteps();

  const restoredUser = await window.authService.restoreSession();
  const apiAvailable = await verifyApiConnection();

  if (restoredUser && apiAvailable) {
    loginView.hidden = true;
    appView.hidden = false;
    adminModeActive = false;
    updateAuthenticatedView();
    await loadAdminUsers();
    await loadTopics();
    await loadGuides();
    await loadLearnerCatalog();
  } else {
    loginView.hidden = false;
    appView.hidden = true;
    usernameInput.focus();

    if (restoredUser && !apiAvailable) {
      loginStatus.textContent = window.i18nService.translate("serverUnavailable", window.i18nService.getLanguage());
      loginStatus.dataset.type = "error";
    }
  }
}

initializePanel();
