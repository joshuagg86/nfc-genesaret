/* Shared online checkout. Firestore rules must enforce equivalent permissions. */
(function (root) {
    'use strict';
    async function commit({db, auth, eventId, items, pulseraId, pulseraNombre, metodo, estado, carritoId}) {
        const user = auth.currentUser;
        if (!user || !eventId || !items.length || !carritoId) throw Error('Datos de venta incompletos');
        if (!['nfc','efectivo','transferencia'].includes(metodo) || !['pagado','pendiente'].includes(estado) || (estado === 'pendiente' && metodo !== 'transferencia')) throw Error('Método o estado inválido');
        const unique = new Set();
        for (const i of items) {
            if (!i.id || unique.has(i.id) || !Number.isSafeInteger(i.cantidad) || i.cantidad <= 0 || !Number.isFinite(Number(i.precio)) || Number(i.precio) <= 0) throw Error('Producto inválido');
            unique.add(i.id);
        }
        const money = n => Math.round(Number(n) * 100);
        const total = items.reduce((sum,i) => sum + money(i.precio)*i.cantidad,0);
        if (!Number.isSafeInteger(total) || total <= 0) throw Error('Importe inválido');
        const refs = items.map(i => db.collection('articulos').doc(i.id));
        const eventRef = db.collection('eventos').doc(eventId);
        const userRef = db.collection('usuarios').doc(user.uid);
        const walletRef = metodo === 'nfc' ? db.collection('pulseras').doc(pulseraId) : null;
        const sales = items.map((i,index) => db.collection('transacciones').doc(carritoId + '_' + index));
        return db.runTransaction(async tx => {
            const [event, profile, previous, wallet, ...products] = await Promise.all([tx.get(eventRef),tx.get(userRef),tx.get(sales[0]),walletRef ? tx.get(walletRef) : Promise.resolve(null),...refs.map(ref=>tx.get(ref))]);
            if (!event.exists || event.data().activo !== true) throw Error('El evento ya no está activo');
            if (!profile.exists || profile.data().activo === false || !['admin','vendedor','administrador'].includes(profile.data().role)) throw Error('Usuario sin autorización');
            if (previous.exists) throw Error('Esta venta ya fue registrada');
            let before = 0, after = 0;
            if (walletRef) {
                if (!wallet.exists || wallet.data().bloqueada || wallet.data().activo === false) throw Error('Pulsera inválida o bloqueada');
                before = money(wallet.data().saldoActual);
                if (!Number.isSafeInteger(before) || before < total) throw Error('Saldo insuficiente');
                after = before - total;
            }
            products.forEach((doc,index) => {
                const i = items[index], p = doc.data();
                if (!doc.exists || p.eventId !== eventId || money(p.precio) !== money(i.precio)) throw Error('El catálogo cambió; actualiza tu carrito');
                if (!p.esInfinito && (!Number.isFinite(Number(p.stock)) || Number(p.stock) < i.cantidad)) throw Error('Stock insuficiente: ' + p.nombre);
            });
            if (walletRef) tx.update(walletRef,{saldoActual:after/100});
            products.forEach((doc,index) => {
                const i = items[index], p = doc.data();
                if (!p.esInfinito) tx.update(refs[index],{stock:Number(p.stock)-i.cantidad});
                tx.set(sales[index],{eventId,pulseraId,pulsera:wallet ? wallet.data().nombre : pulseraNombre,articulo:p.nombre,articuloId:i.id,cantidad:i.cantidad,precioUnitario:money(p.precio)/100,monto:money(p.precio)*i.cantidad/100,saldoAnterior:before/100,saldoNuevo:after/100,vendedor:profile.data().name || user.email || 'Vendedor',vendedorId:user.uid,fecha:new Date(),metodoPago:metodo,estadoPago:estado,carritoId,ventaFueraDePuesto:!!(p.vendedorAsignadoId && p.vendedorAsignadoId !== 'todos' && p.vendedorAsignadoId !== user.uid)});
            });
            return {saldoNuevo:after/100};
        });
    }
    root.GenesaretCheckout = {commit};
})(globalThis);
