import {
  MAPS,
  ALL_ZONES,
  getMapById,
  getMapOfZone
} from "../config/maps.config.js";

import { tsToDate, daysSince } from "./dates.js";
import { statusPriority } from "./status.js";
import {
  getCurrentCycleState,
  getNextRecommendedByMap,
  getSessionCleaningType
} from "./cleaning-cycle.js";
import { getXiaomiPreset } from "../config/cleaning.config.js";

const ROUTINE_TARGET_DAYS = 2;

function normalizeZoneName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00C3\u00A1/g, "a")
    .replace(/\u00C3\u00A9/g, "e")
    .replace(/\u00C3\u00AD/g, "i")
    .replace(/\u00C3\u00B3/g, "o")
    .replace(/\u00C3\u00BA/g, "u")
    .replace(/\u00C3\u00B1/g, "n")
    .toLowerCase()
    .trim();
}

function sessionHasZone(session, zoneName) {
  const target = normalizeZoneName(zoneName);
  return (session.zones || []).some(zone => normalizeZoneName(zone) === target);
}

export function getWeeklyCleaningMode(date = new Date()) {
  const fallbackMode = "profundo";
  const preset = getXiaomiPreset(fallbackMode);

  return {
    mode: fallbackMode,
    title: `Plan ${fallbackMode}`,
    xiaomi: preset,
    note: `Compatibilidad: las sugerencias reales ahora se calculan con el ciclo de limpieza. Dia ${date?.getDay?.() ?? ""}.`
  };
}

export function getLastCleanedForZone(zoneName, sessions = []) {
  const hits = sessions.filter(session => sessionHasZone(session, zoneName));
  if (!hits.length) return null;

  return hits.reduce((latest, session) => {
    const currentDate = tsToDate(session.completedAt);
    if (!currentDate) return latest;
    return currentDate > latest ? currentDate : latest;
  }, new Date(0));
}

export function getDaysSinceZoneCleaned(zoneName, sessions = []) {
  return daysSince(getLastCleanedForZone(zoneName, sessions));
}

export function getLastCleanedForMap(mapId, sessions = []) {
  const map = getMapById(mapId);
  if (!map) return null;

  const dates = map.zones
    .map(zone => getLastCleanedForZone(zone, sessions))
    .filter(Boolean);

  if (!dates.length) return null;

  return dates.reduce((latest, date) => date > latest ? date : latest, new Date(0));
}

export function getDaysSinceMapCleaned(mapId, sessions = []) {
  return daysSince(getLastCleanedForMap(mapId, sessions));
}

export function getMapCoverage(mapId, sessions = []) {
  const map = getMapById(mapId);
  if (!map) return null;

  const zones = map.zones.map(zoneName => {
    const lastCleaned = getLastCleanedForZone(zoneName, sessions);
    return {
      name: zoneName,
      lastCleaned,
      days: daysSince(lastCleaned)
    };
  });

  const overdueZones = zones.filter(zone => zone.days === null || zone.days >= ROUTINE_TARGET_DAYS);
  const oldest = zones.reduce((current, zone) => {
    if (!current) return zone;
    return statusPriority(zone.days) > statusPriority(current.days) ? zone : current;
  }, null);

  return {
    total: zones.length,
    covered: zones.filter(zone => zone.days !== null).length,
    fresh: zones.length - overdueZones.length,
    overdue: overdueZones.length,
    overdueZones,
    oldest,
    zones
  };
}

export function getZonesWithoutData(sessions = []) {
  return ALL_ZONES.filter(zone => !getLastCleanedForZone(zone, sessions));
}

export function getRankedMapsByUrgency(sessions = []) {
  return [...MAPS]
    .map(map => {
      const coverage = getMapCoverage(map.id, sessions);
      return {
        ...map,
        days: coverage?.oldest?.days ?? null,
        lastCleaned: getLastCleanedForMap(map.id, sessions),
        coverage
      };
    })
    .sort((a, b) => statusPriority(b.days) - statusPriority(a.days));
}

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
    .sort((a, b) => statusPriority(b.days) - statusPriority(a.days));
}

export function getCleaningRecommendations(sessions = [], date = new Date()) {
  const cycleState = getCurrentCycleState(sessions, date);
  const weeklyMode = {
    mode: cycleState.currentStage.id,
    title: `Etapa ${cycleState.currentStage.label}`,
    xiaomi: cycleState.xiaomi,
    note: cycleState.weekdayNote || cycleState.currentStage.description
  };
  const rankedMaps = getNextRecommendedByMap(sessions);
  const rankedZones = getRankedZonesByUrgency(sessions);

  const topMaps = rankedMaps.slice(0, 3).map((map, index) => {
    return {
      ...map,
      rank: index + 1,
      targetZones: map.targetZones?.length ? map.targetZones : map.zones.slice(0, 2),
      planTitle: weeklyMode.title,
      planNote: weeklyMode.note,
      xiaomi: weeklyMode.xiaomi
    };
  });

  return {
    weeklyMode,
    cycleState,
    topMaps,
    topZones: rankedZones.slice(0, 6)
  };
}

export function getNextZoneToClean(sessions = []) {
  const rankedZones = getRankedZonesByUrgency(sessions);
  return rankedZones.length ? rankedZones[0] : null;
}

export function getNextMapToClean(sessions = []) {
  const rankedMaps = getRankedMapsByUrgency(sessions);
  return rankedMaps.length ? rankedMaps[0] : null;
}

export function getSessionsByZone(zoneName, sessions = []) {
  return sessions.filter(session => sessionHasZone(session, zoneName));
}

export function getSessionsByMap(mapId, sessions = []) {
  return sessions.filter(session => session.mapId === mapId);
}

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

export function getCleaningHealthSummary(sessions = []) {
  const zones = getRankedZonesByUrgency(sessions);
  const cleanedToday = zones.filter(zone => zone.days === 0).length;
  const freshZones = zones.filter(zone => zone.days !== null && zone.days <= 2).length;
  const attentionZones = zones.filter(zone => zone.days === null || zone.days >= 5).length;
  const quickSessions = sessions.filter(session => getSessionCleaningType(session) === "rapido").length;
  const deepSessions = sessions.filter(session => getSessionCleaningType(session) === "profundo").length;

  return {
    cleanedToday,
    freshZones,
    attentionZones,
    quickSessions,
    deepSessions,
    totalZones: ALL_ZONES.length,
    freshnessPercent: ALL_ZONES.length
      ? Math.round((freshZones / ALL_ZONES.length) * 100)
      : 0
  };
}
