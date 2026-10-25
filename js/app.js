import {
  watchFeelings,
  loadFeelingsFromServer,
  syncFeelingChange,
  pauseFirestore,
  resumeFirestore,
} from "./feelingsService.js";

import {
  readAllFeelings,
  saveFeelingAndQueue,
  deleteFeelingAndQueue,
  readPendingChanges,
  removeSyncedChange,
  mergeServerFeelings,
} from "./idb-storage.js";

// PWA: Install logic
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
const dataSource = document.querySelector("#data-source");

let editingFeelingId = null;
let currentFeelings = [];
let syncInProgress = false;
let syncAgain = false;

function showDataSource(message) {
  if (dataSource) dataSource.textContent = message;
}

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

// Stable ID made on this device, reused when the change syncs to Firestore
function makeLocalId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `feeling-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
// Takes milliseconds (createdAtMs), so it works for Firebase and IndexedDB data
function formatTimestamp(ms) {
  if (typeof ms !== "number") {
    return "Saving...";
  }
  return new Date(ms).toLocaleString([], {
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
                ${where}${formatTimestamp(feeling.createdAtMs)}
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
      // Remove it from this device and queue the delete for Firestore
      await deleteFeelingAndQueue(id);
      await refreshLocalList();
      await updateSyncMessage();
      showToast(
        navigator.onLine
          ? "Feeling deleted."
          : "Deleted on this device. It will sync when you are back online.",
      );
      void synchronizePendingChanges();
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

    const existing = currentFeelings.find(
      (item) => item.id === editingFeelingId,
    );
    const now = Date.now();

    const feeling = {
      id: editingFeelingId || makeLocalId(),
      title: document.querySelector("#title").value.trim(),
      feelingTag: document.querySelector("#feeling-tag").value,
      entry: document.querySelector("#entry").value.trim(),
      context: existing?.context || "",
      status: "active",
      createdAtMs: existing?.createdAtMs || now,
      updatedAtMs: now,
    };

    try {
      if (saveButton) saveButton.disabled = true;

      // Save to this device first. The queue sends the change to Firestore.
      await saveFeelingAndQueue(
        feeling,
        editingFeelingId ? "update" : "create",
      );
      await refreshLocalList();
      await updateSyncMessage();
      showToast(
        navigator.onLine
          ? "Feeling saved."
          : "Saved on this device. It will sync when you are back online.",
      );

      resetFormState();
      void synchronizePendingChanges();
    } catch (error) {
      console.error("Could not save feeling:", error);
      showToast("Could not save the feeling on this device.");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  });
}

// Sync status line under the list heading
async function updateSyncMessage(message) {
  let count = 0;
  try {
    count = (await readPendingChanges()).length;
  } catch (error) {
    console.error("Could not read the sync queue:", error);
  }

  const base =
    message ||
    (navigator.onLine
      ? "Showing feelings from this device."
      : "Offline: showing feelings saved on this device.");

  showDataSource(
    count
      ? `${base} ${count} change${count === 1 ? "" : "s"} waiting to sync.`
      : base,
  );
}

// Re-draw the list from IndexedDB (includes unsent changes)
async function refreshLocalList() {
  renderFeelings(await readAllFeelings());
}

async function synchronizePendingChanges() {
  if (!navigator.onLine) {
    await updateSyncMessage();
    return;
  }

  // If a sync is already running, ask it to run once more when it finishes
  if (syncInProgress) {
    syncAgain = true;
    return;
  }

  syncInProgress = true;
  try {
    do {
      syncAgain = false;
      let failed = false;
      const changes = await readPendingChanges();

      for (const change of changes) {
        if (!navigator.onLine) break;

        try {
          await syncFeelingChange(change);
          await removeSyncedChange(change.feelingId, change.changeId);
        } catch (error) {
          // Keep this change in IndexedDB. The next connection can retry it.
          console.error("Could not sync a feeling:", error);
          failed = true;
          break;
        }
      }

      const remaining = await readPendingChanges();
      if (!remaining.length && navigator.onLine) {
        try {
          const serverFeelings = await loadFeelingsFromServer();
          const merged = await mergeServerFeelings(serverFeelings, false);
          renderFeelings(merged);
        } catch (error) {
          console.warn("Could not refresh the server list yet:", error);
        }
      }

      await updateSyncMessage();
      if (failed || !navigator.onLine) break;
    } while (syncAgain);
  } catch (error) {
    console.error("Could not read the local sync queue:", error);
    await updateSyncMessage("Could not check the sync queue on this device.");
  } finally {
    syncInProgress = false;
    await updateSyncMessage();
  }
}

// Show the local list immediately, then merge Firestore data as it arrives.
async function startApp() {
  try {
    await refreshLocalList();
    await updateSyncMessage();
  } catch (error) {
    console.error("Could not open the local database:", error);
    showDataSource("Local storage could not be opened on this device.");
  }

  try {
    watchFeelings(
      async (remoteFeelings, metadata) => {
        try {
          const possiblyIncomplete =
            metadata.fromCache || metadata.hasPendingWrites;
          const merged = await mergeServerFeelings(
            remoteFeelings,
            possiblyIncomplete,
          );
          renderFeelings(merged);
          await updateSyncMessage(
            metadata.fromCache
              ? "Showing saved feelings while Firestore checks for updates."
              : "Showing the latest Firestore feelings and local changes.",
          );
        } catch (error) {
          console.error(
            "Could not combine local and Firestore feelings:",
            error,
          );
        }
      },
      (error) => {
        console.error("Could not listen to Firestore:", error);
        void updateSyncMessage(
          "Firestore is not available. Your saved feelings are still on this device.",
        );
      },
    );
  } catch (error) {
    console.error("Could not start the Firestore listener:", error);
    showDataSource(
      "Firestore is unavailable. Showing feelings from this device.",
    );
  }

  // Send anything queued while we were offline or closed
  void synchronizePendingChanges();
}

// Only run on pages that have the feelings list
if (list && statusMessage) {
  window.addEventListener("online", async () => {
    await resumeFirestore();
    void synchronizePendingChanges();
  });
  window.addEventListener("offline", () => {
    void pauseFirestore();
    void updateSyncMessage();
  });

  if (!navigator.onLine) void pauseFirestore();
  void startApp();
}
