// ═══════════════════════════════════════════
// app.js — Core inventory logic v4 (Lotes & FEFO)
// ═══════════════════════════════════════════

let productos = JSON.parse(localStorage.getItem('tiaeli_v2') || '[]');
window.productos = productos;
window.setProductosGlobal = function(nuevos) {
  productos = nuevos;
  window.productos = nuevos;
};

const CATS = {Licores:'[L]',Cervezas:'[C]',Sodas:'[S]',Jugos:'[J]',Galletas:'[G]',Chicles:'[CH]',Otros:'[+]'};
const COLLECTION = 'inventario_tiaeli';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

// ── UTILS LOTES ──
function getStockTotal(p) {
  if (!p.lotes) return p.stock || 0;
  return p.lotes.reduce((sum, l) => sum + l.cantidad, 0);
}

function getVencimientoMasCercano(p) {
  if (!p.lotes || p.lotes.length === 0) return p.vencimiento || null;
  const activos = p.lotes.filter(l => l.cantidad > 0 && l.vencimiento);
  if (!activos.length) return null;
  activos.sort((a,b) => new Date(a.vencimiento) - new Date(b.vencimiento));
  return activos[0].vencimiento;
}

function getCostoPromedio(p) {
  if (!p.lotes || p.lotes.length === 0) return p.costo || 0;
  const activos = p.lotes.filter(l => l.cantidad > 0);
  if (!activos.length) return p.costo || 0;
  const totalValor = activos.reduce((s,l) => s + (l.cantidad * (l.costo||0)), 0);
  const totalStock = activos.reduce((s,l) => s + l.cantidad, 0);
  return totalStock > 0 ? totalValor / totalStock : 0;
}

