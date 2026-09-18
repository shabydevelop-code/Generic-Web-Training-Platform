(() => {
  const translations = Object.freeze({
    en: Object.freeze({
      elementSelectionTitle: "Element Selection",
      guideNameLabel: "Guide name",
      guideNamePlaceholder: "Enter guide name",
      elementSelectionDescription: "Select an element directly from the current web page or test a CSS selector manually.",
      selectElementButton: "Select element from page",
      selectedElementLabel: "Selected element",
      cssSelectorLabel: "CSS selector",
      highlightElementButton: "Highlight element",
      clearButton: "Clear",
      stepEditorTitle: "Create Step",
      instructionLabel: "Instruction",
      instructionPlaceholder: "Type the instruction for this step...",
      saveStepButton: "Save Step",
      stepsTitle: "Steps",
      saveGuideButton: "Save Guide",
      guideNameRequired: "Enter a guide name.",
      guideStepsRequired: "Add at least one step before saving.",
      guideReadyToSave: "Guide is ready to save.",
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
      createUserTitle: "Create User",
      newUserButton: "+ New user",
      displayNameLabel: "Display name",
      displayNameOptionalLabel: "Display name (optional)",
      roleLabel: "Role",
      editorRole: "Editor",
      learnerRole: "Learner",
      createUserButton: "Create user",
      createUserRequired: "Username and password are required.",
      userCreated: "User created successfully.",
      usernameExists: "This username already exists.",
      createUserError: "Could not create the user.",
      userManagementTitle: "User Management",
      userManagementDescription: "Users registered in the platform.",
      loadingUsers: "Loading users...",
      userActive: "Active",
      userInactive: "Inactive",
      noUsers: "No users found.",
      usersLoadError: "Could not load users.",
      editUserTitle: "Edit User",
      newPasswordLabel: "New password",
      newPasswordPlaceholder: "Leave empty to keep current password",
      activeUserLabel: "Active user",
      saveChangesButton: "Save changes",
      cancelButton: "Close",
      userUpdated: "User updated successfully.",
      updateUserError: "Could not update the user."
    }),
    he: Object.freeze({
      elementSelectionTitle: "בחירת אלמנט",
      guideNameLabel: "שם המדריך",
      guideNamePlaceholder: "הזן שם מדריך",
      elementSelectionDescription: "בחר אלמנט ישירות מהעמוד הנוכחי או בדוק בורר CSS באופן ידני.",
      selectElementButton: "בחר אלמנט מהעמוד",
      selectedElementLabel: "אלמנט שנבחר",
      cssSelectorLabel: "בורר CSS",
      highlightElementButton: "הדגש אלמנט",
      clearButton: "נקה",
      stepEditorTitle: "יצירת שלב",
      instructionLabel: "הנחיה",
      instructionPlaceholder: "הזן את ההנחיה לשלב...",
      saveStepButton: "שמור שלב",
      stepsTitle: "שלבים",
      saveGuideButton: "שמור מדריך",
      guideNameRequired: "יש להזין שם מדריך.",
      guideStepsRequired: "יש להוסיף לפחות שלב אחד לפני השמירה.",
      guideReadyToSave: "המדריך מוכן לשמירה.",
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
      createUserTitle: "יצירת משתמש",
      newUserButton: "+ משתמש חדש",
      displayNameLabel: "שם תצוגה",
      displayNameOptionalLabel: "שם תצוגה (אופציונלי)",
      roleLabel: "תפקיד",
      editorRole: "עורך",
      learnerRole: "לומד",
      createUserButton: "צור משתמש",
      createUserRequired: "יש להזין שם משתמש וסיסמה.",
      userCreated: "המשתמש נוצר בהצלחה.",
      usernameExists: "שם המשתמש כבר קיים.",
      createUserError: "לא ניתן ליצור את המשתמש.",
      userManagementTitle: "ניהול משתמשים",
      userManagementDescription: "משתמשים הרשומים במערכת.",
      loadingUsers: "טוען משתמשים...",
      userActive: "פעיל",
      userInactive: "לא פעיל",
      noUsers: "לא נמצאו משתמשים.",
      usersLoadError: "לא ניתן לטעון את המשתמשים.",
      editUserTitle: "עריכת משתמש",
      newPasswordLabel: "סיסמה חדשה",
      newPasswordPlaceholder: "השאר ריק כדי לשמור את הסיסמה הקיימת",
      activeUserLabel: "משתמש פעיל",
      saveChangesButton: "שמור שינויים",
      cancelButton: "סגור",
      userUpdated: "המשתמש עודכן בהצלחה.",
      updateUserError: "לא ניתן לעדכן את המשתמש."
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
