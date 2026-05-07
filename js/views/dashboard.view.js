/* ─────────────────────────────────────────────
   DASHBOARD VIEW — Musicala Tracker
   Render de la vista principal
───────────────────────────────────────────── */

import { getSessions } from "../state/store.js";
import { ALL_ZONES, MAPS } from "../config/maps.config.js";
import { renderNextItem, renderZoneCard, renderStatBox } from "../ui/cards.js";
import {
  getCurrentCycleState,
  getNextRecommendedByMap,
  getNextRecommendedMap,
  getCycleLabel
} from "../utils/cleaning-cycle.js";
import {
  getCleaningHealthSummary,
  getCleaningRecommendations,
  getLastCleanedForZone,
  getZonesWithoutData
} from "../utils/zones.js";
import { daysSince } from "../utils/dates.js";

/* ==============================
   ELEMENTOS DOM
============================== */
function getDashboardElements() {
  return {
    load: document.getElementById("dash-load"),
    body: document.getElementById("dash-body"),
    stats: document.getElementById("q-stats"),
    nextList: document.getElementById("next-list"),
    mapLegend: document.getElementById("map-legend"),
    zoneGrid: document.getElementById("zone-grid")
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
   STATS
============================== */
function renderQuickStats(statsElement, sessions) {
  if (!statsElement) return;

  const totalSessions = sessions.length;
  const sessionsThisWeek = sessions.filter(session => {
    const days = daysSince(session.completedAt);
    return days !== null && days <= 7;
  }).length;

  const noDataCount = getZonesWithoutData(sessions).length;
  const health = getCleaningHealthSummary(sessions);
  const cycle = getCurrentCycleState(sessions);

  statsElement.innerHTML = [
    renderStatBox(cycle.cycleNumber, "Ciclo actual", "var(--primary)"),
    renderStatBox(cycle.currentStage.label, "Etapa", "var(--secondary)"),
    renderStatBox(health.cleanedToday, "Zonas hoy", "var(--success)"),
    renderStatBox(`${health.freshnessPercent}%`, "Frescura", "var(--primary)"),
    renderStatBox(
      health.attentionZones || noDataCount,
      "Por atender",
      health.attentionZones > 0 || noDataCount > 0 ? "var(--danger)" : "var(--success)"
    ),
    renderStatBox(sessionsThisWeek, "Esta semana", "var(--secondary)"),
    renderStatBox(totalSessions, "Sesiones", "var(--text-muted)")
  ].join("");
}

/* ==============================
   SIGUIENTE EN LIMPIAR
============================== */
function renderNextToClean(nextListElement, sessions) {
  if (!nextListElement) return;

  const recommendations = getCleaningRecommendations(sessions);
  const cycle = getCurrentCycleState(sessions);
  const nextGlobal = getNextRecommendedMap(sessions);
  const byMap = getNextRecommendedByMap(sessions);
  const pendingMaps = cycle.progress.pendingMaps;

  const cycleSummary = `
    <div class="cycle-panel">
      <div class="cycle-head">
        <div>
          <div class="cycle-kicker">${getCycleLabel(cycle)}</div>
          <div class="cycle-title">Etapa actual: ${cycle.currentStage.label}</div>
        </div>
        <div class="cycle-percent">${cycle.progress.percent}%</div>
      </div>
      <div class="cycle-track"><div class="cycle-fill" style="width:${cycle.progress.percent}%"></div></div>
      <div class="cycle-copy">${cycle.currentStage.description}</div>
      <div class="cycle-copy">${cycle.weekdayNote}</div>
      <div class="cycle-pending">
        ${pendingMaps.length
          ? pendingMaps.map(map => `<span class="tag">${map.name}: ${map.pendingZones.length}</span>`).join("")
          : `<span class="tag">Etapa lista para avanzar</span>`}
      </div>
    </div>
  `;

  const globalSummary = nextGlobal
    ? `<div class="next-section-title">Siguiente sugerencia global</div>${renderNextItem(nextGlobal, 0, nextGlobal.days)}`
    : "";

  const byMapSummary = `
    <div class="next-section-title">Siguiente sugerencia por mapa/piso</div>
    ${byMap
    .map((map, index) => renderNextItem(map, index, map.days))
    .join("")}
  `;

  nextListElement.innerHTML = `
    ${cycleSummary}
    ${globalSummary}
    ${byMapSummary || recommendations.topMaps.map((map, index) => renderNextItem(map, index, map.days)).join("")}
  `;
}

/* ==============================
   LEYENDA DE MAPAS
============================== */
function renderMapLegend(mapLegendElement) {
  if (!mapLegendElement) return;

  mapLegendElement.innerHTML = MAPS.map(map => `
    <div class="leg">
      <div class="leg-dot" style="background:${map.color}"></div>
      ${map.name}
    </div>
  `).join("");
}

/* ==============================
   GRID DE ZONAS
============================== */
function renderZones(zoneGridElement, sessions) {
  if (!zoneGridElement) return;

  zoneGridElement.innerHTML = ALL_ZONES.map(zoneName => {
    const lastCleaned = getLastCleanedForZone(zoneName, sessions);
    const days = daysSince(lastCleaned);
    return renderZoneCard(zoneName, days);
  }).join("");
}

/* ==============================
   RENDER PRINCIPAL
============================== */
export function renderDashboardView() {
  const sessions = getSessions();
  const { load, body, stats, nextList, mapLegend, zoneGrid } = getDashboardElements();

  hide(load);
  show(body);

  renderQuickStats(stats, sessions);
  renderNextToClean(nextList, sessions);
  renderMapLegend(mapLegend);
  renderZones(zoneGrid, sessions);
}
