// ═══════════════════════════════════════════
// services/event-bus.js — Bus de eventos centralizado
// ═══════════════════════════════════════════

/**
 * EventBus - Patrón Pub/Sub para desacoplar módulos
 * Uso:
 *   EventBus.on('productos:changed', (productos) => { ... });
 *   EventBus.emit('productos:changed', productos);
 *   EventBus.off('productos:changed', handler);
 */
class EventBus {
  constructor() {
    this._events = new Map();
    this._onceEvents = new Map();
  }

  /**
   * Suscribe a un evento
   * @param {string} event - Nombre del evento (ej: 'productos:changed')
   * @param {Function} handler - Callback
   * @returns {Function} Función para desuscribir
   */
  on(event, handler) {
    if (!this._events.has(event)) this._events.set(event, new Set());
    this._events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Suscribe una sola vez
   * @param {string} event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  /**
   * Desuscribe de un evento
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    if (this._events.has(event)) {
      this._events.get(event).delete(handler);
    }
  }

  /**
   * Emite evento a todos los suscriptores
   * @param {string} event
   * @param {...*} args - Argumentos para los handlers
   */
  emit(event, ...args) {
    if (this._events.has(event)) {
      this._events.get(event).forEach(handler => {
        try {
          handler(...args);
        } catch (e) {
          console.error(`EventBus error in "${event}":`, e);
        }
      });
    }
  }

  /**
   * Emite evento asíncrono (await Promise.all)
   * @param {string} event
   * @param {...*} args
   * @returns {Promise<void>}
   */
  async emitAsync(event, ...args) {
    if (this._events.has(event)) {
      await Promise.all(
        [...this._events.get(event)].map(handler => 
          Promise.resolve().then(() => handler(...args)).catch(e => 
            console.error(`EventBus async error in "${event}":`, e)
          )
        )
      );
    }
  }

  /**
   * Limpia todos los listeners de un evento
   * @param {string} [event] - Si no se pasa, limpia todo
   */
  clear(event) {
    if (event) {
      this._events.delete(event);
    } else {
      this._events.clear();
    }
  }

  /**
   * Obtiene count de listeners
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    return this._events.has(event) ? this._events.get(event).size : 0;
  }
}

// Instancia singleton global
window.EventBus = new EventBus();

// Eventos estándar del sistema
export const EVENTS = {
  // Productos
  PRODUCTOS_CHANGED: 'productos:changed',
  PRODUCTO_CREATED: 'producto:created',
  PRODUCTO_UPDATED: 'producto:updated',
  PRODUCTO_DELETED: 'producto:deleted',
  
  // Stock
  STOCK_CHANGED: 'stock:changed',
  ENTRADA_REGISTRADA: 'entrada:registrada',
  SALIDA_REGISTRADA: 'salida:registrada',
  LOTE_AJUSTADO: 'lote:ajustado',
  
  // Ventas
  VENTA_CREADA: 'venta:created',
  VENTA_ANULADA: 'venta:anulada',
  VENTAS_HOY_CHANGED: 'ventas-hoy:changed',
  
  // Fiados
  FIADO_CREADO: 'fiado:created',
  PAGO_REGISTRADO: 'pago:registrado',
  FIADO_COBRADO: 'fiado:cobrado',
  
  // Usuario/Sesión
  SESION_INICIADA: 'sesion:iniciada',
  SESION_CERRADA: 'sesion:cerrada',
  USUARIO_CAMBIADO: 'usuario:cambiado',
  
  // Sincronización
  SYNC_START: 'sync:start',
  SYNC_COMPLETE: 'sync:complete',
  SYNC_ERROR: 'sync:error',
  
  // UI
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
  TOAST_SHOW: 'toast:show',
  
  // Navegación
  NAVIGATE: 'navigate',
  SECTION_CHANGED: 'section:changed',
};

export default window.EventBus;