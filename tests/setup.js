// ═══════════════════════════════════════════
// tests/setup.js — Configuración global de tests
// ═══════════════════════════════════════════

// Mock DOM APIs
global.window = global;
global.document = {
  getElementById: () => ({
    value: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    addEventListener: () => {},
    innerHTML: '',
    textContent: '',
    setAttribute: () => {},
    getAttribute: () => '',
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
    focus: () => {},
    blur: () => {}
  }),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    setAttribute: () => {},
    appendChild: () => {}
  }),
  body: { style: {}, classList: { add: () => {} } },
  documentElement: { dataset: {}, setAttribute: () => {} },
  addEventListener: () => {},
  dispatchEvent: () => true
};

global.navigator = {
  onLine: true,
  userAgent: 'node',
  serviceWorker: { addEventListener: () => {} },
  vibrate: () => {}
};

global.localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, value) { this._data[key] = String(value); },
  removeItem(key) { delete this._data[key]; },
  clear() { this._data = {}; },
  key(i) { return Object.keys(this._data)[i] || null; },
  get length() { return Object.keys(this._data).length; }
};

global.sessionStorage = { ...global.localStorage };

global.indexedDB = {
  open: () => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({ createIndex: () => {} }),
      transaction: () => ({
        objectStore: () => ({ put: () => ({ onsuccess: null, onerror: null }), get: () => ({ onsuccess: null, onerror: null }), delete: () => ({ onsuccess: null, onerror: null }), clear: () => ({ onsuccess: null, onerror: null }) }),
        oncomplete: null,
        onerror: null
      })
    }
  })
};

global.fetch = async () => ({ 
  ok: true, 
  json: async () => ({}), 
  text: async () => '' 
});

global.Chart = class {
  constructor() {}
  destroy() {}
  update() {}
};

global.lucide = {
  createIcons: () => {}
};

global.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

// Reset all mocks before each test
beforeEach(() => {
  localStorage._data = {};
  sessionStorage._data = {};
  jest.clearAllMocks();
});

// Global test utilities
global.createMockElement = (overrides = {}) => ({
  value: '',
  style: {},
  classList: { 
    _classes: new Set(),
    add(...c) { c.forEach(x => this._classes.add(x)); },
    remove(...c) { c.forEach(x => this._classes.delete(x)); },
    toggle(c, force) { if (force !== undefined) { if (force) this._classes.add(c); else this._classes.delete(c); } else { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); } },
    has(c) { return this._classes.has(c); },
    contains(c) { return this._classes.has(c); }
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  innerHTML: '',
  textContent: '',
  setAttribute: () => {},
  getAttribute: () => '',
  querySelector: () => null,
  querySelectorAll: () => [],
  focus: () => {},
  blur: () => {},
  ...overrides
});

global.mockProduct = (overrides = {}) => ({
  id: 'test_' + Date.now(),
  nombre: 'Producto Test',
  categoria: 'Licores',
  marca: 'Marca Test',
  unidadBase: 'botella',
  precioVentaUnidad: 100,
  costo: 60,
  stockMinUnidades: 24,
  formatosVenta: [
    { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 100, esBase: true }
  ],
  formatosCompra: [],
  lotes: [],
  tieneVencimiento: false,
  vencimiento: null,
  foto: '',
  nota: '',
  ...overrides
});

global.mockVenta = (overrides = {}) => ({
  id: 'venta_' + Date.now(),
  productoId: 'test_1',
  productoNombre: 'Producto Test',
  cantidad: 1,
  precioUnit: 100,
  total: 100,
  costo: 60,
  ganancia: 40,
  pago: 'efectivo',
  fecha: Date.now(),
  ...overrides
});

// Console spy para tests
global.consoleSpy = {
  logs: [],
  warns: [],
  errors: [],
  install() {
    this.originalLog = console.log;
    this.originalWarn = console.warn;
    this.originalError = console.error;
    console.log = (...args) => { this.logs.push(args); this.originalLog(...args); };
    console.warn = (...args) => { this.warns.push(args); this.originalWarn(...args); };
    console.error = (...args) => { this.errors.push(args); this.originalError(...args); };
  },
  uninstall() {
    console.log = this.originalLog;
    console.warn = this.originalWarn;
    console.error = this.originalError;
  },
  clear() { this.logs = []; this.warns = []; this.errors = []; }
};

// ═══════════════════════════════════════════
// GLOBAL UTILITIES (from utils-bundle.js)
// ═══════════════════════════════════════════
global.safeNum = (v, fb) => v == null ? (fb ?? 0) : isNaN(Number(v)) ? (fb ?? 0) : Number(v);
global.escHTML = (s) => {
  if (s == null || s === undefined) return '';
  return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '\u0027');
};
global.safeArr = (v) => Array.isArray(v) ? v : [];
global.genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function parseLocalDate(d) {
  if (d instanceof Date) return d;
  if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}
