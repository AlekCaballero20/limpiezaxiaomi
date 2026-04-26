import {
  MAPS,
  ALL_ZONES,
  getMapById,
  getMapOfZone
} from "../config/maps.config.js";

import { tsToDate, daysSince } from "./dates.js";
import { statusPriority } from "./status.js";

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

function getSessionMode(session) {
  const xiaomi = session.xiaomi || {};
  const trajectory = xiaomi.trayectoria || "";
  const times = Number(xiaomi.veces || 1);
  const suction = xiaomi.succion || "";

  if (trajectory === "profundo" || times >= 2 || suction === "turbo") return "profundo";
  if (trajectory === "rapido" || suction === "silencioso") return "rapido";
  return "estandar";
}

export function getWeeklyCleaningMode(date = new Date()) {
  const day = date.getDay();

  if (day === 0 || day === 1) {
    return {
      mode: "profundo",
      title: "Plan profundo",
      xiaomi: {
        modo: "aspirar-fregar",
        succion: "turbo",
        agua: "nivel3",
        trayectoria: "profundo",
        veces: "2"
      },
      note: "Inicio de semana: pasada completa para dejar la base limpia."
    };
  }

  if (day >= 2 && day <= 4) {
    return {
      mode: "estandar",
      title: "Plan de sostenimiento",
      xiaomi: {
        modo: "aspirar",
        succion: "estandar",
        agua: "",
        trayectoria: "estandar",
        veces: "1"
      },
      note: "Mitad de semana: cubrir pendientes sin hacerlo tan pesado."
    };
  }

  return {
    mode: "rapido",
    title: "Plan rapido",
    xiaomi: {
      modo: "aspirar",
      succion: "fuerte",
      agua: "",
      trayectoria: "rapido",
      veces: "1"
    },
    note: "Cierre de semana: pasada corta para no dejar acumular."
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
  const weeklyMode = getWeeklyCleaningMode(date);
  const rankedMaps = getRankedMapsByUrgency(sessions);
  const rankedZones = getRankedZonesByUrgency(sessions);
  const candidates = weeklyMode.mode === "profundo"
    ? rankedMaps
    : rankedMaps.filter(map => (map.coverage?.overdue || 0) > 0);

  const topMaps = (candidates.length ? candidates : rankedMaps).slice(0, 3).map((map, index) => {
    const dueZones = weeklyMode.mode === "profundo"
      ? map.zones
      : (map.coverage?.overdueZones || [])
        .sort((a, b) => statusPriority(b.days) - statusPriority(a.days))
        .slice(0, weeklyMode.mode === "rapido" ? 3 : 5)
        .map(zone => zone.name);

    return {
      ...map,
      rank: index + 1,
      targetZones: dueZones.length ? dueZones : map.zones.slice(0, 2),
      planTitle: weeklyMode.title,
      planNote: weeklyMode.note,
      xiaomi: weeklyMode.xiaomi
    };
  });

  return {
    weeklyMode,
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
  const quickSessions = sessions.filter(session => getSessionMode(session) === "rapido").length;
  const deepSessions = sessions.filter(session => getSessionMode(session) === "profundo").length;

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
