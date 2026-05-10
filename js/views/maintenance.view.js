/* ─────────────────────────────────────────────
   MAINTENANCE VIEW - Morchis Tracker
   Vista de cuidado y mantenimiento de aspiradora y estación
───────────────────────────────────────────── */

import {
  MAINTENANCE_GROUPS,
  getMaintenanceRecords,
  markItemDone,
  daysSinceISO
} from "../services/maintenance.service.js";

/* =============================================================================
 * Estado local
 * ============================================================================= */

const maintenanceState = {
  activeFilter: "all",
  isSaving: false
};

/* =============================================================================
 * Helpers DOM
 * ============================================================================= */

function getMaintenanceElements() {
  return {
    load: document.getElementById("maint-load"),
    body: document.getElementById("maint-body")
  };
}

function show(el) {
  if (el) el.style.display = "block";
}

function hide(el) {
  if (el) el.style.display = "none";
}

/* =============================================================================
 * Helpers generales
 * ============================================================================= */

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

function formatDate(value) {
  if (!value) return "Sin registro";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Sin registro";

  try {
    return new Intl.DateTimeFormat("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(date);
  } catch {
    return "Sin registro";
  }
}

function addDaysToISO(isoValue, daysToAdd = 0) {
  if (!isoValue) return null;

  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + Number(daysToAdd || 0));

  return date;
}

function getDaysText(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return "Sin registro";
  }

  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";

  return `Hace ${days} días`;
}

function getNextText(item, record, status) {
  if (!record) return "Listo para registrar";

  const nextDate = addDaysToISO(record.lastDone, item.intervalDays);
  const days = daysSinceISO(record.lastDone);
  const remaining = Number(item.intervalDays || 0) - Number(days || 0);

  if (status === "urgent") {
    const overdue = Math.abs(remaining);
    if (overdue <= 0) return "Vence hoy";
    return `Vencido hace ${overdue} día${overdue === 1 ? "" : "s"}`;
  }

  if (remaining === 0) return "Vence hoy";
  if (remaining === 1) return "Próximo: mañana";
  if (remaining > 1) return `Próximo: en ${remaining} días`;

  return nextDate ? `Próximo: ${formatDate(nextDate)}` : "Próximo: pendiente";
}

function getItemCategory(item = {}, group = {}) {
  const text = normalizeText([
    item.category,
    item.type,
    item.label,
    item.note,
    group.id,
    group.label
  ].filter(Boolean).join(" "));

  if (
    text.includes("estacion") ||
    text.includes("base") ||
    text.includes("deposito") ||
    text.includes("tanque") ||
    text.includes("dock") ||
    text.includes("carga")
  ) {
    return "estacion";
  }

  return "aspiradora";
}

function getCategoryLabel(category) {
  const labels = {
    aspiradora: "Aspiradora",
    estacion: "Estación"
  };

  return labels[category] || "General";
}

function getStatusMeta(item, record) {
  if (!record) {
    return {
      status: "never",
      label: "Sin registro",
      shortLabel: "Sin registro",
      description: "Este elemento todavía no tiene registro.",
      days: null,
      ratio: null,
      priority: 2
    };
  }

  const days = daysSinceISO(record.lastDone);
  const intervalDays = Number(item.intervalDays || 1);
  const ratio = intervalDays > 0 ? days / intervalDays : 0;

  if (ratio >= 1.2) {
    return {
      status: "urgent",
      label: "Urgente",
      shortLabel: "Urgente",
      description: "Ya pasó el tiempo recomendado de mantenimiento.",
      days,
      ratio,
      priority: 4
    };
  }

  if (ratio >= 0.8) {
    return {
      status: "soon",
      label: "Próximo",
      shortLabel: "Próximo",
      description: "Está cerca de necesitar mantenimiento.",
      days,
      ratio,
      priority: 3
    };
  }

  return {
    status: "ok",
    label: "Al día",
    shortLabel: "Al día",
    description: "El mantenimiento está dentro del tiempo recomendado.",
    days,
    ratio,
    priority: 1
  };
}

function getAllMaintenanceItems(records = {}) {
  return MAINTENANCE_GROUPS.flatMap(group => {
    return group.items.map(item => {
      const record = records[item.id] || null;
      const statusMeta = getStatusMeta(item, record);
      const category = getItemCategory(item, group);

      return {
        ...item,
        groupId: group.id || normalizeText(group.label),
        groupLabel: group.label || "General",
        record,
        category,
        categoryLabel: getCategoryLabel(category),
        status: statusMeta.status,
        statusLabel: statusMeta.label,
        statusShortLabel: statusMeta.shortLabel,
        statusDescription: statusMeta.description,
        statusPriority: statusMeta.priority,
        days: statusMeta.days,
        ratio: statusMeta.ratio,
        lastDateLabel: record ? formatDate(record.lastDone) : "Sin registro",
        nextLabel: getNextText(item, record, statusMeta.status)
      };
    });
  });
}

