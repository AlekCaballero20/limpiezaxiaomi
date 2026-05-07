import { CLEANING_CYCLE, WEEKDAY_URGENCY, getNextStageId, getStageConfig, getStageIndex, getXiaomiPreset } from "../config/cleaning.config.js";
import { MAPS, ALL_ZONES, getMapById } from "../config/maps.config.js";
import { tsToDate } from "./dates.js";
import { statusPriority } from "./status.js";

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

function uniqueZones(zones = []) {
  const seen = new Set();
  return zones.filter(zone => {
    const key = normalizeZoneName(zone);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sessionDate(session) {
  return tsToDate(session.completedAt) || tsToDate(session.startedAt) || new Date(0);
}

function sortSessionsAsc(sessions = []) {
  return [...sessions].sort((a, b) => sessionDate(a).getTime() - sessionDate(b).getTime());
}

export function inferCleaningTypeFromXiaomi(xiaomi = {}) {
  const trajectory = xiaomi.trayectoria || "";
  const times = Number(xiaomi.veces || 1);
  const suction = xiaomi.succion || "";
  const mode = xiaomi.modo || "";
  const water = xiaomi.agua || "";

  if (trajectory === "profundo" || times >= 2 || suction === "turbo" || water === "nivel3") return "profundo";
  if (trajectory === "rapido" || suction === "silencioso") return "rapido";
  if (mode || suction || trajectory || water || times) return "estandar";
  return "estandar";
}

export function getSessionCleaningType(session = {}) {
  return session.cleaningType || session.cleaningMode || inferCleaningTypeFromXiaomi(session.xiaomi || {});
}

export function doesSessionCountForStage(session, stage) {
  const stageId = typeof stage === "string" ? stage : stage?.id;
  if (!session || !stageId) return false;
  return getSessionCleaningType(session) === stageId;
}

function createProgress(stageId) {
  const stage = getStageConfig(stageId);
  return {
    stage,
    coveredZones: new Set(),
    contributingSessionIds: [],
    manualSessionIds: []
  };
}

function summarizeProgress(progress) {
  const targetZones = progress.stage.targetZones || ALL_ZONES;
  const coveredZones = targetZones.filter(zone => progress.coveredZones.has(normalizeZoneName(zone)));
  const pendingZones = targetZones.filter(zone => !progress.coveredZones.has(normalizeZoneName(zone)));
  const pendingMaps = MAPS.map(map => {
    const pending = map.zones.filter(zone => pendingZones.some(item => normalizeZoneName(item) === normalizeZoneName(zone)));
    return pending.length ? { ...map, pendingZones: pending } : null;
  }).filter(Boolean);

  return {
    stage: progress.stage,
    totalZones: targetZones.length,
    coveredZones,
    pendingZones,
    pendingMaps,
    completed: pendingZones.length === 0,
    percent: targetZones.length ? Math.round((coveredZones.length / targetZones.length) * 100) : 0,
    contributingSessionIds: [...progress.contributingSessionIds],
    manualSessionIds: [...progress.manualSessionIds]
  };
}

function replayCycle(sessions = []) {
  let cycleNumber = 1;
  let stageId = CLEANING_CYCLE.stages[0].id;
  let progress = createProgress(stageId);
  const stagesCompleted = [];

  sortSessionsAsc(sessions).forEach(session => {
    if (doesSessionCountForStage(session, stageId)) {
      uniqueZones(session.zones || []).forEach(zone => progress.coveredZones.add(normalizeZoneName(zone)));
      if (session.id) progress.contributingSessionIds.push(session.id);
    } else if (session.id) {
      progress.manualSessionIds.push(session.id);
    }

    const summary = summarizeProgress(progress);
    if (!summary.completed) return;

    stagesCompleted.push({
      cycleNumber,
      stage: progress.stage,
      completedAt: session.completedAt || session.startedAt || null
    });

    stageId = getNextStageId(stageId);
    if (getStageIndex(stageId) === 0) cycleNumber += 1;
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
  if (stageId === current.stageId) return summarizeProgress(current.progress);

  const progress = createProgress(stageId);
  sortSessionsAsc(sessions).forEach(session => {
    if (!doesSessionCountForStage(session, stageId)) return;
    uniqueZones(session.zones || []).forEach(zone => progress.coveredZones.add(normalizeZoneName(zone)));
    if (session.id) progress.contributingSessionIds.push(session.id);
  });
  return summarizeProgress(progress);
}

export function getCurrentStage(sessions = [], date = new Date()) {
  const state = getCurrentCycleState(sessions, date);
  return state.currentStage;
}

export function getCurrentCycleState(sessions = [], date = new Date()) {
  const replay = replayCycle(sessions);
  const progress = summarizeProgress(replay.progress);
  const weekdayNote = WEEKDAY_URGENCY[date.getDay()] || "";

  return {
    cycleId: CLEANING_CYCLE.id,
    cycleName: CLEANING_CYCLE.name,
    cycleNumber: replay.cycleNumber,
    currentStage: progress.stage,
    progress,
    stagesCompleted: replay.stagesCompleted,
    weekdayNote,
    xiaomi: getXiaomiPreset(progress.stage.id)
  };
}

function getLastCleanedForZone(zoneName, sessions = []) {
  const target = normalizeZoneName(zoneName);
  const hits = sessions.filter(session => (session.zones || []).some(zone => normalizeZoneName(zone) === target));
  if (!hits.length) return null;
  return hits.reduce((latest, session) => {
    const current = sessionDate(session);
    return current > latest ? current : latest;
  }, new Date(0));
}

function daysSince(value) {
  const date = tsToDate(value);
  if (!date) return null;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((todayStart - dateStart) / 86400000);
}

function rankMapByPending(map, sessions, pendingZones) {
  const targetZones = pendingZones?.length ? pendingZones : map.zones;
  const pending = map.zones.filter(zone => targetZones.some(item => normalizeZoneName(item) === normalizeZoneName(zone)));
  const oldest = (pending.length ? pending : map.zones)
    .map(zone => ({ zone, days: daysSince(getLastCleanedForZone(zone, sessions)) }))
    .sort((a, b) => statusPriority(b.days) - statusPriority(a.days))[0] || null;

  return {
    ...map,
    targetZones: pending.length ? pending : map.zones.slice(0, 2),
    days: oldest?.days ?? null
  };
}

export function getNextRecommendedMap(sessions = []) {
  const state = getCurrentCycleState(sessions);
  const pendingZones = state.progress.pendingZones;
  const ranked = MAPS.map(map => rankMapByPending(map, sessions, pendingZones))
    .filter(map => map.targetZones.length)
    .sort((a, b) => statusPriority(b.days) - statusPriority(a.days));

  const first = ranked[0] || null;
  if (!first) return null;

  return {
    ...first,
    planTitle: `Etapa ${state.currentStage.label}`,
    planNote: state.weekdayNote || state.currentStage.description,
    xiaomi: state.xiaomi,
    cleaningType: state.currentStage.id,
    countsForCycle: true
  };
}

export function getNextRecommendedByMap(sessions = []) {
  const state = getCurrentCycleState(sessions);
  return MAPS.map(map => {
    const item = rankMapByPending(map, sessions, state.progress.pendingZones);
    return {
      ...item,
      planTitle: `Etapa ${state.currentStage.label}`,
      planNote: state.currentStage.description,
      xiaomi: state.xiaomi,
      cleaningType: state.currentStage.id,
      countsForCycle: item.targetZones.length > 0
    };
  });
}

export function getSessionCycleMeta(session = {}, sessionsBefore = []) {
  const state = getCurrentCycleState(sessionsBefore, sessionDate(session));
  const cleaningType = getSessionCleaningType(session);
  const countsForCycle = doesSessionCountForStage({ ...session, cleaningType }, state.currentStage);
  const recommended = countsForCycle;

  return {
    cleaningType,
    cycleNumber: state.cycleNumber,
    cycleStage: state.currentStage.id,
    countsForCycle,
    recommendationSource: recommended ? "recomendada" : "manual"
  };
}

export function getCycleLabel(state) {
  return `${state.cycleName} ${state.cycleNumber}`;
}
