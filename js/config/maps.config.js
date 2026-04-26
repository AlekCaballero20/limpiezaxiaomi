/* ==============================
   MAPS CONFIG - Musicala Tracker
   Definicion de mapas y zonas que puede hacer la aspiradora.
============================== */

export const MAPS = [
  {
    id: 1,
    name: "Mapa 1",
    label: "Entrada & Salones",
    color: "#7c6af5",
    zones: [
      "Recepcion",
      "Corredor lockers",
      "Salon 1",
      "Salon 2",
      "Salon 6"
    ]
  },
  {
    id: 2,
    name: "Mapa 2",
    label: "Primer piso",
    color: "#00d4aa",
    zones: [
      "Pasillo 1er piso",
      "Salon 3",
      "Salon 4",
      "Salon 5",
      "Cafeteria"
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
      "Bano hombres 2do piso",
      "Salon 7",
      "Bano Salon 7",
      "Salon 8",
      "Bano Salon 8",
      "Bano mujeres 2do piso",
      "Salon 9",
      "Salon 10"
    ]
  }
];

/* ==============================
   DERIVADOS
============================== */

export const ALL_ZONES = MAPS.flatMap(map => map.zones);

/* ==============================
   HELPERS
============================== */

export function getMapById(mapId) {
  return MAPS.find(map => map.id === mapId) || null;
}

export function getMapOfZone(zoneName) {
  return MAPS.find(map => map.zones.includes(zoneName)) || null;
}

export function getZonesByMap(mapId) {
  const map = getMapById(mapId);
  return map ? map.zones : [];
}

export function isValidZone(zoneName) {
  return ALL_ZONES.includes(zoneName);
}

export function getZonesPreview(mapId, limit = 3) {
  const zones = getZonesByMap(mapId);
  if (!zones.length) return "";

  const preview = zones.slice(0, limit).join(", ");
  return zones.length > limit ? `${preview}...` : preview;
}