function sortMaintenanceItems(items = []) {
  return [...items].sort((a, b) => {
    if (a.statusPriority !== b.statusPriority) {
      return b.statusPriority - a.statusPriority;
    }

    const aDays = a.days ?? 9999;
    const bDays = b.days ?? 9999;

    return bDays - aDays;
  });
}

/* =============================================================================
 * Filtros
 * ============================================================================= */

const MAINTENANCE_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "urgent", label: "Urgentes" },
  { id: "soon", label: "Próximos" },
  { id: "ok", label: "Al día" },
  { id: "never", label: "Sin registro" },
  { id: "aspiradora", label: "Aspiradora" },
  { id: "estacion", label: "Estación" }
];

function filterMaintenanceItems(items = [], filterId = "all") {
  switch (filterId) {
    case "urgent":
      return items.filter(item => item.status === "urgent");

    case "soon":
      return items.filter(item => item.status === "soon");

    case "ok":
      return items.filter(item => item.status === "ok");

    case "never":
      return items.filter(item => item.status === "never");

    case "aspiradora":
      return items.filter(item => item.category === "aspiradora");

    case "estacion":
      return items.filter(item => item.category === "estacion");

    case "all":
    default:
      return items;
  }
}

/* =============================================================================
 * Resumen
 * ============================================================================= */

function getMaintenanceSummary(items = []) {
  const summary = {
    total: items.length,
    ok: 0,
    soon: 0,
    urgent: 0,
    never: 0,
    aspiradora: 0,
    estacion: 0
  };

  items.forEach(item => {
    if (summary[item.status] !== undefined) {
      summary[item.status] += 1;
    }

    if (summary[item.category] !== undefined) {
      summary[item.category] += 1;
    }
  });

  return summary;
}

function getHeroMessage(summary) {
  if (summary.urgent > 0) {
    return {
      tone: "urgent",
      title: "Hay elementos que necesitan atención hoy",
      text:
        "Conviene resolver primero los urgentes para que Morchis no termine trabajando como empleado explotado de startup."
    };
  }

  if (summary.soon > 0) {
    return {
      tone: "soon",
      title: "Hay mantenimiento próximo",
      text:
        "Nada crítico todavía, pero hay elementos acercándose a su fecha de revisión."
    };
  }

  if (summary.never > 0) {
    return {
      tone: "never",
      title: "Faltan primeros registros",
      text:
        "Todo puede estar bien, pero algunos elementos todavía no tienen punto de partida."
    };
  }

  return {
    tone: "ok",
    title: "Morchis está al día",
    text:
      "Filtros, mopa, aspiradora y estación están bajo control. Un pequeño triunfo contra el polvo."
  };
}

function renderMaintenanceHero(summary) {
  const message = getHeroMessage(summary);

  return `
    <section class="maintenance-hero maintenance-hero--${esc(message.tone)}">
      <div class="maintenance-hero__content">
        <div class="section-kicker">Cuidado</div>

        <h2 class="maintenance-hero-title">
          Cuidado de Morchis
        </h2>

        <p class="maintenance-hero-copy">
          Mantenimiento de aspiradora, mopa, filtros y estación.
        </p>

        <div class="maintenance-hero-message">
          <strong>${esc(message.title)}</strong>
          <span>${esc(message.text)}</span>
        </div>
      </div>

      <div class="maintenance-hero__status">
        <span>Total</span>
        <strong>${summary.total}</strong>
        <small>elementos</small>
      </div>
    </section>
  `;
}

function renderMaintenanceSummary(summary) {
  const stats = [
    {
      id: "urgent",
      label: "Urgentes",
      value: summary.urgent,
      detail: "Atender hoy"
    },
    {
      id: "soon",
      label: "Próximos",
      value: summary.soon,
      detail: "Vencen pronto"
    },
    {
      id: "never",
      label: "Sin registro",
      value: summary.never,
      detail: "Falta primera marca"
    },
    {
      id: "ok",
      label: "Al día",
      value: summary.ok,
      detail: "Sin pendientes"
    }
  ];

  return `
    <section class="maint-summary-row" aria-label="Resumen de mantenimiento">
      ${stats.map(stat => `
        <article class="maint-stat maint-stat--${esc(stat.id)}">
          <span class="maint-stat-num">${esc(stat.value)}</span>
          <span class="maint-stat-lbl">${esc(stat.label)}</span>
          <small>${esc(stat.detail)}</small>
        </article>
      `).join("")}
    </section>
  `;
}

