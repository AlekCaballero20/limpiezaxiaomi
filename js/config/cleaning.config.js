import { ALL_ZONES } from "./maps.config.js";

export const CLEANING_CYCLE = {
  id: "main-cleaning-cycle",
  name: "Ciclo de limpieza",
  stages: [
    {
      id: "profundo",
      label: "Profundo",
      shortLabel: "Profundo",
      targetZones: ALL_ZONES,
      completeLabel: "Base profunda completa",
      description: "Deja todos los mapas con una limpieza completa antes de avanzar."
    },
    {
      id: "estandar",
      label: "Estandar",
      shortLabel: "Estandar",
      targetZones: ALL_ZONES,
      completeLabel: "Sostenimiento completo",
      description: "Mantiene todos los mapas cubiertos sin exigir el modo mas pesado."
    },
    {
      id: "rapido",
      label: "Rapido",
      shortLabel: "Rapido",
      targetZones: ALL_ZONES,
      completeLabel: "Repaso rapido completo",
      description: "Cierra el ciclo con una pasada liviana por las zonas pendientes."
    }
  ]
};

export const XIAOMI_PRESETS = {
  profundo: {
    modo: "aspirar-fregar",
    succion: "turbo",
    agua: "nivel3",
    trayectoria: "profundo",
    veces: "2"
  },
  estandar: {
    modo: "aspirar",
    succion: "estandar",
    agua: "",
    trayectoria: "estandar",
    veces: "1"
  },
  rapido: {
    modo: "aspirar",
    succion: "fuerte",
    agua: "",
    trayectoria: "rapido",
    veces: "1"
  }
};

export const WEEKDAY_URGENCY = {
  0: "Fin de semana: si hay pendientes, conviene cerrar el ciclo sin cambiar de etapa.",
  1: "Inicio de semana: prioriza pendientes visibles, pero conserva la etapa actual.",
  2: "Dia de sostenimiento: buen momento para completar zonas sueltas.",
  3: "Mitad de semana: revisa los mapas con mas dias sin limpiar.",
  4: "Dia de ajuste: completa pendientes antes del cierre semanal.",
  5: "Cierre de semana: prioriza lo urgente sin saltarte el ciclo.",
  6: "Sabado: repaso selectivo si hay zonas acumuladas."
};

export function getStageConfig(stageId) {
  return CLEANING_CYCLE.stages.find(stage => stage.id === stageId) || CLEANING_CYCLE.stages[0];
}

export function getStageIndex(stageId) {
  return Math.max(0, CLEANING_CYCLE.stages.findIndex(stage => stage.id === stageId));
}

export function getNextStageId(stageId) {
  const currentIndex = getStageIndex(stageId);
  const nextIndex = (currentIndex + 1) % CLEANING_CYCLE.stages.length;
  return CLEANING_CYCLE.stages[nextIndex].id;
}

export function getXiaomiPreset(stageId) {
  return { ...(XIAOMI_PRESETS[stageId] || XIAOMI_PRESETS.estandar) };
}
