// ═══════════════════════════════════════════
// ventas.js — Sales module v4 (FEFO Lotes)
// ═══════════════════════════════════════════

let ventas = JSON.parse(localStorage.getItem('tiaeli_ventas') || '[]');
let combos = JSON.parse(localStorage.getItem('tiaeli_combos') || '[]');
window.ventas = ventas;
window.combos = combos;
window.setVentasGlobal = function(nuevas) {
  ventas = nuevas;
  window.ventas = nuevas;
};
window.setCombosGlobal = function(nuevos) {
  combos = nuevos;
  window.combos = nuevos;
};

function saveVentas() {
  localStorage.setItem('tiaeli_ventas', JSON.stringify(ventas));
  window.ventas = ventas;
}
window.saveVentas = saveVentas;
function saveCombos() {
  localStorage.setItem('tiaeli_combos', JSON.stringify(combos));
  window.combos = combos;
  if (window.syncSaveCombo) {
    combos.forEach(c => window.syncSaveCombo(c));
  }
}
window.saveCombos = saveCombos;

// Expose saveProducto from app.js for checkoutPOS
window.saveProductos = function() {
  localStorage.setItem('tiaeli_v2', JSON.stringify(window.productos));
  window.productos = window.productos;
};

function migrarFechasVentas() {
  let migrados = false;
  ventas.forEach(v => {
    if (typeof v.fecha === 'string') {
      const str = v.fecha;
      const [datePart, timePart] = str.split('T');
      if (datePart && timePart) {
        const [y, m, d] = datePart.split('-').map(Number);
        const [h, min, s = '0'] = timePart.split(':').map(Number);
        v.fecha = new Date(y, m - 1, d, h, min, s).getTime();
      } else {
        v.fecha = new Date(str).getTime();
      }
      migrados = true;
    }
  });
  if (migrados) saveVentas();
}
migrarFechasVentas();

function nowLocal() {
  return Date.now();
}




// ── DESCONTAR STOCK FEFO (SIEMPRE EN UNIDADES BASE) ──
// Retorna { lotesAfectados, noCumplido } donde noCumplido > 0 = stock insuficiente
function descontarStockFEFO(productoId, cantidadVendida, formatoVentaId) {
  const producto = window.productos.find(p => p.id === productoId);
  if (!producto || !producto.lotes) return { lotesAfectados: [], noCumplido: cantidadVendida };

  let unidadesPorFormato = 1;
  let formatoNombre = 'Unidad';
  const formatos = safeArr(producto.formatosVenta);
  const formato = formatos.find(f => f.id === formatoVentaId) || formatos[0];
  if (formato) {
    unidadesPorFormato = safeNum(formato.unidades) || 1;
    formatoNombre = formato.nombre || 'Unidad';
  } else if (formatoVentaId && formatoVentaId !== 'unidad_base') {
    unidadesPorFormato = getUnidadesPorEmpaque(producto, formatoVentaId) || 1;
    formatoNombre = getNombreEmpaque(producto, formatoVentaId);
  }

  let restante = cantidadVendida * unidadesPorFormato; // en unidades base
  const lotesAfectados = [];

  const lotesOrdenados = producto.lotes
    .filter(lote => lote && safeNum(lote.cantidadBaseUnidades !== undefined ? lote.cantidadBaseUnidades : lote.cantidad) > 0)
    .sort((a, b) => {
      if (!a.vencimiento) return 1; if (!b.vencimiento) return -1;
      return new Date(a.vencimiento) - new Date(b.vencimiento);
    });

  for (const lote of lotesOrdenados) {
    if (restante <= 0) break;
    const loteUnidades = safeNum(lote.cantidadBaseUnidades !== undefined ? lote.cantidadBaseUnidades : lote.cantidad);
    if (loteUnidades <= 0) continue;

    const tomar = Math.min(loteUnidades, restante);
    const costoUnidad = safeNum(lote.costoPorUnidad) || (safeNum(lote.costo) / (getUnidadesPorEmpaque(producto, lote.empaqueId) || 1));

    lote.cantidadBaseUnidades = loteUnidades - tomar;
    lote.cantidad = lote.cantidadBaseUnidades;
    restante -= tomar;

    lotesAfectados.push({
      loteIndex: producto.lotes.findIndex(l => l.id === lote.id),
      vencimiento: lote.vencimiento,
      cantidadDescontada: tomar,
      costoUnitario: costoUnidad,
      formatoVendido: formatoNombre
    });
  }

  // Filtrar lotes activos
  producto.lotes = producto.lotes.filter(l => l && safeNum(l.cantidadBaseUnidades !== undefined ? l.cantidadBaseUnidades : l.cantidad) > 0);

  // Recalcular stock y vencimiento global del producto
  producto.stock = getTotalUnidadesBase(producto);
  producto.vencimiento = getVencimientoMasCercano(producto);
  producto.costoPromedioUnidad = getCostoPromedio(producto);
  producto.costo = producto.costoPromedioUnidad;
  producto.updatedAt = Date.now();

  if (window.syncSaveProducto) window.syncSaveProducto(producto);
  return { lotesAfectados, noCumplido: Math.ceil(restante / unidadesPorFormato) };
}




