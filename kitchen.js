(function(){
'use strict';
const $=id=>document.getElementById(id);
let stopOrders=null,stopEvents=null,generation=0;
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const millis=v=>v?.toMillis?.()||new Date(v||0).getTime()||0;
function render(snapshot){
 const groups=new Map();
 for(const doc of snapshot.docs){const x=doc.data();if(!['pagado','pendiente'].includes(x.estadoPago)||!x.carritoId)continue;
 const key=x.carritoId;if(!groups.has(key))groups.set(key,{key,items:[],time:0,pending:false});const g=groups.get(key);g.items.push({name:x.articulo||'Producto',qty:Number(x.cantidad)||1});g.time=Math.max(g.time,millis(x.fechaVenta||x.fecha));g.pending ||= x.estadoPago==='pendiente';
 }
 const target=$('orders');target.replaceChildren();
 const orders=[...groups.values()].sort((a,b)=>b.time-a.time||a.key.localeCompare(b.key));
 for(const g of orders.slice(0,100)){const card=node('article',null,'card');card.append(node('h2','Pedido '+g.key.slice(-8).toUpperCase()),node('p',(g.time?new Date(g.time).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}):'Sin fecha')+' · '+(g.pending?'Pago pendiente':'Pagado'),'pill'));for(const item of g.items){const line=node('div',null,'line');line.append(node('span',item.name),node('strong','× '+item.qty));card.append(line);}target.append(card);}
 if(!orders.length)target.append(node('p','Todavía no hay pedidos registrados para este evento.'));
 status((snapshot.metadata.fromCache?'Sin conexión confirmada · datos locales':'Conectado · datos recibidos')+' · '+Math.min(100,orders.length)+' de '+orders.length+' pedidos'+(orders.length>100?' (más recientes)':''));
}
function watch(){const token=++generation;if(stopOrders)stopOrders();stopOrders=null;$('orders').replaceChildren();const id=$('event').value;if(!id){status('No hay eventos activos');return;}status('Cargando pedidos…');stopOrders=db.collection('transacciones').where('eventId','==',id).onSnapshot({includeMetadataChanges:true},snap=>{if(token===generation)render(snap);},err=>{if(token!==generation)return;$('orders').replaceChildren();status('No se pudieron consultar los pedidos. Revisa permisos o conexión: '+err.message,true);});}
auth.onAuthStateChanged(async user=>{const token=++generation;if(stopOrders)stopOrders();if(stopEvents)stopEvents();stopOrders=stopEvents=null;$('event').disabled=true;$('event').replaceChildren();$('orders').replaceChildren();if(!user){status('Inicia sesión para consultar Cocina.',true);const a=node('a','Iniciar sesión','action');a.href='index.html';$('orders').append(a);return;}
 try{const profile=await db.collection('usuarios').doc(user.uid).get();if(token!==generation)return;if(!profile.exists||profile.data().activo===false||!['admin','administrador'].includes(profile.data().role)){status('Esta vista inicial requiere una cuenta administradora.',true);return;}
 stopEvents=db.collection('eventos').where('activo','==',true).onSnapshot(snap=>{const old=$('event').value;$('event').replaceChildren();for(const d of snap.docs){$('event').add(new Option(d.data().nombre||'Evento',d.id));}if([...$('event').options].some(o=>o.value===old))$('event').value=old;$('event').disabled=!snap.size;watch();},err=>{generation++;if(stopOrders)stopOrders();stopOrders=null;$('event').disabled=true;$('orders').replaceChildren();status('No se pudieron cargar los eventos: '+err.message,true);});
 }catch(err){if(token===generation)status('No se pudo verificar el acceso: '+err.message,true);}
});
$('event').onchange=watch;
})();