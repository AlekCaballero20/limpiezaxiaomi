/* ─────────────────────────────────────────────
   MAINTENANCE VIEW — Morchis Tracker
   Vista de mantenimiento de aspiradora y estación
───────────────────────────────────────────── */

import {
  MAINTENANCE_GROUPS,
  getMaintenanceRecords,
  markItemDone,
  clearItemRecord,
  daysSinceISO,
  getItemStatus
} from "../services/maintenance.service.js";

/* ==============================
   HELPERS DOM
============================== */
function getMaintenanceElements() {
  return {
    load: document.getElementById("maint-load"),
    body: document.getElementById("maint-body")
  };
}

function show(el) { if (el) el.style.display = "block"; }
function hide(el) { if (el) el.style.display = "none"; }

/* ==============================
   CHIPS DE ESTADO
============================== */
function statusChip(status, days, intervalDays) {
  if (status === "never") {
    return `<span class="maint-badge maint-badge--never">Sin registro</span>`;
  }
  const label = days === 0 ? "Hoy" : `Hace ${days}d`;
  const classes = {
    ok:     "maint-badge--ok",
    soon:   "maint-badge--soon",
    urgent: "maint-badge--urgent"
  }[status] || "maint-badge--never";
  return `<span class="maint-badge ${classes}">${label} / cada ${intervalDays}d</span>`;
}

/* ==============================
   RENDER ITEM
============================== */
function renderMaintenanceItem(item, record) {
  const days       = record ? daysSinceISO(record.lastDone) : null;
  const status     = record ? (() => {
    const ratio = days / item.intervalDays;
    if (ratio >= 1.2) return "urgent";
    if (ratio >= 0.8) return "soon";
    return "ok";
  })() : "never";

  const lastDateStr = record
    ? new Date(record.lastDone).toLocaleDateString("es-CO", {
        day: "2-digit", month: "short", year: "numeric"
      })
    : null;

  return `
    <div class="maint-item maint-item--${status}" data-item-id="${item.id}">
      <div class="maint-item-icon">${item.icon}</div>
      <div class="maint-item-info">
        <div class="maint-item-name">${item.label}</div>
        <div class="maint-item-note">${item.note}</div>
        ${lastDateStr ? `<div class="maint-item-date">Último: ${lastDateStr}</div>` : ""}
      </div>
      <div class="maint-item-right">
        ${statusChip(status, days, item.intervalDays)}
        <button class="maint-btn-done" data-item-id="${item.id}" title="Marcar como hecho hoy">
          ✓ Listo
        </button>
      </div>
    </div>
  `;
}

/* ==============================
   RENDER GRUPO
============================== */
function renderMaintenanceGroup(group, records) {
  const itemsHtml = group.items
    .map(item => renderMaintenanceItem(item, records[item.id] || null))
    .join("");

  return `
    <div class="maint-group card">
      <div class="card-label">${group.label}</div>
      <div class="maint-list">
        ${itemsHtml}
      </div>
    </div>
  `;
}

/* ==============================
   RENDER RESUMEN
============================== */
function renderMaintenanceSummary(records) {
  let ok = 0, soon = 0, urgent = 0, never = 0;

  MAINTENANCE_GROUPS.forEach(group => {
    group.items.forEach(item => {
      const rec = records[item.id];
      if (!rec) { never++; return; }
      const days = daysSinceISO(rec.lastDone);
      const ratio = days / item.intervalDays;
      if (ratio >= 1.2) urgent++;
      else if (ratio >= 0.8) soon++;
      else ok++;
    });
  });

  return `
    <div class="maint-summary-row">
      <div class="maint-stat maint-stat--ok">
        <span class="maint-stat-num">${ok}</span>
        <span class="maint-stat-lbl">Al día</span>
      </div>
      <div class="maint-stat maint-stat--soon">
        <span class="maint-stat-num">${soon}</span>
        <span class="maint-stat-lbl">Próximos</span>
      </div>
      <div class="maint-stat maint-stat--urgent">
        <span class="maint-stat-num">${urgent}</span>
        <span class="maint-stat-lbl">Urgentes</span>
      </div>
      <div class="maint-stat maint-stat--never">
        <span class="maint-stat-num">${never}</span>
        <span class="maint-stat-lbl">Sin registro</span>
      </div>
    </div>
  `;
}

/* ==============================
   RENDER PRINCIPAL
============================== */
export function renderMaintenanceView() {
  const { load, body } = getMaintenanceElements();
  hide(load);
  show(body);

  if (!body) return;

  const records = getMaintenanceRecords();

  const summaryHtml = renderMaintenanceSummary(records);
  const groupsHtml = MAINTENANCE_GROUPS
    .map(group => renderMaintenanceGroup(group, records))
    .join("");

  body.innerHTML = `
    <div class="page-stack">
      <div class="card">
        <div class="card-label">🔧 Estado general</div>
        ${summaryHtml}
      </div>
      ${groupsHtml}
    </div>
  `;

  setupMaintenanceEvents(body);
}

/* ==============================
   EVENTOS
============================== */
function setupMaintenanceEvents(container) {
  container.querySelectorAll(".maint-btn-done").forEach(btn => {
    btn.addEventListener("click", () => {
      const itemId = btn.dataset.itemId;
      if (!itemId) return;

      markItemDone(itemId);
      renderMaintenanceView();
    });
  });
}
