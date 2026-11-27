(function(){
'use strict';
const $=id=>document.getElementById(id);
let stopOrders=null,stopEvents=null,stopStates=null,generation=0,ordersSnapshot=null,statesSnapshot=null;
const labels={pendiente:'Pendiente',preparando:'Preparando',listo:'Listo',entregado:'Entregado'};
const next={pendiente:'preparando',preparando:'listo',listo:'entregado'};
const actions={pendiente:'Iniciar preparación',preparando:'Marcar listo',listo:'Marcar entregado'};
const tv=document.body.dataset.mode==='tv';
const stateRef=(eventId,key)=>db.collection('eventos').doc(eventId).collection('preparacion_pedidos').doc(key);
async function advance(g,state,button){button.disabled=true;const eventId=$('event').value;try{await db.runTransaction(async tx=>{const ref=stateRef(eventId,g.key);const [d,p,e]=await Promise.all([tx.get(ref),tx.get(db.collection('usuarios').doc(auth.currentUser.uid)),tx.get(db.collection('eventos').doc(eventId))]);if(!p.exists||p.data().activo===false||!['admin','administrador'].includes(p.data().role)||!e.exists||e.data().activo!==true)throw Error('Acceso no autorizado');const current=d.exists?d.data().estado:'pendiente';if(current!==state)throw Error('El pedido cambió en otro dispositivo');tx.set(ref,{estado:next[state],updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:auth.currentUser.uid},{merge:true});});}catch(err){status('No se pudo cambiar el estado: '+err.message,true);}finally{button.disabled=false;}}
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const millis=v=>v?.toMillis?.()||new Date(v||0).getTime()||0;
function render(){
 if(!ordersSnapshot||!statesSnapshot)return;
 const snapshot=ordersSnapshot;const states=new Map(statesSnapshot.docs.map(d=>[d.id,d.data().estado]));const online=!snapshot.metadata.fromCache&&!statesSnapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites&&!statesSnapshot.metadata.hasPendingWrites;
 const groups=new Map();
 for(const doc of snapshot.docs){const x=doc.data();if(!['pagado','pendiente'].includes(x.estadoPago)||!x.carritoId)continue;
 const key=x.carritoId;if(!groups.has(key))groups.set(key,{key,items:[],time:0,pending:false});const g=groups.get(key);g.items.push({name:x.articulo||'Producto',qty:Number(x.cantidad)||1});g.time=Math.max(g.time,millis(x.fechaVenta||x.fecha));g.pending ||= x.estadoPago==='pendiente';
 }
 const target=$('orders');target.replaceChildren();
 const orders=[...groups.values()].map(g=>({...g,state:states.get(g.key)||'pendiente'})).filter(g=>g.state!=='entregado').sort((a,b)=>a.time-b.time||a.key.localeCompare(b.key));
 if(tv){for(const [title,allowed] of [['En preparación',['pendiente','preparando']],['Listos para recoger',['listo']]]){const col=node('section',null,'card');col.append(node('h2',title));const visible=orders.filter(g=>allowed.includes(g.state));for(const g of visible)col.append(node('div',g.key.slice(-8).toUpperCase(),'ticket '+g.state));if(!visible.length)col.append(node('p','Sin pedidos'));target.append(col);}}
 else {for(const g of orders.slice(0,100)){const card=node('article',null,'card');card.append(node('h2','Pedido '+g.key.slice(-8).toUpperCase()),node('p',(g.time?new Date(g.time).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}):'Sin fecha')+' · '+(g.pending?'Pago pendiente':'Pagado'),'pill'),node('p',labels[g.state]||'Estado desconocido','stage '+g.state));for(const item of g.items){const line=node('div',null,'line');line.append(node('span',item.name),node('strong','× '+item.qty));card.append(line);}if(next[g.state]){const b=node('button',actions[g.state]);b.disabled=!online;b.onclick=()=>advance(g,g.state,b);card.append(b);}target.append(card);}if(!orders.length)target.append(node('p','No hay pedidos activos para este evento.'));}
 status((online?'Conectado · datos recibidos':'Sin conexión confirmada · datos locales')+' · '+orders.length+' pedidos activos');
}

function watch(){const token=++generation;if(stopOrders)stopOrders();if(stopStates)stopStates();stopOrders=stopStates=null;ordersSnapshot=statesSnapshot=null;$('orders').replaceChildren();const id=$('event').value;if(!id){status('No hay eventos activos');return;}status('Cargando pedidos…');const fail=err=>{if(token!==generation)return;ordersSnapshot=statesSnapshot=null;$('orders').replaceChildren();status('No se pudieron consultar los pedidos. Revisa permisos o conexión: '+err.message,true);};const listen=(query,assign)=>query.onSnapshot({includeMetadataChanges:true},snap=>{if(token===generation){assign(snap);render();}},fail);stopOrders=listen(db.collection('transacciones').where('eventId','==',id),s=>ordersSnapshot=s);stopStates=listen(db.collection('eventos').doc(id).collection('preparacion_pedidos'),s=>statesSnapshot=s);}

auth.onAuthStateChanged(async user=>{const token=++generation;if(stopOrders)stopOrders();if(stopEvents)stopEvents();if(stopStates)stopStates();stopOrders=stopEvents=stopStates=null;ordersSnapshot=statesSnapshot=null;$('event').disabled=true;$('event').replaceChildren();$('orders').replaceChildren();if(!user){status('Inicia sesión para consultar Cocina.',true);const a=node('a','Iniciar sesión','action');a.href='index.html';$('orders').append(a);return;}
 try{const profile=await db.collection('usuarios').doc(user.uid).get();if(token!==generation)return;if(!profile.exists||profile.data().activo===false||!['admin','administrador'].includes(profile.data().role)){status('Esta vista inicial requiere una cuenta administradora.',true);return;}
 stopEvents=db.collection('eventos').where('activo','==',true).onSnapshot(snap=>{const old=$('event').value;$('event').replaceChildren();for(const d of snap.docs){$('event').add(new Option(d.data().nombre||'Evento',d.id));}if([...$('event').options].some(o=>o.value===old))$('event').value=old;$('event').disabled=!snap.size;watch();},err=>{generation++;if(stopOrders)stopOrders();if(stopStates)stopStates();stopOrders=stopStates=null;ordersSnapshot=statesSnapshot=null;$('event').disabled=true;$('orders').replaceChildren();status('No se pudieron cargar los eventos: '+err.message,true);});
 }catch(err){if(token===generation)status('No se pudo verificar el acceso: '+err.message,true);}
});
$('event').onchange=watch;
})();