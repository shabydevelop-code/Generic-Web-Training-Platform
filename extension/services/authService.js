(() => {
  let currentRole = null;

  function hexToBytes(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g) || [], (byte) => parseInt(byte, 16));
  }

  function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt, iterations) {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: hexToBytes(salt),
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

    return bytesToHex(bits);
  }

  async function authenticate(password) {
    const authConfig = window.appConfig.authentication;

    for (const [role, credential] of Object.entries(authConfig.credentials)) {
      const candidateHash = await hashPassword(password, credential.salt, authConfig.iterations);

      if (candidateHash === credential.hash) {
        currentRole = role;
        return role;
      }
    }

    currentRole = null;
    return null;
  }

  function getCurrentRole() {
    return currentRole;
  }

  window.authService = Object.freeze({
    authenticate,
    getCurrentRole
  });
})();
