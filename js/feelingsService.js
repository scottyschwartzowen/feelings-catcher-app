import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db } from "./firebaseConfig.js";

const feelingRef = collection(db, "feelings");

// Create
export async function createFeeling(data) {
  const docRef = await addDoc(feelingRef, {
    title: data.title.trim(),
    feelingTag: data.feelingTag,
    entry: data.entry.trim(),
    context: data.context || "",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

// Read - onetime fetch request
export async function loadFeelingOnce() {
  const feelingQuery = query(feelingRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(feelingQuery);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

// Read (for homepage)
export function watchFeelings(render, onError) {
  const feelingQuery = query(feelingRef, orderBy("createdAt", "desc"));
  return onSnapshot(
    feelingQuery,
    (snapshot) => {
      const feelings = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data({ serverTimestamps: "estimate" }),
      }));
      render(feelings);
    },
    (error) => {
      if (onError) onError(error);
    },
  );
}

// Update
export async function updateFeeling(id, changes) {
  const docRef = doc(db, "feelings", id);
  return updateDoc(docRef, {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

// Delete
export async function deleteFeeling(id) {
  const docRef = doc(db, "feelings", id);
  return deleteDoc(docRef);
}
