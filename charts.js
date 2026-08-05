// ═══════════════════════════════════════════
// charts.js — Chart.js visualizations
// ═══════════════════════════════════════════

let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function getChartColors() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    text: dark ? '#a1a1aa' : '#52525b',
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    bar: dark ? '#fafafa' : '#09090b',
    barAlpha: dark ? 'rgba(250,250,250,0.08)' : 'rgba(9,9,11,0.07)',
    green: dark ? '#22c55e' : '#16a34a',
    red: dark ? '#f87171' : '#dc2626',
    palette: ['#09090b','#52525b','#a1a1aa','#16a34a','#dc2626','#ea580c','#ca8a04','#2563eb']
  };
}

function buildChartDefaults() {
  const c = getChartColors();
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = c.text;
  Chart.defaults.plugins.legend.labels.color = c.text;
}

// ── Ventas 7 días ──
function renderChart7d() {
  buildChartDefaults();
  const c = getChartColors();
  destroyChart('c7d');
  const ctx = document.getElementById('chartVentas7d');
  if (!ctx) return;

  const days = [], totals = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const dn = new Date(d); dn.setDate(dn.getDate() + 1);
    const label = d.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' });
    const total = (window.ventas || []).filter(v => {
      const vd = new Date(typeof v.fecha === 'number' ? v.fecha : v.fecha); return vd >= d && vd < dn;
    }).reduce((s, v) => s + v.total, 0);
    days.push(label); totals.push(parseFloat(total.toFixed(2)));
  }

  const total7d = totals.reduce((a, b) => a + b, 0);
  const badge = document.getElementById('chart-total-badge');
  if (badge) badge.textContent = 'Bs. ' + total7d.toFixed(2);

  chartInstances['c7d'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Ventas (Bs.)',
        data: totals,
        backgroundColor: totals.map((v, i) => i === totals.length - 1 ? c.bar : c.barAlpha),
        borderColor: c.bar,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'Bs. ' + ctx.raw.toFixed(2) } } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: c.text } },
        y: { grid: { color: c.grid, drawBorder: false }, border: { display: false }, ticks: { color: c.text, callback: v => 'Bs.' + v } }
      },
      animation: { duration: 800, easing: 'easeInOutQuart' }
    }
  });
}

// ── Ventas por categoría (donut) ──
function renderChartCategorias() {
  buildChartDefaults();
  const c = getChartColors();
  destroyChart('ccat');
  const ctx = document.getElementById('chartCategorias');
  if (!ctx) return;
  const map = {};
  (window.ventas || []).forEach(v => { map[v.categoria] = (map[v.categoria] || 0) + v.total; });
  const labels = Object.keys(map), data = Object.values(map);
  if (!labels.length) { chartInstances['ccat'] = null; return; }
  chartInstances['ccat'] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: c.palette, borderColor: 'transparent', borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: { legend: { position: 'bottom', labels: { color: c.text, padding: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ctx.label + ': Bs. ' + ctx.raw.toFixed(2) } } },
      animation: { duration: 900, easing: 'easeInOutBack' }
    }
  });
}

// ── Ventas 30 días ──
function renderChart30d() {
  buildChartDefaults();
  const c = getChartColors();
  destroyChart('c30d');
  const ctx = document.getElementById('chartVentas30d');
  if (!ctx) return;
  const days = [], totals = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const dn = new Date(d); dn.setDate(dn.getDate() + 1);
    const label = d.getDate() + '/' + (d.getMonth() + 1);
    const total = (window.ventas || []).filter(v => { const vd = new Date(typeof v.fecha === 'number' ? v.fecha : v.fecha); return vd >= d && vd < dn; }).reduce((s, v) => s + v.total, 0);
    days.push(label); totals.push(parseFloat(total.toFixed(2)));
  }
  chartInstances['c30d'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Ventas', data: totals,
        borderColor: c.bar, backgroundColor: c.barAlpha,
        borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'Bs. ' + ctx.raw.toFixed(2) } } },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 10, color: c.text } }, y: { grid: { color: c.grid }, border: { display: false }, ticks: { color: c.text, callback: v => 'Bs.' + v } } },
      animation: { duration: 1000 }
    }
  });
}

