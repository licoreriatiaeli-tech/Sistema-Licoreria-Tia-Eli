// ═══════════════════════════════════════════
// ventas.js — Sales module v4 (FEFO Lotes)
// ═══════════════════════════════════════════

let ventas = [];
try { ventas = JSON.parse(localStorage.getItem('tiaeli_ventas') || '[]'); } catch(e) { console.warn('tiaeli_ventas corrupto, reseteando:', e); localStorage.removeItem('tiaeli_ventas'); ventas = []; }
let combos = [];
try { combos = JSON.parse(localStorage.getItem('tiaeli_combos') || '[]'); } catch(e) { console.warn('tiaeli_combos corrupto, reseteando:', e); localStorage.removeItem('tiaeli_combos'); combos = []; }
if ((!combos || combos.length === 0) && window.combos && window.combos.length > 0) {
  combos = window.combos;
}
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
      if (a.vencimiento && b.vencimiento) {
        return new Date(a.vencimiento) - new Date(b.vencimiento);
      }
      if (a.vencimiento && !b.vencimiento) return -1;
      if (!a.vencimiento && b.vencimiento) return 1;
      // Ambos sin vencimiento: orden estricto PEPS / FIFO por fecha de ingreso
      const fA = a.fechaIngreso ? new Date(a.fechaIngreso).getTime() : 0;
      const fB = b.fechaIngreso ? new Date(b.fechaIngreso).getTime() : 0;
      return fA - fB;
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
      loteId: lote.id,
      loteIndex: producto.lotes.findIndex(l => l.id === lote.id),
      vencimiento: lote.vencimiento,
      fechaIngreso: lote.fechaIngreso || null,
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
    const prod = (window.productos || []).find(x => x.id === v.productoId || x.nombre === v.productoNombre);
    const fotoUrl = v.foto || prod?.foto;
    const vThumbHtml = fotoUrl
      ? `<img src="${fotoUrl}" class="venta-card-thumb" alt="${safePN}">`
      : `<div class="venta-card-thumb-icon"><span class="material-symbols-outlined">${v.tipo === 'combo' ? 'local_mall' : 'liquor'}</span></div>`;

    return `<div class="venta-card">
      ${vThumbHtml}
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

// ── REVERSIÓN PERFECTA DE STOCK (DEVOLUCIÓN DE LOTES) ──
function revertirStockVenta(venta) {
  if (!venta) return { ok: false, unidadesDevueltas: 0 };

  const productosMap = new Map(); // pid -> { producto, lotesARestaurar: [] }

  if (venta.tipo === 'combo') {
    const lotes = safeArr(venta.lotesAfectados);
    lotes.forEach(l => {
      const pid = l.productoId;
      if (!pid) return;
      if (!productosMap.has(pid)) {
        const prod = window.productos.find(p => p.id === pid);
        if (prod) productosMap.set(pid, { producto: prod, lotes: [] });
      }
      const item = productosMap.get(pid);
      if (item) item.lotes.push(l);
    });
  } else {
    const pid = venta.productoId;
    const prod = window.productos.find(p => p.id === pid);
    if (prod) {
      const lotes = safeArr(venta.lotesAfectados);
      if (lotes.length > 0) {
        productosMap.set(pid, { producto: prod, lotes });
      } else {
        // Fallback para ventas registradas sin desglose detallado de lotes
        productosMap.set(pid, {
          producto: prod,
          lotes: [{
            loteId: null,
            cantidadDescontada: safeNum(venta.cantidad) || 1,
            costoUnitario: safeNum(prod.costoPromedioUnidad) || safeNum(prod.costo) || 0,
            vencimiento: prod.vencimiento || null
          }]
        });
      }
    }
  }

  if (productosMap.size === 0) {
    console.warn('revertirStockVenta: No se encontraron productos vigentes para devolver stock de la venta', venta.id);
    return { ok: false, unidadesDevueltas: 0 };
  }

  let totalDevueltas = 0;

  productosMap.forEach(({ producto, lotes }) => {
    if (!producto.lotes) producto.lotes = [];

    lotes.forEach(l => {
      const cant = safeNum(l.cantidadDescontada);
      if (cant <= 0) return;
      totalDevueltas += cant;

      // 1. Buscar si el lote original con su ID aún existe en el producto
      let targetLote = l.loteId ? producto.lotes.find(x => x && x.id === l.loteId) : null;

      // 2. Si no está por ID, buscar si hay un lote activo con el mismo vencimiento exacto
      if (!targetLote && l.vencimiento) {
        targetLote = producto.lotes.find(x => x && (x.vencimiento || '') === (l.vencimiento || ''));
      }

      if (targetLote) {
        // Incrementar unidades al lote existente
        const act = safeNum(targetLote.cantidadBaseUnidades !== undefined ? targetLote.cantidadBaseUnidades : targetLote.cantidad);
        targetLote.cantidadBaseUnidades = act + cant;
        targetLote.cantidad = targetLote.cantidadBaseUnidades;
        const costoU = safeNum(targetLote.costoPorUnidad) || safeNum(l.costoUnitario) || safeNum(producto.costoPromedioUnidad) || 0;
        targetLote.costoPorUnidad = costoU;
        targetLote.costoTotalLote = targetLote.cantidadBaseUnidades * costoU;
      } else {
        // Recrear el lote original con su costo y fecha de vencimiento histórica
        const costoU = safeNum(l.costoUnitario) || safeNum(producto.costoPromedioUnidad) || safeNum(producto.costo) || 0;
        const nuevoLote = {
          id: l.loteId || ('lote_' + (typeof genId === 'function' ? genId() : Date.now())),
          cantidadBaseUnidades: cant,
          cantidad: cant,
          costoPorUnidad: costoU,
          costoTotalLote: cant * costoU,
          vencimiento: l.vencimiento || null,
          fechaIngreso: l.fechaIngreso || new Date().toISOString(),
          nota: `Restaurado por anulación de venta (${cant} u.)`
        };
        producto.lotes.push(nuevoLote);
      }
    });

    // Recalcular métricas maestras del producto
    producto.stock = getTotalUnidadesBase(producto);
    producto.vencimiento = getVencimientoMasCercano(producto);
    producto.costoPromedioUnidad = getCostoPromedio(producto);
    producto.costo = producto.costoPromedioUnidad;
    producto.updatedAt = Date.now();

    if (window.syncSaveProducto) window.syncSaveProducto(producto);
  });

  if (window.saveProductos) window.saveProductos();
  else if (typeof save === 'function') save();

  return { ok: true, unidadesDevueltas: totalDevueltas };
}
window.revertirStockVenta = revertirStockVenta;

// ── ANULACIÓN Y ELIMINACIÓN DE VENTA ──
function eliminarVenta(id) {
  const ventaEliminada = ventas.find(v => v.id === id);
  if (!ventaEliminada) {
    toast('Venta no encontrada', 'error');
    return;
  }

  const cantTexto = ventaEliminada.cantidadPacks && ventaEliminada.cantidadPacks > 0
    ? `${ventaEliminada.cantidadPacks} ${ventaEliminada.packLabel || 'pack(s)'} (${ventaEliminada.cantidad} unidades)`
    : `${ventaEliminada.cantidad} unidades`;

  const confMsg = `¿Anular y eliminar esta venta de Bs. ${safeNum(ventaEliminada.total).toFixed(2)}?\n\n` +
    `📦 Producto: ${ventaEliminada.productoNombre}\n` +
    `🔄 Stock a reintegrar al inventario: ${cantTexto}\n\n` +
    `Los lotes y costos se restaurarán de forma automática.`;

  if (!confirm(confMsg)) return;

  // 1. Revertir el stock en los lotes exactos
  const resReversion = revertirStockVenta(ventaEliminada);

  // 2. Eliminar la venta de la colección
  ventas = ventas.filter(v => v.id !== id);
  window.ventas = ventas;
  saveVentas();

  // 3. Sincronizar eliminación en Firestore
  if (window.syncDeleteVenta) window.syncDeleteVenta(id);

  // 4. Registrar en historial de auditoría
  if (window.registrarActividad) {
    const detalleDevolucion = resReversion.ok ? `Stock reintegrado (${cantTexto})` : `Sin devolución de stock`;
    registrarActividad('venta', `Venta ANULADA: ${ventaEliminada.productoNombre} — Bs. ${safeNum(ventaEliminada.total).toFixed(2)}. ${detalleDevolucion}.`);
  }

  // 5. Refrescar todas las pantallas (Ventas, Dashboard, POS e Inventario)
  renderVentasHoy();
  renderVentasStats();
  renderHistorial();
  renderDashboard();
  renderPOSProducts();
  renderCombosVenta();
  if (window.filterAndRender) filterAndRender();
  if (window.renderAllCharts) renderAllCharts();

  toast(`Venta anulada. Se devolvió el stock (${cantTexto}) al inventario.`, 'success');
}
window.eliminarVenta = eliminarVenta;

// ── CALCULAR STOCK COMBO ──
if (typeof window.calcularStockCombo !== 'function') {
  window.calcularStockCombo = function(c, productosLista) {
    if (!c || !c.componentes || !Array.isArray(c.componentes) || c.componentes.length === 0) {
      return { stockDisponible: 0, cuelloDeBotella: null, costoTotal: 0, precioRegularSeparado: 0, componentesDetalle: [] };
    }
    const prods = productosLista || window.productos || [];
    let minStock = Infinity;
    let cuelloDeBotella = null;
    let costoTotal = 0;
    let precioRegularSeparado = 0;

    const componentesDetalle = c.componentes.map(comp => {
      const p = prods.find(x => x.id === comp.productoId);
      const cantReq = Math.max(1, parseInt(comp.cantidad) || 1);
      const stockActual = p ? (typeof getTotalUnidadesBase === 'function' ? getTotalUnidadesBase(p) : (p.stock || 0)) : 0;
      const costoUnit = p ? (typeof getCostoPromedio === 'function' ? getCostoPromedio(p) : (p.costo || 0)) : 0;
      const precioUnit = p ? (typeof getPrecioVentaEfectivo === 'function' ? getPrecioVentaEfectivo(p) : (p.venta || p.precioVenta || 0)) : 0;
      costoTotal += costoUnit * cantReq;
      precioRegularSeparado += precioUnit * cantReq;
      const combosPosibles = Math.floor(stockActual / cantReq);
      if (combosPosibles < minStock) {
        minStock = combosPosibles;
        cuelloDeBotella = { productoId: comp.productoId, nombre: p ? p.nombre : (comp.nombreRef || 'Producto'), stockActual, cantRequerida: cantReq, combosPosibles };
      }
      return { productoId: comp.productoId, nombre: p ? p.nombre : (comp.nombreRef || 'Producto'), cantRequerida: cantReq, stockActual, combosPosibles, costoUnit, precioUnit, esCuelloDeBotella: false, sinStock: stockActual < cantReq };
    });

    if (minStock === Infinity) minStock = 0;
    componentesDetalle.forEach(d => {
      if (cuelloDeBotella && d.productoId === cuelloDeBotella.productoId) d.esCuelloDeBotella = true;
    });

    return { stockDisponible: minStock, cuelloDeBotella, costoTotal, precioRegularSeparado, componentesDetalle };
  };
}

// ── COMBOS VENTA ──
function renderCombosVenta() {
  const modernGrid = document.getElementById('combos-grid');
  const legacyList = document.getElementById('combosVentaList');
  if (!modernGrid && !legacyList) return;

  const combos = window.combos || [];
  const sectionCombos = document.getElementById('pos-section-combos');

  if (!combos || combos.length === 0) {
    if (sectionCombos) sectionCombos.style.display = 'none';
    if (modernGrid) modernGrid.innerHTML = '<div style="grid-column:1/-1;font-size:0.85rem;color:var(--pos-text-muted);padding:10px 0;">No hay combos activos en este momento.</div>';
    if (legacyList) legacyList.innerHTML = '<div style="font-size:0.8rem;color:var(--text3);">No hay combos activos.</div>';
    return;
  }

  const searchInput = document.getElementById('product-search') || document.getElementById('posSearchInput') || document.getElementById('mobile-product-search-input');
  const q = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';

  let combosVisibles = combos.filter(c => c && c.activo !== false);
  if (q) {
    combosVisibles = combosVisibles.filter(c => {
      const nom = (c.nombre || '').toLowerCase();
      const desc = (c.descripcion || '').toLowerCase();
      const hasComp = (c.componentes || []).some(comp => {
        const p = (window.productos || []).find(x => x.id === comp.productoId);
        return p && p.nombre.toLowerCase().includes(q);
      });
      return nom.includes(q) || desc.includes(q) || hasComp;
    });
  }

  if (sectionCombos) {
    const filterMatches = (window.posFilter === 'Todas' || window.posFilter === 'Combos' || !window.posFilter);
    sectionCombos.style.display = (filterMatches && combosVisibles.length > 0) ? 'block' : 'none';
  }

  // Render Modern Combos Grid (Ordenados por mayor rotación de venta)
  if (modernGrid) {
    if (combosVisibles.length === 0) {
      modernGrid.innerHTML = '<div style="grid-column:1/-1;font-size:0.85rem;color:var(--pos-text-muted);padding:10px 0;">No se encontraron combos para la búsqueda.</div>';
      return;
    }

    const { comboStats } = calcularEstadisticasRotacion();
    combosVisibles.sort((a, b) => {
      const calcA = typeof window.calcularStockCombo === 'function' ? window.calcularStockCombo(a) : { stockDisponible: 0 };
      const calcB = typeof window.calcularStockCombo === 'function' ? window.calcularStockCombo(b) : { stockDisponible: 0 };
      const agotA = calcA.stockDisponible <= 0 ? 1 : 0;
      const agotB = calcB.stockDisponible <= 0 ? 1 : 0;
      if (agotA !== agotB) return agotA - agotB;

      const vA = comboStats[a.id]?.vecesVendido || 0;
      const vB = comboStats[b.id]?.vecesVendido || 0;
      if (vB !== vA) return vB - vA;

      return a.nombre.localeCompare(b.nombre);
    });

    modernGrid.innerHTML = combosVisibles.map(c => {
      const calc = typeof window.calcularStockCombo === 'function'
        ? window.calcularStockCombo(c)
        : { stockDisponible: 0, componentesDetalle: [] };

      const maxCombos = calc.stockDisponible;
      const isOut = maxCombos <= 0;
      const availText = isOut ? 'Agotado (0 disp.)' : (`${maxCombos} disp.`);
      const itemsList = (calc.componentesDetalle || []).map(d => `${escHTML(d.nombre)} &times;${d.cantRequerida}`);
      const itemsHtml = itemsList.join(' + ') || (c.descripcion || 'Combo especial');

      return `
        <div class="pos-combo-card ${isOut ? 'out-of-stock' : ''}" onclick="${isOut ? '' : `addComboToPOS('${c.id}')`}">
          <div class="pos-combo-top-row">
            <span class="pos-combo-tag">📦 COMBO</span>
            <span class="pos-combo-stock-badge ${isOut ? 'out' : ''}">${availText}</span>
          </div>
          <div class="pos-combo-info">
            <h3 class="pos-combo-title" title="${escHTML(c.nombre)}">${escHTML(c.nombre)}</h3>
            <p class="pos-combo-desc" title="${escHTML(itemsHtml)}">${escHTML(itemsHtml)}</p>
          </div>
          <div class="pos-combo-price-action">
            <div class="price">Bs. ${(safeNum(c.precioVenta)).toFixed(2)}</div>
            <button type="button" class="btn-add" onclick="event.stopPropagation(); ${isOut ? '' : `addComboToPOS('${c.id}')`}" ${isOut ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
              ${isOut ? 'Agotado' : '+ Añadir'}
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Legacy Grid if present
  if (legacyList) {
    legacyList.innerHTML = '<div class="pos-grid" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">' + combos.map(c => {
      let maxCombos = 9999;
      const itemsHtml = (c.componentes || []).map(i => {
        const p = (window.productos || []).find(x => x.id === i.productoId);
        if (!p) { maxCombos = 0; return ''; }
        const st = getStockTotal(p);
        const posib = Math.floor(st / i.cantidad);
        if (posib < maxCombos) maxCombos = posib;
        return `<span style="font-size:0.7rem;color:var(--text3);">${p.nombre}${p.presentacion ? ' ' + p.presentacion : ''} &times;${i.cantidad}</span>`;
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
    const prod = (window.productos || []).find(x => x.id === v.productoId || x.nombre === v.productoNombre);
    const fotoUrl = v.foto || prod?.foto;
    const histThumbHtml = fotoUrl
      ? `<img src="${fotoUrl}" class="hist-prod-thumb" alt="${escHTML(v.productoNombre)}">`
      : `<div class="hist-prod-thumb-icon"><span class="material-symbols-outlined">${v.tipo === 'combo' ? 'local_mall' : 'liquor'}</span></div>`;

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
          <div style="display:flex; align-items:center; gap:10px;">
            ${histThumbHtml}
            <div style="display:flex; flex-direction:column; gap:2px;">
              <div class="mobile-card-name">${v.productoNombre} ${etq}</div>
              <div style="font-size:0.75rem; color:var(--text3);">${fs}</div>
            </div>
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


    return dateSeparatorRow + `<tr><td style="font-size:.76rem;color:var(--text2);white-space:nowrap">${fs}</td><td><div class="hist-prod-cell">${histThumbHtml}<div><div class="prod-name">${v.productoNombre}${etq}</div>${lotesInfo}</div></div></td><td><b>${v.cantidad}</b></td><td class="price-cost">Bs.${(v.precioUnit||v.total).toFixed(2)}</td><td style="color:var(--red)">${v.descuento>0?'-Bs.'+v.descuento.toFixed(2):'-'}</td><td class="price-venta"><b>Bs.${v.total.toFixed(2)}</b></td><td>${pagoBadge(v.pago, v.pagoDetalle)}</td><td class="price-ganancia ${v.ganancia>=0?'pos':'neg'}">Bs.${v.ganancia.toFixed(2)}</td><td style="color:var(--text3);font-size:.76rem;max-width:110px">${v.nota||'-'}</td><td><button class="btn-icon danger" onclick="eliminarVenta('${v.id}')">\u2715</button></td></tr>`;
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
document.getElementById('btnFiltrarHistorial')?.addEventListener('click', renderHistorial);
document.getElementById('btnExportCSV')?.addEventListener('click', exportarVentas);
document.getElementById('hSearch')?.addEventListener('input', renderHistorial);
// Filtros de fecha y pago: reactivos en tiempo real sin necesidad de presionar "Filtrar"
document.getElementById('hFechaDesde')?.addEventListener('input', renderHistorial);
document.getElementById('hFechaHasta')?.addEventListener('input', renderHistorial);
document.getElementById('hPago')?.addEventListener('change', renderHistorial);


// ── INIT ──
renderVentasStats();

// ═══════════════════════════════════════════
// MODO CAJA RÁPIDA (POS TPV MODERNO)
// ═══════════════════════════════════════════

let posCart = [];
window.posCart = posCart;
let posFilter = 'Todas';
window.posFilter = posFilter;
let posPaymentMethod = 'efectivo';
window.posPaymentMethod = posPaymentMethod;
let currentCustomerName = 'Consumidor Final (S/N)';
let currentDiscount = 0;
let currentTicketNumber = null;
let lastCompletedSale = null;

// Helpers seguros en caso de ejecución aislada
if (typeof window.escHTML !== 'function') {
  window.escHTML = function(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
}

function calcularMetricasTurnoHoy() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startTs = startOfDay.getTime();

  let hoyCount = 0;
  let hoyTotal = 0;
  let hoyEfectivo = 0;
  let hoyDigital = 0;

  (window.ventas || []).forEach(v => {
    const vTime = typeof v.fecha === 'number' ? v.fecha : new Date(v.fecha).getTime();
    if (vTime >= startTs) {
      hoyCount++;
      const tot = safeNum(v.total);
      hoyTotal += tot;
      if (v.pago === 'efectivo') {
        hoyEfectivo += tot;
      } else {
        hoyDigital += tot;
      }
    }
  });

  return { hoyCount, hoyTotal, hoyEfectivo, hoyDigital };
}

function actualizarMetricasTurnoPOS() {
  const metrics = calcularMetricasTurnoHoy();
  const totalEl = document.getElementById('header-turn-total');
  const ticketsEl = document.getElementById('header-turn-tickets');
  if (totalEl) totalEl.textContent = 'Bs. ' + metrics.hoyTotal.toFixed(2);
  if (ticketsEl) ticketsEl.textContent = metrics.hoyCount;

  const user = window.sesion || (typeof window.usuarioActual === 'function' ? window.usuarioActual() : null) || (window.currentUser ? (window.currentUser.nombre || window.currentUser) : null) || localStorage.getItem('tiaeli_sesion') || 'Johan';
  const headerCashierEl = document.getElementById('pos-header-cashier');
  if (headerCashierEl) {
    headerCashierEl.textContent = 'Caja: ' + user;
  }
}

function renderPOSCategoryChips() {
  const container = document.getElementById('category-chips');
  const mobileContainer = document.getElementById('mobile-category-chips');
  if (!container && !mobileContainer) return;

  const prods = window.productos || [];
  const cmbs = window.combos || [];

  const baseCats = ['Todas'];
  if (cmbs.length > 0) baseCats.push('Combos');

  const preferred = ['Licores', 'Cervezas', 'Sodas', 'Snacks', 'Cigarrillos', 'Galletas', 'Chicles', 'Farmacia', 'Otros'];
  const prodCats = [...new Set(prods.map(p => p.categoria).filter(Boolean))];

  preferred.forEach(c => {
    if (prodCats.includes(c) && !baseCats.includes(c)) baseCats.push(c);
  });
  prodCats.forEach(c => {
    if (!baseCats.includes(c)) baseCats.push(c);
  });

  if (container) {
    container.innerHTML = baseCats.map(cat => {
      let count = 0;
      if (cat === 'Todas') count = prods.length;
      else if (cat === 'Combos') count = cmbs.length;
      else count = prods.filter(p => p.categoria === cat).length;

      const isActive = (posFilter === cat);
      return `<button type="button" class="category-btn pos-category-chip ${isActive ? 'active' : ''}" data-cat="${escHTML(cat)}" onclick="setPOSFilter('${escHTML(cat)}')">
        <span>${escHTML(cat)}</span>
        <span class="count">${count}</span>
      </button>`;
    }).join('');
  }

  if (mobileContainer) {
    mobileContainer.innerHTML = baseCats.map(cat => {
      let count = 0;
      if (cat === 'Todas') count = prods.length;
      else if (cat === 'Combos') count = cmbs.length;
      else count = prods.filter(p => p.categoria === cat).length;

      const label = cat === 'Todas' ? `Todos (${count})` : cat;
      const isActive = (posFilter === cat);
      return `<button type="button" class="pos-mobile-cat-pill cat-pill ${isActive ? 'active' : ''}" data-cat="${escHTML(cat)}" onclick="setPOSFilter('${escHTML(cat)}')">
        <span>${escHTML(label)}</span>
      </button>`;
    }).join('');
  }
}

window.initPOS = function() {
  window.posFilter = 'Todas';
  posFilter = 'Todas';

  actualizarMetricasTurnoPOS();

  const cashierEl = document.getElementById('pos-cashier-name');
  const user = window.currentUser ? (window.currentUser.nombre || window.currentUser) : 'Turno Activo';
  if (cashierEl) {
    cashierEl.textContent = user;
  }
  const avatarEl = document.getElementById('mobile-cashier-avatar');
  if (avatarEl) {
    const initial = (typeof user === 'string' && user.length > 0) ? user.charAt(0).toUpperCase() : 'A';
    avatarEl.textContent = initial;
  }

  if (!currentTicketNumber) {
    currentTicketNumber = (window.ventas?.length || 0) + 1001;
  }
  const ticketIdEl = document.getElementById('current-ticket-id');
  if (ticketIdEl) ticketIdEl.textContent = '#' + currentTicketNumber;

  const modalTicketTitle = document.getElementById('modal-ticket-title');
  if (modalTicketTitle) modalTicketTitle.textContent = 'Cobro Ticket #' + currentTicketNumber;

  const modalCashierInfo = document.getElementById('modal-cashier-info');
  if (modalCashierInfo) modalCashierInfo.textContent = 'Caja #1 • ' + (typeof user === 'string' ? user : 'Venta Mostrador');

  const clientEl = document.getElementById('ticket-client-name');
  if (clientEl) clientEl.textContent = currentCustomerName;

  renderPOSCategoryChips();
  renderCombosVenta();
  renderPOSProducts();
  updatePOSCart();
};

window.setPOSFilter = function(categoria) {
  posFilter = categoria;
  window.posFilter = categoria;

  // Actualizar clases de los chips desktop
  const container = document.getElementById('category-chips');
  if (container) {
    container.querySelectorAll('.category-btn, .pos-category-chip').forEach(btn => {
      const chipText = btn.querySelector('span')?.textContent?.trim() || btn.dataset.cat;
      btn.classList.toggle('active', chipText === categoria);
    });
  }

  // Actualizar clases de los chips móvil
  const mobileContainer = document.getElementById('mobile-category-chips');
  if (mobileContainer) {
    mobileContainer.querySelectorAll('.pos-mobile-cat-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === categoria);
    });
  }

  // Compatibilidad con botones viejos de filtro si existen
  document.querySelectorAll('.pos-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.trim() === categoria);
  });

  // Mostrar / ocultar sección de combos
  const sectionCombos = document.getElementById('pos-section-combos');
  if (sectionCombos) {
    if (categoria === 'Todas' || categoria === 'Combos') {
      sectionCombos.style.display = 'block';
    } else {
      sectionCombos.style.display = 'none';
    }
  }

  renderPOSProducts();
};

function getProductCategoryIcon(categoria, nombre) {
  const cat = (categoria || '').toLowerCase();
  const nom = (nombre || '').toLowerCase();
  if (nom.includes('hielo') || cat.includes('hielo')) return { icon: 'ac_unit', color: '#0891b2' };
  if (cat.includes('cerveza') || nom.includes('cerveza') || nom.includes('paceña') || nom.includes('huari') || nom.includes('four loko')) return { icon: 'sports_bar', color: '#d97706' };
  if (cat.includes('soda') || cat.includes('refresco') || nom.includes('coca') || nom.includes('sprite') || nom.includes('fanta') || nom.includes('agua')) return { icon: 'water_bottle', color: '#dc2626' };
  if (cat.includes('snack') || cat.includes('galleta') || nom.includes('nacho') || nom.includes('papas') || nom.includes('mani')) return { icon: 'bakery_dining', color: '#ea580c' };
  if (nom.includes('whisky') || nom.includes('johnnie') || nom.includes('black label') || nom.includes('red label') || nom.includes('chivas') || nom.includes('jack')) return { icon: 'liquor', color: '#b45309' };
  if (nom.includes('fernet') || nom.includes('aperitivo') || nom.includes('campari') || nom.includes('jagermeister')) return { icon: 'local_bar', color: '#047857' };
  if (cat.includes('cigarro') || nom.includes('cigarro') || nom.includes('camel') || nom.includes('marlboro')) return { icon: 'smoking_rooms', color: '#475569' };
  return { icon: 'wine_bar', color: '#c2410c' };
}

// ── ESTADÍSTICAS Y RANKING DE ROTACIÓN (PLAN 2) ──
function calcularEstadisticasRotacion() {
  const stats = {};      // pid -> { unidadesVendidas: 0, tickets: 0, totalMonto: 0 }
  const comboStats = {}; // cid -> { vecesVendido: 0, totalMonto: 0 }

  const ventas = window.ventas || [];
  ventas.forEach(v => {
    if (v.tipo === 'combo') {
      const cid = v.productoId;
      if (cid) {
        if (!comboStats[cid]) comboStats[cid] = { vecesVendido: 0, totalMonto: 0 };
        comboStats[cid].vecesVendido += safeNum(v.cantidad) || 1;
        comboStats[cid].totalMonto += safeNum(v.total) || 0;
      }
      if (Array.isArray(v.lotesAfectados)) {
        v.lotesAfectados.forEach(l => {
          const pid = l.productoId;
          if (pid) {
            if (!stats[pid]) stats[pid] = { unidadesVendidas: 0, tickets: 0, totalMonto: 0 };
            stats[pid].unidadesVendidas += safeNum(l.cantidadDescontada);
          }
        });
      }
    } else {
      const pid = v.productoId;
      if (pid) {
        if (!stats[pid]) stats[pid] = { unidadesVendidas: 0, tickets: 0, totalMonto: 0 };
        stats[pid].unidadesVendidas += safeNum(v.cantidad);
        stats[pid].tickets += 1;
        stats[pid].totalMonto += safeNum(v.total);
      }
    }
  });

  return { stats, comboStats };
}
window.calcularEstadisticasRotacion = calcularEstadisticasRotacion;

window.posSortMode = window.posSortMode || 'populares';
window.setPOSSort = function(mode) {
  window.posSortMode = mode || 'populares';
  const sel = document.getElementById('pos-sort-select');
  if (sel) sel.value = window.posSortMode;
  renderPOSProducts();
};

window.renderPOSProducts = function() {
  const grid = document.getElementById('products-grid') || document.getElementById('posGrid');
  if (!grid) return;

  const countLabel = document.getElementById('product-count-label');

  if (posFilter === 'Combos') {
    grid.innerHTML = '<div class="pos-empty-catalog" style="grid-column: 1/-1; padding: 30px 20px; text-align:center; color: var(--pos-text-muted);"><p style="font-weight:600; font-size:1rem; margin-bottom:4px;">Mostrando combos en la parte superior ☝️</p><small>Selecciona otra categoría o \"Todas\" para ver productos individuales</small></div>';
    if (countLabel) countLabel.textContent = '0 productos';
    return;
  }

  let filtrados = [...(window.productos || [])];

  // 1. Filtrar por Categoría
  const cat = posFilter || 'Todas';
  if (cat !== 'Todas' && cat !== 'Combos') {
    if (cat === 'Otros') {
      const mainCats = ['Cervezas', 'Licores', 'Sodas'];
      const allCats = [...new Set(filtrados.map(p => p.categoria))];
      const otherCats = allCats.filter(c => !mainCats.includes(c));
      filtrados = filtrados.filter(p => otherCats.includes(p.categoria));
    } else {
      filtrados = filtrados.filter(p => p.categoria === cat);
    }
  }

  // 2. Filtrar por Búsqueda (Input)
  const searchInput = document.getElementById('product-search') || document.getElementById('posSearchInput') || document.getElementById('mobile-product-search-input');
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.toLowerCase().trim();
    filtrados = filtrados.filter(p => {
      const nom = String(p.nombre || '').toLowerCase();
      const mar = String(p.marca || '').toLowerCase();
      const pre = String(p.presentacion || '').toLowerCase();
      const bar = String(p.codigoBarras || p.codigo || '').toLowerCase();
      return nom.includes(q) || mar.includes(q) || pre.includes(q) || bar.includes(q);
    });
  }

  // 3. Ordenamiento inteligente por rotación de ventas (Plan 2)
  const sortMode = window.posSortMode || 'populares';
  const { stats } = calcularEstadisticasRotacion();

  // Calcular ranking global de productos activos con ventas
  const rankedProds = (window.productos || [])
    .filter(p => p && p.activo !== false && !p.archivado && (stats[p.id]?.unidadesVendidas || 0) > 0)
    .sort((a, b) => (stats[b.id]?.unidadesVendidas || 0) - (stats[a.id]?.unidadesVendidas || 0));

  const rankMap = {};
  rankedProds.forEach((p, idx) => { rankMap[p.id] = idx + 1; });

  if (sortMode === 'populares') {
    filtrados.sort((a, b) => {
      const stockA = getTotalUnidadesBase(a);
      const stockB = getTotalUnidadesBase(b);
      const agotA = stockA <= 0 ? 1 : 0;
      const agotB = stockB <= 0 ? 1 : 0;
      if (agotA !== agotB) return agotA - agotB;

      const uA = stats[a.id]?.unidadesVendidas || 0;
      const uB = stats[b.id]?.unidadesVendidas || 0;
      if (uB !== uA) return uB - uA;

      return a.nombre.localeCompare(b.nombre);
    });
  } else if (sortMode === 'alfabetico') {
    filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre));
  } else if (sortMode === 'stock_asc') {
    filtrados.sort((a, b) => getTotalUnidadesBase(a) - getTotalUnidadesBase(b));
  } else if (sortMode === 'precio_desc') {
    filtrados.sort((a, b) => (safeNum(b.precioVentaUnidad || b.venta)) - (safeNum(a.precioVentaUnidad || a.venta)));
  }

  if (countLabel) {
    countLabel.textContent = `${filtrados.length} producto${filtrados.length !== 1 ? 's' : ''}`;
  }

  if (!filtrados.length) {
    grid.innerHTML = '<div class="pos-empty-catalog" style="grid-column: 1/-1; padding: 40px 20px; text-align:center; color: var(--pos-text-muted);"><p style="font-weight:600; font-size:1rem; margin-bottom:4px;">No se encontraron productos</p><small>Prueba buscando con otro término o seleccionando otra categoría</small></div>';
    return;
  }

  grid.innerHTML = filtrados.map(p => {
    const stockUnid = getTotalUnidadesBase(p);
    const outOfStock = stockUnid <= 0;
    const enOferta = getProductoEnOferta(p);
    const formatos = safeArr(p.formatosVenta);
    const fmtUnidad = formatos.find(f => f.id === 'unidad' || f.esBase) || { precio: getPrecioVentaEfectivo(p) };
    const precioUnidad = enOferta && safeNum(p.precioOfertaUnidad || p.precioOferta) > 0 ? (p.precioOfertaUnidad || p.precioOferta) : safeNum(fmtUnidad.precio);
    const paqFormatos = formatos.filter(f => f && f.unidades > 1);

    let stockTagClass = '';
    let stockTagText = stockUnid + ' u.';
    if (outOfStock) {
      stockTagClass = 'out';
      stockTagText = 'Agotado';
    } else if (stockUnid <= 2) {
      stockTagClass = 'warning';
      stockTagText = stockUnid + ' crítico';
    }

    const ofertaTag = enOferta ? '<span class="pos-card-format-pill" style="background:#fee2e2;color:#dc2626">OFERTA</span>' : '';
    const metaInfo = [p.presentacion, p.marca].filter(Boolean).join(' · ');

    let formatsHint = '';
    if (paqFormatos.length === 1) {
      formatsHint = `${escHTML(paqFormatos[0].nombre)}: Bs. ${safeNum(paqFormatos[0].precio).toFixed(2)}`;
    } else if (paqFormatos.length > 1) {
      formatsHint = `+ ${paqFormatos.length} formatos disp.`;
    }

    const iconData = getProductCategoryIcon(p.categoria, p.nombre);
    const cartItem = (window.posCart && window.posCart.length > 0) ? window.posCart.find(x => x.id === p.id || (x.p && x.p.id === p.id)) : null;
    const cartQty = cartItem ? cartItem.cant : 0;

          const rankNum = rankMap[p.id];
          let rankBadge = '';
          if (rankNum === 1) {
            rankBadge = '<span class="pos-badge-rank rank-1" title="Producto #1 más vendido">#1 Más Vendido</span>';
          } else if (rankNum === 2) {
            rankBadge = '<span class="pos-badge-rank rank-2" title="#2 en ventas">#2 Más Vendido</span>';
          } else if (rankNum === 3) {
            rankBadge = '<span class="pos-badge-rank rank-3" title="#3 en ventas">#3 Más Vendido</span>';
          } else if (rankNum && rankNum <= 5) {
            rankBadge = `<span class="pos-badge-rank rank-top" title="Top ${rankNum} en ventas">Top ${rankNum}</span>`;
          }

    return `
      <article 
        class="pos-product-card product-card product-card-active ${outOfStock ? 'out-of-stock' : ''}" 
        onclick="${outOfStock ? '' : `addToPOS('${p.id}')`}"
        title="${escHTML(p.nombre)}${metaInfo ? ' - ' + escHTML(metaInfo) : ''}"
        data-id="${p.id}"
        data-cat="${escHTML(p.categoria || '')}"
        data-name="${escHTML(p.nombre)}"
        data-price="${precioUnidad}"
      >
        <span class="cart-badge ${cartQty > 0 ? '' : 'hidden'}">${cartQty}</span>
        <div class="pos-card-top-row">
          <div class="pos-card-icon-box ${p.foto ? 'has-photo' : ''}" style="${p.foto ? '' : `color: ${iconData.color};`}">
            ${p.foto ? `<img src="${p.foto}" class="pos-card-thumb-img" alt="${escHTML(p.nombre)}" />` : `<span class="material-symbols-outlined">${iconData.icon}</span>`}
          </div>
          <span class="pos-card-stock-pill ${stockTagClass}">${stockTagText}</span>
        </div>
        <div class="pos-card-body">
          <h3 class="pos-card-title">${escHTML(p.nombre)} ${rankBadge} ${ofertaTag}</h3>
          <p class="pos-card-sub">${escHTML(p.presentacion || p.marca || '')}</p>
          ${formatsHint ? `<span class="pos-card-format-pill">${formatsHint}</span>` : ''}
        </div>
        <div class="pos-card-footer">
          <div class="pos-card-price-text">
            <span>Bs.</span>
            <span class="price-val">${precioUnidad.toFixed(2)}</span>
            <span class="unit">/u.</span>
          </div>
          <button type="button" class="pos-card-add-btn add-to-cart-btn" onclick="event.stopPropagation(); ${outOfStock ? '' : `addToPOS('${p.id}')`}" ${outOfStock ? 'disabled' : ''} aria-label="Añadir">
            <span class="material-symbols-outlined">add</span>
          </button>
        </div>
      </article>
    `;
  }).join('');
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

  const nombreEl = document.getElementById('posEmpaqueProductoNombre');
  const stockEl = document.getElementById('posEmpaqueStock');
  const optsEl = document.getElementById('posEmpaqueOptions');
  const overlay = document.getElementById('posEmpaqueOverlay');

  if (nombreEl) nombreEl.textContent = p.nombre;
  if (stockEl) stockEl.textContent = stockUnid > 0 ? (window.formatStockDisplay ? formatStockDisplay(p) : stockUnid + ' u.') : 'Agotado';

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

    html += `<button type="button" class="pos-empaque-opt" onclick="addToPOS('${pid}','${escHTML(f.id)}')">
      <span class="po-name">${escHTML(f.nombre || 'Formato')}</span>
      <span class="po-sub">${subText}</span>
      <span class="po-price">Bs. ${precioFmt.toFixed(2)}</span>
    </button>`;
  });

  if (optsEl) optsEl.innerHTML = html;
  if (overlay) overlay.style.display = 'flex';
};

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

  // Si no se pasó formatoId y tiene múltiples formatos, abrir selector
  if (!formatoId && formatos.length > 1) {
    abrirSelectorEmpaquePOS(pid);
    return;
  }

  const empaqueOverlay = document.getElementById('posEmpaqueOverlay');
  if (empaqueOverlay) empaqueOverlay.style.display = 'none';

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
  if (typeof showPOSToast === 'function') {
    showPOSToast(`+1 ${p.nombre}`);
  }
};

