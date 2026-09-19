const CASE_ID = 55891;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("form-case")?.addEventListener("submit", async (event) => { event.preventDefault(); await saveCase(); });
  document.getElementById("btn-escalate-case")?.addEventListener("click", escalateCase);
  loadCase();
});

async function loadCase() {
  try {
    const response = await fetch("/api/cases/" + CASE_ID, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    renderCase(await response.json());
  } catch (error) { console.error("[Demo CRM] Unable to load case.", error); alert("לא ניתן לטעון את נתוני הפניה מהשרת."); }
}

async function saveCase() {
  const payload = { customer: value("case-customer"), site: value("case-site"), category: value("case-category"), assigned: value("case-assigned"), subject: value("case-subject"), notes: value("case-notes") };
  try {
    const response = await fetch("/api/cases/" + CASE_ID, { method: "PUT", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("HTTP " + response.status);
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
