const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#1e293b',
    color: '#ffffff',
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

function showSuccess(message) {
    Toast.fire({ icon: 'success', title: message });
}

function showError(message) {
    Toast.fire({ icon: 'error', title: message });
}
// --- HELPERS BÁSICOS Y CONFIGURACIÓN ---
function toggleTheme() { 
    document.body.classList.toggle('light-mode'); 
    localStorage.setItem('themePreference', document.body.classList.contains('light-mode')?'light':'dark'); 
    updateThemeIcon(); 
}

function updateThemeIcon() { 
    const i=document.getElementById('themeIcon'); 
    if(i) { i.className = document.body.classList.contains('light-mode') ? 'fas fa-moon' : 'fas fa-sun'; } 
}

if(localStorage.getItem('themePreference')==='light') document.body.classList.add('light-mode'); 
updateThemeIcon();

function getEmptyStateHTML(icon, title, desc, btnText, btnAction) { 
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><p class="empty-desc">${desc}</p>${btnText?`<button class="btn-primary" onclick="${btnAction}" style="margin-top:10px;">${btnText}</button>`:''}</div>`; 
}

function getSkeletonTable(c,r){ 
    let h='<table class="table"><thead><tr>'; 
    for(let i=0;i<c;i++)h+='<th><div class="skeleton skeleton-text" style="width:50px"></div></th>'; 
    h+='</tr></thead><tbody>'; 
    for(let i=0;i<r;i++){h+='<tr>';for(let j=0;j<c;j++)h+='<td><div class="skeleton skeleton-text"></div></td>';h+='</tr>';} 
    return h+'</tbody></table>'; 
}

// --- SISTEMA DE NOTIFICACIONES Y SONIDO ---
function showSuccess(msg) { 
    playSound('success'); 
    const a=document.getElementById('successAlert'); 
    a.textContent=msg; a.classList.add('show'); 
    setTimeout(()=>a.classList.remove('show'),3000); 
}

function showError(msg) { 
    playSound('error'); 
    const a=document.getElementById('errorAlert'); 
    a.textContent=msg; a.classList.add('show'); 
    setTimeout(()=>a.classList.remove('show'),3000); 
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) { 
    if (audioCtx.state === 'suspended') audioCtx.resume(); 
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); 
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime); 
    osc.connect(gain); gain.connect(audioCtx.destination); 
    osc.start(); gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration); 
    osc.stop(audioCtx.currentTime + duration); 
}

function playSound(t) { 
    try { 
        if(t==='scan')playTone(800,'sine',0.1); 
        else if(t==='success'){playTone(600,'sine',0.1);setTimeout(()=>playTone(1200,'sine',0.3),100);} 
        else if(t==='error')playTone(150,'sawtooth',0.4); 
    } catch(e){} 
}

// --- AUTENTICACIÓN E INICIALIZACIÓN ---
// --- AUTENTICACIÓN E INICIALIZACIÓN ---
let currentUserId = localStorage.getItem('userId'); // Solo una vez

// 1. SEGURO ANTI-CONGELAMIENTO
setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        console.warn("⚠️ Tiempo excedido, quitando pantalla de carga...");
        overlay.classList.add('hidden');
    }
}, 5000);

// 2. LÓGICA DE INICIO DE SESIÓN
const unsubscribe = auth.onAuthStateChanged(user => {
    
    // A. Verificación: Si no es admin, ¡fuera!
    if(!user || localStorage.getItem('userRole') !== 'admin') { 
        window.location.href='index.html'; 
        return; 
    }

    // B. Configuración Visual (Nombres)
    const nombreGuardado = localStorage.getItem('userName') || 'Administrador';
    
    // Header del Admin
    const headerName = document.getElementById('adminName');
    if(headerName) headerName.textContent = nombreGuardado;
    renderizarAvatar(nombreGuardado);
    
    // Pantalla de Bienvenida
    const welcomeName = document.getElementById('userName');
    if(welcomeName) welcomeName.textContent = nombreGuardado;
    
    // Menú Móvil
    const mobileName = document.getElementById('userNameMobile');
    if(mobileName) mobileName.textContent = nombreGuardado;

    // Pantalla de Carga (Saludo)
    const loadNameEl = document.getElementById('loadingUserName');
    if(loadNameEl) loadNameEl.textContent = nombreGuardado.split(' ')[0];

    // Actualizar saludo (Buenos días/tardes)
    if(typeof actualizarSaludo === 'function') actualizarSaludo();

    // C. CARGA DE DATOS (ESTAS SON LAS FUNCIONES DE ADMIN)
    try { if(typeof cargarEventos === 'function') cargarEventos(); } catch(e) { console.error("Error eventos:", e); }
    try { if(typeof cargarPulseras === 'function') cargarPulseras(); } catch(e) { console.error("Error pulseras:", e); }
    try { if(typeof cargarCuentas === 'function') cargarCuentas(); } catch(e) { console.error("Error cuentas:", e); }
    try { if(typeof cargarCategorias === 'function') cargarCategorias(); } catch(e) { console.error("Error categorías:", e); }
    try { if(typeof actualizarEstadisticas === 'function') actualizarEstadisticas(); } catch(e) { console.error("Error stats:", e); }
    try { if(typeof cargarDashboard === 'function') cargarDashboard(); } catch(e) { console.error("Error dash:", e); }

    // D. Configurar fecha del reporte
    const inputMes = document.getElementById('filtroMesReporte');
    if (inputMes) {
        const hoy = new Date();
        const mesStr = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
        inputMes.value = mesStr;
    }

    // E. Restaurar pestaña activa
    const tab = localStorage.getItem('activeTab') || 'eventos'; 
    if(typeof switchTab === 'function') switchTab(tab);

    // F. FINALMENTE: Quitar pantalla de carga
    setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if(overlay) overlay.classList.add('hidden');
    }, 1500);
});

// --- LOGOUT SEGURO ---
function logout() {
    // Usamos SweetAlert si existe, si no, el confirm nativo
    if(typeof Swal !== 'undefined') {
        Swal.fire({
            title: '¿Cerrar Sesión?',
            text: "Tendrás que ingresar tus datos nuevamente.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#334155',
            confirmButtonText: 'Sí, salir',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                auth.signOut().then(() => window.location.href = 'index.html');
            }
        });
    } else {
        // Fallback clásico
        if(confirm("¿Seguro que quieres cerrar sesión?")) {
            auth.signOut().then(() => window.location.href = 'index.html');
        }
    }
}

function actualizarSaludo() { 
    const h = new Date().getHours(); 
    document.getElementById('welcomeGreeting').textContent = (h<12?'¡Buenos días! ☀️':(h<19?'¡Buenas tardes! 🌤️':'¡Buenas noches! 🌙')); 
}

// --- NAVEGACIÓN ---
function switchTab(tab) {
    
    // Guardar pestaña actual
    localStorage.setItem('activeTab', tab);

    // 1. Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));

    // 2. Desactivar todos los botones (Viejos y Nuevos)
    document.querySelectorAll('.tab-btn, .nav-link').forEach(e => e.classList.remove('active'));

    // 3. Mostrar el contenido seleccionado
    const content = document.getElementById(tab); // Aquí usamos 'tab' (tu variable correcta)
    if (content) content.classList.add('active');

    // 4. Activar el botón nuevo
    const btn = document.getElementById('nav-' + tab);
    if (btn) btn.classList.add('active');

    // Soporte para menú móvil
    const btnMobile = document.querySelector(`.mobile-menu-item[onclick*="'${tab}'"]`);
    if(btnMobile) btnMobile.classList.add('active');

    // --- AQUÍ ESTABA EL ERROR ---
    // Usamos 'tab' en lugar de 'tabId' y agrupamos las cargas:
    if (tab === 'reportes') {
        cargarReporteMensual();
        cargarGraficaVentas();
        cargarGraficaPopulares();
    }
}

function toggleMenu() { document.getElementById('mobileMenu').classList.toggle('active'); }
function switchTabMobile(t) { switchTab(t); toggleMenu(); }
function irAReportes() { window.location.href = './reportes.html'; }

// --- LECTOR QR ---
let html5QrcodeScanner=null; let modoEscaneo='';

function iniciarEscanerQR(modo) { 
    modoEscaneo=modo; document.getElementById('modalQR').classList.add('active'); 
    if(!html5QrcodeScanner) html5QrcodeScanner = new Html5Qrcode("qr-reader"); 
    
    html5QrcodeScanner.start({facingMode:"environment"}, {fps:10, qrbox:250}, (decodedText)=>{ 
        cerrarScannerQR(); const id = decodedText.trim().toUpperCase(); 
        if(modo==='registro') { 
            document.getElementById('pulseraId').value=id; 
            showSuccess('QR Leído: '+id); 
            verificarPulseraExistente(id); 
        } else { 
            const sel = document.getElementById('recargaPulsera'); 
            for(let i=0;i<sel.options.length;i++) { 
                if(sel.options[i].text.includes(id)) { 
                    sel.value=sel.options[i].value; 
                    mostrarSaldoActual(); 
                    break; 
                } 
            } 
        } 
    }).catch(err=>console.log(err)); 
}

function cerrarScannerQR() { 
    document.getElementById('modalQR').classList.remove('active'); 
    if(html5QrcodeScanner) html5QrcodeScanner.stop().then(()=>console.log("Stopped")); 
}

// --- GESTIÓN DE EVENTOS ---
let viendoPapelera=false;

function togglePapelera() { 
    viendoPapelera=!viendoPapelera; 
    document.getElementById('btnPapelera').textContent=viendoPapelera?'📋 Ver Activos':'🗑️ Ver Papelera'; 
    cargarEventos(); 
}

function cargarEventos() {
    const list = document.getElementById('eventsList');
    
    // 1. Mostrar Skeleton (Cargando...)
    if (list) {
        list.innerHTML = `
        <div class="skeleton" style="height: 50px; margin-bottom: 10px; border-radius: 8px;"></div>
        <div class="skeleton" style="height: 50px; margin-bottom: 10px; border-radius: 8px;"></div>
        <div class="skeleton" style="height: 50px; border-radius: 8px;"></div>
        `;
    }

    const estadoActivo = !viendoPapelera;

    // --- CORRECCIÓN: Quitamos .orderBy('createdAt') para evitar el bloqueo de índice ---
    db.collection('eventos')
        .where('activo', '==', estadoActivo)
        .onSnapshot(snap => {
            
            if (snap.empty) {
                if (viendoPapelera) {
                    list.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: var(--text-muted); border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px;">
                            <div style="font-size: 40px; margin-bottom: 15px; opacity: 0.5;">🗑️</div>
                            <h3 style="margin: 0; font-size: 16px; color: var(--text-main);">Papelera Vacía</h3>
                            <p style="font-size: 13px; margin-top: 5px;">No hay eventos eliminados.</p>
                        </div>`;
                } else {
                    list.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                            <div style="font-size: 40px; margin-bottom: 15px;">📅</div>
                            <h3>Sin Eventos</h3>
                            <p>Crea tu primer evento arriba.</p>
                        </div>`;
                }
                return;
            }

            // Convertimos a arreglo para ordenar manualmente
            let eventos = [];
            snap.forEach(d => {
                eventos.push({ id: d.id, ...d.data() });
            });

            // --- ORDENAMIENTO EN MEMORIA (JavaScript) ---
            // Ordenamos del más reciente al más antiguo
            eventos.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA; // Descendente
            });

            // Construimos la tabla
            let html = '<table class="table"><thead><tr><th>Nombre</th><th>Fecha</th><th style="text-align:right;">Acciones</th></tr></thead><tbody>';
            let sel = '<option value="">Selecciona evento</option>';

            eventos.forEach(e => {
                let f = 'S/F'; 
                try { if (e.fecha && e.fecha.toDate) f = e.fecha.toDate().toLocaleDateString('es-MX'); } catch (x) {}
                
                const nSafe = e.nombre.replace(/'/g, "\\'"); 
                const dSafe = (e.descripcion || '').replace(/'/g, "\\'");

                let btns = '';
                if (viendoPapelera) {
                    btns = `
                    <div class="action-buttons-wrapper" style="justify-content: flex-end;">
                        <button class="btn-success" onclick="restaurarEvento('${e.id}')" title="Restaurar">
                            ♻️ <span class="btn-text">Restaurar</span>
                        </button>
                    </div>`;
                    btns = `
                    <div class="action-buttons-wrapper" style="justify-content: flex-end; gap:5px;">
                        <button class="btn-success" onclick="restaurarEvento('${e.id}')">♻️ Restaurar</button>
                        <button class="btn-danger" onclick="eliminarEventoDefinitivo('${e.id}')">🔥 Eliminar</button>
                    </div>`;
                } else {
                    btns = `
                    <div class="action-buttons-wrapper" style="justify-content: flex-end;">
                        <button class="btn-primary" onclick="abrirModalEvento('${e.id}','${nSafe}','${dSafe}')">
                            ✏️ <span class="btn-text">Editar</span>
                        </button>
                        <button class="btn-danger" onclick="eliminarEvento('${e.id}')">
                            🗑️ <span class="btn-text">Borrar</span>
                        </button>
                    </div>`;
                }

                html += `<tr>
                        <td data-label="Nombre" style="font-weight:500;">${e.nombre}</td>
                        <td data-label="Fecha" style="color:var(--text-muted); font-size:0.9em;">${f}</td>
                        <td data-label="Acciones" class="actions-cell">${btns}</td>
                    </tr>`;

                if (!viendoPapelera) sel += `<option value="${e.id}">${e.nombre}</option>`;
            });

            list.innerHTML = html + '</tbody></table>';

            if (!viendoPapelera) {
                const s1 = document.getElementById('articuloEvento'); if (s1) s1.innerHTML = sel;
                const s2 = document.getElementById('filtroEventoLista'); if (s2) s2.innerHTML = sel;
                const s3 = document.getElementById('pulseraEvento'); if (s3) s3.innerHTML = sel;
            }
        }, error => {
            console.error("Error cargando eventos:", error);
            list.innerHTML = `<p style="color:red; text-align:center;">Error cargando eventos: ${error.message}</p>`;
        });
}

function crearEvento() { 
    const n=document.getElementById('eventName').value; 
    if(!n) return alert('Nombre requerido'); 
    db.collection('eventos').add({nombre:n, descripcion:document.getElementById('eventDesc').value, fecha:new Date(), activo:true, createdAt:new Date()})
    .then(()=>{ showSuccess('Evento creado'); document.getElementById('eventName').value=''; cargarEventos(); }); 
}

function eliminarEvento(id) { if(confirm('¿Archivar?')) db.collection('eventos').doc(id).update({activo:false}); }
function restaurarEvento(id) { db.collection('eventos').doc(id).update({activo:true}); }

function abrirModalEvento(id,n,d) { 
    document.getElementById('editEventoId').value=id; 
    document.getElementById('editEventoNombre').value=n; 
    document.getElementById('editEventoDesc').value=d; 
    document.getElementById('modalEditarEvento').classList.add('active'); 
}

function cerrarModalEvento() { document.getElementById('modalEditarEvento').classList.remove('active'); }

function guardarEvento() { 
    db.collection('eventos').doc(document.getElementById('editEventoId').value).update({
        nombre:document.getElementById('editEventoNombre').value, 
        descripcion:document.getElementById('editEventoDesc').value
    }).then(()=>{cerrarModalEvento(); showSuccess('Guardado');}); 
}

// --- GESTIÓN DE PULSERAS ---
let allPulseras=[];

function cargarPulseras() {
    const list = document.getElementById('pulserasList');
    if(list) list.innerHTML = getSkeletonTable(6, 5);
    
    db.collection('pulseras').onSnapshot(snap => {
        allPulseras=[]; 
        let sel='<option value="">Selecciona pulsera...</option>';
        
        snap.forEach(d => { 
            const p=d.data(); allPulseras.push({docId:d.id, ...p});
            sel += `<option value="${d.id}|${p.saldoActual}|${p.nombre}|${p.eventId}">${p.nombre} ($${p.saldoActual.toFixed(2)})</option>`;
        });
        
        renderPulseras(allPulseras);
        
        const recargaSel = document.getElementById('recargaPulsera');
        if(recargaSel) recargaSel.innerHTML=sel;
        
        cargarSelectorRecarga(); 
    });
    
    db.collection('eventos').get().then(s=>{ 
        window.eventosMap={}; 
        s.forEach(d=>window.eventosMap[d.id]=d.data().nombre); 
    });
}

// --- GESTIÓN DE PULSERAS (TABLA PAGINADA CORREGIDA) ---

let pulserasGlobales = [];
let paginaActualPulseras = 1;
const itemsPorPaginaPulseras = 10;

// Esta función se llama al dar clic en la pestaña "Lista"
function cargarPulserasTabla() {
    db.collection('pulseras').orderBy('createdAt', 'desc').onSnapshot(snap => {
        pulserasGlobales = [];
        snap.forEach(doc => {
            // CORRECCIÓN 1: Guardamos el ID real del documento como 'docId'
            // y dejamos que 'id' sea el ID del NFC que viene en doc.data()
            pulserasGlobales.push({ docId: doc.id, ...doc.data() });
        });
        renderizarTablaPulseras();
    });
}

function renderizarTablaPulseras() {
    const tbody = document.getElementById('pulserasListBody');
    const inputBusqueda = document.getElementById('buscarPulseraInput');
    const busqueda = inputBusqueda ? inputBusqueda.value.toLowerCase() : '';
    
    // 1. Filtrar
    let filtrados = pulserasGlobales.filter(p => 
        (p.nombre || '').toLowerCase().includes(busqueda) || 
        (p.id || '').toLowerCase().includes(busqueda) // p.id aquí es el NFC visible
    );

    // 2. Paginar
    const totalItems = filtrados.length;
    const totalPaginas = Math.ceil(totalItems / itemsPorPaginaPulseras) || 1;
    
    if (paginaActualPulseras > totalPaginas) paginaActualPulseras = totalPaginas;
    
    const inicio = (paginaActualPulseras - 1) * itemsPorPaginaPulseras;
    const fin = inicio + itemsPorPaginaPulseras;
    const pulserasPagina = filtrados.slice(inicio, fin);

    // 3. Renderizar HTML
    let html = '';
    
    if (pulserasPagina.length === 0) {
        html = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted); font-style: italic;">No se encontraron pulseras.</td></tr>`;
    } else {
        pulserasPagina.forEach(p => {
            // Estado (Activa/Bloqueada)
            const bloqueada = p.bloqueada === true;
            const estadoBadge = bloqueada ? 
                '<span class="badge" style="background: rgba(239,68,68,0.1); color:#ef4444; border:1px solid rgba(239,68,68,0.2);">🔒 Bloqueada</span>' : 
                '<span class="badge" style="background: rgba(34,197,94,0.1); color:#4ade80; border:1px solid rgba(34,197,94,0.2);">✅ Activa</span>';

            // --- BOTONES DE ACCIÓN (CORREGIDOS PARA USAR p.docId) ---
            
            // 1. Historial (Azul) - USA docId PARA BUSCAR EN TRANSACCIONES
            const btnHistorial = `<button onclick="verHistorial('${p.docId}', '${p.nombre}')" title="Ver Historial" class="btn-icon-action action-role"><i class="fas fa-list-alt"></i></button>`;

            // 2. Editar (Amarillo) - USA docId PARA SABER QUÉ DOCUMENTO EDITAR
            const btnEditar = `<button onclick="abrirModalEditarPulsera('${p.docId}', '${p.nombre}', '${p.id}', '${p.eventId}')" title="Editar" class="btn-icon-action action-reset"><i class="fas fa-edit"></i></button>`;

            // 3. Bloquear/Desbloquear (Gris/Rojo) - USA docId
            const btnLockIcon = bloqueada ? 'fa-unlock' : 'fa-lock';
            const btnLockTitle = bloqueada ? 'Desbloquear' : 'Bloquear';
            const btnLockClass = bloqueada ? 'action-toggle' : 'action-delete'; 
            const btnBloquear = `<button onclick="toggleBloqueoPulsera('${p.docId}', ${bloqueada})" title="${btnLockTitle}" class="btn-icon-action ${btnLockClass}"><i class="fas ${btnLockIcon}"></i></button>`;
            const nombreEvento = window.eventosMap ? (window.eventosMap[p.eventId] || 'S/F') : 'Cargando...';

            html += `
                <tr>
                    <td data-label="Evento" style="font-size:11px; color:var(--text-muted);">${nombreEvento}</td>
                    <td data-label="ID NFC" style="font-family:monospace; color:var(--text-muted); vertical-align: middle;">${p.id}</td>
                    <td data-label="Nombre" style="vertical-align: middle;">
                        <strong style="font-size:14px; color:var(--text-main);">${p.nombre}</strong>
                    </td>
                    <td data-label="Saldo" style="vertical-align: middle;">
                        <span style="font-weight:700; color:${p.saldoActual > 0 ? '#f59e0b' : '#94a3b8'}">$${p.saldoActual.toFixed(2)}</span>
                    </td>
                    <td data-label="Estado" style="vertical-align: middle;">${estadoBadge}</td>
                    <td class="actions-cell" style="vertical-align: middle; text-align: right;">
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            ${btnHistorial}
                            ${btnEditar}
                            ${btnBloquear}
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    tbody.innerHTML = html;

    // 4. Actualizar controles
    document.getElementById('infoPaginacionPulseras').textContent = `Mostrando ${pulserasPagina.length > 0 ? inicio + 1 : 0}-${Math.min(fin, totalItems)} de ${totalItems}`;
    document.getElementById('btnPrevPulseras').disabled = paginaActualPulseras === 1;
    document.getElementById('btnNextPulseras').disabled = paginaActualPulseras === totalPaginas;
}

function filtrarPulserasTabla() {
    paginaActualPulseras = 1; 
    renderizarTablaPulseras();
}

function cambiarPaginaPulseras(delta) {
    paginaActualPulseras += delta;
    renderizarTablaPulseras();
}

// --- ACCIONES DE PULSERAS ---

function toggleBloqueoPulsera(id, estaBloqueada) {
    const accion = estaBloqueada ? 'desbloquear' : 'bloquear';
    Swal.fire({
        title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} pulsera?`,
        text: estaBloqueada ? "El usuario podrá volver a comprar." : "El usuario ya no podrá realizar compras.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: estaBloqueada ? '#22c55e' : '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: `Sí, ${accion}`,
        background: '#1e293b',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('pulseras').doc(id).update({ bloqueada: !estaBloqueada })
                .then(() => showSuccess(`Pulsera ${accion}a correctamente`))
                .catch(e => showError(e.message));
        }
    });
}

