/* ─────────────────────────────────────────────
   HISTORY VIEW - Musicala Tracker
   Render y acciones de la vista historial
───────────────────────────────────────────── */

import { getSessions, removeSession } from "../state/store.js";
import { deleteSession as deleteSessionFromService } from "../services/sessions.service.js";
import { renderSessionCard, renderEmptyState } from "../ui/cards.js";
import { toastSuccess, toastError } from "../ui/toast.js";
import { renderDashboardView } from "./dashboard.view.js";
import { renderStatsView } from "./stats.view.js";
import { tsToDate } from "../utils/dates.js";
import {
  getSessionCleaningType,
  getSessionCycleMeta
} from "../utils/cleaning-cycle.js";

/* =============================================================================
 * Estado local
 * ============================================================================= */

const historyState = {
  search: "",
  type: "all",
  source: "all",
  period: "all"
};

/* =============================================================================
 * Elementos DOM
 * ============================================================================= */

function getHistoryElements() {
  return {
    load: document.getElementById("hist-load"),
    body: document.getElementById("hist-body")
  };
}

/* =============================================================================
 * Helpers UI
 * ============================================================================= */

function show(element) {
  if (element) element.style.display = "block";
}

function hide(element) {
  if (element) element.style.display = "none";
}

function esc(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getSessionDate(session = {}) {
  return (
    tsToDate(session.completedAt) ||
    tsToDate(session.startedAt) ||
    new Date(0)
  );
}

function startOfDay(value = new Date()) {
  const date = tsToDate(value) || new Date(value);

  if (!date || Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetweenDates(a, b) {
  const dayA = startOfDay(a);
  const dayB = startOfDay(b);

  if (!dayA || !dayB) return null;

  return Math.floor((dayB.getTime() - dayA.getTime()) / 86400000);
}

function getDateKey(date) {
  const safeDate = date instanceof Date ? date : new Date(date);

  if (!safeDate || Number.isNaN(safeDate.getTime())) {
    return "sin-fecha";
  }

  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateGroup(date) {
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha";

  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diff = daysBetweenDates(target, today);

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";

  try {
    return new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  } catch {
    return getDateKey(date);
  }
}

function formatSmallDate(date) {
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short"
    }).format(date);
  } catch {
    return "";
  }
}

function sortSessionsDesc(sessions = []) {
  return [...sessions].sort((a, b) => {
    return getSessionDate(b).getTime() - getSessionDate(a).getTime();
  });
}

function sortSessionsAsc(sessions = []) {
  return [...sessions].sort((a, b) => {
    return getSessionDate(a).getTime() - getSessionDate(b).getTime();
  });
}

function getSessionsBefore(session = {}, allSessions = []) {
  const currentDate = getSessionDate(session);
  const currentTime = currentDate.getTime();

  return sortSessionsAsc(allSessions).filter(candidate => {
    if (candidate.id === session.id) return false;

    const candidateTime = getSessionDate(candidate).getTime();

    return candidateTime < currentTime;
  });
}

function getSessionText(session = {}) {
  return [
    session.mapName,
    session.mapLabel,
    session.notes,
    session.cleaningType,
    session.cleaningMode,
    session.recommendationSource,
    ...(session.zones || [])
  ]
    .filter(Boolean)
    .join(" ");
}

function getSessionSource(session = {}, sessionsBefore = []) {
  const inferredMeta = getSessionCycleMeta(session, sessionsBefore);

  return (
    session.recommendationSource ||
    inferredMeta.recommendationSource ||
    "manual"
  );
}

function getSessionCountsForCycle(session = {}, sessionsBefore = []) {
  const inferredMeta = getSessionCycleMeta(session, sessionsBefore);

  return Boolean(
    session.countsForCycle ??
    session.countsForStage ??
    inferredMeta.countsForCycle
  );
}

/* =============================================================================
 * Filtros
 * ============================================================================= */

function isSessionInsidePeriod(session = {}, period = "all") {
  if (period === "all") return true;

  const sessionDate = getSessionDate(session);
  const today = new Date();
  const diff = daysBetweenDates(sessionDate, today);

  if (diff === null) return false;

  if (period === "today") return diff === 0;
  if (period === "week") return diff <= 7;
  if (period === "month") return diff <= 30;

  return true;
}

function filterSessions(sessions = []) {
  const search = normalizeText(historyState.search);

  return sessions.filter(session => {
    const sessionsBefore = getSessionsBefore(session, sessions);
    const cleaningType = getSessionCleaningType(session);
    const source = getSessionSource(session, sessionsBefore);
    const countsForCycle = getSessionCountsForCycle(session, sessionsBefore);

    const matchesSearch = search
      ? normalizeText(getSessionText(session)).includes(search)
      : true;

    const matchesType =
      historyState.type === "all" ||
      normalizeText(cleaningType) === normalizeText(historyState.type);

    const matchesSource =
      historyState.source === "all" ||
      (
        historyState.source === "recommended" &&
        normalizeText(source) === "recomendada"
      ) ||
      (
        historyState.source === "counts" &&
        countsForCycle
      ) ||
      (
        historyState.source === "manual" &&
        !countsForCycle
      );

    const matchesPeriod = isSessionInsidePeriod(session, historyState.period);

    return matchesSearch && matchesType && matchesSource && matchesPeriod;
  });
}

function groupSessionsByDate(sessions = []) {
  return sessions.reduce((groups, session) => {
    const date = getSessionDate(session);
    const key = getDateKey(date);

    if (!groups[key]) {
      groups[key] = {
        key,
        date,
        label: formatDateGroup(date),
        sessions: []
      };
    }

    groups[key].sessions.push(session);

    return groups;
  }, {});
}

/* =============================================================================
 * Resumen
 * ============================================================================= */

function getHistorySummary(sessions = []) {
  const today = new Date();

  const todaySessions = sessions.filter(session => {
    return daysBetweenDates(getSessionDate(session), today) === 0;
  }).length;

  const weekSessions = sessions.filter(session => {
    const diff = daysBetweenDates(getSessionDate(session), today);
    return diff !== null && diff <= 7;
  }).length;

  const deepSessions = sessions.filter(session => {
    return getSessionCleaningType(session) === "profundo";
  }).length;

  const standardSessions = sessions.filter(session => {
    return getSessionCleaningType(session) === "estandar";
  }).length;

  const quickSessions = sessions.filter(session => {
    return getSessionCleaningType(session) === "rapido";
  }).length;

  return {
    total: sessions.length,
    today: todaySessions,
    week: weekSessions,
    profundo: deepSessions,
    estandar: standardSessions,
    rapido: quickSessions
  };
}

function renderHistorySummary(sessions = [], filteredSessions = []) {
  const summary = getHistorySummary(sessions);

  return `
    <section class="history-summary">
      <article class="history-stat">
        <strong>${summary.total}</strong>
        <span>Registros</span>
      </article>

      <article class="history-stat">
        <strong>${summary.today}</strong>
        <span>Hoy</span>
      </article>

      <article class="history-stat">
        <strong>${summary.week}</strong>
        <span>Últimos 7 días</span>
      </article>

      <article class="history-stat">
        <strong>${summary.profundo}</strong>
        <span>Profundos</span>
      </article>

      <article class="history-stat">
        <strong>${summary.estandar}</strong>
        <span>Estándar</span>
      </article>

      <article class="history-stat">
        <strong>${summary.rapido}</strong>
        <span>Rápidos</span>
      </article>

      <article class="history-stat is-muted">
        <strong>${filteredSessions.length}</strong>
        <span>Mostrados</span>
      </article>
    </section>
  `;
}

/* =============================================================================
 * Toolbar
 * ============================================================================= */

function renderHistoryToolbar() {
  return `
    <section class="history-toolbar">
      <div class="history-toolbar__head">
        <div>
          <div class="section-kicker">Historial</div>
          <h2>Registros de limpieza</h2>
          <p>
            Consulta qué se hizo, cuándo se hizo y si contó para la etapa del ciclo.
            Sí, ahora la app intenta explicar las cosas como si respetara el tiempo humano.
          </p>
        </div>

        <button
          type="button"
          class="history-clear-filters"
          data-history-clear
        >
          Limpiar filtros
        </button>
      </div>

      <div class="history-filters">
        <label class="history-search">
          <span>Buscar</span>
          <input
            type="search"
            data-history-search
            placeholder="Zona, mapa o nota..."
            value="${esc(historyState.search)}"
          />
        </label>

        <label>
          <span>Tipo</span>
          <select data-history-type>
            <option value="all" ${historyState.type === "all" ? "selected" : ""}>Todos</option>
            <option value="profundo" ${historyState.type === "profundo" ? "selected" : ""}>Profundo</option>
            <option value="estandar" ${historyState.type === "estandar" ? "selected" : ""}>Estándar</option>
            <option value="rapido" ${historyState.type === "rapido" ? "selected" : ""}>Rápido</option>
          </select>
        </label>

        <label>
          <span>Estado ciclo</span>
          <select data-history-source>
            <option value="all" ${historyState.source === "all" ? "selected" : ""}>Todos</option>
            <option value="recommended" ${historyState.source === "recommended" ? "selected" : ""}>Sugeridos</option>
            <option value="counts" ${historyState.source === "counts" ? "selected" : ""}>Cuenta para etapa</option>
            <option value="manual" ${historyState.source === "manual" ? "selected" : ""}>Manual / menor intensidad</option>
          </select>
        </label>

        <label>
          <span>Periodo</span>
          <select data-history-period>
            <option value="all" ${historyState.period === "all" ? "selected" : ""}>Todo</option>
            <option value="today" ${historyState.period === "today" ? "selected" : ""}>Hoy</option>
            <option value="week" ${historyState.period === "week" ? "selected" : ""}>Últimos 7 días</option>
            <option value="month" ${historyState.period === "month" ? "selected" : ""}>Últimos 30 días</option>
          </select>
        </label>
      </div>
    </section>
  `;
}

function setupHistoryFilters(container) {
  if (!container) return;

  const searchInput = container.querySelector("[data-history-search]");
  const typeSelect = container.querySelector("[data-history-type]");
  const sourceSelect = container.querySelector("[data-history-source]");
  const periodSelect = container.querySelector("[data-history-period]");
  const clearButton = container.querySelector("[data-history-clear]");

  if (searchInput) {
    searchInput.addEventListener("input", event => {
      historyState.search = event.target.value || "";
      renderHistoryView();
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener("change", event => {
      historyState.type = event.target.value || "all";
      renderHistoryView();
    });
  }

  if (sourceSelect) {
    sourceSelect.addEventListener("change", event => {
      historyState.source = event.target.value || "all";
      renderHistoryView();
    });
  }

  if (periodSelect) {
    periodSelect.addEventListener("change", event => {
      historyState.period = event.target.value || "all";
      renderHistoryView();
    });
  }

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      historyState.search = "";
      historyState.type = "all";
      historyState.source = "all";
      historyState.period = "all";

      renderHistoryView();
    });
  }
}

