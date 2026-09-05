# NFC Genesaret - Sistema de Cobro para Eventos

## 🚀 Inicio Rápido

Esta es una aplicación web completa para gestionar pagos con pulseras NFC en eventos. Funciona **offline** y sincroniza datos en **tiempo real** con Firebase.

## 📋 Archivos

- **index.html** - Página de login (Admin y Vendedores)
- **admin.html** - Panel de administrador (crear eventos, pulseras, artículos, reportes)
- **vendedor.html** - Panel de vendedor (solo cobrar)
- **reportes.html** - Dashboard de reportes en tiempo real (tesorería/pastores)

## 🔧 Instalación en GitHub Pages

### Paso 1: Sube los archivos a tu repositorio

1. Ve a tu repositorio en GitHub: `https://github.com/tu-usuario/nfc-genesaret`
2. Click en "Add file" → "Upload files"
3. Selecciona todos los archivos HTML de esta carpeta
4. Commit los cambios

### Paso 2: Activa GitHub Pages

1. Ve a "Settings" del repositorio
2. Busca "Pages" en el menú izquierdo
3. En "Source", selecciona "main" y carpeta "root"
4. Click en "Save"

### Paso 3: Accede a tu app

Tu app estará en: `https://tu-usuario.github.io/nfc-genesaret/`

## 👥 Usuarios de Prueba

Para probar sin crear cuentas:

**Admin:**
- Email: admin@iglesia.com
- Contraseña: admin123
- Tipo: Administrador

**Vendedor:**
- Email: vendedor@iglesia.com
- Contraseña: vendedor123
- Tipo: Vendedor

## 📱 Funcionalidades

### Admin Panel
- ✅ Crear eventos
- ✅ Registrar pulseras NFC con nombre y saldo
- ✅ Gestionar artículos y precios
- ✅ Ver reportes en tiempo real
- ✅ Descargar reportes en HTML

### Panel Vendedor
- ✅ Seleccionar producto a vender
- ✅ Escanear pulsera NFC del cliente
- ✅ Realizar cobro automático
- ✅ Ver historial de ventas del día

### Dashboard de Reportes
- ✅ Estadísticas generales en tiempo real
- ✅ Top productos vendidos
- ✅ Top vendedores
- ✅ Historial completo de transacciones
- ✅ Estado de todas las pulseras
- ✅ Descargar reporte en HTML

## 🔐 Seguridad

- Autenticación con email/contraseña
- Cada rol tiene acceso diferente
- Los datos se guardan en Firebase Firestore
- Sincronización en tiempo real

## 📱 Compatibilidad

- ✅ Chrome/Edge (con soporte NFC)
- ✅ Safari (iOS 13.1+)
- ✅ Firefox
- ✅ Opera

**Nota:** Para leer pulseras NFC, necesitas un dispositivo compatible (teléfono Android con NFC, iPhone con NFC si usas Safari 13.1+)

## ⚙️ Configuración

La aplicación ya tiene configurada tu Firebase:
- **Proyecto:** nfc-genesaret
- **Base de datos:** Firestore
- **Autenticación:** Email/Contraseña

## 🛠️ Customización

Para cambiar colores, fuentes o diseño:
1. Abre cualquier `.html` en un editor de texto
2. Busca la sección `<style>`
3. Modifica los colores (por ejemplo, `#f59e0b` es el naranja)
4. Guarda y sube nuevamente a GitHub

## 📊 Uso en Evento Real

### Día Anterior
1. Entra como Admin
2. Crea un evento nuevo
3. Agrega los artículos (tamales $5, elote $3, etc.)

### Día del Evento - Mañana
1. **Banco:** Tú con tablet/laptop registrando pulseras
   - Lee cada pulsera NFC
   - Asigna nombre y saldo
2. **Puestos:** Los 12 vendedores ingresan
   - Login con su email/contraseña
   - Seleccionan su producto
   - Listos para vender

### Durante Evento
- Vendedores escanean pulsera + cobran
- Datos se sincronizan en tiempo real
- Tesorería ve reportes en vivo

### Después del Evento
- Admin descarga reporte HTML
- Tesorería obtiene todos los datos completos

## ❓ Preguntas Frecuentes

**¿Funciona sin internet?**
Sí, pero necesita internet inicial para la autenticación. Luego funciona offline.

**¿Puedo agregar más vendedores?**
Sí, crea nuevas cuentas en el registro. Solo selecciona "Vendedor" como tipo.

**¿Los datos se pierden si cierro el navegador?**
No, todo está en Firebase. Los datos persisten.

**¿Puedo usar esto en otra iglesia?**
Puedes, pero necesitarías tu propio proyecto de Firebase (es gratis).

## 📞 Soporte

Si necesitas ayuda:
1. Verifica que tengas internet
2. Limpia el cache del navegador (Ctrl+Shift+Del)
3. Vuelve a cargar la página

---

**Hecho con ❤️ para NFC Genesaret**
