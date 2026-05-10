import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../config/firebase.config.js";

const APP_STATE_COLLECTION = "app_state";
const MAINTENANCE_DOC_ID = "maintenance_records";

/* =============================================================================
 * Configuración de mantenimiento
 * ============================================================================= */

export const MAINTENANCE_GROUPS = [
  {
    id: "robot",
    label: "Aspiradora",
    description: "Partes principales del robot: polvo, mopa, cepillos, filtro y sensores.",
    items: [
      {
        id: "contenedor-polvo",
        label: "Contenedor de polvo",
        icon: "🗑️",
        category: "aspiradora",
        intervalDays: 3,
        note: "Vaciar después de 2-3 usos.",
        instruction:
          "Retira el contenedor, vacía el polvo y limpia los bordes antes de volver a instalarlo.",
        priority: 4
      },
      {
        id: "trapo-mopa",
        label: "Trapo / mopa",
        icon: "🧺",
        category: "aspiradora",
        intervalDays: 3,
        note: "Lavar y dejar secar bien.",
        instruction:
          "Lava la mopa con agua limpia, retira residuos y déjala secar completamente para evitar mal olor.",
        priority: 4
      },
      {
        id: "cepillo-principal",
        label: "Cepillo principal",
        icon: "🪥",
        category: "aspiradora",
        intervalDays: 7,
        note: "Retirar pelos enredados.",
        instruction:
          "Saca el cepillo principal y retira pelos, hilos o residuos acumulados en los extremos.",
        priority: 3
      },
      {
        id: "cepillos-lateral",
        label: "Cepillos laterales",
        icon: "🔄",
        category: "aspiradora",
        intervalDays: 7,
        note: "Limpiar acumulación.",
        instruction:
          "Revisa los cepillos laterales, retira pelos y verifica que giren sin atascarse.",
        priority: 3
      },
      {
        id: "filtro-hepa",
        label: "Filtro HEPA",
        icon: "💨",
        category: "aspiradora",
        intervalDays: 14,
        note: "Golpear suave y limpiar con aire.",
        instruction:
          "Retira el filtro, golpéalo suavemente para sacar polvo y evita mojarlo si el fabricante no lo permite.",
        priority: 2
      },
      {
        id: "sensores",
        label: "Sensores y lentes",
        icon: "👁️",
        category: "aspiradora",
        intervalDays: 14,
        note: "Paño seco, sin líquidos.",
        instruction:
          "Limpia sensores y lentes con un paño seco y suave. No uses líquidos directamente.",
        priority: 2
      }
    ]
  },
  {
    id: "estacion",
    label: "Estación de limpieza",
    description: "Base de carga, tanques, bandeja y sistema de autolimpieza.",
    items: [
      {
        id: "agua-sucia",
        label: "Vaciar tanque agua sucia",
        icon: "💧",
        category: "estacion",
        intervalDays: 3,
        note: "Enjuagar con agua limpia.",
        instruction:
          "Vacía el tanque de agua sucia, enjuágalo y evita dejarlo cerrado con residuos adentro.",
        priority: 5
      },
      {
        id: "agua-limpia",
        label: "Rellenar agua limpia",
        icon: "🚿",
        category: "estacion",
        intervalDays: 3,
        note: "Usar agua destilada si es posible.",
        instruction:
          "Revisa el nivel del tanque de agua limpia y rellénalo. Si es posible, usa agua filtrada o destilada.",
        priority: 4
      },
      {
        id: "base-cepillo",
        label: "Cepillo autolimpieza",
        icon: "⚙️",
        category: "estacion",
        intervalDays: 14,
        note: "Retirar pelos y residuos.",
        instruction:
          "Revisa el cepillo de autolimpieza de la base y retira pelos o residuos acumulados.",
        priority: 3
      },
      {
        id: "filtro-estacion",
        label: "Filtro de la estación",
        icon: "🔍",
        category: "estacion",
        intervalDays: 30,
        note: "Limpiar o reemplazar.",
        instruction:
          "Revisa el filtro de la estación, límpialo con cuidado o reemplázalo si ya está deteriorado.",
        priority: 2
      },
      {
        id: "bandeja-estacion",
        label: "Bandeja / contenedor",
        icon: "📦",
        category: "estacion",
        intervalDays: 30,
        note: "Limpiar residuos acumulados.",
        instruction:
          "Limpia la bandeja y las zonas donde se acumula humedad, polvo o mugre seca.",
        priority: 2
      }
    ]
  }
];