function migrarProductosALotes() {
  let migrados = false;
  productos.forEach(p => {
    if (!p.lotes) {
      p.lotes = [{
        id: genId(),
        cantidad: p.stock || 0,
        vencimiento: p.vencimiento || '',
        fechaIngreso: p.fechaRegistro || new Date().toISOString().slice(0,10),
        costo: p.costo || 0,
        nota: "Lote original migrado"
      }];
      migrados = true;
    }
    // Sincronizar stock total
    p.stock = getStockTotal(p);
    p.vencimiento = getVencimientoMasCercano(p);
    p.costo = getCostoPromedio(p);
  });
  if (migrados) {
    save();
    console.log("Migración a lotes completada.");
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
      const fabBtn = document.getElementById('posFabBtn');
      if (cartContainer) cartContainer.classList.remove('open');
      if (fabBtn) fabBtn.classList.remove('open');
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
    
    // 1. DIBUJAR LOS DATOS (Oculto)
    if (sec === 'dashboard') { renderDashboard(); if(window.renderAllCharts) renderAllCharts(); if(window.renderCategoryGrid) renderCategoryGrid(); }
    if (sec === 'inventario') { renderTabla(); }
    if (sec === 'ventas') { if(typeof poblarSelectProductos==='function') poblarSelectProductos(); if(typeof renderVentasStats==='function') renderVentasStats(); if(typeof renderVentasHoy==='function') renderVentasHoy(); if(typeof renderCombosVenta==='function') renderCombosVenta(); }
    if (sec === 'pos') { if(typeof window.initPOS==='function') window.initPOS(); else { if(typeof renderPOSProducts==='function') renderPOSProducts(); if(typeof renderCombosVenta==='function') renderCombosVenta(); } if(typeof renderVentasHoy==='function') renderVentasHoy(); }
    if (sec === 'historial') { if(typeof renderHistorial==='function') renderHistorial(); }
    if (sec === 'analytics') { if(window.renderAnalyticsCharts) renderAnalyticsCharts(); }
    if (sec === 'combos') { if(window.renderCombosManager) renderCombosManager(); }
    if (sec === 'vencimientos') renderVencimientos(7);
    if (sec === 'agregar') { resetProductForm(); }
    
    // 2. MOSTRAR LA SECCIÓN DESPUÉS (Previene parpadeo)
    setTimeout(() => { navegarA(sec); }, 10);
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
  const bajo = productos.filter(p => p.stock > 0 && p.stock <= p.stockMin).length;
  const valor = productos.reduce((s, p) => s + (p.lotes||[]).reduce((s2,l)=>s2+(l.cantidad*(l.costo||0)),0), 0);
  const ventasHoy = (window.ventas || []).filter(v => new Date(v.fecha) >= hoy).reduce((s,v)=>s+v.total,0);

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
  if (window.initOdometers) window.initOdometers();
  if (window.playTitleAnimation) window.playTitleAnimation();

  const badge = document.getElementById('badge-vencimientos');
  if (badge) { if (lotesVenc > 0) { badge.textContent = lotesVenc; badge.style.display = 'inline'; } else badge.style.display = 'none'; }

  const alerts = [];
  const agotados = productos.filter(p => p.stock === 0);
  const bajosItems = productos.filter(p => p.stock > 0 && p.stock <= p.stockMin);
  let lotesProx = [];
  productos.forEach(p => { (p.lotes||[]).forEach(l => { if(l.cantidad>0 && l.vencimiento && new Date(l.vencimiento)<=new Date(Date.now()+7*86400000) && new Date(l.vencimiento)>=now) lotesProx.push(`${p.nombre} (${l.cantidad} uds)`); }); });

  if (agotados.length) alerts.push({cls:'alert-red', icon:'✕', title:`${agotados.length} producto${agotados.length>1?'s':''} sin stock`, text:agotados.slice(0,3).map(p=>p.nombre).join(', ')+(agotados.length>3?'..':'')});
  if (bajosItems.length) alerts.push({cls:'alert-orange', icon:'!', title:`${bajosItems.length} con stock bajo`, text:bajosItems.slice(0,3).map(p=>p.nombre+' ('+p.stock+')').join(', ')});
  if (lotesProx.length) alerts.push({cls:'alert-yellow', icon:'⏰', title:`${lotesProx.length} lotes vencen en 7 días`, text:lotesProx.slice(0,3).join(', ')});

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

function renderTabla(list) {
  list = list || productos;
  const tbody = document.getElementById('invTableBody');
  const mobileCards = document.getElementById('mobileCards');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="es-icon">📦</span><p>No se encontraron productos.</p><button class="btn btn-primary" onclick="navegarA(\'agregar\')">+ Agregar primero</button></div></td></tr>'; if (mobileCards) mobileCards.innerHTML = ''; return; }
  const now = new Date();

  let mobileHtml = [];
  tbody.innerHTML = list.map((p, i) => {
    const pv = p.enOferta ? p.precioOferta : p.venta;
    const costoProm = getCostoPromedio(p);
    const gan = pv - costoProm;
    let estadoBadge = p.stock === 0 ? '<span class="badge badge-agotado">Agotado</span>' : p.stock <= p.stockMin ? '<span class="badge badge-bajo">Stock bajo</span>' : '<span class="badge badge-ok">OK</span>';
    if (p.enOferta) estadoBadge += ' <span class="badge badge-oferta">Oferta</span>';

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
      const bdg = l.cantidad===0?'<span class="lote-badge lote-agotado">Agotado</span>':
                  (d===null?'<span class="lote-badge lote-vigente">S/Venc</span>':
                  d<0?'<span class="lote-badge lote-rojo">Vencido</span>':
                  d<=15?'<span class="lote-badge lote-naranja">Pronto</span>':
                  d<=30?'<span class="lote-badge lote-amarillo">30d</span>':
                  '<span class="lote-badge lote-vigente">Vigente</span>');
      return `<tr><td>Lote ${i+1}</td><td><b>${l.cantidad}</b></td><td>Bs.${l.costo.toFixed(2)}</td><td>${l.vencimiento||'—'}</td><td>${l.fechaIngreso||'—'}</td><td>${bdg}</td></tr>`;
    }).join('') : '';

    const lotesActivos = p.lotes ? p.lotes.filter(l => l.cantidad > 0).length : 0;
    const countText = lotesActivos === 1 ? '1 lote' : lotesActivos + ' lotes';
    
    const mobileLotesHtml = p.lotes && p.lotes.length > 0 ? `
      <div class="mobile-lotes" id="mob-lotes-${p.id}" style="display:none; margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
        <div style="font-size:0.75rem; color:var(--text3); margin-bottom:4px;">Detalle de lotes:</div>
        ${p.lotes.map((l, idx) => `
          <div style="background:var(--bg3); padding:6px 8px; border-radius:4px; margin-bottom:4px; font-size:0.75rem; display:grid; grid-template-columns:1fr 1fr; gap:4px;">
            <div>Cant: <b>${l.cantidad}</b></div>
            <div>Vence: <b>${l.vencimiento||'-'}</b></div>
            <div>Costo: Bs.${l.costo.toFixed(2)}</div>
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
              <div class="product-meta">${p.marca || p.unidad || ''} ${p.marca || p.unidad ? '/' : ''} ${countText}</div>
            </div>
          </div>
          ${estadoBadge}
        </div>
        <div class="mobile-card-body" style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <div class="mobile-card-field"><span>Stock</span><span><b style="${p.stock===0?'color:var(--red)':p.stock<=p.stockMin?'color:var(--orange)':''}">${p.stock} ${p.unidad}</b></span></div>
          <div class="mobile-card-field"><span>Venta</span><span><b>Bs.${pv.toFixed(2)}</b></span></div>
          <div class="mobile-card-field"><span>Ganancia</span><span class="${gan>=0?'pos':'neg'}">Bs.${gan.toFixed(2)}</span></div>
          <div class="mobile-card-field"><span>Vence</span><span>${vencBadge}</span></div>
        </div>
        ${mobileLotesHtml}
        <div class="mobile-card-actions" style="display:flex; gap:6px; margin-top:12px;">
          ${p.lotes && p.lotes.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="document.getElementById('mob-lotes-${p.id}').style.display = document.getElementById('mob-lotes-${p.id}').style.display === 'none' ? 'block' : 'none'">Lotes</button>` : ''}
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="editarProducto('${p.id}')">Editar</button>
          <button class="btn btn-secondary btn-sm warn" onclick="abrirOferta('${p.id}')">%</button>
          <button class="btn btn-secondary btn-sm danger" onclick="eliminarProducto('${p.id}')">✕</button>
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
            <span class="product-meta">${(p.marca || p.unidad || '')}${((p.marca || p.unidad) ? ' / ' : '')}${countText}</span>
          </div>
        </div>
      </td>
      <td><span class="cat-badge">${p.categoria}</span></td>
      <td><span class="value-animated" id="val-stock-${p.id}"><b style="${p.stock===0?'color:var(--red)':p.stock<=p.stockMin?'color:var(--orange)':''}">${window.odoHtml?window.odoHtml(p.stock):p.stock}</b></span> <span style="color:var(--text3);font-size:.75rem">${p.unidad}</span></td>
      <td class="price-cost"><span class="value-animated" id="val-cost-${p.id}">${costoProm>0?'Bs.'+costoProm.toFixed(2):'—'}</span></td>
      <td class="price-venta"><span class="value-animated" id="val-venta-${p.id}">Bs.${pv.toFixed(2)}</span></td>
      <td class="price-ganancia ${gan>=0?'pos':'neg'}"><span class="value-animated" id="val-gan-${p.id}">${costoProm>0?'Bs.'+gan.toFixed(2):'—'}</span></td>
      <td>${vencBadge}</td>
      <td><span class="value-animated" id="val-est-${p.id}">${estadoBadge}</span></td>
      <td><div class="action-btns">
        <button class="btn-icon" onclick="editarProducto('${p.id}')" title="Editar">✎</button>
        <button class="btn-icon warn" onclick="abrirOferta('${p.id}')" title="Oferta">%</button>
        <button class="btn-icon danger" onclick="eliminarProducto('${p.id}')" title="Eliminar">✕</button>
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
}

// ── PRODUCT FORM (LOTES) ──
let formLotes = [];

function renderFormLotes() {
  const container = document.getElementById('lotesFormList');
  if (!container) return;
  if (formLotes.length === 0) { container.innerHTML = '<p style="color:var(--text3);font-size:0.8rem">Agrega al menos un lote para poder tener stock.</p>'; return; }
  container.innerHTML = formLotes.map((l, i) => `
    <div class="lote-form-row">
      <div class="form-group"><label>Cant. *</label><input type="number" class="form-input" value="${l.cantidad}" min="0" onchange="updLote(${i},'cantidad',this.value)" /></div>
      <div class="form-group"><label>Costo (Bs.) *</label><input type="number" class="form-input" value="${l.costo}" min="0" step="0.01" onchange="updLote(${i},'costo',this.value)" /></div>
      <div class="form-group"><label>Vencimiento</label><input type="date" class="form-input" value="${l.vencimiento}" onchange="updLote(${i},'vencimiento',this.value)" /></div>
      <div class="form-group"><label>F. Ingreso</label><input type="date" class="form-input" value="${l.fechaIngreso}" onchange="updLote(${i},'fechaIngreso',this.value)" /></div>
      <button type="button" class="btn-icon danger" style="height:36px;border-radius:var(--radius-sm)" onclick="removerLoteUI(${i})">✕</button>
    </div>
  `).join('');
}
window.updLote = function(i, field, val) { formLotes[i][field] = (field==='cantidad'||field==='costo') ? Number(val) : val; };
window.agregarLoteUI = function() { formLotes.push({id:genId(), cantidad:1, costo:0, vencimiento:'', fechaIngreso:new Date().toISOString().slice(0,10), nota:''}); renderFormLotes(); };
window.removerLoteUI = function(i) { formLotes.splice(i,1); renderFormLotes(); };

function resetProductForm() {
  document.getElementById('productForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('formTitle').textContent = '+ Agregar Producto';
  document.getElementById('btnSubmitText').textContent = 'Guardar Producto';
  formLotes = []; agregarLoteUI();
  if (window.resetPhoto) resetPhoto();
}
window.resetProductForm = resetProductForm;

document.getElementById('btnNuevoProducto').addEventListener('click', () => { resetProductForm(); navegarA('agregar'); });
document.getElementById('btnCancelForm').addEventListener('click', () => navegarA('inventario'));

// UNIFICAR MODAL LOGIC
let tempProductData = null;
let existingProductMatch = null;

document.getElementById('productForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const nombre = document.getElementById('fNombre').value.trim();
  const categoria = document.getElementById('fCategoria').value;
  if (!nombre || !categoria) { toast('Nombre y categoría son obligatorios','error'); return; }

  // Calcular totales
  const stockT = formLotes.reduce((s,l)=>s+l.cantidad,0);
  const costAct = formLotes.filter(l=>l.cantidad>0);
  const costoP = costAct.length ? costAct.reduce((s,l)=>s+(l.cantidad*l.costo),0) / costAct.reduce((s,l)=>s+l.cantidad,0) : 0;
  const vts = costAct.filter(l=>l.vencimiento).sort((a,b)=>new Date(a.vencimiento)-new Date(b.vencimiento));
  const vP = vts.length ? vts[0].vencimiento : '';

  const data = {
    nombre, categoria, marca: document.getElementById('fMarca').value.trim(),
    unidad: document.getElementById('fUnidad').value,
    stockMin: parseInt(document.getElementById('fStockMin').value)||3,
    venta: parseFloat(document.getElementById('fVenta').value)||0,
    proveedor: document.getElementById('fProveedor').value.trim(),
    nota: document.getElementById('fNota').value.trim(),
    lotes: [...formLotes],
    stock: stockT, costo: costoP, vencimiento: vP
  };
  if (window.currentPhotoBase64) data.foto = window.currentPhotoBase64;

  if (!id) {
    // Check if product exists to unify
    const match = productos.find(p => p.nombre.toLowerCase()===nombre.toLowerCase() && p.categoria===categoria && (p.marca||'').toLowerCase()===(data.marca||'').toLowerCase());
    if (match) {
      tempProductData = data; existingProductMatch = match;
      const mInfo = document.getElementById('unificarInfo');
      mInfo.innerHTML = `<div><b>${match.nombre}</b></div><div style="font-size:0.8rem;color:var(--text3)">Stock actual: ${match.stock} uds · Lotes: ${match.lotes.length}</div>`;
      document.getElementById('unificarOverlay').style.display='flex';
      return;
    }
  }

  guardarProductoFinal(id, data);
});

function guardarProductoFinal(id, data) {
  const btn = document.getElementById('btnSpinner'); btn.style.display = 'inline-block';
  if (id) {
    const idx = productos.findIndex(p => p.id === id);
    if (idx > -1) { productos[idx] = {...productos[idx], ...data}; if (!data.foto && productos[idx].foto) data.foto = productos[idx].foto; }
    toast('Producto actualizado','success');
  } else {
    const nuevo = {...data, id:genId(), enOferta:false, precioOferta:data.venta, fechaRegistro:new Date().toISOString(), foto:data.foto||''};
    productos.unshift(nuevo);
    toast('Producto agregado','success');
  }
  save(); btn.style.display='none';
  renderDashboard(); if (window.renderCategoryGrid) renderCategoryGrid();
  navegarA('inventario'); filterAndRender();
  if (window.syncSaveProducto) { const p = id ? productos.find(x=>x.id===id) : productos[0]; if(p) window.syncSaveProducto(p); }
}

document.getElementById('unificarCancelBtn')?.addEventListener('click', () => {
  document.getElementById('unificarOverlay').style.display='none';
  guardarProductoFinal(null, tempProductData);
});
document.getElementById('unificarConfirmBtn')?.addEventListener('click', () => {
  document.getElementById('unificarOverlay').style.display='none';
  if(existingProductMatch && tempProductData) {
    existingProductMatch.lotes = [...(existingProductMatch.lotes||[]), ...tempProductData.lotes];
    existingProductMatch.stock = getStockTotal(existingProductMatch);
    existingProductMatch.vencimiento = getVencimientoMasCercano(existingProductMatch);
    existingProductMatch.costo = getCostoPromedio(existingProductMatch);
    save(); toast('Lotes agregados al producto existente', 'success');
    renderDashboard(); navegarA('inventario'); filterAndRender();
    if (window.syncSaveProducto) window.syncSaveProducto(existingProductMatch);
  }
});

// ── EDIT ──
function editarProducto(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  document.getElementById('editId').value = id;
  document.getElementById('fNombre').value = p.nombre; document.getElementById('fCategoria').value = p.categoria;
  document.getElementById('fMarca').value = p.marca || ''; document.getElementById('fUnidad').value = p.unidad;
  document.getElementById('fStockMin').value = p.stockMin; document.getElementById('fVenta').value = p.venta;
  document.getElementById('fProveedor').value = p.proveedor || ''; document.getElementById('fNota').value = p.nota || '';
  document.getElementById('formTitle').textContent = 'Editar: ' + p.nombre; document.getElementById('btnSubmitText').textContent = 'Guardar Cambios';
  
  if(p.lotes && p.lotes.length) { formLotes = p.lotes.map(l=>({...l})); } else { formLotes = [{id:genId(),cantidad:p.stock||0,costo:p.costo||0,vencimiento:p.vencimiento||'',fechaIngreso:new Date().toISOString().slice(0,10),nota:''}]; }
  renderFormLotes();

  if (p.foto) { window.currentPhotoBase64 = p.foto; const prev = document.getElementById('photoPreview'); if (prev) prev.innerHTML = `<img src="${p.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:7px" /><input type="file" id="fFoto" accept="image/*" onchange="handlePhotoUpload(this)" style="position:absolute;inset:0;opacity:0;cursor:pointer" />`; }
  else { window.currentPhotoBase64=null; if(window.resetPhoto) resetPhoto(); }
  navegarA('agregar'); window.scrollTo(0,0);
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
function abrirOferta(id) {
  const p = productos.find(x => x.id === id); if (!p) return;
  ofertaCurrentId = id; const info = document.getElementById('ofertaInfo');
  if (info) info.innerHTML = `<strong>${p.nombre}</strong> · Precio normal: Bs. ${p.venta.toFixed(2)}${p.enOferta?' · Oferta: Bs. '+p.precioOferta.toFixed(2):''}`;
  const inp = document.getElementById('ofertaPrecio'); if (inp) inp.value = p.precioOferta > 0 ? p.precioOferta : '';
  document.getElementById('ofertaOverlay').style.display='flex';
}
window.abrirOferta = abrirOferta;
document.getElementById('ofertaClose').addEventListener('click',()=>{ document.getElementById('ofertaOverlay').style.display='none'; });
document.getElementById('ofertaCancelBtn').addEventListener('click',()=>{ document.getElementById('ofertaOverlay').style.display='none'; });
document.getElementById('ofertaOverlay').addEventListener('click',function(e){if(e.target===this)this.style.display='none';});
document.getElementById('ofertaConfirmBtn').addEventListener('click',()=>{
  const p = productos.find(x=>x.id===ofertaCurrentId); const precio = parseFloat(document.getElementById('ofertaPrecio').value)||0;
  if (!p || precio<=0) { toast('Ingresa un precio válido','error'); return; }
  p.enOferta=true; p.precioOferta=precio; save(); filterAndRender(); renderDashboard();
  document.getElementById('ofertaOverlay').style.display='none'; toast(p.nombre+' en oferta','success');
  if(window.syncSaveProducto) window.syncSaveProducto(p);
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
        <div class="venc-meta"><span>Vence: ${new Date(x.l.vencimiento).toLocaleDateString('es-BO')}</span><span>Stock de Lote: ${x.l.cantidad} ${x.p.unidad}</span></div>
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
    navegarA('pos');
    if (typeof window.initPOS === 'function') window.initPOS();
  } else {
    // Ya está activo el dashboard por HTML, pero aseguramos
    navegarA('dashboard');
  }
});
// Firebase se inicializa desde sync.js (cargado en index.html)
