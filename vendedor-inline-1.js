const CHURCH_CONFIG = {
            nombre: "VENDEDOR",       // Título
            logoUrl: "logo.png",          // Ruta del logo
            colorPrincipal: "#3b82f6"     // Color principal
        };

        function aplicarIdentidad() {
            // 1. Cambiar Título de la pestaña
            document.title = `Vendedor - ${CHURCH_CONFIG.nombre}`;
            
            // 2. Inyectar Colores Dinámicos (Sobrescribe el naranja)
            document.documentElement.style.setProperty('--color-destacado', CHURCH_CONFIG.colorPrincipal);
            document.documentElement.style.setProperty('--color-precio', CHURCH_CONFIG.colorPrincipal);
            
            // 3. Esperar a que cargue el HTML para cambiar textos
            window.addEventListener('DOMContentLoaded', () => {
                const tituloTexto = document.querySelector('header h2');
                const logoImg = document.querySelector('.logo-header');
                
                if (tituloTexto) tituloTexto.textContent = CHURCH_CONFIG.nombre;
                if (logoImg) logoImg.src = CHURCH_CONFIG.logoUrl;
                
                console.log(`🎨 Identidad aplicada: ${CHURCH_CONFIG.nombre}`);
            });
        }
        
        // Ejecutar inmediatamente
        aplicarIdentidad();
