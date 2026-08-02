/* ─────────────────────────────────────────────
   CARDS UI — Musicala Tracker
   Generadores de HTML para componentes tipo card
───────────────────────────────────────────── */

import { statusColor, statusLabel } from "../utils/status.js";
import { formatDate } from "../utils/dates.js";
import { getMapOfZone } from "../config/maps.config.js";
import {
  getSessionCleaningType,
  getSessionCycleMetaCached
} from "../utils/cleaning-cycle.js";
import {
  getCleaningTypeLabel,
  getXiaomiPreset
} from "../config/cleaning.config.js";

/* =============================================================================
 * Helpers
 * ============================================================================= */

function esc(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeColor(value, fallback = "#ccc") {
  const color = String(value || "").trim();

  if (!color) return fallback;

  // Permite hex, rgb, hsl y variables CSS.
  if (
    color.startsWith("#") ||
    color.startsWith("rgb") ||
    color.startsWith("hsl") ||
    color.startsWith("var(")
  ) {
    return color;
  }

  return fallback;
}

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function daysText(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return "Sin registro";
  }

  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";

  return `Hace ${days}d`;
}

function getStatusClass(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return "is-never";
  }

  if (days <= 1) return "is-fresh";
  if (days <= 3) return "is-soon";

  return "is-urgent";
}

function getReasonClass(reasonId = "") {
  const value = normalizeText(reasonId);

  if (value === "prioritydaily") return "is-priority";
  if (value === "dailyplan") return "is-plan";
  if (value === "cyclepending") return "is-cycle";
  if (value === "oldestzone") return "is-oldest";
  if (value === "urgent") return "is-urgent";

  return "is-neutral";
}

function getSourceLabel(source = "") {
  const value = normalizeText(source);

  const labels = {
    recomendada: "Sugerida por la app",
    "cuenta-para-etapa": "Cuenta para etapa",
    "realizada-hoy": "Realizada hoy",
    "manual-fuera-de-etapa": "Manual fuera de etapa",
    manual: "Registro manual"
  };

  return labels[value] || source || "Registro";
}

function getCycleStatusLabel(session = {}, inferredMeta = {}) {
  if (session.cycleStatusLabel) return session.cycleStatusLabel;
  if (inferredMeta.cycleStatusLabel) return inferredMeta.cycleStatusLabel;

  const countsForCycle = session.countsForCycle ?? inferredMeta.countsForCycle;

  if (countsForCycle) return "Cuenta para etapa";

  const stage = session.cycleStage || inferredMeta.cycleStage;

  if (stage === "profundo") {
    return "No completa etapa profunda";
  }

  return "Realizada, intensidad menor a la sugerida";
}

function renderTags(tags = [], className = "tag") {
  return tags
    .filter(tag => tag !== null && tag !== undefined && String(tag).trim() !== "")
    .map(tag => `<span class="${className}">${esc(tag)}</span>`)
    .join("");
}

function renderXiaomiText(xiaomi = {}) {
  const preset = xiaomi || {};

  const items = [
    preset.modo || "sin modo",
    preset.succion || "sin succión",
    preset.agua || "sin agua",
    preset.trayectoria || "sin trayectoria",
    `${preset.veces || 1} vez${Number(preset.veces || 1) === 1 ? "" : "ces"}`
  ];

  return items.join(" / ");
}

