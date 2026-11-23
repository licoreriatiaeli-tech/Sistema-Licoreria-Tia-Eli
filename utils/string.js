// ═══════════════════════════════════════════
// utils/string.js — Utilidades de strings
// ═══════════════════════════════════════════

/**
 * Escapa HTML para prevenir XSS
 * @param {string} s - String a escapar
 * @returns {string}
 */
export function escHTML(s) {
  if (s == null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '\u0027');
}

/**
 * Genera ID único corto
 * @returns {string}
 */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Trunca string con elipsis
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str || '';
  return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Capitaliza primera letra
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convierte a slug (URL-friendly)
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}