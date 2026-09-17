chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

  if (message?.type === "GWTP_SHOW_TRAINING_STEP") {
    sendResponse(showTrainingStep(message.step));
    return;
  }

  if (message?.type === "GWTP_CLEAR_TRAINING_STEP") {
    clearTrainingStep();
    sendResponse({ success: true });
  }
});