// ── STATS HOY ──
function renderVentasStats() {
  const hoy = new Date(); hoy.setHours(0,0,0,0); const hoyTs = hoy.getTime();
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1); const mananaTs = manana.getTime();
  const vh=(window.ventas||[]).filter(v => typeof v.fecha === 'number' ? (v.fecha >= hoyTs && v.fecha < mananaTs) : new Date(v.fecha) >= hoy);
  const total=vh.reduce((s,v)=>s+v.total,0);
  let ef=0, qr=0;
  vh.forEach(v => {
    if (v.pago === 'mixto' && v.pagoDetalle) {
      ef += v.pagoDetalle.efectivo || 0;
      qr += v.pagoDetalle.qr || 0;
    } else if (v.pago === 'efectivo') {
      ef += v.total;
    } else {
      qr += v.total;
    }
  });
  const set=(id,val,prefix='')=>{
    const el=document.getElementById(id);
    if(el) el.innerHTML = window.odoHtml ? window.odoHtml(val, String(val).includes('.')?'money':'int', prefix) : prefix + val;
  };
  set('vstat-total',total.toFixed(2), 'Bs.'); set('vstat-count',vh.length);
  set('vstat-efectivo',ef.toFixed(2), 'Bs.'); set('vstat-qr',qr.toFixed(2), 'Bs.');
  if(window.initOdometers) window.initOdometers();
}
window.renderVentasStats = renderVentasStats;

function pagoBadge(pago, pagoDetalle){
  const p = (pago || '').toLowerCase();
  if (p === 'mixto' && pagoDetalle) {
    const eff = pagoDetalle.efectivo || 0;
    const qr = pagoDetalle.qr || 0;
    return '<span class="pago-badge pago-mixto" title="Efectivo: Bs. ' + eff.toFixed(2) + ' | QR: Bs. ' + qr.toFixed(2) + '">MIXTO</span>';
  }
  const c = p === 'efectivo' ? 'pago-efectivo' : p === 'qr' ? 'pago-qr' : p === 'fiado' ? 'pago-fiado' : 'pago-transferencia';
  return '<span class="pago-badge ' + c + '">' + (pago || 'OTRO').toUpperCase() + '</span>';
}

// ── VENTAS HOY LIST ──
function renderVentasHoy() {
  const hoy = new Date(); hoy.setHours(0,0,0,0); const hoyTs = hoy.getTime();
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1); const mananaTs = manana.getTime();
  const list=(window.ventas||[]).filter(v => typeof v.fecha === 'number' ? (v.fecha >= hoyTs && v.fecha < mananaTs) : new Date(v.fecha) >= hoy);
  const cont=document.getElementById('ventasHoyList');if(!cont)return;
  if(!list.length){cont.innerHTML='<div class="empty-state" style="padding:22px"><span class="es-icon">&#8212;</span><p>Sin ventas hoy todav\u00eda.</p></div>';return;}
  cont.innerHTML=list.map(v=>{
    const hora=new Date(typeof v.fecha === 'number' ? v.fecha : v.fecha).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'});
    const etq=v.tipo==='combo'?'<span class="combo-tag">COMBO</span>':(v.packLabel?'<span class="pack-tag">'+escHTML(v.packLabel)+'</span>':(v.presentacion?'<span class="pack-tag">'+escHTML(v.presentacion)+'</span>':''));
    const desc=v.tipo==='combo'?(escHTML(v.nota||'')):(v.packLabel?escHTML(v.cantidadPacks+' '+v.packLabel+' · '+v.cantidad+' uds'):(v.presentacion ? escHTML(v.cantidad + ' x ' + v.presentacion) : v.cantidad+' unid'));
    const descLine=v.descuento>0?`<small style="color:var(--red)">(-Bs.${v.descuento.toFixed(2)})</small>`:'';
    let lotesInfo = '';
    if (v.lotesAfectados && v.lotesAfectados.length) {
      lotesInfo = '<ul class="lotes-afectados-list">' + v.lotesAfectados.map(la => `<li>Lote ${la.loteIndex+1} (${la.cantidadDescontada} ud) ${la.vencimiento?escHTML('— '+la.vencimiento):''}</li>`).join('') + '</ul>';
    }
    const safePN = escHTML(v.productoNombre || '(sin nombre)');
    const safeNota = v.nota && v.tipo !== 'combo' ? escHTML(v.nota) : '';
    return `<div class="venta-card">
      <div class="venta-card-left">
        <div class="venta-card-nombre">${safePN} ${etq}</div>
        <div class="venta-card-meta"><span>${hora}</span><span>${desc}</span>${pagoBadge(v.pago, v.pagoDetalle)}${safeNota ? '<span>'+safeNota+'</span>' : ''}</div>
        ${lotesInfo}
      </div>
      <div class="venta-card-total">
        <div class="venta-card-monto">Bs.${v.total.toFixed(2)} ${descLine}</div>
        <div style="font-size:.72rem;color:${v.ganancia>=0?'var(--green)':'var(--red)'}">G: Bs.${v.ganancia.toFixed(2)}</div>
      </div>
      <button class="btn-icon danger" onclick="eliminarVenta('${v.id}')" title="Eliminar">✕</button>
   </div>`;
  }).join('');
}
window.renderVentasHoy = renderVentasHoy;

function eliminarVenta(id) {
  if(!confirm('\u00bfEliminar esta venta? El stock NO se restaura automáticamente.'))return;
  ventas=ventas.filter(v=>v.id!==id);
  window.ventas=ventas;
  saveVentas();
  if (window.syncDeleteVenta) window.syncDeleteVenta(id);
  renderVentasHoy();renderVentasStats();renderHistorial();renderDashboard();
  if(window.renderAllCharts)renderAllCharts();
  toast('Venta eliminada','warning');
}
window.eliminarVenta = eliminarVenta;

