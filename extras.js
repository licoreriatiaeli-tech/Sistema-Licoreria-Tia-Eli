
// ── ODOMETER (ANIMACIÓN ROLLING MODERNA Y ULTRA-FLUIDA) ──
window.odoHtml = function(value, format = 'int', prefix = '', suffix = '') {
  const num = Number(value) || 0;
  let strVal;
  if (format === 'money' || String(value).includes('.')) {
    strVal = num.toFixed(2);
  } else {
    strVal = String(Math.floor(num));
  }
  
  let html = `<span class="odo-counter">`;
  if (prefix) {
    html += `<span class="odo-char odo-prefix">${prefix}</span>`;
  }
  
  for (let i = 0; i < strVal.length; i++) {
    const char = strVal[i];
    if (char === '.' || char === ',') {
      html += `<span class="odo-char odo-sep">${char}</span>`;
    } else {
      const d = parseInt(char, 10);
      const digitVal = isNaN(d) ? 0 : d;
      html += `<span class="odo-digit" data-val="${digitVal}">` +
              `<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>` +
              `<span>5</span><span>6</span><span>7</span><span>8</span><span>9</span>` +
              `</span>`;
    }
  }
  
  if (suffix) {
    html += `<span class="odo-char odo-suffix">${suffix}</span>`;
  }
  html += `</span>`;
  return html;
};

let _odoRafId = null;
window.initOdometers = function(delay = 40) {
  if (_odoRafId) cancelAnimationFrame(_odoRafId);
  
  _odoRafId = requestAnimationFrame(() => {
    _odoRafId = requestAnimationFrame(() => {
      const counters = document.querySelectorAll('.odo-counter');
      counters.forEach(counter => {
        const section = counter.closest('.section');
        const isHidden = section && !section.classList.contains('active');

        const digits = Array.from(counter.querySelectorAll('.odo-digit'));
        const len = digits.length;
        
        digits.forEach((el, index) => {
          const val = el.getAttribute('data-val');
          if (val === null || val === undefined) return;
          
          if (isHidden) {
            // Si la pestaña está oculta, posicionar inmediatamente para que nunca quede en cero o trabado
            el.style.transition = 'none';
            el.style.transform = `translateY(-${val * 10}%)`;
          } else {
            // Animación fluida de 0.45s con curva suave estilo fintech
            const stagger = Math.min((len - 1 - index) * 0.035, 0.18);
            el.style.transition = `transform 0.68s cubic-bezier(0.16, 1, 0.3, 1) ${stagger}s`;
            el.style.transform = `translateY(-${val * 10}%)`;
          }
        });
        
        if (!isHidden) {
          counter.classList.add('updated');
          setTimeout(() => counter.classList.remove('updated'), 720);
        }
      });
    });
  });
};

window.playTitleAnimation = function() {
  const el = document.getElementById('shop-title');
  if (!el) return;
  el.textContent = 'TIA ELI LICORERIA';
  el.classList.remove('title-glow-anim');
  void el.offsetWidth;
  el.classList.add('title-glow-anim');
};

// ═══════════════════════════════════════════
// extras.js — Dark mode, PWA, Combos Manager,
//             Cierre de Caja, Confetti, Photo
// ═══════════════════════════════════════════

// ── THEME ──
let _themeTransitionTimer = null;

function applyTheme(newTheme) {
  const isDark = newTheme === 'dark';
  const html = document.documentElement;

  // Activa clase de transición ligera y controlada (hardware acceleration)
  html.classList.add('theme-transitioning');
  clearTimeout(_themeTransitionTimer);

  html.dataset.theme = newTheme;
  html.classList.toggle('dark', isDark);
  try {
    localStorage.setItem('tiaeli_theme', newTheme);
  } catch (e) {}

  // Actualiza ambos toggles de tema
  const chk1 = document.getElementById('themeToggle');
  const chk2 = document.getElementById('themeToggleFooter');
  if (chk1) chk1.checked = isDark;
  if (chk2) chk2.checked = isDark;
  
  // Iconos barra superior móvil
  const topbarSun = document.querySelector('.topbar-theme-btn .theme-icon-sun');
  const topbarMoon = document.querySelector('.topbar-theme-btn .theme-icon-moon');
  if (topbarSun) topbarSun.style.display = isDark ? 'none' : 'block';
  if (topbarMoon) topbarMoon.style.display = isDark ? 'block' : 'none';
  
  // Iconos footer barra lateral
  const thumbSun = document.querySelector('.theme-icon-sun');
  const thumbMoon = document.querySelector('.theme-icon-moon');
  if (thumbSun) thumbSun.style.display = isDark ? 'none' : 'block';
  if (thumbMoon) thumbMoon.style.display = isDark ? 'block' : 'none';
  
  const label = document.getElementById('themeLabel');
  const thumb = document.getElementById('themeThumb');
  if (label) label.textContent = isDark ? 'Modo oscuro' : 'Modo claro';
  if (thumb) thumb.textContent = isDark ? '☾' : '☼';

  // Notificar al sistema
  document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newTheme } }));

  // Retirar clase tras completar los 190ms para no penalizar la GPU
  _themeTransitionTimer = setTimeout(() => {
    html.classList.remove('theme-transitioning');
  }, 190);
}

window.applyTheme = applyTheme;

function toggleTheme() {
  const isDark = document.documentElement.dataset.theme === 'dark' || document.documentElement.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}
window.toggleTheme = toggleTheme;

function initTheme() {
  const saved = localStorage.getItem('tiaeli_theme') || 'light';
  applyTheme(saved);
}
initTheme();

