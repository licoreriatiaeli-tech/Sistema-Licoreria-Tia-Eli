// ═══════════════════════════════════════════
// app.js — Core inventory logic v4 (Lotes & FEFO + Paquetes + Ofertas)
// ═══════════════════════════════════════════

// Utils globales ahora vienen de utils-bundle.js
// window.safeNum, window.escHTML, window.safeArr, window.genId, etc.

// Declaración global temprana para evitar TDZ en sincronización
var activeVencDias = 7;
window.activeVencDias = activeVencDias;

// csvSafe y _safeImg no están en utils-bundle, mantener aquí
function csvSafe(v){
  var s = String(v == null ? "" : v);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}
function _safeImg(f){ return (f && typeof f === "string" && /^data:image\//.test(f)) ? f : ""; }
window.csvSafe = csvSafe;
window._safeImg = _safeImg;

let productos = [];
try {
  // Limpieza total del sistema para entrega a producción al dueño
  if (localStorage.getItem('tiaeli_prod_ready_clean_v1') !== 'true') {
    const keysToWipe = [
      'tiaeli_v2',
      'tiaeli_ventas',
      'tiaeli_combos',
      'tiaeli_clientes',
      'tiaeli_fiados',
      'tiaeli_pagos',
      'tiaeli_salidas',
      'tiaeli_entradas',
      'tiaeli_gastos',
      'tiaeli_historial_precios',
      'tiaeli_actividad'
    ];
    keysToWipe.forEach(k => {
      try { localStorage.setItem(k, JSON.stringify([])); } catch(e){}
    });
    localStorage.setItem('tiaeli_prod_ready_clean_v1', 'true');
  }

  productos = JSON.parse(localStorage.getItem('tiaeli_v2') || '[]');
  if (productos.some(p => p.id && p.id.startsWith('sim_'))) {
    productos = productos.filter(p => !p.id || !p.id.startsWith('sim_'));
    localStorage.setItem('tiaeli_v2', JSON.stringify(productos));
  }
} catch (e) {
  console.warn('localStorage corrupto, reseteando:', e);
  localStorage.removeItem('tiaeli_v2');
  productos = [];
}
window.productos = productos;
window.setProductosGlobal = function(nuevos) {
  productos = nuevos;
  window.productos = nuevos;
  if (window.EventBus) window.EventBus.emit('productos:changed', productos);
};

const CATS = {Licores:'[L]',Cervezas:'[C]',Sodas:'[S]',Jugos:'[J]',Galletas:'[G]',Chicles:'[CH]',Snacks:'[SN]',Cigarrillos:'[CI]',Farmacia:'[F]',Otros:'[+]'};
const COLLECTION = 'inventario_tiaeli';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ── UTILS EMPAQUES ──
function getEmpaquesProducto(p) {
  return safeArr(p.empaques);
}

function getEmpaquePredeterminado(p) {
  const empaques = getEmpaquesProducto(p);
  if (!empaques.length) return null;
  return empaques.find(e => e.predeterminado || e.esPredeterminado) || empaques[0];
}

function getUnidadesPorEmpaque(p, empaqueId) {
  if (empaqueId === 'unidad_base') return 1;
  const empaques = getEmpaquesProducto(p);
  const empaque = empaques.find(e => e.id === empaqueId);
  return empaque ? empaque.unidades : 1;
}

function getNombreEmpaque(p, empaqueId) {
  if (empaqueId === 'unidad_base') return p.unidadBase || 'Unidad';
  const empaques = getEmpaquesProducto(p);
  const empaque = empaques.find(e => e.id === empaqueId);
  return empaque ? empaque.nombre : 'Paquete';
}

function getEmpaquePorNombre(p, nombre) {
  const empaques = getEmpaquesProducto(p);
  return empaques.find(e => e.nombre === nombre);
}

// ── UTILS LOTES Y FORMATOS ──
// Stock total expresado SIEMPRE en UNIDADES BASE
function getTotalUnidadesBase(p) {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes)) return safeNum(p.stock);
  return p.lotes.reduce((sum, l) => sum + safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad), 0);
}

function getVencimientoMasCercano(p) {
  if (!p) return null;
  if (!p.lotes || !Array.isArray(p.lotes) || p.lotes.length === 0) return p.vencimiento || null;
  const activos = p.lotes.filter(l => l && safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad) > 0 && l.vencimiento);
  if (!activos.length) return null;
  activos.sort((a, b) => new Date(a.vencimiento) - new Date(b.vencimiento));
  return activos[0].vencimiento;
}

function getCostoPromedio(p) {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes) || p.lotes.length === 0) return safeNum(p.costoPromedioUnidad || p.costo);
  const activos = p.lotes.filter(l => l && safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad) > 0);
  if (!activos.length) return safeNum(p.costoPromedioUnidad || p.costo);
  let totalValor = 0, totalStock = 0;
  activos.forEach(l => {
    const unidades = safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad);
    const costoUnit = safeNum(l.costoPorUnidad) || (safeNum(l.costo) / (getUnidadesPorEmpaque(p, l.empaqueId) || 1));
    totalStock += unidades;
    totalValor += unidades * costoUnit;
  });
  return totalStock > 0 ? totalValor / totalStock : safeNum(p.costoPromedioUnidad || p.costo);
}

window.getTotalUnidadesBase = getTotalUnidadesBase;
window.getVencimientoMasCercano = getVencimientoMasCercano;
window.getCostoPromedio = getCostoPromedio;

// ── ALIAS CRÍTICO: getStockTotal → getTotalUnidadesBase ──
// Múltiples módulos (gestion.js, ventas.js, extras.js) llaman getStockTotal()
// pero la función real siempre fue getTotalUnidadesBase(). Este alias unifica ambos.
function getStockTotal(p) { return getTotalUnidadesBase(p); }
window.getStockTotal = getStockTotal;

// ── FALLBACK: sincronizar() — por si Firebase/sync.js no cargó ──
if (!window.sincronizar) {
  window.sincronizar = function() { toast('Sincronización no disponible sin conexión', 'warning'); };
}

function migrarProductoV3(p) {
  if (!p) return p;

  // 1. Formatos de venta
  if (!Array.isArray(p.formatosVenta) || p.formatosVenta.length === 0) {
    p.formatosVenta = [
      { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: safeNum(p.precioVentaUnidad || p.venta), esBase: true }
    ];
    if (Array.isArray(p.empaques) && p.empaques.length > 0) {
      p.empaques.forEach(emp => {
        p.formatosVenta.push({
          id: emp.id || ('fmt_' + genId()),
          nombre: emp.nombre || 'Paquete',
          unidades: safeNum(emp.unidades) || 12,
          precio: safeNum(p.precioVentaPaquete) || 0
        });
      });
    }
  }

  // 2. Formatos de compra
  if (!Array.isArray(p.formatosCompra)) {
    p.formatosCompra = Array.isArray(p.empaques) && p.empaques.length > 0
      ? p.empaques.map(e => ({ id: e.id, nombre: e.nombre, unidades: e.unidades }))
      : [];
  }

  // 3. Normalizar Lotes a cantidadBaseUnidades
  if (!Array.isArray(p.lotes) || p.lotes.length === 0) {
    const st = safeNum(p.stock);
    if (st > 0) {
      p.lotes = [{
        id: genId(),
        cantidadBaseUnidades: st,
        cantidad: st,
        costoTotalLote: safeNum(p.costo) * st,
        costoPorUnidad: safeNum(p.costo),
        vencimiento: p.vencimiento || '',
        fechaIngreso: p.fechaRegistro || new Date().toISOString().slice(0, 10),
        nota: 'Stock inicial migrado'
      }];
    } else {
      p.lotes = [];
    }
  } else {
    p.lotes.forEach(l => {
      if (l.cantidadBaseUnidades === undefined) {
        const unidEmp = getUnidadesPorEmpaque(p, l.empaqueId || 'unidad_base') || 1;
        l.cantidadBaseUnidades = safeNum(l.cantidad) * unidEmp;
        l.cantidad = l.cantidadBaseUnidades;
      } else {
        l.cantidad = l.cantidadBaseUnidades;
      }
      if (l.costoPorUnidad === undefined) {
        const unidEmp = getUnidadesPorEmpaque(p, l.empaqueId || 'unidad_base') || 1;
        l.costoPorUnidad = safeNum(l.costo) / unidEmp;
      }
      if (l.costoTotalLote === undefined) {
        l.costoTotalLote = l.cantidadBaseUnidades * l.costoPorUnidad;
      }
      if (!l.id) l.id = genId();
    });
  }

  // 4. Sincronizar metadatos
  p.stock = p.lotes.reduce((s, l) => s + safeNum(l.cantidadBaseUnidades), 0);
  p.costoPromedioUnidad = getCostoPromedio(p);
  p.costo = p.costoPromedioUnidad;
  p.vencimiento = getVencimientoMasCercano(p);
  const fmtUni = p.formatosVenta.find(f => f.id === 'unidad');
  if (fmtUni) {
    p.precioVentaUnidad = fmtUni.precio;
    p.venta = fmtUni.precio;
  }
  return p;
}
window.migrarProductoV3 = migrarProductoV3;

function migrarTodosLosProductos() {
  productos = productos.map(migrarProductoV3);
  save();
}

function save() {
  try {
    localStorage.setItem('tiaeli_v2', JSON.stringify(productos));
  } catch (e) {
    console.error('save failed:', e);
    toast('Error al guardar — almacenamiento lleno', 'error');
  }
  window.productos = productos;
  if (window.EventBus) window.EventBus.emit('productos:changed', productos);
}

window.productos = productos;
migrarTodosLosProductos();

// ── SEED PRODUCTOS INICIALES ──
function seedProductos() {
  if (productos.length > 0) return;
  save();
}
seedProductos();

// ── TOAST ──
let toastTimer;
function toast(msg, type, icon) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  const icons = {success:'✓', error:'✕', warning:'⚠', info:'i'};
  const ic = icon || icons[type] || '·';
  el.innerHTML = `<span class="toast-icon">${ic}</span>${msg}`;
  el.className = 'toast show ' + (type||'');
  // Errores y warnings duran más para que el usuario los pueda leer bien
  const duration = (type === 'error' || type === 'warning') ? 5000 : 3200;
  toastTimer = setTimeout(() => { el.className = 'toast'; }, duration);
}

// ── NAVIGATION ──
function navegarA(sectionId) {
  // 🔧 AUTO-RESET: Si salimos de "agregar" con datos sin guardar, limpiar formulario
  const currentSection = document.querySelector('.section.active')?.id?.replace('section-', '');
  if (currentSection === 'agregar' && sectionId !== 'agregar') {
    const editId = document.getElementById('editId')?.value;
    const hasUnsavedData = (
      formatosVentaTemp.length > 0 ||
      productoTieneVencimiento ||
      document.getElementById('fNombre')?.value?.trim() ||
      document.getElementById('precioUnidad_unidad')?.value ||
      window.currentPhotoBase64
    );
    if (hasUnsavedData) {
      resetProductForm();
    }
  }

  const currentSec = document.querySelector('.section.active');
  const sec = document.getElementById('section-' + sectionId);
  const nav = document.getElementById('nav-' + sectionId);
  
  if (currentSec && currentSec !== sec) {
    currentSec.classList.remove('active');
    currentSec.classList.remove('exiting');
  }
  if (sec) {
    sec.classList.remove('exiting');
    sec.classList.add('active');
  }

  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.classList.toggle('pos-active', sectionId === 'pos');
  }

  // Toggle posFloatingElements visibility
  const posFloating = document.getElementById('posFloatingElements');
  if (posFloating) {
    if (sectionId === 'pos') {
      posFloating.style.display = 'block';
      if (typeof window.initPOS === 'function') window.initPOS();
      else if (typeof updatePOSCart === 'function') updatePOSCart();
    } else {
      posFloating.style.display = 'none';
      const cartContainer = document.getElementById('posCartContainer');
      const backdrop = document.getElementById('posCartBackdrop');
      if (cartContainer) cartContainer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    }
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (nav) nav.classList.add('active');
  
  // Update mobile bottom nav
  document.querySelectorAll('.mobile-nav-item').forEach(m => {
    if (m.dataset.section === sectionId) {
      m.classList.add('active');
    } else {
      m.classList.remove('active');
    }
  });
  
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
  window.scrollTo(0, 0);
  
  // RENDER DATA FOR SECTION (single source of truth)
  if (sectionId === 'dashboard') { 
    renderDashboard(); 
    if(window.renderAllCharts) renderAllCharts(); 
    if(window.renderCategoryGrid) renderCategoryGrid(); 
    if(window.playTitleAnimation) window.playTitleAnimation(); 
    if(window.initOdometers) window.initOdometers(80); 
  }
  if (sectionId === 'inventario') { 
    renderTabla(); 
  }
  if (sectionId === 'ventas') { 
    if(typeof poblarSelectProductos==='function') poblarSelectProductos(); 
    if(typeof renderVentasStats==='function') renderVentasStats(); 
    if(typeof renderVentasHoy==='function') renderVentasHoy(); 
    if(typeof renderCombosVenta==='function') renderCombosVenta(); 
  }
  if (sectionId === 'pos') { 
    if(typeof window.initPOS==='function') window.initPOS(); 
    else { 
      if(typeof renderPOSProducts==='function') renderPOSProducts(); 
      if(typeof renderCombosVenta==='function') renderCombosVenta(); 
    } 
    if(typeof renderVentasHoy==='function') renderVentasHoy(); 
  }
  if (sectionId === 'historial') { 
    if(typeof renderHistorial==='function') renderHistorial(); 
  }
  if (sectionId === 'analytics') { 
    if(window.renderAnalyticsCharts) renderAnalyticsCharts(); 
  }
  if (sectionId === 'combos') { 
    if(window.renderCombosManager) renderCombosManager(); 
  }
  if (sectionId === 'vencimientos') { 
    renderVencimientos(7); 
  }
  if (sectionId === 'agregar') { 
    resetProductForm(); 
    if (typeof window.initDuplicateProductDetector === 'function') window.initDuplicateProductDetector(); 
  }
  if (sectionId === 'fiados') { 
    if(typeof renderFiados==='function') renderFiados(); 
  }
  if (sectionId === 'gastos') { 
    if(typeof renderGastos==='function') renderGastos(); 
  }
  if (sectionId === 'actividad') { 
    if(typeof renderActividad==='function') renderActividad(); 
  }
  if (sectionId === 'qr') { 
    if(typeof window.initQRPreviews === 'function') window.initQRPreviews(); 
  }
  
  // Emitir evento de cambio de sección
  if (window.EventBus) window.EventBus.emit('section:changed', sectionId);
}
window.navegarA = navegarA;

document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', e => {
    e.preventDefault();
    const sec = n.dataset.section;
    
    // 🔧 AUTO-RESET: Si salimos de "agregar" con datos sin guardar, limpiar formulario
    const currentSection = document.querySelector('.section.active')?.id?.replace('section-', '');
    if (currentSection === 'agregar' && sec !== 'agregar') {
      const editId = document.getElementById('editId')?.value;
      const hasUnsavedData = (
        formatosVentaTemp.length > 0 ||
        productoTieneVencimiento ||
        document.getElementById('fNombre')?.value?.trim() ||
        document.getElementById('precioUnidad_unidad')?.value ||
        window.currentPhotoBase64
      );
      if (hasUnsavedData) {
        resetProductForm();
      }
    }
    
    // NAVIGATE - navegarA handles all rendering
    navegarA(sec);
  });
});

