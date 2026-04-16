/* ─────────────────────────────────────────────
   MAPS CONFIG — Musicala Tracker
   Definición de mapas y zonas
───────────────────────────────────────────── */

export const MAPS = [
  {
    id: 1,
    name: "Mapa 1",
    label: "Entrada & Salones",
    color: "#7c6af5",
    zones: [
      "Recepción",
      "Corredor lockers",
      "Salón 1",
      "Salón 2",
      "Salón 6"
    ]
  },
  {
    id: 2,
    name: "Mapa 2",
    label: "Primer piso",
    color: "#00d4aa",
    zones: [
      "Pasillo 1er piso",
      "Salón 3",
      "Salón 4",
      "Salón 5",
      "Cafetería"
    ]
  },
  {
    id: 3,
    name: "Mapa 3",
    label: "Oficina",
    color: "#f5a623",
    zones: [
      "Oficina"
    ]
  },
  {
    id: 4,
    name: "Mapa 4",
    label: "Segundo piso",
    color: "#e95a7c",
    zones: [
      "Pasillo 2do piso",
      "Baño hombres 2do piso",
      "Salón 7",
      "Baño Salón 7",
      "Salón 8",
      "Baño Salón 8",
      "Baño mujeres 2do piso",
      "Salón 9",
      "Salón 10"
    ]
  },
  {
    id: 5,
    name: "Manual",
    label: "Limpieza manual",
    color: "#8888a0",
    zones: [
      "Baño 1er piso"
    ]
  }
];

/* ==============================
   DERIVADOS
============================== */

/* Lista plana de todas las zonas */
export const ALL_ZONES = MAPS.flatMap(map => map.zones);

/* ==============================
   HELPERS
============================== */

/* Obtener mapa por ID */
export function getMapById(mapId) {
  return MAPS.find(map => map.id === mapId) || null;
}

/* Obtener mapa al que pertenece una zona */
export function getMapOfZone(zoneName) {
  return MAPS.find(map => map.zones.includes(zoneName)) || null;
}

/* Obtener solo las zonas de un mapa */
export function getZonesByMap(mapId) {
  const map = getMapById(mapId);
  return map ? map.zones : [];
}

/* Validar si una zona existe */
export function isValidZone(zoneName) {
  return ALL_ZONES.includes(zoneName);
}

/* Obtener resumen corto de zonas (para UI) */
export function getZonesPreview(mapId, limit = 3) {
  const zones = getZonesByMap(mapId);
  if (!zones.length) return "";

  const preview = zones.slice(0, limit).join(", ");
  return zones.length > limit ? `${preview}…` : preview;
}