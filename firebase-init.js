// firebase-init.js
// Firebase project connection. The values below are your project's public
// web config -- these are meant to be embedded in client-side code and are
// not secret. Real protection lives in Firestore security rules, not in
// hiding this object.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDexlRWnmk0wiJB3TKXw_D_8x5LlKqMjMQ",
  authDomain: "irrigation-audit.firebaseapp.com",
  projectId: "irrigation-audit",
  storageBucket: "irrigation-audit.firebasestorage.app",
  messagingSenderId: "632140032996",
  appId: "1:632140032996:web:e174276acb1a6f2af975f1",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Resolves once we're signed in (anonymously, silently -- no login screen).
// This just keeps the database from being wide open to random internet
// traffic; it is not a real per-technician login yet.
export function whenReady() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          unsub();
          resolve(user);
        }
      },
      (err) => {
        unsub();
        reject(err);
      }
    );
    signInAnonymously(auth).catch((err) => {
      unsub();
      reject(err);
    });
  });
}
