let gwtpTrainingOverlay = null;
let gwtpTrainingTarget = null;

function clearTrainingStep() {
  if (gwtpTrainingOverlay) {
    gwtpTrainingOverlay.remove();
    gwtpTrainingOverlay = null;
  }

  if (gwtpTrainingTarget) {
    gwtpTrainingTarget.style.removeProperty("outline");
    gwtpTrainingTarget.style.removeProperty("outline-offset");
    gwtpTrainingTarget = null;
  }
}

function showTrainingStep(step) {
  clearTrainingStep();
  clearHighlight();

  if (!step?.selector) {
    return { success: false, message: "Step selector is missing." };
  }

  let target;

  try {
    target = document.querySelector(step.selector);
  } catch {
    return { success: false, message: "Step selector is invalid." };
  }

  if (!target) {
    return { success: false, message: "Step element was not found on this page." };
  }

  gwtpTrainingTarget = target;
  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  target.style.setProperty("outline", "3px solid #2563eb", "important");
  target.style.setProperty("outline-offset", "3px", "important");

  const overlay = document.createElement("div");
  overlay.className = "gwtp-training-overlay";
  overlay.style.position = "fixed";
  overlay.style.zIndex = "2147483647";
  overlay.style.maxWidth = "320px";
  overlay.style.padding = "12px 14px";
  overlay.style.border = "1px solid #d0d5dd";
  overlay.style.borderRadius = "10px";
  overlay.style.background = "#ffffff";
  overlay.style.boxShadow = "0 8px 24px rgba(16, 24, 40, 0.18)";
  overlay.style.color = "#172033";
  overlay.style.font = "14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  overlay.textContent = step.instruction || `Step ${step.order || ""}`;

  document.documentElement.appendChild(overlay);
  gwtpTrainingOverlay = overlay;

  const positionOverlay = () => {
    if (!gwtpTrainingOverlay || !gwtpTrainingTarget) {
      return;
    }

    const rect = gwtpTrainingTarget.getBoundingClientRect();
    const overlayRect = gwtpTrainingOverlay.getBoundingClientRect();
    const gap = 10;

    let top = rect.bottom + gap;
    if (top + overlayRect.height > window.innerHeight - gap) {
      top = Math.max(gap, rect.top - overlayRect.height - gap);
    }

    let left = rect.left;
    left = Math.max(gap, Math.min(left, window.innerWidth - overlayRect.width - gap));

    gwtpTrainingOverlay.style.top = `${top}px`;
    gwtpTrainingOverlay.style.left = `${left}px`;
  };

  requestAnimationFrame(positionOverlay);

  return { success: true, message: `Step ${step.order || ""} is running.` };
}
