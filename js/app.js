/* ─────────────────────────────────────────────
   APP — Musicala Tracker
   Punto de entrada principal de la aplicación
───────────────────────────────────────────── */

import { loadSessions } from "./services/sessions.service.js";
import {
  setSessions,
  resetStore,
  setLoading
} from "./state/store.js";

import { setupTabs } from "./ui/tabs.js";
import { toastError } from "./ui/toast.js";

import { setupRegisterView } from "./views/register.view.js";
import { renderDashboardView } from "./views/dashboard.view.js";
import { renderHistoryView } from "./views/history.view.js";
import { renderStatsView } from "./views/stats.view.js";
import { renderMaintenanceView } from "./views/maintenance.view.js";

/* ==============================
   HELPERS UI
============================== */
function showElement(id, display = "block") {
  const element = document.getElementById(id);
  if (!element) return;
  element.style.display = display;
}

function hideElement(id) {
  const element = document.getElementById(id);
  if (!element) return;
  element.style.display = "none";
}

function showInitialLoadingState() {
  showElement("dash-load");
  hideElement("dash-body");

  showElement("hist-load");
  hideElement("hist-body");

  showElement("stats-load");
  hideElement("stats-body");
}

function hideAllLoaders() {
  hideElement("dash-load");
  hideElement("hist-load");
  hideElement("stats-load");

  showElement("dash-body");
  showElement("hist-body");
  showElement("stats-body");
}

/* ==============================
   RENDER GLOBAL
============================== */
export async function renderApp() {
  renderDashboardView();
  renderHistoryView();
  renderStatsView();
  await renderMaintenanceView();
}

/* ==============================
   DATA
============================== */
async function bootstrapSessions() {
  const sessions = await loadSessions();
  setSessions(sessions);
}

/* ==============================
   INIT
============================== */
async function initApp() {
  try {
    resetStore();
    showInitialLoadingState();

    setupTabs();
    await setupRegisterView();

    await bootstrapSessions();

    setLoading("dashboard", false);
    setLoading("history", false);
    setLoading("stats", false);
    setLoading("maintenance", false);

    await renderApp();
    hideAllLoaders();

  } catch (error) {
    console.error("Error inicializando la app:", error);

    toastError("No se pudieron cargar los datos");

    hideAllLoaders();

    const dashBody = document.getElementById("dash-body");
    const histBody = document.getElementById("hist-body");
    const statsBody = document.getElementById("stats-body");

    if (dashBody) {
      dashBody.innerHTML = `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">⚠️</div>
            <div class="empty-txt">
              No se pudo cargar el dashboard.
            </div>
          </div>
        </div>
      `;
    }

    if (histBody) {
      histBody.innerHTML = `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">⚠️</div>
            <div class="empty-txt">
              No se pudo cargar el historial.
            </div>
          </div>
        </div>
      `;
    }

    if (statsBody) {
      statsBody.innerHTML = `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">⚠️</div>
            <div class="empty-txt">
              No se pudieron cargar las estadísticas.
            </div>
          </div>
        </div>
      `;
    }
  }
}

/* ==============================
   DOM READY
============================== */
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
