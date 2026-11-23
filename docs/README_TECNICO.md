# TIA ELI LICORERÍA - Documentación Técnica

## Arquitectura General

```
src/
├── app.js              # Core: productos, lotes, FEFO, wizard
├── ventas.js           # POS, carrito, checkout, historial
├── gestion.js          # Usuarios, fiados, clientes, entradas/salidas
├── charts.js           # Gráficos (Chart.js)
├── sync.js             # Firebase sync
├── extras.js           # Utilidades varias
├── utils/              # Utilidades puras (sin DOM)
│   ├── number.js       # safeNum, formatBs, round, clamp
│   ├── string.js       # escHTML, genId, truncate, slugify
│   ├── array.js        # safeArr, uniqueBy, groupBy, sumBy
│   ├── dom.js          # $, createEl, delegate, show
│   ├── storage.js      # localStorage/IndexedDB wrapper
│   └── date.js         # formatDate, daysBetween, addDays
├── services/           # Servicios singleton
│   ├── event-bus.js    # Pub/Sub para desacoplar módulos
│   └── storage-service.js  # Capa unificada de almacenamiento
├── schemas/            # Validación (Zod-like ligero)
│   └── index.js        # Producto, Venta, Cliente, Fiado, Combo
└── workers/            # Web Workers para tareas pesadas
    └── analytics.worker.js
```

## Flujo de Datos

### 1. Agregar Producto (Wizard 3 pasos)
```
Usuario → Formulario (Paso 1→2→3) → Validación (schemas/Producto)
       → Anti-duplicado (nombre case-insensitive)
       → Si existe: Unificar lotes (modal)
       → Si nuevo: Crear producto + lote inicial
       → save() → EventBus.emit('productos:changed')
       → UI se actualiza via listeners
```

### 2. Venta POS (FEFO)
```
Usuario → Click producto → Carrito (posCart[])
       → Checkout → Validar stock total (pre-check)
       → descontarStockFEFO(productoId, cantidad, formatoId)
       → Ordena lotes por vencimiento ASC
       → Consume del más antiguo primero
       → Actualiza producto.stock, .vencimiento, .costoPromedio
       → Crea venta con lotesAfectados[]
       → save() + saveVentas() → EventBus.emit('venta:created')
```

### 3. Entrada de Stock
```
Usuario → Abrir modal → Seleccionar empaque → Cantidad + Costo + Vencimiento
       → confirmarEntrada()
       → Crea/actualiza lote (agrega a existente o nuevo)
       → Recalcula producto (stock, vencimiento, costo promedio)
       → Registra en tiaeli_entradas (auditoría)
       → EventBus.emit('entrada:registrada')
```

### 4. Anular Venta (Rollback FEFO)
```
Usuario → Confirmar anulación → revertirStockVenta(venta)
       → Busca lotes originales por ID + vencimiento
       → Restaura cantidades exactas
       → Recalcula producto
       → Elimina venta → EventBus.emit('venta:anulada')
```

## Eventos del Sistema (EventBus)

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `productos:changed` | `productos[]` | Productos creados/actualizados/eliminados |
| `producto:created` | `producto` | Nuevo producto guardado |
| `producto:updated` | `producto` | Producto editado |
| `producto:deleted` | `productoId` | Producto eliminado |
| `stock:changed` | `{productoId, stock}` | Stock modificado |
| `entrada:registrada` | `entrada` | Entrada de stock |
| `salida:registrada` | `salida` | Salida sin venta |
| `venta:created` | `venta` | Venta POS completada |
| `venta:anulada` | `ventaId` | Venta anulada |
| `fiado:created` | `fiado` | Fiado registrado |
| `pago:registrado` | `pago` | Pago/abono fiado |
| `section:changed` | `sectionId` | Navegación entre secciones |
| `storage:changed` | `{key, value}` | Cambio en storage |

## Patrones de Diseño

### 1. Event-Driven Architecture
- Módulos no se llaman directamente
- Se comunican via `EventBus.emit/on`
- Facilita testing y desacoplamiento

