/* Shared online checkout. Firestore rules must enforce equivalent permissions. */
(function (root) {
    'use strict';

    const money = n => Math.round(Number(n)*100);
    function resolveRecipe(p, selection={}) {
        const recipe=p.recetaActiva;
        const removed=selection.removed||[], extra=selection.extra||[];
        if(!Array.isArray(removed)||!Array.isArray(extra)||new Set(removed).size!==removed.length||new Set(extra).size!==extra.length)throw Error('Personalización inválida');
        if(!recipe){if(removed.length||extra.length)throw Error('La receta cambió');return {price:money(p.precio),usage:[],notes:[]};}
        if(removed.some(id=>!recipe.lines.some(l=>l.id===id&&l.removable))||extra.some(id=>!recipe.extras.some(l=>l.id===id)))throw Error('La receta cambió; actualiza tu carrito');
        const usage=recipe.lines.filter(l=>!removed.includes(l.id)).concat(recipe.extras.filter(l=>extra.includes(l.id)));
        const notes=recipe.lines.filter(l=>removed.includes(l.id)).map(l=>'Sin '+l.nombre).concat(recipe.extras.filter(l=>extra.includes(l.id)).map(l=>'Extra '+l.nombre));
        return {price:money(p.precio)+recipe.extras.filter(l=>extra.includes(l.id)).reduce((a,l)=>a+money(l.price),0),usage,notes};
    }
    async function customize(p) {
        const recipe=p.recetaActiva, selection={removed:[],extra:[]};
        if(!recipe)return {...resolveRecipe(p),selection};
        const form=document.createElement('div');form.className='smart-modal-form';
        const total=document.createElement('strong');
        function row(l,kind){
            const label=document.createElement('label');
            label.className='smart-modal-check';
            label.style.cssText='display:flex;align-items:center;gap:12px;padding:10px;text-align:left';
            const box=document.createElement('input');box.type='checkbox';box.style.width='auto';box.checked=kind==='removed';
            const name=document.createElement('span');
            name.textContent=l.nombre+(kind==='extra'?' · '+(money(l.price)?String.fromCharCode(36)+(money(l.price)/100).toFixed(2):'Sin costo'):'');
            box.onchange=()=>{
                selection[kind]=selection[kind].filter(id=>id!==l.id);
                if(kind==='removed'?!box.checked:box.checked)selection[kind].push(l.id);
                total.textContent='Total: '+String.fromCharCode(36)+(resolveRecipe(p,selection).price/100).toFixed(2);
            };
            label.append(box,name);form.append(label);
        }
        const heading=t=>{const e=document.createElement('h4');e.textContent=t;form.append(e);};
        heading('Ingredientes incluidos');
        for(const l of recipe.lines){if(l.removable)row(l,'removed');else{const e=document.createElement('p');e.textContent=l.nombre;form.append(e);}}
        if(recipe.extras.length){heading('Extras opcionales');for(const l of recipe.extras)row(l,'extra');}
        total.textContent='Total: '+String.fromCharCode(36)+(money(p.precio)/100).toFixed(2);form.append(total);
        const res=await Swal.fire({titleText:p.nombre,html:form,customClass:{popup:'genesaret-smart-modal'},showCancelButton:true,confirmButtonText:'Agregar al carrito',cancelButtonText:'Cancelar'});
        return res.isConfirmed?{...resolveRecipe(p,selection),selection}:null;
    }
    const variantKey=(id,sel={})=>JSON.stringify([id,[...(sel.removed||[])].sort(),[...(sel.extra||[])].sort()]);
    const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function commit({db, auth, eventId, items, pulseraId, pulseraNombre, metodo, estado, carritoId}) {
        const user = auth.currentUser;
        if (!user || !eventId || !items.length || !carritoId) throw Error('Datos de venta incompletos');
        if (!['nfc','efectivo','transferencia'].includes(metodo) || !['pagado','pendiente'].includes(estado) || (estado === 'pendiente' && metodo === 'nfc')) throw Error('Método o estado inválido');
        if (estado === 'pendiente' && (typeof pulseraNombre !== 'string' || !pulseraNombre.trim())) throw Error('Nombre del cliente obligatorio');
        const unique = new Set();
        for (const i of items) {
            if (!i.id || unique.has(variantKey(i.id,i.selection)) || !Number.isSafeInteger(i.cantidad) || i.cantidad <= 0 || !Number.isFinite(Number(i.precio)) || Number(i.precio) <= 0) throw Error('Producto inválido');
            unique.add(variantKey(i.id,i.selection));
        }
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
            const productTotals=new Map(), supplyTotals=new Map();
            const resolved=products.map((doc,index)=>{
                const i=items[index],p=doc.data();
                if(!doc.exists||p.eventId!==eventId)throw Error('Producto inválido');
                const detail=resolveRecipe(p,i.selection);
                if(detail.price!==money(i.precio))throw Error('El catálogo cambió; actualiza tu carrito');
                productTotals.set(i.id,{p,ref:refs[index],qty:(productTotals.get(i.id)?.qty||0)+i.cantidad});
                for(const l of detail.usage){if(!Number.isSafeInteger(l.amount)||l.amount<=0)throw Error('Receta inválida');supplyTotals.set(l.id,(supplyTotals.get(l.id)||0)+l.amount*i.cantidad);}
                return detail;
            });
            for(const {p,qty} of productTotals.values())if(!p.esInfinito&&(!Number.isFinite(Number(p.stock))||Number(p.stock)<qty))throw Error('Stock insuficiente: '+p.nombre);
            const supplies=await Promise.all([...supplyTotals].map(async ([id,qty])=>({id,qty,doc:await tx.get(db.collection('insumos').doc(id))})));
            for(const {doc,qty} of supplies)if(!doc.exists||doc.data().eventId!==eventId||!Number.isSafeInteger(qty)||!Number.isSafeInteger(doc.data().stock)||doc.data().stock<qty)throw Error('Insumo insuficiente: '+(doc.data()?.nombre||'ingrediente'));
            for(const {p,ref,qty} of productTotals.values())if(!p.esInfinito)tx.update(ref,{stock:Number(p.stock)-qty});
            for(const {id,doc,qty} of supplies){const v=doc.data(),stock=v.stock-qty;tx.update(doc.ref,{stock});tx.set(db.collection('movimientos_insumos').doc(),{eventId,insumoId:id,nombre:v.nombre,unit:v.unit,delta:-qty,stockFinal:stock,motivo:'Venta',usuarioId:user.uid,fecha:new Date(),carritoId});}
            if (numbered) tx.set(counterRef,{ultimo:numeroPedido},{merge:true});
            if (walletRef) tx.update(walletRef,{saldoActual:after/100});
            products.forEach((doc,index) => {
                const i = items[index], p = doc.data();
                const detail=resolved[index];
                tx.set(sales[index],{eventId,pulseraId,pulsera:wallet ? wallet.data().nombre : pulseraNombre,articulo:p.nombre,articuloId:i.id,cantidad:i.cantidad,requiereCocina:p.requiereCocina===true,personalizacion:detail.notes,precioUnitario:detail.price/100,monto:detail.price*i.cantidad/100,saldoAnterior:before/100,saldoNuevo:after/100,vendedor:profile.data().name || user.email || 'Vendedor',vendedorId:user.uid,fecha:new Date(),fechaVenta:new Date(),fechaPago:estado==='pagado'?new Date():null,metodoPago:metodo,estadoPago:estado,carritoId,...(numbered?{numeroPedido}:{}),ventaFueraDePuesto:!!(p.vendedorAsignadoId && p.vendedorAsignadoId !== 'todos' && p.vendedorAsignadoId !== user.uid)});
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
    root.GenesaretCheckout = {commit,customize,variantKey,escapeHtml};
})(globalThis);
