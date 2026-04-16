import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJBCVOMPM7xI0VTvC507yuqkKoX1T7utw",
  authDomain: "limpieza-xiaomi.firebaseapp.com",
  projectId: "limpieza-xiaomi",
  storageBucket: "limpieza-xiaomi.firebasestorage.app",
  messagingSenderId: "144661302250",
  appId: "1:144661302250:web:d25f383d510b8be85d0093"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };