// ═══════════════════════════════════════════
// tests/unit/business.test.js — Tests de lógica de negocio (FEFO, Costing, etc)
// ════════════════════════════════════════════

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Lógica de negocio - FEFO y Costing', () => {
  let mockProductos;

  beforeEach(() => {
    mockProductos = [];
  });

  // Helper para crear producto con lotes
  const createProductoConLotes = (overrides = {}) => ({
    id: 'prod_' + Date.now(),
    nombre: 'Test Product',
    categoria: 'Licores',
    unidadBase: 'botella',
    lotes: [],
    formatosVenta: [
      { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 100, esBase: true }
    ],
    ...overrides
  });

  describe('getTotalUnidadesBase', () => {
    it('suma cantidades de lotes en unidades base', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10 },
          { id: 'l2', cantidadBaseUnidades: 20, cantidad: 20 }
        ]
      });
      expect(global.getTotalUnidadesBase(p)).toBe(30);
    });

    it('retorna 0 para producto sin lotes', () => {
      const p = createProductoConLotes({ lotes: [] });
      expect(global.getTotalUnidadesBase(p)).toBe(0);
    });

    it('retorna stock legacy si no hay lotes', () => {
      const p = createProductoConLotes({ lotes: undefined, stock: 50 });
      expect(global.getTotalUnidadesBase(p)).toBe(50);
    });

    it('filtra lotes con cantidad 0', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10 },
          { id: 'l2', cantidadBaseUnidades: 0, cantidad: 0 },
          { id: 'l3', cantidadBaseUnidades: 5, cantidad: 5 }
        ]
      });
      expect(global.getTotalUnidadesBase(p)).toBe(15);
    });
  });

  describe('getVencimientoMasCercano', () => {
    it('retorna vencimiento más cercano de lotes activos', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, vencimiento: '2024-12-31' },
          { id: 'l2', cantidadBaseUnidades: 20, cantidad: 20, vencimiento: '2024-06-15' },
          { id: 'l3', cantidadBaseUnidades: 5, cantidad: 5, vencimiento: '2025-01-01' }
        ]
      });
      expect(global.getVencimientoMasCercano(p)).toBe('2024-06-15');
    });

    it('ignora lotes sin stock', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 0, cantidad: 0, vencimiento: '2024-01-01' },
          { id: 'l2', cantidadBaseUnidades: 10, cantidad: 10, vencimiento: '2024-12-31' }
        ]
      });
      expect(global.getVencimientoMasCercano(p)).toBe('2024-12-31');
    });

    it('retorna null si no hay lotes con vencimiento', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, vencimiento: '' },
          { id: 'l2', cantidadBaseUnidades: 20, cantidad: 20, vencimiento: null }
        ]
      });
      expect(global.getVencimientoMasCercano(p)).toBeNull();
    });

    it('usa vencimiento del producto como fallback', () => {
      const p = createProductoConLotes({
        lotes: [],
        vencimiento: '2024-07-01'
      });
      expect(global.getVencimientoMasCercano(p)).toBe('2024-07-01');
    });
  });

  describe('getCostoPromedio', () => {
    it('calcula promedio ponderado por stock', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, costoPorUnidad: 50 },
          { id: 'l2', cantidadBaseUnidades: 20, cantidad: 20, costoPorUnidad: 60 }
        ]
      });
      // (10*50 + 20*60) / 30 = 1700/30 = 56.66...
      expect(global.getCostoPromedio(p)).toBeCloseTo(56.67, 1);
    });

    it('retorna costo unitario si solo un lote', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, costoPorUnidad: 75 }
        ]
      });
      expect(global.getCostoPromedio(p)).toBe(75);
    });

    it('usa costo legacy si no hay lotes', () => {
      const p = createProductoConLotes({ lotes: [], costo: 45, costoPromedioUnidad: 45 });
      expect(global.getCostoPromedio(p)).toBe(45);
    });

    it('calcula costo desde costo total del lote si no hay costoPorUnidad', () => {
      const p = createProductoConLotes({
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, costoTotalLote: 500 }
        ]
      });
      expect(global.getCostoPromedio(p)).toBe(50);
    });
  });

  describe('formatStockDisplay', () => {
    it('muestra "0 u." para stock cero', () => {
      const p = createProductoConLotes({ lotes: [] });
      expect(global.formatStockDisplay(p)).toBe('0 u.');
    });

    it('muestra unidades simples sin formatos', () => {
      const p = createProductoConLotes({
        lotes: [{ id: 'l1', cantidadBaseUnidades: 25, cantidad: 25 }],
        formatosVenta: [{ id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 100, esBase: true }]
      });
      expect(global.formatStockDisplay(p)).toBe('25 u.');
    });

    it('muestra paquetes + sueltas', () => {
      const p = createProductoConLotes({
        lotes: [{ id: 'l1', cantidadBaseUnidades: 50, cantidad: 50 }],
        formatosVenta: [
          { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 100, esBase: true },
          { id: 'caja12', nombre: 'Caja de 12', unidades: 12, precio: 1000 }
        ]
      });
      // 50 = 4 cajas (48) + 2 sueltas
      expect(global.formatStockDisplay(p)).toContain('4 Caja de 12');
      expect(global.formatStockDisplay(p)).toContain('2 u.');
    });

    it('muestra solo paquetes si exacto', () => {
      const p = createProductoConLotes({
        lotes: [{ id: 'l1', cantidadBaseUnidades: 48, cantidad: 48 }],
        formatosVenta: [
          { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 100, esBase: true },
          { id: 'caja12', nombre: 'Caja de 12', unidades: 12, precio: 1000 }
        ]
      });
      expect(global.formatStockDisplay(p)).toBe('48 u. (4 Caja de 12)');
    });
  });

  describe('descontarStockFEFO (simulado)', () => {
    // Simulamos la lógica FEFO sin depender de DOM
    const descontarFEFO = (lotes, cantidad, unidadesPorFormato = 1) => {
      const totalUnidades = cantidad * unidadesPorFormato;
      let restante = totalUnidades;
      const lotesOrdenados = [...lotes]
        .filter(l => l.cantidadBaseUnidades > 0)
        .sort((a, b) => {
          if (!a.vencimiento && !b.vencimiento) return 0;
          if (!a.vencimiento) return 1;
          if (!b.vencimiento) return -1;
          return new Date(a.vencimiento) - new Date(b.vencimiento);
        });

      const afectados = [];
      for (const lote of lotesOrdenados) {
        if (restante <= 0) break;
        const tomar = Math.min(lote.cantidadBaseUnidades, restante);
        lote.cantidadBaseUnidades -= tomar;
        lote.cantidad = lote.cantidadBaseUnidades;
        restante -= tomar;
        afectados.push({ loteId: lote.id, cantidadDescontada: tomar });
      }

      return { lotesAfectados: afectados, noCumplido: Math.ceil(restante / unidadesPorFormato) };
    };

    it('consume lote con vencimiento más cercano primero', () => {
      const lotes = [
        { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, vencimiento: '2024-12-31' },
        { id: 'l2', cantidadBaseUnidades: 20, cantidad: 20, vencimiento: '2024-06-15' },
        { id: 'l3', cantidadBaseUnidades: 15, cantidad: 15, vencimiento: '2025-01-01' }
      ];
      
      const result = descontarFEFO(lotes, 15);
      
      expect(result.noCumplido).toBe(0);
      expect(result.lotesAfectados[0].loteId).toBe('l2'); // Vence primero
      expect(result.lotesAfectados[0].cantidadDescontada).toBe(15);
      expect(lotes.find(l => l.id === 'l2').cantidadBaseUnidades).toBe(5);
    });

    it('distribuye entre múltiples lotes si uno no alcanza', () => {
      const lotes = [
        { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, vencimiento: '2024-06-15' },
        { id: 'l2', cantidadBaseUnidades: 20, cantidad: 20, vencimiento: '2024-12-31' }
      ];
      
      const result = descontarFEFO(lotes, 25);
      
      expect(result.noCumplido).toBe(0);
      expect(result.lotesAfectados).toHaveLength(2);
      expect(result.lotesAfectados[0].cantidadDescontada).toBe(10);
      expect(result.lotesAfectados[1].cantidadDescontada).toBe(15);
    });

    it('retorna noCumplido si stock insuficiente', () => {
      const lotes = [
        { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, vencimiento: '2024-06-15' }
      ];
      
      const result = descontarFEFO(lotes, 15);
      
      expect(result.noCumplido).toBe(5);
    });

    it('maneja unidades por formato (ej: cajas de 12)', () => {
      const lotes = [
        { id: 'l1', cantidadBaseUnidades: 100, cantidad: 100, vencimiento: '2024-06-15' }
      ];
      
      // Vender 2 cajas de 12 = 24 unidades
      const result = descontarFEFO(lotes, 2, 12);
      
      expect(result.noCumplido).toBe(0);
      expect(result.lotesAfectados[0].cantidadDescontada).toBe(24);
      expect(lotes[0].cantidadBaseUnidades).toBe(76);
    });

    it('ignora lotes sin vencimiento (al final)', () => {
      const lotes = [
        { id: 'l1', cantidadBaseUnidades: 10, cantidad: 10, vencimiento: '' },
        { id: 'l2', cantidadBaseUnidades: 20, cantidad: 20, vencimiento: '2024-06-15' }
      ];
      
      const result = descontarFEFO(lotes, 15);
      
      expect(result.lotesAfectados[0].loteId).toBe('l2');
      expect(lotes.find(l => l.id === 'l1').cantidadBaseUnidades).toBe(10); // No tocado
    });
  });
});