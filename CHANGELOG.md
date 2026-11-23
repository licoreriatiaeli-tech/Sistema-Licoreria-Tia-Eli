# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2026-09-14 - "Refactor Mayor + Testing Completo"

### 🎉 Added - Nuevas Funcionalidades
- **Sistema de Utils Centralizado** (`utils/`)
  - `number.js`: safeNum, formatBs, round, clamp
  - `string.js`: escHTML, genId, truncate, capitalize, slugify
  - `array.js`: safeArr, uniqueBy, groupBy, sumBy, sortBy, find, filter
  - `dom.js`: $, createEl, delegate, show, scrollToEl
  - `storage.js`: Wrapper localStorage/IndexedDB con TTL
  - `date.js`: formatDate, daysBetween, addDays, isToday, toLocalISODate
- **Event Bus** (`services/event-bus.js`)
  - Patrón Pub/Sub para desacoplar módulos
  - Eventos tipados: `productos:changed`, `venta:created`, `stock:changed`, etc.
- **Storage Service** (`services/storage-service.js`)
  - Capa unificada: Memoria → localStorage → IndexedDB → Firebase
  - Backup/Restore versionado con checksum
- **Validación de Esquemas** (`schemas/index.js`)
  - Zod-like ligero sin dependencias
  - Esquemas: Producto, Venta, Entrada, Salida, Cliente, Fiado, Pago, Combo
  - Modificadores: min, max, positive, optional, default, transform, refine
- **Build System** (Vite 5)
  - Code splitting automático
  - PWA plugin con Workbox
  - Hash en filenames para cache busting
- **Testing Completo**
  - Jest: 50+ tests unitarios (utils, FEFO, costing, schemas)
  - Playwright: E2E flows, visual regression, accessibility
  - GitHub Actions CI/CD pipeline
- **Documentación**
  - `docs/README_TECNICO.md`: Arquitectura, flujos, patrones
  - `CHANGELOG.md`: Este archivo

### 🐛 Fixed - Correcciones Críticas
- **Formulario "Agregar Inventario"**: Limpieza completa de estado al navegar fuera
  - `formatosVentaTemp[]` se resetea
  - `productoTieneVencimiento` se resetea
  - `formatoCompraActive` vuelve a 'paquete'
  - `currentPhotoBase64` se limpia
  - `wizardStep` vuelve a 1
  - Listeners en navegación (sidebar + bottom nav mobile)
- **Funciones Duplicadas Eliminadas**
  - `getStockTotal` → `getTotalUnidadesBase` (app.js)
  - `getVencimientoMasCercano` → global (app.js)
  - `getCostoPromedio` → global (app.js)
  - `safeNum`, `safeArr`, `escHTML`, `genId` → utils-bundle.js
- **Navegación Mobile**: Bottom nav ahora usa `navegarA()` centralizado

### ♻️ Refactored - Mejoras de Código
- **app.js**: Eliminados 22 líneas de utils duplicados
- **gestion.js**: Eliminados 17 líneas de utils duplicados + 28 líneas de helpers stock
- **Import Order**: utils-bundle.js → event-bus → storage-service → schemas → app.js
- **ESLint + Prettier**: Configuración estricta con reglas recomendadas
- **JSDoc**: Tipos en funciones críticas públicas

### 🎨 Visual - UI/UX (Pendiente implementación completa en 4.1)
- Design tokens CSS planificados
- Componentes base: Button, Input, Card, Modal, Toast, Table
- Animaciones: page transitions, list stagger, state changes
- Dark mode refinado WCAG AA

### 🔧 Technical Debt
- Preparado para migración gradual a TypeScript
- Web Workers para analytics (pendiente)
- IndexedDB sync completo (pendiente)

---

## [3.0.0] - 2026-08-15 - "Lotes FEFO + Combos"

### Added
- Sistema de Lotes con FEFO (First Expired, First Out)
- Costing promedio ponderado por lote
- Combos de productos con stock calculado
- Ofertas manuales y por vencimiento
- Auditoría de precios (`historial_precios`)
- Entradas/Salidas con trazabilidad de lotes

### Fixed
- Stock zero al migrar (migración v1)
- Descuento stock correcto en ventas multi-formato

---

## [2.0.0] - 2026-06-01 - "POS Unificado + Fiados"

### Added
- Caja Rápida (POS) unificada PC/Mobile
- Carrito flotante con FAB animado
- Pago mixto (efectivo + QR)
- Sistema de Fiados completo
- Clientes con saldo automático
- Registro de actividad/usuario

---

## [1.0.0] - 2026-03-01 - "MVP Inicial"

### Added
- Inventario básico CRUD
- Ventas simples
- Dashboard con stats
- Categorías y búsqueda
- localStorage persistence
- PWA básico

---

## Tipos de Cambios

- `Added` para nuevas funcionalidades
- `Changed` para cambios en funcionalidad existente
- `Deprecated` para funcionalidades que serán removidas
- `Removed` para funcionalidades removidas
- `Fixed` para corrección de bugs
- `Security` para vulnerabilidades corregidas