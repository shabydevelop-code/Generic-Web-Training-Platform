(() => {
  const PERMISSIONS = Object.freeze({
    RUN_TRAINING: "training.run",
    CREATE_TRAINING: "training.create"
  });

  // Temporary local permissions for development.
  // In the future, these will be supplied by the backend after authentication.
  const currentPermissions = new Set([
    PERMISSIONS.RUN_TRAINING,
    PERMISSIONS.CREATE_TRAINING
  ]);

  function hasPermission(permission) {
    return currentPermissions.has(permission);
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
