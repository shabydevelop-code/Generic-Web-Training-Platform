const CUSTOMER_ID = 10082;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-360");
  form?.addEventListener("submit", async (event) => {
    if (event.submitter?.id === "btn-save-360") {
      event.preventDefault();
      await saveCustomer();
    }
  });

  document.getElementById("c360-tier")?.addEventListener("change", () => form?.requestSubmit());
  document.getElementById("c360-manager")?.addEventListener("change", () => form?.requestSubmit());

  initializeCustomer();
});

async function initializeCustomer() {
  const token = new URLSearchParams(location.search).get("state");
  if (token && await loadCustomerState(token)) return;
  await loadCustomer();
}

async function loadCustomerState(token) {
  try {
    const response = await fetch("/api/customer360-state/" + encodeURIComponent(token), { headers: { Accept: "application/json" } });
    if (!response.ok) return false;
    renderCustomer(await response.json());
    return true;
  } catch (error) {
    console.error("[Demo CRM] Unable to restore customer 360 state.", error);
    return false;
  }
}

async function loadCustomer() {
  try {
    const response = await fetch("/api/customers/" + CUSTOMER_ID, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HTTP " + response.status);
    renderCustomer(await response.json());
  } catch (error) {
    console.error("[Demo CRM] Unable to load customer 360.", error);
    alert("לא ניתן לטעון את נתוני הלקוח מהשרת.");
  }
}

async function saveCustomer() {
  clearValidationErrors();

  const payload = {
    name: value("c360-name"),
    tier: value("c360-tier"),
    mrr: value("c360-mrr"),
    manager: value("c360-manager")
  };

  try {
    const response = await fetch("/api/customers/" + CUSTOMER_ID, {
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
    console.error("[Demo CRM] Unable to save customer 360.", error);
    alert("לא ניתן לשמור את פרטי הלקוח.");
  }
}

function renderCustomer(data) {
  setValue("c360-acc-num", data.accountNumber);
  setValue("c360-name", data.name);
  setValue("c360-tier", data.tier);
  setValue("c360-mrr", data.mrr);
  setValue("c360-manager", data.manager);
  setValue("c360-credit-rating", data.creditRating);

  const titleName = document.getElementById("c360-title-name");
  if (titleName) titleName.textContent = data.name ?? "";

  const companyId = document.getElementById("c360-company-id");
  if (companyId) companyId.textContent = "ח.פ " + (data.companyId ?? "");

  const status = document.getElementById("c360-status-badge");
  if (status) {
    status.textContent = data.status ?? "";
    status.className = "ps-status-badge ps-status-active";
  }

  const tenure = document.getElementById("c360-tenure");
  if (tenure) tenure.textContent = data.tenure ?? "";

  const body = document.getElementById("c360-summary-body");
  if (!body) return;
  body.replaceChildren();

  for (const item of data.summary ?? []) {
    const row = document.createElement("tr");
    const values = [item.referenceNumber, item.type, item.service, item.status, item.date];
    values.forEach((text, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        const strong = document.createElement("strong");
        strong.textContent = text ?? "";
        cell.appendChild(strong);
      } else if (index === 3) {
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

function clearValidationErrors() {
  document.querySelectorAll(".ps-validation-error").forEach((element) => element.remove());
  document.querySelectorAll("[aria-invalid='true']").forEach((element) => element.removeAttribute("aria-invalid"));
}

function showValidationErrors(result) {
  clearValidationErrors();
  for (const [fieldId, message] of Object.entries(result?.errors ?? {})) {
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

function value(id) {
  return document.getElementById(id)?.value ?? "";
}

function setValue(id, nextValue) {
  const element = document.getElementById(id);
  if (element) element.value = nextValue ?? "";
}
