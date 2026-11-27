// --- CONFIGURACIÓN CENTRAL DE FIREBASE ---

const genesaretLocalTest = ['localhost','127.0.0.1'].includes(location.hostname) && location.port === '8001';
window.GenesaretLocalTest = genesaretLocalTest;
const firebaseConfig = genesaretLocalTest ? {apiKey:'demo-local-only',authDomain:'localhost',projectId:'demo-genesaret-security',appId:'demo-local'} : {
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

if (genesaretLocalTest) {
    auth.useEmulator('http://127.0.0.1:9099');
    db.useEmulator('127.0.0.1',8080);
    window.addEventListener('DOMContentLoaded',()=>{
        const badge=document.createElement('div');
        badge.textContent='ENTORNO DE PRUEBA LOCAL · SIN DATOS REALES';
        badge.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#92400e;color:white;text-align:center;font:11px sans-serif;pointer-events:none';
        document.body.append(badge);
    });
}
// 3. ACTIVAR MODO OFFLINE (Persistencia)
// Esto permite que la app funcione si se va el internet y sincronice cuando vuelva.
if (!genesaretLocalTest) db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('La persistencia falló: Múltiples pestañas abiertas.');
        } else if (err.code == 'unimplemented') {
            console.warn('El navegador no soporta persistencia offline.');
        }
    });

console.log("✅ Sistema Genesaret inicializado (Modo Offline activo)");

// --- 4. REGISTRAR PWA (Service Worker) ---
if (!genesaretLocalTest && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('📱 App lista para instalar:', reg.scope))
            .catch((err) => console.log('❌ Error al registrar SW:', err));
    });
}
