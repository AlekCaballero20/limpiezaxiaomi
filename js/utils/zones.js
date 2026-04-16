/* ─────────────────────────────────────────────
   ZONES UTILS — Musicala Tracker
   Lógica de zonas, mapas y urgencia de limpieza
───────────────────────────────────────────── */

import {
  MAPS,
  ALL_ZONES,
  getMapById,
  getMapOfZone
} from "../config/maps.config.js";

import { tsToDate, daysSince } from "./dates.js";
import { statusPriority } from "./status.js";

/* ==============================
   ÚLTIMA LIMPIEZA POR ZONA
============================== */
export function getLastCleanedForZone(zoneName, sessions = []) {
  const hits = sessions.filter(session => session.zones?.includes(zoneName));

  if (!hits.length) return null;

  return hits.reduce((latest, session) => {
    const currentDate = tsToDate(session.completedAt);
    if (!currentDate) return latest;
    return currentDate > latest ? currentDate : latest;
  }, new Date(0));
}

/* ==============================
   DÍAS DESDE ÚLTIMA LIMPIEZA POR ZONA
============================== */
export function getDaysSinceZoneCleaned(zoneName, sessions = []) {
  const lastCleaned = getLastCleanedForZone(zoneName, sessions);
  return daysSince(lastCleaned);
}

/* ==============================
   ÚLTIMA LIMPIEZA POR MAPA
============================== */
export function getLastCleanedForMap(mapId, sessions = []) {
  const map = getMapById(mapId);
  if (!map) return null;

  const dates = map.zones
    .map(zone => getLastCleanedForZone(zone, sessions))
    .filter(Boolean);

  if (!dates.length) return null;

  return dates.reduce((latest, date) => {
    return date > latest ? date : latest;
  }, new Date(0));
}

/* ==============================
   DÍAS DESDE ÚLTIMA LIMPIEZA POR MAPA
============================== */
export function getDaysSinceMapCleaned(mapId, sessions = []) {
  const lastCleaned = getLastCleanedForMap(mapId, sessions);
  return daysSince(lastCleaned);
}

/* ==============================
   ZONAS SIN DATOS
============================== */
export function getZonesWithoutData(sessions = []) {
  return ALL_ZONES.filter(zone => !getLastCleanedForZone(zone, sessions));
}

/* ==============================
   MAPAS RANKEADOS POR URGENCIA
============================== */
export function getRankedMapsByUrgency(sessions = []) {
  return [...MAPS]
    .map(map => ({
      ...map,
      days: getDaysSinceMapCleaned(map.id, sessions),
      lastCleaned: getLastCleanedForMap(map.id, sessions)
    }))
    .sort((a, b) => {
      return statusPriority(b.days) - statusPriority(a.days);
    });
}

/* ==============================
   ZONAS RANKEADAS POR URGENCIA
============================== */
export function getRankedZonesByUrgency(sessions = []) {
  return [...ALL_ZONES]
    .map(zoneName => {
      const map = getMapOfZone(zoneName);
      const lastCleaned = getLastCleanedForZone(zoneName, sessions);

      return {
        name: zoneName,
        mapId: map?.id ?? null,
        mapName: map?.name ?? null,
        mapLabel: map?.label ?? null,
        mapColor: map?.color ?? "#ccc",
        lastCleaned,
        days: daysSince(lastCleaned)
      };
    })
    .sort((a, b) => {
      return statusPriority(b.days) - statusPriority(a.days);
    });
}

/* ==============================
   PRÓXIMA ZONA RECOMENDADA
============================== */
export function getNextZoneToClean(sessions = []) {
  const rankedZones = getRankedZonesByUrgency(sessions);
  return rankedZones.length ? rankedZones[0] : null;
}

/* ==============================
   PRÓXIMO MAPA RECOMENDADO
============================== */
export function getNextMapToClean(sessions = []) {
  const rankedMaps = getRankedMapsByUrgency(sessions);
  return rankedMaps.length ? rankedMaps[0] : null;
}

/* ==============================
   SESIONES DE UNA ZONA
============================== */
export function getSessionsByZone(zoneName, sessions = []) {
  return sessions.filter(session => session.zones?.includes(zoneName));
}

/* ==============================
   SESIONES DE UN MAPA
============================== */
export function getSessionsByMap(mapId, sessions = []) {
  const map = getMapById(mapId);
  if (!map) return [];

  return sessions.filter(session => session.mapId === mapId);
}

/* ==============================
   RESUMEN GENERAL DE COBERTURA
============================== */
export function getCoverageSummary(sessions = []) {
  const totalZones = ALL_ZONES.length;
  const zonesWithoutData = getZonesWithoutData(sessions).length;
  const coveredZones = totalZones - zonesWithoutData;

  return {
    totalZones,
    coveredZones,
    zonesWithoutData,
    coveragePercent: totalZones > 0
      ? Math.round((coveredZones / totalZones) * 100)
      : 0
  };
}