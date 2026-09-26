(() => {
  const HOST_NAME = "com.gwtp.windows";
  let activePort = null;
  let activeRequestId = null;

  function pickTarget() {
    if (activePort) {
      return Promise.reject(new Error("A Windows target selection is already active."));
    }

    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const port = chrome.runtime.connectNative(HOST_NAME);
      activePort = port;
      activeRequestId = requestId;

      const cleanup = () => {
        if (activePort === port) {
          activePort = null;
          activeRequestId = null;
        }
        try { port.disconnect(); } catch {}
      };

      port.onMessage.addListener((message) => {
        if (message?.requestId !== requestId) return;

        if (message.type === "targetSelected") {
          cleanup();
          resolve(message.target);
        } else if (message.type === "selectionCancelled") {
          cleanup();
          resolve(null);
        } else if (message.type === "error") {
          cleanup();
          reject(new Error(message.code || "Windows Runtime returned an error."));
        }
      });

      port.onDisconnect.addListener(() => {
        if (activePort !== port) return;
        const detail = chrome.runtime.lastError?.message || "Windows Runtime disconnected.";
        activePort = null;
        activeRequestId = null;
        reject(new Error(detail));
      });

      port.postMessage({ type: "pickTarget", requestId });
    });
  }

  function cancelPick() {
    if (!activePort || !activeRequestId) return;
    activePort.postMessage({ type: "cancelPick", requestId: activeRequestId });
  }

  window.windowsBridgeService = { pickTarget, cancelPick };
})();