// ── ANIMATED COUNTER ──
function animateCounter(el, target, prefix, suffix, decimals) {
  if (!el) return;
  prefix = prefix || ''; suffix = suffix || ''; decimals = decimals || 0;
  const num = Number(target) || 0;
  const startVal = parseFloat(el.dataset.prev || '0') || 0;
  el.dataset.prev = num;
  
  if (Math.abs(num - startVal) < 0.001) {
    el.textContent = prefix + num.toFixed(decimals) + suffix;
    return;
  }
  
  const duration = 520;
  const start = performance.now();
  
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = startVal + (num - startVal) * eased;
    el.textContent = prefix + current.toFixed(decimals) + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = prefix + num.toFixed(decimals) + suffix;
    }
  }
  requestAnimationFrame(step);
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 400);
}

// ── CONFETTI ──
function lanzarConfetti() {
  const colors = ['#09090b','#52525b','#a1a1aa','#d4d4d8','#fafafa','#ea580c'];
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
window.currentPhotoBase64 = null;
let currentPhotoBase64 = null;

// Límite óptimo para POS minorista: 60KB por imagen Base64 (resolución 400x400px nítida para thumbnails)
// Garantiza carga ultrarrápida en móviles y previene saturar la cuota de localStorage y Firestore
const PHOTO_MAX_BYTES = 60 * 1024;
const PHOTO_MAX_RAW = 5 * 1024 * 1024;

// Comprime una imagen usando canvas. Devuelve dataURL o null si no se pudo.
function compressImage(file, maxBytes = PHOTO_MAX_BYTES, maxWidth = 400) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      reject(new Error('El archivo no es una imagen'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round(h * (maxWidth / w));
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const qualities = [0.82, 0.72, 0.60, 0.45, 0.30];
        let chosen = null;
        for (const q of qualities) {
          const dataUrl = canvas.toDataURL('image/jpeg', q);
          const bytes = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
          if (bytes <= maxBytes) {
            chosen = dataUrl;
            break;
          }
        }
        if (!chosen) {
          chosen = canvas.toDataURL('image/jpeg', 0.25);
        }
        resolve(chosen);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
window.compressImage = compressImage;

async function handlePhotoUpload(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.size > PHOTO_MAX_RAW) { toast('La foto no debe superar 5MB antes de comprimir', 'error'); return; }
  try {
    currentPhotoBase64 = await compressImage(file, PHOTO_MAX_BYTES, 400);
    window.currentPhotoBase64 = currentPhotoBase64;
    const preview = document.getElementById('photoPreview');
    if (preview) {
      preview.innerHTML = `<img src="${currentPhotoBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:7px" /><input type="file" id="fFoto" accept="image/*" onchange="handlePhotoUpload(this)" style="position:absolute;inset:0;opacity:0;cursor:pointer" />`;
    }
    toast('Foto cargada y optimizada', 'success');
  } catch (err) {
    toast('Error al procesar foto: ' + err.message, 'error');
    currentPhotoBase64 = null;
    window.currentPhotoBase64 = null;
  }
}
window.handlePhotoUpload = handlePhotoUpload;

function resetPhoto() {
  currentPhotoBase64 = null;
  window.currentPhotoBase64 = null;
  const preview = document.getElementById('photoPreview');
  if (preview) {
    preview.innerHTML = `<span>Toca para subir foto</span><input type="file" id="fFoto" accept="image/*" onchange="handlePhotoUpload(this)" />`;
  }
}
window.resetPhoto = resetPhoto;

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

document.getElementById('cajaClose')?.addEventListener('click', () => { document.getElementById('cajaOverlay').style.display = 'none'; });
document.getElementById('cajaOverlay')?.addEventListener('click', function(e) { if(e.target===this) this.style.display='none'; });
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
    const gan = safeNum(p.venta) - safeNum(p.costo);
    return [p.nombre||'',p.categoria||'',p.marca||'',p.unidadBase||p.unidad||'',safeNum(p.stock),safeNum(p.stockMin)||24,safeNum(p.costo),safeNum(p.venta),gan,p.vencimiento||'',p.proveedor||'']
      .map(x => '"'+String(x).replace(/"/g,'""')+'"').join(',');
  }).join('\n');
  const blob = new Blob(['\uFEFF'+header+rows],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download='inventario_tiaeli_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click(); URL.revokeObjectURL(url);
  toast('Inventario exportado', 'success');
}

// ── COMBOS MANAGER (EMERALD RETAIL) ──
let editingComboId = null;
let comboComponents = [];

// ── CÁLCULO MATEMÁTICO CENTRALIZADO DE STOCK DINÁMICO ──
window.calcularStockCombo = function(c, productosLista) {
  if (!c || !c.componentes || !Array.isArray(c.componentes) || c.componentes.length === 0) {
    return {
      stockDisponible: 0,
      cuelloDeBotella: null,
      costoTotal: 0,
      precioRegularSeparado: 0,
      componentesDetalle: []
    };
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
      cuelloDeBotella = {
        productoId: comp.productoId,
        nombre: p ? p.nombre : (comp.nombreRef || 'Producto no encontrado'),
        stockActual,
        cantRequerida: cantReq,
        combosPosibles
      };
    }

    return {
      productoId: comp.productoId,
      nombre: p ? p.nombre : (comp.nombreRef || 'Producto no encontrado'),
      presentacion: p ? p.presentacion : '',
      marca: p ? p.marca : '',
      cantRequerida: cantReq,
      stockActual,
      combosPosibles,
      costoUnit,
      precioUnit,
      esCuelloDeBotella: false,
      sinStock: stockActual < cantReq
    };
  });

  if (minStock === Infinity) minStock = 0;

  componentesDetalle.forEach(d => {
    if (cuelloDeBotella && d.productoId === cuelloDeBotella.productoId) {
      d.esCuelloDeBotella = true;
    }
  });

  return {
    stockDisponible: minStock,
    cuelloDeBotella,
    costoTotal,
    precioRegularSeparado,
    componentesDetalle
  };
};

