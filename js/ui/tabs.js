/* ─────────────────────────────────────────────
   TABS UI — Musicala Tracker
   Manejo de navegación por pestañas
───────────────────────────────────────────── */

import { setActiveTab, getActiveTab } from "../state/store.js";

/* ==============================
   HELPERS INTERNOS
============================== */
function getTabButtons() {
  return document.querySelectorAll(".tab");
}

function getPages() {
  return document.querySelectorAll(".page");
}

/* ==============================
   RENDER
============================== */
export function renderTabs() {
  const activeTab = getActiveTab();

  getTabButtons().forEach(button => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });

  getPages().forEach(page => {
    page.classList.toggle("active", page.id === `tab-${activeTab}`);
  });
}

/* ==============================
   ACTIONS
============================== */
export function switchTab(tabName) {
  if (!tabName) return;

  setActiveTab(tabName);
  renderTabs();
}

/* ==============================
   EVENTS
============================== */
export function setupTabs() {
  getTabButtons().forEach(button => {
    button.addEventListener("click", () => {
      switchTab(button.dataset.tab);
    });
  });

  renderTabs();
}