// ═══════════════════════════════════════════
// utils/storage.js — Utilidades de storage
// ═══════════════════════════════════════════

const PREFIX = 'tiaeli_';

/**
 * Key namespaced
 * @param {string} key
 * @returns {string}
 */
function ns(key) {
  return PREFIX + key;
}

/**
 * Guarda en localStorage con serialización JSON
 * @param {string} key
 * @param {*} value
 */
export function set(key, value) {
  try {
    localStorage.setItem(ns(key), JSON.stringify(value));
  } catch (e) {
    console.error('Storage set error:', key, e);
  }
}

/**
 * Obtiene de localStorage con parseo JSON
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
export function get(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(ns(key));
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error('Storage get error:', key, e);
    return defaultValue;
  }
}

/**
 * Elimina clave
 * @param {string} key
 */
export function remove(key) {
  localStorage.removeItem(ns(key));
}

/**
 * Limpia todo el namespace
 */
export function clear() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .forEach(k => localStorage.removeItem(k));
}

/**
 * Obtiene todas las claves del namespace
 * @returns {string[]}
 */
export function keys() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => k.slice(PREFIX.length));
}

/**
 * Guarda en sessionStorage
 * @param {string} key
 * @param {*} value
 */
export function setSession(key, value) {
  try {
    sessionStorage.setItem(ns(key), JSON.stringify(value));
  } catch (e) {
    console.error('SessionStorage set error:', key, e);
  }
}

/**
 * Obtiene de sessionStorage
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
export function getSession(key, defaultValue = null) {
  try {
    const item = sessionStorage.getItem(ns(key));
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Guarda con expiración (timestamp)
 * @param {string} key
 * @param {*} value
 * @param {number} ttlMs - Time to live en ms
 */
export function setWithTTL(key, value, ttlMs) {
  set(key, { value, expires: Date.now() + ttlMs });
}

/**
 * Obtiene con expiración
 * @param {string} key
 * @param {*} [defaultValue=null]
 * @returns {*}
 */
export function getWithTTL(key, defaultValue = null) {
  const item = get(key);
  if (!item || !item.expires) return item?.value ?? defaultValue;
  if (Date.now() > item.expires) {
    remove(key);
    return defaultValue;
  }
  return item.value;
}