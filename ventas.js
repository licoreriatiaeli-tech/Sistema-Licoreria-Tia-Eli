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
function saveCombos() {
  localStorage.setItem('tiaeli_combos', JSON.stringify(combos));
  window.combos = combos;
  if (window.syncSaveCombo) {
    combos.forEach(c => window.syncSaveCombo(c));
  }
}
window.saveCombos = saveCombos;

function nowLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// ── PACK SIZES ──
function getPackSizes(p) {
  const nom = p.nombre.toLowerCase();
  const cat = (p.categoria || '').toLowerCase();
  if (nom.includes('corona')) return [{id:'unidad',label:'Unidad',mult:1}, {id:'caja',label:'Caja (24 uds)',mult:24}];
  if (cat==='cervezas'||nom.includes('cerveza')||nom.includes('pilsener')||nom.includes('paceña')||nom.includes('huari')) return [{id:'unidad',label:'Unidad',mult:1}, {id:'paquete',label:'Paquete (12 uds)',mult:12}];
  if (p.packs && p.packs.length) return p.packs;
  return [{id:'unidad',label:'Unidad',mult:1}];
}

let selectedPack = {id:'unidad', mult:1, label:'Unidad'};

function renderPackSizes(p) {
  const wrap = document.getElementById('vPackWrap');
  if (!wrap) return;
  const packs = getPackSizes(p);
  if (packs.length <= 1) { wrap.style.display='none'; selectedPack=packs[0]; return; }
  selectedPack = packs[0];
  wrap.style.display = 'block';
  wrap.innerHTML = '<label class="pack-label">Presentación de venta</label><div class="pack-btns">' +
    packs.map(pk => `<button type="button" class="pack-btn${pk.id==='unidad'?' active':''}" data-pack='${JSON.stringify(pk)}'>${pk.label}</button>`).join('') + '</div>';
  wrap.querySelectorAll('.pack-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPack = JSON.parse(btn.dataset.pack);
      wrap.querySelectorAll('.pack-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      calcVentaPreview();
    });
  });
}

