// Import the functions your need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// TODO: Add SDKs for Firebase products you want to use:

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAubu5USmXW2wB8QE2IfVAO-rOLOI-eSNk",
  authDomain: "feelings-catcher-54b32.firebaseapp.com",
  projectId: "feelings-catcher-54b32",
  storageBucket: "feelings-catcher-54b32.firebasestorage.app",
  messagingSenderId: "690869311862",
  appId: "1:690869311862:web:a222585b6349f93f310257",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// cspell:ignore Firestore
export const db = getFirestore(app);
