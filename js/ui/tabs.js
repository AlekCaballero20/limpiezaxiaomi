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

function getTabButton(tabName) {
  return Array.from(getTabButtons()).find(button => button.dataset.tab === tabName) || null;
}

function getTabPage(tabName) {
  return document.getElementById(`tab-${tabName}`);
}

function isValidTab(tabName) {
  return Boolean(tabName && getTabButton(tabName) && getTabPage(tabName));
}

/* ==============================
   RENDER
============================== */
export function renderTabs() {
  const activeTab = getActiveTab();
  const activePageId = `tab-${activeTab}`;

  getTabButtons().forEach(button => {
    const isActive = button.dataset.tab === activeTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  getPages().forEach(page => {
    const isActive = page.id === activePageId;
    page.hidden = !isActive;
    page.setAttribute("aria-hidden", isActive ? "false" : "true");
    page.classList.toggle("active", isActive);
  });
}

/* ==============================
   ACTIONS
============================== */
export function switchTab(tabName) {
  if (!tabName) return;

  if (!getTabButton(tabName)) {
    console.warn(`No existe un boton de tab para "${tabName}".`);
    return;
  }

  if (!getTabPage(tabName)) {
    console.warn(`No existe una seccion para la tab "${tabName}".`);
    return;
  }

  setActiveTab(tabName);
  renderTabs();

  if (window.location.hash !== `#${tabName}`) {
    window.location.hash = tabName;
  }
}

/* ==============================
   EVENTS
============================== */
export function setupTabs() {
  const tabsNav = document.querySelector(".tabs-nav");

  if (tabsNav && tabsNav.dataset.tabsReady !== "true") {
    tabsNav.addEventListener("click", event => {
      const button = event.target.closest("[data-tab]");
      if (!button || !tabsNav.contains(button)) return;
      switchTab(button.dataset.tab);
    });

    tabsNav.dataset.tabsReady = "true";
  }

  const hashTab = window.location.hash.replace("#", "").trim();
  const initialTab = isValidTab(hashTab) ? hashTab : "dashboard";
  setActiveTab(initialTab);

  renderTabs();
}
