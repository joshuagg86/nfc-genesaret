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
root.GenesaretReversals={cancelSale};
})(globalThis);