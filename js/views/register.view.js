/* ─────────────────────────────────────────────
   REGISTER VIEW — Musicala Tracker
   Formulario de registro con flujo:
   Iniciar limpieza → Finalizar sesión
───────────────────────────────────────────── */

import { Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { MAPS, getMapById } from "../config/maps.config.js";
import { saveSession as saveSessionToService } from "../services/sessions.service.js";
import { addSession, setSelectedMapId, getSelectedMapId } from "../state/store.js";
import { getLocalNowInputValue } from "../utils/dates.js";
import { toastSuccess, toastError, toastWarning } from "../ui/toast.js";
import { switchTab } from "../ui/tabs.js";
import { renderDashboardView } from "./dashboard.view.js";
import { renderHistoryView } from "./history.view.js";
import { renderStatsView } from "./stats.view.js";

/* ==============================
   BORRADOR EN LOCALSTORAGE
============================== */
const DRAFT_KEY = "xiaomi_session_draft";

function getDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch { /* silencioso */ }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

/* ==============================
   TIMER EN VIVO
============================== */
let _timerInterval = null;

function startTimer(startIso) {
  stopTimer();
  const el = document.getElementById("session-active-timer");
  if (!el) return;

  function tick() {
    const ms = Date.now() - new Date(startIso).getTime();
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    if (min > 0) {
      el.textContent = `${min} min ${sec < 10 ? "0" : ""}${sec} seg transcurridos`;
    } else {
      el.textContent = `${sec} seg transcurridos`;
    }
  }

  tick();
  _timerInterval = setInterval(tick, 5000);
}

function stopTimer() {
  if (_timerInterval) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

/* ==============================
   ELEMENTOS DOM
============================== */
function getRegisterElements() {
  return {
    mapSelect:     document.getElementById("map-select"),
    zonesGroup:    document.getElementById("zones-group"),
    zoneChecks:    document.getElementById("zone-checks"),
    dateInput:     document.getElementById("date-input"),
    durationInput: document.getElementById("dur-input"),
    notesInput:    document.getElementById("notes-input"),
    startButton:   document.getElementById("start-btn"),
    finishButton:  document.getElementById("finish-btn"),
    cancelButton:  document.getElementById("cancel-draft-btn"),
    finishFields:  document.getElementById("finish-fields"),
  };
}

function getXiaomiValues() {
  return {
    modo:        document.getElementById("xiaomi-modo")?.value        || "",
    succion:     document.getElementById("xiaomi-succion")?.value     || "",
    agua:        document.getElementById("xiaomi-agua")?.value        || "",
    trayectoria: document.getElementById("xiaomi-trayectoria")?.value || "",
    veces:       document.getElementById("xiaomi-veces")?.value       || "",
  };
}

function setXiaomiValues({ modo, succion, agua, trayectoria, veces } = {}) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val || "";
  };
  set("xiaomi-modo",        modo);
  set("xiaomi-succion",     succion);
  set("xiaomi-agua",        agua);
  set("xiaomi-trayectoria", trayectoria);
  set("xiaomi-veces",       veces);
}

/* ==============================
   INIT
============================== */
export function setupRegisterView() {
  const elements = getRegisterElements();
  if (!elements.mapSelect) return;

  populateMapSelect(elements.mapSelect);
  bindRegisterEvents(elements);

  // Restaurar borrador si existe
  const draft = getDraft();
  if (draft) {
    restoreDraftToForm(draft);
    updateSessionUI(draft);
  } else {
    updateSessionUI(null);
  }
}

/* ==============================
   POPULATE MAP SELECT
============================== */
function populateMapSelect(selectElement) {
  if (!selectElement) return;
  const currentValue = selectElement.value;
  selectElement.innerHTML = `
    <option value="">Seleccionar mapa...</option>
    ${MAPS.map(map => `
      <option value="${map.id}">${map.name} — ${map.label}</option>
    `).join("")}
  `;
  if (currentValue) selectElement.value = currentValue;
}