/* =============================================================================
 * Render de grupos
 * ============================================================================= */

function renderHistoryGroups(sessions = [], allSessions = []) {
  if (!sessions.length) {
    return renderEmptyState(
      "🧹",
      "No hay registros para estos filtros",
      "Prueba limpiar filtros o revisar otro periodo."
    );
  }

  const grouped = groupSessionsByDate(sortSessionsDesc(sessions));

  return Object.values(grouped)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(group => {
      return `
        <section class="history-day">
          <div class="history-day__head">
            <div>
              <h3>${esc(group.label)}</h3>
              <span>${esc(formatSmallDate(group.date))}</span>
            </div>

            <strong>
              ${group.sessions.length}
              ${group.sessions.length === 1 ? "registro" : "registros"}
            </strong>
          </div>

          <div class="history-day__list">
            ${group.sessions
              .map(session => {
                const sessionsBefore = getSessionsBefore(session, allSessions);
                return renderSessionCard(session, sessionsBefore);
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

/* =============================================================================
 * Eventos de eliminar
 * ============================================================================= */

function setupDeleteButtons(container) {
  if (!container) return;

  const deleteButtons = container.querySelectorAll(".btn-del");

  deleteButtons.forEach(button => {
    button.addEventListener("click", async () => {
      const sessionId = button.dataset.id;
      if (!sessionId) return;

      const confirmed = window.confirm(
        "¿Eliminar esta sesión? Esto también actualizará las sugerencias y estadísticas."
      );

      if (!confirmed) return;

      button.disabled = true;
      button.classList.add("is-loading");

      try {
        await deleteSessionFromService(sessionId);
        removeSession(sessionId);

        renderHistoryView();
        renderDashboardView();
        renderStatsView();

        toastSuccess("Sesión eliminada");
      } catch (error) {
        console.error("Error eliminando sesión:", error);
        button.disabled = false;
        button.classList.remove("is-loading");
        toastError("No se pudo eliminar la sesión");
      }
    });
  });
}

/* =============================================================================
 * Render principal
 * ============================================================================= */

export function renderHistoryView() {
  const sessions = sortSessionsDesc(getSessions());
  const { load, body } = getHistoryElements();

  hide(load);
  show(body);

  if (!body) return;

  if (!sessions.length) {
    body.innerHTML = `
      ${renderHistoryToolbar()}
      ${renderEmptyState(
        "📋",
        "Aún no hay sesiones registradas",
        "Cuando Morchis haga su primera limpieza, aparecerá aquí con su historial."
      )}
    `;

    setupHistoryFilters(body);
    return;
  }

  const filteredSessions = filterSessions(sessions);

  body.innerHTML = `
    ${renderHistoryToolbar()}
    ${renderHistorySummary(sessions, filteredSessions)}
    ${renderHistoryGroups(filteredSessions, sessions)}
  `;

  setupHistoryFilters(body);
  setupDeleteButtons(body);
}