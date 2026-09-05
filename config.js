// --- CONFIGURACIÓN CENTRAL DE FIREBASE ---

const firebaseConfig = {
    apiKey: "AIzaSyC56h2z_HnfFH6h0QEqYjOFoUolNwDeJDQ",
    authDomain: "nfc-genesaret.firebaseapp.com",
    projectId: "nfc-genesaret",
    storageBucket: "nfc-genesaret.firebasestorage.app",
    messagingSenderId: "58470602922",
    appId: "1:58470602922:web:661854ac1cc6f11f8c58d3"
};

// 1. Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // Si ya existe, usar la instancia activa
}

// 2. Inicializar Servicios
const auth = firebase.auth();
const db = firebase.firestore();

// 3. ACTIVAR MODO OFFLINE (Persistencia)
// Esto permite que la app funcione si se va el internet y sincronice cuando vuelva.
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('La persistencia falló: Múltiples pestañas abiertas.');
        } else if (err.code == 'unimplemented') {
            console.warn('El navegador no soporta persistencia offline.');
        }
    });

console.log("✅ Sistema Genesaret inicializado (Modo Offline activo)");

// --- 4. REGISTRAR PWA (Service Worker) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('📱 App lista para instalar:', reg.scope))
            .catch((err) => console.log('❌ Error al registrar SW:', err));
    });
}