document.getElementById('menuToggle')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.toggle('open'); document.getElementById('overlay')?.classList.toggle('active'); });
document.getElementById('overlay')?.addEventListener('click', () => { document.getElementById('sidebar')?.classList.remove('open'); document.getElementById('overlay')?.classList.remove('active'); });


// ── DASHBOARD ──
function renderDashboard() {
  const now = new Date();
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const venceIn30 = new Date(); venceIn30.setDate(venceIn30.getDate() + 30);

  const total = productos.length;
  const enStock = productos.filter(p => p.stock > 0).length;
  const bajo = productos.filter(p => p.stock > 0 && p.stock <= (p.stockMinUnidades || p.stockMin || 24)).length;
  const valor = productos.reduce((s, p) => s + (p.lotes||[]).reduce((s2,l)=>s2+(l.cantidad*(l.costo||0)),0), 0);
  const listaVentasHoy = (window.ventas || []).filter(v => {
    const f = typeof v.fecha === 'number' ? new Date(v.fecha) : new Date(v.fecha);
    return f >= hoy;
  });
  const ventasHoy = listaVentasHoy.reduce((s, v) => s + (safeNum(v.total) || 0), 0);
  const gananciaHoy = listaVentasHoy.reduce((s, v) => {
    if (v.ganancia !== undefined && v.ganancia !== null) return s + safeNum(v.ganancia);
    const cost = safeNum(v.costo) || 0;
    return s + (safeNum(v.total) - cost);
  }, 0);

  // Retiros del dueño de hoy (descuentan del costo de ganancias)
  let salidasList = [];
  try { salidasList = JSON.parse(localStorage.getItem('tiaeli_salidas') || '[]'); } catch { salidasList = []; }
  const salidasHoy = salidasList.filter(s => {
    const f = typeof s.fecha === 'number' ? new Date(s.fecha) : new Date(s.fecha);
    return f >= hoy && (s.motivo === 'personal' || s.tipo === 'consumo_dueno');
  });
  const costoRetirosHoy = salidasHoy.reduce((sum, s) => sum + (safeNum(s.costoTotal) || (safeNum(s.cantidad) * safeNum(s.costoUnitario))), 0);

  // Gastos operativos de hoy (Luz, agua, extras)
  let gastosList = [];
  try { gastosList = JSON.parse(localStorage.getItem('tiaeli_gastos') || '[]'); } catch { gastosList = []; }
  const gastosHoy = gastosList.filter(g => {
    const f = typeof g.fecha === 'number' ? new Date(g.fecha) : new Date(g.fecha);
    return f >= hoy;
  });
  const totalGastosHoy = gastosHoy.reduce((sum, g) => sum + safeNum(g.monto), 0);

  // Ganancia Neta Real (descontando retiros de dueño y gastos)
  const gananciaNetaRealHoy = gananciaHoy - costoRetirosHoy - totalGastosHoy;

  // Fiados pendientes
  let fiadosPendiente = 0;
  let clientesConDeuda = 0;
  if (window.clientes && window.fiados && window.pagos) {
    window.clientes.forEach(c => {
      const totalFiados = (window.fiados || []).filter(f => f.clienteId === c.id).reduce((s, f) => s + (f.monto || 0), 0);
      const totalPagos = (window.pagos || []).filter(p => p.clienteId === c.id).reduce((s, p) => s + (p.monto || 0), 0);
      const saldo = totalFiados - totalPagos;
      if (saldo > 0.01) {
        fiadosPendiente += saldo;
        clientesConDeuda++;
      }
    });
  }

  // Vencimientos por lotes, no solo productos
  let lotesVenc = 0;
  productos.forEach(p => {
    (p.lotes||[]).forEach(l => {
      if (l.cantidad>0 && l.vencimiento && new Date(l.vencimiento)<=venceIn30 && new Date(l.vencimiento)>=now) {
        lotesVenc++;
      }
    });
  });

  const anim = (id, val, pre, suf, dec) => {
    const el = document.getElementById(id); 
    if (!el) return; 
    const formatted = dec ? Number(val).toFixed(dec) : val;
    if (typeof window.odoHtml === 'function') {
      el.innerHTML = window.odoHtml(formatted, dec ? 'money' : 'int', pre || '', suf || '');
    } else {
      el.textContent = (pre || '') + formatted + (suf || '');
    }
  };
  anim('stat-total', total, '', '', 0);
  anim('stat-stock', enStock, '', '', 0);
  anim('stat-bajo', bajo, '', '', 0);
  anim('stat-vence', lotesVenc, '', '', 0);
  anim('stat-valor', valor, 'Bs.', '', 0);
  anim('stat-ventas-hoy', ventasHoy, 'Bs.', '', 2);
  anim('stat-ganancia-hoy', gananciaNetaRealHoy, 'Bs.', '', 2);
  const detEl = document.getElementById('stat-ganancia-hoy-detalles');
  if (detEl) {
    if (costoRetirosHoy > 0 || totalGastosHoy > 0) {
      detEl.style.display = 'block';
      let partes = [];
      if (costoRetirosHoy > 0) partes.push(`-Bs. ${costoRetirosHoy.toFixed(2)} retiros`);
      if (totalGastosHoy > 0) partes.push(`-Bs. ${totalGastosHoy.toFixed(2)} gastos`);
      detEl.textContent = `(Bruta: Bs. ${gananciaHoy.toFixed(2)} | ${partes.join(' | ')})`;
    } else {
      detEl.style.display = 'none';
    }
  }
  anim('stat-fiados', fiadosPendiente, 'Bs.', '', 2);

  if (typeof window.initOdometers === 'function') {
    window.initOdometers(80);
  }
  if (typeof window.playTitleAnimation === 'function') {
    const titleEl = document.getElementById('shop-title');
    if (titleEl && (!titleEl.children || titleEl.children.length === 0)) {
      window.playTitleAnimation();
    }
  }

  const badge = document.getElementById('badge-vencimientos');
  if (badge) { if (lotesVenc > 0) { badge.textContent = lotesVenc; badge.style.display = 'inline'; } else badge.style.display = 'none'; }
  const badgeFiados = document.getElementById('badge-fiados');
  if (badgeFiados) { if (clientesConDeuda > 0) { badgeFiados.textContent = clientesConDeuda; badgeFiados.style.display = 'inline-flex'; } else badgeFiados.style.display = 'none'; }

  const alerts = [];
  const agotados = productos.filter(p => p.stock === 0);
  const bajosItems = productos.filter(p => p.stock > 0 && p.stock <= p.stockMin);
  let lotesProx = [];
  productos.forEach(p => { (p.lotes||[]).forEach(l => { if(l.cantidad>0 && l.vencimiento && new Date(l.vencimiento)<=new Date(Date.now()+7*86400000) && new Date(l.vencimiento)>=now) lotesProx.push(`${p.nombre} (${l.cantidad} uds)`); }); });

  if (agotados.length) alerts.push({cls:'alert-red', icon:'✕', title:`${agotados.length} producto${agotados.length>1?'s':''} sin stock`, text:agotados.slice(0,3).map(p=>p.nombre).join(', ')+(agotados.length>3?'..':'')});
  if (bajosItems.length) alerts.push({cls:'alert-orange', icon:'!', title:`${bajosItems.length} con stock bajo`, text:bajosItems.slice(0,3).map(p=>p.nombre+' ('+p.stock+')').join(', ')});
  if (lotesProx.length) alerts.push({cls:'alert-yellow', icon:'⏰', title:`${lotesProx.length} lotes vencen en 7 días`, text:lotesProx.slice(0,3).join(', ')});
  // Alerta fiados
  if (clientesConDeuda > 0) alerts.push({cls:'alert-orange', icon:'📒', title:`${clientesConDeuda} cliente${clientesConDeuda>1?'s':''} con fiados pendientes`, text:`Total por cobrar: Bs. ${fiadosPendiente.toFixed(2)}`});

  const alertSection = document.getElementById('alertSection'); const alertList = document.getElementById('alertList');
  if (alertSection && alertList) { alertSection.style.display = alerts.length ? 'block' : 'none'; alertList.innerHTML = alerts.map(a => `<div class="alert-item ${a.cls}"><span class="alert-icon">${a.icon}</span><div class="alert-text"><strong>${a.title}</strong><span>${a.text}</span></div></div>`).join(''); }
}

// ═══════════════════════════════════════════════════════════════
// INVENTARIO MODERNO — ORANGE RETAIL SYSTEM (LOGIC & RENDERING)
// ═══════════════════════════════════════════════════════════════

let invCurrentPage = 1;
let invItemsPerPage = 10;
let invCurrentCategory = 'Todos';
let invSelectedProductIds = new Set();
let invLastFilteredList = [];

// Categorías principales del diseño
const INV_STANDARD_CATEGORIES = [
  'Todos',
  'Licores',
  'Cervezas',
  'Sodas & Aguas',
  'Combos & Packs',
  'Snacks / Otros',
  'Hielo & Desechables'
];

function getCategoryMaterialIcon(cat) {
  const c = (cat || '').toLowerCase();
  if (c.includes('licor') || c.includes('ron') || c.includes('vodka') || c.includes('singani') || c.includes('fernet') || c.includes('whisky') || c.includes('tequila') || c.includes('gin') || c.includes('vino')) return 'liquor';
  if (c.includes('cerveza')) return 'sports_bar';
  if (c.includes('soda') || c.includes('gaseosa') || c.includes('agua') || c.includes('jugo')) return 'local_cafe';
  if (c.includes('snack') || c.includes('galleta') || c.includes('chicle') || c.includes('dulce') || c.includes('golosina')) return 'cookie';
  if (c.includes('hielo') || c.includes('desechable') || c.includes('vaso')) return 'ac_unit';
  if (c.includes('cigarro') || c.includes('cigarrillo') || c.includes('tabaco')) return 'smoking_rooms';
  if (c.includes('farmacia') || c.includes('salud') || c.includes('medicamento')) return 'medication';
  if (c.includes('combo') || c.includes('pack')) return 'inventory_2';
  return 'wine_bar';
}

function matchesCategoryFilter(prodCat, pillKey) {
  if (!pillKey || pillKey === 'Todos') return true;
  const c = (prodCat || '').toLowerCase();
  if (pillKey === 'Licores') return c.includes('licor') || c.includes('vino') || c.includes('whisky') || c.includes('ron') || c.includes('vodka') || c.includes('singani') || c.includes('fernet') || c.includes('tequila') || c.includes('gin');
  if (pillKey === 'Cervezas') return c.includes('cerveza');
  if (pillKey === 'Sodas & Aguas') return c.includes('soda') || c.includes('agua') || c.includes('gaseosa') || c.includes('jugo');
  if (pillKey === 'Combos & Packs') return c.includes('combo') || c.includes('pack');
  if (pillKey === 'Snacks / Otros') return c.includes('snack') || c.includes('golosina') || c.includes('galleta') || c.includes('chicle') || c.includes('cigarro') || c.includes('cigarrillo') || c.includes('farmacia') || c.includes('otro');
  if (pillKey === 'Hielo & Desechables') return c.includes('hielo') || c.includes('desechable') || c.includes('vaso');
  return c === pillKey.toLowerCase();
}

function getProductPresentationText(p) {
  if (p.medida) return p.medida;
  if (p.mlPorUnidad && Number(p.mlPorUnidad) > 0) {
    const ml = Number(p.mlPorUnidad);
    const ub = p.unidadBase || 'Botella';
    if (ml >= 1000) {
      const l = (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1);
      return `${l} Litro${l !== '1' ? 's' : ''}`;
    }
    return `${ml}ml`;
  }
  if (p.contenido) return p.contenido;
  if (p.formatosVenta && p.formatosVenta.length > 0) {
    const f = p.formatosVenta[0];
    return `${f.nombre || 'Unidad'}`;
  }
  if (p.unidadBase) return p.unidadBase;
  return 'Unidad';
}

// Devuelve texto tipo "120 (10 Cajas de 12)" o "5" (número limpio sin "u.")
function formatStockDisplay(p) {
  if (!p) return '0';
  const total = getTotalUnidadesBase(p);
  if (total <= 0) return '0';

  // Buscar si tiene formatos de venta con paquetes (> 1 unidad)
  const formatos = safeArr(p.formatosVenta).filter(f => f && safeNum(f.unidades) > 1);
  if (formatos.length > 0) {
    formatos.sort((a, b) => b.unidades - a.unidades);
    const ref = formatos[0];
    const paquetes = Math.floor(total / ref.unidades);
    const sueltas = total % ref.unidades;
    if (paquetes > 0 && sueltas > 0) {
      return `${total} (${paquetes} ${ref.nombre} + ${sueltas})`;
    } else if (paquetes > 0 && sueltas === 0) {
      return `${total} (${paquetes} ${ref.nombre})`;
    }
  } else if (safeArr(p.empaques).length > 0) {
    const emp = p.empaques[0];
    const paq = Math.floor(total / (emp.unidades || 1));
    const suelt = total % (emp.unidades || 1);
    if (paq > 0 && suelt > 0) return `${total} (${paq} ${emp.nombre} + ${suelt})`;
    if (paq > 0 && suelt === 0) return `${total} (${paq} ${emp.nombre})`;
  }
  return `${total}`;
}
window.formatStockDisplay = formatStockDisplay;

// Precio efectivo de venta de un producto (considera oferta manual activa)
function getPrecioVentaEfectivo(p) {
  if (!p) return 0;
  const ofertaManualActiva = p.enOfertaManual && safeNum(p.precioOfertaUnidad) > 0 && (!p.fechaFinOferta || new Date(p.fechaFinOferta) >= new Date());
  if (ofertaManualActiva) return safeNum(p.precioOfertaUnidad);
  return safeNum(p.venta) || safeNum(p.precioVentaUnidad) || 0;
}
window.getPrecioVentaEfectivo = getPrecioVentaEfectivo;

// ¿El producto está en oferta (manual o por lote)?
function getProductoEnOferta(p) {
  if (!p) return false;
  if (p.enOfertaManual && safeNum(p.precioOfertaUnidad) > 0 && (!p.fechaFinOferta || new Date(p.fechaFinOferta) >= new Date())) return true;
  if (p.lotes && p.lotes.some(l => l.enOfertaPorVencimiento && safeNum(l.cantidad) > 0)) return true;
  return false;
}
window.getProductoEnOferta = getProductoEnOferta;

