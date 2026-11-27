(function(root){
'use strict';
const cents=n=>Math.round(Number(n)*100);
async function cancelSale(id){
 const first=await db.collection('transacciones').doc(id).get({source:'server'});
 if(!first.exists)throw Error('Venta no encontrada');
 const initial=first.data(),key=initial.carritoId;
 const result=await Swal.fire({title:'Cancelar venta completa',text:'Si fue pagada con pulsera se devolverá el saldo. Para efectivo o transferencia confirma la devolución fuera del sistema. Se conserva el historial.',input:'text',inputLabel:'Motivo obligatorio',showCancelButton:true,confirmButtonText:'Continuar',cancelButtonText:'Volver',inputValidator:v=>!v.trim()?'Escribe el motivo':undefined});
 if(!result.isConfirmed)return false;
 const restore=await Swal.fire({title:'¿Recuperar existencias?',text:'Solo recupera productos e ingredientes si realmente pueden volver al inventario. Las ventas antiguas sin detalle exacto no permiten esta opción.',showDenyButton:true,showCancelButton:true,confirmButtonText:'Sí, recuperar',denyButtonText:'No recuperar',cancelButtonText:'Volver'});
 if(restore.isDismissed)return false;
 const uid=auth.currentUser.uid,ref=db.collection('transacciones'),audit=db.collection('anulaciones').doc();
 const refs=key?(await ref.where('carritoId','==',key).get({source:'server'})).docs.map(d=>d.ref):[first.ref];
 if(!refs.length)throw Error('Venta no encontrada');
 await db.runTransaction(async tx=>{
 const [profile,...docs]=await Promise.all([tx.get(db.collection('usuarios').doc(uid)),...refs.map(r=>tx.get(r))]);
 if(!profile.exists||profile.data().activo===false||profile.data().role!=='admin')throw Error('Sin autorización');
 const rows=docs.map(d=>d.data());
 if(docs.some(d=>!d.exists)||rows.some(t=>!['pagado','pendiente'].includes(t.estadoPago)||t.eventId!==initial.eventId||t.carritoId!==key||t.metodoPago!==initial.metodoPago||t.pulseraId!==initial.pulseraId||t.estadoPago!==initial.estadoPago))throw Error('Venta ya cancelada o inconsistente');
 const exact=rows.every(t=>t.lineasVenta===rows.length&&Array.isArray(t.descuentoInsumos)&&Number.isSafeInteger(t.descuentoProducto));
 if(restore.isConfirmed&&!exact)throw Error('Venta antigua: cancela sin recuperar existencias y ajusta el inventario manualmente');
 const total=rows.reduce((a,t)=>a+cents(t.monto),0);
 if(!Number.isSafeInteger(total)||total<=0)throw Error('Importe inválido');
 const wallet=initial.estadoPago==='pagado'&&initial.metodoPago==='nfc'?await tx.get(db.collection('pulseras').doc(initial.pulseraId)):null;
 if(wallet&&(!wallet.exists||!Number.isSafeInteger(cents(wallet.data().saldoActual))))throw Error('Pulsera inválida');
 const preparation=key&&initial.eventId?await tx.get(db.collection('eventos').doc(initial.eventId).collection('preparacion_pedidos').doc(key)):null;
 if(restore.isConfirmed&&preparation?.exists&&['preparando','listo','entregado'].includes(preparation.data().estado))throw Error('Pedido ya preparado: cancela sin recuperar existencias');
 const products=new Map(),supplies=new Map();
 if(restore.isConfirmed)for(const t of rows){if(t.descuentoProducto>0)products.set(t.articuloId,(products.get(t.articuloId)||0)+t.descuentoProducto);for(const l of t.descuentoInsumos){if(!Number.isSafeInteger(l.amount)||l.amount<=0)throw Error('Consumo inválido');supplies.set(l.id,(supplies.get(l.id)||0)+l.amount);}}
 const stock=await Promise.all([...products].map(async ([id,n])=>({n,d:await tx.get(db.collection('articulos').doc(id))})));
 const ingredients=await Promise.all([...supplies].map(async ([id,n])=>({n,d:await tx.get(db.collection('insumos').doc(id))})));
 for(const {d,n} of [...stock,...ingredients])if(!d.exists||d.data().eventId!==initial.eventId||!Number.isSafeInteger(Number(d.data().stock)+n))throw Error('Inventario no disponible');
 for(const {d} of stock)if(d.data().esInfinito)throw Error('El modo de stock cambió; recupera manualmente');
 const now=firebase.firestore.FieldValue.serverTimestamp();
 if(wallet)tx.update(wallet.ref,{saldoActual:(cents(wallet.data().saldoActual)+total)/100});
 for(const {d,n} of stock)tx.update(d.ref,{stock:Number(d.data().stock)+n});
 for(const {d,n} of ingredients){const v=d.data(),stock=v.stock+n;tx.update(d.ref,{stock});tx.set(db.collection('movimientos_insumos').doc(),{eventId:initial.eventId,insumoId:d.id,nombre:v.nombre,unit:v.unit,delta:n,stockFinal:stock,motivo:'Cancelación',usuarioId:uid,fecha:now,carritoId:key||id});}
 for(const d of docs)tx.update(d.ref,{estadoPago:'cancelado',estadoPagoAnterior:initial.estadoPago,canceladoPor:uid,canceladoAt:now,motivoCancelacion:result.value.trim(),anulacionId:audit.id});
 tx.set(audit,{eventId:initial.eventId||null,carritoId:key||id,transacciones:refs.map(r=>r.id),monto:total/100,metodo:initial.metodoPago||null,estadoAnterior:initial.estadoPago,recuperarStock:restore.isConfirmed,usuarioId:uid,motivo:result.value.trim(),fecha:now});
 });return true;
}
let salesStop=null,rows=[],events=[];
function renderSales(){
 const target=document.getElementById('saleHistoryList'),ev=document.getElementById('saleHistoryEvent').value,q=document.getElementById('saleHistorySearch').value.toLowerCase();
 target.replaceChildren();const groups=new Map();
 for(const t of rows){if(ev&&t.eventId!==ev)continue;const id=t.carritoId||t.id;let g=groups.get(id);if(!g){g={id,first:t,items:[],total:0};groups.set(id,g);}g.items.push(t);g.total+=Number(t.monto)||0;}
 const visible=[...groups.values()].filter(g=>[g.id,g.first.numeroPedido,g.first.pulsera,g.first.vendedor,...g.items.map(t=>t.articulo)].join(' ').toLowerCase().includes(q)).sort((a,b)=>(b.first.fechaVenta?.toMillis?.()||b.first.fecha?.toMillis?.()||0)-(a.first.fechaVenta?.toMillis?.()||a.first.fecha?.toMillis?.()||0));
 const n=(tag,txt,cls)=>{const e=document.createElement(tag);e.textContent=txt;if(cls)e.className=cls;return e;};
 for(const g of visible.slice(0,100)){const t=g.first,card=n('article','','smart-card');card.append(n('h3',t.numeroPedido?'Pedido '+t.numeroPedido:'Venta '+g.id.slice(-6)),n('strong',new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(g.total),'smart-amount'),n('small',g.items.map(x=>x.cantidad+' × '+x.articulo).join(' · ')),n('small',(t.metodoPago||'Sin método')+' · '+(t.estadoPago||'Histórica')+' · '+(t.vendedor||'')));
 if(g.items.every(x=>['pagado','pendiente'].includes(x.estadoPago))){const b=n('button','Cancelar venta','btn-danger');b.type='button';b.onclick=async()=>{b.disabled=true;try{if(await cancelSale(t.id))showSuccess('Venta cancelada');}catch(e){showError(e.message);}finally{b.disabled=false;}};card.append(b);}target.append(card);}
 if(!target.children.length)target.append(n('p','Sin ventas para mostrar'));document.getElementById('saleHistoryCount').textContent=visible.length+' ventas · mostrando hasta 100';
}
async function open(){
 if(salesStop)return;
 const sel=document.getElementById('saleHistoryEvent');try{const snap=await db.collection('eventos').get();sel.replaceChildren(new Option('Todos los eventos',''));for(const d of snap.docs)sel.add(new Option(d.data().nombre||'Evento',d.id));sel.onchange=renderSales;document.getElementById('saleHistorySearch').oninput=renderSales;
 salesStop=db.collection('transacciones').onSnapshot(snap=>{rows=snap.docs.map(d=>({...d.data(),id:d.id}));renderSales();},e=>{document.getElementById('saleHistoryList').textContent=e.message;salesStop=null;});
 }catch(e){showError(e.message);}
}
root.GenesaretReversals={cancelSale,open};
})(globalThis);