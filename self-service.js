(function(){
'use strict';
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
let products=[],cart=new Map(),stopProducts=null,stopEvents=null,version=0,authorized=false;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;if(text==='🧴')n.classList.add('water-bottle-icon');return n;};
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const available=p=>Number.isFinite(Number(p.precio))&&Number(p.precio)>0&&(p.esInfinito===true||Number(p.stock)>0);
let customizing=false,sending=false,online=false,pendingId=null,station=null,stationStop=null,stationConfirmed=false;
let paymentStop=null,paymentTimer=null,paymentScope='',paymentQueue=[],paymentShowing=false;
const paymentSeen=new Set();
function stopPaymentDisplay(){
 if(paymentStop)paymentStop();paymentStop=null;paymentScope='';paymentQueue=[];paymentShowing=false;
 clearTimeout(paymentTimer);$('customerPayment').hidden=true;
}
function showNextPayment(){
 if(paymentShowing||!paymentQueue.length)return;
 const sale=paymentQueue.shift(),panel=$('customerPayment');
 const compact=cart.size>0||customizing||sending||Swal.isVisible()||document.activeElement===$('search');
 panel.classList.toggle('compact',compact);
 $('customerPaymentAmount').textContent=money(sale.total);
 $('customerPaymentNumber').textContent=sale.kitchen?(sale.number?'Pedido '+sale.number:'Consulta tu número en Caja'):'¡Gracias por tu compra!';
 $('customerPaymentHint').textContent=sale.kitchen?'Consulta la TV para recoger tu pedido.':'Gracias por visitarnos.';
 panel.hidden=false;paymentShowing=true;window.GeneSound?.play('success');
 paymentTimer=setTimeout(()=>{panel.hidden=true;paymentShowing=false;showNextPayment();},5000);
}
function watchPaymentDisplay(linked){
 const scope=linked.id+'|'+linked.eventId+'|'+linked.vendedorId;
 if(paymentScope===scope)return;
 stopPaymentDisplay();paymentScope=scope;
 let initialized=false;
 paymentStop=db.collection('eventos').doc(linked.eventId).collection('confirmaciones_caja').doc(linked.vendedorId).onSnapshot({includeMetadataChanges:true},snap=>{
  if(paymentScope!==scope||snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;
  const t=snap.data();
  if(t&&t.carritoId&&t.fecha?.toMillis){const key=scope+'|'+t.carritoId,time=t.fecha.toMillis();if(!paymentSeen.has(key)){paymentSeen.add(key);if(initialized&&Date.now()-time<15000&&time<=Date.now()+10000)paymentQueue.push({total:t.total,kitchen:t.kitchen,number:t.numeroPedido,time});}}
  initialized=true;showNextPayment();
 },e=>{if(paymentScope===scope){console.warn('Confirmación de cliente no disponible',e);$('paymentDisplayStatus').textContent='Confirmaciones no disponibles';}});
}
const params=new URLSearchParams(location.search);
const requestedStation=/^\d{6}$/.test(params.get('estacion')||'')?params.get('estacion'):null;
const requestedEvent=requestedStation?params.get('evento'):null;
const stationKey=()=> 'genesaret.station.'+auth.currentUser?.uid+(requestedStation?'.'+requestedStation:'');
let pairingVersion=0;
let operatorUntil=0,operatorTimer=null;
function lockOperator(){operatorUntil=0;clearTimeout(operatorTimer);$('kioskOperator').hidden=true;document.body.classList.remove('operator-open');}
function operatorAllowed(){return authorized&&Date.now()<operatorUntil;}
function unlockOperator(){operatorUntil=Date.now()+60000;clearTimeout(operatorTimer);operatorTimer=setTimeout(lockOperator,60000);$('kioskOperator').hidden=false;document.body.classList.add('operator-open');}
$('kioskSettings').onclick=async()=>{
 if(operatorAllowed()){lockOperator();return;}
 const user=auth.currentUser;if(!user||!authorized||sending||customizing)return;
 if(!user.email){await Swal.fire({title:'Acceso no disponible',text:'Esta cuenta no tiene correo asociado.',icon:'error'});return;}
 const result=await Swal.fire({title:'Configuración del operador',text:'Introduce la contraseña de esta cuenta para acceder a los controles.',input:'password',inputAttributes:{autocomplete:'current-password'},showCancelButton:true,confirmButtonText:'Desbloquear',cancelButtonText:'Cancelar',showLoaderOnConfirm:true,allowOutsideClick:()=>!Swal.isLoading(),customClass:{popup:'genesaret-smart-modal'},preConfirm:async value=>{try{if(!value)throw Error();await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,value));return true;}catch(e){Swal.showValidationMessage('No se pudo verificar la contraseña.');return false;}}});
 if(result.isConfirmed&&auth.currentUser?.uid===user.uid&&authorized)unlockOperator();
};
$('kioskOperator').addEventListener('pointerdown',()=>{if(operatorAllowed())unlockOperator();});


