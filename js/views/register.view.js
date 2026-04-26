import { Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { MAPS, getMapById } from "../config/maps.config.js";
import {
  saveSession as saveSessionToService,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession
} from "../services/sessions.service.js";
import { addSession, setSelectedMapId, getSelectedMapId } from "../state/store.js";
import { toastSuccess, toastError, toastWarning } from "../ui/toast.js";
import { switchTab } from "../ui/tabs.js";
import { getWeeklyCleaningMode } from "../utils/zones.js";
import { renderDashboardView } from "./dashboard.view.js";
import { renderHistoryView } from "./history.view.js";
import { renderStatsView } from "./stats.view.js";

let currentDraft = null;
let timerInterval = null;

function getDraft() {
  return currentDraft;
}

function saveDraft(data) {
  currentDraft = data || null;
}

function clearDraft() {
  currentDraft = null;
}

async function resolveInitialDraft() {
  const localDraft = getDraft();
  try {
    const cloudDraft = await loadActiveSession();
    return cloudDraft || localDraft;
  } catch (error) {
    console.error("No se pudo cargar la sesion activa compartida:", error);
    return localDraft;
  }
}

function startTimer(startIso) {
  stopTimer();
  const el = document.getElementById("session-active-timer");
  if (!el) return;

  const tick = () => {
    const ms = Date.now() - new Date(startIso).getTime();
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    el.textContent = min > 0
      ? `${min} min ${sec < 10 ? "0" : ""}${sec} seg transcurridos`
      : `${sec} seg transcurridos`;
  };

  tick();
  timerInterval = setInterval(tick, 5000);
}

function stopTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function getRegisterElements() {
  return {
    mapSelect: document.getElementById("map-select"),
    zonesGroup: document.getElementById("zones-group"),
    zoneChecks: document.getElementById("zone-checks"),
    dateInput: document.getElementById("date-input"),
    durationInput: document.getElementById("dur-input"),
    notesInput: document.getElementById("notes-input"),
    startButton: document.getElementById("start-btn"),
    finishButton: document.getElementById("finish-btn"),
    cancelButton: document.getElementById("cancel-draft-btn"),
    finishFields: document.getElementById("finish-fields")
  };
}

function getXiaomiValues() {
  return {
    modo: document.getElementById("xiaomi-modo")?.value || "",
    succion: document.getElementById("xiaomi-succion")?.value || "",
    agua: document.getElementById("xiaomi-agua")?.value || "",
    trayectoria: document.getElementById("xiaomi-trayectoria")?.value || "",
    veces: document.getElementById("xiaomi-veces")?.value || ""
  };
}

function setXiaomiValues({ modo, succion, agua, trayectoria, veces } = {}) {
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined) el.value = value || "";
  };

  set("xiaomi-modo", modo);
  set("xiaomi-succion", succion);
  set("xiaomi-agua", agua);
  set("xiaomi-trayectoria", trayectoria);
  set("xiaomi-veces", veces);
}

export async function setupRegisterView() {
  const elements = getRegisterElements();
  if (!elements.mapSelect) return;

  populateMapSelect(elements.mapSelect);
  bindRegisterEvents(elements);

  const draft = await resolveInitialDraft();
  if (draft) {
    saveDraft(draft);
    restoreDraftToForm(draft);
    updateSessionUI(draft);
  } else {
    applyWeeklyXiaomiDefaults();
    updateSessionUI(null);
  }
}

function applyWeeklyXiaomiDefaults() {
  const plan = getWeeklyCleaningMode();
  const hasValue = ["xiaomi-modo", "xiaomi-succion", "xiaomi-agua", "xiaomi-trayectoria", "xiaomi-veces"]
    .some(id => document.getElementById(id)?.value);
  if (!hasValue) setXiaomiValues(plan.xiaomi);
}

function populateMapSelect(selectElement) {
  const currentValue = selectElement.value;
  selectElement.innerHTML = `
    <option value="">Seleccionar mapa...</option>
    ${MAPS.map(map => `<option value="${map.id}">${map.name} - ${map.label}</option>`).join("")}
  `;
  if (currentValue) selectElement.value = currentValue;
}