// ── Horas pico ──
function renderChartHoras() {
  buildChartDefaults();
  const c = getChartColors();
  destroyChart('choras');
  const ctx = document.getElementById('chartHoras');
  if (!ctx) return;
  const hours = Array(24).fill(0);
  (window.ventas || []).forEach(v => { const h = new Date(typeof v.fecha === 'number' ? v.fecha : v.fecha).getHours(); hours[h] += v.total; });
  const labels = hours.map((_, i) => i + 'h');
  chartInstances['choras'] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Bs.', data: hours.map(v => parseFloat(v.toFixed(2))), backgroundColor: c.barAlpha, borderColor: c.bar, borderWidth: 1, borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 12, color: c.text } }, y: { grid: { color: c.grid }, border: { display: false }, ticks: { color: c.text } } },
      animation: { duration: 700 }
    }
  });
}

// ── Forma de pago (pie) ──
function renderChartPagos() {
  buildChartDefaults();
  const c = getChartColors();
  destroyChart('cpagos');
  const ctx = document.getElementById('chartPagos');
  if (!ctx) return;
  const map = {};
  (window.ventas || []).forEach(v => { map[v.pago] = (map[v.pago] || 0) + v.total; });
  const labels = Object.keys(map), data = Object.values(map);
  if (!labels.length) return;
  const colors = labels.map(l => l === 'efectivo' ? c.green : l === 'qr' ? c.text : '#2563eb');
  chartInstances['cpagos'] = new Chart(ctx, {
    type: 'pie',
    data: { labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)), datasets: [{ data, backgroundColor: colors, borderColor: 'transparent' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: c.text, padding: 8 } } }, animation: { duration: 800 } }
  });
}

