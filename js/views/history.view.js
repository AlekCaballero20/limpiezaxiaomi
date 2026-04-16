/* ─────────────────────────────────────────────
   HISTORY VIEW — Musicala Tracker
   Render y acciones de la vista historial
───────────────────────────────────────────── */

import { getSessions, removeSession } from "../state/store.js";
import { deleteSession as deleteSessionFromService } from "../services/sessions.service.js";
import { renderSessionCard, renderEmptyState } from "../ui/cards.js";
import { toastSuccess, toastError } from "../ui/toast.js";
import { renderDashboardView } from "./dashboard.view.js";
import { renderStatsView } from "./stats.view.js";

/* ==============================
   ELEMENTOS DOM
============================== */
function getHistoryElements() {
  return {
    load: document.getElementById("hist-load"),
    body: document.getElementById("hist-body")
  };
}

/* ==============================
   HELPERS UI
============================== */
function show(element) {
  if (element) element.style.display = "block";
}

function hide(element) {
  if (element) element.style.display = "none";
}

/* ==============================
   EVENTOS
============================== */
function setupDeleteButtons(container) {
  if (!container) return;

  const deleteButtons = container.querySelectorAll(".btn-del");

  deleteButtons.forEach(button => {
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.id;
      if (!sessionId) return;

      const confirmed = window.confirm("¿Eliminar esta sesión?");
      if (!confirmed) return;

      try {
        await deleteSessionFromService(sessionId);
        removeSession(sessionId);

        renderHistoryView();
        renderDashboardView();
        renderStatsView();

        toastSuccess("Sesión eliminada");
      } catch (error) {
        console.error("Error eliminando sesión:", error);
        toastError("No se pudo eliminar la sesión");
      }
    });
  });
}

/* ==============================
   RENDER PRINCIPAL
============================== */
export function renderHistoryView() {
  const sessions = getSessions();
  const { load, body } = getHistoryElements();

  hide(load);
  show(body);

  if (!body) return;

  if (!sessions.length) {
    body.innerHTML = renderEmptyState(
      "📋",
      "Aún no hay sesiones registradas"
    );
    return;
  }

  body.innerHTML = sessions
    .map(session => renderSessionCard(session))
    .join("");

  setupDeleteButtons(body);
}