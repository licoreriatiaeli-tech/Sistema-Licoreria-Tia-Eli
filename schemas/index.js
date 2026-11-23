// ═══════════════════════════════════════════
// schemas/index.js — Validación de esquemas (Zod-like ligero)
// ═══════════════════════════════════════════

/**
 * Resultado de validación
 * @typedef {Object} ValidationResult
 * @property {boolean} success
 * @property {*} data - Datos validados y transformados
 * @property {Array<{path:string, message:string}>} errors
 */

/**
 * Crea resultado de éxito
 * @param {*} data
 * @returns {ValidationResult}
 */
function ok(data) {
  return { success: true, data, errors: [] };
}

/**
 * Crea resultado de error
 * @param {Array<{path:string, message:string}>} errors
 * @returns {ValidationResult}
 */
function err(errors) {
  return { success: false, data: null, errors };
}

/**
 * Validador base
 * @template T
 * @param {function(*):T} parseFn
 * @returns {Object}
 */
function createValidator(parseFn) {
  const validator = {
    parse: (value) => {
      try {
        return ok(parseFn(value));
      } catch (e) {
        return err([{ path: '', message: e.message }]);
      }
    },
    safeParse: (value) => {
      try {
        return ok(parseFn(value));
      } catch (e) {
        return err([{ path: '', message: e.message }]);
      }
    },
    pipe: (...modifiers) => {
      return createValidator((v) => {
        let result = validator.parse(v);
        if (!result.success) throw new Error(result.errors[0]?.message || 'Validation failed');
        let data = result.data;
        for (const mod of modifiers) {
          if (typeof mod === 'function') {
            data = mod(data);
          } else if (mod && typeof mod.parse === 'function') {
            const r = mod.parse(data);
            if (!r.success) throw new Error(r.errors[0]?.message || 'Validation failed');
            data = r.data;
          }
        }
        return data;
      });
    }
  };
  return validator;
}

// ═══════════════════════════════════════════
// PRIMITIVOS
// ═══════════════════════════════════════════

const string = createValidator((v) => {
  if (typeof v !== 'string') throw new Error('Debe ser texto');
  return v;
});

const number = createValidator((v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('Debe ser número');
  return n;
});

const boolean = createValidator((v) => {
  if (typeof v !== 'boolean') throw new Error('Debe ser booleano');
  return v;
});

const date = createValidator((v) => {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) throw new Error('Fecha inválida');
  return d;
});

// ═══════════════════════════════════════════
// MODIFICADORES
// ═══════════════════════════════════════════

function min(minVal, msg) {
  return (v) => {
    if (v < minVal) throw new Error(msg || `Mínimo ${minVal}`);
    return v;
  };
}

function max(maxVal, msg) {
  return (v) => {
    if (v > maxVal) throw new Error(msg || `Máximo ${maxVal}`);
    return v;
  };
}

function positive(msg) {
  return min(0.01, msg || 'Debe ser positivo');
}

function nonNegative(msg) {
  return min(0, msg || 'No puede ser negativo');
}

function optional(validator) {
  return createValidator((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    return validator.parse(v).data;
  });
}

function defaultValue(def, validator) {
  return createValidator((v) => {
    if (v === undefined || v === null || v === '') return def;
    return validator.parse(v).data;
  });
}

function transform(fn, validator) {
  return createValidator((v) => fn(validator.parse(v).data));
}

function refine(validator, fn, message) {
  return createValidator((v) => {
    const result = validator.parse(v);
    if (!fn(result.data)) throw new Error(message);
    return result.data;
  });
}

// ═══════════════════════════════════════════
// OBJETOS / ESQUEMAS COMPLEJOS
// ═══════════════════════════════════════════

function object(shape) {
  return createValidator((input) => {
    if (!input || typeof input !== 'object') throw new Error('Debe ser objeto');
    const result = {};
    const errors = [];
    
    for (const [key, validator] of Object.entries(shape)) {
      const value = input[key];
      const res = validator.safeParse(value);
      if (!res.success) {
        errors.push(...res.errors.map(e => ({ path: key, message: e.message })));
      } else if (res.data !== undefined) {
        result[key] = res.data;
      }
    }
    
    if (errors.length) throw { errors };
    return result;
  });
}

function array(itemValidator) {
  return createValidator((input) => {
    if (!Array.isArray(input)) throw new Error('Debe ser array');
    const result = [];
    const errors = [];
    
    input.forEach((item, index) => {
      const res = itemValidator.safeParse(item);
      if (!res.success) {
        errors.push(...res.errors.map(e => ({ path: `[${index}]${e.path}`, message: e.message })));
      } else {
        result.push(res.data);
      }
    });
    
    if (errors.length) throw { errors };
    return result;
  });
}

function enumValidator(values) {
  return createValidator((v) => {
    if (!values.includes(v)) throw new Error(`Debe ser uno de: ${values.join(', ')}`);
    return v;
  });
}

// ═══════════════════════════════════════════
// ESQUEMAS DEL SISTEMA
// ═══════════════════════════════════════════

