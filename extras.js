
// ── ODOMETER (TRAGAMONEDAS) ──
window.odoHtml = function(value, format='int', prefix='', suffix='') {
  let strVal = format === 'money' ? Number(value).toFixed(2) : String(Math.floor(Number(value)));
  let html = `<span class="odo-counter">`;
  if (prefix) html += `<span class="odo-char" style="width:auto; margin-right:4px; font-weight: inherit;">${prefix}</span>`;
  for(let i=0; i<strVal.length; i++) {
    let char = strVal[i];
    if(char === '.' || char === ',') {
       html += `<span class="odo-char">${char}</span>`;
    } else {
       html += `<span class="odo-digit" data-val="${char}" style="transform:translateY(0)">` + 
               [0,1,2,3,4,5,6,7,8,9].map(n=>`<span>${n}</span>`).join('') + 
               `</span>`;
    }
  }
  if (suffix) html += `<span class="odo-char" style="width:auto; margin-left:4px; font-weight: inherit;">${suffix}</span>`;
  html += `</span>`;
  return html;
}

window.playTitleAnimation = function() {
  setTimeout(() => {
    const el = document.getElementById('shop-title');
    if (!el) return;
    el.innerHTML = '';
    const text = 'TIA ELI LICORERIA';
    text.split('').forEach((char, i) => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00A0' : char;
      span.className = 'split-char';
      span.style.animationDelay = `${i * 0.05}s`;
      el.appendChild(span);
    });
  }, 250); // Wait for section transition to complete
}

window.initOdometers = function(delay = 250) {
  setTimeout(() => {
    document.querySelectorAll('.odo-counter').forEach(counter => {
      const digits = Array.from(counter.querySelectorAll('.odo-digit'));
      digits.forEach((el, index) => {
        let val = el.getAttribute('data-val');
        void el.offsetWidth; // Trigger reflow
        // Stagger from right to left (index backwards)
        let delayOffset = (digits.length - 1 - index) * 0.08;
        el.style.transitionDelay = delayOffset + 's';
        el.style.transform = `translateY(calc(${val} * -1em))`;
      });
    });
  }, delay);
}

// ═══════════════════════════════════════════
// extras.js — Dark mode, PWA, Combos Manager,
//             Cierre de Caja, Confetti, Photo
// ═══════════════════════════════════════════

// ── THEME ──
function applyTheme(newTheme) {
  document.documentElement.dataset.theme = newTheme;
  localStorage.setItem('tiaeli_theme', newTheme);
  const chk = document.getElementById('themeToggle');
  if (chk) chk.checked = newTheme === 'dark';
  const label = document.getElementById('themeLabel');
  const thumb = document.getElementById('themeThumb');
  if (label) label.textContent = newTheme === 'dark' ? 'Modo oscuro' : 'Modo claro';
  if (thumb) thumb.textContent = newTheme === 'dark' ? '☾' : '☼';
  document.dispatchEvent(new CustomEvent('themeChanged'));
}
window.applyTheme = applyTheme;

function toggleTheme() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  applyTheme(isDark ? 'light' : 'dark');
}

function initTheme() {
  const saved = localStorage.getItem('tiaeli_theme') || 'light';
  applyTheme(saved);
}
initTheme();

// ── ANIMATED COUNTER ──
function animateCounter(el, target, prefix, suffix, decimals) {
  prefix = prefix || ''; suffix = suffix || ''; decimals = decimals || 0;
  const duration = 800, start = performance.now();
  const startVal = parseFloat(el.dataset.prev || '0') || 0;
  el.dataset.prev = target;
  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startVal + (target - startVal) * eased;
    el.textContent = prefix + current.toFixed(decimals) + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = prefix + target.toFixed(decimals) + suffix;
  }
  requestAnimationFrame(step);
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 400);
}

// ── CONFETTI ──
function lanzarConfetti() {
  const colors = ['#09090b','#52525b','#a1a1aa','#d4d4d8','#fafafa','#16a34a'];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left:${Math.random()*100}vw;
      top:${-10 + Math.random()*-40}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      transform:rotate(${Math.random()*360}deg);
      animation-delay:${Math.random()*0.5}s;
      animation-duration:${1+Math.random()*0.8}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }
}

// ── PHOTO UPLOAD ──
let currentPhotoBase64 = null;

