// ═══════════════════════════════════════════
// app.js — Core inventory logic v4 (Lotes & FEFO + Paquetes + Ofertas)
// ═══════════════════════════════════════════

// ==== UTILS GLOBALES ====
function escHTML(s){
  if(s==null||s===undefined) return "";
  return String(s)
    .replace(/&/g, String.fromCharCode(38,97,109,112,59))
    .replace(/</g, String.fromCharCode(38,108,116,59))
    .replace(/>/g, String.fromCharCode(38,103,116,59))
    .replace(/"/g, String.fromCharCode(38,113,117,111,116,59))
    .replace(/\x27/g, String.fromCharCode(38,35,51,57,59));
}
function safeNum(v, fb){ var n = Number(v); return Number.isFinite(n) ? n : (fb === undefined ? 0 : fb); }
function safeArr(v){ return Array.isArray(v) ? v : []; }
function csvSafe(v){
  var s = String(v == null ? "" : v);
  return /^[=+\-@\t\r]/.test(s) ? String.fromCharCode(39) + s : s;
}
function _safeImg(f){ return (f && typeof f === "string" && /^data:image\//.test(f)) ? f : ""; }
window.escHTML = escHTML;
window.safeNum = safeNum;
window.safeArr = safeArr;
window.csvSafe = csvSafe;
window._safeImg = _safeImg;

let productos = [];
try {
  productos = JSON.parse(localStorage.getItem('tiaeli_v2') || '[]');
} catch (e) {
  console.warn('localStorage corrupto, reseteando:', e);
  localStorage.removeItem('tiaeli_v2');
  productos = [];
}
window.productos = productos;
window.setProductosGlobal = function(nuevos) {
  productos = nuevos;
  window.productos = nuevos;
};

const CATS = {Licores:'[L]',Cervezas:'[C]',Sodas:'[S]',Jugos:'[J]',Galletas:'[G]',Chicles:'[CH]',Otros:'[+]'};
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

// ── UTILS LOTES ──
// Stock total expresado en UNIDADES BASE (convierte empaques)
function getTotalUnidadesBase(p) {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes)) return safeNum(p.stock);
  return p.lotes.reduce((sum, l) => {
    const unidades = getUnidadesPorEmpaque(p, l.empaqueId || 'unidad_base');
    return sum + safeNum(l.cantidad) * unidades;
  }, 0);
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
  let totalValor = 0, totalStock = 0;
  activos.forEach(l => {
    const unidEmp = getUnidadesPorEmpaque(p, l.empaqueId || 'unidad_base') || 1;
    const unidades = safeNum(l.cantidad) * unidEmp;
    totalStock += unidades;
    totalValor += unidades * (safeNum(l.costo) / unidEmp);
  });
  return totalStock > 0 ? totalValor / totalStock : 0;
}

// Helper para obtener stock total en unidades base
function getTotalUnidadesBase(p) {
  if (!p) return 0;
  if (!p.lotes || !Array.isArray(p.lotes)) return safeNum(p.stock);
  return p.lotes.reduce((sum, l) => {
    const unidades = getUnidadesPorEmpaque({empaques: safeArr(p.empaques)}, l.empaqueId);
    return sum + safeNum(l.cantidad) * unidades;
  }, 0);
}

function migrarProductosALotes() {
  let migrados = false;
  productos.forEach(p => {
    // Campos nuevos de identidad
    if (!p.unidadBase) p.unidadBase = p.unidad || 'unidad';
    if (!p.mlPorUnidad) p.mlPorUnidad = 330;
    // Sin empaques definidos = solo unidades sueltas (sin paquete inventado)
    if (!Array.isArray(p.empaques)) p.empaques = [];
    if (!p.stockMinUnidades) p.stockMinUnidades = p.stockMin || 24;

    // Lotes: normalizar al nuevo modelo (empaqueId + costo por empaque)
    if (!p.lotes) {
      p.lotes = [{
        id: genId(),
        cantidad: p.stock || 0,
        empaqueId: 'unidad_base',
        vencimiento: p.vencimiento || '',
        fechaIngreso: p.fechaRegistro || new Date().toISOString().slice(0, 10),
        costo: p.costo || 0,
        nota: 'Lote original migrado'
      }];
      migrados = true;
    } else {
      p.lotes.forEach(l => {
        if (!l.empaqueId) l.empaqueId = 'unidad_base';
        if (!l.id) l.id = genId();
        if (!l.fechaIngreso) l.fechaIngreso = p.fechaRegistro || new Date().toISOString().slice(0, 10);
      });
    }

    // Precios nuevos
    if (typeof p.precioVentaUnidad !== 'number') p.precioVentaUnidad = p.venta || 0;
    if (typeof p.precioVentaPaquete !== 'number') p.precioVentaPaquete = 0;
    if (!p.venta) p.venta = p.precioVentaUnidad;

    // Ofertas
    if (typeof p.enOfertaManual !== 'boolean') p.enOfertaManual = p.enOferta || false;
    if (typeof p.precioOfertaUnidad !== 'number') p.precioOfertaUnidad = p.precioOferta || 0;
    if (typeof p.precioOfertaPaquete !== 'number') p.precioOfertaPaquete = 0;
    if (!p.fechaFinOferta) p.fechaFinOferta = '';
    if (!p.ofertaLote || typeof p.ofertaLote !== 'object') {
      p.ofertaLote = { activa: true, dias: 14, descuento: 10 };
    }

    // Sincronizar stock total
    p.stock = getTotalUnidadesBase(p);
    p.vencimiento = getVencimientoMasCercano(p);
    p.costo = getCostoPromedio(p);
  });
  if (migrados) {
    save();
    console.log('Migración a lotes con paquetes completada.');
  }
}

function save() {
  localStorage.setItem('tiaeli_v2', JSON.stringify(productos));
  window.productos = productos;
  
}

window.productos = productos;
migrarProductosALotes();

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
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ── NAVIGATION ──
function navegarA(sectionId) {
  const currentSec = document.querySelector('.section.active');
  const sec = document.getElementById('section-' + sectionId);
  const nav = document.getElementById('nav-' + sectionId);
  
  if (currentSec && currentSec !== sec) {
    currentSec.classList.remove('active');
    currentSec.classList.add('exiting');
    setTimeout(() => {
      currentSec.classList.remove('exiting');
      if (sec) sec.classList.add('active');
    }, 200); // Wait for exit animation
  } else {
    if (sec) sec.classList.add('active');
  }

  // Toggle posFloatingElements visibility
  const posFloating = document.getElementById('posFloatingElements');
  if (posFloating) {
    if (sectionId === 'pos') {
      posFloating.style.display = 'block';
    } else {
      posFloating.style.display = 'none';
      // Also close the cart if navigating away
      const cartContainer = document.getElementById('posCartContainer');
      if (cartContainer) cartContainer.classList.remove('open');
    }
 
 
  }

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (nav) nav.classList.add('active');
  
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
  window.scrollTo({top: 0, behavior: 'smooth'});
}
window.navegarA = navegarA;

document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', e => {
    e.preventDefault();
    const sec = n.dataset.section;
    
    // 1. RENDER DATA FIRST (before navigation)
    if (sec === 'dashboard') { renderDashboard(); if(window.renderAllCharts) renderAllCharts(); if(window.renderCategoryGrid) renderCategoryGrid(); }
    if (sec === 'inventario') { renderTabla(); }
    if (sec === 'ventas') { if(typeof poblarSelectProductos==='function') poblarSelectProductos(); if(typeof renderVentasStats==='function') renderVentasStats(); if(typeof renderVentasHoy==='function') renderVentasHoy(); if(typeof renderCombosVenta==='function') renderCombosVenta(); }
    if (sec === 'pos') { if(typeof window.initPOS==='function') window.initPOS(); else { if(typeof renderPOSProducts==='function') renderPOSProducts(); if(typeof renderCombosVenta==='function') renderCombosVenta(); } if(typeof renderVentasHoy==='function') renderVentasHoy(); }
    if (sec === 'historial') { if(typeof renderHistorial==='function') renderHistorial(); }
    if (sec === 'analytics') { if(window.renderAnalyticsCharts) renderAnalyticsCharts(); }
    if (sec === 'combos') { if(window.renderCombosManager) renderCombosManager(); }
    if (sec === 'vencimientos') renderVencimientos(7);
    if (sec === 'agregar') { resetProductForm(); }
    if (sec === 'fiados') { if(typeof renderFiados==='function') renderFiados(); }
    if (sec === 'actividad') { if(typeof renderActividad==='function') renderActividad(); }
    
    // 2. NAVIGATE AFTER (single call, no setTimeout)
    navegarA(sec);
  });
});

