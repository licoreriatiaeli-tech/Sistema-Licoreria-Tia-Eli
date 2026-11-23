const { app, protocol, BrowserWindow, Menu, ipcMain, net } = require('electron');
const path = require('path');
const url = require('url');

// Registrar esquema privilegiado para tener soporte completo de localStorage, IndexedDB y ServiceWorker
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 680,
    title: 'TIA ELI LICORERIA — Sistema de Gestión',
    icon: path.join(__dirname, '../icon-512.png'),
    backgroundColor: '#09090b',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL('app://localhost/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.key === 'F5' && input.type === 'keyDown') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Manejador del protocolo local seguro app://localhost/
  protocol.handle('app', (request) => {
    const reqUrl = new URL(request.url);
    let pathname = decodeURIComponent(reqUrl.pathname);
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }
    const resolvedPath = path.join(__dirname, '..', pathname);
    return net.fetch(url.pathToFileURL(resolvedPath).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ── IPC HANDLERS PARA FUNCIONES DE ESCRITORIO ──
ipcMain.on('print-ticket', (event, options = {}) => {
  if (!mainWindow) return;
  mainWindow.webContents.print({
    silent: options.silent || false,
    printBackground: true,
    deviceName: options.printerName || ''
  }, (success, errorType) => {
    if (!success) console.warn('[Desktop Print] Error al imprimir:', errorType);
  });
});

ipcMain.on('window-action', (event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  if (action === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  if (action === 'close') mainWindow.close();
});
