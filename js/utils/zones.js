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
  getSessionCleaningType,
  getZonesCleanedOnDate,
  wasZoneCleanedOnDate
} from "./cleaning-cycle.js";

import {
  getXiaomiPreset,
  getDailyCleaningStrategy,
  PRIORITY_DAILY_ZONES,
  ZONE_FRESHNESS_LIMITS,
  ZONE_FRESHNESS_LABELS,
  ZONE_FRESHNESS_DESCRIPTIONS,
  ZONE_FILTERS
} from "../config/cleaning.config.js";

/* =============================================================================
 * Configuración local
 * ============================================================================= */

const ROUTINE_TARGET_DAYS = 2;

const DEFAULT_REFERENCE_DATE = () => new Date();

/* =============================================================================
 * Normalización
 * ============================================================================= */

export function normalizeZoneName(value = "") {
  return String(value || "")
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

function zoneEquals(a, b) {
  return normalizeZoneName(a) === normalizeZoneName(b);
}

function uniqueZones(zones = []) {
  const seen = new Set();

  return (zones || []).filter(zone => {
    const key = normalizeZoneName(zone);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function hasZone(zoneList = [], zoneName) {
  const target = normalizeZoneName(zoneName);

  return (zoneList || []).some(zone => normalizeZoneName(zone) === target);
}

function getCanonicalZoneName(zoneName) {
  const target = normalizeZoneName(zoneName);

  return ALL_ZONES.find(zone => normalizeZoneName(zone) === target) || zoneName;
}

function isPriorityDailyZone(zoneName) {
  return hasZone(PRIORITY_DAILY_ZONES, zoneName);
}

/* =============================================================================
 * Fechas
 * ============================================================================= */

function getSessionDate(session = {}) {
  return tsToDate(session.completedAt) || tsToDate(session.startedAt) || null;
}

function startOfDay(value = new Date()) {
  const date = tsToDate(value) || new Date(value);

  if (!date || Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameCalendarDay(a, b) {
  const dayA = startOfDay(a);
  const dayB = startOfDay(b);

  if (!dayA || !dayB) return false;

  return dayA.getTime() === dayB.getTime();
}

function daysSinceDate(value, referenceDate = DEFAULT_REFERENCE_DATE()) {
  const date = tsToDate(value);
  const reference = startOfDay(referenceDate);

  if (!date || !reference) return null;

  const dateStart = startOfDay(date);

  return Math.floor((reference.getTime() - dateStart.getTime()) / 86400000);
}

/* =============================================================================
 * Sesiones por zona / mapa
 * ============================================================================= */

function sessionHasZone(session = {}, zoneName) {
  const target = normalizeZoneName(zoneName);

  return (session.zones || []).some(zone => normalizeZoneName(zone) === target);
}

export function getSessionsByZone(zoneName, sessions = []) {
  return (sessions || []).filter(session => sessionHasZone(session, zoneName));
}

export function getSessionsByMap(mapId, sessions = []) {
  return (sessions || []).filter(session => Number(session.mapId) === Number(mapId));
}

export function getSessionsForToday(sessions = [], date = DEFAULT_REFERENCE_DATE()) {
  return (sessions || []).filter(session => isSameCalendarDay(getSessionDate(session), date));
}

/* =============================================================================
 * Últimos registros
 * ============================================================================= */

export function getLastCleanedForZone(zoneName, sessions = []) {
  const hits = getSessionsByZone(zoneName, sessions);

  if (!hits.length) return null;

  return hits.reduce((latest, session) => {
    const currentDate = getSessionDate(session);

    if (!currentDate) return latest;
    if (!latest) return currentDate;

    return currentDate > latest ? currentDate : latest;
  }, null);
}

export function getDaysSinceZoneCleaned(
  zoneName,
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return daysSinceDate(getLastCleanedForZone(zoneName, sessions), referenceDate);
}

export function getLastCleanedForMap(mapId, sessions = []) {
  const map = getMapById(mapId);

  if (!map) return null;

  const dates = map.zones
    .map(zone => getLastCleanedForZone(zone, sessions))
    .filter(Boolean);

  if (!dates.length) return null;

  return dates.reduce((latest, date) => (date > latest ? date : latest), dates[0]);
}

export function getDaysSinceMapCleaned(
  mapId,
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return daysSinceDate(getLastCleanedForMap(mapId, sessions), referenceDate);
}

/* =============================================================================
 * Estado de frescura
 * ============================================================================= */

export function getZoneFreshnessStatus(days) {
  if (days === null || days === undefined || Number.isNaN(Number(days))) {
    return "never";
  }

  if (days <= ZONE_FRESHNESS_LIMITS.freshDays) {
    return "today";
  }

  if (days <= ZONE_FRESHNESS_LIMITS.soonDays) {
    return "soon";
  }

  return "urgent";
}

export function getZoneFreshnessMeta(days) {
  const status = getZoneFreshnessStatus(days);

  return {
    status,
    label: ZONE_FRESHNESS_LABELS[status] || "Sin registro",
    description:
      ZONE_FRESHNESS_DESCRIPTIONS[status] ||
      "Zona sin información suficiente.",
    priority: statusPriority(days)
  };
}

export function getMapFreshnessStatus(mapId, sessions = [], referenceDate = DEFAULT_REFERENCE_DATE()) {
  const coverage = getMapCoverage(mapId, sessions, referenceDate);

  if (!coverage) return "never";
  if (coverage.zonesWithoutData === coverage.total) return "never";
  if (coverage.urgent > 0) return "urgent";
  if (coverage.soon > 0) return "soon";

  return "today";
}

/* =============================================================================
 * Información enriquecida de zonas
 * ============================================================================= */

export function getZoneInfo(
  zoneName,
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const canonicalName = getCanonicalZoneName(zoneName);
  const map = getMapOfZone(canonicalName);
  const lastCleaned = getLastCleanedForZone(canonicalName, sessions);
  const days = daysSinceDate(lastCleaned, referenceDate);
  const freshness = getZoneFreshnessMeta(days);
  const cleanedToday = wasZoneCleanedOnDate(canonicalName, sessions, referenceDate);
  const priorityDaily = isPriorityDailyZone(canonicalName);
  const cycleState = getCurrentCycleState(sessions, referenceDate);
  const pendingInCycle = hasZone(cycleState.progress?.pendingZones || [], canonicalName);
  const preferredToday = hasZone(
    cycleState.dailyStrategy?.preferredZones || [],
    canonicalName
  );

  return {
    name: canonicalName,
    normalizedName: normalizeZoneName(canonicalName),

    mapId: map?.id ?? null,
    mapName: map?.name ?? null,
    mapLabel: map?.label ?? null,
    mapColor: map?.color ?? "#ccc",

    lastCleaned,
    days,

    freshnessStatus: freshness.status,
    freshnessLabel: freshness.label,
    freshnessDescription: freshness.description,
    freshnessPriority: freshness.priority,

    cleanedToday,
    priorityDaily,
    pendingInCycle,
    preferredToday,

    needsAttention:
      !cleanedToday &&
      (
        days === null ||
        freshness.status === "urgent" ||
        pendingInCycle ||
        priorityDaily ||
        preferredToday
      ),

    shouldSuggest:
      !cleanedToday &&
      (
        priorityDaily ||
        preferredToday ||
        pendingInCycle ||
        days === null ||
        days >= ZONE_FRESHNESS_LIMITS.soonDays
      )
  };
}

export function getAllZoneInfo(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return ALL_ZONES.map(zoneName => getZoneInfo(zoneName, sessions, referenceDate));
}

/* =============================================================================
 * Cobertura por mapa
 * ============================================================================= */

export function getMapCoverage(
  mapId,
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const map = getMapById(mapId);

  if (!map) return null;

  const zones = map.zones.map(zoneName =>
    getZoneInfo(zoneName, sessions, referenceDate)
  );

  const zonesWithoutData = zones.filter(zone => zone.days === null).length;
  const cleanedToday = zones.filter(zone => zone.cleanedToday).length;
  const fresh = zones.filter(zone => zone.freshnessStatus === "today").length;
  const soon = zones.filter(zone => zone.freshnessStatus === "soon").length;
  const urgent = zones.filter(zone => zone.freshnessStatus === "urgent").length;

  const overdueZones = zones.filter(zone => {
    return zone.days === null || zone.days >= ROUTINE_TARGET_DAYS;
  });

  const pendingCycleZones = zones.filter(zone => zone.pendingInCycle);
  const priorityZones = zones.filter(zone => zone.priorityDaily);
  const preferredTodayZones = zones.filter(zone => zone.preferredToday);

  const oldest = zones.reduce((current, zone) => {
    if (!current) return zone;

    return statusPriority(zone.days) > statusPriority(current.days)
      ? zone
      : current;
  }, null);

  return {
    map,

    total: zones.length,
    covered: zones.filter(zone => zone.days !== null).length,
    zonesWithoutData,

    cleanedToday,
    fresh,
    soon,
    urgent,

    overdue: overdueZones.length,
    overdueZones,

    pendingCycle: pendingCycleZones.length,
    pendingCycleZones,

    priority: priorityZones.length,
    priorityZones,

    preferredToday: preferredTodayZones.length,
    preferredTodayZones,

    oldest,
    zones,

    freshnessPercent: zones.length
      ? Math.round((fresh / zones.length) * 100)
      : 0,

    coveragePercent: zones.length
      ? Math.round(((zones.length - zonesWithoutData) / zones.length) * 100)
      : 0,

    cleanedTodayPercent: zones.length
      ? Math.round((cleanedToday / zones.length) * 100)
      : 0
  };
}

/* =============================================================================
 * Listados por estado
 * ============================================================================= */

export function getZonesWithoutData(sessions = []) {
  return ALL_ZONES.filter(zone => !getLastCleanedForZone(zone, sessions));
}

export function getZonesCleanedToday(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const cleanedSet = getZonesCleanedOnDate(sessions, referenceDate);

  return ALL_ZONES.filter(zone => cleanedSet.has(normalizeZoneName(zone)));
}

export function getPendingZones(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return getAllZoneInfo(sessions, referenceDate).filter(zone => {
    return !zone.cleanedToday && zone.shouldSuggest;
  });
}

export function getPriorityZonesPendingToday(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return PRIORITY_DAILY_ZONES
    .map(zone => getZoneInfo(zone, sessions, referenceDate))
    .filter(zone => !zone.cleanedToday);
}

export function getPreferredZonesPendingToday(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const strategy = getDailyCleaningStrategy(referenceDate);

  return uniqueZones(strategy.preferredZones || [])
    .map(zone => getZoneInfo(zone, sessions, referenceDate))
    .filter(zone => !zone.cleanedToday);
}

/* =============================================================================
 * Rankings
 * ============================================================================= */

export function getRankedMapsByUrgency(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return [...MAPS]
    .map(map => {
      const coverage = getMapCoverage(map.id, sessions, referenceDate);

      return {
        ...map,
        days: coverage?.oldest?.days ?? null,
        lastCleaned: getLastCleanedForMap(map.id, sessions),
        coverage,

        cleanedToday: coverage?.cleanedToday ?? 0,
        pendingCycle: coverage?.pendingCycle ?? 0,
        priorityPending: coverage?.priorityZones?.filter(zone => !zone.cleanedToday).length ?? 0,
        urgent: coverage?.urgent ?? 0,
        zonesWithoutData: coverage?.zonesWithoutData ?? 0
      };
    })
    .sort((a, b) => {
      if (a.priorityPending !== b.priorityPending) {
        return b.priorityPending - a.priorityPending;
      }

      if (a.pendingCycle !== b.pendingCycle) {
        return b.pendingCycle - a.pendingCycle;
      }

      if (a.urgent !== b.urgent) {
        return b.urgent - a.urgent;
      }

      if (a.zonesWithoutData !== b.zonesWithoutData) {
        return b.zonesWithoutData - a.zonesWithoutData;
      }

      return statusPriority(b.days) - statusPriority(a.days);
    });
}

export function getRankedZonesByUrgency(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return getAllZoneInfo(sessions, referenceDate).sort((a, b) => {
    if (a.cleanedToday !== b.cleanedToday) {
      return a.cleanedToday ? 1 : -1;
    }

    if (a.priorityDaily !== b.priorityDaily) {
      return a.priorityDaily ? -1 : 1;
    }

    if (a.preferredToday !== b.preferredToday) {
      return a.preferredToday ? -1 : 1;
    }

    if (a.pendingInCycle !== b.pendingInCycle) {
      return a.pendingInCycle ? -1 : 1;
    }

    return statusPriority(b.days) - statusPriority(a.days);
  });
}

/* =============================================================================
 * Recomendaciones
 * ============================================================================= */

export function getWeeklyCleaningMode(date = DEFAULT_REFERENCE_DATE()) {
  const strategy = getDailyCleaningStrategy(date);
  const fallbackMode = "profundo";
  const preset = getXiaomiPreset(fallbackMode);

  return {
    mode: fallbackMode,
    title: `Plan ${fallbackMode}`,
    xiaomi: preset,
    strategy,
    note:
      strategy?.note ||
      `Compatibilidad: las sugerencias reales ahora se calculan con el ciclo de limpieza. Día ${date?.getDay?.() ?? ""}.`
  };
}

export function getCleaningRecommendations(
  sessions = [],
  date = DEFAULT_REFERENCE_DATE()
) {
  const cycleState = getCurrentCycleState(sessions, date);
  const strategy = cycleState.dailyStrategy || getDailyCleaningStrategy(date);

  const weeklyMode = {
    mode: cycleState.currentStage.id,
    title: `Etapa ${cycleState.currentStage.label}`,
    xiaomi: cycleState.xiaomi,
    strategy,
    note:
      cycleState.weekdayNote ||
      strategy?.note ||
      cycleState.currentStage.description
  };

  const rankedMaps = getNextRecommendedByMap(sessions, date);
  const rankedZones = getRankedZonesByUrgency(sessions, date);

  const topMaps = rankedMaps.slice(0, 3).map((map, index) => {
    return {
      ...map,
      rank: index + 1,
      targetZones: map.targetZones?.length ? map.targetZones : map.zones.slice(0, 2),
      planTitle: map.planTitle || weeklyMode.title,
      planNote: map.planNote || weeklyMode.note,
      xiaomi: map.xiaomi || weeklyMode.xiaomi,
      cleaningType: map.cleaningType || weeklyMode.mode
    };
  });

  return {
    weeklyMode,
    cycleState,
    strategy,
    topMaps,
    topZones: rankedZones.slice(0, 6),
    priorityPending: getPriorityZonesPendingToday(sessions, date),
    preferredPending: getPreferredZonesPendingToday(sessions, date),
    cleanedToday: getZonesCleanedToday(sessions, date)
  };
}

export function getNextZoneToClean(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const rankedZones = getRankedZonesByUrgency(sessions, referenceDate)
    .filter(zone => !zone.cleanedToday);

  return rankedZones.length ? rankedZones[0] : null;
}

export function getNextMapToClean(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const rankedMaps = getRankedMapsByUrgency(sessions, referenceDate);

  return rankedMaps.length ? rankedMaps[0] : null;
}

/* =============================================================================
 * Filtros para UI
 * ============================================================================= */

export function getAvailableZoneFilters() {
  return [...ZONE_FILTERS];
}

export function filterZones(
  zones = [],
  filterId = "all",
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const enrichedZones = zones.map(zone => {
    if (typeof zone === "string") {
      return getZoneInfo(zone, sessions, referenceDate);
    }

    return zone;
  });

  switch (filterId) {
    case "all":
      return enrichedZones;

    case "map-1":
      return enrichedZones.filter(zone => Number(zone.mapId) === 1);

    case "map-2":
      return enrichedZones.filter(zone => Number(zone.mapId) === 2);

    case "map-3":
      return enrichedZones.filter(zone => Number(zone.mapId) === 3);

    case "map-4":
      return enrichedZones.filter(zone => Number(zone.mapId) === 4);

    case "priority":
      return enrichedZones.filter(zone => zone.priorityDaily);

    case "pending":
      return enrichedZones.filter(zone => zone.shouldSuggest || zone.pendingInCycle);

    case "done-today":
      return enrichedZones.filter(zone => zone.cleanedToday);

    case "never":
      return enrichedZones.filter(zone => zone.days === null || zone.freshnessStatus === "never");

    default:
      return enrichedZones;
  }
}

/* =============================================================================
 * Resúmenes
 * ============================================================================= */

export function getCoverageSummary(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const zones = getAllZoneInfo(sessions, referenceDate);

  const totalZones = zones.length;
  const zonesWithoutData = zones.filter(zone => zone.days === null).length;
  const coveredZones = totalZones - zonesWithoutData;

  const cleanedToday = zones.filter(zone => zone.cleanedToday).length;
  const freshZones = zones.filter(zone => zone.freshnessStatus === "today").length;
  const soonZones = zones.filter(zone => zone.freshnessStatus === "soon").length;
  const urgentZones = zones.filter(zone => zone.freshnessStatus === "urgent").length;
  const pendingZones = zones.filter(zone => zone.shouldSuggest).length;

  return {
    totalZones,
    coveredZones,
    zonesWithoutData,

    cleanedToday,
    freshZones,
    soonZones,
    urgentZones,
    pendingZones,

    coveragePercent: totalZones > 0
      ? Math.round((coveredZones / totalZones) * 100)
      : 0,

    freshnessPercent: totalZones > 0
      ? Math.round((freshZones / totalZones) * 100)
      : 0,

    cleanedTodayPercent: totalZones > 0
      ? Math.round((cleanedToday / totalZones) * 100)
      : 0,

    pendingPercent: totalZones > 0
      ? Math.round((pendingZones / totalZones) * 100)
      : 0
  };
}

export function getCleaningHealthSummary(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const zones = getAllZoneInfo(sessions, referenceDate);

  const cleanedToday = zones.filter(zone => zone.cleanedToday).length;
  const freshZones = zones.filter(zone => zone.freshnessStatus === "today").length;
  const attentionZones = zones.filter(zone => {
    return zone.freshnessStatus === "urgent" || zone.freshnessStatus === "never";
  }).length;

  const priorityPending = zones.filter(zone => {
    return zone.priorityDaily && !zone.cleanedToday;
  }).length;

  const pendingCycleZones = zones.filter(zone => zone.pendingInCycle).length;

  const quickSessions = sessions.filter(session => {
    return getSessionCleaningType(session) === "rapido";
  }).length;

  const standardSessions = sessions.filter(session => {
    return getSessionCleaningType(session) === "estandar";
  }).length;

  const deepSessions = sessions.filter(session => {
    return getSessionCleaningType(session) === "profundo";
  }).length;

  return {
    cleanedToday,
    freshZones,
    attentionZones,
    priorityPending,
    pendingCycleZones,

    quickSessions,
    standardSessions,
    deepSessions,

    totalZones: ALL_ZONES.length,

    freshnessPercent: ALL_ZONES.length
      ? Math.round((freshZones / ALL_ZONES.length) * 100)
      : 0,

    cleanedTodayPercent: ALL_ZONES.length
      ? Math.round((cleanedToday / ALL_ZONES.length) * 100)
      : 0
  };
}

export function getGeneralCleaningStatus(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const summary = getCoverageSummary(sessions, referenceDate);
  const cycleState = getCurrentCycleState(sessions, referenceDate);

  return {
    ...summary,
    cycleNumber: cycleState.cycleNumber,
    currentStage: cycleState.currentStage,
    cycleProgressPercent: cycleState.progress?.percent ?? 0,
    dailyStrategy: cycleState.dailyStrategy,
    weekdayNote: cycleState.weekdayNote
  };
}

/* =============================================================================
 * Agrupaciones útiles para vistas
 * ============================================================================= */

export function groupZonesByMap(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  return MAPS.map(map => {
    const coverage = getMapCoverage(map.id, sessions, referenceDate);

    return {
      ...map,
      coverage,
      zones: coverage?.zones || []
    };
  });
}

export function groupZonesByFreshness(
  sessions = [],
  referenceDate = DEFAULT_REFERENCE_DATE()
) {
  const zones = getAllZoneInfo(sessions, referenceDate);

  return {
    today: zones.filter(zone => zone.freshnessStatus === "today"),
    soon: zones.filter(zone => zone.freshnessStatus === "soon"),
    urgent: zones.filter(zone => zone.freshnessStatus === "urgent"),
    never: zones.filter(zone => zone.freshnessStatus === "never")
  };
}

export function getZoneStatusLabel(zoneName, sessions = [], referenceDate = DEFAULT_REFERENCE_DATE()) {
  const info = getZoneInfo(zoneName, sessions, referenceDate);

  if (info.cleanedToday) return "Limpiada hoy";
  if (info.days === null) return "Sin registro";
  if (info.days === 0) return "Hoy";
  if (info.days === 1) return "Ayer";

  return `Hace ${info.days}d`;
}

export function getZoneReasonLabel(zoneName, sessions = [], referenceDate = DEFAULT_REFERENCE_DATE()) {
  const info = getZoneInfo(zoneName, sessions, referenceDate);

  if (info.cleanedToday) return "Ya realizada hoy";
  if (info.priorityDaily) return "Prioridad diaria";
  if (info.preferredToday) return "Plan del día";
  if (info.pendingInCycle) return "Pendiente del ciclo";
  if (info.days === null) return "Sin registro";
  if (info.freshnessStatus === "urgent") return "Urgente";

  return "Seguimiento";
}