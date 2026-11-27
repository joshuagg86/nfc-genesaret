/* Shared online checkout. Firestore rules must enforce equivalent permissions. */
(function (root) {
    'use strict';
    async function commit({db, auth, eventId, items, pulseraId, pulseraNombre, metodo, estado, carritoId}) {
        const user = auth.currentUser;
        if (!user || !eventId || !items.length || !carritoId) throw Error('Datos de venta incompletos');
        if (!['nfc','efectivo','transferencia'].includes(metodo) || !['pagado','pendiente'].includes(estado) || (estado === 'pendiente' && metodo === 'nfc')) throw Error('Método o estado inválido');
        if (estado === 'pendiente' && (typeof pulseraNombre !== 'string' || !pulseraNombre.trim())) throw Error('Nombre del cliente obligatorio');
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
        // One number per event and cart. A separate counter avoids modifying event settings.
        const counterRef = eventRef.collection('contadores').doc('pedidos');
        const transact = numbered => db.runTransaction(async tx => {
            const [event, profile, previous, wallet, ...products] = await Promise.all([tx.get(eventRef),tx.get(userRef),tx.get(sales[0]),walletRef ? tx.get(walletRef) : Promise.resolve(null),...refs.map(ref=>tx.get(ref))]);
            if (!event.exists || event.data().activo !== true) throw Error('El evento ya no está activo');
            if (!profile.exists || profile.data().activo === false || !['admin','vendedor','administrador'].includes(profile.data().role)) throw Error('Usuario sin autorización');
            if (previous.exists) throw Error('Esta venta ya fue registrada');
            const counter = numbered ? await tx.get(counterRef) : null;
            const last = counter?.exists ? counter.data().ultimo : 0;
            if (numbered && (!Number.isSafeInteger(last) || last < 0 || last >= Number.MAX_SAFE_INTEGER)) throw Error('Contador de pedidos inválido');
            const numeroPedido = numbered ? last + 1 : null;
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
            if (numbered) tx.set(counterRef,{ultimo:numeroPedido},{merge:true});
            if (walletRef) tx.update(walletRef,{saldoActual:after/100});
            products.forEach((doc,index) => {
                const i = items[index], p = doc.data();
                if (!p.esInfinito) tx.update(refs[index],{stock:Number(p.stock)-i.cantidad});
                tx.set(sales[index],{eventId,pulseraId,pulsera:wallet ? wallet.data().nombre : pulseraNombre,articulo:p.nombre,articuloId:i.id,cantidad:i.cantidad,requiereCocina:p.requiereCocina===true,precioUnitario:money(p.precio)/100,monto:money(p.precio)*i.cantidad/100,saldoAnterior:before/100,saldoNuevo:after/100,vendedor:profile.data().name || user.email || 'Vendedor',vendedorId:user.uid,fecha:new Date(),fechaVenta:new Date(),fechaPago:estado==='pagado'?new Date():null,metodoPago:metodo,estadoPago:estado,carritoId,...(numbered?{numeroPedido}:{}),ventaFueraDePuesto:!!(p.vendedorAsignadoId && p.vendedorAsignadoId !== 'todos' && p.vendedorAsignadoId !== user.uid)});
            });
            return {saldoNuevo:after/100,numeroPedido};
        });
        try { return await transact(true); }
        catch (error) {
            // A denied atomic transaction commits nothing. Preserve checkout until the new counter rules are deployed.
            if (error.code !== 'permission-denied' && error.code !== 'firestore/permission-denied') throw error;
            console.warn('Numeración de pedidos no autorizada; registrando sin folio.', error);
            return transact(false);
        }
    }
    root.GenesaretCheckout = {commit};
})(globalThis);
