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

  // Autologin as ELI and navigate to inventario
  await page.evaluate(() => {
    window.sesion = 'ELI';
    localStorage.setItem('tiaeli_sesion', 'ELI');
    localStorage.setItem('tiaeli_usuario_activo', 'ELI');
    if (typeof seleccionarUsuario === 'function') seleccionarUsuario('ELI');
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.remove();
    }
    if (typeof navegarA === 'function') navegarA('inventario');
  });

  // Wait for products to load
  await page.waitForFunction(() => window.productos && window.productos.length > 0, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // 1. Screenshot of the inventory table
  console.log('Taking screenshot of table actions...');
  await page.screenshot({ 
    path: 'C:/Users/J. Valdivia/.gemini/antigravity/brain/186cba1b-dee8-4fb0-8c84-de5eafab621b/verificacion_acciones_tabla_moderna.png', 
    fullPage: false 
  });

  // 2. Open Edit Modal for first product
  console.log('Opening Edit Modal...');
  await page.evaluate(() => {
    if (window.productos && window.productos.length > 0) {
      window.editarProducto(window.productos[0].id);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ 
    path: 'C:/Users/J. Valdivia/.gemini/antigravity/brain/186cba1b-dee8-4fb0-8c84-de5eafab621b/verificacion_modal_editar_compacto.png', 
    fullPage: false 
  });

  // Close Edit Modal
  await page.evaluate(() => {
    const editOverlay = document.getElementById('editarProductoOverlay');
    if (editOverlay) editOverlay.style.display = 'none';
  });
  await page.waitForTimeout(300);

  // 3. Open Entrada Modal for first product
  console.log('Opening Entrada Modal...');
  await page.evaluate(() => {
    if (window.productos && window.productos.length > 0) {
      window.abrirEntrada(window.productos[0].id);
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ 
    path: 'C:/Users/J. Valdivia/.gemini/antigravity/brain/186cba1b-dee8-4fb0-8c84-de5eafab621b/verificacion_modal_entrada_compacto_2col.png', 
    fullPage: false 
  });

  console.log('Visual verification complete!');
  await browser.close();
})();