// ── COMBOS VENTA ──
function renderCombosVenta() {
  const cList = document.getElementById('combosVentaList');
  if(!cList)return;
  if(!window.combos || window.combos.length===0){
    cList.innerHTML='<div style="font-size:0.8rem;color:var(--text3);">No hay combos activos.</div>';
    return;
  }
  
  cList.innerHTML = '<div class="pos-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">' + window.combos.map(c => {
    let maxCombos = 9999;
    const itemsHtml = c.componentes.map(i => {
      const p = productos.find(x=>x.id===i.productoId);
      if(!p){maxCombos=0;return '';}
      const st = getStockTotal(p);
      const posib = Math.floor(st / i.cantidad);
      if(posib<maxCombos) maxCombos=posib;
      return `<span style="font-size:0.7rem;color:var(--text3);">${p.nombre}${p.presentacion?' '+p.presentacion:''} &times;${i.cantidad}</span>`;
    }).join('<br>');
    
    const isOut = maxCombos <= 0;
    return `<div class="pos-card ${isOut ? 'out-of-stock' : ''}" onclick="addComboToPOS('${c.id}')" style="text-align:left; padding:12px; display:flex; flex-direction:column;">
              <div class="pos-card-name" style="color:var(--primary); font-size:0.95rem; margin-bottom:6px;">📦 ${c.nombre}</div>
              <div style="margin-top:2px; margin-bottom:8px; line-height:1.2; flex:1;">${itemsHtml}</div>
              <div class="pos-card-price" style="margin-top:auto;">Bs. ${c.precioVenta.toFixed(2)}</div>
              <div class="pos-card-stock">${isOut ? 'Agotado' : 'Disponibles: ' + maxCombos}</div>
            </div>`;
  }).join('') + '</div>';
}
window.renderCombosVenta = renderCombosVenta;




// \u2500\u2500 HISTORIAL \u2500\u2500
function renderHistorial() {
  const q=(document.getElementById('hSearch')?.value||'').toLowerCase();
  const desde=document.getElementById('hFechaDesde')?.value;
  const hasta=document.getElementById('hFechaHasta')?.value;
  const pago=document.getElementById('hPago')?.value;
  let lista=[...(window.ventas||[])];
  if(q)lista=lista.filter(v=>v.productoNombre.toLowerCase().includes(q));
  if(desde) {
    const d = new Date(desde + 'T00:00:00').getTime();
    lista = lista.filter(v => (typeof v.fecha === 'number' ? v.fecha : new Date(v.fecha).getTime()) >= d);
  }
  if(hasta) {
    const d = new Date(hasta + 'T23:59:59').getTime();
    lista = lista.filter(v => (typeof v.fecha === 'number' ? v.fecha : new Date(v.fecha).getTime()) <= d);
  }
  if(pago)lista=lista.filter(v=>v.pago===pago);
  lista.sort((a,b) => (typeof b.fecha === 'number' ? b.fecha : new Date(b.fecha).getTime()) - (typeof a.fecha === 'number' ? a.fecha : new Date(a.fecha).getTime()));
  const tv=lista.reduce((s,v)=>s+v.total,0),tg=lista.reduce((s,v)=>s+v.ganancia,0);
  let ef=0, qr=0;
  lista.forEach(v => {
    if (v.pago === 'mixto' && v.pagoDetalle) {
      ef += v.pagoDetalle.efectivo || 0;
      qr += v.pagoDetalle.qr || 0;
    } else if (v.pago === 'efectivo') {
      ef += v.total;
    } else {
      qr += v.total;
    }
  });
  const histResumen = document.getElementById('histResumen');
  if (histResumen) {
    histResumen.innerHTML=[
      [tv, 'Total vendido', 'Bs.', 2],
      [lista.length, 'Ventas', '', 0],
      [tg, 'Ganancia', 'Bs.', 2],
      [ef, 'Efectivo', 'Bs.', 2],
      [qr, 'QR/Transfer.', 'Bs.', 2]
    ].map(([v,l,p,d])=>{
      const valStr = d ? v.toFixed(d) : v;
      const htmlVal = window.odoHtml ? window.odoHtml(valStr, d?'money':'int', p?p:'') : (p?p:'') + valStr;
      return `<div class="hres-card"><div class="hres-val">${htmlVal}</div><div class="hres-lbl">${l}</div></div>`;
    }).join('');
  }
  if(window.initOdometers) window.initOdometers();
  
  const tbody=document.getElementById('histTableBody');
  const mobileCards=document.getElementById('histMobileCards');
  
  if (!tbody) return;
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="es-icon">&#8212;</span><p>Sin ventas en este per\u00edodo.</p></div></td></tr>';
    if (mobileCards) mobileCards.innerHTML = '';
    return;
  }
  
