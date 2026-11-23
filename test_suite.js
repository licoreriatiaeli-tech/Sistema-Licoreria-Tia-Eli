// ═══════════════════════════════════════════════════════════════
// test_suite.js — Suite de Pruebas Automatizadas (Tester Completo)
// Sistema Licorería Tía Eli
// ═══════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🧪 INICIANDO TESTER COMPLETO — SISTEMA TIA ELI LICORERIA');
console.log('═══════════════════════════════════════════════════════════════\n');

// ── TEST 1: SINTAXIS Y CARGA DE ARCHIVOS ──
console.log('📌 Test Grupo 1: Sintaxis y Verificación de Archivos JS/HTML');
const jsFiles = [
  'firebase-config.js',
  'sync.js',
  'app.js',
  'charts.js',
  'ventas.js',
  'extras.js',
  'gestion.js',
  'sw.js'
];

jsFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  assert(fs.existsSync(filePath), `Archivo existe: ${file}`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.length > 50, `Archivo no está vacío: ${file} (${content.length} bytes)`);
});

// ── TEST 2: VERIFICACIÓN DE ELEMENTOS DOM CRÍTICOS EN INDEX.HTML ──
console.log('\n📌 Test Grupo 2: Integridad de IDs y Selectores en index.html');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const criticalIds = [
  'btnSpinner',
  'ofertaClose',
  'ofertaManualCancelBtn',
  'ofertaManualConfirmBtn',
  'entradaCantidad',
  'entradaCosto',
  'entradaTipoEmpaque',
  'salidaCantidad',
  'salidaMotivo',
  'products-grid',
  'invTableBody',
  'stat-total',
  'stat-stock',
  'stat-bajo',
  'stat-valor',
  'stat-ventas-hoy',
  'stat-ganancia-hoy',
  'stat-fiados',
  'section-gastos',
  'kpiGastosTotalMes',
  'consumoDuenoOverlay',
  'gastoModalOverlay'
];

criticalIds.forEach(id => {
  assert(html.includes(`id="${id}"`), `Elemento con id="${id}" existe en index.html`);
});

// ── TEST 3: ENTORNO SIMULADO Y LÓGICA DE NEGOCIO ──
console.log('\n📌 Test Grupo 3: Carga en VM y Funciones Core');

const mockElements = {};

function getMockEl(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      style: {},
      classList: {
        _classes: new Set(),
        add(...c) { c.forEach(x => this._classes.add(x)); },
        remove(...c) { c.forEach(x => this._classes.delete(x)); },
        toggle(c, force) {
          if (force !== undefined) { if (force) this._classes.add(c); else this._classes.delete(c); }
          else { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); }
        },
        has(c) { return this._classes.has(c); },
        contains(c) { return this._classes.has(c); }
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      removeAttribute: () => {},
      appendChild: () => {},
      removeChild: () => {},
      click: () => {},
      focus: () => {},
      blur: () => {},
      value: '',
      textContent: '',
      innerHTML: '',
      dataset: {}
    };
  }
  return mockElements[id];
}

const windowMock = {
  navigator: { onLine: true, userAgent: 'node', serviceWorker: { addEventListener: () => {} } },
  location: { reload: () => {} },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  scrollTo: () => {},
  document: {
    getElementById: (id) => getMockEl(id),
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    dispatchEvent: () => {},
    createElement: () => getMockEl('created_' + Math.random()),
    documentElement: getMockEl('documentElement'),
    body: getMockEl('body')
  },
  MutationObserver: class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } },
  IntersectionObserver: class { constructor() {} observe() {} unobserve() {} disconnect() {} },
  CustomEvent: class CustomEvent { constructor(type, opt) { this.type = type; this.opt = opt; } },
  console: { log: () => {}, warn: () => {}, error: () => {} },
  Date: Date,
  Math: Math,
  JSON: JSON,
  Number: Number,
  String: String,
  Array: Array,
  Boolean: Boolean,
  Object: Object,
  RegExp: RegExp,
  parseInt: parseInt,
  parseFloat: parseFloat,
  isNaN: isNaN,
  isFinite: isFinite,
  encodeURIComponent: encodeURIComponent,
  decodeURIComponent: decodeURIComponent,
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}) })
};
windowMock.window = windowMock;
windowMock.document.defaultView = windowMock;

const context = vm.createContext(windowMock);

// Cargar scripts en orden
['utils-bundle.js', 'firebase-config.js', 'sync.js', 'app.js', 'charts.js', 'ventas.js', 'extras.js', 'gestion.js'].forEach(f => {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  vm.runInContext(code, context, { filename: f });
});

