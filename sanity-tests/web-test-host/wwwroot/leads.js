const LEAD_ID = 3094;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-lead");
  form?.addEventListener("submit", async (event) => {
    if (event.submitter?.id === "btn-save-lead") {
      event.preventDefault();
      await saveLead();
    }
  });
  document.getElementById("lead-source")?.addEventListener("change", () => form?.requestSubmit());
  document.getElementById("lead-interest")?.addEventListener("change", () => form?.requestSubmit());
  document.getElementById("btn-convert-lead")?.addEventListener("click", convertLead);
  initializeLead();
});

async function initializeLead() {
  const token = new URLSearchParams(location.search).get("state");
  if (token && await loadLeadState(token)) {
    history.replaceState(null, "", location.pathname);
    return;
  }
  await loadLead();
}

async function loadLeadState(token) {
  try {
    const response = await fetch("/api/lead-state/" + encodeURIComponent(token), { headers: { Accept: "application/json" } });
    if (!response.ok) return false;
    renderLead(await response.json());
    return true;
  } catch (error) {
    console.error("[Demo CRM] Unable to restore lead state.", error);
    return false;
  }
}

async function loadLead() {
  try {
    const response = await fetch("/api/leads/" + LEAD_ID, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    renderLead(await response.json());
  } catch (error) {
    console.error("[Demo CRM] Unable to load lead.", error);
    alert("לא ניתן לטעון את נתוני הליד מהשרת.");
  }
}

async function saveLead() {
  clearValidationErrors();
  const payload = {
    company: value("lead-company"),
    contactName: value("lead-contact-name"),
    email: value("lead-email"),
    source: value("lead-source"),
    interest: value("lead-interest")
  };

  try {
    const response = await fetch("/api/leads/" + LEAD_ID, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      if (response.status === 400) {
        showValidationErrors(await response.json());
        return;
      }
      throw new Error("HTTP " + response.status);
    }
    location.href = location.pathname;
  } catch (error) {
    console.error("[Demo CRM] Unable to save lead.", error);
    alert("לא ניתן לשמור את הליד.");
  }
}

async function convertLead() {
  try {
    const response = await fetch("/api/leads/" + LEAD_ID + "/convert", { method: "POST" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    location.href = "customer360.html";
  } catch (error) {
    console.error("[Demo CRM] Unable to convert lead.", error);
    alert("לא ניתן להמיר את הליד ללקוח.");
  }
}

function renderLead(data) {
  setValue("lead-id", data.leadNumber);
  setValue("lead-company", data.company);
  setValue("lead-contact-name", data.contactName);
  setValue("lead-email", data.email);
  setValue("lead-source", data.source);
  setValue("lead-interest", data.interest);

  const status = document.getElementById("lead-status-badge");
  if (status) {
    status.textContent = data.status;
    status.className = "ps-status-badge ps-status-active";
  }

  const potential = document.getElementById("lead-potential");
  if (potential) potential.textContent = "פוטנציאל עסקה: " + data.potential;

  const count = document.getElementById("leads-count");
  if (count) count.textContent = (data.pipeline?.length ?? 0) + " לידים בתהליך";

  const body = document.getElementById("leads-table-body");
  if (!body) return;
  body.replaceChildren();

  for (const item of data.pipeline ?? []) {
    const row = document.createElement("tr");
    const values = [item.leadNumber, item.company, item.contactName, item.sourceLabel, item.stage, item.createdAt];
    values.forEach((text, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        const strong = document.createElement("strong");
        strong.textContent = text ?? "";
        cell.appendChild(strong);
      } else if (index === 4) {
        const badge = document.createElement("span");
        badge.className = "ps-status-badge " + (item.statusClass ?? "ps-status-active");
        badge.textContent = text ?? "";
        cell.appendChild(badge);
      } else {
        cell.textContent = text ?? "";
      }
      row.appendChild(cell);
    });
    body.appendChild(row);
  }
}

function value(id) {
  return document.getElementById(id)?.value ?? "";
}

function setValue(id, nextValue) {
  const element = document.getElementById(id);
  if (element) element.value = nextValue ?? "";
}


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
