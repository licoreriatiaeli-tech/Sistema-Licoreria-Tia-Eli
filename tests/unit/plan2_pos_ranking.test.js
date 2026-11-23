// ═══════════════════════════════════════════
// tests/unit/plan2_pos_ranking.test.js — Tests de Plan 2 (Ranking de ventas en tiempo real y Top Sellers)
// ═══════════════════════════════════════════

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('Plan 2: Ranking de ventas POS y orden automático de mayor rotación', () => {
  beforeEach(() => {
    global.productos = [];
    global.ventas = [];
    global.combos = [];
  });

  describe('Cálculo de estadísticas de rotación por ventas reales', () => {
    it('acumula correctamente las unidades vendidas por producto individual y por combos', () => {
      const pPaceña = { id: 'p_pacena', nombre: 'Paceña 330ml', stock: 100 };
      const pFernet = { id: 'p_fernet', nombre: 'Fernet Branca 750ml', stock: 20 };
      const pCoca = { id: 'p_coca', nombre: 'Coca-Cola 2L', stock: 50 };
      global.productos = [pPaceña, pFernet, pCoca];

      global.ventas = [
        // Venta 1: 5 botellas sueltas de Paceña
        { id: 'v1', tipo: 'individual', productoId: 'p_pacena', cantidad: 5, total: 47.5 },
        // Venta 2: 1 botella de Fernet
        { id: 'v2', tipo: 'individual', productoId: 'p_fernet', cantidad: 1, total: 85 },
        // Venta 3: Combo (Pack de 12 Paceñas)
        {
          id: 'v3',
          tipo: 'combo',
          productoId: 'c_pacena12',
          cantidad: 2, // 2 packs = 24 botellas
          total: 220,
          lotesAfectados: [
            { productoId: 'p_pacena', cantidadDescontada: 24 }
          ]
        },
        // Venta 4: 10 Coca-Colas
        { id: 'v4', tipo: 'individual', productoId: 'p_coca', cantidad: 10, total: 130 }
      ];

      // Simular la función de rotación
      const stats = {};
      const comboStats = {};
      global.ventas.forEach(v => {
        if (v.tipo === 'combo') {
          const cid = v.productoId;
          if (cid) {
            comboStats[cid] = (comboStats[cid] || 0) + (v.cantidad || 1);
          }
          if (Array.isArray(v.lotesAfectados)) {
            v.lotesAfectados.forEach(l => {
              stats[l.productoId] = (stats[l.productoId] || 0) + (l.cantidadDescontada || 0);
            });
          }
        } else {
          stats[v.productoId] = (stats[v.productoId] || 0) + (v.cantidad || 0);
        }
      });

      // Paceña: 5 sueltas + 24 de combos = 29 unidades vendidas
      expect(stats['p_pacena']).toBe(29);
      // Coca-Cola: 10 unidades
      expect(stats['p_coca']).toBe(10);
      // Fernet: 1 unidad
      expect(stats['p_fernet']).toBe(1);
      // Combo Pack 12 Paceña: 2 veces vendido
      expect(comboStats['c_pacena12']).toBe(2);
    });

    it('ordena en primera fila los productos con mayor salida de inventario', () => {
      const p1 = { id: 'p1', nombre: 'Vino Tinto', stock: 10 }; // 2 ventas
      const p2 = { id: 'p2', nombre: 'Paceña 330ml', stock: 50 }; // 40 ventas
      const p3 = { id: 'p3', nombre: 'Coca-Cola 2L', stock: 30 }; // 25 ventas
      const p4 = { id: 'p4', nombre: 'Whisky 12 años', stock: 5 }; // 0 ventas (nuevo)
      const pAgotado = { id: 'p_ago', nombre: 'Vodka Ruso', stock: 0 }; // 100 ventas pasadas pero agotado

      const lista = [p1, p2, p3, p4, pAgotado];
      const stats = {
        p1: 2,
        p2: 40,
        p3: 25,
        p4: 0,
        p_ago: 100
      };

      lista.sort((a, b) => {
        const agotA = a.stock <= 0 ? 1 : 0;
        const agotB = b.stock <= 0 ? 1 : 0;
        if (agotA !== agotB) return agotA - agotB;

        const uA = stats[a.id] || 0;
        const uB = stats[b.id] || 0;
        if (uB !== uA) return uB - uA;

        return a.nombre.localeCompare(b.nombre);
      });

      // Primer lugar (primera fila): Paceña (40 u.)
      expect(lista[0].id).toBe('p2');
      // Segundo lugar: Coca-Cola (25 u.)
      expect(lista[1].id).toBe('p3');
      // Tercer lugar: Vino Tinto (2 u.)
      expect(lista[2].id).toBe('p1');
      // Cuarto lugar: Whisky (0 u., activo)
      expect(lista[3].id).toBe('p4');
      // Último lugar: Vodka Ruso (stock = 0 se va al final)
      expect(lista[4].id).toBe('p_ago');
    });
  });
});
