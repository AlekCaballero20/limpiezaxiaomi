import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../config/firebase.config.js";

const COLLECTION_NAME = "sessions";

/* ==============================
   HELPERS INTERNOS
============================== */
function getSessionsCollection() {
  return collection(db, COLLECTION_NAME);
}

/* ==============================
   READ
============================== */
export async function loadSessions() {
  const sessionsQuery = query(
    getSessionsCollection(),
    orderBy("completedAt", "desc")
  );

  const snapshot = await getDocs(sessionsQuery);

  return snapshot.docs.map(document => ({
    id: document.id,
    ...document.data()
  }));
}

/* ==============================
   CREATE
============================== */
export async function saveSession(sessionData) {
  const documentRef = await addDoc(getSessionsCollection(), sessionData);

  return {
    id: documentRef.id,
    ...sessionData
  };
}

/* ==============================
   DELETE
============================== */
export async function deleteSession(sessionId) {
  const sessionRef = doc(db, COLLECTION_NAME, sessionId);
  await deleteDoc(sessionRef);

  return sessionId;
}