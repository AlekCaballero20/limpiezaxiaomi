/* ─────────────────────────────────────────────
   CLEANING CYCLE UTILS — Musicala Tracker
   Lógica de ciclo, prioridad diaria y sugerencias
───────────────────────────────────────────── */

import {
  CLEANING_CYCLE,
  WEEKDAY_URGENCY,
  PRIORITY_DAILY_ZONES,
  PRIORITY_DAILY_ZONE_NOTE,
  getNextStageId,
  getStageConfig,
  getStageIndex,
  getXiaomiPreset,
  getDailyCleaningStrategy,
  doesCleaningCoverStage,
  getSessionCycleStatus,
  normalizeCleaningType,
  getCleaningTypeLabel,
  getSuggestionReason
} from "../config/cleaning.config.js";

import { MAPS, ALL_ZONES, getMapById, getMapOfZone } from "../config/maps.config.js";
import { tsToDate } from "./dates.js";
import { statusPriority } from "./status.js";

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

function uniqueZones(zones = []) {
  const seen = new Set();

  return (zones || []).filter(zone => {
    const key = normalizeZoneName(zone);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function zoneEquals(a, b) {
  return normalizeZoneName(a) === normalizeZoneName(b);
}

function getCanonicalZoneName(zoneName) {
  const target = normalizeZoneName(zoneName);
  return ALL_ZONES.find(zone => normalizeZoneName(zone) === target) || zoneName;
}

function hasZone(zoneList = [], zoneName) {
  const target = normalizeZoneName(zoneName);
  return (zoneList || []).some(zone => normalizeZoneName(zone) === target);
}

function isPriorityZone(zoneName) {
  return hasZone(PRIORITY_DAILY_ZONES, zoneName);
}

/* =============================================================================
 * Fechas y sesiones
 * ============================================================================= */

function sessionDate(session = {}) {
  return tsToDate(session.completedAt) || tsToDate(session.startedAt) || new Date(0);
}

function sortSessionsAsc(sessions = []) {
  return [...(sessions || [])].sort((a, b) => sessionDate(a).getTime() - sessionDate(b).getTime());
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

function daysSinceDate(value, referenceDate = new Date()) {
  const date = tsToDate(value);
  const reference = startOfDay(referenceDate);
  if (!date || !reference) return null;

  const dateStart = startOfDay(date);
  return Math.floor((reference.getTime() - dateStart.getTime()) / 86400000);
}

function sessionHasZone(session = {}, zoneName) {
  return (session.zones || []).some(zone => zoneEquals(zone, zoneName));
}

export function getSessionsForDate(sessions = [], date = new Date()) {
  return (sessions || []).filter(session => isSameCalendarDay(sessionDate(session), date));
}

export function getZonesCleanedOnDate(sessions = [], date = new Date()) {
  const cleaned = new Set();

  getSessionsForDate(sessions, date).forEach(session => {
    uniqueZones(session.zones || []).forEach(zone => {
      cleaned.add(normalizeZoneName(zone));
    });
  });

  return cleaned;
}

export function wasZoneCleanedOnDate(zoneName, sessions = [], date = new Date()) {
  const cleanedToday = getZonesCleanedOnDate(sessions, date);
  return cleanedToday.has(normalizeZoneName(zoneName));
}

export function getLastCleanedForZone(zoneName, sessions = []) {
  const hits = (sessions || []).filter(session => sessionHasZone(session, zoneName));
  if (!hits.length) return null;

  return hits.reduce((latest, session) => {
    const current = sessionDate(session);
    return current > latest ? current : latest;
  }, new Date(0));
}

function getZoneAge(zoneName, sessions = [], referenceDate = new Date()) {
  return daysSinceDate(getLastCleanedForZone(zoneName, sessions), referenceDate);
}

/* =============================================================================
 * Tipo/intensidad de limpieza
 * ============================================================================= */

export function inferCleaningTypeFromXiaomi(xiaomi = {}) {
  const trajectory = normalizeCleaningType(xiaomi.trayectoria || "");
  const times = Number(xiaomi.veces || 1);

  const suction = String(xiaomi.succion || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const mode = String(xiaomi.modo || "").trim().toLowerCase();
  const water = String(xiaomi.agua || "").trim().toLowerCase();

  if (
    trajectory === "profundo" ||
    times >= 2 ||
    suction === "turbo" ||
    water === "nivel3" ||
    mode === "aspirar-fregar"
  ) {
    return "profundo";
  }

  if (trajectory === "rapido" || suction === "silencioso") {
    return "rapido";
  }

  if (mode || suction || trajectory || water || times) {
    return "estandar";
  }

  return "estandar";
}

export function getSessionCleaningType(session = {}) {
  const explicitType = session.cleaningType || session.cleaningMode || session.type;
  if (explicitType) return normalizeCleaningType(explicitType);

  return inferCleaningTypeFromXiaomi(session.xiaomi || {});
}

export function doesSessionCountForStage(session, stage) {
  const stageId = typeof stage === "string" ? stage : stage?.id;
  if (!session || !stageId) return false;

  const sessionCleaningType = getSessionCleaningType(session);

  return doesCleaningCoverStage(sessionCleaningType, stageId);
}

/* =============================================================================
 * Progreso de ciclo
 * ============================================================================= */

function createProgress(stageId) {
  const stage = getStageConfig(stageId);

  return {
    stage,
    coveredZones: new Set(),
    contributingSessionIds: [],
    manualSessionIds: [],
    lowerIntensitySessionIds: []
  };
}

function summarizeProgress(progress) {
  const targetZones = progress.stage.targetZones || ALL_ZONES;

  const coveredZones = targetZones.filter(zone =>
    progress.coveredZones.has(normalizeZoneName(zone))
  );

  const pendingZones = targetZones.filter(zone =>
    !progress.coveredZones.has(normalizeZoneName(zone))
  );

  const pendingMaps = MAPS.map(map => {
    const pending = map.zones.filter(zone =>
      pendingZones.some(item => zoneEquals(item, zone))
    );

    return pending.length ? { ...map, pendingZones: pending } : null;
  }).filter(Boolean);

  return {
    stage: progress.stage,
    totalZones: targetZones.length,
    coveredZones,
    pendingZones,
    pendingMaps,
    completed: pendingZones.length === 0,
    percent: targetZones.length
      ? Math.round((coveredZones.length / targetZones.length) * 100)
      : 0,
    contributingSessionIds: [...progress.contributingSessionIds],
    manualSessionIds: [...progress.manualSessionIds],
    lowerIntensitySessionIds: [...progress.lowerIntensitySessionIds]
  };
}

function replayCycle(sessions = []) {
  let cycleNumber = 1;
  let stageId = CLEANING_CYCLE.stages[0].id;
  let progress = createProgress(stageId);
  const stagesCompleted = [];

  sortSessionsAsc(sessions).forEach(session => {
    const cleaningType = getSessionCleaningType(session);

    const countsForStage = doesSessionCountForStage(
      { ...session, cleaningType },
      stageId
    );

    if (countsForStage) {
      uniqueZones(session.zones || []).forEach(zone => {
        progress.coveredZones.add(normalizeZoneName(zone));
      });

      if (session.id) progress.contributingSessionIds.push(session.id);
    } else if (session.id) {
      progress.manualSessionIds.push(session.id);
      progress.lowerIntensitySessionIds.push(session.id);
    }

    const summary = summarizeProgress(progress);
    if (!summary.completed) return;

    stagesCompleted.push({
      cycleNumber,
      stage: progress.stage,
      completedAt: session.completedAt || session.startedAt || null
    });

    stageId = getNextStageId(stageId);

    if (getStageIndex(stageId) === 0) {
      cycleNumber += 1;
    }

    progress = createProgress(stageId);
  });

  return {
    cycleNumber,
    stageId,
    progress,
    stagesCompleted
  };
}

export function getStageProgress(sessions = [], stage) {
  const current = replayCycle(sessions);
  const stageId = typeof stage === "string" ? stage : stage?.id || current.stageId;

  if (normalizeCleaningType(stageId) === normalizeCleaningType(current.stageId)) {
    return summarizeProgress(current.progress);
  }

  const progress = createProgress(stageId);

  sortSessionsAsc(sessions).forEach(session => {
    if (!doesSessionCountForStage(session, stageId)) return;

    uniqueZones(session.zones || []).forEach(zone => {
      progress.coveredZones.add(normalizeZoneName(zone));
    });

    if (session.id) progress.contributingSessionIds.push(session.id);
  });

  return summarizeProgress(progress);
}

export function getCurrentStage(sessions = [], date = new Date()) {
  const state = getCurrentCycleState(sessions, date);
  return state.currentStage;
}

/* Memoria del estado de ciclo.
   getZoneInfo() lo pide una vez por zona, asi que un render de
   estadisticas llegaba a recalcularlo unas 60 veces con el mismo
   resultado. El calculo solo depende de las sesiones y del dia
   calendario (no de la hora), asi que se cachea por esas dos claves.
   La longitud entra en la clave porque addSession() muta el array
   en sitio y la referencia no cambia. */
const cycleStateCache = new WeakMap();

export function getCurrentCycleState(sessions = [], date = new Date()) {
  const parsedDate = tsToDate(date) || new Date(date);
  const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  const dayKey = new Date(
    safeDate.getFullYear(),
    safeDate.getMonth(),
    safeDate.getDate()
  ).getTime();

  const canCache = Array.isArray(sessions);
  const cacheKey = `${dayKey}:${canCache ? sessions.length : 0}`;

  if (canCache) {
    let perSessions = cycleStateCache.get(sessions);

    if (perSessions && perSessions.has(cacheKey)) {
      return perSessions.get(cacheKey);
    }

    const state = computeCurrentCycleState(sessions, safeDate);

    if (!perSessions) {
      perSessions = new Map();
      cycleStateCache.set(sessions, perSessions);
    }

    perSessions.set(cacheKey, state);

    return state;
  }

  return computeCurrentCycleState(sessions, safeDate);
}

function computeCurrentCycleState(sessions, safeDate) {
  const replay = replayCycle(sessions);
  const progress = summarizeProgress(replay.progress);
  const dailyStrategy = getDailyCleaningStrategy(safeDate);
  const weekdayNote = WEEKDAY_URGENCY[safeDate.getDay()] || dailyStrategy.note || "";
  const cleanedToday = getZonesCleanedOnDate(sessions, safeDate);

  return {
    cycleId: CLEANING_CYCLE.id,
    cycleName: CLEANING_CYCLE.name,
    cycleNumber: replay.cycleNumber,
    currentStage: progress.stage,
    progress,
    stagesCompleted: replay.stagesCompleted,
    weekdayNote,
    dailyStrategy,
    cleanedToday: [...cleanedToday],
    cleanedTodayCount: cleanedToday.size,
    xiaomi: getXiaomiPreset(progress.stage.id)
  };
}

/* =============================================================================
 * Ranking y sugerencias
 * ============================================================================= */

function buildZoneInfo(zoneName, sessions = [], date = new Date()) {
  const map = getMapOfZone(zoneName);
  const lastCleaned = getLastCleanedForZone(zoneName, sessions);
  const days = daysSinceDate(lastCleaned, date);
  const cleanedToday = wasZoneCleanedOnDate(zoneName, sessions, date);

  return {
    name: getCanonicalZoneName(zoneName),
    mapId: map?.id ?? null,
    mapName: map?.name ?? null,
    mapLabel: map?.label ?? null,
    mapColor: map?.color ?? "#ccc",
    lastCleaned,
    days,
    cleanedToday,
    priorityDaily: isPriorityZone(zoneName)
  };
}

function sortZonesByNeed(zones = [], sessions = [], date = new Date()) {
  return uniqueZones(zones)
    .map(zone => buildZoneInfo(zone, sessions, date))
    .sort((a, b) => {
      if (a.cleanedToday !== b.cleanedToday) return a.cleanedToday ? 1 : -1;
      if (a.priorityDaily !== b.priorityDaily) return a.priorityDaily ? -1 : 1;

      return statusPriority(b.days) - statusPriority(a.days);
    });
}

function firstAvailableZones(zones = [], sessions = [], date = new Date(), limit = 3) {
  return sortZonesByNeed(zones, sessions, date)
    .filter(zone => !zone.cleanedToday)
    .slice(0, limit)
    .map(zone => zone.name);
}

function getOldestAvailableZones(sessions = [], date = new Date(), limit = 3, restrictToMapId = null) {
  const sourceZones = restrictToMapId
    ? getMapById(restrictToMapId)?.zones || []
    : ALL_ZONES;

  return sortZonesByNeed(sourceZones, sessions, date)
    .filter(zone => !zone.cleanedToday)
    .slice(0, limit)
    .map(zone => zone.name);
}

function getPendingCycleZonesForMap(map, pendingZones = []) {
  if (!map) return [];
  if (!pendingZones?.length) return [...map.zones];

  return map.zones.filter(zone => hasZone(pendingZones, zone));
}

function resolveSuggestionReason(reasonId, fallback = "cyclePending") {
  return getSuggestionReason(reasonId || fallback);
}

function createRecommendationFromZones({
  zones,
  sessions,
  date,
  state,
  map = null,
  reasonId = "cyclePending",
  planNote = "",
  limit = 3
}) {
  const cleanZones = uniqueZones(zones || []).slice(0, limit);
  if (!cleanZones.length) return null;

  const resolvedMap = map || getMapOfZone(cleanZones[0]);
  if (!resolvedMap) return null;

  const zoneInfos = sortZonesByNeed(cleanZones, sessions, date);

  const oldest = zoneInfos.sort(
    (a, b) => statusPriority(b.days) - statusPriority(a.days)
  )[0];

  const reason = resolveSuggestionReason(reasonId);

  return {
    ...resolvedMap,
    targetZones: cleanZones,
    days: oldest?.days ?? null,
    planTitle: `Etapa ${state.currentStage.label}`,
    planNote: planNote || reason.description || state.currentStage.description,
    reasonId: reason.id,
    reasonLabel: reason.label,
    reasonDescription: reason.description,
    dailyStrategy: state.dailyStrategy,
    xiaomi: state.xiaomi,
    cleaningType: state.currentStage.id,
    cleaningTypeLabel: getCleaningTypeLabel(state.currentStage.id),
    countsForCycle: true,
    cleanedToday: cleanZones.every(zone => wasZoneCleanedOnDate(zone, sessions, date))
  };
}

function getPriorityDailyRecommendation(sessions = [], date = new Date(), state) {
  const zones = firstAvailableZones(PRIORITY_DAILY_ZONES, sessions, date, 3);

  return createRecommendationFromZones({
    zones,
    sessions,
    date,
    state,
    reasonId: "priorityDaily",
    planNote: PRIORITY_DAILY_ZONE_NOTE,
    limit: 3
  });
}

function getDailyPlanRecommendation(sessions = [], date = new Date(), state) {
  const strategy = state.dailyStrategy || getDailyCleaningStrategy(date);
  const zones = firstAvailableZones(strategy.preferredZones || [], sessions, date, 3);

  return createRecommendationFromZones({
    zones,
    sessions,
    date,
    state,
    reasonId: "dailyPlan",
    planNote: strategy.note,
    limit: 3
  });
}

function getCyclePendingRecommendation(sessions = [], date = new Date(), state) {
  const zones = firstAvailableZones(state.progress.pendingZones || [], sessions, date, 3);

  return createRecommendationFromZones({
    zones,
    sessions,
    date,
    state,
    reasonId: "cyclePending",
    planNote: state.currentStage.description,
    limit: 3
  });
}

function getOldestZoneRecommendation(sessions = [], date = new Date(), state) {
  const zones = getOldestAvailableZones(sessions, date, 3);

  return createRecommendationFromZones({
    zones,
    sessions,
    date,
    state,
    reasonId: "oldestZone",
    planNote: "No hay prioridad diaria pendiente. Sigue con las zonas más antiguas.",
    limit: 3
  });
}

function getRecommendationForMap(map, sessions = [], date = new Date(), state) {
  if (!map) return null;

  const priorityZones = firstAvailableZones(
    map.zones.filter(zone => isPriorityZone(zone)),
    sessions,
    date,
    3
  );

  if (priorityZones.length) {
    return createRecommendationFromZones({
      zones: priorityZones,
      sessions,
      date,
      state,
      map,
      reasonId: "priorityDaily",
      planNote: PRIORITY_DAILY_ZONE_NOTE,
      limit: 3
    });
  }

  const dailyZones = firstAvailableZones(
    (state.dailyStrategy?.preferredZones || []).filter(zone => hasZone(map.zones, zone)),
    sessions,
    date,
    3
  );

  if (dailyZones.length) {
    return createRecommendationFromZones({
      zones: dailyZones,
      sessions,
      date,
      state,
      map,
      reasonId: "dailyPlan",
      planNote: state.dailyStrategy?.note || state.weekdayNote,
      limit: 3
    });
  }

  const pendingZones = firstAvailableZones(
    getPendingCycleZonesForMap(map, state.progress.pendingZones),
    sessions,
    date,
    3
  );

  if (pendingZones.length) {
    return createRecommendationFromZones({
      zones: pendingZones,
      sessions,
      date,
      state,
      map,
      reasonId: "cyclePending",
      planNote: state.currentStage.description,
      limit: 3
    });
  }

  const oldestZones = getOldestAvailableZones(sessions, date, 3, map.id);

  return createRecommendationFromZones({
    zones: oldestZones,
    sessions,
    date,
    state,
    map,
    reasonId: "oldestZone",
    planNote: "Mapa sin pendientes prioritarios. Se sugieren las zonas más antiguas.",
    limit: 3
  });
}

export function getNextRecommendedMap(sessions = [], date = new Date()) {
  const state = getCurrentCycleState(sessions, date);

  const recommendation =
    getPriorityDailyRecommendation(sessions, date, state) ||
    getDailyPlanRecommendation(sessions, date, state) ||
    getCyclePendingRecommendation(sessions, date, state) ||
    getOldestZoneRecommendation(sessions, date, state);

  return recommendation;
}

export function getNextRecommendedByMap(sessions = [], date = new Date()) {
  const state = getCurrentCycleState(sessions, date);

  return MAPS.map(map => getRecommendationForMap(map, sessions, date, state))
    .filter(Boolean)
    .sort((a, b) => {
      const reasonWeight = {
        priorityDaily: 4,
        dailyPlan: 3,
        cyclePending: 2,
        oldestZone: 1
      };

      const aWeight = reasonWeight[a.reasonId] || 0;
      const bWeight = reasonWeight[b.reasonId] || 0;

      if (aWeight !== bWeight) return bWeight - aWeight;

      return statusPriority(b.days) - statusPriority(a.days);
    });
}

/* =============================================================================
 * Metadata para guardar sesiones
 * ============================================================================= */

export function getSessionCycleMeta(session = {}, sessionsBefore = []) {
  const date = sessionDate(session);
  const state = getCurrentCycleState(sessionsBefore, date);
  const cleaningType = getSessionCleaningType(session);

  const countsForCycle = doesSessionCountForStage(
    { ...session, cleaningType },
    state.currentStage
  );

  const cycleStatus = getSessionCycleStatus(cleaningType, state.currentStage.id);
  const nextRecommended = getNextRecommendedMap(sessionsBefore, date);
  const wasRecommendedMap = Number(session.mapId) === Number(nextRecommended?.id);

  const cleanedTodayBefore = uniqueZones(session.zones || []).some(zone =>
    wasZoneCleanedOnDate(zone, sessionsBefore, date)
  );

  let recommendationSource = "manual";

  if (countsForCycle && wasRecommendedMap) {
    recommendationSource = "recomendada";
  } else if (countsForCycle) {
    recommendationSource = "cuenta-para-etapa";
  } else if (cleanedTodayBefore) {
    recommendationSource = "realizada-hoy";
  } else {
    recommendationSource = "manual-fuera-de-etapa";
  }

  return {
    cleaningType,
    cleaningTypeLabel: getCleaningTypeLabel(cleaningType),
    cycleNumber: state.cycleNumber,
    cycleStage: state.currentStage.id,
    cycleStageLabel: state.currentStage.label,
    countsForCycle,
    countsForStage: countsForCycle,
    cycleStatusId: cycleStatus.id,
    cycleStatusLabel: cycleStatus.label,
    cycleStatusDescription: cycleStatus.description,
    recommendationSource,
    wasRecommendedMap,
    cleanedTodayBefore
  };
}

export function getSessionCycleLabel(session = {}, sessionsBefore = []) {
  const meta = session.cycleStatusLabel
    ? session
    : getSessionCycleMeta(session, sessionsBefore);

  return meta.cycleStatusLabel || (meta.countsForCycle ? "Cuenta para etapa" : "Realizada hoy");
}

export function getCycleLabel(state) {
  if (!state) return CLEANING_CYCLE.name;
  return `${state.cycleName || CLEANING_CYCLE.name} ${state.cycleNumber || 1}`;
}

/* =============================================================================
 * Helpers útiles para vistas futuras
 * ============================================================================= */

export function getDailySuggestionContext(sessions = [], date = new Date()) {
  const state = getCurrentCycleState(sessions, date);
  const main = getNextRecommendedMap(sessions, date);
  const byMap = getNextRecommendedByMap(sessions, date);

  return {
    state,
    main,
    secondary: byMap.filter(item => item.id !== main?.id).slice(0, 3),
    cleanedToday: state.cleanedToday,
    dailyStrategy: state.dailyStrategy
  };
}

export function getZoneSuggestionMeta(zoneName, sessions = [], date = new Date()) {
  const info = buildZoneInfo(zoneName, sessions, date);
  const state = getCurrentCycleState(sessions, date);
  const isPendingInCycle = hasZone(state.progress.pendingZones, zoneName);
  const isPreferredToday = hasZone(state.dailyStrategy?.preferredZones || [], zoneName);

  return {
    ...info,
    isPendingInCycle,
    isPreferredToday,
    shouldSuggest:
      !info.cleanedToday &&
      (
        info.priorityDaily ||
        isPreferredToday ||
        isPendingInCycle ||
        info.days === null ||
        info.days >= 3
      )
  };
}
/* =============================================================================
 * Metadatos de ciclo: version rapida
 *
 * getSessionCycleMeta() recorre todas las sesiones anteriores, asi que
 * calcularlo para cada sesion del historial cuesta O(n^2). Estas dos ayudas
 * evitan la mayor parte de ese trabajo:
 *
 *  - Las sesiones guardadas por la app ya llevan los metadatos persistidos:
 *    en ese caso no hay nada que inferir.
 *  - Para las antiguas, el resultado se memoiza por objeto de sesion, de modo
 *    que filtrar o volver a pintar el historial no lo recalcula.
 * ============================================================================= */

const PERSISTED_META_FIELDS = [
  "cleaningType",
  "cleaningTypeLabel",
  "countsForCycle",
  "recommendationSource",
  "cycleStage",
  "cycleStatusLabel"
];

export function hasPersistedCycleMeta(session) {
  if (!session || typeof session !== "object") return false;

  return PERSISTED_META_FIELDS.every(field => {
    return session[field] !== undefined && session[field] !== null;
  });
}

const cycleMetaCache = new WeakMap();

/**
 * Igual que getSessionCycleMeta, pero sin recalcular lo que ya se sabe.
 *
 * @param {object} session
 * @param {Array|Function} sessionsBefore Array de sesiones anteriores, o una
 *   funcion que lo devuelve. Si es funcion solo se invoca cuando hace falta
 *   inferir de verdad, para no construir la lista en vano.
 */
export function getSessionCycleMetaCached(session, sessionsBefore = []) {
  if (!session || typeof session !== "object") {
    return getSessionCycleMeta(session, resolveSessionsBefore(sessionsBefore));
  }

  /* Ya trae todos los campos: la propia sesion sirve como metadato.
     Los consumidores leen `session.X || meta.X`, asi que el resultado
     es identico al inferido. */
  if (hasPersistedCycleMeta(session)) return session;

  const cached = cycleMetaCache.get(session);
  if (cached) return cached;

  const meta = getSessionCycleMeta(session, resolveSessionsBefore(sessionsBefore));
  cycleMetaCache.set(session, meta);

  return meta;
}

function resolveSessionsBefore(sessionsBefore) {
  return typeof sessionsBefore === "function" ? sessionsBefore() : (sessionsBefore || []);
}

/**
 * Construye un resolutor de "sesiones anteriores a esta" que ordena una sola
 * vez y luego corta por busqueda binaria, en vez de reordenar la lista entera
 * por cada sesion. Equivale a filtrar por `fecha < fecha de la sesion`.
 */
export function createSessionsBeforeResolver(sessions = [], getDate) {
  const toTime = session => {
    const date = getDate ? getDate(session) : sessionDate(session);
    const time = date instanceof Date ? date.getTime() : NaN;
    return Number.isNaN(time) ? 0 : time;
  };

  const sorted = [...sessions].sort((a, b) => toTime(a) - toTime(b));
  const times = sorted.map(toTime);
  const cache = new Map();

  return function getSessionsBefore(session) {
    const time = toTime(session);

    if (cache.has(time)) return cache.get(time);

    let low = 0;
    let high = times.length;

    while (low < high) {
      const mid = (low + high) >> 1;
      if (times[mid] < time) low = mid + 1;
      else high = mid;
    }

    const result = sorted.slice(0, low);
    cache.set(time, result);

    return result;
  };
}
