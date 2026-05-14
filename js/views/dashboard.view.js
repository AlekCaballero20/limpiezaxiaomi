import { getSessions } from "../state/store.js";
import { MAPS } from "../config/maps.config.js";
import { renderStatBox } from "../ui/cards.js";
import { switchTab } from "../ui/tabs.js";
import {
  getDailyVisibleStatus,
  getNextWeeklyRecommendations,
  getRecommendedCleaningTypeForZone,
  getWeeklyZoneLedger
} from "../utils/weekly-cleaning.js";

let activeZoneFilter = "all";
let activeSuggestion = null;

const WEEKLY_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "missing-profundo", label: "Falta profundo" },
  { id: "missing-estandar", label: "Falta estandar" },
  { id: "missing-rapido", label: "Falta rapido" },
  { id: "ready", label: "Listos" },
  { id: "map-1", label: "Mapa 1" },
  { id: "map-2", label: "Mapa 2" },
  { id: "map-3", label: "Mapa 3" },
  { id: "map-4", label: "Mapa 4" }
];

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

function formatWeekRange(range) {
  const fmt = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" });
  return `${fmt.format(range.start)} - ${fmt.format(range.end)}`;
}

function renderQuickStats(statsElement, sessions) {
  if (!statsElement) return;

  const daily = getDailyVisibleStatus(sessions);
  const weekly = getWeeklyZoneLedger(sessions);

  statsElement.innerHTML = [
    renderStatBox(`${daily.doneCount}/${daily.total}`, "Rutina diaria", daily.completed ? "var(--success)" : "var(--danger)"),
    renderStatBox(`${weekly.completeCount}/${weekly.totalZones}`, "Zonas listas", weekly.completed ? "var(--success)" : "var(--primary)"),
    renderStatBox(weekly.pendingCount, "Zonas con deuda", weekly.pendingCount ? "var(--danger)" : "var(--success)"),
    renderStatBox(formatWeekRange(weekly.week), "Semana", "var(--secondary)"),
    renderStatBox(sessions.length, "Sesiones", "var(--text-muted)")
  ].join("");
}

function renderProgressChip(label, done, target, type) {
  const complete = Number(done) >= Number(target);
  return `
    <span class="weekly-chip ${complete ? "is-ready" : "is-pending"}" data-type="${esc(type)}">
      ${esc(label)} <strong>${done}/${target}</strong>
    </span>
  `;
}

function renderDailyVisibleBlock(daily) {
  return `
    <section class="weekly-panel">
      <div class="weekly-panel__head">
        <div>
          <div class="section-kicker">Rutina diaria visible</div>
          <h2>${daily.doneCount}/${daily.total} listas hoy</h2>
        </div>
        <span class="weekly-status ${daily.completed ? "is-ready" : "is-pending"}">
          ${daily.completed ? "Completa" : "Pendiente"}
        </span>
      </div>

      <div class="visible-routine-grid">
        ${daily.zones.map(zone => `
          <article class="visible-zone ${zone.done ? "is-ready" : "is-pending"}" style="--zone-map-color:${esc(zone.mapColor)}">
            <span class="zone-card__dot" style="background:${esc(zone.mapColor)}"></span>
            <div>
              <strong>${esc(zone.zoneName)}</strong>
              <span>${esc(zone.mapName)} ${zone.done ? "- lista" : "- falta"}</span>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderXiaomiMiniPreset(xiaomi = {}) {
  const items = [
    ["Modo", xiaomi.modo],
    ["Succion", xiaomi.succion],
    ["Agua", xiaomi.agua || "Sin agua"],
    ["Trayectoria", xiaomi.trayectoria],
    ["Veces", xiaomi.veces]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  return `
    <div class="xiaomi-mini">
      ${items.map(([label, value]) => `
        <span class="xiaomi-pill"><strong>${esc(label)}:</strong> ${esc(value)}</span>
      `).join("")}
    </div>
  `;
}

function renderSuggestionBlock(suggestion) {
  if (!suggestion) {
    return `
      <section class="next-hero is-empty">
        <div class="next-hero__content">
          <div class="section-kicker">Siguiente accion sugerida</div>
          <h2>Semana completa</h2>
          <p>No hay rutina visible ni deuda semanal pendiente.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="next-hero is-cycle">
      <div class="next-hero__content">
        <div class="section-kicker">Siguiente accion sugerida</div>
        <div class="next-hero__head">
          <div>
            <h2>${esc(suggestion.mapName || suggestion.name || "Siguiente limpieza")}</h2>
            <p>${esc(suggestion.reasonLabel)} - ${esc(suggestion.cleaningTypeLabel)}</p>
          </div>
          <button type="button" class="btn primary" id="use-weekly-suggestion">
            Usar esta sugerencia
          </button>
        </div>

        <div class="next-hero__zones">
          ${(suggestion.targetZones || []).map(zone => `<span class="tag">${esc(zone)}</span>`).join("")}
        </div>

        <p class="next-hero__note">${esc(suggestion.planNote || "")}</p>
        ${renderXiaomiMiniPreset(suggestion.xiaomi)}
      </div>

      <div class="next-hero__meta">
        <span>${esc(suggestion.mapLabel || "")}</span>
        <strong>${esc(suggestion.cleaningTypeLabel)}</strong>
        <span>${esc(suggestion.reasonLabel)}</span>
      </div>
    </section>
  `;
}

function bindSuggestionButton() {
  const button = document.getElementById("use-weekly-suggestion");
  if (!button || !activeSuggestion) return;

  button.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("xiaomi:use-weekly-suggestion", {
      detail: activeSuggestion
    }));
    switchTab("registrar");
  });
}

