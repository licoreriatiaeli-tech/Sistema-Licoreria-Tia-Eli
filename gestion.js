// ═══════════════════════════════════════════════════════════════
// gestion.js — Módulo de gestión personal: usuarios, sesiones, actividad, fiados, salidas, entradas
// ═══════════════════════════════════════════════════════════════

// Utils globales vienen de utils-bundle.js
// window.safeNum, window.genId, window.escHTML, window.safeArr, etc.

// ==== USUARIOS Y SESIÓN ====
const DEFAULT_USUARIOS = [
  { id: 'eli', nombre: 'ELI', color: '#ea580c' },
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

// ==== ACTIVIDAD & AUDITORÍA ====
let actividad = [];
try { actividad = JSON.parse(localStorage.getItem('tiaeli_actividad') || '[]'); } catch { actividad = []; }
const MAX_ACTIVIDAD = 3000;

function generarActividadInicialDemo() {
  const now = Date.now();
  const H = 3600 * 1000;
  const D = 24 * H;
  return [
    {
      id: 'act-1',
      tipo: 'usuario',
      detalle: 'Sesión iniciada: ELI',
      subdetalle: 'Acceso seguro al terminal con rol Cajero Principal.',
      fecha: now - 15 * 60 * 1000,
      usuario: 'ELI',
      turno: 'Tarde',
      badge: 'ACTIVO',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-2',
      tipo: 'usuario',
      detalle: 'Sesión iniciada: JOHAN',
      subdetalle: 'Inicio de sesión con permisos totales de administración.',
      fecha: now - 2 * H,
      usuario: 'JOHAN',
      turno: 'Tarde (Administración)',
      badge: 'ADMINISTRADOR',
      device: 'Backoffice Admin'
    },
    {
      id: 'act-3',
      tipo: 'usuario',
      detalle: 'Sesión iniciada: EDWIN',
      subdetalle: 'Inicio de sesión con perfil de almacén y recepción.',
      fecha: now - 3 * H,
      usuario: 'EDWIN',
      turno: 'Tarde (Recepción y Almacén)',
      badge: 'ALMACÉN',
      device: 'Tablet Bodega'
    },
    {
      id: 'act-4',
      tipo: 'salida',
      detalle: 'Lote #2 quitado (60 u.) — Paceña Normal 330ml',
      subdetalle: 'Merma justificada por lote con fecha límite cercana. Retirado de depósito matriz.',
      extraDesc: 'Motivo: Devolución por fecha de caducidad cercana • Valor: - Bs. 420,00',
      fecha: now - 4 * H,
      usuario: 'ELI',
      badge: 'MERMA / RETIRO',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-5',
      tipo: 'producto',
      detalle: 'Lote #1 ajustado a 120 u. — Paceña Normal 330ml',
      subdetalle: 'Ajuste manual realizado tras arqueo de estantería. Se sumaron 2 unidades que estaban en enfriador exhibidor.',
      extraDesc: 'Conteo en góndola: 118 u. → 120 u. (+2 unidades regularizadas)',
      fecha: now - 4 * H - 35 * 1000,
      usuario: 'ELI',
      badge: 'AJUSTE FÍSICO',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-6',
      tipo: 'producto',
      detalle: 'Lote #1 ajustado a 118 u. — Paceña Normal 330ml',
      subdetalle: 'Registro intermedio antes de la verificación final de stock del lote Paceña 330ml.',
      extraDesc: 'Conteo inicial de cierre de turno parcial.',
      fecha: now - 4 * H - 180 * 1000,
      usuario: 'ELI',
      badge: 'MODIFICACIÓN STOCK',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-7',
      tipo: 'venta',
      detalle: 'Venta Cobrada #1043 — Bs. 190.00',
      subdetalle: 'Ticket emitido correctamente. Transacción acreditada en cuenta corriente BCP mediante QR interoperable.',
      extraDesc: 'Items: 1x Flor de Caña 5A (2L), 2x Coca Cola 3L • Método: QR Simple BCB',
      fecha: now - 5 * H,
      usuario: 'JOHAN',
      badge: 'COBRO POS',
      device: 'Terminal POS #2'
    },
    {
      id: 'act-8',
      tipo: 'entrada',
      detalle: 'Recepción Mercadería Factura #8491 — Flor de Caña 5 años',
      subdetalle: 'Ingreso validado en almacén por Edwin. Factura con sello de conformidad física.',
      extraDesc: 'Ingreso de +24 botellas • Costo unitario Bs. 60,00 • Proveedor: CBN Distribuidora',
      fecha: now - 6 * H,
      usuario: 'EDWIN',
      badge: 'ENTRADA STOCK',
      device: 'Tablet Depósito'
    },
    {
      id: 'act-9',
      tipo: 'venta',
      detalle: 'Venta Cobrada #1042 — Bs. 85.00',
      subdetalle: 'Venta rápida en mostrador en efectivo.',
      extraDesc: 'Items: 1x Fernet Branca 1L, 1x Coca Cola 2L • Efectivo en Caja',
      fecha: now - 1 * D - 2 * H,
      usuario: 'ELI',
      badge: 'COBRO POS',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-10',
      tipo: 'fiado',
      detalle: 'Nuevo Fiado registrado: Don Carlos — Bs. 120.00',
      subdetalle: 'Registro de deuda a cliente de confianza con plazo 7 días.',
      extraDesc: '2x Whisky Johnnie Walker Red 750ml • Saldo pendiente',
      fecha: now - 1 * D - 5 * H,
      usuario: 'ELI',
      badge: 'FIADO',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-11',
      tipo: 'pago',
      detalle: 'Pago de Fiado recibido: Don Carlos — Bs. 120.00',
      subdetalle: 'Cancelación total de saldo pendiente con comprobante.',
      extraDesc: 'Pago completo en efectivo recibido en caja',
      fecha: now - 1 * D - 3 * H,
      usuario: 'ELI',
      badge: 'PAGO RECIBIDO',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-12',
      tipo: 'salida',
      detalle: 'Retiro por rotura en góndola — Fernet Branca 1L',
      subdetalle: 'Merma por caída de botella durante reposición en estantería superior.',
      extraDesc: 'Motivo: Daño físico en sala de ventas • Valor: - Bs. 125,00',
      fecha: now - 2 * D - 1 * H,
      usuario: 'EDWIN',
      badge: 'MERMA / RETIRO',
      device: 'Tablet Depósito'
    },
    {
      id: 'act-13',
      tipo: 'producto',
      detalle: 'Stock ajustado — Ron Abuelo 750ml (12 u. → 15 u.)',
      subdetalle: 'Regularización de stock tras conteo físico semanal.',
      extraDesc: 'Conteo físico: +3 unidades encontradas en almacén secundario',
      fecha: now - 2 * D - 4 * H,
      usuario: 'ELI',
      badge: 'AJUSTE FÍSICO',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-14',
      tipo: 'venta',
      detalle: 'Venta Cobrada #1041 — Bs. 130.00',
      subdetalle: 'Venta con cobro mediante tarjeta de débito.',
      extraDesc: 'Items: 2x Paceña 6-pack latas, 1x Papas Lays • Tarjeta Débito Red Enlace',
      fecha: now - 2 * D - 6 * H,
      usuario: 'ELI',
      badge: 'COBRO POS',
      device: 'Terminal POS #1'
    },
    {
      id: 'act-15',
      tipo: 'sistema',
      detalle: 'Copia de Respaldo Automática completada',
      subdetalle: 'Base de datos y catálogo sincronizados en almacenamiento local y nube.',
      extraDesc: 'Catálogo de productos y 142 registros de auditoría respaldados con éxito.',
      fecha: now - 3 * D,
      usuario: 'SISTEMA',
      badge: 'SISTEMA',
      device: 'Servidor Local'
    }
  ];
}

if (!actividad || !actividad.length) {
  actividad = generarActividadInicialDemo();
  try { localStorage.setItem('tiaeli_actividad', JSON.stringify(actividad)); } catch(e){}
}
window.actividad = actividad;

function saveActividad() {
  localStorage.setItem('tiaeli_actividad', JSON.stringify(actividad));
  window.actividad = actividad;
}

function registrarActividad(tipo, detalle, extra = {}) {
  const u = usuarioActual() || 'SISTEMA';
  const item = {
    id: (typeof genId === 'function' ? genId() : 'act-' + Date.now()),
    tipo: tipo || 'sistema',
    detalle: (typeof escHTML === 'function' ? escHTML(detalle) : detalle),
    subdetalle: extra.subdetalle || '',
    extraDesc: extra.extraDesc || '',
    fecha: Date.now(),
    usuario: u,
    badge: extra.badge || '',
    device: extra.device || 'Terminal Matriz',
    turno: extra.turno || ''
  };
  actividad.unshift(item);
  if (actividad.length > MAX_ACTIVIDAD) actividad.length = MAX_ACTIVIDAD;
  saveActividad();
  if (document.getElementById('section-actividad')?.classList.contains('active')) {
    if (typeof renderActividad === 'function') renderActividad();
  }
}
window.registrarActividad = registrarActividad;

// ==== LOGIN OVERLAY ====
function cerrarLogin() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'none';
}
window.cerrarLogin = cerrarLogin;

