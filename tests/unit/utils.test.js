// ═══════════════════════════════════════════
// tests/unit/utils.test.js — Tests unitarios para utils
// ═══════════════════════════════════════════

const { describe, it, expect, beforeEach } = require('@jest/globals');

// Importar las funciones globales (simuladas en setup.js)
const { safeNum, safeArr, escHTML, genId, formatDate, formatBs, round, clamp, truncate, capitalize, slugify, uniqueBy, groupBy, sumBy, sortBy, find, filter, $, createEl, clearEl, toggleClass, delegate, show, scrollToEl, storage, formatDate: fmtDate, formatDateTime, formatTime, daysBetween, startOfDay, endOfDay, addDays, isToday, now, toLocalISODate } = global;

describe('utils/number.js', () => {
  describe('safeNum', () => {
    it('convierte string a número', () => {
      expect(safeNum('123')).toBe(123);
      expect(safeNum('12.34')).toBe(12.34);
    });
    it('retorna fallback para valores inválidos', () => {
      expect(safeNum('abc', 0)).toBe(0);
      expect(safeNum(null, 5)).toBe(5);
      expect(safeNum(undefined, 10)).toBe(10);
      expect(safeNum(NaN, 42)).toBe(42);
    });
    it('maneja números ya válidos', () => {
      expect(safeNum(42)).toBe(42);
      expect(safeNum(0)).toBe(0);
      expect(safeNum(-5)).toBe(-5);
    });
  });

  describe('formatBs', () => {
    it('formatea con 2 decimales por defecto', () => {
      expect(formatBs(100)).toBe('Bs. 100.00');
      expect(formatBs(99.9)).toBe('Bs. 99.90');
    });
    it('permite decimales personalizados', () => {
      expect(formatBs(100, 0)).toBe('Bs. 100');
      expect(formatBs(100.555, 3)).toBe('Bs. 100.555');
    });
  });

  describe('round', () => {
    it('redondea a 2 decimales por defecto', () => {
      expect(round(1.234)).toBe(1.23);
      expect(round(1.235)).toBe(1.24);
    });
    it('permite decimales personalizados', () => {
      expect(round(1.2345, 3)).toBe(1.235);
      expect(round(100, 0)).toBe(100);
    });
  });

  describe('clamp', () => {
    it('limita al mínimo', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });
    it('limita al máximo', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
    it('mantiene valor en rango', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
  });
});

describe('utils/string.js', () => {
  describe('escHTML', () => {
    it('escapa caracteres especiales', () => {
      expect(escHTML('<script>')).toBe('<script>');
      expect(escHTML('"quote"')).toBe('"quote"');
      expect(escHTML("'single'")).toBe("'single'");
      expect(escHTML('&')).toBe('&');
    });
    it('maneja null/undefined', () => {
      expect(escHTML(null)).toBe('');
      expect(escHTML(undefined)).toBe('');
    });
  });

  describe('genId', () => {
    it('genera IDs únicos', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(genId());
      }
      expect(ids.size).toBe(100);
    });
    it('tiene longitud esperada', () => {
      const id = genId();
      expect(id.length).toBeGreaterThan(10);
    });
  });

  describe('truncate', () => {
    it('trunca strings largos', () => {
      expect(truncate('Hola mundo', 5)).toBe('Hola…');
    });
    it('no trunca strings cortos', () => {
      expect(truncate('Hi', 10)).toBe('Hi');
    });
    it('maneja null/undefined', () => {
      expect(truncate(null, 5)).toBe('');
      expect(truncate(undefined, 5)).toBe('');
    });
  });

  describe('capitalize', () => {
    it('capitaliza primera letra', () => {
      expect(capitalize('hola')).toBe('Hola');
      expect(capitalize('HOLA')).toBe('Hola');
    });
    it('maneja strings vacíos', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('slugify', () => {
    it('convierte a slug', () => {
      expect(slugify('Hola Mundo')).toBe('hola-mundo');
      expect(slugify('Café con Leche')).toBe('cafe-con-leche');
      expect(slugify('Test@#$%')).toBe('test');
    });
  });
});

describe('utils/array.js', () => {
  const arr = [
    { id: 1, nombre: 'A', valor: 10 },
    { id: 2, nombre: 'B', valor: 20 },
    { id: 3, nombre: 'A', valor: 30 }
  ];

  describe('safeArr', () => {
    it('retorna array si es array', () => {
      expect(safeArr([1,2,3])).toEqual([1,2,3]);
    });
    it('retorna array vacío para no-arrays', () => {
      expect(safeArr(null)).toEqual([]);
      expect(safeArr('string')).toEqual([]);
      expect(safeArr(123)).toEqual([]);
    });
  });

  describe('uniqueBy', () => {
    it('elimina duplicados por clave', () => {
      const result = uniqueBy(arr, 'nombre');
      expect(result).toHaveLength(2);
      expect(result.map(r => r.nombre)).toEqual(['A', 'B']);
    });
  });

  describe('groupBy', () => {
    it('agrupa por clave', () => {
      const result = groupBy(arr, 'nombre');
      expect(result.A).toHaveLength(2);
      expect(result.B).toHaveLength(1);
    });
  });

  describe('sumBy', () => {
    it('suma propiedad numérica', () => {
      expect(sumBy(arr, 'valor')).toBe(60);
    });
  });

  describe('sortBy', () => {
    it('ordena ascendente por defecto', () => {
      const result = sortBy([...arr].reverse(), 'valor');
      expect(result[0].valor).toBe(10);
      expect(result[2].valor).toBe(30);
    });
    it('ordena descendente', () => {
      const result = sortBy(arr, 'valor', 'desc');
      expect(result[0].valor).toBe(30);
    });
  });

  describe('find', () => {
    it('encuentra primer elemento', () => {
      const result = find(arr, x => x.valor > 15);
      expect(result.valor).toBe(20);
    });
  });

  describe('filter', () => {
    it('filtra elementos', () => {
      const result = filter(arr, x => x.nombre === 'A');
      expect(result).toHaveLength(2);
    });
  });
});

describe('utils/date.js', () => {
  const testDate = new Date('2024-01-15T10:30:00');

  describe('formatDate', () => {
    it('formatea fecha DD/MM/YYYY', () => {
      expect(formatDate(testDate)).toBe('15/01/2024');
    });
  });

  describe('formatDateTime', () => {
    it('formatea fecha y hora', () => {
      const result = formatDateTime(testDate);
      expect(result).toContain('15/01/2024');
      expect(result).toContain('10:30');
    });
  });

  describe('formatTime', () => {
    it('formatea solo hora', () => {
      expect(formatTime(testDate)).toBe('10:30');
    });
  });

  describe('daysBetween', () => {
    it('calcula días entre fechas', () => {
      expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9);
      expect(daysBetween('2024-01-10', '2024-01-01')).toBe(-9);
    });
  });

  describe('startOfDay / endOfDay', () => {
    it('inicio del día a 00:00:00', () => {
      const d = startOfDay(testDate);
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
    });
    it('fin del día a 23:59:59', () => {
      const d = endOfDay(testDate);
      expect(d.getHours()).toBe(23);
      expect(d.getMinutes()).toBe(59);
    });
  });

  describe('addDays', () => {
    it('suma días', () => {
      const d = addDays('2024-01-01', 5);
      expect(formatDate(d)).toBe('06/01/2024');
    });
    it('resta días', () => {
      const d = addDays('2024-01-10', -5);
      expect(formatDate(d)).toBe('05/01/2024');
    });
  });

  describe('isToday', () => {
    it('detecta fecha de hoy', () => {
      expect(isToday(new Date())).toBe(true);
    });
    it('detecta fechas pasadas', () => {
      expect(isToday('2020-01-01')).toBe(false);
    });
  });

  describe('now', () => {
    it('retorna timestamp actual', () => {
      const before = Date.now();
      const result = now();
      const after = Date.now();
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe('toLocalISODate', () => {
    it('retorna YYYY-MM-DD', () => {
      const result = toLocalISODate(testDate);
      expect(result).toBe('2024-01-15');
    });
  });
});

describe('utils/storage.js', () => {
  beforeEach(() => {
    localStorage._data = {};
  });

  it('set/get funciona', async () => {
    await storage.set('test', { foo: 'bar' });
    const result = await storage.get('test');
    expect(result).toEqual({ foo: 'bar' });
  });

  it('get retorna default para clave inexistente', async () => {
    const result = await storage.get('noexiste', 'default');
    expect(result).toBe('default');
  });

  it('remove elimina clave', async () => {
    await storage.set('test', 'value');
    await storage.remove('test');
    const result = await storage.get('test');
    expect(result).toBeNull();
  });

  it('keys lista claves', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);
    const keys = storage.keys();
    expect(keys).toContain('a');
    expect(keys).toContain('b');
    expect(keys.length).toBe(2);
  });

  it('clear limpia todo', async () => {
    await storage.set('a', 1);
    await storage.set('b', 2);
    await storage.clear();
    expect(await storage.get('a')).toBeNull();
    expect(await storage.get('b')).toBeNull();
  });
});

describe('disableNumberInputWheel', () => {
  it('desenfoca el input tipo number cuando ocurre el evento wheel en activeElement', () => {
    let wheelHandler = null;
    let blurred = false;
    const mockInput = {
      tagName: 'INPUT',
      type: 'number',
      blur: () => { blurred = true; }
    };
    const mockDoc = {
      activeElement: mockInput,
      addEventListener: (evt, handler) => {
        if (evt === 'wheel') wheelHandler = handler;
      }
    };

    global.disableNumberInputWheel(mockDoc);
    expect(wheelHandler).not.toBeNull();

    wheelHandler({ target: {} });
    expect(blurred).toBe(true);
  });

  it('desenfoca el input tipo number cuando el target del wheel es el input', () => {
    let wheelHandler = null;
    let targetBlurred = false;
    const mockInput = {
      tagName: 'INPUT',
      type: 'number',
      blur: () => { targetBlurred = true; }
    };
    const mockDoc = {
      activeElement: null,
      addEventListener: (evt, handler) => {
        if (evt === 'wheel') wheelHandler = handler;
      }
    };

    global.disableNumberInputWheel(mockDoc);
    wheelHandler({ target: mockInput });
    expect(targetBlurred).toBe(true);
  });

  it('no desenfoca elementos que no son input number', () => {
    let wheelHandler = null;
    let blurred = false;
    const mockTextInput = {
      tagName: 'INPUT',
      type: 'text',
      blur: () => { blurred = true; }
    };
    const mockDoc = {
      activeElement: mockTextInput,
      addEventListener: (evt, handler) => {
        if (evt === 'wheel') wheelHandler = handler;
      }
    };

    global.disableNumberInputWheel(mockDoc);
    wheelHandler({ target: mockTextInput });
    expect(blurred).toBe(false);
  });
});