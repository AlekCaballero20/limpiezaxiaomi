import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../config/firebase.config.js";

const COLLECTION_NAME = "sessions";
const APP_STATE_COLLECTION = "app_state";
const ACTIVE_SESSION_DOC_ID = "active_session";

/* ==============================
   HELPERS INTERNOS
============================== */
function getSessionsCollection() {
  return collection(db, COLLECTION_NAME);
}

function getActiveSessionRef() {
  return doc(db, APP_STATE_COLLECTION, ACTIVE_SESSION_DOC_ID);
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

/* ==============================
   ACTIVE SESSION (SHARED)
============================== */
export async function loadActiveSession() {
  const snapshot = await getDoc(getActiveSessionRef());
  if (!snapshot.exists()) return null;
  return snapshot.data();
}

export async function saveActiveSession(activeSessionData) {
  await setDoc(getActiveSessionRef(), {
    ...activeSessionData,
    updatedAt: Timestamp.now()
  });

  return activeSessionData;
}

export async function clearActiveSession() {
  await deleteDoc(getActiveSessionRef());
}
