import { ALL_ZONES } from "./maps.config.js";

/**
 * cleaning.config.js
 * -----------------------------------------------------------------------------
 * Configuración central del ciclo de limpieza de Morchis.
 *
 * Este archivo NO registra limpiezas ni calcula historial directamente.
 * Su trabajo es definir:
 * - etapas del ciclo,
 * - jerarquía de intensidad,
 * - zonas prioritarias diarias,
 * - estrategia sugerida según el día,
 * - presets Xiaomi,
 * - textos base para que la app no suene como trámite notarial.
 */

/* =============================================================================
 * Intensidad de limpieza
 * =============================================================================
 *
 * La app debe entender que una limpieza más fuerte cubre una más suave.
 *
 * Ejemplo:
 * - Si la etapa actual es "estandar" y se hizo "profundo", sí cuenta.
 * - Si la etapa actual es "profundo" y se hizo "rapido", no completa etapa,
 *   pero igual debe quedar como zona realizada hoy.
 */

export const CLEANING_INTENSITY = {
  rapido: 1,
  estandar: 2,
  profundo: 3
};

export const CLEANING_TYPE_LABELS = {
  rapido: "Rápido",
  estandar: "Estándar",
  profundo: "Profundo"
};

export const CLEANING_TYPE_SHORT_LABELS = {
  rapido: "Rápido",
  estandar: "Estándar",
  profundo: "Profundo"
};

export const CLEANING_TYPE_DESCRIPTIONS = {
  profundo: "Limpieza completa: aspirado y fregado con configuración fuerte.",
  estandar: "Limpieza de sostenimiento para mantener las zonas cubiertas.",
  rapido: "Repaso liviano para refrescar zonas ya trabajadas."
};

export const CLEANING_TYPE_ORDER = ["rapido", "estandar", "profundo"];

/**
 * Normaliza valores por si llegan con tilde, mayúsculas o variantes.
 * Porque, aparentemente, hasta las palabras necesitan onboarding.
 */
export function normalizeCleaningType(type) {
  const value = String(type || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["profundo", "profunda", "deep"].includes(value)) return "profundo";
  if (["estandar", "standard", "normal"].includes(value)) return "estandar";
  if (["rapido", "rapida", "quick", "fast"].includes(value)) return "rapido";

  return "estandar";
}

export function getCleaningIntensity(type) {
  const normalizedType = normalizeCleaningType(type);
  return CLEANING_INTENSITY[normalizedType] || CLEANING_INTENSITY.estandar;
}

export function doesCleaningCoverStage(cleaningType, stageId) {
  const cleaningIntensity = getCleaningIntensity(cleaningType);
  const stageIntensity = getCleaningIntensity(stageId);

  return cleaningIntensity >= stageIntensity;
}

export function getCleaningTypeLabel(type) {
  const normalizedType = normalizeCleaningType(type);
  return CLEANING_TYPE_LABELS[normalizedType] || CLEANING_TYPE_LABELS.estandar;
}

/* =============================================================================
 * Ciclo principal
 * ============================================================================= */

export const CLEANING_CYCLE = {
  id: "main-cleaning-cycle",
  name: "Ciclo de limpieza",
  description:
    "Ciclo progresivo para alternar limpiezas profundas, estándar y rápidas sin perder zonas pendientes.",
  stages: [
    {
      id: "profundo",
      label: "Profundo",
      shortLabel: "Profundo",
      intensity: CLEANING_INTENSITY.profundo,
      targetZones: ALL_ZONES,
      completeLabel: "Base profunda completa",
      description:
        "Deja todos los mapas con una limpieza completa antes de avanzar.",
      suggestionLabel: "Hacer limpieza profunda",
      helperText:
        "Ideal para reiniciar el ciclo, recuperar zonas acumuladas y dejar la sede bien cubierta."
    },
    {
      id: "estandar",
      label: "Estándar",
      shortLabel: "Estándar",
      intensity: CLEANING_INTENSITY.estandar,
      targetZones: ALL_ZONES,
      completeLabel: "Sostenimiento completo",
      description:
        "Mantiene todos los mapas cubiertos sin exigir el modo más pesado.",
      suggestionLabel: "Hacer limpieza estándar",
      helperText:
        "Sirve para mantener la sede limpia sin gastar el modo más fuerte todos los días."
    },
    {
      id: "rapido",
      label: "Rápido",
      shortLabel: "Rápido",
      intensity: CLEANING_INTENSITY.rapido,
      targetZones: ALL_ZONES,
      completeLabel: "Repaso rápido completo",
      description:
        "Cierra el ciclo con una pasada liviana por las zonas pendientes.",
      suggestionLabel: "Hacer repaso rápido",
      helperText:
        "Útil para refrescar zonas visibles o cerrar pendientes pequeños."
    }
  ]
};

