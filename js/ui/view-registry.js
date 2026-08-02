/* ─────────────────────────────────────────────
   VIEW REGISTRY — Musicala Tracker

   Render perezoso por pestaña.

   Antes el arranque pintaba las cuatro vistas aunque solo una fuera
   visible. Historial y Estadisticas son las caras (recorren todo el
   historial), asi que se dejan pendientes hasta que el usuario entra
   en ellas. Cuando los datos cambian se marcan como sucias y se vuelven
   a pintar solo si estan a la vista.
───────────────────────────────────────────── */

const renderers = new Map();
const dirtyViews = new Set();

let getVisibleTab = () => null;

/**
 * @param {string} tabName Nombre de la pestaña (data-tab).
 * @param {Function} renderer Funcion de render, puede ser async.
 */
export function registerView(tabName, renderer) {
  if (!tabName || typeof renderer !== "function") return;

  renderers.set(tabName, renderer);
  dirtyViews.add(tabName);
}

export function setVisibleTabResolver(resolver) {
  if (typeof resolver === "function") getVisibleTab = resolver;
}

/** Marca vistas como pendientes de repintar. Sin argumentos, todas. */
export function invalidateViews(tabNames = null) {
  const targets = tabNames === null
    ? [...renderers.keys()]
    : [].concat(tabNames);

  targets.forEach(tabName => {
    if (renderers.has(tabName)) dirtyViews.add(tabName);
  });
}

export function isViewDirty(tabName) {
  return dirtyViews.has(tabName);
}

/**
 * Pinta la pestaña indicada si tiene cambios pendientes.
 * @returns {Promise<boolean>} true si se repinto.
 */
export async function renderView(tabName) {
  const renderer = renderers.get(tabName);

  if (!renderer || !dirtyViews.has(tabName)) return false;

  /* Se limpia antes de pintar: si el render vuelve a invalidar la vista,
     esa marca no se pierde. */
  dirtyViews.delete(tabName);

  try {
    await renderer();
  } catch (error) {
    console.error(`Error pintando la vista "${tabName}":`, error);
    dirtyViews.add(tabName);
    return false;
  }

  return true;
}

/** Pinta la pestaña visible ahora mismo, si esta pendiente. */
export function renderVisibleView() {
  const tabName = getVisibleTab();

  if (!tabName) return Promise.resolve(false);

  return renderView(tabName);
}

/**
 * Marca vistas como sucias y repinta de inmediato solo la visible.
 * Es lo que deben usar las acciones que cambian datos.
 */
export function refreshViews(tabNames = null) {
  invalidateViews(tabNames);

  return renderVisibleView();
}
