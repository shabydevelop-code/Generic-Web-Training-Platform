(() => {
  const translations = Object.freeze({
    en: Object.freeze({
      loginTitle: "Sign in",
      loginDescription: "Enter your access password to continue.",
      passwordLabel: "Password",
      passwordPlaceholder: "Enter password",
      continueButton: "Continue"
    }),
    he: Object.freeze({
      loginTitle: "כניסה",
      loginDescription: "הזן את סיסמת הגישה כדי להמשיך.",
      passwordLabel: "סיסמה",
      passwordPlaceholder: "הזן סיסמה",
      continueButton: "המשך"
    })
  });

  function getLanguage() {
    const browserLanguage = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
    return browserLanguage.toLowerCase().startsWith("he") ? "he" : "en";
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