document.getElementById('menuToggle').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('active'); });
document.getElementById('overlay').addEventListener('click', () => { document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('active'); });

// ── DASHBOARD ──
function renderDashboard() {
  const now = new Date();
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const venceIn30 = new Date(); venceIn30.setDate(venceIn30.getDate() + 30);

  const total = productos.length;
  const enStock = productos.filter(p => p.stock > 0).length;
  const bajo = productos.filter(p => p.stock > 0 && p.stock <= (p.stockMinUnidades || p.stockMin || 24)).length;
  const valor = productos.reduce((s, p) => s + (p.lotes||[]).reduce((s2,l)=>s2+(l.cantidad*(l.costo||0)),0), 0);
  const ventasHoy = (window.ventas || []).filter(v => new Date(v.fecha) >= hoy).reduce((s,v)=>s+v.total,0);

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
    if (window.odoHtml) {
      el.innerHTML = window.odoHtml(val, dec?'money':'int', pre, suf);
    } else {
      el.textContent = (pre||'') + (dec?val.toFixed(dec):val) + (suf||'');
    }
  };
  anim('stat-total', total, '', '', 0);
  anim('stat-stock', enStock, '', '', 0);
  anim('stat-bajo', bajo, '', '', 0);
  anim('stat-vence', lotesVenc, '', '', 0);
  anim('stat-valor', valor, 'Bs.', '', 0);
  anim('stat-ventas-hoy', ventasHoy, 'Bs.', '', 0);
  anim('stat-fiados', fiadosPendiente, 'Bs.', '', 2);
  if (window.initOdometers) window.initOdometers();
  if (window.playTitleAnimation) window.playTitleAnimation();

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

function filterAndRender() {
  const q = (document.getElementById('searchInput').value || '').toLowerCase();
  const cat = document.getElementById('filterCategoria').value;
  const est = document.getElementById('filterEstado').value;
  const now = new Date(); const soon = new Date(Date.now() + 30*86400000);

  let list = [...productos];
  if (q) list = list.filter(p => p.nombre.toLowerCase().includes(q) || (p.marca||'').toLowerCase().includes(q));
  if (cat) list = list.filter(p => p.categoria === cat);
  if (est === 'ok') list = list.filter(p => p.stock > p.stockMin);
  else if (est === 'bajo') list = list.filter(p => p.stock > 0 && p.stock <= p.stockMin);
  else if (est === 'agotado') list = list.filter(p => p.stock === 0);
  else if (est === 'vence-pronto') list = list.filter(p => p.vencimiento && new Date(p.vencimiento) <= soon && new Date(p.vencimiento) >= now);
  renderTabla(list);
}
window.filterAndRender = filterAndRender;