function toggleLotesRow(id) {
  const row = document.getElementById('lotes-row-' + id);
  const btn = document.getElementById('btn-expand-' + id);
  const arrow = document.getElementById('arrow-lotes-' + id);
  if (!row) return;
  const isHidden = row.classList.contains('hidden');
  if (isHidden) {
    row.classList.remove('hidden');
    row.classList.add('open');
    if (btn) btn.classList.add('open');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  } else {
    row.classList.add('hidden');
    row.classList.remove('open');
    if (btn) btn.classList.remove('open');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
}
window.toggleLotesRow = toggleLotesRow;

function updateInventoryKPIs(allProds) {
  allProds = allProds || productos || [];
  const total = allProds.length;
  let conStock = 0;
  let costoTotal = 0;
  let ventaTotal = 0;
  let bajoAgotadoCount = 0;

  allProds.forEach(p => {
    const stock = getTotalUnidadesBase(p);
    const costo = getCostoPromedio(p);
    const venta = getPrecioVentaEfectivo(p);
    const stockMin = safeNum(p.stockMinUnidades) || safeNum(p.stockMin) || 5;

    if (stock > 0) conStock++;
    if (stock <= stockMin || stock === 0) bajoAgotadoCount++;
    costoTotal += (stock * costo);
    ventaTotal += (stock * venta);
  });

  const rotacion = total > 0 ? ((conStock / total) * 100).toFixed(1) : '0.0';
  const margen = ventaTotal > 0 ? (((ventaTotal - costoTotal) / ventaTotal) * 100).toFixed(1) : '0.0';

  const elTotal = document.getElementById('invKpiTotal');
  const elRot = document.getElementById('invKpiRotacion');
  const elCosto = document.getElementById('invKpiCosto');
  const elVenta = document.getElementById('invKpiVenta');
  const elMargen = document.getElementById('invKpiMargen');
  const elBajo = document.getElementById('invKpiBajo');

  if (elTotal) elTotal.textContent = total;
  if (elRot) elRot.textContent = `${rotacion}% rotación activa`;
  if (elCosto) elCosto.textContent = `Bs. ${costoTotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elVenta) elVenta.textContent = `Bs. ${ventaTotal.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (elMargen) elMargen.textContent = `+${margen}%`;
  if (elBajo) elBajo.textContent = bajoAgotadoCount;
}

function renderCategoryPills(allProds) {
  const container = document.getElementById('invCategoryPills');
  if (!container) return;
  allProds = allProds || productos || [];

  const extraCategories = new Set();
  allProds.forEach(p => {
    if (p.categoria) {
      let isStandard = false;
      for (const cat of INV_STANDARD_CATEGORIES) {
        if (cat !== 'Todos' && matchesCategoryFilter(p.categoria, cat)) {
          isStandard = true;
          break;
        }
      }
      if (!isStandard) extraCategories.add(p.categoria);
    }
  });

  const categoriesToShow = [...INV_STANDARD_CATEGORIES, ...Array.from(extraCategories)];

  container.innerHTML = categoriesToShow.map(cat => {
    let count = 0;
    if (cat === 'Todos') {
      count = allProds.length;
    } else {
      count = allProds.filter(p => matchesCategoryFilter(p.categoria, cat)).length;
    }
    const isActive = invCurrentCategory === cat;
    return `
      <button class="inv-pill ${isActive ? 'active' : ''}" type="button" onclick="selectInventoryCategory('${cat}')">
        <span>${cat}</span>
        <span class="inv-pill-count">${count}</span>
      </button>
    `;
  }).join('');
}

window.selectInventoryCategory = function(cat) {
  invCurrentCategory = cat;
  invCurrentPage = 1;
  const syncSelect = document.getElementById('filterCategoria');
  if (syncSelect) syncSelect.value = (cat === 'Todos' ? '' : cat);
  filterAndRender();
};

function updatePaginationUI(start, end, total, totalPages) {
  const elStart = document.getElementById('invPageStart');
  const elEnd = document.getElementById('invPageEnd');
  const elTotal = document.getElementById('invPageTotal');
  const elControls = document.getElementById('invPaginationControls');

  if (elStart) elStart.textContent = start;
  if (elEnd) elEnd.textContent = end;
  if (elTotal) elTotal.textContent = total;

  if (!elControls) return;

  if (total === 0) {
    elControls.innerHTML = '';
    return;
  }

  let html = `
    <button class="inv-page-nav-btn" type="button" ${invCurrentPage <= 1 ? 'disabled' : ''} onclick="goToInventoryPage(1)" title="Primera página">
      <span class="material-symbols-outlined">first_page</span>
    </button>
    <button class="inv-page-nav-btn" type="button" ${invCurrentPage <= 1 ? 'disabled' : ''} onclick="goToInventoryPage(${invCurrentPage - 1})" title="Página anterior">
      <span class="material-symbols-outlined">chevron_left</span>
    </button>
    <div class="inv-page-numbers-group">
  `;

  if (totalPages <= 6) {
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="inv-page-num-btn ${i === invCurrentPage ? 'active' : ''}" type="button" onclick="goToInventoryPage(${i})">${i}</button>`;
    }
  } else {
    html += `<button class="inv-page-num-btn ${1 === invCurrentPage ? 'active' : ''}" type="button" onclick="goToInventoryPage(1)">1</button>`;
    if (invCurrentPage > 3) {
      html += `<span class="inv-page-dots">...</span>`;
    }
    const startP = Math.max(2, invCurrentPage - 1);
    const endP = Math.min(totalPages - 1, invCurrentPage + 1);
    for (let i = startP; i <= endP; i++) {
      html += `<button class="inv-page-num-btn ${i === invCurrentPage ? 'active' : ''}" type="button" onclick="goToInventoryPage(${i})">${i}</button>`;
    }
    if (invCurrentPage < totalPages - 2) {
      html += `<span class="inv-page-dots">...</span>`;
    }
    html += `<button class="inv-page-num-btn ${totalPages === invCurrentPage ? 'active' : ''}" type="button" onclick="goToInventoryPage(${totalPages})">${totalPages}</button>`;
  }

  html += `
    </div>
    <button class="inv-page-nav-btn" type="button" ${invCurrentPage >= totalPages ? 'disabled' : ''} onclick="goToInventoryPage(${invCurrentPage + 1})" title="Página siguiente">
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
    <button class="inv-page-nav-btn" type="button" ${invCurrentPage >= totalPages ? 'disabled' : ''} onclick="goToInventoryPage(${totalPages})" title="Última página">
      <span class="material-symbols-outlined">last_page</span>
    </button>
  `;

  elControls.innerHTML = html;
}

window.goToInventoryPage = function(page) {
  invCurrentPage = page;
  renderTabla(invLastFilteredList);
};

window.toggleSelectProduct = function(id, checked) {
  if (checked) invSelectedProductIds.add(id);
  else invSelectedProductIds.delete(id);
};

window.openInvRowMenu = function(e, prodId) {
  e.stopPropagation();
  document.getElementById('invRowMenuDropdown')?.remove();

  const p = (window.productos || []).find(x => x.id === prodId);
  if (!p) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'invRowMenuDropdown';
  menu.className = 'inv-actions-dropdown';
  menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  menu.style.left = Math.max(10, rect.right + window.scrollX - 190) + 'px';

  const hasLotes = p.lotes && p.lotes.length > 0;

  menu.innerHTML = `
    <button class="inv-dropdown-item" onclick="abrirConsumoDuenoModal('${p.id}'); document.getElementById('invRowMenuDropdown')?.remove();" style="color:#ea580c;font-weight:600">
      <span class="material-symbols-outlined" style="color:#ea580c">person_remove</span>
      <span>Consumo de Dueño</span>
    </button>
    ${hasLotes ? `<button class="inv-dropdown-item" onclick="toggleLotesRow('${p.id}'); document.getElementById('invRowMenuDropdown')?.remove();">
      <span class="material-symbols-outlined">layers</span>
      <span>Ver lotes y fechas</span>
    </button>` : ''}
    <button class="inv-dropdown-item" onclick="abrirSalida('${p.id}'); document.getElementById('invRowMenuDropdown')?.remove();">
      <span class="material-symbols-outlined">move_up</span>
      <span>Registrar Salida</span>
    </button>
    <button class="inv-dropdown-item" onclick="abrirOferta('${p.id}'); document.getElementById('invRowMenuDropdown')?.remove();">
      <span class="material-symbols-outlined">local_offer</span>
      <span>Poner en Oferta</span>
    </button>
    ${(p.activo === false || p.archivado) ? `
    <button class="inv-dropdown-item" onclick="reactivarProducto('${p.id}'); document.getElementById('invRowMenuDropdown')?.remove();" style="color:var(--orange-600, #ea580c);font-weight:600">
      <span class="material-symbols-outlined">unarchive</span>
      <span>Reactivar Producto</span>
    </button>` : `
    <button class="inv-dropdown-item danger" onclick="eliminarProducto('${p.id}'); document.getElementById('invRowMenuDropdown')?.remove();">
      <span class="material-symbols-outlined">delete</span>
      <span>Eliminar / Archivar</span>
    </button>`}
  `;

  document.body.appendChild(menu);

  const closeListener = function(event) {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener('click', closeListener);
    }
  };
  setTimeout(() => document.addEventListener('click', closeListener), 10);
};

window.handleHeaderEntrada = function() {
  if (invSelectedProductIds.size > 0) {
    const firstSelected = Array.from(invSelectedProductIds)[0];
    abrirEntrada(firstSelected);
    return;
  }
  if (invLastFilteredList && invLastFilteredList.length === 1) {
    abrirEntrada(invLastFilteredList[0].id);
    return;
  }
  if (productos && productos.length > 0) {
    const first = (invLastFilteredList && invLastFilteredList.length) ? invLastFilteredList[0] : productos[0];
    abrirEntrada(first.id);
    if (typeof toast === 'function') {
      toast('Selecciona un producto específico para ingresar su stock', 'info');
    }
    return;
  }
  if (typeof toast === 'function') {
    toast('No hay productos disponibles en inventario', 'warning');
  }
};

window.limpiarFiltrosInventario = function() {
  const searchInput = document.getElementById('searchInput');
  const filterEstado = document.getElementById('filterEstado');
  const filterOrden = document.getElementById('filterOrden');
  if (searchInput) searchInput.value = '';
  if (filterEstado) filterEstado.value = '';
  if (filterOrden) filterOrden.value = 'stock-asc';
  invCurrentCategory = 'Todos';
  invCurrentPage = 1;
  filterAndRender();
};

window.openShortcutsModal = function() {
  const m = document.getElementById('modal-shortcuts');
  if (m) m.classList.remove('hidden');
};

function filterAndRender() {
  const searchInput = document.getElementById('searchInput');
  const filterEstado = document.getElementById('filterEstado');
  const filterOrden = document.getElementById('filterOrden');

  const q = (searchInput ? searchInput.value || '' : '').toLowerCase().trim();
  const est = filterEstado ? filterEstado.value : '';
  const orden = filterOrden ? filterOrden.value : 'stock-asc';
  const now = new Date();
  const soon = new Date(Date.now() + 30 * 86400000);

  let list = (est === 'archivados')
    ? (productos || []).filter(p => p && (p.activo === false || p.archivado === true))
    : (productos || []).filter(p => p && p.activo !== false && !p.archivado);

  // 1. Buscador primario
  if (q) {
    list = list.filter(p => {
      const nom = (p.nombre || '').toLowerCase();
      const mar = (p.marca || '').toLowerCase();
      const cod = (p.codigoBarras || p.codigo || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      return nom.includes(q) || mar.includes(q) || cod.includes(q) || id.includes(q);
    });
  }

  // 2. Filtro de Categoría
  if (invCurrentCategory && invCurrentCategory !== 'Todos') {
    list = list.filter(p => matchesCategoryFilter(p.categoria, invCurrentCategory));
  }

  // 3. Filtro de Estado
  if (est === 'ok') {
    list = list.filter(p => {
      const stock = getTotalUnidadesBase(p);
      const min = safeNum(p.stockMinUnidades) || safeNum(p.stockMin) || 5;
      return stock > min;
    });
  } else if (est === 'bajo') {
    list = list.filter(p => {
      const stock = getTotalUnidadesBase(p);
      const min = safeNum(p.stockMinUnidades) || safeNum(p.stockMin) || 5;
      return stock > 0 && stock <= min;
    });
  } else if (est === 'agotado') {
    list = list.filter(p => getTotalUnidadesBase(p) === 0);
  } else if (est === 'vence-pronto') {
    list = list.filter(p => {
      if (p.vencimiento && new Date(p.vencimiento) <= soon && new Date(p.vencimiento) >= now) return true;
      if (p.lotes && p.lotes.some(l => l.vencimiento && new Date(l.vencimiento) <= soon && new Date(l.vencimiento) >= now && safeNum(l.cantidad) > 0)) return true;
      return false;
    });
  }

  // 4. Ordenación (con desempate alfabético estable para evitar saltos al editar)
  if (orden === 'stock-asc') {
    list.sort((a, b) => {
      const diff = getTotalUnidadesBase(a) - getTotalUnidadesBase(b);
      return diff !== 0 ? diff : (a.nombre || '').localeCompare(b.nombre || '');
    });
  } else if (orden === 'ventas-desc') {
    list.sort((a, b) => {
      const diff = safeNum(b.ventasContador) - safeNum(a.ventasContador);
      return diff !== 0 ? diff : (a.nombre || '').localeCompare(b.nombre || '');
    });
  } else if (orden === 'valor-desc') {
    list.sort((a, b) => {
      const valA = getTotalUnidadesBase(a) * getCostoPromedio(a);
      const valB = getTotalUnidadesBase(b) * getCostoPromedio(b);
      const diff = valB - valA;
      return diff !== 0 ? diff : (a.nombre || '').localeCompare(b.nombre || '');
    });
  } else if (orden === 'az') {
    list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  } else if (orden === 'za') {
    list.sort((a, b) => (b.nombre || '').localeCompare(a.nombre || ''));
  }

  invLastFilteredList = list;
  renderTabla(list);
}
window.filterAndRender = filterAndRender;

// Listeners de controles de inventario con debounce para evitar parpadeos y reseteos
const invSearchInputEl = document.getElementById('searchInput');
if (invSearchInputEl) {
  invSearchInputEl.addEventListener('input', debounce(() => {
    invCurrentPage = 1;
    filterAndRender();
  }, 160));
}
document.getElementById('filterCategoria')?.addEventListener('change', (e) => {
  invCurrentCategory = e.target.value || 'Todos';
  invCurrentPage = 1;
  filterAndRender();
});
document.getElementById('filterEstado')?.addEventListener('change', () => {
  invCurrentPage = 1;
  filterAndRender();
});
document.getElementById('filterOrden')?.addEventListener('change', () => {
  invCurrentPage = 1;
  filterAndRender();
});
document.getElementById('invRowsPerPage')?.addEventListener('change', (e) => {
  invItemsPerPage = parseInt(e.target.value, 10) || 10;
  invCurrentPage = 1;
  renderTabla(invLastFilteredList);
});
document.getElementById('invSelectAllCheckbox')?.addEventListener('change', (e) => {
  const checked = e.target.checked;
  const cbs = document.querySelectorAll('.row-select-cb');
  cbs.forEach(cb => {
    cb.checked = checked;
    const pid = cb.getAttribute('data-id');
    if (pid) {
      if (checked) invSelectedProductIds.add(pid);
      else invSelectedProductIds.delete(pid);
    }
  });
});

// Listener de atajos de teclado globales
window.addEventListener('keydown', function(e) {
  if (e.key === 'F2') {
    e.preventDefault();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      if (typeof navegarA === 'function') navegarA('inventario');
      searchInput.focus();
      searchInput.select();
    }
  } else if (e.key === 'F3') {
    e.preventDefault();
    handleHeaderEntrada();
  } else if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault();
    const btn = document.getElementById('btnNuevoProducto');
    if (btn) btn.click();
  } else if (e.key === 'F12') {
    e.preventDefault();
    if (typeof navegarA === 'function') navegarA('pos');
  } else if (e.key === 'Escape') {
    const shortcutsModal = document.getElementById('modal-shortcuts');
    if (shortcutsModal && !shortcutsModal.classList.contains('hidden')) {
      shortcutsModal.classList.add('hidden');
    }
    document.getElementById('invRowMenuDropdown')?.remove();
  }
});

function renderTabla(list) {
  if (!list) {
    list = (invLastFilteredList && invLastFilteredList.length) ? invLastFilteredList : (productos || []);
  }
  invLastFilteredList = list;
  const tbody = document.getElementById('invTableBody');
  const mobileCards = document.getElementById('mobileCards');
  if (!tbody) return;

  // Actualizar KPIs y Categorías en base a la lista general
  updateInventoryKPIs(productos);
  renderCategoryPills(productos);

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="inv-empty-state">
            <span class="material-symbols-outlined inv-empty-icon">inventory_2</span>
            <div class="inv-empty-title">No se encontraron productos coincidentes</div>
            <div class="inv-empty-sub">Intenta cambiar el término de búsqueda o limpia los filtros activos.</div>
            <button class="inv-btn-secondary" onclick="limpiarFiltrosInventario()">Restablecer filtros</button>
          </div>
        </td>
      </tr>
    `;
    if (mobileCards) mobileCards.innerHTML = '';
    updatePaginationUI(0, 0, 0, 1);
    return;
  }

  // Paginación
  const totalItems = list.length;
  const totalPages = Math.ceil(totalItems / invItemsPerPage) || 1;
  if (invCurrentPage > totalPages) invCurrentPage = totalPages;
  if (invCurrentPage < 1) invCurrentPage = 1;

  const startIdx = (invCurrentPage - 1) * invItemsPerPage;
  const endIdx = startIdx + invItemsPerPage;
  const pageItems = list.slice(startIdx, endIdx);

  updatePaginationUI(startIdx + 1, Math.min(endIdx, totalItems), totalItems, totalPages);

  const now = new Date();

  tbody.innerHTML = pageItems.map(p => {
    const pv = getPrecioVentaEfectivo(p);
    const costoProm = getCostoPromedio(p);
    const stockUnidades = getTotalUnidadesBase(p);
    const stockMin = safeNum(p.stockMinUnidades) || safeNum(p.stockMin) || 5;
    const enOferta = getProductoEnOferta(p);

    const margenPct = pv > 0 ? (((pv - costoProm) / pv) * 100).toFixed(1) : '0.0';
    const valTotal = stockUnidades * (costoProm > 0 ? costoProm : pv);

    let stockBadge = '';
    if (stockUnidades === 0) {
      stockBadge = `<span class="stock-pill stock-pill-critico"><span class="material-symbols-outlined">cancel</span><span>0</span><span class="stock-pill-lbl">Agotado</span></span>`;
    } else if (stockUnidades <= 2) {
      stockBadge = `<span class="stock-pill stock-pill-critico"><span class="material-symbols-outlined">warning</span><span>${stockUnidades}</span><span class="stock-pill-lbl">Crítico</span></span>`;
    } else if (stockUnidades <= stockMin) {
      stockBadge = `<span class="stock-pill stock-pill-bajo"><span class="material-symbols-outlined">priority_high</span><span>${stockUnidades}</span><span class="stock-pill-lbl">Bajo</span></span>`;
    } else if (stockUnidades >= 20) {
      stockBadge = `<span class="stock-pill stock-pill-optimo"><span class="material-symbols-outlined">verified</span><span>${stockUnidades}</span><span class="stock-pill-lbl">Óptimo</span></span>`;
    } else {
      stockBadge = `<span class="stock-pill stock-pill-normal"><span class="material-symbols-outlined">check_circle</span><span>${stockUnidades}</span><span class="stock-pill-lbl">Normal</span></span>`;
    }

    const hasLotes = p.lotes && p.lotes.length > 0;
    const lotesToggleBtn = hasLotes ? `
      <button type="button" class="inv-btn-lotes-toggle" id="btn-expand-${p.id}" onclick="toggleLotesRow('${p.id}')" title="Ver ${p.lotes.length} lote(s) registrados">
        <span class="material-symbols-outlined" style="font-size:13px;">layers</span>
        <span>${p.lotes.length} lote${p.lotes.length > 1 ? 's' : ''}</span>
        <span class="material-symbols-outlined inv-lotes-arrow" id="arrow-lotes-${p.id}" style="font-size:14px;">expand_more</span>
      </button>
    ` : '';

    const catIcon = getCategoryMaterialIcon(p.categoria);
    const thumbHtml = p.foto ? `<img src="${p.foto}" class="inv-prod-thumb-img" alt="${p.nombre}">` : `<span class="material-symbols-outlined">${catIcon}</span>`;

    const isNew = p.fechaCreacion && ((now - new Date(p.fechaCreacion)) / 86400000 <= 7);
    const newTag = isNew ? `<span class="inv-prod-new-tag">RECIÉN INGRESADO</span>` : '';
    const ofertaTag = enOferta ? `<span class="inv-prod-new-tag" style="background:#fef08a;color:#854d0e;">OFERTA</span>` : '';
    const isArchived = (p.activo === false || p.archivado === true);
    const archivedTag = isArchived ? `<span class="inv-prod-new-tag" style="background:rgba(239,68,68,0.15);color:#dc2626;border:1px solid rgba(239,68,68,0.3);font-weight:800;">ARCHIVADO</span>` : '';

    const skuText = p.codigoBarras || p.codigo || (p.id ? 'SKU: ' + p.id.slice(0, 8).toUpperCase() : 'SKU: —');
    const presText = getProductPresentationText(p);
    const isSelected = invSelectedProductIds.has(p.id);

    const lotesHtml = hasLotes ? p.lotes.map((l, i) => {
      const v = l.vencimiento ? new Date(l.vencimiento) : null;
      const d = v ? Math.ceil((v - now) / 86400000) : null;
      const bdg = l.cantidad === 0 ? '<span class="inv-lote-badge inv-lote-agotado">Agotado</span>' :
                  (d === null ? '<span class="inv-lote-badge inv-lote-vigente">S/Venc</span>' :
                  d < 0 ? '<span class="inv-lote-badge inv-lote-rojo">Vencido</span>' :
                  d <= 15 ? '<span class="inv-lote-badge inv-lote-naranja">Pronto</span>' :
                  d <= 30 ? '<span class="inv-lote-badge inv-lote-amarillo">30d</span>' :
                  '<span class="inv-lote-badge inv-lote-vigente">Vigente</span>');
      return `
        <tr>
          <td>
            <div style="font-weight:700;">Lote ${i + 1}</div>
            ${l.nota ? `<div style="font-size:11px;color:var(--text2);margin-top:2px;display:flex;align-items:center;gap:3px;" title="Observación de este lote">
              <span class="material-symbols-outlined" style="font-size:13px;color:var(--inv-primary,#f97316);">notes</span>
              <span>${escHTML(l.nota)}</span>
            </div>` : ''}
          </td>
          <td><b>${l.cantidad}</b></td>
          <td>Bs. ${safeNum(l.costoPorUnidad).toFixed(2)}</td>
          <td>${l.vencimiento ? new Date(l.vencimiento).toLocaleDateString('es-BO') : '<span style="color:var(--text3)">Sin vencimiento</span>'}</td>
          <td>${l.fechaIngreso ? new Date(l.fechaIngreso).toLocaleDateString('es-BO') : '—'}</td>
          <td>${bdg}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px;">
              <input type="number" min="0" value="${l.cantidad}" onchange="ajustarCantidadLote('${p.id}', '${l.id}', this.valueAsNumber)" style="width:55px;padding:2px 4px;font-size:12px;border:1px solid var(--inv-border);border-radius:4px;">
              <button onclick="eliminarLote('${p.id}', '${l.id}')" title="Eliminar lote" style="background:transparent;border:none;color:var(--inv-error);cursor:pointer;font-weight:bold;font-size:14px;">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('') : '';

    return `
      <tr class="inventory-row" data-id="${p.id}">
        <td style="text-align: center;">
          <input type="checkbox" class="inv-checkbox row-select-cb" data-id="${p.id}" ${isSelected ? 'checked' : ''} onchange="toggleSelectProduct('${p.id}', this.checked)">
        </td>
        <td>
          <div class="inv-prod-cell">
            <div class="inv-prod-icon-box">
              ${thumbHtml}
            </div>
            <div class="inv-prod-meta-col">
              <div class="inv-prod-name-row">
                <span class="inv-prod-name" title="${p.nombre}">${p.nombre}</span>
                ${p.medida ? `<span class="inv-prod-medida-tag">${escHTML(p.medida)}</span>` : ''}
                <span class="inv-prod-cat-tag cat-badge">${p.categoria || 'General'}</span>
                ${newTag}
                ${ofertaTag}
                ${archivedTag}
              </div>
              <div class="inv-prod-sub-row">
                <span>${skuText}</span>
                <span>•</span>
                <span class="inv-prod-sub-desc">${presText}</span>
              </div>
            </div>
          </div>
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <div class="inv-stock-cell-wrap">
            ${stockBadge}
            ${lotesToggleBtn}
          </div>
        </td>
        <td class="inv-td-num inv-costo-val">
          Bs. ${costoProm.toFixed(2)}
        </td>
        <td class="inv-td-num inv-precio-val">
          <div class="inv-precio-cell-interactive" onclick="abrirQuickEditPrecio('${p.id}', event)" title="Clic para cambiar precio de venta rápido">
            <span>Bs. ${pv.toFixed(2)}</span>
            <span class="material-symbols-outlined inv-quick-edit-icon">edit</span>
          </div>
        </td>
        <td class="inv-td-num">
          <span class="inv-margen-pill ${Number(margenPct) < 0 ? 'negativo' : ''}">
            ${Number(margenPct) >= 0 ? '+' : ''}${margenPct}%
          </span>
        </td>
        <td class="inv-td-num inv-total-val">
          Bs. ${valTotal.toFixed(2)}
        </td>
        <td style="text-align: center;">
          <div class="inv-row-actions">
            ${isArchived ? `
            <button class="inv-btn-add-stock" type="button" onclick="reactivarProducto('${p.id}')" style="background:rgba(249,115,22,0.15);color:var(--inv-primary,#f97316);border:1px solid rgba(249,115,22,0.35);font-weight:700;" title="Reactivar producto en catálogo">
              <span class="material-symbols-outlined">unarchive</span>
              <span>Reactivar</span>
            </button>
            ` : `
            <button class="inv-btn-add-stock" type="button" onclick="abrirEntrada('${p.id}')" title="Registrar nuevo lote de mercadería">
              <span class="material-symbols-outlined">add</span>
              <span>Entrada</span>
            </button>
            `}
            <button class="inv-btn-edit-action" type="button" onclick="editarProducto('${p.id}')" title="Editar datos y precio de venta">
              <span class="material-symbols-outlined">edit</span>
              <span>Editar</span>
            </button>
            <button class="inv-btn-icon-action" type="button" onclick="openInvRowMenu(event, '${p.id}')" title="Más opciones">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        </td>
      </tr>
      <tr class="inv-lotes-tr lote-row hidden" id="lotes-row-${p.id}">
        <td colspan="8">
          <div class="inv-lotes-wrapper">
            <div class="inv-lotes-header" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--border);">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-symbols-outlined" style="font-size:18px;color:var(--inv-primary);">layers</span>
                <span style="font-weight:700;font-size:13px;color:var(--text1);">Lotes registrados</span>
                <span style="font-size:11px;color:var(--text3);font-weight:500;">(${p.lotes.length} en bodega)</span>
              </div>
              <button type="button" class="inv-btn-add-stock" onclick="abrirEntrada('${p.id}')" style="padding:4px 10px;font-size:11px;height:auto;border-radius:6px;">
                <span class="material-symbols-outlined" style="font-size:14px;">add</span>
                <span>+ Nuevo Lote</span>
              </button>
            </div>
            <table class="inv-lotes-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Stock</th>
                  <th>Costo Unitario</th>
                  <th>Vencimiento</th>
                  <th>F. Ingreso</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${lotesHtml}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (mobileCards) {
    mobileCards.innerHTML = '';
  }
}
window.renderTabla = renderTabla;

// ── WIZARD PRODUCTO (3 PASOS) & FORMATOS DE VENTA MIXTA ──
let productoTieneVencimiento = false;
let formatoCompraActual = 'paquete'; // 'paquete' | 'unidad'
let formatosVentaTemp = []; // Formatos adicionales dinámicos (Six pack, Caja, etc.)
let tempProductData = null;
let existingProductMatch = null;

// Controla si el campo de ml se muestra (solo para bebidas/líquidos)
window.checkMlVisibility = function() {
  const cat = document.getElementById('fCategoria')?.value || '';
  const ub = document.getElementById('fUnidadBase')?.value || '';
  const wrap = document.getElementById('wrapMlPorUnidad');
  if (!wrap) return;
  const isLiquidCat = ['Licores', 'Cervezas', 'Sodas', 'Jugos'].includes(cat);
  const isLiquidUnit = ['lata', 'botella', 'ml', 'litro'].includes(ub);
  if (isLiquidCat || isLiquidUnit) {
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
    const input = document.getElementById('fMlPorUnidad');
    if (input) input.value = '';
  }
};

// Toggle Paso 1: ¿Tiene fecha de vencimiento?
window.toggleTieneVencimiento = function(tiene) {
  productoTieneVencimiento = !!tiene;
  const btnSi = document.getElementById('btnVenceSi');
  const btnNo = document.getElementById('btnVenceNo');
  const wrap = document.getElementById('wrapFechaVencimiento');
  if (btnSi) btnSi.className = tiene ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  if (btnNo) btnNo.className = tiene ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm';
  if (wrap) wrap.style.display = tiene ? 'block' : 'none';
  if (!tiene) {
    const inp = document.getElementById('fVencimiento');
    if (inp) inp.value = '';
  }
};

// Toggle Paso 2: ¿Compró por paquete o unidad suelta?
window.toggleFormatoCompra = function(formato) {
  formatoCompraActual = formato;
  const btnPaq = document.getElementById('btnFormatoPaquete');
  const btnUni = document.getElementById('btnFormatoUnidad');
  const areaPaq = document.getElementById('areaCompraPaquete');
  const areaUni = document.getElementById('areaCompraUnidad');
  const labelCant = document.getElementById('labelCantidadInicial');

  if (formato === 'paquete') {
    if (btnPaq) btnPaq.className = 'btn btn-primary btn-sm';
    if (btnUni) btnUni.className = 'btn btn-secondary btn-sm';
    if (areaPaq) areaPaq.style.display = 'block';
    if (areaUni) areaUni.style.display = 'none';
    if (labelCant) {
      const paqNombre = document.getElementById('paqueteNombre')?.value || 'paquetes/cajas';
      labelCant.textContent = 'Cantidad de ' + paqNombre + ' que ingresa:';
    }
  } else {
    if (btnPaq) btnPaq.className = 'btn btn-secondary btn-sm';
    if (btnUni) btnUni.className = 'btn btn-primary btn-sm';
    if (areaPaq) areaPaq.style.display = 'none';
    if (areaUni) areaUni.style.display = 'block';
    if (labelCant) {
      const ub = document.getElementById('fUnidadBase')?.value || 'unidades';
      labelCant.textContent = 'Cantidad de ' + ub + ' que ingresa:';
    }
  }
  onCostoCompraChanged();
};

// Función única de cálculo del costo unitario actual
function calcularCostoUnitarioActual() {
  if (formatoCompraActual === 'paquete') {
    const costPaq = parseFloat(document.getElementById('costoPaquete')?.value) || 0;
    const unids = parseInt(document.getElementById('paqueteUnidades')?.value) || 1;
    return unids > 0 ? (costPaq / unids) : 0;
  } else {
    return parseFloat(document.getElementById('costoUnidad')?.value) || 0;
  }
}
window.calcularCostoUnitarioActual = calcularCostoUnitarioActual;

function onCostoCompraChanged() {
  const costoUni = calcularCostoUnitarioActual();
  const elDisplay = document.getElementById('costoUnitarioDisplay');
  if (elDisplay) elDisplay.textContent = 'Bs. ' + costoUni.toFixed(2);
  renderFormatosVentaList();
  actualizarResumenStockInicial();
}
window.onCostoCompraChanged = onCostoCompraChanged;

// Cálculo de referencia en vivo por formato (ahorro/descuento y margen sobre costo automático)
function calcularReferenciaFormato(unidadesFormato, precioFormato, precioUnidadSuelta, costoUnitario) {
  const precioSueltoEquivalente = unidadesFormato * precioUnidadSuelta;
  const ahorroCliente = precioSueltoEquivalente - precioFormato;
  const porcentajeDescuentoCliente = precioSueltoEquivalente > 0 ? (ahorroCliente / precioSueltoEquivalente) * 100 : 0;

  const costoTotalFormato = unidadesFormato * costoUnitario;
  const gananciaFormato = precioFormato - costoTotalFormato;
  const margenPorcentaje = precioFormato > 0 ? (gananciaFormato / precioFormato) * 100 : 0;

  return {
    precioSueltoEquivalente,
    ahorroCliente,
    porcentajeDescuentoCliente,
    costoTotalFormato,
    gananciaFormato,
    margenPorcentaje
  };
}
window.calcularReferenciaFormato = calcularReferenciaFormato;

function agregarFormatoVenta() {
  const id = 'fmt_' + genId();
  formatosVentaTemp.push({ id, nombre: '', unidades: null, precio: null });
  renderFormatosVentaList();
}
window.agregarFormatoVenta = agregarFormatoVenta;

function eliminarFormatoVenta(id) {
  formatosVentaTemp = formatosVentaTemp.filter(f => f.id !== id);
  renderFormatosVentaList();
}
window.eliminarFormatoVenta = eliminarFormatoVenta;

function actualizarFormato(id, campo, valor) {
  const f = formatosVentaTemp.find(x => x.id === id);
  if (f) {
    f[campo] = campo === 'nombre' ? valor : (parseFloat(valor) || 0);
  }
}
window.actualizarFormato = actualizarFormato;

// Debounced render to prevent cursor jumping on input
let _renderDebounceTimer = null;
function renderFormatosVentaListDebounced() {
  clearTimeout(_renderDebounceTimer);
  _renderDebounceTimer = setTimeout(renderFormatosVentaList, 300);
}
window.renderFormatosVentaListDebounced = renderFormatosVentaListDebounced;

function renderFormatosVentaList() {
  const cont = document.getElementById('formatosVentaList');
  if (!cont) return;

  // Track active focus to prevent cursor jumping
  const activeId = document.activeElement ? document.activeElement.id : null;
  let cursorStart = null;
  let cursorEnd = null;
  if (document.activeElement && document.activeElement.type === 'text') {
    try {
      cursorStart = document.activeElement.selectionStart;
      cursorEnd = document.activeElement.selectionEnd;
    } catch(e) {}
  }

  const precioUnidadSuelta = parseFloat(document.getElementById('precioUnidad_unidad')?.value) || 0;
  const costoUnitario = calcularCostoUnitarioActual();

  const elDisplay = document.getElementById('costoUnitarioDisplay');
  if (elDisplay) elDisplay.textContent = 'Bs. ' + costoUnitario.toFixed(2);

  // Referencia para la fila fija de Unidad
  let refUnidadHtml = '';
  if (precioUnidadSuelta > 0 && costoUnitario > 0) {
    const gan = precioUnidadSuelta - costoUnitario;
    const mar = (gan / precioUnidadSuelta) * 100;
    const clase = mar < 0 ? 'alerta-roja' : mar < 15 ? 'alerta-amarilla' : 'alerta-verde';
    refUnidadHtml = `
      <div class="formato-referencia ${clase}">
        Ganancia por unidad: <b>Bs. ${gan.toFixed(2)}</b> (Margen: <b>${Math.round(mar)}%</b>)
        ${mar < 0 ? ' ⚠️ ¡Estás vendiendo por debajo del costo unitario!' : ''}
      </div>`;
  }

  // Filas adicionales dinámicas
  const filas = formatosVentaTemp.map(f => {
    let refHtml = '';
    if (f.unidades > 0 && f.precio > 0) {
      const r = calcularReferenciaFormato(f.unidades, f.precio, precioUnidadSuelta, costoUnitario);
      const clase = r.margenPorcentaje < 0 ? 'alerta-roja' : r.margenPorcentaje < 15 ? 'alerta-amarilla' : 'alerta-verde';
      refHtml = `
        <div class="formato-referencia ${clase}">
          💡 ${f.unidades} sueltas costarían <b>Bs. ${r.precioSueltoEquivalente.toFixed(2)}</b>
          — ${r.ahorroCliente >= 0 ? 'descuento cliente de' : 'recargo de'} <b>Bs. ${Math.abs(r.ahorroCliente).toFixed(2)} (${Math.abs(r.porcentajeDescuentoCliente).toFixed(1)}%)</b><br>
          Tu ganancia en este formato: <b>Bs. ${r.gananciaFormato.toFixed(2)}</b> (Margen: <b>${Math.round(r.margenPorcentaje)}%</b>)
          ${r.margenPorcentaje < 0 ? ' ⚠️ ¡Estás vendiendo este paquete por debajo de tu costo!' : ''}
        </div>`;
    }
    return `
      <div class="formato-row" data-id="${f.id}">
        <div class="formato-row-inputs">
          <input type="text" id="fmt_nombre_${f.id}" class="form-input" placeholder="Nombre (ej. Six Pack, Caja de 24)" value="${escHTML(f.nombre || '')}"
                 oninput="actualizarFormato('${f.id}','nombre',this.value); renderFormatosVentaListDebounced();">
          <input type="number" id="fmt_unids_${f.id}" class="form-input" placeholder="Cant. unidades *" min="2" step="1" value="${f.unidades ?? ''}"
                 onchange="actualizarFormato('${f.id}','unidades',this.value); renderFormatosVentaList();">
          <input type="number" id="fmt_precio_${f.id}" class="form-input" placeholder="Precio venta Bs. *" min="0" step="0.01" value="${f.precio ?? ''}"
                 onchange="actualizarFormato('${f.id}','precio',this.value); renderFormatosVentaList();">
          <button type="button" class="btn-icon danger" onclick="eliminarFormatoVenta('${f.id}')" title="Eliminar formato"><i data-lucide="trash-2"></i></button>
        </div>
        ${refHtml}
      </div>`;
  }).join('');

  const unidadVal = document.getElementById('precioUnidad_unidad')?.value || '';
  cont.innerHTML = `
    <div class="formato-row" data-id="unidad">
      <div class="formato-row-inputs">
        <span class="formato-nombre-fija">🔘 Unidad (1 u.)</span>
        <input type="hidden" id="formatoUnidades_unidad" value="1" />
        <span style="font-size:0.8rem;color:var(--text3)">1 unidad base</span>
        <input type="number" id="precioUnidad_unidad" class="form-input" placeholder="Precio Bs. *" step="0.01" min="0" onchange="renderFormatosVentaList()" value="${unidadVal}" required />
        <div></div>
      </div>
      <div id="ref_unidad">${refUnidadHtml}</div>
    </div>
    ${filas}`;
  if (window.lucide && window.lucide.createIcons) lucide.createIcons();

  // Restore focus
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) {
      el.focus();
      try {
        if (cursorStart !== null && el.type === 'text') {
          el.setSelectionRange(cursorStart, cursorEnd);
        }
      } catch (e) {}
    }
  }
}
window.renderFormatosVentaList = renderFormatosVentaList;

// Resumen del stock inicial e inversión (Paso 3)
window.actualizarResumenStockInicial = function() {
  const cantIngreso = parseFloat(document.getElementById('fCantidadInicial')?.value) || 0;
  let totalUnids = 0;
  let totalInversion = 0;

  if (formatoCompraActual === 'paquete') {
    const unidsPorPaq = parseInt(document.getElementById('paqueteUnidades')?.value) || 1;
    const costoPaq = parseFloat(document.getElementById('costoPaquete')?.value) || 0;
    totalUnids = cantIngreso * unidsPorPaq;
    totalInversion = cantIngreso * costoPaq;
  } else {
    const costoUni = parseFloat(document.getElementById('costoUnidad')?.value) || 0;
    totalUnids = cantIngreso;
    totalInversion = cantIngreso * costoUni;
  }

  const elUnids = document.getElementById('stockInicialUnidadesCalculadas');
  const elInv = document.getElementById('stockInicialInversionTotal');

  if (elUnids) {
    if (formatoCompraActual === 'paquete' && cantIngreso > 0) {
      const paqNombre = document.getElementById('paqueteNombre')?.value || 'paquetes/cajas';
      const unidsPorPaq = parseInt(document.getElementById('paqueteUnidades')?.value) || 1;
      elUnids.textContent = totalUnids + ' unidades (' + cantIngreso + ' × ' + paqNombre + ' de ' + unidsPorPaq + ')';
    } else {
      elUnids.textContent = totalUnids + ' unidades';
    }
  }
  if (elInv) elInv.textContent = 'Bs. ' + totalInversion.toFixed(2);
};

function actualizarWizardStep(step) {
  document.querySelectorAll('.wizard-pane').forEach((pane, i) => {
    pane.style.display = (i + 1 === step) ? 'block' : 'none';
  });
  document.querySelectorAll('.wizard-step').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.step) === step);
  });
  const prevBtn = document.getElementById('wizardPrev');
  const nextBtn = document.getElementById('wizardNext');
  const submitBtn = document.getElementById('wizardSubmit');
  if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-block';
  if (nextBtn) nextBtn.style.display = step === 3 ? 'none' : 'inline-block';
  if (submitBtn) submitBtn.style.display = step === 3 ? 'inline-block' : 'none';

  const sub = document.getElementById('formSubtitle');
  if (sub) {
    sub.textContent = 'Paso ' + step + ' de 3: ' + (
      step === 1 ? 'Identidad y Datos Base' :
      step === 2 ? 'Costos y Precios' :
      'Inventario Inicial'
    );
  }
  if (step === 2) {
    onCostoCompraChanged();
  }
  if (step === 3) {
    actualizarResumenStockInicial();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── CÁLCULO DE MARGEN Y VENCIMIENTO DIRECTO ──
function calcularMargenDirecto() {
  const costo = parseFloat(document.getElementById('costoUnidad')?.value) || 0;
  const venta = parseFloat(document.getElementById('precioUnidad_unidad')?.value) || 0;
  const ganancia = venta > 0 ? (venta - costo) : 0;
  const margen = (costo > 0 && venta > 0) ? ((ganancia / costo) * 100) : 0;

  const lblG = document.getElementById('lblGananciaDirecta');
  const lblM = document.getElementById('lblMargenDirecto');
  if (lblG) {
    lblG.textContent = 'Bs. ' + ganancia.toFixed(2);
    lblG.style.color = ganancia >= 0 ? '#ea580c' : '#dc2626';
  }
  if (lblM) {
    lblM.textContent = margen.toFixed(1) + '%';
    lblM.style.color = margen >= 0 ? 'var(--primary)' : '#dc2626';
  }
}
window.calcularMargenDirecto = calcularMargenDirecto;

function toggleVencimientoDirecto(checked) {
  const wrap = document.getElementById('wrapVencimientoDirecto');
  if (wrap) wrap.style.display = checked ? 'block' : 'none';
  if (!checked) {
    const fV = document.getElementById('fVencimiento');
    if (fV) fV.value = '';
  }
}
window.toggleVencimientoDirecto = toggleVencimientoDirecto;

let duplicateProductMatch = null;
function initDuplicateProductDetector() {
  const fNombreInput = document.getElementById('fNombre');
  if (!fNombreInput || fNombreInput._hasDuplicateListener) return;
  fNombreInput._hasDuplicateListener = true;

  fNombreInput.addEventListener('input', (e) => {
    const val = e.target.value.trim().toLowerCase();
    const alertBox = document.getElementById('duplicateProductAlert');
    const editId = document.getElementById('editId')?.value;
    if (editId || !val) {
      if (alertBox) alertBox.style.display = 'none';
      duplicateProductMatch = null;
      return;
    }
    const match = (productos || []).find(p => p && p.nombre && p.nombre.trim().toLowerCase() === val);
    if (match) {
      duplicateProductMatch = match;
      if (alertBox) {
        alertBox.style.display = 'block';
        const countEl = document.getElementById('duplicateStockCount');
        if (countEl) countEl.textContent = `${getTotalUnidadesBase(match)} unidades`;
      }
    } else {
      duplicateProductMatch = null;
      if (alertBox) alertBox.style.display = 'none';
    }
  });
}
window.initDuplicateProductDetector = initDuplicateProductDetector;

function setMedidaRapida(val) {
  const fMed = document.getElementById('fMedida');
  if (fMed) {
    fMed.value = val;
    fMed.focus();
  }
}
window.setMedidaRapida = setMedidaRapida;

function sumarLoteAProductoExistente() {
  if (!duplicateProductMatch) return;
  const p = duplicateProductMatch;
  // Redirigir directamente al inventario y abrir la entrada de lote
  navegarA('inventario');
  setTimeout(() => {
    if (typeof abrirEntrada === 'function') {
      abrirEntrada(p.id);
    }
  }, 120);
}
window.sumarLoteAProductoExistente = sumarLoteAProductoExistente;

function editarPrecioProductoExistente() {
  if (!duplicateProductMatch) return;
  const p = duplicateProductMatch;
  if (typeof editarProducto === 'function') {
    editarProducto(p.id);
  }
}
window.editarPrecioProductoExistente = editarPrecioProductoExistente;

// Compatibilidad retroactiva si algo llama wizardNextStep
window.wizardNextStep = function() {};
window.wizardPrevStep = function() {};

function resetProductForm() {
  const form = document.getElementById('productForm');
  if (form) form.reset();
  const editId = document.getElementById('editId');
  if (editId) editId.value = '';
  const fMed = document.getElementById('fMedida');
  if (fMed) fMed.value = '';

  const alertBox = document.getElementById('duplicateProductAlert');
  if (alertBox) alertBox.style.display = 'none';
  duplicateProductMatch = null;

  toggleVencimientoDirecto(false);
  calcularMargenDirecto();

  const title = document.getElementById('formTitle');
  if (title) title.textContent = '+ Agregar Producto';
  const subtitle = document.getElementById('formSubtitle');
  if (subtitle) subtitle.textContent = 'Registro directo al inventario por unidad';

  tempProductData = null;
  existingProductMatch = null;
  const unifOverlay = document.getElementById('unificarOverlay');
  if (unifOverlay) unifOverlay.style.display = 'none';
}
window.resetProductForm = resetProductForm;

document.getElementById('btnNuevoProducto')?.addEventListener('click', () => { resetProductForm(); navegarA('agregar'); });
document.getElementById('btnCancelForm')?.addEventListener('click', () => { resetProductForm(); navegarA('inventario'); });

// SUBMIT PRODUCT FORM (Directo y Atómico por Unidad)
document.getElementById('productForm')?.addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('editId')?.value || '';
  const nombre = (document.getElementById('fNombre')?.value || '').trim();
  const categoria = document.getElementById('fCategoria')?.value || '';
  const medida = (document.getElementById('fMedida')?.value || '').trim();
  const costo = parseFloat(document.getElementById('costoUnidad')?.value) || 0;
  const venta = parseFloat(document.getElementById('precioUnidad_unidad')?.value) || 0;
  const cantidadInicial = parseFloat(document.getElementById('fCantidadInicial')?.value) || 0;
  const stockMin = parseInt(document.getElementById('fStockMin')?.value) || 12;
  const tieneVenc = document.getElementById('chkTieneVencimiento')?.checked || false;
  const fechaVenc = tieneVenc ? (document.getElementById('fVencimiento')?.value || '') : '';

  if (!nombre) { toast('El nombre del producto es obligatorio', 'error'); return; }
  if (!categoria) { toast('Selecciona una categoría', 'error'); return; }
  if (costo <= 0) { toast('Ingresa el costo de compra', 'error'); return; }
  if (venta <= 0) { toast('Ingresa el precio de venta', 'error'); return; }

  // Si no es edición y el producto ya existe en catálogo
  if (!id) {
    const existing = (productos || []).find(p => p.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (existing) {
      if (cantidadInicial > 0) {
        if (!existing.lotes) existing.lotes = [];
        existing.lotes.push({
          id: genId(),
          cantidadBaseUnidades: cantidadInicial,
          cantidad: cantidadInicial,
          costoTotalLote: costo * cantidadInicial,
          costoPorUnidad: costo,
          vencimiento: fechaVenc,
          fechaIngreso: new Date().toISOString().slice(0, 10),
          nota: 'Nuevo lote ingresado'
        });
        existing.stock = getTotalUnidadesBase(existing);
        existing.vencimiento = getVencimientoMasCercano(existing);
        existing.costoPromedioUnidad = getCostoPromedio(existing);
        existing.costo = existing.costoPromedioUnidad;
        if (venta > 0) {
          existing.precioVentaUnidad = venta;
          existing.venta = venta;
        }
        existing.updatedAt = Date.now();
        save();
        if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(existing);
        toast(`Lote de ${cantidadInicial} u. agregado a "${existing.nombre}" con éxito`, 'success');
        navegarA('inventario');
        filterAndRender();
        resetProductForm();
        return;
      } else {
        toast(`"${existing.nombre}" ya existe en catálogo. Ingresa cuántas unidades llegaron o edita su precio.`, 'warning');
        return;
      }
    }
  }

  // Lote inicial si es nuevo producto
  let lotes = [];
  if (!id && cantidadInicial > 0) {
    lotes.push({
      id: genId(),
      cantidadBaseUnidades: cantidadInicial,
      cantidad: cantidadInicial,
      costoTotalLote: costo * cantidadInicial,
      costoPorUnidad: costo,
      vencimiento: fechaVenc,
      fechaIngreso: new Date().toISOString().slice(0, 10),
      nota: 'Stock inicial'
    });
  }

  const formatosVenta = [
    { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: venta, esBase: true }
  ];

  const data = {
    nombre,
    medida,
    categoria,
    marca: '',
    unidadBase: 'unidad',
    unidad: 'unidad',
    stockMinUnidades: stockMin,
    stockMin,
    formatosVenta,
    formatosCompra: [],
    empaques: [],
    precioVentaUnidad: venta,
    venta: venta,
    tieneVencimiento: tieneVenc,
    vencimiento: fechaVenc || null,
    costo: costo,
    costoPromedioUnidad: costo,
    costoReferencia: costo,
    nota: '',
    cantInicialCompra: cantidadInicial,
    costoTotalCompraInicial: costo * cantidadInicial
  };

  if (!id) {
    data.lotes = lotes;
    data.stock = cantidadInicial;
  }

  guardarProductoFinal(id, data);
});

