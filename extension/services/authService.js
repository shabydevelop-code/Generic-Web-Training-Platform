(() => {
  let currentUser = null;
  let currentRole = null;

  async function authenticate(username, password) {
    try {
      const user = await window.apiService.request("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      currentUser = user;
      currentRole = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles[0] : null;
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

  function logout() {
    currentUser = null;
    currentRole = null;
  }

  window.authService = Object.freeze({
    authenticate,
    getCurrentUser,
    getCurrentRole,
    logout
  });
})();
