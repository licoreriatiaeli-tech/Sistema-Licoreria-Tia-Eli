# PLAN DEL SISTEMA — TIA ELI LICORERÍA

> **Versión del plan:** v4.0 — Documento de ingeniería paso a paso
> **Propósito:** Guía completa para construir y mantener el sistema de gestión de una licorería familiar, de forma que cualquier IA de desarrollo web (Claude, etc.) o desarrollador pueda ejecutarla sin ambigüedades.
> **Estado base del repositorio:** La app ya existe como PWA en v3.0 (inventario con lotes FEFO, caja rápida POS, historial, analíticas, combos, vencimientos, QR de pago, backup). Este plan describe el sistema FINAL completo y detalla tanto lo existente (para entenderse) como lo nuevo (para construirse).

---

## 1. RESUMEN EJECUTIVO

Aplicación web progresiva (PWA) de gestión para una licorería familiar. La usan el dueño (JOHAN), su padre (EDWIN), su madre/tía (ELI) y, a futuro, un empleado más. Funciona 100% sin internet en el celular (localStorage) y sincroniza entre dispositivos con Firebase (Firestore) cuando hay conexión.

### 1.1 Objetivos de negocio
1. **Atender rápido**: la caja rápida (POS) permite vender con 2-3 toques, descontando el stock automáticamente con lógica FEFO (primero lo que vence antes).
2. **Inventario controlado**: productos con lotes (cantidad, costo, vencimiento), entrada de stock y salidas.
3. **Salidas sin venta**: cuando alguien de la familia se saca un producto (ej. una Coca-Cola 3L) o algo se daña/venció, se registra como "salida" con motivo y autor, sin contar como venta ni ganancia.
4. **Fiados (créditos)**: registrar clientes que deben, con expediente por cliente, abonos parciales y saldo actualizado.
5. **Trazabilidad total**: cada acción (venta, entrada, salida, fiado, pago, alta/edición de producto) queda firmada con el nombre del usuario que la hizo.
6. **Nunca perder datos**: respaldo local + sincronización a la nube + exportación/importación de respaldo.

### 1.2 Usuarios
| Usuario | Rol |
|---|---|
| ELI | Administra tienda, vende, fía |
| EDWIN | Vende, fía, controla inventario |
| JOHAN | Administrador, ventas, fiados, configuración |
| (Futuro empleado) | Venta y salidas únicamente (por definir permisos) |

### 1.3 Decisión de identificación
Sin contraseñas: al abrir la app se muestra una pantalla con botones grandes ("¿Quién eres?") y se elige el nombre. Cada registro posterior se firma con ese nombre. Cerrar/ cambiar sesión es un toque en el chip de usuario.

---

## 2. PILA TECNOLÓGICA (sin frameworks)

| Tecnología | Uso |
|---|---|
| HTML5 + CSS3 | Estructura y diseño (variables CSS para temas claro/oscuro) |
| JavaScript vanilla | Toda la lógica, modularizada en archivos por responsabilidad |
| localStorage | Base de datos local/offline (caché y persistencia principal) |
| Firebase Firestore (opcional) | Sincronización en tiempo real entre dispositivos |
| Chart.js (CDN) | Gráficas de ventas y analíticas |
| Service Worker + manifest.json | PWA instalable y modo offline |

---

## 3. ARQUITECTURA DE ARCHIVOS Y ORDEN DE CARGA

```
SISTEMA LICORERIA/
├── index.html            Esqueleto: sidebar, secciones, modales, login
├── style.css             Todos los estilos
├── app.js                Core: productos, lotes, inventario, navegación, dashboard
├── ventas.js             Ventas + caja rápida POS + FEFO + historial
├── charts.js             Gráficas Chart.js
├── extras.js             Tema, PWA, combos, cierre de caja, backup, QR de pago
├── gestion.js            NUEVO: usuarios/sesión, fiados, salidas, entradas, actividad
├── lucide.min.js         NUEVO: librería de iconos profesionales (Lucide, ISC) auto-alojada
├── sync.js               Sincronización Firestore ↔ localStorage
├── firebase-config.js    Credenciales Firebase (inyectables)
├── sw.js                 Service Worker (caché offline)
└── manifest.json         Manifest PWA
```

### 3.1 Orden de carga de scripts en index.html (CRÍTICO)
```
firebase-config.js   → define window.firebaseConfig
lucide.min.js        → iconos profesionales (window.lucide)
sync.js              → inicia Firebase y listeners; expone window.sync*
app.js               → productos, utilidades globales (escHTML, safeNum, genId, getStockTotal)
charts.js            → gráficos
ventas.js            → ventas + POS + descontarStockFEFO()
extras.js            → tema, combos, backup, QR
gestion.js           → NUEVO: usa todo lo anterior
```
Regla: `gestion.js` DEBE cargarse al final porque depende de `descontarStockFEFO()` (definido en ventas.js), de `productos` (app.js) y de utilidades globales. Si la app se abre SIN conexión, `lucide.min.js` sale de la caché del Service Worker (auto-alojada, no depende de internet).

