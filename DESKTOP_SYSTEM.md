# SISTEMA DE ESCRITORIO PC — TIA ELI LICORERIA

Este documento describe la arquitectura, configuración, funcionamiento offline y empaquetado del sistema **TIA ELI LICORERIA** como programa nativo para Windows (`.exe`), manteniendo independencia total de internet y protegiendo el repositorio de GitHub.

---

## 1. Filosofía y Aislamiento del Sistema

1. **Cero impacto en la web:** El código fuente original (`app.js`, `ventas.js`, `gestion.js`, `style.css`) sigue siendo el mismo y funciona tanto en navegador como en escritorio.
2. **Cero peticiones externas para abrir:** Las librerías de Firebase y Chart.js se alojan en la carpeta local `/libs`, eliminando cualquier dependencia de CDNs de internet para cargar la interfaz.
3. **Persistencia Híbrida (Offline-First):**
   * **Modo Sin Internet:** Puedes abrir el programa, ver el stock, realizar ventas, consultar clientes y deudas. Todo se guarda inmediatamente en el almacenamiento interno de la PC (`localStorage` e `IndexedDB`).
   * **Modo Conexión:** En cuanto la PC se conecta a una red WiFi o cableada, Firebase detecta la conexión y sincroniza los cambios pendientes con la nube en segundo plano.
4. **Privacidad y Git:** Todo lo relacionado a ejecutables generados (`dist-electron/`, instaladores `.exe`, temporales) está ignorado en `.gitignore` para no subir archivos pesados ni configuraciones locales a GitHub.

---

## 2. Estructura de Archivos del Modo Escritorio

```text
SISTEMA LICORERIA/
├── libs/                           <-- Librerías locales para uso 100% offline
│   ├── firebase-app-compat.js      (Motor base de Firebase)
│   ├── firebase-firestore-compat.js(Base de datos en la nube)
│   └── chart.umd.min.js            (Gráficos del dashboard)
│
├── electron/                       <-- Módulo exclusivo de escritorio
│   ├── main.cjs                    (Proceso principal: ventana, pantalla completa, menús)
│   └── preload.cjs                 (Puente de seguridad e integración con Windows)
│
├── DESKTOP_SYSTEM.md               <-- Este archivo de referencia
├── index.html                      <-- Interfaz visual (apunta a libs locales)
└── package.json                    <-- Scripts de ejecución y configuración de compilación
```

---

## 3. Comandos de Uso

### Probar el programa en vivo (Modo Desarrollo):
```bash
npm run desktop:dev
```
* Abre la aplicación de inmediato en una ventana de Windows maximizada.
* Puedes presionar `F12` para ver la consola de depuración en caso de necesitar revisar eventos.

### Generar el instalador o ejecutable para Windows (.exe):
```bash
npm run desktop:build
```
* Compila todo el sistema y genera en la carpeta `dist-electron/`:
  * `TiaEliLicoreria Setup.exe` (Instalador estándar para cualquier PC con Windows).
  * O versión portable directa para llevar en una memoria USB.

---

## 4. Comportamiento en Windows

* **Inicio rápido:** Abre en menos de 1 segundo directamente desde los archivos locales.
* **Sin distracciones:** Se oculta la barra de menús del navegador; solo se muestra la aplicación limpia y moderna de Tía Eli.
* **Icono oficial:** Aparece con el logotipo de la licorería en la barra de tareas y en el escritorio.
* **Impresión:** Permite enviar tickets directamente al sistema de impresión de Windows.
