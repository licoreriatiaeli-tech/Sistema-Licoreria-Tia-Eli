// =============================================
// CONFIGURACIÓN FIREBASE — TIA ELI LICORERIA
// =============================================
// INSTRUCCIONES:
// 1. Ve a https://console.firebase.google.com
// 2. Crea un proyecto nuevo o usa uno existente
// 3. Ve a Configuración del proyecto > Tus apps > Web
// 4. Registra la app y copia los datos aquí abajo
// 5. En Firestore: Crear base de datos > Modo de prueba
// 6. IMPORTANTE: No subas este archivo con keys reales a repos públicos
//    Usa variables de entorno o build process para inyectar config
// =============================================

// Configuración se inyecta en build time o desde variables de entorno
// window.__FIREBASE_CONFIG__ = { apiKey, authDomain, projectId, ... };
// Si no está definida, la app funciona en modo solo localStorage

const firebaseConfig = window.__FIREBASE_CONFIG__ || {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT.appspot.com",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};

// Exportar para uso global
window.firebaseConfig = firebaseConfig;