function renderCombosManager() {
  const grid = document.getElementById('combosManagerList');
  if (!grid) return;
  const combos = window.combos || [];

  // 1. Métricas KPIs de Combos
  const totalCombos = combos.length;
  let listosVenta = 0;
  let agotados = 0;
  let sumaMargen = 0;
  let countMargen = 0;

  const combosCalculados = combos.map(c => {
    const calc = window.calcularStockCombo(c);
    if (calc.stockDisponible > 0) listosVenta++;
    else agotados++;

    const ganancia = c.precioVenta > 0 ? (c.precioVenta - calc.costoTotal) : 0;
    const margen = calc.costoTotal > 0 ? ((ganancia / calc.costoTotal) * 100) : 0;
    if (c.precioVenta > 0 && calc.costoTotal > 0) {
      sumaMargen += margen;
      countMargen++;
    }

    return { combo: c, calc, ganancia, margen };
  });

  const kpiTotal = document.getElementById('combosKpiTotal');
  const kpiActivos = document.getElementById('combosKpiActivos');
  const kpiListos = document.getElementById('combosKpiListos');
  const kpiStockMax = document.getElementById('combosKpiStockMax');
  const kpiAgotados = document.getElementById('combosKpiAgotados');
  const kpiMargen = document.getElementById('combosKpiMargen');

  if (kpiTotal) kpiTotal.textContent = totalCombos;
  if (kpiActivos) kpiActivos.textContent = `${totalCombos} activos en catálogo`;
  if (kpiListos) kpiListos.textContent = listosVenta;
  if (kpiStockMax) kpiStockMax.textContent = listosVenta > 0 ? 'Listos para POS' : 'Sin combos listos';
  if (kpiAgotados) kpiAgotados.textContent = agotados;
  if (kpiMargen) {
    const margenProm = countMargen > 0 ? (sumaMargen / countMargen).toFixed(1) : '0';
    kpiMargen.textContent = margenProm + '%';
  }

  // 2. Filtros y Búsqueda
  const q = (document.getElementById('combosSearchInput')?.value || '').toLowerCase().trim();
  const filterEstado = document.getElementById('combosFilterEstado')?.value || '';
  const filterOrden = document.getElementById('combosFilterOrden')?.value || 'nombre-asc';

  let filtrados = combosCalculados.filter(item => {
    const c = item.combo;
    if (q) {
      const matchNombre = (c.nombre || '').toLowerCase().includes(q);
      const matchDesc = (c.descripcion || '').toLowerCase().includes(q);
      const matchComp = item.calc.componentesDetalle.some(cd => cd.nombre.toLowerCase().includes(q));
      if (!matchNombre && !matchDesc && !matchComp) return false;
    }
    if (filterEstado === 'disponible' && item.calc.stockDisponible <= 0) return false;
    if (filterEstado === 'agotado' && item.calc.stockDisponible > 0) return false;
    return true;
  });

  // Ordenación
  filtrados.sort((a, b) => {
    if (filterOrden === 'nombre-asc') return (a.combo.nombre || '').localeCompare(b.combo.nombre || '');
    if (filterOrden === 'stock-desc') return b.calc.stockDisponible - a.calc.stockDisponible;
    if (filterOrden === 'precio-desc') return (b.combo.precioVenta || 0) - (a.combo.precioVenta || 0);
    if (filterOrden === 'precio-asc') return (a.combo.precioVenta || 0) - (b.combo.precioVenta || 0);
    if (filterOrden === 'ganancia-desc') return b.ganancia - a.ganancia;
    return 0;
  });

  // Estado vacío
  if (!combos.length) {
    grid.innerHTML = `
      <div class="inv-empty-state" style="grid-column: 1/-1; background: var(--inv-surface-lowest); border: 1px dashed var(--inv-border); border-radius: 1.25rem; padding: 3rem 1.5rem;">
        <span class="material-symbols-outlined inv-empty-icon" style="font-size: 54px; color: var(--inv-primary);">liquor</span>
        <div class="inv-empty-title" style="font-size: 18px; margin-bottom: 6px;">No tienes combos creados todavía</div>
        <p class="inv-empty-sub" style="max-width: 460px; margin-bottom: 1.5rem;">Crea tu primer combo (ej: 1 Ron + 1 Coca-Cola). El sistema calculará el stock disponible automáticamente según tus existencias de bodega.</p>
        <button class="inv-btn-primary" type="button" onclick="abrirModalCombo()">
          <span class="material-symbols-outlined">add_circle</span>
          <span>+ Crear Primer Combo</span>
        </button>
      </div>`;
    return;
  }

  if (!filtrados.length) {
    grid.innerHTML = `
      <div class="inv-empty-state" style="grid-column: 1/-1; background: var(--inv-surface-lowest); border: 1px dashed var(--inv-border); border-radius: 1.25rem; padding: 2.5rem 1.5rem;">
        <span class="material-symbols-outlined inv-empty-icon" style="font-size: 42px;">filter_list_off</span>
        <div class="inv-empty-title">Sin resultados con los filtros actuales</div>
        <p class="inv-empty-sub">Prueba cambiando el término de búsqueda o seleccionando "Todos los combos".</p>
      </div>`;
    return;
  }

  // 3. Renderizado de Tarjetas Limpias para el Administrador / Vendedor
  grid.innerHTML = filtrados.map(({ combo: c, calc, ganancia, margen }) => {
    const isOut = calc.stockDisponible <= 0;

    // Badge principal de stock disponible
    const heroPill = isOut
      ? `<span class="combo-stock-hero-pill agotado"><span class="material-symbols-outlined" style="font-size:16px">block</span> Sin stock (0 disponibles)</span>`
      : `<span class="combo-stock-hero-pill disponible"><span class="material-symbols-outlined" style="font-size:16px">check_circle</span> ${calc.stockDisponible} paquetes disponibles</span>`;

    // Lista limpia de insumos con existencias exactas en unidades
    const compsListHtml = calc.componentesDetalle.map(d => {
      const badgeCls = d.sinStock ? 'sin-stock' : 'ok';
      const badgeTxt = d.sinStock
        ? `Sin stock (0 u.)`
        : `Existente: ${d.stockActual} u.`;

      return `
        <div class="combo-comp-item-row">
          <div class="combo-comp-name-qty">
            <span class="material-symbols-outlined" style="font-size:15px; color:var(--inv-on-surface-variant)">subdirectory_arrow_right</span>
            <span>${escHTML(d.nombre)}</span>
            <span style="color:var(--inv-primary); font-weight:700;">&times;${d.cantRequerida}</span>
          </div>
          <span class="combo-comp-stock-badge ${badgeCls}">${badgeTxt}</span>
        </div>`;
    }).join('');

    return `
      <div class="combo-manager-card-modern ${isOut ? 'is-out-of-stock' : ''}">
        <div class="combo-card-head">
          <div class="combo-card-title-group">
            <div class="combo-card-title">${escHTML(c.nombre)}</div>
            ${c.descripcion ? `<div class="combo-card-desc">${escHTML(c.descripcion)}</div>` : ''}
          </div>
          <div class="combo-card-actions-quick">
            <button class="inv-btn-secondary" type="button" style="padding:0.35rem 0.65rem;" onclick="abrirModalCombo('${c.id}')" title="Editar Combo">
              <span class="material-symbols-outlined" style="font-size:16px">edit</span>
            </button>
            <button class="inv-btn-danger-icon" type="button" onclick="eliminarCombo('${c.id}')" title="Eliminar Combo">
              <span class="material-symbols-outlined" style="font-size:18px">delete</span>
            </button>
          </div>
        </div>

        <div>${heroPill}</div>

        <div class="combo-comps-wrapper">
          <div class="combo-comps-header">
            <span>Insumos</span>
            <span>Existencia en Bodega</span>
          </div>
          ${compsListHtml}
        </div>

        <div class="combo-pricing-grid">
          <div class="combo-price-stat">
            <span class="combo-price-stat-lbl">Precio Combo</span>
            <span class="combo-price-stat-val primary">Bs. ${(safeNum(c.precioVenta)).toFixed(2)}</span>
          </div>
          <div class="combo-price-stat">
            <span class="combo-price-stat-lbl">Costo</span>
            <span class="combo-price-stat-val">Bs. ${(calc.costoTotal).toFixed(2)}</span>
          </div>
          <div class="combo-price-stat">
            <span class="combo-price-stat-lbl">Ganancia</span>
            <span class="combo-price-stat-val success">Bs. ${(ganancia).toFixed(2)} (${margen.toFixed(1)}%)</span>
          </div>
          <div class="combo-price-stat">
            <span class="combo-price-stat-lbl">Disponibles</span>
            <span class="combo-price-stat-val" style="color:var(--inv-primary); font-weight:700;">
              ${calc.stockDisponible} u.
            </span>
          </div>
        </div>

        <div class="combo-card-footer">
          <button class="inv-btn-primary" type="button" style="flex:1; justify-content:center;" onclick="venderComboDesdeManager('${c.id}')" ${isOut ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>
            <span class="material-symbols-outlined">point_of_sale</span>
            <span>${isOut ? 'Sin Stock en Bodega' : 'Vender en Caja (POS)'}</span>
          </button>
        </div>
      </div>`;
  }).join('');
}

