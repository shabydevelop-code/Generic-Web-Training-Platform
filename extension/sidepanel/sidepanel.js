const selectorInput = document.getElementById("selectorInput");
const selectButton = document.getElementById("selectButton");
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
const guideStartUrlInput = document.getElementById("guideStartUrlInput");
const saveGuideButton = document.getElementById("saveGuideButton");
const saveGuideStatus = document.getElementById("saveGuideStatus");
const statusElement = document.getElementById("status");
const selectedElement = document.getElementById("selectedElement");
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

let currentSelectedElement = null;
let activeStepId = null;
let adminModeActive = false;
let editingUserId = null;
let editingStepId = null;
let editingGuideId = null;


function updatePreviewUi() {
  const active = Boolean(previewSession);
  previewGuideButton.hidden = active;
  previewActiveControls.hidden = !active;

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
    startUrl: guideStartUrlInput.value.trim(),
    steps: window.trainingService.getSteps().map((step) => ({
      ...step,
      frame: step.element?.frame || step.frame || null
    }))
  };
}

async function startGuidePreview() {
  const guide = buildPreviewGuide();
  const language = window.i18nService.getLanguage();

  if (!guide.startUrl || guide.steps.length === 0) {
    saveGuideStatus.textContent = window.i18nService.translate("previewStartError", language);
    saveGuideStatus.dataset.type = "error";
    return;
  }

  previewGuideButton.disabled = true;
  try {
    previewSession = { ...guide, stepIndex: 0 };
    updatePreviewUi();
    await window.guideRunner.preview(guide);
  } catch (error) {
    previewSession = null;
    updatePreviewUi();
    saveGuideStatus.textContent = window.i18nService.translate("previewStartError", language);
    saveGuideStatus.dataset.type = "error";
    console.error(error);
  } finally {
    previewGuideButton.disabled = false;
  }
}

async function exitGuidePreview() {
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
  learnerRecoveryMessage.textContent = window.i18nService.translate("resumeElementNotFound", language);
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
      await window.guideRunner.restart(guide);
    } else {
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
  deleteConfirmOverlay.hidden = false;
  confirmDeleteButton.focus();
}

