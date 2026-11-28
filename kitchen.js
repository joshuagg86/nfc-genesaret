(function(){
'use strict';
const $=id=>document.getElementById(id);
let stopOrders=null,stopEvents=null,stopStates=null,generation=0,ordersSnapshot=null,statesSnapshot=null;
const labels={pendiente:'Pendiente',preparando:'Preparando',listo:'Listo',entregado:'Entregado'};
const next={pendiente:'preparando',preparando:'listo',listo:'entregado'};
const actions={pendiente:'Iniciar preparación',preparando:'Marcar listo',listo:'Marcar entregado'};
const tv=document.body.dataset.mode==='tv';
const stateRef=(eventId,key)=>db.collection('eventos').doc(eventId).collection('preparacion_pedidos').doc(key);
const inFlight=new Set(),acknowledged=new Map();
let soundBaseline=null;
const rank={pendiente:0,preparando:1,listo:2,entregado:3};
const operationKey=(eventId,key)=>JSON.stringify([eventId,key]);
function transition(current,requested){
 const desired=next[requested];
 if(!desired||!Object.hasOwn(rank,current))throw Error('Estado de pedido inválido');
 if(rank[current]>=rank[desired])return {state:current,write:false};
 if(current!==requested)return {state:current,write:false};
 return {state:desired,write:true};
}
async function advance(g,state,button){
 const eventId=$('event').value,key=operationKey(eventId,g.key),token=generation;
 if(tv||!eventId||inFlight.has(key)||!next[state])return;
 let failure=null;inFlight.add(key);button.disabled=true;button.textContent='Actualizando…';render();
 try{
  const result=await db.runTransaction(async tx=>{
   const ref=stateRef(eventId,g.key);
   const [d,p,e]=await Promise.all([tx.get(ref),tx.get(db.collection('usuarios').doc(auth.currentUser.uid)),tx.get(db.collection('eventos').doc(eventId))]);
   if(!p.exists||p.data().activo===false||!['admin','administrador','cocina'].includes(p.data().role)||!e.exists||e.data().activo!==true)throw Error('Acceso no autorizado');
   const current=d.exists?d.data().estado:'pendiente',change=transition(current,state);
   if(change.write)tx.set(ref,{estado:change.state,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:auth.currentUser.uid},{merge:true});
   return change.state;
  });
  if(token===generation&&$('event').value===eventId){
   const observed=statesSnapshot?.docs.find(d=>d.id===g.key)?.data().estado||'pendiente';
   if(rank[result]>rank[observed])acknowledged.set(key,result);
  }
 }catch(err){failure=err;}
 finally{inFlight.delete(key);if(token===generation&&$('event').value===eventId){render();if(failure)status('No se pudo cambiar el estado: '+failure.message,true);}}
}
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
const millis=v=>v?.toMillis?.()||new Date(v||0).getTime()||0;
function render(){
 if(!ordersSnapshot||!statesSnapshot)return;
 const snapshot=ordersSnapshot;const states=new Map(statesSnapshot.docs.map(d=>[d.id,d.data().estado]));const online=!snapshot.metadata.fromCache&&!statesSnapshot.metadata.fromCache&&!snapshot.metadata.hasPendingWrites&&!statesSnapshot.metadata.hasPendingWrites;
 const groups=new Map();
 for(const doc of snapshot.docs){const x=doc.data();if(x.estado!=='activo'||!Array.isArray(x.items))continue;groups.set(doc.id,{key:doc.id,items:x.items,time:millis(x.fecha),pending:x.pagoPendiente===true,number:x.numeroPedido});}
 const target=$('orders');target.replaceChildren();
 const all=[...groups.values()].sort((a,b)=>a.time-b.time||a.key.localeCompare(b.key));
 const eventId=$('event').value;
 for(const [key,confirmed] of acknowledged){const [ev,id]=JSON.parse(key);if(ev===eventId&&rank[states.get(id)||'pendiente']>=rank[confirmed])acknowledged.delete(key);}
 const orders=all.map(g=>{const observed=states.get(g.key)||'pendiente',confirmed=acknowledged.get(operationKey(eventId,g.key));return {...g,state:confirmed&&rank[confirmed]>rank[observed]?confirmed:observed};}).filter(g=>g.state!=='entregado');
 if(online){const current=new Map(all.map(g=>[g.key,states.get(g.key)||'pendiente']));if(soundBaseline){const alert=tv?[...current].some(([k,s])=>s==='listo'&&soundBaseline.get(k)!=='listo'):[...current].some(([k,s])=>!soundBaseline.has(k)&&s==='pendiente');if(alert)window.GeneSound?.play(tv?'ready':'order');}soundBaseline=current;}
 const label=g=>g.number?'Pedido '+g.number:'Sin folio · '+g.key.slice(-4).toUpperCase();
 if(tv){for(const [title,allowed] of [['En preparación',['pendiente','preparando']],['Listos para recoger',['listo']]]){const col=node('section',null,'card');col.append(node('h2',title));const visible=orders.filter(g=>allowed.includes(g.state));for(const g of visible)col.append(node('div',label(g),'ticket '+g.state));if(!visible.length)col.append(node('p','Sin pedidos'));target.append(col);}}
 else {for(const g of orders.slice(0,100)){const card=node('article',null,'card');card.append(node('h2',label(g)),node('p',(g.time?new Date(g.time).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}):'Sin fecha')+' · '+(g.pending?'Pago pendiente':'Pagado'),'pill'),node('p',labels[g.state]||'Estado desconocido','stage '+g.state));for(const item of g.items){const line=node('div',null,'line');line.append(node('span',item.name),node('strong','× '+item.qty));card.append(line);for(const note of item.notes)card.append(node('p',note,'pill'));}if(next[g.state]){const busy=inFlight.has(operationKey(eventId,g.key));const b=node('button',busy?'Actualizando…':actions[g.state]);b.disabled=!online||busy;b.onclick=()=>advance(g,g.state,b);card.append(b);}target.append(card);}if(!orders.length)target.append(node('p','No hay pedidos activos para este evento.'));}
 status((online?'Conectado · datos recibidos':'Sin conexión confirmada · datos locales')+' · '+orders.length+' pedidos activos');
}