window.venderComboDesdeManager = function(cId) {
  if (typeof window.addComboToPOS === 'function') {
    window.addComboToPOS(cId);
  }
  if (typeof window.navegarA === 'function') {
    window.navegarA('pos');
  }
};

function abrirModalCombo(id) {
  editingComboId = id || null;
  comboComponents = [];
  const overlay = document.getElementById('comboModalOverlay');
  const title = document.getElementById('comboModalTitle');
  if (!overlay) return;

  if (id) {
    const c = (window.combos || []).find(x => x.id === id);
    if (!c) return;
    document.getElementById('cmNombre').value = c.nombre;
    document.getElementById('cmDesc').value = c.descripcion || '';
    document.getElementById('cmPrecio').value = c.precioVenta || '';
    comboComponents = (c.componentes || []).map(x => ({ ...x }));
    if (title) title.textContent = 'Editar Combo / Pack';
  } else {
    document.getElementById('cmNombre').value = '';
    document.getElementById('cmDesc').value = '';
    document.getElementById('cmPrecio').value = '';
    comboComponents = [];
    if (title) title.textContent = 'Nuevo Combo / Pack';
  }

  renderComboComponentes();
  overlay.style.display = 'flex';
}

function renderComboComponentes() {
  const cont = document.getElementById('cmComponentes');
  if (!cont) return;

  if (comboComponents.length === 0) {
    cont.innerHTML = '<div class="cm-component-item" style="color:var(--inv-on-surface-variant); font-size:0.85rem; padding:16px; justify-content:center; text-align:center; border:1px dashed var(--inv-border);">No hay componentes seleccionados. Usa el buscador arriba para añadir productos.</div>';
    const resumen = document.getElementById('cmResumenCostos');
    if (resumen) resumen.style.display = 'none';
    const liveStockBox = document.getElementById('cmLiveStockBox');
    if (liveStockBox) liveStockBox.style.display = 'none';
    return;
  }

  cont.innerHTML = comboComponents.map((comp, i) => {
    const p = (window.productos || []).find(x => x.id === comp.productoId);
    const stock = p ? (typeof getTotalUnidadesBase === 'function' ? getTotalUnidadesBase(p) : (p.stock || 0)) : 0;
    const precioV = p ? (typeof getPrecioVentaEfectivo === 'function' ? getPrecioVentaEfectivo(p) : (p.venta || p.precioVenta || 0)) : 0;
    const costo = p ? (typeof getCostoPromedio === 'function' ? getCostoPromedio(p) : (p.costo || 0)) : 0;
    const nombre = p ? p.nombre : (comp.nombreRef || 'Producto');
    const marca = p && p.marca ? ` - ${p.marca}` : '';
    const pres = p && p.presentacion ? ` (${p.presentacion})` : '';

    return `
      <div class="cm-component-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--inv-surface-lowest);border:1px solid var(--inv-border);border-radius:0.75rem;">
        <div style="flex:1; display:flex; flex-direction:column; gap:2px;">
          <span style="font-weight:600; font-size:0.9rem; color:var(--inv-on-surface);">${escHTML(nombre)}${escHTML(marca)}${escHTML(pres)}</span>
          <span style="font-size:0.78rem; color:var(--inv-on-surface-variant);">
            Stock: <b style="color:${stock > 0 ? '#ea580c' : '#dc2626'};">${stock} u.</b> &middot; Costo: Bs.${costo.toFixed(2)}/u &middot; Venta reg.: Bs.${precioV.toFixed(2)}/u
          </span>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <button type="button" class="inv-btn-secondary" style="width:30px; height:28px; padding:0; justify-content:center; border-radius:0.4rem; font-size:11px; font-weight:700;" onclick="updateCompCant(${i}, 6)" title="Fijar 6 unidades">+6</button>
          <button type="button" class="inv-btn-secondary" style="width:32px; height:28px; padding:0; justify-content:center; border-radius:0.4rem; font-size:11px; font-weight:700;" onclick="updateCompCant(${i}, 12)" title="Fijar 12 unidades">+12</button>
          <button type="button" class="inv-btn-secondary" style="width:32px; height:28px; padding:0; justify-content:center; border-radius:0.4rem; font-size:11px; font-weight:700;" onclick="updateCompCant(${i}, 24)" title="Fijar 24 unidades">+24</button>
          <button type="button" class="inv-btn-secondary" style="width:28px; height:28px; padding:0; justify-content:center; border-radius:0.4rem;" onclick="updateCompCant(${i}, ${Math.max(1, (comp.cantidad || 1) - 1)})">&minus;</button>
          <input type="number" class="form-input" style="width:50px; height:28px; text-align:center; padding:2px; font-weight:700; border-radius:0.4rem;" value="${comp.cantidad}" min="1" onchange="updateCompCant(${i}, this.value)" />
          <button type="button" class="inv-btn-secondary" style="width:28px; height:28px; padding:0; justify-content:center; border-radius:0.4rem;" onclick="updateCompCant(${i}, ${(comp.cantidad || 1) + 1})">&plus;</button>
          <button type="button" class="inv-btn-danger-icon" style="width:28px; height:28px; border-radius:0.4rem;" onclick="removeComp(${i})" title="Quitar componente">✕</button>
        </div>
      </div>`;
  }).join('');

  actualizarResumenCombo();
}