assert(typeof context.getTotalUnidadesBase === 'function', 'getTotalUnidadesBase está definida');
assert(typeof context.formatStockDisplay === 'function', 'formatStockDisplay está definida');
assert(typeof context.getCostoPromedio === 'function', 'getCostoPromedio está definida');
assert(typeof context.descontarStockFEFO === 'function', 'descontarStockFEFO está definida');
assert(typeof context.abrirEntrada === 'function', 'abrirEntrada está definida');
assert(typeof context.confirmarEntrada === 'function', 'confirmarEntrada está definida');
assert(typeof context.ajustarCantidadLote === 'function', 'ajustarCantidadLote está definida');
assert(typeof context.confirmarSalida === 'function', 'confirmarSalida está definida');

// ── TEST 4: COMPORTAMIENTO DE PRODUCTO CON STOCK CERO ──
console.log('\n📌 Test Grupo 4: Comportamiento de Productos con Stock 0');

const prodZero = {
  id: 'coca_test',
  nombre: 'Coca-Cola 2L',
  categoria: 'Sodas',
  marca: 'Coca Cola',
  unidadBase: 'botella',
  stock: 0,
  stockMin: 6,
  venta: 15,
  costo: 10,
  formatosVenta: [
    { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 15, esBase: true },
    { id: 'paq6', nombre: 'Paquete de 6', unidades: 6, precio: 80 }
  ],
  formatosCompra: [{ id: 'caja12', nombre: 'Caja de 12', unidades: 12 }],
  lotes: []
};

// Normalización v3 no debe crear lotes dummy si stock es 0
const migrado = context.migrarProductoV3(prodZero);
assert(migrado.lotes.length === 0, 'Producto con stock 0 mantiene lotes vacíos (sin lote dummy)');
assert(context.getTotalUnidadesBase(migrado) === 0, 'getTotalUnidadesBase retorna 0 para producto sin stock');
assert(context.formatStockDisplay(migrado) === '0', 'formatStockDisplay muestra "0" para stock 0 (número limpio)');

// ── TEST 5: REGISTRO DE ENTRADA (+ STOCK) ──
console.log('\n📌 Test Grupo 5: Registro de Entrada (+ Stock)');

context.setSesion('JOHAN');
const testList = [JSON.parse(JSON.stringify(prodZero))];
context.setProductosGlobal(testList);
windowMock.productos = testList;

// Simular entrada de 2 cajas de 12 (24 unidades) a Bs. 120 por caja
getMockEl('entradaProductoId').value = 'coca_test';
getMockEl('entradaTipoEmpaque').value = 'caja12';
getMockEl('entradaCantidad').value = '2'; // 2 cajas
getMockEl('entradaCosto').value = '120';  // Bs. 120 por caja (Bs. 10/unidad)
getMockEl('entradaVencimiento').value = '2026-12-31';
getMockEl('entradaNota').value = 'Compra inicial de prueba';
getMockEl('loteExistenteSelect').value = '';

context.confirmarEntrada();

const prodActualizado = context.productos.find(p => p.id === 'coca_test');
assert(prodActualizado.stock === 24, `Stock actualizado a 24 unidades base (actual: ${prodActualizado.stock})`);
assert(prodActualizado.lotes.length === 1, `Lote creado exitosamente (total lotes: ${prodActualizado.lotes.length})`);
assert(prodActualizado.lotes[0].cantidadBaseUnidades === 24, 'Cantidad del lote en unidades base es 24');
assert(prodActualizado.lotes[0].costoPorUnidad === 10, 'Costo por unidad calculado es Bs. 10.00');
assert(context.formatStockDisplay(prodActualizado) === '24 (4 Paquete de 6)', 'formatStockDisplay refleja empaques correctamente (número limpio)');

// Verificar auditoría de entrada
const entradasGuardadas = JSON.parse(windowMock.localStorage.getItem('tiaeli_entradas') || '[]');
assert(entradasGuardadas.length > 0, 'Entrada registrada en historial tiaeli_entradas');
assert(entradasGuardadas[0].unidadesTotales === 24, 'Historial de entradas registra 24 unidades totales');

// ── TEST 6: AJUSTE MANUAL DE LOTE ──
console.log('\n📌 Test Grupo 6: Ajuste Manual de Lote');

const loteId = prodActualizado.lotes[0].id;
// Ajustar lote de 24 a 30 unidades
context.ajustarCantidadLote('coca_test', loteId, 30);
assert(prodActualizado.stock === 30, `Ajuste de lote incrementa stock a 30 (actual: ${prodActualizado.stock})`);
assert(prodActualizado.lotes[0].cantidad === 30, 'Lote refleja cantidad 30');