let mobileHtml = [];
  let lastDateStr = null;
  tbody.innerHTML = lista.map((v, i) => {
    const fd = new Date(typeof v.fecha === 'number' ? v.fecha : v.fecha);
    const fs = fd.toLocaleDateString('es-BO') + ' ' + fd.toLocaleTimeString('es-BO', {hour:'2-digit',minute:'2-digit'});
    const dateOnly = fd.toLocaleDateString('es-BO');
    const etq = v.tipo === 'combo' ? ' <span class="combo-tag">COMBO</span>' : (v.packLabel ? ' <span class="pack-tag">' + v.packLabel + '</span>' : (v.presentacion ? ' <span class="pack-tag">' + escHTML(v.presentacion) + '</span>' : ''));
    let lotesInfo = '';
    if (v.lotesAfectados && v.lotesAfectados.length) {
      lotesInfo = '<ul class="lotes-afectados-list">' + v.lotesAfectados.map(la => `<li>Lote ${la.loteIndex+1} (${la.cantidadDescontada} ud) ${la.vencimiento ? '- ' + la.vencimiento : ''}</li>`).join('') + '</ul>';
    }

    // Separador de fecha si cambia
    let dateSeparatorRow = '';
    let dateSeparatorMobile = '';
    if (dateOnly !== lastDateStr) {
      dateSeparatorRow = `<tr class="hist-date-separator"><td colspan="10"><span>${dateOnly}</span></td></tr>`;
      dateSeparatorMobile = `<div class="hist-date-header">${dateOnly}</div>`;
      lastDateStr = dateOnly;
    }

    mobileHtml.push(dateSeparatorMobile + `
      <div class="mobile-card" style="animation-delay:${Math.min(i*30, 600)}ms">
        <div class="mobile-card-header" style="justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div class="mobile-card-name">${v.productoNombre} ${etq}</div>
            <div style="font-size:0.75rem; color:var(--text3);">${fs}</div>
          </div>
          ${pagoBadge(v.pago, v.pagoDetalle)}
        </div>
        <div class="mobile-card-body" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="mobile-card-field"><span>Cantidad</span><span><b>${v.cantidad}</b></span></div>
          <div class="mobile-card-field"><span>Total</span><span><b>Bs.${v.total.toFixed(2)}</b></span></div>
          <div class="mobile-card-field"><span>Descuento</span><span style="color:var(--red)">${v.descuento>0?'-Bs.'+v.descuento.toFixed(2):'-'}</span></div>
          <div class="mobile-card-field"><span>Ganancia</span><span class="${v.ganancia>=0?'pos':'neg'}">Bs.${v.ganancia.toFixed(2)}</span></div>
        </div>
        ${v.lotesAfectados && v.lotesAfectados.length > 0 ? `
        <div class="mobile-lotes" style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
          <div style="font-size:0.75rem; color:var(--text3); margin-bottom:4px;">Lotes afectados:</div>
          ${v.lotesAfectados.map(la => `
            <div style="background:var(--bg3); padding:6px 8px; border-radius:4px; margin-bottom:4px; font-size:0.75rem; display:flex; justify-content:space-between; align-items:center;">
              <span>Lote ${la.loteIndex+1} <b>(${la.cantidadDescontada} ud)</b></span>
              <span>${la.vencimiento||'-'}</span>
            </div>
          `).join('')}
        </div>` : ''}
        ${v.nota ? `<div style="margin-top:8px; font-size:0.75rem; color:var(--text3); padding:6px; background:var(--bg3); border-radius:4px; font-style:italic;">"${v.nota}"</div>` : ''}
        <div class="mobile-card-actions" style="margin-top:12px;">
          <button class="btn btn-secondary btn-sm danger" style="width:100%" onclick="eliminarVenta('${v.id}')">Eliminar Venta</button>
        </div>
      </div>
    `);

    return dateSeparatorRow + `<tr><td style="font-size:.76rem;color:var(--text2);white-space:nowrap">${fs}</td><td><div class="prod-name">${v.productoNombre}${etq}</div>${lotesInfo}</td><td><b>${v.cantidad}</b></td><td class="price-cost">Bs.${(v.precioUnit||v.total).toFixed(2)}</td><td style="color:var(--red)">${v.descuento>0?'-Bs.'+v.descuento.toFixed(2):'-'}</td><td class="price-venta"><b>Bs.${v.total.toFixed(2)}</b></td><td>${pagoBadge(v.pago, v.pagoDetalle)}</td><td class="price-ganancia ${v.ganancia>=0?'pos':'neg'}">Bs.${v.ganancia.toFixed(2)}</td><td style="color:var(--text3);font-size:.76rem;max-width:110px">${v.nota||'-'}</td><td><button class="btn-icon danger" onclick="eliminarVenta('${v.id}')">\u2715</button></td></tr>`;
  }).join('');
  
  if (mobileCards) mobileCards.innerHTML = mobileHtml.join('');
}
window.renderHistorial = renderHistorial;

function exportarVentas() {
  if(!(window.ventas||[]).length){toast('No hay ventas','warning');return;}
   const h='Fecha,Tipo,Producto,Presentacion,Cantidad,PrecioUnit,Subtotal,Descuento,Total,Costo,Ganancia,Pago,Nota\n';
   const r=(window.ventas||[]).map(v=>[new Date(typeof v.fecha === 'number' ? v.fecha : v.fecha).toISOString(),v.tipo||'individual',v.productoNombre,v.presentacion||v.packLabel||'Unidad',v.cantidad,v.precioUnit,v.subtotal||v.total,v.descuento||0,v.total,v.costo,v.ganancia,v.pago,v.nota||''].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+h+r],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ventas_tiaeli_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);
  toast('CSV exportado','success');
}

// ── BIND ──
document.getElementById('btnFiltrarHistorial')?.addEventListener('click',renderHistorial);
document.getElementById('btnExportCSV')?.addEventListener('click',exportarVentas);
document.getElementById('hSearch')?.addEventListener('input',renderHistorial);

// ── INIT ──
renderVentasStats();

// ═══════════════════════════════════════════
// MODO CAJA RÁPIDA (POS)
// ═══════════════════════════════════════════

let posCart = [];
let posFilter = 'Todas';
let posPaymentMethod = 'efectivo';

window.initPOS = function() {
  window.posFilter = 'Todas';
  posFilter = 'Todas';
  renderPOSProducts();
  renderCombosVenta();
  updatePOSCart();
};

window.setPOSFilter = function(categoria) {
  posFilter = categoria;
  window.posFilter = categoria;
  document.querySelectorAll('.pos-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.trim() === categoria);
  });
  renderPOSProducts();
};

