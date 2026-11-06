import {
  getMessaging,
  isSupported,
  onRegistered,
  register,
  unregister,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";

import {
  serverTimestamp,
  doc,
  setDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { app, db } from "./firebaseConfig.js";

const VAPID_PUBLIC_KEY =
  "BAKvjiEuyWG9mVzRg8JlXi7bWY5cr2y5jWqCvrx0QMXBEn1XbpbknIkS1HpP5p3u_Rgw9i3jqaCQWI0KrhUnONs";

async function getSupportedMessaging() {
  const supported = await isSupported();
  if (!supported) {
    throw new Error("Push notifications are not supported in this browser.");
  }
  return getMessaging(app);
}

export async function enablePushNotifications(userId) {
  if (!userId) {
    throw new Error("Sign in before enabling notifications");
  }
  const messaging = await getSupportedMessaging();
  if (VAPID_PUBLIC_KEY.startsWith("PASTE_")) {
    throw new Error("Add your VAPID public key in js/notifications.js first.");
  }
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notifications.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return false;
  }
  const serviceWorker = await navigator.serviceWorker.ready;

  const installationId = await new Promise((resolve, reject) => {
    let stopListening = () => {};
    stopListening = onRegistered(messaging, (fid) => {
      stopListening();
      resolve(fid);
    });
    register(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: serviceWorker,
    }).catch((error) => {
      stopListening();
      reject(error);
    });
  });

  const installationRef = doc(
    db,
    "users",
    userId,
    "notificationInstallations",
    installationId,
  );

  await setDoc(installationRef, {
    fid: installationId,
    updatedAt: serverTimestamp(),
  });

  localStorage.setItem("feelings-catcher-fid-" + userId, installationId);
  return true;
}

export async function disablePushNotifications(userId) {
  const installationId = localStorage.getItem("feelings-catcher-fid-" + userId);

  if (installationId) {
    const installationRef = doc(
      db,
      "users",
      userId,
      "notificationInstallations",
      installationId,
    );
    await deleteDoc(installationRef);
    localStorage.removeItem("feelings-catcher-fid-" + userId);
  }
  const messaging = await getSupportedMessaging();
  await unregister(messaging);
}

// Does this device already have a push registration for this user?
export function hasPushRegistration(userId) {
  try {
    return Boolean(localStorage.getItem("feelings-catcher-fid-" + userId));
  } catch (error) {
    return false;
  }
}