function updateCompCant(i, val) {
  if (!comboComponents[i]) return;
  comboComponents[i].cantidad = Math.max(1, parseInt(val) || 1);

  // Auto-sugerir nombre profesional
  const nombreInput = document.getElementById('cmNombre');
  if (nombreInput && (!nombreInput.value.trim() || nombreInput.dataset.autogenerated === 'true')) {
    if (comboComponents.length === 1) {
      const p = (window.productos || []).find(x => x.id === comboComponents[0].productoId);
      const cNom = p ? p.nombre : 'Producto';
      const cant = comboComponents[0].cantidad;
      nombreInput.value = cant > 1 ? `Paquete ${cNom} (${cant} u.)` : `Combo ${cNom}`;
      nombreInput.dataset.autogenerated = 'true';
    } else if (comboComponents.length > 1) {
      const names = comboComponents.map(c => {
        const p = (window.productos || []).find(x => x.id === c.productoId);
        return `${c.cantidad > 1 ? c.cantidad + 'x ' : ''}${p ? p.nombre : 'Item'}`;
      });
      nombreInput.value = 'Combo ' + names.join(' + ');
      nombreInput.dataset.autogenerated = 'true';
    }
  }

  renderComboComponentes();
}

function removeComp(i) {
  comboComponents.splice(i, 1);
  renderComboComponentes();
}

