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
import {
  registerView,
  renderVisibleView,
  refreshViews
} from "./ui/view-registry.js";
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
function registerViews() {
  registerView("dashboard", renderDashboardView);
  registerView("historial", renderHistoryView);
  registerView("estadisticas", renderStatsView);
  registerView("mantenimiento", renderMaintenanceView);
}

/* Repinta todo lo que depende de sesiones, pero solo de verdad la
   pestaña visible; el resto queda pendiente hasta que se entre en ella. */
export function refreshSessionViews() {
  return refreshViews(["dashboard", "historial", "estadisticas"]);
}

/* ==============================
   DATA
============================== */
function handleFreshSessions(sessions) {
  setSessions(sessions);
  refreshSessionViews();
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

    registerViews();
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

    /* Solo se pinta la pestaña visible. Historial y Estadisticas recorren
       todo el historial y cuestan segundos: se dejan para cuando se abran. */
    hideAllLoaders();
    renderTabs();
    await renderVisibleView();

    console.info(
      `[perf] Interfaz lista en ${Math.round(performance.now())} ms`
    );

    await registerPromise;

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