global.parseLocalDate = parseLocalDate;

global.formatDate = (d) => {
  const dt = parseLocalDate(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
};
global.formatBs = (v, d = 2) => 'Bs. ' + Number(v).toFixed(d);
global.round = (v, d = 2) => { const p = Math.pow(10, d); return Math.round(Number(v) * p) / p; };
global.clamp = (v, min, max) => Math.max(min, Math.min(max, v));
global.truncate = (s, len) => s == null ? '' : s.length > len ? s.slice(0, len - 1) + '\u2026' : s;
global.capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
global.slugify = (s) => s.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
global.uniqueBy = (arr, key) => [...new Map(arr.map(item => [item[key], item])).values()];
global.groupBy = (arr, key) => arr.reduce((acc, item) => {
  acc[item[key]] = acc[item[key]] || [];
  acc[item[key]].push(item);
  return acc;
}, {});
global.sumBy = (arr, key) => arr.reduce((sum, item) => sum + (item[key] || 0), 0);
global.sortBy = (arr, key, order = 'asc') => {
  const sorted = [...arr].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (order === 'desc') return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });
  return sorted;
};
global.find = (arr, predicate) => arr.find(predicate);
global.filter = (arr, predicate) => arr.filter(predicate);
global.$ = () => null;
global.createEl = () => ({
  style: {},
  classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  setAttribute: () => {}, appendChild: () => {}, removeChild: () => {},
  focus: () => {}, blur: () => {}, innerHTML: '', textContent: '',
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener: () => {}, removeEventListener: () => {},
});
global.clearEl = () => ({ innerHTML: '', textContent: '' });
global.toggleClass = () => {};
global.delegate = () => {};
global.show = () => {};
global.scrollToEl = () => {};
global.disableNumberInputWheel = (doc = global.document) => {
  if (!doc || !doc.addEventListener) return;
  doc.addEventListener('wheel', (e) => {
    const isNum = (el) => el && el.tagName === 'INPUT' && (el.type || '').toLowerCase() === 'number';
    if (isNum(doc.activeElement)) doc.activeElement.blur();
    if (isNum(e.target)) e.target.blur();
  }, { passive: true });
};

// ═══════════════════════════════════════════
// DATE UTILITIES
// ═══════════════════════════════════════════
global.formatDateTime = (d) => {
  const dt = new Date(d);
  const dd = dt.getDate().toString().padStart(2, '0');
  const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = dt.getFullYear();
  const h = dt.getHours().toString().padStart(2, '0');
  const min = dt.getMinutes().toString().padStart(2, '0');
  const s = dt.getSeconds().toString().padStart(2, '0');
  return dd + '/' + mm + '/' + yyyy + ' ' + h + ':' + min + ':' + s;
};
global.formatTime = (d) => {
  const dt = new Date(d);
  const h = dt.getHours().toString().padStart(2, '0');
  const m = dt.getMinutes().toString().padStart(2, '0');
  return h + ':' + m;
};
global.daysBetween = (d1, d2) => {
  const a = new Date(d1).getTime();
  const b = new Date(d2).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
};
global.startOfDay = (d) => { const dt = parseLocalDate(d); dt.setHours(0, 0, 0, 0); return dt; };
global.endOfDay = (d) => { const dt = parseLocalDate(d); dt.setHours(23, 59, 59, 999); return dt; };
global.addDays = (d, n) => { const dt = parseLocalDate(d); dt.setDate(dt.getDate() + n); return dt; };
global.isToday = (d) => { const today = new Date(); return parseLocalDate(d).toDateString() === today.toDateString(); };
global.now = () => Date.now();
global.toLocalISODate = (d) => { const dt = parseLocalDate(d); const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,'0'); const dd = String(dt.getDate()).padStart(2,'0'); return y+'-'+m+'-'+dd; };

// ═══════════════════════════════════════════
// STORAGE (from services/storage-service.js)
// ═══════════════════════════════════════════
global.storage = {
  async set(key, value) { localStorage.setItem('tiaeli_' + key, JSON.stringify(value)); },
  async get(key, defaultValue) {
    const raw = localStorage.getItem('tiaeli_' + key);
    if (raw === null) return defaultValue ?? null;
    try { return JSON.parse(raw); } catch { return raw; }
  },
  async remove(key) { localStorage.removeItem('tiaeli_' + key); },
  keys() {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tiaeli_')) result.push(k.replace('tiaeli_', ''));
    }
    return result;
  },
  async clear() { localStorage.clear(); }
};