/* =============================================================================
 * Badges y tarjetas
 * ============================================================================= */

function statusChip(item) {
  const classes = {
    ok: "maint-badge--ok",
    soon: "maint-badge--soon",
    urgent: "maint-badge--urgent",
    never: "maint-badge--never"
  };

  return `
    <span class="maint-badge ${classes[item.status] || "maint-badge--never"}">
      ${esc(item.statusShortLabel)}
    </span>
  `;
}

function renderPriorityItem(item) {
  return `
    <article class="maint-priority-card maint-priority-card--${esc(item.status)}">
      <div class="maint-item-icon">${esc(item.icon || "🔧")}</div>

      <div class="maint-item-info">
        <div class="maint-item-name">${esc(item.label)}</div>
        <div class="maint-item-note">${esc(item.note || item.statusDescription)}</div>

        <div class="maint-item-meta">
          <span>${esc(item.lastDateLabel)}</span>
          <span>Cada ${esc(item.intervalDays)} días</span>
          <span>${esc(item.nextLabel)}</span>
        </div>
      </div>

      <div class="maint-item-right">
        ${statusChip(item)}
        <button
          type="button"
          class="maint-btn-done"
          data-item-id="${esc(item.id)}"
          title="Marcar como hecho hoy"
        >
          ✓ Listo
        </button>
      </div>
    </article>
  `;
}

function renderPriorityBlock(items = []) {
  const priorityItems = sortMaintenanceItems(
    items.filter(item => item.status === "urgent" || item.status === "soon")
  ).slice(0, 3);

  if (!priorityItems.length) {
    const neverCount = items.filter(item => item.status === "never").length;

    return `
      <section class="maint-priority">
        <div class="maint-group-header">
          <div>
            <div class="section-kicker">Atender primero</div>
            <h3>Todo está bajo control</h3>
          </div>
        </div>

        <div class="empty-soft">
          ${
            neverCount > 0
              ? `No hay urgentes. Revisa los ${neverCount} elemento${neverCount === 1 ? "" : "s"} sin registro para dejar la base completa.`
              : "No hay urgentes ni próximos. Morchis puede seguir fingiendo que no carga el peso de la limpieza institucional."
          }
        </div>
      </section>
    `;
  }

  return `
    <section class="maint-priority">
      <div class="maint-group-header">
        <div>
          <div class="section-kicker">Atender primero</div>
          <h3>Prioridad de mantenimiento</h3>
        </div>

        <span>${priorityItems.length} elemento${priorityItems.length === 1 ? "" : "s"}</span>
      </div>

      <div class="maint-priority-list">
        ${priorityItems.map(renderPriorityItem).join("")}
      </div>
    </section>
  `;
}

function renderMaintenanceItem(item) {
  return `
    <article
      class="maint-item maint-item--${esc(item.status)}"
      data-item-id="${esc(item.id)}"
      data-status="${esc(item.status)}"
      data-category="${esc(item.category)}"
    >
      <div class="maint-item-icon">${esc(item.icon || "🔧")}</div>

      <div class="maint-item-info">
        <div class="maint-item-topline">
          <span>${esc(item.groupLabel)}</span>
          <span>${esc(item.categoryLabel)}</span>
        </div>

        <div class="maint-item-name">${esc(item.label)}</div>

        <div class="maint-item-note">
          ${esc(item.note || item.statusDescription)}
        </div>

        <div class="maint-item-dates">
          <span class="maint-item-date">
            Último: ${esc(item.lastDateLabel)}
          </span>

          <span class="maint-item-next">
            ${esc(item.nextLabel)}
          </span>

          <span>
            Cada ${esc(item.intervalDays)} días
          </span>
        </div>
      </div>

      <div class="maint-item-right">
        ${statusChip(item)}

        <button
          type="button"
          class="maint-btn-done"
          data-item-id="${esc(item.id)}"
          title="Marcar como hecho hoy"
        >
          ✓ Listo
        </button>
      </div>
    </article>
  `;
}

/* =============================================================================
 * Grupos y filtros
 * ============================================================================= */