window.renderPOSProducts = function() {
  const grid = document.getElementById('posGrid');
  if (!grid) return;
  
  let filtrados = [...(window.productos || [])];
  
  // 1. Filtrar por Categoria
  const cat = posFilter || 'Todas';
  if (cat !== 'Todas') {
    if (cat === 'Otros') {
      const mainCats = ['Cervezas', 'Licores', 'Sodas'];
      const allCats = [...new Set(filtrados.map(p => p.categoria))];
      const otherCats = allCats.filter(c => !mainCats.includes(c));
      filtrados = filtrados.filter(p => otherCats.includes(p.categoria));
    } else {
      filtrados = filtrados.filter(p => p.categoria === cat);
    }
  }

  // 2. Filtrar por Búsqueda (Search Input)
  const searchInput = document.getElementById('posSearchInput');
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.toLowerCase().trim();
    filtrados = filtrados.filter(p => {
      const nom = String(p.nombre || '').toLowerCase();
      const mar = String(p.marca || '').toLowerCase();
      const pre = String(p.presentacion || '').toLowerCase();
      return nom.includes(q) || mar.includes(q) || pre.includes(q);
    });
  }

  filtrados.sort((a,b) => a.nombre.localeCompare(b.nombre));

   grid.innerHTML = filtrados.length ? filtrados.map(p => {
    const stockUnid = getTotalUnidadesBase(p);
    const outOfStock = stockUnid <= 0 ? 'out-of-stock' : '';
    const presentacion = p.presentacion ? escHTML(p.presentacion) : '';
    const marca = p.marca ? escHTML(p.marca) : '';
    const enOferta = getProductoEnOferta(p);
    const formatos = safeArr(p.formatosVenta);
    const fmtUnidad = formatos.find(f => f.id === 'unidad' || f.esBase) || { precio: getPrecioVentaEfectivo(p) };
    const precioUnidad = enOferta && safeNum(p.precioOfertaUnidad || p.precioOferta) > 0 ? (p.precioOfertaUnidad || p.precioOferta) : safeNum(fmtUnidad.precio);

    const paqFormatos = formatos.filter(f => f && f.unidades > 1);
    const stockLine = window.formatStockDisplay ? formatStockDisplay(p) : stockUnid + ' u.';
    const ofertaTag = enOferta ? '<span class="badge badge-oferta">OFERTA</span>' : '';
    
    let paqTag = '';
    if (paqFormatos.length === 1) {
      paqTag = `<div class="pos-card-sub2">${escHTML(paqFormatos[0].nombre)}: Bs. ${safeNum(paqFormatos[0].precio).toFixed(2)}</div>`;
    } else if (paqFormatos.length > 1) {
      paqTag = `<div class="pos-card-sub2" style="color:var(--primary)">+ ${paqFormatos.length} formatos disponibles</div>`;
    }

    return `<div class="pos-card ${outOfStock}" onclick="addToPOS('${p.id}')">
              <div class="pos-card-name">${p.nombre} ${ofertaTag}</div>
              ${presentacion || marca ? '<div class="pos-card-sub">' + [marca, presentacion].filter(Boolean).join(' / ') + '</div>' : ''}
              <div class="pos-card-price">Bs. ${precioUnidad.toFixed(2)} <small style="font-weight:400">/u.</small></div>
              ${paqTag}
              <div class="pos-card-stock">${stockUnid > 0 ? stockLine : 'Agotado'}</div>
            </div>`;
  }).join('') : '<div class="empty-state" style="padding:30px;grid-column:1/-1"><p>No se encontraron productos.</p></div>';
};

window.filterPOSGrid = function() {
  renderPOSProducts();
};

let posEmpaqueProductoId = null;

window.abrirSelectorEmpaquePOS = function(pid) {
  const p = (window.productos || []).find(x => x.id === pid);
  if (!p) return;
  posEmpaqueProductoId = pid;
  const formatos = safeArr(p.formatosVenta).length > 0
    ? p.formatosVenta
    : [
        { id: 'unidad', nombre: p.unidadBase || 'Unidad', unidades: 1, precio: getPrecioVentaEfectivo(p), esBase: true },
        ...safeArr(p.empaques).map(e => ({ id: e.id, nombre: e.nombre, unidades: e.unidades, precio: p.precioVentaPaquete || 0 }))
      ];

  const stockUnid = getTotalUnidadesBase(p);
  const enOferta = getProductoEnOferta(p);

  document.getElementById('posEmpaqueProductoNombre').textContent = p.nombre;
  document.getElementById('posEmpaqueStock').textContent = stockUnid > 0 ? (window.formatStockDisplay ? formatStockDisplay(p) : stockUnid + ' u.') : 'Agotado';
  const opts = document.getElementById('posEmpaqueOptions');
  let html = '';

  formatos.forEach(f => {
    let precioFmt = safeNum(f.precio);
    if (f.id === 'unidad' || f.esBase) {
      if (enOferta && safeNum(p.precioOfertaUnidad || p.precioOferta) > 0) {
        precioFmt = p.precioOfertaUnidad || p.precioOferta;
      }
    } else if (f.unidades > 1 && enOferta && safeNum(p.precioOfertaPaquete) > 0) {
      precioFmt = p.precioOfertaPaquete;
    }
    const precioPorUnidad = (f.unidades && f.unidades > 0) ? (precioFmt / f.unidades) : precioFmt;
    const subText = f.unidades > 1 ? `${f.unidades} u. · Bs. ${precioPorUnidad.toFixed(2)} /u` : '1 unidad base';

    html += `<button class="pos-empaque-opt" onclick="addToPOS('${pid}','${escHTML(f.id)}')">
      <span class="po-name">${escHTML(f.nombre || 'Formato')}</span>
      <span class="po-sub">${subText}</span>
      <span class="po-price">Bs. ${precioFmt.toFixed(2)}</span>
    </button>`;
  });

  opts.innerHTML = html;
  document.getElementById('posEmpaqueOverlay').style.display = 'flex';
};
window.abrirSelectorEmpaquePOS = abrirSelectorEmpaquePOS;

