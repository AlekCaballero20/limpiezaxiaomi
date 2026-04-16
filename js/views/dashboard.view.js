/* ─────────────────────────────────────────────
   DASHBOARD VIEW — Musicala Tracker
   Render de la vista principal
───────────────────────────────────────────── */

import { getSessions } from "../state/store.js";
import { ALL_ZONES, MAPS } from "../config/maps.config.js";
import { renderNextItem, renderZoneCard, renderStatBox } from "../ui/cards.js";
import { getRankedMapsByUrgency, getLastCleanedForZone, getZonesWithoutData } from "../utils/zones.js";
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

  statsElement.innerHTML = [
    renderStatBox(totalSessions, "Sesiones totales", "var(--primary)"),
    renderStatBox(sessionsThisWeek, "Esta semana", "var(--secondary)"),
    renderStatBox(
      noDataCount,
      "Sin registros",
      noDataCount > 0 ? "var(--danger)" : "var(--success)"
    )
  ].join("");
}

/* ==============================
   SIGUIENTE EN LIMPIAR
============================== */
function renderNextToClean(nextListElement, sessions) {
  if (!nextListElement) return;

  const rankedMaps = getRankedMapsByUrgency(sessions);

  nextListElement.innerHTML = rankedMaps
    .map((map, index) => renderNextItem(map, index, map.days))
    .join("");
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