/** @type {import('./index').Validator} */
const ProductoSchema = object({
  nombre: refine(string, v => v.trim().length >= 2, 'Nombre mínimo 2 caracteres'),
  categoria: enumValidator(['Licores', 'Cervezas', 'Sodas', 'Jugos', 'Galletas', 'Chicles', 'Snacks', 'Cigarrillos', 'Farmacia', 'Otros']),
  marca: optional(string),
  unidadBase: enumValidator(['unidad', 'botella', 'lata', 'sobre', 'cajetilla', 'paquete', 'litro', 'ml']),
  mlPorUnidad: optional(number).pipe(optional(positive())),
  stockMinUnidades: defaultValue(24, number.pipe(nonNegative())),
  precioVentaUnidad: number.pipe(positive('Precio debe ser > 0')),
  costo: number.pipe(nonNegative()),
  tieneVencimiento: boolean,
  vencimiento: optional(date),
  formatosVenta: array(object({
    id: string,
    nombre: string,
    unidades: number.pipe(positive()),
    precio: number.pipe(nonNegative()),
    esBase: optional(boolean)
  })),
  formatosCompra: array(object({
    id: string,
    nombre: string,
    unidades: number.pipe(positive())
  }))
});

const VentaSchema = object({
  productoId: string,
  productoNombre: string,
  cantidad: number.pipe(positive()),
  precioUnit: number.pipe(nonNegative()),
  total: number.pipe(nonNegative()),
  costo: number.pipe(nonNegative()),
  ganancia: number,
  pago: enumValidator(['efectivo', 'qr', 'transferencia', 'mixto', 'fiado']),
  nota: optional(string),
  fecha: date,
  formatoVenta: optional(string)
});

const EntradaSchema = object({
  productoId: string,
  cantidad: number.pipe(positive()),
  costo: number.pipe(nonNegative()),
  empaqueId: string,
  vencimiento: optional(date),
  nota: optional(string)
});

const SalidaSchema = object({
  productoId: string,
  cantidad: number.pipe(positive()),
  motivo: enumValidator(['personal', 'merma', 'regalo', 'otro']),
  nota: optional(string)
});

const ClienteSchema = object({
  nombre: refine(string, v => v.trim().length >= 2, 'Nombre mínimo 2 caracteres'),
  telefono: optional(string),
  email: optional(string)
});

const FiadoSchema = object({
  clienteId: string,
  items: array(object({
    productoId: string,
    productoNombre: string,
    cantidad: number.pipe(positive()),
    precioUnit: number.pipe(nonNegative()),
    esInventario: boolean
  })),
  monto: number.pipe(positive()),
  nota: optional(string)
});

const PagoSchema = object({
  clienteId: string,
  monto: number.pipe(positive()),
  metodo: enumValidator(['efectivo', 'qr', 'transferencia']),
  nota: optional(string)
});

const ComboSchema = object({
  nombre: refine(string, v => v.trim().length >= 2, 'Nombre mínimo 2 caracteres'),
  componentes: array(object({
    productoId: string,
    cantidad: number.pipe(positive())
  })),
  precioVenta: number.pipe(positive()),
  descripcion: optional(string)
});

// ═══════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════

const z = {
  string,
  number,
  boolean,
  date,
  object,
  array,
  enum: enumValidator,
  optional,
  default: defaultValue,
  min,
  max,
  positive,
  nonNegative,
  transform,
  refine,
  // Schemas predefinidos
  Producto: ProductoSchema,
  Venta: VentaSchema,
  Entrada: EntradaSchema,
  Salida: SalidaSchema,
  Cliente: ClienteSchema,
  Fiado: FiadoSchema,
  Pago: PagoSchema,
  Combo: ComboSchema
};

// Validation helpers
function validateAndSanitize(schema, data, context = '') {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Validación fallida${context ? ` en ${context}` : ''}: ${errors}`);
  }
  return result.data;
}

function validateProducto(data) {
  return validateAndSanitize(ProductoSchema, data, 'Producto');
}

function validateVenta(data) {
  return validateAndSanitize(VentaSchema, data, 'Venta');
}

function validateEntrada(data) {
  return validateAndSanitize(EntradaSchema, data, 'Entrada');
}

function validateSalida(data) {
  return validateAndSanitize(SalidaSchema, data, 'Salida');
}

function validateCliente(data) {
  return validateAndSanitize(ClienteSchema, data, 'Cliente');
}

function validateFiado(data) {
  return validateAndSanitize(FiadoSchema, data, 'Fiado');
}

function validatePago(data) {
  return validateAndSanitize(PagoSchema, data, 'Pago');
}

function validateCombo(data) {
  return validateAndSanitize(ComboSchema, data, 'Combo');
}

// Add to exports
z.validateProducto = validateProducto;
z.validateVenta = validateVenta;
z.validateEntrada = validateEntrada;
z.validateSalida = validateSalida;
z.validateCliente = validateCliente;
z.validateFiado = validateFiado;
z.validatePago = validatePago;
z.validateCombo = validateCombo;

window.z = z;
export default z;