function renderXiaomiPills(xiaomi = {}) {
  const items = [
    ["Modo", xiaomi.modo],
    ["Succión", xiaomi.succion],
    ["Agua", xiaomi.agua || "Sin agua"],
    ["Ruta", xiaomi.trayectoria],
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

/* =============================================================================
 * NEXT ITEM — Siguiente en limpiar
 * ============================================================================= */

export function renderNextItem(map, index = 0, days = null) {
  if (!map) {
    return renderEmptyState("🧹", "No hay sugerencias por ahora.");
  }

  const color = safeColor(map.color);
  const zones = map.targetZones?.length
    ? map.targetZones
    : map.zones?.length
      ? map.zones.slice(0, 3)
      : [];

  const zonesText = zones.length
    ? zones.join(", ")
    : `${map.zones?.length || 0} zona${map.zones?.length === 1 ? "" : "s"}`;

  const cleaningType = map.cleaningType || map.cleaningMode || "estandar";
  const cleaningTypeLabel =
    map.cleaningTypeLabel ||
    getCleaningTypeLabel(cleaningType) ||
    cleaningType;

  const reasonClass = getReasonClass(map.reasonId);
  const xiaomi = map.xiaomi || getXiaomiPreset(cleaningType);

  return `
    <article class="next-item ${reasonClass}">
      <div class="next-rank">${Number(index) + 1}</div>

      <div class="next-bar" style="background:${color}"></div>

      <div class="next-info">
        <div class="next-name">
          ${esc(map.name || `Mapa ${map.id || ""}`)}
          ${map.label ? `— ${esc(map.label)}` : ""}
        </div>

        <div class="next-sub">
          ${esc(zonesText)}
        </div>

        <div class="next-tags">
          ${renderTags([
            map.reasonLabel || "Sugerencia",
            cleaningTypeLabel,
            map.countsForCycle === false ? "Registro manual" : "Cuenta para etapa"
          ])}
        </div>

        ${map.planNote
          ? `
            <div class="next-plan">
              ${map.planTitle ? `<strong>${esc(map.planTitle)}:</strong> ` : ""}
              ${esc(map.planNote)}
            </div>
          `
          : ""}

        ${renderXiaomiPills(xiaomi)}
      </div>

      <div class="next-status" style="color:${statusColor(days)}">
        <strong>${esc(statusLabel(days))}</strong>
        <span>${esc(daysText(days))}</span>
      </div>
    </article>
  `;
}

/* =============================================================================
 * ZONE CARD
 * ============================================================================= */

export function renderZoneCard(zoneInput, daysInput = null) {
  const isObject = typeof zoneInput === "object" && zoneInput !== null;

  const zoneName = isObject
    ? zoneInput.name
    : zoneInput;

  const map = isObject
    ? {
        id: zoneInput.mapId,
        name: zoneInput.mapName,
        label: zoneInput.mapLabel,
        color: zoneInput.mapColor
      }
    : getMapOfZone(zoneName);

  const days = isObject
    ? zoneInput.days
    : daysInput;

  const color = safeColor(map?.color);
  const statusClass = isObject
    ? `is-${zoneInput.freshnessStatus || "neutral"}`
    : getStatusClass(days);

  const cleanedToday = Boolean(zoneInput?.cleanedToday);
  const priorityDaily = Boolean(zoneInput?.priorityDaily);
  const pendingInCycle = Boolean(zoneInput?.pendingInCycle);
  const preferredToday = Boolean(zoneInput?.preferredToday);

  const reasonLabel = cleanedToday
    ? "Hecha hoy"
    : priorityDaily
      ? "Prioridad diaria"
      : preferredToday
        ? "Plan del día"
        : pendingInCycle
          ? "Pendiente del ciclo"
          : days === null || days === undefined
            ? "Sin registro"
            : "Seguimiento";

  return `
    <article
      class="zone-card ${statusClass}"
      data-map-id="${esc(map?.id ?? "")}"
      data-zone="${esc(zoneName)}"
      data-cleaned-today="${cleanedToday ? "true" : "false"}"
      data-priority="${priorityDaily ? "true" : "false"}"
      data-pending-cycle="${pendingInCycle ? "true" : "false"}"
      style="--zone-map-color:${color}"
    >
      <div class="zone-strip" style="background:${color}"></div>

      <div class="zone-card__head">
        <div>
          <div class="zone-name">${esc(zoneName)}</div>
          <div class="zone-map" style="color:${color}">
            ${esc(map?.name || "Sin mapa")}
            ${map?.label ? ` · ${esc(map.label)}` : ""}
          </div>
        </div>

        <div
          class="zone-dot"
          style="background:${statusColor(days)}"
          title="${esc(statusLabel(days))}"
        ></div>
      </div>

      <div class="zone-card__status">
        <div class="zone-days" style="color:${statusColor(days)}">
          ${esc(statusLabel(days))}
        </div>

        <div class="zone-card__ago">
          ${esc(daysText(days))}
        </div>
      </div>

      <div class="zone-card__tags">
        ${renderTags([
          reasonLabel,
          cleanedToday ? "Realizada hoy" : "",
          priorityDaily ? "Visible" : "",
          pendingInCycle ? "Ciclo" : ""
        ])}
      </div>
    </article>
  `;
}

/* =============================================================================
 * HISTORIAL ITEM
 * ============================================================================= */

export function renderSessionCard(session, sessionsBefore = []) {
  /* Version cacheada: si la sesion ya trae sus metadatos de ciclo guardados
     no se recorre el historial anterior. `sessionsBefore` puede ser una
     funcion perezosa, que solo se evalua si de verdad hay que inferir. */
  const inferredMeta = getSessionCycleMetaCached(session, sessionsBefore);

  const cleaningType =
    session.cleaningType ||
    inferredMeta.cleaningType ||
    getSessionCleaningType(session);

  const cleaningTypeLabel =
    session.cleaningTypeLabel ||
    inferredMeta.cleaningTypeLabel ||
    getCleaningTypeLabel(cleaningType);

  const countsForCycle =
    session.countsForCycle ??
    session.countsForStage ??
    inferredMeta.countsForCycle ??
    false;

  const source =
    session.recommendationSource ||
    inferredMeta.recommendationSource ||
    "manual";

  const cycleStatusLabel = getCycleStatusLabel(session, inferredMeta);
  const xiaomi = session.xiaomi || getXiaomiPreset(cleaningType);
  const xiaomiText = renderXiaomiText(xiaomi);

  const sessionDate = session.completedAt || session.startedAt;
  const durationText = session.durationMinutes
    ? ` · ${session.durationMinutes} min`
    : "";

  const mapColor = safeColor(session.mapColor);
  const mapName = session.mapName || `Mapa ${session.mapId || ""}`;
  const mapLabel = session.mapLabel || "";

  const statusClass = countsForCycle ? "is-counts" : "is-manual";

  return `
    <article class="sess ${statusClass}">
      <div class="sess-strip" style="background:${mapColor}"></div>

      <div class="sess-head">
        <div>
          <div class="sess-map">
            ${esc(mapName)}
            ${mapLabel ? `— ${esc(mapLabel)}` : ""}
          </div>

          <div class="sess-date">
            ${esc(formatDate(sessionDate))}
            ${esc(durationText)}
          </div>
        </div>

        <button
          type="button"
          class="btn-del"
          data-id="${esc(session.id)}"
          title="Eliminar registro"
          aria-label="Eliminar registro"
        >
          ✕
        </button>
      </div>

      <div class="sess-tags">
        ${renderTags([
          cleaningTypeLabel,
          cycleStatusLabel,
          getSourceLabel(source),
          inferredMeta.cycleStageLabel
            ? `Etapa ${inferredMeta.cycleStageLabel}`
            : session.cycleStage
              ? `Etapa ${session.cycleStage}`
              : ""
        ])}

        ${(session.zones || [])
          .map(zone => `<span class="tag tag-zone">${esc(zone)}</span>`)
          .join("")}
      </div>

      <div class="sess-meta">
        <strong>Xiaomi:</strong> ${esc(xiaomiText)}
      </div>

      ${session.notes
        ? `
          <div class="sess-notes">
            ${esc(session.notes)}
          </div>
        `
        : ""}
    </article>
  `;
}

/* =============================================================================
 * EMPTY STATE
 * ============================================================================= */

export function renderEmptyState(icon = "📭", text = "Sin datos", detail = "") {
  return `
    <div class="empty">
      <div class="empty-icon">${esc(icon)}</div>
      <div class="empty-txt">${esc(text)}</div>
      ${detail ? `<div class="empty-detail">${esc(detail)}</div>` : ""}
    </div>
  `;
}

/* =============================================================================
 * LOADING STATE
 * ============================================================================= */

export function renderLoading(text = "Cargando") {
  return `
    <div class="loading">
      <span>${esc(text)}</span>
      <span class="spin"></span>
    </div>
  `;
}

/* =============================================================================
 * STAT BOX
 * ============================================================================= */

export function renderStatBox(value, label, color = "var(--primary)", detail = "") {
  const finalColor = safeColor(color, "var(--primary)");

  return `
    <div class="stat-box">
      <div class="stat-num" style="color:${finalColor}">
        ${esc(value)}
      </div>

      <div class="stat-lbl">
        ${esc(label)}
      </div>

      ${detail
        ? `
          <div class="stat-detail">
            ${esc(detail)}
          </div>
        `
        : ""}
    </div>
  `;
}

/* =============================================================================
 * BAR ROW — estadísticas
 * ============================================================================= */

export function renderBarRow(label, value, max, color = "var(--primary)") {
  const numericValue = Number(value || 0);
  const numericMax = Number(max || 0);
  const rawWidth = numericMax > 0 ? (numericValue / numericMax) * 100 : 0;
  const width = Math.max(0, Math.min(100, rawWidth));
  const visibleWidth = numericValue > 0 ? Math.max(4, width) : 0;
  const finalColor = safeColor(color, "var(--primary)");

  return `
    <div class="bar-row">
      <div class="bar-label" title="${esc(label)}">
        ${esc(label)}
      </div>

      <div class="bar-track">
        <div
          class="bar-fill"
          style="width:${visibleWidth}%; background:${finalColor}">
        </div>
      </div>

      <div class="bar-val">
        ${esc(numericValue)}
      </div>
    </div>
  `;
}