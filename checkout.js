/* Shared online checkout. Firestore rules must enforce equivalent permissions. */
(function (root) {
    'use strict';

    const money = n => Math.round(Number(n)*100);
    function resolveRecipe(p, selection={}) {
        const recipe=p.recetaActiva?(p.produccionPorLotes?{...p.recetaActiva,lines:[]}:p.recetaActiva):null;
        let removed=selection.removed||[], extra=selection.extra||[];
        if(!Array.isArray(removed)||!Array.isArray(extra)||new Set(removed).size!==removed.length||new Set(extra).size!==extra.length)throw Error('Personalización inválida');
        if(!recipe){if(removed.length||extra.length)throw Error('La receta cambió');return {price:money(p.precio),usage:[],notes:[]};}
        if(removed.some(id=>!recipe.lines.some(l=>l.id===id&&l.removable))||extra.some(id=>!recipe.extras.some(l=>l.id===id)))throw Error('La receta cambió; actualiza tu carrito');
        // A removed included ingredient selected as extra restores its base portion.
        const restored=new Set(removed.filter(id=>extra.includes(id)));
        removed=removed.filter(id=>!restored.has(id));
        extra=extra.filter(id=>!restored.has(id));
        const usage=recipe.lines.filter(l=>!removed.includes(l.id)).concat(recipe.extras.filter(l=>extra.includes(l.id)));
        const notes=recipe.lines.filter(l=>removed.includes(l.id)).map(l=>'Sin '+l.nombre).concat(recipe.extras.filter(l=>extra.includes(l.id)).map(l=>'Extra '+l.nombre));
        return {price:money(p.precio)+recipe.extras.filter(l=>extra.includes(l.id)).reduce((a,l)=>a+money(l.price),0),usage,notes};
    }
    function foodIcon(name,fallback='🍽️'){
        const n=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        for(const [pattern,icon] of [[/aguacate/,'🥑'],[/queso/,'🧀'],[/carne|hamburguesa/,'🍔'],[/sandwich|chapata|torta/,'🥪'],[/jitomate|tomate/,'🍅'],[/cebolla/,'🧅'],[/lechuga|verdura/,'🥬'],[/jamon|tocino/,'🥓'],[/pollo/,'🍗'],[/huevo/,'🥚'],[/pan dulce|dona/,'🍩'],[/pan/,'🍞'],[/agua/,'🧴'],[/cafe/,'☕'],[/refresco|jugo/,'🥤'],[/papa/,'🍟'],[/chocolate/,'🍫']])if(pattern.test(n))return icon;
        return fallback;
    }
    function ingredientAvailability(p,stocks,selection={}){
        const detail=resolveRecipe(p,selection),needs=new Map();
        for(const l of detail.usage)needs.set(l.id,(needs.get(l.id)||0)+l.amount);
        return [...needs].filter(([id,n])=>!stocks.has(id)||stocks.get(id)<n).map(([id])=>id);
    }
    async function customize(p) {
        const recipe=p.recetaActiva?(p.produccionPorLotes?{...p.recetaActiva,lines:[]}:p.recetaActiva):null, selection={removed:[],extra:[]};
        if(!recipe||(!recipe.lines.length&&!recipe.extras.length))return {...resolveRecipe(p),selection};
        const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;if(txt==='🧴')n.classList.add('water-bottle-icon');return n;};
        const fmt=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n/100);
        const stocks=new Map();
        const ids=[...new Set([...recipe.lines,...recipe.extras].map(l=>l.id))];
        await Promise.all(ids.map(async id=>{const d=await db.collection('insumos').doc(id).get({source:'server'});if(d.exists&&d.data().eventId===p.eventId)stocks.set(id,Number(d.data().stock));}));
        const form=el('div','modifier-form');
        const hero=el('div','modifier-hero');
        const heroText=el('div');heroText.append(el('strong','','A tu gusto'),el('small','','Personaliza tu pedido'));
        hero.append(el('span','modifier-hero-icon',foodIcon(p.nombre)),heroText,el('strong','modifier-base-price',fmt(money(p.precio))));form.append(hero);
        const rows=[];const warning=el('p','modifier-hint');warning.setAttribute('role','status');
        const summary=el('div','modifier-summary');
        const breakdown=el('small','',''),total=el('strong','','');const copy=el('div');copy.append(el('small','','Total del producto'),total);summary.append(copy,breakdown);
        function refresh(){
            for(const {l,kind,b,marker,detail} of rows){
                const isBase=kind==='removed', restored=!isBase&&selection.removed.includes(l.id);
                const selected=isBase?!selection.removed.includes(l.id):selection.extra.includes(l.id);
                b.setAttribute('aria-pressed',String(selected));b.classList.toggle('is-selected',selected);
                marker.textContent=isBase?(selected?'✓':'+'):(selected?'✓':'+');
                detail.textContent=isBase?(selected?'Incluido':'Sin ingrediente'):(restored?'Reincorporar · sin costo':money(l.price)?'+'+fmt(money(l.price)):'Sin costo');
            }
            const d=resolveRecipe(p,selection);total.textContent=fmt(d.price);
            const unavailable=ingredientAvailability(p,stocks,selection);
            warning.textContent=unavailable.length?'Sin existencias: '+unavailable.map(id=>[...recipe.lines,...recipe.extras].find(l=>l.id===id)?.nombre||'ingrediente').join(', '):'';
            for(const {l,kind,b,detail} of rows){
                if(kind!=='extra')continue;
                const selected=selection.extra.includes(l.id),restoring=selection.removed.includes(l.id);
                const candidate=restoring?{removed:selection.removed.filter(id=>id!==l.id),extra:selection.extra.filter(id=>id!==l.id)}:{removed:selection.removed,extra:[...new Set([...selection.extra,l.id])]};
                const blocked=!selected&&ingredientAvailability(p,stocks,candidate).includes(l.id);
                b.disabled=blocked;if(blocked)detail.textContent='Agotado';
            }
            const confirm=Swal.getConfirmButton?.();if(confirm)confirm.disabled=unavailable.length>0;
            breakdown.textContent=d.price===money(p.precio)?'Precio base': 'Base '+fmt(money(p.precio))+' · Extras '+fmt(d.price-money(p.precio));
        }
        function section(title,hint,lines,kind){
            const section=el('section','modifier-section');section.append(el('h3','',title),el('p','modifier-hint',hint));
            const grid=el('div','modifier-grid');
            for(const l of lines){
                const b=el('button','modifier-option');b.type='button';
                const icon=el('span','modifier-food-icon',foodIcon(l.nombre,'🍴'));icon.setAttribute('aria-hidden','true');
                const info=el('span','modifier-info');const detail=el('small');info.append(el('strong','',l.nombre),detail);
                const marker=el('span','modifier-marker');marker.setAttribute('aria-hidden','true');b.append(icon,info,marker);
                if(kind==='removed'&&!l.removable){b.disabled=true;b.classList.add('is-required');}
                rows.push({l,kind,b,marker,detail});
                b.onclick=()=>{
                    const list=selection[kind];
                    if(list.includes(l.id))selection[kind]=list.filter(id=>id!==l.id);else selection[kind]=[...list,l.id];
                    if(selection.removed.includes(l.id)&&selection.extra.includes(l.id)){
                        selection.removed=selection.removed.filter(id=>id!==l.id);
                        selection.extra=selection.extra.filter(id=>id!==l.id);
                    }
                    refresh();
                };grid.append(b);
            }
            section.append(grid);form.append(section);
        }
        if(recipe.lines.length)section('Ingredientes incluidos','Toca para quitar o volver a incluir.',recipe.lines,'removed');
        if(recipe.extras.length)section('Hazlo extra','Añade una porción adicional a tu gusto.',recipe.extras,'extra');
        form.append(warning,summary);refresh();
        const res=await Swal.fire({titleText:p.nombre,html:form,width:680,customClass:{popup:'genesaret-smart-modal genesaret-modifier'},showCancelButton:true,confirmButtonText:'Agregar al carrito',cancelButtonText:'Cancelar',didOpen:refresh,preConfirm:()=>{if(ingredientAvailability(p,stocks,selection).length){Swal.showValidationMessage('No hay existencias suficientes');return false;}}});
        return res.isConfirmed?{...resolveRecipe(p,selection),selection}:null;
    }
    const variantKey=(id,sel={})=>JSON.stringify([id,[...(sel.removed||[])].sort(),[...(sel.extra||[])].sort()]);
    const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function commit({db, auth, eventId, items, pulseraId, pulseraNombre, metodo, estado, carritoId, selfOrderId=null}) {
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
        const orderRef=selfOrderId?db.collection('pedidos_autoservicio').doc(selfOrderId):null;
        const transact = numbered => db.runTransaction(async tx => {
            const [event, profile, previous, wallet, ...products] = await Promise.all([tx.get(eventRef),tx.get(userRef),tx.get(sales[0]),walletRef ? tx.get(walletRef) : Promise.resolve(null),...refs.map(ref=>tx.get(ref))]);
            if (!event.exists || event.data().activo !== true) throw Error('El evento ya no está activo');
            if (!profile.exists || profile.data().activo === false || !['admin','vendedor','administrador'].includes(profile.data().role)) throw Error('Usuario sin autorización');
            if (previous.exists) throw Error('Esta venta ya fue registrada');
            const shift=metodo==='efectivo'&&estado==='pagado'?await GenesaretCash.read(db,tx,user.uid):null;
            const counter = numbered ? await tx.get(counterRef) : null;
            const order=orderRef?await tx.get(orderRef):null;
            if(orderRef){
                const o=order.data();
                if(!order.exists||o.eventId!==eventId||o.estado!=='pendiente'||o.vendedorId!==user.uid||estado!=='pagado')throw Error('Pedido no disponible para cobrar');
                const station=await tx.get(db.collection('estaciones_venta').doc(o.estacionId));
                if(!station.exists||!station.data().activo||station.data().vendedorId!==user.uid||station.data().eventId!==eventId)throw Error('Estación no autorizada');
                // The assigned cashier may edit the cart before payment. The final items are validated below.
            }
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
            const costs=new Map(supplies.map(({id,doc})=>[id,doc.data().costPerUnit]));
            const costSnapshots=resolved.map((detail,index)=>{
                const p=products[index].data(),i=items[index];
                // Prepared batches and purchased products need an explicit finished-unit cost.
                const base=p.produccionPorLotes||!p.recetaActiva? p.costoUnitario:null;
                if((p.produccionPorLotes||!p.recetaActiva)&&(!Number.isFinite(base)||base<0))return null;
                if(detail.usage.some(l=>!Number.isFinite(costs.get(l.id))||costs.get(l.id)<0))return null;
                return Math.round(((base||0)+detail.usage.reduce((a,l)=>a+l.amount*costs.get(l.id),0))*i.cantidad*100)/100;
            });
            for(const {p,ref,qty} of productTotals.values())if(!p.esInfinito)tx.update(ref,{stock:Number(p.stock)-qty});
            for(const {id,doc,qty} of supplies){const v=doc.data(),stock=v.stock-qty;tx.update(doc.ref,{stock});tx.set(db.collection('movimientos_insumos').doc(),{eventId,insumoId:id,nombre:v.nombre,unit:v.unit,delta:-qty,stockFinal:stock,motivo:'Venta',usuarioId:user.uid,fecha:new Date(),carritoId});}
            if(orderRef){
                const finalItems=items.map((i,index)=>({id:i.id,nombre:products[index].data().nombre,cantidad:i.cantidad,precio:resolved[index].price/100,selection:i.selection||{removed:[],extra:[]},notes:resolved[index].notes}));
                const signature=rows=>JSON.stringify(rows.map(i=>[variantKey(i.id,i.selection),i.cantidad,money(i.precio)]).sort((a,b)=>a[0].localeCompare(b[0])));
                tx.update(orderRef,{estado:'cobrado',carritoId,numeroPedido,cobradoPor:user.uid,cobradoAt:new Date(),itemsFinales:finalItems,totalFinal:total/100,modificadoEnCaja:signature(order.data().items)!==signature(finalItems)});
            }
            const kitchenItems=products.flatMap((doc,index)=>doc.data().requiereCocina===true?[{name:doc.data().nombre,qty:items[index].cantidad,notes:resolved[index].notes}]:[]);
            if(kitchenItems.length)tx.set(eventRef.collection('pedidos_cocina').doc(carritoId),{items:kitchenItems,numeroPedido,fecha:firebase.firestore.FieldValue.serverTimestamp(),estado:'activo',vendedorId:user.uid,pagoPendiente:estado==='pendiente'});
            if(estado==='pagado')tx.set(eventRef.collection('confirmaciones_caja').doc(user.uid),{carritoId,total:total/100,kitchen:kitchenItems.length>0,numeroPedido,fecha:firebase.firestore.FieldValue.serverTimestamp(),vendedorId:user.uid});
            GenesaretCash.credit(tx,shift,total);
            if (numbered) tx.set(counterRef,{ultimo:numeroPedido},{merge:true});
            if (walletRef) tx.update(walletRef,{saldoActual:after/100});
            products.forEach((doc,index) => {
                const i = items[index], p = doc.data();
                const detail=resolved[index];
                tx.set(sales[index],{eventId,...(shift?{turnoCajaId:shift.id}:{}),...(selfOrderId?{pedidoAutoservicioId:selfOrderId}:{}),pulseraId,pulsera:wallet ? wallet.data().nombre : pulseraNombre,articulo:p.nombre,articuloId:i.id,cantidad:i.cantidad,lineasVenta:items.length,descuentoProducto:!p.esInfinito?i.cantidad:0,descuentoInsumos:detail.usage.map(l=>({id:l.id,amount:l.amount*i.cantidad})),requiereCocina:p.requiereCocina===true,personalizacion:detail.notes,costoVenta:costSnapshots[index],precioUnitario:detail.price/100,monto:detail.price*i.cantidad/100,saldoAnterior:before/100,saldoNuevo:after/100,vendedor:profile.data().name || user.email || 'Vendedor',vendedorId:user.uid,fecha:new Date(),fechaVenta:new Date(),fechaPago:estado==='pagado'?new Date():null,metodoPago:metodo,estadoPago:estado,carritoId,...(numbered?{numeroPedido}:{}),ventaFueraDePuesto:!!(p.vendedorAsignadoId && p.vendedorAsignadoId !== 'todos' && p.vendedorAsignadoId !== user.uid)});
            });
            return {saldoNuevo:after/100,numeroPedido};
        });
        return transact(true);
    }
    root.GenesaretCheckout = {commit,customize,variantKey,escapeHtml,resolveRecipe,foodIcon,ingredientAvailability};
})(globalThis);