// ── Resumen de costos, ganancia y simulación de stock en vivo del modal ──
function actualizarResumenCombo() {
  const resumen = document.getElementById('cmResumenCostos');
  const liveStockBox = document.getElementById('cmLiveStockBox');
  if (!resumen && !liveStockBox) return;

  if (comboComponents.length === 0) {
    if (resumen) resumen.style.display = 'none';
    if (liveStockBox) liveStockBox.style.display = 'none';
    return;
  }

  // Simulación del stock dinámico disponible
  const precioVenta = parseFloat(document.getElementById('cmPrecio')?.value) || 0;
  const dummyCombo = { componentes: comboComponents, precioVenta };
  const calc = window.calcularStockCombo(dummyCombo);

  // 1. Live Stock Box
  if (liveStockBox) {
    liveStockBox.style.display = 'flex';
    const liveIcon = document.getElementById('cmLiveStockIcon');
    const liveTitle = document.getElementById('cmLiveStockTitle');
    const liveDetail = document.getElementById('cmLiveStockDetail');

    if (calc.stockDisponible > 0) {
      liveStockBox.className = 'combo-live-stock-box';
      if (liveIcon) {
        liveIcon.textContent = 'check_circle';
        liveIcon.style.color = '#ea580c';
      }
      if (liveTitle) liveTitle.textContent = `${calc.stockDisponible} paquetes disponibles con stock actual`;
      if (liveDetail) {
        liveDetail.innerHTML = `Stock calculado automáticamente según las existencias registradas en bodega.`;
      }
    } else {
      liveStockBox.className = 'combo-live-stock-box agotado';
      if (liveIcon) {
        liveIcon.textContent = 'block';
        liveIcon.style.color = '#dc2626';
      }
      if (liveTitle) liveTitle.textContent = `Sin existencias (0 paquetes disponibles)`;
      if (liveDetail) {
        liveDetail.innerHTML = `No hay existencias suficientes en bodega para armar este producto.`;
      }
    }
  }

  // 2. Resumen financiero
  if (resumen) {
    resumen.style.display = 'block';
    const costoTotal = calc.costoTotal;
    let precioRegularSuelto = 0;
    comboComponents.forEach(c => {
      const p = (window.productos || []).find(x => x.id === c.productoId);
      const pr = p ? (typeof getPrecioVentaEfectivo === 'function' ? getPrecioVentaEfectivo(p) : safeNum(p.venta)) : 0;
      precioRegularSuelto += pr * (c.cantidad || 1);
    });

    const ganancia = precioVenta > 0 ? (precioVenta - costoTotal) : 0;
    const margen = (costoTotal > 0 && precioVenta > 0) ? ((ganancia / costoTotal) * 100) : 0;

    const elCosto = document.getElementById('cmCostoTotal');
    const elReg = document.getElementById('cmPrecioRegular');
    const elGanancia = document.getElementById('cmGanancia');
    const elMargen = document.getElementById('cmMargen');

    if (elCosto) elCosto.textContent = 'Bs. ' + costoTotal.toFixed(2);
    if (elReg) elReg.textContent = 'Bs. ' + precioRegularSuelto.toFixed(2);
    if (elGanancia) {
      elGanancia.textContent = 'Bs. ' + ganancia.toFixed(2);
      elGanancia.style.color = ganancia >= 0 ? '#ea580c' : '#dc2626';
    }
    if (elMargen) {
      elMargen.textContent = margen.toFixed(1) + '%';
      elMargen.style.color = margen >= 0 ? 'var(--inv-primary)' : '#dc2626';
    }

    const inputPrecio = document.getElementById('cmPrecio');
    if (inputPrecio && (!inputPrecio.value || parseFloat(inputPrecio.value) === 0) && precioRegularSuelto > 0) {
      inputPrecio.placeholder = precioRegularSuelto.toFixed(2);
    }

    if (elGanancia) elGanancia.style.color = ganancia >= 0 ? '#ea580c' : '#dc2626';
    if (elMargen) elMargen.style.color = margen >= 30 ? '#ea580c' : (margen >= 15 ? '#d97706' : '#dc2626');
  }
}

// Búsqueda en modal
const cmSearchInput = document.getElementById('cmSearchInput');
if (cmSearchInput) {
  cmSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const res = document.getElementById('cmSearchResults');
    if (!res) return;
    if (!q) { res.style.display = 'none'; return; }

    const matches = (window.productos || []).filter(p => (p.nombre + ' ' + (p.marca || '')).toLowerCase().includes(q)).slice(0, 10);
    if (!matches.length) {
      res.innerHTML = '<div class="cm-search-empty">No se encontraron productos</div>';
      res.style.display = 'block';
      return;
    }

    res.innerHTML = matches.map(p => {
      const stock = typeof getTotalUnidadesBase === 'function' ? getTotalUnidadesBase(p) : (p.stock || 0);
      const precioV = typeof getPrecioVentaEfectivo === 'function' ? getPrecioVentaEfectivo(p) : (p.venta || p.precioVenta || 0);
      const costo = typeof getCostoPromedio === 'function' ? getCostoPromedio(p) : (p.costo || 0);

      return `
        <div class="cm-search-item" onclick="addCompFromSearch('${p.id}', '${p.nombre.replace(/'/g, "\\'")}')">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight:600; font-size:0.88rem; color:var(--inv-on-surface);">${escHTML(p.nombre)} ${p.marca ? ' - ' + escHTML(p.marca) : ''}</span>
            <span style="font-size:0.75rem; color:var(--inv-on-surface-variant)">Disp: <b style="color:${stock > 0 ? '#ea580c' : '#dc2626'}">${stock} u.</b> &middot; Costo: Bs.${costo.toFixed(2)} &middot; Venta: Bs.${precioV.toFixed(2)}</span>
          </div>
          <span style="font-size:1.3rem; color:var(--inv-primary); font-weight:bold;">&plus;</span>
        </div>`;
    }).join('');
    res.style.display = 'block';
  });
}

window.addCompFromSearch = function(pid, nombre) {
  const exists = comboComponents.find(c => c.productoId === pid);
  if (exists) {
    exists.cantidad++;
  } else {
    comboComponents.push({ productoId: pid, nombreRef: nombre, cantidad: 1 });
  }
  const input = document.getElementById('cmSearchInput');
  if (input) input.value = '';
  const res = document.getElementById('cmSearchResults');
  if (res) res.style.display = 'none';

  // Sugerir nombre automáticamente si está vacío o auto-generado
  const nombreInput = document.getElementById('cmNombre');
  if (nombreInput && (!nombreInput.value.trim() || nombreInput.dataset.autogenerated === 'true')) {
    if (comboComponents.length === 1) {
      const cant = comboComponents[0].cantidad;
      nombreInput.value = cant > 1 ? `Paquete ${nombre} (${cant} u.)` : `Combo ${nombre}`;
      nombreInput.dataset.autogenerated = 'true';
    } else if (comboComponents.length > 1) {
      const names = comboComponents.map(c => `${c.cantidad > 1 ? c.cantidad + 'x ' : ''}${c.nombreRef || 'Item'}`);
      nombreInput.value = 'Combo ' + names.join(' + ');
      nombreInput.dataset.autogenerated = 'true';
    }
  }

  renderComboComponentes();
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('#cmSearchInput') && !e.target.closest('#cmSearchResults')) {
    const res = document.getElementById('cmSearchResults');
    if (res) res.style.display = 'none';
  }
});

