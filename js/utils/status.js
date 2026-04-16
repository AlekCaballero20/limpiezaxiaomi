/* ─────────────────────────────────────────────
   STATUS UTILS — Musicala Tracker
   Lógica de estados de limpieza
───────────────────────────────────────────── */

/* ==============================
   COLORES
============================== */
export function statusColor(days) {
  if (days === null) return "var(--never)";
  if (days <= 2) return "var(--fresh)";
  if (days <= 5) return "var(--ok)";
  if (days <= 10) return "var(--warn)";
  return "var(--urgent)";
}

/* ==============================
   LABELS
============================== */
export function statusLabel(days) {
  if (days === null) return "Sin datos";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days}d`;
}

/* ==============================
   TIPO DE ESTADO (lógico)
============================== */
export function statusType(days) {
  if (days === null) return "none";
  if (days <= 2) return "fresh";
  if (days <= 5) return "ok";
  if (days <= 10) return "warn";
  return "urgent";
}

/* ==============================
   PRIORIDAD NUMÉRICA
============================== */
export function statusPriority(days) {
  if (days === null) return 999; // máxima urgencia por falta de datos
  return days;
}

/* ==============================
   ORDENAMIENTO
============================== */
export function sortByUrgency(list, getDaysFn) {
  return [...list].sort((a, b) => {
    const aDays = getDaysFn(a);
    const bDays = getDaysFn(b);

    const aPriority = statusPriority(aDays);
    const bPriority = statusPriority(bDays);

    return bPriority - aPriority;
  });
}

/* ==============================
   TEXTO MÁS HUMANO (UX)
============================== */
export function statusMessage(days) {
  if (days === null) return "Nunca se ha limpiado";

  if (days === 0) return "Limpieza realizada hoy";
  if (days === 1) return "Se limpió ayer";

  if (days <= 3) return "Reciente";
  if (days <= 7) return "Conviene limpiar pronto";

  return "Requiere limpieza urgente";
}

/* ==============================
   CLASE CSS (para badges)
============================== */
export function statusClass(days) {
  const type = statusType(days);

  switch (type) {
    case "fresh":
      return "badge--success";
    case "ok":
      return "badge--neutral";
    case "warn":
      return "badge--warn";
    case "urgent":
      return "badge--danger";
    default:
      return "badge--neutral";
  }
}