// ═══════════════════════════════════════════
// services/storage-service.js — Capa de almacenamiento unificada
// ═══════════════════════════════════════════

const PREFIX = 'tiaeli_';

/**
 * StorageService - Abstracción sobre localStorage, IndexedDB y Firebase
 * Proporciona API consistente con soporte para:
 * - localStorage (síncrono, pequeño)
 * - IndexedDB (asíncrono, grande, offline)
 * - Firebase (remoto, sync multi-dispositivo)
 */
class StorageService {
  constructor() {
    this._memoryCache = new Map();
    this._indexedDB = null;
    this._dbName = 'TiaEliDB';
    this._dbVersion = 1;
    this._stores = ['productos', 'ventas', 'fiados', 'clientes', 'pagos', 'combos', 'entradas', 'salidas', 'actividad', 'historial_precios', 'usuarios'];
    this._initIndexedDB();
  }

  // ═══════════════════════════════════════════
  // INDEXEDDB
  // ═══════════════════════════════════════════
  
  _initIndexedDB() {
    if (!window.indexedDB) return;
    
    const request = indexedDB.open(this._dbName, this._dbVersion);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      this._stores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
    
    request.onsuccess = (event) => {
      this._indexedDB = event.target.result;
      console.log('[StorageService] IndexedDB listo');
    };
    
    request.onerror = (e) => {
      console.warn('[StorageService] IndexedDB no disponible:', e.target.error);
    };
  }

  // ═══════════════════════════════════════════
  // LOCALSTORAGE (síncrono, fallback)
  // ═══════════════════════════════════════════
  
  _lsKey(key) { return PREFIX + key; }
  
  _getLS(key) {
    try {
      const item = localStorage.getItem(this._lsKey(key));
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('[StorageService] LS get error:', key, e);
      return null;
    }
  }
  
  _setLS(key, value) {
    try {
      localStorage.setItem(this._lsKey(key), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[StorageService] LS set error:', key, e);
      return false;
    }
  }
  
  _removeLS(key) {
    localStorage.removeItem(this._lsKey(key));
  }

  // ═══════════════════════════════════════════
  // API PÚBLICA
  // ═══════════════════════════════════════════

  /**
   * Obtiene valor (primero memoria, luego localStorage)
   * @param {string} key
   * @param {*} defaultValue
   * @returns {Promise<*>}
   */
  async get(key, defaultValue = null) {
    // Cache en memoria
    if (this._memoryCache.has(key)) return this._memoryCache.get(key);
    
    // localStorage
    const value = this._getLS(key);
    if (value !== null) {
      this._memoryCache.set(key, value);
      return value;
    }
    
    // IndexedDB (async)
    if (this._indexedDB) {
      try {
        const value = await this._getIDB(key);
        if (value !== undefined) {
          this._memoryCache.set(key, value);
          return value;
        }
      } catch (e) {
        console.warn('[StorageService] IDB get error:', key, e);
      }
    }
    
    return defaultValue;
  }

  /**
   * Guarda valor (memoria + localStorage + IndexedDB)
   * @param {string} key
   * @param {*} value
   * @returns {Promise<boolean>}
   */
  async set(key, value) {
    this._memoryCache.set(key, value);
    
    // localStorage (síncrono, rápido)
    this._setLS(key, value);
    
    // IndexedDB (async, no bloquea)
    if (this._indexedDB) {
      this._setIDB(key, value).catch(e => 
        console.warn('[StorageService] IDB set error:', key, e)
      );
    }
    
    // Emitir evento
    if (window.EventBus) window.EventBus.emit('storage:changed', { key, value });
    
    return true;
  }

  /**
   * Elimina clave
   * @param {string} key
   */
  async remove(key) {
    this._memoryCache.delete(key);
    this._removeLS(key);
    
    if (this._indexedDB) {
      try {
        await this._removeIDB(key);
      } catch (e) {
        console.warn('[StorageService] IDB remove error:', key, e);
      }
    }
    
    if (window.EventBus) window.EventBus.emit('storage:removed', { key });
  }

  /**
   * Obtiene múltiples claves
   * @param {string[]} keys
   * @returns {Promise<Object>}
   */
  async getMany(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = await this.get(key);
    }
    return result;
  }

  /**
   * Guarda múltiples claves
   * @param {Object} entries
   */
  async setMany(entries) {
    await Promise.all(
      Object.entries(entries).map(([key, value]) => this.set(key, value))
    );
  }

  /**
   * Lista todas las claves del namespace
   * @returns {string[]}
   */
  keys() {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .map(k => k.slice(PREFIX.length));
  }

  /**
   * Limpia todo el namespace
   */
  async clear() {
    this._memoryCache.clear();
    this.keys().forEach(k => this._removeLS(k));
    
    if (this._indexedDB) {
      for (const storeName of this._stores) {
        await this._clearStore(storeName);
      }
    }
    
    if (window.EventBus) window.EventBus.emit('storage:cleared');
  }

  // ═══════════════════════════════════════════
  // INDEXEDDB HELPERS
  // ═══════════════════════════════════════════

  _getIDB(key) {
    return new Promise((resolve, reject) => {
      if (!this._indexedDB) return resolve(undefined);
      
      // Determinar store por prefijo de key
      const storeName = this._getStoreForKey(key);
      const transaction = this._indexedDB.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  _setIDB(key, value) {
    return new Promise((resolve, reject) => {
      if (!this._indexedDB) return resolve();
      
      const storeName = this._getStoreForKey(key);
      const transaction = this._indexedDB.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ id: key, value, updatedAt: Date.now() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  _removeIDB(key) {
    return new Promise((resolve, reject) => {
      if (!this._indexedDB) return resolve();
      
      const storeName = this._getStoreForKey(key);
      const transaction = this._indexedDB.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  _clearStore(storeName) {
    return new Promise((resolve, reject) => {
      if (!this._indexedDB) return resolve();
      
      const transaction = this._indexedDB.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  _getStoreForKey(key) {
    // Mapear keys a stores por prefijo
    if (key.startsWith('producto')) return 'productos';
    if (key.startsWith('venta')) return 'ventas';
    if (key.startsWith('fiado')) return 'fiados';
    if (key.startsWith('cliente')) return 'clientes';
    if (key.startsWith('pago')) return 'pagos';
    if (key.startsWith('combo')) return 'combos';
    if (key.startsWith('entrada')) return 'entradas';
    if (key.startsWith('salida')) return 'salidas';
    if (key.startsWith('actividad')) return 'actividad';
    if (key.startsWith('historial_precio')) return 'historial_precios';
    if (key.startsWith('usuario')) return 'usuarios';
    return 'productos'; // default
  }

  // ═══════════════════════════════════════════
  // BACKUP / RESTORE
  // ═══════════════════════════════════════════

  /**
   * Exporta todo el storage a JSON
   * @returns {Promise<Object>}
   */
  async exportAll() {
    const data = {};
    for (const key of this.keys()) {
      data[key] = await this.get(key);
    }
    return {
      version: 1,
      timestamp: Date.now(),
      checksum: this._computeChecksum(data),
      data
    };
  }

  /**
   * Importa desde backup
   * @param {Object} backup
   * @returns {Promise<boolean>}
   */
  async importAll(backup) {
    if (!backup || !backup.data) return false;
    
    // Verificar checksum
    if (backup.checksum !== this._computeChecksum(backup.data)) {
      console.error('[StorageService] Checksum inválido en backup');
      return false;
    }
    
    await this.clear();
    await this.setMany(backup.data);
    return true;
  }

  _computeChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}

// Instancia singleton
window.StorageService = new StorageService();

export default window.StorageService;