// ═══════════════════════════════════════════
// utils-bundle.js — Utils expuestos globalmente
// ═══════════════════════════════════════════

// number.js
function safeNum(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function formatBs(val, decimals = 2) { return 'Bs. ' + safeNum(val).toFixed(decimals); }
function round(val, decimals = 2) { const factor = Math.pow(10, decimals); return Math.round(safeNum(val) * factor) / factor; }
function clamp(val, min, max) { return Math.max(min, Math.min(max, safeNum(val))); }

// string.js
function escHTML(s) {
  if (s == null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '\u0027');
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function truncate(str, maxLen) { if (!str || str.length <= maxLen) return str || ''; return str.slice(0, maxLen - 1) + '\u2026'; }
function capitalize(str) { if (!str) return ''; return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(); }
function slugify(str) { return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

// array.js
function safeArr(v) { return Array.isArray(v) ? v : []; }
function uniqueBy(arr, key) { const seen = new Set(); return safeArr(arr).filter(item => { const k = typeof key === 'function' ? key(item) : item[key]; if (seen.has(k)) return false; seen.add(k); return true; }); }
function groupBy(arr, key) { return safeArr(arr).reduce((acc, item) => { const k = typeof key === 'function' ? key(item) : item[key]; (acc[k] = acc[k] || []).push(item); return acc; }, {}); }
function sumBy(arr, key) { return safeArr(arr).reduce((sum, item) => { const val = typeof key === 'function' ? key(item) : item[key]; return sum + safeNum(val); }, 0); }
function sortBy(arr, key, dir = 'asc') { const multiplier = dir === 'desc' ? -1 : 1; return [...safeArr(arr)].sort((a, b) => { const av = typeof key === 'function' ? key(a) : a[key]; const bv = typeof key === 'function' ? key(b) : b[key]; if (av < bv) return -1 * multiplier; if (av > bv) return 1 * multiplier; return 0; }); }
function find(arr, predicate) { return safeArr(arr).find(predicate); }
function filter(arr, predicate) { return safeArr(arr).filter(predicate); }

// dom.js
function $(id) { return document.getElementById(id); }
function createEl(tag, attrs = {}, children = []) { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v); else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v); else el.setAttribute(k, v); }); (Array.isArray(children) ? children : [children]).forEach(c => { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return el; }
function clearEl(el) { if (el) el.innerHTML = ''; }
function toggleClass(el, className, force) { if (el) el.classList.toggle(className, force); }
function delegate(parent, selector, event, handler) { parent.addEventListener(event, e => { const target = e.target.closest(selector); if (target) handler.call(target, e, target); }); }
function show(el, show, display = 'block') { if (el) el.style.display = show ? display : 'none'; }
function scrollToEl(target, options = { behavior: 'smooth', block: 'start' }) { const el = typeof target === 'string' ? $(target) : target; if (el) el.scrollIntoView(options); }
function disableNumberInputWheel() {
  if (typeof document === 'undefined' || !document.addEventListener || window._wheelBlurInitialized) return;
  window._wheelBlurInitialized = true;
  document.addEventListener('wheel', function(e) {
    const isNum = (el) => el && el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'number';
    if (isNum(document.activeElement)) {
      document.activeElement.blur();
    }
    if (isNum(e.target)) {
      e.target.blur();
    }
  }, { passive: true });
}
disableNumberInputWheel();
window.disableNumberInputWheel = disableNumberInputWheel;

// storage.js
const PREFIX = 'tiaeli_';
function ns(key) { return PREFIX + key; }
function set(key, value) { try { localStorage.setItem(ns(key), JSON.stringify(value)); } catch (e) { console.error('Storage set error:', key, e); } }
function get(key, defaultValue = null) { try { const item = localStorage.getItem(ns(key)); return item ? JSON.parse(item) : defaultValue; } catch (e) { console.error('Storage get error:', key, e); return defaultValue; } }
function remove(key) { localStorage.removeItem(ns(key)); }
function clear() { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); }
function keys() { return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length)); }
function setSession(key, value) { try { sessionStorage.setItem(ns(key), JSON.stringify(value)); } catch (e) { console.error('SessionStorage set error:', key, e); } }
function getSession(key, defaultValue = null) { try { const item = sessionStorage.getItem(ns(key)); return item ? JSON.parse(item) : defaultValue; } catch (e) { return defaultValue; } }
function setWithTTL(key, value, ttlMs) { set(key, { value, expires: Date.now() + ttlMs }); }
function getWithTTL(key, defaultValue = null) { const item = get(key); if (!item || !item.expires) return item?.value ?? defaultValue; if (Date.now() > item.expires) { remove(key); return defaultValue; } return item.value; }

