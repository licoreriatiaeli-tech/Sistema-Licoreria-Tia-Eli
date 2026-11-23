// ═══════════════════════════════════════════
// utils/dom.js — Utilidades DOM
// ═══════════════════════════════════════════

/**
 * Obtiene elemento por ID con cache opcional
 * @param {string} id
 * @returns {HTMLElement|null}
 */
export function $(id) {
  return document.getElementById(id);
}

/**
 * Crea elemento con atributos y hijos
 * @param {string} tag
 * @param {Object} [attrs={}]
 * @param {Array|string|HTMLElement} [children=[]]
 * @returns {HTMLElement}
 */
export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return el;
}

/**
 * Limpia contenido de elemento
 * @param {HTMLElement} el
 */
export function clearEl(el) {
  if (el) el.innerHTML = '';
}

/**
 * Toggle clase
 * @param {HTMLElement} el
 * @param {string} className
 * @param {boolean} [force]
 */
export function toggleClass(el, className, force) {
  if (el) el.classList.toggle(className, force);
}

/**
 * Agrega evento delegado
 * @param {HTMLElement} parent
 * @param {string} selector
 * @param {string} event
 * @param {Function} handler
 */
export function delegate(parent, selector, event, handler) {
  parent.addEventListener(event, e => {
    const target = e.target.closest(selector);
    if (target) handler.call(target, e, target);
  });
}

/**
 * Muestra/oculta elemento
 * @param {HTMLElement} el
 * @param {boolean} show
 * @param {string} [display='block']
 */
export function show(el, show, display = 'block') {
  if (el) el.style.display = show ? display : 'none';
}

/**
 * Scroll suave a elemento
 * @param {HTMLElement|string} target
 * @param {Object} [options={behavior:'smooth',block:'start'}]
 */
export function scrollToEl(target, options = { behavior: 'smooth', block: 'start' }) {
  const el = typeof target === 'string' ? $(target) : target;
  if (el) el.scrollIntoView(options);
}