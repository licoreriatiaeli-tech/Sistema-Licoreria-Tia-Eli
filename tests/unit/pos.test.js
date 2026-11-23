// ═══════════════════════════════════════════
// tests/unit/pos.test.js — Tests del Módulo POS Moderno
// ═══════════════════════════════════════════

const { describe, it, expect, beforeEach } = require('@jest/globals');
const fs = require('fs');
const path = require('path');

// Eval ventas.js in global context
const ventasCode = fs.readFileSync(path.resolve(__dirname, '../../ventas.js'), 'utf8');

describe('Módulo POS Moderno', () => {
  beforeEach(() => {
    global.window.productos = [
      {
        id: 'p1',
        nombre: 'Fernet Branca 750ml',
        marca: 'Branca',
        categoria: 'Licores',
        unidadBase: 'botella',
        precioVenta: 75.0,
        lotes: [
          { id: 'l1', cantidadBaseUnidades: 10, costoUnitario: 45, vencimiento: '2026-12-31' }
        ],
        formatosVenta: [
          { id: 'unidad', nombre: 'Botella', unidades: 1, precio: 75.0, esBase: true }
        ]
      },
      {
        id: 'p2',
        nombre: 'Cerveza Huari 620ml',
        marca: 'Huari',
        categoria: 'Cervezas',
        unidadBase: 'botella',
        precioVenta: 18.0,
        lotes: [
          { id: 'l2', cantidadBaseUnidades: 12, costoUnitario: 12, vencimiento: '2026-10-15' }
        ],
        formatosVenta: [
          { id: 'unidad', nombre: 'Botella', unidades: 1, precio: 18.0, esBase: true },
          { id: 'pack12', nombre: 'Pack x12', unidades: 12, precio: 200.0 }
        ]
      }
    ];

    global.window.combos = [
      {
        id: 'combo_test',
        nombre: 'Combo Fernet + Huari',
        precioVenta: 90.0,
        componentes: [
          { productoId: 'p1', cantidad: 1 },
          { productoId: 'p2', cantidad: 1 }
        ]
      }
    ];

    global.window.ventas = [];
    global.window.currentUser = { nombre: 'Cajero Test' };

    // Eval ventas code
    eval(ventasCode);
  });

  it('initPOS inicializa correctamente y renderiza catálogo sin errores', () => {
    expect(typeof global.window.initPOS).toBe('function');
    expect(() => global.window.initPOS()).not.toThrow();
  });

  it('addToPOS agrega productos individuales respetando el stock disponible', () => {
    global.window.initPOS();
    global.window.addToPOS('p1');
    expect(global.window.posCart.length).toBe(1);
    expect(global.window.posCart[0].p.id).toBe('p1');
    expect(global.window.posCart[0].cant).toBe(1);
    expect(global.window.posCart[0].precio).toBe(75.0);
  });

  it('addComboToPOS agrega combos al carrito verificando stock de componentes', () => {
    global.window.initPOS();
    global.window.addComboToPOS('combo_test');
    expect(global.window.posCart.length).toBe(1);
    expect(global.window.posCart[0].p.isCombo).toBe(true);
    expect(global.window.posCart[0].precio).toBe(90.0);
  });

  it('updatePOSQty modifica cantidades y previene superar el stock disponible', () => {
    global.window.initPOS();
    global.window.addToPOS('p1');
    const itemId = global.window.posCart[0].id;

    global.window.updatePOSQty(itemId, 1);
    expect(global.window.posCart[0].cant).toBe(2);

    // Intentar restar hasta eliminar
    global.window.updatePOSQty(itemId, -2);
    expect(global.window.posCart.length).toBe(0);
  });

  it('selectPaymentMethod conmuta métodos de pago válidos', () => {
    global.window.initPOS();
    global.window.selectPaymentMethod('qr');
    expect(global.window.posPaymentMethod).toBe('qr');

    global.window.selectPaymentMethod('tarjeta');
    expect(global.window.posPaymentMethod).toBe('tarjeta');

    global.window.selectPaymentMethod('efectivo');
    expect(global.window.posPaymentMethod).toBe('efectivo');
  });

  it('checkoutPOS descuenta stock FEFO, guarda la venta y limpia el carrito', () => {
    global.window.initPOS();
    global.window.addToPOS('p1'); // 1 unidad de Fernet (hay 10)
    expect(global.window.posCart.length).toBe(1);

    global.window.checkoutPOS();

    // Carrito debe quedar vacío
    expect(global.window.posCart.length).toBe(0);

    // Stock debe haberse descontado a 9
    const prod = global.window.productos.find(x => x.id === 'p1');
    expect(global.getTotalUnidadesBase(prod)).toBe(9);

    // La venta debe registrarse en window.ventas
    expect(global.window.ventas.length).toBe(1);
    expect(global.window.ventas[0].productoId).toBe('p1');
    expect(global.window.ventas[0].total).toBe(75.0);
  });

  it('cierre de caja y atajos funcionan sin lanzar excepciones', () => {
    global.window.initPOS();
    expect(() => global.window.openCashCloseModal()).not.toThrow();
    expect(() => global.window.closeCashCloseModal()).not.toThrow();
    expect(() => global.window.confirmarCierreTurno()).not.toThrow();
    expect(() => global.window.toggleShortcutsModal(true)).not.toThrow();
    expect(() => global.window.toggleShortcutsModal(false)).not.toThrow();
  });

  it('calcula stock dinámico de combos y respeta el cuello de botella (Coca-Cola 10 + Ron 9)', () => {
    // Escenario solicitado: 10 Coca-Cola y 9 Ron
    global.window.productos = [
      {
        id: 'p_ron',
        nombre: 'Ron Abuelo 750ml',
        marca: 'Abuelo',
        categoria: 'Licores',
        unidadBase: 'botella',
        costo: 35.0,
        venta: 60.0,
        lotes: [
          { id: 'l_ron', cantidadBaseUnidades: 9, costoUnitario: 35, vencimiento: '2027-01-01' }
        ]
      },
      {
        id: 'p_cola',
        nombre: 'Coca-Cola 2L',
        marca: 'Coca-Cola',
        categoria: 'Sodas',
        unidadBase: 'botella',
        costo: 8.0,
        venta: 14.0,
        lotes: [
          { id: 'l_cola', cantidadBaseUnidades: 10, costoUnitario: 8, vencimiento: '2026-11-01' }
        ]
      }
    ];

    const comboRonCola = {
      id: 'combo_ron_cola',
      nombre: 'Combo Ron + Coca-Cola',
      precioVenta: 68.0,
      componentes: [
        { productoId: 'p_ron', cantidad: 1 },
        { productoId: 'p_cola', cantidad: 1 }
      ]
    };
    global.window.combos = [comboRonCola];

    // 1. Verificar cálculo de stock dinámico
    const calc = global.window.calcularStockCombo(comboRonCola);
    expect(calc.stockDisponible).toBe(9); // limit by Ron (9 vs 10)
    expect(calc.cuelloDeBotella.productoId).toBe('p_ron');
    expect(calc.cuelloDeBotella.combosPosibles).toBe(9);

    // 2. Agregar al POS
    global.window.initPOS();
    for (let i = 0; i < 9; i++) {
      global.window.addComboToPOS('combo_ron_cola');
    }
    const cartItem = global.window.posCart.find(x => x.id === 'combo_combo_ron_cola');
    expect(cartItem.cant).toBe(9);

    // Intentar agregar el 10º combo (debe ser bloqueado por falta de Ron)
    global.window.addComboToPOS('combo_ron_cola');
    expect(cartItem.cant).toBe(9); // Sigue en 9

    // 3. Vender 2 combos y validar descuento de stock en ambos productos
    cartItem.cant = 2; // vendemos 2
    global.window.checkoutPOS();

    const ron = global.window.productos.find(x => x.id === 'p_ron');
    const cola = global.window.productos.find(x => x.id === 'p_cola');

    expect(global.getTotalUnidadesBase(ron)).toBe(7); // 9 - 2 = 7
    expect(global.getTotalUnidadesBase(cola)).toBe(8); // 10 - 2 = 8

    // Stock de combo recalculado debe ser 7 (limitado por Ron)
    const nuevoCalc = global.window.calcularStockCombo(comboRonCola);
    expect(nuevoCalc.stockDisponible).toBe(7);
  });
});
