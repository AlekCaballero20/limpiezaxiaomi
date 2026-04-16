/* ─────────────────────────────────────────────
   TOAST UI — Musicala Tracker
   Sistema de notificaciones simple
───────────────────────────────────────────── */

let toastTimeout = null;

/* ==============================
   ELEMENT
============================== */
function getToastElement() {
  return document.getElementById("toast");
}

/* ==============================
   SHOW
============================== */
export function showToast(message, type = "success", duration = 3000) {
  const el = getToastElement();
  if (!el) return;

  /* limpiar timeout anterior */
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  el.textContent = message;

  /* estilos por tipo */
  applyToastStyle(el, type);

  /* mostrar */
  el.classList.add("show");

  /* ocultar */
  toastTimeout = setTimeout(() => {
    hideToast();
  }, duration);
}

/* ==============================
   HIDE
============================== */
export function hideToast() {
  const el = getToastElement();
  if (!el) return;

  el.classList.remove("show");
}

/* ==============================
   STYLES
============================== */
function applyToastStyle(el, type) {
  switch (type) {

    case "success":
      el.style.background = "var(--success)";
      el.style.color = "#fff";
      break;

    case "error":
      el.style.background = "var(--danger)";
      el.style.color = "#fff";
      break;

    case "warning":
      el.style.background = "var(--warning)";
      el.style.color = "#fff";
      break;

    case "info":
    default:
      el.style.background = "var(--primary)";
      el.style.color = "#fff";
      break;
  }
}

/* ==============================
   SHORTCUTS
============================== */
export function toastSuccess(message) {
  showToast(message, "success");
}

export function toastError(message) {
  showToast(message, "error");
}

export function toastWarning(message) {
  showToast(message, "warning");
}

export function toastInfo(message) {
  showToast(message, "info");
}