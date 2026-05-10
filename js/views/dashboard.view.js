/* ─────────────────────────────────────────────
   DASHBOARD VIEW — Musicala Tracker
   Vista principal: sugerencias, estado y filtros
───────────────────────────────────────────── */

import { getSessions } from "../state/store.js";
import { MAPS } from "../config/maps.config.js";
import { renderStatBox } from "../ui/cards.js";

import {
  getCurrentCycleState,
  getNextRecommendedMap,
  getNextRecommendedByMap,
  getCycleLabel
} from "../utils/cleaning-cycle.js";

import {
  getAllZoneInfo,
  getAvailableZoneFilters,
  filterZones,
  getCleaningHealthSummary,
  getCoverageSummary,
  getGeneralCleaningStatus,
  getCleaningRecommendations,
  getZoneStatusLabel,
  getZoneReasonLabel
} from "../utils/zones.js";

import { daysSince } from "../utils/dates.js";

/* =============================================================================
 * Estado local de la vista
 * ============================================================================= */

let activeZoneFilter = "all";

/* =============================================================================
 * Elementos DOM
 * ============================================================================= */

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

/* =============================================================================
 * Helpers básicos
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

function toDateLabel(value) {
  if (!value) return "Sin registro";

  try {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(value);
  } catch {
    return "Sin registro";
  }
}

function daysText(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return "Sin registro";
  }

  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";

  return `Hace ${days}d`;
}

function getStatusClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "urgent") return "is-urgent";
  if (normalized === "soon") return "is-soon";
  if (normalized === "today") return "is-fresh";
  if (normalized === "never") return "is-never";

  return "is-neutral";
}

function getReasonClass(reasonId) {
  const normalized = String(reasonId || "").toLowerCase();

  if (normalized === "prioritydaily") return "is-priority";
  if (normalized === "dailyplan") return "is-plan";
  if (normalized === "cyclepending") return "is-cycle";
  if (normalized === "oldestzone") return "is-oldest";

  return "is-neutral";
}

/* =============================================================================
 * Stats claras
 * ============================================================================= */

function renderQuickStats(statsElement, sessions) {
  if (!statsElement) return;

  const totalSessions = sessions.length;

  const sessionsThisWeek = sessions.filter(session => {
    const days = daysSince(session.completedAt || session.startedAt);
    return days !== null && days <= 7;
  }).length;

  const health = getCleaningHealthSummary(sessions);
  const coverage = getCoverageSummary(sessions);
  const status = getGeneralCleaningStatus(sessions);
  const cycle = getCurrentCycleState(sessions);

  statsElement.innerHTML = [
    renderStatBox(cycle.cycleNumber, "Ciclo actual", "var(--primary)"),
    renderStatBox(cycle.currentStage.label, "Etapa", "var(--secondary)"),
    renderStatBox(`${cycle.progress.percent}%`, "Avance etapa", "var(--primary)"),
    renderStatBox(`${coverage.freshnessPercent}%`, "Frescura general", "var(--success)"),
    renderStatBox(coverage.cleanedToday, "Zonas hoy", "var(--success)"),
    renderStatBox(
      coverage.pendingZones,
      "Pendientes",
      coverage.pendingZones > 0 ? "var(--danger)" : "var(--success)"
    ),
    renderStatBox(coverage.zonesWithoutData, "Sin registro", "var(--text-muted)"),
    renderStatBox(sessionsThisWeek, "Esta semana", "var(--secondary)"),
    renderStatBox(totalSessions, "Sesiones", "var(--text-muted)")
  ].join("");

  statsElement.insertAdjacentHTML(
    "afterend",
    `
      <div class="metrics-note" aria-label="Explicación de estadísticas">
        <strong>Lectura rápida:</strong>
        Frescura mide qué tan recientes están las zonas.
        Avance etapa mide cuánto falta para completar el ciclo actual.
        No son lo mismo, porque claro, la vida necesitaba más de una métrica para trapear un pasillo.
      </div>
    `
  );

  return {
    health,
    coverage,
    status
  };
}

/* =============================================================================
 * Tarjeta principal: qué hacer ahora
 * ============================================================================= */