window.addComboToPOS = function(cId) {
  const c = (window.combos || []).find(x => x.id === cId);
  if (!c) return;

  // Calcular unidades ya comprometidas en el carrito de cada producto
  const yaEnCarrito = {};
  posCart.forEach(item => {
    if (item.p && item.p.isCombo && item.p.comboRef && Array.isArray(item.p.comboRef.componentes)) {
      item.p.comboRef.componentes.forEach(comp => {
        yaEnCarrito[comp.productoId] = (yaEnCarrito[comp.productoId] || 0) + ((comp.cantidad || 1) * item.cant);
      });
    } else if (item.p && item.p.id) {
      const u = (item.formatoVenta && item.formatoVenta.unidades) || item.unidadesPorEmpaque || 1;
      yaEnCarrito[item.p.id] = (yaEnCarrito[item.p.id] || 0) + (item.cant * u);
    }
  });

  let minStock = 9999;
  let cuelloNombre = '';

  for (const comp of (c.componentes || [])) {
    const pr = (window.productos || []).find(px => px.id === comp.productoId);
    if (!pr) { minStock = 0; cuelloNombre = comp.nombreRef || 'Producto'; break; }
    const stTotal = typeof getTotalUnidadesBase === 'function' ? getTotalUnidadesBase(pr) : (pr.stock || 0);
    const cantReq = comp.cantidad || 1;
    const yaUsado = yaEnCarrito[comp.productoId] || 0;
    const disponibleLibre = Math.max(0, stTotal - yaUsado);
    const posib = Math.floor(disponibleLibre / cantReq);
    if (posib < minStock) {
      minStock = posib;
      cuelloNombre = pr.nombre;
    }
  }

  if (minStock <= 0) {
    toast(`Stock insuficiente para añadir combo (agotado por ${cuelloNombre || 'componente'})`, 'warning');
    return;
  }

  const existing = posCart.find(x => x.id === 'combo_' + c.id);
  if (existing) {
    existing.cant++;
  } else {
    posCart.push({
      id: 'combo_' + c.id,
      cant: 1,
      precio: c.precioVenta,
      p: { id: c.id, nombre: "COMBO: " + c.nombre, isCombo: true, comboRef: c, venta: c.precioVenta }
    });
  }
  updatePOSCart();
  if (typeof showPOSToast === 'function') {
    showPOSToast(`+1 COMBO: ${c.nombre}`);
  }
};