// Guardado del producto y sincronización
function guardarProductoFinal(id, data) {
  const btn = document.getElementById('btnSpinner');
  if (btn) btn.style.display = 'inline-block';

  if (id) {
    const idx = productos.findIndex(p => p.id === id);
    if (idx > -1) {
      const antes = JSON.parse(JSON.stringify(productos[idx]));
      const antiguoVenta = safeNum(antes.precioVentaUnidad || antes.venta);
      const nuevo = { ...productos[idx], ...data };
      if (!data.foto && productos[idx].foto) nuevo.foto = productos[idx].foto;

      // Recalcular stock y costo con base en lotes
      nuevo.stock = getTotalUnidadesBase(nuevo);
      nuevo.costoPromedioUnidad = getCostoPromedio(nuevo);
      nuevo.costo = nuevo.costoPromedioUnidad;
      nuevo.vencimiento = getVencimientoMasCercano(nuevo);

      if (antiguoVenta !== safeNum(nuevo.precioVentaUnidad)) {
        registrarHistorialPrecio(productos[idx], 'edicion', 'Precio unidad: Bs.' + antiguoVenta.toFixed(2) + ' → Bs.' + safeNum(nuevo.precioVentaUnidad).toFixed(2));
      }
      productos[idx] = nuevo;
    }
    toast('Producto actualizado', 'success');
    save();
    if (btn) btn.style.display = 'none';
    renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
    navegarA('inventario'); filterAndRender(); resetProductForm();
    if (window.syncSaveProducto) { const p = productos.find(x => x.id === id); if (p) window.syncSaveProducto(p); }
  } else {
    const nuevo = {
      ...data,
      id: genId(),
      enOfertaManual: false,
      enOferta: false,
      precioOferta: 0,
      precioOfertaUnidad: 0,
      precioOfertaPaquete: 0,
      fechaFinOferta: '',
      ofertaLote: { activa: false, dias: 14, descuento: 10 },
      fechaRegistro: new Date().toISOString(),
      foto: data.foto || ''
    };
    productos.unshift(nuevo);
    save();

    // 🌟 REGISTRO DE AUDITORÍA EN HISTORIAL DE ENTRADAS (Si inició con stock)
    if (nuevo.stock > 0 && nuevo.lotes && nuevo.lotes.length > 0) {
      let entradas = [];
      try { entradas = JSON.parse(localStorage.getItem('tiaeli_entradas') || '[]'); } catch { entradas = []; }
      const entradaIni = {
        id: genId(),
        productoId: nuevo.id,
        productoNombre: nuevo.nombre,
        empaqueId: 'unidad_base',
        empaqueNombre: nuevo.unidadBase || 'unidad',
        cantidad: nuevo.stock,
        unidadesTotales: nuevo.stock,
        costo: data.costoTotalCompraInicial || (nuevo.costoPromedioUnidad * nuevo.stock),
        costoPorUnidad: nuevo.costoPromedioUnidad,
        vencimiento: nuevo.vencimiento || '',
        proveedor: 'Inventario Inicial',
        nota: 'Stock inicial al crear producto',
        fecha: Date.now(),
        usuario: (typeof usuarioActual === 'function' && usuarioActual()) || '—'
      };
      entradas.unshift(entradaIni);
      localStorage.setItem('tiaeli_entradas', JSON.stringify(entradas));
      if (window.syncSaveEntrada) window.syncSaveEntrada(entradaIni);
    }

    if (btn) btn.style.display = 'none';
    renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
    const sInp = document.getElementById('searchInput');
    if (sInp) sInp.value = '';
    const fEst = document.getElementById('filterEstado');
    if (fEst) fEst.value = '';
    invCurrentCategory = 'Todos';
    invCurrentPage = 1;
    navegarA('inventario');
    filterAndRender();
    resetProductForm();
    if (window.syncSaveProducto) window.syncSaveProducto(nuevo);
    toast('¡Producto "' + nuevo.nombre + '" guardado con ' + formatStockDisplay(nuevo) + '!', 'success');
  }
}

