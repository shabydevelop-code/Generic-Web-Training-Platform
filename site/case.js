const CASE_ID = 55891;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-case");
  form?.addEventListener("submit", async (event) => {
    if (event.submitter?.id === "btn-save-case") {
      event.preventDefault();
      await saveCase();
    }
  });
  document.getElementById("case-category")?.addEventListener("change", () => form?.requestSubmit());
  document.getElementById("case-assigned")?.addEventListener("change", () => form?.requestSubmit());
  document.getElementById("btn-escalate-case")?.addEventListener("click", escalateCase);
  initializeCase();
});

async function initializeCase() {
  const token = new URLSearchParams(location.search).get("state");
  if (token && await loadCaseState(token)) {
    history.replaceState(null, "", location.pathname);
    return;
  }
  await loadCase();
}

async function loadCaseState(token) {
  try {
    const response = await fetch("/api/case-state/" + encodeURIComponent(token), { headers: { Accept: "application/json" } });
    if (!response.ok) return false;
    renderCase(await response.json());
    return true;
  } catch (error) {
    console.error("[Demo CRM] Unable to restore case state.", error);
    return false;
  }
}

async function loadCase() {
  try {
    const response = await fetch("/api/cases/" + CASE_ID, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    renderCase(await response.json());
  } catch (error) { console.error("[Demo CRM] Unable to load case.", error); alert("לא ניתן לטעון את נתוני הפניה מהשרת."); }
}

async function saveCase() {
  clearValidationErrors();
  const payload = { customer: value("case-customer"), site: value("case-site"), category: value("case-category"), assigned: value("case-assigned"), subject: value("case-subject"), notes: value("case-notes") };
  try {
    const response = await fetch("/api/cases/" + CASE_ID, { method: "PUT", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) {
      if (response.status === 400) {
        showValidationErrors(await response.json());
        return;
      }
      throw new Error("HTTP " + response.status);
    }
    location.href = location.pathname;
  } catch (error) { console.error("[Demo CRM] Unable to save case.", error); alert("לא ניתן לשמור את הפניה."); }
}

async function escalateCase() {
  try {
    const response = await fetch("/api/cases/" + CASE_ID + "/escalate", { method: "POST" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    location.href = location.pathname;
  } catch (error) { console.error("[Demo CRM] Unable to escalate case.", error); alert("לא ניתן להסלים את הפניה."); }
}

function renderCase(data) {
  setValue("case-id", data.caseNumber); setValue("case-customer", data.customer); setValue("case-site", data.site); setValue("case-category", data.category); setValue("case-assigned", data.assigned); setValue("case-sla", data.sla); setValue("case-subject", data.subject); setValue("case-notes", data.notes);
  const status = document.getElementById("case-status-badge"); if (status) { status.textContent = data.status; status.className = "ps-status-badge ps-status-pending"; }
  const priority = document.getElementById("case-priority"); if (priority) priority.textContent = "עדיפות: " + data.priority;
  const body = document.getElementById("case-history-body"); if (body) { body.replaceChildren(); for (const item of data.history ?? []) { const row = document.createElement("tr"); for (const text of [item.occurredAt, item.actor, item.actionType, item.description]) { const cell = document.createElement("td"); cell.textContent = text ?? ""; row.appendChild(cell); } body.appendChild(row); } }
}

function value(id) { return document.getElementById(id)?.value ?? ""; }
function setValue(id, nextValue) { const element = document.getElementById(id); if (element) element.value = nextValue ?? ""; }


function clearValidationErrors() {
  document.querySelectorAll(".ps-validation-error").forEach((element) => element.remove());
  document.querySelectorAll("[aria-invalid='true']").forEach((element) => element.removeAttribute("aria-invalid"));
}

function showValidationErrors(result) {
  clearValidationErrors();
  const errors = result?.errors ?? {};
  for (const [fieldId, message] of Object.entries(errors)) {
    const field = document.getElementById(fieldId);
    if (!field) continue;
    field.setAttribute("aria-invalid", "true");
    const error = document.createElement("div");
    error.className = "ps-validation-error";
    error.textContent = message;
    field.insertAdjacentElement("afterend", error);
  }
  alert(result?.message ?? "לא ניתן לשמור. יש לתקן את השדות המסומנים.");
}