document.getElementById('searchInput').addEventListener('input', filterAndRender);
document.getElementById('filterCategoria').addEventListener('change', filterAndRender);
document.getElementById('filterEstado').addEventListener('change', filterAndRender);

// ── RENDER TABLE ──
function toggleLotesRow(id) {
  const row = document.getElementById('lotes-row-' + id);
  const btn = document.getElementById('btn-expand-' + id);
  const wrapper = row ? row.querySelector('.lote-row-wrapper') : null;
  const inner   = row ? row.querySelector('.lote-row-inner')   : null;
  if (!row || !wrapper || !inner) return;

  const isOpen = row.classList.contains('open');

  if (isOpen) {
    // ── CLOSING ──
    // Snapshot current height, then animate to 0
    wrapper.style.height = wrapper.scrollHeight + 'px';
    // Fade out lote rows in reverse stagger
    const loteRows = inner.querySelectorAll('tbody tr');
    loteRows.forEach((tr, i) => {
      tr.style.transition = `opacity 0.15s ease ${(loteRows.length - 1 - i) * 0.04}s, transform 0.15s ease ${(loteRows.length - 1 - i) * 0.04}s`;
      tr.style.opacity = '0';
      tr.style.transform = 'translateX(-8px)';
    });
    requestAnimationFrame(() => {
      wrapper.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease';
      wrapper.style.height = '0';
      wrapper.style.opacity = '0';
    });
    row.classList.remove('open');
    if (btn) { btn.classList.remove('open'); }
  } else {
    // ── OPENING ──
    row.classList.add('open');
    if (btn) btn.classList.add('open');
    // Reset inner rows to invisible before measuring
    const loteRows = inner.querySelectorAll('tbody tr');
    loteRows.forEach(tr => {
      tr.style.transition = 'none';
      tr.style.opacity = '0';
      tr.style.transform = 'translateX(-12px)';
    });
    // Measure real height
    wrapper.style.transition = 'none';
    wrapper.style.height = 'auto';
    wrapper.style.opacity = '0';
    const targetH = wrapper.scrollHeight + 'px';
    wrapper.style.height = '0';
    // Trigger animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wrapper.style.transition = 'height 0.35s cubic-bezier(0.2, 0.65, 0.3, 0.9), opacity 0.25s ease';
        wrapper.style.height = targetH;
        wrapper.style.opacity = '1';
        // Stagger each lote row in
        loteRows.forEach((tr, i) => {
          tr.style.transition = `opacity 0.25s ease ${0.08 + i * 0.06}s, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.08 + i * 0.06}s`;
          tr.style.opacity = '1';
          tr.style.transform = 'translateX(0)';
        });
        // After animation ends, clear fixed height so it adapts to content
        setTimeout(() => { wrapper.style.height = 'auto'; }, 400);
      });
    });
  }
}
window.toggleLotesRow = toggleLotesRow;

