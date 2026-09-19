const SITE_ID = 77402;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("form-site");
  const refreshButton = document.getElementById("btn-refresh-site");
  const typeSelect = document.getElementById("site-type");
  const cityInput = document.getElementById("site-city");

  form?.addEventListener("submit", async (event) => {
    if (event.submitter?.id === "btn-save-site") {
      event.preventDefault();
      await saveSite();
    }
  });

  const submitFieldChange = () => form?.requestSubmit();
  typeSelect?.addEventListener("change", submitFieldChange);
  cityInput?.addEventListener("change", submitFieldChange);

  refreshButton?.addEventListener("click", () => {
    location.reload();
  });

  initializeSite();
});


async function initializeSite() {
  const params = new URLSearchParams(location.search);
  const stateToken = params.get("state");
  const message = params.get("message");

  if (message) {
    params.delete("message");
    const cleanQuery = params.toString();
    history.replaceState(null, "", `${location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`);
  }

  if (stateToken) {
    const restored = await loadServerState(stateToken);
    if (restored) {
      history.replaceState(null, "", location.pathname);
      showServerMessageAfterPageLoad(message);
      return;
    }
  }

  await loadSite();
  showServerMessageAfterPageLoad(message);
}

async function loadServerState(token) {
  try {
    const response = await fetch(`/api/site-state/${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      return false;
    }

    const state = await response.json();
    setValue("site-code", state.code);
    setValue("site-name", state.name);
    setValue("site-type", state.type);
    setValue("site-city", state.city);
    setValue("site-contact-name", state.contactName);
    setValue("site-phone", state.phone);

    const siteResponse = await fetch(`/api/sites/${SITE_ID}`, {
      headers: { Accept: "application/json" }
    });

    if (siteResponse.ok) {
      const persistedSite = await siteResponse.json();
      renderSiteMetadata(persistedSite);
      renderAssets(Array.isArray(persistedSite.assets) ? persistedSite.assets : []);
    }

    return true;
  } catch (error) {
    console.error("[Demo CRM] Unable to restore server form state.", error);
    return false;
  }
}

function showServerMessageAfterPageLoad(message) {
  if (!message) {
    return;
  }

  const splash = document.getElementById("splash-screen");

  const showAlertWhenSplashIsGone = () => {
    const splashStyle = splash ? getComputedStyle(splash) : null;
    const splashIsVisible = splash &&
      splashStyle &&
      splashStyle.visibility !== "hidden" &&
      Number.parseFloat(splashStyle.opacity || "1") > 0;

    if (splashIsVisible) {
      requestAnimationFrame(showAlertWhenSplashIsGone);
      return;
    }

    requestAnimationFrame(() => {
      alert(message);
    });
  };

  showAlertWhenSplashIsGone();
}

async function loadSite() {
  try {
    const response = await fetch(`/api/sites/${SITE_ID}`, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Failed to load site: HTTP ${response.status}`);
    }

    const site = await response.json();
    renderSite(site);
  } catch (error) {
    console.error("[Demo CRM] Unable to load site data.", error);
    alert("לא ניתן לטעון את נתוני האתר מהשרת.");
  }
}

async function saveSite() {
  clearValidationErrors();
  const payload = {
    code: getValue("site-code"),
    name: getValue("site-name"),
    type: getValue("site-type"),
    city: getValue("site-city"),
    contactName: getValue("site-contact-name"),
    phone: getValue("site-phone")
  };

  try {
    const response = await fetch(`/api/sites/${SITE_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      if (response.status === 400) {
        showValidationErrors(await response.json());
        return;
      }
      throw new Error(`Failed to save site: HTTP ${response.status}`);
    }

    location.reload();
  } catch (error) {
    console.error("[Demo CRM] Unable to save site data.", error);
    alert("לא ניתן לשמור את נתוני האתר.");
  }
}

function renderSite(site) {
  setValue("site-code", site.code);
  setValue("site-name", site.name);
  setValue("site-type", site.type);
  setValue("site-city", site.city);
  setValue("site-contact-name", site.contactName);
  setValue("site-phone", site.phone);

  renderSiteMetadata(site);
  renderAssets(Array.isArray(site.assets) ? site.assets : []);
}

function renderSiteMetadata(site) {
  const systemId = document.getElementById("site-system-id");
  if (systemId) {
    systemId.textContent = `מזהה מערכת: ${site.systemId}`;
  }

  const statusBadge = document.getElementById("site-status-badge");
  if (statusBadge) {
    statusBadge.textContent = site.status === "active" ? "פעיל ומחובר" : site.status;
    statusBadge.className = `ps-status-badge ${site.status === "active" ? "ps-status-active" : "ps-status-pending"}`;
  }
}

function renderAssets(assets) {
  const body = document.getElementById("site-assets-body");
  const count = document.getElementById("site-assets-count");

  if (count) {
    count.textContent = `${assets.length} פריטים מותקנים`;
  }

  if (!body) {
    return;
  }

  body.replaceChildren();

  for (const asset of assets) {
    const row = document.createElement("tr");

    const serialCell = document.createElement("td");
    const serial = document.createElement("strong");
    serial.textContent = asset.serialNumber;
    serialCell.appendChild(serial);

    const descriptionCell = createTextCell(asset.description);
    const ipCell = createTextCell(asset.ipAddress);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `ps-status-badge ${asset.status === "active" ? "ps-status-active" : "ps-status-pending"}`;
    status.textContent = asset.status === "active" ? "תקין" : "דורש בדיקה";
    statusCell.appendChild(status);

    const dateCell = createTextCell(asset.installationDate);

    row.append(serialCell, descriptionCell, ipCell, statusCell, dateCell);
    body.appendChild(row);
  }
}

function createTextCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "";
  return cell;
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value ?? "";
  }
}

function getValue(id) {
  const element = document.getElementById(id);
  return element?.value ?? "";
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