// ── POBLAR SELECT ──
function poblarSelectProductos() {
  const sel = document.getElementById('vProducto');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Seleccionar producto...</option>';
  const grupos = {};
  [...(window.productos||[])].sort((a,b)=>a.categoria.localeCompare(b.categoria)||a.nombre.localeCompare(b.nombre)).forEach(p => {
    if (!grupos[p.categoria]) grupos[p.categoria]=[];
    grupos[p.categoria].push(p);
  });
  Object.entries(grupos).forEach(([cat,items]) => {
    const og = document.createElement('optgroup'); og.label=cat;
    items.forEach(p => {
      const opt = document.createElement('option'); opt.value=p.id;
      opt.textContent = p.nombre+(p.marca?' — '+p.marca:'')+' ['+p.stock+']';
      if (p.stock===0) { opt.textContent+=' ⚠ SIN STOCK'; opt.style.color='var(--red)'; }
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  if (cur) sel.value=cur;
}
window.poblarSelectProductos = poblarSelectProductos;

// ── PRODUCT SELECTION (solo si existe el form antiguo) ──
(function() {
  const vProducto = document.getElementById('vProducto');
  if (!vProducto) return; // El formulario antiguo ya no existe en el HTML
  
  vProducto.addEventListener('change', function() {
    const p = (window.productos||[]).find(x=>x.id===this.value);
    const info = document.getElementById('vStockInfo');
    const bar = document.getElementById('vStockBar');
    selectedPack={id:'unidad',mult:1,label:'Unidad'};
    if (p) {
      renderPackSizes(p);
      const pv = p.enOferta ? p.precioOferta : p.venta;
      const stockColor = p.stock===0?'var(--red)':p.stock<=p.stockMin?'var(--orange)':'var(--green)';
      const cantLotes = (p.lotes||[]).filter(l=>l.cantidad>0).length;
      let vencHtml = '';
      if (p.vencimiento) {
        const dias = Math.ceil((new Date(p.vencimiento) - new Date()) / 86400000);
        const colorV = dias<=7 ? 'var(--red)' : dias<=15 ? 'var(--orange)' : 'var(--text2)';
        vencHtml = `&nbsp; Próx. vencimiento: <b style="color:${colorV}">${new Date(p.vencimiento).toLocaleDateString('es-BO')}</b>`;
      }
      if (bar) bar.innerHTML = `<b>${p.nombre}${p.marca?' — '+p.marca:''}</b> &nbsp; Stock Total: <b style="color:${stockColor}">${p.stock} ${p.unidad}</b>${vencHtml} &nbsp; Lotes: <b>${cantLotes}</b><br><small style="color:var(--text3);margin-top:5px;display:block">ℹ️ Al vender, se descontará automáticamente del lote que venza más pronto (FEFO).</small>`;
      if (info) info.style.display='block';
      const vPrecio = document.getElementById('vPrecio');
      if (pv>0 && vPrecio) vPrecio.value=pv.toFixed(2);
      calcVentaPreview();
    } else {
      if (info) info.style.display='none';
      const w=document.getElementById('vPackWrap'); if(w)w.style.display='none';
    }
  });
})();

// ── CALC PREVIEW ──
function calcVentaPreview() {
  const pidEl = document.getElementById('vProducto');
  if (!pidEl) return;
  const pid = pidEl.value;
  const cantEl = document.getElementById('vCantidad');
  const precioEl = document.getElementById('vPrecio');
  if (!cantEl || !precioEl) return;
  const cant = (parseInt(cantEl.value)||0)*(selectedPack.mult||1);
  const precio = parseFloat(precioEl.value)||0;
  const descPct = parseFloat(document.getElementById('vDescPct')?.value)||0;
  const descBs = parseFloat(document.getElementById('vDescBs')?.value)||0;
  const p = (window.productos||[]).find(x=>x.id===pid);
  const preview = document.getElementById('ventaPreview');
  if (!preview) return;
  if (p && cant>0 && precio>0) {
    const subtotal = cant*precio;
    const descMonto = descBs>0 ? descBs : (descPct>0 ? subtotal*(descPct/100) : 0);
    const total = Math.max(0, subtotal-descMonto);
    const ganancia = (precio-p.costo)*cant - descMonto;
    const vpSub = document.getElementById('vp-subtotal');
    if (vpSub) vpSub.textContent = 'Bs.'+subtotal.toFixed(2)+(selectedPack.mult>1?' ('+cant+' uds)':'');
    const descRow = document.getElementById('vp-desc-row');
    const descEl = document.getElementById('vp-desc');
    if (descMonto>0 && descRow && descEl) { descRow.style.display='flex'; descEl.textContent='-Bs.'+descMonto.toFixed(2); } else if(descRow) descRow.style.display='none';
    const vpTotal = document.getElementById('vp-total');
    if (vpTotal) vpTotal.textContent = 'Bs.'+total.toFixed(2);
    const gEl=document.getElementById('vp-ganancia');
    if (gEl) { gEl.textContent='Bs.'+ganancia.toFixed(2); gEl.style.color=ganancia>=0?'var(--green)':'var(--red)'; }
    preview.style.display='block';
  } else preview.style.display='none';
}

['vCantidad','vPrecio','vDescPct','vDescBs'].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('input',calcVentaPreview);});

// ── DESCONTAR STOCK FEFO ──
function descontarStockFEFO(productoId, cantidadVendida) {
  const producto = window.productos.find(p => p.id === productoId);
  if (!producto || !producto.lotes) return [];

  // Ordenar lotes por vencimiento (FEFO)
  const lotesOrdenados = producto.lotes
    .filter(lote => lote.cantidad > 0)
    .sort((a, b) => {
      if (!a.vencimiento) return 1; if (!b.vencimiento) return -1;
      return new Date(a.vencimiento) - new Date(b.vencimiento);
    });

  let restante = cantidadVendida;
  const lotesAfectados = [];

  for (const lote of lotesOrdenados) {
    if (restante <= 0) break;
    const descontar = Math.min(lote.cantidad, restante);
    lote.cantidad -= descontar;
    restante -= descontar;

    lotesAfectados.push({
      loteIndex: producto.lotes.findIndex(l => l.id === lote.id),
      vencimiento: lote.vencimiento,
      cantidadDescontada: descontar,
      costoUnitario: lote.costo || producto.costo || 0
    });
  }

  // Recalcular stock y vencimiento global del producto
  producto.stock = producto.lotes.reduce((s, l) => s + l.cantidad, 0);
  const activos = producto.lotes.filter(l => l.cantidad > 0 && l.vencimiento);
  if (activos.length) {
    activos.sort((a,b) => new Date(a.vencimiento) - new Date(b.vencimiento));
    producto.vencimiento = activos[0].vencimiento;
  } else {
    producto.vencimiento = null;
  }
  
  // Recalcular costo promedio
  const activosCosto = producto.lotes.filter(l => l.cantidad > 0);
  if (activosCosto.length) {
    producto.costo = activosCosto.reduce((s,l)=>s+(l.cantidad*(l.costo||0)),0) / activosCosto.reduce((s,l)=>s+l.cantidad,0);
  }

  if (window.syncSaveProducto) window.syncSaveProducto(producto);
  return lotesAfectados;
}

// ── SUBMIT VENTA (solo si existe el form antiguo) ──
(function() {
  const ventaForm = document.getElementById('ventaForm');
  if (!ventaForm) return; // El formulario antiguo ya no existe

  ventaForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const pid = document.getElementById('vProducto').value;
    const cantInput = parseInt(document.getElementById('vCantidad').value)||0;
    const cant = cantInput*(selectedPack.mult||1);
    const precio = parseFloat(document.getElementById('vPrecio').value)||0;
    const pago = document.getElementById('vPago').value;
    const fechaInput = nowLocal();
    const nota = '';
    const descPct = parseFloat(document.getElementById('vDescPct')?.value)||0;
    const descBs = parseFloat(document.getElementById('vDescBs')?.value)||0;
    const p = (window.productos||[]).find(x=>x.id===pid);

    if (!p) { toast('Selecciona un producto','error'); return; }
    if (cant<=0) { toast('Cantidad inválida','error'); return; }
    if (precio<=0) { toast('Precio inválido','error'); return; }
    if (cant>p.stock) { toast('Stock insuficiente. Disponible: '+p.stock+(selectedPack.mult>1?' (necesitas '+cant+')':''),'error'); return; }

    const btnSpinner = document.getElementById('btnVentaSpinner');
    const btnText = document.getElementById('btnVentaText');
    if (btnSpinner) btnSpinner.style.display='inline-block';
    if (btnText) btnText.textContent='Registrando...';

    const lotesAfectados = descontarStockFEFO(p.id, cant);
    const costoTotal = lotesAfectados.reduce((s, l) => s + (l.cantidadDescontada * l.costoUnitario), 0);

    const subtotal = cant*precio;
    const descMonto = descBs>0?descBs:(descPct>0?subtotal*(descPct/100):0);
    const total = Math.max(0,subtotal-descMonto);
    const ganancia = total - costoTotal;

    save(); // guardar cambios en productos

    const venta = {
      id:genId(), tipo:'individual',
      productoId:p.id, productoNombre:p.nombre, productomarca:p.marca||'',
      categoria:p.categoria, cantidad:cant,
      cantidadPacks:cantInput, packLabel:selectedPack.id!=='unidad'?selectedPack.label:'',
      precioUnit:precio, subtotal, descuento:descMonto, total, costo:costoTotal,
      ganancia, pago, nota, fecha:fechaInput||nowLocal(), fechaRegistro:new Date().toISOString(),
      lotesAfectados
    };

    ventas.unshift(venta);
    saveVentas();

    renderVentasStats();
    renderVentasHoy();
    renderDashboard();
    if (window.renderAllCharts) renderAllCharts();

    if (window.animateValueElement) {
      ['stat-stock', 'stat-bajo', 'stat-vence', 'stat-valor', 'stat-ventas-hoy', 'vstat-total', 'vstat-efectivo', 'vstat-qr', 'vp-ganancia'].forEach(id => {
        let el = document.getElementById(id);
        if (el) window.animateValueElement(el.parentElement);
      });
    }

    if (btnSpinner) btnSpinner.style.display='none';
    if (btnText) btnText.textContent='Registrar Venta';
    ventaForm.reset();
    const vStockInfo = document.getElementById('vStockInfo');
    if (vStockInfo) vStockInfo.style.display='none';
    const vPackWrap = document.getElementById('vPackWrap');
    if (vPackWrap) vPackWrap.style.display='none';
    const ventaPreview = document.getElementById('ventaPreview');
    if (ventaPreview) ventaPreview.style.display='none';
    selectedPack = { mult: 1, label: '' };

    if (window.lanzarConfetti) lanzarConfetti();
    toast('Venta registrada \u2014 Bs.'+total.toFixed(2),'success');
    if (window.syncSaveVenta) { window.syncSaveVenta(venta); }
  });
})();

