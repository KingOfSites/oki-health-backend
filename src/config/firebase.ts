import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "XXX",
  authDomain: "solid-tech-f7b1b.firebaseapp.com",
  projectId: "solid-tech-f7b1b",
  storageBucket: "solid-tech-f7b1b.appspot.com",
  messagingSenderId: "XXX",
  appId: "XXX"
};

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
