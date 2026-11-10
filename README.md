# Feelings Catcher

## Description

Feelings Catcher is a voice-first feelings journal. It helps you notice an intense feeling in the moment, name it, and file it away as a journal entry, so you can look back later and see patterns in what you were doing whenever that feeling showed up.

It is designed for anyone who wants a quick, low-friction way to check in with their emotions, such as people practicing emotional awareness or tracking stress and anxiety over time.

The app is built with plain HTML, CSS, and JavaScript using Materialize CSS (hosted locally) and Firebase. You sign in with an account, your feelings are saved to Cloud Firestore, and a copy is kept on your device in IndexedDB so the app keeps working offline. Voice capture and the calendar view are still placeholders and are planned for a future update.

## Features

- **Accounts:** email and password sign-in with Firebase Authentication. Each person sees only their own feelings.
- **Create, read, update and delete feelings** that work online and offline.
- **Offline-first storage:** every change is saved on the device first, then synchronized to Firebase.
- **Reminders:** an optional daily reminder to catch a feeling and a weekly check-in, configured on the Profile page.
- **Push notifications:** an optional notification on your other devices when a feeling is added to your account.
- **Profile page:** shows your name and email and lets you change your display name.

## How Firebase Is Used

**Authentication.** Users create an account and sign in on `signin.html`. Every other page checks for a signed-in user and redirects to the sign-in page if there isn't one.

**Cloud Firestore** is the online source of truth. It stores:

| Path                                         | Contents                                                      |
| -------------------------------------------- | ------------------------------------------------------------- |
| `feelings/{id}`                              | One document per feeling                                      |
| `users/{uid}`                                | The signed-in user's reminder settings                        |
| `users/{uid}/notificationInstallations/{id}` | One document per device that has push notifications turned on |

Firestore security rules (`firebase.rules`) make sure a signed-in user can read and change only their own feelings, settings and device registrations, and they limit the size of a title and an entry.

**Cloud Messaging and Cloud Functions.** When a new `feelings` document is created, the `notifyOwnerAboutFeeling` function looks up the owner's registered devices and sends each one a push notification.

**Hosting** serves the app over HTTPS, which service workers and push notifications require.

## How IndexedDB Is Used

Each user gets a database named `feelings-catcher-local-<user id>` with two object stores:

| Store            | Purpose                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `feelings`       | A copy of the user's feelings, so the list loads instantly and works offline |
| `pendingChanges` | The queue of changes that have not reached Firestore yet                     |

A pending change records the feeling's ID, the action (`create`, `update` or `delete`), the data to send, when it was queued, and a unique `changeId`. A feeling has at most one pending change: the latest action wins.

Firestore also keeps its own offline cache. The app reads from IndexedDB first and then merges in what Firestore reports.

## Using the App: CRUD Online and Offline

The steps are the same online and offline. Only what happens behind the scenes differs.

| Action     | How                                                        | Online                                                              | Offline                                                           |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Create** | Tap **+**, fill in the form, tap _Catch This Feeling_      | Saved on the device and sent to Firestore within a moment           | Saved on the device and queued. A message says it will sync later |
| **Read**   | Open the home page                                         | List loads from IndexedDB, then updates from Firestore in real time | List loads from IndexedDB                                         |
| **Update** | Tap the pencil on a feeling, change it, tap _Save Changes_ | Saved on the device and sent to Firestore                           | Saved on the device and queued                                    |
| **Delete** | Tap the trash can and confirm                              | Removed from the device and from Firestore                          | Removed from the device and queued                                |

The line under _Recent Feelings_ shows where the list came from and how many changes are waiting to sync.

## How Synchronization Works

1. **Save locally first.** Every create, update or delete is written to the `feelings` store and added to `pendingChanges` in one IndexedDB transaction, so neither can be saved without the other.
2. **Send queued changes.** When the app opens, and whenever the browser comes back online, it reads the queue (oldest first) and applies each change to Firestore.
3. **Clear only what was sent.** After Firestore accepts a change, the queue entry is removed only if its `changeId` still matches. If the user edits the same feeling while it was syncing, the newer change stays queued and is sent next. If a change fails, it stays in the queue and is retried on the next connection.
4. **Merge the server's data.** When the queue is empty, the app loads the feelings from Firestore and merges them into IndexedDB. A real-time listener keeps the list current, including changes made on other devices.
5. **Unsent local changes win.** While a change is waiting in the queue, it takes priority over what the server reports, so the edit is never overwritten by an older server copy.
6. **Network handling.** The app pauses Firestore's network connection when the browser goes offline and resumes it when it returns, which avoids repeated connection errors.

**Special cases.** Editing a feeling that has never reached Firestore keeps it a `create`. Deleting a feeling replaces any earlier pending change for it. If two devices change the same feeling, the change that reaches Firestore last wins.

## How Record IDs Stay Consistent

- When a feeling is created, the app generates its ID on the device (`crypto.randomUUID()`, with a fallback).
- That same ID is used as the IndexedDB key and as the Firestore document ID. Firestore never assigns a different one.
- Syncing writes to that document ID with `setDoc`. If a request is retried (for example after a dropped connection), it rewrites the same document, so no duplicate is created.
- Creates send the full record, and edits are merged into the existing document, so a retried change is safe.
- Because the IDs match everywhere, merging the server list into IndexedDB cannot produce a second copy of the same feeling.

## Reminders and Push Notifications

- **Reminders** (Profile page): turn on a daily reminder and a weekly check-in and choose the time. They are shown on this device while Feelings Catcher is open in a browser tab or the installed app. Settings are saved to your account.
- **Push notifications** (home page, _Enable_): registers this device so you are notified when a feeling is added to your account, even if the app is in the background or closed. A notification is not shown while the app tab is in the foreground.

## Setup

**Requirements:** a Firebase project, [Node.js](https://nodejs.org) 22 or later, and the Firebase CLI (`npm install -g firebase-tools`).

1. In the [Firebase console](https://console.firebase.google.com), create a project and add a **Web app**. Enable **Email/Password** under Authentication, create a **Firestore** database, and generate a **Web Push certificate** (VAPID key) under Project settings → Cloud Messaging. Cloud Functions need the **Blaze** plan.
2. Copy the web config into `js/firebaseConfig.js` and into the `firebaseConfig` object at the top of `sw.js`. Paste the VAPID public key into `js/notifications.js`, and set `APP_URL` in `functions/index.js` to your deployed `https://` address.
3. Install the function packages:

   ```bash
   cd functions
   npm install
   cd ..
   ```

4. Run locally with a static server such as the VS Code