// Botón cancelar venta (solo si existe)
(function() {
  const btn = document.getElementById('btnVentaCancelar');
  if (btn) btn.addEventListener('click', () => navegarA('inventario'));
})();

// ── STATS HOY ──
function renderVentasStats() {
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const vh=(window.ventas||[]).filter(v=>new Date(v.fecha)>=hoy);
  const total=vh.reduce((s,v)=>s+v.total,0);
  const ef=vh.filter(v=>v.pago==='efectivo').reduce((s,v)=>s+v.total,0);
  const qr=vh.filter(v=>v.pago!=='efectivo').reduce((s,v)=>s+v.total,0);
  const set=(id,val,prefix='')=>{
    const el=document.getElementById(id);
    if(el) el.innerHTML = window.odoHtml ? window.odoHtml(val, String(val).includes('.')?'money':'int', prefix) : prefix + val;
  };
  set('vstat-total',total.toFixed(2), 'Bs.'); set('vstat-count',vh.length);
  set('vstat-efectivo',ef.toFixed(2), 'Bs.'); set('vstat-qr',qr.toFixed(2), 'Bs.');
  if(window.initOdometers) window.initOdometers();
}
window.renderVentasStats = renderVentasStats;

function pagoBadge(pago){const c=pago==='efectivo'?'pago-efectivo':pago==='qr'?'pago-qr':'pago-transferencia';return '<span class="pago-badge '+c+'">'+pago.toUpperCase()+'</span>';}

