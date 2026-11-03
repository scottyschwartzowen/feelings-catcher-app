import { loadSettings, readLocalSettings } from "./userSettings.js";
import { dayStamp, isReminderDue } from "./reminderSchedule.js";

const CHECK_EVERY_MS = 30 * 1000;
const ICON = "/images/icons/icon-192.png";

const MESSAGES = {
  daily: {
    title: "Time to catch a feeling",
    body: "Take a moment to notice how you feel and write it down.",
  },
  weekly: {
    title: "Weekly check-in",
    body: "Look back at your week. How have you been feeling?",
  },
};

export function notificationsSupported() {
  return "Notification" in window;
}

// "granted", "denied", "default" (not asked yet) or "unsupported"
export function permissionState() {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

// Ask the browser for permission if we have not asked yet.
// Call this from a click or change handler, because browsers ignore it otherwise.
export async function ensurePermission() {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

export async function showReminderNotification({ title, body, tag }) {
  if (permissionState() !== "granted") return false;

  const options = { body, icon: ICON, tag, data: { url: "/" } };

  try {
    // The service worker shows it, which also works in the installed app
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return true;
    }
  } catch (error) {
    console.warn("Service worker notification failed, using a plain one:", error);
  }

  new Notification(title, options);
  return true;
}

function lastFiredKey(userId, kind) {
  return `feelings-catcher-reminder-${kind}-${userId}`;
}

function readLastFired(userId, kind) {
  try {
    return localStorage.getItem(lastFiredKey(userId, kind));
  } catch (error) {
    return null;
  }
}

function writeLastFired(userId, kind, stamp) {
  try {
    localStorage.setItem(lastFiredKey(userId, kind), stamp);
  } catch (error) {
    // Without storage a reminder could repeat each check, so see the guard below.
  }
}

let startedFor = null;
const firedThisSession = new Set();

function checkReminders(userId) {
  if (permissionState() !== "granted") return;

  const settings = readLocalSettings(userId);
  const now = new Date();
  const reminders = [
    ["daily", settings.dailyReminder],
    ["weekly", settings.weeklyReminder],
  ];

  for (const [kind, reminder] of reminders) {
    const today = dayStamp(now);
    const lastStamp = readLastFired(userId, kind);
    if (!isReminderDue(kind, reminder, now, lastStamp)) continue;
    if (firedThisSession.has(`${kind}-${today}`)) continue;

    // Mark it first, so a second open tab does not show it again
    firedThisSession.add(`${kind}-${today}`);
    writeLastFired(userId, kind, today);
    void showReminderNotification({ ...MESSAGES[kind], tag: `reminder-${kind}` });
  }
}

// Reminders appear while Feelings Catcher is open (in a tab or the installed app).
export function startReminders(userId) {
  if (startedFor === userId) return;
  startedFor = userId;

  // Pull this account's saved reminder settings onto this device
  void loadSettings(userId);

  checkReminders(userId);
  setInterval(() => checkReminders(userId), CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkReminders(userId);
  });
}