function unlinkStation(){clearPresence();linkedCode=null;++pairingVersion;stopPaymentDisplay();if(stationStop)stationStop();stationStop=null;station=null;stationConfirmed=false;pendingId=null;localStorage.removeItem(stationKey());$('stationLabel').textContent='Sin estación vinculada';render();}
let previewMode=false,linkedCode=null,stopPresence=null;
function clearPresence(){if(stopPresence)stopPresence();stopPresence=null;}
async function linkStation(code){
 if(sending||!authorized)return;
 const attempt=++pairingVersion,ev=$('event').value;code=String(code||'').trim();
 if(!/^\d{6}$/.test(code))return status('Ingresa un código de seis dígitos',true);
 try{
 let d;
 if(previewMode&&requestedStation){d=await db.collection('estaciones_venta').doc(requestedStation).get({source:'server'});}
 else{const alias=await db.collection('estaciones_codigos').doc(code).get({source:'server'});d=await db.collection('estaciones_venta').doc(alias.exists?alias.data().estacionId:code).get({source:'server'});}
 if(attempt!==pairingVersion||ev!==$('event').value||!authorized)return;
 if(!d.exists||!d.data().activo||d.data().archivada||d.data().eventId!==ev||(!previewMode&&(d.data().codigoVinculacion||d.id)!==code))throw Error('Código inválido o estación no disponible');
 if(stationStop)stationStop();clearPresence();station={id:d.id,...d.data()};linkedCode=code;stationConfirmed=true;if(!previewMode)localStorage.setItem(stationKey(),code);
 $('stationLabel').textContent='Vinculada a '+station.nombre;
 stationStop=d.ref.onSnapshot({includeMetadataChanges:true},snap=>{
 if(!snap.exists||!snap.data().activo||snap.data().archivada||snap.data().eventId!==$('event').value||(!previewMode&&(snap.data().codigoVinculacion||snap.id)!==linkedCode)){unlinkStation();return;}
 station={id:snap.id,...snap.data()};stationConfirmed=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;
 if(stationConfirmed&&!previewMode){watchPaymentDisplay(station);if(!stopPresence)stopPresence=GenesaretPresence.start(station.id,'autoservicio',linkedCode);$('paymentDisplayStatus').textContent='';}else{stopPaymentDisplay();clearPresence();}
 $('stationLabel').textContent=stationConfirmed?'Vinculada a '+station.nombre:'Estación sin conexión confirmada';render();
 },e=>{stationConfirmed=false;clearPresence();status(e.message,true);render();});render();
 }catch(e){status(e.message,true);}
}
$('stationLink').onclick=async()=>{if(!operatorAllowed())return;const r=await Swal.fire({title:'Vincular estación',input:'text',inputLabel:'Código de seis dígitos',showCancelButton:true,confirmButtonText:'Vincular',cancelButtonText:'Cancelar'});if(r.isConfirmed&&operatorAllowed())linkStation(r.value);};$('stationUnlink').onclick=()=>{if(!sending&&operatorAllowed())unlinkStation();};
const count=id=>[...cart.values()].filter(x=>x.id===id).reduce((n,x)=>n+x.qty,0);
async function choose(p){
 if(sending||customizing||!authorized||!available(p))return;
 const token=version;customizing=true;
 try{
  const detail=await GenesaretCheckout.customize(p);
  if(!detail||token!==version||!authorized)return;
  const current=products.find(x=>x.id===p.id);
  if(!current||!available(current)||(!current.esInfinito&&count(p.id)>=Number(current.stock)))throw Error('Stock insuficiente');
  const key=GenesaretCheckout.variantKey(p.id,detail.selection);
  pendingId=null;const old=cart.get(key);
  if(old)old.qty++;else cart.set(key,{id:p.id,qty:1,price:detail.price/100,selection:detail.selection,notes:detail.notes});
 }catch(e){status(e.message,true);}finally{customizing=false;render();}
}
function change(key,delta){if(sending)return;pendingId=null;const item=cart.get(key);if(!item)return;const p=products.find(x=>x.id===item.id);if(delta>0&&(!p||!available(p)||(!p.esInfinito&&count(p.id)>=Number(p.stock))))return;if(item.qty+delta<=0)cart.delete(key);else item.qty+=delta;render();}
function render(){
 const list=$('products'),basket=$('cart');const listScroll=list.scrollTop,basketScroll=basket.scrollTop;list.replaceChildren();basket.replaceChildren();
 const q=$('search').value.trim().toLocaleLowerCase('es-MX');
 for(const p of products.filter(x=>String(x.nombre||'').toLocaleLowerCase('es-MX').includes(q))){
  const b=node('button',null,'product');b.type='button';b.disabled=!available(p)||(!p.esInfinito&&count(p.id)>=Number(p.stock));
  const cat=String(p.categoria||'Menú');b.append(node('span',GenesaretCheckout.foodIcon(p.nombre,cat.split(' ')[0].match(/[^\p{L}\p{N}]/u)?cat.split(' ')[0]:'🍽️'),'product-icon'),node('strong',p.nombre||'Producto'),node('span',money(Number(p.precio)||0)),node('small',available(p)?(p.recetaActiva?'Personalizar':'Agregar al pedido'):'No disponible'));b.onclick=()=>choose(p);list.append(b);
 }
 if(!list.children.length)list.append(node('p','No hay productos disponibles.'));
 let total=0;
 for(const [key,item] of cart){const p=products.find(x=>x.id===item.id);if(!p)continue;
  const line=node('div',null,'line'),controls=node('div',null,'controls');const minus=node('button','−'),plus=node('button','+');
  minus.type=plus.type='button';minus.setAttribute('aria-label','Quitar una unidad de '+p.nombre);plus.setAttribute('aria-label','Agregar una unidad de '+p.nombre);
  minus.onclick=()=>change(key,-1);plus.onclick=()=>change(key,1);plus.disabled=!available(p)||(!p.esInfinito&&count(p.id)>=Number(p.stock));controls.append(minus,node('strong',String(item.qty)),plus);
  const sub=Math.round(item.price*100)*item.qty/100;total+=sub;const title=node('div',null,'cart-line-title');title.append(node('span',GenesaretCheckout.foodIcon(p.nombre),'cart-food-icon'),node('strong',p.nombre));line.append(title);for(const note of item.notes)line.append(node('small',note));line.append(controls,node('span',money(sub)));basket.append(line);
 }
 if(!basket.children.length)basket.append(node('p','Selecciona productos para empezar.'));$('total').textContent=money(total);$('send').disabled=sending||!online||!authorized||!stationConfirmed||!station||!cart.size;list.scrollTop=listScroll;basket.scrollTop=basketScroll;
}
function watch(){clearPresence();++pairingVersion;stopPaymentDisplay();online=false;pendingId=null;if(stationStop)stationStop();stationStop=null;station=null;stationConfirmed=false;$('stationLabel').textContent='Sin estación vinculada';const token=++version;if(stopProducts)stopProducts();stopProducts=null;products=[];cart.clear();render();const id=$('event').value;if(!authorized||!id){status('No hay eventos activos.');return;}status('Cargando menú…');const saved=previewMode?requestedStation:localStorage.getItem(stationKey());if(saved)linkStation(saved);stopProducts=db.collection('articulos').where('eventId','==',id).onSnapshot({includeMetadataChanges:true},snap=>{if(token!==version)return;products=snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));for(const [key,item] of cart){const p=products.find(x=>x.id===item.id);if(!p||!available(p)||(!p.esInfinito&&count(p.id)>Number(p.stock)))cart.delete(key);else {try{const current=GenesaretCheckout.resolveRecipe(p,item.selection);if(current.price!==Math.round(item.price*100))cart.delete(key);}catch(e){cart.delete(key);}}}online=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;render();status(snap.metadata.fromCache?'Menú local · conexión no confirmada':'Menú actualizado');},err=>{if(token!==version)return;products=[];cart.clear();render();status('No se pudo cargar el menú: '+err.message,true);});}
$('kioskLogout').onclick=async()=>{if(sending||!operatorAllowed())return;const r=await Swal.fire({title:'¿Cerrar sesión?',text:'La vinculación de esta cuenta se conserva en este navegador.',showCancelButton:true,confirmButtonText:'Cerrar sesión',cancelButtonText:'Volver'});if(r.isConfirmed&&operatorAllowed()){try{await auth.signOut();location.replace('index.html');}catch(e){status('No se pudo cerrar sesión: '+e.message,true);}}};
auth.onAuthStateChanged(async user=>{clearPresence();previewMode=false;$('previewBack').hidden=true;lockOperator();++pairingVersion;stopPaymentDisplay();if(stationStop)stationStop();stationStop=null;station=null;stationConfirmed=false;const token=++version;authorized=false;if(stopProducts)stopProducts();if(stopEvents)stopEvents();stopProducts=stopEvents=null;products=[];cart.clear();$('event').replaceChildren();$('event').disabled=$('search').disabled=true;render();if(!user){location.replace('index.html');return;}try{const p=await db.collection('usuarios').doc(user.uid).get();if(token!==version)return;if(!p.exists||p.data().activo===false||!['admin','administrador','autoservicio'].includes(p.data().role)){status('Tu cuenta no tiene acceso a Autoservicio.',true);return;}authorized=true;previewMode=params.get('preview')==='1'&&['admin','administrador'].includes(p.data().role);$('previewBack').hidden=!previewMode;if(previewMode){$('notice').textContent='Vista previa: los pedidos se simulan y no se envían a Caja.';$('kioskSettings').hidden=true;}else $('kioskSettings').hidden=false;stopEvents=db.collection('eventos').where('activo','==',true).onSnapshot(snap=>{if(!authorized)return;const old=$('event').value;$('event').replaceChildren();for(const d of snap.docs)$('event').add(new Option(d.data().nombre||'Evento',d.id));if(requestedEvent){if([...$('event').options].some(o=>o.value===requestedEvent))$('event').value=requestedEvent;else $('event').value='';}else if([...$('event').options].some(o=>o.value===old))$('event').value=old;$('event').disabled=!!requestedEvent||!snap.size;$('search').disabled=!snap.size;if(old!==$('event').value||!stopProducts)watch();},err=>{authorized=false;++version;if(stopProducts)stopProducts();stopProducts=null;products=[];cart.clear();$('event').disabled=$('search').disabled=true;render();status('No se pudieron consultar eventos: '+err.message,true);});}catch(err){if(token===version)status('No se pudo verificar el acceso: '+err.message,true);}});
async function sendOrder(){
 if(sending||!online||!authorized||!stationConfirmed||!station||!cart.size)return;
 if(previewMode){cart.clear();render();await Swal.fire({title:'Pedido de prueba',text:'Vista previa: no se envió ningún pedido real.',icon:'success'});return;}
 const ev=$('event').value,linked={...station},items=[...cart.values()].map(x=>({id:x.id,cantidad:x.qty,precio:x.price,selection:x.selection}));
 sending=true;render();$('event').disabled=true;
 try{
  const uid=auth.currentUser.uid,ref=pendingId?db.collection('pedidos_autoservicio').doc(pendingId):db.collection('pedidos_autoservicio').doc();pendingId=ref.id;
  await db.runTransaction(async tx=>{
   const [profile,event,previous,stationDoc,...docs]=await Promise.all([tx.get(db.collection('usuarios').doc(uid)),tx.get(db.collection('eventos').doc(ev)),tx.get(ref),tx.get(db.collection('estaciones_venta').doc(linked.id)),...items.map(i=>tx.get(db.collection('articulos').doc(i.id)))]);
   if(!profile.exists||profile.data().activo===false||!['admin','administrador','autoservicio'].includes(profile.data().role)||!event.exists||event.data().activo!==true)throw Error('Acceso no autorizado');
   if(!stationDoc.exists||!stationDoc.data().activo||stationDoc.data().eventId!==ev||stationDoc.data().vendedorId!==linked.vendedorId||(stationDoc.data().codigoVinculacion||stationDoc.id)!==linkedCode)throw Error('La estación ya no está disponible');
   if(previous.exists){if(previous.data().creadoPor!==uid||previous.data().eventId!==ev||previous.data().estacionId!==linked.id)throw Error('Pedido inválido');return;}
   let total=0;const quantities=new Map();
   const rows=items.map((i,j)=>{const d=docs[j],p=d.data();if(!d.exists||p.eventId!==ev||!available(p))throw Error('Producto no disponible');const detail=GenesaretCheckout.resolveRecipe(p,i.selection);if(detail.price!==Math.round(i.precio*100))throw Error('El precio cambió');quantities.set(i.id,(quantities.get(i.id)||0)+i.cantidad);if(!p.esInfinito&&quantities.get(i.id)>Number(p.stock))throw Error('Stock insuficiente');total+=detail.price*i.cantidad;return {...i,nombre:p.nombre,notes:detail.notes};});
   tx.set(ref,{eventId:ev,items:rows,total:total/100,estado:'pendiente',estacionId:linked.id,vendedorId:linked.vendedorId,creadoPor:uid,fecha:firebase.firestore.FieldValue.serverTimestamp()});
  });
  cart.clear();pendingId=null;render();
  await Swal.fire({title:'¡Pedido recibido!',text:'Tu pedido está en '+linked.nombre+'. Acércate a Caja para pagar.',icon:'success',confirmButtonText:'Nuevo pedido',allowOutsideClick:false,customClass:{popup:'genesaret-smart-modal'}});
 }catch(e){status('No se pudo enviar: '+e.message,true);await Swal.fire({title:'No se pudo enviar',text:e.message,icon:'error'});}finally{sending=false;$('event').disabled=!!requestedEvent||!authorized;render();}
}
$('send').onclick=sendOrder;
$('event').onchange=()=>{if(operatorAllowed())watch();};$('search').oninput=render;
})();