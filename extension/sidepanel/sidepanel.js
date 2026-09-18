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
const saveGuideButton = document.getElementById("saveGuideButton");
const saveGuideStatus = document.getElementById("saveGuideStatus");
const statusElement = document.getElementById("status");
const selectedElement = document.getElementById("selectedElement");
const selectedTag = document.getElementById("selectedTag");
const selectedSelector = document.getElementById("selectedSelector");
const stepEditor = document.getElementById("stepEditor");
const instructionInput = document.getElementById("instructionInput");
const saveStepButton = document.getElementById("saveStepButton");
const stepsSection = document.getElementById("stepsSection");
const stepsList = document.getElementById("stepsList");
const learnModeView = document.getElementById("learnModeView");
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
const topicsView = document.getElementById("topicsView");
const topicsList = document.getElementById("topicsList");
const openTopicsButton = document.getElementById("openTopicsButton");
const backFromTopicsButton = document.getElementById("backFromTopicsButton");
const editTopicEditor = document.getElementById("editTopicEditor");
const editTopicInput = document.getElementById("editTopicInput");
const saveTopicButton = document.getElementById("saveTopicButton");
const cancelEditTopicButton = document.getElementById("cancelEditTopicButton");
const editTopicStatus = document.getElementById("editTopicStatus");
let editingTopicId = null;
const guideLibraryView = document.getElementById("guideLibraryView");
const guideEditorView = document.getElementById("guideEditorView");
const guidesList = document.getElementById("guidesList");
const guidesStatus = document.getElementById("guidesStatus");
const openNewGuideButton = document.getElementById("openNewGuideButton");
const backToGuidesButton = document.getElementById("backToGuidesButton");
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


function openTopicEditor(topic) {
  closeTopicCreator();
  editingTopicId = topic.id;
  editTopicInput.value = topic.name;
  editTopicEditor.hidden = false;
  topicStatus.textContent = "";
  editTopicStatus.textContent = "";
  editTopicStatus.removeAttribute("data-type");
  editTopicInput.focus();
}

function closeTopicEditor() {
  editingTopicId = null;
  editTopicInput.value = "";
  editTopicEditor.hidden = true;
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
      await loadTopics();
      topicStatus.textContent = window.i18nService.translate("topicDeleted", language);
      topicStatus.dataset.type = "success";
    } catch (error) {
      topicStatus.textContent = window.i18nService.translate(
        error?.status === 409 ? "topicHasGuides" : error?.status == null ? "serverUnavailable" : "topicDeleteError",
        language
      );
      topicStatus.dataset.type = "error";
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

      const actions = document.createElement("div");
      actions.className = "guide-item__actions";

      const editButton = document.createElement("button");
      editButton.className = "guide-item__action";
      editButton.type = "button";
      editButton.textContent = window.i18nService.translate("editStepButton", language);
      editButton.addEventListener("click", () => openExistingGuide(guide.id));

      const deleteButton = document.createElement("button");
      deleteButton.className = "guide-item__action guide-item__action--danger";
      deleteButton.type = "button";
      deleteButton.textContent = window.i18nService.translate("deleteStepButton", language);
      deleteButton.addEventListener("click", () => {
        const message = window.i18nService.translate("confirmDeleteGuide", language).replace("{name}", guide.name);
        requestDeleteConfirmation(message, () => handleDeleteGuide(guide.id));
      });

      actions.append(editButton, deleteButton);
      item.append(name, meta, actions);
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

    topicSelect.value = String(guide.topicId);
    guideNameInput.value = guide.name;
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
  topicsView.hidden = true;
  topicSelect.value = "";
  guideNameInput.value = "";
  window.trainingService.clearSteps();
  activeStepId = null;
  editingStepId = null;
  renderSteps();
  updateGuideEditorValidity();
  guideLibraryView.hidden = true;
  guideEditorView.hidden = false;
}

