import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";

export const DEFAULT_SETTINGS = {
  dailyReminder: { enabled: false, time: "20:00" },
  weeklyReminder: { enabled: false, day: 0, time: "18:00" }, // day 0 = Sunday
};

function withDefaults(raw) {
  const saved = raw || {};
  return {
    dailyReminder: {
      ...DEFAULT_SETTINGS.dailyReminder,
      ...(saved.dailyReminder || {}),
    },
    weeklyReminder: {
      ...DEFAULT_SETTINGS.weeklyReminder,
      ...(saved.weeklyReminder || {}),
    },
  };
}

function localKey(userId) {
  return `feelings-catcher-settings-${userId}`;
}

// Settings kept on this device (works offline, and the reminder timer reads them)
export function readLocalSettings(userId) {
  try {
    return withDefaults(JSON.parse(localStorage.getItem(localKey(userId))));
  } catch (error) {
    return withDefaults(null);
  }
}

function writeLocalSettings(userId, settings) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(settings));
  } catch (error) {
    // Storage blocked: the settings still save to the account below.
  }
}

// Start from this device's copy, then pull the account's copy from Firestore
export async function loadSettings(userId) {
  const local = readLocalSettings(userId);
  try {
    const snapshot = await getDoc(doc(db, "users", userId));
    if (!snapshot.exists()) return local;
    const merged = withDefaults(snapshot.data().settings);
    writeLocalSettings(userId, merged);
    return merged;
  } catch (error) {
    console.warn("Could not load account settings, using this device's:", error);
    return local;
  }
}

// Save on this device straight away, and to the account when possible
export function saveSettings(userId, settings) {
  const clean = withDefaults(settings);
  writeLocalSettings(userId, clean);

  // Not awaited: while offline this waits in Firestore's queue until we reconnect
  setDoc(
    doc(db, "users", userId),
    { settings: clean, updatedAt: serverTimestamp() },
    { merge: true },
  ).catch((error) => {
    console.warn("Could not save settings to the account yet:", error);
  });

  return clean;
}
