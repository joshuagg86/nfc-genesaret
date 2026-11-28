// --- CONFIGURACIÓN CENTRAL DE FIREBASE ---

const genesaretLocalTest = ['localhost','127.0.0.1'].includes(location.hostname) && location.port === '8001';
window.GenesaretLocalTest = genesaretLocalTest;
const genesaretTraining = ['genesaret-capacitacion.web.app','genesaret-capacitacion.firebaseapp.com'].includes(location.hostname);
window.GenesaretTraining = genesaretTraining;
const trainingConfig = {apiKey:'AIzaSyD7XzEbcR9p52s-B2X6kOn-aw9MAD_Tts8',authDomain:'genesaret-capacitacion.firebaseapp.com',projectId:'genesaret-capacitacion',storageBucket:'genesaret-capacitacion.firebasestorage.app',messagingSenderId:'978559622551',appId:'1:978559622551:web:f40715b7c669d6b5d238d2'};
const firebaseConfig = genesaretLocalTest ? {apiKey:'demo-local-only',authDomain:'localhost',projectId:'demo-genesaret-security',appId:'demo-local'} : genesaretTraining ? trainingConfig : {
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
    if(firebase.app().options.projectId!==firebaseConfig.projectId)throw Error('Entorno Firebase incorrecto');
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
if(genesaretTraining || !genesaretLocalTest){
 window.addEventListener('DOMContentLoaded',()=>{
  if(genesaretTraining){const badge=document.createElement('div');badge.textContent='MODO CAPACITACIÓN · SIN DATOS REALES';badge.setAttribute('role','status');badge.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#facc15;color:#422006;text-align:center;font: bold 12px/22px system-ui;pointer-events:none';document.body.append(badge);document.body.style.paddingTop='22px';}
  const title=document.getElementById('trainingModeTitle');if(title&&genesaretTraining)title.textContent='Volver a operación real';
  const login=document.getElementById('loginForm');
  if(login){const a=document.createElement('a');a.href=genesaretTraining?'https://joshuagg86.github.io/nfc-genesaret/':'https://genesaret-capacitacion.web.app/';a.textContent=genesaretTraining?'Ir a operación real':'Entrar a modo capacitación';a.style.cssText='display:block;margin:16px 0 4px;text-align:center;font-weight:700;color:inherit;text-decoration:underline';login.append(a);}
 });
}
// 3. ACTIVAR MODO OFFLINE (Persistencia)
// Esto permite que la app funcione si se va el internet y sincronice cuando vuelva.
if (!genesaretLocalTest && !genesaretTraining) db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('La persistencia falló: Múltiples pestañas abiertas.');
        } else if (err.code == 'unimplemented') {
            console.warn('El navegador no soporta persistencia offline.');
        }
    });

console.log("✅ Sistema Genesaret inicializado (Modo Offline activo)");

// --- 4. REGISTRAR PWA (Service Worker) ---
if (!genesaretLocalTest && !genesaretTraining && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('📱 App lista para instalar:', reg.scope))
            .catch((err) => console.log('❌ Error al registrar SW:', err));
    });
}