### 2. Immutable Lotes (Append-Only)
- Lotes nunca se mutan directamente
- Ajustes crean nuevo lote + marcan anterior `archived: true`
- Trazabilidad completa

### 3. FEFO Estricto
- `descontarStockFEFO` ordena por `vencimiento ASC`
- Lotes sin vencimiento van al final
- Tests unitarios verifican orden de consumo

### 4. Costing Ponderado
```
costoPromedio = Σ(cantidad_i × costo_i) / Σ(cantidad_i)
```
- Se recalcula en cada entrada/salida/ajuste
- Tests verifican precisión matemática

### 5. Validación por Esquemas
- `z.Producto`, `z.Venta`, `z.Cliente`, etc.
- Validación en cliente + servidor (futuro)
- Mensajes de error claros

## Storage Layer

### Capas
1. **Memoria** (cache instantáneo)
2. **localStorage** (síncrono, <5MB)
3. **IndexedDB** (asíncrono, >50MB, offline)
4. **Firebase** (remoto, multi-dispositivo)

### Backup/Restore
```js
// Export
const backup = await StorageService.exportAll();
// { version, timestamp, checksum, data }

// Import
await StorageService.importAll(backup);
```

## Testing Strategy

### Pirámide de Tests
```
        ▲
       / \     E2E (Playwright) - 10 tests
      /   \    Flujos completos, visual, a11y
     /─────\
    /       \  Integration - 8 tests
   /         \ API, storage, sync
  /───────────\
 /             \  Unit (Jest) - 50+ tests
/               \ Utils, FEFO, Costing, Schemas
─────────────────
```

### Comandos
```bash
npm run test          # Unit tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E
npm run test:visual   # Visual regression
npm run test:a11y     # Accessibility
```

## Performance

### Métricas Objetivo (Lighthouse)
- **FCP** < 1.5s
- **LCP** < 2.5s
- **TBT** < 200ms
- **CLS** < 0.1

### Optimizaciones
- Code splitting por rutas (Vite)
- Lazy loading: charts, extras, workers
- Memoización: `getTotalUnidadesBase`, `getCostoPromedio`
- Service Worker: cache-first para assets, network-first para API

## Accesibilidad (WCAG AA)

- Contraste ≥ 4.5:1 (texto), ≥ 3:1 (UI)
- Focus visible en todos los interactivos
- ARIA labels en iconos/botones sin texto
- Landmarks: main, nav, aside, header
- Reduced motion respectado
- Touch targets ≥ 44×44px

## Seguridad

- XSS prevention: `escHTML` en todo output
- CSP headers (configurar en hosting)
- Firebase rules: solo usuarios autenticados
- Validación tanto cliente como servidor
- Sanitización de inputs de archivo (imágenes)

## Deployment

### Build
```bash
npm run build  # Genera dist/ con hash en filenames
```

### Variables de Entorno
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
```

### Hosting Recomendado
- **Netlify/Vercel**: Auto-deploy, preview PRs, edge functions
- **Firebase Hosting**: Integración nativa, CDN global

## Debugging

### Console Commands
```js
// Ver productos
productos

// Ver ventas
ventas

// Disparar eventos manualmente
EventBus.emit('productos:changed', productos)

// Exportar backup
StorageService.exportAll().then(console.log)

// Limpiar storage
localStorage.clear(); indexedDB.deleteDatabase('TiaEliDB')
```

### Logs Estructurados
```js
// En código
console.log('[Módulo] Acción', { key: value });
// Prefijos: [App], [Ventas], [Gestion], [Sync], [Storage]
```

## Roadmap Técnico

- [ ] TypeScript migration gradual
- [ ] Web Worker para analytics
- [ ] IndexedDB sync completo
- [ ] Background Sync para offline
- [ ] Push notifications (VAPID)
- [ ] Multi-tenant (sucursales)
- [ ] API REST documentada (OpenAPI)
- [ ] GraphQL endpoint opcional