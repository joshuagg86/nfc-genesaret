# Cafetería Genesaret · iteración web 1
Rama de revisión, no desplegar sobre producción antes de validar.
- Interfaz azul oscura y controles táctiles; vendedor con dos columnas en tablet y navegación inferior en móvil.
- Catálogo de puesto por defecto y acceso explícito a otros productos. Los productos sin asignación se consideran comunes.
- Checkout compartido con transacción Firestore, lectura de saldo y stock actual, identidad autenticada y registro de ventas fuera de puesto. Requiere conexión; no se debe aprobar un pago offline.
- Extracción de scripts y estilos de acceso; eliminación de recargas forzadas por versiones incompatibles.
- Pendiente: revisar reglas Firestore reales, recargas/anulaciones/simuladores, reportes por evento, stock mínimo, duplicados restantes, pruebas con Firebase Emulator y NFC físico, configuración Capacitor y compilación Android.
- Prueba manual: dos vendedores cobran misma pulsera simultáneamente; stock final no negativo; transferencia pendiente; efectivo cancelado; cambio de evento; QR y NFC; navegación tablet/móvil.
