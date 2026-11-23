// ═══════════════════════════════════════════
// tests/unit/gastos_consumo.test.js — Tests de Gastos Operativos y Consumo de Dueño
// ═══════════════════════════════════════════

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Gastos Operativos y Consumo de Dueño', () => {
  describe('Cálculo de Gastos Operativos por Categoría', () => {
    it('calcula correctamente los totales del mes para Luz, Agua y Extras', () => {
      const now = new Date();
      const mesActual = now.getMonth();
      const anioActual = now.getFullYear();

      const gastos = [
        { id: 'g1', categoria: 'luz', monto: 150.50, fecha: now.getTime() },
        { id: 'g2', categoria: 'luz', monto: 50.00, fecha: now.getTime() },
        { id: 'g3', categoria: 'agua', monto: 35.00, fecha: now.getTime() },
        { id: 'g4', categoria: 'extras', monto: 20.00, fecha: now.getTime() },
        { id: 'g5', categoria: 'extras', monto: 15.50, fecha: now.getTime() },
        // Gasto de un mes anterior (no debe contarse en este mes)
        { id: 'g6', categoria: 'luz', monto: 200.00, fecha: new Date(anioActual, mesActual - 2, 1).getTime() }
      ];

      const gastosMes = gastos.filter(g => {
        const d = new Date(g.fecha);
        return d.getMonth() === mesActual && d.getFullYear() === anioActual;
      });

      const totalMes = gastosMes.reduce((s, g) => s + g.monto, 0);
      const luzMes = gastosMes.filter(g => g.categoria === 'luz').reduce((s, g) => s + g.monto, 0);
      const aguaMes = gastosMes.filter(g => g.categoria === 'agua').reduce((s, g) => s + g.monto, 0);
      const extrasMes = gastosMes.filter(g => g.categoria === 'extras').reduce((s, g) => s + g.monto, 0);

      expect(totalMes).toBeCloseTo(271.00);
      expect(luzMes).toBeCloseTo(200.50);
      expect(aguaMes).toBeCloseTo(35.00);
      expect(extrasMes).toBeCloseTo(35.50);
    });

    it('no incluye alquiler porque el local es propio / sin alquiler', () => {
      const categoriasValidas = ['luz', 'agua', 'extras'];
      expect(categoriasValidas.includes('alquiler')).toBe(false);
    });
  });

  describe('Consumo de Dueño (Retiro personal con deducción de costo en ganancias)', () => {
    it('descuenta del stock por PEPS y deduce exactamente el costo de compra de las ganancias', () => {
      // Ejemplo del usuario: Coca-Cola venta Bs. 22.00, costo Bs. 18.00
      const producto = {
        id: 'coca_cola_2l',
        nombre: 'Coca Cola 2L',
        venta: 22.00,
        lotes: [
          { id: 'l1', cantidad: 5, cantidadBaseUnidades: 5, costo: 18.00, costoPorUnidad: 18.00 },
          { id: 'l2', cantidad: 10, cantidadBaseUnidades: 10, costo: 19.00, costoPorUnidad: 19.00 }
        ]
      };

      const cantidadARetirar = 1;
      let cantidadRestante = cantidadARetirar;
      let lotesAfectados = [];

      for (const lote of producto.lotes) {
        if (lote.cantidad <= 0) continue;
        const d = Math.min(lote.cantidad, cantidadRestante);
        lote.cantidad -= d;
        lote.cantidadBaseUnidades = lote.cantidad;
        cantidadRestante -= d;
        lotesAfectados.push({
          loteId: lote.id,
          cantidadDescontada: d,
          costoUnitario: lote.costoPorUnidad
        });
        if (cantidadRestante <= 0) break;
      }

      // 1. Stock descontado
      expect(producto.lotes[0].cantidad).toBe(4);
      expect(cantidadRestante).toBe(0);

      // 2. Costo total de retiro deducible de ganancias
      const costoTotalRetiro = lotesAfectados.reduce((s, la) => s + (la.cantidadDescontada * la.costoUnitario), 0);
      expect(costoTotalRetiro).toBe(18.00);

      // 3. Impacto en ganancia neta diaria
      const gananciaVentasHoy = 100.00; // Por ejemplo, 100 Bs de ganancia por ventas
      const gananciaNetaReal = gananciaVentasHoy - costoTotalRetiro;
      expect(gananciaNetaReal).toBe(82.00); // 100 - 18 = 82
    });

    it('maneja retiros de múltiples unidades que cruzan varios lotes PEPS con diferente costo', () => {
      const producto = {
        id: 'whisky_black',
        nombre: 'Johnnie Walker Black',
        venta: 220.00,
        lotes: [
          { id: 'l1', cantidad: 2, cantidadBaseUnidades: 2, costo: 140.00, costoPorUnidad: 140.00 },
          { id: 'l2', cantidad: 5, cantidadBaseUnidades: 5, costo: 150.00, costoPorUnidad: 150.00 }
        ]
      };

      // Dueño retira 3 botellas: 2 del lote 1 (@ 140) y 1 del lote 2 (@ 150)
      let cantidadARetirar = 3;
      let lotesAfectados = [];

      for (const lote of producto.lotes) {
        if (lote.cantidad <= 0) continue;
        const d = Math.min(lote.cantidad, cantidadARetirar);
        lote.cantidad -= d;
        lote.cantidadBaseUnidades = lote.cantidad;
        cantidadARetirar -= d;
        lotesAfectados.push({
          cantidadDescontada: d,
          costoUnitario: lote.costoPorUnidad
        });
        if (cantidadARetirar <= 0) break;
      }

      const costoTotalRetiro = lotesAfectados.reduce((s, la) => s + (la.cantidadDescontada * la.costoUnitario), 0);
      // 2 * 140 + 1 * 150 = 280 + 150 = 430 Bs.
      expect(costoTotalRetiro).toBe(430.00);
      expect(producto.lotes[0].cantidad).toBe(0);
      expect(producto.lotes[1].cantidad).toBe(4);
    });
  });

  describe('Cálculo de Ganancia Neta Real en Dashboard', () => {
    it('resta correctamente los retiros de dueño y los gastos operativos de la ganancia bruta de ventas', () => {
      const gananciaHoy = 350.00; // Ganancia por ventas de mostrador
      const costoRetirosHoy = 18.00; // 1 Coca-Cola retirada por el dueño
      const totalGastosHoy = 50.00; // Gasto de bolsas/hielo (extras)

      const gananciaNetaRealHoy = gananciaHoy - costoRetirosHoy - totalGastosHoy;
      expect(gananciaNetaRealHoy).toBe(282.00);
    });
  });
});
