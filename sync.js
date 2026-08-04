// ═══════════════════════════════════════════════════════════════
// sync.js — Sincronización en tiempo real: Firestore + localStorage
// Arquitectura: Firestore (nube) ↔ localStorage (cache offline)
// ═══════════════════════════════════════════════════════════════

(function() {

  // ── ESTADO GLOBAL DE SINCRONIZACIÓN ──
  let _db = null;
  let _syncReady = false;
  let _listeners = [];   // Guardamos los unsubscribers de onSnapshot
  let _pendingWrites = 0;
  let _renderTimerP, _renderTimerV, _renderTimerC;
  let _localChanges = new Map(); // Track local changes by id: { data, timestamp, type }

  const COLS = {
    productos: 'inventario_tiaeli',
    ventas:    'ventas_tiaeli',
    combos:    'combos_tiaeli',
    config:    'config_tiaeli'
  };

  // ── HELPERS DE UI ──
  function setStatus(state, text) {
    const dot   = document.getElementById('syncDot');
    const txt   = document.getElementById('syncText');
    const label = document.getElementById('syncLabel');
    if (dot)   dot.className = 'sync-dot ' + state;
    if (txt)   txt.textContent = text;
    if (label) label.textContent = state === 'syncing' ? 'Sincronizando...' : 'Sincronizar';
  }

  function setSpinner(on) {
    ['syncIcon','syncIconMobile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) on ? el.classList.add('spinning') : el.classList.remove('spinning');
    });
    const btn = document.getElementById('syncBtn');
    if (btn) on ? btn.classList.add('syncing') : btn.classList.remove('syncing');
  }

  // ── INICIALIZAR FIREBASE ──
  window.initFirebase = async function() {
    try {
      const cfg = window.firebaseConfig;
      if (!cfg || !cfg.apiKey || cfg.apiKey === 'TU_API_KEY_AQUI') {
        setStatus('offline', 'Sin config');
        console.warn('[Sync] firebase-config.js no configurado.');
        return;
      }

      // Inicializar solo si no existe ya la app
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
      }

      _db = firebase.firestore();

      // Habilitar persistencia offline (caché en el navegador/celular)
      try {
        await _db.enablePersistence({ synchronizeTabs: true });
        console.log('[Sync] Persistencia offline habilitada ✅');
      } catch (err) {
        if (err.code === 'failed-precondition') {
          console.warn('[Sync] Persistencia solo en 1 tab a la vez.');
        } else if (err.code === 'unimplemented') {
          console.warn('[Sync] Este navegador no soporta persistencia offline.');
        }
      }

      _syncReady = true;
      window.db = _db;
      setStatus('online', 'Conectado ☁️');

      // Escuchar cambios en tiempo real
      _iniciarListeners();

      console.log('[Sync] Firebase listo ✅');
    } catch (e) {
      console.error('[Sync] Error inicializando Firebase:', e);
      setStatus('error', 'Error');
      alert("❌ ERROR GRAVE DE CONEXIÓN A FIREBASE:\n\n" + e.message + "\n\nRevisa que los datos en firebase-config.js estén copiados exactamente como te los dio Firebase.");
    }
  };

  // ── LISTENERS EN TIEMPO REAL (onSnapshot) ──
  // Cuando cualquier dispositivo cambia algo → se actualiza aquí automáticamente
  function _iniciarListeners() {
    if (!_db) return;

    // Limpiar listeners anteriores
    _listeners.forEach(unsub => unsub());
    _listeners = [];

    // Helper: Smart merge remote data with local pending changes
    function smartMerge(collection, remoteArray, setterFn) {
      const local = (window.productos || []); // fallback
      const merged = remoteArray.map(remoteDoc => {
        const key = `${collection}:${remoteDoc.id}`;
        const localChange = _localChanges.get(key);
        
        if (localChange && localChange.type !== 'delete') {
          // Local has newer changes - use local but keep remote timestamp if newer
          const localData = localChange.data;
          const remoteUpdated = remoteDoc.updatedAt || remoteDoc.fechaRegistro || 0;
          const localUpdated = localData.updatedAt || localData.fechaRegistro || 0;
          
          if (localUpdated >= remoteUpdated) {
            // Local is newer or same - keep local
            return localData;
          }
          // Remote is newer - merge remote but preserve local unsynced fields
          return { ...remoteDoc, ...localData, updatedAt: Math.max(remoteUpdated, localUpdated) };
        }
        return remoteDoc;
      });
      
      // Add locally created items not yet in remote
      _localChanges.forEach((change, key) => {
        if (key.startsWith(collection + ':') && change.type === 'create') {
          const exists = merged.some(d => d.id === change.data.id);
          if (!exists) merged.push(change.data);
        }
      });
      
      // Remove locally deleted items
      const filtered = merged.filter(doc => {
        const key = `${collection}:${doc.id}`;
        const localChange = _localChanges.get(key);
        return !(localChange && localChange.type === 'delete');
      });
      
      setterFn(filtered);
      localStorage.setItem(`tiaeli_${collection.replace('_tiaeli', '')}`, JSON.stringify(filtered));
    }

    // ── Productos ──
    const unsubProductos = _db.collection(COLS.productos)
      .onSnapshot({ includeMetadataChanges: false }, snap => {
        const remoto = snap.docs.map(d => d.data());
        smartMerge(COLS.productos, remoto, (merged) => {
          if (window.setProductosGlobal) window.setProductosGlobal(merged);
          else window.productos = merged;
        });
        
        if (_renderTimerP) clearTimeout(_renderTimerP);
        _renderTimerP = setTimeout(() => {
          if (typeof filterAndRender === 'function') filterAndRender();
          if (typeof renderDashboard === 'function') renderDashboard();
        }, 150);
        console.log('[Sync] Productos actualizados desde nube:', remoto.length);
      }, err => {
        console.error('[Sync] Error listener productos:', err);
        if (err.code === 'permission-denied') {
          alert("⚠️ ERROR DE FIREBASE: Tus reglas de seguridad de Firestore han expirado o deniegan el acceso.\n\nVe a tu consola de Firebase > Firestore Database > Reglas (Rules) y cambia la regla a:\nallow read, write: if true;\n\nLuego publica los cambios.");
        }
      });

    // ── Ventas ──
    const unsubVentas = _db.collection(COLS.ventas)
      .orderBy('fecha', 'desc')
      .limit(5000)
      .onSnapshot({ includeMetadataChanges: false }, snap => {
        const remoto = snap.docs.map(d => d.data());
        smartMerge(COLS.ventas, remoto, (merged) => {
          if (window.setVentasGlobal) window.setVentasGlobal(merged);
          else window.ventas = merged;
        });

        if (_renderTimerV) clearTimeout(_renderTimerV);
        _renderTimerV = setTimeout(() => {
          if (typeof renderVentasHoy === 'function') renderVentasHoy();
          if (typeof renderVentasStats === 'function') renderVentasStats();
          if (typeof renderDashboard === 'function') renderDashboard();
        }, 150);
        console.log('[Sync] Ventas actualizadas desde nube:', remoto.length);
      }, err => console.error('[Sync] Error listener ventas:', err));

    // ── Combos ──
    const unsubCombos = _db.collection(COLS.combos)
      .onSnapshot({ includeMetadataChanges: false }, snap => {
        const remoto = snap.docs.map(d => d.data());
        smartMerge(COLS.combos, remoto, (merged) => {
          if (window.setCombosGlobal) window.setCombosGlobal(merged);
          else window.combos = merged;
        });

        if (_renderTimerC) clearTimeout(_renderTimerC);
        _renderTimerC = setTimeout(() => {
          if (typeof renderCombosManager === 'function') renderCombosManager();
          if (typeof renderCombosVenta === 'function') renderCombosVenta();
        }, 150);
        console.log('[Sync] Combos actualizados desde nube:', remoto.length);
      }, err => console.error('[Sync] Error listener combos:', err));

    // ── QRs (Configuración global) ──
    const unsubConfig = _db.collection(COLS.config).doc('qrs')
      .onSnapshot({ includeMetadataChanges: false }, snap => {
        if (!snap.exists) return;
        const data = snap.data();
        if (data) {
          ['eli', 'edwin', 'johan'].forEach(name => {
            if (data[name]) {
              localStorage.setItem(`tiaeli_qr_${name}`, data[name]);
            } else {
              localStorage.removeItem(`tiaeli_qr_${name}`);
            }
          });
          if (typeof window.initQRPreviews === 'function') window.initQRPreviews();
        }
      }, err => console.error('[Sync] Error listener config:', err));

    _listeners.push(unsubProductos, unsubVentas, unsubCombos, unsubConfig);
    console.log('[Sync] Listeners en tiempo real activos ✅');
  }

  // ── ESCRIBIR EN FIRESTORE (con fallback a localStorage) ──
  async function _subirDoc(coleccion, doc) {
    if (!_db || !doc || !doc.id) return;
    try {
      await _db.collection(coleccion).doc(doc.id).set(doc, { merge: true });
    } catch (e) {
      console.warn('[Sync] No se pudo subir a Firestore (modo offline). Se guardó en localStorage.', e);
      if (e.code === 'permission-denied') {
        toast("Error de Permisos de Firebase. Revisa las 'Reglas' en la consola de Firebase.", "error");
      }
      // Firestore automáticamente reintentará cuando vuelva la conexión
    }
  }

  async function _eliminarDoc(coleccion, id) {
    if (!_db || !id) return;
    try {
      await _db.collection(coleccion).doc(id).delete();
    } catch (e) {
      console.warn('[Sync] No se pudo eliminar en Firestore (modo offline).');
    }
  }

  // ── API PÚBLICA ──

  // Track local change for conflict resolution
  function _trackLocalChange(collection, doc, type) {
    if (!doc || !doc.id) return;
    _localChanges.set(`${collection}:${doc.id}`, {
      data: JSON.parse(JSON.stringify(doc)), // deep clone
      timestamp: Date.now(),
      type: type // 'create' | 'update' | 'delete'
    });
  }

  // Guardar/actualizar un producto
  window.syncSaveProducto = function(producto) {
    if (!producto || !producto.id) return;
    _trackLocalChange(COLS.productos, producto, 'update');
    _subirDoc(COLS.productos, producto);
  };

  // Eliminar un producto
  window.syncDeleteProducto = function(id) {
    if (!id) return;
    _trackLocalChange(COLS.productos, { id }, 'delete');
    _eliminarDoc(COLS.productos, id);
  };

  // Guardar/actualizar una venta
  window.syncSaveVenta = function(venta) {
    if (!venta || !venta.id) return;
    _trackLocalChange(COLS.ventas, venta, 'update');
    _subirDoc(COLS.ventas, venta);
  };

  // Eliminar una venta
  window.syncDeleteVenta = function(id) {
    if (!id) return;
    _trackLocalChange(COLS.ventas, { id }, 'delete');
    _eliminarDoc(COLS.ventas, id);
  };

  // Guardar/actualizar un combo
  window.syncSaveCombo = function(combo) {
    if (!combo || !combo.id) return;
    _trackLocalChange(COLS.combos, combo, 'update');
    _subirDoc(COLS.combos, combo);
  };

  // Eliminar un combo
  window.syncDeleteCombo = function(id) {
    if (!id) return;
    _trackLocalChange(COLS.combos, { id }, 'delete');
    _eliminarDoc(COLS.combos, id);
  };

  // Guardar QR Global
  window.syncSaveQRsGlobal = function(qrData) {
    if (!_db) return;
    try {
      _db.collection(COLS.config).doc('qrs').set(qrData, { merge: true });
    } catch(e) {
      console.warn('[Sync] Offline QR save', e);
    }
  };

  // ── SINCRONIZACIÓN MANUAL (botón "Sincronizar") ──
  window.sincronizar = async function() {
    if (!_syncReady) {
      await window.initFirebase();
      if (!_syncReady) {
        toast('Firebase no configurado. Configura firebase-config.js', 'error');
        return;
      }
    }
    setSpinner(true);
    setStatus('syncing', 'Sincronizando...');
    try {
      // Unir todos los elementos a sincronizar
      const allItems = [];
      (window.productos || []).forEach(p => allItems.push({ col: COLS.productos, doc: { ...p, updatedAt: p.updatedAt || Date.now() } }));
      (window.ventas || []).forEach(v => allItems.push({ col: COLS.ventas, doc: { ...v, updatedAt: v.updatedAt || v.fechaRegistro || Date.now() } }));
      (window.combos || []).forEach(c => allItems.push({ col: COLS.combos, doc: { ...c, updatedAt: c.updatedAt || Date.now() } }));

      // Firestore soporta máximo 500 operaciones por batch
      const chunk = 450;
      for (let i = 0; i < allItems.length; i += chunk) {
        const batch = _db.batch();
        const slice = allItems.slice(i, i + chunk);
        slice.forEach(item => {
          batch.set(_db.collection(item.col).doc(item.doc.id), item.doc, { merge: true });
        });
        await batch.commit();
      }

      // Clear local changes tracking after successful sync
      _localChanges.clear();

      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-BO');
      setStatus('online', '☁️ Sync ' + timeStr);
      toast('✅ Sincronización completa — todos los dispositivos actualizados', 'success');
      const info = document.getElementById('headerSyncInfo');
      if (info) info.textContent = 'Última sync: ' + timeStr;
    } catch (e) {
      setStatus('error', 'Error al sync');
      toast('Error al sincronizar: ' + e.message, 'error');
    } finally {
      setSpinner(false);
    }
  };

  // Indicador online/offline del navegador
  window.addEventListener('online',  () => setStatus('online',  '☁️ Online'));
  window.addEventListener('offline', () => setStatus('offline', '📴 Sin internet'));

})();
