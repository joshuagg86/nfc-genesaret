// Configuración de SweetAlert2
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

// Sobrescribimos las funciones viejas con las nuevas
function showSuccess(message) {
    Toast.fire({ icon: 'success', title: message });
}

function showError(message) {
    Toast.fire({ icon: 'error', title: message });
}
        // --- GESTIÓN DE TEMAS ---
        function toggleTheme() {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('themePreference', isLight ? 'light' : 'dark');
            updateThemeIcon();
        }

        function updateThemeIcon() {
            const isLight = document.body.classList.contains('light-mode');
            const icon = document.getElementById('themeIcon');
            if (isLight) {
                icon.classList.remove('fa-sun');
                icon.classList.add('fa-moon');
            } else {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }

        // Cargar preferencia al inicio
        if (localStorage.getItem('themePreference') === 'light') {
            document.body.classList.add('light-mode');
        }
        updateThemeIcon();

        // --- SISTEMA DE SONIDOS ---
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        function playTone(freq, type, duration) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(); gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
            osc.stop(audioCtx.currentTime + duration);
        }

       function playSound(type) {
            // Silenciado temporalmente en pruebas de escritorio
            return;
        }

        // --- LÓGICA PRINCIPAL ---
        let currentUserId = localStorage.getItem('userId');
        let scannedPulsera = null;
        let carrito = [];
        let authInitialized = false;
        let productosGlobales = [];
        let categoriaActiva = 'Todo';
        let metodoPagoActual = 'nfc'; 
        let estadoTransferencia = 'pagado';
        let unsubscribeTransacciones = null;

        const unsubscribe = auth.onAuthStateChanged(user => {
            if (authInitialized) return;
            authInitialized = true;

            // 1. Verificación de seguridad (Igual que antes)
            if (!user || localStorage.getItem('userRole') !== 'vendedor') {
                localStorage.clear(); window.location.replace('index.html'); return;
            }

            // 2. Configuración de Usuario
            currentUserId = user.uid;
            localStorage.setItem('userId', user.uid);
            
            // Obtenemos el nombre para el saludo
            const nombreGuardado = localStorage.getItem('userName') || 'Vendedor';
            
            // A. Actualizamos el Header de la App
            document.getElementById('userName').textContent = nombreGuardado;
            
            // B. Actualizamos la Pantalla de Carga (NUEVO)
            // Tomamos solo el primer nombre para que sea más amigable (ej: "Joshua" en vez de "Joshua Gonzalez")
            const primerNombre = nombreGuardado.split(' ')[0];
            const loadNameEl = document.getElementById('loadingUserName');
            if(loadNameEl) loadNameEl.textContent = primerNombre;

            // 3. Configuración de Fecha (Igual que antes)
            const hoy = new Date();
            // Corrección de zona horaria local simple
            const year = hoy.getFullYear();
            const month = String(hoy.getMonth() + 1).padStart(2, '0');
            const day = String(hoy.getDate()).padStart(2, '0');
            const fechaLocal = `${year}-${month}-${day}`;
            
            const inputFecha = document.getElementById('filtroFechaCorte');
            if(inputFecha) inputFecha.value = fechaLocal;

            // 4. Carga de Datos (Igual que antes)
            loadProducts();
            cargarPulseras();
            loadMyTransactions(); 
            cargarPendientes(); 
            cambiarMetodoPago('nfc');

            // 5. ANIMACIÓN DE SALIDA (NUEVO) ✨
            // Esperamos 1.5 segundos para que se vea el saludo y luego quitamos la pantalla
            setTimeout(() => {
                const overlay = document.getElementById('loadingOverlay');
                if(overlay) overlay.classList.add('hidden');
            }, 1500);

            unsubscribe();
        });
        // --- CONTROL ANTI-DOBLE COBRO Y FEEDBACK HÁPTICO/AUDITIVO ---
        let isProcessingPayment = false;

        // Pitido estilo terminal POS mediante Web Audio API (no requiere archivos externos)
        function reproducirBeepExito() {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono alto agradable (La5)
                osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12);

                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start();
                osc.stop(audioCtx.currentTime + 0.15);
            } catch (e) {
                console.log("AudioContext no disponible o bloqueado por el navegador:", e);
            }
        }

        // Vibración háptica nativa en Android
        function dispararVibracionExito() {
            if (navigator.vibrate) {
                // Patrón: vibra 80ms, pausa 40ms, vibra 100ms
                navigator.vibrate([80, 40, 100]);
            }
        }

        // --- LOGOUT SEGURO (VENDEDOR) ---
        function logout() {
            Swal.fire({
                title: '¿Cerrar Sesión?',
                text: "Tendrás que ingresar tus datos nuevamente.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#334155',
                confirmButtonText: 'Sí, salir',
                cancelButtonText: 'Cancelar',
                background: '#1e293b',
                color: '#ffffff'
            }).then((result) => {
                if (result.isConfirmed) {
                    auth.signOut().then(() => {
                        localStorage.clear();
                        window.location.href = 'index.html';
                    });
                }
            });
        }
        
        function showSuccess(msg) { const a=document.getElementById('successAlert'); a.textContent=msg; a.classList.add('show'); setTimeout(()=>a.classList.remove('show'),3000); }
        function showError(msg) { playSound('error'); const a=document.getElementById('errorAlert'); a.textContent=msg; a.classList.add('show'); setTimeout(()=>a.classList.remove('show'),3000); }

        function cambiarPestana(tabId, btn) {
            // 1. Cambio visual de pestañas (Lo que ya tenías)
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.sub-tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            btn.classList.add('active');

            // 2. --- LÓGICA DE ACTUALIZACIÓN AUTOMÁTICA ---
            // Si entras a "Mi Corte", recargamos las transacciones al instante.
            if (tabId === 'corte') {
                // Pequeño indicador visual de que está actualizando
                const lista = document.getElementById('transactionsList');
                if(lista) lista.style.opacity = '0.5'; 
                
                loadMyTransactions(); // <--- ESTA ES LA CLAVE
                
                // Restauramos opacidad tras un momento breve
                setTimeout(() => { if(lista) lista.style.opacity = '1'; }, 300);
            }
            
            // Si entras a "Pendientes", recargamos la lista de fiados.
            if (tabId === 'pendientes') {
                cargarPendientes();
            }
            
            // Si entras a "Venta", nos aseguramos que el foco esté en el lector o catálogo
            if (tabId === 'venta') {
               // Opcional: podrías poner foco en algún input si quisieras
            }
        }

        function cambiarMetodoPago(metodo) {
            metodoPagoActual = metodo;
            document.querySelectorAll('.pm-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById('pm-' + metodo).classList.add('active');
            const seccionNFC = document.getElementById('seccionNFC');
            const seccionDirecto = document.getElementById('seccionPagoDirecto');
            const inputsTransf = document.getElementById('inputsTransferencia');

            if (metodo === 'nfc') { seccionNFC.style.display = 'block'; seccionDirecto.style.display = 'none'; } 
            else {
                seccionNFC.style.display = 'none'; seccionDirecto.style.display = 'block';
                inputsTransf.style.display = 'block';
                setEstadoTransferencia('pagado');
            }
        }
        function setEstadoTransferencia(estado) {
            estadoTransferencia = estado;
            const showName = estado === 'pendiente' || metodoPagoActual === 'transferencia';
            document.getElementById('nombreClienteTransferencia').style.display = showName ? 'block' : 'none';
            document.getElementById('directCustomerLabel').style.display = showName ? 'block' : 'none';
            document.getElementById('btnPagarDirecto').textContent = estado === 'pendiente' ? 'Registrar venta fiada' : 'Registrar venta';
            document.getElementById('btnStatusPagado').className = 'status-btn ' + (estado==='pagado' ? 'active-pagado' : '');
            document.getElementById('btnStatusPendiente').className = 'status-btn ' + (estado==='pendiente' ? 'active-pendiente' : '');
        }

        function loadProducts() {
            db.collection('eventos').where('activo', '==', true).get().then(snap => {
                let html = '';
                let primerEventoId = '';
                
                snap.forEach((doc, idx) => {
                    if (!primerEventoId) primerEventoId = doc.id;
                    html += `<option value="${doc.id}">${doc.data().nombre}</option>`;
                });
                
                const sel = document.getElementById('eventSelect');
                if (sel) {
                    sel.innerHTML = html;
                    // Si hay evento activo, lo selecciona solo y carga el catálogo de inmediato
                    if (primerEventoId) {
                        sel.value = primerEventoId;
                        cargarProductosPorEvento();
                    }
                }
            });
        }
        function separarEmoji(texto) {
            if (!texto || texto === 'Todo') return { emoji: '🔎', nombre: 'Todo' };
            const partes = texto.split(' ');
            if (partes.length > 1) return { emoji: partes[0], nombre: partes.slice(1).join(' ') };
            return { emoji: '📦', nombre: texto };
        }
        let catalogUnsubscribe = null;
let catalogEvent = '';
let showAllProducts = true;
function toggleCatalogScope() {
    showAllProducts = !showAllProducts;
    const button = document.getElementById('catalogScope');
    button.textContent = showAllProducts ? 'Ver mi puesto' : 'Ver todos los productos';
    button.setAttribute('aria-pressed', String(showAllProducts));
    cargarProductosPorEvento();
}
function cargarProductosPorEvento() {
    const eventId = document.getElementById('eventSelect').value;
    const container = document.getElementById('contenedorProductos');
    const tabs = document.getElementById('categoryTabs');
    if (catalogUnsubscribe) { catalogUnsubscribe(); catalogUnsubscribe = null; }
    if (catalogEvent !== eventId) {
        if (carrito.length) vaciarCarrito();
        catalogEvent = eventId;
    }
    productosGlobales = [];
    if (!eventId) { container.textContent = 'Selecciona un evento'; tabs.innerHTML = ''; return; }
    const uid = auth.currentUser?.uid;
    catalogUnsubscribe = db.collection('articulos').where('eventId', '==', eventId).onSnapshot(snapshot => {
        const categories = new Set(['Todo']);
        productosGlobales = [];
        snapshot.forEach(doc => {
            const p = doc.data();
            if (!showAllProducts && p.vendedorAsignadoId && p.vendedorAsignadoId !== uid && p.vendedorAsignadoId !== 'todos') return;
            const categoria = p.categoria || 'Otros';
            categories.add(categoria);
            productosGlobales.push({ ...p, id: doc.id, categoria });
        });
        renderizarPestañas(Array.from(categories));
        categoriaActiva = 'Todo';
        renderizarGridProductos();
    }, error => { container.textContent = 'No se pudo cargar el catálogo'; showError(error.message); });
}
        function renderizarPestañas(cats) {
            const tabs = document.getElementById('categoryTabs'); let html = '';
            cats.sort((a,b) => (a==='Todo')?-1:(b==='Todo')?1:a.localeCompare(b));
            cats.forEach(c => {
                const d = separarEmoji(c); html += `<button class="cat-tab ${c==='Todo'?'active':''}" onclick="filtrarPorCategoria('${c}', this)"><span>${d.emoji}</span> ${d.nombre}</button>`;
            });
            tabs.innerHTML = html;
        }
        function filtrarPorCategoria(c, el) {
            document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active')); if(el) el.classList.add('active');
            categoriaActiva = c; renderizarGridProductos();
        }
        function renderizarGridProductos() {
            const container = document.getElementById('contenedorProductos');
            
            // 1. Obtener texto del buscador
            const textoBusqueda = document.getElementById('buscadorVendedor') ? document.getElementById('buscadorVendedor').value.toLowerCase() : '';
            
            let filtrados = productosGlobales; 

            // 2. Filtro por Categoría
            if (categoriaActiva !== 'Todo') {
                filtrados = productosGlobales.filter(p => p.categoria === categoriaActiva);
            }
            
            // 3. Filtro por Texto
            if (textoBusqueda) {
                filtrados = filtrados.filter(p => p.nombre.toLowerCase().includes(textoBusqueda));
            }
            
            if (filtrados.length === 0) { 
                container.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p class="empty-desc">No encontramos productos con ese nombre</p></div>'; 
                return; 
            }
            
            let html = '<div class="productos-grid">';
            
            filtrados.forEach(p => {
                const d = separarEmoji(p.categoria);
                
                // --- CORRECCIONES DE SEGURIDAD ---
                // 1. Validar Stock
                const stockActual = (p.stock !== undefined && p.stock !== null) ? p.stock : 0;
                
                // 2. Validar Precio (ESTO ARREGLA EL $NaN)
                // Intentamos convertir a número. Si falla (NaN), usamos 0.
                const precioSeguro = parseFloat(p.precio) || 0;

                // Condición de Agotado
                const sinStock = !p.esInfinito && stockActual <= 0;

                let stockHTML = '';
                let estilosCard = '';
                let clickAction = '';

                // --- LÓGICA VISUAL ---
                if (p.esInfinito) {
                    stockHTML = '<span style="font-size:11px; color:#3b82f6; font-weight:bold; background:rgba(59, 130, 246,0.1); padding:2px 6px; border-radius:4px;">♾️ Infinito</span>';
                    clickAction = `onclick="agregarDirecto('${p.id}')"`;
                    estilosCard = 'cursor: pointer;';
                } else {
                    if (sinStock) {
                        stockHTML = '<span style="font-size:11px; background:#334155; color:#cbd5e1; padding:2px 6px; border-radius:4px; font-weight:bold;">AGOTADO</span>';
                        estilosCard = 'filter: grayscale(1); opacity: 0.6; pointer-events: none; cursor: not-allowed;';
                        clickAction = ''; 
                    } else {
                        const colorStock = stockActual < 5 ? '#ef4444' : 'var(--text-muted)';
                        const bgStock = stockActual < 5 ? 'rgba(239,68,68,0.1)' : 'transparent';
                        stockHTML = `<span style="font-size:11px; color:${colorStock}; background:${bgStock}; padding:2px 6px; border-radius:4px; font-weight:600;">${stockActual} disp.</span>`;
                        clickAction = `onclick="agregarDirecto('${p.id}')"`;
                        estilosCard = 'cursor: pointer;';
                    }
                }

                html += `<div class="producto-card" ${clickAction} style="${estilosCard} transition: all 0.2s;">
                            <div class="prod-emoji">${GenesaretCheckout.foodIcon(p.nombre,d.emoji)}</div>
                            <div class="prod-info">
                                <div class="prod-nombre">${p.nombre}</div>
                                <div class="prod-precio">$${precioSeguro.toFixed(2)}</div>
                                <div style="margin-top:auto; padding-top:5px;">${stockHTML}</div>
                            </div>
                        </div>`;
            });
            container.innerHTML = html + '</div>';
        }

        let customizingProduct=false;
        async function agregarDirecto(id) {
            if (isProcessingPayment||customizingProduct) return;
            const p=productosGlobales.find(p=>p.id===id);if(!p)return;
            const event=document.getElementById('eventSelect').value;
            customizingProduct=true;
            try {
                const detail=await GenesaretCheckout.customize(p);
                if(!detail||isProcessingPayment||event!==document.getElementById('eventSelect').value)return;
                const qty=carrito.filter(x=>x.id===id).reduce((a,x)=>a+x.cantidad,0);
                if(!p.esInfinito&&qty+1>p.stock)return showError('Stock insuficiente');
                const key=GenesaretCheckout.variantKey(id,detail.selection);
                const item=carrito.find(x=>GenesaretCheckout.variantKey(x.id,x.selection)===key);
                if(item)item.cantidad++;else carrito.push({id,nombre:p.nombre,precio:detail.price/100,cantidad:1,esInfinito:p.esInfinito,stock:p.stock,selection:detail.selection,notes:detail.notes});
                renderizarCarrito();
            }catch(e){showError(e.message);}finally{customizingProduct=false;}
        }
        function cambiarCantidad(idx, d) {
    if (isProcessingPayment || !carrito[idx]) return;
    const item = carrito[idx];
    const product = productosGlobales.find(p => p.id === item.id);
    const limit = product ? product.stock : item.stock;
    if (d > 0 && !item.esInfinito && carrito.filter(x=>x.id===item.id).reduce((a,x)=>a+x.cantidad,0) + d > limit) return showError('Stock insuficiente');
    item.cantidad += d;
    if (item.cantidad <= 0) carrito.splice(idx, 1);
    renderizarCarrito();
}
        function eliminarDelCarrito(idx) { if (isProcessingPayment) return; carrito.splice(idx, 1); renderizarCarrito(); }
        function vaciarCarrito(force = false) { if (isProcessingPayment && !force) return; carrito = []; renderizarCarrito(); }
        
        function renderizarCarrito() {
            const cont = document.getElementById('carritoItems'); 
            const btnNFC = document.getElementById('btnPagarNFC');
            const totalDisplay = document.getElementById('headerTotalDisplay');
            let total = 0;
            if (carrito.length === 0) { 
                cont.innerHTML = `<div class="carrito-vacio"><i class="fas fa-shopping-basket"></i><p>El carrito está esperando productos</p></div>`; 
                if(btnNFC) btnNFC.style.display = 'none'; 
                totalDisplay.textContent = '$0.00'; return; 
            }
            let html='';
            carrito.forEach((it, ix) => {
                const sub = it.precio * it.cantidad; total += sub;
                html += `
                    <div class="carrito-item">
                        <span class="cart-food-icon" aria-hidden="true">${GenesaretCheckout.foodIcon(it.nombre)}</span><div class="carrito-item-info">
                            <div class="carrito-item-nombre">${GenesaretCheckout.escapeHtml(it.nombre)}</div>${(it.notes||[]).map(n=>`<small style="display:block;color:var(--text-muted)">${GenesaretCheckout.escapeHtml(n)}</small>`).join("")}
                            <div class="carrito-item-precio">$${it.precio.toFixed(2)} c/u</div>
                        </div>
                        <div class="carrito-item-cantidad">
                            <button class="qty-btn" onclick="cambiarCantidad(${ix}, -1)"><i class="fas fa-minus" style="font-size:10px;"></i></button>
                            <span class="qty-val">${it.cantidad}</span>
                            <button class="qty-btn" onclick="cambiarCantidad(${ix}, 1)"><i class="fas fa-plus" style="font-size:10px;"></i></button>
                        </div>
                        <div class="carrito-item-subtotal">$${sub.toFixed(2)}</div>
                        <button class="btn-eliminar-item" onclick="eliminarDelCarrito(${ix})"><i class="fas fa-trash-alt"></i></button>
                    </div>`;
            });
            cont.innerHTML = html; totalDisplay.textContent = '$' + total.toFixed(2);
            if(btnNFC) btnNFC.style.display = 'block';
        }
        function obtenerTotalCarrito() { return carrito.reduce((s, i) => s + (i.precio * i.cantidad), 0); }

        // --- NFC ---
        function startNFCRead() {
            if (carrito.length === 0) { showError('Agrega productos primero'); return; }
            if (!('NDEFReader' in window)) { showError('Navegador sin soporte NFC'); return; }
            if (audioCtx.state === 'suspended') audioCtx.resume();
            
            document.getElementById('nfcReader').innerHTML = `<div class="nfc-icon">⏳</div><div class="nfc-status">Acerca el gafete...</div>`;
            
            const ndef = new NDEFReader();
            ndef.scan().then(() => {
                ndef.onreading = event => {
                    // Leemos el UID de fábrica del NTAG213
                    let id = event.serialNumber;
                    
                    if (!id && event.message && event.message.records) {
                        for (const r of event.message.records) {
                            if (r.recordType === 'text') {
                                id = new TextDecoder().decode(r.data);
                                break;
                            }
                        }
                    }
                    
                    if (id) {
                        id = id.replace(/:/g, '').toUpperCase();
                        readPulseraData(id);
                    } else {
                        showError('Chip sin identificador');
                        resetScan();
                    }
                };
            }).catch(e => {
                showError('Error NFC: ' + (e.message || e));
                resetScan();
            });
        }
       function readPulseraData(id) {
            // Si ya hay un cobro en curso, ignora cualquier lectura fantasma del chip
            if (isProcessingPayment) return;

            db.collection('pulseras').where('id', '==', id).get().then(snap => {
                if (snap.empty) { 
                    showError('Pulsera no encontrada'); 
                    resetScan(); 
                    return; 
                }
                
                const doc = snap.docs[0];
                const p = doc.data();
                if (p.bloqueada) { 
                    showError('🔒 Pulsera Bloqueada'); 
                    resetScan(); 
                    return; 
                }

                scannedPulsera = { id: doc.id, nombre: p.nombre, saldo: p.saldoActual };
                
                const total = obtenerTotalCarrito();
                if (total > 0) {
                    if (scannedPulsera.saldo < total) {
                        showError(`Saldo insuficiente ($${scannedPulsera.saldo.toFixed(2)})`);
                        resetScan();
                        return;
                    }
                    // Disparar cobro directo protegido
                    ejecutarCobroInmediatoNFC();
                } else {
                    mostrarPulseraDetectada();
                }
            }).catch(err => {
                console.error("Error leyendo pulsera:", err);
                isProcessingPayment = false;
            });
        }
        function ejecutarCobroInmediatoNFC() {
    if (isProcessingPayment || !scannedPulsera || !carrito.length || metodoPagoActual !== 'nfc') return;
    const eventId = document.getElementById('eventSelect').value;
    registrarTransaccion(eventId, scannedPulsera.id, scannedPulsera.nombre, 0, 'nfc', 'pagado', db.collection('transacciones').doc().id);
}
        function mostrarPulseraDetectada() {
            document.getElementById('saldoInfo').classList.add('show'); document.getElementById('saldoActual').textContent = scannedPulsera.saldo.toFixed(2);
            document.getElementById('nfcReader').innerHTML = `<div class="nfc-icon">✅</div><div class="nfc-status"><strong>${scannedPulsera.nombre}</strong></div>`;
        }
        function resetScan() {
            scannedPulsera = null; document.getElementById('nfcReader').innerHTML = `<div class="nfc-icon">📱</div><div class="nfc-status">Escanea para cobrar</div><button class="btn-primary" onclick="startNFCRead()">Leer NFC</button>`;
            document.getElementById('saldoInfo').classList.remove('show'); document.getElementById('simulatedPulsera').value = '';
        }
        function selectSimulatedPulsera() {
            const val = document.getElementById('simulatedPulsera').value;
            if (!val) { resetScan(); return; }
            const [id, nom, sal] = val.split('|');

            db.collection('pulseras').doc(id).get().then(doc => {
                const p = doc.data();
                if (p.bloqueada) { showError('🔒 Bloqueada'); document.getElementById('simulatedPulsera').value=''; return; }
                
                scannedPulsera = { id, nombre: nom, saldo: parseFloat(sal) };
                const total = obtenerTotalCarrito();
                if (total > 0) {
                    if (scannedPulsera.saldo < total) {
                        showError(`Saldo insuficiente ($${scannedPulsera.saldo.toFixed(2)})`);
                        return;
                    }
                    ejecutarCobroInmediatoNFC();
                } else {
                    mostrarPulseraDetectada();
                }
            });
        }
        function startNFCReadConsulta() {
            if (!('NDEFReader' in window)) { showError('Navegador sin soporte NFC'); return; }
            if (audioCtx.state === 'suspended') audioCtx.resume();
            
            document.getElementById('nfcReaderConsulta').innerHTML = `<div class="nfc-icon">⏳</div><div class="nfc-status">Acerca el gafete...</div>`;
            
            const ndef = new NDEFReader();
            ndef.scan().then(() => {
                ndef.onreading = event => {
                    let id = event.serialNumber;
                    
                    if (!id && event.message && event.message.records) {
                        for (const r of event.message.records) {
                            if (r.recordType === 'text') {
                                id = new TextDecoder().decode(r.data);
                                break;
                            }
                        }
                    }
                    
                    if (id) {
                        id = id.replace(/:/g, '').toUpperCase();
                        leerPulseraConsulta(id);
                    } else {
                        showError('Chip sin identificador');
                        resetConsulta();
                    }
                };
            }).catch(e => {
                showError('Error NFC: ' + (e.message || e));
                resetConsulta();
            });
        }
        function leerPulseraConsulta(id) {
            db.collection('pulseras').where('id', '==', id).get().then(snap => {
                if (snap.empty) { showError('No encontrada'); resetConsulta(); return; }
                snap.forEach(doc => {
                    const p = doc.data();
                    document.getElementById('consultaNombre').textContent = p.nombre; document.getElementById('consultaSaldo').textContent = p.saldoActual.toFixed(2);
                    document.getElementById('saldoInfoConsulta').style.display = 'block'; document.getElementById('nfcReaderConsulta').innerHTML = `<div class="nfc-icon">✅</div><div class="nfc-status">Leída correctamente</div>`;
                    playSound('scan');
                });
            });
        }
        function consultarSaldoSimulado() {
            const val = document.getElementById('simulatedPulseraConsulta').value; if (!val) { resetConsulta(); return; }
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const [id, nom, sal] = val.split('|');
            document.getElementById('consultaNombre').textContent = nom; document.getElementById('consultaSaldo').textContent = parseFloat(sal).toFixed(2);
            document.getElementById('saldoInfoConsulta').style.display = 'block'; document.getElementById('nfcReaderConsulta').innerHTML = `<div class="nfc-icon">✅</div><div class="nfc-status">Simulación activa</div>`;
            playSound('scan');
        }
        function resetConsulta() {
            document.getElementById('nfcReaderConsulta').innerHTML = `<div class="nfc-icon">📱</div><div class="nfc-status">Escanea para ver saldo</div><button class="btn-primary" onclick="startNFCReadConsulta()">Leer NFC</button>`;
            document.getElementById('saldoInfoConsulta').style.display = 'none'; document.getElementById('simulatedPulseraConsulta').value = '';
            document.getElementById('consultaNombre').textContent = '-'; document.getElementById('consultaSaldo').textContent = '0.00';
        }
        function cargarPulseras() {
            db.collection('pulseras').onSnapshot(snap => {
                let s = '<option value="">Selecciona para cobrar...</option>', c = '<option value="">Simular lectura...</option>';
                snap.forEach(doc => {
                    const p = doc.data(), b = p.bloqueada ? ' (🔒)' : '', v = `${doc.id}|${p.nombre}|${p.saldoActual}`;
                    s += `<option value="${v}">${p.nombre} - $${p.saldoActual.toFixed(2)}${b}</option>`; c += `<option value="${v}">${p.nombre} - $${p.saldoActual.toFixed(2)}${b}</option>`;
                });
                document.getElementById('simulatedPulsera').innerHTML = s; document.getElementById('simulatedPulseraConsulta').innerHTML = c;
            });
        }

        // --- PROCESAMIENTO PAGO ---
        function procesarPago() {
            if (isProcessingPayment) return;
            if (carrito.length === 0) { showError('Carrito vacío'); return; }
            
            // Reactivar AudioContext si está suspendido (navegadores modernos)
            if (audioCtx.state === 'suspended') audioCtx.resume();
            
            const btnNFC = document.getElementById('btnPagarNFC');
            const btnDirecto = document.getElementById('btnPagarDirecto'); // El botón verde de registrar
            
            // Deshabilitar botones para evitar doble venta
            if(btnNFC) btnNFC.disabled = true;
            if(btnDirecto) btnDirecto.disabled = true;

            const total = obtenerTotalCarrito(); 
            const eventId = document.getElementById('eventSelect').value;
            const carritoId = db.collection('transacciones').doc().id;

            // --- LÓGICA DE PAGO NFC ---
            if (metodoPagoActual === 'nfc') {
                if (!scannedPulsera) { 
                    showError('Falta escanear pulsera'); 
                    if(btnNFC) btnNFC.disabled = false; 
                    return; 
                }
                if (scannedPulsera.saldo < total) { 
                    showError('Saldo insuficiente'); 
                    if(btnNFC) btnNFC.disabled = false; 
                    return; 
                }
                ejecutarCobroInmediatoNFC();

            // --- LÓGICA DE PAGO DIRECTO (Efectivo / Transferencia) ---
            } else {
                
                if (metodoPagoActual === 'efectivo' && estadoTransferencia === 'pagado') {
                    pedirMontoEfectivo(total);
                    return;
                }
                const estado = estadoTransferencia;
                const inputNombre = document.getElementById('nombreClienteTransferencia').value.trim();
                if (estado === 'pendiente' && !inputNombre) {
                    showError('Escribe el nombre del cliente para fiar');
                    if (btnDirecto) btnDirecto.disabled = false;
                    return;
                }
                const nombreCliente = inputNombre || 'Cliente Transferencia';
                const idCliente = (metodoPagoActual === 'efectivo' ? 'efectivo_' : 'transf_') + carritoId;
                registrarTransaccion(eventId, idCliente, nombreCliente, 0, metodoPagoActual, estado, carritoId);
            }
        }

        async function registrarTransaccion(eventId, pulseraId, pulseraNombre, saldoNuevo, metodo, estado, carritoId) {
    if (isProcessingPayment) return;
    isProcessingPayment = true;
    const eventSelector = document.getElementById('eventSelect');
    eventSelector.disabled = true;
    const items = carrito.map(i => ({...i}));
    const total = obtenerTotalCarrito();
    try {
        const result = await GenesaretCheckout.commit({db, auth, eventId, items, pulseraId, pulseraNombre, metodo, estado, carritoId});
        if (estado === 'pagado') playSound('success');
        mostrarConfirmacionPago(total, pulseraNombre, result.saldoNuevo, metodo, estado, result.numeroPedido);
        vaciarCarrito(true);
        if (metodo === 'nfc') resetScan();
        document.getElementById('nombreClienteTransferencia').value = '';
        setEstadoTransferencia('pagado');
        loadMyTransactions();
    } catch (error) {
        showError(error.message);
    } finally {
        isProcessingPayment = false;
        eventSelector.disabled = false;
        const btnNFC = document.getElementById('btnPagarNFC');
        const btnDirecto = document.getElementById('btnPagarDirecto');
        if (btnNFC) btnNFC.disabled = false;
        if (btnDirecto) btnDirecto.disabled = false;
    }
}
        
        let interval;
        function mostrarConfirmacionPago(total, cliente, saldo, metodo, estado, numeroPedido) {
            document.getElementById('sellerPaymentTitle').textContent = estado === 'pendiente' ? 'Venta fiada registrada' : '¡Pago Exitoso!';
            document.getElementById('confirmarMonto').textContent = '$'+total.toFixed(2);
            document.getElementById('confirmarProducto').textContent = numeroPedido ? 'Pedido ' + numeroPedido : 'Venta sin folio de pedido';
            document.getElementById('confirmarCliente').textContent = cliente;
            let txtMetodo = metodo === 'nfc' ? 'Pulsera NFC' : (metodo === 'efectivo' ? 'Efectivo' : 'Transferencia');
            if (estado === 'pendiente') txtMetodo += ' (PENDIENTE)';
            document.getElementById('confirmarMetodo').textContent = txtMetodo;
            if (metodo === 'nfc') { document.getElementById('confirmarSaldoNuevo').textContent = '$'+saldo.toFixed(2); document.getElementById('confirmarSaldoNuevo').parentElement.style.display = 'block'; }
            else { document.getElementById('confirmarSaldoNuevo').parentElement.style.display = 'none'; }
            document.getElementById('pagoConfirmadoOverlay').classList.add('active');
            let s = 4; document.getElementById('contadorCierre').textContent = s;
            interval = setInterval(() => { s--; document.getElementById('contadorCierre').textContent = s; if(s<=0) cerrarConfirmacion(); }, 1000);
        }
        function cerrarConfirmacion() { document.getElementById('pagoConfirmadoOverlay').classList.remove('active'); if(interval) clearInterval(interval); }

        let pendingUnsubscribe = null;
        function cargarPendientes() {
            if (!currentUserId) return;
            if (pendingUnsubscribe) pendingUnsubscribe();
            pendingUnsubscribe = db.collection('transacciones').where('vendedorId','==',currentUserId).onSnapshot(snapshot => {
                const lista = document.getElementById('listaPendientesContainer');
                const badge = document.getElementById('tabBadgePendientes');
                lista.replaceChildren();
                const grupos = new Map();
                snapshot.forEach(doc => {
                    const t = doc.data();
                    if (t.estadoPago !== 'pendiente') return;
                    const key = t.carritoId || doc.id;
                    if (!grupos.has(key)) grupos.set(key,{nombre:String(t.pulsera||'Cliente').replace(/ \\(Transferencia\\)$/,''), monto:0, items:[], ids:[], metodo:t.metodoPago});
                    const g = grupos.get(key);
                    g.monto += Number(t.monto)||0; g.items.push((t.cantidad||1)+' × '+(t.articulo||'Producto'));g.ids.push(doc.id);
                });
                badge.textContent = grupos.size;
                badge.style.display = grupos.size ? 'inline-block' : 'none';
                if (!grupos.size) {lista.textContent='No hay cuentas pendientes por cobrar';return;}
                for (const g of grupos.values()) {
                    const card=document.createElement('div');card.className='pendiente-item';
                    const info=document.createElement('div');info.className='pendiente-info';
                    for (const [tag,value] of [['h4',g.nombre],['p',g.items.join(', ')],['p',g.metodo==='efectivo'?'Efectivo':'Transferencia'],['strong','$'+g.monto.toFixed(2)]]) {
                        const node=document.createElement(tag);node.textContent=value;info.append(node);
                    }
                    const btn=document.createElement('button');btn.className='btn-cobrar-pendiente';btn.textContent='Cobrar';btn.onclick=()=>confirmarPagoPendiente(btn,g);
                    card.append(info,btn);lista.append(card);
                }
            },error=>showError(error.message));
        }
        async function confirmarPagoPendiente(btn,g) {
            btn.disabled=true;
            try {
                const result=await Swal.fire({title:'¿Confirmar cobro?',text:g.nombre+' · $'+g.monto.toFixed(2)+' · '+(g.metodo==='efectivo'?'Efectivo':'Transferencia'),icon:'question',showCancelButton:true,confirmButtonText:'Confirmar dinero recibido',cancelButtonText:'Cancelar',background:'#102437',color:'#fff'});
                if (!result.isConfirmed) return;
                await db.runTransaction(async tx=>{
                    const refs=g.ids.map(id=>db.collection('transacciones').doc(id));
                    const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
                    if(docs.some(doc=>!doc.exists||doc.data().estadoPago!=='pendiente'||doc.data().vendedorId!==auth.currentUser?.uid)) throw Error('La cuenta cambió o ya fue cobrada');
                    const amount=docs.reduce((sum,doc)=>sum+Math.round(Number(doc.data().monto)*100),0);
                    if(amount!==Math.round(g.monto*100)) throw Error('El importe cambió');
                    const now=new Date();
                    refs.forEach((ref,i)=>tx.update(ref,{estadoPago:'pagado',fechaVenta:docs[i].data().fechaVenta||docs[i].data().fecha||now,fecha:now,fechaPago:now}));
                });
                playSound('success');showSuccess('Cobro registrado');loadMyTransactions();
            } catch(error){showError(error.message);} finally{btn.disabled=false;}
        }

        // --- DASHBOARD ---
function loadMyTransactions() {
    const myId = currentUserId || localStorage.getItem('userId');
    if (!myId) return;

    const inputFecha = document.getElementById('filtroFechaCorte');
    const now = new Date();
    const hoyStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (!inputFecha.value) inputFecha.value = hoyStr;
    const fechaStr = inputFecha.value;

    const startOfDay = new Date(fechaStr + 'T00:00:00').getTime();
    const endOfDay = new Date(fechaStr + 'T23:59:59').getTime();

    if (unsubscribeTransacciones) unsubscribeTransacciones();

    // Consulta limpia: SOLO por vendedor para evitar bloqueo de índices de Firebase
    unsubscribeTransacciones = db.collection('transacciones')
        .where('vendedorId', '==', myId)
        .onSnapshot(snap => {
            const trans = [];
            
            snap.forEach(d => {
                const data = d.data();
                const fMillis = data.fecha?.toDate ? data.fecha.toDate().getTime() : new Date(data.fecha || 0).getTime();
                // Filtramos el día en memoria
                if (fMillis >= startOfDay && fMillis <= endOfDay) {
                    trans.push({ id: d.id, ...data, millis: fMillis });
                }
            });

            // Ordenar del más reciente al más antiguo
            trans.sort((a, b) => b.millis - a.millis);

            let total = 0, subNFC = 0, subEfe = 0, subTrans = 0, subPend = 0;
            const articulosConteo = {};
            
            trans.forEach(t => {
                const m = parseFloat(t.monto) || 0;
                if (t.estadoPago === 'pendiente') subPend += m;
                else if (!['cancelado','anulado'].includes(t.estadoPago)) {
                    total += m;
                    if (t.metodoPago === 'efectivo') subEfe += m;
                    else if (t.metodoPago === 'transferencia') subTrans += m;
                    else subNFC += m;
                }

                if (t.articulo) {
                    articulosConteo[t.articulo] = (articulosConteo[t.articulo] || 0) + (t.cantidad || 1);
                }
            });

            // Actualizar tarjetas
            document.getElementById('totalVentas').textContent = total.toFixed(2);
            document.getElementById('ventasCount').textContent = trans.length;
            document.getElementById('totalNFC').textContent = subNFC.toFixed(2);
            document.getElementById('totalEfectivo').textContent = subEfe.toFixed(2);
            document.getElementById('totalTransf').textContent = subTrans.toFixed(2);
            document.getElementById('totalPendiente').textContent = subPend.toFixed(2);

            // Renderizar lista
            const listCont = document.getElementById('transactionsList');
            if (!listCont) return;

            if (trans.length === 0) {
                listCont.innerHTML = '<p style="color:var(--text-muted); font-size:12px; text-align:center; padding:15px;">Sin ventas registradas en esta fecha</p>';
                return;
            }

            let html = '';
            trans.slice(0, 15).forEach(t => {
                const dObj = new Date(t.millis);
                const hora = dObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                let metodoBadge = (t.metodoPago || 'NFC').toUpperCase();
                let estiloMonto = 'color: #3b82f6;';

                if (t.estadoPago === 'pendiente') {
                    metodoBadge += ' (PENDIENTE)';
                    estiloMonto = 'color: #ef4444;';
                }

                html += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">
                    <div>
                        <strong>${t.articulo || 'Varios'}</strong> <span style="color:var(--text-muted)">(${t.pulsera || 'Cliente'})</span>
                        <div style="font-size:10px; color:var(--text-muted)">${hora} · ${metodoBadge}</div>
                    </div>
                    <div style="font-weight:bold; ${estiloMonto}">$${(t.monto || 0).toFixed(2)}</div>
                </div>`;
            });
            listCont.innerHTML = html;

            // Top productos
            const topCont = document.getElementById('ventasPorArticulo');
            if (topCont) {
                const entries = Object.entries(articulosConteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
                let topHtml = '<div style="display:flex; flex-wrap:wrap; gap:8px;">';
                entries.forEach(([art, cant]) => {
                    topHtml += `<span style="background:rgba(255,255,255,0.05); border:1px solid var(--border-color); padding:3px 8px; border-radius:4px; font-size:11px;">${art}: <strong>${cant}</strong></span>`;
                });
                topCont.innerHTML = topHtml + '</div>';
            }
        }, err => {
            console.error("Error:", err);
            document.getElementById('transactionsList').innerHTML = `<p style="color:red; font-size:12px;">Error: ${err.message}</p>`;
        });
}

        document.addEventListener('keydown', (e) => {
            if (e.key === 'F1') { e.preventDefault(); cambiarMetodoPago('efectivo'); }
            if (e.key === 'F2') { e.preventDefault(); cambiarMetodoPago('nfc'); }
            if (e.code === 'Space' && carrito.length > 0 && e.target.tagName !== 'INPUT') {
                e.preventDefault(); 
                if (metodoPagoActual === 'nfc') startNFCRead();
                else {
                    const btnDirecto = document.getElementById('btnPagarDirecto');
                    if(btnDirecto && !btnDirecto.disabled) btnDirecto.click();
                }
            }
        });

        // --- LÓGICA LECTOR QR (VENDEDOR - CORREGIDA) ---
        let html5QrcodeScanner = null;

        // Forzamos que la función sea global usando 'window'
        window.cerrarScannerQR = function() {
            // 1. Ocultar visualmente primero (para que se sienta rápido)
            const modal = document.getElementById('modalQR');
            if (modal) modal.classList.remove('active');
            
            // 2. Detener la cámara si existe y está corriendo
            if (html5QrcodeScanner) {
                try {
                    html5QrcodeScanner.stop().then(() => {
                        console.log("Cámara detenida correctamente");
                        html5QrcodeScanner.clear();
                    }).catch(err => {
                        console.warn("La cámara ya estaba detenida o hubo un error menor:", err);
                        html5QrcodeScanner.clear();
                    });
                } catch (e) {
                    console.log("Error intentando detener cámara:", e);
                }
            }
        };

window.iniciarEscanerQR = function(modo) {
    // Aseguramos que el modal exista y lo mostramos
    const modal = document.getElementById('modalQR');
    if (!modal) { console.error("No encuentro el modalQR en el HTML"); return; }
    
    modal.classList.add('active');

    // Limpiamos instancia anterior si existiera colgada
    if (html5QrcodeScanner) { 
        try { html5QrcodeScanner.clear(); } catch(e){}
    }

    // Creamos nueva instancia
    html5QrcodeScanner = new Html5Qrcode("qr-reader");

    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };
    
    // Iniciar cámara
    html5QrcodeScanner.start({ facingMode: "environment" }, config, (decodedText) => {
        // --- ÉXITO AL LEER ---
        window.cerrarScannerQR(); // Cerramos inmediatamente
        
        const id = decodedText.trim();
        playSound('scan');

        // Lógica según el modo
        if (modo === 'cobro_nfc') {
            readPulseraData(id); 
        } 
        else if (modo === 'identificar_cliente') {
            identificarClientePorQR(id);
        }
        else if (modo === 'consulta') {
            leerPulseraConsulta(id); 
        }

    }).catch(err => {
        // Error al iniciar (ej. permisos denegados)
        console.log("Error cámara: ", err);
        // Opcional: mostrar alerta si es error de permisos
        if(err?.name === 'NotAllowedError') showError('⚠️ Permiso de cámara denegado');
    });
};
        


// Función auxiliar para llenar el nombre al escanear en Efectivo/Transferencia
function identificarClientePorQR(id) {
    db.collection('pulseras').where('id', '==', id).get().then(snap => {
        if (snap.empty) {
            showError('Usuario no encontrado');
            return;
        }
        snap.forEach(doc => {
            const p = doc.data();
            if (p.bloqueada) { showError('Usuario Bloqueado'); return; }
            
            // Llenamos el input de nombre
            const inputNombre = document.getElementById('nombreClienteTransferencia');
            inputNombre.value = p.nombre;
            
            // Forzamos que se muestre el input aunque sea Efectivo, para que veas quién es
            document.getElementById('inputsTransferencia').style.display = 'block';
            
            showSuccess(`Cliente identificado: ${p.nombre}`);
        });
    });
}
// --- CALCULADORA DE CAMBIO (VENDEDOR) ---
function pedirMontoEfectivo(total) {
    Swal.fire({
        title: `Total: $${total.toFixed(2)}`,
        text: "¿Con cuánto paga el cliente?",
        input: 'number',
        inputPlaceholder: 'Ej: 500',
        inputAttributes: { min: total, step: '0.50' },
        showCancelButton: true,
        confirmButtonText: 'Calcular Cambio',
        confirmButtonColor: '#3b82f6',
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
                    // Si confirma, procedemos a guardar la venta
                    const eventId = document.getElementById('eventSelect').value;
                    const carritoId = db.collection('transacciones').doc().id;
                    
                    // Llamamos directo a registrarTransaccion con los datos de efectivo
                    registrarTransaccion(eventId, 'pago_efectivo', 'Venta Mostrador (Efectivo)', 0, 'efectivo', 'pagado', carritoId);
                } else { document.getElementById('btnPagarDirecto').disabled = false; }
            });
        } else { document.getElementById('btnPagarDirecto').disabled = false; }
    });
}
