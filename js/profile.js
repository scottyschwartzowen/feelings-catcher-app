import { requiredSignedInUser, updateDisplayName } from "./auth.js";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  readLocalSettings,
  saveSettings,
} from "./userSettings.js";
import {
  ensurePermission,
  permissionState,
  showReminderNotification,
} from "./reminders.js";

const profileName = document.querySelector("#profile-name");
const memberSince = document.querySelector("#member-since");
const displayNameInput = document.querySelector("#display-name");
const saveNameButton = document.querySelector("#save-name");
const emailInput = document.querySelector("#email");

const dailyToggle = document.querySelector("#daily-toggle");
const dailyTime = document.querySelector("#daily-time");
const weeklyToggle = document.querySelector("#weekly-toggle");
const weeklyDay = document.querySelector("#weekly-day");
const weeklyTime = document.querySelector("#weekly-time");
const notificationStatus = document.querySelector("#notification-status");
const testButton = document.querySelector("#test-notification");

let currentUser = null;
let settings = structuredClone(DEFAULT_SETTINGS);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function showToast(message) {
  if (typeof M !== "undefined") {
    M.toast({ html: escapeHtml(message) });
  } else {
    console.log(message);
  }
}

// ----- Account -----

function nameFor(user) {
  return user.displayName || (user.email || "").split("@")[0] || "Friend";
}

function showUser(user) {
  profileName.textContent = nameFor(user);
  displayNameInput.value = user.displayName || "";
  displayNameInput.placeholder = nameFor(user);
  emailInput.value = user.email || "";

  const created = user.metadata?.creationTime;
  memberSince.textContent = created
    ? `Member since ${new Date(created).toLocaleDateString([], {
        month: "long",
        year: "numeric",
      })}`
    : "";

  if (typeof M !== "undefined") M.updateTextFields();
}

saveNameButton.addEventListener("click", async () => {
  const name = displayNameInput.value.trim();
  if (!name) {
    showToast("Enter a display name first.");
    return;
  }

  try {
    saveNameButton.disabled = true;
    const user = await updateDisplayName(name.slice(0, 50));
    showUser(user);
    showToast("Display name saved.");
  } catch (error) {
    console.error("Could not save the display name:", error);
    showToast(
      navigator.onLine
        ? "Could not save your display name."
        : "You need to be online to change your display name.",
    );
  } finally {
    saveNameButton.disabled = false;
  }
});

// ----- Notifications -----

function describePermission() {
  const state = permissionState();
  if (state === "unsupported") {
    return "This browser does not support notifications.";
  }
  if (state === "denied") {
    return "Notifications are blocked for this site. Allow them in your browser's site settings, then turn a reminder on again.";
  }
  if (state === "default") {
    return "Turn on a reminder to allow notifications on this device.";
  }
  return "Reminders appear on this device while Feelings Catcher is open, in a browser tab or the installed app.";
}

function renderSettings() {
  dailyToggle.checked = settings.dailyReminder.enabled;
  dailyTime.value = settings.dailyReminder.time;
  dailyTime.disabled = !settings.dailyReminder.enabled;

  weeklyToggle.checked = settings.weeklyReminder.enabled;
  weeklyDay.value = String(settings.weeklyReminder.day);
  weeklyTime.value = settings.weeklyReminder.time;
  weeklyDay.disabled = !settings.weeklyReminder.enabled;
  weeklyTime.disabled = !settings.weeklyReminder.enabled;

  notificationStatus.textContent = describePermission();
  if (typeof M !== "undefined") M.updateTextFields();
}

function persist() {
  if (currentUser) settings = saveSettings(currentUser.uid, settings);
  renderSettings();
}

async function onToggle(key, checkbox, label) {
  if (checkbox.checked) {
    const permission = await ensurePermission();
    if (permission !== "granted") {
      checkbox.checked = false;
      showToast(
        permission === "denied"
          ? "Notifications are blocked in your browser settings."
          : "This browser does not support notifications.",
      );
      renderSettings();
      return;
    }
  }

  settings[key].enabled = checkbox.checked;
  persist();
  showToast(`${label} reminder turned ${checkbox.checked ? "on" : "off"}.`);
}

dailyToggle.addEventListener("change", () =>
  onToggle("dailyReminder", dailyToggle, "Daily"),
);
weeklyToggle.addEventListener("change", () =>
  onToggle("weeklyReminder", weeklyToggle, "Weekly"),
);

dailyTime.addEventListener("change", () => {
  if (!dailyTime.value) return;
  settings.dailyReminder.time = dailyTime.value;
  persist();
});

weeklyDay.addEventListener("change", () => {
  settings.weeklyReminder.day = Number(weeklyDay.value);
  persist();
});

weeklyTime.addEventListener("change", () => {
  if (!weeklyTime.value) return;
  settings.weeklyReminder.time = weeklyTime.value;
  persist();
});

testButton.addEventListener("click", async () => {
  const permission = await ensurePermission();
  if (permission !== "granted") {
    showToast("Allow notifications first to see a test.");
    renderSettings();
    return;
  }
  await showReminderNotification({
    title: "Test reminder",
    body: "Notifications are working on this device.",
    tag: "reminder-test",
  });
  renderSettings();
});

// ----- Start -----

requiredSignedInUser(async (user) => {
  currentUser = user;
  showUser(user);

  settings = readLocalSettings(user.uid);
  renderSettings();

  settings = await loadSettings(user.uid);
  renderSettings();
});
