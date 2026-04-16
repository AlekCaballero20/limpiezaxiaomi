/* ─────────────────────────────────────────────
   STORE — Musicala Tracker
   Estado global simple de la app
───────────────────────────────────────────── */

const state = {
  sessions: [],
  activeTab: "dashboard",
  selectedMapId: null,
  loading: {
    dashboard: true,
    history: true,
    stats: true
  }
};

/* ==============================
   GETTERS
============================== */
export function getState() {
  return state;
}

export function getSessions() {
  return state.sessions;
}

export function getActiveTab() {
  return state.activeTab;
}

export function getSelectedMapId() {
  return state.selectedMapId;
}

export function isLoading(section) {
  return Boolean(state.loading[section]);
}

/* ==============================
   SETTERS
============================== */
export function setSessions(sessions = []) {
  state.sessions = Array.isArray(sessions) ? [...sessions] : [];
}

export function addSession(session) {
  if (!session) return;
  state.sessions.unshift(session);
}

export function removeSession(sessionId) {
  state.sessions = state.sessions.filter(session => session.id !== sessionId);
}

export function setActiveTab(tabName) {
  state.activeTab = tabName;
}

export function setSelectedMapId(mapId) {
  state.selectedMapId = mapId ?? null;
}

export function setLoading(section, value) {
  if (!(section in state.loading)) return;
  state.loading[section] = Boolean(value);
}

/* ==============================
   HELPERS
============================== */
export function resetUIState() {
  state.activeTab = "dashboard";
  state.selectedMapId = null;
  state.loading = {
    dashboard: true,
    history: true,
    stats: true
  };
}

export function resetStore() {
  state.sessions = [];
  resetUIState();
}