// ── VENTAS HOY LIST ──
function renderVentasHoy() {
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const list=(window.ventas||[]).filter(v=>new Date(v.fecha)>=hoy);
  const cont=document.getElementById('ventasHoyList');if(!cont)return;
  if(!list.length){cont.innerHTML='<div class="empty-state" style="padding:22px"><span class="es-icon">&#8212;</span><p>Sin ventas hoy todav\u00eda.</p></div>';return;}
  cont.innerHTML=list.map(v=>{
    const hora=new Date(v.fecha).toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'});
    const etq=v.tipo==='combo'?'<span class="combo-tag">COMBO</span>':(v.packLabel?'<span class="pack-tag">'+v.packLabel+'</span>':'');
    const desc=v.tipo==='combo'?(v.nota||''):(v.packLabel?v.cantidadPacks+' '+v.packLabel+' \u00b7 '+v.cantidad+' uds':v.cantidad+' unid');
    const descLine=v.descuento>0?` <small style="color:var(--red)">(-Bs.${v.descuento.toFixed(2)})</small>`:'';
    let lotesInfo = '';
    if (v.lotesAfectados && v.lotesAfectados.length) {
      lotesInfo = '<ul class="lotes-afectados-list">' + v.lotesAfectados.map(la => `<li>Lote ${la.loteIndex+1} (${la.cantidadDescontada} ud) ${la.vencimiento?'— '+la.vencimiento:''}</li>`).join('') + '</ul>';
    }
    return `<div class="venta-card">
      <div class="venta-card-left">
        <div class="venta-card-nombre">${v.productoNombre} ${etq}</div>
        <div class="venta-card-meta"><span>${hora}</span><span>${desc}</span>${pagoBadge(v.pago)}${v.nota&&v.tipo!=='combo'?'<span>'+v.nota+'</span>':''}</div>
        ${lotesInfo}
      </div>
      <div class="venta-card-total">
        <div class="venta-card-monto">Bs.${v.total.toFixed(2)}${descLine}</div>
        <div style="font-size:.72rem;color:${v.ganancia>=0?'var(--green)':'var(--red)'}">G: Bs.${v.ganancia.toFixed(2)}</div>
      </div>
      <button class="btn-icon danger" onclick="eliminarVenta('${v.id}')" title="Eliminar">\u2715</button>
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
      return `<span style="font-size:0.7rem;color:var(--text3);">${p.nombre} &times;${i.cantidad}</span>`;
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

function venderCombo(comboId) {
  const c=(window.combos||[]).find(x=>x.id===comboId);if(!c)return;
  const precio=parseFloat(document.getElementById('cprecio-'+comboId)?.value)||0;
  const cantCombos=parseInt(document.getElementById('ccant-'+comboId)?.value)||1;
  const pago=document.getElementById('cpago-'+comboId)?.value||'efectivo';
  if(precio<=0){toast('Ingresa el precio del combo','error');return;}
  
  for(const comp of c.componentes){const p=(window.productos||[]).find(x=>x.id===comp.productoId);if(!p){toast('Producto "'+comp.nombreRef+'" no encontrado','error');return;}if(p.stock<comp.cantidad*cantCombos){toast('Stock insuficiente de '+p.nombre,'error');return;}}
  
  let costoTotalCombo = 0;
  const lotesAfectadosTodos = [];

  c.componentes.forEach(comp => {
    const cantNecesaria = comp.cantidad * cantCombos;
    const laf = descontarStockFEFO(comp.productoId, cantNecesaria);
    const costoComp = laf.reduce((s,l)=>s+(l.cantidadDescontada*l.costoUnitario), 0);
    costoTotalCombo += costoComp;
    lotesAfectadosTodos.push(...laf);
  });
  save();

  const v={id:genId(),tipo:'combo',comboId:c.id,comboNombre:c.nombre,productoNombre:c.nombre,productomarca:'',categoria:'Combo',cantidad:cantCombos,cantidadPacks:cantCombos,packLabel:'',precioUnit:precio,subtotal:precio*cantCombos,descuento:0,total:precio*cantCombos,costo:costoTotalCombo,ganancia:(precio*cantCombos)-costoTotalCombo,pago,nota:c.descripcion||'',fecha:nowLocal(),fechaRegistro:new Date().toISOString(), lotesAfectados: lotesAfectadosTodos};
  ventas.unshift(v);saveVentas();
  renderCombosVenta();renderVentasStats();renderVentasHoy();renderDashboard();
  if(window.renderAllCharts)renderAllCharts();
  
  if (window.animateValueElement) {
    ['stat-stock', 'stat-bajo', 'stat-vence', 'stat-valor', 'stat-ventas-hoy', 'vstat-total', 'vstat-efectivo', 'vstat-qr'].forEach(id => {
      let el = document.getElementById(id);
    });
  }

  if(window.lanzarConfetti)lanzarConfetti();
  toast('Combo vendido: '+cantCombos+' \u00d7 '+c.nombre+' \u2014 Bs.'+v.total.toFixed(2),'success');
  if(window.syncSaveVenta) window.syncSaveVenta(v);
}
window.venderCombo = venderCombo;

// \u2500\u2500 HISTORIAL \u2500\u2500
function renderHistorial() {
  const q=(document.getElementById('hSearch')?.value||'').toLowerCase();
  const desde=document.getElementById('hFechaDesde')?.value;
  const hasta=document.getElementById('hFechaHasta')?.value;
  const pago=document.getElementById('hPago')?.value;
  let lista=[...(window.ventas||[])];
  if(q)lista=lista.filter(v=>v.productoNombre.toLowerCase().includes(q));
  if(desde)lista=lista.filter(v=>v.fecha>=desde);
  if(hasta)lista=lista.filter(v=>v.fecha<=hasta+'T23:59');
  if(pago)lista=lista.filter(v=>v.pago===pago);
  const tv=lista.reduce((s,v)=>s+v.total,0),tg=lista.reduce((s,v)=>s+v.ganancia,0);
  const ef=lista.filter(v=>v.pago==='efectivo').reduce((s,v)=>s+v.total,0);
  const qr=lista.filter(v=>v.pago!=='efectivo').reduce((s,v)=>s+v.total,0);
  const histResumen = document.getElementById('histResumen');
  if (histResumen) {
    histResumen.innerHTML=[
      [tv, 'Total vendido', 'Bs.', 2],
      [lista.length, 'Transacciones', '', 0],
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
  tbody.innerHTML = lista.map((v, i) => {
    const fd=new Date(v.fecha);const fs=fd.toLocaleDateString('es-BO')+' '+fd.toLocaleTimeString('es-BO',{hour:'2-digit',minute:'2-digit'});
    const etq=v.tipo==='combo'?' <span class="combo-tag">COMBO</span>':(v.packLabel?' <span class="pack-tag">'+v.packLabel+'</span>':'');
    let lotesInfo = '';
    if (v.lotesAfectados && v.lotesAfectados.length) {
      lotesInfo = '<ul class="lotes-afectados-list">' + v.lotesAfectados.map(la => `<li>Lote ${la.loteIndex+1} (${la.cantidadDescontada} ud) ${la.vencimiento?'- '+la.vencimiento:''}</li>`).join('') + '</ul>';
    }

    mobileHtml.push(`
      <div class="mobile-card" style="animation-delay:${Math.min(i*30, 600)}ms">
        <div class="mobile-card-header" style="justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div class="mobile-card-name">${v.productoNombre} ${etq}</div>
            <div style="font-size:0.75rem; color:var(--text3);">${fs}</div>
          </div>
          ${pagoBadge(v.pago)}
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

    return `<tr><td style="font-size:.76rem;color:var(--text2);white-space:nowrap">${fs}</td><td><div class="prod-name">${v.productoNombre}${etq}</div>${lotesInfo}</td><td><b>${v.cantidad}</b></td><td class="price-cost">Bs.${v.precioUnit.toFixed(2)}</td><td style="color:var(--red)">${v.descuento>0?'-Bs.'+v.descuento.toFixed(2):'-'}</td><td class="price-venta"><b>Bs.${v.total.toFixed(2)}</b></td><td>${pagoBadge(v.pago)}</td><td class="price-ganancia ${v.ganancia>=0?'pos':'neg'}">Bs.${v.ganancia.toFixed(2)}</td><td style="color:var(--text3);font-size:.76rem;max-width:110px">${v.nota||'-'}</td><td><button class="btn-icon danger" onclick="eliminarVenta('${v.id}')">\u2715</button></td></tr>`;
  }).join('');
  
  if (mobileCards) mobileCards.innerHTML = mobileHtml.join('');
}
window.renderHistorial = renderHistorial;