// ═══════════════════════════════════════════
// BUSINESS LOGIC (from app.js)
// ═══════════════════════════════════════════
global.getTotalUnidadesBase = (p) => {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes)) return global.safeNum(p.stock);
  return p.lotes.reduce((sum, l) => sum + global.safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad), 0);
};
global.getStockTotal = global.getTotalUnidadesBase;
global.getVencimientoMasCercano = (p) => {
  if (!p) return null;
  if (!p.lotes || !Array.isArray(p.lotes) || p.lotes.length === 0) return p.vencimiento || null;
  const activos = p.lotes.filter(l => l && global.safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad) > 0 && l.vencimiento);
  if (!activos.length) return null;
  activos.sort((a, b) => new Date(a.vencimiento) - new Date(b.vencimiento));
  return activos[0].vencimiento;
};
global.getCostoPromedio = (p) => {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes) || p.lotes.length === 0) return global.safeNum(p.costoPromedioUnidad || p.costo);
  const activos = p.lotes.filter(l => l && global.safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad) > 0);
  if (!activos.length) return global.safeNum(p.costoPromedioUnidad || p.costo);
  let totalValor = 0, totalStock = 0;
    activos.forEach(l => {
    const unidades = global.safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad);
    const costoUnit = global.safeNum(l.costoPorUnidad) || (l.costoTotalLote && unidades > 0 ? l.costoTotalLote / unidades : 0);
    totalStock += unidades;
    totalValor += unidades * costoUnit;
  });
  return totalStock > 0 ? totalValor / totalStock : global.safeNum(p.costoPromedioUnidad || p.costo);
};
global.getUnidadesPorEmpaque = (p, empaqueId) => {
  if (!p || !empaqueId) return 1;
  const fmts = [...(p.formatosCompra || []), ...(p.formatosVenta || [])];
  const fmt = fmts.find(f => f.id === empaqueId);
  return fmt ? (fmt.unidades || 1) : 1;
};
global.getNombreEmpaque = (p, empaqueId) => {
  if (!p || !empaqueId) return p?.unidadBase || 'unidad';
  const fmts = [...(p.formatosCompra || []), ...(p.formatosVenta || [])];
  const fmt = fmts.find(f => f.id === empaqueId);
  return fmt ? fmt.nombre : p.unidadBase || 'unidad';
};
global.getPrecioVentaEfectivo = (p) => {
  if (!p) return 0;
  const fmt = (p.formatosVenta || []).find(f => f.esBase);
  return fmt ? global.safeNum(fmt.precio) : global.safeNum(p.precioVentaUnidad);
};
global.getProductoEnOferta = () => null;
global.formatStockDisplay = (p) => {
  if (!p) return '0 u.';
  const total = global.getTotalUnidadesBase(p);
  if (total === 0) return '0 u.';
  const fmts = (p.formatosVenta || []).filter(f => f.unidades > 1);
  if (fmts.length === 0) return total + ' u.';
  const best = fmts.sort((a, b) => b.unidades - a.unidades)[0];
  const paq = Math.floor(total / best.unidades);
  const sueltas = total % best.unidades;
  if (paq > 0 && sueltas === 0) return total + ' u. (' + paq + ' ' + best.nombre + ')';
  if (paq > 0) return paq + ' ' + best.nombre + ' + ' + sueltas + ' u.';
  return total + ' u.';
};
global.toast = () => {};

