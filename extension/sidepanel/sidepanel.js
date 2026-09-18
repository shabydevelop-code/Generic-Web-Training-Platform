const selectorInput = document.getElementById("selectorInput");
const selectButton = document.getElementById("selectButton");
const topicSelect = document.getElementById("topicSelect");
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

let currentSelectedElement = null;
let activeStepId = null;
let adminModeActive = false;
let editingUserId = null;

function updateAuthenticatedView() {
  const role = window.authService.getCurrentRole();
  const isAdmin = role === "admin";
  const isEditor = role === "editor";
  const isLearner = role === "learner";

  const currentUser = window.authService.getCurrentUser();
  const language = window.i18nService.getLanguage();
  const roleLabel = window.i18nService.translate(`${role}Role`, language);
  currentUserName.textContent = currentUser?.displayName || currentUser?.username || "";
  currentUserRole.textContent = roleLabel;

  adminButton.hidden = true;
  adminView.hidden = !isAdmin;
  createModeView.hidden = !isEditor;
  learnModeView.hidden = !isLearner;
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
    });
  } catch (error) {
    topicStatus.textContent = window.i18nService.translate(
      error?.status == null ? "serverUnavailable" : "topicsLoadError",
      language
    );
    topicStatus.dataset.type = "error";
  }
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

    newTopicInput.value = "";
    await loadTopics();
    topicSelect.value = String(topic.id);
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

    item.append(title, instruction, selector);
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
  const instruction = instructionInput.value.trim();
  const selector = selectorInput.value.trim();

  if (!currentSelectedElement) {
    setStatus("Select an element before saving the step.", "error");
    return;
  }

  if (!instruction) {
    setStatus("Enter an instruction before saving the step.", "error");
    instructionInput.focus();
    return;
  }

  try {
    const step = window.trainingService.createStep({
      selector,
      instruction,
      element: currentSelectedElement
    });

    instructionInput.value = "";
    renderSteps();
    setStatus(`Step ${step.order} saved.`, "success");
  } catch (error) {
    setStatus(error.message || "Could not save the step.", "error");
    console.error(error);
  }
});

saveGuideButton.addEventListener("click", () => {
  const guideName = guideNameInput.value.trim();
  const steps = window.trainingService.getSteps();
  const language = window.i18nService.getLanguage();

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

  saveGuideStatus.textContent = window.i18nService.translate("guideReadyToSave", language);
  saveGuideStatus.dataset.type = "info";
});

guideNameInput.addEventListener("input", () => {
  saveGuideStatus.textContent = "";
  saveGuideStatus.removeAttribute("data-type");
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
  renderSteps();

  const restoredUser = await window.authService.restoreSession();

  if (restoredUser) {
    loginView.hidden = true;
    appView.hidden = false;
    adminModeActive = false;
    updateAuthenticatedView();
    await loadAdminUsers();
    await loadTopics();
  } else {
    loginView.hidden = false;
    appView.hidden = true;
    usernameInput.focus();
  }

  verifyApiConnection();
}

initializePanel();
