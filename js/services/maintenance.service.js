/* ─────────────────────────────────────────────
   MAINTENANCE SERVICE — Morchis Tracker
   Seguimiento de mantenimiento de aspiradora
   y estación de limpieza (localStorage)
───────────────────────────────────────────── */

const STORAGE_KEY = "morchis_mantenimiento";

/* ==============================
   ITEMS DE MANTENIMIENTO
============================== */
export const MAINTENANCE_GROUPS = [
  {
    id: "robot",
    label: "🤖 Aspiradora",
    items: [
      { id: "contenedor-polvo",  label: "Contenedor de polvo",       icon: "🗑️", intervalDays: 3,  note: "Vaciar después de 2-3 usos" },
      { id: "trapo-mopa",        label: "Trapo / mopa",              icon: "🧺", intervalDays: 3,  note: "Lavar y dejar secar bien" },
      { id: "cepillo-principal", label: "Cepillo principal",         icon: "🪥", intervalDays: 7,  note: "Retirar pelos enredados" },
      { id: "cepillos-lateral",  label: "Cepillos laterales",        icon: "🔄", intervalDays: 7,  note: "Limpiar de acumulación" },
      { id: "filtro-hepa",       label: "Filtro HEPA",               icon: "💨", intervalDays: 14, note: "Golpear suave y limpiar con aire" },
      { id: "sensores",          label: "Sensores y lentes",         icon: "👁️", intervalDays: 14, note: "Paño seco, sin líquidos" },
    ]
  },
  {
    id: "estacion",
    label: "🏠 Estación de limpieza",
    items: [
      { id: "agua-sucia",        label: "Vaciar tanque agua sucia",  icon: "💧", intervalDays: 3,  note: "Enjuagar con agua limpia" },
      { id: "agua-limpia",       label: "Rellenar agua limpia",      icon: "🚿", intervalDays: 3,  note: "Usar agua destilada si es posible" },
      { id: "base-cepillo",      label: "Cepillo auto-limpieza",     icon: "⚙️", intervalDays: 14, note: "Retirar pelos y residuos" },
      { id: "filtro-estacion",   label: "Filtro de la estación",     icon: "🔍", intervalDays: 30, note: "Limpiar o reemplazar" },
      { id: "bandeja-estacion",  label: "Bandeja / contenedor",      icon: "📦", intervalDays: 30, note: "Limpiar residuos acumulados" },
    ]
  }
];

/* ==============================
   TODOS LOS ITEMS FLAT
============================== */
export const ALL_MAINTENANCE_ITEMS = MAINTENANCE_GROUPS.flatMap(g => g.items);

/* ==============================
   LECTURA / ESCRITURA
============================== */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ==============================
   API PÚBLICA
============================== */

/** Obtiene el registro de mantenimiento de todos los items */
export function getMaintenanceRecords() {
  return loadData();
}

/** Obtiene el registro de un item específico */
export function getItemRecord(itemId) {
  const data = loadData();
  return data[itemId] || null;
}

/** Marca un item como realizado ahora */
export function markItemDone(itemId, notes = "") {
  const data = loadData();
  data[itemId] = {
    lastDone: new Date().toISOString(),
    notes: notes || ""
  };
  saveData(data);
  return data[itemId];
}

/** Elimina el registro de un item (resetear) */
export function clearItemRecord(itemId) {
  const data = loadData();
  delete data[itemId];
  saveData(data);
}

/* ==============================
   UTILIDADES
============================== */

/** Días transcurridos desde una fecha ISO */
export function daysSinceISO(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Estado de urgencia: 'ok' | 'soon' | 'urgent' | 'never' */
export function getItemStatus(itemId) {
  const item = ALL_MAINTENANCE_ITEMS.find(i => i.id === itemId);
  if (!item) return "never";

  const record = getItemRecord(itemId);
  if (!record) return "never";

  const days = daysSinceISO(record.lastDone);
  if (days === null) return "never";

  const ratio = days / item.intervalDays;
  if (ratio >= 1.2)  return "urgent";
  if (ratio >= 0.8)  return "soon";
  return "ok";
}