function abrirModalEditarPulsera(docId, nombre, idNfc, eventoId) {
    const modal = document.getElementById('modalEditarPulsera');
    if(modal) {
        document.getElementById('editPulseraId').value = docId; // Este es el ID oculto de Firestore
        document.getElementById('editPulseraNombre').value = nombre;
        document.getElementById('editPulseraIdNfc').value = idNfc; // Este es el ID Visible (NFC)
        const combo = document.getElementById('editPulseraEvento');
        if(combo) combo.value = eventoId;
        modal.classList.add('active');
    }
}

function filtrarPulserasTabla() {
    paginaActualPulseras = 1; 
    renderizarTablaPulseras();
}

function cambiarPaginaPulseras(delta) {
    paginaActualPulseras += delta;
    renderizarTablaPulseras();
}

// --- ACCIONES DE PULSERAS ---

function toggleBloqueoPulsera(id, estaBloqueada) {
    const accion = estaBloqueada ? 'desbloquear' : 'bloquear';
    Swal.fire({
        title: `¿${accion.charAt(0).toUpperCase() + accion.slice(1)} pulsera?`,
        text: estaBloqueada ? "El usuario podrá volver a comprar." : "El usuario ya no podrá realizar compras.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: estaBloqueada ? '#22c55e' : '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: `Sí, ${accion}`,
        background: '#1e293b',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('pulseras').doc(id).update({ bloqueada: !estaBloqueada })
                .then(() => showSuccess(`Pulsera ${accion}a correctamente`))
                .catch(e => showError(e.message));
        }
    });
}

function abrirModalEditarPulsera(docId, nombre, idNfc, eventoId) {
    const modal = document.getElementById('modalEditarPulsera');
    if(modal) {
        document.getElementById('editPulseraId').value = docId;
        document.getElementById('editPulseraNombre').value = nombre;
        document.getElementById('editPulseraIdNfc').value = idNfc; 
        const combo = document.getElementById('editPulseraEvento');
        if(combo) combo.value = eventoId;
        modal.classList.add('active');
    }
}

function registrarPulsera() {
    const ev = document.getElementById('pulseraEvento').value; 
    const id = document.getElementById('pulseraId').value; 
    const nom = document.getElementById('pulseraNombre').value; 
    const salInput = document.getElementById('pulseraSaldo').value;
    const sal = parseFloat(salInput) || 0; // Si está vacío, es 0
    
    if(!ev || !id || !nom) return showError('Faltan datos obligatorios (Evento, ID o Nombre)');
    
    // 1. Guardamos la pulsera
    db.collection('pulseras').add({
        eventId: ev, 
        id: id, // ID visible (NFC)
        nombre: nom, 
        saldoInicial: sal, 
        saldoActual: sal, 
        activo: true, 
        bloqueada: false,
        createdAt: new Date()
    }).then((docRef) => { 
        
        // 2. ¡NUEVO! Guardamos el movimiento en el Historial automáticamente
        db.collection('recargas').add({
            pulseraId: docRef.id,       // ID interno de Firestore
            pulseraNombre: nom,
            monto: sal,
            saldoAnterior: 0,           // Al nacer, antes tenía 0
            saldoNuevo: sal,            // Ahora tiene el saldo inicial
            fecha: new Date(),
            motivo: 'Registro Inicial / Creación',
            eventId: ev,                // Guardamos el evento para que salga en la tabla
            realizadoPor: localStorage.getItem('userName') || 'Admin'
        });

        showSuccess('✅ Pulsera registrada y añadida al historial'); 
        
        // Limpiar campos
        document.getElementById('pulseraId').value = ''; 
        document.getElementById('pulseraNombre').value = '';
        document.getElementById('pulseraSaldo').value = '';
        
        // Actualizar tabla si estamos viéndola
        if(typeof cargarPulserasTabla === 'function') cargarPulserasTabla();

    }).catch(e => showError('Error al registrar: ' + e.message));
}

function cargarSelectorRecarga() {
    let sim='<option value="">Selecciona...</option>';
    allPulseras.forEach(p=>sim+=`<option value="${p.docId}|${p.nombre}|${p.saldoActual}">${p.nombre}</option>`);
    const simSel = document.getElementById('simPulsera'); 
    if(simSel) simSel.innerHTML=sim;
}

// --- 3. RECARGA CON TICKET VIRTUAL ---
function recargarSaldo() {
    const val = document.getElementById('recargaPulsera').value; 
    const montoStr = document.getElementById('montoRecarga').value;
    const motivo = document.getElementById('motivoRecarga').value;
    
    if(!val || !montoStr) return Swal.fire('Error', 'Selecciona pulsera y monto', 'error');
    
    const monto = parseFloat(montoStr);
    
    // --- CAMBIO 1: Leemos el 4to valor (eventId) ---
    // Nota: Esto asume que ya actualizaste cargarPulseras para incluir el ID al final
    const [pid, saldoAnteriorStr, nom, eventId] = val.split('|');
    
    const saldoAnterior = parseFloat(saldoAnteriorStr);
    const saldoNuevo = saldoAnterior + monto;
    
    const fecha = new Date();

    db.collection('pulseras').doc(pid).update({
        saldoActual: saldoNuevo, 
        // Opcional: Si quieres llevar registro de cuánto se ha metido en total históricamente:
        saldoInicial: firebase.firestore.FieldValue.increment(monto) 
    }).then(() => {
        
        // --- CAMBIO 2: Guardar en historial CON EL EVENTO ---
        db.collection('recargas').add({
            pulseraId: pid, 
            pulseraNombre: nom, 
            monto: monto, 
            saldoAnterior: saldoAnterior, 
            saldoNuevo: saldoNuevo, 
            fecha: fecha, 
            motivo: motivo || 'Recarga de Saldo', // Texto por defecto si está vacío
            eventId: eventId, // <--- ESTO ES LO QUE FALTABA
            realizadoPor: localStorage.getItem('userName') || 'Admin'
        });

        // GENERAR HTML DEL TICKET
        const ticketHTML = `
            <div class="ticket-container">
                <div class="ticket-header">
                    <strong>GENESARET EVENTOS</strong><br>
                    <small>${fecha.toLocaleString()}</small>
                </div>
                <div class="ticket-row"><span>Cliente:</span> <span>${nom}</span></div>
                <div class="ticket-row"><span>Saldo Ant:</span> <span>$${saldoAnterior.toFixed(2)}</span></div>
                <div class="ticket-row"><span>Recarga:</span> <span>$${monto.toFixed(2)}</span></div>
                <div class="ticket-total">
                    TOTAL: $${saldoNuevo.toFixed(2)}
                </div>
                <div style="text-align:center; margin-top:10px; font-size:12px;">
                    ¡Gracias por tu recarga! 🥳
                </div>
            </div>
        `;

        // MOSTRAR TICKET CON SWEETALERT
        Swal.fire({
            title: '¡Recarga Exitosa!',
            html: ticketHTML,
            icon: null, 
            confirmButtonText: 'Cerrar Ticket',
            confirmButtonColor: '#22c55e',
            background: '#1e293b',
            color: '#fff'
        });

        // Limpiar formulario
        document.getElementById('montoRecarga').value = ''; 
        document.getElementById('motivoRecarga').value = '';
        document.getElementById('infoSaldoActual').style.display = 'none';
        
        // Recargar selector para actualizar saldo visible en la lista
        if(typeof cargarSelectorRecarga === 'function') {
            cargarSelectorRecarga(); 
        } else {
            // Fallback si usas cargarPulseras
            cargarPulseras();
        }
    }).catch(error => {
        console.error("Error en recarga: ", error);
        Swal.fire('Error', 'No se pudo realizar la recarga', 'error');
    });
}

function verHistorialPulsera(pid, nom) {
    document.getElementById('historialPulseraNombre').textContent=nom;
    document.getElementById('modalHistorialPulsera').classList.add('active');
    
    db.collection('transacciones').where('pulseraId','==',pid).get().then(snap=>{
        let h='<table class="table"><thead><tr><th>Fecha</th><th>Item</th><th>$$</th><th>Acción</th></tr></thead><tbody>';
        if(snap.empty) h='<p style="text-align:center;padding:20px;">Sin movimientos</p>';
        else {
            let movimientos = [];
            snap.forEach(d => movimientos.push({ id: d.id, ...d.data() }));
            movimientos.sort((a,b) => (b.fecha?.toDate?b.fecha.toDate():new Date(0)) - (a.fecha?.toDate?a.fecha.toDate():new Date(0)));
            
            movimientos.forEach(t => {
                let f='-'; if(t.fecha?.toDate) f=t.fecha.toDate().toLocaleDateString();
                h+=`<tr><td>${f}</td><td>${t.articulo}</td><td>$${t.monto}</td><td><button class="btn-warning" onclick="anularTransaccion('${t.id}',${t.monto},'${pid}')" style="font-size:10px;">Anular</button></td></tr>`;
            });
        }
        document.getElementById('historialPulseraLista').innerHTML=h+'</tbody></table>';
    });
}