window.addToPOS = function(pid, formatoId) {
  const p = (window.productos || []).find(x => x.id === pid);
  if (!p) return;

  const stockUnid = getTotalUnidadesBase(p);
  if (stockUnid <= 0) { toast('Producto agotado', 'warning'); return; }

  const formatos = safeArr(p.formatosVenta).length > 0
    ? p.formatosVenta
    : [
        { id: 'unidad', nombre: p.unidadBase || 'Unidad', unidades: 1, precio: getPrecioVentaEfectivo(p), esBase: true },
        ...safeArr(p.empaques).map(e => ({ id: e.id, nombre: e.nombre, unidades: e.unidades, precio: p.precioVentaPaquete || 0 }))
      ];

  // Si no se pasó un formatoId específico y el producto tiene más de 1 formato de venta: abrir selector
  if (!formatoId && formatos.length > 1) {
    abrirSelectorEmpaquePOS(pid);
    return;
  }

  document.getElementById('posEmpaqueOverlay') && (document.getElementById('posEmpaqueOverlay').style.display = 'none');

  formatoId = formatoId || 'unidad';
  let formato = formatos.find(f => f.id === formatoId) || formatos[0] || { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: getPrecioVentaEfectivo(p) };

  const unidadesPorFormato = safeNum(formato.unidades) || 1;
  const maxPosible = Math.floor(stockUnid / unidadesPorFormato);
  if (maxPosible <= 0) { toast('Stock insuficiente para vender en formato ' + formato.nombre, 'warning'); return; }

  const itemId = pid + '::' + formato.id;
  const enOferta = getProductoEnOferta(p);
  let precio = safeNum(formato.precio) || (getPrecioVentaEfectivo(p) * unidadesPorFormato);
  if ((formato.id === 'unidad' || formato.esBase) && enOferta && safeNum(p.precioOfertaUnidad || p.precioOferta) > 0) {
    precio = p.precioOfertaUnidad || p.precioOferta;
  } else if (unidadesPorFormato > 1 && enOferta && safeNum(p.precioOfertaPaquete) > 0) {
    precio = p.precioOfertaPaquete;
  }

  const existing = posCart.find(item => item.id === itemId);
  const cantActual = existing ? existing.cant : 0;
  if (cantActual + 1 > maxPosible) { toast('Stock disponible: ' + maxPosible + ' ' + formato.nombre, 'warning'); return; }

  if (existing) {
    existing.cant++;
  } else {
    posCart.push({
      id: itemId,
      p: p,
      cant: 1,
      precio: precio,
      formatoVenta: formato,
      empaqueId: formato.id,
      unidadesPorEmpaque: unidadesPorFormato
    });
  }
  updatePOSCart();
  autoOpenPOSCart();
};

window.updatePOSQty = function(pid, delta) {
  const item = posCart.find(x => x.id === pid);
  if (!item) return;

  const nuevo = item.cant + delta;
  if (nuevo <= 0) {
    posCart = posCart.filter(x => x.id !== pid);
  } else {
    let stockMax = 9999;
    if (item.p.isCombo && item.p.comboRef) {
      item.p.comboRef.componentes.forEach(comp => {
        const pr = productos.find(px => px.id === comp.productoId);
        if (!pr) { stockMax = 0; return; }
        const st = getTotalUnidadesBase(pr);
        const posib = Math.floor(st / comp.cantidad);
        if (posib < stockMax) stockMax = posib;
      });
    } else {
      const stockUnid = getTotalUnidadesBase(item.p);
      stockMax = Math.floor(stockUnid / (item.unidadesPorEmpaque || 1));
    }
    if (nuevo > stockMax) {
      toast(stockMax > 0 ? 'Stock disponible: ' + stockMax : 'Producto agotado', 'warning');
      return;
    }
    item.cant = nuevo;
  }
  updatePOSCart();
};

window.setPOSPayment = function(method) {
  window.posPaymentMethod = method;
  posPaymentMethod = method;
  const btnCash = document.getElementById('posPayCash');
  const btnQR = document.getElementById('posPayQR');
  const btnMixto = document.getElementById('posPayMixto');
  const qrOpts = document.getElementById('posQROptions');
  const mixtoModal = document.getElementById('posMixtoModal');
  
  if(btnCash) btnCash.classList.toggle('active', method === 'efectivo');
  if(btnQR) btnQR.classList.toggle('active', method === 'qr');
  if(btnMixto) btnMixto.classList.toggle('active', method === 'mixto');
  if(qrOpts) qrOpts.style.display = method === 'qr' ? 'flex' : 'none';
  if(mixtoModal) mixtoModal.style.display = method === 'mixto' ? 'block' : 'none';
  
  if (method === 'mixto') {
    const total = posCart.reduce((sum, item) => sum + item.cant * item.precio, 0);
    const totalEl = document.getElementById('posMixtoTotal');
    if (totalEl) totalEl.textContent = 'Bs. ' + total.toFixed(2);
    document.getElementById('posMixtoEfectivo').value = '';
    document.getElementById('posMixtoQR').value = '';
    document.getElementById('posMixtoError').textContent = '';
    document.getElementById('posMixtoOk').textContent = '';
  }
};

window.togglePosCart = function(forceClose) {
  const cart = document.getElementById('posCartContainer');
  const backdrop = document.getElementById('posCartBackdrop');
  if (!cart) return;

  if (forceClose === true) {
    cart.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
    return;
  }

  if (posCart.length === 0 && !cart.classList.contains('open')) {
    toast('El carrito está vacío. Agrega productos tocándolos.', 'info');
    return;
  }

  const isOpen = cart.classList.toggle('open');
  if (backdrop) {
    if (isOpen) backdrop.classList.add('active');
    else backdrop.classList.remove('active');
  }
};

