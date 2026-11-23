const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 }
  });
  const page = await context.newPage();

  const fileUrl = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
  console.log('Navigating to', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

  // Autologin as ELI and populate sample gastos and products if needed
  await page.evaluate(() => {
    window.sesion = 'ELI';
    localStorage.setItem('tiaeli_sesion', 'ELI');
    localStorage.setItem('tiaeli_usuario_activo', 'ELI');
    if (typeof seleccionarUsuario === 'function') seleccionarUsuario('ELI');
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.remove();

    // Seed mock gastos if empty for visual check
    let mockGastos = [
      { id: 'g1', categoria: 'luz', categoriaLabel: 'Luz (Electricidad)', monto: 180.00, fecha: Date.now(), fechaStr: '2026-11-15', nota: 'Factura luz heladeras y mostrador', usuario: 'ELI' },
      { id: 'g2', categoria: 'agua', categoriaLabel: 'Agua', monto: 45.00, fecha: Date.now(), fechaStr: '2026-11-14', nota: 'Consumo agua potable tienda', usuario: 'ELI' },
      { id: 'g3', categoria: 'extras', categoriaLabel: 'Extras / Insumos', monto: 30.00, fecha: Date.now(), fechaStr: '2026-11-13', nota: 'Bolsas plásticas y papel higiénico', usuario: 'ELI' }
    ];
    localStorage.setItem('tiaeli_gastos', JSON.stringify(mockGastos));
    if (typeof window.setGastosGlobal === 'function') window.setGastosGlobal(mockGastos);
  });

  await page.waitForTimeout(1000);

  // 1. Screenshot of Inventory with "Consumo Dueño" button
  console.log('Navigating to inventario...');
  await page.evaluate(() => {
    if (typeof navegarA === 'function') navegarA('inventario');
  });
  await page.waitForTimeout(600);
  await page.screenshot({ 
    path: 'C:/Users/J. Valdivia/.gemini/antigravity/brain/186cba1b-dee8-4fb0-8c84-de5eafab621b/verificacion_inventario_consumo_btn.png', 
    fullPage: false 
  });

  // 2. Open Consumo de Dueño modal
  console.log('Opening Consumo de Dueño modal...');
  await page.evaluate(() => {
    const prodId = (window.productos && window.productos.length > 0) ? window.productos[0].id : null;
    window.abrirConsumoDuenoModal(prodId);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ 
    path: 'C:/Users/J. Valdivia/.gemini/antigravity/brain/186cba1b-dee8-4fb0-8c84-de5eafab621b/verificacion_modal_consumo_dueno.png', 
    fullPage: false 
  });

  // Close Consumo Dueño modal
  await page.evaluate(() => {
    window.cerrarConsumoDuenoModal();
  });
  await page.waitForTimeout(300);

  // 3. Navigate to #section-gastos
  console.log('Navigating to Gastos...');
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach(el => el.style.display = 'none');
    if (typeof navegarA === 'function') navegarA('gastos');
    if (typeof window.renderGastos === 'function') window.renderGastos();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ 
    path: 'C:/Users/J. Valdivia/.gemini/antigravity/brain/186cba1b-dee8-4fb0-8c84-de5eafab621b/verificacion_section_gastos.png', 
    fullPage: false 
  });

  // 4. Open Gasto Modal
  console.log('Opening Gasto Modal...');
  await page.evaluate(() => {
    window.abrirGastoModal();
  });
  await page.waitForTimeout(600);
  await page.screenshot({ 
    path: 'C:/Users/J. Valdivia/.gemini/antigravity/brain/186cba1b-dee8-4fb0-8c84-de5eafab621b/verificacion_modal_gasto.png', 
    fullPage: false 
  });

  console.log('All screenshots captured successfully!');
  await browser.close();
})();
