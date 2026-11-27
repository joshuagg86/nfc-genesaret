(function(){
'use strict';
const $=id=>document.getElementById(id), money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
let products=[],cart=new Map(),stopProducts=null,stopEvents=null,version=0,authorized=false;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;if(text==='🧴')n.classList.add('water-bottle-icon');return n;};
const status=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
const available=p=>Number.isFinite(Number(p.precio))&&Number(p.precio)>0&&(p.esInfinito===true||Number(p.stock)>0);
let customizing=false,sending=false,online=false,pendingId=null;
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
 const list=$('products'),basket=$('cart');list.replaceChildren();basket.replaceChildren();
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
 if(!basket.children.length)basket.append(node('p','Selecciona productos para empezar.'));$('total').textContent=money(total);$('send').disabled=sending||!online||!authorized||!cart.size;
}
function watch(){online=false;pendingId=null;const token=++version;if(stopProducts)stopProducts();stopProducts=null;products=[];cart.clear();render();const id=$('event').value;if(!authorized||!id){status('No hay eventos activos.');return;}status('Cargando menú…');stopProducts=db.collection('articulos').where('eventId','==',id).onSnapshot({includeMetadataChanges:true},snap=>{if(token!==version)return;products=snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>String(a.nombre||'').localeCompare(String(b.nombre||''),'es'));for(const [key,item] of cart){const p=products.find(x=>x.id===item.id);if(!p||!available(p)||(!p.esInfinito&&count(p.id)>Number(p.stock)))cart.delete(key);else {try{const current=GenesaretCheckout.resolveRecipe(p,item.selection);if(current.price!==Math.round(item.price*100))cart.delete(key);}catch(e){cart.delete(key);}}}online=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;render();status(snap.metadata.fromCache?'Menú local · conexión no confirmada':'Menú actualizado');},err=>{if(token!==version)return;products=[];cart.clear();render();status('No se pudo cargar el menú: '+err.message,true);});}
auth.onAuthStateChanged(async user=>{const token=++version;authorized=false;if(stopProducts)stopProducts();if(stopEvents)stopEvents();stopProducts=stopEvents=null;products=[];cart.clear();$('event').replaceChildren();$('event').disabled=$('search').disabled=true;render();if(!user){status('Inicia sesión como administrador para probar Autoservicio.',true);return;}try{const p=await db.collection('usuarios').doc(user.uid).get();if(token!==version)return;if(!p.exists||p.data().activo===false||!['admin','administrador'].includes(p.data().role)){status('Esta versión requiere acceso de administrador.',true);return;}authorized=true;stopEvents=db.collection('eventos').where('activo','==',true).onSnapshot(snap=>{if(!authorized)return;const old=$('event').value;$('event').replaceChildren();for(const d of snap.docs)$('event').add(new Option(d.data().nombre||'Evento',d.id));if([...$('event').options].some(o=>o.value===old))$('event').value=old;$('event').disabled=!snap.size;$('search').disabled=!snap.size;if(old!==$('event').value||!stopProducts)watch();},err=>{authorized=false;++version;if(stopProducts)stopProducts();stopProducts=null;products=[];cart.clear();$('event').disabled=$('search').disabled=true;render();status('No se pudieron consultar eventos: '+err.message,true);});}catch(err){if(token===version)status('No se pudo verificar el acceso: '+err.message,true);}});
async function sendOrder(){
 if(sending||!online||!authorized||!cart.size)return;
 const ev=$('event').value,items=[...cart.values()].map(x=>({id:x.id,cantidad:x.qty,precio:x.price,selection:x.selection}));
 sending=true;render();$('event').disabled=true;
 try{
  const uid=auth.currentUser.uid,ref=pendingId?db.collection('pedidos_autoservicio').doc(pendingId):db.collection('pedidos_autoservicio').doc();pendingId=ref.id;
  await db.runTransaction(async tx=>{
   const [profile,event,previous,...docs]=await Promise.all([tx.get(db.collection('usuarios').doc(uid)),tx.get(db.collection('eventos').doc(ev)),tx.get(ref),...items.map(i=>tx.get(db.collection('articulos').doc(i.id)))]);
   if(!profile.exists||profile.data().activo===false||!['admin','administrador'].includes(profile.data().role)||!event.exists||event.data().activo!==true)throw Error('Acceso no autorizado');
   if(previous.exists){if(previous.data().creadoPor!==uid||previous.data().eventId!==ev)throw Error('Pedido inválido');return;}
   let total=0;const quantities=new Map();
   const rows=items.map((i,j)=>{const d=docs[j],p=d.data();if(!d.exists||p.eventId!==ev||!available(p))throw Error('Producto no disponible');const detail=GenesaretCheckout.resolveRecipe(p,i.selection);if(detail.price!==Math.round(i.precio*100))throw Error('El precio cambió');quantities.set(i.id,(quantities.get(i.id)||0)+i.cantidad);if(!p.esInfinito&&quantities.get(i.id)>Number(p.stock))throw Error('Stock insuficiente');total+=detail.price*i.cantidad;return {...i,nombre:p.nombre,notes:detail.notes};});
   tx.set(ref,{eventId:ev,items:rows,total:total/100,estado:'pendiente',creadoPor:uid,fecha:new Date()});
  });
  cart.clear();pendingId=null;render();
  const code='GENESARET:PEDIDO:'+ref.id;
  const box=node('div');box.append(node('p','Presenta este código en Caja. El número de cocina se asigna al pagar.'));
  const qr=node('div');qr.style.cssText='display:flex;justify-content:center;margin:16px auto';box.append(qr);
  if(typeof QRCode==='function')new QRCode(qr,{text:code,width:220,height:220});
  box.append(node('p',ref.id));
  await Swal.fire({title:'¡Pedido enviado!',html:box,confirmButtonText:'Nuevo pedido',allowOutsideClick:false,customClass:{popup:'genesaret-smart-modal'}});
 }catch(e){status('No se pudo enviar: '+e.message,true);await Swal.fire({title:'No se pudo enviar',text:e.message,icon:'error'});}finally{sending=false;$('event').disabled=!authorized;render();}
}
$('send').onclick=sendOrder;
$('event').onchange=watch;$('search').oninput=render;
})();