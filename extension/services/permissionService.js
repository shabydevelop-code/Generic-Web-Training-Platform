(() => {
  const PERMISSIONS = Object.freeze({
    RUN_TRAINING: "training.run",
    CREATE_TRAINING: "training.create"
  });

  const ROLE_PERMISSIONS = Object.freeze({
    admin: Object.freeze([]),
    editor: Object.freeze([
      PERMISSIONS.RUN_TRAINING,
      PERMISSIONS.CREATE_TRAINING
    ]),
    learner: Object.freeze([
      PERMISSIONS.RUN_TRAINING
    ])
  });

  function hasPermission(permission) {
    const role = window.authService?.getCurrentRole();
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }

  function canRunTraining() {
    return hasPermission(PERMISSIONS.RUN_TRAINING);
  }

  function canCreateTraining() {
    return hasPermission(PERMISSIONS.CREATE_TRAINING);
  }

  window.permissionService = Object.freeze({
    PERMISSIONS,
    hasPermission,
    canRunTraining,
    canCreateTraining
  });
})();
