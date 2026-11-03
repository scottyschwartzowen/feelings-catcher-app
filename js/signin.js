import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth } from "./firebaseConfig.js";

const signUpForm = document.querySelector("#sign-up-form");
const signInForm = document.querySelector("#sign-in-form");
const message = document.querySelector("#auth-message");

function showMessage(text) {
  message.textContent = text;
}

onAuthStateChanged(auth, (user) => {
  if (user) window.location.replace("/");
});

document.querySelector("#show-sign-up").addEventListener("click", (event) => {
  event.preventDefault();
  signInForm.hidden = true;
  signUpForm.hidden = false;
  showMessage("");
});

document.querySelector("#show-sign-in").addEventListener("click", (event) => {
  event.preventDefault();
  signInForm.hidden = false;
  signUpForm.hidden = true;
  showMessage("");
});

signUpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#sign-up-email").value.trim();
  const password = document.querySelector("#sign-up-password").value;

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    window.location.replace("/");
  } catch (error) {
    showMessage(error.message);
  }
});

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#sign-in-email").value.trim();
  const password = document.querySelector("#sign-in-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace("/");
  } catch (error) {
    showMessage(error.message);
  }
});