### 3.2 Sistema de iconos profesionales (Lucide)

**Fuente y licencia:** [Lucide Icons](https://lucide.dev) — licencia **ISC** (gratis personal y comercial, sin atribución obligatoria en el producto). Es el fork activo y mantenido de Feather Icons y el estándar de facto en dashboards modernos (shadcn/ui, SaaS): trazo lineal consistente de 2px, malla de 24px, puntas redondeadas, neutros sin relleno (ni caricaturas ni emojis).

**Instalación (auto-alojada, offline):**
1. Descargar el build vanilla UMD: `https://unpkg.com/lucide@0.535.0/dist/umd/lucide.min.js` (≈368 KB) → guardar en la raíz como `lucide.min.js` (el archivo incluye el header de licencia ISC).
2. Cargarlo PRIMERO en `index.html` (con `defer`).
3. En `DOMContentLoaded`: `window.lucide.createIcons();`.
4. Incluirlo en `sw.js` (caché offline) y versionarlo `?v=N` como el resto.

**Cómo se usa (patrón):**
```html
<i data-lucide="home"></i>  → se convierte en <svg class="lucide lucide-home" stroke="currentColor">
```
El color se hereda con `currentColor` → se adapta solo al tema claro/oscuro y a los estados hover/activo.

**Mapa de iconos CANÓNICO (usar siempre estos, sin mezclar con emojis):**

| Elemento | Icono Lucide |
|---|---|
| Dashboard | `home` |
| Inventario | `box` |
| Registrar Venta (POS) | `shopping-cart` |
| Historial | `history` |
| Analíticas | `bar-chart-3` |
| Combos | `gift` |
| Vencimientos | `calendar-clock` |
| Agregar Producto | `plus-circle` |
| Gestión de QR | `qr-code` |
| **Fiados** (nuevo) | `hand-coins` |
| **Actividad** (nuevo) | `activity` |
| Entrada de stock | `arrow-down-to-line` (o `package-plus`) |
| Salida sin venta | `arrow-up-from-line` (o `package-minus`) |
| Cobrar / abonar | `circle-dollar-sign` |
| Expediente del cliente | `book-open` |
| Nuevo cliente | `user-plus` |
| Editar | `pencil` |
| Eliminar | `trash-2` |
| Buscar | `search` |
| Pago en efectivo | `banknote` |
| Pago por QR | `qr-code` |
| Cerrar sesión | `log-out` |
| Exportar / Importar | `download` / `upload` |
| Imprimir | `printer` |
| Filtros | `filter` |

**Reglas obligatorias:** una sola librería en todo el proyecto; los iconos ACOMPAÑAN al texto (no lo sustituyen); nunca mezclar emojis con estos iconos en la misma pantalla.

---

## 4. MODELO DE DATOS

### 4.1 Producto — `window.productos[]` (localStorage `tiaeli_v2`)
```js
{
  id: "m9x8Fa",                 // genId(): Date.now().toString(36) + random
  nombre: "Coca-Cola",           // nombre base del producto (marca comercial)
  categoria: "Sodas",           // Licores|Cervezas|Sodas|Jugos|Galletas|Chicles|Otros
  marca: "Coca Cola",           // fabricante o marca
  presentacion: "2 litros",      // tamaño/contenido (Ej: 750ml, 6 pack, 1 litro, 500ml)
  unidad: "botella",            // unidad|botella|lata|paquete|caja|litro — tipo de envase
  stockMin: 3,
  venta: 15.5,                  // precio de venta en Bs.
  costo: 11.0,                  // DERIVADO: costo promedio ponderado de lotes activos
  stock: 24,                    // DERIVADO: suma de cantidades de lotes
  vencimiento: "2026-12-01",    // DERIVADO: vencimiento más próximo con stock
  proveedor: "", nota: "",
  foto: "data:image/...",       // opcional, comprimida a <800 KB
  enOferta: false, precioOferta: 15.5,
  fechaRegistro: "ISO...",
  lotes: [ { id, cantidad, costo, vencimiento, fechaIngreso, nota } ]
}
```
**Invariante:** `stock`, `vencimiento` y `costo` son SIEMPRE derivados de `lotes`. Nunca se escriben a mano.

### 4.2 Venta — `window.ventas[]` (localStorage `tiaeli_ventas`)
```js
{
  id, tipo: "individual" | "combo",
   productoId, productoNombre, productomarca, categoria, presentacion,
   cantidad, cantidadPacks, packLabel,
  precioUnit, subtotal, descuento, total, costo, ganancia,
  pago: "efectivo" | "qr" | "transferencia",
  nota, fecha: (timestamp number), fechaRegistro: "ISO",
  lotesAfectados: [ { loteIndex, vencimiento, cantidadDescontada, costoUnitario } ],
  usuario: "JOHAN"              // NUEVO: quien registró la venta
}
```
Nota legacy: ventas viejas pueden tener `fecha` como string ISO. Siempre normalizar: `new Date(typeof v.fecha === 'number' ? v.fecha : v.fecha)`.

### 4.3 Cliente — `clientes[]` (localStorage `tiaeli_clientes`) NUEVO
```js
{ id, nombre, telefono, creado: ts, creadoPor: "usuario" }
```

### 4.4 Fiado — `fiados[]` (localStorage `tiaeli_fiados`) NUEVO
```js
{
  id, clienteId,
  items: [ { productoId, productoNombre, cantidad, precioUnit } ],
  monto, fecha: ts,
  usuario,                    // quien fió
  lotesAfectados, nota
}
```

### 4.5 Pago — `pagos[]` (localStorage `tiaeli_pagos`) NUEVO
```js
{ id, clienteId, monto, metodo: "efectivo"|"qr", fecha: ts, usuario, nota }
```

### 4.6 Salida — `salidas[]` (localStorage `tiaeli_salidas`) NUEVO
```js
{
  id, productoId, productoNombre, cantidad,
  motivo: "personal"|"vencido"|"dañado"|"merma"|"otro",
  nota, fecha: ts, usuario, lotesAfectados
}
```

### 4.7 Actividad — `actividad[]` (localStorage `tiaeli_actividad`) NUEVO
```js
{ id, tipo: "venta"|"entrada"|"salida"|"fiado"|"pago"|"producto"|"combo"|"oferta"|"usuario"|"sistema"|"backup",
  detalle: "texto", fecha: ts, usuario }
```
Límite: 3000 registros más recientes. NO se sincroniza con Firestore (evita agotar la cuota de escrituras); es local a cada dispositivo.

### 4.8 Usuarios y sesión
- `localStorage["tiaeli_usuarios"]` → `[{ id, nombre, color }]`; iniciales: ELI, EDWIN, JOHAN.
- `localStorage["tiaeli_sesion"]` → nombre del usuario activo.
- Sin contraseñas (botones rápidos, decisión de negocio).

### 4.9 Colecciones Firestore
| Colección | Contenido | Estado |
|---|---|---|
| `inventario_tiaeli` | productos | existente |
| `ventas_tiaeli` | ventas | existente |
| `combos_tiaeli` | combos | existente |
| `config_tiaeli` | doc `qrs` (QR de pago) | existente |
| `clientes_tiaeli` | clientes | NUEVA |
| `fiados_tiaeli` | fiados | NUEVA |
| `pagos_fiados_tiaeli` | pagos | NUEVA |
| `salidas_tiaeli` | salidas sin venta | NUEVA |

La ACTIVIDAD no se sube a la nube por diseño (nota en 4.7).

---

## 5. REGLAS DE NEGOCIO (invariantes que NUNCA deben romperse)

1. **Stock total = Σ de cantidades de lotes.** Cualquier mutación de stock pasa por lotes.
2. **FEFO:** al descontar, se consumen primero los lotes con vencimiento más cercano.
3. **Una salida no genera ganancia ni entra a la caja.** Solo descuenta stock.
4. **Un fiado descuenta stock pero NO entra a la caja:** queda como cuenta por cobrar.
5. **Ninguna acción sin autor:** cada movimiento registra el usuario activo del momento.
6. **Eliminar una venta NO restaura stock** (se advierte al usuario). **Eliminar un fiado SÍ restaura stock** (creando un lote de devolución con costo/vencimiento originales).
7. **Los importes de respaldo siempre se MERGEAN** (nunca reemplazan lo local).
8. **El saldo de un cliente = Σ montos de sus fiados − Σ de sus pagos.**

---

## 6. FASES DE IMPLEMENTACIÓN PASO A PASO

> Convención por fase: **Objetivo → Archivos → Pasos → Validación → Errores esperados**.
> No avanzar a la siguiente fase hasta que la validación de la anterior dé "verde".

---

### FASE 0 — Preparación del entorno y Firebase
**Objetivo:** entorno de trabajo listo y credenciales de nube opcionales.

**Pasos:**
1. Consola Firebase (https://console.firebase.google.com): crear proyecto → Agregar app Web → copiar `apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId` a `firebase-config.js`.
2. Firestore → Crear base de datos → modo de prueba (ámbito familiar).
3. Abrir `index.html` en el navegador: debe funcionar SIN Firebase (modo local, badge "Sin config").
4. Commit base en git.

**Validación:** la app navega, agrega productos y persiste en localStorage sin errores de consola.

**Errores esperados:**
- Credenciales mal copiadas → alerta "Revisa los datos en firebase-config.js".
- Dos pestañas con persistencia → aviso `failed-precondition` (normal; usar una pestaña principal).

---

### FASE 1 — Esqueleto y navegación
**Objetivo:** estructura de secciones y navegación estable.

**Archivos:** `index.html`, `app.js`, `style.css`.

**Pasos:**
1. Sidebar con grupos:
   - **Principal:** Dashboard, Inventario.
   - **Ventas:** Registrar Venta (POS), Historial, Analíticas.
   - **Gestión:** Combos, Vencimientos, Agregar Producto, Gestión de QR.
   - **Personal (NUEVO):** Fiados, Registro de Actividad.
   Cada ítem lleva su icono Lucide (ver mapa en 3.2): `home`, `box`, `shopping-cart`, `history`, `bar-chart-3`, `gift`, `calendar-clock`, `plus-circle`, `qr-code`, `hand-coins`, `activity`.
2. Secciones `<section id="section-...">`; solo una lleva `.active` (CSS: `.section {display:none}` / `.section.active {display:block}`).
3. `navegarA(sectionId)` en app.js: renderizar datos ANTES de cambiar de sección (evita pantallas blancas).
4. Móvil: arrancar en POS; escritorio: arrancar en Dashboard.

**Validación:** cada ítem del menú muestra su sección con animación; sin secciones blancas.

**Errores esperados:**
- Falta `.active` → sección invisible.
- Sección inexistente en el HTML pero invocada → `if (sec)` guard, sin crash.

---

### FASE 2 — Usuarios y sesión (NUEVO)
**Objetivo:** identificar quién usa la app y firmar cada acción.

**Archivos:** `gestion.js` (crear), `index.html`, `style.css`.

**Pasos:**
1. Estado: `tiaeli_usuarios` (default ELI/EDWIN/JOHAN) y `tiaeli_sesion`.
2. Overlay de login (`#loginOverlay`): tarjetas grandes con inicial y nombre; `seleccionarUsuario(nombre)` guarda sesión, cierra overlay, actualiza chip, registra actividad tipo `usuario` ("Sesión iniciada: X").
3. Chip de usuario fijo:
   - Sidebar footer: avatar con inicial + nombre + botón "Cambiar".
   - Topbar móvil: iniciales del usuario activo.
   - Clic en el chip → reabre el login (puede cambiarse la sesión en cualquier momento).
4. Exponer `window.usuarioActual` (nombre en mayúsculas, p. ej. "JOHAN").
5. Si no hay sesión guardada al cargar → mostrar login. Si el overlay se cierra sin elegir → dejarlo siempre visible hasta elegir (no bloquea en modo oscuro/escritorio).

**Validación:** recargar → pide usuario; elegir → el chip muestra el nombre; hacer una venta → la venta y la actividad muestran el autor.

**Errores esperados:**
- `localStorage` de sesión borrado → vuelve a pedir login (comportamiento correcto, no bug).
- Comparación de nombres con acentos/mayúsculas → normalizar con `trim()` y comparar exacto, sin `toLowerCase` para visualizar.

---

### FASE 3 — Registro de producto y lotes
**Objetivo:** alta/edición de productos con stock por lotes (base existente, reforzada).

**Archivos:** `app.js`, `index.html`, `extras.js`.

**Pasos:**
1. Formulario `#productForm`: nombre*, categoría*, marca/presentación, unidad, stock mínimo, precio venta, lotes (cantidad, costo, vencimiento, fecha ingreso), proveedor, foto, notas.
2. Cálculo automático al guardar: `stock`, `costo` promedio ponderado, `vencimiento` más próximo (funciones `getStockTotal`, `getCostoPromedio`, `getVencimientoMasCercano`).
3. **Unificación anti-duplicados:** si ya existe producto con mismo nombre+categoría+marca (case-insensitive, trim) → modal "Agregar como nuevo lote al existente" (opción recomendada) o "Crear duplicado de todos modos".
4. `migrarProductosALotes()`: productos antiguos sin `lotes` pasan a un único lote (compatibilidad con datos existentes).
5. **NUEVO:** registrar actividad `producto` en: alta, edición, fusión y eliminación.

**Validación:** crear producto → aparece en inventario con stock correcto; crear el mismo producto otra vez → pregunta por fusión.

**Errores esperados:**
| Error | Causa | Manejo |
|---|---|---|
| Duplicados | Nombre escrito distinto | Fusión por nombre+categoría+marca normalizado |
| Costo 0 | Lote sin costo | Permitir (costo 0) pero mostrar "—" en ganancia |
| Cantidad negativa | Input manual | `min="0"` + `safeNum()` |
| Foto pesada | Foto > 3 MB | Comprimir con canvas a ≤800 KB (extras.js) |

---

### FASE 4 — Inventario: listar, entrar y salir stock
**Objetivo:** ver el inventario completo y poder aumentar (entrada) o quitar (salida) stock fácilmente.

**Archivos:** `app.js`, `gestion.js` (modales), `index.html`, `style.css`.

**Pasos:**
1. **Listado:** tabla (escritorio) + tarjetas (móvil). Columnas: foto, producto, categoría, stock total, costo, venta, ganancia, vencimiento, estado, acciones. Fila expandible con detalle de lotes (animación).
2. **Filtros:** búsqueda por nombre/marca, categoría, estado (ok/bajo/agotado/vence-pronto).
3. **Entrada de stock (NUEVO, modal `entradaOverlay`):** `registrarEntrada(productoId)` → cantidad, costo unitario, vencimiento, proveedor → agrega lote nuevo → recalcula derivados → actividad `entrada`.
   - Acceso: botón "⇧ Añadir stock" en cada fila + botón "Entrada rápida" en cabecera (con selector de producto).
4. **Salida sin venta (NUEVO, modal `salidaOverlay`):** `registrarSalida(productoId)` → cantidad + motivo (`personal`/`vencido`/`dañado`/`merma`/`otro`) + nota → descuenta FEFO reutilizando `descontarStockFEFO()` → actividad `salida`. NO afecta caja ni ganancias.
   - Acceso: botón "⇩ Retirar" en cada fila + "Salida rápida" en cabecera (selector de producto si se abre sin contexto).
5. Botón "Exportar CSV" de inventario.

**Validación:** entrar 10 unidades → stock sube y se ve el lote nuevo; retirar 3 con motivo "personal" → stock baja, aparece en Actividad y el Dashboard de caja NO cambia.

**Errores esperados:**
- Salida mayor al stock disponible → bloquear con "Stock disponible: X".
- Eliminar producto con stock → confirmación clara (irreversible).
- Tras entrada/salida, POS y Dashboard deben reflejar el nuevo stock (re-render completo).

---

### FASE 5 — Ventas y caja rápida (POS)
**Objetivo:** vender en segundos con descuento automático FEFO.

**Archivos:** `ventas.js`, `index.html`.

**Pasos:**
1. Grilla de productos con filtros por categoría y búsqueda; tarjeta con nombre, precio, stock disponible (agotado = gris).
2. Carrito flotante (FAB): ítems con +/− y total; formas de pago Efectivo/QR (con QR elegible por persona).
3. `checkoutPOS()`:
   - Pre-validar stock por ítem (incluyendo combos: stock mínimo del componente limitante).
   - Por cada ítem: `descontarStockFEFO` → construir venta con `usuario: window.usuarioActual` (NUEVO).
   - Guardar, sincronizar, confeti + toast.
4. **NUEVO:** registrar actividad `venta` por cada venta con su autor.
5. Eliminar venta: confirmación "el stock NO se restaura"; registrar actividad `venta` ("venta eliminada").

**Validación:** vender con stock → stock baja por FEFO y la venta aparece firmada en Historial y Actividad.

**Errores esperados:**
- Stock insuficiente en combo → validar antes de mutar lotes.
- Doble toque en "Registrar" → deshabilitar el botón mientras procesa.
- Fecha legacy (string) vs nueva (timestamp) → normalización siempre.
- Venta de producto eliminado → bloquear (producto no existe).

---

### FASE 6 — Historial, analíticas y dashboard
**Objetivo:** ver el desempeño del negocio.

**Archivos:** `ventas.js`, `charts.js`, `app.js`, `index.html`.

**Pasos:**
1. Historial: filtros (fecha desde/hasta, forma de pago, búsqueda), tabla + tarjetas móvil, resumen (total, ganancia, efectivo, QR/transferencia), exportar CSV.
2. Analíticas (Chart.js): ventas últimos 30 días, horas pico, forma de pago (pie), ganancia por categoría, top 10 productos, ticket promedio.
3. Dashboard: tarjetas de estadísticas (total productos, en stock, stock bajo, por vencer, valor inventario, ventas hoy) + ventas 7 días + top productos + categorías + alertas.
4. **NUEVO:** tarjeta "Fiados por cobrar" (saldo pendiente total) y alerta de clientes con deuda.

**Validación:** cada tarjeta muestra valores reales; gráficos se repintan al cambiar el tema.

**Errores esperados:**
- Chart.js no cargó (offline, CDN) → guard `if (typeof Chart === 'undefined') return;`.
- Arrays vacíos → siempre `|| []` antes de `.reduce/.map/.filter`.
- `localStorage` casi lleno → monitor de cuota (`checkStorageQuota`) y aviso en consola.

---

### FASE 7 — Combos y vencimientos
**Objetivo:** venta agrupada y control de caducidad.

**Archivos:** `extras.js`, `ventas.js`, `app.js`, `index.html`.

**Pasos:**
1. Combos: crear/editar combos (buscador de productos, cantidades, precio sugerido, ganancia estimada). En POS se muestra la disponibilidad (mínimo de componentes). Al vender combo se descuentan todos sus componentes (FEFO por cada uno).
2. Vencimientos: pestañas 7/15/30 días/todos; alerta por lote; acción rápida "Poner en oferta".

**Validación:** crear combo → aparece en POS; venderlo → descuenta los componentes; vencimiento → badge en sidebar con contador.

**Errores esperados:**
- Producto de un combo eliminado → marcar combo "sin stock" y mostrar nombre de referencia.
- Combo sin precio → advertir "Sin precio fijado".

---

### FASE 8 — Fiados / Créditos (NUEVO, módulo completo)
**Objetivo:** gestionar clientes que deben, sus fiados y abonos, todo firmado.

**Archivos:** `gestion.js`, `index.html`, `style.css`, `sync.js`.

**Pasos:**
1. **Nuevo fiado (modal `fiadoOverlay`):**
   - Cliente: input con autocompletado (crea cliente nuevo si no existe al guardar).
   - Ítems: buscador de productos (estilo combo) → agregar `{producto, cantidad, precio}`; lista editable (cantidad +/−, quitar).
   - Total = Σ cantidad × precio.
   - Guardar: validar stock por ítem → `descontarStockFEFO` por ítem → crear fiado → actividad `fiado` ("Fiado a NOMBRE — Bs.X, N ítems — por USUARIO").
2. **Sección Fiados:**
   - Stats: Pendiente total, Cobrado total, Clientes en deuda, Fiados registrados.
   - Búsqueda por cliente.
   - Tarjeta por cliente: nombre, saldo (verde "al día" / naranja/rojo "en deuda"), botones **Cobrar** y **Ver expediente**.
3. **Cobrar / abonar (modal `pagoOverlay`):** monto (precargado = saldo), método efectivo/QR, nota → crea pago → baja saldo → actividad `pago` ("Abono de NOMBRE — Bs.X — por USUARIO").
4. **Expediente del cliente (modal o expandible):** lista de fiados (fecha, ítems, monto, quién fió) y pagos (fecha, monto, método, quién cobró). Botón eliminar fiado → restaura stock con lote de devolución (costo/vencimiento originales) + actividad `fiado` ("fiado anulado"). Botón eliminar pago (revierte el abono).
5. Saldo = Σ fiados − Σ pagos (permitir sobrepago de forma controlada; se muestra el saldo real).

**Validación:** fiar 2 productos a un cliente nuevo → stock baja, cliente aparece con saldo, Actividad lo registra con autor; abonar Bs.10 → saldo baja y queda firmado.

**Errores esperados:**
- Cliente con mismo nombre ya existente → reutilizar en vez de duplicar (normalizar).
- Cobrar más del saldo → permitir monto exacto solicitado pero mostrar saldo resultante (informativo).
- Fiado con stock insuficiente → bloquear ítem y avisar.
- Anular fiado → restaurar stock correctamente (no generar stock de más).

---

### FASE 9 — Registro de Actividad (NUEVO)
**Objetivo:** auditoría completa de todo lo que pasa en la tienda.

**Archivos:** `gestion.js`, `index.html`, `style.css`.

**Pasos:**
1. `registrarActividad(tipo, detalle)` central en `gestion.js`; cap de 3000 registros (corta los más viejos).
2. Sección "Registro de Actividad":
   - Filtros: tipo (venta/entrada/salida/fiado/pago/producto/combo/oferta/usuario/sistema/backup), usuario (select dinámico), rango de fechas.
   - Listado en tarjetas: icono por tipo (color distinto), fecha/hora, detalle, autor resaltado.
   - Exportar CSV de actividad.
3. **Firma automática de todas las operaciones** (ver tabla de tipos en 4.7): entradas, salidas, ventas, fiados, pagos, alta/edición/eliminación de productos y combos, ofertas, cambio de sesión, backups/restauraciones, cierre de caja.

**Validación:** hacer una venta y una salida → ambas aparecen con fecha, autor y tipo correctos; filtro por usuario funciona.

**Errores esperados:**
- Actividad infinita creciendo → cap de 3000 (pierde los más viejos sin romper).
- Detalle con caracteres especiales → escapar HTML (`escHTML`) antes de renderizar (XSS).

---

### FASE 10 — Sincronización y offline (sync.js)
**Objetivo:** los datos se comparten entre el celular y la PC de forma automática.

**Archivos:** `sync.js`.

**Pasos:**
1. Si no hay config de Firebase → modo local (todo sigue funcionando en el dispositivo).
2. `onSnapshot` por colección con `smartMerge` (fusiona lo remoto con cambios locales pendientes vía `_localChanges`). **NUEVO:** listeners para clientes, fiados, pagos y salidas.
3. Escrituras con `_subirDoc`/`_eliminarDoc` (reintento automático offline). **NUEVO:** `window.syncSaveCliente/Fiado/Pago/Salida` y sus borrados.
4. Botón manual "Sincronizar": batch (máx. 450 docs por batch) que sube TODAS las colecciones, incluidas las nuevas; limpia `_localChanges` al éxito.
5. Indicadores de estado (conectado/sincronizando/offline) en sidebar y topbar.

**Validación:** con Firestore configurado, vender en el celular → aparece en la PC en <2 segundos.

**Errores esperados:**
- `permission-denied` por reglas de Firestore → alerta con instrucciones de reglas.
- Persistencia en múltiples pestañas → aviso `failed-precondition` (usar una pestaña).
- Navegador sin soporte de persistencia → aviso `unimplemented`.

---

### FASE 11 — Respaldo y restauración (extras.js)
**Objetivo:** nunca perder los datos.

**Pasos:**
1. `exportarDatos()`: JSON con productos, ventas, combos **y ahora clientes, fiados, pagos, salidas** (con versión del archivo).
2. `importarDatos()`: valida estructura (campos obligatorios), detecta IDs duplicados, muestra resumen y hace MERGE (no reemplazo).
3. Recomendación en el login: "Haz un respaldo semanal" (aviso discreto).

**Validación:** exportar → importar en otro navegador → los datos aparecen fusionados sin duplicados.

---

### FASE 12 — QR de pago y cierre de caja
**Objetivo:** cobrar por QR y cerrar el día con un resumen.

**Pasos:**
1. Gestión de QR: subir imagen de QR personal por usuario (ELI/EDWIN/JOHAN), sincronizada entre dispositivos; en POS con método QR se muestra el QR elegido.
2. Cierre de caja: total vendido, ganancia, transacciones, ticket promedio, desglose por forma de pago, imprimir.
3. **NUEVO:** en el cierre de caja se incluye "Pendiente de fiados" para que la caja real = efectivo + QR − fiados pendientes de hoy (cobros de fiados registrados en el día suman como cobrado).

**Validación:** subir QR → aparece en POS; cierre de caja muestra el desglose correcto.

---

### FASE 13 — PWA (instalable en el celular)
**Archivos:** `manifest.json`, `sw.js`, `index.html`.

**Pasos:**
1. `manifest.json`: nombre, `display: standalone`, colores, `start_url: ./index.html`.
2. `sw.js`: cachea todos los JS/CSS/HTML (incluido `gestion.js` y `lucide.min.js`); NO intercepta peticiones a `firestore.googleapis.com` ni a `firebase`; limpiar caché vieja al actualizar.
3. Banner de instalación con `beforeinstallprompt`.
4. Versionado `?v=N` en los `<script>/<link>` del index.html: al modificar un archivo, subir N para forzar refresco de caché (los iconos Lucide auto-alojados se actualizan igual).

**Validación:** instalar en Android/iOS → abrir sin internet → todo funciona (modo local).

---

### FASE 14 — Estrategia de pruebas (checklist final)
**Objetivo:** cada módulo verificado antes de usar en producción.

Checklist por ejecutar completa:
1. **Login:** aparece al iniciar; cambia de usuario en cualquier momento; las acciones quedan firmadas.
2. **Productos:** alta, edición, fusión de duplicados, foto, eliminación.
3. **Inventario:** filtros, entrada de stock, salida con motivo, exportar CSV.
4. **POS:** vender individual y combo; stock FEFO correcto; pagos efectivo/QR; venta firmada.
5. **Historial/Analíticas:** filtros por fecha y pago; CSV; gráficos; cierre de caja.
6. **Fiados:** crear cliente, fiar con varios ítems, cobrar parcial, saldar, anular fiado (restaura stock), expediente.
7. **Actividad:** cada acción con autor; filtros por tipo/usuario/fecha; CSV.
8. **Sync:** dos dispositivos conectados comparten datos en tiempo real; sin Firestore todo sigue funcionando.
9. **Backup:** exportar → importar → sin duplicados ni pérdidas.
10. **Offline/PWA:** instalar, cortar internet, operar normal, reconectar y sincronizar.
11. **Móvil:** navegación con una mano (FAB del carrito), tablas con scroll horizontal, toques precisos.

---

## 7. ERRORES: LOS QUE PUEDEN APARECER Y LOS QUE NO DEBERÍAN

### 7.1 Errores que PUEDEN aparecer (y cómo se manejan)
| # | Error | Fase | Manejo |
|---|---|---|---|
| 1 | Stock insuficiente (venta, combo, fiado, salida) | 4-8 | Pre-validación antes de mutar lotes; aviso con cantidad disponible |
| 2 | Producto duplicado | 3 | Modal de fusión (agregar como lote) |
| 3 | Backup con IDs duplicados | 11 | `checkDupes()` → rechazar importación |
| 4 | localStorage lleno | 4-6 | Fotos comprimidas ≤800 KB; monitor de cuota; respaldo periódico |
| 5 | Firebase sin configurar | 10 | Modo local completo + badge "Sin config" |
| 6 | Reglas de Firestore deniegan escritura | 10 | Alerta con instrucciones de reglas |
| 7 | Fechas legacy (string) en ventas | 5 | Normalización en cada lectura |
| 8 | Producto de combo eliminado | 7 | Combo se muestra sin stock (nombre de referencia) |
| 9 | Persistencia multi-pestaña | 10 | Aviso; usar una pestaña principal |
| 10 | Actividad creciendo sin fin | 9 | Cap de 3000 registros |
| 11 | Doble clic en "Registrar venta" | 5 | Botón deshabilitado durante el proceso |
| 12 | Salida/fiado mayor al stock | 4, 8 | Bloqueo con aviso claro |

### 7.2 Errores que NO deberían aparecer (protegidos por diseño)
| # | Situación | Protección |
|---|---|---|
| 1 | XSS por detalle con HTML | Todo dato del usuario pasa por `escHTML()` al renderizar |
| 2 | IDs duplicados en la base | `genId()` timestamp + random; validación en importación |
| 3 | Stock desincronizado entre lotes y total | `stock/vencimiento/costo` siempre derivados de lotes |
| 4 | Venta sin autor | `checkoutPOS` inyecta `usuario`; sin sesión no se permite operar |
| 5 | Pérdida de datos por importación | Siempre MERGE, nunca reemplazo |
| 6 | Caché PWA vieja tras actualizar | Versionado `?v=N` + limpieza de caché en `activate` |
| 7 | Gráficos rotos sin internet | Guard `typeof Chart === 'undefined'` |
| 8 | Navegación a sección inexistente | Guard `if (sec)` en `navegarA` |

---

## 8. DESPLIEGUE

Opción recomendada (gratis y sencilla):
1. **Firebase Hosting:** `firebase login` → `firebase init hosting` → `firebase deploy`. HTTPS automático.
2. Alternativa: cualquier hosting estático (Netlify, Vercel, GitHub Pages) subiendo la carpeta del proyecto.
3. Recordatorio: `firebase-config.js` con las claves del proyecto real; NO publicar credenciales sensibles en repos públicos.

---

## 9. MEJORAS FUTURAS (fuera de alcance por ahora)
- Escáner de código de barras / QR propio para agregar al carrito más rápido.
- Impresión de boleta/ticket de venta.
- Descuentos por ticket en POS.
- Reporte semanal/mensual por turno y por producto.
- Permisos por usuario (el futuro empleado solo vende).
- Módulo de gastos/egresos de la tienda.

---

## 10. CONCLUSIÓN

El sistema final = base existente (productos/lotes, POS FEFO, historial, analíticas, combos, vencimientos, QR, backup, sync) + **5 módulos nuevos**: sesión de usuarios, salidas sin venta, entradas de stock, fiados con expediente y registro de actividad. Todo en HTML/CSS/JS vanilla, localStorage + Firestore, pensado para un teléfono usado por máximo 4 personas, con máxima prioridad en: (1) fluidez de la caja, (2) trazabilidad de quién hizo qué, (3) robustez offline y respaldos.

**Instrucción final al ejecutante:** trabaja por fases en orden, valida cada fase antes de avanzar, y al terminar ejecuta la checklist de la Fase 14 completa. Cualquier desviación de estas invariantes (sección 5) debe tratarse como bug crítico.
