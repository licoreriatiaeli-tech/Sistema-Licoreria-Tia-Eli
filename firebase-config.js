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
  apiKey: "AIzaSyAiffWyKsvjYJKPIytQU1VfXgPjyve6H4c",
  authDomain: "sistema-tia-eli.firebaseapp.com",
  projectId: "sistema-tia-eli",
  storageBucket: "sistema-tia-eli.firebasestorage.app",
  messagingSenderId: "36921296081",
  appId: "1:36921296081:web:e0ca5edeadd2f15f84f1f0"
};

// Exportar para uso global
window.firebaseConfig = firebaseConfig;