function renderMaintenanceFilters(items = []) {
  const filteredItems = filterMaintenanceItems(items, maintenanceState.activeFilter);

  return `
    <section class="maint-filter-panel">
      <div class="maint-group-header">
        <div>
          <div class="section-kicker">Vista</div>
          <h3>Filtrar cuidado</h3>
        </div>

        <span>${filteredItems.length} de ${items.length}</span>
      </div>

      <div class="maint-filters" role="tablist" aria-label="Filtros de cuidado">
        ${MAINTENANCE_FILTERS.map(filter => {
          const count = filterMaintenanceItems(items, filter.id).length;
          const active = maintenanceState.activeFilter === filter.id ? "is-active" : "";

          return `
            <button
              type="button"
              class="maint-filter-btn ${active}"
              data-maint-filter="${esc(filter.id)}"
              aria-pressed="${active ? "true" : "false"}"
            >
              ${esc(filter.label)}
              <span>${count}</span>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function groupItemsForRender(items = []) {
  return items.reduce((groups, item) => {
    const key = item.groupId || "general";

    if (!groups[key]) {
      groups[key] = {
        id: key,
        label: item.groupLabel || "General",
        items: []
      };
    }

    groups[key].items.push(item);

    return groups;
  }, {});
}

function renderMaintenanceGroups(items = []) {
  const filteredItems = filterMaintenanceItems(items, maintenanceState.activeFilter);
  const sortedItems = sortMaintenanceItems(filteredItems);

  if (!sortedItems.length) {
    return `
      <div class="empty-soft">
        No hay elementos para este filtro. Lo cual, por una vez, significa que el filtro sí está haciendo su trabajo.
      </div>
    `;
  }

  const groups = groupItemsForRender(sortedItems);

  return Object.values(groups).map(group => {
    return `
      <section class="maint-group card">
        <div class="maint-group-header">
          <div>
            <div class="card-label">${esc(group.label)}</div>
            <h3>${esc(group.label)}</h3>
          </div>

          <span>
            ${group.items.length}
            ${group.items.length === 1 ? "elemento" : "elementos"}
          </span>
        </div>

        <div class="maint-list">
          ${group.items.map(renderMaintenanceItem).join("")}
        </div>
      </section>
    `;
  }).join("");
}

/* =============================================================================
 * Render principal
 * ============================================================================= */

export async function renderMaintenanceView() {
  const { load, body } = getMaintenanceElements();

  hide(load);
  show(body);

  if (!body) return;

  body.innerHTML = `
    <div class="loading">
      Cargando cuidado de Morchis
      <span class="spin"></span>
    </div>
  `;

  try {
    const records = await getMaintenanceRecords();
    const items = getAllMaintenanceItems(records);
    const summary = getMaintenanceSummary(items);

    body.innerHTML = `
      <div class="page-stack maintenance-page">
        ${renderMaintenanceHero(summary)}
        ${renderMaintenanceSummary(summary)}
        ${renderPriorityBlock(items)}
        ${renderMaintenanceFilters(items)}
        ${renderMaintenanceGroups(items)}
      </div>
    `;

    setupMaintenanceEvents(body);
  } catch (error) {
    console.error("Error cargando mantenimiento:", error);

    body.innerHTML = `
      <div class="empty">
        <div class="empty-icon">⚠️</div>
        <div class="empty-txt">No se pudo cargar el cuidado de Morchis</div>
        <div class="empty-detail">
          Revisa la conexión o el servicio de mantenimiento. Porque aparentemente hasta limpiar filtros necesita infraestructura digital.
        </div>
      </div>
    `;
  }
}

/* =============================================================================
 * Eventos
 * ============================================================================= */

function setupMaintenanceEvents(container) {
  if (!container) return;

  container.querySelectorAll("[data-maint-filter]").forEach(button => {
    button.addEventListener("click", () => {
      maintenanceState.activeFilter = button.dataset.maintFilter || "all";
      renderMaintenanceView();
    });
  });

  container.querySelectorAll(".maint-btn-done").forEach(btn => {
    btn.addEventListener("click", async () => {
      const itemId = btn.dataset.itemId;

      if (!itemId || maintenanceState.isSaving) return;

      maintenanceState.isSaving = true;
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.textContent = "Guardando...";

      try {
        await markItemDone(itemId);
        await renderMaintenanceView();
      } catch (error) {
        console.error("Error marcando mantenimiento:", error);

        btn.disabled = false;
        btn.classList.remove("is-loading");
        btn.textContent = "✓ Listo";

        window.alert("No se pudo guardar el mantenimiento. Revisa la conexión.");
      } finally {
        maintenanceState.isSaving = false;
      }
    });
  });
}