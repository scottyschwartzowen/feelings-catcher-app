const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const database = getFirestore();

// Must be the full https:// address of the deployed app
const APP_URL = "https://feelings-catcher-54b32.web.app";

exports.notifyOwnerAboutFeeling = onDocumentCreated(
  "feelings/{feelingId}",
  async (event) => {
    const feeling = event.data?.data();
    if (!feeling) {
      console.log("No feeling data was found");
      return;
    }

    const userId = feeling.ownerUid;
    if (!userId) {
      console.log("Feeling has no ownerUid");
      return;
    }

    const registrations = await database
      .collection("users")
      .doc(userId)
      .collection("notificationInstallations")
      .get();

    const installationIds = registrations.docs.map(
      (registration) => registration.id,
    );

    console.log(`Found ${installationIds.length} installations`);
    if (installationIds.length === 0) {
      console.log("No installations found; no notifications sent.");
      return;
    }

    const messages = installationIds.map((installationId) => ({
      fid: installationId,
      notification: {
        title: "Feelings Catcher",
        body: "A new feeling was added to your account.",
      },
      webpush: {
        fcmOptions: {
          link: APP_URL,
        },
      },
    }));

    // allSettled: one dead device must not stop the others from being notified
    const results = await Promise.allSettled(
      messages.map((message) => getMessaging().send(message)),
    );

    const sent = results.filter((result) => result.status === "fulfilled");

    const staleCleanups = [];
    results.forEach((result, index) => {
      if (result.status !== "rejected") return;

      if (result.reason?.code === "messaging/installation-id-not-registered") {
        // The device is gone: remove its registration so we stop trying
        console.log(`Removing stale installation ${installationIds[index]}`);
        staleCleanups.push(
          database
            .collection("users")
            .doc(userId)
            .collection("notificationInstallations")
            .doc(installationIds[index])
            .delete(),
        );
      } else {
        console.error("Send failed:", result.reason);
      }
    });
    await Promise.all(staleCleanups);

    console.log(`Sent ${sent.length} of ${results.length} notifications`);
  },
);