function anularTransaccion(tid,m,pid) { 
    if(confirm('¿Anular compra y devolver dinero?')) { 
        db.collection('pulseras').doc(pid).update({
            saldoActual: firebase.firestore.FieldValue.increment(m)
        })
        .then(()=>db.collection('transacciones').doc(tid).delete())
        .then(()=>{ 
            db.collection('anulaciones').add({transaccionId:tid, monto:m, fecha:new Date(), usuario:'Admin'});
            showSuccess('Anulado'); 
            document.getElementById('modalHistorialPulsera').classList.remove('active'); 
        }); 
    } 
}

function toggleBloqueo(pid, estado) {
    if(confirm(estado ? '¿Bloquear pulsera?' : '¿Desbloquear?')) {
        db.collection('pulseras').doc(pid).update({bloqueada: estado}).then(()=>showSuccess('Estado actualizado'));
    }
}

function abrirModalPulsera(did,id,nom,evId) { 
    document.getElementById('editPulseraId').value=did; 
    document.getElementById('editPulseraIdNfc').value=id; 
    document.getElementById('editPulseraNombre').value=nom; 
    
    db.collection('eventos').get().then(snap => {
        let h = '<option value="">Sin evento</option>';
        snap.forEach(d => h += `<option value="${d.id}">${d.data().nombre}</option>`);
        document.getElementById('editPulseraEvento').innerHTML = h;
    });

    document.getElementById('modalEditarPulsera').classList.add('active'); 
}

function cerrarModalPulsera() { document.getElementById('modalEditarPulsera').classList.remove('active'); }

function guardarPulsera() { 
    db.collection('pulseras').doc(document.getElementById('editPulseraId').value).update({
        id:document.getElementById('editPulseraIdNfc').value, 
        nombre:document.getElementById('editPulseraNombre').value, 
        eventId:document.getElementById('editPulseraEvento').value
    }).then(()=>{cerrarModalPulsera(); showSuccess('Guardado');}); 
}

function mostrarSaldoActual() { 
    const v=document.getElementById('recargaPulsera').value; 
    if(v) { 
        document.getElementById('infoSaldoActual').style.display='block'; 
        document.getElementById('saldoActualRecarga').textContent=v.split('|')[1]; 
    } 
}

function filtroPulseras(m,b) { 
    document.querySelectorAll('.sub-tab-btn').forEach(bb=>bb.classList.remove('active')); b.classList.add('active'); 
    document.querySelectorAll('.puls-section').forEach(s=>s.style.display='none'); document.getElementById('puls-'+m).style.display='block'; 
    if(m==='lista') cargarPulserasTabla();
    if(m==='historial') cargarHistorialRecargas();
}

let unsubRecargas = null;
let unsubTransacciones = null;

function cargarHistorialRecargas() {
    const container = document.getElementById('historialRecargas');
    container.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fas fa-spinner fa-spin"></i> Cargando movimientos...</div>';
    
    let movimientosRecargas = [];
    let movimientosCompras = [];

    // Función interna para mezclar y pintar
    const renderizarFusion = () => {
        // 1. Unificar las dos listas
        const todos = [...movimientosRecargas, ...movimientosCompras];
        
        // 2. Ordenar por fecha (Del más nuevo al más viejo)
        todos.sort((a, b) => b.fecha - a.fecha);
        
        // 3. Tomar los últimos 50 movimientos
        const items = todos.slice(0, 50);
        
        if (items.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Sin movimientos registrados</div>';
            return;
        }

        let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Evento</th>
                    <th>Usuario</th>
                    <th>Movimiento</th>
                    <th>Detalle</th>
                </tr>
            </thead>
            <tbody>`;
            
        items.forEach(item => {
            const fecha = item.fecha.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            // Buscamos el nombre del evento en el mapa global (si existe)
            const evento = (window.eventosMap && item.eventId) ? (window.eventosMap[item.eventId] || '-') : '-';
            
            // Estilos dinámicos según tipo (Ingreso vs Gasto)
            const esIngreso = item.tipo === 'ingreso';
            const colorMonto = esIngreso ? '#22c55e' : '#ef4444'; // Verde o Rojo
            const signo = esIngreso ? '+' : '-';
            
            // Badges (Etiquetas)
            let badge = '';
            if(item.etiqueta === 'Recarga') badge = '<span class="badge" style="background:rgba(34,197,94,0.1); color:#22c55e;">💰 Recarga</span>';
            else if(item.etiqueta === 'Creación') badge = '<span class="badge" style="background:rgba(245,158,11,0.1); color:#f59e0b;">✨ Creación</span>';
            else badge = '<span class="badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">🛒 Compra</span>';

            html += `
            <tr>
                <td style="font-size:11px; color:var(--text-muted);">${fecha}</td>
                <td style="font-size:11px;">${evento}</td>
                <td><strong>${item.nombre}</strong></td>
                <td style="color:${colorMonto}; font-weight:bold;">
                    ${signo}$${item.monto.toFixed(2)}
                </td>
                <td style="font-size:12px; color:var(--text-muted);">
                    ${badge} <span style="margin-left:5px;">${item.detalle}</span>
                </td>
            </tr>`;
        });
        
        container.innerHTML = html + '</tbody></table>';
    };

    // --- LISTENER 1: RECARGAS (Ingresos) ---
    if(unsubRecargas) unsubRecargas();
    unsubRecargas = db.collection('recargas').orderBy('fecha','desc').limit(30).onSnapshot(snap => {
        movimientosRecargas = snap.docs.map(d => {
            const dat = d.data();
            const esCreacion = dat.motivo && dat.motivo.includes('Creación');
            return {
                fecha: dat.fecha ? dat.fecha.toDate() : new Date(0),
                nombre: dat.pulseraNombre || 'Desconocido',
                monto: parseFloat(dat.monto) || 0,
                tipo: 'ingreso',
                etiqueta: esCreacion ? 'Creación' : 'Recarga',
                detalle: dat.motivo || 'Recarga de saldo',
                eventId: dat.eventId
            };
        });
        renderizarFusion();
    });

    // --- LISTENER 2: TRANSACCIONES (Compras/Gastos) ---
    if(unsubTransacciones) unsubTransacciones();
    unsubTransacciones = db.collection('transacciones').orderBy('fecha','desc').limit(30).onSnapshot(snap => {
        movimientosCompras = snap.docs.map(d => {
            const dat = d.data();
            return {
                fecha: dat.fecha ? dat.fecha.toDate() : new Date(0),
                nombre: dat.pulsera || 'Cliente', // En ventas se guarda como 'pulsera'
                monto: parseFloat(dat.monto) || 0,
                tipo: 'egreso',
                etiqueta: 'Compra',
                detalle: dat.articulo || 'Varios',
                eventId: dat.eventId
            };
        });
        renderizarFusion();
    });
}

// --- GESTIÓN DE ARTÍCULOS (TABLA PRO) ---

let articulosGlobales = [];
let paginaActualArticulos = 1;
const itemsPorPaginaArticulos = 10;

// Se llama al entrar a la pestaña "Lista" o cambiar el evento
function cargarArticulosTabla() {
    const eventId = document.getElementById('filtroEventoLista').value;
    if (!eventId) return; // Esperar a que se cargue el select

    db.collection('articulos').where('eventId', '==', eventId).onSnapshot(snap => {
        articulosGlobales = [];
        const categoriasSet = new Set(['Todas']);

        snap.forEach(doc => {
            const data = doc.data();
            articulosGlobales.push({ id: doc.id, ...data });
            if (data.categoria) categoriasSet.add(data.categoria);
        });

        // Actualizar combo de categorías dinámicamente
        const selectCat = document.getElementById('filtroCategoriaLista');
        const catActual = selectCat.value;
        let catHtml = '';
        Array.from(categoriasSet).sort().forEach(c => {
            catHtml += `<option value="${c}">${c}</option>`;
        });
        selectCat.innerHTML = catHtml;
        selectCat.value = categoriasSet.has(catActual) ? catActual : 'Todas';

        renderizarTablaArticulos();
    });
}

function renderizarTablaArticulos() {
    const tbody = document.getElementById('articulosListBody');
    const busqueda = document.getElementById('buscarArticuloInput').value.toLowerCase();
    const categoriaFiltro = document.getElementById('filtroCategoriaLista').value;
    
    // 1. Filtrar
    let filtrados = articulosGlobales.filter(a => {
        const matchTexto = (a.nombre || '').toLowerCase().includes(busqueda);
        const matchCat = categoriaFiltro === 'Todas' || a.categoria === categoriaFiltro;
        return matchTexto && matchCat;
    });

    // 2. Ordenar alfabéticamente
    filtrados.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    // 3. Paginar
    const totalItems = filtrados.length;
    const totalPaginas = Math.ceil(totalItems / itemsPorPaginaArticulos) || 1;
    
    if (paginaActualArticulos > totalPaginas) paginaActualArticulos = totalPaginas;
    
    const inicio = (paginaActualArticulos - 1) * itemsPorPaginaArticulos;
    const fin = inicio + itemsPorPaginaArticulos;
    const itemsPagina = filtrados.slice(inicio, fin);

    // 4. Renderizar HTML
    let html = '';
    
    if (itemsPagina.length === 0) {
        html = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted); font-style: italic;">No se encontraron artículos.</td></tr>`;
    } else {
        itemsPagina.forEach(a => {
            // Analizar Stock
            let stockBadge = '';
            if (a.esInfinito) {
                stockBadge = '<span class="badge" style="background:rgba(59,130,246,0.1); color:#60a5fa;">♾️ Infinito</span>';
            } else {
                const stock = a.stock || 0;
                if (stock <= 0) stockBadge = '<span class="badge" style="background:rgba(239,68,68,0.1); color:#ef4444;">Agotado</span>';
                else if (stock < 10) stockBadge = `<span class="badge" style="background:rgba(245,158,11,0.1); color:#f59e0b;">⚠️ Bajo (${stock})</span>`;
                else stockBadge = `<span class="badge" style="background:rgba(34,197,94,0.1); color:#4ade80;">${stock} un.</span>`;
            }

            // Emoji y Nombre
            const emoji = a.categoria ? (a.categoria.split(' ')[0] || '📦') : '📦'; // Intenta sacar emoji de la categoría

            // Botones
            const btnEditar = `<button onclick="abrirModalEditarArticulo('${a.id}')" title="Editar" class="btn-icon-action action-role"><i class="fas fa-edit"></i></button>`;
            const btnBorrar = `<button onclick="borrarArticulo('${a.id}', '${a.nombre}')" title="Eliminar" class="btn-icon-action action-delete"><i class="fas fa-trash-alt"></i></button>`;

            html += `
                <tr>
                    <td data-label="Producto" style="vertical-align: middle;">
                        <strong style="font-size:14px; color:var(--text-main);">${a.nombre}</strong>
                    </td>
                    <td data-label="Categoría" style="vertical-align: middle; color:var(--text-muted);">
                        ${a.categoria || 'General'}
                    </td>
                    <td data-label="Precio" style="vertical-align: middle;">
                        <span style="font-weight:700; color:#f59e0b;">$${(parseFloat(a.precio) || 0).toFixed(2)}</span>
                    </td>
                    <td data-label="Stock" style="vertical-align: middle;">${stockBadge}</td>
                    <td class="actions-cell" style="vertical-align: middle; text-align: right;">
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            ${btnEditar}
                            ${btnBorrar}
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    tbody.innerHTML = html;

    // 5. Actualizar controles
    document.getElementById('infoPaginacionArticulos').textContent = `Mostrando ${itemsPagina.length > 0 ? inicio + 1 : 0}-${Math.min(fin, totalItems)} de ${totalItems}`;
    document.getElementById('btnPrevArticulos').disabled = paginaActualArticulos === 1;
    document.getElementById('btnNextArticulos').disabled = paginaActualArticulos === totalPaginas;
}

function filtrarArticulosTabla() {
    paginaActualArticulos = 1;
    renderizarTablaArticulos();
}

function cambiarPaginaArticulos(delta) {
    paginaActualArticulos += delta;
    renderizarTablaArticulos();
}

// --- ABRIR MODAL DE EDICIÓN / REABASTECER (VERSIÓN FINAL COMPLETA) ---

function abrirModalEditarArticulo(id) {
    const articulo = articulosGlobales.find(a => a.id === id);
    if (!articulo) return;

    // 1. CARGAR CATEGORÍAS (Esta es la parte que faltaba)
    const selectCat = document.getElementById('editArticuloCategoria');
    
    if (selectCat) {
        let opcionesHTML = '<option value="">Selecciona...</option>';
        
        // Usamos las categorías que ya cargó el sistema (variable global 'todasLasCategorias')
        if (typeof todasLasCategorias !== 'undefined' && todasLasCategorias.length > 0) {
            todasLasCategorias.forEach(cat => {
                // El valor debe ser "Emoji + Espacio + Nombre" para que coincida
                const valor = `${cat.emoji} ${cat.nombre}`;
                opcionesHTML += `<option value="${valor}">${valor}</option>`;
            });
        } else {
            // Respaldo básico por si acaso
            opcionesHTML += '<option value="🍔 Comida">🍔 Comida</option>';
            opcionesHTML += '<option value="🥤 Bebidas">🥤 Bebidas</option>';
        }

        // TRUCO: Si el artículo tiene una categoría vieja o borrada, la agregamos para que no se pierda
        const catActual = articulo.categoria || "";
        if (catActual && !opcionesHTML.includes(`"${catActual}"`)) {
             opcionesHTML += `<option value="${catActual}">${catActual} (Categoría actual)</option>`;
        }
        
        selectCat.innerHTML = opcionesHTML;
        selectCat.value = catActual; // ¡Aquí seleccionamos la categoría correcta!
    }

    // 2. LLENAR DATOS BÁSICOS
    document.getElementById('editArticuloId').value = id;
    
    const inputNombre = document.getElementById('artNombre');
    if(inputNombre) inputNombre.value = articulo.nombre;
    
    const inputPrecio = document.getElementById('articuloPrice'); 
    if(inputPrecio) inputPrecio.value = articulo.precio ? articulo.precio : '';

    // 3. LÓGICA DE STOCK (CORREGIDA PARA EVITAR BLOQUEO)
    const stockActual = articulo.stock || 0;
    
    // Campo "Stock Actual"
    const inputActual = document.getElementById('artStockActual');
    if(inputActual) {
        inputActual.value = articulo.esInfinito ? "∞" : stockActual;
    }

    // Campo "Sumar" (Siempre empieza vacío y limpio)
    const inputSumar = document.getElementById('artStockSumar');
    if(inputSumar) {
        inputSumar.value = ''; 
        inputSumar.disabled = false; // <--- IMPORTANTE: Forzamos desbloqueo inicial
    }

    // Checkbox Infinito
    const checkInf = document.getElementById('artInfinito');
    if(checkInf) {
        checkInf.checked = articulo.esInfinito === true;
        
        // Ejecutamos la función INMEDIATAMENTE para aplicar el estado correcto
        toggleStockInput();
    }

    // 4. MOSTRAR MODAL
    document.getElementById('modalArticulo').classList.add('active');
    const titulo = document.getElementById('tituloModalArticulo');
    if(titulo) titulo.textContent = '✏️ Editar / Reabastecer';
    
    // Truco extra: Poner el cursor automáticamente en "Sumar Cantidad" si no es infinito
    if (!articulo.esInfinito && inputSumar) {
        setTimeout(() => inputSumar.focus(), 100);
    }
}

function borrarArticulo(id, nombre) {
    Swal.fire({
        title: '¿Eliminar producto?',
        text: `Se borrará "${nombre}" del inventario.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, eliminar',
        background: '#1e293b', color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('articulos').doc(id).delete()
                .then(() => showSuccess('Artículo eliminado'))
                .catch(e => showError(e.message));
        }
    });
}