window.togglePOSCart = function() {
  const cartContainer = document.getElementById('posCartContainer');
  const backdrop = document.getElementById('posCartBackdrop');
  const floatingBtn = document.getElementById('posCartFloatingBtn');
  if (!cartContainer) return;
  const isOpen = cartContainer.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('active', isOpen);
  if (floatingBtn) floatingBtn.setAttribute('aria-expanded', isOpen);
};

window.closePOSCart = function() {
  const cartContainer = document.getElementById('posCartContainer');
  const backdrop = document.getElementById('posCartBackdrop');
  const floatingBtn = document.getElementById('posCartFloatingBtn');
  if (cartContainer) cartContainer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
  if (floatingBtn) floatingBtn.setAttribute('aria-expanded', 'false');
};

// Auto-abrir carrito al agregar primer item
function autoOpenPOSCart() {
  const cartContainer = document.getElementById('posCartContainer');
  if (cartContainer && !cartContainer.classList.contains('open') && posCart.length > 0) {
    cartContainer.classList.add('open');
    const backdrop = document.getElementById('posCartBackdrop');
    if (backdrop) backdrop.classList.add('active');
  }
}

window.clearPOSCart = function() {
  if (posCart.length === 0) return;
  posCart = [];
  updatePOSCart();
  toast('Carrito vaciado', 'success');
};