// ═══════════════════════════════════════════
// SCHEMAS (lightweight Zod-like validation)
// ═══════════════════════════════════════════
(function initSchemas() {
  function ok(data) { return { success: true, data, errors: [] }; }
  function err(errors) { return { success: false, data: null, errors }; }
  function createValidator(parseFn) {
    const validator = {
      parse: (value) => { try { return ok(parseFn(value)); } catch (e) { return err([{ path: '', message: e.message }]); } },
      safeParse: (value) => { try { return ok(parseFn(value)); } catch (e) { return err([{ path: '', message: e.message }]); } },
      pipe: (...modifiers) => createValidator((v) => {
        let result = validator.parse(v);
        if (!result.success) throw new Error(result.errors[0]?.message || 'Validation failed');
        let data = result.data;
        for (const mod of modifiers) {
          if (typeof mod === 'function') { data = mod(data); }
          else if (mod && typeof mod.parse === 'function') { const r = mod.parse(data); if (!r.success) throw new Error(r.errors[0]?.message || 'Validation failed'); data = r.data; }
        }
        return data;
      })
    };
    return validator;
  }
  const string = createValidator((v) => { if (typeof v !== 'string') throw new Error('Debe ser texto'); return v; });
  const number = createValidator((v) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error('Debe ser numero'); return n; });
  const boolean = createValidator((v) => { if (typeof v !== 'boolean') throw new Error('Debe ser booleano'); return v; });
  const date = createValidator((v) => { const d = v instanceof Date ? v : new Date(v); if (isNaN(d.getTime())) throw new Error('Fecha invalida'); return d; });
  function min(minVal, msg) { return (v) => { if (v < minVal) throw new Error(msg || 'Minimo ' + minVal); return v; }; }
  function max(maxVal, msg) { return (v) => { if (v > maxVal) throw new Error(msg || 'Maximo ' + maxVal); return v; }; }
  function positive(msg) { return min(0.01, msg || 'Debe ser positivo'); }
  function nonNegative(msg) { return min(0, msg || 'No puede ser negativo'); }
  function optional(validator) { return createValidator((v) => { if (v === undefined || v === null || v === '') return undefined; return validator.parse(v).data; }); }
  function defaultValue(def, validator) { return createValidator((v) => { if (v === undefined || v === null || v === '') return def; return validator.parse(v).data; }); }
  function transform(fn, validator) { return createValidator((v) => fn(validator.parse(v).data)); }
  function refine(validator, fn, message) { return createValidator((v) => { const result = validator.parse(v); if (!fn(result.data)) throw new Error(message); return result.data; }); }
  function object(shape) {
    return createValidator((input) => {
      if (!input || typeof input !== 'object') throw new Error('Debe ser objeto');
      const result = {}; const errors = [];
      for (const [key, validator] of Object.entries(shape)) {
        const value = input[key]; const res = validator.safeParse(value);
        if (!res.success) errors.push(...res.errors.map(e => ({ path: key, message: e.message })));
        else if (res.data !== undefined) result[key] = res.data;
      }
      if (errors.length) throw { errors };
      return result;
    });
  }
  function array(itemValidator) {
    return createValidator((input) => {
      if (!Array.isArray(input)) throw new Error('Debe ser array');
      const result = []; const errors = [];
      input.forEach((item, index) => {
        const res = itemValidator.safeParse(item);
        if (!res.success) errors.push(...res.errors.map(e => ({ path: '[' + index + ']' + e.path, message: e.message })));
        else result.push(res.data);
      });
      if (errors.length) throw { errors };
      return result;
    });
  }
  function enumValidator(values) { return createValidator((v) => { if (!values.includes(v)) throw new Error('Debe ser uno de: ' + values.join(', ')); return v; }); }
  const ProductoSchema = object({
    nombre: refine(string, v => v.trim().length >= 2, 'Nombre minimo 2 caracteres'),
    categoria: enumValidator(['Licores', 'Cervezas', 'Sodas', 'Jugos', 'Galletas', 'Chicles', 'Snacks', 'Cigarrillos', 'Farmacia', 'Otros']),
    marca: optional(string),
    unidadBase: enumValidator(['unidad', 'botella', 'lata', 'sobre', 'cajetilla', 'paquete', 'litro', 'ml']),
    mlPorUnidad: optional(number).pipe(optional(positive())),
    stockMinUnidades: defaultValue(24, number.pipe(nonNegative())),
    precioVentaUnidad: number.pipe(positive('Precio debe ser > 0')),
    costo: number.pipe(nonNegative()),
    tieneVencimiento: boolean,
    vencimiento: optional(date),
    formatosVenta: array(object({ id: string, nombre: string, unidades: number.pipe(positive()), precio: number.pipe(nonNegative()), esBase: optional(boolean) })),
    formatosCompra: array(object({ id: string, nombre: string, unidades: number.pipe(positive()) }))
  });
  const VentaSchema = object({
    productoId: string, productoNombre: string, cantidad: number.pipe(positive()),
    precioUnit: number.pipe(nonNegative()), total: number.pipe(nonNegative()),
    costo: number.pipe(nonNegative()), ganancia: number,
    pago: enumValidator(['efectivo', 'qr', 'transferencia', 'mixto', 'fiado']),
    nota: optional(string), fecha: date, formatoVenta: optional(string)
  });
  const ClienteSchema = object({ nombre: refine(string, v => v.trim().length >= 2, 'Nombre minimo 2 caracteres'), telefono: optional(string), email: optional(string) });
  const FiadoSchema = object({
    clienteId: string, items: array(object({ productoId: string, productoNombre: string, cantidad: number.pipe(positive()), precioUnit: number.pipe(nonNegative()), esInventario: boolean })),
    monto: number.pipe(positive()), nota: optional(string)
  });
  const ComboSchema = object({
    nombre: refine(string, v => v.trim().length >= 2, 'Nombre minimo 2 caracteres'),
    componentes: array(object({ productoId: string, cantidad: number.pipe(positive()) })),
    precioVenta: number.pipe(positive()), descripcion: optional(string)
  });
  global.z = { string, number, boolean, date, object, array, enum: enumValidator, optional, default: defaultValue, min, max, positive, nonNegative, transform, refine, Producto: ProductoSchema, Venta: VentaSchema, Cliente: ClienteSchema, Fiado: FiadoSchema, Combo: ComboSchema };
})();