// Guardar Combo
document.getElementById('comboModalSave')?.addEventListener('click', () => {
  const nombre = document.getElementById('cmNombre').value.trim();
  const desc = document.getElementById('cmDesc').value.trim();
  const precio = parseFloat(document.getElementById('cmPrecio').value) || 0;
  if (!nombre) { toast('Ingresa un nombre para el combo', 'error'); return; }
  if (precio <= 0) { toast('Ingresa un precio de venta válido para el combo', 'error'); return; }
  if (!comboComponents.length || !comboComponents.some(c => c.productoId)) { toast('Agrega al menos un producto componente', 'error'); return; }

  const validos = comboComponents.filter(c => c.productoId).map(c => ({
    productoId: c.productoId,
    nombreRef: c.nombreRef || '',
    cantidad: Math.max(1, parseInt(c.cantidad) || 1)
  }));

  if (editingComboId) {
    const idx = (window.combos || []).findIndex(c => c.id === editingComboId);
    if (idx > -1) {
      window.combos[idx] = {
        ...window.combos[idx],
        nombre,
        descripcion: desc,
        precioVenta: precio,
        componentes: validos,
        updatedAt: Date.now()
      };
    }
  } else {
    if (!window.combos) window.combos = [];
    window.combos.unshift({
      id: typeof genId === 'function' ? genId() : ('c_' + Date.now()),
      nombre,
      descripcion: desc,
      precioVenta: precio,
      activo: true,
      componentes: validos,
      fechaCreacion: new Date().toISOString()
    });
  }

  if (typeof setCombosGlobal === 'function') setCombosGlobal(window.combos);
  if (typeof saveCombos === 'function') saveCombos();
  document.getElementById('comboModalOverlay').style.display = 'none';

  renderCombosManager();
  if (typeof renderCombosVenta === 'function') renderCombosVenta();
  toast(editingComboId ? 'Combo actualizado exitosamente' : 'Combo creado exitosamente', 'success');
});

function eliminarCombo(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar este combo promocional?')) return;
  window.combos = (window.combos || []).filter(c => c.id !== id);
  if (typeof setCombosGlobal === 'function') setCombosGlobal(window.combos);
  if (typeof saveCombos === 'function') saveCombos();
  if (window.syncDeleteCombo) window.syncDeleteCombo(id);
  renderCombosManager();
  if (typeof renderCombosVenta === 'function') renderCombosVenta();
  toast('Combo eliminado', 'warning');
}

document.getElementById('comboModalClose')?.addEventListener('click', () => {
  document.getElementById('comboModalOverlay').style.display = 'none';
});
document.getElementById('comboModalCancel')?.addEventListener('click', () => {
  document.getElementById('comboModalOverlay').style.display = 'none';
});
document.getElementById('comboModalOverlay')?.addEventListener('click', function(e) {
  if (e.target === this) this.style.display = 'none';
});
document.getElementById('btnNuevoCombo')?.addEventListener('click', () => abrirModalCombo());

// Filtros y buscador dinámico de Combos Manager
document.getElementById('combosSearchInput')?.addEventListener('input', renderCombosManager);
document.getElementById('combosFilterEstado')?.addEventListener('change', renderCombosManager);
document.getElementById('combosFilterOrden')?.addEventListener('change', renderCombosManager);

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

