// ═══════════════════════════════════════════
// utils/date.js — Utilidades de fechas
// ═══════════════════════════════════════════

/**
 * Formatea fecha como DD/MM/YYYY
 * @param {Date|number|string} date
 * @returns {string}
 */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formatea fecha y hora
 * @param {Date|number|string} date
 * @returns {string}
 */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-BO', { 
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit' 
  });
}

/**
 * Formatea solo hora
 * @param {Date|number|string} date
 * @returns {string}
 */
export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Días entre dos fechas
 * @param {Date|number|string} from
 * @param {Date|number|string} to
 * @returns {number}
 */
export function daysBetween(from, to) {
  const f = new Date(from);
  const t = new Date(to);
  f.setHours(0,0,0,0);
  t.setHours(0,0,0,0);
  return Math.round((t - f) / 86400000);
}

/**
 * Inicio del día (00:00:00)
 * @param {Date|number|string} [date=new Date()]
 * @returns {Date}
 */
export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  return d;
}

/**
 * Fin del día (23:59:59.999)
 * @param {Date|number|string} [date=new Date()]
 * @returns {Date}
 */
export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23,59,59,999);
  return d;
}

/**
 * Suma días a fecha
 * @param {Date|number|string} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Verifica si fecha es hoy
 * @param {Date|number|string} date
 * @returns {boolean}
 */
export function isToday(date) {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

/**
 * Timestamp actual
 * @returns {number}
 */
export function now() {
  return Date.now();
}

/**
 * ISO string fecha local (YYYY-MM-DD)
 * @param {Date|number|string} [date=new Date()]
 * @returns {string}
 */
export function toLocalISODate(date = new Date()) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}