(function(root){
'use strict';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
const ref=id=>db.collection('estaciones_venta').doc(id);
const node=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;};
const btn=(txt,fn)=>{const b=node('button',txt,'btn-secondary');b.type='button';b.onclick=fn;return b;};
async function createStation(){
 const event=$('stationEvent').value,vendor=$('stationVendor').value,name=$('stationName').value.trim();
 if(!event||!vendor||!name)return showError('Completa los datos de la estación');
 try{
 const id=String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000);
 await db.runTransaction(async tx=>{
 const assignment=db.collection('estaciones_asignaciones').doc(event+'_'+vendor);
 const [a,e,v,d,assigned]=await Promise.all([tx.get(db.collection('usuarios').doc(auth.currentUser.uid)),tx.get(db.collection('eventos').doc(event)),tx.get(db.collection('usuarios').doc(vendor)),tx.get(ref(id)),tx.get(assignment)]);
 if(!a.exists||!['admin','administrador'].includes(a.data().role)||a.data().activo===false||!e.exists||e.data().activo!==true||!v.exists||v.data().activo===false||!['vendedor','admin','administrador'].includes(v.data().role)||d.exists||assigned.exists)throw Error('No se pudo crear la estación; revisa los datos e intenta otra vez');
 tx.set(assignment,{estacionId:id,eventId:event,vendedorId:vendor});
 tx.set(ref(id),{nombre:name,eventId:event,vendedorId:vendor,activo:true,fecha:firebase.firestore.FieldValue.serverTimestamp()});
 });$('stationName').value='';showSuccess('Estación creada');
 }catch(e){showError(e.message);}
}
let stop=null;
async function open(){
 if(stop)return;
 try{
 const [events,users]=await Promise.all([db.collection('eventos').where('activo','==',true).get(),db.collection('usuarios').get()]);
 for(const [key,docs,filter] of [['stationEvent',events.docs,()=>true],['stationVendor',users.docs,d=>d.data().activo!==false&&['vendedor','admin','administrador'].includes(d.data().role)]]){
 const sel=$(key);sel.replaceChildren();for(const d of docs.filter(filter))sel.add(new Option(d.data().nombre||d.data().name||d.data().email||d.id,d.id));
 }
 $('stationCreate').onclick=createStation;
 stop=db.collection('estaciones_venta').onSnapshot(snap=>{
 const list=$('stationList');list.replaceChildren();
 for(const d of snap.docs){const s=d.data(),card=node('article',null,'smart-card');card.append(node('h3',s.nombre),node('strong',d.id,'smart-amount'),node('small',(events.docs.find(x=>x.id===s.eventId)?.data().nombre||'Evento')+' · '+(users.docs.find(x=>x.id===s.vendedorId)?.data().name||'Caja')),node('small',s.activo?'Habilitada':'Deshabilitada'));
 const auto=node('div',null,'station-autoservice');auto.append(node('h3','Autoservicio · '+s.nombre),node('small','Acceso independiente para esta estación'));
 const url='autoservicio.html?estacion='+encodeURIComponent(d.id)+'&evento='+encodeURIComponent(s.eventId);
 const launch=node('a','Abrir Autoservicio','btn-primary');launch.href=url;launch.target='_blank';launch.rel='noopener';launch.style.cssText='display:block;text-align:center;text-decoration:none;padding:12px;border-radius:12px';if(s.activo){auto.append(launch,btn('Copiar enlace',async()=>{try{await navigator.clipboard.writeText(new URL(url,location.href).href);showSuccess('Enlace copiado');}catch(e){await Swal.fire({title:'Enlace de Autoservicio',text:new URL(url,location.href).href});}}));}else auto.append(node('small','Estación deshabilitada'));card.append(auto);
 card.append(btn(s.activo?'Deshabilitar':'Habilitar',async()=>{try{await d.ref.update({activo:!s.activo});}catch(e){showError(e.message);}}));list.append(card);}
 if(!list.children.length)list.append(node('p','Crea tu primera estación.'));
 },e=>{$('stationList').textContent=e.message;stop=null;});
 }catch(e){showError(e.message);}
}
function queue({container,eventId,canLoad,load,cancel,onError}){
 let stops=[],station=null,orders=[],loading=false,paused=false,failed=null,closed=false,confirmed=false;
 const target=$(container);
 const draw=()=>{
 target.replaceChildren();
 target.append(node('strong',station?'Estación '+station.nombre:'Sin estación asignada'));
 target.append(node('small',station?(confirmed?'Cola sincronizada':'Sin conexión confirmada'):'Configura una estación desde Administración'));
 if(station){target.append(node('small',orders.length+' pedidos pendientes'));for(const o of orders){const row=node('div',null,'station-order');row.append(node('span',o.items.reduce((a,i)=>a+i.cantidad,0)+' productos · '+money(o.total)));row.append(btn('Cargar',()=>{paused=false;failed=null;next();}),btn('Cancelar',()=>cancel(o.id,station.id)));target.append(row);}target.append(btn(paused?'Reanudar cola':'Pausar carga automática',()=>{paused=!paused;draw();if(!paused){failed=null;next();}}));}
 };
 async function next(o=orders[0]){
 if(closed||!confirmed||loading||paused||!o||o.id===failed||!canLoad())return;
 loading=true;try{const ok=await load(o.id,station.id);if(!ok)failed=o.id;}catch(e){failed=o.id;onError(e.message);}finally{loading=false;}
 }
 const uid=auth.currentUser?.uid;
 if(!uid||!eventId){draw();return {close(){},next(){},pause(){}};}
 let stopOrders=null;
 stops.push(db.collection('estaciones_venta').where('vendedorId','==',uid).onSnapshot(snap=>{
 const matches=snap.docs.filter(d=>d.data().activo&&d.data().eventId===eventId).sort((a,b)=>a.id.localeCompare(b.id));
 const sel=matches[0];if(station?.id===sel?.id&&station)return;
 if(stopOrders)stopOrders();station=sel?{id:sel.id,...sel.data()}:null;orders=[];confirmed=false;draw();
 if(station)stopOrders=db.collection('pedidos_autoservicio').where('estacionId','==',station.id).onSnapshot({includeMetadataChanges:true},snap=>{
 confirmed=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;orders=snap.docs.filter(d=>d.data().estado==='pendiente'&&d.data().eventId===eventId).map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.fecha?.toMillis?.()||0)-(b.fecha?.toMillis?.()||0)||a.id.localeCompare(b.id));draw();next();
 },e=>{confirmed=false;draw();onError(e.message);});
 },e=>onError(e.message)));
 draw();return {close(){closed=true;stops.forEach(f=>f());if(stopOrders)stopOrders();target.replaceChildren();},next(){draw();next();},pause(){paused=true;draw();}};
}
async function cancel(id,stationId){
 const r=await Swal.fire({title:'¿Cancelar pedido sin cobrar?',text:'No se descontarán existencias ni saldo.',showCancelButton:true,confirmButtonText:'Cancelar pedido',cancelButtonText:'Volver'});
 if(!r.isConfirmed)return false;
 const order=db.collection('pedidos_autoservicio').doc(id);
 await db.runTransaction(async tx=>{const [o,s]=await Promise.all([tx.get(order),tx.get(ref(stationId))]);if(!o.exists||o.data().estado!=='pendiente'||o.data().estacionId!==stationId||!s.exists||s.data().vendedorId!==auth.currentUser.uid)throw Error('Pedido no disponible');tx.update(order,{estado:'cancelado',canceladoPor:auth.currentUser.uid,canceladoAt:firebase.firestore.FieldValue.serverTimestamp()});});return true;
}
root.GenesaretStations={open,queue,cancel};
})(globalThis);