function delArt(id) { if(confirm('¿Borrar?')) db.collection('articulos').doc(id).delete(); }
function eliminarArticulo(id) { delArt(id); }

function abrirModalArticulo(id,n,p,c,s,inf) {
    document.getElementById('editArticuloId').value=id; 
    document.getElementById('artNombre').value=n; 
    document.getElementById('artPrecio').value=p; 
    document.getElementById('editArticuloCategoria').value=c;
    document.getElementById('artInfinito').checked=(inf==='true'||inf===true); 
    document.getElementById('artStock').value=s; 
    toggleStockInput();
    document.getElementById('modalArticulo').classList.add('active');
}

function cerrarModalArticulo() { document.getElementById('modalArticulo').classList.remove('active'); }

// --- GUARDAR ARTÍCULO + REGISTRO EN BITÁCORA ---
function guardarArticuloFinal() {
    const id = document.getElementById('editArticuloId').value; 
    const nombre = document.getElementById('artNombre').value; 
    const inf = document.getElementById('artInfinito').checked;
    
    // Obtener valores
    const stockActual = parseInt(document.getElementById('artStockActual').value) || 0;
    const stockSumar = parseInt(document.getElementById('artStockSumar').value) || 0;
    
    const nuevoStockTotal = stockActual + stockSumar;

    // --- VALIDACIÓN NUEVA: NO PERMITIR STOCK NEGATIVO ---
    if (!inf && nuevoStockTotal < 0) {
        return showError(`❌ No puedes restar tanto. El stock quedaría en ${nuevoStockTotal}.`);
    }

    db.collection('articulos').doc(id).update({
        nombre: nombre, 
        precio: parseFloat(document.getElementById('articuloPrice').value),
        categoria: document.getElementById('editArticuloCategoria').value, 
        esInfinito: inf, 
        stock: inf ? 99999 : nuevoStockTotal
    }).then(() => {
        // ... (resto del código de bitácora igual que tenías) ...
        if (stockSumar !== 0 && !inf) {
            const tipo = stockSumar > 0 ? 'entrada' : 'salida/ajuste'; // Detectamos tipo
            db.collection('bitacora_stock').add({
                fecha: new Date(),
                articulo: nombre,
                cantidad: stockSumar,
                stockFinal: nuevoStockTotal,
                usuario: localStorage.getItem('userName') || 'Admin',
                tipo: tipo
            });
        }
        cerrarModalArticulo(); 
        showSuccess('Stock actualizado correctamente');
    }).catch(e => showError(e.message));
}

function toggleNewStockInput() { 
    const c=document.getElementById('newArtInfinito'); 
    document.getElementById('newArtStock').disabled=c.checked; 
    if(c.checked)document.getElementById('newArtStock').value=''; 
}

// --- CONTROLAR SI EL STOCK ES INFINITO O NO ---
function toggleStockInput() { 
    const checkInf = document.getElementById('artInfinito'); 
    const inputSumar = document.getElementById('artStockSumar');
    const inputActual = document.getElementById('artStockActual');
    
    // Si la casilla "Infinito" está marcada...
    if (checkInf.checked) {
        // Bloqueamos los campos
        if(inputSumar) {
            inputSumar.disabled = true;
            inputSumar.placeholder = "Infinito";
            inputSumar.value = "";
        }
        if(inputActual) inputActual.value = "∞";
    } else {
        // Si NO es infinito, DESBLOQUEAMOS para que puedas escribir
        if(inputSumar) {
            inputSumar.disabled = false;
            inputSumar.placeholder = "Cantidad a sumar";
        }
        // (El stock actual se rellena en abrirModal, aquí no lo tocamos)
    }
}

function filtroArticulos(m, b) {
    // 1. Cambiar estilos de botones (Visual)
    document.querySelectorAll('.sub-tab-btn').forEach(bb => bb.classList.remove('active')); 
    if(b) b.classList.add('active');

    // 2. Ocultar secciones y mostrar la elegida (Visual)
    document.querySelectorAll('.art-section').forEach(s => s.style.display = 'none'); 
    document.getElementById('sec-' + m).style.display = 'block';

    // 3. LÓGICA NUEVA: Cargar tabla si elegimos "lista"
    if (m === 'lista') {
        cargarArticulosTabla(); // <--- ESTO ES LO QUE FALTABA
    }

    if (m === 'bitacora') {
        cargarBitacora();
    }
}

function sincronizarEventos(v) { 
    const sa = document.getElementById('articuloEvento'); if(sa && sa.value!==v) sa.value=v;
    const sl = document.getElementById('filtroEventoLista'); if(sl && sl.value!==v) sl.value=v;
}

// --- GESTIÓN DE CATEGORÍAS & EMOJIS ---
const emojis=["🍔","🍕","🌭","🌮","🥤","☕","🍰","🍿","🎮","🎁","👕","🎟️","⛪","✝️","🕊️","📖"];

function inicializarEmojiPicker(idGrid, idInput, idDisplay, idBtn) {
    const grid = document.getElementById(idGrid); if(!grid) return; grid.innerHTML = '';
    emojis.forEach(e => {
        const b = document.createElement('button'); b.className = 'emoji-option-btn'; b.textContent = e;
        b.onclick = (ev) => { 
            ev.preventDefault(); 
            document.getElementById(idInput).value=e; 
            if(idDisplay) document.getElementById(idDisplay).textContent=e; 
            grid.classList.remove('active'); 
        };
        grid.appendChild(b);
    });
}

function toggleEmojiPicker() { 
    const p=document.getElementById('emojiGridPanel'); 
    if(!p.innerHTML) inicializarEmojiPicker('emojiGridPanel','nuevaCategoriaEmoji','emojiDisplay','btnEmojiTrigger');
    p.classList.toggle('active'); 
}

function toggleEmojiPickerEdit() { 
    const p=document.getElementById('emojiGridPanelEdit'); 
    if(!p.innerHTML) inicializarEmojiPicker('emojiGridPanelEdit','editCategoriaEmoji','emojiDisplayEdit','btnEmojiTriggerEdit');
    p.classList.toggle('active'); 
}

let todasLasCategorias = [];

function cargarCategorias() {
    db.collection('categorias').onSnapshot(s=>{
        todasLasCategorias=[]; 
        const c=document.getElementById('gridCategorias'); 
        if(c) c.innerHTML='';
        
        let fil='<option value="">Todas</option>';
        
        s.forEach(d=>{ 
            const cat=d.data(); todasLasCategorias.push({id:d.id,...cat});
            
            if(c) {
                const div=document.createElement('div'); div.className='cat-option'; 
                div.innerHTML=`<span class="cat-emoji">${cat.emoji}</span><span class="cat-name">${cat.nombre}</span>`; 
                
                div.onclick=()=>{
                    document.querySelectorAll('.cat-option').forEach(x=>x.classList.remove('selected')); 
                    div.classList.add('selected'); 
                    
                    // <--- CORRECCIÓN IMPORTANTE: Guardamos Emoji + Espacio + Nombre
                    const valorCompleto = `${cat.emoji} ${cat.nombre}`;
                    document.getElementById('articuloCategoria').value = valorCompleto;
                }; 
                c.appendChild(div);
            }
            fil+=`<option value="${cat.emoji} ${cat.nombre}">${cat.emoji} ${cat.nombre}</option>`;
        });
        
        const sel=document.getElementById('filtroCategoria'); 
        if(sel) sel.innerHTML=fil;
        
        renderizarListaCategorias();
    });
}

