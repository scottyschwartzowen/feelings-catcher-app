import {
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { auth } from "./firebaseConfig.js";

export function requiredSignedInUser(onSignedIn) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("/signin.html");
      return;
    }
    onSignedIn(user);
  });
}

export async function signOutUser() {
  await signOut(auth);
  window.location.replace("/signin.html");
}

// Change the signed-in user's display name (needs a connection)
export async function updateDisplayName(displayName) {
  await updateProfile(auth.currentUser, { displayName });
  return auth.currentUser;
}
