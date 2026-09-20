chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GWTP_VALIDATE_ELEMENT") {
    if (!message.selector) {
      sendResponse({ success: false });
      return;
    }

    try {
      sendResponse({ success: Boolean(document.querySelector(message.selector)) });
    } catch {
      sendResponse({ success: false });
    }
    return;
  }

  if (message?.type === "GWTP_HIGHLIGHT_ELEMENT") {
    sendResponse(highlightElement(message.selector));
    return;
  }

  if (message?.type === "GWTP_CLEAR_HIGHLIGHT") {
    stopElementPicker();
    clearHighlight();
    clearTrainingStep();
    sendResponse({ success: true });
    return;
  }

  if (message?.type === "GWTP_START_ELEMENT_PICKER") {
    sendResponse(startElementPicker());
    return;
  }

  if (message?.type === "GWTP_CAN_SHOW_TRAINING_STEP") {
    const result = message.step?.selector ? findElement(message.step.selector) : { element: null };
    sendResponse({ success: Boolean(result?.element) && !result?.error });
    return;
  }

  if (message?.type === "GWTP_SHOW_TRAINING_STEP") {
    showTrainingStep(message.step, message.navigation)
      .then(sendResponse)
      .catch((error) => sendResponse({
        success: false,
        message: error?.message || "Could not show the training step."
      }));
    return true;
  }

  if (message?.type === "GWTP_CLEAR_TRAINING_STEP") {
    clearTrainingStep();
    sendResponse({ success: true });
  }
});


globalThis.__GWTP_CONTENT_READY__ = true;
chrome.runtime.sendMessage({ type: "GWTP_PAGE_READY" }).catch(() => {});
