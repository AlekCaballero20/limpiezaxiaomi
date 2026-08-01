import {
  collection,
  getDocs,
  getDocsFromCache,
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
function getSessionsQuery() {
  return query(getSessionsCollection(), orderBy("completedAt", "desc"));
}

function mapSnapshot(snapshot) {
  return snapshot.docs.map(document => ({
    id: document.id,
    ...document.data()
  }));
}

export async function loadSessions() {
  const snapshot = await getDocs(getSessionsQuery());
  return mapSnapshot(snapshot);
}

/**
 * Lectura cache-first: devuelve al instante lo que haya en IndexedDB
 * y avisa por callback cuando llega la version del servidor.
 * Si no hay cache (primera visita) hace la lectura normal.
 */
export async function loadSessionsCacheFirst(onFreshData) {
  const sessionsQuery = getSessionsQuery();

  try {
    const cached = await getDocsFromCache(sessionsQuery);

    if (!cached.empty) {
      // Refresco en segundo plano: no bloquea el primer render.
      getDocs(sessionsQuery)
        .then(fresh => {
          if (typeof onFreshData !== "function") return;
          if (fresh.metadata.fromCache) return;
          onFreshData(mapSnapshot(fresh));
        })
        .catch(error => {
          console.warn("No se pudo refrescar sesiones desde el servidor:", error);
        });

      return { sessions: mapSnapshot(cached), fromCache: true };
    }
  } catch (error) {
    console.warn("Cache de sesiones no disponible:", error);
  }

  const snapshot = await getDocs(sessionsQuery);
  return { sessions: mapSnapshot(snapshot), fromCache: false };
}

/* ==============================
   CREATE
============================== */
/**
 * Escritura optimista: el id se genera en el cliente y el documento
 * se aplica al cache local de inmediato. Devolvemos sin esperar el ACK
 * del servidor; `ack` permite reaccionar si la sincronizacion falla.
 */
export function saveSession(sessionData) {
  const documentRef = doc(getSessionsCollection());
  const ack = setDoc(documentRef, sessionData);

  return {
    session: { id: documentRef.id, ...sessionData },
    ack
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