function renderizarListaCategorias() {
    const cont = document.getElementById('listaCategorias'); 
    if(!cont) return;
    
    let h = '';
    
    todasLasCategorias.forEach(c => {
        h += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(255,255,255,0.03); margin-bottom: 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
            
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 24px;">${c.emoji}</span>
                <span style="font-size: 14px; font-weight: 600; color: var(--text-main);">${c.nombre}</span>
            </div>

            <div style="display: flex; gap: 10px;">
                
                <button class="btn-primary" onclick="abrirModalEditarCategoria('${c.id}','${c.emoji}','${c.nombre}')" 
                    style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 13px;">
                    <i class="fas fa-pencil-alt"></i> 
                    <span>Editar</span>
                </button>

                <button class="btn-danger" onclick="eliminarCategoria('${c.id}')" 
                    style="display: flex; align-items: center; gap: 8px; padding: 8px 16px; font-size: 13px;">
                    <i class="fas fa-trash"></i> 
                    <span>Borrar</span>
                </button>
                
            </div>
        </div>`;
    });
    
    cont.innerHTML = h;
}

function agregarCategoria() { 
    const n=document.getElementById('nuevaCategoriaNombre').value; 
    const e=document.getElementById('nuevaCategoriaEmoji').value;
    if(!n) return alert('Falta nombre');
    db.collection('categorias').add({emoji:e||'📦', nombre:n, createdAt:new Date()})
    .then(()=>{ showSuccess('Agregada'); document.getElementById('nuevaCategoriaNombre').value=''; }); 
}

function abrirModalEditarCategoria(id,e,n) { 
    document.getElementById('editCategoriaId').value=id; 
    document.getElementById('editCategoriaEmoji').value=e; 
    document.getElementById('editCategoriaNombre').value=n; 
    document.getElementById('modalEditarCategoria').classList.add('active'); 
}

function cerrarModalEditarCategoria() { document.getElementById('modalEditarCategoria').classList.remove('active'); }

function guardarCategoriaEditada() { 
    db.collection('categorias').doc(document.getElementById('editCategoriaId').value).update({
        emoji:document.getElementById('editCategoriaEmoji').value, 
        nombre:document.getElementById('editCategoriaNombre').value
    }).then(()=>cerrarModalEditarCategoria()); 
}

function eliminarCategoria(id) { if(confirm('¿Borrar categoría?')) db.collection('categorias').doc(id).delete(); }

// --- GESTIÓN DE CUENTAS ---
// --- GESTIÓN DE CUENTAS (PAGINADA Y MODAL) ---

let cuentasGlobales = [];
let paginaActualCuentas = 1;
const itemsPorPaginaCuentas = 10;

function cargarCuentas() {
    db.collection('usuarios').orderBy('createdAt', 'desc').onSnapshot(snap => {
        cuentasGlobales = [];
        snap.forEach(doc => {
            cuentasGlobales.push({ id: doc.id, ...doc.data() });
        });
        renderizarTablaCuentas();
    });
}

// --- TABLA CUENTAS ACTUALIZADA (CON CAMBIO DE ROL) ---

function renderizarTablaCuentas() {
    const tbody = document.getElementById('cuentasListBody');
    const busqueda = document.getElementById('buscarCuenta').value.toLowerCase();
    
    // 1. Filtrar
    let filtrados = cuentasGlobales.filter(u => 
        (u.name || '').toLowerCase().includes(busqueda) || 
        (u.email || '').toLowerCase().includes(busqueda)
    );

    // 2. Paginar
    const totalItems = filtrados.length;
    const totalPaginas = Math.ceil(totalItems / itemsPorPaginaCuentas) || 1;
    
    if (paginaActualCuentas > totalPaginas) paginaActualCuentas = totalPaginas;
    
    const inicio = (paginaActualCuentas - 1) * itemsPorPaginaCuentas;
    const fin = inicio + itemsPorPaginaCuentas;
    const usuariosPagina = filtrados.slice(inicio, fin);

    // 3. Renderizar HTML
    let html = '';
    
    if (usuariosPagina.length === 0) {
        html = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: var(--text-muted); font-style: italic;">No se encontraron usuarios.</td></tr>`;
    } else {
        usuariosPagina.forEach(u => {
            // Badges
            const estado = u.activo ? 
                '<span class="badge" style="background: rgba(34,197,94,0.1); color:#4ade80; border:1px solid rgba(34,197,94,0.2);">Activo</span>' : 
                '<span class="badge" style="background: rgba(148,163,184,0.1); color:#94a3b8; border:1px solid rgba(148,163,184,0.2);">Inactivo</span>';
                
            const rolClass = u.role === 'admin' ? 'badge-rol-admin' : 'badge-rol-vendedor';
            const rol = `<span class="${rolClass}">${u.role.toUpperCase()}</span>`;

            // --- BOTONES DE ACCIÓN ---
            
            // A. Activar/Desactivar
            const btnEstadoClass = u.activo ? 'action-toggle' : 'action-toggle inactive';
            const btnIcon = u.activo ? 'fa-toggle-on' : 'fa-toggle-off';
            const btnEstado = `<button onclick="cambiarEstadoUsuario('${u.id}', ${!u.activo})" title="Cambiar Estado" class="btn-icon-action ${btnEstadoClass}"><i class="fas ${btnIcon}"></i></button>`;

            // B. Cambiar Rol (NUEVO - Azul) 
            // Calcula el rol contrario para enviarlo a la función
            const siguienteRol = u.role === 'admin' ? 'vendedor' : 'admin';
            const btnRol = `<button onclick="cambiarRolUsuario('${u.id}', '${u.name}', '${siguienteRol}')" title="Cambiar a ${siguienteRol.toUpperCase()}" class="btn-icon-action action-role"><i class="fas fa-user-tag"></i></button>`;

            // C. Reset Password (Amarillo)
            const btnReset = `<button onclick="resetPass('${u.email}')" title="Restablecer Contraseña" class="btn-icon-action action-reset"><i class="fas fa-key"></i></button>`;

            // D. Borrar (Rojo)
            const btnBorrar = `<button onclick="borrarUsuario('${u.id}', '${u.name}')" title="Eliminar Usuario" class="btn-icon-action action-delete"><i class="fas fa-trash-alt"></i></button>`;

            html += `
                <tr>
                    <td data-label="Nombre" style="vertical-align: middle;">
                        <div style="display:flex; flex-direction:column;">
                            <strong style="font-size:14px; color:var(--text-main);">${u.name || 'Sin Nombre'}</strong>
                        </div>
                    </td>
                    <td data-label="Email" style="vertical-align: middle; color:var(--text-muted); font-size:13px;">${u.email}</td>
                    <td data-label="Rol" style="vertical-align: middle;">${rol}</td>
                    <td data-label="Estado" style="vertical-align: middle;">${estado}</td>
                    <td class="actions-cell" style="vertical-align: middle; text-align: right;">
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            ${btnRol}   ${btnEstado}
                            ${btnReset}
                            ${btnBorrar}
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    tbody.innerHTML = html;

    // Actualizar controles
    document.getElementById('infoPaginacion').textContent = `Mostrando ${usuariosPagina.length > 0 ? inicio + 1 : 0}-${Math.min(fin, totalItems)} de ${totalItems}`;
    document.getElementById('btnPrevCuentas').disabled = paginaActualCuentas === 1;
    document.getElementById('btnNextCuentas').disabled = paginaActualCuentas === totalPaginas;
}

// --- FUNCIÓN PARA CAMBIAR ROL (AGREGAR AL FINAL DE ADMIN.JS) ---
function cambiarRolUsuario(id, nombre, nuevoRol) {
    Swal.fire({
        title: `¿Cambiar rol a ${nuevoRol.toUpperCase()}?`,
        text: `El usuario ${nombre} tendrá permisos de ${nuevoRol}.`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonColor: '#3b82f6', // Azul
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, cambiar rol',
        background: '#1e293b',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('usuarios').doc(id).update({ role: nuevoRol })
                .then(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Rol actualizado',
                        timer: 1500,
                        showConfirmButton: false,
                        background: '#1e293b',
                        color: '#ffffff'
                    });
                })
                .catch(e => showError(e.message));
        }
    });
}

function cambiarPaginaCuentas(delta) {
    paginaActualCuentas += delta;
    renderizarTablaCuentas();
}

function filtrarCuentas() {
    paginaActualCuentas = 1; // Reset a página 1 al buscar
    renderizarTablaCuentas();
}

// --- MODALES ---
function abrirModalCrearUsuario() {
    document.getElementById('modalCrearUsuario').classList.add('active');
    document.getElementById('newUserName').focus();
}

function cerrarModalCrearUsuario() {
    document.getElementById('modalCrearUsuario').classList.remove('active');
    // Limpiar campos
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserEmail').value = '';
    document.getElementById('newUserPassword').value = '';
}

// --- FUNCIONES DE ACCIÓN ---
// Asegúrate de actualizar tu función crearCuenta para cerrar el modal al final
function crearCuenta() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;

    if (!name || !email || !password) return showError('Completa todos los campos');
    if (password.length < 6) return showError('La contraseña debe tener al menos 6 caracteres');

    showLoading(true);

    // Usamos la app secundaria para no cerrar sesión del admin
    const secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');

    secondaryApp.auth().createUserWithEmailAndPassword(email, password)
        .then((cred) => {
            return db.collection('usuarios').doc(cred.user.uid).set({
                name: name,
                email: email,
                role: role,
                createdAt: new Date(),
                activo: true
            });
        })
        .then(() => {
            secondaryApp.delete();
            showSuccess(`✅ Usuario ${name} creado correctamente.`);
            cerrarModalCrearUsuario(); // <--- IMPORTANTE: Cerrar modal
        })
        .catch((error) => {
            secondaryApp.delete();
            showError(error.message);
        })
        .finally(() => showLoading(false));
}

function cambiarEstadoUsuario(id, nuevoEstado) {
    db.collection('usuarios').doc(id).update({ activo: nuevoEstado })
        .then(() => showSuccess('Estado actualizado'))
        .catch(e => showError(e.message));
}

function borrarUsuario(id, nombre) {
    if(confirm(`¿Estás seguro de eliminar al usuario ${nombre}? Esta acción no se puede deshacer.`)) {
        // Nota: Borrar de Auth requiere Cloud Functions, aquí solo borramos de BD por ahora
        db.collection('usuarios').doc(id).delete()
            .then(() => showSuccess('Usuario eliminado de la base de datos'))
            .catch(e => showError(e.message));
    }
}

// --- ESTADISTICAS ---
function actualizarEstadisticas() {
    db.collection('eventos').get().then(s=>document.getElementById('totalEventos').textContent=s.size);
    db.collection('pulseras').get().then(s=>document.getElementById('totalPulseras').textContent=s.size);
    db.collection('transacciones').get().then(s=>document.getElementById('totalTransacciones').textContent=s.size);
    db.collection('articulos').get().then(s=>document.getElementById('totalArticulos').textContent=s.size);
}

function cargarDashboard() {
    // 1. CARGA DE VENTAS DEL DÍA (Tu código original)
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    
    db.collection('transacciones').where('fecha','>=',hoy).onSnapshot(s=>{
        let tot=0, nfc=0, efe=0, transf=0;
        s.forEach(d=>{ 
            const t=d.data(); const m=t.monto||0; 
            tot+=m; 
            if(t.metodoPago==='efectivo') efe+=m; 
            else if(t.metodoPago==='transferencia') transf+=m;
            else nfc+=m; 
        });
        
        // Verificamos que existan los elementos antes de asignarles valor para evitar errores
        const elTotal = document.getElementById('dashTotalVentas');
        if(elTotal) elTotal.textContent='$'+tot.toFixed(2);
        
        const elNFC = document.getElementById('dashTotalNFC');
        if(elNFC) elNFC.textContent='$'+nfc.toFixed(2);
        
        const elEfe = document.getElementById('dashTotalEfectivo');
        if(elEfe) elEfe.textContent='$'+efe.toFixed(2);
        
        const elTransf = document.getElementById('dashTotalTransf');
        if(elTransf) elTransf.textContent='$'+transf.toFixed(2);
    });

    // 2. NUEVO: ACTIVAR ALERTAS DE STOCK
    // Llamamos a la función que vigila el inventario
    if(typeof verificarStockBajo === 'function') {
        verificarStockBajo();
    }
}

// --- SIMULACIÓN COBRO ---
function loadSimArticulos() { /* Ya cargado en cargarArticulos */ }

function simularTransaccion() {
    const pv=document.getElementById('simPulsera').value; 
    const av=document.getElementById('simArticulo').value;
    
    if(!pv||!av) return alert('Selecciona ambos');
    
    const [pid,pnom,psal] = pv.split('|'); 
    const [aid,anom,aprec] = av.split('|');
    const costo=parseFloat(aprec); const saldo=parseFloat(psal);
    
    if(saldo<costo) return alert('Saldo insuficiente');
    
    db.collection('pulseras').doc(pid).update({saldoActual:saldo-costo}).then(()=>{
        db.collection('transacciones').add({
            pulseraId:pid, pulsera:pnom, articulo:anom, monto:costo, 
            fecha:new Date(), metodoPago:'nfc'
        });
        showSuccess('Cobrado');
    });
}

// ==================== REPORTES GENERALES (PDF/EXCEL) ====================
let datosReporteMensual = [];
let resumenMensual = { total: 0, nfc: 0, efectivo: 0, transf: 0 };

function cargarReporteMensual() {
    const inputMes = document.getElementById('filtroMesReporte');
    if (!inputMes || !inputMes.value) return;

    const [anio, mes] = inputMes.value.split('-');
    const fechaInicio = new Date(anio, mes - 1, 1);
    const fechaFin = new Date(anio, mes, 0, 23, 59, 59);

    const elTotal = document.getElementById('repMesTotal');
    if(elTotal) elTotal.textContent = '...';

    db.collection('transacciones')
        .where('fecha', '>=', fechaInicio)
        .where('fecha', '<=', fechaFin)
        .get()
        .then(snapshot => {
            let total = 0, nfc = 0, efectivo = 0, transf = 0;
            datosReporteMensual = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                const monto = data.monto || 0;
                const metodo = data.metodoPago || 'nfc';

                total += monto;
                if (metodo === 'efectivo') efectivo += monto;
                else if (metodo === 'transferencia') transf += monto;
                else nfc += monto;

                datosReporteMensual.push({
                    Fecha: data.fecha ? data.fecha.toDate().toLocaleString() : 'S/F',
                    Producto: data.articulo || 'Varios',
                    Vendedor: data.vendedor || 'Sistema',
                    Metodo: metodo,
                    Monto: monto
                });
            });

            resumenMensual = { total, nfc, efectivo, transf };

            document.getElementById('repMesTotal').textContent = '$' + total.toFixed(2);
            document.getElementById('repMesNFC').textContent = '$' + nfc.toFixed(2);
            document.getElementById('repMesEfectivo').textContent = '$' + efectivo.toFixed(2);
            document.getElementById('repMesTransf').textContent = '$' + transf.toFixed(2);
        })
        .catch(err => { console.error(err); });
}

function descargarExcelMensual() {
    if (!datosReporteMensual.length) return showError('No hay datos en este mes');
    
    const mesTxt = document.getElementById('filtroMesReporte').value;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datosReporteMensual);
    
    ws['!cols'] = [{wch:20}, {wch:25}, {wch:15}, {wch:15}, {wch:10}];
    
    XLSX.utils.book_append_sheet(wb, ws, "Reporte Mensual");
    XLSX.writeFile(wb, `Reporte_Genesaret_${mesTxt}.xlsx`);
    showSuccess('Excel descargado');
}

function descargarPDFMensual() {
    if (!datosReporteMensual.length) return showError('No hay datos en este mes');
    if (!window.jspdf) return showError('Librería PDF cargando...');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const mesTxt = document.getElementById('filtroMesReporte').value;

    doc.setFontSize(18);
    doc.setTextColor(245, 158, 11);
    doc.text("Reporte Mensual - Genesaret", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Período: ${mesTxt}`, 14, 30);

    doc.setFillColor(240, 240, 240);
    doc.rect(14, 35, 180, 25, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Total Vendido: $${resumenMensual.total.toFixed(2)}`, 20, 45);
    doc.text(`NFC: $${resumenMensual.nfc.toFixed(2)}`, 80, 45);
    doc.text(`Efectivo: $${resumenMensual.efectivo.toFixed(2)}`, 20, 55);
    doc.text(`Transferencia: $${resumenMensual.transf.toFixed(2)}`, 80, 55);

    const columnas = [["Fecha", "Producto", "Vendedor", "Método", "Monto"]];
    const filas = datosReporteMensual.map(d => [d.Fecha, d.Producto, d.Vendedor, d.Metodo, `$${d.Monto.toFixed(2)}`]);

    doc.autoTable({
        startY: 65,
        head: columnas,
        body: filas,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        styles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`Reporte_PDF_${mesTxt}.pdf`);
    showSuccess('PDF generado');
}
function formatearMonedaInput(input) {
    let valor = parseFloat(input.value);
    if (isNaN(valor)) {
        input.value = ""; // Si no es número, limpiar
    } else {
        input.value = valor.toFixed(2); // Forzar 2 decimales (ej: 50.00)
    }
}
// --- GENERADOR DE AVATAR (Iniciales) ---
function renderizarAvatar(nombre) {
    if(!nombre) return;
    
    // 1. Crear las iniciales
    const partes = nombre.split(' ');
    const iniciales = (partes[0][0] + (partes.length > 1 ? partes[1][0] : '')).toUpperCase();

    // Función auxiliar para crear la bolita
    const crearBolita = () => {
        const div = document.createElement('div');
        div.className = 'user-avatar-circle';
        div.textContent = iniciales;
        return div;
    };

    // 2. Poner en ESCRITORIO
    const containerDesk = document.getElementById('avatarContainer');
    if(containerDesk) {
        containerDesk.innerHTML = ''; // Limpiar por si acaso
        containerDesk.appendChild(crearBolita());
    }

    // 3. Poner en MÓVIL (Nuevo)
    const containerMobile = document.getElementById('mobileAvatarContainer');
    if(containerMobile) {
        containerMobile.innerHTML = ''; // Limpiar
        const avatarMobile = crearBolita();
        // Opcional: Hacerlo un poquito más grande en el móvil para que luzca
        avatarMobile.style.width = '45px'; 
        avatarMobile.style.height = '45px';
        avatarMobile.style.fontSize = '16px';
        containerMobile.appendChild(avatarMobile);
    }
}

// Esto conecta el botón nuevo con el menú existente
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) {
        menu.classList.toggle('active');
    } else {
        console.error("No encuentro el menú móvil (id='mobileMenu')");
    }
}

// Mantenemos esta por si el fondo oscuro la usa para cerrar
function toggleMenu() { 
    toggleMobileMenu(); 
}
// --- TOGGLE TEMA MÓVIL ---
function toggleThemeMobile() {
    toggleTheme(); // Llama a la función principal
    actualizarTextoTemaMobile();
}

function actualizarTextoTemaMobile() {
    const isLight = document.body.classList.contains('light-mode');
    const textEl = document.getElementById('mobileThemeText');
    const iconEl = document.getElementById('mobileThemeIcon');
    
    if(textEl) textEl.textContent = isLight ? "Tema Claro" : "Tema Oscuro";
    
    if(iconEl) {
        iconEl.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
        // En modo claro mostramos Sol (porque estamos en día), en oscuro Luna.
        // O si prefieres "Cambiar a...", invierte la lógica. 
        // Como está ahora describe el estado ACTUAL.
    }
}

// Llamar al inicio para poner el texto correcto
actualizarTextoTemaMobile();

async function startNFCReadAdmin() {
    if (!('NDEFReader' in window)) {
        showError('❌ Tu dispositivo o navegador no soporta lectura NFC web. Usa la opción QR.');
        return;
    }
    
    try {
        const ndef = new NDEFReader();
        document.getElementById('nfcReaderAdmin').innerHTML = `
            <div class="nfc-icon">⏳</div>
            <div class="nfc-status">Acerca el sticker o gafete al sensor...</div>
        `;
        
        await ndef.scan();
        
        ndef.onreading = event => {
            // Prioridad 1: Tomar el número de serie de fábrica (UID único del NTAG213)
            let id = event.serialNumber;
            
            // Prioridad 2: Si por alguna razón viene vacío, buscar si tiene texto grabado
            if (!id && event.message && event.message.records) {
                const decoder = new TextDecoder();
                for (const record of event.message.records) {
                    id = decoder.decode(record.data);
                }
            }
            
            if (!id) {
                showError('No se pudo obtener el ID del chip.');
                return;
            }

            // Normalizamos a mayúsculas y quitamos los dos puntos que a veces pone Android (ej: 04:a1:b2 -> 04A1B2)
            id = id.replace(/:/g, '').toUpperCase();
            
            // Llenar el campo en la interfaz
            document.getElementById('pulseraId').value = id;
            showSuccess('✅ Chip leído: ' + id);
            playSound('scan');
            
            // Restaurar diseño del botón
            document.getElementById('nfcReaderAdmin').innerHTML = `
                <div class="nfc-icon">✅</div>
                <div class="nfc-status">Leído: <strong>${id}</strong></div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="btn-primary" onclick="startNFCReadAdmin()">📡 Leer Otro</button>
                </div>
            `;
        };
    } catch (error) {
        showError('Error NFC: ' + error.message);
        document.getElementById('nfcReaderAdmin').innerHTML = `
            <div class="nfc-icon">❌</div>
            <div class="nfc-status">Error al activar sensor.</div>
            <button class="btn-primary" onclick="startNFCReadAdmin()">Reintentar</button>
        `;
    }
}

async function startNFCRecarga() {
    if (!('NDEFReader' in window)) {
        showError('❌ Tu dispositivo no soporta NFC Web. Usa QR.');
        return;
    }
    // Lógica similar para recarga...
    // (Te recomiendo usar el QR en iPhone obligatoriamente)
}
// --- FUNCIÓN RECUPERAR CONTRASEÑA (AGREGAR AL FINAL) ---
function resetPass(email) {
    Swal.fire({
        title: '¿Restablecer contraseña?',
        text: `Se enviará un correo a ${email} para que el usuario cree una nueva clave.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#334155',
        confirmButtonText: 'Sí, enviar correo',
        background: '#1e293b',
        color: '#ffffff'
    }).then((result) => {
        if (result.isConfirmed) {
            auth.sendPasswordResetEmail(email)
                .then(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Correo enviado',
                        text: 'El usuario recibirá las instrucciones en breve.',
                        background: '#1e293b',
                        color: '#ffffff',
                        confirmButtonColor: '#22c55e',
                        timer: 2000,
                        showConfirmButton: false
                    });
                })
                .catch(e => showError(e.message));
        }
    });
}

// --- GRÁFICAS DEL DASHBOARD (Chart.js) ---
let myChart = null; // Variable global para guardar la gráfica