// ── EXPORTAR / IMPORTAR DATOS (BACKUP v4.1) ──
window.exportarDatos = function() {
  const datos = {
    version: '4.1',
    fecha: new Date().toISOString(),
    dispositivo: navigator.userAgent.substring(0, 50),
    productos: window.productos || [],
    ventas: window.ventas || [],
    combos: window.combos || [],
    clientes: window.clientes || [],
    fiados: window.fiados || [],
    pagos: window.pagos || [],
    actividad: window.actividad || [],
    historialPrecios: window.historialPrecios || JSON.parse(localStorage.getItem('tiaeli_historial_precios') || '[]')
  };
  try { datos.salidas = JSON.parse(localStorage.getItem('tiaeli_salidas') || '[]'); } catch { datos.salidas = []; }
  try { datos.entradas = JSON.parse(localStorage.getItem('tiaeli_entradas') || '[]'); } catch { datos.entradas = []; }

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

  toast(`✅ Backup v4.1 descargado: ${totalProductos} productos, ${totalVentas} ventas`, 'success');
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
        
        // Add new items from remote or update existing with newer version
        remote.forEach(item => {
          const localItem = localMap.get(item[idKey]);
          if (!localItem) {
            localMap.set(item[idKey], item);
          } else {
            // Compare updatedAt to keep the newer version
            const localUpdated = localItem.updatedAt || localItem.fechaRegistro || 0;
            const remoteUpdated = item.updatedAt || item.fechaRegistro || 0;
            if (remoteUpdated > localUpdated) {
              localMap.set(item[idKey], item);
            }
            // If local is newer, keep local (preserve unsynced changes)
          }
        });
        
        return Array.from(localMap.values());
      }
      
      // Deep merge for products (preserve local lotes changes if newer)
      function mergeProductosDeep(local, remote) {
        const localMap = new Map(local.map(p => [p.id, p]));
        const remoteMap = new Map(remote.map(p => [p.id, p]));
        
        remote.forEach(remoteProd => {
          const localProd = localMap.get(remoteProd.id);
          if (!localProd) {
            localMap.set(remoteProd.id, remoteProd);
          } else {
            // Compare updatedAt
            const localUpdated = localProd.updatedAt || localProd.fechaRegistro || 0;
            const remoteUpdated = remoteProd.updatedAt || remoteProd.fechaRegistro || 0;
            
            if (remoteUpdated > localUpdated) {
              // Remote is newer, but preserve local lotes if they have newer data
              const mergedProd = { ...remoteProd };
              // Merge lotes arrays by ID, keeping newer entries
              if (localProd.lotes && remoteProd.lotes) {
                const localLotesMap = new Map(localProd.lotes.map(l => [l.id, l]));
                const remoteLotesMap = new Map(remoteProd.lotes.map(l => [l.id, l]));
                
                remoteProd.lotes.forEach(l => {
                  const localLote = localLotesMap.get(l.id);
                  if (!localLote || (l.updatedAt || 0) >= (localLote.updatedAt || 0)) {
                    localLotesMap.set(l.id, l);
                  } else {
                    localLotesMap.set(l.id, localLote);
                  }
                });
                mergedProd.lotes = Array.from(localLotesMap.values());
              } else if (localProd.lotes && !remoteProd.lotes) {
                mergedProd.lotes = localProd.lotes;
              }
              localMap.set(remoteProd.id, mergedProd);
            }
            // If local is newer, keep local entirely
          }
        });
        
        return Array.from(localMap.values());
      }

      // Merge productos (deep merge to preserve lotes)
      if (datos.productos) {
        const mergedProductos = mergeProductosDeep(window.productos || [], datos.productos);
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

      // Merge clientes / fiados / pagos
      if (datos.clientes) {
        const merged = mergeArrays(window.clientes || [], datos.clientes);
        localStorage.setItem('tiaeli_clientes', JSON.stringify(merged));
        window.clientes = merged;
        if (window.setClientesGlobal) window.setClientesGlobal(merged);
      }
      if (datos.fiados) {
        const merged = mergeArrays(window.fiados || [], datos.fiados);
        localStorage.setItem('tiaeli_fiados', JSON.stringify(merged));
        window.fiados = merged;
        if (window.setFiadosGlobal) window.setFiadosGlobal(merged);
      }
      if (datos.pagos) {
        const merged = mergeArrays(window.pagos || [], datos.pagos);
        localStorage.setItem('tiaeli_pagos', JSON.stringify(merged));
        window.pagos = merged;
        if (window.setPagosGlobal) window.setPagosGlobal(merged);
      }
      if (datos.historialPrecios) {
        const merged = mergeArrays(window.historialPrecios || [], datos.historialPrecios);
        localStorage.setItem('tiaeli_historial_precios', JSON.stringify(merged));
        window.historialPrecios = merged;
      }
      if (datos.salidas) {
        const localSalidas = JSON.parse(localStorage.getItem('tiaeli_salidas') || '[]');
        localStorage.setItem('tiaeli_salidas', JSON.stringify(mergeArrays(localSalidas, datos.salidas)));
      }
      if (datos.entradas) {
        const localEntradas = JSON.parse(localStorage.getItem('tiaeli_entradas') || '[]');
        localStorage.setItem('tiaeli_entradas', JSON.stringify(mergeArrays(localEntradas, datos.entradas)));
      }
      if (datos.actividad) {
        const localAct = window.actividad || [];
        const merged = mergeArrays(localAct, datos.actividad).sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
        localStorage.setItem('tiaeli_actividad', JSON.stringify(merged));
        window.actividad = merged;
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
      if (window.syncSaveCliente && datos.clientes) {
        datos.clientes.forEach(c => syncPromises.push(window.syncSaveCliente(c)));
      }
      if (window.syncSaveFiado && datos.fiados) {
        datos.fiados.forEach(f => syncPromises.push(window.syncSaveFiado(f)));
      }
      if (window.syncSavePago && datos.pagos) {
        datos.pagos.forEach(p => syncPromises.push(window.syncSavePago(p)));
      }
      if (window.syncSaveHistorialPrecio && datos.historialPrecios) {
        datos.historialPrecios.forEach(h => syncPromises.push(window.syncSaveHistorialPrecio(h)));
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
      if (typeof renderFiados === 'function') renderFiados();
      if (typeof renderActividad === 'function') renderActividad();

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

// ═══════════════════════════════════════════
// MEJORAS ADICIONALES - UX/ACCESIBILIDAD
// ═══════════════════════════════════════════

// Theme transition suave al cambiar
(function initThemeTransition() {
  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease !important; }';
  let timeout;
  const origApply = window.applyTheme;
  if (typeof origApply === 'function') {
    window.applyTheme = function(theme) {
      origApply(theme);
      document.head.appendChild(style);
      clearTimeout(timeout);
      timeout = setTimeout(() => style.remove(), 400);
    };
  }
})();

// Auto-focus search inputs al cambiar de sección
(function initAutoFocusSearch() {
  const sectionSearchMap = {
    inventario: 'searchInput',
    pos: 'posSearchInput',
    historial: 'hSearch',
    fiados: 'fiadoSearch'
  };
  const observer = new MutationObserver(() => {
    for (const [section, inputId] of Object.entries(sectionSearchMap)) {
      const sec = document.getElementById('section-' + section);
      if (sec && sec.style.display !== 'none' && getComputedStyle(sec).display !== 'none') {
        const input = document.getElementById(inputId);
        if (input) setTimeout(() => input.focus(), 100);
        break;
      }
    }
  });
  document.querySelectorAll('[data-section]').forEach(sec => {
    observer.observe(sec, { attributes: true, attributeFilter: ['style'] });
  });
})();

// Smooth scroll en tablas con scroll horizontal
document.querySelectorAll('.table-responsive, .inv-table-wrap').forEach(wrap => {
  wrap.style.scrollBehavior = 'smooth';
});

// Confirmation antes de salir con datos sin guardar
(function initBeforeUnload() {
  let dirty = false;
  document.getElementById('productForm')?.addEventListener('input', () => { dirty = true; });
  document.getElementById('productForm')?.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();

// PWA install prompt mejorado
(function initPWABanner() {
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('pwaBanner');
    if (banner) {
      banner.style.display = 'flex';
      const installBtn = document.getElementById('pwaBannerInstall');
      const closeBtn = document.getElementById('pwaBannerClose');
      if (installBtn) installBtn.onclick = async () => {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') banner.style.display = 'none';
        deferredPrompt = null;
      };
      if (closeBtn) closeBtn.onclick = () => { banner.style.display = 'none'; };
    }
  });
})();

console.log('[Extras] Mejoras UX cargadas');

