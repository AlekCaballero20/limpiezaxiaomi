/* ─────────────────────────────────────────────
   DATES UTILS — Musicala Tracker
   Helpers reutilizables para manejo de fechas
───────────────────────────────────────────── */

/* ==============================
   CONVERSIÓN
============================== */
export function tsToDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* ==============================
   DIFERENCIAS
============================== */
export function daysSince(dateValue) {
  const date = tsToDate(dateValue);
  if (!date) return null;

  const diffMs = Date.now() - date.getTime();
  return Math.floor(diffMs / 86400000);
}

/* ==============================
   FORMATEO
============================== */
export function formatDate(value, locale = "es-CO") {
  const date = tsToDate(value);
  if (!date) return "Fecha inválida";

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDateOnly(value, locale = "es-CO") {
  const date = tsToDate(value);
  if (!date) return "Fecha inválida";

  return date.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatTimeOnly(value, locale = "es-CO") {
  const date = tsToDate(value);
  if (!date) return "Hora inválida";

  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* ==============================
   INPUTS HTML
============================== */
export function getLocalNowInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function toDateTimeLocalValue(value) {
  const date = tsToDate(value);
  if (!date) return "";

  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 16);
}

/* ==============================
   COMPARACIÓN
============================== */
export function isSameDay(a, b) {
  const dateA = tsToDate(a);
  const dateB = tsToDate(b);

  if (!dateA || !dateB) return false;

  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function sortDatesDesc(list = []) {
  return [...list].sort((a, b) => {
    const dateA = tsToDate(a);
    const dateB = tsToDate(b);

    const timeA = dateA ? dateA.getTime() : 0;
    const timeB = dateB ? dateB.getTime() : 0;

    return timeB - timeA;
  });
}

export function sortDatesAsc(list = []) {
  return [...list].sort((a, b) => {
    const dateA = tsToDate(a);
    const dateB = tsToDate(b);

    const timeA = dateA ? dateA.getTime() : 0;
    const timeB = dateB ? dateB.getTime() : 0;

    return timeA - timeB;
  });
}