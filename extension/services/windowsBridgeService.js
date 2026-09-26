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

  let previewPort = null;

  function ensurePreviewPort() {
    if (previewPort) return previewPort;
    previewPort = chrome.runtime.connectNative(HOST_NAME);
    previewPort.onMessage.addListener((message) => {
      if (message?.type === "navigationRequested") {
        window.dispatchEvent(new CustomEvent("gwtp-windows-preview-navigation", {
          detail: { direction: message.direction }
        }));
      }
    });
    previewPort.onDisconnect.addListener(() => { previewPort = null; });
    return previewPort;
  }

  function requestPreview(message, expectedType) {
    return new Promise((resolve, reject) => {
      const port = ensurePreviewPort();
      const requestId = crypto.randomUUID();

      const onMessage = (response) => {
        if (response?.requestId !== requestId || response?.type !== expectedType) return;
        port.onMessage.removeListener(onMessage);
        resolve(response);
      };
      port.onMessage.addListener(onMessage);
      try {
        port.postMessage({ ...message, requestId });
      } catch (error) {
        port.onMessage.removeListener(onMessage);
        reject(error);
      }
    });
  }

  async function canShowStep(step) {
    if (!step?.windowsTarget) return false;
    const response = await requestPreview({
      type: "canShowStep",
      target: step.windowsTarget
    }, "stepAvailability");
    return response?.success === true;
  }

  async function showStep(step) {
    const response = await requestPreview({
      type: "showStep",
      target: step?.windowsTarget,
      instruction: step?.instruction || "",
      canPrevious: Boolean(step?.navigation?.canPrevious),
      canNext: Boolean(step?.navigation?.canNext)
    }, "stepShown");
    return response;
  }

  async function clearStep(options = {}) {
    if (!previewPort) return { success: true };
    const response = await requestPreview({
      type: "clearStep",
      restorePreviousForeground: options.restorePreviousForeground === true
    }, "stepCleared");
    try { previewPort.disconnect(); } catch {}
    previewPort = null;
    return response;
  }

  window.windowsBridgeService = { pickTarget, cancelPick, canShowStep, showStep, clearStep };
})();
