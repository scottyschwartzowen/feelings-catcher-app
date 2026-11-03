import {
  collection,
  serverTimestamp,
  getDocsFromServer,
  query,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  disableNetwork,
  enableNetwork,
  setLogLevel,
  where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";

setLogLevel("error"); // hide Firestore's offline retry warnings

const feelingRef = collection(db, "feelings");
function feelingsQueryFor(userId) {
  return query(feelingRef, where("ownerUid", "==", userId));
}

// Turn a Firestore Timestamp (or an already-converted number) into milliseconds
function timestampToMillis(timestamp) {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  return typeof timestamp === "number" ? timestamp : null;
}

// Convert Firestore document into the plain object the app and IndexedDB use
function fromFirestore(docSnap) {
  const data = docSnap.data({ serverTimestamps: "estimate" });

  return {
    id: docSnap.id,
    ownerUid: data.ownerUid || "",
    title: data.title || "",
    feelingTag: data.feelingTag || "other",
    entry: data.entry || "",
    context: data.context || "",
    status: data.status || "active",
    createdAtMs: timestampToMillis(data.createdAt) ?? data.createdAtMs ?? null,
    updatedAtMs: timestampToMillis(data.updatedAt) ?? data.updatedAtMs ?? null,
  };
}

// Read - onetime fetch request
export async function loadFeelingsFromServer(userId) {
  const snapshot = await getDocsFromServer(feelingsQueryFor(userId));
  return snapshot.docs.map(fromFirestore);
}

// Apply one queued action. Stable IDs make a retried create safe from duplicates.
export async function syncFeelingChange(userId, change) {
  const feelingDocRef = doc(db, "feelings", change.feelingId);

  if (change.type === "delete") {
    await deleteDoc(feelingDocRef);
    return;
  }

  const data = change.data;
  const firestoreData = {
    title: data.title,
    ownerUid: userId,
    feelingTag: data.feelingTag,
    entry: data.entry,
    context: data.context || "",
    status: data.status || "active",
    updatedAt: serverTimestamp(),
  };

  if (change.type === "create") {
    firestoreData.createdAt = serverTimestamp();
  }

  // A full set for creates and merge set for edits keeps retries idempotent.
  await setDoc(feelingDocRef, firestoreData, {
    merge: change.type !== "create",
  });
}

// Read - real-time listener
export function watchFeelings(userId, onData, onError) {
  return onSnapshot(
    feelingsQueryFor(userId),
    { includeMetadataChanges: true },
    (snapshot) => {
      onData(snapshot.docs.map(fromFirestore), {
        fromCache: snapshot.metadata.fromCache,
        hasPendingWrites: snapshot.metadata.hasPendingWrites,
      });
    },
    onError,
  );
}

// Stop / restart Firestore's live connection when the browser goes offline / online
export function pauseFirestore() {
  return disableNetwork(db);
}

export function resumeFirestore() {
  return enableNetwork(db);
}