export const ALL_MAINTENANCE_ITEMS = MAINTENANCE_GROUPS.flatMap(group => {
  return group.items.map(item => ({
    ...item,
    groupId: group.id,
    groupLabel: group.label,
    groupDescription: group.description || ""
  }));
});

export const MAINTENANCE_STATUS = {
  ok: {
    id: "ok",
    label: "Al día",
    shortLabel: "Al día",
    description: "El mantenimiento está dentro del tiempo recomendado.",
    priority: 1
  },
  soon: {
    id: "soon",
    label: "Próximo",
    shortLabel: "Próximo",
    description: "Está cerca de necesitar mantenimiento.",
    priority: 2
  },
  urgent: {
    id: "urgent",
    label: "Urgente",
    shortLabel: "Urgente",
    description: "Ya pasó el tiempo recomendado de mantenimiento.",
    priority: 3
  },
  never: {
    id: "never",
    label: "Sin registro",
    shortLabel: "Sin registro",
    description: "Este elemento todavía no tiene registro.",
    priority: 4
  }
};

/* =============================================================================
 * Referencias Firebase
 * ============================================================================= */

function getMaintenanceRef() {
  return doc(db, APP_STATE_COLLECTION, MAINTENANCE_DOC_ID);
}

/* =============================================================================
 * Helpers generales
 * ============================================================================= */

function safeString(value = "") {
  return String(value ?? "").trim();
}

function normalizeText(value = "") {
  return safeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function startOfDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (!date || Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getTodayISO() {
  return new Date().toISOString();
}

function addDays(dateValue, daysToAdd = 0) {
  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);

  if (!date || Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + Number(daysToAdd || 0));

  return date;
}

function getItemById(itemId) {
  const normalizedId = normalizeText(itemId);

  return ALL_MAINTENANCE_ITEMS.find(item => {
    return normalizeText(item.id) === normalizedId;
  }) || null;
}

function normalizeMaintenanceRecord(record = null) {
  if (!record || typeof record !== "object") return null;

  return {
    lastDone: record.lastDone || null,
    notes: record.notes || "",
    doneBy: record.doneBy || "",
    updatedAt: record.updatedAt || null
  };
}

function normalizeMaintenanceRecords(records = {}) {
  return Object.entries(records || {}).reduce((acc, [itemId, record]) => {
    const normalized = normalizeMaintenanceRecord(record);

    if (normalized) {
      acc[itemId] = normalized;
    }

    return acc;
  }, {});
}

function getStatusFromDays(days, intervalDays) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return MAINTENANCE_STATUS.never;
  }

  const safeInterval = Math.max(1, Number(intervalDays || 1));
  const ratio = Number(days) / safeInterval;

  if (ratio >= 1.2) return MAINTENANCE_STATUS.urgent;
  if (ratio >= 0.8) return MAINTENANCE_STATUS.soon;

  return MAINTENANCE_STATUS.ok;
}

/* =============================================================================
 * Lectura de registros
 * ============================================================================= */

export async function getMaintenanceRecords() {
  const snapshot = await getDoc(getMaintenanceRef());

  if (!snapshot.exists()) return {};

  const data = snapshot.data() || {};

  return normalizeMaintenanceRecords(data.records || {});
}

export async function getItemRecord(itemId) {
  const records = await getMaintenanceRecords();

  return records[itemId] || null;
}

/* =============================================================================
 * Escritura de registros
 * ============================================================================= */