// Límite seguro para Firestore (1MB doc - overhead base64 ≈ 750KB binario)
const PHOTO_MAX_BYTES = 800 * 1024;
const PHOTO_MAX_RAW = 3 * 1024 * 1024;

// Comprime una imagen usando canvas. Devuelve dataURL o null si no se pudo.
function compressImage(file, maxBytes, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen'));
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = e => {
      img.onerror = () => reject(new Error('Imagen corrupta'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas no disponible')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        // Probar calidades descendentes hasta caber en maxBytes
        const qualities = [0.82, 0.7, 0.6, 0.45, 0.3];
        const tryEnc = (i) => {
          if (i >= qualities.length) { resolve(canvas.toDataURL('image/jpeg', 0.2)); return; }
          try {
            const dataUrl = canvas.toDataURL('image/jpeg', qualities[i]);
            const size = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
            if (size <= maxBytes || qualities[i] <= 0.2) resolve(dataUrl);
            else tryEnc(i + 1);
          } catch (err) {
            reject(new Error('Error comprimiendo: ' + err.message));
          }
        };
        tryEnc(0);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handlePhotoUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > PHOTO_MAX_RAW) { toast('La foto no debe superar 3MB antes de comprimir', 'error'); return; }
  try {
    currentPhotoBase64 = await compressImage(file, PHOTO_MAX_BYTES);
    const preview = document.getElementById('photoPreview');
    if (preview) {
      preview.innerHTML = `<img src="${currentPhotoBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:7px" /><input type="file" id="fFoto" accept="image/*" onchange="handlePhotoUpload(this)" style="position:absolute;inset:0;opacity:0;cursor:pointer" />`;
    }
    toast('Foto cargada', 'success');
  } catch (err) {
    toast('Error al procesar foto: ' + err.message, 'error');
    currentPhotoBase64 = null;
  }
}

function resetPhoto() {
  currentPhotoBase64 = null;
  const preview = document.getElementById('photoPreview');
  if (preview) {
    preview.innerHTML = `<span>Toca para subir foto</span><input type="file" id="fFoto" accept="image/*" onchange="handlePhotoUpload(this)" />`;
  }
}

// ── CIERRE DE CAJA ──
function abrirCierreCaja() {
  const overlay = document.getElementById('cajaOverlay');
  if (!overlay) return;
  const hoy = new Date(); hoy.setHours(0,0,0,0); const hoyTs = hoy.getTime();
  const manana = new Date(hoy); manana.setDate(manana.getDate() + 1); const mananaTs = manana.getTime();
  const ventasHoy = (window.ventas || []).filter(v => {
    const vFecha = typeof v.fecha === 'number' ? v.fecha : new Date(v.fecha).getTime();
    return vFecha >= hoyTs && vFecha < mananaTs;
  });
  const total = ventasHoy.reduce((s,v)=>s+v.total,0);
  const ganancia = ventasHoy.reduce((s,v)=>s+v.ganancia,0);
  const efectivo = ventasHoy.filter(v=>v.pago==='efectivo').reduce((s,v)=>s+v.total,0);
  const qr = ventasHoy.filter(v=>v.pago==='qr').reduce((s,v)=>s+v.total,0);
  const transferencia = ventasHoy.filter(v=>v.pago==='transferencia').reduce((s,v)=>s+v.total,0);
  const combosH = ventasHoy.filter(v=>v.tipo==='combo');
  const indivH = ventasHoy.filter(v=>v.tipo!=='combo');
  const fechaEl = document.getElementById('cajaFecha');
  if (fechaEl) fechaEl.textContent = new Date().toLocaleDateString('es-BO',{weekday:'long',day:'numeric',month:'long'});
  const body = document.getElementById('cajaBody');
  if (!body) return;
  body.innerHTML = `
    <div class="caja-grid">
      <div class="caja-card"><div class="caja-val">Bs. ${total.toFixed(2)}</div><div class="caja-lbl">Total vendido</div></div>
      <div class="caja-card"><div class="caja-val" style="color:${ganancia>=0?'var(--green)':'var(--red)'}">Bs. ${ganancia.toFixed(2)}</div><div class="caja-lbl">Ganancia neta ${ganancia<0?'⚠️ PÉRDIDA':''}</div></div>
      <div class="caja-card"><div class="caja-val">${ventasHoy.length}</div><div class="caja-lbl">Transacciones</div></div>
      <div class="caja-card"><div class="caja-val">${ventasHoy.length>0?'Bs. '+(total/ventasHoy.length).toFixed(2):'-'}</div><div class="caja-lbl">Ticket promedio</div></div>
    </div>
    <div class="caja-separator"></div>
    <div style="font-size:.85rem;font-weight:700;margin-bottom:8px;color:var(--text2)">Desglose por forma de pago</div>
    <div class="caja-row"><span>Efectivo</span><span style="font-weight:700">Bs. ${efectivo.toFixed(2)}</span></div>
    <div class="caja-row"><span>QR</span><span style="font-weight:700">Bs. ${qr.toFixed(2)}</span></div>
    <div class="caja-row"><span>Transferencia</span><span style="font-weight:700">Bs. ${transferencia.toFixed(2)}</span></div>
    <div class="caja-row" style="font-size:.9rem;font-weight:700;margin-top:4px;color:var(--text)"><span>TOTAL</span><span>Bs. ${total.toFixed(2)}</span></div>
    <div class="caja-separator"></div>
    <div style="font-size:.85rem;font-weight:700;margin-bottom:8px;color:var(--text2)">Resumen de ventas</div>
    <div class="caja-row"><span>Ventas individuales</span><span>${indivH.length}</span></div>
    <div class="caja-row"><span>Combos vendidos</span><span>${combosH.length}</span></div>
    ${total>0?'<button class="btn btn-secondary caja-print-btn" onclick="window.print()">Imprimir resumen</button>':''}
  `;
  overlay.style.display = 'flex';
}

document.getElementById('cajaClose').addEventListener('click', () => { document.getElementById('cajaOverlay').style.display = 'none'; });
document.getElementById('cajaOverlay').addEventListener('click', function(e) { if(e.target===this) this.style.display='none'; });
const btnCierreCaja = document.getElementById('btnCierreCaja');
if (btnCierreCaja) btnCierreCaja.addEventListener('click', abrirCierreCaja);

// ── DESCUENTO en ventas ──
function toggleDescuento() {
  const fields = document.getElementById('discountFields');
  const toggle = document.getElementById('discountToggle');
  if (!fields) return;
  const showing = fields.style.display !== 'none';
  fields.style.display = showing ? 'none' : 'grid';
  toggle.textContent = showing ? '+ Agregar descuento' : '- Quitar descuento';
  if (showing) {
    const pct = document.getElementById('vDescPct');
    const bs = document.getElementById('vDescBs');
    if (pct) pct.value = '';
    if (bs) bs.value = '';
  }
}

// ── EXPORT INVENTARIO CSV ──
function exportarInventarioCSV() {
  if (!window.productos || !window.productos.length) { toast('No hay productos', 'warning'); return; }
  const header = 'Nombre,Categoria,Marca,Unidad,Stock,StockMin,Costo,Venta,Ganancia,Vencimiento,Proveedor\n';
  const rows = window.productos.map(p => {
    const gan = p.venta - p.costo;
    return [p.nombre,p.categoria,p.marca||'',p.unidad,p.stock,p.stockMin,p.costo,p.venta,gan,p.vencimiento||'',p.proveedor||'']
      .map(x => '"'+String(x).replace(/"/g,'""')+'"').join(',');
  }).join('\n');
  const blob = new Blob(['\uFEFF'+header+rows],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download='inventario_tiaeli_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('Inventario exportado', 'success');
}

// ── COMBOS MANAGER ──
let editingComboId = null;
let comboComponents = [];

function renderCombosManager() {
  const grid = document.getElementById('combosManagerList');
  if (!grid) return;
  const combos = window.combos || [];
  if (!combos.length) {
    grid.innerHTML = '<div class="empty-state"><span class="es-icon">&#9670;</span><p>No hay combos creados todavía.</p><button class="btn btn-primary" onclick="abrirModalCombo()">+ Crear primer combo</button></div>';
    return;
  }
  grid.innerHTML = combos.map(c => {
    const comps = c.componentes.map(comp => {
      const p = (window.productos||[]).find(x=>x.id===comp.productoId);
      return `<span class="combo-comp${p&&p.stock>=comp.cantidad?'':' comp-sin-stock'}">${p?p.nombre:comp.nombreRef} ×${comp.cantidad}</span>`;
    }).join('');
    const costoTotal = c.componentes.reduce((sum,comp) => {
      const p = (window.productos||[]).find(x=>x.id===comp.productoId);
      return sum + (p ? p.costo*comp.cantidad : 0);
    }, 0);
    const ganancia = c.precioVenta > 0 ? c.precioVenta - costoTotal : null;
    return `<div class="combo-manager-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div><div class="combo-nombre">${c.nombre}</div><div class="combo-desc">${c.descripcion||''}</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="abrirModalCombo('${c.id}')"><i data-lucide="pencil" style="width:13px;height:13px"></i> Editar</button>
          <button class="btn-icon danger" onclick="eliminarCombo('${c.id}')" title="Eliminar combo"><i data-lucide="trash-2" style="width:14px;height:14px"></i></button>
        </div>
      </div>
      <div class="combo-componentes" style="margin-bottom:10px">${comps}</div>
      <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text2)">
        ${c.precioVenta>0?`<span>Precio: <b style="color:var(--text)">Bs. ${c.precioVenta.toFixed(2)}</b></span>`:'<span style="color:var(--orange)">Sin precio fijado</span>'}
        ${ganancia!==null?`<span>Ganancia est.: <b style="color:${ganancia>=0?'var(--green)':'var(--red)'}">Bs. ${ganancia.toFixed(2)}</b></span>`:''}
      </div>
    </div>`;
  }).join('');
  if (window.lucide) lucide.createIcons();
}

function abrirModalCombo(id) {
  editingComboId = id || null;
  comboComponents = [];
  const overlay = document.getElementById('comboModalOverlay');
  const title = document.getElementById('comboModalTitle');
  if (!overlay) return;
  if (id) {
    const c = (window.combos||[]).find(x=>x.id===id);
    if (!c) return;
    document.getElementById('cmNombre').value = c.nombre;
    document.getElementById('cmDesc').value = c.descripcion||'';
    document.getElementById('cmPrecio').value = c.precioVenta||'';
    comboComponents = c.componentes.map(x=>({...x}));
    if (title) title.textContent = 'Editar Combo';
  } else {
    document.getElementById('cmNombre').value='';
    document.getElementById('cmDesc').value='';
    document.getElementById('cmPrecio').value='';
    comboComponents=[];
    if (title) title.textContent = 'Nuevo Combo';
  }
  renderComboComponentes();
  overlay.style.display='flex';
}

function renderComboComponentes() {
  const cont = document.getElementById('cmComponentes');
  if (!cont) return;
  if (comboComponents.length === 0) {
    cont.innerHTML = '<div style="color:var(--text3); font-size:0.85rem; padding:10px 0; text-align:center;">No hay componentes. Busca y agrega uno arriba.</div>';
    return;
  }
  cont.innerHTML = comboComponents.map((comp, i) => {
    const p = (window.productos||[]).find(x=>x.id===comp.productoId);
    if (!p) return '';
    const stock = Array.isArray(p.lotes) ? p.lotes.reduce((acc,l)=>acc+l.cantidad,0) : 0;
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--bg3);padding:10px;border-radius:8px">
      <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
         <span style="font-weight:600; font-size:0.9rem; color:var(--text);">${p.nombre} ${p.marca?' - '+p.marca:''}</span>
         <span style="font-size:0.75rem; color:var(--text3)">Disp: <b>${stock}</b> | Costo: Bs.${(p.costo||0).toFixed(2)} | Venta: Bs.${(p.venta||0).toFixed(2)}</span>
      </div>
      <input type="number" class="form-input" style="width:70px; height:38px; padding:4px 8px;" value="${comp.cantidad}" min="1" onchange="updateCompCant(${i},this.value)" />
      <button class="btn-icon danger" style="width:38px; height:38px; border-radius:8px;" onclick="removeComp(${i})">&#10005;</button>
    </div>`;
  }).join('');
}

function updateCompCant(i, val) { comboComponents[i].cantidad = parseInt(val)||1; }
function removeComp(i) { comboComponents.splice(i,1); renderComboComponentes(); }

const cmSearchInput = document.getElementById('cmSearchInput');
if (cmSearchInput) {
  cmSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const res = document.getElementById('cmSearchResults');
    if (!q) { res.style.display = 'none'; return; }
    
    const matches = (window.productos||[]).filter(p => (p.nombre+' '+(p.marca||'')).toLowerCase().includes(q)).slice(0, 10);
    if (!matches.length) {
      res.innerHTML = '<div style="padding:12px; color:var(--text3); font-size:0.85rem; text-align:center;">No se encontraron productos</div>';
      res.style.display = 'block';
      return;
    }
    
    res.innerHTML = matches.map(p => {
      const stock = Array.isArray(p.lotes) ? p.lotes.reduce((acc,l)=>acc+l.cantidad,0) : 0;
      return `<div style="padding:12px; border-bottom:1px solid var(--border); cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:var(--trans);" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'" onclick="addCompFromSearch('${p.id}', '${p.nombre.replace(/'/g,"\\'")}')">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="font-weight:600; font-size:0.85rem; color:var(--text);">${p.nombre} ${p.marca?' - '+p.marca:''}</span>
          <span style="font-size:0.75rem; color:var(--text3)">Disp: <b>${stock}</b> | Costo: Bs.${(p.costo||0).toFixed(2)} | Venta: Bs.${(p.venta||0).toFixed(2)}</span>
        </div>
        <span style="font-size:1.2rem; color:var(--primary); font-weight:bold;">+</span>
      </div>`;
    }).join('');
    res.style.display = 'block';
  });
}

window.addCompFromSearch = function(pid, nombre) {
  // Evitar duplicados
  const exists = comboComponents.find(c => c.productoId === pid);
  if (exists) {
    exists.cantidad++;
  } else {
    comboComponents.push({productoId: pid, nombreRef: nombre, cantidad: 1});
  }
  const input = document.getElementById('cmSearchInput');
  if (input) input.value = '';
  const res = document.getElementById('cmSearchResults');
  if (res) res.style.display = 'none';
  renderComboComponentes();
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('#cmSearchInput') && !e.target.closest('#cmSearchResults')) {
    const res = document.getElementById('cmSearchResults');
    if (res) res.style.display = 'none';
  }
});

document.getElementById('comboModalSave').addEventListener('click', () => {
  const nombre = document.getElementById('cmNombre').value.trim();
  const desc = document.getElementById('cmDesc').value.trim();
  const precio = parseFloat(document.getElementById('cmPrecio').value)||0;
  if (!nombre) { toast('Ingresa un nombre para el combo','error'); return; }
  if (!comboComponents.length || !comboComponents.some(c=>c.productoId)) { toast('Agrega al menos un producto','error'); return; }
  const validos = comboComponents.filter(c=>c.productoId);
  if (editingComboId) {
    const idx = (window.combos||[]).findIndex(c=>c.id===editingComboId);
    if (idx>-1) { window.combos[idx] = {...window.combos[idx], nombre, descripcion:desc, precioVenta:precio, componentes:validos}; }
  } else {
    if (!window.combos) window.combos = [];
    window.combos.unshift({id:genId(),nombre,descripcion:desc,precioVenta:precio,activo:true,componentes:validos});
  }
  if (typeof setCombosGlobal === 'function') setCombosGlobal(window.combos);
  if (typeof saveCombos === 'function') saveCombos();
  document.getElementById('comboModalOverlay').style.display='none';
  renderCombosManager();
  if (typeof renderCombosVenta === 'function') renderCombosVenta();
  toast(editingComboId?'Combo actualizado':'Combo creado', 'success');
});

function eliminarCombo(id) {
  if (!confirm('¿Eliminar este combo?')) return;
  window.combos = (window.combos||[]).filter(c=>c.id!==id);
  if (typeof setCombosGlobal === 'function') setCombosGlobal(window.combos);
  if (typeof saveCombos === 'function') saveCombos();
  if (window.syncDeleteCombo) window.syncDeleteCombo(id);
  renderCombosManager();
  if (typeof renderCombosVenta==='function') renderCombosVenta();
  toast('Combo eliminado','warning');
}

document.getElementById('comboModalClose').addEventListener('click',()=>{document.getElementById('comboModalOverlay').style.display='none';});
document.getElementById('comboModalCancel').addEventListener('click',()=>{document.getElementById('comboModalOverlay').style.display='none';});
document.getElementById('comboModalOverlay').addEventListener('click',function(e){if(e.target===this)this.style.display='none';});
document.getElementById('btnNuevoCombo').addEventListener('click',()=>abrirModalCombo());

// ── CATEGORY GRID in dashboard ──
function renderCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  if (!grid) return;
  const cats = {};
  const EMOJIS = {Licores:'🍷',Cervezas:'🍺',Sodas:'🥤',Jugos:'🧃',Galletas:'🍪',Chicles:'🍬',Otros:'📦'};
  (window.productos||[]).forEach(p=>{ cats[p.categoria]=(cats[p.categoria]||0)+1; });
  if (!Object.keys(cats).length) { grid.innerHTML='<p style="color:var(--text3);font-size:.82rem">Sin productos aún.</p>'; return; }
  grid.innerHTML = Object.entries(cats).map(([cat,count])=>`
    <div class="cat-card" onclick="navegarA('inventario');setTimeout(()=>{const s=document.getElementById('filterCategoria');if(s){s.value='${cat}';filterAndRender();}},200)">
      <span class="cat-emoji">${EMOJIS[cat]||'📦'}</span>
      <div class="cat-name">${cat}</div>
      <div class="cat-count">${count} producto${count!==1?'s':''}</div>
    </div>`).join('');
}

// ── PWA ──
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  const banner = document.getElementById('pwaBanner');
  if (banner && !localStorage.getItem('tiaeli_pwa_dismissed')) {
    setTimeout(() => banner.classList.add('visible'), 3000);
  }
});
const pwaBannerInstall = document.getElementById('pwaBannerInstall');
const pwaBannerClose = document.getElementById('pwaBannerClose');
if (pwaBannerInstall) pwaBannerInstall.addEventListener('click', () => {
  if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(r=>{ if(r.outcome==='accepted') toast('App instalada!','success'); }); }
  document.getElementById('pwaBanner').classList.remove('visible');
});
if (pwaBannerClose) pwaBannerClose.addEventListener('click', () => {
  document.getElementById('pwaBanner').classList.remove('visible');
  localStorage.setItem('tiaeli_pwa_dismissed','1');
});

// ── EXPOSE confetti globally for ventas.js ──
window.lanzarConfetti = lanzarConfetti;
window.animateCounter = animateCounter;
window.renderAllCharts = renderAllCharts;
window.renderAnalyticsCharts = renderAnalyticsCharts;
window.renderCombosManager = renderCombosManager;
window.renderCategoryGrid = renderCategoryGrid;
window.exportarInventarioCSV = exportarInventarioCSV;
window.handlePhotoUpload = handlePhotoUpload;
window.toggleDescuento = toggleDescuento;

// ── INIT extras ──
setTimeout(() => {
  renderAllCharts();
  renderCategoryGrid();
  renderCombosManager();
}, 500);

// ── LOCALSTORAGE WARNING ──
function checkStorageQuota() {
  try {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) total += localStorage[key].length * 2;
    }
    if (total > 4 * 1024 * 1024) {
      console.warn('[Storage] Uso de localStorage: ' + (total / 1024 / 1024).toFixed(1) + 'MB — cerca del límite de 5-10MB');
    }
  } catch(e) { /* ignore */ }
}
setTimeout(checkStorageQuota, 3000);

// ── SERVICE WORKER (PWA) ──
// Service Worker se registra automáticamente desde index.html si está disponible
// No desregistramos para permitir funcionalidad offline

// ── PREMIUM ANIMATIONS ──
window.animateValueElement = function(el) {
  if (!el) return;
  el.classList.remove('updated');
  void el.offsetWidth; // trigger reflow
  el.classList.add('updated');
};

// ── EXPORTAR / IMPORTAR DATOS (BACKUP) ──
window.exportarDatos = function() {
  const datos = {
    version: '3.0',
    fecha: new Date().toISOString(),
    dispositivo: navigator.userAgent.substring(0, 50),
    productos: window.productos || [],
    ventas: window.ventas || [],
    combos: window.combos || []
  };

  const totalProductos = datos.productos.length;
  const totalVentas = datos.ventas.length;

  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fechaStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `tiaeli_backup_${fechaStr}.json`;
  a.click();
  URL.revokeObjectURL(url);

  toast(`✅ Backup descargado: ${totalProductos} productos, ${totalVentas} ventas`, 'success');
};

window.importarDatos = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const datos = JSON.parse(e.target.result);

      // Validar que es un backup válido del sistema
      if (!datos.productos && !datos.ventas) {
        toast('❌ Archivo inválido. Usa un backup exportado desde este sistema.', 'error');
        return;
      }

      // Validar estructura de productos
      const productosInvalidos = (datos.productos || []).filter(p => !p.nombre || !p.categoria);
      if (productosInvalidos.length > 0) {
        toast('❌ Backup corrupto: ' + productosInvalidos.length + ' producto(s) sin nombre o categoría.', 'error');
        return;
      }

      // Validar estructura de ventas
      const ventasInvalidas = (datos.ventas || []).filter(v => !v.productoNombre || v.total === undefined);
      if (ventasInvalidas.length > 0) {
        toast('❌ Backup corrupto: ' + ventasInvalidas.length + ' venta(s) inválidas.', 'error');
        return;
      }

      // Check for duplicate IDs in backup
      const checkDupes = (arr, label) => {
        const seen = new Set();
        const dupes = arr.filter(item => {
          if (seen.has(item.id)) return true;
          seen.add(item.id);
          return false;
        });
        return dupes.length;
      };
      
      const dupeProds = checkDupes(datos.productos || [], 'productos');
      const dupeVentas = checkDupes(datos.ventas || [], 'ventas');
      const dupeCombos = checkDupes(datos.combos || [], 'combos');
      
      if (dupeProds || dupeVentas || dupeCombos) {
        toast('❌ Backup tiene IDs duplicados: ' + dupeProds + ' productos, ' + dupeVentas + ' ventas, ' + dupeCombos + ' combos.', 'error');
        return;
      }

      const totalP = (datos.productos || []).length;
      const totalV = (datos.ventas || []).length;
      const totalC = (datos.combos || []).length;

      if (!confirm(`¿Importar este backup?\n\n📦 ${totalP} productos\n💰 ${totalV} ventas\n🎁 ${totalC} combos\n\nFecha del backup: ${datos.fecha ? new Date(datos.fecha).toLocaleString('es-BO') : 'desconocida'}\n\n⚠️ Se fusionará con datos actuales (no reemplaza).`)) {
        event.target.value = '';
        return;
      }

      // MERGE instead of replace - preserve local changes not in backup
      function mergeArrays(local, remote, idKey = 'id') {
        const localMap = new Map(local.map(item => [item[idKey], item]));
        const remoteMap = new Map(remote.map(item => [item[idKey], item]));
        
        // Add new items from remote
        remote.forEach(item => {
          if (!localMap.has(item[idKey])) {
            localMap.set(item[idKey], item);
          }
        });
        
        // Keep local items not in remote (preserve unsynced changes)
        return Array.from(localMap.values());
      }

      // Merge productos
      if (datos.productos) {
        const mergedProductos = mergeArrays(window.productos || [], datos.productos);
        localStorage.setItem('tiaeli_v2', JSON.stringify(mergedProductos));
        window.productos = mergedProductos;
        if (window.setProductosGlobal) window.setProductosGlobal(mergedProductos);
      }

      // Merge ventas
      if (datos.ventas) {
        const mergedVentas = mergeArrays(window.ventas || [], datos.ventas);
        localStorage.setItem('tiaeli_ventas', JSON.stringify(mergedVentas));
        window.ventas = mergedVentas;
        if (window.setVentasGlobal) window.setVentasGlobal(mergedVentas);
      }

      // Merge combos
      if (datos.combos) {
        const mergedCombos = mergeArrays(window.combos || [], datos.combos);
        localStorage.setItem('tiaeli_combos', JSON.stringify(mergedCombos));
        window.combos = mergedCombos;
        if (window.setCombosGlobal) window.setCombosGlobal(mergedCombos);
      }

      // Sync to Firestore if connected (with proper await)
      const syncPromises = [];
      if (window.syncSaveProducto && datos.productos) {
        datos.productos.forEach(p => syncPromises.push(window.syncSaveProducto(p)));
      }
      if (window.syncSaveVenta && datos.ventas) {
        datos.ventas.forEach(v => syncPromises.push(window.syncSaveVenta(v)));
      }
      if (window.syncSaveCombo && datos.combos) {
        datos.combos.forEach(c => syncPromises.push(window.syncSaveCombo(c)));
      }
      
      Promise.all(syncPromises).catch(err => console.warn('Sync partial:', err));

      // Re-renderizar todo
      if (typeof filterAndRender === 'function') filterAndRender();
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof renderVentasHoy === 'function') renderVentasHoy();
      if (typeof renderVentasStats === 'function') renderVentasStats();
      if (typeof renderHistorial === 'function') renderHistorial();
      if (window.renderAllCharts) renderAllCharts();
      if (window.renderCategoryGrid) renderCategoryGrid();
      if (window.renderCombosManager) renderCombosManager();

      toast(`✅ Importación completada: ${totalP} productos, ${totalV} ventas fusionados`, 'success');
      event.target.value = ''; // Reset input

    } catch (err) {
      toast('❌ Error al leer el archivo: ' + err.message, 'error');
      event.target.value = '';
    }
  };
  reader.readAsText(file);
};

// ── GESTIÓN DE QR (PAGOS) ──

const QR_NAMES = ['eli', 'edwin', 'johan'];

window.handleQRUpload = async function(input, name) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type || !file.type.startsWith('image/')) {
    toast('El archivo no es una imagen', 'error');
    input.value = '';
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    toast('El QR no debe superar 3MB', 'error');
    input.value = '';
    return;
  }

  try {
    const base64 = await compressImage(file, PHOTO_MAX_BYTES, 800);
    localStorage.setItem(`tiaeli_qr_${name}`, base64);

    if (window.syncSaveQRsGlobal) {
      window.syncSaveQRsGlobal({ [name]: base64 });
    }

    const previewDiv = document.getElementById(`qrPreview${name.charAt(0).toUpperCase() + name.slice(1)}`);
    if (previewDiv) {
      previewDiv.innerHTML = `<img src="${base64}" style="max-width:100%;max-height:100%;border-radius:8px;" />
                              <input type="file" accept="image/*" onchange="handleQRUpload(this, '${name}')" />`;
    }
    toast(`QR de ${name.toUpperCase()} guardado y sincronizado.`, 'success');
  } catch (err) {
    toast('Error al procesar QR: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
};

window.clearQR = function(name) {
  if (!confirm(`¿Eliminar el QR de ${name.toUpperCase()}?`)) return;
  localStorage.removeItem(`tiaeli_qr_${name}`);
  
  if (window.syncSaveQRsGlobal) {
    window.syncSaveQRsGlobal({ [name]: null }); // Enviar null borra el campo al hacer merge
  }

  const previewDiv = document.getElementById(`qrPreview${name.charAt(0).toUpperCase() + name.slice(1)}`);
  if (previewDiv) {
    previewDiv.innerHTML = `<span>Subir QR</span>
                            <input type="file" accept="image/*" onchange="handleQRUpload(this, '${name}')" />`;
  }
  toast(`QR de ${name.toUpperCase()} eliminado.`, 'warning');
};

window.showQR = function(name) {
  const base64 = localStorage.getItem(`tiaeli_qr_${name}`);
  const overlay = document.getElementById('qrOverlay');
  const img = document.getElementById('qrModalImage');
  const emptyText = document.getElementById('qrModalEmpty');
  const title = document.getElementById('qrModalTitle');
  
  title.innerText = `QR de Pago — ${name.toUpperCase()}`;
  
  if (base64) {
    img.src = base64;
    img.style.display = 'inline-block';
    emptyText.style.display = 'none';
  } else {
    img.style.display = 'none';
    emptyText.style.display = 'block';
  }
  
  overlay.style.display = 'flex';
};

// Inicializar previsualizaciones de QR
window.initQRPreviews = function() {
  QR_NAMES.forEach(name => {
    const base64 = localStorage.getItem(`tiaeli_qr_${name}`);
    if (base64) {
      const previewDiv = document.getElementById(`qrPreview${name.charAt(0).toUpperCase() + name.slice(1)}`);
      if (previewDiv) {
        previewDiv.innerHTML = `<img src="${base64}" style="max-width:100%;max-height:100%;border-radius:8px;" />
                                <input type="file" accept="image/*" onchange="handleQRUpload(this, '${name}')" />`;
      }
    } else {
      const previewDiv = document.getElementById(`qrPreview${name.charAt(0).toUpperCase() + name.slice(1)}`);
      if (previewDiv) {
        previewDiv.innerHTML = `<span>Subir QR</span>
                                <input type="file" accept="image/*" onchange="handleQRUpload(this, '${name}')" />`;
      }
    }
  });
};

// Llamar a la inicialización al cargar
setTimeout(window.initQRPreviews, 600);