// date.js
function formatDate(date) { const d = date instanceof Date ? date : new Date(date); if (isNaN(d.getTime())) return ''; return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function formatDateTime(date) { const d = date instanceof Date ? date : new Date(date); if (isNaN(d.getTime())) return ''; return d.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatTime(date) { const d = date instanceof Date ? date : new Date(date); if (isNaN(d.getTime())) return ''; return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }); }
function daysBetween(from, to) { const f = new Date(from); const t = new Date(to); f.setHours(0,0,0,0); t.setHours(0,0,0,0); return Math.round((t - f) / 86400000); }
function startOfDay(date = new Date()) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function endOfDay(date = new Date()) { const d = new Date(date); d.setHours(23,59,59,999); return d; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function isToday(date) { const d = new Date(date); const today = new Date(); return d.toDateString() === today.toDateString(); }
function now() { return Date.now(); }
function toLocalISODate(date = new Date()) { const d = new Date(date); return d.toISOString().slice(0, 10); }

// Exponer globalmente
window.safeNum = safeNum;
window.formatBs = formatBs;
window.round = round;
window.clamp = clamp;
window.escHTML = escHTML;
window.genId = genId;
window.truncate = truncate;
window.capitalize = capitalize;
window.slugify = slugify;
window.safeArr = safeArr;
window.uniqueBy = uniqueBy;
window.groupBy = groupBy;
window.sumBy = sumBy;
window.sortBy = sortBy;
window.find = find;
window.filter = filter;
window.$ = $;
window.createEl = createEl;
window.clearEl = clearEl;
window.toggleClass = toggleClass;
window.delegate = delegate;
window.show = show;
window.scrollToEl = scrollToEl;
window.storage = { set, get, remove, clear, keys, setSession, getSession, setWithTTL, getWithTTL };
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatTime = formatTime;
window.daysBetween = daysBetween;
window.startOfDay = startOfDay;
window.endOfDay = endOfDay;
window.addDays = addDays;
window.isToday = isToday;
window.now = now;
window.toLocalISODate = toLocalISODate;

// Alias compatibilidad
window.csvSafe = function(v) { var s = String(v == null ? '' : v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; };
window._safeImg = function(f) { return (f && typeof f === "string" && /^data:image\//.test(f)) ? f : ''; };

// ═══════════════════════════════════════════
// UTILIDADES ADICIONALES
// ═══════════════════════════════════════════

// Debounce: retrasa ejecución hasta que el usuario deja de escribir
window.debounce = function(fn, ms) {
  var timer;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(ctx, args); }, ms);
  };
};

// Throttle: ejecuta como máximo una vez cada N ms
window.throttle = function(fn, ms) {
  var last = 0;
  return function() {
    var now = Date.now();
    if (now - last >= ms) {
      last = now;
      return fn.apply(this, arguments);
    }
  };
};

// TrapFocus: mantiene el foco dentro de un modal (accesibilidad)
window.trapFocus = function(modalEl) {
  var focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return function() {};
  var first = focusable[0];
  var last = focusable[focusable.length - 1];
  function handler(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  modalEl.addEventListener('keydown', handler);
  if (first && first.focus) first.focus();
  return function() { modalEl.removeEventListener('keydown', handler); };
};

// scrollToTop: scroll suave al inicio
window.scrollToTop = function() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// copyToClipboard: copia texto al portapapeles
window.copyToClipboard = function(text) {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
};

// formatNumber: separadores de miles
window.formatNumber = function(n) {
  return safeNum(n).toLocaleString('es-BO');
};

// sleep: pausa async
window.sleep = function(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
};

// generateColor: color determinista a partir de un string
window.stringToColor = function(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var h = Math.abs(hash) % 360;
  return 'hsl(' + h + ', 55%, 45%)';
};

console.log('[Utils] Cargado y expuesto globalmente');