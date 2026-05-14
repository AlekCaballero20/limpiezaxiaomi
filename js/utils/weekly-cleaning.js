import {
  getCleaningIntensity,
  getCleaningTypeLabel,
  getXiaomiPreset,
  normalizeCleaningType
} from "../config/cleaning.config.js";
import { ALL_ZONES, MAPS, getMapOfZone } from "../config/maps.config.js";
import { tsToDate } from "./dates.js";
import { getSessionCleaningType, normalizeZoneName } from "./cleaning-cycle.js";

export const WEEKLY_ZONE_TARGETS = {
  profundo: 2,
  estandar: 1,
  rapido: 1
};

export const DAILY_VISIBLE_ZONES = [
  "Recepcion",
  "Pasillo 1er piso",
  "Pasillo 2do piso",
  "Corredor lockers",
  "Cafeteria"
];

const WEEKLY_TYPES = ["profundo", "estandar", "rapido"];

function safeDate(value = new Date()) {
  const date = tsToDate(value) || new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function sessionDate(session = {}) {
  return tsToDate(session.completedAt) || tsToDate(session.startedAt) || new Date(0);
}

function startOfDay(value = new Date()) {
  const date = safeDate(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function sortSessionsAsc(sessions = []) {
  return [...(sessions || [])].sort((a, b) => sessionDate(a).getTime() - sessionDate(b).getTime());
}

function canonicalZoneName(zoneName) {
  const target = normalizeZoneName(zoneName);
  return ALL_ZONES.find(zone => normalizeZoneName(zone) === target) || zoneName;
}

function hasZone(zones = [], zoneName) {
  const target = normalizeZoneName(zoneName);
  return (zones || []).some(zone => normalizeZoneName(zone) === target);
}

function sessionCoversType(sessionType, requiredType) {
  return getCleaningIntensity(sessionType) >= getCleaningIntensity(requiredType);
}

function createEmptyCounts() {
  return WEEKLY_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});
}

function getPreferredAssignedType(session = {}, actualType, zoneStatus) {
  const requestedType =
    session.weeklyTargetType ||
    session.recommendedCleaningType ||
    session.suggestedCleaningType ||
    session.recommendationCleaningType;

  const normalizedRequestedType = requestedType ? normalizeCleaningType(requestedType) : null;

  if (
    normalizedRequestedType &&
    sessionCoversType(actualType, normalizedRequestedType) &&
    zoneStatus.counts[normalizedRequestedType] < WEEKLY_ZONE_TARGETS[normalizedRequestedType]
  ) {
    return normalizedRequestedType;
  }

  if (
    zoneStatus.counts[actualType] !== undefined &&
    zoneStatus.counts[actualType] < WEEKLY_ZONE_TARGETS[actualType]
  ) {
    return actualType;
  }

  return WEEKLY_TYPES
    .filter(type => zoneStatus.counts[type] !== undefined)
    .find(type =>
      sessionCoversType(actualType, type) &&
      zoneStatus.counts[type] < WEEKLY_ZONE_TARGETS[type]
    ) || null;
}

function zoneWeeklyComplete(zoneStatus) {
  return WEEKLY_TYPES.every(type => zoneStatus.counts[type] >= WEEKLY_ZONE_TARGETS[type]);
}

function buildZoneStatus(zoneName) {
  const map = getMapOfZone(zoneName);
  return {
    zoneName,
    name: zoneName,
    mapId: map?.id ?? null,
    mapName: map?.name ?? "Sin mapa",
    mapLabel: map?.label ?? "",
    mapColor: map?.color ?? "#ccc",
    targets: { ...WEEKLY_ZONE_TARGETS },
    counts: createEmptyCounts(),
    assignedSessions: [],
    completed: false,
    suggestedType: "profundo",
    suggestedLabel: getCleaningTypeLabel("profundo"),
    missingTypes: [...WEEKLY_TYPES]
  };
}

function finalizeZoneStatus(zoneStatus) {
  const missingTypes = WEEKLY_TYPES.filter(
    type => zoneStatus.counts[type] < WEEKLY_ZONE_TARGETS[type]
  );

  const suggestedType = getRecommendedCleaningTypeForZone({
    ...zoneStatus,
    missingTypes
  });

  return {
    ...zoneStatus,
    completed: missingTypes.length === 0,
    missingTypes,
    suggestedType,
    suggestedLabel: getCleaningTypeLabel(suggestedType)
  };
}

export function getWeekRange(date = new Date()) {
  const current = startOfDay(date);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(current);
  start.setDate(current.getDate() + mondayOffset);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getSessionsForWeek(sessions = [], date = new Date()) {
  const { start, end } = getWeekRange(date);

  return (sessions || []).filter(session => {
    const dateValue = sessionDate(session);
    return dateValue >= start && dateValue <= end;
  });
}

export function getDailyVisibleStatus(sessions = [], date = new Date()) {
  const todaySessions = (sessions || []).filter(session => sameDay(sessionDate(session), date));

  const zones = DAILY_VISIBLE_ZONES.map(zoneName => {
    const session = todaySessions.find(item =>
      hasZone(item.zones || [], zoneName) &&
      sessionCoversType(getSessionCleaningType(item), "rapido")
    );

    const map = getMapOfZone(zoneName);

    return {
      zoneName,
      name: zoneName,
      mapId: map?.id ?? null,
      mapName: map?.name ?? "Sin mapa",
      mapLabel: map?.label ?? "",
      mapColor: map?.color ?? "#ccc",
      done: Boolean(session),
      sessionId: session?.id || null,
      cleaningType: session ? getSessionCleaningType(session) : null
    };
  });

  const done = zones.filter(zone => zone.done);

  return {
    date: startOfDay(date),
    zones,
    doneZones: done,
    pendingZones: zones.filter(zone => !zone.done),
    doneCount: done.length,
    total: zones.length,
    completed: done.length === zones.length
  };
}

export function getWeeklyZoneLedger(sessions = [], date = new Date()) {
  const ledger = new Map(
    ALL_ZONES.map(zone => [normalizeZoneName(zone), buildZoneStatus(zone)])
  );

  sortSessionsAsc(getSessionsForWeek(sessions, date)).forEach(session => {
    const actualType = getSessionCleaningType(session);

    (session.zones || []).forEach(rawZoneName => {
      const zoneName = canonicalZoneName(rawZoneName);
      const key = normalizeZoneName(zoneName);
      const zoneStatus = ledger.get(key);
      if (!zoneStatus) return;

      const assignedType = getPreferredAssignedType(session, actualType, zoneStatus);
      if (!assignedType) return;

      zoneStatus.counts[assignedType] += 1;
      zoneStatus.assignedSessions.push({
        sessionId: session.id || null,
        completedAt: session.completedAt || session.startedAt || null,
        actualType,
        assignedType,
        zoneName
      });
    });
  });

  const zones = [...ledger.values()].map(finalizeZoneStatus);
  const completeZones = zones.filter(zone => zone.completed);
  const pendingZones = zones.filter(zone => !zone.completed);

  return {
    week: getWeekRange(date),
    targets: { ...WEEKLY_ZONE_TARGETS },
    zones,
    completeZones,
    pendingZones,
    totalZones: zones.length,
    completeCount: completeZones.length,
    pendingCount: pendingZones.length,
    completed: pendingZones.length === 0
  };
}

export function getZoneWeeklyStatus(zoneName, sessions = [], date = new Date()) {
  const target = normalizeZoneName(zoneName);
  return getWeeklyZoneLedger(sessions, date).zones.find(zone =>
    normalizeZoneName(zone.zoneName) === target
  ) || finalizeZoneStatus(buildZoneStatus(canonicalZoneName(zoneName)));
}

export function getRecommendedCleaningTypeForZone(zoneStatus = {}) {
  const counts = zoneStatus.counts || {};
  const missingTypes = zoneStatus.missingTypes || WEEKLY_TYPES.filter(
    type => (counts[type] || 0) < WEEKLY_ZONE_TARGETS[type]
  );

  return missingTypes[0] || "rapido";
}

function buildRecommendationFromZone(zone, reasonId, reasonLabel) {
  if (!zone) return null;

  const cleaningType = getRecommendedCleaningTypeForZone(zone);

  return {
    id: zone.mapId,
    mapId: zone.mapId,
    name: zone.mapName,
    mapName: zone.mapName,
    mapLabel: zone.mapLabel,
    mapColor: zone.mapColor,
    targetZones: [zone.zoneName],
    cleaningType,
    cleaningTypeLabel: getCleaningTypeLabel(cleaningType),
    weeklyTargetType: cleaningType,
    xiaomi: getXiaomiPreset(cleaningType),
    reasonId,
    reasonLabel,
    planTitle: reasonLabel,
    planNote: `${zone.zoneName} necesita ${getCleaningTypeLabel(cleaningType).toLowerCase()} para cumplir la semana.`,
    completed: false
  };
}

export function getNextWeeklyRecommendations(sessions = [], date = new Date()) {
  const daily = getDailyVisibleStatus(sessions, date);

  if (!daily.completed) {
    const pendingByMap = daily.pendingZones.reduce((acc, zone) => {
      if (!acc.has(zone.mapId)) acc.set(zone.mapId, []);
      acc.get(zone.mapId).push(zone);
      return acc;
    }, new Map());

    const firstMapZones = [...pendingByMap.values()][0] || [];
    const map = MAPS.find(item => Number(item.id) === Number(firstMapZones[0]?.mapId));

    return {
      main: {
        id: map?.id ?? firstMapZones[0]?.mapId ?? null,
        mapId: map?.id ?? firstMapZones[0]?.mapId ?? null,
        name: map?.name || "Rutina visible",
        mapName: map?.name || "Rutina visible",
        mapLabel: map?.label || "",
        mapColor: map?.color || "#ccc",
        targetZones: firstMapZones.map(zone => zone.zoneName),
        cleaningType: "rapido",
        cleaningTypeLabel: getCleaningTypeLabel("rapido"),
        weeklyTargetType: "rapido",
        xiaomi: getXiaomiPreset("rapido"),
        reasonId: "dailyVisible",
        reasonLabel: "Rutina diaria visible",
        planTitle: "Rutina diaria visible",
        planNote: "Primero cubre las zonas visibles pendientes de hoy. Una limpieza estandar o profunda tambien cuenta.",
        completed: false
      },
      daily,
      weekly: getWeeklyZoneLedger(sessions, date)
    };
  }

  const weekly = getWeeklyZoneLedger(sessions, date);
  const debt = weekly.pendingZones
    .slice()
    .sort((a, b) => {
      if (a.mapId !== b.mapId) return Number(a.mapId) - Number(b.mapId);
      return WEEKLY_TYPES.indexOf(a.suggestedType) - WEEKLY_TYPES.indexOf(b.suggestedType);
    });

  return {
    main: buildRecommendationFromZone(debt[0], "weeklyDebt", "Deuda semanal"),
    daily,
    weekly
  };
}