/* =============================================================================
 * Zonas prioritarias diarias
 * =============================================================================
 *
 * Estas zonas son las más visibles y deben tener prioridad al iniciar el día.
 * Si ya se limpiaron hoy, no deberían volver a aparecer como sugerencia principal.
 */

export const PRIORITY_DAILY_ZONES = [
  "Recepcion",
  "Corredor lockers",
  "Pasillo 1er piso",
  "Pasillo 2do piso",
  "Cafeteria"
];

export const PRIORITY_DAILY_ZONE_LABEL = "Zonas visibles de inicio del día";

export const PRIORITY_DAILY_ZONE_NOTE =
  "Antes de avanzar con el ciclo, conviene dejar cubiertas las zonas más visibles.";

/* =============================================================================
 * Estrategias por día
 * =============================================================================
 *
 * getDay() en JavaScript:
 * 0 domingo, 1 lunes, 2 martes, 3 miércoles, 4 jueves, 5 viernes, 6 sábado.
 */

export const DAILY_CLEANING_STRATEGIES = {
  0: {
    id: "sunday-critical",
    label: "Domingo de cierre suave",
    shortLabel: "Cierre suave",
    preferredMapIds: [1, 2, 3, 4],
    preferredZones: [],
    reason: "Pendientes críticos",
    note:
      "Si hay pendientes urgentes, conviene cerrarlos sin forzar cambio de etapa."
  },

  1: {
    id: "monday-visible-start",
    label: "Inicio de semana",
    shortLabel: "Inicio semanal",
    preferredMapIds: [1, 2],
    preferredZones: [
      "Recepcion",
      "Corredor lockers",
      "Pasillo 1er piso",
      "Salon 1",
      "Salon 2",
      "Salon 6"
    ],
    reason: "Prioridad diaria",
    note:
      "Prioriza entrada, recepción, corredores y primer piso para arrancar la semana con buena presentación."
  },

  2: {
    id: "tuesday-first-floor",
    label: "Sostenimiento de primer piso",
    shortLabel: "Primer piso",
    preferredMapIds: [2],
    preferredZones: [
      "Pasillo 1er piso",
      "Salon 3",
      "Salon 4",
      "Salon 5",
      "Cafeteria"
    ],
    reason: "Plan del día",
    note:
      "Buen día para completar salones del primer piso y zonas de uso frecuente."
  },

  3: {
    id: "wednesday-second-floor",
    label: "Revisión de segundo piso",
    shortLabel: "Segundo piso",
    preferredMapIds: [4],
    preferredZones: [
      "Pasillo 2do piso",
      "Bano hombres 2do piso",
      "Bano mujeres 2do piso",
      "Salon 7",
      "Salon 8",
      "Salon 9",
      "Salon 10"
    ],
    reason: "Plan del día",
    note:
      "Mitad de semana: revisa segundo piso y zonas que suelen quedarse acumuladas."
  },

  4: {
    id: "thursday-adjustments",
    label: "Día de ajuste",
    shortLabel: "Ajustes",
    preferredMapIds: [3, 4],
    preferredZones: [
      "Oficina",
      "Bano Salon 7",
      "Bano Salon 8",
      "Salon 7",
      "Salon 8"
    ],
    reason: "Plan del día",
    note:
      "Día útil para oficina, baños y pendientes antiguos antes del cierre semanal."
  },

  5: {
    id: "friday-weekly-close",
    label: "Cierre de semana",
    shortLabel: "Cierre semanal",
    preferredMapIds: [1, 2, 3, 4],
    preferredZones: [
      "Recepcion",
      "Corredor lockers",
      "Pasillo 1er piso",
      "Pasillo 2do piso",
      "Cafeteria"
    ],
    reason: "Pendiente del ciclo",
    note:
      "Prioriza lo atrasado, lo visible y lo que falte para cerrar el ciclo sin dejar ruido para la siguiente semana."
  },

  6: {
    id: "saturday-selective-review",
    label: "Repaso de sábado",
    shortLabel: "Repaso selectivo",
    preferredMapIds: [1, 2, 4],
    preferredZones: [
      "Recepcion",
      "Corredor lockers",
      "Pasillo 1er piso",
      "Salon 1",
      "Salon 2",
      "Salon 6",
      "Salon 10"
    ],
    reason: "Plan del día",
    note:
      "Repaso selectivo según movimiento de clases y zonas con mayor visibilidad."
  }
};