export async function markItemDone(itemId, notes = "", doneBy = "") {
  const item = getItemById(itemId);

  if (!item) {
    throw new Error(`No existe el elemento de mantenimiento: ${itemId}`);
  }

  const record = {
    lastDone: getTodayISO(),
    notes: safeString(notes),
    doneBy: safeString(doneBy),
    updatedAt: new Date().toISOString()
  };

  await setDoc(
    getMaintenanceRef(),
    {
      records: {
        [item.id]: record
      },
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return record;
}

export async function clearItemRecord(itemId) {
  const item = getItemById(itemId);

  if (!item) {
    throw new Error(`No existe el elemento de mantenimiento: ${itemId}`);
  }

  await setDoc(
    getMaintenanceRef(),
    {
      [`records.${item.id}`]: deleteField(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function markManyItemsDone(itemIds = [], notes = "", doneBy = "") {
  const validItems = itemIds
    .map(itemId => getItemById(itemId))
    .filter(Boolean);

  if (!validItems.length) return {};

  const nowISO = getTodayISO();

  const records = validItems.reduce((acc, item) => {
    acc[item.id] = {
      lastDone: nowISO,
      notes: safeString(notes),
      doneBy: safeString(doneBy),
      updatedAt: nowISO
    };

    return acc;
  }, {});

  await setDoc(
    getMaintenanceRef(),
    {
      records,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return records;
}

/* =============================================================================
 * Fechas y estado
 * ============================================================================= */

export function daysSinceISO(isoString) {
  if (!isoString) return null;

  const date = startOfDay(isoString);
  const today = startOfDay(new Date());

  if (!date || !today) return null;

  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

export function getNextMaintenanceDate(itemId, record = null) {
  const item = getItemById(itemId);

  if (!item || !record?.lastDone) return null;

  return addDays(record.lastDone, item.intervalDays);
}

export function getRemainingDays(itemId, record = null) {
  const item = getItemById(itemId);

  if (!item || !record?.lastDone) return null;

  const days = daysSinceISO(record.lastDone);

  if (days === null) return null;

  return Number(item.intervalDays || 0) - days;
}

export function getItemStatusFromRecord(itemId, record = null) {
  const item = getItemById(itemId);

  if (!item) return MAINTENANCE_STATUS.never.id;
  if (!record) return MAINTENANCE_STATUS.never.id;

  const days = daysSinceISO(record.lastDone);
  const status = getStatusFromDays(days, item.intervalDays);

  return status.id;
}

export async function getItemStatus(itemId) {
  const record = await getItemRecord(itemId);

  return getItemStatusFromRecord(itemId, record);
}

export function getItemStatusMeta(itemId, record = null) {
  const item = getItemById(itemId);

  if (!item) {
    return {
      ...MAINTENANCE_STATUS.never,
      days: null,
      ratio: null,
      remainingDays: null,
      nextDate: null
    };
  }

  if (!record) {
    return {
      ...MAINTENANCE_STATUS.never,
      days: null,
      ratio: null,
      remainingDays: null,
      nextDate: null
    };
  }

  const days = daysSinceISO(record.lastDone);
  const intervalDays = Math.max(1, Number(item.intervalDays || 1));
  const ratio = days === null ? null : days / intervalDays;
  const status = getStatusFromDays(days, intervalDays);

  return {
    ...status,
    days,
    ratio,
    remainingDays: getRemainingDays(itemId, record),
    nextDate: getNextMaintenanceDate(itemId, record)
  };
}

/* =============================================================================
 * Datos enriquecidos para vistas
 * ============================================================================= */

export function getMaintenanceItemById(itemId) {
  return getItemById(itemId);
}

export function getMaintenanceItemsByGroup(groupId) {
  const normalizedGroupId = normalizeText(groupId);

  return ALL_MAINTENANCE_ITEMS.filter(item => {
    return normalizeText(item.groupId) === normalizedGroupId;
  });
}

export function getMaintenanceItemsByCategory(category) {
  const normalizedCategory = normalizeText(category);

  return ALL_MAINTENANCE_ITEMS.filter(item => {
    return normalizeText(item.category) === normalizedCategory;
  });
}

export function enrichMaintenanceItem(item, record = null) {
  const statusMeta = getItemStatusMeta(item.id, record);

  return {
    ...item,
    record,
    status: statusMeta.id,
    statusLabel: statusMeta.label,
    statusShortLabel: statusMeta.shortLabel,
    statusDescription: statusMeta.description,
    statusPriority: statusMeta.priority,
    days: statusMeta.days,
    ratio: statusMeta.ratio,
    remainingDays: statusMeta.remainingDays,
    nextDate: statusMeta.nextDate
  };
}

export function enrichMaintenanceItems(records = {}) {
  return ALL_MAINTENANCE_ITEMS.map(item => {
    return enrichMaintenanceItem(item, records[item.id] || null);
  });
}

export async function getEnrichedMaintenanceItems() {
  const records = await getMaintenanceRecords();

  return enrichMaintenanceItems(records);
}

export async function getMaintenanceRecordsAsList() {
  const records = await getMaintenanceRecords();

  return enrichMaintenanceItems(records);
}

/* =============================================================================
 * Resumen
 * ============================================================================= */

export function getMaintenanceSummaryFromItems(items = []) {
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

export async function getMaintenanceSummary() {
  const items = await getEnrichedMaintenanceItems();

  return getMaintenanceSummaryFromItems(items);
}