function cargarGraficaVentas() {
    const dias = parseInt(document.getElementById('rangoGrafica').value) || 7;
    const ctx = document.getElementById('ventasChart');
    if (!ctx) return; // Si no estamos en la pestaña correcta, salir

    // Calcular fecha de inicio (hace X días)
    const hoy = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(hoy.getDate() - dias);
    fechaInicio.setHours(0, 0, 0, 0);

    // Consultar Firebase
    db.collection('transacciones')
        .where('fecha', '>=', fechaInicio)
        .orderBy('fecha', 'asc')
        .get()
        .then(snap => {
            // 1. Procesar Datos: Agrupar ventas por fecha (DD/MM)
            const ventasPorDia = {};
            const etiquetas = [];
            
            // Inicializar días vacíos para que la gráfica no se vea hueca
            for (let i = 0; i < dias; i++) {
                const d = new Date(fechaInicio);
                d.setDate(d.getDate() + i);
                const key = d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
                ventasPorDia[key] = 0;
                etiquetas.push(key);
            }

            // Llenar con datos reales
            snap.forEach(doc => {
                const data = doc.data();
                const fecha = data.fecha.toDate();
                const key = fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
                
                if (ventasPorDia[key] !== undefined) {
                    ventasPorDia[key] += data.monto;
                }
            });

            const valores = etiquetas.map(tag => ventasPorDia[tag]);

            // 2. Dibujar Gráfica
            if (myChart) myChart.destroy(); // Destruir anterior para no encimar

            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: etiquetas,
                    datasets: [{
                        label: 'Ventas ($)',
                        data: valores,
                        backgroundColor: 'rgba(245, 158, 11, 0.6)', // Tu naranja semi-transparente
                        borderColor: '#f59e0b',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }, // Ocultar leyenda redundante
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `$${context.raw.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { color: '#94a3b8' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8' }
                        }
                    }
                }
            });
        })
        .catch(err => console.error("Error cargando gráfica:", err));
}

// --- HISTORIAL INDIVIDUAL DE PULSERA ---

// --- HISTORIAL INDIVIDUAL DE PULSERA (CORREGIDO) ---
function verHistorial(id, nombre) {
    const modal = document.getElementById('modalHistorialPulsera');
    if (!modal) return;
    
    // 1. Mostrar Modal y Loader
    document.getElementById('historialPulseraNombre').textContent = `Movimientos de: ${nombre}`;
    document.getElementById('historialPulseraLista').innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin"></i> Cargando datos...</div>';
    modal.classList.add('active');

    // 2. Consultar Transacciones (SIN ORDERBY PARA EVITAR ERROR DE ÍNDICE)
    db.collection('transacciones')
        .where('pulseraId', '==', id)
        .limit(50) // Traemos los últimos 50 movimientos
        .get()
        .then(snap => {
            if (snap.empty) {
                document.getElementById('historialPulseraLista').innerHTML = `
                    <div style="text-align:center; padding:30px; color:var(--text-muted);">
                        <i class="fas fa-history" style="font-size:30px; margin-bottom:10px; opacity:0.5;"></i>
                        <p>No hay movimientos registrados.</p>
                    </div>`;
                return;
            }

            // 3. ORDENAMOS AQUÍ CON JAVASCRIPT (Truco para evitar el error)
            let movimientos = [];
            snap.forEach(doc => movimientos.push(doc.data()));
            
            // Ordenar del más reciente al más antiguo
            movimientos.sort((a, b) => {
                const dateA = a.fecha ? a.fecha.toDate() : new Date(0);
                const dateB = b.fecha ? b.fecha.toDate() : new Date(0);
                return dateB - dateA;
            });

            // 4. Renderizar la tabla
            let html = `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Concepto</th>
                            <th>Monto</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            movimientos.forEach(d => {
                const fecha = d.fecha ? d.fecha.toDate().toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                
                // Detectar si es Gasto (tiene artículo) o Recarga
                // Asumimos que si tiene campo 'articulo' es una compra
                const esGasto = !!d.articulo; 
                
                const icono = esGasto ? '🛍️' : '💰';
                const concepto = esGasto ? d.articulo : (d.motivo || 'Recarga de Saldo');
                const colorMonto = esGasto ? '#ef4444' : '#22c55e'; // Rojo gasto, Verde ingreso
                const signo = esGasto ? '-' : '+';

                html += `
                    <tr>
                        <td style="color:var(--text-muted); font-size:11px;">${fecha}</td>
                        <td><span style="margin-right:5px;">${icono}</span> ${concepto}</td>
                        <td style="color:${colorMonto}; font-weight:bold;">${signo}$${d.monto.toFixed(2)}</td>
                    </tr>
                `;
            });

            html += '</tbody></table>';
            document.getElementById('historialPulseraLista').innerHTML = html;
        })
        .catch(err => {
            console.error(err);
            document.getElementById('historialPulseraLista').innerHTML = `<p style="color:#ef4444; text-align:center;">Error técnico: ${err.message}</p>`;
        });
}

function cerrarModalHistorial() {
    document.getElementById('modalHistorialPulsera').classList.remove('active');
}

// --- GUARDAR NUEVO ARTÍCULO (FUNCIÓN CORREGIDA) ---

// --- GUARDAR NUEVO ARTÍCULO (CORREGIDO CON TUS IDs) ---

function guardarNuevoArticulo() {
    // 1. OBTENER VALORES (Usando tus IDs correctos del HTML)
    const eventoVal = document.getElementById('articuloEvento').value;
    const nombreInput = document.getElementById('articuloName'); // Tu ID es articuloName
    const precioInput = document.getElementById('artPrecio');    // Tu ID es artPrecio
    
    // Stock (Usando los IDs de la sección "Nuevo", no del modal)
    const checkInfinito = document.getElementById('newArtInfinito'); // Tu ID es newArtInfinito
    const stockInput = document.getElementById('newArtStock');       // Tu ID es newArtStock

    // Valores limpios
    const nombreVal = nombreInput.value.trim();
    const precioVal = parseFloat(precioInput.value);
    const esInfinito = checkInfinito.checked;
    const stockVal = esInfinito ? 99999 : (parseInt(stockInput.value) || 0);

    // 2. OBTENER CATEGORÍA
    // Tu función cargarCategorias actualiza este input oculto, así que lo leemos directo
    const categoriaVal = document.getElementById('articuloCategoria').value;

    // 3. VALIDACIÓN
    if (!eventoVal) return showError('Selecciona un evento');
    if (!categoriaVal) return showError('Selecciona una categoría (dale clic a un icono)');
    if (!nombreVal) return showError('Escribe el nombre del producto');
    if (isNaN(precioVal) || precioVal < 0) return showError('Ingresa un precio válido');

    // 4. GUARDAR EN FIREBASE
    const nuevoArticulo = {
        eventId: eventoVal,
        categoria: categoriaVal,
        nombre: nombreVal,
        precio: precioVal,
        esInfinito: esInfinito,
        stock: stockVal,
        createdAt: new Date()
    };

    db.collection('articulos').add(nuevoArticulo)
        .then(() => {
            showSuccess(`¡${nombreVal} agregado!`);

            // 5. LIMPIAR FORMULARIO
            nombreInput.value = '';
            precioInput.value = '';
            stockInput.value = '';
            checkInfinito.checked = false;
            
            // Habilitar input de stock de nuevo por si se desactivó
            stockInput.disabled = false;
            
            // Opcional: Quitar selección visual de categoría
            document.querySelectorAll('.cat-option').forEach(x => x.classList.remove('selected'));
            document.getElementById('articuloCategoria').value = '';
            
            // Recargar tabla si estamos viendo la lista
            if(typeof cargarArticulosTabla === 'function') cargarArticulosTabla();
        })
        .catch((error) => {
            console.error("Error al guardar:", error);
            showError('Error al guardar: ' + error.message);
        });
}

// --- CERRAR SELECTOR DE EMOJIS AL DAR CLIC FUERA ---

document.addEventListener('click', function(event) {
    // Buscamos si hay algún panel abierto
    const panelesAbiertos = document.querySelectorAll('.emoji-grid-panel.active');

    panelesAbiertos.forEach(panel => {
        // Buscamos el contenedor padre (donde vive el botón y el panel)
        const contenedor = panel.closest('.emoji-picker-container');

        // Si el clic NO fue dentro del contenedor...
        if (contenedor && !contenedor.contains(event.target)) {
            // ... cerramos el panel
            panel.classList.remove('active');
        }
    });
});

// --- 1. WIDGET DE STOCK BAJO (CON BOTÓN REABASTECER) ---
function verificarStockBajo() {
    db.collection('articulos').where('esInfinito', '==', false).onSnapshot(snap => {
        const contenedor = document.getElementById('widgetStockAlerta');
        const lista = document.getElementById('listaStockBajo');
        if(!contenedor || !lista) return;

        let html = '';
        let hayAlertas = false;

        snap.forEach(doc => {
            const prod = doc.data();
            const stock = prod.stock || 0;

            if (stock <= 5) { 
                hayAlertas = true;
                const color = stock === 0 ? '#ef4444' : '#f59e0b'; 
                const texto = stock === 0 ? 'AGOTADO' : `Quedan ${stock}`;
                const icono = prod.categoria ? prod.categoria.split(' ')[0] : '📦';

                html += `
                <div class="stock-alert-item" style="margin-bottom:5px;">
                    <span style="color: #fff;">${icono} ${prod.nombre}</span>
                    <strong style="color: ${color};">${texto}</strong>
                </div>`;
            }
        });

        // AGREGAMOS EL BOTÓN DE REABASTECER AL FINAL
        if (hayAlertas) {
            html += `
            <button onclick="irAInventario()" class="btn-primary" style="width:100%; margin-top:10px; background: rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2);">
                📦 Ir a Reabastecer
            </button>`;
        }

        lista.innerHTML = html;
        contenedor.style.display = hayAlertas ? 'block' : 'none';
    });
}

// Función auxiliar para redirigir
function irAInventario() {
    switchTab('articulos'); // Cambia de pestaña mayor
    // Simula clic en el botón de la sub-pestaña "Lista"
    const btnLista = document.querySelector("button[onclick*='lista']");
    if(btnLista) btnLista.click(); 
}

// --- 2. GRÁFICA DE PRODUCTOS POPULARES ---
let chartPopulares = null;

function cargarGraficaPopulares() {
    const ctx = document.getElementById('topProductosChart');
    if (!ctx) return;

    // Analizamos TODAS las transacciones (o podrías filtrar por fecha si prefieres)
    db.collection('transacciones').get().then(snap => {
        const conteo = {};

        snap.forEach(doc => {
            const t = doc.data();
            // Solo contamos ventas (tienen campo 'articulo')
            if (t.articulo) {
                const nombre = t.articulo;
                conteo[nombre] = (conteo[nombre] || 0) + 1; // Contamos cantidad de veces vendido
            }
        });

        // Convertir a array y ordenar
        const ranking = Object.entries(conteo)
            .sort((a, b) => b[1] - a[1]) // Orden descendente
            .slice(0, 5); // Top 5

        const labels = ranking.map(item => item[0]);
        const data = ranking.map(item => item[1]);

        if (chartPopulares) chartPopulares.destroy();

        chartPopulares = new Chart(ctx, {
            type: 'doughnut', // Gráfica de Dona
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#cbd5e1' } }
                }
            }
        });
    });
}

// --- CARGAR BITÁCORA ---
function cargarBitacora() {
    const tbody = document.getElementById('listaBitacora');
    if(!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';

    db.collection('bitacora_stock')
        .orderBy('fecha', 'desc')
        .limit(50) // Últimos 50 movimientos
        .get()
        .then(snap => {
            if(snap.empty) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">Sin movimientos recientes</td></tr>';
                return;
            }

            let html = '';
            snap.forEach(doc => {
                const d = doc.data();
                const fecha = d.fecha ? d.fecha.toDate().toLocaleString('es-MX', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '-';
                
                // Estilo visual según si sumó o restó
                const esPositivo = d.cantidad > 0;
                const color = esPositivo ? '#22c55e' : '#ef4444';
                const signo = esPositivo ? '+' : '';
                const icono = esPositivo ? '📥' : '📤';

                html += `
                <tr>
                    <td style="color:var(--text-muted); font-size:11px;">${fecha}</td>
                    <td><strong>${d.articulo}</strong></td>
                    <td>
                        <span class="badge" style="background:${color}20; color:${color}; border:1px solid ${color}40;">
                            ${icono} ${signo}${d.cantidad} (Total: ${d.stockFinal})
                        </span>
                    </td>
                    <td style="font-size:12px;">${d.usuario}</td>
                </tr>`;
            });
            tbody.innerHTML = html;
        });
}

// ==========================================
// --- MÓDULO POS RÁPIDO (ADMIN) ---
// ==========================================

let carritoPOS = [];
let productosPOS = []; // Copia local para búsqueda rápida

let adminEventoActivo = ''; 

// 1. MODIFICAR: Función abrirPOSAdmin (Para cargar un evento por defecto)
function abrirPOSAdmin() {
    document.getElementById('modalPOSAdmin').classList.add('active');
    
    // Cargar Inventario
    document.getElementById('posGrid').innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    
    // A) CARGAR ARTÍCULOS
    db.collection('articulos').get().then(snap => {
        adminInventarioPOS = []; 
        snap.forEach(doc => adminInventarioPOS.push({ id: doc.id, ...doc.data() }));
        adminInventarioPOS.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        renderPOSGrid(adminInventarioPOS);
    });

    // B) DETECTAR UN EVENTO ACTIVO (Para que las ventas salgan en Reportes)
    db.collection('eventos').where('activo', '==', true).limit(1).get().then(snap => {
        if(!snap.empty) {
            adminEventoActivo = snap.docs[0].id;
            console.log("Evento activo detectado para Admin:", adminEventoActivo);
        } else {
            console.warn("No hay eventos activos. La venta podría no salir en reportes filtrados.");
        }
    });

    actualizarAdminCarritoUI();
    cambiarMetodoPOS('efectivo'); 
    switchPOSTab('venta'); 
}

function cerrarPOSAdmin() {
    document.getElementById('modalPOSAdmin').classList.remove('active');
}

function cargarProductosPOS() {
    const grid = document.getElementById('posGrid');
    grid.innerHTML = '<p>Cargando...</p>';
    
    // Usamos los artículos globales que ya tienes cargados en memoria
    // Si no están cargados, hacemos una petición rápida
    if(articulosGlobales.length > 0) {
        renderPOSGrid(articulosGlobales);
    } else {
        db.collection('articulos').where('esInfinito','==',true).get().then(snap => {
            // Fallback: Si no hay lista global, traemos al menos los infinitos o todo
             // Nota: Mejor usar articulosGlobales si ya visitaste la pestaña "Lista"
             // Si está vacía, forzamos carga básica
             db.collection('articulos').limit(50).get().then(s => {
                 productosPOS = [];
                 s.forEach(d => productosPOS.push({id:d.id, ...d.data()}));
                 renderPOSGrid(productosPOS);
             });
        });
    }
}

function renderPOSGrid(lista) {
    const grid = document.getElementById('posGrid');
    let html = '';
    
    lista.forEach(p => {
        // Emoji fallback
        const emoji = p.categoria ? p.categoria.split(' ')[0] : '📦';
        const precio = parseFloat(p.precio) || 0;
        
        // Stock visual
        const stockTexto = p.esInfinito ? '∞' : (p.stock || 0);
        const stockColor = (!p.esInfinito && p.stock < 5) ? '#ef4444' : '#94a3b8';

        html += `
        <div onclick="agregarAlCarritoPOS('${p.id}', '${p.nombre}', ${precio})" 
             style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:10px; cursor:pointer; text-align:center; transition:transform 0.1s; position:relative; overflow:hidden;">
            <div style="font-size:24px; margin-bottom:5px;">${emoji}</div>
            <div style="font-size:11px; font-weight:600; line-height:1.2; height:2.4em; overflow:hidden;">${p.nombre}</div>
            <div style="font-size:13px; color:#f59e0b; font-weight:bold; margin-top:5px;">$${precio.toFixed(2)}</div>
            <div style="position:absolute; top:5px; right:5px; font-size:10px; color:${stockColor}; background:rgba(0,0,0,0.3); padding:2px 5px; border-radius:4px;">${stockTexto}</div>
        </div>`;
    });
    grid.innerHTML = html;
    productosPOS = lista; // Guardamos referencia
}

function filtrarPOS() {
    const txt = document.getElementById('posSearch').value.toLowerCase();
    // Filtramos sobre la lista que ya tengamos en pantalla o en memoria
    // Si usas 'articulosGlobales' asegúrate de que esté llena
    const filtrados = (productosPOS.length > 0 ? productosPOS : articulosGlobales).filter(p => p.nombre.toLowerCase().includes(txt));
    renderPOSGrid(filtrados);
}

function agregarAlCarritoPOS(id, nombre, precio) {
    const existe = carritoPOS.find(i => i.id === id);
    if(existe) {
        existe.cantidad++;
    } else {
        carritoPOS.push({ id, nombre, precio, cantidad: 1 });
    }
    actualizarCarritoPOS();
}

function actualizarCarritoPOS() {
    const lista = document.getElementById('posCarritoList');
    const totalEl = document.getElementById('posTotal');
    
    if(carritoPOS.length === 0) {
        lista.innerHTML = '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; opacity:0.5;"><i class="fas fa-shopping-basket" style="font-size:40px; margin-bottom:10px;"></i><p>Vacío</p></div>';
        totalEl.textContent = '$0.00';
        return;
    }

    let html = '';
    let total = 0;

    carritoPOS.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;
        
        html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; margin-bottom:8px;">
            <div style="flex:1;">
                <div style="font-size:12px; font-weight:600;">${item.nombre}</div>
                <div style="font-size:10px; color:var(--text-muted);">$${item.precio} x ${item.cantidad}</div>
            </div>
            <div style="font-weight:bold; font-size:13px; margin-right:10px;">$${subtotal.toFixed(2)}</div>
            <button onclick="eliminarItemPOS(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>`;
    });

    lista.innerHTML = html;
    totalEl.textContent = '$' + total.toFixed(2);
}

