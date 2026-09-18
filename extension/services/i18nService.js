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
      logoutButton: "Log out"
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
      logoutButton: "יציאה"
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