function closeDeleteConfirmation() {
  deleteConfirmOverlay.hidden = true;
  pendingDeleteAction = null;
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
  guidesStatus.textContent = window.i18nService.translate("loadingGuides", language);
  guidesStatus.dataset.type = "info";

  try {
    const guides = await window.apiService.request("/api/guides");

    guides.forEach((guide) => {
      const item = document.createElement("div");
      item.className = "guide-item";

      const name = document.createElement("strong");
      name.textContent = guide.name;

      const meta = document.createElement("span");
      meta.textContent = `${guide.topicName} · ${guide.stepCount} ${window.i18nService.translate("stepCount", language)}`;

      item.dataset.guideId = String(guide.id);
      item.classList.add("entity-card--clickable");
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.addEventListener("click", () => openExistingGuide(guide.id));
      item.addEventListener("keydown", async (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openExistingGuide(guide.id);
        }
      });

      item.append(name, meta);
      guidesList.appendChild(item);
    });

    guidesStatus.textContent = guides.length ? "" : window.i18nService.translate("noGuides", language);
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
    guideStartUrlInput.value = guide.startUrl || "";
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
  guideStartUrlInput.value = "";
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

  if (!displayName || !username || !password) {
    createUserStatus.textContent = window.i18nService.translate("createUserRequired", language);
    createUserStatus.dataset.type = "error";
    return;
  }

  if (username.length < 5 || username.length > 30) {
    createUserStatus.textContent = window.i18nService.translate("usernameLengthInvalid", language);
    createUserStatus.dataset.type = "error";
    newUsername.focus();
    return;
  }

  if (!/^[a-zA-Z0-9._]+$/.test(username)) {
    createUserStatus.textContent = window.i18nService.translate("usernameInvalidCharacters", language);
    createUserStatus.dataset.type = "error";
    newUsername.focus();
    return;
  }

  if (password.length < 6 || password.length > 20 || /\s/.test(password)) {
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
  editUserStatus.textContent = "";
  editUserStatus.removeAttribute("data-type");
}

async function handleSaveUser() {
  if (editingUserId == null) return;

  const language = window.i18nService.getLanguage();
  const displayName = editDisplayName.value.trim();
  const newUserPassword = editNewPassword.value;

  if (newUserPassword && (newUserPassword.length < 6 || newUserPassword.length > 20 || /\s/.test(newUserPassword))) {
    editUserStatus.textContent = window.i18nService.translate("passwordRequirementsInvalid", language);
    editUserStatus.dataset.type = "error";
    editNewPassword.focus();
    return;
  }


  if (!displayName) {
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

async function loadAdminUsers() {
  if (window.authService.getCurrentRole() !== "admin") return;

  const language = window.i18nService.getLanguage();
  usersStatus.textContent = window.i18nService.translate("loadingUsers", language);
  usersStatus.dataset.type = "info";
  usersList.replaceChildren();

  try {
    const users = await window.apiService.request("/api/users");

    users.forEach((user) => {
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
      usersList.appendChild(item);
    });

    usersStatus.textContent = users.length ? "" : window.i18nService.translate("noUsers", language);
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
    guideStartUrlInput.value.trim() !== String(editingGuideSnapshot.startUrl || "").trim() ||
    guideAvailableInput.checked !== Boolean(editingGuideSnapshot.isAvailable)
  );
}

function updateGuideEditorValidity() {
  const hasTopic = Boolean(topicSelect.value);
  const hasGuideName = Boolean(guideNameInput.value.trim());
  const hasStartUrl = Boolean(guideStartUrlInput.value.trim());
  const guideIdentityValid = hasTopic && hasGuideName && hasStartUrl;

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
  const needsValue = type === "equals" || type === "not_equals" || type === "contains";
  const enabled = type !== "none";
  validationValueField.hidden = !needsValue;
  validationErrorField.hidden = !enabled;
  validationValueLabel.textContent = window.i18nService.translate("validationValueLabel", language);
}

function resetValidationBuilder() {
  validationTypeSelect.value = "none";
  validationValueInput.value = "";
  validationErrorInput.value = "";
  updateValidationBuilder();
}

function loadValidationBuilder(validation) {
  if (!validation?.expression) { resetValidationBuilder(); return; }
  const supportedType = ["required", "changed", "equals", "not_equals", "contains"].includes(validation.builderType)
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
    if (type === "equals") expression = "^" + escapeRegexValue(value) + "$";
    if (type === "not_equals") expression = "^(?!" + escapeRegexValue(value) + "$).+$";
    if (type === "contains") expression = ".*" + escapeRegexValue(value) + ".*";
  }
  return { engine: type === "changed" ? "changed" : "regex", expression, errorMessage, builderType: type, builderValue: (type === "required" || type === "changed") ? "" : value };
}
function updateStepSaveValidity() {
  const validationType = validationTypeSelect.value;
  const validationNeedsValue = validationType === "equals" || validationType === "not_equals" || validationType === "contains";
  const validationComplete =
    validationType === "none" ||
    (Boolean(validationErrorInput.value.trim()) && (!validationNeedsValue || Boolean(validationValueInput.value)));

  saveStepButton.disabled =
    !currentSelectedElement ||
    !selectorInput.value.trim() ||
    !hasInstructionContent() ||
    !validationComplete;
}

async function validateSelectedStepElement() {
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
  } else {
    const responses = await window.messagingService.sendToAllFrames({
      type: "GWTP_HIGHLIGHT_ELEMENT",
      selector: step.selector
    });
    matched = responses.some((item) => item.response?.success);
  }

  if (matched) return;

  setStatus("Could not find the selected element on the current page.", "error");
}

function closeStepCreator() {
  clearPageTrainingVisuals();
  editingStepId = null;
  editingStepSnapshot = null;
  saveStepButton.textContent = window.i18nService.translate("saveStepButton", window.i18nService.getLanguage());
  editStepDeleteSection.hidden = true;
  currentSelectedElement = null;
  selectorInput.value = "";
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

  editingStepId = null;
  editingStepSnapshot = null;
  stepEditorTitle.textContent = window.i18nService.translate("stepEditorTitle", window.i18nService.getLanguage());
  saveStepButton.textContent = window.i18nService.translate("saveStepButton", window.i18nService.getLanguage());
  editStepDeleteSection.hidden = true;
  currentSelectedElement = null;
  selectorInput.value = "";
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

  editingStepId = step.id;
  editingStepSnapshot = step;
  stepEditorTitle.textContent = window.i18nService.translate("editStepEditorTitle", window.i18nService.getLanguage());
  saveStepButton.textContent = window.i18nService.translate("updateStepButton", window.i18nService.getLanguage());
  editStepDeleteSection.hidden = false;
  currentSelectedElement = step.element || {
    tagName: "",
    text: ""
  };
  selectorInput.value = step.selector;
  setInstructionHtml(step.instruction);
  loadValidationBuilder(step.validation);
  selectedTag.textContent = step.element?.tagName ? `<${step.element.tagName}>${step.element.text ? ` — ${step.element.text}` : ""}` : "";
  selectedSelector.textContent = step.selector;
  renderSelectedFrame(currentSelectedElement);
  selectedElement.hidden = false;
  stepEditor.hidden = false;
  selectButton.hidden = false;
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
          instruction: step.instruction,
          frame: step.element?.frame || null,
          validation: step.validation || null
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
  stepsList.replaceChildren();
  stepsSection.hidden = false;

  if (steps.length === 0) return;

  let draggedStepId = null;

  const persistReorder = async () => {
    renderSteps();
    await persistStepChanges();
  };

  steps.forEach((step) => {
    const item = document.createElement("div");
    item.className = "step-item";
    item.dataset.stepId = step.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Run Step ${step.order}`);
    item.setAttribute("aria-pressed", String(step.id === activeStepId));

    if (step.id === activeStepId) item.classList.add("step-item--active");

    const language = window.i18nService.getLanguage();

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

    const instruction = document.createElement("div");
    instruction.className = "step-item__instruction";
    instruction.innerHTML = sanitizeInstructionHtml(step.instruction || "");

    const selector = document.createElement("code");
    selector.textContent = step.selector;

    item.append(header, instruction, selector);

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

    item.addEventListener("click", async () => {
      openStepEditor(step);
      await highlightEditorStep(step);
    });
    item.addEventListener("keydown", async (event) => {
      if (event.target !== item) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openStepEditor(step);
        await highlightEditorStep(step);
      }
    });

    stepsList.appendChild(item);
  });
}

selectButton.addEventListener("click", async () => {
  try {
    await window.messagingService.sendToAllFrames({ type: "GWTP_CLEAR_HIGHLIGHT" }).catch(() => {});
    activeStepId = null;
    markActiveStep(null);
    const responses = await window.messagingService.sendToAllFrames({ type: "GWTP_START_ELEMENT_PICKER" });
    const started = responses.some((item) => item.response?.success);
    setStatus(started ? "Selection mode active." : "Could not start selection mode.", started ? "info" : "error");
  } catch (error) {
    setStatus(
      "This page cannot currently be controlled. Try a regular http/https page and reload it after updating the extension.",
      "error"
    );
    console.error(error);
  }
});

async function persistExistingGuide() {
  if (!editingGuideId) return;

  const topicId = Number(topicSelect.value);
  const guideName = guideNameInput.value.trim();
  const startUrl = guideStartUrlInput.value.trim();
  const steps = window.trainingService.getSteps();

  if (!topicId || !guideName || !startUrl) {
    throw new Error("Guide details are incomplete.");
  }

  await window.apiService.request(`/api/guides/${editingGuideId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topicId,
      name: guideName,
      startUrl,
      isAvailable: guideAvailableInput.checked,
      steps: steps.map((step) => ({
        id: step.persistedId || null,
        selector: step.selector,
        instruction: step.instruction,
        frame: step.element?.frame || null,
        validation: step.validation || null
      }))
    })
  });
}