function renderXiaomiMiniPreset(xiaomi = {}) {
  const items = [
    ["Modo", xiaomi.modo],
    ["Succión", xiaomi.succion],
    ["Agua", xiaomi.agua || "Sin agua"],
    ["Trayectoria", xiaomi.trayectoria],
    ["Veces", xiaomi.veces]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (!items.length) return "";

  return `
    <div class="xiaomi-mini">
      ${items
        .map(([label, value]) => `
          <span class="xiaomi-pill">
            <strong>${esc(label)}:</strong> ${esc(value)}
          </span>
        `)
        .join("")}
    </div>
  `;
}

function renderTargetZones(zones = []) {
  if (!zones.length) {
    return `<span class="tag is-muted">Sin zonas sugeridas</span>`;
  }

  return zones
    .map(zone => `<span class="tag">${esc(zone)}</span>`)
    .join("");
}

function renderMainRecommendation(recommendation, cycle) {
  if (!recommendation) {
    return `
      <section class="next-hero is-empty">
        <div class="next-hero__content">
          <div class="section-kicker">Qué hacer ahora</div>
          <h2>Todo está cubierto por ahora</h2>
          <p>
            No hay una sugerencia principal pendiente. Revisa el historial o haz un repaso manual
            si hubo mucho movimiento en la sede.
          </p>
        </div>
      </section>
    `;
  }

  const reasonClass = getReasonClass(recommendation.reasonId);

  return `
    <section class="next-hero ${reasonClass}">
      <div class="next-hero__content">
        <div class="section-kicker">Qué hacer ahora</div>

        <div class="next-hero__head">
          <div>
            <h2>${esc(recommendation.name || recommendation.mapName || "Siguiente limpieza")}</h2>
            <p>
              ${esc(recommendation.reasonLabel || "Sugerencia")}
              · ${esc(recommendation.cleaningTypeLabel || cycle.currentStage.label)}
            </p>
          </div>

          <div class="next-hero__badge">
            ${esc(recommendation.reasonLabel || "Sugerencia")}
          </div>
        </div>

        <div class="next-hero__zones">
          ${renderTargetZones(recommendation.targetZones || [])}
        </div>

        <p class="next-hero__note">
          ${esc(recommendation.planNote || cycle.weekdayNote || cycle.currentStage.description)}
        </p>

        ${renderXiaomiMiniPreset(recommendation.xiaomi || cycle.xiaomi)}
      </div>

      <div class="next-hero__meta">
        <span>${esc(getCycleLabel(cycle))}</span>
        <strong>${esc(cycle.currentStage.label)}</strong>
        <span>${cycle.progress.percent}% etapa</span>
      </div>
    </section>
  `;
}

/* =============================================================================
 * Sugerencias secundarias
 * ============================================================================= */

function renderSecondaryRecommendation(item, index) {
  const reasonClass = getReasonClass(item.reasonId);

  return `
    <article class="next-card ${reasonClass}">
      <div class="next-card__rank">${index + 1}</div>

      <div class="next-card__body">
        <div class="next-card__head">
          <h3>${esc(item.name || item.mapName || `Mapa ${item.id}`)}</h3>
          <span>${esc(item.reasonLabel || "Sugerencia")}</span>
        </div>

        <div class="next-card__zones">
          ${renderTargetZones(item.targetZones || [])}
        </div>

        <p>${esc(item.planNote || item.reasonDescription || "Sugerencia de seguimiento.")}</p>
      </div>

      <div class="next-card__side">
        <strong>${esc(item.cleaningTypeLabel || item.cleaningType || "Limpieza")}</strong>
        <span>${daysText(item.days)}</span>
      </div>
    </article>
  `;
}

function renderSecondaryRecommendations(items = []) {
  const limited = items.slice(0, 3);

  if (!limited.length) {
    return `
      <div class="empty-soft">
        No hay sugerencias secundarias relevantes. Qué momento tan raro: una app sin ruido innecesario.
      </div>
    `;
  }

  return limited.map((item, index) => renderSecondaryRecommendation(item, index)).join("");
}

/* =============================================================================
 * Ciclo
 * ============================================================================= */

function renderCyclePanel(cycle) {
  const pendingMaps = cycle.progress.pendingMaps || [];

  return `
    <section class="cycle-panel">
      <div class="cycle-head">
        <div>
          <div class="cycle-kicker">${esc(getCycleLabel(cycle))}</div>
          <div class="cycle-title">Etapa actual: ${esc(cycle.currentStage.label)}</div>
        </div>

        <div class="cycle-percent">${cycle.progress.percent}%</div>
      </div>

      <div class="cycle-track">
        <div class="cycle-fill" style="width:${cycle.progress.percent}%"></div>
      </div>

      <div class="cycle-copy">
        ${esc(cycle.currentStage.description)}
      </div>

      <div class="cycle-copy">
        ${esc(cycle.weekdayNote || "")}
      </div>

      <div class="cycle-pending">
        ${pendingMaps.length
          ? pendingMaps
              .map(map => `
                <span class="tag">
                  ${esc(map.name)}: ${map.pendingZones.length}
                </span>
              `)
              .join("")
          : `<span class="tag">Etapa lista para avanzar</span>`}
      </div>
    </section>
  `;
}

/* =============================================================================
 * Render de sugerencias
 * ============================================================================= */

function renderNextToClean(nextListElement, sessions) {
  if (!nextListElement) return;

  const cycle = getCurrentCycleState(sessions);
  const recommendations = getCleaningRecommendations(sessions);
  const mainRecommendation = getNextRecommendedMap(sessions);
  const byMap = getNextRecommendedByMap(sessions);

  const secondary = byMap
    .filter(item => Number(item.id) !== Number(mainRecommendation?.id))
    .slice(0, 3);

  nextListElement.innerHTML = `
    ${renderMainRecommendation(mainRecommendation, cycle)}

    <div class="dashboard-two-col">
      <div>
        <div class="next-section-title">Sugerencias secundarias</div>
        <div class="next-stack">
          ${renderSecondaryRecommendations(
            secondary.length ? secondary : recommendations.topMaps || []
          )}
        </div>
      </div>

      <div>
        <div class="next-section-title">Estado del ciclo</div>
        ${renderCyclePanel(cycle)}
      </div>
    </div>
  `;
}

/* =============================================================================
 * Filtros de zonas
 * ============================================================================= */

function renderMapLegend(mapLegendElement, sessions) {
  if (!mapLegendElement) return;

  const filters = getAvailableZoneFilters();
  const zones = getAllZoneInfo(sessions);
  const filteredZones = filterZones(zones, activeZoneFilter, sessions);

  mapLegendElement.innerHTML = `
    <div class="zone-toolbar">
      <div>
        <div class="section-kicker">Estado de zonas</div>
        <h2>Filtrar zonas</h2>
      </div>

      <div class="zone-toolbar__count">
        ${filteredZones.length} de ${zones.length}
      </div>
    </div>

    <div class="zone-filters" role="tablist" aria-label="Filtros de zonas">
      ${filters
        .map(filter => {
          const active = filter.id === activeZoneFilter ? "is-active" : "";

          return `
            <button
              type="button"
              class="zone-filter ${active}"
              data-zone-filter="${esc(filter.id)}"
              aria-pressed="${filter.id === activeZoneFilter ? "true" : "false"}"
            >
              ${esc(filter.label)}
            </button>
          `;
        })
        .join("")}
    </div>

    <div class="map-mini-legend" aria-label="Colores de mapas">
      ${MAPS.map(map => `
        <span class="leg">
          <span class="leg-dot" style="background:${esc(map.color)}"></span>
          ${esc(map.name)}
        </span>
      `).join("")}
    </div>
  `;

  mapLegendElement.querySelectorAll("[data-zone-filter]").forEach(button => {
    button.addEventListener("click", () => {
      activeZoneFilter = button.dataset.zoneFilter || "all";

      const { mapLegend, zoneGrid } = getDashboardElements();
      renderMapLegend(mapLegend, getSessions());
      renderZones(zoneGrid, getSessions());
    });
  });
}

/* =============================================================================
 * Grid de zonas
 * ============================================================================= */

function renderZoneCardEnhanced(zone) {
  const statusClass = getStatusClass(zone.freshnessStatus);
  const reasonClass = zone.priorityDaily
    ? "is-priority"
    : zone.preferredToday
      ? "is-plan"
      : zone.pendingInCycle
        ? "is-cycle"
        : "is-neutral";

  const mapColor = zone.mapColor || "#ccc";

  return `
    <article
      class="zone-card ${statusClass} ${reasonClass}"
      data-map-id="${esc(zone.mapId)}"
      data-status="${esc(zone.freshnessStatus)}"
      data-cleaned-today="${zone.cleanedToday ? "true" : "false"}"
      data-priority="${zone.priorityDaily ? "true" : "false"}"
      style="--zone-map-color:${esc(mapColor)}"
    >
      <div class="zone-card__marker"></div>

      <div class="zone-card__head">
        <div>
          <h3>${esc(zone.name)}</h3>
          <p>${esc(zone.mapName || zone.mapLabel || "Sin mapa")}</p>
        </div>

        <span class="zone-card__dot" style="background:${esc(mapColor)}"></span>
      </div>

      <div class="zone-card__status">
        <strong>${esc(getZoneStatusLabel(zone.name, getSessions()))}</strong>
        <span>${esc(zone.freshnessLabel)}</span>
      </div>

      <div class="zone-card__tags">
        <span class="tag">${esc(getZoneReasonLabel(zone.name, getSessions()))}</span>
        ${zone.cleanedToday ? `<span class="tag is-success">Hecha hoy</span>` : ""}
        ${zone.priorityDaily ? `<span class="tag is-primary">Visible</span>` : ""}
        ${zone.pendingInCycle ? `<span class="tag is-cycle">Ciclo</span>` : ""}
      </div>

      <div class="zone-card__foot">
        <span>Último: ${esc(toDateLabel(zone.lastCleaned))}</span>
        <strong>${daysText(zone.days)}</strong>
      </div>
    </article>
  `;
}

function renderZones(zoneGridElement, sessions) {
  if (!zoneGridElement) return;

  const allZones = getAllZoneInfo(sessions);
  const zones = filterZones(allZones, activeZoneFilter, sessions);

  if (!zones.length) {
    zoneGridElement.innerHTML = `
      <div class="empty-soft">
        No hay zonas para este filtro. Al fin un filtro que sí filtra, pequeño milagro doméstico.
      </div>
    `;
    return;
  }

  zoneGridElement.innerHTML = zones
    .map(zone => renderZoneCardEnhanced(zone))
    .join("");
}

/* =============================================================================
 * Render principal
 * ============================================================================= */

export function renderDashboardView() {
  const sessions = getSessions();
  const {
    load,
    body,
    stats,
    nextList,
    mapLegend,
    zoneGrid
  } = getDashboardElements();

  hide(load);
  show(body);

  renderQuickStats(stats, sessions);
  renderNextToClean(nextList, sessions);
  renderMapLegend(mapLegend, sessions);
  renderZones(zoneGrid, sessions);
}