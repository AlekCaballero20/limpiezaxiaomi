import {
  deleteField,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "../config/firebase.config.js";

const APP_STATE_COLLECTION = "app_state";
const MAINTENANCE_DOC_ID = "maintenance_records";

export const MAINTENANCE_GROUPS = [
  {
    id: "robot",
    label: "Aspiradora",
    items: [
      { id: "contenedor-polvo", label: "Contenedor de polvo", icon: "🗑️", intervalDays: 3, note: "Vaciar despues de 2-3 usos" },
      { id: "trapo-mopa", label: "Trapo / mopa", icon: "🧺", intervalDays: 3, note: "Lavar y dejar secar bien" },
      { id: "cepillo-principal", label: "Cepillo principal", icon: "🪥", intervalDays: 7, note: "Retirar pelos enredados" },
      { id: "cepillos-lateral", label: "Cepillos laterales", icon: "🔄", intervalDays: 7, note: "Limpiar de acumulacion" },
      { id: "filtro-hepa", label: "Filtro HEPA", icon: "💨", intervalDays: 14, note: "Golpear suave y limpiar con aire" },
      { id: "sensores", label: "Sensores y lentes", icon: "👁️", intervalDays: 14, note: "Pano seco, sin liquidos" }
    ]
  },
  {
    id: "estacion",
    label: "Estacion de limpieza",
    items: [
      { id: "agua-sucia", label: "Vaciar tanque agua sucia", icon: "💧", intervalDays: 3, note: "Enjuagar con agua limpia" },
      { id: "agua-limpia", label: "Rellenar agua limpia", icon: "🚿", intervalDays: 3, note: "Usar agua destilada si es posible" },
      { id: "base-cepillo", label: "Cepillo auto-limpieza", icon: "⚙️", intervalDays: 14, note: "Retirar pelos y residuos" },
      { id: "filtro-estacion", label: "Filtro de la estacion", icon: "🔍", intervalDays: 30, note: "Limpiar o reemplazar" },
      { id: "bandeja-estacion", label: "Bandeja / contenedor", icon: "📦", intervalDays: 30, note: "Limpiar residuos acumulados" }
    ]
  }
];

export const ALL_MAINTENANCE_ITEMS = MAINTENANCE_GROUPS.flatMap(group => group.items);

function getMaintenanceRef() {
  return doc(db, APP_STATE_COLLECTION, MAINTENANCE_DOC_ID);
}

export async function getMaintenanceRecords() {
  const snapshot = await getDoc(getMaintenanceRef());
  if (!snapshot.exists()) return {};
  const data = snapshot.data();
  return data.records || {};
}

export async function getItemRecord(itemId) {
  const records = await getMaintenanceRecords();
  return records[itemId] || null;
}

export async function markItemDone(itemId, notes = "") {
  const record = {
    lastDone: new Date().toISOString(),
    notes: notes || ""
  };

  await setDoc(
    getMaintenanceRef(),
    {
      records: {
        [itemId]: record
      }
    },
    { merge: true }
  );

  return record;
}

export async function clearItemRecord(itemId) {
  await setDoc(
    getMaintenanceRef(),
    {
      records: {
        [itemId]: deleteField()
      }
    },
    { merge: true }
  );
}

export function daysSinceISO(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export async function getItemStatus(itemId) {
  const item = ALL_MAINTENANCE_ITEMS.find(entry => entry.id === itemId);
  if (!item) return "never";

  const record = await getItemRecord(itemId);
  if (!record) return "never";

  const days = daysSinceISO(record.lastDone);
  if (days === null) return "never";

  const ratio = days / item.intervalDays;
  if (ratio >= 1.2) return "urgent";
  if (ratio >= 0.8) return "soon";
  return "ok";
}