window.updatePOSCart = function() {
  const container = document.getElementById('posCartItems');
  const totalAmount = document.getElementById('posTotalAmount');
  const btnCheckout = document.getElementById('posCheckoutBtn');
  const badge = document.getElementById('posCartBadge');
  const floatingBtn = document.getElementById('posCartFloatingBtn');
  const backdrop = document.getElementById('posCartBackdrop');
  const cartContainer = document.getElementById('posCartContainer');

  const totalUnits = posCart.reduce((sum, item) => sum + item.cant, 0);

  // Actualizar contador del badge y estado del botón flotante
  if (badge) {
    badge.textContent = totalUnits;
    if (totalUnits > 0) {
      badge.classList.remove('bump');
      void badge.offsetWidth; // Reflow para reiniciar animación
      badge.classList.add('bump');
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (floatingBtn) {
    if (totalUnits > 0) {
      floatingBtn.classList.add('has-items');
      floatingBtn.classList.remove('bounce');
      void floatingBtn.offsetWidth;
      floatingBtn.classList.add('bounce');
    } else {
      floatingBtn.classList.remove('has-items', 'bounce');
    }
  }

  if (!container) return;

  if (posCart.length === 0) {
    container.innerHTML = '<div class="pos-cart-empty"><span style="font-size:2.2rem;margin-bottom:6px;display:block">🛒</span><p style="margin:0;font-weight:600;color:var(--text)">Carrito vacío</p><small style="color:var(--text3);font-size:0.8rem">Toca cualquier producto o combo para agregarlo</small></div>';
    if (totalAmount) totalAmount.innerText = 'Bs. 0.00';
    if (btnCheckout) btnCheckout.disabled = true;
    
    if (cartContainer && cartContainer.classList.contains('open')) {
      cartContainer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    }
    return;
  }

  if (btnCheckout) btnCheckout.disabled = false;
  let total = 0;

  container.innerHTML = posCart.map(item => {
    const subtotal = item.cant * item.precio;
    total += subtotal;
    const present = item.p.presentacion || '';
    const etiquetaEmp = (item.formatoVenta && item.formatoVenta.id !== 'unidad' && item.formatoVenta.nombre) || (item.empaqueId && item.empaqueId !== 'unidad_base' ? getNombreEmpaque(item.p, item.empaqueId) : '');
    return `<div class="pos-cart-item">
              <div class="pos-cart-item-info">
                <div class="pos-cart-item-name">${escHTML(item.p.nombre)}${present?' <small style="color:var(--text3);font-size:0.75rem">'+escHTML(present)+'</small>':''}${etiquetaEmp?' <small style="color:var(--primary);font-size:0.75rem">('+escHTML(etiquetaEmp)+')</small>':''}</div>
                <div class="pos-cart-item-price">Bs. ${item.precio.toFixed(2)} c/u &middot; <b>Subtotal: Bs. ${subtotal.toFixed(2)}</b></div>
              </div>
              <div class="pos-cart-item-controls">
                <button class="pos-btn-qty" onclick="updatePOSQty('${item.id}', -1)" title="Restar">−</button>
                <span class="pos-qty">${item.cant}</span>
                <button class="pos-btn-qty" onclick="updatePOSQty('${item.id}', 1)" title="Sumar">+</button>
              </div>
            </div>`;
  }).join('');

  if (totalAmount) totalAmount.innerText = `Bs. ${total.toFixed(2)}`;
};

window.checkoutPOS = function() {
  if (posCart.length === 0) return;

  const btn = document.getElementById('posCheckoutBtn');
  if (btn) {
    btn.innerText = 'Procesando...';
    btn.disabled = true;
  }

  const fechaVenta = new Date().toISOString();

  try {
    // ── Pre-validación de stock para cada item del carrito ──
    for (const item of posCart) {
      if (item.p.isCombo && item.p.comboRef) {
        for (const comp of item.p.comboRef.componentes) {
          const pr = productos.find(x => x.id === comp.productoId);
          if (!pr) {
            toast('Producto del combo ya no existe', 'error');
            return;
          }
          const disp = getStockTotal(pr);
          const req = comp.cantidad * item.cant;
          if (disp < req) {
            const nombre = pr.nombre || 'producto';
            toast(`Stock insuficiente de ${nombre} para el combo`, 'error');
            return;
          }
        }
      } else {
        const stockUnid = getStockTotal(item.p);
        const reqUnid = item.cant * (item.unidadesPorEmpaque || 1);
        if (stockUnid < reqUnid) {
          toast(`Stock insuficiente de ${item.p.nombre}`, 'error');
          return;
        }
      }
    }

    // Obtener detalle de pago mixto ANTES del bucle (una sola vez por checkout)
    let pagoDetalle = null;
    if (posPaymentMethod === 'mixto') {
      const mixto = validarMixto();
      if (!mixto) { toast('Complete correctamente el pago mixto', 'error'); return; }
      pagoDetalle = mixto;
    }

    posCart.forEach(item => {
      const p = item.p;
      const cant = item.cant;
      const precio = item.precio;
      const subtotal = cant * precio;
      const total = subtotal;

      if (p.isCombo) {
        const combo = p.comboRef;
        let lotesAfectadosTotales = [];
        let costoTotal = 0;

        combo.componentes.forEach(cItem => {
          const reqCant = cItem.cantidad * cant;
          const { lotesAfectados, noCumplido } = descontarStockFEFO(cItem.productoId, reqCant, 'unidad_base');
          if (noCumplido > 0) {
            console.warn('FEFO: no se pudo descontar', noCumplido, 'uds de', cItem.productoId);
          }
          costoTotal += lotesAfectados.reduce((s, l) => s + (l.cantidadDescontada * l.costoUnitario), 0);
          const productoNombre = productos.find(x => x.id === cItem.productoId)?.nombre || '';
          lotesAfectados.forEach(l => {
            l.comboItemNombre = productoNombre;
            lotesAfectadosTotales.push(l);
});
      });

      const venta = {
        id: genId(), tipo: 'combo',
        productoId: combo.id, productoNombre: p.nombre, productomarca: '',
        categoria: 'Combo', cantidad: cant,
        cantidadPacks: 1, packLabel: '',
        precioUnit: precio, subtotal, descuento: 0, total, costo: costoTotal,
        ganancia: total - costoTotal, pago: posPaymentMethod, nota: 'Combo desde Caja Rápida',
        fecha: nowLocal(), fechaRegistro: fechaVenta,
        lotesAfectados: lotesAfectadosTotales
      };
      if (pagoDetalle) venta.pagoDetalle = pagoDetalle;
      ventas.unshift(venta);
      ventasRegistradas.push(venta);
    } else {
        const formato = item.formatoVenta;
        const formatoId = (formato && formato.id) || item.empaqueId || 'unidad';
        const unidadesPorEmp = (formato && formato.unidades) || item.unidadesPorEmpaque || 1;
        const { lotesAfectados, noCumplido } = descontarStockFEFO(p.id, cant, formatoId);
        if (noCumplido > 0) {
          console.warn('FEFO: no se pudo descontar', noCumplido, 'uds de', p.id);
        }
        const costoTotal = lotesAfectados.reduce((s, l) => s + (l.cantidadDescontada * l.costoUnitario), 0);
        const ganancia = total - costoTotal;
        const esPaquete = unidadesPorEmp > 1;
        const empNombre = esPaquete ? ((formato && formato.nombre) || getNombreEmpaque(p, formatoId)) : '';

        const venta = {
          id: genId(), tipo: 'individual',
          productoId: p.id, productoNombre: p.nombre, productomarca: p.marca||'',
          presentacion: p.presentacion || '',
          categoria: p.categoria, cantidad: cant * unidadesPorEmp,
          cantidadPacks: esPaquete ? cant : 0,
          packLabel: esPaquete ? empNombre : '',
          precioUnit: precio, subtotal, descuento: 0, total, costo: costoTotal,
          ganancia, pago: posPaymentMethod, nota: 'Venta desde Caja Rápida' + (esPaquete ? ` (${cant} ${empNombre})` : ''),
          fecha: nowLocal(), fechaRegistro: fechaVenta,
          lotesAfectados
        };
        if (pagoDetalle) venta.pagoDetalle = pagoDetalle;
        ventas.unshift(venta);
        ventasRegistradas.push(venta);
      }
    });

    saveVentas();
    window.saveProductos();

    // Sync a Firebase
    if (window.syncSaveVenta) {
      ventasRegistradas.forEach(v => window.syncSaveVenta(v));
    }

    if (window.lanzarConfetti) lanzarConfetti();
    toast('¡Venta Registrada Exitosamente!', 'success');

    // Limpiar carrito
    posCart = [];
    updatePOSCart();
    renderPOSProducts();
    renderCombosVenta();

    renderVentasStats();
    renderVentasHoy();
    renderDashboard();

    if (window.renderAllCharts) renderAllCharts();

  } catch (err) {
    toast('Error procesando venta: ' + err.message, 'error');
    console.error('Error en checkoutPOS:', err);
  } finally {
    if (btn) {
      btn.innerText = 'REGISTRAR VENTA';
      btn.disabled = false;
    }
  }
};

window.addComboToPOS = function(cId) {
  const c = window.combos.find(x => x.id === cId);
  if (!c) return;

  let minStock = 9999;
  c.componentes.forEach(comp => {
    const pr = productos.find(px => px.id === comp.productoId);
    if (!pr) { minStock = 0; return; }
    const st = getStockTotal(pr);
    const posib = Math.floor(st / comp.cantidad);
    if (posib < minStock) minStock = posib;
  });

  if (minStock <= 0) { toast('Stock insuficiente para este combo', 'warning'); return; }

  const existing = posCart.find(x => x.id === 'combo_'+c.id);
  if (existing) {
    if (existing.cant + 1 > minStock) { toast('Stock disponible: ' + minStock, 'warning'); return; }
    existing.cant++;
  } else {
    posCart.push({
      id: 'combo_'+c.id,
      cant: 1,
      precio: c.precioVenta,
      p: { id: c.id, nombre: "COMBO: " + c.nombre, isCombo: true, comboRef: c, venta: c.precioVenta }
    });
  }
  updatePOSCart();
};