window.updatePOSQty = function(pid, delta) {
  const item = posCart.find(x => x.id === pid);
  if (!item) return;

  const nuevo = item.cant + delta;
  if (nuevo <= 0) {
    posCart = posCart.filter(x => x.id !== pid);
  } else {
    // Calcular unidades ya comprometidas por OTROS items en el carrito
    const yaEnOtros = {};
    posCart.forEach(it => {
      if (it.id === pid) return;
      if (it.p && it.p.isCombo && it.p.comboRef && Array.isArray(it.p.comboRef.componentes)) {
        it.p.comboRef.componentes.forEach(comp => {
          yaEnOtros[comp.productoId] = (yaEnOtros[comp.productoId] || 0) + ((comp.cantidad || 1) * it.cant);
        });
      } else if (it.p && it.p.id) {
        const u = (it.formatoVenta && it.formatoVenta.unidades) || it.unidadesPorEmpaque || 1;
        yaEnOtros[it.p.id] = (yaEnOtros[it.p.id] || 0) + (it.cant * u);
      }
    });

    let stockMax = 9999;
    let bottleneckName = '';

    if (item.p.isCombo && item.p.comboRef) {
      item.p.comboRef.componentes.forEach(comp => {
        const pr = (window.productos || []).find(px => px.id === comp.productoId);
        if (!pr) { stockMax = 0; bottleneckName = comp.nombreRef || 'Producto'; return; }
        const stTotal = typeof getTotalUnidadesBase === 'function' ? getTotalUnidadesBase(pr) : (pr.stock || 0);
        const cantReq = comp.cantidad || 1;
        const libre = Math.max(0, stTotal - (yaEnOtros[comp.productoId] || 0));
        const posib = Math.floor(libre / cantReq);
        if (posib < stockMax) {
          stockMax = posib;
          bottleneckName = pr.nombre;
        }
      });
    } else {
      const pr = (window.productos || []).find(px => px.id === item.p.id) || item.p;
      const stTotal = typeof getTotalUnidadesBase === 'function' ? getTotalUnidadesBase(pr) : (pr.stock || 0);
      const u = (item.formatoVenta && item.formatoVenta.unidades) || item.unidadesPorEmpaque || 1;
      const libre = Math.max(0, stTotal - (yaEnOtros[item.p.id] || 0));
      stockMax = Math.floor(libre / u);
      bottleneckName = pr.nombre;
    }

    if (nuevo > stockMax) {
      toast(stockMax > 0 ? `Stock disponible: ${stockMax} (${bottleneckName})` : `Producto/insumo agotado (${bottleneckName})`, 'warning');
      return;
    }
    item.cant = nuevo;
  }
  updatePOSCart();
};