function eliminarItemPOS(index) {
    carritoPOS.splice(index, 1);
    actualizarCarritoPOS();
}

function limpiarCarritoPOS() {
    carritoPOS = [];
    actualizarCarritoPOS();
}

// --- MODIFICACIÓN EN COBRAR POS (ADMIN) ---

function cobrarPOS() {
    if(carritoPOS.length === 0) return showError('Agrega productos primero');
    
    // Calculamos el total
    const total = carritoPOS.reduce((acc, i) => acc + (i.precio * i.cantidad), 0);

    Swal.fire({
        title: `Total a Cobrar: $${total.toFixed(2)}`,
        text: 'Selecciona método de pago',
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '💵 Efectivo',
        denyButtonText: '📡 Pulsera NFC',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#22c55e',
        denyButtonColor: '#3b82f6',
        background: '#1e293b', color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            // CAMBIO AQUÍ: En lugar de cobrar directo, pedimos el billete
            pedirMontoEfectivo(total, 'admin'); 
        } else if (result.isDenied) {
            procesarVentaAdmin('nfc');
        }
    });
}

// --- NUEVA FUNCIÓN: CALCULADORA DE CAMBIO ---
function pedirMontoEfectivo(total, origen) {
    Swal.fire({
        title: `Total: $${total.toFixed(2)}`,
        text: "¿Con cuánto paga el cliente?",
        input: 'number',
        inputPlaceholder: 'Ej: 200',
        inputAttributes: { min: total, step: '0.50' },
        showCancelButton: true,
        confirmButtonText: 'Calcular Cambio',
        confirmButtonColor: '#f59e0b',
        background: '#1e293b', color: '#fff',
        inputValidator: (value) => {
            if (!value) return 'Escribe una cantidad';
            if (parseFloat(value) < total) return '¡Falta dinero! El monto es menor al total.';
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const pago = parseFloat(result.value);
            const cambio = pago - total;

            // Mostramos el cambio en GRANDE
            Swal.fire({
                title: `💰 Cambio: $${cambio.toFixed(2)}`,
                html: `<p style="font-size:18px; color:#cbd5e1;">Cobra <strong>$${total.toFixed(2)}</strong> y devuelve <strong>$${cambio.toFixed(2)}</strong></p>`,
                icon: 'success',
                confirmButtonText: '✅ Confirmar Venta',
                confirmButtonColor: '#22c55e',
                showCancelButton: true,
                cancelButtonText: 'Corregir',
                background: '#1e293b', color: '#fff'
            }).then((resFinal) => {
                if(resFinal.isConfirmed) {
                    // Dependiendo de quién llamó a la función, ejecutamos el cobro real
                    if(origen === 'admin') procesarVentaAdmin('efectivo');
                    if(origen === 'vendedor') realizarCobroFinal('efectivo'); // Asumiendo que así se llama en tu script.js
                }
            });
        }
    });
}

function procesarVentaAdmin(metodo, total) {
    const batch = db.batch();
    const fecha = new Date();
    
    // 1. Guardar transacciones individuales
    carritoPOS.forEach(item => {
        const refVenta = db.collection('transacciones').doc();
        batch.set(refVenta, {
            articulo: item.nombre,
            monto: item.precio, // Guardamos precio unitario x cantidad o desglosado? 
                                // Para simplificar reportes, mejor guardamos 1 doc por cada unidad o 1 doc agrupado.
                                // Tu sistema actual parece contar por items, así que guardemos 1 doc por "Venta Agrupada" o bucle.
            // Para mantener coherencia con tu gráfica de "Más vendidos", necesitamos guardar el nombre del articulo.
            // Si vendió 2 cocas, lo ideal es guardar 2 registros o 1 registro con cantidad:2.
            // Asumiré registro simple por ahora para no romper tu lógica actual.
            cantidad: item.cantidad,
            totalVenta: item.precio * item.cantidad,
            fecha: fecha,
            metodoPago: metodo,
            vendedor: 'Admin POS'
        });

        // 2. Restar Stock (si no es infinito) - Esto requiere leer el ID real, asumimos que 'item.id' es correcto
        // Nota: Firestore Batch no soporta queries, así que el stock lo actualizamos directo con decremento
        const refArt = db.collection('articulos').doc(item.id);
        batch.update(refArt, {
            stock: firebase.firestore.FieldValue.increment(-item.cantidad)
        });
    });

    batch.commit().then(() => {
        Swal.fire({
            icon: 'success',
            title: '¡Venta Exitosa!',
            timer: 1500,
            showConfirmButton: false,
            background: '#1e293b', color: '#fff'
        });
        limpiarCarritoPOS();
        cerrarPOSAdmin();
    }).catch(e => showError(e.message));
}

function procesarVentaNFCAdmin(total) {
    // Pedimos ID de pulsera
    Swal.fire({
        title: 'Escanea Pulsera',
        input: 'text',
        inputPlaceholder: 'ID Pulsera...',
        didOpen: () => {
             // Aquí podrías activar tu lector NFC si quisieras
             document.querySelector('.swal2-input').focus();
        },
        background: '#1e293b', color: '#fff'
    }).then((res) => {
        if(res.value) {
            // Verificar saldo y cobrar (Lógica similar a tu simulador)
            // Por brevedad, solo lo simulo:
            showSuccess('Cobro NFC procesado (Simulado)');
            limpiarCarritoPOS();
            cerrarPOSAdmin();
        }
    });
}
function eliminarEventoDefinitivo(id) {
    Swal.fire({
        title: '¿Eliminar DEFINITIVAMENTE?',
        text: "Esto borrará el evento y NO se puede deshacer.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Sí, borrar para siempre'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('eventos').doc(id).delete()
                .then(() => showSuccess('Evento eliminado permanentemente.'));
        }
    });
}
// ==========================================
// --- MÓDULO POS RÁPIDO V3 (ADMIN FINAL) ---
// ==========================================

let adminCarrito = [];
let adminMetodoPago = 'efectivo';
let adminTransfStatus = 'pagado';
let adminScannedPulsera = null; 
let adminInventarioPOS = []; // ✅ Variable 100% independiente para el POS

function abrirPOSAdmin() {
    document.getElementById('modalPOSAdmin').classList.add('active');
    
    // Indicador de carga
    document.getElementById('posGrid').innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); width:100%;"><i class="fas fa-spinner fa-spin"></i> Cargando inventario...</div>';
    
    // --- CORRECCIÓN DEFINITIVA: USAMOS .get() SIN FILTROS ---
    // Esto asegura que cargue TODO lo que haya en la base de datos
    db.collection('articulos').get().then(snap => {
        adminInventarioPOS = []; 
        
        snap.forEach(doc => {
            const d = doc.data();
            adminInventarioPOS.push({ id: doc.id, ...d });
        });

        // Ordenar alfabéticamente
        adminInventarioPOS.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        // Renderizar
        renderPOSGrid(adminInventarioPOS);
    }).catch(err => {
        console.error(err);
        document.getElementById('posGrid').innerHTML = '<p style="text-align:center; color:red;">Error cargando datos</p>';
    });

    actualizarAdminCarritoUI();
    cambiarMetodoPOS('efectivo'); 
    switchPOSTab('venta'); 
}

function cerrarPOSAdmin() {
    document.getElementById('modalPOSAdmin').classList.remove('active');
    if(window.html5QrcodeScanner) window.cerrarScannerQR();
}

// --- 1. RENDERIZADO DEL GRID ---
function renderPOSGrid(lista) {
    const grid = document.getElementById('posGrid');
    if(!grid) return;
    
    // Si la lista viene vacía, usamos la memoria local
    if(!lista) lista = adminInventarioPOS;
    
    if(lista.length === 0) {
        grid.innerHTML = '<div style="text-align:center; width:100%; padding:20px; color:var(--text-muted);">No hay productos disponibles</div>';
        return;
    }
    
    let html = '';
    lista.forEach(p => {
        // Validación Stock
        const stock = parseInt(p.stock) || 0;
        const sinStock = !p.esInfinito && stock <= 0;
        
        // Estilos Grises si agotado
        const estiloCard = sinStock ? 'filter: grayscale(1); opacity: 0.6; pointer-events: none; cursor: not-allowed;' : 'cursor: pointer;';
        const accion = sinStock ? '' : `onclick="agregarAdminCarrito('${p.id}')"`;
        
        // Badge visual
        let badge = '';
        if(p.esInfinito) badge = '<span style="font-size:10px; background:rgba(245,158,11,0.2); color:#f59e0b; padding:2px 5px; border-radius:4px;">♾️ Infinito</span>';
        else if(sinStock) badge = '<span style="font-size:10px; background:#334155; color:#cbd5e1; padding:2px 5px; border-radius:4px;">AGOTADO</span>';
        else badge = `<span style="font-size:10px; background:rgba(34,197,94,0.1); color:#4ade80; padding:2px 5px; border-radius:4px;">${stock} disp.</span>`;

        // Emoji y Precio
        const emoji = p.categoria ? p.categoria.split(' ')[0] : '📦';
        const precio = parseFloat(p.precio)||0;

        html += `
        <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:10px; padding:10px; text-align:center; position:relative; transition:transform 0.1s; ${estiloCard}" ${accion}>
            <div style="font-size:28px; margin-bottom:5px;">${emoji}</div>
            <div style="font-size:12px; font-weight:600; line-height:1.2; height:2.4em; overflow:hidden; margin-bottom:5px;">${p.nombre}</div>
            <div style="font-size:14px; color:#f59e0b; font-weight:bold;">$${precio.toFixed(2)}</div>
            <div style="position:absolute; top:5px; right:5px;">${badge}</div>
        </div>`;
    });
    grid.innerHTML = html;
}

function filtrarPOS() {
    const txt = document.getElementById('posSearch').value.toLowerCase();
    const filtrados = adminInventarioPOS.filter(p => p.nombre.toLowerCase().includes(txt));
    renderPOSGrid(filtrados);
}

// --- 2. CARRITO ADMIN ---
function agregarAdminCarrito(id) {
    // Buscamos en nuestra lista independiente
    const prod = adminInventarioPOS.find(p => p.id === id);
    if(!prod) return;

    const item = adminCarrito.find(i => i.id === id);
    const cantidadEnCarrito = item ? item.cantidad : 0;

    if (!prod.esInfinito && (cantidadEnCarrito + 1 > prod.stock)) {
        return showError('⚠️ Stock insuficiente');
    }

    if(item) { item.cantidad++; } 
    else { adminCarrito.push({ id: id, nombre: prod.nombre, precio: parseFloat(prod.precio)||0, cantidad: 1, esInfinito: prod.esInfinito }); }
    
    actualizarAdminCarritoUI();
}

function actualizarAdminCarritoUI() {
    const list = document.getElementById('posCarritoList');
    const totalEl = document.getElementById('posAdminTotalBadge');
    
    if(adminCarrito.length === 0) {
        list.innerHTML = '<div class="carrito-vacio"><i class="fas fa-shopping-basket"></i><p>Carrito vacío</p></div>';
        totalEl.textContent = '$0.00';
        return;
    }

    let html = '';
    let total = 0;

    adminCarrito.forEach((item, idx) => {
        const sub = item.precio * item.cantidad;
        total += sub;
        html += `
        <div class="carrito-item">
            <div class="carrito-item-info">
                <div class="carrito-item-nombre">${item.nombre}</div>
                <div class="carrito-item-precio">$${item.precio.toFixed(2)}</div>
            </div>
            <div class="carrito-item-cantidad">
                <button class="qty-btn" onclick="cambiarCantAdmin(${idx}, -1)">-</button>
                <span>${item.cantidad}</span>
                <button class="qty-btn" onclick="cambiarCantAdmin(${idx}, 1)">+</button>
            </div>
            <div class="carrito-item-subtotal">$${sub.toFixed(2)}</div>
            <button class="btn-eliminar-item" onclick="eliminarItemAdmin(${idx})"><i class="fas fa-trash"></i></button>
        </div>`;
    });

    list.innerHTML = html;
    totalEl.textContent = '$' + total.toFixed(2);
}

function cambiarCantAdmin(idx, delta) {
    if (delta > 0) {
        const item = adminCarrito[idx];
        const prodReal = adminInventarioPOS.find(p => p.id === item.id);
        if (prodReal && !prodReal.esInfinito && item.cantidad + delta > prodReal.stock) {
            return showError('Stock insuficiente');
        }
    }
    adminCarrito[idx].cantidad += delta;
    if(adminCarrito[idx].cantidad <= 0) adminCarrito.splice(idx, 1);
    actualizarAdminCarritoUI();
}

function eliminarItemAdmin(idx) {
    adminCarrito.splice(idx, 1);
    actualizarAdminCarritoUI();
}

function limpiarCarritoPOS() {
    adminCarrito = [];
    actualizarAdminCarritoUI();
    resetAdminNFC();
}