// Devuelve texto tipo "8 Paq. + 5 u." para un producto
function formatStockDisplay(p) {
  if (!p) return '0 u.';
  if (!p.lotes || !p.lotes.length) return safeNum(p.stock) + ' u.';
  const empaques = safeArr(p.empaques);
  // Agrupar por empaque
  const porEmpaque = {};
  p.lotes.forEach(l => {
    if (!l || safeNum(l.cantidad) <= 0) return;
    const id = l.empaqueId || 'unidad_base';
    porEmpaque[id] = (porEmpaque[id] || 0) + safeNum(l.cantidad);
  });
  const partes = [];
  empaques.forEach(e => {
    if (porEmpaque[e.id] > 0) partes.push(porEmpaque[e.id] + ' Paq.');
  });
  if (porEmpaque['unidad_base'] > 0) partes.push(porEmpaque['unidad_base'] + ' u.');
  // Si no hay empaques definidos pero hay stock en lotes viejos sin empaqueId
  const totalUnidades = getTotalUnidadesBase(p);
  if (!partes.length && totalUnidades > 0) partes.push(totalUnidades + ' u.');
  return partes.length ? partes.join(' + ') : (totalUnidades > 0 ? totalUnidades + ' u.' : '0 u.');
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

function renderTabla(list) {
  list = list || productos;
  const tbody = document.getElementById('invTableBody');
  const mobileCards = document.getElementById('mobileCards');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="es-icon">📦</span><p>No se encontraron productos.</p><button class="btn btn-primary" onclick="navegarA(\'agregar\')">+ Agregar primero</button></div></td></tr>'; if (mobileCards) mobileCards.innerHTML = ''; return; }
  const now = new Date();

  let mobileHtml = [];
  tbody.innerHTML = list.map((p, i) => {
    const pv = getPrecioVentaEfectivo(p);
    const costoProm = getCostoPromedio(p);
    const gan = pv - costoProm;
    const stockUnidades = getTotalUnidadesBase(p);
    const stockMin = safeNum(p.stockMinUnidades) || safeNum(p.stockMin) || 24;
    const enOferta = getProductoEnOferta(p);
    let estadoBadge = stockUnidades === 0 ? '<span class="badge badge-agotado">Agotado</span>' : stockUnidades <= stockMin ? '<span class="badge badge-bajo">Stock bajo</span>' : '<span class="badge badge-ok">OK</span>';
    if (enOferta) estadoBadge += ' <span class="badge badge-oferta">OFERTA</span>';

    let vencBadge = '—';
    if (p.vencimiento) {
      const vd = new Date(p.vencimiento); const dias = Math.ceil((vd - now) / 86400000);
      vencBadge = dias < 0 ? `<span style="color:var(--red);font-weight:700">VENCIDO</span>` : dias <= 7 ? `<span style="color:var(--red)">${dias}d</span>` : dias <= 30 ? `<span style="color:var(--orange)">${dias}d</span>` : `<span style="color:var(--text3)">${vd.toLocaleDateString('es-BO')}</span>`;
    }
    const foto = p.foto ? `<div class="prod-photo"><img src="${p.foto}" /></div>` : `<div class="prod-photo">${CATS[p.categoria]||'·'}</div>`;
    const expandBtn = p.lotes && p.lotes.length > 0 ? `<button class="btn-expand" id="btn-expand-${p.id}" onclick="toggleLotesRow('${p.id}')">▶</button>` : '';

    const lotesHtml = p.lotes ? p.lotes.map((l, i) => {
      const v = l.vencimiento ? new Date(l.vencimiento) : null;
      const d = v ? Math.ceil((v-now)/86400000) : null;
      const empaqueNombre = getNombreEmpaque(p, l.empaqueId || 'unidad_base');
      const bdg = l.cantidad===0?'<span class="lote-badge lote-agotado">Agotado</span>':
                  (d===null?'<span class="lote-badge lote-vigente">S/Venc</span>':
                  d<0?'<span class="lote-badge lote-rojo">Vencido</span>':
                  d<=15?'<span class="lote-badge lote-naranja">Pronto</span>':
                  d<=30?'<span class="lote-badge lote-amarillo">30d</span>':
                  '<span class="lote-badge lote-vigente">Vigente</span>');
      const ofertaTag = l.enOfertaPorVencimiento && safeNum(l.cantidad) > 0 ? ' <span class="lote-badge lote-oferta">OFERTA VENC.</span>' : '';
      return `<tr><td>Lote ${i+1}</td><td><b>${l.cantidad} ${empaqueNombre === 'Unidad' ? 'u.' : empaqueNombre}</b></td><td>Bs.${safeNum(l.costo).toFixed(2)}</td><td>${l.vencimiento||'—'}</td><td>${l.fechaIngreso||'—'}</td><td>${bdg}${ofertaTag}</td></tr>`;
    }).join('') : '';

    const lotesActivos = p.lotes ? p.lotes.filter(l => l.cantidad > 0).length : 0;
    const countText = lotesActivos === 1 ? '1 lote' : lotesActivos + ' lotes';
    const stockDisplay = formatStockDisplay(p);
    
    const mobileLotesHtml = p.lotes && p.lotes.length > 0 ? `
      <div class="mobile-lotes" id="mob-lotes-${p.id}" style="display:none; margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
        <div style="font-size:0.75rem; color:var(--text3); margin-bottom:4px;">Detalle de lotes:</div>
        ${p.lotes.map((l, idx) => `
          <div style="background:var(--bg3); padding:6px 8px; border-radius:4px; margin-bottom:4px; font-size:0.75rem; display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            <div>Cant: <b>${l.cantidad} ${getNombreEmpaque(p, l.empaqueId || 'unidad_base')}</b></div>
            <div>Vence: <b>${l.vencimiento||'-'}</b></div>
            <div>Costo: Bs.${safeNum(l.costo).toFixed(2)}</div>
            <div>Ingreso: ${l.fechaIngreso||'-'}</div>
          </div>
        `).join('')}
      </div>` : '';

    mobileHtml.push(`
      <div class="mobile-card" style="animation-delay:${Math.min(i*30, 600)}ms">
        <div class="mobile-card-header">
          <div style="display:flex; align-items:center; gap:8px;">
            ${foto}
            <div>
              <div class="mobile-card-name">${p.nombre}</div>
              <div class="product-meta">${(p.marca || '')}${p.marca ? ' / ' : ''}${countText}</div>
            </div>
          </div>
          ${estadoBadge}
        </div>
        <div class="mobile-card-body" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="mobile-card-field"><span>Stock</span><span><b style="${stockUnidades===0?'color:var(--red)':stockUnidades<=stockMin?'color:var(--orange)':''}">${stockDisplay}</b></span></div>
          <div class="mobile-card-field"><span>Venta</span><span><b>Bs.${pv.toFixed(2)}</b></span></div>
          <div class="mobile-card-field"><span>Ganancia</span><span class="${gan>=0?'pos':'neg'}">Bs.${gan.toFixed(2)}</span></div>
          <div class="mobile-card-field"><span>Vence</span><span>${vencBadge}</span></div>
        </div>
        ${mobileLotesHtml}
        <div class="mobile-card-actions" style="display:flex; gap:6px; margin-top:12px; align-items:center; flex-wrap:wrap;">
          ${p.lotes && p.lotes.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="document.getElementById('mob-lotes-${p.id}').style.display = document.getElementById('mob-lotes-${p.id}').style.display === 'none' ? 'block' : 'none'"><i data-lucide="layers"></i> Lotes</button>` : ''}
          <button class="btn-icon entrada" onclick="abrirEntrada('${p.id}')" title="Registrar Entrada (+ Stock)"><i data-lucide="package-plus"></i></button>
          <button class="btn-icon salida" onclick="abrirSalida('${p.id}')" title="Registrar Salida (- Stock)"><i data-lucide="package-minus"></i></button>
          <button class="btn-icon" onclick="editarProducto('${p.id}')" title="Editar producto"><i data-lucide="pencil"></i></button>
          <button class="btn-icon warn" onclick="abrirOferta('${p.id}')" title="Poner en oferta"><i data-lucide="star"></i></button>
          <button class="btn-icon danger" onclick="eliminarProducto('${p.id}')" title="Eliminar producto"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `);

    return `<tr class="row-new inventory-row" style="animation-delay:${Math.min(i*30, 600)}ms">
      <td>${expandBtn}</td>
      <td>
        <div class="product-cell">
          ${foto}
          <div class="product-info">
            <span class="prod-name">${p.nombre}</span>
            <span class="product-meta">${(p.marca || '')}${p.marca ? ' / ' : ''}${countText}</span>
          </div>
        </div>
      </td>
      <td><span class="cat-badge">${p.categoria}</span></td>
      <td><span class="value-animated" id="val-stock-${p.id}"><b style="${stockUnidades===0?'color:var(--red)':stockUnidades<=stockMin?'color:var(--orange)':''}">${window.odoHtml?window.odoHtml(stockUnidades):stockUnidades}</b></span> <span style="color:var(--text3);font-size:.75rem">${stockDisplay}</span></td>
      <td class="price-cost"><span class="value-animated" id="val-cost-${p.id}">${costoProm>0?'Bs.'+costoProm.toFixed(2):'—'}</span></td>
      <td class="price-venta"><span class="value-animated" id="val-venta-${p.id}">Bs.${pv.toFixed(2)}</span></td>
      <td class="price-ganancia ${gan>=0?'pos':'neg'}"><span class="value-animated" id="val-gan-${p.id}">${costoProm>0?'Bs.'+gan.toFixed(2):'—'}</span></td>
      <td>${vencBadge}</td>
      <td><span class="value-animated" id="val-est-${p.id}">${estadoBadge}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon entrada" onclick="abrirEntrada('${p.id}')" title="Registrar Entrada (+ Stock)"><i data-lucide="package-plus"></i></button>
        <button class="btn-icon salida" onclick="abrirSalida('${p.id}')" title="Registrar Salida (- Stock)"><i data-lucide="package-minus"></i></button>
        <button class="btn-icon" onclick="editarProducto('${p.id}')" title="Editar producto"><i data-lucide="pencil"></i></button>
        <button class="btn-icon warn" onclick="abrirOferta('${p.id}')" title="Poner en oferta"><i data-lucide="star"></i></button>
        <button class="btn-icon danger" onclick="eliminarProducto('${p.id}')" title="Eliminar producto"><i data-lucide="trash-2"></i></button>
      </div></td>
    </tr>
    <tr class="lote-row" id="lotes-row-${p.id}">
      <td colspan="10" class="lote-container">
        <div class="lote-row-wrapper">
          <div class="lote-row-inner">
            <table class="lote-table">
              <thead><tr><th>Lote</th><th>Stock</th><th>Costo</th><th>Vencimiento</th><th>F. Ingreso</th><th>Estado</th></tr></thead>
              <tbody>${lotesHtml}</tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  if (window.initOdometers) window.initOdometers();
  if (mobileCards) {
    mobileCards.innerHTML = mobileHtml.join('');
  }
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

// ── WIZARD PRODUCTO (3 PASOS) ──
let wizardPaquetes = [];

function actualizarWizardStep(step) {
  document.querySelectorAll('.wizard-pane').forEach((pane, i) => { pane.style.display = (i + 1 === step) ? 'block' : 'none'; });
  document.querySelectorAll('.wizard-step').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.step) === step));
  const prevBtn = document.getElementById('wizardPrev');
  const nextBtn = document.getElementById('wizardNext');
  const submitBtn = document.getElementById('wizardSubmit');
  if (prevBtn) prevBtn.style.display = step === 1 ? 'none' : 'inline-block';
  if (nextBtn) nextBtn.style.display = step === 3 ? 'none' : 'inline-block';
  if (submitBtn) submitBtn.style.display = step === 3 ? 'inline-block' : 'none';
  const sub = document.getElementById('formSubtitle');
  if (sub) sub.textContent = 'Paso ' + step + ' de 3: ' + (step === 1 ? 'Identidad del producto' : step === 2 ? 'Paquetes (conversiones)' : 'Precios sugeridos');
  const btnTxt = document.getElementById('wizardSubmit');
  if (btnTxt) btnTxt.textContent = document.getElementById('editId').value ? 'Guardar cambios' : '✅ Crear producto';
}

window.wizardNextStep = function() {
  const step = parseInt(document.getElementById('wizardStep').value || '1');
  if (step === 1) {
    if (!document.getElementById('fNombre').value.trim()) { toast('El nombre del producto es obligatorio', 'error'); return; }
    if (!document.getElementById('fCategoria').value) { toast('Selecciona una categoría', 'error'); return; }
    if (!document.getElementById('fUnidadBase').value) { toast('Selecciona la unidad base', 'error'); return; }
  }
  if (step === 2 && wizardPaquetes.length === 0) {
    if (!confirm('No definiste ningún paquete. ¿Continuar vendiendo solo unidades sueltas?')) return;
  }
  if (step < 3) { document.getElementById('wizardStep').value = String(step + 1); actualizarWizardStep(step + 1); calcMargenPreview(); }
};

window.wizardPrevStep = function() {
  const step = parseInt(document.getElementById('wizardStep').value || '1');
  if (step > 1) { document.getElementById('wizardStep').value = String(step - 1); actualizarWizardStep(step - 1); }
};

function renderPaquetesUI() {
  const list = document.getElementById('paquetesList');
  if (list) {
    list.innerHTML = wizardPaquetes.length === 0
      ? '<p style="font-size:0.8rem;color:var(--text3)">Sin paquetes aún — el producto se venderá solo en unidades sueltas.</p>'
      : wizardPaquetes.map((paq, i) => `
          <div class="paquete-chip">
            <div class="paquete-chip-info">
              <strong>${escHTML(paq.nombre)}</strong>
              <span>${paq.unidades} unidades por paquete${paq.predeterminado ? ' · <b style="color:var(--primary)">Predeterminado</b>' : ''}</span>
            </div>
            <div class="paquete-chip-actions">
              <button type="button" class="btn btn-secondary btn-sm" onclick="togglePaqueteDefault(${i})">${paq.predeterminado ? 'Quitar default' : 'Hacer default'}</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="editarPaqueteWizard(${i})">✏️</button>
              <button type="button" class="btn btn-danger btn-sm" onclick="eliminarPaqueteWizard(${i})">✕</button>
            </div>
          </div>`).join('');
  }
  const preview = document.getElementById('paquetesPreview');
  if (preview) {
    preview.innerHTML = wizardPaquetes.length
      ? '<div class="margen-preview" style="display:block;padding:10px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)"><div class="margen-item"><span>Paquetes:</span><span>' + wizardPaquetes.map(q => `${escHTML(q.nombre)} (${q.unidades} u)`).join(' · ') + '</span></div></div>'
      : '';
  }
}

window.guardarPaquete = function() {
  const nombre = document.getElementById('paqueteNombre').value.trim();
  const unidades = parseInt(document.getElementById('paqueteUnidades').value || '0');
  const predeterminado = document.getElementById('paquetePredeterminado').checked;
  if (!nombre || unidades < 2) { toast('Nombre y unidades (mínimo 2) son obligatorios', 'error'); return; }
  if (wizardPaquetes.some(q => q.nombre.toLowerCase() === nombre.toLowerCase())) { toast('Ese paquete ya existe', 'error'); return; }
  const idxEdit = document.getElementById('editPaqueteIdx').value;
  if (idxEdit !== '') {
    const paq = wizardPaquetes[parseInt(idxEdit)];
    if (paq) { paq.nombre = nombre; paq.unidades = unidades; paq.predeterminado = predeterminado; }
    document.getElementById('editPaqueteIdx').value = '';
    toast('Paquete actualizado', 'success');
  } else {
    wizardPaquetes.push({ id: genId(), nombre, unidades, predeterminado });
    if (predeterminado) wizardPaquetes.forEach((q, j) => { if (j < wizardPaquetes.length - 1) q.predeterminado = false; });
    toast('Paquete agregado', 'success');
  }
  cancelarPaquete();
  renderPaquetesUI();
};

window.cancelarPaquete = function() {
  const n = document.getElementById('paqueteNombre'); if (n) n.value = '';
  const u = document.getElementById('paqueteUnidades'); if (u) u.value = '';
  const c = document.getElementById('paquetePredeterminado'); if (c) c.checked = false;
  const e = document.getElementById('editPaqueteIdx'); if (e) e.value = '';
};

window.editarPaqueteWizard = function(i) {
  const paq = wizardPaquetes[i]; if (!paq) return;
  document.getElementById('editPaqueteIdx').value = i;
  document.getElementById('paqueteNombre').value = paq.nombre;
  document.getElementById('paqueteUnidades').value = paq.unidades;
  document.getElementById('paquetePredeterminado').checked = paq.predeterminado;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.eliminarPaqueteWizard = function(i) {
  if (!confirm('¿Eliminar este paquete?')) return;
  wizardPaquetes.splice(i, 1);
  renderPaquetesUI();
};

window.togglePaqueteDefault = function(i) {
  wizardPaquetes.forEach((q, j) => { q.predeterminado = j === i; });
  renderPaquetesUI();
};

function calcMargenPreview() {
  const wrap = document.getElementById('margenPreview');
  if (!wrap) return;
  const precioUnidad = parseFloat(document.getElementById('fPrecioUnidad').value) || 0;
  const editId = document.getElementById('editId').value;
  const p = editId ? (window.productos || []).find(x => x.id === editId) : null;
  const costo = p ? getCostoPromedio(p) : 0;
  if (!precioUnidad || costo <= 0) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const gan = precioUnidad - costo;
  document.getElementById('prevGanancia').textContent = 'Bs. ' + gan.toFixed(2);
  document.getElementById('prevMargen').textContent = Math.round((gan / precioUnidad) * 100) + '%';
}

function resetProductForm() {
  const form = document.getElementById('productForm');
  if (form) form.reset();
  const editId = document.getElementById('editId');
  if (editId) editId.value = '';
  const step = document.getElementById('wizardStep');
  if (step) step.value = '1';
  wizardPaquetes = [];
  renderPaquetesUI();
  cancelarPaquete();
  actualizarWizardStep(1);
  const title = document.getElementById('formTitle');
  if (title) title.textContent = '+ Agregar Producto';
  const hpWrap = document.getElementById('historialPreciosBtnWrap');
  if (hpWrap) hpWrap.innerHTML = '';
  if (window.resetPhoto) resetPhoto();
}
window.resetProductForm = resetProductForm;

document.getElementById('btnNuevoProducto').addEventListener('click', () => { resetProductForm(); navegarA('agregar'); });
document.getElementById('btnCancelForm').addEventListener('click', () => navegarA('inventario'));
document.getElementById('fPrecioUnidad').addEventListener('input', calcMargenPreview);

// UNIFICAR MODAL LOGIC (mantener compatibilidad)
let tempProductData = null;
let existingProductMatch = null;

document.getElementById('productForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const nombre = document.getElementById('fNombre').value.trim();
  const categoria = document.getElementById('fCategoria').value;
  const unidadBase = document.getElementById('fUnidadBase').value;
  if (!nombre || !categoria || !unidadBase) { toast('Completa los campos obligatorios del Paso 1', 'error'); return; }
  const precioUnidad = parseFloat(document.getElementById('fPrecioUnidad').value) || 0;
  if (precioUnidad <= 0) { toast('El precio por unidad es obligatorio (Paso 3)', 'error'); return; }
  const precioPaquete = parseFloat(document.getElementById('fPrecioPaquete').value) || 0;
  const stockMin = parseInt(document.getElementById('fStockMin').value) || 24;
  if (wizardPaquetes.length && precioPaquete <= 0) { toast('Definiste paquetes: el precio por paquete es obligatorio (Paso 3)', 'error'); return; }

  const empaques = wizardPaquetes.map((q, i) => ({
    id: 'paq_' + i,
    nombre: q.nombre,
    unidades: q.unidades,
    predeterminado: q.predeterminado
  }));
  if (empaques.length && !empaques.some(q => q.predeterminado)) empaques[0].predeterminado = true;

  const data = {
    nombre,
    categoria,
    marca: document.getElementById('fMarca').value.trim(),
    unidadBase,
    unidad: unidadBase,
    mlPorUnidad: safeNum(document.getElementById('fMlPorUnidad').value) || null,
    stockMinUnidades: stockMin,
    stockMin,
    empaques,
    precioVentaUnidad: precioUnidad,
    venta: precioUnidad,
    precioVentaPaquete: precioPaquete || 0,
    nota: document.getElementById('fNota').value.trim(),
    lotes: id ? undefined : [],
    stock: 0,
    costo: 0,
    vencimiento: null
  };
  if (id && (data.lotes === undefined)) delete data.lotes;
  if (window.currentPhotoBase64) data.foto = window.currentPhotoBase64;

  if (!id) {
    const match = productos.find(p => p.nombre.toLowerCase() === nombre.toLowerCase() && p.categoria === categoria && (p.marca || '').toLowerCase() === (data.marca || '').toLowerCase());
    if (match) {
      if (!confirm('Ya existe "' + match.nombre + '" en el inventario. ¿Crear de todos modos como producto duplicado?')) return;
    }
  }

  guardarProductoFinal(id, data);
});

function guardarProductoFinal(id, data) {
  const btn = document.getElementById('btnSpinner');
  if (btn) btn.style.display = 'inline-block';
  if (id) {
    const idx = productos.findIndex(p => p.id === id);
    if (idx > -1) {
      const antes = JSON.parse(JSON.stringify(productos[idx]));
      const antiguoVenta = safeNum(antes.venta);
      const antiguoPaquete = safeNum(antes.precioVentaPaquete);
      const nuevo = { ...productos[idx], ...data };
      if (!data.foto && productos[idx].foto) nuevo.foto = productos[idx].foto;
      if (antiguoVenta !== safeNum(nuevo.venta) || antiguoPaquete !== safeNum(nuevo.precioVentaPaquete)) {
        registrarHistorialPrecio(productos[idx], 'edicion', 'Precio unidad: Bs.' + antiguoVenta.toFixed(2) + ' → Bs.' + safeNum(nuevo.venta).toFixed(2) + (antiguoPaquete !== safeNum(nuevo.precioVentaPaquete) ? ' · Paquete: Bs.' + antiguoPaquete.toFixed(2) + ' → Bs.' + safeNum(nuevo.precioVentaPaquete).toFixed(2) : ''));
      }
      productos[idx] = nuevo;
    }
    toast('Producto actualizado', 'success');
  } else {
    const nuevo = { ...data, id: genId(), enOfertaManual: false, enOferta: false, precioOferta: 0, precioOfertaUnidad: 0, precioOfertaPaquete: 0, fechaFinOferta: '', ofertaLote: { activa: false, dias: 14, descuento: 10 }, fechaRegistro: new Date().toISOString(), foto: data.foto || '' };
    productos.unshift(nuevo);
    toast('Producto agregado', 'success');
  }
  save();
  if (btn) btn.style.display = 'none';
  renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
  navegarA('inventario'); filterAndRender();
  if (window.syncSaveProducto) { const p = id ? productos.find(x => x.id === id) : productos[0]; if (p) window.syncSaveProducto(p); }
}

document.getElementById('unificarCancelBtn')?.addEventListener('click', () => {
  document.getElementById('unificarOverlay').style.display = 'none';
  guardarProductoFinal(null, tempProductData);
});
document.getElementById('unificarConfirmBtn')?.addEventListener('click', () => {
  document.getElementById('unificarOverlay').style.display = 'none';
  if (existingProductMatch && tempProductData) {
    const newLotes = JSON.parse(JSON.stringify(tempProductData.lotes));
    existingProductMatch.lotes = [...(existingProductMatch.lotes || []), ...newLotes];
    existingProductMatch.stock = getStockTotal(existingProductMatch);
    existingProductMatch.vencimiento = getVencimientoMasCercano(existingProductMatch);
    existingProductMatch.costo = getCostoPromedio(existingProductMatch);
    existingProductMatch.updatedAt = Date.now();
    save(); toast('Lotes agregados al producto existente', 'success');
    renderDashboard(); navegarA('inventario'); filterAndRender();
    if (window.syncSaveProducto) window.syncSaveProducto(existingProductMatch);
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
  document.getElementById('hpProductoInfo').textContent = 'Unidad: Bs.' + safeNum(p.precioVentaUnidad || p.venta).toFixed(2) + (safeNum(p.precioVentaPaquete) > 0 ? ' · Paquete: Bs.' + safeNum(p.precioVentaPaquete).toFixed(2) : '');
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

// ── EDIT ──
function editarProducto(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  resetProductForm();
  document.getElementById('editId').value = id;
  document.getElementById('fNombre').value = p.nombre;
  document.getElementById('fCategoria').value = p.categoria;
  document.getElementById('fUnidadBase').value = p.unidadBase || p.unidad || 'unidad';
  document.getElementById('fMlPorUnidad').value = p.mlPorUnidad || '';
  document.getElementById('fStockMin').value = p.stockMinUnidades || p.stockMin || 24;
  document.getElementById('fMarca').value = p.marca || '';
  document.getElementById('fNota').value = p.nota || '';
  document.getElementById('fPrecioUnidad').value = p.precioVentaUnidad || p.venta || 0;
  document.getElementById('fPrecioPaquete').value = p.precioVentaPaquete || 0;
  document.getElementById('formTitle').textContent = 'Editar: ' + p.nombre;
  wizardPaquetes = safeArr(p.empaques).map((q, i) => ({ id: q.id, nombre: q.nombre, unidades: q.unidades, predeterminado: q.predeterminado }));
  renderPaquetesUI();
  const hpWrap = document.getElementById('historialPreciosBtnWrap');
  if (hpWrap) hpWrap.innerHTML = '<button type="button" class="btn btn-secondary btn-sm" onclick="abrirHistorialPrecios(\'' + p.id + '\')">💰 Historial de precios</button>';
  if (p.foto) { window.currentPhotoBase64 = p.foto; const prev = document.getElementById('photoPreview'); if (prev) prev.innerHTML = `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:7px" /><input type="file" id="fFoto" accept="image/*" onchange="handlePhotoUpload(this)" style="position:absolute;inset:0;opacity:0;cursor:pointer" />`; }
  else { window.currentPhotoBase64 = null; if (window.resetPhoto) resetPhoto(); }
  navegarA('agregar'); window.scrollTo(0, 0);
}
window.editarProducto = editarProducto;

// ── DELETE ──
function eliminarProducto(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  if (!confirm('¿Eliminar "' + p.nombre + '"? Esta acción no se puede deshacer.')) return;
  productos = productos.filter(x => x.id !== id);
  window.productos = productos;
  save();
  if (window.syncDeleteProducto) window.syncDeleteProducto(id);
  filterAndRender(); renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
  toast('Producto eliminado','warning');
}
window.eliminarProducto = eliminarProducto;

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
document.getElementById('ofertaCancelBtn')?.addEventListener('click', () => { document.getElementById('ofertaOverlay').style.display = 'none'; });
document.getElementById('ofertaOverlay')?.addEventListener('click', function(e) { if (e.target === this) this.style.display = 'none'; });
document.getElementById('ofertaConfirmBtn')?.addEventListener('click', () => {
  const p = productos.find(x => x.id === ofertaCurrentId);
  if (!p) return;
  const precioU = parseFloat(document.getElementById('ofertaPrecioUnidad').value) || 0;
  const precioP = parseFloat(document.getElementById('ofertaPrecioPaquete').value) || 0;
  const fechaFin = document.getElementById('ofertaFechaFin').value || '';
  if (precioU <= 0 && precioP <= 0) {
    p.enOfertaManual = false; p.enOferta = false; p.precioOfertaUnidad = 0; p.precioOfertaPaquete = 0; p.precioOferta = 0; p.fechaFinOferta = '';
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
let activeVencDias = 7;
function renderVencimientos(dias) {
  activeVencDias = dias;
  document.querySelectorAll('.vtab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.dias)===dias||t.dataset.dias==='9999'&&dias===9999));
  const now = new Date(); const limit = new Date(Date.now() + dias*86400000);
  
  let listLotes = [];
  productos.forEach(p => {
    (p.lotes||[]).forEach((l, i) => {
      if (l.cantidad > 0 && l.vencimiento) {
        const vd = new Date(l.vencimiento);
        listLotes.push({ p, l, i, vd, diasRestantes: Math.ceil((vd-now)/86400000) });
      }
    });
  });

  listLotes = listLotes.filter(x => dias===9999 ? true : x.vd <= limit).sort((a,b) => a.vd - b.vd);
  
  const cont = document.getElementById('vencimientoList');
  if (!listLotes.length) { cont.innerHTML='<div class="empty-state"><span class="es-icon">✓</span><p>No hay lotes próximos a vencer en este rango.</p></div>'; return; }
  
  cont.innerHTML = listLotes.map(x => {
    const cls = x.diasRestantes < 0 ? 'critico' : x.diasRestantes <= 7 ? 'critico' : x.diasRestantes <= 15 ? 'alerta' : '';
    const diaTag = x.diasRestantes < 0 ? '<span class="venc-dias dias-rojo">VENCIDO</span>' :
      x.diasRestantes <= 7 ? `<span class="venc-dias dias-rojo">${x.diasRestantes}d</span>` :
      x.diasRestantes <= 15 ? `<span class="venc-dias dias-naranja">${x.diasRestantes}d</span>` :
      `<span class="venc-dias dias-amarillo">${x.diasRestantes}d</span>`;
    return `<div class="venc-card ${cls}">
      <div class="venc-emoji">${x.diasRestantes<0?'🚫':x.diasRestantes<=7?'⚠️':'📅'}</div>
      <div class="venc-info">
        <div class="venc-name">${x.p.nombre} (Lote ${x.i+1})</div>
        <div class="venc-meta"><span>Vence: ${new Date(x.l.vencimiento).toLocaleDateString('es-BO')}</span><span>Stock: ${x.l.cantidad} ${getNombreEmpaque(x.p, x.l.empaqueId || 'unidad_base')}${x.l.enOfertaPorVencimiento ? ' · <b style="color:var(--orange)">EN OFERTA</b>' : ''}</span></div>
      </div>
      ${diaTag}
      <div class="venc-actions"><button class="btn btn-warning btn-sm" onclick="abrirOferta('${x.p.id}')">Oferta</button></div>
    </div>`;
  }).join('');
}
window.renderVencimientos = renderVencimientos;
document.querySelectorAll('.vtab').forEach(t => t.addEventListener('click', () => renderVencimientos(parseInt(t.dataset.dias)||9999)));

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