// Botones del modal de unificación
document.getElementById('unificarCancelBtn')?.addEventListener('click', () => {
  document.getElementById('unificarOverlay').style.display = 'none';
  if (tempProductData) {
    guardarProductoFinal(null, tempProductData);
    tempProductData = null;
    existingProductMatch = null;
  }
});

document.getElementById('unificarConfirmBtn')?.addEventListener('click', () => {
  document.getElementById('unificarOverlay').style.display = 'none';
  if (existingProductMatch && tempProductData) {
    const newLotes = JSON.parse(JSON.stringify(tempProductData.lotes || []));
    existingProductMatch.lotes = [...(existingProductMatch.lotes || []), ...newLotes];
    existingProductMatch.stock = getTotalUnidadesBase(existingProductMatch);
    existingProductMatch.vencimiento = getVencimientoMasCercano(existingProductMatch);
    existingProductMatch.costoPromedioUnidad = getCostoPromedio(existingProductMatch);
    existingProductMatch.costo = existingProductMatch.costoPromedioUnidad;
    existingProductMatch.updatedAt = Date.now();

    // Registrar en auditoría de entradas
    if (newLotes.length > 0 && tempProductData.stock > 0) {
      let entradas = [];
      try { entradas = JSON.parse(localStorage.getItem('tiaeli_entradas') || '[]'); } catch { entradas = []; }
      const entradaUnif = {
        id: genId(),
        productoId: existingProductMatch.id,
        productoNombre: existingProductMatch.nombre,
        empaqueId: 'unidad_base',
        empaqueNombre: existingProductMatch.unidadBase || 'unidad',
        cantidad: tempProductData.stock,
        unidadesTotales: tempProductData.stock,
        costo: tempProductData.costoTotalCompraInicial || (tempProductData.costoPromedioUnidad * tempProductData.stock),
        costoPorUnidad: tempProductData.costoPromedioUnidad,
        vencimiento: tempProductData.vencimiento || '',
        proveedor: 'Unificación de Stock',
        nota: 'Nuevo lote unificado al producto',
        fecha: Date.now(),
        usuario: (typeof usuarioActual === 'function' && usuarioActual()) || '—'
      };
      entradas.unshift(entradaUnif);
      localStorage.setItem('tiaeli_entradas', JSON.stringify(entradas));
      if (window.syncSaveEntrada) window.syncSaveEntrada(entradaUnif);
    }

    save();
    toast('Lotes agregados al producto existente "' + existingProductMatch.nombre + '"', 'success');
    renderDashboard(); navegarA('inventario'); filterAndRender();
    if (window.syncSaveProducto) window.syncSaveProducto(existingProductMatch);
    tempProductData = null;
    existingProductMatch = null;
  }
});

