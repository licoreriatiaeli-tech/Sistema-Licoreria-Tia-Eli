// ═══════════════════════════════════════════
// tests/unit/schemas.test.js — Tests para validación de esquemas
// ═══════════════════════════════════════════

const { describe, it, expect } = require('@jest/globals');

describe('schemas/index.js', () => {
  const z = global.z;

  describe('Validadores primitivos', () => {
    it('string valida y transforma', () => {
      const result = z.string.parse('hola');
      expect(result.success).toBe(true);
      expect(result.data).toBe('hola');
    });

    it('string rechaza no-strings', () => {
      const result = z.string.safeParse(123);
      expect(result.success).toBe(false);
    });

    it('number valida y transforma', () => {
      const result = z.number.parse('42');
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('number rechaza NaN', () => {
      const result = z.number.safeParse('abc');
      expect(result.success).toBe(false);
    });

    it('boolean valida', () => {
      expect(z.boolean.parse(true).data).toBe(true);
      expect(z.boolean.parse(false).data).toBe(false);
    });
  });

  describe('Modificadores', () => {
    it('min valida mínimo', () => {
      const validator = z.number.pipe(z.min(10, 'Mínimo 10'));
      expect(validator.parse(15).data).toBe(15);
      expect(validator.safeParse(5).success).toBe(false);
    });

    it('max valida máximo', () => {
      const validator = z.number.pipe(z.max(100));
      expect(validator.parse(50).data).toBe(50);
      expect(validator.safeParse(150).success).toBe(false);
    });

    it('positive valida > 0', () => {
      const validator = z.number.pipe(z.positive());
      expect(validator.parse(0.01).data).toBe(0.01);
      expect(validator.safeParse(0).success).toBe(false);
      expect(validator.safeParse(-5).success).toBe(false);
    });

    it('optional permite undefined', () => {
      const validator = z.optional(z.string);
      expect(validator.parse(undefined).data).toBeUndefined();
      expect(validator.parse('').data).toBeUndefined();
      expect(validator.parse('hola').data).toBe('hola');
    });

    it('default proporciona valor por defecto', () => {
      const validator = z.default(24, z.number);
      expect(validator.parse(undefined).data).toBe(24);
      expect(validator.parse(10).data).toBe(10);
    });

    it('transform transforma valor', () => {
      const validator = z.transform(v => v * 2, z.number);
      expect(validator.parse(5).data).toBe(10);
    });

    it('refine valida condición personalizada', () => {
      const validator = z.refine(z.number, v => v % 2 === 0, 'Debe ser par');
      expect(validator.parse(4).data).toBe(4);
      expect(validator.safeParse(3).success).toBe(false);
    });
  });

  describe('object', () => {
    const schema = z.object({
      nombre: z.string,
      edad: z.number.pipe(z.positive()),
      email: z.optional(z.string)
    });

    it('valida objeto completo', () => {
      const result = schema.parse({ nombre: 'Juan', edad: 25, email: 'juan@test.com' });
      expect(result.success).toBe(true);
      expect(result.data.nombre).toBe('Juan');
    });

    it('rechaza campos faltantes requeridos', () => {
      const result = schema.safeParse({ edad: 25 });
      expect(result.success).toBe(false);
    });

    it('rechaza tipos incorrectos', () => {
      const result = schema.safeParse({ nombre: 'Juan', edad: -5 });
      expect(result.success).toBe(false);
    });

    it('permite campos opcionales undefined', () => {
      const result = schema.parse({ nombre: 'Juan', edad: 25 });
      expect(result.data.email).toBeUndefined();
    });
  });

  describe('array', () => {
    const schema = z.array(z.object({
      id: z.string,
      cantidad: z.number.pipe(z.positive())
    }));

    it('valida array de objetos', () => {
      const result = schema.parse([
        { id: '1', cantidad: 10 },
        { id: '2', cantidad: 5 }
      ]);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('rechaza elementos inválidos', () => {
      const result = schema.safeParse([
        { id: '1', cantidad: -5 }
      ]);
      expect(result.success).toBe(false);
    });
  });

  describe('enum', () => {
    const schema = z.enum(['a', 'b', 'c']);

    it('acepta valores válidos', () => {
      expect(schema.parse('a').data).toBe('a');
      expect(schema.parse('b').data).toBe('b');
    });

    it('rechaza valores inválidos', () => {
      const result = schema.safeParse('d');
      expect(result.success).toBe(false);
    });
  });

  describe('Esquemas del sistema', () => {
    describe('Producto', () => {
      it('valida producto completo', () => {
        const producto = {
          nombre: 'Whisky 12 años',
          categoria: 'Licores',
          marca: 'Johnnie Walker',
          unidadBase: 'botella',
          precioVentaUnidad: 250,
          costo: 180,
          stockMinUnidades: 12,
          tieneVencimiento: false,
          formatosVenta: [
            { id: 'unidad', nombre: 'Unidad', unidades: 1, precio: 250, esBase: true }
          ],
          formatosCompra: [
            { id: 'caja6', nombre: 'Caja de 6', unidades: 6 }
          ]
        };
        const result = z.Producto.safeParse(producto);
        expect(result.success).toBe(true);
      });

      it('rechaza nombre muy corto', () => {
        const result = z.Producto.safeParse({ nombre: 'A', categoria: 'Licores', unidadBase: 'botella', precioVentaUnidad: 100, costo: 50 });
        expect(result.success).toBe(false);
      });

      it('rechaza categoría inválida', () => {
        const result = z.Producto.safeParse({ nombre: 'Test', categoria: 'Invalida', unidadBase: 'botella', precioVentaUnidad: 100, costo: 50 });
        expect(result.success).toBe(false);
      });

      it('rechaza precio negativo', () => {
        const result = z.Producto.safeParse({ nombre: 'Test', categoria: 'Licores', unidadBase: 'botella', precioVentaUnidad: -10, costo: 50 });
        expect(result.success).toBe(false);
      });
    });

    describe('Venta', () => {
      it('valida venta completa', () => {
        const venta = {
          productoId: 'prod_1',
          productoNombre: 'Producto',
          cantidad: 2,
          precioUnit: 100,
          total: 200,
          costo: 120,
          ganancia: 80,
          pago: 'efectivo',
          fecha: new Date()
        };
        const result = z.Venta.safeParse(venta);
        expect(result.success).toBe(true);
      });

      it('rechaza método de pago inválido', () => {
        const result = z.Venta.safeParse({ ...global.mockVenta(), pago: 'bitcoin' });
        expect(result.success).toBe(false);
      });
    });

    describe('Cliente', () => {
      it('valida cliente', () => {
        const result = z.Cliente.safeParse({ nombre: 'Juan Pérez', telefono: '71234567' });
        expect(result.success).toBe(true);
      });

      it('rechaza nombre muy corto', () => {
        const result = z.Cliente.safeParse({ nombre: 'J' });
        expect(result.success).toBe(false);
      });
    });

    describe('Fiado', () => {
      it('valida fiado con items', () => {
        const fiado = {
          clienteId: 'cli_1',
          items: [
            { productoId: 'p1', productoNombre: 'Prod 1', cantidad: 2, precioUnit: 50, esInventario: true }
          ],
          monto: 100
        };
        const result = z.Fiado.safeParse(fiado);
        expect(result.success).toBe(true);
      });
    });

    describe('Combo', () => {
      it('valida combo', () => {
        const combo = {
          nombre: 'Combo 6 cervezas',
          componentes: [
            { productoId: 'p1', cantidad: 6 }
          ],
          precioVenta: 60
        };
        const result = z.Combo.safeParse(combo);
        expect(result.success).toBe(true);
      });
    });
  });
});