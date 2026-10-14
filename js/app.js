import {
  createFeeling,
  watchFeelings,
  updateFeeling,
  deleteFeeling,
} from "./feelingsService.js";

// Install logic
let installPrompt = null;
const installBtn = document.querySelector("#installApp");
const installBtnMobile = document.querySelector("#installAppMobile");

function showInstallButtons() {
  if (installBtn) installBtn.hidden = false;
  if (installBtnMobile) installBtnMobile.hidden = false;
}

function hideInstallButtons() {
  if (installBtn) installBtn.hidden = true;
  if (installBtnMobile) installBtnMobile.hidden = true;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  showInstallButtons();
});

async function handleInstallClick() {
  if (!installPrompt) return;
  const result = await installPrompt.prompt();
  console.log("Install choice:", result.outcome);
  installPrompt = null;
  hideInstallButtons();
}

if (installBtn) installBtn.addEventListener("click", handleInstallClick);
if (installBtnMobile)
  installBtnMobile.addEventListener("click", handleInstallClick);

// Theme logic, dark mode is default
const THEME_KEY = "feelings-catcher-theme";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (err) {
    return null;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    // no localStorage yet - theme won't persist across reloads.
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const nextLabel =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
    btn.setAttribute("aria-label", nextLabel);
  });
  document.querySelectorAll(".theme-toggle-icon").forEach((icon) => {
    icon.textContent = theme === "dark" ? "light_mode" : "dark_mode";
  });
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";
  const next = current === "dark" ? "light" : "dark";
  setStoredTheme(next);
  applyTheme(next);
}

// Sync the toggle buttons/icons to whatever theme the head script already applied
applyTheme(
  document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark",
);

document.querySelectorAll(".theme-toggle-btn").forEach((btn) => {
  btn.addEventListener("click", toggleTheme);
});

// Form selectors
const form = document.querySelector("#add-feeling-form");
const list = document.querySelector("#feelings-list");
const statusMessage = document.querySelector("#feeling-status");
const countBadge = document.querySelector("#feeling-count");
const formTitle = document.querySelector("#form-title");
const saveButton = document.querySelector("#save-feeling");
const cancelEditButton = document.querySelector("#cancel-edit");
const feelingFormPanel = document.querySelector("#feeling-form");

let editingFeelingId = null;
let currentFeelings = [];

// Toast message
function showToast(message) {
  if (typeof M !== "undefined") {
    M.toast({ html: message });
  } else {
    console.log(message);
  }
}

// Helper function (clean data)
function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Feelings (not categories per lecture example)
function feelingDetails(tag) {
  const feelings = {
    anxiety: {
      icon: "psychology",
      iconClass: "purple-text text-darken-2",
      labelClass: "purple-text text-darken-2",
      label: "ANXIETY",
    },
    anger: {
      icon: "local_fire_department",
      iconClass: "red-text text-darken-2",
      labelClass: "red-text text-darken-2",
      label: "ANGER",
    },
    stress: {
      icon: "bolt",
      iconClass: "deep-orange-text text-darken-2",
      labelClass: "deep-orange-text text-darken-2",
      label: "STRESS",
    },
    fear: {
      icon: "warning",
      iconClass: "pink-text text-darken-2",
      labelClass: "pink-text text-darken-2",
      label: "FEAR",
    },
    sadness: {
      icon: "water_drop",
      iconClass: "blue-text text-darken-2",
      labelClass: "blue-text text-darken-2",
      label: "SADNESS",
    },
    calm: {
      icon: "spa",
      iconClass: "green-text text-darken-2",
      labelClass: "green-text text-darken-2",
      label: "CALM",
    },
    gratitude: {
      icon: "favorite",
      iconClass: "teal-text text-darken-2",
      labelClass: "teal-text text-darken-2",
      label: "GRATITUDE",
    },
    joy: {
      icon: "sentiment_satisfied",
      iconClass: "amber-text text-darken-2",
      labelClass: "amber-text text-darken-2",
      label: "JOY",
    },
    other: {
      icon: "label",
      iconClass: "grey-text text-darken-2",
      labelClass: "grey-text text-darken-2",
      label: "OTHER",
    },
  };

  return feelings[tag] || feelings.other;
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Saving...";
  }
  return timestamp.toDate().toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Render Feelings
