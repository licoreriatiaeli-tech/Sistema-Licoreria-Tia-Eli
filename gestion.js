// ═══════════════════════════════════════════════════════════════
// gestion.js — Módulo de gestión personal: usuarios, sesiones, actividad, fiados, salidas, entradas
// ═══════════════════════════════════════════════════════════════

// ==== UTILIDADES ====
function safeNum(v, fb) { const n = Number(v); return Number.isFinite(n) ? n : (fb ?? 0); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function escHTML(s) {
  if (s == null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "\u0026\u0061\u006d\u0070\u003b")
    .replace(/</g, "\u0026\u006c\u0074\u003b")
    .replace(/>/g, "\u0026\u0067\u0074\u003b")
    .replace(/"/g, "\u0026\u0071\u0075\u006f\u0074\u003b")
    .replace(/'/g, "\u0026\u0023\u0033\u0039\u003b");
}

// ==== USUARIOS Y SESIÓN ====
const DEFAULT_USUARIOS = [
  { id: 'eli', nombre: 'ELI', color: '#16a34a' },
  { id: 'edwin', nombre: 'EDWIN', color: '#2563eb' },
  { id: 'johan', nombre: 'JOHAN', color: '#ea580c' }
];

let usuarios = [];
try {
  usuarios = JSON.parse(localStorage.getItem('tiaeli_usuarios') || '[]');
} catch { usuarios = []; }
if (!usuarios.length) { usuarios = DEFAULT_USUARIOS; localStorage.setItem('tiaeli_usuarios', JSON.stringify(usuarios)); }
window.usuarios = usuarios;

function saveUsuarios() { localStorage.setItem('tiaeli_usuarios', JSON.stringify(usuarios)); window.usuarios = usuarios; }

let sesion = localStorage.getItem('tiaeli_sesion') || null;
function setSesion(nombre) {
  const u = usuarios.find(x => x.nombre.toUpperCase() === nombre.toUpperCase());
  if (!u) return false;
  sesion = u.nombre;
  localStorage.setItem('tiaeli_sesion', sesion);
  actualizarChipUsuario();
  registrarActividad('usuario', 'Sesión iniciada: ' + sesion);
  return true;
}
function getSesion() { return sesion; }
function cerrarSesion() { sesion = null; localStorage.removeItem('tiaeli_sesion'); actualizarChipUsuario(); mostrarLogin(true); }
function usuarioActual() { return sesion; }
window.usuarioActual = usuarioActual;
window.setSesion = setSesion;
window.cerrarSesion = cerrarSesion;

// ==== ACTIVIDAD ====
let actividad = [];
try { actividad = JSON.parse(localStorage.getItem('tiaeli_actividad') || '[]'); } catch { actividad = []; }
const MAX_ACTIVIDAD = 3000;
function saveActividad() { localStorage.setItem('tiaeli_actividad', JSON.stringify(actividad)); window.actividad = actividad; }

function registrarActividad(tipo, detalle) {
  const u = usuarioActual() || 'SISTEMA';
  actividad.unshift({ id: genId(), tipo, detalle: escHTML(detalle), fecha: Date.now(), usuario: u });
  if (actividad.length > MAX_ACTIVIDAD) actividad.length = MAX_ACTIVIDAD;
  saveActividad();
}
window.registrarActividad = registrarActividad;

// ==== LOGIN OVERLAY ====
function renderLoginOverlay() {
  const cont = document.getElementById('loginUsers');
  if (!cont) return;
  cont.innerHTML = usuarios.map(u => (
    '<button class="login-user-btn" onclick="seleccionarUsuario(\'' + u.nombre + '\')" style="--ucolor:' + u.color + '">' +
      '<span class="login-user-avatar">' + u.nombre.charAt(0) + '</span>' +
      '<span class="login-user-name">' + u.nombre + '</span>' +
    '</button>'
  )).join('');
}

function mostrarLogin(forzar) {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  if (!forzar && sesion) { overlay.style.display = 'none'; return; }
  renderLoginOverlay();
  overlay.style.display = 'flex';
}

function seleccionarUsuario(nombre) {
  if (setSesion(nombre)) {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
    if (typeof filterAndRender === 'function') filterAndRender();
    if (typeof renderDashboard === 'function') renderDashboard();
  }
}
window.seleccionarUsuario = seleccionarUsuario;
window.mostrarLogin = mostrarLogin;

// ==== CHIP DE USUARIO (sidebar + topbar) ====
function actualizarChipUsuario() {
  const chip = document.getElementById('userChip');
  const mobile = document.getElementById('userChipMobile');
  if (chip) {
    if (sesion) {
      const u = usuarios.find(x => x.nombre === sesion) || { color: '#888' };
      chip.innerHTML = '<span class="user-avatar" style="background:' + u.color + '">' + sesion.charAt(0) + '</span><span class="user-name">' + sesion + '</span><span class="user-switch" onclick="mostrarLogin(true)" title="Cambiar usuario">⇄</span>';
      chip.style.display = 'flex';
    } else {
      chip.style.display = 'none';
    }
  }
  if (mobile) {
    if (sesion) {
      const u = usuarios.find(x => x.nombre === sesion) || { color: '#888' };
      mobile.innerHTML = '<span class="user-avatar" style="background:' + u.color + '">' + sesion.charAt(0) + '</span>';
      mobile.style.display = 'flex';
    } else {
      mobile.style.display = 'none';
    }
  }
}

// ==== CLIENTES ====
let clientes = [];
try { clientes = JSON.parse(localStorage.getItem('tiaeli_clientes') || '[]'); } catch { clientes = []; }
window.clientes = clientes;

function saveClientes() { localStorage.setItem('tiaeli_clientes', JSON.stringify(clientes)); window.clientes = clientes; }
window.setClientesGlobal = function(nuevos) { clientes = nuevos; window.clientes = nuevos; };

// ==== FIADOS ====
let fiados = [];
try { fiados = JSON.parse(localStorage.getItem('tiaeli_fiados') || '[]'); } catch { fiados = []; }
window.fiados = fiados;

function saveFiados() { localStorage.setItem('tiaeli_fiados', JSON.stringify(fiados)); window.fiados = fiados; }
window.setFiadosGlobal = function(nuevos) { fiados = nuevos; window.fiados = nuevos; };

// ==== PAGOS ====
let pagos = [];
try { pagos = JSON.parse(localStorage.getItem('tiaeli_pagos') || '[]'); } catch { pagos = []; }
window.pagos = pagos;

function savePagos() { localStorage.setItem('tiaeli_pagos', JSON.stringify(pagos)); window.pagos = pagos; }
window.setPagosGlobal = function(nuevos) { pagos = nuevos; window.pagos = nuevos; };

// ==== HELPERS DE STOCK ====
function getStockTotal(p) {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes)) return safeNum(p.stock);
  return p.lotes.reduce((sum, l) => sum + safeNum(l && l.cantidad), 0);
}
function getVencimientoMasCercano(p) {
  if (!p) return null;
  if (!p.lotes || !Array.isArray(p.lotes) || p.lotes.length === 0) return p.vencimiento || null;
  const activos = p.lotes.filter(l => l && safeNum(l.cantidad) > 0 && l.vencimiento);
  if (!activos.length) return null;
  activos.sort((a, b) => new Date(a.vencimiento) - new Date(b.vencimiento));
  return activos[0].vencimiento;
}
function getCostoPromedio(p) {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes) || p.lotes.length === 0) return safeNum(p.costo);
  const activos = p.lotes.filter(l => l && safeNum(l.cantidad) > 0);
  if (!activos.length) return safeNum(p.costo);
  const totalValor = activos.reduce((s, l) => s + (safeNum(l.cantidad) * safeNum(l.costo)), 0);
  const totalStock = activos.reduce((s, l) => s + safeNum(l.cantidad), 0);
  return totalStock > 0 ? totalValor / totalStock : 0;
}

