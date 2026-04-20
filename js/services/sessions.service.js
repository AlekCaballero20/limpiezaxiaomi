/* ─────────────────────────────────────────────
   SESSIONS SERVICE — Musicala Tracker
   (Archivo correcto: sessions.service.js)
   CRUD de sesiones en Firestore
───────────────────────────────────────────── */

export {
  loadSessions,
  saveSession,
  deleteSession,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession
} from "./sessions.services.js";
