// ═══════════════════════════════════════════
// utils/array.js — Utilidades de arrays
// ═══════════════════════════════════════════

/**
 * Asegura que valor sea array
 * @param {*} v
 * @returns {Array}
 */
export function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

/**
 * Único por clave
 * @param {Array} arr
 * @param {string|Function} key
 * @returns {Array}
 */
export function uniqueBy(arr, key) {
  const seen = new Set();
  return safeArr(arr).filter(item => {
    const k = typeof key === 'function' ? key(item) : item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Agrupa array por clave
 * @param {Array} arr
 * @param {string|Function} key
 * @returns {Object}
 */
export function groupBy(arr, key) {
  return safeArr(arr).reduce((acc, item) => {
    const k = typeof key === 'function' ? key(item) : item[key];
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

/**
 * Suma propiedad numérica de array
 * @param {Array} arr
 * @param {string|Function} key
 * @returns {number}
 */
export function sumBy(arr, key) {
  return safeArr(arr).reduce((sum, item) => {
    const val = typeof key === 'function' ? key(item) : item[key];
    return sum + safeNum(val);
  }, 0);
}

/**
 * Ordena array por clave (asc/desc)
 * @param {Array} arr
 * @param {string|Function} key
 * @param {'asc'|'desc'} [dir='asc']
 * @returns {Array}
 */
export function sortBy(arr, key, dir = 'asc') {
  const multiplier = dir === 'desc' ? -1 : 1;
  return [...safeArr(arr)].sort((a, b) => {
    const av = typeof key === 'function' ? key(a) : a[key];
    const bv = typeof key === 'function' ? key(b) : b[key];
    if (av < bv) return -1 * multiplier;
    if (av > bv) return 1 * multiplier;
    return 0;
  });
}

/**
 * Busca primer elemento que cumple condición
 * @param {Array} arr
 * @param {Function} predicate
 * @returns {*|undefined}
 */
export function find(arr, predicate) {
  return safeArr(arr).find(predicate);
}

/**
 * Filtra array
 * @param {Array} arr
 * @param {Function} predicate
 * @returns {Array}
 */
export function filter(arr, predicate) {
  return safeArr(arr).filter(predicate);
}