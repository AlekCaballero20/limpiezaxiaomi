import { getSessions } from "../state/store.js";
import { MAPS, ALL_ZONES } from "../config/maps.config.js";
import { renderBarRow, renderEmptyState, renderStatBox } from "../ui/cards.js";
import {
  getCleaningHealthSummary,
  getCleaningRecommendations,
  getLastCleanedForZone,
  getMapCoverage,
  getSessionsByZone
} from "../utils/zones.js";
import { daysSince, tsToDate } from "../utils/dates.js";
import { statusColor, statusLabel } from "../utils/status.js";

function getStatsElements() {
  return {
    load: document.getElementById("stats-load"),
    body: document.getElementById("stats-body")
  };
}

function show(element) {
  if (element) element.style.display = "block";
}

function hide(element) {
  if (element) element.style.display = "none";
}

function getMapStats(sessions) {
  return MAPS.map(map => ({
    ...map,
    count: sessions.filter(session => session.mapId === map.id).length,
    coverage: getMapCoverage(map.id, sessions)
  }));
}

function getZoneStats(sessions) {
  return ALL_ZONES.map(zoneName => {
    const hits = getSessionsByZone(zoneName, sessions);
    const count = hits.length;
    const lastCleaned = getLastCleanedForZone(zoneName, sessions);
    const days = daysSince(lastCleaned);

    let avgCycle = null;
    if (count >= 2) {
      const sortedDates = hits
        .map(session => tsToDate(session.completedAt))
        .filter(Boolean)
        .sort((a, b) => a - b);
      const intervals = [];
      for (let i = 1; i < sortedDates.length; i++) {
        intervals.push((sortedDates[i] - sortedDates[i - 1]) / 86400000);
      }
      if (intervals.length) {
        avgCycle = Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length);
      }
    }

    return {
      zone: zoneName,
      count,
      days,
      avg: avgCycle
    };
  }).sort((a, b) => {
    const aPriority = a.days === null ? 9999 : a.days;
    const bPriority = b.days === null ? 9999 : b.days;
    return bPriority - aPriority;
  });
}

function renderHealthSection(sessions) {
  const health = getCleaningHealthSummary(sessions);

  return `
    <div class="stat-row stat-row-wide">
      ${renderStatBox(health.cleanedToday, "Zonas limpiadas hoy", "var(--success)")}
      ${renderStatBox(`${health.freshnessPercent}%`, "Zonas frescas", "var(--primary)")}
      ${renderStatBox(health.attentionZones, "Zonas por atender", health.attentionZones ? "var(--danger)" : "var(--success)")}
      ${renderStatBox(health.deepSessions, "Profundas", "var(--secondary)")}
      ${renderStatBox(health.quickSessions, "Rapidas", "var(--warning)")}
    </div>
  `;
}

function renderDecisionSection(sessions) {
  const recommendation = getCleaningRecommendations(sessions);
  const first = recommendation.topMaps[0];
  if (!first) return "";

  return `
    <div class="card decision-card">
      <div class="card-label">Decision sugerida</div>
      <div class="decision-title">${first.name} - ${first.label}</div>
      <div class="decision-copy">${first.planTitle}: ${first.planNote}</div>
      <div class="decision-tags">
        ${first.targetZones.map(zone => `<span class="tag">${zone}</span>`).join("")}
      </div>
      <div class="decision-settings">
        Xiaomi: ${first.xiaomi.modo || "aspirar"} / ${first.xiaomi.succion || "estandar"} / ${first.xiaomi.trayectoria || "estandar"} / ${first.xiaomi.veces || 1} vez
      </div>
    </div>
  `;
}

function renderMapStatsSection(mapStats) {
  const maxValue = Math.max(...mapStats.map(item => item.count), 1);

  return `
    <div class="card">
      <div class="card-label">Sesiones y pendientes por mapa</div>
      <div class="bar-chart">
        ${mapStats.map(map =>
          renderBarRow(
            `${map.name} - ${map.label} (${map.coverage?.overdue || 0} pendientes)`,
            map.count,
            maxValue,
            map.color
          )
        ).join("")}
      </div>
    </div>
  `;
}

function renderZoneStatsSection(zoneStats) {
  const maxValue = Math.max(...zoneStats.map(item => item.count), 1);

  return `
    <div class="card">
      <div class="card-label">Limpiezas por zona</div>
      <div class="bar-chart">
        ${zoneStats.map(item =>
          renderBarRow(item.zone, item.count, maxValue, "var(--primary)")
        ).join("")}
      </div>
    </div>
  `;
}

function renderLastCleanedSection(zoneStats) {
  return `
    <div class="card">
      <div class="card-label">Prioridad por zona</div>
      ${zoneStats.map(item => `
        <div class="zone-status-row">
          <div class="zsr-dot" style="background:${statusColor(item.days)}"></div>
          <div class="zsr-name">${item.zone}</div>
          <div class="zsr-days" style="color:${statusColor(item.days)}">${statusLabel(item.days)}</div>
          ${item.avg !== null ? `<div class="zsr-avg">~${item.avg}d/ciclo</div>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

export function renderStatsView() {
  const sessions = getSessions();
  const { load, body } = getStatsElements();

  hide(load);
  show(body);

  if (!body) return;

  if (sessions.length < 1) {
    body.innerHTML = `
      <div class="card">
        ${renderEmptyState("ST", "Registra una sesion para activar estadisticas")}
      </div>
    `;
    return;
  }

  const mapStats = getMapStats(sessions);
  const zoneStats = getZoneStats(sessions);

  body.innerHTML = `
    ${renderHealthSection(sessions)}
    ${renderDecisionSection(sessions)}
    ${renderMapStatsSection(mapStats)}
    ${renderZoneStatsSection(zoneStats)}
    ${renderLastCleanedSection(zoneStats)}
  `;
}