function renderTopBlocks(nextListElement, sessions) {
  if (!nextListElement) return;

  const { daily, weekly, main } = getNextWeeklyRecommendations(sessions);
  activeSuggestion = main;

  nextListElement.innerHTML = `
    ${renderDailyVisibleBlock(daily)}
    ${renderSuggestionBlock(main)}
    <section class="weekly-panel weekly-summary">
      <div class="weekly-panel__head">
        <div>
          <div class="section-kicker">Cumplimiento semanal</div>
          <h2>${weekly.completeCount}/${weekly.totalZones} zonas completas</h2>
        </div>
        <span class="weekly-status ${weekly.completed ? "is-ready" : "is-pending"}">
          ${weekly.completed ? "Lista" : `${weekly.pendingCount} pendientes`}
        </span>
      </div>
    </section>
  `;

  bindSuggestionButton();
}

function filterWeeklyZones(zones = []) {
  return zones.filter(zone => {
    if (activeZoneFilter === "all") return true;
    if (activeZoneFilter === "ready") return zone.completed;
    if (activeZoneFilter.startsWith("map-")) {
      return Number(zone.mapId) === Number(activeZoneFilter.replace("map-", ""));
    }
    if (activeZoneFilter.startsWith("missing-")) {
      const type = activeZoneFilter.replace("missing-", "");
      return (zone.counts[type] || 0) < (zone.targets[type] || 0);
    }
    return true;
  });
}

function renderMapLegend(mapLegendElement, sessions) {
  if (!mapLegendElement) return;

  const ledger = getWeeklyZoneLedger(sessions);
  const filtered = filterWeeklyZones(ledger.zones);

  mapLegendElement.innerHTML = `
    <div class="zone-toolbar">
      <div>
        <div class="section-kicker">Matriz semanal</div>
        <h2>Zonas por meta</h2>
      </div>
      <div class="zone-toolbar__count">${filtered.length} de ${ledger.zones.length}</div>
    </div>

    <div class="zone-filters" role="tablist" aria-label="Filtros de matriz semanal">
      ${WEEKLY_FILTERS.map(filter => `
        <button
          type="button"
          class="zone-filter ${filter.id === activeZoneFilter ? "is-active" : ""}"
          data-zone-filter="${esc(filter.id)}"
          aria-pressed="${filter.id === activeZoneFilter ? "true" : "false"}"
        >
          ${esc(filter.label)}
        </button>
      `).join("")}
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
      renderWeeklyMatrix(zoneGrid, getSessions());
    });
  });
}

function renderZoneCard(zone) {
  const suggestedType = getRecommendedCleaningTypeForZone(zone);

  return `
    <article class="zone-card ${zone.completed ? "is-fresh" : "is-urgent"}" style="--zone-map-color:${esc(zone.mapColor)}">
      <div class="zone-card__marker"></div>
      <div class="zone-card__head">
        <div>
          <h3>${esc(zone.zoneName)}</h3>
          <p>${esc(zone.mapName)} - ${esc(zone.mapLabel)}</p>
        </div>
        <span class="zone-card__dot" style="background:${esc(zone.mapColor)}"></span>
      </div>

      <div class="weekly-chip-row">
        ${renderProgressChip("Profundo", zone.counts.profundo, zone.targets.profundo, "profundo")}
        ${renderProgressChip("Estandar", zone.counts.estandar, zone.targets.estandar, "estandar")}
        ${renderProgressChip("Rapido", zone.counts.rapido, zone.targets.rapido, "rapido")}
      </div>

      <div class="zone-card__status">
        <strong>${zone.completed ? "Completa esta semana" : "Pendiente esta semana"}</strong>
        <span>Siguiente: ${esc(zone.completed ? "Sin deuda" : zone.suggestedLabel || suggestedType)}</span>
      </div>
    </article>
  `;
}

function renderWeeklyMatrix(zoneGridElement, sessions) {
  if (!zoneGridElement) return;

  const ledger = getWeeklyZoneLedger(sessions);
  const zones = filterWeeklyZones(ledger.zones);

  if (!zones.length) {
    zoneGridElement.innerHTML = `<div class="empty-soft">No hay zonas para este filtro.</div>`;
    return;
  }

  zoneGridElement.innerHTML = zones.map(renderZoneCard).join("");
}

export function renderDashboardView() {
  const sessions = getSessions();
  const { load, body, stats, nextList, mapLegend, zoneGrid } = getDashboardElements();

  hide(load);
  show(body);

  renderQuickStats(stats, sessions);
  renderTopBlocks(nextList, sessions);
  renderMapLegend(mapLegend, sessions);
  renderWeeklyMatrix(zoneGrid, sessions);
}
