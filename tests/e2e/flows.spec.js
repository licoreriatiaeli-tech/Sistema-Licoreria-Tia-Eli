// ═══════════════════════════════════════════
// tests/e2e/flows.spec.js — Tests E2E de flujos principales
// ═══════════════════════════════════════════

import { test, expect } from '@playwright/test';

test.describe('Flujos principales', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Esperar a que la app cargue
    await page.waitForSelector('#section-dashboard', { state: 'visible', timeout: 10000 });
  });

  test.describe('Navegación', () => {
    test('navega a Inventario', async ({ page }) => {
      await page.click('#nav-inventario');
      await expect(page.locator('#section-inventario')).toBeVisible();
    });

    test('navega a Agregar Producto', async ({ page }) => {
      await page.click('#nav-agregar');
      await expect(page.locator('#section-agregar')).toBeVisible();
      await expect(page.locator('#formTitle')).toContainText('Agregar Producto');
    });

    test('navega a POS', async ({ page }) => {
      await page.click('#nav-pos');
      await expect(page.locator('#section-pos')).toBeVisible();
    });
  });

  test.describe('Agregar Producto - Formulario Directo', () => {
    test('guarda producto completo directamente', async ({ page }) => {
      await page.click('#nav-agregar');
      
      await page.fill('#fNombre', 'Producto Completo E2E');
      await page.selectOption('#fCategoria', 'Sodas');
      await page.fill('#costoUnidad', '10.00');
      await page.fill('#precioUnidad_unidad', '15.00');
      await page.fill('#fCantidadInicial', '5');
      await page.fill('#fStockMin', '12');
      
      // Guardar
      await page.click('#btnGuardarProductoDirecto');
      
      // Verificar navegación a inventario
      await expect(page.locator('#section-inventario')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#invTableBody')).toContainText('Producto Completo E2E');
    });

    test('limpia formulario al navegar fuera sin guardar', async ({ page }) => {
      await page.click('#nav-agregar');
      await page.fill('#fNombre', 'Producto Temporal');
      await page.selectOption('#fCategoria', 'Licores');
      
      // Navegar a Inventario sin guardar
      await page.click('#nav-inventario');
      
      // Volver a Agregar
      await page.click('#nav-agregar');
      
      // Verificar formulario limpio
      await expect(page.locator('#fNombre')).toHaveValue('');
    });
  });

  test.describe('Inventario - Tabla', () => {
    test('filtra por búsqueda', async ({ page }) => {
      await page.click('#nav-inventario');
      await page.fill('#searchInput', 'Producto');
      await expect(page.locator('#invTableBody')).toContainText('Producto');
    });

    test('filtra por categoría', async ({ page }) => {
      await page.click('#nav-inventario');
      await page.selectOption('#filterCategoria', 'Licores');
      // Verificar que solo muestra licores
      const rows = page.locator('#invTableBody tr.inventory-row');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        await expect(rows.nth(i).locator('.cat-badge')).toContainText('Licores');
      }
    });

    test('expande lote al clickear flecha', async ({ page }) => {
      await page.click('#nav-inventario');
      // Esperar a que haya al menos un producto con lotes
      const expandBtn = page.locator('.btn-expand').first();
      if (await expandBtn.isVisible()) {
        await expandBtn.click();
        await expect(page.locator('.lote-row.open')).toBeVisible();
      }
    });
  });

  test.describe('POS - Venta rápida', () => {
    test('agrega producto al carrito', async ({ page }) => {
      await page.click('#nav-pos');
      await expect(page.locator('#posGrid')).toBeVisible();
      
      // Click en primer producto
      const firstProduct = page.locator('.pos-card').first();
      await firstProduct.click();
      
      // Verificar carrito
      await expect(page.locator('#posCartBadge')).toBeVisible();
      await expect(page.locator('#posCartBadge')).toHaveText('1');
    });

    test('abre carrito y muestra items', async ({ page }) => {
      await page.click('#nav-pos');
      const firstProduct = page.locator('.pos-card').first();
      await firstProduct.click();
      
      // Abrir carrito (FAB)
      await page.click('#posCartFloatingBtn');
      
      await expect(page.locator('#posCartContainer')).toBeVisible();
      await expect(page.locator('.pos-cart-item')).toBeVisible();
    });
  });

  test.describe('Historial', () => {
    test('filtra por fecha', async ({ page }) => {
      await page.click('#nav-historial');
      await page.fill('#hFechaDesde', '2024-01-01');
      await page.fill('#hFechaHasta', '2024-12-31');
      await page.click('#btnFiltrarHistorial');
      await expect(page.locator('#histTableBody')).toBeVisible();
    });
  });

  test.describe('Responsive', () => {
    test('mobile: bottom nav visible', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('.mobile-only-nav')).toBeVisible();
    });

    test('desktop: sidebar visible', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await expect(page.locator('.sidebar')).toBeVisible();
    });
  });
});

test.describe('Visual Regression', () => {
  test('dashboard - screenshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#section-dashboard', { state: 'visible' });
    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('inventario - screenshot', async ({ page }) => {
    await page.goto('/');
    await page.click('#nav-inventario');
    await page.waitForSelector('#section-inventario', { state: 'visible' });
    await expect(page).toHaveScreenshot('inventario.png');
  });

  test('agregar producto - screenshot', async ({ page }) => {
    await page.goto('/');
    await page.click('#nav-agregar');
    await page.waitForSelector('#section-agregar', { state: 'visible' });
    await expect(page).toHaveScreenshot('agregar-producto.png');
  });

  test('pos - screenshot', async ({ page }) => {
    await page.goto('/');
    await page.click('#nav-pos');
    await page.waitForSelector('#section-pos', { state: 'visible' });
    await expect(page).toHaveScreenshot('pos.png');
  });
});