function renderFeelings(feelings) {
  currentFeelings = feelings;
  if (!list || !statusMessage) return;

  if (countBadge) {
    countBadge.textContent = feelings.length;
    countBadge.setAttribute(
      "data-badge-caption",
      feelings.length === 1 ? "entry" : "entries",
    );
  }

  if (feelings.length === 0) {
    list.innerHTML = `
      <div class="card-panel white center-align">
        <p class="grey-text text-darken-1">
          No feelings caught yet. Tap + to add your first one.
        </p>
      </div>`;
    statusMessage.textContent = "";
    return;
  }

  list.innerHTML = feelings
    .map((feeling) => {
      const details = feelingDetails(feeling.feelingTag);
      const where = feeling.context
        ? `Logged from ${escapeHtml(feeling.context)} &nbsp;|&nbsp; `
        : "";

      return `
        <div class="card-panel white feeling-card">
          <div class="row valign-wrapper no-margin-bottom">
            <div class="col s3 m2 center-align">
              <i class="material-icons medium ${details.iconClass}">${details.icon}</i>
            </div>
            <div class="col s7 m8">
              <span class="${details.labelClass}"><strong>${details.label}</strong></span>
              <h5 class="black-text">${escapeHtml(feeling.title)}</h5>
              <p class="grey-text text-darken-1">${escapeHtml(feeling.entry)}</p>
              <p class="grey-text">
                <i class="material-icons tiny">schedule</i>
                ${where}${formatTimestamp(feeling.createdAt)}
              </p>
            </div>
            <div class="col s2 m2 right-align">
              <button
                class="btn-flat edit-feeling"
                type="button"
                data-id="${escapeHtml(feeling.id)}"
                aria-label="Edit ${escapeHtml(feeling.title)} entry"
              >
                <i class="material-icons grey-text text-darken-1">edit</i>
              </button>
              <button
                class="btn-flat delete-feeling"
                type="button"
                data-id="${escapeHtml(feeling.id)}"
                aria-label="Delete ${escapeHtml(feeling.title)} entry"
              >
                <i class="material-icons grey-text text-darken-1">delete_outline</i>
              </button>
            </div>
          </div>
        </div>`;
    })
    .join("");

  statusMessage.textContent = "";
}

// Click listener for both buttons with confirm before delete
if (list) {
  list.addEventListener("click", async (event) => {
    const editButton = event.target.closest(".edit-feeling");
    if (editButton) {
      startEdit(editButton.dataset.id);
      return;
    }

    const deleteButton = event.target.closest(".delete-feeling");
    if (!deleteButton) return;

    const id = deleteButton.dataset.id;
    const feeling = currentFeelings.find((item) => item.id === id);
    const title = feeling?.title || "this feeling";

    if (!window.confirm(`Delete ${title}?`)) return;

    try {
      deleteButton.disabled = true;
      await deleteFeeling(id);
      showToast("Feeling deleted.");
    } catch (error) {
      console.error("Could not delete feeling:", error);
      showToast("Could not delete the feeling.");
      deleteButton.disabled = false;
    }
  });
}

// Edit
function startEdit(id) {
  const feeling = currentFeelings.find((item) => item.id === id);
  if (!feeling || !form) return;

  editingFeelingId = id;

  form.querySelector("#title").value = feeling.title || "";
  form.querySelector("#feeling-tag").value = feeling.feelingTag || "";
  form.querySelector("#entry").value = feeling.entry || "";

  formTitle.textContent = "Edit Feeling";
  saveButton.innerHTML =
    'Save Changes <i class="material-icons right">save</i>';
  cancelEditButton.hidden = false;

  if (typeof M !== "undefined") {
    M.updateTextFields();
    M.textareaAutoResize(form.querySelector("#entry"));

    const tagSelect = form.querySelector("#feeling-tag");
    const selectInstance = M.FormSelect.getInstance(tagSelect);
    if (selectInstance) selectInstance.destroy();
    M.FormSelect.init(tagSelect);

    const panel = M.Sidenav.getInstance(feelingFormPanel);
    if (panel) panel.open();
  }
}

// Form reset
function resetFormState() {
  editingFeelingId = null;
  form.reset();

  formTitle.textContent = "Catch a New Feeling";
  saveButton.innerHTML =
    'Catch This Feeling<i class="material-icons right">check</i>';
  cancelEditButton.hidden = true;

  if (typeof M !== "undefined") {
    M.updateTextFields();

    const tagSelect = form.querySelector("#feeling-tag");
    const selectInstance = M.FormSelect.getInstance(tagSelect);
    if (selectInstance) selectInstance.destroy();
    M.FormSelect.init(tagSelect);

    const panel = M.Sidenav.getInstance(feelingFormPanel);
    if (panel) panel.close();
  }
}

if (cancelEditButton) {
  cancelEditButton.addEventListener("click", resetFormState);
}

// Save (create or update)
if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = {
      title: document.querySelector("#title").value.trim(),
      feelingTag: document.querySelector("#feeling-tag").value,
      entry: document.querySelector("#entry").value.trim(),
    };

    try {
      saveButton.disabled = true;

      if (editingFeelingId) {
        await updateFeeling(editingFeelingId, values);
        showToast("Feeling updated.");
      } else {
        await createFeeling(values);
        showToast("Feeling saved.");
      }

      resetFormState();
    } catch (error) {
      console.error("Could not save feeling:", error);
      showToast("Could not save the feeling. Check Firebase setup and rules.");
    } finally {
      saveButton.disabled = false;
    }
  });
}

// Load and live-update the list
if (list && statusMessage) {
  statusMessage.textContent = "Loading feelings...";
  watchFeelings(renderFeelings, (error) => {
    console.error("Could not load feelings:", error);
    statusMessage.textContent = "Could not load feelings.";
  });
}
