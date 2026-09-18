(() => {
  let currentUser = null;
  let currentRole = null;
  let accessToken = null;
  const SESSION_KEY = "gwtp.auth.user";

  function applyUser(user) {
    currentUser = user;
    currentRole = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles[0] : null;
    accessToken = user?.accessToken || null;
  }

  async function saveSession(user) {
    await chrome.storage.local.set({ [SESSION_KEY]: user });
  }

  async function restoreSession() {
    const stored = await chrome.storage.local.get(SESSION_KEY);
    const user = stored[SESSION_KEY] || null;
    applyUser(user);
    return user;
  }

  async function authenticate(username, password) {
    try {
      const user = await window.apiService.request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      applyUser(user);
      await saveSession(user);
      return { success: true, user };
    } catch (error) {
      currentUser = null;
      currentRole = null;

      if (error?.status === 401) {
        return { success: false, reason: "invalidCredentials" };
      }

      if (error?.status == null) {
        return { success: false, reason: "serverUnavailable" };
      }

      return { success: false, reason: "serverError" };
    }
  }

  function getCurrentUser() {
    return currentUser;
  }

  function getCurrentRole() {
    return currentRole;
  }

  function getAccessToken() {
    return accessToken;
  }

  async function logout() {
    applyUser(null);
    await chrome.storage.local.remove(SESSION_KEY);
  }

  window.authService = Object.freeze({
    authenticate,
    restoreSession,
    getCurrentUser,
    getCurrentRole,
    getAccessToken,
    logout
  });
})();
