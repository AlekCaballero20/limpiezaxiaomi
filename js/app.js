/* ─────────────────────────────────────────────
   APP — Musicala Tracker
   Punto de entrada principal de la aplicación
───────────────────────────────────────────── */

import { loadSessionsCacheFirst } from "./services/sessions.service.js";
import {
  setSessions,
  resetStore,
  setLoading
} from "./state/store.js";

import { renderTabs, setupTabs } from "./ui/tabs.js";
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

/* Re-render de las vistas que dependen de sesiones (sin tocar mantenimiento) */
function renderSessionViews() {
  renderDashboardView();
  renderHistoryView();
  renderStatsView();
}

/* ==============================
   DATA
============================== */
function handleFreshSessions(sessions) {
  setSessions(sessions);
  renderSessionViews();
}

/* ==============================
   INIT
============================== */
async function initApp() {
  /* Las lecturas de red arrancan a la vez en vez de en cascada.
     Antes eran 3 round-trips encadenados; ahora es 1 tiempo de espera. */
  let markSessionsReady = () => {};
  const sessionsReady = new Promise(resolve => { markSessionsReady = resolve; });

  try {
    resetStore();
    showInitialLoadingState();

    setupTabs();

    const sessionsPromise = loadSessionsCacheFirst(handleFreshSessions);
    const registerPromise = setupRegisterView(sessionsReady);

    const { sessions } = await sessionsPromise;
    setSessions(sessions);
    markSessionsReady();

    setLoading("dashboard", false);
    setLoading("history", false);
    setLoading("stats", false);
    setLoading("maintenance", false);

    /* Pintamos dashboard/historial/stats de inmediato y dejamos que
       mantenimiento y el formulario terminen en paralelo. */
    renderSessionViews();
    hideAllLoaders();
    renderTabs();

    console.info(
      `[perf] Interfaz lista en ${Math.round(performance.now())} ms`
    );

    await Promise.all([registerPromise, renderMaintenanceView()]);

  } catch (error) {
    console.error("Error inicializando la app:", error);

    markSessionsReady();
    toastError("No se pudieron cargar los datos");

    hideAllLoaders();
    renderTabs();

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