window.clearPOSCart = function() {
  if (posCart.length === 0) return;
  const totalItems = posCart.reduce((s, i) => s + i.cant, 0);
  if (!confirm(`¿Vaciar el ticket actual? Se perderán ${totalItems} producto${totalItems !== 1 ? 's' : ''}.`)) return;
  posCart = [];
  currentDiscount = 0;
  updatePOSCart();
  toast('Ticket vaciado', 'info');
  if (typeof showPOSToast === 'function') {
    showPOSToast('Venta reiniciada');
  }
};

window.showPOSToast = function(msg) {
  const toastEl = document.getElementById('toast-pos');
  const toastMsg = document.getElementById('toast-message');
  if (!toastEl) {
    if (typeof window.toast === 'function') window.toast(msg, 'success');
    return;
  }
  if (toastMsg) toastMsg.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(window._posToastTimer);
  window._posToastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 1800);
};

window.updatePOSCart = function() {
  window.posCart = posCart;
  const ticketList = document.getElementById('ticket-items-list');
  const emptyState = document.getElementById('ticket-empty-state');
  const subtotalEl = document.getElementById('ticket-subtotal');
  const discountEl = document.getElementById('ticket-discount');
  const totalEl = document.getElementById('ticket-total');
  const btnCobrar = document.getElementById('btn-complete-sale');
  const mobileCount = document.getElementById('mobile-ticket-items-count');
  const mobileTotal = document.getElementById('mobile-ticket-total');

  // Mobile Action Bar & Drawer elements
  const mobileActionBarTotal = document.getElementById('cart-total-amount');
  const mobileActionBarBadge = document.getElementById('badge-total-items');
  const mobileModalTotal = document.getElementById('modal-total-display');
  const mobileDrawerCount = document.getElementById('drawer-items-count');
  const mobileDrawerItemsContainer = document.getElementById('modal-cart-items-container');

  // Fallback elements for backwards compatibility
  const legacyContainer = document.getElementById('posCartItems');
  const legacyTotalAmount = document.getElementById('posTotalAmount');
  const legacyBtnCheckout = document.getElementById('posCheckoutBtn');
  const legacyBadge = document.getElementById('posCartBadge');
  const legacyFloatingBtn = document.getElementById('posCartFloatingBtn');

  const totalUnits = posCart.reduce((sum, item) => sum + item.cant, 0);
  const subtotal = posCart.reduce((sum, item) => sum + (item.cant * item.precio), 0);
  const totalFinal = Math.max(0, subtotal - (currentDiscount || 0));

  if (mobileCount) mobileCount.textContent = totalUnits;
  if (mobileTotal) mobileTotal.textContent = 'Bs. ' + totalFinal.toFixed(2);

  // Sync Mobile Action Bar & Drawer Summary
  if (mobileActionBarTotal) mobileActionBarTotal.textContent = totalFinal.toFixed(2);
  if (mobileActionBarBadge) mobileActionBarBadge.textContent = totalUnits;
  if (mobileModalTotal) mobileModalTotal.textContent = 'Bs. ' + totalFinal.toFixed(2);
  if (mobileDrawerCount) {
    mobileDrawerCount.textContent = `${totalUnits} ${totalUnits === 1 ? 'ítem cargado' : 'ítems cargados'}`;
  }

  // Sync legacy elements
  if (legacyBadge) {
    legacyBadge.textContent = totalUnits;
    legacyBadge.style.display = totalUnits > 0 ? 'flex' : 'none';
  }
  if (legacyFloatingBtn) {
    if (totalUnits > 0) legacyFloatingBtn.classList.add('has-items');
    else legacyFloatingBtn.classList.remove('has-items');
  }
  if (legacyTotalAmount) legacyTotalAmount.innerText = 'Bs. ' + totalFinal.toFixed(2);
  if (legacyBtnCheckout) legacyBtnCheckout.disabled = (posCart.length === 0);

  // Sync cart-badge on all product cards in catalog
  document.querySelectorAll('#products-grid .pos-product-card').forEach(card => {
    const pid = card.dataset.id;
    const badge = card.querySelector('.cart-badge');
    if (!badge) return;
    const inCart = posCart.filter(item => item.id === pid || (item.p && item.p.id === pid));
    const qty = inCart.reduce((s, it) => s + it.cant, 0);
    if (qty > 0) {
      badge.textContent = qty;
      badge.classList.remove('hidden');
    } else {
      badge.textContent = '0';
      badge.classList.add('hidden');
    }
  });

  // Render Modern Ticket List (Desktop) & Drawer List (Mobile)
  if (posCart.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    if (ticketList) {
      ticketList.querySelectorAll('.pos-ticket-item').forEach(el => el.remove());
    }
    if (subtotalEl) subtotalEl.textContent = 'Bs. 0.00';
    if (discountEl) discountEl.textContent = '- Bs. 0.00';
    if (totalEl) totalEl.textContent = 'Bs. 0.00';
    if (btnCobrar) btnCobrar.disabled = true;

    if (legacyContainer) {
      legacyContainer.innerHTML = '<div class="pos-cart-empty"><span style="font-size:2.2rem;margin-bottom:6px;display:block">🛒</span><p style="margin:0;font-weight:600;color:var(--text)">Carrito vacío</p></div>';
    }

    if (mobileDrawerItemsContainer) {
      mobileDrawerItemsContainer.innerHTML = '<div style="text-align:center; padding: 16px 8px; color: var(--mobile-pos-on-surface-variant); font-size: 11px;">Carrito de venta vacío</div>';
    }

    calculateChange();
    updateMobileChangeCalculation();
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  if (btnCobrar) btnCobrar.disabled = false;

  if (subtotalEl) subtotalEl.textContent = 'Bs. ' + subtotal.toFixed(2);
  if (discountEl) discountEl.textContent = '- Bs. ' + (currentDiscount || 0).toFixed(2);
  if (totalEl) totalEl.textContent = 'Bs. ' + totalFinal.toFixed(2);

  const itemsHtml = posCart.map(item => {
    const itemSubtotal = item.cant * item.precio;
    const formatName = item.formatoVenta?.nombre && item.formatoVenta.id !== 'unidad'
      ? ` (${escHTML(item.formatoVenta.nombre)})`
      : '';
    const itemPhoto = item.p?.foto;
    const itemThumb = itemPhoto
      ? `<img src="${itemPhoto}" class="pos-item-thumb-img" alt="${escHTML(item.p.nombre)}">`
      : `<div class="pos-item-thumb-placeholder"><span class="material-symbols-outlined">${item.p?.isCombo ? 'local_mall' : 'liquor'}</span></div>`;
    return `
      <div class="pos-ticket-item-card pos-ticket-item" id="ticket-item-${escHTML(item.id)}">
        <div class="pos-item-thumb-wrap">
          ${itemThumb}
        </div>
        <div class="pos-item-info">
          <h4 class="pos-item-title" title="${escHTML(item.p.nombre)}${formatName}">${escHTML(item.p.nombre)}${formatName}</h4>
          <div class="pos-item-price-unit">Bs. ${item.precio.toFixed(2)} c/u</div>
        </div>
        <div class="pos-item-qty-wrap">
          <button type="button" class="pos-btn-qty" onclick="updatePOSQty('${item.id}', -1)" title="Restar">-</button>
          <span class="pos-item-qty-val">${item.cant}</span>
          <button type="button" class="pos-btn-qty" onclick="updatePOSQty('${item.id}', 1)" title="Sumar">+</button>
        </div>
        <div class="pos-item-total-col">
          <div class="pos-item-total-val">Bs. ${itemSubtotal.toFixed(2)}</div>
          <button type="button" class="pos-item-remove-btn" onclick="removeFromPOS('${item.id}')" title="Quitar">Quitar</button>
        </div>
      </div>
    `;
  }).join('');

  if (ticketList) {
    ticketList.innerHTML = `<div class="pos-ticket-empty-state" id="ticket-empty-state" style="display:none">
      <div class="pos-ticket-empty-icon">
        <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>
      </div>
      <p class="title">Carrito de venta vacío</p>
      <p class="sub">Haz clic en cualquier producto o combo para añadirlo al ticket.</p>
    </div>` + itemsHtml;
  }

  if (legacyContainer) {
    legacyContainer.innerHTML = itemsHtml;
  }

  if (mobileDrawerItemsContainer) {
    mobileDrawerItemsContainer.innerHTML = posCart.map(item => {
      const itemSubtotal = item.cant * item.precio;
      const formatName = item.formatoVenta?.nombre && item.formatoVenta.id !== 'unidad'
        ? ` (${escHTML(item.formatoVenta.nombre)})`
        : '';
      const mPhoto = item.p?.foto;
      const mThumb = mPhoto
        ? `<img src="${mPhoto}" class="pos-mobile-thumb-img" alt="${escHTML(item.p.nombre)}">`
        : `<div class="pos-mobile-thumb-placeholder"><span class="material-symbols-outlined">${item.p?.isCombo ? 'local_mall' : 'liquor'}</span></div>`;
      return `
        <div class="pos-mobile-drawer-cart-item">
          <div class="pos-mobile-thumb-wrap">
            ${mThumb}
          </div>
          <div class="item-main">
            <span class="item-name" title="${escHTML(item.p.nombre)}${formatName}">${escHTML(item.p.nombre)}${formatName}</span>
            <span class="item-unit-price">Bs. ${item.precio.toFixed(2)} c/u</span>
          </div>
          <div class="item-stepper">
            <button type="button" onclick="updatePOSQty('${item.id}', -1)" title="Restar">-</button>
            <span class="qty">${item.cant}</span>
            <button type="button" onclick="updatePOSQty('${item.id}', 1)" title="Sumar">+</button>
          </div>
          <span class="item-total">Bs. ${itemSubtotal.toFixed(2)}</span>
          <button type="button" class="item-del" onclick="removeFromPOS('${item.id}')" title="Eliminar">&times;</button>
        </div>
      `;
    }).join('');
  }

  calculateChange();
  updateMobileChangeCalculation();
};

window.selectPaymentMethod = function(method) {
  posPaymentMethod = method;
  window.posPaymentMethod = method;

  const btnEf = document.getElementById('pay-btn-efectivo');
  const btnQr = document.getElementById('pay-btn-qr');
  const btnTj = document.getElementById('pay-btn-tarjeta');

  if (btnEf) btnEf.classList.toggle('active', method === 'efectivo');
  if (btnQr) btnQr.classList.toggle('active', method === 'qr');
  if (btnTj) btnTj.classList.toggle('active', method === 'tarjeta');

  // Mobile payment method buttons
  document.querySelectorAll('#payment-methods .pos-mobile-method-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });

  const cashPanel = document.getElementById('cash-calculator-panel');
  if (cashPanel) {
    cashPanel.style.display = (method === 'efectivo') ? 'flex' : 'none';
  }

  const qrOpts = document.getElementById('posQROptions');
  if (qrOpts) {
    qrOpts.style.display = (method === 'qr') ? 'flex' : 'none';
  }

  const mobileCashSection = document.getElementById('cash-calculator-section');
  const mobileQROpts = document.getElementById('modal-qr-accounts');
  if (mobileCashSection) {
    mobileCashSection.style.display = (method === 'efectivo') ? 'block' : 'none';
  }
  if (mobileQROpts) {
    mobileQROpts.style.display = (method === 'qr') ? 'block' : 'none';
  }

  // Legacy sync
  const oldCash = document.getElementById('posPayCash');
  const oldQR = document.getElementById('posPayQR');
  if (oldCash) oldCash.classList.toggle('active', method === 'efectivo');
  if (oldQR) oldQR.classList.toggle('active', method === 'qr');

  calculateChange();
  updateMobileChangeCalculation();
};
window.setPOSPayment = window.selectPaymentMethod;

window.setMobilePaymentMethod = function(method) {
  window.selectPaymentMethod(method);
};

window.openPOSMobilePaymentSheet = function() {
  const total = posCart.reduce((sum, item) => sum + (item.cant * item.precio), 0) - (currentDiscount || 0);
  if (posCart.length === 0 || total <= 0) {
    showPOSToast("Agregue productos antes de cobrar");
    return;
  }
  const modal = document.getElementById('payment-modal-backdrop');
  if (modal) {
    modal.classList.add('open');
  }
  window.mobileCashTendered = total;
  updateMobileChangeCalculation();
};

window.closePOSMobilePaymentSheet = function() {
  const modal = document.getElementById('payment-modal-backdrop');
  if (modal) {
    modal.classList.remove('open');
  }
};

window.mobileCashTendered = 0;

window.setMobileCashAmount = function(val) {
  const subtotal = posCart.reduce((sum, item) => sum + (item.cant * item.precio), 0);
  const total = Math.max(0, subtotal - (currentDiscount || 0));

  if (val === 'exact') {
    window.mobileCashTendered = total;
  } else {
    window.mobileCashTendered = parseFloat(val) || 0;
  }

  const desktopCashInput = document.getElementById('cash-received-input');
  if (desktopCashInput) {
    desktopCashInput.value = window.mobileCashTendered.toFixed(2);
  }

  updateMobileChangeCalculation();
};

window.updateMobileChangeCalculation = function() {
  const subtotal = posCart.reduce((sum, item) => sum + (item.cant * item.precio), 0);
  const total = Math.max(0, subtotal - (currentDiscount || 0));

  const tenderedEl = document.getElementById('tendered-display');
  const changeEl = document.getElementById('calculated-change-value');
  const noteEl = document.getElementById('change-note');

  if (!tenderedEl || !changeEl) return;

  const tendered = (typeof window.mobileCashTendered === 'number' && window.mobileCashTendered >= 0)
    ? window.mobileCashTendered
    : total;
  tenderedEl.textContent = `Bs. ${tendered.toFixed(2)}`;

  const diff = tendered - total;
  const change = diff > 0 ? diff : 0;
  changeEl.textContent = `Bs. ${change.toFixed(2)}`;

  if (noteEl) {
    if (diff < -0.01) {
      noteEl.textContent = `Faltan Bs. ${Math.abs(diff).toFixed(2)}`;
      noteEl.style.color = 'var(--mobile-pos-error)';
    } else {
      noteEl.textContent = 'Listo para entregar';
      noteEl.style.color = '';
    }
  }
};

window.confirmMobileCheckout = function() {
  const total = posCart.reduce((sum, item) => sum + (item.cant * item.precio), 0) - (currentDiscount || 0);
  if (posCart.length === 0 || total <= 0) {
    showPOSToast("No hay productos en el ticket");
    return;
  }

  const desktopCashInput = document.getElementById('cash-received-input');
  if (desktopCashInput && posPaymentMethod === 'efectivo') {
    desktopCashInput.value = (window.mobileCashTendered || total).toFixed(2);
  }

  const saleNum = currentTicketNumber || (window.ventas?.length || 0) + 1001;
  closePOSMobilePaymentSheet();
  checkoutPOS();
  showPOSToast(`¡Venta #${saleNum} cobrada (Bs. ${total.toFixed(2)})!`);
};

window.syncMobileSearch = function(val) {
  const clearBtn = document.getElementById('mobile-clear-search');
  if (clearBtn) {
    clearBtn.style.display = val && val.trim().length > 0 ? 'flex' : 'none';
  }
  const desktopSearch = document.getElementById('product-search');
  if (desktopSearch && desktopSearch.value !== val) {
    desktopSearch.value = val;
  }
  filterPOSGrid();
};

window.clearMobileSearch = function() {
  const mobileInput = document.getElementById('mobile-product-search-input');
  if (mobileInput) mobileInput.value = '';
  const clearBtn = document.getElementById('mobile-clear-search');
  if (clearBtn) clearBtn.style.display = 'none';

  const desktopSearch = document.getElementById('product-search');
  if (desktopSearch) desktopSearch.value = '';

  filterPOSGrid();
};

window.triggerMobileScanner = function() {
  const code = prompt("Ingresa el código de barras o escanea con lector:");
  if (!code) return;
  const p = (window.productos || []).find(x => 
    String(x.codigoBarras || '').trim() === code.trim() ||
    String(x.codigo || '').trim() === code.trim()
  );
  if (p) {
    addToPOS(p.id);
    showPOSToast(`¡${p.nombre} escaneado!`);
  } else {
    showPOSToast(`Código ${code} no encontrado`);
  }
};

window.calculateChange = function() {
  const subtotal = posCart.reduce((s, i) => s + (i.cant * i.precio), 0);
  const total = Math.max(0, subtotal - (currentDiscount || 0));
  const cashInput = document.getElementById('cash-received-input');
  const changeDisplay = document.getElementById('change-display');
  if (!changeDisplay) return;

  if (posPaymentMethod !== 'efectivo') {
    changeDisplay.textContent = 'Bs. 0.00';
    changeDisplay.style.color = 'var(--pos-emerald)';
    return;
  }

  const received = parseFloat(cashInput?.value) || 0;
  if (received <= 0) {
    changeDisplay.textContent = 'Bs. 0.00';
    changeDisplay.style.color = 'var(--pos-emerald)';
    return;
  }

  const diff = received - total;
  if (diff >= 0) {
    changeDisplay.textContent = 'Bs. ' + diff.toFixed(2);
    changeDisplay.style.color = 'var(--pos-emerald)';
  } else {
    changeDisplay.textContent = 'Faltan Bs. ' + Math.abs(diff).toFixed(2);
    changeDisplay.style.color = '#ef4444';
  }
};

window.addCashQuick = function(amount) {
  const cashInput = document.getElementById('cash-received-input');
  if (!cashInput) return;
  cashInput.value = amount.toFixed(2);
  calculateChange();
};

window.setExactPayment = function() {
  const cashInput = document.getElementById('cash-received-input');
  if (!cashInput) return;
  const subtotal = posCart.reduce((s, i) => s + (i.cant * i.precio), 0);
  const total = Math.max(0, subtotal - (currentDiscount || 0));
  cashInput.value = total.toFixed(2);
  calculateChange();
};

window.changeCustomerName = function() {
  const nuevo = prompt('Nombre o Razón Social del Cliente:', currentCustomerName === 'Consumidor Final (S/N)' ? '' : currentCustomerName);
  if (nuevo !== null) {
    currentCustomerName = nuevo.trim() || 'Consumidor Final (S/N)';
    const el = document.getElementById('ticket-client-name');
    if (el) el.textContent = currentCustomerName;
  }
};

window.applyPromptDiscount = function() {
  const subtotal = posCart.reduce((s, i) => s + (i.cant * i.precio), 0);
  const actual = currentDiscount || 0;
  const input = prompt(`Descuento a aplicar en Bs. (Subtotal: Bs. ${subtotal.toFixed(2)}):`, actual > 0 ? actual : '');
  if (input === null) return;
  const val = parseFloat(input) || 0;
  if (val < 0) {
    toast('El descuento no puede ser negativo', 'warning');
    return;
  }
  if (val > subtotal) {
    toast('El descuento no puede ser mayor al subtotal', 'warning');
    return;
  }
  currentDiscount = val;
  updatePOSCart();
  toast(val > 0 ? `Descuento de Bs. ${val.toFixed(2)} aplicado` : 'Descuento eliminado', 'info');
};

window.checkoutPOS = function() {
  if (posCart.length === 0) return;

  const btn = document.getElementById('btn-complete-sale') || document.getElementById('posCheckoutBtn');
  if (btn) {
    btn.dataset.prevText = btn.innerHTML;
    btn.innerHTML = '<span>Procesando venta...</span>';
    btn.disabled = true;
  }

  const fechaVenta = new Date().toISOString();

  try {
    // ── Pre-validación de stock por producto ──
    const stockRequerido = {};
    for (const item of posCart) {
      if (item.p.isCombo && item.p.comboRef) {
        for (const comp of item.p.comboRef.componentes) {
          const pr = (window.productos || []).find(x => x.id === comp.productoId);
          if (!pr) { toast('Producto del combo ya no existe', 'error'); return; }
          const req = comp.cantidad * item.cant;
          stockRequerido[comp.productoId] = (stockRequerido[comp.productoId] || 0) + req;
        }
      } else {
        const unidsPorEmp = (item.formatoVenta && item.formatoVenta.unidades) || item.unidadesPorEmpaque || 1;
        const reqUnid = item.cant * unidsPorEmp;
        stockRequerido[item.p.id] = (stockRequerido[item.p.id] || 0) + reqUnid;
      }
    }
    for (const [pid, reqTotal] of Object.entries(stockRequerido)) {
      const pr = (window.productos || []).find(x => x.id === pid);
      if (!pr) { toast('Producto no encontrado', 'error'); return; }
      const disp = typeof getTotalUnidadesBase === 'function' ? getTotalUnidadesBase(pr) : getStockTotal(pr);
      if (disp < reqTotal) {
        toast(`Stock insuficiente de ${pr.nombre}: necesitas ${reqTotal} u. pero hay ${disp}`, 'error');
        return;
      }
    }

    const subtotalBruto = posCart.reduce((s, i) => s + (i.cant * i.precio), 0);
    const totalConDescuento = Math.max(0, subtotalBruto - (currentDiscount || 0));
    const discountRatio = subtotalBruto > 0 ? (totalConDescuento / subtotalBruto) : 1;

    // Validación de efectivo si se ingresó monto menor
    const cashInput = document.getElementById('cash-received-input');
    const cashReceived = parseFloat(cashInput?.value) || 0;
    if (posPaymentMethod === 'efectivo' && cashReceived > 0 && cashReceived < totalConDescuento) {
      const confirmaMenor = confirm(`El monto recibido (Bs. ${cashReceived.toFixed(2)}) es menor al total (Bs. ${totalConDescuento.toFixed(2)}).\n¿Deseas registrar la venta de todos modos?`);
      if (!confirmaMenor) return;
    }

    if (!currentTicketNumber) {
      currentTicketNumber = (window.ventas?.length || 0) + 1001;
    }

    const ventasRegistradas = [];

    posCart.forEach(item => {
      const p = item.p;
      const cant = item.cant;
      const precio = item.precio;
      const subtotalItem = cant * precio;
      const totalItem = parseFloat((subtotalItem * discountRatio).toFixed(2));
      const descuentoItem = parseFloat((subtotalItem - totalItem).toFixed(2));

      if (p.isCombo) {
        const combo = p.comboRef;
        let lotesAfectadosTotales = [];
        let costoTotal = 0;

        combo.componentes.forEach(cItem => {
          const reqCant = cItem.cantidad * cant;
          const { lotesAfectados, noCumplido } = descontarStockFEFO(cItem.productoId, reqCant, 'unidad');
          if (noCumplido > 0) {
            console.warn('FEFO: no se pudo descontar', noCumplido, 'uds de', cItem.productoId);
          }
          costoTotal += lotesAfectados.reduce((s, l) => s + (l.cantidadDescontada * l.costoUnitario), 0);
          const productoNombre = (window.productos || []).find(x => x.id === cItem.productoId)?.nombre || '';
          lotesAfectados.forEach(l => {
            l.productoId = cItem.productoId;
            l.comboItemNombre = productoNombre;
            lotesAfectadosTotales.push(l);
          });
        });

        const venta = {
          id: genId(), tipo: 'combo',
          productoId: combo.id, productoNombre: p.nombre, productomarca: '',
          categoria: 'Combo', cantidad: cant,
          cantidadPacks: 1, packLabel: '',
          precioUnit: precio, subtotal: subtotalItem, descuento: descuentoItem, total: totalItem, costo: costoTotal,
          ganancia: totalItem - costoTotal, pago: posPaymentMethod,
          cliente: currentCustomerName,
          ticketId: currentTicketNumber,
          nota: 'Combo POS #' + currentTicketNumber + (currentCustomerName ? ' (' + currentCustomerName + ')' : ''),
          fecha: nowLocal(), fechaRegistro: fechaVenta,
          lotesAfectados: lotesAfectadosTotales
        };
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
        const ganancia = totalItem - costoTotal;
        const esPaquete = unidadesPorEmp > 1;
        const empNombre = esPaquete ? ((formato && formato.nombre) || getNombreEmpaque(p, formatoId)) : '';

        const venta = {
          id: genId(), tipo: 'individual',
          productoId: p.id, productoNombre: p.nombre, productomarca: p.marca || '',
          presentacion: p.presentacion || '',
          categoria: p.categoria, cantidad: cant * unidadesPorEmp,
          cantidadPacks: esPaquete ? cant : 0,
          packLabel: esPaquete ? empNombre : '',
          precioUnit: precio, subtotal: subtotalItem, descuento: descuentoItem, total: totalItem, costo: costoTotal,
          ganancia, pago: posPaymentMethod,
          cliente: currentCustomerName,
          ticketId: currentTicketNumber,
          nota: 'Venta POS #' + currentTicketNumber + (esPaquete ? ` (${cant} ${empNombre})` : '') + (currentCustomerName ? ' (' + currentCustomerName + ')' : ''),
          fecha: nowLocal(), fechaRegistro: fechaVenta,
          lotesAfectados
        };
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

    // Registrar en log de actividad
    if (window.registrarActividad) {
      const items = ventasRegistradas.map(v => v.productoNombre).join(', ');
      registrarActividad('venta', `Ticket #${currentTicketNumber}: ${items} — Bs.${totalConDescuento.toFixed(2)} (${posPaymentMethod})`);
    }

    const changeAmount = (posPaymentMethod === 'efectivo' && cashReceived >= totalConDescuento)
      ? (cashReceived - totalConDescuento)
      : 0;

    lastCompletedSale = {
      ticketId: currentTicketNumber,
      client: currentCustomerName,
      method: posPaymentMethod,
      total: totalConDescuento,
      change: changeAmount,
      items: [...posCart],
      date: new Date()
    };

    // Poblar y abrir Modal de Recibo
    const mTicket = document.getElementById('modal-ticket-id');
    const mClient = document.getElementById('modal-client-name');
    const mMethod = document.getElementById('modal-payment-method');
    const mTotal = document.getElementById('modal-total-paid');
    const mChange = document.getElementById('modal-change-returned');
    const receiptModal = document.getElementById('receipt-modal');

    if (mTicket) mTicket.textContent = '#' + currentTicketNumber;
    if (mClient) mClient.textContent = currentCustomerName;
    if (mMethod) mMethod.textContent = posPaymentMethod.toUpperCase();
    if (mTotal) mTotal.textContent = 'Bs. ' + totalConDescuento.toFixed(2);
    if (mChange) mChange.textContent = 'Bs. ' + changeAmount.toFixed(2);
    if (receiptModal) receiptModal.classList.add('active');

    // Reset de la venta actual
    posCart = [];
    currentDiscount = 0;
    if (cashInput) cashInput.value = '';

    updatePOSCart();
    renderPOSProducts();
    renderCombosVenta();
    renderPOSCategoryChips();
    actualizarMetricasTurnoPOS();

    if (typeof renderVentasStats === 'function') renderVentasStats();
    if (typeof renderVentasHoy === 'function') renderVentasHoy();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (window.renderAllCharts) renderAllCharts();

  } catch (err) {
    toast('Error procesando venta: ' + err.message, 'error');
    console.error('Error en checkoutPOS:', err);
  } finally {
    if (btn) {
      btn.innerHTML = btn.dataset.prevText || '<span>Cobrar Ticket (F12)</span>';
      btn.disabled = false;
    }
  }
};

window.closeReceiptModal = function() {
  const modal = document.getElementById('receipt-modal');
  if (modal) modal.classList.remove('active');

  // Siguiente ticket
  currentTicketNumber = (window.ventas?.length || 0) + 1001;
  const ticketIdEl = document.getElementById('current-ticket-id');
  if (ticketIdEl) ticketIdEl.textContent = '#' + currentTicketNumber;

  currentCustomerName = 'Consumidor Final (S/N)';
  const clientEl = document.getElementById('ticket-client-name');
  if (clientEl) clientEl.textContent = currentCustomerName;

  currentDiscount = 0;
  const cashInput = document.getElementById('cash-received-input');
  if (cashInput) cashInput.value = '';
  calculateChange();

  const searchInput = document.getElementById('product-search');
  if (searchInput) searchInput.focus();
};

window.printLastReceipt = function() {
  if (!lastCompletedSale) {
    window.print();
    return;
  }
  const sale = lastCompletedSale;
  const itemsRows = sale.items.map(it => `
    <tr>
      <td style="text-align:left;padding:3px 0;">${escHTML(it.p.nombre)}</td>
      <td style="text-align:center;padding:3px 0;">${it.cant}</td>
      <td style="text-align:right;padding:3px 0;">Bs.${(it.cant * it.precio).toFixed(2)}</td>
    </tr>
  `).join('');

  const printWindow = window.open('', '_blank', 'width=380,height=600');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>Ticket #${sale.ticketId}</title>
      <style>
        @page { margin: 0; size: 80mm auto; }
        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 12px; color: #000; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0; }
        .bold { font-weight: bold; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
      </style>
    </head>
    <body>
      <div class="center">
        <h2 style="margin:0;font-size:16px;">TIA ELI LICORERIA</h2>
        <div style="font-size:10px;">Control de Ventas e Inventario</div>
        <div class="divider"></div>
        <div class="bold">TICKET #${sale.ticketId}</div>
        <div style="font-size:10px;">${new Date(sale.date).toLocaleString('es-BO')}</div>
        <div style="font-size:10px;">Cliente: ${escHTML(sale.client)}</div>
      </div>
      <div class="divider"></div>
      <table>
        <thead>
          <tr style="border-bottom:1px solid #000;">
            <th style="text-align:left">Detalle</th>
            <th style="text-align:center">Cant</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      <div class="divider"></div>
      <div class="row bold" style="font-size:13px;">
        <span>TOTAL:</span>
        <span>Bs. ${sale.total.toFixed(2)}</span>
      </div>
      <div class="row">
        <span>Método:</span>
        <span style="text-transform:uppercase">${escHTML(sale.method)}</span>
      </div>
      ${sale.method === 'efectivo' ? `
      <div class="row">
        <span>Cambio:</span>
        <span>Bs. ${sale.change.toFixed(2)}</span>
      </div>
      ` : ''}
      <div class="divider"></div>
      <div class="center" style="font-size:10px;margin-top:10px;">
        ¡Gracias por su compra!<br>
        Vuelva pronto
      </div>
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

window.openCashCloseModal = function() {
  const metrics = calcularMetricasTurnoHoy();
  const initCash = 300.00;
  const totalCashToDeliver = initCash + metrics.hoyEfectivo;

  const initCashEl = document.getElementById('close-initial-cash');
  const cashSalesEl = document.getElementById('close-cash-sales');
  const digitalSalesEl = document.getElementById('close-digital-sales');
  const totalCashEl = document.getElementById('close-total-cash');

  if (initCashEl) initCashEl.textContent = 'Bs. ' + initCash.toFixed(2);
  if (cashSalesEl) cashSalesEl.textContent = 'Bs. ' + metrics.hoyEfectivo.toFixed(2);
  if (digitalSalesEl) digitalSalesEl.textContent = 'Bs. ' + metrics.hoyDigital.toFixed(2);
  if (totalCashEl) totalCashEl.textContent = 'Bs. ' + totalCashToDeliver.toFixed(2);

  const modal = document.getElementById('cash-close-modal');
  if (modal) modal.classList.add('active');
};

window.closeCashCloseModal = function() {
  const modal = document.getElementById('cash-close-modal');
  if (modal) modal.classList.remove('active');
};

window.confirmarCierreTurno = function() {
  const metrics = calcularMetricasTurnoHoy();
  if (window.registrarActividad) {
    window.registrarActividad('caja', `Arqueo y Cierre: Efectivo Bs.${metrics.hoyEfectivo.toFixed(2)}, Digital Bs.${metrics.hoyDigital.toFixed(2)}, Tickets: ${metrics.hoyCount}`);
  }
  toast('Cierre de caja registrado exitosamente', 'success');
  closeCashCloseModal();
};

window.toggleShortcutsModal = function(show) {
  const modal = document.getElementById('shortcuts-modal');
  if (!modal) return;
  if (show === undefined) modal.classList.toggle('active');
  else if (show) modal.classList.add('active');
  else modal.classList.remove('active');
};

window.toggleMobileTicket = function() {
  const panel = document.getElementById('pos-ticket-panel');
  if (panel) panel.classList.toggle('open');
};

// Retrocompatibilidad con nombres anteriores de funciones
window.togglePosCart = function(forceClose) {
  const panel = document.getElementById('pos-ticket-panel');
  if (!panel) return;
  if (forceClose === true) panel.classList.remove('open');
  else panel.classList.toggle('open');
};
window.togglePOSCart = window.togglePosCart;
window.closePOSCart = function() {
  const panel = document.getElementById('pos-ticket-panel');
  if (panel) panel.classList.remove('open');
};

// Atajos globales de teclado
window.addEventListener('keydown', function(e) {
  const posSec = document.getElementById('section-pos');
  if (!posSec || !posSec.classList.contains('active')) return;

  const receiptModal = document.getElementById('receipt-modal');
  if (receiptModal && receiptModal.classList.contains('active')) {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeReceiptModal();
      return;
    }
  }

  if (e.key === 'Escape') {
    closeReceiptModal();
    closeCashCloseModal();
    toggleShortcutsModal(false);
    return;
  }

  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
  const isInputFocused = (activeTag === 'input' || activeTag === 'textarea');

  if (e.key === 'F2' || (e.key === '/' && !isInputFocused)) {
    e.preventDefault();
    const s = document.getElementById('product-search');
    if (s) { s.focus(); s.select(); }
    return;
  }

  if (e.key === 'F1') {
    e.preventDefault();
    selectPaymentMethod('efectivo');
    return;
  }

  if (e.key === 'F3') {
    e.preventDefault();
    selectPaymentMethod('qr');
    return;
  }

  if (e.key === 'F4') {
    e.preventDefault();
    selectPaymentMethod('tarjeta');
    return;
  }

  if (e.key === 'F12') {
    e.preventDefault();
    checkoutPOS();
    return;
  }
});

// ── Aliases de compatibilidad para NUEVO REGISTRO / POS ──
window.removeFromPOS = function(pid) {
  posCart = posCart.filter(x => x.id !== pid);
  updatePOSCart();
};
window.removeFromCart = window.removeFromPOS;
window.addToCart = window.addToPOS;
window.changeQty = window.updatePOSQty;
window.clearCurrentSale = window.clearPOSCart;
window.completeSale = window.checkoutPOS;
window.printMockReceipt = window.printLastReceipt;
window.setCategory = window.setPOSFilter;