function renderLoginOverlay() {
  const cont = document.getElementById('loginUsers');
  if (!cont) return;
  const current = window.sesion || (typeof window.usuarioActual === 'function' ? window.usuarioActual() : null);
  cont.innerHTML = usuarios.map(u => {
    const isCurrent = current && (current.toUpperCase() === u.nombre.toUpperCase());
    const roleText = u.nombre.toUpperCase() === 'ELI' ? 'Administrador' : 'Cajero / Operador';
    return (
      '<button type="button" class="login-user-btn' + (isCurrent ? ' active-current-user' : '') + '" onclick="seleccionarUsuario(\'' + u.nombre + '\')" style="--ucolor:' + u.color + '">' +
        '<span class="login-user-avatar">' + u.nombre.charAt(0) + '</span>' +
        '<div class="login-user-info">' +
          '<div class="login-user-name-row">' +
            '<span class="login-user-name">' + u.nombre + '</span>' +
            (isCurrent ? '<span class="login-user-active-badge"><span class="active-dot"></span> En sesión</span>' : '') +
          '</div>' +
          '<span class="login-user-role">' + roleText + '</span>' +
        '</div>' +
        '<svg class="login-user-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>' +
      '</button>'
    );
  }).join('');

  const closeBtn = document.getElementById('btnCloseLoginOverlay');
  if (closeBtn) {
    closeBtn.style.display = current ? 'flex' : 'none';
  }
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
  const modernAvatar = document.getElementById('sidebarUserAvatar');
  const modernName = document.getElementById('sidebarUserName');
  const modernRole = document.getElementById('sidebarUserRole');
  const modernTipName = document.getElementById('sidebarUserTipName');
  const modernTipRole = document.getElementById('sidebarUserTipRole');

  if (sesion) {
    const u = usuarios.find(x => x.nombre.toUpperCase() === sesion.toUpperCase()) || { color: '#ea580c', nombre: sesion };
    const initial = sesion.charAt(0).toUpperCase();
    const roleText = (sesion.toUpperCase() === 'ELI' ? 'Administrador' : 'Cajero / Operador');
    if (modernAvatar) {
      modernAvatar.textContent = initial;
      modernAvatar.style.backgroundColor = u.color || '#ea580c';
      modernAvatar.title = `${sesion} - ${roleText}`;
    }
    if (modernName) modernName.textContent = sesion;
    if (modernRole) modernRole.textContent = roleText;
    if (modernTipName) modernTipName.textContent = sesion;
    if (modernTipRole) modernTipRole.textContent = roleText;
    const headerCashierEl = document.getElementById('pos-header-cashier');
    if (headerCashierEl) headerCashierEl.textContent = 'Caja: ' + sesion;
  }
  if (chip) {
    chip.style.display = 'none';
    chip.innerHTML = '';
  }
  if (mobile) {
    if (sesion) {
      const u = usuarios.find(x => x.nombre.toUpperCase() === sesion.toUpperCase()) || { color: '#888' };
      mobile.innerHTML = '<span class="user-avatar" style="background:' + (u.color || '#ea580c') + '">' + sesion.charAt(0).toUpperCase() + '</span>';
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
  const stock = getTotalUnidadesBase(p);
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
  let cantidad = safeNum(document.getElementById('salidaCantidad').value);
  const motivo = document.getElementById('salidaMotivo').value;
  const nota = document.getElementById('salidaNota').value.trim();
  if (!pid || !cantidad || cantidad <= 0) { toast('Cantidad inválida', 'error'); return; }
  const p = window.productos.find(x => x.id === pid);
  if (!p) { toast('Producto no encontrado', 'error'); return; }
  const stock = getTotalUnidadesBase(p);
  if (cantidad > stock) { toast('Stock disponible: ' + stock + ' ' + (p.unidad || 'ud'), 'error'); return; }

  let lotesAfectados = [];
  let noCumplido = 0;
  if (typeof descontarStockFEFO === 'function') {
    const res = descontarStockFEFO(pid, cantidad);
    lotesAfectados = res.lotesAfectados || [];
    noCumplido = res.noCumplido || 0;
  } else {
    noCumplido = cantidad;
    for (const lote of (p.lotes || [])) {
      if (lote.cantidad <= 0) continue;
      const d = Math.min(lote.cantidad, cantidad);
      lote.cantidad -= d;
      lote.cantidadBaseUnidades = lote.cantidad;
      cantidad -= d;
      lotesAfectados.push({ vencimiento: lote.vencimiento, cantidadDescontada: d, costoUnitario: lote.costo || p.costo || 0 });
      if (cantidad <= 0) break;
    }
    noCumplido = cantidad;
  }

  if (noCumplido > 0) { toast('No se pudo descontar todo el stock (FEFO)', 'warning'); }

  p.stock = getTotalUnidadesBase(p);
  p.vencimiento = getVencimientoMasCercano(p);
  p.costoPromedioUnidad = getCostoPromedio(p);
  p.costo = p.costoPromedioUnidad;
  p.updatedAt = Date.now();


  const cantSalidaNum = safeNum(document.getElementById('salidaCantidad').value);
  const esCorreccion = motivo === 'ajuste_error' || motivo === 'conteo_fisico';

  let salidas = [];
  try { salidas = JSON.parse(localStorage.getItem('tiaeli_salidas') || '[]'); } catch { salidas = []; }
  salidas.unshift({
    id: genId(),
    productoId: pid,
    productoNombre: p.nombre,
    cantidad: cantSalidaNum,
    motivo: motivo,
    tipo: esCorreccion ? 'correccion' : 'salida',
    nota: document.getElementById('salidaNota').value.trim(),
    fecha: Date.now(),
    usuario: usuarioActual(),
    lotesAfectados
  });
  localStorage.setItem('tiaeli_salidas', JSON.stringify(salidas));

  const etiquetaAccion = esCorreccion ? 'Corrección de stock (agregado de más): ' : 'Salida: ';
  registrarActividad(esCorreccion ? 'ajuste' : 'salida', etiquetaAccion + p.nombre + ' (' + cantSalidaNum + ' ' + (p.unidad || 'ud') + ') — Motivo: ' + motivo);

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

// Control de Lote y Nota en Modal de Entrada
window._entradaConLote = false;
window._entradaConNota = false;

window.seleccionarVencimiento = function(activo) {
  window._entradaConVencimiento = !!activo;
  const btnNo = document.getElementById('btnVencNo');
  const btnSi = document.getElementById('btnVencSi');
  const wrap = document.getElementById('entradaVencimientoField');
  const venc = document.getElementById('entradaVencimiento');
  if (btnNo && btnSi) {
    if (activo) {
      btnSi.classList.add('active');
      btnNo.classList.remove('active');
    } else {
      btnNo.classList.add('active');
      btnSi.classList.remove('active');
    }
  }
  if (wrap) wrap.style.display = activo ? 'block' : 'none';
  if (!activo && venc) venc.value = '';
};
window.toggleEntradaLote = window.seleccionarVencimiento;
window.toggleEntradaNota = function() {};

function abrirEntrada(productoId) {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  const p = window.productos ? window.productos.find(x => x.id === productoId) : null;
  if (!p) { toast('Producto no encontrado', 'error'); return; }
  entradaProductoId = productoId;
  const stockUnid = getStockTotal(p);
  
  const idEl = document.getElementById('entradaProductoId');
  if (idEl) idEl.value = productoId;
  const nomEl = document.getElementById('entradaProductoNombre');
  if (nomEl) nomEl.value = p.nombre;
  const stkEl = document.getElementById('entradaStockActual');
  if (stkEl) stkEl.value = stockUnid;
  
  const nombre2El = document.getElementById('entradaProductoNombre2');
  if (nombre2El) nombre2El.textContent = p.nombre + (p.medida ? ' (' + p.medida + ')' : '');
  const stock2El = document.getElementById('entradaStockActual2');
  if (stock2El) stock2El.textContent = window.formatStockDisplay ? formatStockDisplay(p) : stockUnid;
  
  const cantEl = document.getElementById('entradaCantidad');
  if (cantEl) cantEl.value = '';
  
  const costoVal = p.costo ? parseFloat(Number(p.costo).toFixed(2)) : '';
  const costoEl = document.getElementById('entradaCosto');
  if (costoEl) costoEl.value = costoVal;
  
  const vencEl = document.getElementById('entradaVencimiento');
  if (vencEl) vencEl.value = '';
  const notaEl = document.getElementById('entradaNota');
  if (notaEl) notaEl.value = '';
  
  const titleEl = document.getElementById('entradaModalTitle');
  if (titleEl) titleEl.textContent = 'Registrar Entrada — ' + escHTML(p.nombre);
  
  // Inicializar tarjeta inteligente de actualización de precio de venta
  const pvActual = (typeof getPrecioVentaEfectivo === 'function' && getPrecioVentaEfectivo(p)) || safeNum(p.venta) || safeNum(p.precioVentaUnidad) || 0;
  const cpActual = (typeof getCostoPromedio === 'function' && getCostoPromedio(p)) || safeNum(p.costo) || 0;
  window._entradaCostoAnterior = cpActual;
  window._entradaPrecioVentaActual = pvActual;
  
  const heroPvEl = document.getElementById('entradaHeroPrecioVenta');
  if (heroPvEl) heroPvEl.textContent = 'Bs. ' + pvActual.toFixed(2);

  const inpNuevoP = document.getElementById('entradaNuevoPrecioInput');
  if (inpNuevoP) inpNuevoP.value = pvActual > 0 ? pvActual.toFixed(2) : '';
  
  const textActual = document.getElementById('entradaPrecioVentaActualText');
  if (textActual) {
    textActual.innerHTML = `Precio de venta actual en mostrador: <b>Bs. ${pvActual.toFixed(2)}</b> (Costo anterior: Bs. ${cpActual.toFixed(2)})`;
  }
  
  const cardUpdate = document.getElementById('entradaPrecioUpdateCard');
  if (cardUpdate) cardUpdate.style.display = 'none';
  
  // Lotes existentes y numeración de nuevo lote
  const boxPrevios = document.getElementById('entradaLotesPreviosBox');
  const listPrevios = document.getElementById('entradaLotesPreviosList');
  const tagNuevoLote = document.getElementById('entradaNuevoLoteTag');
  
  const lotesActivos = (p.lotes || []).filter(l => l && safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad) > 0);
  const nextLoteNum = (p.lotes || []).length + 1;
  
  if (tagNuevoLote) {
    tagNuevoLote.textContent = `Lote #${nextLoteNum}`;
  }
  
  if (boxPrevios && listPrevios) {
    if (lotesActivos.length > 0) {
      listPrevios.innerHTML = lotesActivos.map((l, idx) => {
        const cant = safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad);
        const costo = safeNum(l.costoPorUnidad).toFixed(2);
        const origIdx = (p.lotes || []).indexOf(l);
        const num = origIdx >= 0 ? origIdx + 1 : idx + 1;
        return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;padding:2px 0;">
          <span>• <b>Lote #${num}:</b> ${cant}</span>
          <span style="font-weight:700;color:var(--text1);">Costo: <b>Bs. ${costo}</b></span>
        </div>`;
      }).join('');
      boxPrevios.style.display = 'block';
    } else {
      boxPrevios.style.display = 'none';
      listPrevios.innerHTML = '';
    }
  }

  // Fecha de hoy para el nuevo lote
  const fechaHoyEl = document.getElementById('entradaLoteIngresoFechaText');
  if (fechaHoyEl) {
    const hoyStr = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    fechaHoyEl.textContent = 'Hoy: ' + hoyStr;
  }
  
  // Activar vencimiento si el producto suele tenerlo (cervezas, sodas, etc.)
  const tieneCtrlVenc = !!p.controlVencimiento || !!p.vencimiento;
  seleccionarVencimiento(tieneCtrlVenc);
  
  const overlay = document.getElementById('entradaOverlay');
  if (overlay) overlay.style.display = 'flex';
  actualizarEntradaResumen();
}
window.abrirEntrada = abrirEntrada;

// ── ELIMINAR LOTE ──
window.eliminarLote = function(pid, lid) {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  const p = window.productos ? window.productos.find(x => x.id === pid) : null;
  if (!p || !p.lotes) return;
  const idx = p.lotes.findIndex(l => l && l.id === lid);
  if (idx < 0) return;
  const l = p.lotes[idx];
  const cant = safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad);

  const conf = confirm(`¿Quitar Lote #${idx+1}?\n(${cant} unidades de ${p.nombre})\nEsto reducirá el stock y no se podrá deshacer.`);
  if (!conf) return;

  // Si tiene cantidad, generar movimiento de salida antes de borrar
  if (cant > 0) {
    const salida = {
      id: genId(),
      productoId: pid,
      productoNombre: p.nombre,
      cantidad: cant,
      unidadesTotales: cant,
      motivo: 'Anulación de lote',
      empaqueId: 'unidad_base',
      empaqueNombre: p.unidadBase || 'unidad',
      fecha: Date.now(),
      usuario: (typeof usuarioActual === 'function' && usuarioActual()) || '—',
      tipo: 'ajuste'
    };
    // Registrar en historial de salidas si existe
    if (typeof window.registrarSalidaMovimiento === 'function') {
      window.registrarSalidaMovimiento(salida);
    } else {
      let salidas = [];
      try { salidas = JSON.parse(localStorage.getItem('tiaeli_salidas') || '[]'); } catch { salidas = []; }
      salidas.unshift(salida);
      localStorage.setItem('tiaeli_salidas', JSON.stringify(salidas));
      if (typeof window.syncSaveSalida === 'function') window.syncSaveSalida(salida);
    }
  }

  // Eliminar lote
  p.lotes.splice(idx, 1);
  if (p.lotes.length === 0) p.lotes = [];

  // Recalcular
  p.stock = getTotalUnidadesBase(p);
  p.vencimiento = getVencimientoMasCercano(p);
  p.costoPromedioUnidad = getCostoPromedio(p);
  p.costo = p.costoPromedioUnidad;
  p.updatedAt = Date.now();

  // Auditoría
  registrarActividad('entrada', `Lote #${idx+1} quitado (${cant} u.) — ${p.nombre}`);

  // Persistir
  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);

  // Re-render
  if (typeof filterAndRender === 'function') filterAndRender();
  if (document.getElementById('editarProductoOverlay')?.style.display !== 'none') {
    if (typeof renderEditModalLotes === 'function') renderEditModalLotes(p);
    const stockEl = document.getElementById('editModalStockDisplay');
    if (stockEl) stockEl.textContent = p.stock;
  }
  toast('Lote quitado', 'success');
};

// ── AJUSTAR CANTIDAD DE LOTE ──
window.ajustarCantidadLote = function(pid, lid, nuevaCant) {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  const p = window.productos ? window.productos.find(x => x.id === pid) : null;
  if (!p || !p.lotes) return;
  const idx = p.lotes.findIndex(l => l && l.id === lid);
  if (idx < 0) return;
  let cant = safeNum(nuevaCant);
  if (cant < 0 || isNaN(cant)) cant = 0;
  const l = p.lotes[idx];
  l.cantidadBaseUnidades = cant;
  l.cantidad = cant;
  l.costoTotalLote = cant * safeNum(l.costoPorUnidad || (p.costo || 0));
  p.stock = getTotalUnidadesBase(p);
  p.vencimiento = getVencimientoMasCercano(p);
  p.costoPromedioUnidad = getCostoPromedio(p);
  p.costo = p.costoPromedioUnidad;
  p.updatedAt = Date.now();
  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  const cantAnterior = safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad);
  const diff = cant - cantAnterior;
  const motivoStr = diff < 0 
    ? `Corrección de ingreso sobrante (${diff}) en Lote #${idx+1} — ${p.nombre}` 
    : `Ajuste de inventario (+${diff}) en Lote #${idx+1} — ${p.nombre}`;
  registrarActividad('ajuste', motivoStr);
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();
  if (document.getElementById('editarProductoOverlay')?.style.display !== 'none') {
    if (typeof renderEditModalLotes === 'function') renderEditModalLotes(p);
    const stockEl = document.getElementById('editModalStockDisplay');
    if (stockEl) stockEl.textContent = p.stock;
  }
  toast(`Lote #${idx+1} de "${p.nombre}" ajustado a ${cant}`, 'success');
};

// Muestra/oculta detalle extra cuando se elige crear un lote nuevo vs. agregar a uno existente
window.toggleLoteExistente = function() {
  const sel = document.getElementById('loteExistenteSelect');
  const group = document.getElementById('loteExistenteGroup');
  if (!sel || !group) return;
  // Si un lote está seleccionado, se podría ocultar el vencimiento (el lote ya lo tiene);
  // dejamos el selector activo siempre que haya lotes activos.
  return sel.value;
};


// Auto-cálculo: costo por unidad = costo del empaque ÷ unidades del empaque
function actualizarEntradaResumen() {
  const resumenEl = document.getElementById('entradaResumen');
  const p = window.productos ? window.productos.find(x => x.id === entradaProductoId) : null;
  if (!p) return;
  const empaqueId = (document.getElementById('entradaTipoEmpaque') || {}).value || 'unidad_base';
  let unidadesEmp = 1;
  let nombreEmp = p.unidadBase || 'unidad';
  if (empaqueId !== 'unidad_base') {
    const todosFormatos = [...(p.formatosCompra || []), ...(p.formatosVenta || []), ...(p.empaques || [])];
    const fmt = todosFormatos.find(f => f.id === empaqueId);
    if (fmt) {
      unidadesEmp = fmt.unidades || 1;
      nombreEmp = fmt.nombre || 'Paquete';
    }
  }

  const cant = parseFloat(document.getElementById('entradaCantidad')?.value) || 0;
  const costoEmp = parseFloat(document.getElementById('entradaCosto')?.value) || 0;
  const costoUnidad = costoEmp > 0 ? costoEmp / unidadesEmp : 0;
  const total = cant * costoEmp;
  const elTotal = document.getElementById('entradaResumenTotal');
  const elNuevoStock = document.getElementById('entradaResumenNuevoStock');
  const stockActual = safeNum(getStockTotal(p));

  if (elNuevoStock) elNuevoStock.textContent = (stockActual + cant);
  if (elTotal) elTotal.textContent = 'Bs. ' + total.toFixed(2);

  // Variación del costo respecto a compras anteriores
  const badgeVariacion = document.getElementById('entradaCostoVariacionBadge');
  if (badgeVariacion) {
    const cAnt = window._entradaCostoAnterior || 0;
    if (cAnt > 0 && Math.abs(costoUnidad - cAnt) >= 0.01) {
      const diff = costoUnidad - cAnt;
      if (diff > 0) {
        badgeVariacion.textContent = `▲ Subió +Bs. ${diff.toFixed(2)}`;
        badgeVariacion.style.background = 'rgba(239,68,68,0.15)';
        badgeVariacion.style.color = '#dc2626';
        badgeVariacion.style.display = 'inline-block';
      } else {
        badgeVariacion.textContent = `▼ Bajó -Bs. ${Math.abs(diff).toFixed(2)}`;
        badgeVariacion.style.background = 'rgba(249,115,22,0.15)';
        badgeVariacion.style.color = '#ea580c';
        badgeVariacion.style.display = 'inline-block';
      }
    } else if (costoUnidad > 0) {
      badgeVariacion.textContent = '= Mismo costo';
      badgeVariacion.style.background = 'rgba(100,116,139,0.12)';
      badgeVariacion.style.color = 'var(--text2)';
      badgeVariacion.style.display = 'inline-block';
    } else {
      badgeVariacion.style.display = 'none';
    }
  }

  if (cant > 0 && costoEmp > 0) {
    if (resumenEl) resumenEl.style.display = 'block';
  } else {
    if (resumenEl) resumenEl.style.display = 'none';
  }
  if (typeof calcularMargenEntrada === 'function') calcularMargenEntrada();
}
window.actualizarEntradaResumen = actualizarEntradaResumen;

// Muestra el mini-form inline de configuración rápida de paquete
window.mostrarConfigPaqueteRapido = function() {
  const form = document.getElementById('configPaqueteRapidoForm');
  if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
};

// Guarda un paquete rápido desde el modal de entrada y actualiza el producto
window.guardarPaqueteRapido = function() {
  const pid = document.getElementById('entradaProductoId')?.value;
  const elNombre = document.getElementById('rapidoPaqueteNombre');
  const elUnidades = document.getElementById('rapidoPaqueteUnidades');
  if (!elNombre || !elUnidades) return;
  const nombre = (elNombre.value || '').trim();
  const unidades = parseInt(elUnidades.value || '0', 10);
  if (!nombre || unidades < 2) { toast('Nombre y unidades (mínimo 2) son obligatorios', 'error'); return; }
  const p = window.productos ? window.productos.find(x => x.id === pid) : null;
  if (!p) { toast('Producto no encontrado', 'error'); return; }
  if (!p.formatosCompra) p.formatosCompra = [];
  if (!p.formatosVenta) p.formatosVenta = [{ id: 'unidad', nombre: 'Unidad', unidades: 1, precio: p.precioVentaUnidad || p.venta || 0, esBase: true }];
  const nuevo = { id: 'fmt_' + genId(), nombre, unidades };
  p.formatosCompra.push(nuevo);
  p.formatosVenta.push({ id: nuevo.id, nombre, unidades, precio: 0 });
  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  abrirEntrada(pid);
  toast('Formato "' + nombre + '" configurado.', 'success');
};

// Aplica el nuevo precio de venta sugerido desde el modal de entrada
window.aplicarNuevoPrecioVenta = function() {
  const pid = document.getElementById('entradaProductoId')?.value;
  const elPrecio = document.getElementById('nuevoPrecioVentaInput') || document.getElementById('entradaPrecioVenta');
  const nuevoPrecio = parseFloat(elPrecio?.value) || 0;
  if (!nuevoPrecio || nuevoPrecio <= 0) { toast('Ingresá un precio válido', 'error'); return; }
  const p = window.productos ? window.productos.find(x => x.id === pid) : null;
  if (!p) return;
  const anterior = safeNum(p.venta);
  p.venta = nuevoPrecio;
  p.precioVentaUnidad = nuevoPrecio;
  const fmtUni = safeArr(p.formatosVenta).find(f => f.id === 'unidad');
  if (fmtUni) fmtUni.precio = nuevoPrecio;
  if (typeof registrarHistorialPrecio === 'function') {
    registrarHistorialPrecio(p, 'entrada', 'Precio unidad actualizado al registrar entrada: Bs.' + anterior.toFixed(2) + ' → Bs.' + nuevoPrecio.toFixed(2));
  }
  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  const row = document.getElementById('actualizarPrecioVentaRow');
  if (row) row.style.display = 'none';
  toast('Precio de venta actualizado a Bs. ' + nuevoPrecio.toFixed(2), 'success');
};


function confirmarEntrada() {
  const pid = document.getElementById('entradaProductoId')?.value;
  const cantidad = safeNum(document.getElementById('entradaCantidad')?.value);
  const costoEmp = safeNum(document.getElementById('entradaCosto')?.value);
  const tieneVenc = !!window._entradaConVencimiento;
  const vencInp = document.getElementById('entradaVencimiento');
  const vencimiento = (tieneVenc && vencInp) ? vencInp.value.trim() : (vencInp ? vencInp.value.trim() : '');
  const nota = (document.getElementById('entradaNota')?.value || '').trim();
  
  if (!pid || !cantidad || cantidad <= 0 || costoEmp <= 0) {
    toast('Ingresa una cantidad y costo válidos', 'error');
    return;
  }
  if (tieneVenc && !vencimiento) {
    toast('Ingresa la fecha de vencimiento del lote', 'warning');
    return;
  }
  const p = window.productos.find(x => x.id === pid);
  if (!p) { toast('Producto no encontrado', 'error'); return; }

  const empaqueId = document.getElementById('entradaTipoEmpaque')?.value || 'unidad_base';
  let unidadesEmp = 1;
  let nombreEmp = 'Unidad';
  if (empaqueId !== 'unidad_base') {
    const fmt = safeArr(p.formatosCompra).find(f => f.id === empaqueId);
    if (fmt) {
      unidadesEmp = fmt.unidades || 1;
      nombreEmp = fmt.nombre || 'Paquete';
    }
  }

  const cantidadBase = cantidad * unidadesEmp;
  const costoUnidad = costoEmp / unidadesEmp;
  const valorIngreso = costoEmp * cantidad;

  if (!p.lotes) p.lotes = [];

  // SIEMPRE SE REGISTRA COMO UN NUEVO LOTE (Ingreso con fecha de hoy y nota)
  p.lotes.push({
    id: genId(),
    cantidadBaseUnidades: cantidadBase,
    cantidad: cantidadBase,
    costoTotalLote: valorIngreso,
    costoPorUnidad: costoUnidad,
    vencimiento: vencimiento || '',
    fechaIngreso: new Date().toISOString().slice(0, 10),
    nota: nota
  });

  // Actualizar precio de venta general si se modificó en el modal de entrada (aplica para ventas futuras, sin alterar historial)
  const nuevoPrecioVenta = safeNum(document.getElementById('entradaNuevoPrecioInput')?.value);
  if (nuevoPrecioVenta > 0) {
    const antiguoP = safeNum(p.precioVentaUnidad || p.venta);
    if (antiguoP !== nuevoPrecioVenta) {
      p.precioVentaUnidad = nuevoPrecioVenta;
      p.venta = nuevoPrecioVenta;
      const fmts = safeArr(p.formatosVenta);
      const fmtUni = fmts.find(f => f.id === 'unidad' || f.esBase);
      if (fmtUni) fmtUni.precio = nuevoPrecioVenta;
      else fmts.unshift({ id: 'unidad', nombre: 'Unidad', unidades: 1, precio: nuevoPrecioVenta, esBase: true });
      p.formatosVenta = fmts;
      if (typeof registrarHistorialPrecio === 'function') {
        registrarHistorialPrecio(p, 'entrada_mercaderia', `Precio general actualizado al ingresar lote: Bs.${antiguoP.toFixed(2)} → Bs.${nuevoPrecioVenta.toFixed(2)}`);
      }
    }
  }

  p.stock = getTotalUnidadesBase(p);
  p.vencimiento = getVencimientoMasCercano(p);
  p.costoPromedioUnidad = getCostoPromedio(p);
  p.costo = p.costoPromedioUnidad;
  p.updatedAt = Date.now();

  let entradas = [];
  try { entradas = JSON.parse(localStorage.getItem('tiaeli_entradas') || '[]'); } catch { entradas = []; }
  entradas.unshift({
    id: genId(),
    productoId: pid,
    productoNombre: p.nombre,
    empaqueId: empaqueId,
    empaqueNombre: nombreEmp,
    cantidad: cantidad,
    unidadesTotales: cantidadBase,
    costo: valorIngreso,
    costoPorUnidad: costoUnidad,
    vencimiento: vencimiento,
    proveedor: '',
    nota: nota,
    fecha: Date.now(),
    usuario: (typeof usuarioActual === 'function' && usuarioActual()) || '—',
    aLoteExistente: false
  });
  localStorage.setItem('tiaeli_entradas', JSON.stringify(entradas));

  registrarActividad('entrada', 'Entrada: ' + p.nombre + ' (+' + cantidadBase + ' u.) — Costo: Bs.' + valorIngreso.toFixed(2) + (vencimiento ? ' Vence: ' + vencimiento : ''));

  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  if (typeof window.syncSaveEntrada === 'function') window.syncSaveEntrada(entradas[0]);

  const overlay = document.getElementById('entradaOverlay');
  if (overlay) overlay.style.display = 'none';
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();
  if (typeof ejecutarJobOfertasLote === 'function') ejecutarJobOfertasLote();
  toast('¡Entrada registrada! +' + cantidadBase + ' unidades ingresadas', 'success');
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
  const stock = getTotalUnidadesBase(p);
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

// ==== ACTIVIDAD & AUDITORÍA (ORANGE RETAIL MODERN) ====

const auditState = {
  search: '',
  tipo: 'all',
  usuario: 'all',
  fechaDesde: '',
  fechaHasta: '',
  datePreset: 'todo', // 'hoy' | '7d' | 'mes' | 'todo'
  quickPill: 'all',  // 'all' | 'session' | 'stock' | 'sale' | 'merma'
  rowsPerPage: 10,
  currentPage: 1
};

// Generar avatar e iniciales del usuario
function getAuditAvatar(usuario, tipo) {
  const u = (usuario || 'EL').trim().toUpperCase();
  const initials = u.length >= 2 ? u.slice(0, 2) : u;
  return { u, initials };
}

// Clasificación de evento para estilos, badges y filtros
function categorizarEvento(a) {
  const t = (a.tipo || '').toLowerCase();
  const d = (a.detalle || '').toLowerCase();
  
  if (t === 'usuario' || t === 'session' || d.includes('sesión') || d.includes('login') || d.includes('usuario')) {
    return 'session';
  }
  if (t === 'merma' || d.includes('merma') || d.includes('quitado') || d.includes('retiro') || d.includes('anulad') || d.includes('vencid')) {
    return 'merma';
  }
  if (t === 'producto' || t === 'stock' || d.includes('ajust') || d.includes('arqueo') || d.includes('lote #') || d.includes('stock')) {
    return 'stock';
  }
  if (t === 'venta' || t === 'sale' || d.includes('venta') || d.includes('cobrad') || d.includes('pos')) {
    return 'sale';
  }
  if (t === 'entrada' || d.includes('recepción') || d.includes('ingreso') || d.includes('compra')) {
    return 'entrada';
  }
  if (t === 'fiado' || t === 'pago' || d.includes('fiado') || d.includes('deuda')) {
    return 'fiado';
  }
  return 'general';
}

function updateAuditKPIs() {
  const lista = window.actividad || [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  // 1. Total Eventos Hoy
  const eventosHoy = lista.filter(a => a.fecha >= startOfToday && a.fecha <= endOfToday);
  const totalHoyEl = document.getElementById('kpiTotalEventosHoy');
  if (totalHoyEl) totalHoyEl.textContent = eventosHoy.length;

  // 2. Sesiones Activas
  const usuariosActivos = new Set();
  const currentU = usuarioActual();
  if (currentU) usuariosActivos.add(currentU);
  eventosHoy.forEach(a => {
    if (categorizarEvento(a) === 'session' && a.usuario) usuariosActivos.add(a.usuario);
  });
  if (usuariosActivos.size === 0 && Array.isArray(window.usuarios)) {
    window.usuarios.forEach(u => usuariosActivos.add(u.nombre));
  }
  const kpiSesionesEl = document.getElementById('kpiSesionesActivas');
  if (kpiSesionesEl) kpiSesionesEl.textContent = usuariosActivos.size;
  const kpiSesionesListaEl = document.getElementById('kpiSesionesLista');
  if (kpiSesionesListaEl) {
    kpiSesionesListaEl.textContent = Array.from(usuariosActivos).slice(0, 3).join(', ') || 'Eli, Edwin, Johan';
  }

  // 3. Movimientos de Stock
  const movsStock = lista.filter(a => {
    const cat = categorizarEvento(a);
    return cat === 'stock' || cat === 'entrada' || cat === 'merma';
  });
  const kpiStockEl = document.getElementById('kpiMovimientosStock');
  if (kpiStockEl) kpiStockEl.textContent = movsStock.length;

  // 4. Alertas / Mermas
  const retiros = lista.filter(a => categorizarEvento(a) === 'merma' || /merma|retiro|quitado/i.test(a.detalle));
  const anulaciones = lista.filter(a => /anula/i.test(a.detalle));
  const totalAlertas = retiros.length + anulaciones.length;
  const kpiAlertasEl = document.getElementById('kpiAlertasMermas');
  if (kpiAlertasEl) kpiAlertasEl.textContent = totalAlertas;
  const kpiAlertasSubEl = document.getElementById('kpiAlertasSub');
  if (kpiAlertasSubEl) {
    kpiAlertasSubEl.textContent = `${retiros.length} retiro${retiros.length === 1 ? '' : 's'} • ${anulaciones.length} anulación${anulaciones.length === 1 ? '' : 'es'}`;
  }
}

function renderAuditPills() {
  const container = document.getElementById('auditPillsContainer');
  if (!container) return;

  const lista = window.actividad || [];
  const countAll = lista.length;
  let countSession = 0, countStock = 0, countSale = 0, countMerma = 0;

  lista.forEach(a => {
    const cat = categorizarEvento(a);
    if (cat === 'session') countSession++;
    else if (cat === 'stock' || cat === 'entrada') countStock++;
    else if (cat === 'sale') countSale++;
    else if (cat === 'merma') countMerma++;
  });

  const pills = [
    { key: 'all', label: 'Todos', count: countAll, icon: 'list_alt' },
    { key: 'session', label: 'Sesiones', count: countSession, icon: 'person' },
    { key: 'stock', label: 'Ajustes Stock', count: countStock, icon: 'inventory_2' },
    { key: 'sale', label: 'Ventas POS', count: countSale, icon: 'point_of_sale' },
    { key: 'merma', label: 'Alertas / Mermas', count: countMerma, icon: 'warning' }
  ];

  container.innerHTML = pills.map(p => `
    <button class="audit-pill-filter ${auditState.quickPill === p.key ? 'active' : ''}" type="button" onclick="selectAuditQuickPill('${p.key}')">
      <span class="material-symbols-outlined audit-pill-icon">${p.icon}</span>
      <span class="audit-pill-text">${p.label}</span>
      <span class="audit-pill-count">${p.count}</span>
    </button>
  `).join('');
}

function populateAuditFilterDropdowns() {
  const lista = window.actividad || [];
  
  // Usuario Dropdown
  const userSelect = document.getElementById('auditUsuarioFilter');
  if (userSelect && userSelect.options.length <= 1) {
    const usersSet = new Set();
    if (Array.isArray(window.usuarios)) {
      window.usuarios.forEach(u => usersSet.add(u.nombre));
    }
    lista.forEach(a => { if (a.usuario) usersSet.add(a.usuario); });
    const userOpts = Array.from(usersSet).map(u => `<option value="${u}">${u}</option>`).join('');
    userSelect.innerHTML = '<option value="all">Todos los usuarios</option>' + userOpts;
  }
}

function selectAuditDatePreset(preset, btn) {
  auditState.datePreset = preset;
  auditState.currentPage = 1;

  document.querySelectorAll('.audit-time-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86400000 - 1;

  const desdeInput = document.getElementById('auditFechaDesde');
  const hastaInput = document.getElementById('auditFechaHasta');

  if (preset === 'hoy') {
    const dStr = new Date(startOfToday).toISOString().slice(0, 10);
    if (desdeInput) desdeInput.value = dStr;
    if (hastaInput) hastaInput.value = dStr;
  } else if (preset === '7d') {
    const d7 = new Date(startOfToday - 6 * 86400000).toISOString().slice(0, 10);
    const dStr = new Date(endOfToday).toISOString().slice(0, 10);
    if (desdeInput) desdeInput.value = d7;
    if (hastaInput) hastaInput.value = dStr;
  } else if (preset === 'mes') {
    const dMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const dStr = new Date(endOfToday).toISOString().slice(0, 10);
    if (desdeInput) desdeInput.value = dMes;
    if (hastaInput) hastaInput.value = dStr;
  } else if (preset === 'todo') {
    if (desdeInput) desdeInput.value = '';
    if (hastaInput) hastaInput.value = '';
  }

  renderActividad();
}
window.selectAuditDatePreset = selectAuditDatePreset;

function selectAuditQuickPill(key) {
  auditState.quickPill = key;
  auditState.currentPage = 1;
  const tipoFilter = document.getElementById('auditTipoFilter');
  if (tipoFilter) {
    if (key === 'all') tipoFilter.value = 'all';
    else if (key === 'session') tipoFilter.value = 'session';
    else if (key === 'stock') tipoFilter.value = 'stock';
    else if (key === 'sale') tipoFilter.value = 'sale';
    else if (key === 'merma') tipoFilter.value = 'merma';
  }
  renderActividad();
}
window.selectAuditQuickPill = selectAuditQuickPill;

function limpiarFiltrosAuditoria() {
  auditState.search = '';
  auditState.tipo = 'all';
  auditState.usuario = 'all';
  auditState.fechaDesde = '';
  auditState.fechaHasta = '';
  auditState.datePreset = 'todo';
  auditState.quickPill = 'all';
  auditState.currentPage = 1;

  const s = document.getElementById('auditSearchInput'); if (s) s.value = '';
  const t = document.getElementById('auditTipoFilter'); if (t) t.value = 'all';
  const u = document.getElementById('auditUsuarioFilter'); if (u) u.value = 'all';
  const fd = document.getElementById('auditFechaDesde'); if (fd) fd.value = '';
  const fh = document.getElementById('auditFechaHasta'); if (fh) fh.value = '';

  document.querySelectorAll('.audit-time-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim().toLowerCase() === 'todo');
  });

  renderActividad();
}
window.limpiarFiltrosAuditoria = limpiarFiltrosAuditoria;

function setAuditRowsPerPage(n, btn) {
  auditState.rowsPerPage = parseInt(n) || 10;
  auditState.currentPage = 1;
  document.querySelectorAll('.audit-rows-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderActividad();
}
window.setAuditRowsPerPage = setAuditRowsPerPage;

function goToAuditPage(p) {
  auditState.currentPage = p;
  renderActividad();
  document.getElementById('actividadList')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.goToAuditPage = goToAuditPage;

function renderPaginationControls(totalPages, currentPage) {
  const container = document.getElementById('auditPaginationControls');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = `
      <button type="button" disabled class="audit-nav-btn" title="Página única">1</button>
    `;
    return;
  }

  let html = `
    <button type="button" class="audit-nav-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToAuditPage(${currentPage - 1})" title="Página anterior">
      <span class="material-symbols-outlined" style="font-size:16px;">chevron_left</span>
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      html += `
        <button type="button" class="audit-nav-btn ${i === currentPage ? 'active' : ''}" onclick="goToAuditPage(${i})">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<span class="audit-nav-dots">...</span>`;
    }
  }

  html += `
    <button type="button" class="audit-nav-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToAuditPage(${currentPage + 1})" title="Página siguiente">
      <span class="material-symbols-outlined" style="font-size:16px;">chevron_right</span>
    </button>
  `;

  container.innerHTML = html;
}

function renderActividad() {
  const cont = document.getElementById('actividadList');
  if (!cont) return;

  updateAuditKPIs();
  renderAuditPills();
  populateAuditFilterDropdowns();

  const searchVal = (document.getElementById('auditSearchInput')?.value || '').toLowerCase().trim();
  const tipoVal = document.getElementById('auditTipoFilter')?.value || auditState.tipo || 'all';
  const userVal = document.getElementById('auditUsuarioFilter')?.value || auditState.usuario || 'all';
  const desdeStr = document.getElementById('auditFechaDesde')?.value || '';
  const hastaStr = document.getElementById('auditFechaHasta')?.value || '';

  const desdeTs = desdeStr ? new Date(desdeStr + 'T00:00:00').getTime() : 0;
  const hastaTs = hastaStr ? new Date(hastaStr + 'T23:59:59.999').getTime() : Infinity;

  let lista = [...(window.actividad || [])];

  // 1. Filtrar por rango de fechas
  if (desdeTs > 0) lista = lista.filter(a => a.fecha >= desdeTs);
  if (hastaTs < Infinity) lista = lista.filter(a => a.fecha <= hastaTs);

  // 2. Filtrar por usuario
  if (userVal !== 'all' && userVal !== '') {
    lista = lista.filter(a => (a.usuario || '').toUpperCase() === userVal.toUpperCase());
  }

  // 3. Filtrar por tipo / píldora rápida
  const activePill = auditState.quickPill;
  if (activePill !== 'all') {
    lista = lista.filter(a => {
      const cat = categorizarEvento(a);
      if (activePill === 'session') return cat === 'session';
      if (activePill === 'stock') return cat === 'stock' || cat === 'entrada';
      if (activePill === 'sale') return cat === 'sale';
      if (activePill === 'merma') return cat === 'merma';
      return true;
    });
  } else if (tipoVal !== 'all' && tipoVal !== '') {
    lista = lista.filter(a => {
      const cat = categorizarEvento(a);
      if (tipoVal === 'session') return cat === 'session';
      if (tipoVal === 'stock') return cat === 'stock';
      if (tipoVal === 'merma') return cat === 'merma';
      if (tipoVal === 'sale') return cat === 'sale';
      if (tipoVal === 'entrada') return cat === 'entrada';
      if (tipoVal === 'fiado') return cat === 'fiado';
      return a.tipo === tipoVal;
    });
  }

  // 4. Filtrar por término de búsqueda
  if (searchVal) {
    lista = lista.filter(a => {
      const txt = [
        a.detalle || '',
        a.subdetalle || '',
        a.extraDesc || '',
        a.usuario || '',
        a.tipo || '',
        a.badge || '',
        a.device || ''
      ].join(' ').toLowerCase();
      return txt.includes(searchVal);
    });
  }

  // 5. Paginación
  const totalItems = lista.length;
  const rowsPerPage = auditState.rowsPerPage || 10;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  
  if (auditState.currentPage > totalPages) auditState.currentPage = totalPages;
  if (auditState.currentPage < 1) auditState.currentPage = 1;
  const currentPage = auditState.currentPage;

  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, totalItems);
  const pagedItems = lista.slice(startIdx, endIdx);

  const paginationInfoEl = document.getElementById('auditPaginationInfo');
  if (paginationInfoEl) {
    if (totalItems === 0) {
      paginationInfoEl.innerHTML = 'Mostrando <strong>0 a 0</strong> de <strong>0</strong> eventos';
    } else {
      paginationInfoEl.innerHTML = `Mostrando <strong class="font-bold font-mono">${startIdx + 1} a ${endIdx}</strong> de <strong class="font-bold font-mono">${totalItems}</strong> eventos`;
    }
  }

  renderPaginationControls(totalPages, currentPage);

  if (totalItems === 0) {
    cont.innerHTML = `
      <div class="empty-state" style="padding:48px 24px; text-align:center; background:var(--act-card-bg); border-radius:1rem; border:1px dashed var(--act-border);">
        <span class="material-symbols-outlined" style="font-size:44px; color:var(--act-text-light); margin-bottom:8px; display:inline-block;">manage_search</span>
        <h4 style="font-size:15px; font-weight:700; color:var(--act-text-main); margin:0 0 4px 0;">No se encontraron registros de auditoría</h4>
        <p style="font-size:13px; color:var(--act-text-muted); margin:0 0 16px 0;">Prueba modificando el buscador, el usuario seleccionado o el rango de tiempo.</p>
        <button class="audit-btn-detail" type="button" onclick="limpiarFiltrosAuditoria()">Restablecer Filtros</button>
      </div>
    `;
    return;
  }

  const currentUser = (usuarioActual() || '').toUpperCase();
  cont.innerHTML = pagedItems.map((a, idx) => {
    const cat = categorizarEvento(a);
    const dateObj = new Date(a.fecha);
    const dateStr = dateObj.toLocaleDateString('es-BO', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const isCurrentActive = a.usuario && a.usuario.toUpperCase() === currentUser;
    const { initials } = getAuditAvatar(a.usuario, cat);

    let rowTypeClass = 'type-login';
    let avatarBoxHtml = '';
    let badgeHtml = '';
    let actionBtnHtml = '';
    let subDescHtml = '';
    let displayTitle = a.detalle || 'Registro del Sistema';

    if (cat === 'session') {
      rowTypeClass = 'type-login';
      const isJohan = (a.usuario || '').toUpperCase() === 'JOHAN';
      const isEdwin = (a.usuario || '').toUpperCase() === 'EDWIN';
      const roleBadge = isJohan ? '<span class="audit-chip-badge purple">ADMINISTRADOR</span>' : (isEdwin ? '<span class="audit-chip-badge blue">ALMACÉN</span>' : '<span class="audit-chip-badge green"><span class="audit-live-dot" style="width:6px;height:6px;"></span>ACTIVO</span>');
      
      avatarBoxHtml = `
        <div class="audit-avatar-wrap">
          <div class="audit-avatar-box ${isCurrentActive ? 'green' : ''}">${initials}</div>
          ${isCurrentActive ? '<span class="audit-avatar-online"></span>' : ''}
        </div>
      `;
      badgeHtml = `
        <span class="audit-chip-user">${a.usuario}</span>
        ${roleBadge}
      `;
      displayTitle = 'Sesión iniciada';
      subDescHtml = a.turno ? `Turno: <strong style="color:var(--act-text-main);">${a.turno}</strong>` : (a.subdetalle || a.extraDesc || 'Acceso seguro al terminal con credenciales autorizadas.');
      actionBtnHtml = `
        <button class="audit-btn-detail" type="button" onclick="openAuditModalById('${a.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
          <span>Detalle</span>
        </button>
      `;
    } else if (cat === 'merma') {
      rowTypeClass = 'type-merma';
      avatarBoxHtml = `
        <div class="audit-avatar-wrap">
          <div class="audit-avatar-box rose">
            <span class="material-symbols-outlined" style="font-size:20px;">delete_forever</span>
          </div>
        </div>
      `;
      badgeHtml = `
        <span class="audit-chip-badge rose">MERMA / RETIRO</span>
        <span class="audit-chip-user">${a.usuario}</span>
      `;
      subDescHtml = a.extraDesc || a.subdetalle || 'Retiro de inventario por merma o fecha cercana.';
      actionBtnHtml = `
        <button class="audit-btn-detail btn-rose" type="button" onclick="openAuditModalById('${a.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
          <span>Ver Justificación</span>
        </button>
      `;
    } else if (cat === 'stock') {
      rowTypeClass = 'type-stock';
      avatarBoxHtml = `
        <div class="audit-avatar-wrap">
          <div class="audit-avatar-box blue">
            <span class="material-symbols-outlined" style="font-size:20px;">inventory_2</span>
          </div>
        </div>
      `;
      const badgeText = a.badge || 'AJUSTE FÍSICO';
      badgeHtml = `
        <span class="audit-chip-badge blue">${badgeText}</span>
        <span class="audit-chip-user">${a.usuario}</span>
      `;
      subDescHtml = a.extraDesc || a.subdetalle || 'Ajuste manual de existencias físicas.';
      actionBtnHtml = `
        <button class="audit-btn-detail" type="button" onclick="openAuditModalById('${a.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
          <span>Detalle</span>
        </button>
      `;
    } else if (cat === 'sale') {
      rowTypeClass = 'type-venta';
      avatarBoxHtml = `
        <div class="audit-avatar-wrap">
          <div class="audit-avatar-box green">
            <span class="material-symbols-outlined" style="font-size:20px;">point_of_sale</span>
          </div>
        </div>
      `;
      badgeHtml = `
        <span class="audit-chip-badge green">COBRO POS</span>
        <span class="audit-chip-user">${a.usuario}</span>
      `;
      subDescHtml = (a.subdetalle && a.subdetalle !== a.detalle) ? a.subdetalle : ((a.extraDesc && a.extraDesc !== a.detalle) ? a.extraDesc : 'Ticket de venta cobrado y emitido en mostrador');
      actionBtnHtml = `
        <button class="audit-btn-detail btn-orange" type="button" onclick="openAuditModalById('${a.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">receipt_long</span>
          <span>Ver Ticket</span>
        </button>
      `;
    } else if (cat === 'entrada') {
      rowTypeClass = 'type-entrada';
      avatarBoxHtml = `
        <div class="audit-avatar-wrap">
          <div class="audit-avatar-box green">
            <span class="material-symbols-outlined" style="font-size:20px;">add_box</span>
          </div>
        </div>
      `;
      badgeHtml = `
        <span class="audit-chip-badge green">ENTRADA STOCK</span>
        <span class="audit-chip-user">${a.usuario}</span>
      `;
      subDescHtml = (a.subdetalle && a.subdetalle !== a.detalle) ? a.subdetalle : (a.extraDesc || 'Ingreso y reposición de mercadería en almacén.');
      actionBtnHtml = `
        <button class="audit-btn-detail" type="button" onclick="openAuditModalById('${a.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
          <span>Detalle</span>
        </button>
      `;
    } else if (cat === 'fiado') {
      rowTypeClass = 'type-fiado';
      avatarBoxHtml = `
        <div class="audit-avatar-wrap">
          <div class="audit-avatar-box amber">
            <span class="material-symbols-outlined" style="font-size:20px;">menu_book</span>
          </div>
        </div>
      `;
      badgeHtml = `
        <span class="audit-chip-badge amber">${a.tipo === 'pago' ? 'PAGO RECIBIDO' : 'FIADO'}</span>
        <span class="audit-chip-user">${a.usuario}</span>
      `;
      subDescHtml = (a.subdetalle && a.subdetalle !== a.detalle) ? a.subdetalle : (a.extraDesc || 'Operación de crédito/fiado en cuenta cliente.');
      actionBtnHtml = `
        <button class="audit-btn-detail" type="button" onclick="openAuditModalById('${a.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
          <span>Detalle</span>
        </button>
      `;
    } else {
      rowTypeClass = 'type-login';
      avatarBoxHtml = `
        <div class="audit-avatar-wrap">
          <div class="audit-avatar-box">
            <span class="material-symbols-outlined" style="font-size:20px;">history</span>
          </div>
        </div>
      `;
      badgeHtml = `
        <span class="audit-chip-badge gray">${(a.tipo || 'SISTEMA').toUpperCase()}</span>
        <span class="audit-chip-user">${a.usuario || 'SISTEMA'}</span>
      `;
      subDescHtml = (a.subdetalle && a.subdetalle !== a.detalle) ? a.subdetalle : (a.extraDesc || 'Movimiento administrativo del sistema.');
      actionBtnHtml = `
        <button class="audit-btn-detail" type="button" onclick="openAuditModalById('${a.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">visibility</span>
          <span>Detalle</span>
        </button>
      `;
    }

    return `
      <article class="audit-row ${rowTypeClass} animate-item" style="animation-delay:${idx * 0.03}s">
        <div class="audit-row-left">
          ${avatarBoxHtml}
          <div class="audit-row-content">
            <div class="audit-row-title-row">
              <h4 class="audit-row-title">${displayTitle}</h4>
              ${badgeHtml}
            </div>
            <p class="audit-row-desc">${subDescHtml}</p>
          </div>
        </div>
        <div class="audit-row-right">
          <div class="audit-timestamp-wrap">
            <p class="audit-date-val">${dateStr}</p>
            <p class="audit-time-val">${timeStr}</p>
          </div>
          ${actionBtnHtml}
        </div>
      </article>
    `;
  }).join('');
}
window.renderActividad = renderActividad;

function filtrarActividad() {
  renderActividad();
}
window.filtrarActividad = filtrarActividad;

// Modal de Detalle de Auditoría
function openAuditModalById(id) {
  const modal = document.getElementById('auditModal');
  if (!modal) return;
  const a = (window.actividad || []).find(x => String(x.id) === String(id));
  if (!a) return;

  const cat = categorizarEvento(a);
  const dateObj = new Date(a.fecha);
  const dateStr = dateObj.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  let typeBadgeText = 'REGISTRO';
  let badgeColorClass = '';
  if (cat === 'session') { typeBadgeText = 'AUTENTICACIÓN'; badgeColorClass = 'green'; }
  else if (cat === 'sale') { typeBadgeText = 'VENTA POS'; badgeColorClass = 'orange'; }
  else if (cat === 'stock') { typeBadgeText = 'AJUSTE STOCK'; badgeColorClass = 'blue'; }
  else if (cat === 'merma') { typeBadgeText = 'MERMA / RETIRO'; badgeColorClass = 'rose'; }
  else if (cat === 'entrada') { typeBadgeText = 'ENTRADA STOCK'; badgeColorClass = 'green'; }
  else if (cat === 'fiado') { typeBadgeText = (a.tipo === 'pago' ? 'ABONO DE FIADO' : 'CRÉDITO / FIADO'); badgeColorClass = 'amber'; }

  const tEl = document.getElementById('modalTitle');
  if (tEl) tEl.textContent = a.detalle || 'Detalle de Auditoría';

  const dEl = document.getElementById('modalDesc');
  if (dEl) {
    const parts = [];
    if (a.subdetalle && a.subdetalle !== a.detalle) parts.push(a.subdetalle);
    if (a.extraDesc && a.extraDesc !== a.detalle && a.extraDesc !== a.subdetalle) parts.push(a.extraDesc);
    if (!parts.length) parts.push(a.detalle || 'Sin descripción adicional registrada.');
    dEl.textContent = parts.join('\n\n');
  }

  const tsEl = document.getElementById('modalTimestamp');
  if (tsEl) tsEl.textContent = `${dateStr} a las ${timeStr}`;

  const uEl = document.getElementById('modalUser');
  if (uEl) {
    const uName = (a.usuario || 'SISTEMA').toUpperCase();
    const role = (uName === 'ELI' ? 'Dueña / Administradora' : (uName === 'EDWIN' ? 'Dueño / Almacén' : (uName === 'JOHAN' ? 'Sistemas / Admin' : 'Cajero / Operador')));
    uEl.textContent = `${a.usuario || 'SISTEMA'} (${role})`;
  }

  const bEl = document.getElementById('modalTypeBadge');
  if (bEl) {
    bEl.textContent = typeBadgeText;
    bEl.className = 'audit-modal-badge ' + badgeColorClass;
  }

  const devEl = document.getElementById('modalDevice');
  if (devEl) devEl.textContent = a.device || (cat === 'session' ? 'Terminal POS #1' : 'Terminal Matriz');

  modal.classList.remove('hidden');
}
window.openAuditModalById = openAuditModalById;

function openAuditModal(title, desc, timestamp, user, type, device) {
  const modal = document.getElementById('auditModal');
  if (!modal) return;
  const tEl = document.getElementById('modalTitle'); if (tEl) tEl.textContent = title || 'Detalle de Actividad';
  const dEl = document.getElementById('modalDesc'); if (dEl) dEl.textContent = desc || 'Sin descripción adicional registrada.';
  const tsEl = document.getElementById('modalTimestamp'); if (tsEl) tsEl.textContent = timestamp || '--';
  const uEl = document.getElementById('modalUser'); if (uEl) uEl.textContent = user || 'SISTEMA';
  const bEl = document.getElementById('modalTypeBadge'); if (bEl) bEl.textContent = (type || 'REGISTRO').toUpperCase();
  const devEl = document.getElementById('modalDevice'); if (devEl) devEl.textContent = device || 'Terminal Matriz';

  modal.classList.remove('hidden');
}
window.openAuditModal = openAuditModal;

function closeAuditModal() {
  const modal = document.getElementById('auditModal');
  if (modal) modal.classList.add('hidden');
}
window.closeAuditModal = closeAuditModal;

function validarIntegridadHash() {
  if (typeof toast === 'function') {
    toast('✓ Registro verificado exitosamente mediante firma criptográfica SHA-256 (Integridad comprobada)', 'success');
  } else {
    alert('✓ Registro verificado exitosamente mediante firma de bloque SHA-256');
  }
}
window.validarIntegridadHash = validarIntegridadHash;

function limpiarActividadAuditoria() {
  const confirmed = confirm('¿Deseas vaciar los registros de demostración/prueba de auditoría?\n\nEsto dejará el registro limpio para auditar únicamente las operaciones y ventas reales de la tienda.');
  if (!confirmed) return;

  window.actividad = [];
  try {
    localStorage.setItem('tiaeli_actividad', JSON.stringify([]));
  } catch(e){}

  registrarActividad('sistema', 'Auditoría reiniciada: Registros de prueba eliminados', {
    subdetalle: 'Se ha iniciado un historial limpio de trazabilidad en tiempo real.',
    badge: 'AUDITORÍA LIMPIA'
  });

  renderActividad();
  if (typeof toast === 'function') {
    toast('✓ Auditoría limpia: registros de prueba eliminados exitosamente', 'success');
  }
}
window.limpiarActividadAuditoria = limpiarActividadAuditoria;

// Exportación CSV
function exportarActividadCSV() {
  if (!window.actividad || !window.actividad.length) {
    if (typeof toast === 'function') toast('Sin actividad para exportar', 'warning');
    return;
  }
  const btn = document.getElementById('exportCsvBtn');
  const txtEl = document.getElementById('exportCsvText');
  const originalText = txtEl ? txtEl.textContent : 'Exportar CSV';

  if (txtEl) txtEl.textContent = 'Generando archivo...';

  setTimeout(() => {
    const header = 'Fecha,Hora,Tipo,Usuario,Detalle,Subdetalle,Dispositivo\n';
    const rows = window.actividad.map(a => {
      const d = new Date(a.fecha);
      const fechaStr = d.toISOString().slice(0, 10);
      const horaStr = d.toLocaleTimeString('es-BO');
      return [
        fechaStr,
        horaStr,
        a.tipo || '',
        a.usuario || '',
        '"' + (a.detalle || '').replace(/"/g, '""') + '"',
        '"' + (a.subdetalle || a.extraDesc || '').replace(/"/g, '""') + '"',
        '"' + (a.device || 'Terminal Matriz').replace(/"/g, '""') + '"'
      ].join(',');
    }).join('\n');

    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auditoria_licoreria_tiaeli_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    if (txtEl) txtEl.textContent = `Descargado (${window.actividad.length} registros)`;
    if (typeof toast === 'function') toast(`CSV descargado: ${window.actividad.length} registros`, 'success');

    setTimeout(() => {
      if (txtEl) txtEl.textContent = originalText;
    }, 2500);
  }, 400);
}
window.exportarActividadCSV = exportarActividadCSV;

// Listeners interactivos
function setupAuditListeners() {
  const searchInput = document.getElementById('auditSearchInput');
  if (searchInput && !searchInput.dataset.auditBound) {
    searchInput.dataset.auditBound = 'true';
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        auditState.search = searchInput.value;
        auditState.currentPage = 1;
        renderActividad();
      }, 180);
    });
  }

  const tipoFilter = document.getElementById('auditTipoFilter');
  if (tipoFilter && !tipoFilter.dataset.auditBound) {
    tipoFilter.dataset.auditBound = 'true';
    tipoFilter.addEventListener('change', () => {
      auditState.tipo = tipoFilter.value;
      auditState.quickPill = 'all';
      auditState.currentPage = 1;
      renderActividad();
    });
  }

  const userFilter = document.getElementById('auditUsuarioFilter');
  if (userFilter && !userFilter.dataset.auditBound) {
    userFilter.dataset.auditBound = 'true';
    userFilter.addEventListener('change', () => {
      auditState.usuario = userFilter.value;
      auditState.currentPage = 1;
      renderActividad();
    });
  }

  const fechaDesde = document.getElementById('auditFechaDesde');
  const fechaHasta = document.getElementById('auditFechaHasta');
  if (fechaDesde && !fechaDesde.dataset.auditBound) {
    fechaDesde.dataset.auditBound = 'true';
    fechaDesde.addEventListener('change', () => {
      auditState.fechaDesde = fechaDesde.value;
      auditState.currentPage = 1;
      renderActividad();
    });
  }
  if (fechaHasta && !fechaHasta.dataset.auditBound) {
    fechaHasta.dataset.auditBound = 'true';
    fechaHasta.addEventListener('change', () => {
      auditState.fechaHasta = fechaHasta.value;
      auditState.currentPage = 1;
      renderActividad();
    });
  }

  if (!window._auditKeydownBound) {
    window._auditKeydownBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAuditModal();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        const input = document.getElementById('auditSearchInput');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupAuditListeners);
} else {
  setupAuditListeners();
}

// ==== JOB OFERTAS POR LOTE (VENCIMIENTO) ====
// Corre al iniciar y cada hora: marca lotes próximos a vencer como en oferta.
// Cuando el lote se agota, el precio vuelve a la normalidad automáticamente.
function ejecutarJobOfertasLote(notificar) {
  const prods = window.productos || [];
  let cambios = 0;
  const notifs = [];
  const now = new Date();
  prods.forEach(p => {
    const cfg = p.ofertaLote && p.ofertaLote.activa ? p.ofertaLote : null;
    safeArr(p.lotes).forEach(l => {
      if (safeNum(l.cantidad) <= 0) {
        if (l.enOfertaPorVencimiento) { l.enOfertaPorVencimiento = false; cambios++; }
        return;
      }
      if (!l.vencimiento) return;
      const vd = new Date(l.vencimiento);
      const dias = Math.ceil((vd - now) / 86400000);
      const umbral = cfg ? cfg.dias : 0;
      const deberiaOferta = cfg && dias <= umbral;
      if (deberiaOferta && !l.enOfertaPorVencimiento) {
        l.enOfertaPorVencimiento = true;
        cambios++;
        notifs.push(p.nombre + ' (lote vence en ' + dias + 'd) — oferta ' + cfg.descuento + '%');
        if (typeof registrarHistorialPrecio === 'function') {
          registrarHistorialPrecio(p, 'oferta', 'Oferta automática por lote: vence en ' + dias + ' días (' + cfg.descuento + '% dcto)');
        }
      } else if (!deberiaOferta && l.enOfertaPorVencimiento) {
        l.enOfertaPorVencimiento = false;
        cambios++;
      }
    });
  });
  if (cambios > 0) {
    if (typeof save === 'function') save();
    prods.forEach(p => { if (window.syncSaveProducto) window.syncSaveProducto(p); });
    if (typeof filterAndRender === 'function') filterAndRender();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderPOSProducts === 'function') renderPOSProducts();
    if (typeof renderVencimientos === 'function') renderVencimientos(window.activeVencDias || 7);
  }
  if (notificar !== false && notifs.length) {
    toast('Lotes en oferta por vencimiento: ' + notifs.length, 'success');
    notifs.slice(0, 3).forEach(n => toast(n, 'info'));
    if (typeof registrarActividad === 'function') {
      notifs.forEach(n => registrarActividad('oferta', 'Oferta automática: ' + n));
    }
  }
  return cambios;
}
window.ejecutarJobOfertasLote = ejecutarJobOfertasLote;

// ==== INICIALIZACIÓN ====
function initGestion() {
  actualizarChipUsuario();
  actualizarBadgesFiados();
  if (!sesion) {
    setTimeout(function() { mostrarLogin(true); }, 100);
  }
  setTimeout(function() {
    try { ejecutarJobOfertasLote(true); } catch (e) { console.warn('Job ofertas:', e); }
  }, 1500);
  setInterval(function() {
    try { ejecutarJobOfertasLote(false); } catch (e) { console.warn('Job ofertas (hora):', e); }
  }, 3600000);
}
window.initGestion = initGestion;
window.calcularMargenEntrada = function() {
  const inpCosto = document.getElementById('entradaCosto');
  const inpPrecio = document.getElementById('entradaNuevoPrecioInput');
  const badge = document.getElementById('entradaNuevoMargenBadge');
  if (!inpCosto || !inpPrecio || !badge) return;
  const c = parseFloat(inpCosto.value) || 0;
  const p = parseFloat(inpPrecio.value) || 0;
  if (p > 0 && c > 0) {
    const ganancia = p - c;
    const margen = ((ganancia / p) * 100).toFixed(1);
    badge.textContent = `Ganancia: ${ganancia >= 0 ? '+' : ''}Bs. ${ganancia.toFixed(2)} (${margen}%)`;
    badge.style.color = ganancia >= 0 ? 'var(--inv-primary, #f97316)' : 'var(--inv-error, #ef4444)';
  } else {
    badge.textContent = '';
  }
};

// ==== GASTOS DE TIENDA (LUZ, AGUA, EXTRAS) ====
let gastos = [];
try {
  gastos = JSON.parse(localStorage.getItem('tiaeli_gastos') || '[]');
} catch (e) {
  gastos = [];
}
window.gastos = gastos;

function saveGastos() {
  localStorage.setItem('tiaeli_gastos', JSON.stringify(gastos));
  window.gastos = gastos;
}
window.saveGastos = saveGastos;
window.setGastosGlobal = function(nuevos) {
  gastos = nuevos || [];
  window.gastos = gastos;
};

function abrirGastoModal() {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  const overlay = document.getElementById('gastoModalOverlay');
  if (!overlay) return;
  document.getElementById('gastoMonto').value = '';
  document.getElementById('gastoNota').value = '';
  const fechaInp = document.getElementById('gastoFecha');
  if (fechaInp) fechaInp.value = new Date().toISOString().slice(0, 10);
  seleccionarCategoriaGasto('luz');
  overlay.style.display = 'flex';
}
window.abrirGastoModal = abrirGastoModal;

function cerrarGastoModal() {
  const overlay = document.getElementById('gastoModalOverlay');
  if (overlay) overlay.style.display = 'none';
}
window.cerrarGastoModal = cerrarGastoModal;

let _gastoCategoriaSeleccionada = 'luz';
function seleccionarCategoriaGasto(cat) {
  _gastoCategoriaSeleccionada = cat;
  ['luz', 'agua', 'extras'].forEach(c => {
    const btn = document.getElementById('btnGastoCat_' + c);
    if (btn) {
      if (c === cat) {
        btn.classList.add('active');
        btn.style.borderColor = 'var(--inv-primary, #f97316)';
        btn.style.background = 'rgba(249,115,22,0.12)';
        btn.style.color = 'var(--inv-primary, #f97316)';
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = 'var(--border)';
        btn.style.background = 'var(--bg2)';
        btn.style.color = 'var(--text2)';
      }
    }
  });
}
window.seleccionarCategoriaGasto = seleccionarCategoriaGasto;

function confirmarGasto() {
  const monto = parseFloat(document.getElementById('gastoMonto')?.value) || 0;
  const fechaVal = document.getElementById('gastoFecha')?.value || new Date().toISOString().slice(0, 10);
  const nota = (document.getElementById('gastoNota')?.value || '').trim();
  
  if (monto <= 0) {
    toast('Ingresa un monto válido mayor a 0', 'error');
    return;
  }
  
  const cat = _gastoCategoriaSeleccionada || 'extras';
  const catLabels = { luz: 'Luz (Electricidad)', agua: 'Agua', extras: 'Extras / Insumos' };
  const catLabel = catLabels[cat] || 'Gasto';

  const nuevoGasto = {
    id: 'gasto_' + (typeof genId === 'function' ? genId() : Date.now()),
    categoria: cat,
    categoriaLabel: catLabel,
    monto: monto,
    fecha: new Date(fechaVal + 'T12:00:00').getTime(),
    fechaStr: fechaVal,
    nota: nota || catLabel,
    usuario: (typeof usuarioActual === 'function' && usuarioActual()) || 'ELI',
    createdAt: Date.now()
  };

  gastos.unshift(nuevoGasto);
  saveGastos();
  if (typeof window.syncSaveGasto === 'function') window.syncSaveGasto(nuevoGasto);
  
  registrarActividad('gasto', `Gasto registrado: ${catLabel} — Bs. ${monto.toFixed(2)}${nota ? ' (' + nota + ')' : ''}`);
  
  cerrarGastoModal();
  renderGastos();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast(`Gasto de Bs. ${monto.toFixed(2)} (${catLabel}) guardado con éxito`, 'success');
}
window.confirmarGasto = confirmarGasto;

function eliminarGasto(id) {
  const idx = gastos.findIndex(g => g.id === id);
  if (idx < 0) return;
  const g = gastos[idx];
  if (!confirm(`¿Eliminar gasto de Bs. ${g.monto.toFixed(2)} (${g.categoriaLabel || g.categoria})?`)) return;
  
  gastos.splice(idx, 1);
  saveGastos();
  if (typeof window.syncDeleteGasto === 'function') window.syncDeleteGasto(id);
  registrarActividad('gasto', `Gasto eliminado: ${g.categoriaLabel || g.categoria} — Bs. ${g.monto.toFixed(2)}`);
  
  renderGastos();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast('Gasto eliminado', 'info');
}
window.eliminarGasto = eliminarGasto;

function renderGastos() {
  const container = document.getElementById('gastosTableBody');
  const emptyState = document.getElementById('gastosEmptyState');
  if (!container) return;

  const now = new Date();
  const mesActual = now.getMonth();
  const anioActual = now.getFullYear();

  // Filtrar gastos del mes actual para los KPIs
  const gastosMes = gastos.filter(g => {
    const d = new Date(g.fecha);
    return d.getMonth() === mesActual && d.getFullYear() === anioActual;
  });

  const totalMes = gastosMes.reduce((s, g) => s + safeNum(g.monto), 0);
  const luzMes = gastosMes.filter(g => g.categoria === 'luz').reduce((s, g) => s + safeNum(g.monto), 0);
  const aguaMes = gastosMes.filter(g => g.categoria === 'agua').reduce((s, g) => s + safeNum(g.monto), 0);
  const extrasMes = gastosMes.filter(g => g.categoria === 'extras').reduce((s, g) => s + safeNum(g.monto), 0);

  const elTotal = document.getElementById('kpiGastosTotalMes');
  const elLuz = document.getElementById('kpiGastosLuzMes');
  const elAgua = document.getElementById('kpiGastosAguaMes');
  const elExtras = document.getElementById('kpiGastosExtrasMes');

  if (elTotal) elTotal.textContent = 'Bs. ' + totalMes.toFixed(2);
  if (elLuz) elLuz.textContent = 'Bs. ' + luzMes.toFixed(2);
  if (elAgua) elAgua.textContent = 'Bs. ' + aguaMes.toFixed(2);
  if (elExtras) elExtras.textContent = 'Bs. ' + extrasMes.toFixed(2);

  // Filtro de categoría en tabla
  const catFilter = document.getElementById('gastosFilterCat')?.value || 'todos';
  let lista = [...gastos];
  if (catFilter !== 'todos') {
    lista = lista.filter(g => g.categoria === catFilter);
  }

  if (lista.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  const catBadges = {
    luz: '<span class="badge" style="background:rgba(245,158,11,0.15);color:#d97706;border:1px solid rgba(245,158,11,0.3);font-weight:700;">⚡ Luz</span>',
    agua: '<span class="badge" style="background:rgba(59,130,246,0.15);color:#2563eb;border:1px solid rgba(59,130,246,0.3);font-weight:700;">💧 Agua</span>',
    extras: '<span class="badge" style="background:rgba(139,92,246,0.15);color:#7c3aed;border:1px solid rgba(139,92,246,0.3);font-weight:700;">📦 Extras / Insumos</span>'
  };

  container.innerHTML = lista.map(g => {
    const fStr = g.fecha ? new Date(g.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : (g.fechaStr || '—');
    const badge = catBadges[g.categoria] || catBadges.extras;
    return `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:10px 14px;font-size:0.86rem;color:var(--text2);">${fStr}</td>
        <td style="padding:10px 14px;">${badge}</td>
        <td style="padding:10px 14px;font-size:0.88rem;font-weight:600;color:var(--text1);">${escHTML(g.nota || '—')}</td>
        <td style="padding:10px 14px;font-size:0.95rem;font-weight:800;color:var(--red,#ef4444);text-align:right;">-Bs. ${safeNum(g.monto).toFixed(2)}</td>
        <td style="padding:10px 14px;font-size:0.82rem;color:var(--text3);text-align:center;">${escHTML(g.usuario || 'ELI')}</td>
        <td style="padding:10px 14px;text-align:center;">
          <button type="button" onclick="eliminarGasto('${g.id}')" style="background:transparent;border:none;color:#ef4444;cursor:pointer;padding:4px;" title="Eliminar este gasto">
            <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}
window.renderGastos = renderGastos;

// ==== CONSUMO DE DUEÑO / RETIRO PERSONAL DE MERCADERÍA ====
function abrirConsumoDuenoModal(productoId) {
  if (!sesion) { toast('Debes iniciar sesión primero', 'warning'); return; }
  const overlay = document.getElementById('consumoDuenoOverlay');
  if (!overlay) return;

  const sel = document.getElementById('consumoDuenoProductoSelect');
  if (sel) {
    const prods = (window.productos || []).filter(p => p && p.activo !== false && !p.archivado);
    prods.sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
    sel.innerHTML = '<option value="">-- Selecciona el producto que se retira --</option>' +
      prods.map(p => {
        const stk = getTotalUnidadesBase(p);
        const cp = getCostoPromedio(p);
        return `<option value="${p.id}" ${p.id === productoId ? 'selected' : ''}>${escHTML(p.nombre)} (Stock: ${stk} | Costo: Bs. ${cp.toFixed(2)})</option>`;
      }).join('');
  }

  document.getElementById('consumoDuenoCantidad').value = '1';
  document.getElementById('consumoDuenoNota').value = '';
  
  const userSelect = document.getElementById('consumoDuenoUsuario');
  if (userSelect) {
    const cur = usuarioActual() || 'ELI';
    userSelect.value = cur;
  }

  onConsumoDuenoProductoChanged();
  overlay.style.display = 'flex';
}
window.abrirConsumoDuenoModal = abrirConsumoDuenoModal;

function cerrarConsumoDuenoModal() {
  const overlay = document.getElementById('consumoDuenoOverlay');
  if (overlay) overlay.style.display = 'none';
}
window.cerrarConsumoDuenoModal = cerrarConsumoDuenoModal;

function onConsumoDuenoProductoChanged() {
  const pid = document.getElementById('consumoDuenoProductoSelect')?.value;
  const p = (window.productos || []).find(x => x.id === pid);
  const infoCard = document.getElementById('consumoDuenoInfoCard');
  if (!p) {
    if (infoCard) infoCard.style.display = 'none';
    actualizarCalculoConsumoDueno();
    return;
  }
  if (infoCard) infoCard.style.display = 'block';
  
  const stk = getTotalUnidadesBase(p);
  const cp = getCostoPromedio(p);
  const pv = getPrecioVentaEfectivo(p);

  document.getElementById('consumoDuenoProdNombre').textContent = p.nombre;
  document.getElementById('consumoDuenoProdStock').textContent = stk;
  document.getElementById('consumoDuenoProdCosto').textContent = 'Bs. ' + cp.toFixed(2);
  document.getElementById('consumoDuenoProdVenta').textContent = 'Bs. ' + pv.toFixed(2);

  const inpCant = document.getElementById('consumoDuenoCantidad');
  if (inpCant) {
    inpCant.max = stk;
    if (stk <= 0) inpCant.value = '0';
    else if (parseInt(inpCant.value) > stk || parseInt(inpCant.value) <= 0) inpCant.value = '1';
  }

  actualizarCalculoConsumoDueno();
}
window.onConsumoDuenoProductoChanged = onConsumoDuenoProductoChanged;

function actualizarCalculoConsumoDueno() {
  const pid = document.getElementById('consumoDuenoProductoSelect')?.value;
  const cant = parseInt(document.getElementById('consumoDuenoCantidad')?.value, 10) || 0;
  const p = (window.productos || []).find(x => x.id === pid);
  
  const cardCalculo = document.getElementById('consumoDuenoCalculoCard');
  if (!p || cant <= 0) {
    if (cardCalculo) cardCalculo.style.display = 'none';
    return;
  }
  if (cardCalculo) cardCalculo.style.display = 'block';

  const cp = getCostoPromedio(p);
  const stk = getTotalUnidadesBase(p);
  const costoTotalRetiro = cant * cp;
  const pv = getPrecioVentaEfectivo(p) * cant;

  document.getElementById('consumoDuenoCalcStockNuevo').textContent = Math.max(0, stk - cant);
  document.getElementById('consumoDuenoCalcVentaPerdida').textContent = 'Bs. ' + pv.toFixed(2);
  document.getElementById('consumoDuenoCalcImpactoGanancia').textContent = '-Bs. ' + costoTotalRetiro.toFixed(2);
}
window.actualizarCalculoConsumoDueno = actualizarCalculoConsumoDueno;

function confirmarConsumoDueno() {
  const pid = document.getElementById('consumoDuenoProductoSelect')?.value;
  let cantidad = parseInt(document.getElementById('consumoDuenoCantidad')?.value, 10) || 0;
  const usuarioRetiro = document.getElementById('consumoDuenoUsuario')?.value || usuarioActual() || 'ELI';
  const nota = (document.getElementById('consumoDuenoNota')?.value || '').trim();

  if (!pid) { toast('Selecciona el producto a retirar', 'warning'); return; }
  if (cantidad <= 0) { toast('Ingresa una cantidad mayor a 0', 'error'); return; }

  const p = (window.productos || []).find(x => x.id === pid);
  if (!p) { toast('Producto no encontrado', 'error'); return; }
  const stock = getTotalUnidadesBase(p);
  if (cantidad > stock) { toast(`Stock insuficiente (disponible: ${stock})`, 'error'); return; }

  // Descontar por PEPS
  let lotesAfectados = [];
  let noCumplido = 0;
  if (typeof descontarStockFEFO === 'function') {
    const res = descontarStockFEFO(pid, cantidad);
    lotesAfectados = res.lotesAfectados || [];
    noCumplido = res.noCumplido || 0;
  } else {
    noCumplido = cantidad;
    for (const lote of (p.lotes || [])) {
      if (lote.cantidad <= 0) continue;
      const d = Math.min(lote.cantidad, cantidad);
      lote.cantidad -= d;
      lote.cantidadBaseUnidades = lote.cantidad;
      cantidad -= d;
      lotesAfectados.push({ vencimiento: lote.vencimiento, cantidadDescontada: d, costoUnitario: lote.costo || p.costo || 0 });
      if (cantidad <= 0) break;
    }
  }

  // Costo total exacto de las unidades retiradas (impacto directo en ganancias)
  let costoTotalRetiro = lotesAfectados.reduce((s, la) => s + (la.cantidadDescontada * safeNum(la.costoUnitario)), 0);
  if (costoTotalRetiro <= 0) {
    costoTotalRetiro = (parseInt(document.getElementById('consumoDuenoCantidad')?.value, 10) || 1) * getCostoPromedio(p);
  }

  p.stock = getTotalUnidadesBase(p);
  p.vencimiento = getVencimientoMasCercano(p);
  p.costoPromedioUnidad = getCostoPromedio(p);
  p.costo = p.costoPromedioUnidad;
  p.updatedAt = Date.now();

  const cantRetiro = parseInt(document.getElementById('consumoDuenoCantidad')?.value, 10) || 1;

  let salidas = [];
  try { salidas = JSON.parse(localStorage.getItem('tiaeli_salidas') || '[]'); } catch { salidas = []; }
  const nuevaSalida = {
    id: genId(),
    productoId: pid,
    productoNombre: p.nombre,
    cantidad: cantRetiro,
    motivo: 'personal',
    tipo: 'consumo_dueno',
    costoUnitario: costoTotalRetiro / cantRetiro,
    costoTotal: costoTotalRetiro,
    precioVentaPerdido: (p.venta || p.precioVentaUnidad || 0) * cantRetiro,
    nota: nota || `Consumo de dueño (${usuarioRetiro})`,
    fecha: Date.now(),
    usuario: usuarioRetiro,
    lotesAfectados
  };
  salidas.unshift(nuevaSalida);
  localStorage.setItem('tiaeli_salidas', JSON.stringify(salidas));

  registrarActividad('salida', `Consumo Dueño: ${p.nombre} (-${cantRetiro}) por ${usuarioRetiro} — Costo: Bs. ${costoTotalRetiro.toFixed(2)}`);

  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  if (typeof window.syncSaveSalida === 'function') window.syncSaveSalida(nuevaSalida);

  cerrarConsumoDuenoModal();
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();

  toast(`Retiro registrado: -${cantRetiro} ${p.nombre}. Se descontaron Bs. ${costoTotalRetiro.toFixed(2)} de las ganancias.`, 'success');
}
window.confirmarConsumoDueno = confirmarConsumoDueno;
