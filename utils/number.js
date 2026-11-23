// ═══════════════════════════════════════════
// utils/number.js — Utilidades numéricas
// ═══════════════════════════════════════════

/**
 * Convierte valor a número seguro con fallback
 * @param {*} v - Valor a convertir
 * @param {number} [fb=0] - Fallback si no es número finito
 * @returns {number}
 */
export function safeNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/**
 * Formatea número como moneda boliviana
 * @param {number} val - Valor
 * @param {number} [decimals=2] - Decimales
 * @returns {string}
 */
export function formatBs(val, decimals = 2) {
  return 'Bs. ' + safeNum(val).toFixed(decimals);
}

/**
 * Redondea a N decimales evitando errores de punto flotante
 * @param {number} val - Valor
 * @param {number} [decimals=2] - Decimales
 * @returns {number}
 */
export function round(val, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(safeNum(val) * factor) / factor;
}

/**
 * Clampa valor entre min y max
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, safeNum(val)));
}