saveStepButton.addEventListener("click", async () => {
  const language = window.i18nService.getLanguage();

  if (!topicSelect.value) {
    setStatus(window.i18nService.translate("guideTopicRequired", language), "error");
    topicSelect.focus();
    return;
  }

  if (!guideNameInput.value.trim()) {
    setStatus(window.i18nService.translate("guideNameRequired", language), "error");
    guideNameInput.focus();
    return;
  }

  const instruction = getInstructionHtml();
  const selector = selectorInput.value.trim();

  if (!currentSelectedElement) {
    setStatus(window.i18nService.translate("stepElementRequired", language), "error");
    return;
  }

  if (!hasInstructionContent()) {
    setStatus(window.i18nService.translate("stepInstructionRequired", language), "error");
    instructionInput.focus();
    return;
  }

  if (!(await validateSelectedStepElement())) {
    setStatus(window.i18nService.translate("stepElementInvalid", language), "error");
    return;
  }

  let validation;
  try {
    validation = buildStepValidation();
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }

  try {
    const step = editingStepId
      ? window.trainingService.updateStep(editingStepId, {
          selector,
          instruction,
          element: currentSelectedElement,
          validation
        })
      : window.trainingService.createStep({
          selector,
          instruction,
          element: currentSelectedElement,
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
validationTypeSelect.addEventListener("change", () => { updateValidationBuilder(); updateStepSaveValidity(); });
validationValueInput.addEventListener("input", updateStepSaveValidity);
validationErrorInput.addEventListener("input", updateStepSaveValidity);

removeSelectedElementButton.addEventListener("click", () => {
  currentSelectedElement = null;
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
  const startUrl = guideStartUrlInput.value.trim();
  const steps = window.trainingService.getSteps();
  const language = window.i18nService.getLanguage();

  if (!topicId) {
    saveGuideStatus.textContent = window.i18nService.translate("guideTopicRequired", language);
    saveGuideStatus.dataset.type = "error";
    topicSelect.focus();
    return;
  }

  if (!guideName) {
    saveGuideStatus.textContent = window.i18nService.translate("guideNameRequired", language);
    saveGuideStatus.dataset.type = "error";
    guideNameInput.focus();
    return;
  }

  if (!startUrl) {
    saveGuideStatus.textContent = window.i18nService.translate("guideStartUrlRequired", language);
    saveGuideStatus.dataset.type = "error";
    guideStartUrlInput.focus();
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
        startUrl: startUrl || null,
        isAvailable: guideAvailableInput.checked,
        steps: steps.map((step) => ({
          id: step.persistedId || null,
          selector: step.selector,
          instruction: step.instruction,
          frame: step.element?.frame || null,
          validation: step.validation || null
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

guideStartUrlInput.addEventListener("input", () => {
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
  if (message?.type === "GWTP_ELEMENT_SELECTED") {
    const element = message.element;
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
    setStatus(window.i18nService.translate("elementSelectionCancelled", window.i18nService.getLanguage()));
  }
});


async function handleLogin() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    loginStatus.textContent = window.i18nService.translate("invalidPassword", window.i18nService.getLanguage());
    loginStatus.dataset.type = "error";
    return;
  }

  const result = await window.authService.authenticate(username, password);

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
      passwordInput.select();
    }

    return;
  }

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
  guideStartUrlInput.value = "";
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
    console.info("GWTP page cleanup skipped during logout:", error);
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

learnerTopicSelect.addEventListener("change", handleLearnerTopicChange);
learnerGuideSelect.addEventListener("change", handleLearnerGuideChange);
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const role = window.authService.getCurrentRole();

  if (role === "editor" && previewSession) {
    if (message?.type === "GWTP_PAGE_READY") {
      const current = {
        step: previewSession.steps[previewSession.stepIndex],
        stepIndex: previewSession.stepIndex,
        totalSteps: previewSession.steps.length,
        mode: "preview"
      };
      window.guideRunner.showCurrentStep(current).catch((error) => {
        console.info("GWTP preview restore skipped:", error);
      });
      return;
    }

    if (message?.type === "GWTP_PREVIEW_NEXT" || message?.type === "GWTP_PREVIEW_PREVIOUS") {
      const direction = message.type === "GWTP_PREVIEW_NEXT" ? 1 : -1;
      previewSession.stepIndex = Math.max(0, Math.min(previewSession.steps.length - 1, previewSession.stepIndex + direction));
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
    window.guideRunner.canShowStep(message.current)
      .then((success) => sendResponse({ success }))
      .catch(() => sendResponse({ success: false }));
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
    window.guideRunner.showCurrentStep(message.current).catch((error) => {
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
