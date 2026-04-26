/* ─────────────────────────────────────────────
   CARDS UI — Musicala Tracker
   Generadores de HTML para componentes tipo card
───────────────────────────────────────────── */

import { statusColor, statusLabel } from "../utils/status.js";
import { formatDate } from "../utils/dates.js";
import { getMapOfZone } from "../config/maps.config.js";

/* ==============================
   NEXT ITEM (Siguiente en limpiar)
============================== */
export function renderNextItem(map, index, days) {
  const zonesText = map.targetZones?.length
    ? map.targetZones.join(", ")
    : `${map.zones.length} zona${map.zones.length > 1 ? "s" : ""}`;
  const xiaomi = map.xiaomi
    ? `${map.xiaomi.trayectoria || "estandar"} · ${map.xiaomi.succion || "estandar"} · ${map.xiaomi.veces || 1} vez`
    : "";

  return `
    <div class="next-item">
      <div class="next-rank">${index + 1}</div>

      <div class="next-bar" style="background:${map.color}"></div>

      <div class="next-info">
        <div class="next-name">
          ${map.name} — ${map.label}
        </div>

        <div class="next-sub">
          ${zonesText}
        </div>

        ${map.planNote ? `<div class="next-plan">${map.planTitle}: ${map.planNote}</div>` : ""}
        ${xiaomi ? `<div class="next-xiaomi">${xiaomi}</div>` : ""}
      </div>

      <div class="next-status" style="color:${statusColor(days)}">
        ${statusLabel(days)}
      </div>
    </div>
  `;
}

/* ==============================
   ZONE CARD
============================== */
export function renderZoneCard(zoneName, days) {
  const map = getMapOfZone(zoneName);

  return `
    <div class="zone-card">
      <div 
        class="zone-strip" 
        style="background:${map?.color || "#ccc"}">
      </div>

      <div 
        class="zone-dot" 
        style="background:${statusColor(days)}">
      </div>

      <div class="zone-name">${zoneName}</div>

      <div 
        class="zone-days" 
        style="color:${statusColor(days)}">
        ${statusLabel(days)}
      </div>

      <div 
        class="zone-map" 
        style="color:${map?.color || "#888"}">
        ${map?.name || "—"}
      </div>
    </div>
  `;
}

/* ==============================
   HISTORIAL ITEM
============================== */
export function renderSessionCard(session) {
  return `
    <div class="sess">

      <div 
        class="sess-strip" 
        style="background:${session.mapColor || "#ccc"}">
      </div>

      <div class="sess-head">

        <div>
          <div class="sess-map">
            ${session.mapName} — ${session.mapLabel}
          </div>

          <div class="sess-date">
            ${formatDate(session.completedAt)}
            ${session.durationMinutes ? ` · ${session.durationMinutes} min` : ""}
          </div>
        </div>

        <button class="btn-del" data-id="${session.id}">
          ✕
        </button>

      </div>

      <div class="sess-tags">
        ${session.zones.map(zone =>
          `<span class="tag">${zone}</span>`
        ).join("")}
      </div>

      ${session.notes
        ? `<div class="sess-notes">${session.notes}</div>`
        : ""}
    </div>
  `;
}

/* ==============================
   EMPTY STATE
============================== */
export function renderEmptyState(icon = "📭", text = "Sin datos") {
  return `
    <div class="empty">
      <div class="empty-icon">${icon}</div>
      <div class="empty-txt">${text}</div>
    </div>
  `;
}

/* ==============================
   LOADING STATE
============================== */
export function renderLoading(text = "Cargando") {
  return `
    <div class="loading">
      ${text}
      <span class="spin"></span>
    </div>
  `;
}

/* ==============================
   STAT BOX
============================== */
export function renderStatBox(value, label, color) {
  return `
    <div class="stat-box">
      <div class="stat-num" style="color:${color}">
        ${value}
      </div>
      <div class="stat-lbl">${label}</div>
    </div>
  `;
}

/* ==============================
   BAR ROW (estadísticas)
============================== */
export function renderBarRow(label, value, max, color) {
  const width = max > 0 ? (value / max) * 100 : 0;

  return `
    <div class="bar-row">

      <div class="bar-label" title="${label}">
        ${label}
      </div>

      <div class="bar-track">
        <div 
          class="bar-fill"
          style="width:${Math.max(4, width)}%; background:${color}">
        </div>
      </div>

      <div class="bar-val">${value}</div>

    </div>
  `;
}
