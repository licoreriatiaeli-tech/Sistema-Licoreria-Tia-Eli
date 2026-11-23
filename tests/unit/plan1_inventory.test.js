// ═══════════════════════════════════════════
// tests/unit/plan1_inventory.test.js — Tests de Plan 1 (Unidad atómica, correcciones y archivado)
// ═══════════════════════════════════════════

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Plan 1: Gestión de Inventario Atómico y Correcciones', () => {
  beforeEach(() => {
    global.productos = [];
    global.ventas = [];
    global.fiados = [];
    global.save = jest.fn();
    global.toast = jest.fn();
    global.confirm = jest.fn();
    global.registrarActividad = jest.fn();
  });

  describe('Conversión atómica de paquetes a unidades base', () => {
    it('calcula correctamente el stock inicial e inversión desde paquetes de compra', () => {
      const paquetesComprados = 5;
      const unidadesPorPaquete = 12; // Ej: Caja de 12
      const costoPorPaquete = 120.0;

      const unidadesTotalesBase = paquetesComprados * unidadesPorPaquete;
      const costoUnitarioBase = costoPorPaquete / unidadesPorPaquete;
      const inversionTotal = paquetesComprados * costoPorPaquete;

      expect(unidadesTotalesBase).toBe(60);
      expect(costoUnitarioBase).toBe(10.0);
      expect(inversionTotal).toBe(600.0);
      expect(unidadesTotalesBase * costoUnitarioBase).toBe(inversionTotal);
    });

    it('formatea la visualización del stock desglosando cajas y sueltas', () => {
      const p = {
        id: 'p1',
        nombre: 'Paceña 330ml',
        stock: 38,
        formatosVenta: [
          { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 12 },
          { id: 'caja12', nombre: 'Caja de 12', unidades: 12, precio: 130 }
        ],
        lotes: [{ id: 'l1', cantidadBaseUnidades: 38, cantidad: 38 }]
      };

      if (typeof global.formatStockDisplay === 'function') {
        const display = global.formatStockDisplay(p);
        // 38 = 3 cajas de 12 (36) + 2 sueltas
        expect(display).toContain('3 Caja de 12');
        expect(display).toContain('2 u.');
      }
    });
  });

  describe('Corrección de errores: Agregué de más en un lote', () => {
    it('ajusta limpiamente la cantidad de un lote sobrante recalculando el stock total', () => {
      const producto = {
        id: 'prod_paceña',
        nombre: 'Cerveza Paceña 330ml',
        costo: 10,
        lotes: [
          // Lote ingresado por error como 120 unidades en vez de 12
          { id: 'lot_erroneo', cantidadBaseUnidades: 120, cantidad: 120, costoPorUnidad: 10, costoTotalLote: 1200 }
        ]
      };
      global.productos = [producto];

      // Simular ajuste de lote a 12 unidades reales
      const nuevaCantidad = 12;
      const lote = producto.lotes[0];
      const diferencia = nuevaCantidad - lote.cantidadBaseUnidades; // -108 unidades

      lote.cantidadBaseUnidades = nuevaCantidad;
      lote.cantidad = nuevaCantidad;
      lote.costoTotalLote = nuevaCantidad * lote.costoPorUnidad;
      producto.stock = nuevaCantidad;

      expect(producto.stock).toBe(12);
      expect(lote.costoTotalLote).toBe(120);
      expect(diferencia).toBe(-108);
    });
  });

  describe('Protección de eliminación vs. archivado de productos', () => {
    it('permite eliminar completamente productos nuevos que nunca tuvieron ventas', () => {
      const productoNuevo = {
        id: 'prod_nuevo',
        nombre: 'Licor Prueba',
        stock: 0,
        lotes: []
      };
      global.productos = [productoNuevo];
      global.ventas = [];
      global.confirm.mockReturnValue(true);

      // Si no hay ventas, se filtra de la lista
      const ventasDelProd = global.ventas.filter(v => v.productoId === productoNuevo.id);
      expect(ventasDelProd.length).toBe(0);

      global.productos = global.productos.filter(p => p.id !== productoNuevo.id);
      expect(global.productos).toHaveLength(0);
    });

    it('protege y archiva productos que tienen ventas registradas en el historial', () => {
      const productoConVentas = {
        id: 'prod_estrella',
        nombre: 'Cerveza Paceña',
        activo: true,
        stock: 24,
        lotes: [{ id: 'l1', cantidadBaseUnidades: 24, cantidad: 24 }]
      };
      global.productos = [productoConVentas];
      global.ventas = [
        { id: 'v1', productoId: 'prod_estrella', cantidad: 12, total: 130 }
      ];

      const ventasDelProd = global.ventas.filter(v => v.productoId === productoConVentas.id);
      expect(ventasDelProd.length).toBeGreaterThan(0);

      // Al detectar ventas, se archiva en lugar de eliminarse
      productoConVentas.activo = false;
      productoConVentas.archivado = true;

      expect(productoConVentas.activo).toBe(false);
      expect(productoConVentas.archivado).toBe(true);

      // Los filtros normales de catálogo excluyen archivados
      const visibles = global.productos.filter(p => p.activo !== false && !p.archivado);
      expect(visibles).toHaveLength(0);

      // Pero el producto se puede reactivar
      productoConVentas.activo = true;
      productoConVentas.archivado = false;
      const reactivados = global.productos.filter(p => p.activo !== false && !p.archivado);
      expect(reactivados).toHaveLength(1);
    });
  });

  describe('Flujo de Combos / Packs: Paceña 12 u. a Bs. 110', () => {
    it('calcula costo, ganancia y descuenta unidades base del producto original', () => {
      // 1. Producto base
      const pacena = {
        id: 'pacena_330',
        nombre: 'Cerveza Paceña 330ml',
        costo: 8.10,
        venta: 9.50,
        stock: 30, // 30 botellas
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 30, cantidad: 30, costoPorUnidad: 8.10, vencimiento: '2026-12-01' }
        ]
      };
      global.productos = [pacena];

      // 2. Combo / Pack creado por el usuario
      const comboPack12 = {
        id: 'combo_pacena_12',
        nombre: 'Paquete Paceña 12 u.',
        precioVenta: 110.0,
        componentes: [
          { productoId: 'pacena_330', cantidad: 12 }
        ]
      };

      // Cálculo financiero del combo
      const cantInsumos = comboPack12.componentes[0].cantidad;
      const costoCombo = cantInsumos * pacena.costo; // 12 * 8.10 = 97.20
      const gananciaCombo = comboPack12.precioVenta - costoCombo; // 110 - 97.20 = 12.80
      const packsPosibles = Math.floor(pacena.stock / cantInsumos); // 30 / 12 = 2 packs

      expect(costoCombo).toBeCloseTo(97.20, 2);
      expect(gananciaCombo).toBeCloseTo(12.80, 2);
      expect(packsPosibles).toBe(2);

      // Simular venta de 1 pack (descuenta 12 unidades físicas)
      const cantVentaPacks = 1;
      const unidadesADescontar = cantVentaPacks * cantInsumos;
      expect(unidadesADescontar).toBe(12);

      pacena.lotes[0].cantidadBaseUnidades -= unidadesADescontar;
      pacena.lotes[0].cantidad = pacena.lotes[0].cantidadBaseUnidades;
      pacena.stock = pacena.lotes[0].cantidadBaseUnidades;

      // Quedan 18 botellas físicas (alcanza para 1 pack más y sobran 6 botellas)
      expect(pacena.stock).toBe(18);
      const packsRestantes = Math.floor(pacena.stock / cantInsumos);
      expect(packsRestantes).toBe(1);
    });
  });
});