// ==== SALDOS CLIENTE ====
function calcularSaldoCliente(clienteId) {
  const totalFiados = fiados.filter(f => f.clienteId === clienteId).reduce((s, f) => s + safeNum(f.monto), 0);
  const totalPagos = pagos.filter(p => p.clienteId === clienteId).reduce((s, p) => s + safeNum(p.monto), 0);
  return totalFiados - totalPagos;
}

function actualizarBadgesFiados() {
  const badge = document.getElementById('badge-fiados');
  const clientesConDeuda = clientes.filter(c => calcularSaldoCliente(c.id) > 0.01).length;
  if (badge) {
    if (clientesConDeuda > 0) {
      badge.textContent = clientesConDeuda;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }
  // Stats en section-fiados
  const totalPendiente = clientes.reduce((s, c) => s + Math.max(0, calcularSaldoCliente(c.id)), 0);
  const totalCobrado = pagos.reduce((s, p) => s + safeNum(p.monto), 0);
  const elPend = document.getElementById('fiadoTotalPendiente');
  const elCobr = document.getElementById('fiadoTotalCobrado');
  const elClie = document.getElementById('fiadoClientesDeuda');
  const elFido = document.getElementById('fiadoTotalFiados');
  if (elPend) elPend.textContent = 'Bs. ' + totalPendiente.toFixed(2);
  if (elCobr) elCobr.textContent = 'Bs. ' + totalCobrado.toFixed(2);
  if (elClie) elClie.textContent = clientes.filter(c => calcularSaldoCliente(c.id) > 0.01).length;
  if (elFido) elFido.textContent = fiados.length;
}

// ==== SALIDAS (sin venta) ====
let salidaProductoId = null;

function abrirSalida(productoId) {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  const p = window.productos ? window.productos.find(x => x.id === productoId) : null;
  if (!p) { toast('Producto no encontrado', 'error'); return; }
  salidaProductoId = productoId;
  const stock = getStockTotal(p);
  document.getElementById('salidaProductoId').value = productoId;
  document.getElementById('salidaProductoNombre').textContent = p.nombre;
  document.getElementById('salidaStockDisp').textContent = stock + ' ' + (p.unidad || 'ud');
  document.getElementById('salidaCantidad').value = '';
  document.getElementById('salidaCantidad').max = stock;
  document.getElementById('salidaMotivo').value = 'personal';
  document.getElementById('salidaNota').value = '';
  document.getElementById('salidaModalTitle').textContent = 'Registrar Salida — ' + p.nombre;
  document.getElementById('salidaOverlay').style.display = 'flex';
}
window.abrirSalida = abrirSalida;

function confirmarSalida() {
  const pid = document.getElementById('salidaProductoId').value;
  const cantidad = safeNum(document.getElementById('salidaCantidad').value);
  const motivo = document.getElementById('salidaMotivo').value;
  const nota = document.getElementById('salidaNota').value.trim();
  if (!pid || !cantidad || cantidad <= 0) { toast('Cantidad inválida', 'error'); return; }
  const p = window.productos.find(x => x.id === pid);
  if (!p) { toast('Producto no encontrado', 'error'); return; }
  const stock = getStockTotal(p);
  if (cantidad > stock) { toast('Stock disponible: ' + stock + ' ' + (p.unidad || 'ud'), 'error'); return; }

  let lotesAfectados = [];
  let noCumplido = 0;
  if (typeof descontarStockFEFO === 'function') {
    const res = descontarStockFEFO(pid, cantidad);
    lotesAfectados = res.lotesAfectados || [];
    noCumplido = res.noCumplido || 0;
  } else {
    noCumplido = cantidad;
    for (const lote of p.lotes) {
      if (lote.cantidad <= 0) continue;
      const d = Math.min(lote.cantidad, cantidad);
      lote.cantidad -= d;
      cantidad -= d;
      lotesAfectados.push({ vencimiento: lote.vencimiento, cantidadDescontada: d, costoUnitario: lote.costo || p.costo || 0 });
      if (cantidad <= 0) break;
    }
    noCumplido = cantidad;
  }

  if (noCumplido > 0) { toast('No se pudo descontar todo el stock (FEFO)', 'warning'); }

  p.stock = getStockTotal(p);
  p.vencimiento = getVencimientoMasCercano(p);
  p.costo = getCostoPromedio(p);
  p.updatedAt = Date.now();

  let salidas = [];
  try { salidas = JSON.parse(localStorage.getItem('tiaeli_salidas') || '[]'); } catch { salidas = []; }
  salidas.unshift({
    id: genId(),
    productoId: pid,
    productoNombre: p.nombre,
    cantidad: safeNum(document.getElementById('salidaCantidad').value),
    motivo: document.getElementById('salidaMotivo').value,
    nota: document.getElementById('salidaNota').value.trim(),
    fecha: Date.now(),
    usuario: usuarioActual(),
    lotesAfectados
  });
  localStorage.setItem('tiaeli_salidas', JSON.stringify(salidas));

  registrarActividad('salida', 'Salida: ' + p.nombre + ' (' + safeNum(document.getElementById('salidaCantidad').value) + ' ' + (p.unidad || 'ud') + ') — Motivo: ' + motivo);

  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  if (typeof window.syncSaveSalida === 'function') window.syncSaveSalida(salidas[0]);

  document.getElementById('salidaOverlay').style.display = 'none';
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();
  toast('Salida registrada', 'success');
}

// ==== ENTRADAS (agregar stock) ====
let entradaProductoId = null;

function abrirEntrada(productoId) {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  const p = window.productos ? window.productos.find(x => x.id === productoId) : null;
  if (!p) { toast('Producto no encontrado', 'error'); return; }
  entradaProductoId = productoId;
  const stock = getStockTotal(p);
  document.getElementById('entradaProductoId').value = productoId;
  document.getElementById('entradaProductoNombre').value = p.nombre;
  document.getElementById('entradaStockActual').value = stock + ' ' + (p.unidad || 'ud');
  // Populate display fields
  const nombre2El = document.getElementById('entradaProductoNombre2');
  if (nombre2El) nombre2El.textContent = p.nombre;
  const stock2El = document.getElementById('entradaStockActual2');
  if (stock2El) stock2El.textContent = stock + ' ' + (p.unidad || 'ud');
  document.getElementById('entradaCantidad').value = '';
  // Round cost to 2 decimals for display
  const costoVal = p.costo ? parseFloat(Number(p.costo).toFixed(2)) : '';
  document.getElementById('entradaCosto').value = costoVal;
  document.getElementById('entradaVencimiento').value = '';
  document.getElementById('entradaProveedor').value = '';
  document.getElementById('entradaNota').value = '';
  document.getElementById('entradaModalTitle').textContent = 'Registrar Entrada';
  // Hide cost summary until fields are filled
  const resumenEl = document.getElementById('entradaResumen');
  if (resumenEl) resumenEl.style.display = 'none';
  document.getElementById('entradaOverlay').style.display = 'flex';
  // Setup cost calculation listeners
  setupEntradaCostCalc();
}
window.abrirEntrada = abrirEntrada;

function setupEntradaCostCalc() {
  const cantEl = document.getElementById('entradaCantidad');
  const costoEl = document.getElementById('entradaCosto');
  const resumenEl = document.getElementById('entradaResumen');
  if (!cantEl || !costoEl || !resumenEl) return;
  const calc = () => {
    const cant = parseFloat(cantEl.value) || 0;
    const costo = parseFloat(costoEl.value) || 0;
    if (cant > 0 && costo > 0) {
      resumenEl.style.display = 'block';
      document.getElementById('entradaResumenUnit').textContent = 'Bs. ' + costo.toFixed(2);
      document.getElementById('entradaResumenQty').textContent = cant;
      document.getElementById('entradaResumenTotal').textContent = 'Bs. ' + (cant * costo).toFixed(2);
    } else {
      resumenEl.style.display = 'none';
    }
  };
  // Remove old listeners by cloning
  const newCant = cantEl.cloneNode(true);
  cantEl.parentNode.replaceChild(newCant, cantEl);
  const newCosto = costoEl.cloneNode(true);
  costoEl.parentNode.replaceChild(newCosto, costoEl);
  newCant.addEventListener('input', calc);
  newCosto.addEventListener('input', calc);
  calc();
}

function confirmarEntrada() {
  const pid = document.getElementById('entradaProductoId').value;
  const cantidad = safeNum(document.getElementById('entradaCantidad').value);
  const costo = safeNum(document.getElementById('entradaCosto').value);
  const vencimiento = document.getElementById('entradaVencimiento').value;
  const proveedor = document.getElementById('entradaProveedor').value.trim();
  const nota = document.getElementById('entradaNota').value.trim();
  if (!pid || !cantidad || cantidad <= 0 || costo < 0) { toast('Datos inválidos', 'error'); return; }
  const p = window.productos.find(x => x.id === pid);
  if (!p) { toast('Producto no encontrado', 'error'); return; }

  if (!p.lotes) p.lotes = [];
  p.lotes.push({
    id: genId(),
    cantidad: cantidad,
    costo: costo,
    vencimiento: vencimiento || '',
    fechaIngreso: new Date().toISOString().slice(0, 10),
    nota: nota || (proveedor ? 'Proveedor: ' + proveedor : '')
  });

  p.stock = getStockTotal(p);
  p.vencimiento = getVencimientoMasCercano(p);
  p.costo = getCostoPromedio(p);
  p.updatedAt = Date.now();

  let entradas = [];
  try { entradas = JSON.parse(localStorage.getItem('tiaeli_entradas') || '[]'); } catch { entradas = []; }
  entradas.unshift({
    id: genId(),
    productoId: pid,
    productoNombre: p.nombre,
    cantidad: cantidad,
    costo: costo,
    vencimiento: vencimiento,
    proveedor: proveedor,
    nota: nota,
    fecha: Date.now(),
    usuario: usuarioActual()
  });
  localStorage.setItem('tiaeli_entradas', JSON.stringify(entradas));

  registrarActividad('entrada', 'Entrada: ' + p.nombre + ' (+' + cantidad + ' ' + (p.unidad || 'ud') + ') — Costo: Bs.' + costo.toFixed(2) + (vencimiento ? ' Vence: ' + vencimiento : ''));

  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  if (typeof window.syncSaveEntrada === 'function') window.syncSaveEntrada(entradas[0]);

  document.getElementById('entradaOverlay').style.display = 'none';
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();
  toast('Entrada registrada', 'success');
}

// ==== FIADOS - LÓGICA COMPLETA ====

function renderFiados() {
  actualizarBadgesFiados();
  renderFiadosLista();
}

function renderFiadosLista() {
  const cont = document.getElementById('fiadoClientesList');
  if (!cont) return;
  const q = (document.getElementById('fiadoSearch')?.value || '').toLowerCase();
  let lista = [...clientes];
  if (q) lista = lista.filter(c => c.nombre.toLowerCase().includes(q));
  
  if (!lista.length) {
    cont.innerHTML = '<div class="empty-state" style="padding:30px"><span class="es-icon">👥</span><p>No hay clientes registrados.</p><button class="btn btn-primary" onclick="abrirFiadoModal()">+ Crear primer cliente con fiado</button></div>';
    return;
  }
  
  cont.innerHTML = lista.map(c => {
    const saldo = calcularSaldoCliente(c.id);
    const claseSaldo = saldo > 0.01 ? 'deuda' : 'al-dia';
    const textoSaldo = saldo > 0.01 ? 'Bs. ' + saldo.toFixed(2) : 'Al día';
    const fiadosCliente = fiados.filter(f => f.clienteId === c.id).length;
    return `
      <div class="fiado-cliente-card">
        <div class="fiado-cliente-info">
          <div class="fiado-cliente-nombre">${escHTML(c.nombre)}</div>
          <div class="fiado-cliente-meta">
            <span>${fiadosCliente} fiado${fiadosCliente !== 1 ? 's' : ''}</span>
            <span>${c.telefono ? '📞 ' + escHTML(c.telefono) : ''}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span class="fiado-saldo ${saldo > 0.01 ? 'deuda' : 'al-dia'}">${saldo > 0.01 ? 'Bs. ' + saldo.toFixed(2) : 'Al día'}</span>
          <div class="fiado-actions">
            ${saldo > 0.01 ? '<button class="fiado-btn cobrar" onclick="abrirCobrarModal(\'' + c.id + '\')"><i data-lucide="circle-dollar-sign"></i> Cobrar</button>' : ''}
            <button class="fiado-btn ver" onclick="abrirExpedienteModal(\'' + c.id + '\')"><i data-lucide="book-open"></i> Ver</button>
            <button class="fiado-btn eliminar" onclick="eliminarCliente(\'' + c.id + '\')"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}
window.renderFiados = renderFiados;

function filtrarFiados() {
  renderFiadosLista();
}

// ==== FIADO MODULO SIMPLIFICADO ====
// Variables de estado para fiado en curso
let fiadoItems = [];
let fiadoClienteNombre = '';

function abrirFiadoModal() {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  fiadoItems = [];
  fiadoClienteNombre = '';
  document.getElementById('fiadoClienteNombre').value = '';
  document.getElementById('fiadoItemsList').innerHTML = '';
  document.getElementById('fiadoTotalDisplay').textContent = 'Bs. 0.00';
  document.getElementById('fiadoModalTitle').textContent = 'Nuevo Fiado';
  document.getElementById('fiadoOverlay').style.display = 'flex';
  // Focus en cliente
  setTimeout(() => document.getElementById('fiadoClienteNombre').focus(), 100);
}
window.abrirFiadoModal = abrirFiadoModal;

function cerrarFiadoModal() {
  document.getElementById('fiadoOverlay').style.display = 'none';
  fiadoItems = [];
  fiadoClienteNombre = '';
}
window.cerrarFiadoModal = cerrarFiadoModal;

// Buscar productos del inventario para sugerencias
function buscarProductoFiadoSimple(valor) {
  const cont = document.getElementById('fiadoProductoSugerencias');
  if (!cont) return;
  const q = valor.toLowerCase().trim();
  if (!q) { cont.style.display = 'none'; return; }
  const matches = (window.productos || []).filter(p => 
    (p.nombre + ' ' + (p.marca || '') + ' ' + (p.presentacion || '')).toLowerCase().includes(q) && getStockTotal(p) > 0
  ).slice(0, 8);
  if (!matches.length) {
    cont.innerHTML = '<div class="search-result-item" style="justify-content:center;color:var(--text3)">Sin stock. Podés escribir nombre libre.</div>';
    cont.style.display = 'block';
    return;
  }
  cont.innerHTML = matches.map(p => `
    <div class="search-result-item" onclick="agregarProductoFiadoDesdeInventario('${p.id}')">
      <div class="search-result-info">
         <span class="search-result-name">${escHTML(p.nombre)} ${p.presentacion ? ' - ' + escHTML(p.presentacion) : ''} ${p.marca ? '(' + escHTML(p.marca) + ')' : ''}</span>
         <span class="search-result-meta">${[p.marca, p.presentacion, p.unidad].filter(Boolean).join(' / ')} · Stock: <b>${getStockTotal(p)}</b> · Venta: Bs.${(p.venta || 0).toFixed(2)}</span>
      </div>
      <span class="search-result-action">+</span>
    </div>
  `).join('');
  cont.style.display = 'block';
}
window.buscarProductoFiadoSimple = buscarProductoFiadoSimple;

function agregarProductoFiadoDesdeInventario(productoId) {
  const p = (window.productos || []).find(x => x.id === productoId);
  if (!p) return;
  const stock = getStockTotal(p);
  if (stock <= 0) { toast('Sin stock', 'warning'); return; }
  const existing = fiadoItems.find(i => i.productoId === productoId);
  if (existing) {
    if (existing.cantidad >= stock) { toast('Máximo stock disponible: ' + stock, 'warning'); return; }
    existing.cantidad++;
  } else {
     fiadoItems.push({ productoId: p.id, productoNombre: p.nombre, presentacion: p.presentacion || '', marca: p.marca || '', cantidad: 1, precioUnit: p.venta, esInventario: true });
  }
  document.getElementById('fiadoProductoNombre').value = '';
  document.getElementById('fiadoProductoSugerencias').style.display = 'none';
  renderFiadoItems();
}
window.agregarProductoFiadoDesdeInventario = agregarProductoFiadoDesdeInventario;

function renderFiadoItems() {
  const cont = document.getElementById('fiadoItemsList');
  if (!cont) return;
  if (!fiadoItems.length) {
    cont.innerHTML = '<p style="color:var(--text3);font-size:.8rem;text-align:center;padding:20px">Agregá productos escribiendo arriba</p>';
    document.getElementById('fiadoTotalDisplay').textContent = 'Bs. 0.00';
    return;
  }
  let total = 0;
  cont.innerHTML = fiadoItems.map((item, idx) => {
    const subtotal = item.cantidad * item.precioUnit;
    total += subtotal;
    const tag = item.esInventario ? '<span style="font-size:.6rem;background:var(--green-bg);color:var(--green);padding:2px 6px;border-radius:4px">Inv.</span>' : '<span style="font-size:.6rem;background:var(--orange-bg);color:var(--orange);padding:2px 6px;border-radius:4px">Libre</span>';
    return `
      <div class="fiado-producto-row">
        <div class="fiado-producto-info">
          <div class="fiado-producto-nombre">${escHTML(item.productoNombre)}${item.presentacion || item.marca ? ' <span style="font-weight:400;color:var(--text3)">' + escHTML([item.marca, item.presentacion].filter(Boolean).join(' / ')) + '</span>' : ''} ${tag}</div>
          <div class="fiado-producto-detalle">
            <span>Precio: Bs.${item.precioUnit.toFixed(2)}</span>
            <span>Subtotal: Bs.${subtotal.toFixed(2)}</span>
          </div>
        </div>
        <div class="fiado-producto-cantidad">${item.cantidad} ud</div>
        <div class="fiado-producto-actions">
          <button class="btn-icon" onclick="cambiarCantidadFiado(${idx}, -1)" title="Restar">−</button>
          <button class="btn-icon danger" onclick="removerProductoFiado(${idx})" title="Quitar">✕</button>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('fiadoTotalDisplay').textContent = 'Bs. ' + total.toFixed(2);
}

function cambiarCantidadFiado(idx, delta) {
  const item = fiadoItems[idx];
  if (!item) return;
  let stockMax = 999;
  if (item.esInventario) {
    const p = (window.productos || []).find(x => x.id === item.productoId);
    stockMax = p ? getStockTotal(p) : 999;
  }
  const nueva = item.cantidad + delta;
  if (nueva <= 0) { fiadoItems.splice(idx, 1); }
  else if (nueva > stockMax) { toast('Máximo disponible: ' + stockMax, 'warning'); return; }
  else { item.cantidad = nueva; }
  renderFiadoItems();
}
window.cambiarCantidadFiado = cambiarCantidadFiado;

function removerProductoFiado(idx) {
  fiadoItems.splice(idx, 1);
  renderFiadoItems();
}
window.removerProductoFiado = removerProductoFiado;

// Agregar producto libre (no del inventario)
function agregarProductoFiadoLibre() {
  const input = document.getElementById('fiadoProductoNombre');
  const nombre = input.value.trim();
  const precio = safeNum(document.getElementById('fiadoProductoPrecio').value);
  const cantidad = safeNum(document.getElementById('fiadoProductoCantidad').value);
  if (!nombre || precio <= 0 || cantidad <= 0) { toast('Completá nombre, precio y cantidad', 'error'); return; }
  fiadoItems.push({ productoId: 'libre_' + genId(), productoNombre: nombre, cantidad: cantidad, precioUnit: precio, esInventario: false });
  input.value = '';
  document.getElementById('fiadoProductoPrecio').value = '';
  document.getElementById('fiadoProductoCantidad').value = '';
  renderFiadoItems();
}
window.agregarProductoFiadoLibre = agregarProductoFiadoLibre;

// Guardar fiado simplificado
function guardarFiado() {
  const clienteNombre = document.getElementById('fiadoClienteNombre').value.trim();
  if (!clienteNombre) { toast('Poné el nombre del cliente', 'error'); return; }
  if (!fiadoItems.length) { toast('Agregá al menos un producto', 'error'); return; }
  if (!sesion) { toast('Iniciá sesión primero', 'warning'); return; }

  // Validar stock para items de inventario
  for (const item of fiadoItems) {
    if (item.esInventario) {
      const p = window.productos.find(x => x.id === item.productoId);
      if (!p) { toast('Producto no existe: ' + item.productoNombre, 'error'); return; }
      if (getStockTotal(p) < item.cantidad) { toast('Stock insuficiente de ' + item.productoNombre, 'error'); return; }
    }
  }

  // Buscar o crear cliente por nombre (simple)
  let cliente = clientes.find(c => c.nombre.toLowerCase() === clienteNombre.toLowerCase());
  if (!cliente) {
    cliente = { id: genId(), nombre: clienteNombre, telefono: '', creado: Date.now(), creadoPor: usuarioActual() };
    clientes.unshift(cliente);
    saveClientes();
  }
  const clienteId = cliente.id;

  // Descontar stock FEFO para items de inventario
  const todosLotesAfectados = [];
  for (const item of fiadoItems) {
    if (item.esInventario && typeof descontarStockFEFO === 'function') {
      const res = descontarStockFEFO(item.productoId, item.cantidad);
      (res.lotesAfectados || []).forEach(l => { l.fiadoItemNombre = item.productoNombre; todosLotesAfectados.push(l); });
    }
  }

  // Recalcular productos afectados
  const productosAfectados = new Set(fiadoItems.filter(i => i.esInventario).map(i => i.productoId));
  for (const pid of productosAfectados) {
    const p = window.productos.find(x => x.id === pid);
    if (p) {
      p.stock = getStockTotal(p);
      p.vencimiento = getVencimientoMasCercano(p);
      p.costo = getCostoPromedio(p);
      p.updatedAt = Date.now();
      if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
    }
  }

  // Crear fiado
  const montoTotal = fiadoItems.reduce((s, i) => s + i.cantidad * i.precioUnit, 0);
  const fiado = {
    id: genId(),
    clienteId: cliente.id,
     items: fiadoItems.map(i => ({ productoId: i.productoId, productoNombre: i.productoNombre, presentacion: i.presentacion||'', marca: i.marca||'', cantidad: i.cantidad, precioUnit: i.precioUnit, esInventario: i.esInventario })),
    monto: montoTotal,
    fecha: Date.now(),
    usuario: usuarioActual(),
    lotesAfectados: todosLotesAfectados
  };
  fiados.unshift(fiado);
  saveFiados();

  registrarActividad('fiado', 'Fiado a ' + clienteNombre + ' — Bs.' + montoTotal.toFixed(2) + ' (' + fiadoItems.length + ' productos)');

  if (typeof save === 'function') save();
  if (typeof window.syncSaveFiado === 'function') window.syncSaveFiado(fiado);

  cerrarFiadoModal();
  renderFiados();
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();
  toast('Fiado registrado: Bs.' + montoTotal.toFixed(2), 'success');
}
window.guardarFiado = guardarFiado;

// ==== COBRAR / ABONAR ====
function abrirCobrarModal(clienteId) {
  if (!sesion) { toast('Inicia sesión primero', 'warning'); return; }
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;
  const saldo = calcularSaldoCliente(clienteId);
  if (saldo <= 0.01) { toast('Cliente sin deuda', 'info'); return; }
  document.getElementById('cobrarClienteId').value = clienteId;
  document.getElementById('cobrarClienteNombre').textContent = c.nombre;
  document.getElementById('cobrarSaldoTexto').textContent = 'Saldo: Bs. ' + saldo.toFixed(2);
  document.getElementById('cobrarMonto').value = saldo.toFixed(2);
  document.getElementById('cobrarMonto').max = saldo.toFixed(2);
  document.getElementById('cobrarMetodo').value = 'efectivo';
  document.getElementById('cobrarNota').value = '';
  document.getElementById('cobrarModalTitle').textContent = 'Cobrar a ' + c.nombre;
  document.getElementById('cobrarOverlay').style.display = 'flex';
}
window.abrirCobrarModal = abrirCobrarModal;

function cerrarCobrarModal() {
  document.getElementById('cobrarOverlay').style.display = 'none';
}
window.cerrarCobrarModal = cerrarCobrarModal;

function registrarPago() {
  const clienteId = document.getElementById('cobrarClienteId').value;
  const monto = safeNum(document.getElementById('cobrarMonto').value);
  const metodo = document.getElementById('cobrarMetodo').value;
  const nota = document.getElementById('cobrarNota').value.trim();
  if (!clienteId || !monto || monto <= 0) { toast('Monto inválido', 'error'); return; }
  const saldo = calcularSaldoCliente(clienteId);
  if (monto > saldo + 0.01) { toast('Monto excede la deuda (Bs. ' + saldo.toFixed(2) + ')', 'error'); return; }

  const c = clientes.find(x => x.id === clienteId);
  const pago = {
    id: genId(),
    clienteId,
    monto,
    metodo,
    nota,
    fecha: Date.now(),
    usuario: usuarioActual()
  };
  pagos.unshift(pago);
  savePagos();

  registrarActividad('pago', 'Abono de ' + c.nombre + ' — Bs.' + monto.toFixed(2) + ' (' + metodo + ')');

  if (typeof window.syncSavePago === 'function') window.syncSavePago(pago);

  // Si el saldo llega a 0, registrar fiados pagados como ventas
  const nuevoSaldo = calcularSaldoCliente(clienteId);
  if (nuevoSaldo <= 0.01) {
    const fiadosNoCobrados = fiados.filter(f => f.clienteId === clienteId && !f.cobrado);
    for (const f of fiadosNoCobrados) {
      f.cobrado = true;
      // Crear venta por cada item del fiado
      for (const item of (f.items || [])) {
        const lotesItem = (f.lotesAfectados || []).filter(l => l.fiadoItemNombre === item.productoNombre);
        const costoItem = lotesItem.reduce((s, l) => s + (l.cantidadDescontada || 0) * (l.costoUnitario || 0), 0);
        const subtotal = item.cantidad * item.precioUnit;
        const venta = {
          id: genId(),
          tipo: 'individual',
          productoId: item.productoId,
          productoNombre: item.productoNombre,
          productomarca: item.marca || '',
          presentacion: item.presentacion || '',
          categoria: 'Fiado',
          cantidad: item.cantidad,
          cantidadPacks: 1,
          packLabel: '',
          precioUnit: item.precioUnit,
          subtotal: subtotal,
          descuento: 0,
          total: subtotal,
          costo: costoItem,
          ganancia: subtotal - costoItem,
          pago: 'fiado',
          nota: 'Fiado cobrado — ' + c.nombre,
          fecha: Date.now(),
          fechaRegistro: Date.now(),
          clienteId: clienteId,
          fiadoId: f.id,
          lotesAfectados: lotesItem
        };
        window.ventas.unshift(venta);
        if (typeof window.syncSaveVenta === 'function') window.syncSaveVenta(venta);
      }
      if (typeof window.syncSaveFiado === 'function') window.syncSaveFiado(f);
    }
    if (fiadosNoCobrados.length) {
      saveFiados();
      saveVentas();
      registrarActividad('venta', 'Fiados de ' + c.nombre + ' registrados como venta (' + fiadosNoCobrados.length + ' fiados)');
      if (typeof renderVentasHoy === 'function') renderVentasHoy();
      if (typeof renderVentasStats === 'function') renderVentasStats();
    }
  }

  cerrarCobrarModal();
  renderFiados();
  actualizarBadgesFiados();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast('Cobro registrado: Bs.' + monto.toFixed(2), 'success');
}
window.registrarPago = registrarPago;

// ==== EXPEDIENTE CLIENTE ====
function abrirExpedienteModal(clienteId) {
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;
  const saldo = calcularSaldoCliente(clienteId);
  const fiadosCliente = fiados.filter(f => f.clienteId === clienteId);
  const pagosCliente = pagos.filter(p => p.clienteId === clienteId);
  
  document.getElementById('expClienteNombre').textContent = c.nombre;
  document.getElementById('expClienteTelefono').textContent = c.telefono ? '📞 ' + c.telefono : 'Sin teléfono';
  const claseSaldo = saldo > 0.01 ? 'deuda' : 'al-dia';
  document.getElementById('expSaldoTotal').innerHTML = 'Saldo total: <span class="fiado-saldo ' + claseSaldo + '">' + (saldo > 0.01 ? 'Bs. ' + saldo.toFixed(2) : 'Al día') + '</span>';
  
  // Fiados
  const contF = document.getElementById('expFiadosList');
  if (fiadosCliente.length === 0) {
    contF.innerHTML = '<p style="color:var(--text3);padding:12px;text-align:center">Sin fiados registrados</p>';
  } else {
    contF.innerHTML = fiadosCliente.map(f => {
       const itemsHtml = f.items.map(it => '<span class="fiado-item-detalle" style="margin:0 8px">' + it.cantidad + 'x ' + escHTML(it.productoNombre) + (it.presentacion ? ' (' + escHTML(it.presentacion) + ')' : '') + ' @ Bs.' + it.precioUnit.toFixed(2) + '</span>').join('<br>');
       const cobradoBadge = f.cobrado ? '<span style="font-size:.6rem;background:var(--green-bg);color:var(--green);padding:2px 6px;border-radius:4px;margin-left:8px">COBRADO</span>' : '';
      return `
        <div class="fiado-item-row" style="${f.cobrado ? 'opacity:0.6' : ''}">
          <div class="fiado-item-info">
            <div class="fiado-item-nombre">Fiado ${new Date(f.fecha).toLocaleDateString('es-BO')} — por ${f.usuario}${cobradoBadge}</div>
            <div class="fiado-item-detalle">${itemsHtml}</div>
          </div>
          <div class="fiado-item-monto">Bs. ${f.monto.toFixed(2)}</div>
          <div class="fiado-item-fecha">${new Date(f.fecha).toLocaleTimeString('es-BO', {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      `;
    }).join('');
  }
  
  // Pagos
  const contP = document.getElementById('expPagosList');
  if (pagosCliente.length === 0) {
    contP.innerHTML = '<p style="color:var(--text3);padding:12px;text-align:center">Sin abonos registrados</p>';
  } else {
    contP.innerHTML = pagosCliente.map(p => `
      <div class="pago-item-row">
        <div class="pago-item-info">
          <div class="pago-item-monto">Bs. ${p.monto.toFixed(2)} — ${p.metodo === 'efectivo' ? '💵 Efectivo' : '📱 QR'}</div>
          <div class="pago-item-detalle">
            <span>${new Date(p.fecha).toLocaleDateString('es-BO')}</span>
            <span>por ${p.usuario}</span>
            ${p.nota ? '<span>' + escHTML(p.nota) + '</span>' : ''}
          </div>
        </div>
        <div class="pago-item-fecha">${new Date(p.fecha).toLocaleTimeString('es-BO', {hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    `).join('');
  }
  
  document.getElementById('expedienteModalTitle').textContent = 'Expediente: ' + c.nombre;
  document.getElementById('expedienteOverlay').style.display = 'flex';
}
window.abrirExpedienteModal = abrirExpedienteModal;

function cerrarExpedienteModal() {
  document.getElementById('expedienteOverlay').style.display = 'none';
}
window.cerrarExpedienteModal = cerrarExpedienteModal;

function eliminarCliente(clienteId) {
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;
  const saldo = calcularSaldoCliente(clienteId);
  if (saldo > 0.01) { if (!confirm('Cliente tiene deuda de Bs.' + saldo.toFixed(2) + '. ¿Eliminar igual?')) return; }
  if (!confirm('Eliminar cliente "' + c.nombre + '" y todo su historial?')) return;
  clientes = clientes.filter(x => x.id !== clienteId);
  saveClientes();
  // Opcional: limpiar fiados/pagos del cliente
  fiados = fiados.filter(f => f.clienteId !== clienteId);
  saveFiados();
  pagos = pagos.filter(p => p.clienteId !== clienteId);
  savePagos();
  registrarActividad('cliente', 'Cliente eliminado: ' + c.nombre);
  renderFiados();
  actualizarBadgesFiados();
  toast('Cliente eliminado', 'warning');
}
window.eliminarCliente = eliminarCliente;

// ==== ACTIVIDAD ====
function renderActividad() {
  const cont = document.getElementById('actividadList');
  if (!cont) return;
  
  const tipo = document.getElementById('actFiltroTipo')?.value || '';
  const usuario = document.getElementById('actFiltroUsuario')?.value || '';
  const desde = document.getElementById('actFiltroDesde')?.value ? new Date(document.getElementById('actFiltroDesde').value).setHours(0,0,0,0) : 0;
  const hasta = document.getElementById('actFiltroHasta')?.value ? new Date(document.getElementById('actFiltroHasta').value).setHours(23,59,59,999) : Infinity;
  
  let lista = [...(actividad || [])];
  if (tipo) lista = lista.filter(a => a.tipo === tipo);
  if (usuario) lista = lista.filter(a => a.usuario === usuario);
  if (desde) lista = lista.filter(a => a.fecha >= desde);
  if (hasta) lista = lista.filter(a => a.fecha <= hasta);
  
  // Poblar filtros dinámicos
  const tipoSel = document.getElementById('actFiltroTipo');
  if (tipoSel && tipoSel.options.length <= 1) {
    const tipos = [...new Set(actividad.map(a => a.tipo))];
    tipoSel.innerHTML = '<option value="">Todos los tipos</option>' + tipos.map(t => '<option value="' + t + '">' + t + '</option>').join('');
  }
  const userSel = document.getElementById('actFiltroUsuario');
  if (userSel && userSel.options.length <= 1) {
    const users = [...new Set(actividad.map(a => a.usuario))];
    userSel.innerHTML = '<option value="">Todos los usuarios</option>' + users.map(u => '<option value="' + u + '">' + u + '</option>').join('');
  }
  
  if (!lista.length) {
    cont.innerHTML = '<div class="empty-state" style="padding:30px"><p>Sin actividad en este filtro</p></div>';
    return;
  }
  
  const iconosTipo = { venta: '💰', entrada: '📥', salida: '📤', fiado: '📒', pago: '✅', producto: '📦', combo: '🎁', oferta: '🏷️', usuario: '👤', sistema: '⚙️', backup: '💾' };
  
  cont.innerHTML = lista.slice(0, 500).map(a => `
    <div class="actividad-item">
      <span class="actividad-icon ${a.tipo}">${iconosTipo[a.tipo] || '●'}</span>
      <div class="actividad-info">
        <div class="actividad-detalle">${a.detalle}</div>
        <div class="actividad-meta">
          <span class="actividad-usuario">${a.usuario}</span>
          <span>${new Date(a.fecha).toLocaleString('es-BO')}</span>
        </div>
      </div>
    </div>
  `).join('');
}
window.renderActividad = renderActividad;

function filtrarActividad() {
  renderActividad();
}

function exportarActividadCSV() {
  if (!actividad.length) { toast('Sin actividad para exportar', 'warning'); return; }
  const header = 'Fecha,Tipo,Usuario,Detalle\n';
  const rows = actividad.map(a => [new Date(a.fecha).toISOString(), a.tipo, a.usuario, '"' + a.detalle.replace(/"/g, '""') + '"'].join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'actividad_tiaeli_' + new Date().toISOString().slice(0,10) + '.csv'; a.click(); URL.revokeObjectURL(url);
  toast('CSV de actividad exportado', 'success');
}
window.exportarActividadCSV = exportarActividadCSV;

// ==== INICIALIZACIÓN ====
function initGestion() {
  actualizarChipUsuario();
  actualizarBadgesFiados();
  if (!sesion) {
    setTimeout(function() { mostrarLogin(true); }, 100);
  }
}
window.initGestion = initGestion;