/* ==============================
   RESTAURAR BORRADOR AL FORMULARIO
============================== */
function restoreDraftToForm(draft) {
  const elements = getRegisterElements();
  if (!elements.mapSelect) return;

  if (draft.mapId) {
    elements.mapSelect.value = draft.mapId;
    setSelectedMapId(draft.mapId);
    renderZoneChecks();

    // Restaurar selección de zonas
    if (draft.zones?.length && elements.zoneChecks) {
      elements.zoneChecks.querySelectorAll("input[type=checkbox]").forEach(cb => {
        const isSelected = draft.zones.includes(cb.value);
        cb.checked = isSelected;
        const zcheck = cb.closest(".zcheck");
        const zbox   = zcheck?.querySelector(".zbox");
        if (zcheck) zcheck.classList.toggle("on", isSelected);
        if (zbox)   zbox.textContent = isSelected ? "✓" : "";
      });
    }
  }

  setXiaomiValues({
    modo:        draft.xiaomiModo,
    succion:     draft.xiaomiSuccion,
    agua:        draft.xiaomiAgua,
    trayectoria: draft.xiaomiTrayectoria,
    veces:       draft.xiaomiVeces,
  });

  if (elements.notesInput && draft.notes) {
    elements.notesInput.value = draft.notes;
  }
}

/* ==============================
   EVENTOS
============================== */
function bindRegisterEvents(elements) {
  const { mapSelect, startButton, finishButton, cancelButton } = elements;

  mapSelect.addEventListener("change", () => {
    const mapId = mapSelect.value ? Number(mapSelect.value) : null;
    setSelectedMapId(mapId);
    renderZoneChecks();
  });

  if (startButton)  startButton.addEventListener("click",  () => handleStart());
  if (finishButton) finishButton.addEventListener("click", () => handleFinish());
  if (cancelButton) cancelButton.addEventListener("click", () => handleCancelDraft());
}

/* ==============================
   RENDER ZONAS
============================== */
function renderZoneChecks() {
  const { zonesGroup, zoneChecks } = getRegisterElements();
  const selectedMapId = getSelectedMapId();

  if (!selectedMapId) {
    if (zonesGroup) zonesGroup.style.display = "none";
    if (zoneChecks) zoneChecks.innerHTML = "";
    return;
  }

  const map = getMapById(selectedMapId);
  if (!map || !zonesGroup || !zoneChecks) return;

  zonesGroup.style.display = "block";

  zoneChecks.innerHTML = map.zones.map(zone => `
    <label class="zcheck on">
      <input type="checkbox" value="${zone}" checked>
      <div class="zbox">✓</div>
      <span>${zone}</span>
    </label>
  `).join("");

  zoneChecks.querySelectorAll(".zcheck").forEach(item => {
    item.addEventListener("click", event => {
      event.preventDefault();
      const input = item.querySelector("input");
      const box   = item.querySelector(".zbox");
      if (!input || !box) return;
      input.checked = !input.checked;
      item.classList.toggle("on", input.checked);
      box.textContent = input.checked ? "✓" : "";
    });
  });
}

/* ==============================
   UI: ESTADO SESIÓN
============================== */
function updateSessionUI(draft) {
  const banner      = document.getElementById("session-active-banner");
  const startBtn    = document.getElementById("start-btn");
  const finishBtn   = document.getElementById("finish-btn");
  const cancelBtn   = document.getElementById("cancel-draft-btn");
  const finishFields = document.getElementById("finish-fields");

  if (draft) {
    if (banner)       banner.style.display      = "flex";
    if (startBtn)     startBtn.style.display     = "none";
    if (finishBtn)    finishBtn.style.display     = "";
    if (cancelBtn)    cancelBtn.style.display     = "";
    if (finishFields) finishFields.style.display  = "";
    startTimer(draft.startTime);
  } else {
    if (banner)       banner.style.display       = "none";
    if (startBtn)     startBtn.style.display      = "";
    if (finishBtn)    finishBtn.style.display      = "none";
    if (cancelBtn)    cancelBtn.style.display      = "none";
    if (finishFields) finishFields.style.display   = "none";
    stopTimer();
  }
}

/* ==============================
   INICIAR LIMPIEZA
============================== */
function handleStart() {
  const elements = getRegisterElements();
  const mapId = elements.mapSelect?.value ? Number(elements.mapSelect.value) : null;

  if (!mapId) {
    toastWarning("Selecciona un mapa antes de iniciar");
    return;
  }

  const selectedZones = [
    ...(elements.zoneChecks?.querySelectorAll("input:checked") || [])
  ].map(i => i.value);

  if (!selectedZones.length) {
    toastWarning("Selecciona al menos una zona");
    return;
  }

  const xiaomi = getXiaomiValues();

  const draft = {
    startTime:        new Date().toISOString(),
    mapId,
    zones:            selectedZones,
    notes:            elements.notesInput?.value.trim() || "",
    xiaomiModo:       xiaomi.modo,
    xiaomiSuccion:    xiaomi.succion,
    xiaomiAgua:       xiaomi.agua,
    xiaomiTrayectoria: xiaomi.trayectoria,
    xiaomiVeces:      xiaomi.veces,
  };

  saveDraft(draft);
  updateSessionUI(draft);
  toastSuccess("🧹 ¡Limpieza iniciada! Finaliza cuando termine.");
}

