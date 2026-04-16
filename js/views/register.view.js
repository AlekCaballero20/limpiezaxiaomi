/* ─────────────────────────────────────────────
   REGISTER VIEW — Musicala Tracker
   Manejo del formulario de registro de limpieza
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
   ELEMENTOS DOM
============================== */
function getRegisterElements() {
  return {
    mapSelect: document.getElementById("map-select"),
    zonesGroup: document.getElementById("zones-group"),
    zoneChecks: document.getElementById("zone-checks"),
    dateInput: document.getElementById("date-input"),
    durationInput: document.getElementById("dur-input"),
    notesInput: document.getElementById("notes-input"),
    saveButton: document.getElementById("save-btn")
  };
}

/* ==============================
   INIT
============================== */
export function setupRegisterView() {
  const elements = getRegisterElements();
  if (!elements.mapSelect) return;

  setDefaultDate(elements.dateInput);
  populateMapSelect(elements.mapSelect);
  bindRegisterEvents(elements);
}

/* ==============================
   DEFAULTS
============================== */
function setDefaultDate(dateInput) {
  if (!dateInput) return;
  dateInput.value = getLocalNowInputValue();
}

function populateMapSelect(selectElement) {
  if (!selectElement) return;

  const currentValue = selectElement.value;

  selectElement.innerHTML = `
    <option value="">Seleccionar mapa...</option>
    ${MAPS.map(map => `
      <option value="${map.id}">
        ${map.name} — ${map.label}
      </option>
    `).join("")}
  `;

  if (currentValue) {
    selectElement.value = currentValue;
  }
}

/* ==============================
   EVENTOS
============================== */
function bindRegisterEvents(elements) {
  const {
    mapSelect,
    saveButton
  } = elements;

  mapSelect.addEventListener("change", () => {
    const mapId = mapSelect.value ? Number(mapSelect.value) : null;
    setSelectedMapId(mapId);
    renderZoneChecks();
  });

  saveButton.addEventListener("click", async () => {
    await handleSave();
  });
}

/* ==============================
   RENDER ZONAS
============================== */
function renderZoneChecks() {
  const {
    zonesGroup,
    zoneChecks
  } = getRegisterElements();

  const selectedMapId = getSelectedMapId();

  if (!selectedMapId) {
    if (zonesGroup) zonesGroup.style.display = "none";
    if (zoneChecks) zoneChecks.innerHTML = "";
    return;
  }

  const map = getMapById(selectedMapId);

  if (!map || !zonesGroup || !zoneChecks) {
    return;
  }

  zonesGroup.style.display = "block";

  zoneChecks.innerHTML = map.zones.map(zone => `
    <label class="zcheck on">
      <input type="checkbox" value="${zone}" checked>
      <div class="zbox">✓</div>
      <span>${zone}</span>
    </label>
  `).join("");

  setupZoneCheckInteractions(zoneChecks);
}

function setupZoneCheckInteractions(container) {
  const zoneItems = container.querySelectorAll(".zcheck");

  zoneItems.forEach(item => {
    item.addEventListener("click", event => {
      event.preventDefault();

      const input = item.querySelector("input");
      const box = item.querySelector(".zbox");

      if (!input || !box) return;

      input.checked = !input.checked;
      item.classList.toggle("on", input.checked);
      box.textContent = input.checked ? "✓" : "";
    });
  });
}

/* ==============================
   SAVE
============================== */
async function handleSave() {
  const elements = getRegisterElements();
  const {
    mapSelect,
    zoneChecks,
    dateInput,
    durationInput,
    notesInput,
    saveButton
  } = elements;

  const mapId = mapSelect.value ? Number(mapSelect.value) : null;

  if (!mapId) {
    toastWarning("Selecciona un mapa");
    return;
  }

  const map = getMapById(mapId);

  if (!map) {
    toastError("Mapa inválido");
    return;
  }

  const selectedZones = [...zoneChecks.querySelectorAll("input:checked")]
    .map(input => input.value);

  if (!selectedZones.length) {
    toastWarning("Selecciona al menos una zona");
    return;
  }

  const dateValue = dateInput.value;
  if (!dateValue) {
    toastWarning("Ingresa la fecha");
    return;
  }

  const durationMinutes = durationInput.value
    ? Number(durationInput.value)
    : null;

  const notes = notesInput.value.trim() || null;

  setSaveState(saveButton, true);

  try {
    const newSession = await saveSessionToService({
      mapId: map.id,
      mapName: map.name,
      mapLabel: map.label,
      mapColor: map.color,
      zones: selectedZones,
      completedAt: Timestamp.fromDate(new Date(dateValue)),
      durationMinutes,
      notes
    });

    addSession(newSession);

    resetRegisterForm();
    renderDashboardView();
    renderHistoryView();
    renderStatsView();

    toastSuccess("✓ Sesión guardada");

    setTimeout(() => {
      switchTab("dashboard");
    }, 500);

  } catch (error) {
    console.error("Error guardando sesión:", error);
    toastError("Error al guardar");
  } finally {
    setSaveState(saveButton, false);
  }
}

/* ==============================
   RESET
============================== */
function resetRegisterForm() {
  const {
    mapSelect,
    zonesGroup,
    zoneChecks,
    dateInput,
    durationInput,
    notesInput
  } = getRegisterElements();

  mapSelect.value = "";
  if (zonesGroup) zonesGroup.style.display = "none";
  if (zoneChecks) zoneChecks.innerHTML = "";
  if (dateInput) dateInput.value = getLocalNowInputValue();
  if (durationInput) durationInput.value = "";
  if (notesInput) notesInput.value = "";

  setSelectedMapId(null);
}

/* ==============================
   ESTADO BOTÓN
============================== */
function setSaveState(button, isSaving) {
  if (!button) return;

  button.disabled = isSaving;
  button.textContent = isSaving
    ? "Guardando…"
    : "Guardar sesión";
}