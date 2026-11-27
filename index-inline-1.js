const rolePages={admin:'admin.html',vendedor:'vendedor.html',cocina:'cocina.html',tv:'tv-pedidos.html',autoservicio:'autoservicio.html'};
// Utilidades UI
        const showError = (msg) => {
            const el = document.getElementById('error');
            el.textContent = msg; el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 5000);
        };
        const showSuccess = (msg) => {
            const el = document.getElementById('success');
            el.textContent = msg; el.classList.add('show');
            setTimeout(() => el.classList.remove('show'), 5000);
        };
        const showLoading = (show) => document.getElementById('loading').classList.toggle('show', show);
        const toggleForms = () => {
            document.getElementById('loginForm').classList.toggle('active');
            document.getElementById('registerForm').classList.toggle('active');
            document.getElementById('error').classList.remove('show');
        };

        function login() {
        // 1. OBTENER DATOS (Con tus IDs correctos)
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        // 2. VALIDAR
        if (!email || !password) {
            Swal.fire({
                icon: 'warning',
                title: 'Faltan datos',
                text: 'Por favor ingresa tu correo y contraseña',
                background: '#1e293b',
                color: '#fff',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        // 3. ACTIVAR EFECTO DE CARGA (Ocultar Form -> Mostrar Loader)
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('loginLoader').style.display = 'block';

        // 4. INTENTAR INICIAR SESIÓN
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Éxito: Buscamos el rol en la base de datos
                return db.collection('usuarios').doc(userCredential.user.uid).get();
            })
            .then((doc) => {
                if (doc.exists && doc.data().activo!==false && rolePages[doc.data().role]) {
                    const role = doc.data().role;
                    const name = doc.data().name;
                    
                    // Guardar sesión local
                    localStorage.setItem('userRole', role);
                    localStorage.setItem('userName', name);
                    localStorage.setItem('userId', doc.id);

                    // Redirigir
                    window.location.href=rolePages[role];
                } else {
                    throw new Error("Usuario sin rol asignado.");
                }
            })
            .catch((error) => {
                // 5. SI FALLA: RESTAURAR EL FORMULARIO
                // Ocultamos el Loader y volvemos a mostrar el Formulario
                document.getElementById('loginLoader').style.display = 'none';
                document.getElementById('loginForm').style.display = 'block';

                console.error(error);
                
                // Mensajes de error amigables
                let msg = "Error al iniciar sesión";
                if(error.code === 'auth/wrong-password') msg = "La contraseña es incorrecta";
                if(error.code === 'auth/user-not-found') msg = "Este correo no está registrado";
                if(error.code === 'auth/invalid-email') msg = "El correo no es válido";
                if(error.code === 'auth/too-many-requests') msg = "Muchos intentos fallidos. Espera un momento.";

                Swal.fire({
                    icon: 'error',
                    title: 'No pudimos entrar',
                    text: msg,
                    background: '#1e293b',
                    color: '#fff',
                    confirmButtonColor: '#ef4444'
                });
            });
    }
        function guardarSesion(uid, role, name) {
            localStorage.setItem('userId', uid);
            localStorage.setItem('userRole', role);
            localStorage.setItem('userName', name);
            
            setTimeout(() => {
                window.location.href = rolePages[role]||'index.html';
            }, 500);
        }

        // ---  RECUPERAR CONTRASEÑA (CON CONFIRMACIÓN) ---
        function recuperarPassword() {
            const email = document.getElementById('loginEmail').value.trim();
            
            if (!email) {
                showError('⚠️ Por favor, escribe tu correo en el campo de Email primero.');
                document.getElementById('loginEmail').focus();
                return;
            }
            
            // CONFIRMACIÓN DE SEGURIDAD
            if(confirm(`¿Estás seguro que deseas restablecer la contraseña para: ${email}?\n\nTe enviaremos un correo.`)) {
                showLoading(true);
                auth.sendPasswordResetEmail(email)
                    .then(() => {
                        showSuccess('✅ Enlace enviado. Revisa tu correo (y la carpeta de Spam).');
                    })
                    .catch(e => {
                        if(e.code === 'auth/user-not-found') showError('Este correo no está registrado.');
                        else showError(e.message);
                    })
                    .finally(() => showLoading(false));
            }
        }

        // --- 3. REGISTRO ---
        function register() {
            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const confirm = document.getElementById('registerConfirm').value;

            if (!name || !email || !password) return showError('Completa los campos');
            if (password !== confirm) return showError('Las contraseñas no coinciden');
            if (password.length < 6) return showError('Mínimo 6 caracteres');

            showLoading(true);

            // Usar app secundaria para no cerrar sesión si ya hay una (aunque aquí no afecta tanto)
            const secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');
    if(window.GenesaretLocalTest) secondaryApp.auth().useEmulator('http://127.0.0.1:9099');
            
            secondaryApp.auth().createUserWithEmailAndPassword(email, password)
                .then(cred => {
                    return db.collection('usuarios').doc(cred.user.uid).set({
                        name: name, email: email, role: 'vendedor', createdAt: new Date(), activo: true
                    });
                })
                .then(() => {
                    secondaryApp.delete();
                    showSuccess('✅ Cuenta creada. Ya puedes iniciar sesión.');
                    toggleForms();
                    document.getElementById('loginEmail').value = email;
                })
                .catch(error => {
                    secondaryApp.delete();
                    if (error.code === 'auth/email-already-in-use') {
                        showError('⚠️ Este correo ya existe. Si olvidaste la clave, usa "Olvidé mi contraseña"');
                    } else {
                        showError(error.message);
                    }
                })
                .finally(() => showLoading(false));
        }

        // --- MANEJO DE ESTADO ---
        auth.onAuthStateChanged(user => {
            if (user) {
                // En lugar de leer localStorage (que puede estar viejo),
                // consultamos el rol REAL en la base de datos.
                db.collection('usuarios').doc(user.uid).get().then(doc => {
                    if (doc.exists && doc.data().activo!==false && rolePages[doc.data().role]) {
                        const realRole = doc.data().role;
                        
                        // Actualizamos la memoria para corregir cualquier error
                        localStorage.setItem('userRole', realRole);
                        localStorage.setItem('userId', user.uid);
                        
                        // Redirigimos basándonos EXCLUSIVAMENTE en la base de datos
                        window.location.replace(rolePages[realRole]);
                    } else {
                        // Si el usuario no existe en la BD (error raro), cerramos sesión por seguridad
                        console.error("Usuario autenticado pero no encontrado en BD");
                        auth.signOut();
                    }
                }).catch(error => {
                    console.error("Error verificando rol:", error);
                });
            }
            // Si no hay usuario, se queda en el login esperando (correcto)
        });
        
        // Enter para login
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const isLogin = document.getElementById('loginForm').classList.contains('active');
                isLogin ? login() : register();
            }
        });
        // --- FUNCIÓN PARA VER/OCULTAR CONTRASEÑA ---
        function togglePasswordVisibility() {
            // Ahora buscamos 'loginPassword'
            const input = document.getElementById('loginPassword');
            const icon = document.getElementById('togglePasswordBtn');
            
            if (input.type === 'password') {
                input.type = 'text'; 
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash'); 
            } else {
                input.type = 'password'; 
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye'); 
            }
        }
