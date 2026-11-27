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
 const reserved=db.collection('estaciones_codigos').doc(id);
 const [a,e,v,d,assigned,codeDoc]=await Promise.all([tx.get(db.collection('usuarios').doc(auth.currentUser.uid)),tx.get(db.collection('eventos').doc(event)),tx.get(db.collection('usuarios').doc(vendor)),tx.get(ref(id)),tx.get(assignment),tx.get(reserved)]);
 if(!a.exists||!['admin','administrador'].includes(a.data().role)||a.data().activo===false||!e.exists||e.data().activo!==true||!v.exists||v.data().activo===false||!['vendedor','admin','administrador'].includes(v.data().role)||d.exists||assigned.exists||codeDoc.exists)throw Error('No se pudo crear la estación; revisa los datos e intenta otra vez');
 tx.set(reserved,{estacionId:id});tx.set(assignment,{estacionId:id,eventId:event,vendedorId:vendor});
 tx.set(ref(id),{nombre:name,eventId:event,vendedorId:vendor,activo:true,fecha:firebase.firestore.FieldValue.serverTimestamp()});
 });$('stationName').value='';showSuccess('Estación creada');
 }catch(e){showError(e.message);}
}
async function manageStation(id,action,users){
 const r=ref(id),initial=await r.get({source:'server'});if(!initial.exists)return;const old=initial.data();
 let name=old.nombre,vendor=old.vendedorId,newCode=null;
 if(action==='edit'){
 const form=node('div'),n=node('input'),v=node('select');n.value=name;n.maxLength=80;n.setAttribute('aria-label','Nombre de estación');v.setAttribute('aria-label','Vendedor asignado');for(const d of users.docs.filter(d=>d.data().activo!==false&&['admin','administrador','vendedor'].includes(d.data().role)))v.add(new Option((d.data().name||'Cuenta')+' · '+(d.data().email||''),d.id));v.value=vendor;form.append(node('p','Nombre de estación'),n,node('p','Vendedor asignado'),v);
 const result=await Swal.fire({title:'Editar estación',html:form,showCancelButton:true,confirmButtonText:'Guardar',cancelButtonText:'Cancelar',preConfirm:()=>{if(!n.value.trim()||!v.value){Swal.showValidationMessage('Completa los datos');return false;}return {name:n.value.trim(),vendor:v.value};}});if(!result.isConfirmed)return;({name,vendor}=result.value);
 }else{
 const result=await Swal.fire({title:action==='delete'?'¿Retirar estación?':'¿Regenerar código?',text:action==='delete'?'Se conservará el historial de pedidos.':'Las tablets vinculadas deberán introducir el código nuevo.',showCancelButton:true,confirmButtonText:action==='delete'?'Retirar':'Regenerar',cancelButtonText:'Volver'});if(!result.isConfirmed)return;
 if(action==='rotate')newCode=String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000);
 }
 if((action==='delete'||vendor!==old.vendedorId)&&old.activo)throw Error('Deshabilita la estación antes de cambiar vendedor o retirarla.');
 if(action==='delete'||vendor!==old.vendedorId){const orders=await db.collection('pedidos_autoservicio').where('estacionId','==',id).get({source:'server'});if(orders.docs.some(o=>o.data().estado==='pendiente'))throw Error('Hay pedidos pendientes. Habilita la estación y resuélvelos primero.');}
 await db.runTransaction(async tx=>{
 const uid=auth.currentUser.uid,admin=await tx.get(db.collection('usuarios').doc(uid)),current=await tx.get(r);
 if(!admin.exists||admin.data().role!=='admin'||admin.data().activo===false||!current.exists||current.data().archivada||current.data().vendedorId!==old.vendedorId||current.data().activo!==old.activo||(current.data().codigoVinculacion||id)!==(old.codigoVinculacion||id))throw Error('La estación cambió; vuelve a intentarlo.');
 const prior=db.collection('estaciones_asignaciones').doc(old.eventId+'_'+old.vendedorId),priorDoc=await tx.get(prior);
 if(priorDoc.exists&&priorDoc.data().estacionId!==id)throw Error('Asignación inconsistente');
 if(action==='delete'){tx.update(r,{archivada:true,activo:false,archivadaAt:firebase.firestore.FieldValue.serverTimestamp()});if(priorDoc.exists)tx.delete(prior);return;}
 if(action==='rotate'){
 const reserve=db.collection('estaciones_codigos').doc(newCode),reserved=await tx.get(reserve),legacy=await tx.get(ref(newCode));
 if(reserved.exists||legacy.exists)throw Error('Código ocupado; vuelve a intentar');
 tx.set(reserve,{estacionId:id});tx.update(r,{codigoVinculacion:newCode});return;
 }
 if(vendor!==old.vendedorId){const dest=db.collection('estaciones_asignaciones').doc(old.eventId+'_'+vendor),assigned=await tx.get(dest),v=await tx.get(db.collection('usuarios').doc(vendor));if(assigned.exists||!v.exists||v.data().activo===false||!['admin','administrador','vendedor'].includes(v.data().role))throw Error('Vendedor no disponible o ya asignado');if(priorDoc.exists)tx.delete(prior);tx.set(dest,{estacionId:id,eventId:old.eventId,vendedorId:vendor});}
 tx.update(r,{nombre:name,vendedorId:vendor});
 });showSuccess('Estación actualizada');
}
let stop=null,stopUsers=null,opening=false;
async function open(){
 if(stop||opening)return;opening=true;
 try{
 const [events,initialUsers]=await Promise.all([db.collection('eventos').where('activo','==',true).get(),db.collection('usuarios').get()]);
 let users=initialUsers,stationSnapshot=null;
 const eventSelect=$('stationEvent');eventSelect.replaceChildren();for(const d of events.docs)eventSelect.add(new Option(d.data().nombre||d.id,d.id));
 function refreshVendors(){const sel=$('stationVendor'),old=sel.value;sel.replaceChildren();for(const d of users.docs.filter(d=>d.data().activo!==false&&['vendedor','admin','administrador'].includes(d.data().role))){const u=d.data();sel.add(new Option((u.name||u.nombre||'Sin nombre')+(u.email?' · '+u.email:''),d.id));}if([...sel.options].some(o=>o.value===old))sel.value=old;}
 refreshVendors();
 $('stationCreate').onclick=createStation;
 function renderStations(snap){
 const list=$('stationList');list.replaceChildren();
 for(const d of [...snap.docs].filter(d=>!d.data().archivada).sort((a,b)=>String(a.data().nombre).localeCompare(String(b.data().nombre),'es',{numeric:true}))){
 const s=d.data(),card=node('article',null,'station-config-card');
 const header=node('div',null,'station-config-head'),icon=node('span',null,'station-config-icon');
 const glyph=node('i',null,'fas fa-cash-register');glyph.setAttribute('aria-hidden','true');icon.append(glyph);
 const title=node('div',null,'station-config-title');title.append(node('h3',s.nombre||'Caja'),node('small',events.docs.find(x=>x.id===s.eventId)?.data().nombre||'Evento no activo'));
 header.append(icon,title,node('span',s.activo?'Habilitada':'Deshabilitada','station-config-state '+(s.activo?'enabled':'disabled')));card.append(header);
 const seller=users.docs.find(x=>x.id===s.vendedorId)?.data(),account=node('div',null,'station-config-account');
 account.append(node('small','Vendedor asignado'),node('strong',seller?.name||seller?.nombre||'Cuenta no disponible'));if(seller?.email)account.append(node('small',seller.email));card.append(account);
 const code=node('div',null,'station-config-code');code.append(node('small','Código de vinculación'),node('strong',s.codigoVinculacion||d.id),node('small','Introdúcelo en la tablet de Autoservicio'));card.append(code);
 const actions=node('div',null,'station-config-actions');
 if(s.activo){const launch=node('a','Vista previa', 'btn-secondary');launch.href='autoservicio.html?estacion='+encodeURIComponent(d.id)+'&evento='+encodeURIComponent(s.eventId)+'&preview=1';launch.target='_self';launch.rel='noopener';launch.title='Probar como administrador';actions.append(launch);}
 const toggle=btn(s.activo?'Deshabilitar':'Habilitar',async()=>{const result=await Swal.fire({title:s.activo?'¿Deshabilitar estación?':'¿Habilitar estación?',text:s.activo?'La estación dejará de recibir pedidos. Revisa antes que no haya pedidos pendientes.':'La estación podrá recibir pedidos nuevamente.',showCancelButton:true,confirmButtonText:s.activo?'Deshabilitar':'Habilitar',cancelButtonText:'Volver'});if(!result.isConfirmed)return;try{if(s.activo){const orders=await db.collection('pedidos_autoservicio').where('estacionId','==',d.id).get({source:'server'});if(orders.docs.some(o=>o.data().estado==='pendiente'))throw Error('Cobra o cancela los pedidos pendientes antes de deshabilitar la estación');}await d.ref.update({activo:!s.activo});}catch(e){showError(e.message);}});actions.append(toggle);for(const [label,action] of [['Editar','edit'],['Regenerar código','rotate'],['Eliminar','delete']])actions.append(btn(label,async()=>{try{await manageStation(d.id,action,users);}catch(e){showError(e.message);}}));card.append(actions);list.append(card);
 }
 if(!list.children.length)list.append(node('p','Crea tu primera estación.'));
 }
 stop=db.collection('estaciones_venta').onSnapshot(snap=>{stationSnapshot=snap;renderStations(snap);},e=>{$('stationList').textContent=e.message;stop=null;if(stopUsers){stopUsers();stopUsers=null;}});
 stopUsers=db.collection('usuarios').onSnapshot(snap=>{users=snap;refreshVendors();if(stationSnapshot)renderStations(stationSnapshot);},e=>showError('No se pudieron actualizar las cuentas: '+e.message));
 }catch(e){showError(e.message);}finally{opening=false;}
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