/* ==============================
   FINALIZAR SESIÓN
============================== */
async function handleFinish() {
  const draft = getDraft();
  if (!draft) {
    toastError("No hay sesión en curso");
    return;
  }

  const elements = getRegisterElements();

  // Zonas actuales del formulario (por si se editaron)
  const currentZones = [
    ...(elements.zoneChecks?.querySelectorAll("input:checked") || [])
  ].map(i => i.value);

  if (!currentZones.length) {
    toastWarning("Selecciona al menos una zona antes de finalizar");
    return;
  }

  const endTime       = new Date();
  const startTime     = new Date(draft.startTime);
  const autoMinutes   = Math.max(1, Math.round((endTime - startTime) / 60000));

  // Usar duración manual si el usuario la editó, si no usar la calculada
  const manualMinutes  = elements.durationInput?.value
    ? Number(elements.durationInput.value)
    : null;
  const durationMinutes = manualMinutes || autoMinutes;

  // Fecha: usar la del input si está; si no, la hora actual
  const dateValue = elements.dateInput?.value;
  const completedAt = dateValue
    ? Timestamp.fromDate(new Date(dateValue))
    : Timestamp.fromDate(endTime);

  const xiaomi = getXiaomiValues();
  const notes  = elements.notesInput?.value.trim() || draft.notes || null;

  setFinishState(true);

  try {
    const map = getMapById(draft.mapId);
    if (!map) {
      toastError("Mapa inválido");
      setFinishState(false);
      return;
    }

    const newSession = await saveSessionToService({
      mapId:     map.id,
      mapName:   map.name,
      mapLabel:  map.label,
      mapColor:  map.color,
      zones:     currentZones,
      completedAt,
      startedAt: Timestamp.fromDate(startTime),
      durationMinutes,
      notes,
      xiaomi: {
        modo:        xiaomi.modo        || null,
        succion:     xiaomi.succion     || null,
        agua:        xiaomi.agua        || null,
        trayectoria: xiaomi.trayectoria || null,
        veces:       xiaomi.veces       || null,
      }
    });

    addSession(newSession);
    clearDraft();
    updateSessionUI(null);
    resetRegisterForm();
    renderDashboardView();
    renderHistoryView();
    renderStatsView();

    toastSuccess(`✓ Sesión guardada — ${durationMinutes} min`);

    setTimeout(() => switchTab("dashboard"), 600);

  } catch (error) {
    console.error("Error guardando sesión:", error);
    toastError("Error al guardar");
  } finally {
    setFinishState(false);
  }
}

/* ==============================
   CANCELAR BORRADOR
============================== */
function handleCancelDraft() {
  clearDraft();
  stopTimer();
  updateSessionUI(null);
  resetRegisterForm();
  toastWarning("Sesión cancelada");
}

/* ==============================
   RESET FORMULARIO
============================== */
function resetRegisterForm() {
  const {
    mapSelect,
    zonesGroup,
    zoneChecks,
    dateInput,
    durationInput,
    notesInput,
  } = getRegisterElements();

  if (mapSelect)     mapSelect.value = "";
  if (zonesGroup)    zonesGroup.style.display = "none";
  if (zoneChecks)    zoneChecks.innerHTML = "";
  if (dateInput)     dateInput.value = "";
  if (durationInput) durationInput.value = "";
  if (notesInput)    notesInput.value = "";

  ["xiaomi-modo", "xiaomi-succion", "xiaomi-agua", "xiaomi-trayectoria", "xiaomi-veces"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  setSelectedMapId(null);
}

/* ==============================
   ESTADO BOTÓN FINALIZAR
============================== */
function setFinishState(isSaving) {
  const btn       = document.getElementById("finish-btn");
  const cancelBtn = document.getElementById("cancel-draft-btn");
  if (!btn) return;
  btn.disabled       = isSaving;
  btn.textContent    = isSaving ? "Guardando…" : "✅  Finalizar sesión";
  if (cancelBtn) cancelBtn.disabled = isSaving;
}