export const WEEKDAY_URGENCY = {
  0: DAILY_CLEANING_STRATEGIES[0].note,
  1: DAILY_CLEANING_STRATEGIES[1].note,
  2: DAILY_CLEANING_STRATEGIES[2].note,
  3: DAILY_CLEANING_STRATEGIES[3].note,
  4: DAILY_CLEANING_STRATEGIES[4].note,
  5: DAILY_CLEANING_STRATEGIES[5].note,
  6: DAILY_CLEANING_STRATEGIES[6].note
};

export function getDailyCleaningStrategy(date = new Date()) {
  const parsedDate = date instanceof Date ? date : new Date(date);
  const day = Number.isNaN(parsedDate.getTime())
    ? new Date().getDay()
    : parsedDate.getDay();

  return DAILY_CLEANING_STRATEGIES[day] || DAILY_CLEANING_STRATEGIES[1];
}

/* =============================================================================
 * Motivos de sugerencia
 * ============================================================================= */

export const SUGGESTION_REASONS = {
  priorityDaily: {
    id: "priorityDaily",
    label: "Prioridad diaria",
    description: "Zona visible que conviene hacer al iniciar el día."
  },
  dailyPlan: {
    id: "dailyPlan",
    label: "Plan del día",
    description: "Zona recomendada por la estrategia del día."
  },
  cyclePending: {
    id: "cyclePending",
    label: "Pendiente del ciclo",
    description: "Zona pendiente para completar la etapa actual."
  },
  oldestZone: {
    id: "oldestZone",
    label: "Zona más antigua",
    description: "Zona con más tiempo sin registro de limpieza."
  },
  urgent: {
    id: "urgent",
    label: "Urgente",
    description: "Zona acumulada o con demasiados días sin limpieza."
  },
  manual: {
    id: "manual",
    label: "Registro manual",
    description: "Limpieza registrada manualmente fuera de la sugerencia principal."
  }
};

/* =============================================================================
 * Textos de estado del ciclo
 * ============================================================================= */

export const SESSION_CYCLE_STATUS = {
  countsForStage: {
    id: "countsForStage",
    label: "Cuenta para etapa",
    description: "La intensidad realizada cubre la etapa actual del ciclo."
  },
  doneToday: {
    id: "doneToday",
    label: "Realizada hoy",
    description: "La zona ya fue limpiada hoy y no debe sugerirse de nuevo."
  },
  lowerThanStage: {
    id: "lowerThanStage",
    label: "Realizada, intensidad menor a la sugerida",
    description:
      "La zona quedó registrada como hecha hoy, pero no completa la etapa actual."
  },
  doesNotCompleteDeep: {
    id: "doesNotCompleteDeep",
    label: "No completa etapa profunda",
    description:
      "La limpieza fue registrada, pero la etapa profunda requiere mayor intensidad."
  },
  manualOutsideStage: {
    id: "manualOutsideStage",
    label: "Manual fuera de etapa",
    description:
      "Registro manual válido para frescura e historial, pero no necesariamente para avanzar etapa."
  }
};

export function getSessionCycleStatus(cleaningType, stageId) {
  const normalizedCleaningType = normalizeCleaningType(cleaningType);
  const normalizedStageId = normalizeCleaningType(stageId);
  const coversStage = doesCleaningCoverStage(
    normalizedCleaningType,
    normalizedStageId
  );

  if (coversStage) {
    return SESSION_CYCLE_STATUS.countsForStage;
  }

  if (normalizedStageId === "profundo") {
    return SESSION_CYCLE_STATUS.doesNotCompleteDeep;
  }

  return SESSION_CYCLE_STATUS.lowerThanStage;
}

/* =============================================================================
 * Presets Xiaomi
 * ============================================================================= */

export const XIAOMI_PRESETS = {
  profundo: {
    id: "profundo",
    label: "Profundo",
    modo: "aspirar-fregar",
    succion: "turbo",
    agua: "nivel3",
    trayectoria: "profundo",
    veces: "2",
    description:
      "Aspirar y fregar con turbo, agua alta y trayectoria profunda. Ideal para reiniciar base."
  },

  estandar: {
    id: "estandar",
    label: "Estándar",
    modo: "aspirar",
    succion: "estandar",
    agua: "",
    trayectoria: "estandar",
    veces: "1",
    description:
      "Aspirado estándar para sostenimiento. Buen balance entre limpieza y tiempo."
  },

  rapido: {
    id: "rapido",
    label: "Rápido",
    modo: "aspirar",
    succion: "fuerte",
    agua: "",
    trayectoria: "rapido",
    veces: "1",
    description:
      "Repaso rápido con succión fuerte para zonas visibles o de paso."
  }
};

