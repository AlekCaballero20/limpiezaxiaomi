import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDJBCVOMPM7xI0VTvC507yuqkKoX1T7utw",
  authDomain: "limpieza-xiaomi.firebaseapp.com",
  projectId: "limpieza-xiaomi",
  storageBucket: "limpieza-xiaomi.firebasestorage.app",
  messagingSenderId: "144661302250",
  appId: "1:144661302250:web:d25f383d510b8be85d0093"
};

const app = initializeApp(firebaseConfig);

/* Cache persistente en IndexedDB:
   - La segunda carga (y siguientes) lee desde disco: render casi instantaneo.
   - Las escrituras se aplican local primero y se sincronizan solas. */
let db;

try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error) {
  console.warn("Cache persistente no disponible, usando memoria:", error);
  db = getFirestore(app);
}

export { app, db };
