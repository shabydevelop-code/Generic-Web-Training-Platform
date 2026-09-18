(() => {
  const translations = Object.freeze({
    en: Object.freeze({
      loginTitle: "Sign in",
      loginDescription: "Enter your username and password to continue.",
      usernameLabel: "Username",
      usernamePlaceholder: "Enter username",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter password",
      continueButton: "Continue",
      invalidPassword: "Incorrect username or password. Please try again.",
      serverUnavailable: "Cannot connect to the server. Make sure the service is running and try again.",
      serverError: "The server encountered an error. Please try again.",
      logoutButton: "Log out",
      adminButton: "Admin",
      backButton: "Back",
      adminTitle: "Administration",
      adminDescription: "Manage users and platform permissions.",
      userManagementTitle: "User Management",
      userManagementDescription: "User management tools will appear here."
    }),
    he: Object.freeze({
      loginTitle: "כניסה",
      loginDescription: "הזן שם משתמש וסיסמה כדי להמשיך.",
      usernameLabel: "שם משתמש",
      usernamePlaceholder: "הזן שם משתמש",
      passwordLabel: "סיסמה",
      passwordPlaceholder: "הזן סיסמה",
      continueButton: "המשך",
      invalidPassword: "שם המשתמש או הסיסמה שגויים. נסה שוב.",
      serverUnavailable: "לא ניתן להתחבר לשרת. ודא שהשירות פעיל ונסה שוב.",
      serverError: "אירעה שגיאה בשרת. נסה שוב.",
      logoutButton: "יציאה",
      adminButton: "ניהול",
      backButton: "חזרה",
      adminTitle: "ניהול מערכת",
      adminDescription: "ניהול משתמשים והרשאות במערכת.",
      userManagementTitle: "ניהול משתמשים",
      userManagementDescription: "כלי ניהול המשתמשים יופיעו כאן."
    })
  });

  function getLanguage() {
    const configuredLanguage = window.appConfig?.language;
    return configuredLanguage === "he" ? "he" : "en";
  }

  function translate(key, language) {
    return translations[language]?.[key] ?? translations.en[key] ?? key;
  }

  function applyDirection(language) {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "he" ? "rtl" : "ltr";
  }

  function applyTranslations(language) {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = translate(element.dataset.i18n, language);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = translate(element.dataset.i18nPlaceholder, language);
    });
  }

  function initialize() {
    const language = getLanguage();
    applyDirection(language);
    applyTranslations(language);
    return language;
  }

  window.i18nService = Object.freeze({
    initialize,
    getLanguage,
    translate
  });
})();