function restoreDraftToForm(draft) {
  const elements = getRegisterElements();
  if (!elements.mapSelect) return;

  if (draft.mapId) {
    elements.mapSelect.value = draft.mapId;
    setSelectedMapId(draft.mapId);
    renderZoneChecks();

    if (draft.zones?.length && elements.zoneChecks) {
      elements.zoneChecks.querySelectorAll("input[type=checkbox]").forEach(cb => {
        const isSelected = draft.zones.includes(cb.value);
        cb.checked = isSelected;
        const zcheck = cb.closest(".zcheck");
        const zbox = zcheck?.querySelector(".zbox");
        if (zcheck) zcheck.classList.toggle("on", isSelected);
        if (zbox) zbox.textContent = isSelected ? "OK" : "";
      });
    }
  }

  setXiaomiValues({
    modo: draft.xiaomiModo,
    succion: draft.xiaomiSuccion,
    agua: draft.xiaomiAgua,
    trayectoria: draft.xiaomiTrayectoria,
    veces: draft.xiaomiVeces
  });

  if (elements.notesInput && draft.notes) {
    elements.notesInput.value = draft.notes;
  }
}

function bindRegisterEvents(elements) {
  const { mapSelect, startButton, finishButton, cancelButton } = elements;

  mapSelect.addEventListener("change", () => {
    const mapId = mapSelect.value ? Number(mapSelect.value) : null;
    setSelectedMapId(mapId);
    renderZoneChecks();
  });

  if (startButton) startButton.addEventListener("click", () => handleStart());
  if (finishButton) finishButton.addEventListener("click", () => handleFinish());
  if (cancelButton) cancelButton.addEventListener("click", () => handleCancelDraft());
}

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
      <div class="zbox">OK</div>
      <span>${zone}</span>
    </label>
  `).join("");

  zoneChecks.querySelectorAll(".zcheck").forEach(item => {
    item.addEventListener("click", event => {
      event.preventDefault();
      const input = item.querySelector("input");
      const box = item.querySelector(".zbox");
      if (!input || !box) return;
      input.checked = !input.checked;
      item.classList.toggle("on", input.checked);
      box.textContent = input.checked ? "OK" : "";
    });
  });
}

function updateSessionUI(draft) {
  const banner = document.getElementById("session-active-banner");
  const startBtn = document.getElementById("start-btn");
  const finishBtn = document.getElementById("finish-btn");
  const cancelBtn = document.getElementById("cancel-draft-btn");
  const finishFields = document.getElementById("finish-fields");

  if (draft) {
    if (banner) banner.style.display = "flex";
    if (startBtn) startBtn.style.display = "none";
    if (finishBtn) finishBtn.style.display = "";
    if (cancelBtn) cancelBtn.style.display = "";
    if (finishFields) finishFields.style.display = "";
    startTimer(draft.startTime);
  } else {
    if (banner) banner.style.display = "none";
    if (startBtn) startBtn.style.display = "";
    if (finishBtn) finishBtn.style.display = "none";
    if (cancelBtn) cancelBtn.style.display = "none";
    if (finishFields) finishFields.style.display = "none";
    stopTimer();
  }
}

async function handleStart() {
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
    startTime: new Date().toISOString(),
    mapId,
    zones: selectedZones,
    notes: elements.notesInput?.value.trim() || "",
    xiaomiModo: xiaomi.modo,
    xiaomiSuccion: xiaomi.succion,
    xiaomiAgua: xiaomi.agua,
    xiaomiTrayectoria: xiaomi.trayectoria,
    xiaomiVeces: xiaomi.veces
  };

  setStartState(true);
  try {
    await saveActiveSession(draft);
    saveDraft(draft);
    updateSessionUI(draft);
    toastSuccess("Limpieza iniciada. Disponible en todos tus dispositivos.");
  } catch (error) {
    console.error("Error iniciando sesion compartida:", error);
    toastError("No se pudo iniciar la sesion compartida");
  } finally {
    setStartState(false);
  }
}

async function handleFinish() {
  const draft = await resolveInitialDraft();
  if (!draft) {
    toastError("No hay sesion en curso");
    return;
  }

  const elements = getRegisterElements();
  const currentZones = [
    ...(elements.zoneChecks?.querySelectorAll("input:checked") || [])
  ].map(i => i.value);

  if (!currentZones.length) {
    toastWarning("Selecciona al menos una zona antes de finalizar");
    return;
  }

  const endTime = new Date();
  const startTime = new Date(draft.startTime);
  const autoMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
  const manualMinutes = elements.durationInput?.value ? Number(elements.durationInput.value) : null;
  const durationMinutes = manualMinutes || autoMinutes;

  const dateValue = elements.dateInput?.value;
  const completedAt = dateValue
    ? Timestamp.fromDate(new Date(dateValue))
    : Timestamp.fromDate(endTime);

  const xiaomi = getXiaomiValues();
  const notes = elements.notesInput?.value.trim() || draft.notes || null;

  setFinishState(true);

  try {
    const map = getMapById(draft.mapId);
    if (!map) {
      toastError("Mapa invalido");
      setFinishState(false);
      return;
    }

    const newSession = await saveSessionToService({
      mapId: map.id,
      mapName: map.name,
      mapLabel: map.label,
      mapColor: map.color,
      zones: currentZones,
      completedAt,
      startedAt: Timestamp.fromDate(startTime),
      durationMinutes,
      notes,
      xiaomi: {
        modo: xiaomi.modo || null,
        succion: xiaomi.succion || null,
        agua: xiaomi.agua || null,
        trayectoria: xiaomi.trayectoria || null,
        veces: xiaomi.veces || null
      }
    });

    addSession(newSession);
    clearDraft();
    await clearActiveSession();
    updateSessionUI(null);
    resetRegisterForm();
    renderDashboardView();
    renderHistoryView();
    renderStatsView();

    toastSuccess(`Sesion guardada - ${durationMinutes} min`);
    setTimeout(() => switchTab("dashboard"), 600);
  } catch (error) {
    console.error("Error guardando sesion:", error);
    toastError("Error al guardar");
  } finally {
    setFinishState(false);
  }
}

function handleCancelDraft() {
  setCancelState(true);
  clearActiveSession()
    .catch(error => {
      console.error("Error cancelando sesion compartida:", error);
      toastError("No se pudo cancelar la sesion compartida");
    })
    .finally(() => {
      clearDraft();
      stopTimer();
      updateSessionUI(null);
      resetRegisterForm();
      toastWarning("Sesion cancelada");
      setCancelState(false);
    });
}

function resetRegisterForm() {
  const {
    mapSelect,
    zonesGroup,
    zoneChecks,
    dateInput,
    durationInput,
    notesInput
  } = getRegisterElements();

  if (mapSelect) mapSelect.value = "";
  if (zonesGroup) zonesGroup.style.display = "none";
  if (zoneChecks) zoneChecks.innerHTML = "";
  if (dateInput) dateInput.value = "";
  if (durationInput) durationInput.value = "";
  if (notesInput) notesInput.value = "";

  ["xiaomi-modo", "xiaomi-succion", "xiaomi-agua", "xiaomi-trayectoria", "xiaomi-veces"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  setSelectedMapId(null);
}

function setFinishState(isSaving) {
  const btn = document.getElementById("finish-btn");
  const cancelBtn = document.getElementById("cancel-draft-btn");
  if (!btn) return;
  btn.disabled = isSaving;
  btn.textContent = isSaving ? "Guardando..." : "Finalizar sesion";
  if (cancelBtn) cancelBtn.disabled = isSaving;
}

function setStartState(isSaving) {
  const btn = document.getElementById("start-btn");
  if (!btn) return;
  btn.disabled = isSaving;
  btn.textContent = isSaving ? "Iniciando..." : "Iniciar limpieza";
}

function setCancelState(isSaving) {
  const btn = document.getElementById("cancel-draft-btn");
  if (!btn) return;
  btn.disabled = isSaving;
}