// ── HISTORIAL DE PRECIOS + AUDITORÍA ──
let historialPrecios = [];
try { historialPrecios = JSON.parse(localStorage.getItem('tiaeli_historial_precios') || '[]'); } catch { historialPrecios = []; }
window.historialPrecios = historialPrecios;

function saveHistorialPrecios() {
  localStorage.setItem('tiaeli_historial_precios', JSON.stringify(historialPrecios));
  window.historialPrecios = historialPrecios;
}

function registrarHistorialPrecio(p, tipo, detalle) {
  if (!p) return;
  historialPrecios.unshift({
    id: genId(),
    productoId: p.id,
    productoNombre: p.nombre,
    tipo,
    detalle,
    usuario: (typeof usuarioActual === 'function' && usuarioActual()) || '—',
    fecha: Date.now()
  });
  if (historialPrecios.length > 5000) historialPrecios = historialPrecios.slice(0, 5000);
  saveHistorialPrecios();
  if (window.syncSaveHistorialPrecio) window.syncSaveHistorialPrecio(historialPrecios[0]);
}

function abrirHistorialPrecios(id) {
  const p = productos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('hpProductoNombre').textContent = p.nombre;
  const precioUni = (p.formatosVenta?.find(f => f.id === 'unidad')?.precio) || p.precioVentaUnidad || p.venta || 0;
  document.getElementById('hpProductoInfo').textContent = 'Unidad: Bs.' + safeNum(precioUni).toFixed(2);
  const items = historialPrecios.filter(h => h.productoId === id).slice(0, 50);
  const list = document.getElementById('historialPreciosList');
  if (!items.length) { list.innerHTML = '<div class="empty-state"><span class="es-icon">💰</span><p>Sin cambios de precio registrados todavía.</p></div>'; }
  else {
    list.innerHTML = items.map(h => {
      const f = new Date(h.fecha);
      const tipoTag = h.tipo === 'oferta' ? '<span class="lote-badge lote-oferta">OFERTA</span>' : h.tipo === 'edicion' ? '<span class="badge badge-ok">EDICIÓN</span>' : '<span class="badge badge-bajo">' + escHTML(h.tipo) + '</span>';
      return `<div class="venta-card" style="margin-bottom:8px">
        <div class="venta-card-left">
          <div class="venta-card-nombre">${tipoTag} <span style="font-weight:400">${escHTML(h.detalle)}</span></div>
          <div class="venta-card-meta"><span>${f.toLocaleString('es-BO')}</span><span>${escHTML(h.usuario)}</span></div>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('historialPreciosOverlay').style.display = 'flex';
}
window.abrirHistorialPrecios = abrirHistorialPrecios;

// ── EDIT PRODUCTO REFORMADO ──
window._editModalCostoPromedio = 0;

function editarProducto(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  document.getElementById('editModalId').value = id;
  document.getElementById('editModalNombre').value = p.nombre || '';
  const catInput = document.getElementById('editModalCategoria');
  if (catInput) catInput.value = p.categoria || 'Licores';
  document.getElementById('editModalNota').value = p.nota || '';
  document.getElementById('editModalStockMin').value = safeNum(p.stockMinUnidades) || safeNum(p.stockMin) || 5;

  // Precio de venta general efectivo y costo promedio
  const pv = getPrecioVentaEfectivo(p);
  const cp = getCostoPromedio(p);
  const stockTotal = getTotalUnidadesBase(p);
  
  window._editModalCostoPromedio = cp;
  
  const inpPrecio = document.getElementById('editModalPrecioUnidad');
  if (inpPrecio) {
    const valMostrar = pv > 0 ? pv.toFixed(2) : (safeNum(p.venta) > 0 ? safeNum(p.venta).toFixed(2) : '');
    inpPrecio.value = valMostrar;
  }
  
  const pActualDisp = document.getElementById('editModalPrecioActualDisplay');
  if (pActualDisp) {
    pActualDisp.textContent = pv > 0 ? 'Bs. ' + pv.toFixed(2) : (safeNum(p.venta) > 0 ? 'Bs. ' + safeNum(p.venta).toFixed(2) : 'Sin precio');
  }
  const cActualDisp = document.getElementById('editModalCostoDisplay');
  if (cActualDisp) {
    cActualDisp.textContent = 'Bs. ' + cp.toFixed(2);
  }
  const costoRef = document.getElementById('editModalCostoRef');
  if (costoRef) {
    costoRef.textContent = 'Bs. ' + cp.toFixed(2);
  }
  
  calcularMargenEdicionModal();

  // Hero: Identidad Fija del Producto con Precio de Venta y Stock Arriba
  const catIcon = getCategoryMaterialIcon(p.categoria);
  document.getElementById('editModalHero').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;padding:10px 14px;background:var(--bg2);border-radius:var(--radius);border:1px solid var(--border);margin-bottom:12px;">
      <div style="width:36px;height:36px;border-radius:8px;background:rgba(249,115,22,0.12);color:var(--inv-primary,#f97316);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span class="material-symbols-outlined" style="font-size:22px;">${catIcon}</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:800;font-size:0.98rem;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(p.nombre)}</div>
        <div style="font-size:0.78rem;color:var(--text2);display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px;">
          <span>Precio venta: <b style="color:var(--inv-primary,#f97316);font-weight:700;">Bs. ${pv.toFixed(2)}</b></span>
          <span>•</span>
          <span>Stock actual: <b id="editModalStockDisplay" style="color:var(--text1);font-weight:700;">${stockTotal}</b></span>
          ${p.medida ? `<span>•</span><span style="font-weight:600;color:var(--text3);">${escHTML(p.medida)}</span>` : ''}
        </div>
      </div>
    </div>`;

  // Lotes con ajuste directo
  renderEditModalLotes(p);

  document.getElementById('editModalTitle').textContent = 'Editar: ' + p.nombre;
  document.getElementById('editarProductoOverlay').style.display = 'flex';
}
window.editarProducto = editarProducto;

window.calcularMargenEdicionModal = function() {
  const inp = document.getElementById('editModalPrecioUnidad');
  const lbl = document.getElementById('editModalGananciaCalc');
  if (!inp || !lbl) return;
  const p = parseFloat(inp.value) || 0;
  const cp = window._editModalCostoPromedio || 0;
  if (p > 0) {
    const ganancia = p - cp;
    const margen = ((ganancia / p) * 100).toFixed(1);
    lbl.textContent = (ganancia >= 0 ? '+' : '') + 'Bs. ' + ganancia.toFixed(2) + ' (' + margen + '%)';
    lbl.style.color = ganancia >= 0 ? 'var(--inv-primary, #f97316)' : 'var(--inv-error, #ef4444)';
  } else {
    lbl.textContent = '+Bs. 0.00 (0.0%)';
    lbl.style.color = 'var(--text3)';
  }
};

window.abrirEntradaDesdeEdicion = function() {
  const id = document.getElementById('editModalId')?.value;
  if (!id) return;
  document.getElementById('editarProductoOverlay').style.display = 'none';
  if (typeof abrirEntrada === 'function') abrirEntrada(id);
};

// Render lotes inside the edit modal con opción de edición directa
function renderEditModalLotes(p) {
  const container = document.getElementById('editModalLotes');
  if (!container) return;
  const lotes = safeArr(p.lotes).filter(l => safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad) > 0);
  if (lotes.length === 0) {
    container.innerHTML = '<div style="padding:10px;background:var(--bg2);border-radius:6px;font-size:0.82rem;color:var(--text3);text-align:center">Sin lotes activos en bodega</div>';
    return;
  }
  const now = new Date();
  container.innerHTML = lotes.map((l, i) => {
    const v = l.vencimiento ? new Date(l.vencimiento) : null;
    const d = v ? Math.ceil((v - now) / 86400000) : null;
    const vencFmt = v ? v.toLocaleDateString('es-BO') : 'S/Venc.';
    const ingresoFmt = l.fechaIngreso ? new Date(l.fechaIngreso).toLocaleDateString('es-BO') : '—';
    const bdg = d === null ? '<span class="inv-lote-badge inv-lote-vigente">Vigente</span>' :
                d < 0 ? '<span class="inv-lote-badge inv-lote-rojo">Vencido</span>' :
                d <= 15 ? '<span class="inv-lote-badge inv-lote-naranja">Pronto</span>' :
                '<span class="inv-lote-badge inv-lote-vigente">Vigente</span>';
    const cantLote = safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad);
    const hasRealNota = l.nota && l.nota.trim() !== '' && l.nota !== 'Lote original migrado';

    return `<div style="background:var(--bg2);padding:8px 12px;border-radius:6px;margin-bottom:6px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:0.82rem;">
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;color:var(--text1);">
          Lote ${i+1} &nbsp;·&nbsp; Costo: <b>Bs. ${safeNum(l.costoPorUnidad).toFixed(2)}</b> &nbsp;·&nbsp; <span style="font-size:0.75rem;color:var(--text3);">Ingreso: ${ingresoFmt} &nbsp;·&nbsp; Venc: <b>${vencFmt}</b></span>
        </div>
        ${hasRealNota ? `<div style="font-size:0.75rem;color:var(--text2);margin-top:2px;">Nota: <b>${escHTML(l.nota)}</b></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
        <span style="font-size:0.75rem;color:var(--text3);font-weight:600;">Cant:</span>
        <input type="number" class="form-input" min="0" value="${cantLote}" 
          style="width:58px;padding:3px 6px;font-size:0.82rem;text-align:center;height:28px;" 
          onchange="ajustarCantidadLote('${p.id}', '${l.id}', this.value)" 
          title="Editar cantidad de este lote" />
        <button type="button" onclick="eliminarLote('${p.id}', '${l.id}')" 
          style="padding:3px 7px;height:28px;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;" 
          title="Quitar este lote">
          <span class="material-symbols-outlined" style="font-size:16px;">delete</span>
        </button>
        ${bdg}
      </div>
    </div>`;
  }).join('');
}
window.renderEditModalLotes = renderEditModalLotes;

// Guardar cambios del modal de edición
function guardarEdicionModal() {
  const id = document.getElementById('editModalId').value;
  if (!id) return;
  const idx = productos.findIndex(p => p.id === id);
  if (idx < 0) { toast('Producto no encontrado', 'error'); return; }

  const nombre = document.getElementById('editModalNombre').value.trim();
  if (!nombre) { toast('El nombre no puede estar vacío', 'error'); return; }
  const categoria = (document.getElementById('editModalCategoria')?.value || productos[idx].categoria || 'Licores');
  if (!categoria) { toast('Selecciona una categoría', 'error'); return; }
  const precioUnidad = safeNum(document.getElementById('editModalPrecioUnidad').value);
  if (precioUnidad <= 0) { toast('Ingresa un precio de venta válido mayor a 0', 'error'); return; }

  const antes = JSON.parse(JSON.stringify(productos[idx]));
  const antiguoVenta = safeNum(antes.precioVentaUnidad || antes.venta);

  productos[idx].nombre = nombre;
  productos[idx].categoria = categoria;
  productos[idx].nota = document.getElementById('editModalNota').value.trim();
  productos[idx].stockMinUnidades = safeNum(document.getElementById('editModalStockMin').value) || 5;

  // Actualizar precio de venta general
  productos[idx].precioVentaUnidad = precioUnidad;
  productos[idx].venta = precioUnidad;

  const fmts = safeArr(productos[idx].formatosVenta);
  const fmtUni = fmts.find(f => f.id === 'unidad' || f.esBase);
  if (fmtUni) {
    fmtUni.precio = precioUnidad;
  } else {
    fmts.unshift({ id: 'unidad', nombre: 'Unidad', unidades: 1, precio: precioUnidad, esBase: true });
  }
  productos[idx].formatosVenta = fmts;
  productos[idx].updatedAt = Date.now();

  if (antiguoVenta !== precioUnidad && typeof registrarHistorialPrecio === 'function') {
    registrarHistorialPrecio(antes, 'edicion', `Precio general actualizado: Bs.${antiguoVenta.toFixed(2)} → Bs.${precioUnidad.toFixed(2)}`);
  }

  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(productos[idx]);

  document.getElementById('editarProductoOverlay').style.display = 'none';
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast(`Producto "${nombre}" actualizado exitosamente`, 'success');
}
window.guardarEdicionModal = guardarEdicionModal;

// ── DELETE & ARCHIVE PROTEGIDO ──
function eliminarProducto(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  const ventasDelProd = (window.ventas || []).filter(v => v.productoId === id);
  const fiadosDelProd = (window.fiados || []).filter(f => (f.items || []).some(it => it.productoId === id));

  if (ventasDelProd.length > 0 || fiadosDelProd.length > 0) {
    const totalVentas = ventasDelProd.length;
    const msg = `⚠️ ACCIÓN PROTEGIDA:\n\nEl producto "${p.nombre}" tiene ${totalVentas} venta(s)${fiadosDelProd.length > 0 ? ` y ${fiadosDelProd.length} fiado(s)` : ''} en su historial.\n\nEliminarlo de forma destructiva rompería tus reportes contables y el historial de ganancias pasadas.\n\n¿Deseas ARCHIVARLO/DESACTIVARLO en su lugar?\n• Se ocultará del POS para que no se pueda vender.\n• Se retirará del catálogo de inventario activo.\n• Tus reportes de ventas y ganancias se conservarán intactos.`;
    if (!confirm(msg)) return;

    p.activo = false;
    p.archivado = true;
    p.updatedAt = Date.now();
    save();
    if (window.syncSaveProducto) window.syncSaveProducto(p);
    if (typeof registrarActividad === 'function') {
      registrarActividad('producto', `Producto archivado (protegido por historial): ${p.nombre}`);
    }
    filterAndRender(); renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
    if (window.renderPOSProducts) window.renderPOSProducts();
    toast(`"${p.nombre}" archivado y protegido correctamente`, 'success');
    return;
  }

  if (!confirm(`¿Eliminar definitivamente "${p.nombre}"?\nComo este producto no tiene ventas registradas, se eliminará de forma segura y completa del sistema.`)) return;
  productos = productos.filter(x => x.id !== id);
  window.productos = productos;
  save();
  if (window.syncDeleteProducto) window.syncDeleteProducto(id);
  if (typeof registrarActividad === 'function') {
    registrarActividad('producto', `Producto eliminado permanentemente: ${p.nombre}`);
  }
  filterAndRender(); renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
  if (window.renderPOSProducts) window.renderPOSProducts();
  toast('Producto eliminado limpiamente','warning');
}
window.eliminarProducto = eliminarProducto;

function reactivarProducto(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  p.activo = true;
  p.archivado = false;
  p.updatedAt = Date.now();
  save();
  if (window.syncSaveProducto) window.syncSaveProducto(p);
  if (typeof registrarActividad === 'function') {
    registrarActividad('producto', `Producto reactivado en catálogo: ${p.nombre}`);
  }
  filterAndRender(); renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
  if (window.renderPOSProducts) window.renderPOSProducts();
  toast(`"${p.nombre}" reactivado en el catálogo`, 'success');
}
window.reactivarProducto = reactivarProducto;

// ── OFERTA ──
let ofertaCurrentId = null;
window.cambiarOfertaTab = function(tab) {
  document.querySelectorAll('.oferta-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const manual = document.getElementById('ofertaTabManual');
  const lote = document.getElementById('ofertaTabLote');
  if (manual) manual.style.display = tab === 'manual' ? 'block' : 'none';
  if (lote) lote.style.display = tab === 'lote' ? 'block' : 'none';
};
function abrirOferta(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  ofertaCurrentId = id;
  document.getElementById('ofertaProductoId').value = id;
  const info = document.getElementById('ofertaInfo');
  if (info) info.innerHTML = `<strong>${p.nombre}</strong> · Unidad: Bs. ${safeNum(p.precioVentaUnidad || p.venta).toFixed(2)}${safeNum(p.precioVentaPaquete) > 0 ? ' · Paquete: Bs. ' + safeNum(p.precioVentaPaquete).toFixed(2) : ''}`;
  const precUni = safeNum(p.precioOfertaUnidad || p.precioOferta) > 0 ? (p.precioOfertaUnidad || p.precioOferta) : '';
  document.getElementById('ofertaPrecioUnidad').value = precUni;
  document.getElementById('ofertaPrecioPaquete').value = safeNum(p.precioOfertaPaquete) > 0 ? p.precioOfertaPaquete : '';
  document.getElementById('ofertaFechaFin').value = p.fechaFinOferta || '';
  const cfg = p.ofertaLote || {};
  const chk = document.getElementById('ofertaLoteActiva'); if (chk) chk.checked = cfg.activa !== false;
  const dias = document.getElementById('ofertaDiasVencimiento'); if (dias) dias.value = cfg.dias || 14;
  const dcto = document.getElementById('ofertaDescuentoLote'); if (dcto) dcto.value = cfg.descuento || 10;
  cambiarOfertaTab('manual');
  document.getElementById('ofertaOverlay').style.display = 'flex';
}
window.abrirOferta = abrirOferta;
document.getElementById('ofertaClose')?.addEventListener('click', () => { document.getElementById('ofertaOverlay').style.display = 'none'; });
document.getElementById('ofertaManualCancelBtn')?.addEventListener('click', () => { document.getElementById('ofertaOverlay').style.display = 'none'; });
document.getElementById('ofertaManualConfirmBtn')?.addEventListener('click', () => {
  const p = productos.find(x => x.id === ofertaCurrentId);
  if (!p) return;
  const precioU = parseFloat(document.getElementById('ofertaPrecioUnidad').value) || 0;
  const precioP = parseFloat(document.getElementById('ofertaPrecioPaquete').value) || 0;
  const fechaFin = document.getElementById('ofertaFechaFin').value;
  if (!precioU && !precioP) {
    p.enOfertaManual = false; p.enOferta = false;
    p.precioOferta = 0; p.precioOfertaUnidad = 0; p.precioOfertaPaquete = 0; p.fechaFinOferta = '';
    registrarHistorialPrecio(p, 'oferta', 'Oferta manual desactivada');
    save(); filterAndRender(); renderDashboard();
    document.getElementById('ofertaOverlay').style.display = 'none';
    toast('Oferta manual desactivada', 'info');
    if (window.syncSaveProducto) window.syncSaveProducto(p);
    return;
  }
  p.enOfertaManual = true; p.enOferta = true;
  p.precioOfertaUnidad = precioU; p.precioOfertaPaquete = precioP; p.precioOferta = precioU; p.fechaFinOferta = fechaFin;
  registrarHistorialPrecio(p, 'oferta', 'Oferta manual: unidad Bs.' + precioU.toFixed(2) + (precioP > 0 ? ' · paquete Bs.' + precioP.toFixed(2) : '') + (fechaFin ? ' hasta ' + fechaFin : ''));
  save(); filterAndRender(); renderDashboard();
  document.getElementById('ofertaOverlay').style.display = 'none';
  toast(p.nombre + ' en oferta', 'success');
  if (window.syncSaveProducto) window.syncSaveProducto(p);
});
document.getElementById('ofertaLoteCancelBtn')?.addEventListener('click', () => { document.getElementById('ofertaOverlay').style.display = 'none'; });
document.getElementById('ofertaLoteConfirmBtn')?.addEventListener('click', () => {
  const p = productos.find(x => x.id === ofertaCurrentId);
  if (!p) return;
  p.ofertaLote = {
    activa: document.getElementById('ofertaLoteActiva').checked,
    dias: parseInt(document.getElementById('ofertaDiasVencimiento').value) || 14,
    descuento: parseInt(document.getElementById('ofertaDescuentoLote').value) || 10
  };
  registrarHistorialPrecio(p, 'config', 'Oferta por lote: ' + (p.ofertaLote.activa ? 'activada (' + p.ofertaLote.dias + ' días, ' + p.ofertaLote.descuento + '%)' : 'desactivada'));
  save(); filterAndRender(); renderDashboard();
  if (typeof ejecutarJobOfertasLote === 'function') ejecutarJobOfertasLote();
  document.getElementById('ofertaOverlay').style.display = 'none';
  toast('Configuración de oferta por lote guardada', 'success');
  if (window.syncSaveProducto) window.syncSaveProducto(p);
});

// ── VENCIMIENTOS POR LOTES ──
activeVencDias = 7;
function renderVencimientos(dias) {
  activeVencDias = dias;
  document.querySelectorAll('.vtab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.dias)===dias||t.dataset.dias==='9999'&&dias===9999));
  const now = new Date(); const limit = new Date(Date.now() + dias*86400000);
  
  let listLotes = [];
  productos.forEach(p => {
    (p.lotes||[]).forEach((l, i) => {
      if (l.cantidad > 0 && l.vencimiento) {
        const vdStr = String(l.vencimiento);
        const vd = new Date(vdStr.includes('T') ? vdStr : vdStr + 'T12:00:00');
        listLotes.push({ p, l, i, vd, diasRestantes: Math.ceil((vd-now)/86400000) });
      }
    });
  });

  listLotes = listLotes.filter(x => dias===9999 ? true : x.vd <= limit).sort((a,b) => a.vd - b.vd);
  
  const cont = document.getElementById('vencimientoList');
  if (!listLotes.length) { cont.innerHTML='<div class="empty-state"><span class="es-icon">✓</span><p>No hay lotes próximos a vencer en este rango.</p></div>'; return; }
  
  cont.innerHTML = listLotes.map(x => {
    const cls = x.diasRestantes < 0 ? 'critico' : x.diasRestantes <= 7 ? 'critico' : x.diasRestantes <= 15 ? 'alerta' : x.diasRestantes <= 30 ? 'precaucion' : 'seguro';
    const diaTag = x.diasRestantes < 0 ? '<span class="venc-dias dias-rojo">VENCIDO</span>' :
      x.diasRestantes <= 7 ? `<span class="venc-dias dias-rojo">${x.diasRestantes}d</span>` :
      x.diasRestantes <= 15 ? `<span class="venc-dias dias-naranja">${x.diasRestantes}d</span>` :
      x.diasRestantes <= 30 ? `<span class="venc-dias dias-amarillo">${x.diasRestantes}d</span>` :
      `<span class="venc-dias dias-verde">${x.diasRestantes}d</span>`;
    const emoji = x.diasRestantes < 0 ? '🚫' : x.diasRestantes <= 7 ? '⚠️' : x.diasRestantes <= 15 ? '⚡' : x.diasRestantes <= 30 ? '⏰' : '📅';
    const fechaFmt = x.vd.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return `<div class="venc-card ${cls}">
      <div class="venc-emoji">${emoji}</div>
      <div class="venc-info">
        <div class="venc-name">${escHTML(x.p.nombre)} <span style="font-size:0.78rem;font-weight:500;color:var(--text3);">(Lote: ${escHTML(x.l.numero || ('#' + (x.i+1)))})</span></div>
        <div class="venc-meta">
          <span><b>Vence:</b> ${fechaFmt}</span>
          <span><b>Stock:</b> ${x.l.cantidad} u.</span>
          <span><b>Categoría:</b> ${escHTML(x.p.categoria || 'General')}</span>
          ${x.l.enOfertaPorVencimiento ? ' · <b style="color:var(--orange)">EN OFERTA</b>' : ''}
        </div>
      </div>
      ${diaTag}
      <div class="venc-actions"><button class="btn btn-warning btn-sm" onclick="abrirOferta('${x.p.id}')">Oferta</button></div>
    </div>`;
  }).join('');
}
window.renderVencimientos = renderVencimientos;
document.querySelectorAll('.vtab').forEach(t => t.addEventListener('click', () => renderVencimientos(parseInt(t.dataset.dias)||9999)));

// ── SIMULACRO DE VENCIMIENTOS CORTOS Y LARGOS ──
function cargarSimulacroVencimientos() {
  const hoy = new Date();
  function addDias(dias) {
    const d = new Date(hoy.getTime() + dias * 86400000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const simulacro = [
    {
      id: 'sim_corona',
      nombre: 'Cerveza Corona Extra 355ml',
      categoria: 'Cervezas',
      unidadBase: 'unidad',
      stockMin: 12,
      costo: 12.00,
      costoPromedioUnidad: 12.00,
      venta: 15.00,
      precioVentaUnidad: 15.00,
      lotes: [
        {
          id: 'lote_sim_cor_1',
          numero: 'L-COR-VENC',
          vencimiento: addDias(-2), // Vencido: hace 2 días
          cantidad: 14,
          cantidadBaseUnidades: 14,
          costo: 12.00,
          costoPorUnidad: 12.00,
          costoTotalLote: 168.00
        }
      ]
    },
    {
      id: 'sim_pacena',
      nombre: 'Cerveza Paceña Pilsener 330ml',
      categoria: 'Cervezas',
      unidadBase: 'unidad',
      stockMin: 24,
      costo: 8.10,
      costoPromedioUnidad: 8.10,
      venta: 9.50,
      precioVentaUnidad: 9.50,
      lotes: [
        {
          id: 'lote_sim_pac_1',
          numero: 'L-PAC-01',
          vencimiento: addDias(3), // Corto crítico: 3 días
          cantidad: 24,
          cantidadBaseUnidades: 24,
          costo: 8.10,
          costoPorUnidad: 8.10,
          costoTotalLote: 194.40
        },
        {
          id: 'lote_sim_pac_2',
          numero: 'L-PAC-02',
          vencimiento: addDias(90), // Largo: 3 meses (90 días)
          cantidad: 96,
          cantidadBaseUnidades: 96,
          costo: 8.10,
          costoPorUnidad: 8.10,
          costoTotalLote: 777.60
        }
      ]
    },
    {
      id: 'sim_fernet',
      nombre: 'Fernet Branca 750ml',
      categoria: 'Licores',
      unidadBase: 'botella',
      stockMin: 6,
      costo: 68.00,
      costoPromedioUnidad: 68.00,
      venta: 85.00,
      precioVentaUnidad: 85.00,
      lotes: [
        {
          id: 'lote_sim_fer_1',
          numero: 'L-FER-01',
          vencimiento: addDias(6), // Corto crítico: 6 días
          cantidad: 8,
          cantidadBaseUnidades: 8,
          costo: 68.00,
          costoPorUnidad: 68.00,
          costoTotalLote: 544.00
        },
        {
          id: 'lote_sim_fer_2',
          numero: 'L-FER-02',
          vencimiento: addDias(365), // Muy largo: 1 año (365 días)
          cantidad: 18,
          cantidadBaseUnidades: 18,
          costo: 68.00,
          costoPorUnidad: 68.00,
          costoTotalLote: 1224.00
        }
      ]
    },
    {
      id: 'sim_ron',
      nombre: 'Ron Flor de Caña 4 Años 750ml',
      categoria: 'Licores',
      unidadBase: 'botella',
      stockMin: 6,
      costo: 52.00,
      costoPromedioUnidad: 52.00,
      venta: 65.00,
      precioVentaUnidad: 65.00,
      lotes: [
        {
          id: 'lote_sim_ron_1',
          numero: 'L-RON-01',
          vencimiento: addDias(12), // Medio: 12 días (alerta naranja)
          cantidad: 12,
          cantidadBaseUnidades: 12,
          costo: 52.00,
          costoPorUnidad: 52.00,
          costoTotalLote: 624.00
        }
      ]
    },
    {
      id: 'sim_smirnoff',
      nombre: 'Vodka Smirnoff Red 700ml',
      categoria: 'Licores',
      unidadBase: 'botella',
      stockMin: 6,
      costo: 48.00,
      costoPromedioUnidad: 48.00,
      venta: 60.00,
      precioVentaUnidad: 60.00,
      lotes: [
        {
          id: 'lote_sim_vod_1',
          numero: 'L-VOD-01',
          vencimiento: addDias(24), // Medio: 24 días (precaución amarilla)
          cantidad: 10,
          cantidadBaseUnidades: 10,
          costo: 48.00,
          costoPorUnidad: 48.00,
          costoTotalLote: 480.00
        }
      ]
    },
    {
      id: 'sim_singani',
      nombre: 'Singani Los Parrales Clásico 750ml',
      categoria: 'Licores',
      unidadBase: 'botella',
      stockMin: 6,
      costo: 42.00,
      costoPromedioUnidad: 42.00,
      venta: 55.00,
      precioVentaUnidad: 55.00,
      lotes: [
        {
          id: 'lote_sim_sin_1',
          numero: 'L-SIN-01',
          vencimiento: addDias(180), // Largo: 6 meses (180 días verde)
          cantidad: 15,
          cantidadBaseUnidades: 15,
          costo: 42.00,
          costoPorUnidad: 42.00,
          costoTotalLote: 630.00
        }
      ]
    }
  ];

  simulacro.forEach(item => {
    item.stock = item.lotes.reduce((sum, l) => sum + l.cantidad, 0);
    item.vencimiento = item.lotes[0].vencimiento;
    const idx = productos.findIndex(p => p.id === item.id || p.nombre === item.nombre);
    if (idx >= 0) {
      productos[idx] = { ...productos[idx], ...item };
    } else {
      productos.push(item);
    }
  });

  save();
  renderVencimientos(activeVencDias || 7);
  renderDashboard();
  if (typeof toast === 'function') toast('Simulacro cargado: 6 productos con vencimientos cortos y largos', 'success');
}
window.cargarSimulacroVencimientos = cargarSimulacroVencimientos;

// ── INIT ──
renderDashboard();
renderTabla();

document.addEventListener('DOMContentLoaded', () => {
  if (window.innerWidth <= 768) {
    // On mobile, start at POS - render data first
    if (typeof window.initPOS === 'function') window.initPOS();
    navegarA('pos');
  } else {
    // Desktop: dashboard is already active in HTML, just ensure
    navegarA('dashboard');
  }
});
// Firebase se inicializa desde sync.js (cargado en index.html)

// ═══════════════════════════════════════════
// MEJORAS ADICIONALES - UI/UX
// ═══════════════════════════════════════════

// Scroll-to-top button
(function initScrollToTop() {
  const btn = document.createElement('button');
  btn.className = 'scroll-top-btn';
  btn.innerHTML = '<i data-lucide="arrow-up" style="width:20px;height:20px"></i>';
  btn.setAttribute('aria-label', 'Volver arriba');
  btn.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.body.appendChild(btn);
  window.addEventListener('scroll', throttle(() => {
    btn.classList.toggle('visible', window.scrollY > 300);
  }, 200));
})();

// Escape key closes any open modal
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const modals = document.querySelectorAll('[id$="Overlay"]');
  for (const m of modals) {
    if (m.style.display !== 'none' && m.style.display !== '' && getComputedStyle(m).display !== 'none') {
      m.style.display = 'none';
      return;
    }
  }
});

// Debounced search for inventory - ya gestionado en filterAndRender sin sobreescritura

// Debounced search for POS
const posSearchInput = document.getElementById('posSearchInput');
if (posSearchInput) {
  posSearchInput.addEventListener('input', debounce(() => {
    if (typeof renderPOS === 'function') renderPOS();
  }, 250));
}

// Debounced search for historial
const hSearch = document.getElementById('hSearch');
if (hSearch) {
  hSearch.addEventListener('input', debounce(() => {
    if (typeof renderHistorial === 'function') renderHistorial();
  }, 250));
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl+S / Cmd+S → save product form
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const wizardSubmit = document.getElementById('wizardSubmit') || document.getElementById('btnGuardarProductoDirecto');
    if (wizardSubmit && document.getElementById('productForm')?.style.display !== 'none') {
      wizardSubmit.click();
    }
  }
  // Ctrl+N → new product
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    document.getElementById('btnNuevoProducto')?.click();
  }
});

// Add aria-labels to icon-only buttons for accessibility
document.querySelectorAll('.btn-icon, [title]').forEach(el => {
  if (!el.getAttribute('aria-label') && el.getAttribute('title')) {
    el.setAttribute('aria-label', el.getAttribute('title'));
  }
});

console.log('[App] Mejoras UI/UX cargadas');

window.editModalPhotoBase64 = undefined;

window.handleEditModalPhotoUpload = async function(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  try {
    const b64 = typeof compressImage === 'function' ? await compressImage(file, 60 * 1024, 400) : await (new Promise((res, rej) => {
      const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsDataURL(file);
    }));
    window.editModalPhotoBase64 = b64;
    const heroEl = document.getElementById('editModalHeroImg');
    if (heroEl) {
      heroEl.outerHTML = `<img src="${b64}" id="editModalHeroImg" style="width:52px;height:52px;border-radius:8px;object-fit:cover;border:1px solid var(--border)" />`;
    }
    toast('Foto cargada para guardar', 'success');
  } catch(e) {
    toast('Error al procesar foto: ' + e.message, 'error');
  }
};

window.removeEditModalPhoto = function() {
  window.editModalPhotoBase64 = '';
  const heroEl = document.getElementById('editModalHeroImg');
  if (heroEl) {
    heroEl.outerHTML = `<div id="editModalHeroImg" style="width:52px;height:52px;border-radius:8px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:1.4rem;border:1px solid var(--border)">🍷</div>`;
  }
  toast('Foto quitada', 'info');
};

// ── QUICK EDIT PRECIO EN 1 CLIC DESDE TABLA ──
window._quickEditCosto = 0;

window.abrirQuickEditPrecio = function(id, event) {
  if (event) event.stopPropagation();
  const p = productos.find(x => x.id === id);
  if (!p) return;
  const pv = getPrecioVentaEfectivo(p);
  const cp = getCostoPromedio(p);
  
  document.getElementById('quickEditProdId').value = id;
  document.getElementById('quickEditProdNombre').textContent = p.nombre;
  document.getElementById('quickEditProdDetalle').textContent = `${p.categoria || 'General'} · ${p.medida || 'Unidad'} · Stock: ${getTotalUnidadesBase(p)}`;
  document.getElementById('quickEditCostoActual').textContent = 'Bs. ' + cp.toFixed(2);
  
  const inp = document.getElementById('quickEditPrecioInput');
  inp.value = pv > 0 ? pv.toFixed(2) : '';
  
  window._quickEditCosto = cp;
  actualizarMargenQuickEdit();
  
  document.getElementById('quickEditPrecioOverlay').style.display = 'flex';
  setTimeout(() => { inp.focus(); inp.select(); }, 80);
};

window.cerrarQuickEditPrecio = function() {
  document.getElementById('quickEditPrecioOverlay').style.display = 'none';
};

window.actualizarMargenQuickEdit = function() {
  const inp = document.getElementById('quickEditPrecioInput');
  const lbl = document.getElementById('quickEditGananciaVal');
  const nuevoP = parseFloat(inp.value) || 0;
  const costo = window._quickEditCosto || 0;
  if (!lbl) return;
  
  if (nuevoP > 0) {
    const ganancia = nuevoP - costo;
    const margen = ((ganancia / nuevoP) * 100).toFixed(1);
    lbl.textContent = (ganancia >= 0 ? '+' : '') + 'Bs. ' + ganancia.toFixed(2) + ' (' + margen + '%)';
    lbl.style.color = ganancia >= 0 ? 'var(--inv-primary, #f97316)' : 'var(--inv-error, #ef4444)';
  } else {
    lbl.textContent = '+Bs. 0.00 (0.0%)';
    lbl.style.color = 'var(--text3)';
  }
};

window.guardarQuickEditPrecio = function() {
  const id = document.getElementById('quickEditProdId').value;
  const p = productos.find(x => x.id === id);
  if (!p) return;
  
  const nuevoP = safeNum(document.getElementById('quickEditPrecioInput').value);
  if (nuevoP <= 0) {
    toast('Ingresa un precio de venta válido mayor a 0', 'error');
    return;
  }
  
  const antes = JSON.parse(JSON.stringify(p));
  const antiguoVenta = safeNum(p.precioVentaUnidad || p.venta);
  
  p.precioVentaUnidad = nuevoP;
  p.venta = nuevoP;
  
  const fmts = safeArr(p.formatosVenta);
  const fmtUni = fmts.find(f => f.id === 'unidad' || f.esBase);
  if (fmtUni) {
    fmtUni.precio = nuevoP;
  } else {
    fmts.unshift({ id: 'unidad', nombre: 'Unidad', unidades: 1, precio: nuevoP, esBase: true });
  }
  p.formatosVenta = fmts;
  p.updatedAt = Date.now();
  
  if (antiguoVenta !== nuevoP && typeof registrarHistorialPrecio === 'function') {
    registrarHistorialPrecio(antes, 'edicion_rapida', `Precio general actualizado: Bs.${antiguoVenta.toFixed(2)} → Bs.${nuevoP.toFixed(2)}`);
  }
  
  if (typeof save === 'function') save();
  if (typeof window.syncSaveProducto === 'function') window.syncSaveProducto(p);
  
  cerrarQuickEditPrecio();
  if (typeof filterAndRender === 'function') filterAndRender();
  if (typeof renderPOSProducts === 'function') renderPOSProducts();
  if (typeof renderDashboard === 'function') renderDashboard();
  toast(`Precio de venta de "${p.nombre}" actualizado a Bs. ${nuevoP.toFixed(2)}`, 'success');
};