// ── Ganancia por categoría ──
function renderChartGanCat() {
  buildChartDefaults();
  const c = getChartColors();
  destroyChart('cgancat');
  const ctx = document.getElementById('chartGanCat');
  if (!ctx) return;
  const map = {};
  (window.ventas || []).forEach(v => { map[v.categoria] = (map[v.categoria] || 0) + v.ganancia; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(x => x[0]), data = sorted.map(x => parseFloat(x[1].toFixed(2)));
  if (!labels.length) return;
  chartInstances['cgancat'] = new Chart(ctx, {
    type: 'bar', indexAxis: 'y',
    data: { labels, datasets: [{ label: 'Ganancia (Bs.)', data, backgroundColor: data.map(v => v >= 0 ? c.green.replace(')', ',.2)').replace('rgb', 'rgba') : c.red.replace(')', ',.2)').replace('rgb', 'rgba')), borderColor: data.map(v => v >= 0 ? c.green : c.red), borderWidth: 1.5, borderRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { grid: { color: c.grid }, border: { display: false }, ticks: { color: c.text, callback: v => 'Bs.' + v } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: c.text } } },
      animation: { duration: 800 }
    }
  });
}

// ── Top productos analytics ──
function renderAnTopProd() {
  const cont = document.getElementById('anTopProd');
  if (!cont) return;
  const map = {};
  (window.ventas || []).forEach(v => {
    if (!map[v.productoNombre]) map[v.productoNombre] = { total: 0, cant: 0, ganancia: 0, cat: v.categoria };
    map[v.productoNombre].total += v.total;
    map[v.productoNombre].cant += v.cantidad;
    map[v.productoNombre].ganancia += v.ganancia;
  });
  const sorted = Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  if (!sorted.length) { cont.innerHTML = '<p style="color:var(--text3);font-size:.85rem">Sin ventas aún.</p>'; return; }
  const maxTotal = sorted[0][1].total;
  cont.innerHTML = sorted.map(([name, d], i) => `
    <div class="top-prod-item">
      <div class="top-prod-rank${i===0?' gold':i===1?' silver':i===2?' bronze':''}">${i+1}</div>
      <div class="top-prod-info">
        <div class="top-prod-name">${name}</div>
        <div class="top-prod-cat">${d.cat} &middot; ${d.cant} uds vendidas</div>
        <div class="top-bar"><div class="top-bar-fill" style="width:${(d.total/maxTotal*100).toFixed(1)}%"></div></div>
      </div>
      <div class="top-prod-val">Bs. ${d.total.toFixed(2)}</div>
    </div>`).join('');
}

// ── Top 5 para dashboard ──
function renderTopProductosDash() {
  const cont = document.getElementById('topProductosList');
  if (!cont) return;
  const map = {};
  (window.ventas || []).forEach(v => {
    if (!map[v.productoNombre]) map[v.productoNombre] = { total: 0, cant: 0, cat: v.categoria, id: v.productoId };
    map[v.productoNombre].total += v.total;
    map[v.productoNombre].cant += v.cantidad;
  });
  const sorted = Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  if (!sorted.length) { cont.innerHTML = '<div class="empty-state" style="padding:20px"><p>Sin ventas aún.</p></div>'; return; }
  const maxTotal = sorted[0][1].total;
   cont.innerHTML = sorted.map(([name, d], i) => {
    const prod = (window.productos || []).find(p => p.id === d.id);
    const foto = prod && prod.foto ? `<img src="${prod.foto}" alt="${name}" />` : (name.charAt(0));
    const sub = [prod?.marca, prod?.presentacion, prod?.categoria].filter(Boolean).join(' / ');
    return `<div class="top-prod-item">
      <div class="top-prod-rank${i===0?' gold':i===1?' silver':i===2?' bronze':''}">${i+1}</div>
      <div class="top-prod-img">${prod && prod.foto ? '<img src="'+prod.foto+'" />' : name.charAt(0)}</div>
      <div class="top-prod-info">
        <div class="top-prod-name">${name}</div>
        <div class="top-prod-cat">${sub || d.cat}</div>
        <div class="top-bar"><div class="top-bar-fill" style="width:${(d.total/maxTotal*100).toFixed(1)}%"></div></div>
      </div>
      <div class="top-prod-val">Bs. ${d.total.toFixed(2)}</div>
    </div>`;
  }).join('');
}

// ── Analytics stats ──
function renderAnalyticsStats() {
  const all = window.ventas || [];
  const total = all.reduce((s,v)=>s+v.total,0);
  const ganancia = all.reduce((s,v)=>s+v.ganancia,0);
  const avg = all.length > 0 ? total/all.length : 0;
  const set=(id, val, p, d)=>{
    const el=document.getElementById(id);
    if(el) {
      const valStr = d ? val.toFixed(d) : val;
      el.innerHTML = window.odoHtml ? window.odoHtml(valStr, d?'money':'int', p||'') : (p||'') + valStr;
    }
  };
  set('an-total', total, 'Bs.', 0);
  set('an-ganancia', ganancia, 'Bs.', 0);
  set('an-txns', all.length, '', 0);
  set('an-avg', avg, 'Bs.', 0);
  if(window.initOdometers) window.initOdometers();
}

// ── Render all charts ──
function renderAllCharts() {
  setTimeout(() => {
    renderChart7d();
    renderChartCategorias();
    renderTopProductosDash();
  }, 100);
}

function renderAnalyticsCharts() {
  setTimeout(() => {
    renderAnalyticsStats();
    renderChart30d();
    renderChartHoras();
    renderChartPagos();
    renderChartGanCat();
    renderAnTopProd();
  }, 100);
}

// Re-render charts when theme changes
document.addEventListener('themeChanged', () => {
  renderAllCharts();
  const activeSection = document.querySelector('.section.active');
  if (activeSection && activeSection.id === 'section-analytics') renderAnalyticsCharts();
});