// --- 3. PESTAÑAS (VENTA | PENDIENTES | CORTE) ---
function switchPOSTab(tabName, btn) {
    document.getElementById('pos-tab-venta').style.display = 'none';
    document.getElementById('pos-tab-pendientes').style.display = 'none';
    document.getElementById('pos-tab-corte').style.display = 'none';
    document.getElementById('pos-tab-' + tabName).style.display = 'block';

    if(btn) {
        document.querySelectorAll('#modalPOSAdmin .sub-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    if(tabName === 'pendientes') cargarPendientesAdmin();
    if(tabName === 'corte') cargarCorteAdmin();
}

// --- 4. MÉTODOS DE PAGO Y FLUJO ---
function cambiarMetodoPOS(m) {
    adminMetodoPago = m;
    document.querySelectorAll('.pm-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('pm-admin-' + m);
    if(btn) btn.classList.add('active');

    const divDirecto = document.getElementById('adminPagoDirecto');
    const divNFC = document.getElementById('adminPagoNFC');
    const inputsTransf = document.getElementById('adminInputsTransf');

    if (m === 'nfc') {
        divDirecto.style.display = 'none';
        divNFC.style.display = 'block';
    } else {
        divNFC.style.display = 'none';
        divDirecto.style.display = 'block';
        inputsTransf.style.display = (m === 'transferencia') ? 'block' : 'none';
    }
}

function setAdminTransfStatus(st) {
    adminTransfStatus = st;
    document.getElementById('btnAdminPagado').className = 'status-btn ' + (st==='pagado'?'active-pagado':'');
    document.getElementById('btnAdminPendiente').className = 'status-btn ' + (st==='pendiente'?'active-pendiente':'');
}

// --- 5. LÓGICA NFC (ARREGLO DE BOTONES GRANDES) ---
async function startAdminNFCScan() {
    if (!('NDEFReader' in window)) return showError('Navegador sin soporte NFC');
    
    document.getElementById('adminNfcReader').innerHTML = '<div class="nfc-icon">⏳</div><div>Acerca pulsera...</div>';
    
    try {
        const ndef = new NDEFReader();
        await ndef.scan();
        ndef.onreading = event => {
            const decoder = new TextDecoder();
            let id = '';
            for (const record of event.message.records) {
                id = decoder.decode(record.data);
            }
            buscarPulseraAdmin(id);
        };
    } catch(e) {
        showError('Error NFC: ' + e);
        resetAdminNFC();
    }
}

function buscarPulseraAdmin(id) {
    db.collection('pulseras').where('id', '==', id).get().then(snap => {
        if(snap.empty) { showError('Pulsera no encontrada'); resetAdminNFC(); return; }
        const p = snap.docs[0].data();
        const pid = snap.docs[0].id;
        
        if(p.bloqueada) { showError('Pulsera Bloqueada'); resetAdminNFC(); return; }
        
        adminScannedPulsera = { docId: pid, ...p };
        
        document.getElementById('adminClienteNFC').textContent = p.nombre;
        document.getElementById('adminSaldoNFC').textContent = '$' + p.saldoActual.toFixed(2);
        document.getElementById('adminSaldoInfo').style.display = 'block';
        document.getElementById('btnAdminCobrarNFC').disabled = false;
        
        document.getElementById('adminNfcReader').innerHTML = `<div class="nfc-icon">✅</div><div>${p.nombre}</div>`;
        playSound('scan');
    });
}

function resetAdminNFC() {
    adminScannedPulsera = null;
    document.getElementById('adminSaldoInfo').style.display = 'none';
    document.getElementById('btnAdminCobrarNFC').disabled = true;
    
    // ✅ AQUÍ ESTÁ EL ARREGLO DE LOS BOTONES GRANDES
    document.getElementById('adminNfcReader').innerHTML = `
        <div class="nfc-icon" style="font-size: 24px;">📱</div>
        <div class="nfc-status">Escanear Pulsera</div>
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px; width: 100%;">
            <button class="btn-primary" onclick="startAdminNFCScan()" style="font-size: 11px; flex: 1; min-width: 0; padding: 10px 5px;">📡 NFC</button>
            <button class="btn-secondary" onclick="iniciarEscanerQR('admin_cobro')" style="font-size: 11px; flex: 1; min-width: 0; padding: 10px 5px;">📸 QR</button>
        </div>`;
}

// --- 6. PROCESAR COBRO ---
function procesarCobroAdmin() {
    if(adminCarrito.length === 0) return showError('Carrito vacío');
    const total = adminCarrito.reduce((acc, i) => acc + (i.precio*i.cantidad), 0);
    const carritoId = Date.now().toString();

    // Cobro Efectivo
    if(adminMetodoPago === 'efectivo') {
        pedirMontoEfectivo(total, 'admin'); 
        return; 
    }

    // Cobro Transferencia
    if(adminMetodoPago === 'transferencia') {
        let cliente = document.getElementById('adminClienteTransf').value.trim();
        if(adminTransfStatus === 'pendiente' && !cliente) return showError('Escribe nombre para fiar');
        if(!cliente) cliente = 'Cliente Transferencia';
        
        finalizarVentaAdmin(total, 'pago_transf', cliente + ' (Transf)', 0, adminMetodoPago, adminTransfStatus, carritoId);
        return;
    }

    // Cobro NFC
    if(adminMetodoPago === 'nfc') {
        if(!adminScannedPulsera) return showError('Escanea pulsera primero');
        if(adminScannedPulsera.saldoActual < total) return showError('Saldo insuficiente');
        
        const nuevoSaldo = adminScannedPulsera.saldoActual - total;
        
        db.collection('pulseras').doc(adminScannedPulsera.docId).update({ saldoActual: nuevoSaldo }).then(() => {
            finalizarVentaAdmin(total, adminScannedPulsera.docId, adminScannedPulsera.nombre, nuevoSaldo, 'nfc', 'pagado', carritoId);
        }).catch(e => showError(e.message));
    }
}

function finalizarVentaAdmin(total, pulseraId, nombre, saldoNuevo, metodo, estado, carritoId) {
    const batch = db.batch();
    const fecha = new Date();
    const vendedor = localStorage.getItem('userName') || 'Admin';
    const vendedorId = localStorage.getItem('userId');

    adminCarrito.forEach(item => {
        const refVenta = db.collection('transacciones').doc();
        batch.set(refVenta, {
            articulo: item.nombre,
            monto: item.precio * item.cantidad,
            cantidad: item.cantidad,
            precioUnitario: item.precio,
            fecha: fecha,
            metodoPago: metodo,
            estadoPago: estado,
            vendedor: vendedor,
            vendedorId: vendedorId,
            pulsera: nombre,
            pulseraId: pulseraId,
            saldoNuevo: saldoNuevo,
            carritoId: carritoId,
            eventId: adminEventoActivo // <--- IMPORTANTE: AQUÍ GUARDAMOS EL EVENTO
        });

        if(!item.esInfinito) {
            batch.update(db.collection('articulos').doc(item.id), {
                stock: firebase.firestore.FieldValue.increment(-item.cantidad)
            });
        }
    });

    batch.commit().then(() => {
        playSound('success');
        document.getElementById('adminConfMonto').textContent = '$' + total.toFixed(2);
        document.getElementById('adminPagoOverlay').classList.add('active');
        
        limpiarCarritoPOS();
        document.getElementById('adminClienteTransf').value = '';
        setAdminTransfStatus('pagado');
        cargarCorteAdmin(); 
    }).catch(e => showError(e.message));
}
function simularNFCAdmin() {
    Swal.fire({
        title: '🧪 Simulador NFC',
        text: 'Ingresa el ID de la pulsera (Ej: "cafeteria" o el ID que creaste)',
        input: 'text',
        inputPlaceholder: 'ID de la pulsera...',
        showCancelButton: true,
        confirmButtonText: 'Simular Escaneo',
        background: '#1e293b', color: '#fff'
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            buscarPulseraAdmin(result.value);
        }
    });
}

function cerrarConfirmacionAdmin() {
    document.getElementById('adminPagoOverlay').classList.remove('active');
}

function cargarPendientesAdmin() {
    const list = document.getElementById('posListaPendientes');
    const myId = localStorage.getItem('userId');
    
    list.innerHTML = '<p style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Buscando deudas...</p>';
    
    db.collection('transacciones')
        .where('vendedorId', '==', myId)
        .where('estadoPago', '==', 'pendiente')
        .onSnapshot(snap => { 
            if(snap.empty) {
                list.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p class="empty-desc">No tienes cuentas pendientes</p></div>';
                return;
            }
            
            const grupos = {};
            let granTotalDeuda = 0;

            snap.forEach(d => {
                const t = d.data();
                const key = t.carritoId || d.id;
                if(!grupos[key]) grupos[key] = { nombre: t.pulsera, total: 0, items: [], ids: [] };
                grupos[key].total += t.monto;
                grupos[key].items.push(`${t.cantidad}x ${t.articulo}`);
                grupos[key].ids.push(d.id);
                
                granTotalDeuda += t.monto;
            });

            // Tarjeta Total
            let html = `
            <div style="background:rgba(234, 179, 8, 0.1); border:1px solid #eab308; padding:15px; border-radius:10px; margin-bottom:15px; text-align:center;">
                <div style="color:#eab308; font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;">Total por Cobrar</div>
                <div style="color:#ffffff; font-size:26px; font-weight:800;">$${granTotalDeuda.toFixed(2)}</div>
            </div>`;

            // Lista
            Object.values(grupos).forEach(g => {
                // CORRECCIÓN: Usamos encodeURIComponent para blindar los datos
                const idsEncoded = encodeURIComponent(JSON.stringify(g.ids));
                
                html += `
                <div style="background:var(--bg-input); border:1px solid var(--border-color); border-radius:10px; padding:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="flex:1;">
                        <div style="font-weight:bold; color:#f59e0b; font-size:14px;">${g.nombre}</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${g.items.join(', ')}</div>
                    </div>
                    <div style="text-align:right; margin-left:10px;">
                        <div style="font-weight:bold; font-size:15px; margin-bottom:5px;">$${g.total.toFixed(2)}</div>
                        <button class="btn-success" style="padding:6px 12px; font-size:11px;" onclick="confirmarCobroAdmin('${idsEncoded}', ${g.total})">Cobrar</button>
                    </div>
                </div>`;
            });
            list.innerHTML = html;
        });
}

function confirmarCobroAdmin(idsEncoded, monto) {
    try {
        // CORRECCIÓN: Decodificamos el string seguro
        const ids = JSON.parse(decodeURIComponent(idsEncoded));
        
        Swal.fire({
            title: `¿Cobrar $${monto.toFixed(2)}?`,
            text: "Se marcará como pagado.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#22c55e',
            confirmButtonText: 'Sí, cobrar',
            background: '#1e293b', color: '#fff'
        }).then((result) => {
            if (result.isConfirmed) {
                const batch = db.batch();
                ids.forEach(id => {
                    batch.update(db.collection('transacciones').doc(id), { 
                        estadoPago: 'pagado', 
                        fecha: new Date() 
                    });
                });
                batch.commit().then(() => {
                    showSuccess('Deuda cobrada exitosamente');
                });
            }
        });
    } catch (e) {
        showError('Error al procesar IDs: ' + e.message);
    }
}

function cargarCorteAdmin() {
    const myId = localStorage.getItem('userId');
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    db.collection('transacciones')
        .where('vendedorId', '==', myId)
        .where('fecha', '>=', hoy)
        .orderBy('fecha', 'desc')
        .onSnapshot(snap => { 
            let totalCobrado = 0;
            let totalPendiente = 0; // NUEVO CONTADOR
            let count = 0;
            let htmlList = '<table class="table" style="margin-top:0;"><thead><tr><th>Hora</th><th>Items</th><th>Monto</th></tr></thead><tbody>';
            
            snap.forEach(d => {
                const t = d.data();
                count++;
                
                // SEPARAMOS EL DINERO REAL DE LA DEUDA
                if(t.estadoPago === 'pendiente') {
                    totalPendiente += t.monto;
                } else {
                    totalCobrado += t.monto;
                }
                
                const hora = t.fecha && t.fecha.toDate ? t.fecha.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--';
                
                // Lógica visual para la lista
                let montoDisplay = `$${t.monto.toFixed(2)}`;
                let estiloMonto = 'font-weight:bold; color:#fff;';
                
                if (t.estadoPago === 'pendiente') {
                    estiloMonto = 'font-weight:bold; color:#f59e0b;';
                    montoDisplay += ' <span style="font-size:9px; border:1px solid #f59e0b; padding:1px 3px; border-radius:3px;">PENDIENTE</span>';
                }

                htmlList += `<tr>
                    <td style="font-size:11px; color:var(--text-muted);">${hora}</td>
                    <td style="font-size:11px;">${t.articulo}</td>
                    <td style="${estiloMonto}">${montoDisplay}</td>
                </tr>`;
            });
            
            if(count === 0) htmlList = '<tr><td colspan="3" style="text-align:center; padding:20px; color:var(--text-muted);">Sin ventas hoy</td></tr>';

            // REGENERAMOS EL HTML DE LAS TARJETAS (STATS GRID) DESDE JS
            // Así no tienes que editar el HTML manualmente
            const statsHTML = `
            <h4>Resumen de Ventas (Sesión Actual)</h4>
            <div class="stats-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom: 20px;">
                <div class="stat-box" style="background:var(--bg-input); padding:10px; border-radius:8px; text-align:center; border:1px solid var(--border-color);">
                    <div style="font-size:20px; font-weight:bold; color:#22c55e;">$${totalCobrado.toFixed(2)}</div>
                    <div style="font-size:11px; color:var(--text-muted);">Cobrado</div>
                </div>
                <div class="stat-box" style="background:var(--bg-input); padding:10px; border-radius:8px; text-align:center; border:1px solid var(--border-color);">
                    <div style="font-size:20px; font-weight:bold; color:#f59e0b;">$${totalPendiente.toFixed(2)}</div>
                    <div style="font-size:11px; color:var(--text-muted);">Pendiente</div>
                </div>
                <div class="stat-box" style="background:var(--bg-input); padding:10px; border-radius:8px; text-align:center; border:1px solid var(--border-color);">
                    <div style="font-size:20px; font-weight:bold; color:#fff;">${count}</div>
                    <div style="font-size:11px; color:var(--text-muted);"># Ventas</div>
                </div>
            </div>`;

            // Inyectamos todo en el contenedor
            const tabCorte = document.getElementById('pos-tab-corte');
            tabCorte.innerHTML = statsHTML + `<div class="table-container">${htmlList}</tbody></table></div>`;
        });
}
// --- FUNCIÓN FALTANTE: FLUJO DE EFECTIVO ---
function pedirMontoEfectivo(total, origen) {
    Swal.fire({
        title: `Total: $${total.toFixed(2)}`,
        text: 'Ingresa con cuánto paga el cliente:',
        input: 'number',
        inputAttributes: { min: total, step: '0.50' },
        inputPlaceholder: 'Monto recibido...',
        showCancelButton: true,
        confirmButtonText: '💵 Cobrar',
        confirmButtonColor: '#22c55e',
        background: '#1e293b', color: '#fff',
        didOpen: () => {
            const input = Swal.getInput();
            input.value = total; // Sugerir el monto exacto
            input.select();
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const recibido = parseFloat(result.value);
            if (recibido < total) return showError('El monto es menor al total');
            
            const cambio = recibido - total;
            const carritoId = Date.now().toString();

            // Guardar la venta según el origen
            if (origen === 'admin') {
                // Usamos la función del Admin que ya incluye el EVENTO
                finalizarVentaAdmin(total, 'pago_efectivo', 'Venta Mostrador (Efectivo)', 0, 'efectivo', 'pagado', carritoId);
            } else {
                // Flujo Vendedor (si lo compartieran)
                // registrarTransaccion(...) 
            }

            // Mostrar Cambio
            Swal.fire({
                title: '¡Cobro Exitoso!',
                html: `<div style="font-size:20px; margin-bottom:10px;">Cambio a entregar:</div>
                       <div style="font-size:42px; font-weight:bold; color:#f59e0b;">$${cambio.toFixed(2)}</div>`,
                icon: 'success',
                confirmButtonText: 'Aceptar',
                background: '#1e293b', color: '#fff'
            });
        }
    });
}