function exportarVentas() {
  if(!(window.ventas||[]).length){toast('No hay ventas','warning');return;}
  const h='Fecha,Tipo,Producto,Presentacion,Cantidad,PrecioUnit,Subtotal,Descuento,Total,Costo,Ganancia,Pago,Nota\n';
  const r=(window.ventas||[]).map(v=>[v.fecha,v.tipo||'individual',v.productoNombre,v.packLabel||'Unidad',v.cantidad,v.precioUnit,v.subtotal||v.total,v.descuento||0,v.total,v.costo,v.ganancia,v.pago,v.nota||''].map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+h+r],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ventas_tiaeli_'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);
  toast('CSV exportado','success');
}

// ── SEED ──
function seedCombos() {
  if((window.combos||[]).length>0)return;
}

// ── BIND ──
document.getElementById('btnFiltrarHistorial')?.addEventListener('click',renderHistorial);
document.getElementById('btnExportCSV')?.addEventListener('click',exportarVentas);
document.getElementById('hSearch')?.addEventListener('input',renderHistorial);

// ── INIT ──
seedCombos();
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
      filtrados = filtrados.filter(p => p.categoria === 'Jugos' || p.categoria === 'Galletas' || p.categoria === 'Chicles' || p.categoria === 'Otros');
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
      return nom.includes(q) || mar.includes(q);
    });
  }

  // Ordenar alfabéticamente
  filtrados.sort((a,b) => a.nombre.localeCompare(b.nombre));

  grid.innerHTML = filtrados.length ? filtrados.map(p => {
    const stock = getStockTotal(p);
    const outOfStock = stock <= 0 ? 'out-of-stock' : '';
    return `<div class="pos-card ${outOfStock}" onclick="addToPOS('${p.id}')">
              <div class="pos-card-name">${p.nombre}</div>
              <div class="pos-card-price">Bs. ${(p.venta || 0).toFixed(2)}</div>
              <div class="pos-card-stock">${stock > 0 ? stock + ' disp.' : 'Agotado'}</div>
            </div>`;
  }).join('') : '<div class="empty-state" style="padding:30px;grid-column:1/-1"><p>No se encontraron productos.</p></div>';
};