function showGuideLibrary() {
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

  createUserButton.disabled = true;
  createUserStatus.textContent = "";

  try {
    await window.apiService.request("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, displayName, password, role })
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
  editUsername.textContent = user.username;
  editDisplayName.value = user.displayName || "";
  const isAdminUser = user.roles?.includes("admin");
  editRole.value = isAdminUser ? "editor" : (user.roles?.[0] || "learner");
  editRoleSection.hidden = isAdminUser;
  editNewPassword.value = "";
  editIsActive.checked = user.isActive;
  editActiveSection.hidden = isAdminUser;
  editUserStatus.textContent = "";
  editUserCard.hidden = false;
  editUserCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeUserEditor() {
  editingUserId = null;
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

    editUserStatus.textContent = window.i18nService.translate("userUpdated", language);
    editUserStatus.dataset.type = "success";
    await loadAdminUsers();
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
  if (window.authService.getCurrentRole() !== "admin") {
    return;
  }

  usersStatus.textContent = window.i18nService.translate("loadingUsers", window.i18nService.getLanguage());
  usersStatus.dataset.type = "info";
  usersList.replaceChildren();

  try {
    const users = await window.apiService.request("/api/users");

    users.forEach((user) => {
      const item = document.createElement("div");
      item.className = "user-item";
      const isAdminUser = Array.isArray(user.roles) && user.roles.includes("admin");

      if (!isAdminUser || user.id === window.authService.getCurrentUser()?.id) {
        item.classList.add("user-item--editable");
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.addEventListener("click", () => openUserEditor(user));
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openUserEditor(user);
          }
        });
      }

      const identity = document.createElement("div");
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
      role.textContent = Array.isArray(user.roles) && user.roles.length ? user.roles.join(", ") : "—";

      const state = document.createElement("span");
      state.textContent = window.i18nService.translate(user.isActive ? "userActive" : "userInactive", window.i18nService.getLanguage());

      meta.append(role, state);
      item.append(identity, meta);
      usersList.appendChild(item);
    });

    usersStatus.textContent = users.length
      ? ""
      : window.i18nService.translate("noUsers", window.i18nService.getLanguage());
  } catch (error) {
    usersStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "usersLoadError",
      window.i18nService.getLanguage()
    );
    usersStatus.dataset.type = "error";
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

      const actions = document.createElement("div");
      actions.className = "topic-card__actions";

      const editButton = document.createElement("button");
      editButton.className = "topic-card__action";
      editButton.type = "button";
      editButton.textContent = window.i18nService.translate("editTopicButton", language);
      editButton.addEventListener("click", () => openTopicEditor(topic));

      const deleteButton = document.createElement("button");
      deleteButton.className = "topic-card__action topic-card__action--danger";
      deleteButton.type = "button";
      deleteButton.textContent = window.i18nService.translate("deleteTopicButton", language);
      deleteButton.addEventListener("click", () => handleDeleteTopic(topic));

      actions.append(editButton, deleteButton);
      card.append(name, actions);
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

function updateGuideEditorValidity() {
  const hasTopic = Boolean(topicSelect.value);
  const hasGuideName = Boolean(guideNameInput.value.trim());
  const hasSteps = window.trainingService.getSteps().length > 0;
  const guideIdentityValid = hasTopic && hasGuideName;

  addStepButton.disabled = !guideIdentityValid;
  saveGuideButton.disabled = hasSteps && !guideIdentityValid;

  return guideIdentityValid;
}

function closeStepCreator() {
  editingStepId = null;
  currentSelectedElement = null;
  selectorInput.value = "";
  instructionInput.value = "";
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
  currentSelectedElement = null;
  selectorInput.value = "";
  instructionInput.value = "";
  selectedElement.hidden = true;
  stepEditor.hidden = false;
  selectButton.hidden = false;
  addStepButton.hidden = true;
  statusElement.textContent = "";
  statusElement.removeAttribute("data-type");
}

function openStepEditor(step) {
  if (!updateGuideEditorValidity()) return;

  editingStepId = step.id;
  currentSelectedElement = step.element || {
    tagName: "",
    text: ""
  };
  selectorInput.value = step.selector;
  instructionInput.value = step.instruction;
  selectedTag.textContent = step.element?.tagName ? `<${step.element.tagName}>${step.element.text ? ` — ${step.element.text}` : ""}` : "";
  selectedSelector.textContent = step.selector;
  selectedElement.hidden = false;
  stepEditor.hidden = false;
  selectButton.hidden = false;
  addStepButton.hidden = true;
  statusElement.textContent = "";
  statusElement.removeAttribute("data-type");
  instructionInput.focus();
}

function deleteDraftStep(stepId) {
  window.trainingService.deleteStep(stepId);
  if (activeStepId === stepId) activeStepId = null;
  if (editingStepId === stepId) closeStepCreator();
  renderSteps();
  updateGuideEditorValidity();
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

  if (steps.length === 0) {
    stepsSection.hidden = true;
    return;
  }

  stepsSection.hidden = false;

  steps.forEach((step) => {
    const item = document.createElement("div");
    item.className = "step-item";
    item.dataset.stepId = step.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Run Step ${step.order}`);
    item.setAttribute("aria-pressed", String(step.id === activeStepId));

    if (step.id === activeStepId) {
      item.classList.add("step-item--active");
    }

    const title = document.createElement("strong");
    title.textContent = `Step ${step.order}`;

    const instruction = document.createElement("p");
    instruction.textContent = step.instruction;

    const selector = document.createElement("code");
    selector.textContent = step.selector;

    const actions = document.createElement("div");
    actions.className = "step-item__actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "step-action";
    editButton.textContent = window.i18nService.translate("editStepButton", window.i18nService.getLanguage());
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openStepEditor(step);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "step-action step-action--danger";
    deleteButton.textContent = window.i18nService.translate("deleteStepButton", window.i18nService.getLanguage());
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteDraftStep(step.id);
    });

    actions.append(editButton, deleteButton);
    item.append(title, instruction, selector, actions);
    item.addEventListener("click", () => runStep(step));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        runStep(step);
      }
    });

    stepsList.appendChild(item);
  });
}

selectButton.addEventListener("click", async () => {
  try {
    const response = await window.messagingService.sendToActivePage({ type: "GWTP_START_ELEMENT_PICKER" });
    setStatus(response?.message || "Selection mode active.");
  } catch (error) {
    setStatus(
      "This page cannot currently be controlled. Try a regular http/https page and reload it after updating the extension.",
      "error"
    );
    console.error(error);
  }
});

saveStepButton.addEventListener("click", () => {
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

  const instruction = instructionInput.value.trim();
  const selector = selectorInput.value.trim();

  if (!currentSelectedElement) {
    setStatus(window.i18nService.translate("stepElementRequired", language), "error");
    return;
  }

  if (!instruction) {
    setStatus(window.i18nService.translate("stepInstructionRequired", language), "error");
    instructionInput.focus();
    return;
  }

  try {
    const step = editingStepId
      ? window.trainingService.updateStep(editingStepId, {
          selector,
          instruction,
          element: currentSelectedElement
        })
      : window.trainingService.createStep({
          selector,
          instruction,
          element: currentSelectedElement
        });

    renderSteps();
    updateGuideEditorValidity();
    closeStepCreator();
    setStatus(`Step ${step.order} saved.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not save the step.", "error");
    console.error(error);
  }
});

saveGuideButton.addEventListener("click", async () => {
  const topicId = Number(topicSelect.value);
  const guideName = guideNameInput.value.trim();
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

  if (steps.length === 0) {
    saveGuideStatus.textContent = window.i18nService.translate("guideStepsRequired", language);
    saveGuideStatus.dataset.type = "error";
    return;
  }

  saveGuideButton.disabled = true;
  saveGuideStatus.textContent = "";

  try {
    await window.apiService.request("/api/guides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicId,
        name: guideName,
        steps: steps.map((step) => ({
          selector: step.selector,
          instruction: step.instruction
        }))
      })
    });

    saveGuideStatus.textContent = window.i18nService.translate("guideSaved", language);
    saveGuideStatus.dataset.type = "success";
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

guideNameInput.addEventListener("input", () => {
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
  updateGuideEditorValidity();

  if (window.trainingService.getSteps().length > 0 && !guideNameInput.value.trim()) {
    saveGuideStatus.textContent = window.i18nService.translate("guideNameRequired", window.i18nService.getLanguage());
    saveGuideStatus.dataset.type = "error";
  }
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
    selectedElement.hidden = false;
    stepEditor.hidden = false;
    instructionInput.focus();
    setStatus("Element selected successfully.", "success");
    return;
  }

  if (message?.type === "GWTP_ELEMENT_SELECTION_CANCELLED") {
    setStatus("Element selection cancelled.");
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
}

async function handleLogout() {
  await window.authService.logout();
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

openTopicsButton.addEventListener("click", openTopics);
backFromTopicsButton.addEventListener("click", closeTopics);
cancelDeleteButton.addEventListener("click", closeDeleteConfirmation);
confirmDeleteButton.addEventListener("click", confirmPendingDelete);
deleteConfirmOverlay.addEventListener("click", (event) => {
  if (event.target === deleteConfirmOverlay) closeDeleteConfirmation();
});
openNewGuideButton.addEventListener("click", openNewGuide);
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

async function verifyApiConnection() {
  try {
    const health = await window.apiService.healthCheck();
    console.info("GWTP API connected:", health);
  } catch (error) {
    console.error("GWTP API connection failed:", error);
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

  if (restoredUser) {
    loginView.hidden = true;
    appView.hidden = false;
    adminModeActive = false;
    updateAuthenticatedView();
    await loadAdminUsers();
    await loadTopics();
    await loadGuides();
  } else {
    loginView.hidden = false;
    appView.hidden = true;
    usernameInput.focus();
  }

  verifyApiConnection();
}

initializePanel();