function watch(){soundBaseline=null;acknowledged.clear();const token=++generation;if(stopOrders)stopOrders();if(stopStates)stopStates();stopOrders=stopStates=null;ordersSnapshot=statesSnapshot=null;$('orders').replaceChildren();const id=$('event').value;if(!id){status('No hay eventos activos');return;}status('Cargando pedidos…');const fail=err=>{if(token!==generation)return;ordersSnapshot=statesSnapshot=null;$('orders').replaceChildren();status('No se pudieron consultar los pedidos. Revisa permisos o conexión: '+err.message,true);};const listen=(query,assign)=>query.onSnapshot({includeMetadataChanges:true},snap=>{if(token===generation){assign(snap);render();}},fail);stopOrders=listen(db.collection('eventos').doc(id).collection('pedidos_cocina'),s=>ordersSnapshot=s);stopStates=listen(db.collection('eventos').doc(id).collection('preparacion_pedidos'),s=>statesSnapshot=s);}

auth.onAuthStateChanged(async user=>{const token=++generation;soundBaseline=null;acknowledged.clear();if(stopOrders)stopOrders();if(stopEvents)stopEvents();if(stopStates)stopStates();stopOrders=stopEvents=stopStates=null;ordersSnapshot=statesSnapshot=null;$('event').disabled=true;$('event').replaceChildren();$('orders').replaceChildren();if(!user){status('Inicia sesión para consultar Cocina.',true);const a=node('a','Iniciar sesión','action');a.href='index.html';$('orders').append(a);return;}
 try{const profile=await db.collection('usuarios').doc(user.uid).get();if(token!==generation)return;if(!profile.exists||profile.data().activo===false||!['admin','administrador',tv?'tv':'cocina'].includes(profile.data().role)){status('Tu cuenta no tiene acceso a esta pantalla.',true);return;}
 stopEvents=db.collection('eventos').where('activo','==',true).onSnapshot(snap=>{const old=$('event').value;$('event').replaceChildren();for(const d of snap.docs){$('event').add(new Option(d.data().nombre||'Evento',d.id));}if([...$('event').options].some(o=>o.value===old))$('event').value=old;$('event').disabled=!snap.size;if(old!==$('event').value||!stopOrders||!stopStates)watch();},err=>{generation++;if(stopOrders)stopOrders();if(stopStates)stopStates();stopOrders=stopStates=null;ordersSnapshot=statesSnapshot=null;$('event').disabled=true;$('orders').replaceChildren();status('No se pudieron cargar los eventos: '+err.message,true);});
 }catch(err){if(token===generation)status('No se pudo verificar el acceso: '+err.message,true);}
});
$('event').onchange=watch;
})();