window.filterPOSGrid = function() {
  renderPOSProducts();
};

window.addToPOS = function(pid) {
  const p = productos.find(x => x.id === pid);
  if (!p) return;

  const existing = posCart.find(item => item.id === pid);
  if (existing) {
    existing.cant++;
  } else {
    posCart.push({ id: p.id, p: p, cant: 1, precio: p.venta });
  }
  updatePOSCart();
};

window.updatePOSQty = function(pid, delta) {
  const item = posCart.find(x => x.id === pid);
  if (!item) return;
  
  const nuevo = item.cant + delta;
  if (nuevo <= 0) {
    posCart = posCart.filter(x => x.id !== pid);
  } else {
    item.cant = nuevo;
  }
  updatePOSCart();
};

window.setPOSPayment = function(method) {
  window.posPaymentMethod = method;
  posPaymentMethod = method;
  const btnCash = document.getElementById('posPayCash');
  const btnQR = document.getElementById('posPayQR');
  const qrOpts = document.getElementById('posQROptions');
  
  if(btnCash) btnCash.classList.toggle('active', method === 'efectivo');
  if(btnQR) btnQR.classList.toggle('active', method === 'qr');
  if(qrOpts) qrOpts.style.display = method === 'qr' ? 'flex' : 'none';
};

window.togglePosCart = function() {
  const cart = document.getElementById('posCartContainer');
  const fabBtn = document.getElementById('posFabBtn');
  if (posCart.length === 0) {
    toast('El carrito está vacío', 'info');
    return;
  }
  if (cart) cart.classList.toggle('open');
  if (fabBtn) fabBtn.classList.toggle('open');
};

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
  const badge = document.getElementById('posFabBadge');
  if (!container) return;

  const totalItems = posCart.reduce((s, item) => s + item.cant, 0);
  if (badge) {
    if (totalItems > 0) {
      badge.style.display = 'flex';
      badge.innerText = totalItems;
    } else {
      badge.style.display = 'none';
      badge.innerText = '0';
    }
  }

  if (posCart.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px;">Carrito vacío</div>';
    if (totalAmount) totalAmount.innerText = 'Bs. 0.00';
    if (btnCheckout) btnCheckout.disabled = true;
    
    // Si el carrito está vacío y está abierto, lo cerramos
    const cartContainer = document.getElementById('posCartContainer');
    const fabBtn = document.getElementById('posFabBtn');
    if (cartContainer && cartContainer.classList.contains('open')) {
      cartContainer.classList.remove('open');
      if (fabBtn) fabBtn.classList.remove('open');
    }
    return;
  }

  if (btnCheckout) btnCheckout.disabled = false;
  let total = 0;

  container.innerHTML = posCart.map(item => {
    const subtotal = item.cant * item.precio;
    total += subtotal;
    return `<div class="pos-cart-item">
              <div class="pos-cart-item-info">
                <div class="pos-cart-item-name">${item.p.nombre}</div>
                <div class="pos-cart-item-price">Bs. ${item.precio.toFixed(2)} c/u</div>
              </div>
              <div class="pos-cart-item-controls">
                <button class="pos-btn-qty" onclick="updatePOSQty('${item.id}', -1)">-</button>
                <span class="pos-qty">${item.cant}</span>
                <button class="pos-btn-qty" onclick="updatePOSQty('${item.id}', 1)">+</button>
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
    const ventasRegistradas = [];
    
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
          const lotesAf = descontarStockFEFO(cItem.productoId, reqCant);
          costoTotal += lotesAf.reduce((s, l) => s + (l.cantidadDescontada * l.costoUnitario), 0);
          lotesAf.forEach(l => {
            l.comboItemNombre = productos.find(x => x.id === cItem.productoId)?.nombre || '';
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
        ventas.unshift(venta);
        ventasRegistradas.push(venta);
      } else {
        const lotesAfectados = descontarStockFEFO(p.id, cant);
        const costoTotal = lotesAfectados.reduce((s, l) => s + (l.cantidadDescontada * l.costoUnitario), 0);
        const ganancia = total - costoTotal;

        const venta = {
          id: genId(), tipo: 'individual',
          productoId: p.id, productoNombre: p.nombre, productomarca: p.marca||'',
          categoria: p.categoria, cantidad: cant,
          cantidadPacks: 1, packLabel: '',
          precioUnit: precio, subtotal, descuento: 0, total, costo: costoTotal,
          ganancia, pago: posPaymentMethod, nota: 'Venta desde Caja Rápida', 
          fecha: nowLocal(), fechaRegistro: fechaVenta,
          lotesAfectados
        };
        ventas.unshift(venta);
        ventasRegistradas.push(venta);
      }
    });

    save();
    saveVentas();
    
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
  
  const existing = posCart.find(x => x.id === 'combo_'+c.id);
  if (existing) {
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
  toast('Combo agregado al carrito', 'success');
};