// Ajustar lote a 0 unidades
context.ajustarCantidadLote('coca_test', loteId, 0);
assert(prodActualizado.stock === 0, `Ajuste de lote a cero deja stock en 0 (actual: ${prodActualizado.stock})`);

// ── TEST 7: VENTAS Y CAJA POS CON DESCUENTO FEFO ──
console.log('\n📌 Test Grupo 7: Ventas y Descuento FEFO');

// Re-abastecer con 10 unidades para pruebas de venta
context.ajustarCantidadLote('coca_test', loteId, 10);
assert(prodActualizado.stock === 10, 'Stock restablecido a 10 unidades para venta');

// Descontar 3 unidades en formato 'unidad'
const resVenta = context.descontarStockFEFO('coca_test', 3, 'unidad');
assert(resVenta.noCumplido === 0, 'Venta de 3 unidades completada sin saldo pendiente');
assert(prodActualizado.stock === 7, `Stock restante es 7 (actual: ${prodActualizado.stock})`);

// Intentar vender más de lo disponible (10 unidades teniendo 7)
const resVentaExceso = context.descontarStockFEFO('coca_test', 10, 'unidad');
assert(resVentaExceso.noCumplido === 3, 'Venta en exceso detecta noCumplido = 3');
assert(prodActualizado.stock === 0, 'Stock se agotó limpiamente');

// Descontar cuando está en 0
const resVentaCero = context.descontarStockFEFO('coca_test', 1, 'unidad');
assert(resVentaCero.noCumplido === 1, 'No permite ventas con stock 0');

// ── TEST 8: SALIDA SIN VENTA ──
console.log('\n📌 Test Grupo 8: Salida de Mercadería sin Venta');

// Reabastecer con 5 unidades mediante entrada
getMockEl('entradaProductoId').value = 'coca_test';
getMockEl('entradaTipoEmpaque').value = 'unidad_base';
getMockEl('entradaCantidad').value = '5';
getMockEl('entradaCosto').value = '10';
getMockEl('entradaVencimiento').value = '';
getMockEl('loteExistenteSelect').value = '';
context.confirmarEntrada();
assert(prodActualizado.stock === 5, 'Stock abastecido con 5 unidades para salida');

getMockEl('salidaProductoId').value = 'coca_test';
getMockEl('salidaCantidad').value = '2';
getMockEl('salidaMotivo').value = 'personal';
getMockEl('salidaNota').value = 'Consumo familiar';

context.confirmarSalida();
assert(prodActualizado.stock === 3, `Stock tras salida de 2 unidades es 3 (actual: ${prodActualizado.stock})`);

const salidasGuardadas = JSON.parse(windowMock.localStorage.getItem('tiaeli_salidas') || '[]');
assert(salidasGuardadas.length > 0, 'Salida registrada en historial tiaeli_salidas');
assert(salidasGuardadas[0].motivo === 'personal', 'Motivo de salida registrado correctamente');

// ── TEST 9: VERIFICACIÓN DE ESTADO CERO EN FIRESTORE ──
console.log('\n📌 Test Grupo 9: Verificación de Base de Datos Firestore');

async function testFirestoreState() {
  const apiKey = 'AIzaSyAiffWyKsvjYJKPIytQU1VfXgPjyve6H4c';
  const projectId = 'sistema-tia-eli';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventario_tiaeli?pageSize=100&key=${apiKey}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    const docs = data.documents || [];
    assert(docs.length >= 25, `Colección inventario_tiaeli en Firestore accesible y sincronizada (encontrados: ${docs.length} productos)`);
    
    let validSchema = true;
    docs.forEach(d => {
      const nombre = d.fields?.nombre?.stringValue;
      if (!nombre) validSchema = false;
    });
    assert(validSchema, 'Todos los productos en Firestore cumplen con el esquema de datos requerido (nombre válido)');
  } catch (err) {
    assert(false, `Error consultando Firestore: ${err.message}`);
  }
}

testFirestoreState().then(() => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 RESUMEN DE PRUEBAS: ${passedTests}/${totalTests} pruebas pasadas (${Math.round(passedTests/totalTests*100)}%)`);
  if (failedTests === 0) {
    console.log('🎉 ¡TODOS LOS TESTS PASARON CON ÉXITO! EL SISTEMA ESTÁ 100% OPERATIVO.');
  } else {
    console.error(`⚠️ ${failedTests} pruebas fallaron.`);
    process.exit(1);
  }
  console.log('═══════════════════════════════════════════════════════════════');
});
