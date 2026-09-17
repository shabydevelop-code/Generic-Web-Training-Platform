chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GWTP_HIGHLIGHT_ELEMENT") {
    sendResponse(highlightElement(message.selector));
    return;
  }

  if (message?.type === "GWTP_CLEAR_HIGHLIGHT") {
    stopElementPicker();
    clearHighlight();
    sendResponse({ success: true });
    return;
  }

  if (message?.type === "GWTP_START_ELEMENT_PICKER") {
    sendResponse(startElementPicker());
  }
});