export const XIAOMI_FIELD_LABELS = {
  modo: "Modo",
  succion: "Succión",
  agua: "Agua",
  trayectoria: "Trayectoria",
  veces: "Veces"
};

export const XIAOMI_VALUE_LABELS = {
  "aspirar-fregar": "Aspirar y fregar",
  aspirar: "Aspirar",
  turbo: "Turbo",
  fuerte: "Fuerte",
  estandar: "Estándar",
  nivel3: "Nivel 3",
  profundo: "Profundo",
  rapido: "Rápido",
  "": "Sin agua"
};

/* =============================================================================
 * Estados de frescura
 * ============================================================================= */

export const ZONE_FRESHNESS_LIMITS = {
  freshDays: 1,
  soonDays: 3,
  urgentDays: 5
};

export const ZONE_FRESHNESS_LABELS = {
  today: "Al día",
  soon: "Próxima",
  urgent: "Urgente",
  never: "Sin registro"
};

export const ZONE_FRESHNESS_DESCRIPTIONS = {
  today: "Limpieza registrada hoy.",
  soon: "Zona reciente, pero conviene vigilarla.",
  urgent: "Zona con varios días sin limpieza.",
  never: "Zona sin registros todavía."
};

/* =============================================================================
 * Filtros visuales sugeridos para dashboard
 * ============================================================================= */

export const ZONE_FILTERS = [
  {
    id: "all",
    label: "Todos"
  },
  {
    id: "map-1",
    label: "Mapa 1",
    mapId: 1
  },
  {
    id: "map-2",
    label: "Mapa 2",
    mapId: 2
  },
  {
    id: "map-3",
    label: "Mapa 3",
    mapId: 3
  },
  {
    id: "map-4",
    label: "Mapa 4",
    mapId: 4
  },
  {
    id: "priority",
    label: "Prioritarias"
  },
  {
    id: "pending",
    label: "Pendientes"
  },
  {
    id: "done-today",
    label: "Limpiadas hoy"
  },
  {
    id: "never",
    label: "Sin registro"
  }
];

/* =============================================================================
 * Helpers públicos
 * ============================================================================= */

export function getStageConfig(stageId) {
  const normalizedStageId = normalizeCleaningType(stageId);

  return (
    CLEANING_CYCLE.stages.find(stage => stage.id === normalizedStageId) ||
    CLEANING_CYCLE.stages[0]
  );
}

export function getStageIndex(stageId) {
  const normalizedStageId = normalizeCleaningType(stageId);
  const index = CLEANING_CYCLE.stages.findIndex(
    stage => stage.id === normalizedStageId
  );

  return Math.max(0, index);
}

export function getNextStageId(stageId) {
  const currentIndex = getStageIndex(stageId);
  const nextIndex = (currentIndex + 1) % CLEANING_CYCLE.stages.length;

  return CLEANING_CYCLE.stages[nextIndex].id;
}

export function getPreviousStageId(stageId) {
  const currentIndex = getStageIndex(stageId);
  const previousIndex =
    currentIndex - 1 < 0 ? CLEANING_CYCLE.stages.length - 1 : currentIndex - 1;

  return CLEANING_CYCLE.stages[previousIndex].id;
}

export function getXiaomiPreset(stageId) {
  const normalizedStageId = normalizeCleaningType(stageId);

  return {
    ...(XIAOMI_PRESETS[normalizedStageId] || XIAOMI_PRESETS.estandar)
  };
}

export function getXiaomiPresetForCleaningType(cleaningType) {
  return getXiaomiPreset(cleaningType);
}

export function isPriorityDailyZone(zoneName) {
  const normalizedZoneName = normalizeZoneName(zoneName);

  return PRIORITY_DAILY_ZONES.some(
    priorityZone => normalizeZoneName(priorityZone) === normalizedZoneName
  );
}

export function normalizeZoneName(zoneName) {
  return String(zoneName || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getPriorityDailyZones() {
  return [...PRIORITY_DAILY_ZONES];
}

export function getSuggestionReason(reasonId) {
  return SUGGESTION_REASONS[reasonId] || SUGGESTION_REASONS.cyclePending;
}
