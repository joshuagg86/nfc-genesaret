(function(root){
'use strict';
const $=id=>document.getElementById(id);
const units=['unidad','g','ml'];
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
const qty=n=>Number(n).toLocaleString('es-MX');
let eventId='', supplies=[], products=[], recipes=new Map(), moves=[], stops=[], eventStop=null, mode='', busy=false, draft=[], extras=[], selectedProduct='', generation=0, loaded=new Set();
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
function option(select,label,value){select.add(new Option(label,value));}
function status(message){$('smartStatus').textContent=message;$('recipeStatus').textContent=message;}
function tile(label,value){const e=node('div',null,'smart-tile');e.append(node('small',label),node('strong',value));return e;}
function button(label,action,cls='btn-secondary'){const b=node('button',label,cls);b.type='button';b.onclick=action;return b;}
function numeric(value,label){if(String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0||!Number.isSafeInteger(Number(value)))throw Error(label+' debe ser un entero no negativo');return Number(value);}
function checkAdmin(profile){if(!profile.exists||profile.data().role!=='admin'||profile.data().activo===false)throw Error('Sin permisos de administrador');}
function renderSupplies(){
 const target=$('smartList');target.replaceChildren();
 $('smartStats').replaceChildren(tile('Insumos',supplies.length),tile('Stock bajo',supplies.filter(s=>s.stock<=s.minStock).length),tile('Valor de existencias',money(supplies.reduce((sum,s)=>sum+s.stock*s.costPerUnit,0))));
 const query=$('smartSearch').value.toLowerCase();
 for(const s of supplies.filter(s=>s.nombre.toLowerCase().includes(query)&&($('smartFilter').value!=='low'||s.stock<=s.minStock))){
 const e=node('article',null,'smart-card');e.append(node('h3',s.nombre),node('strong',qty(s.stock)+' '+s.unit,'smart-amount'),node('small','Mínimo: '+qty(s.minStock)+' '+s.unit+' · Costo/u: '+money(s.costPerUnit)));
 e.append(node('small',s.cobrableComoExtra?'Extra sugerido: '+money(s.precioExtraDefault||0):'Extra sin costo'));
 if(s.stock<=s.minStock)e.append(node('span',s.stock===0?'Agotado':'Stock bajo','smart-warning'));
 const actions=node('div',null,'smart-actions');actions.append(button('Entrada',()=>movement(s,'entrada')),button('Salida / merma',()=>movement(s,'salida')),button('Editar',()=>edit(s)));e.append(actions);target.append(e);
 }
 if(!target.children.length)target.append(node('p','No hay insumos para mostrar.'));
 const hist=$('smartHistory');hist.replaceChildren();
 for(const m of moves.slice().sort((a,b)=>(b.fecha?.toMillis?.()||0)-(a.fecha?.toMillis?.()||0)).slice(0,20)){const e=node('div',null,'overview-row');e.append(node('span',m.nombre+' · '+m.motivo),node('strong',(m.delta>0?'+':'')+qty(m.delta)+' '+m.unit));hist.append(e);}
 if(!hist.children.length)hist.append(node('p','Sin movimientos registrados.'));
}
function updateSummary(){
 const box=$('recipeSummary');box.replaceChildren();let capacity=Infinity,cost=0,valid=draft.length>0;const totals=new Map();
 for(const row of draft){const s=supplies.find(x=>x.id===row.id);if(!s||!Number.isSafeInteger(row.amount)||row.amount<=0){valid=false;continue;}totals.set(row.id,(totals.get(row.id)||0)+row.amount);}
 for(const [id,amount] of totals){const s=supplies.find(x=>x.id===id);capacity=Math.min(capacity,Math.floor(s.stock/amount));cost+=amount*s.costPerUnit;}
 const product=products.find(p=>p.id===selectedProduct);const price=Number(product?.precio); const extraValid=extras.every(x=>supplies.some(s=>s.id===x.id)&&Number.isSafeInteger(x.amount)&&x.amount>0&&Number.isFinite(x.price)&&x.price>=0)&&new Set(extras.map(x=>x.id)).size===extras.length;
 box.append(tile('Porciones posibles',valid?qty(capacity):'—'),tile('Costo interno / porción',valid?money(cost):'—'),tile('Precio base de venta',Number.isFinite(price)?money(price):'—'),tile('Margen bruto estimado',valid&&Number.isFinite(price)?money(price-cost):'—'));
 $('recipeSave').disabled=busy||!valid||!extraValid||!selectedProduct||new Set(draft.map(x=>x.id)).size!==draft.length; $('recipeActivate').disabled=$('recipeSave').disabled;
}
function renderRecipe(){
 const box=$('recipeLines');box.replaceChildren();
 for(const [i,line] of draft.entries()){const row=node('div',null,'recipe-row');const sel=node('select');sel.setAttribute('aria-label','Ingrediente');option(sel,'Seleccionar ingrediente','');for(const s of supplies)option(sel,s.nombre+' ('+s.unit+')',s.id);sel.value=line.id;sel.onchange=()=>{line.id=sel.value;updateSummary();};const input=node('input');input.type='number';input.min='1';input.step='1';input.value=line.amount||'';input.placeholder='Cantidad';input.setAttribute('aria-label','Cantidad por porción');input.oninput=()=>{line.amount=Number(input.value);updateSummary();};const removable=node('label',null,'recipe-check');const check=node('input');check.type='checkbox';check.checked=line.removable===true;check.onchange=()=>{line.removable=check.checked;};removable.append(check,node('span','Se puede quitar'));row.append(sel,input,removable,button('Quitar',()=>{draft.splice(i,1);renderRecipe();}));box.append(row);}
 renderExtras();updateSummary();
}
function renderExtras(){
 const box=$('recipeExtras');box.replaceChildren();
 for(const [i,line] of extras.entries()){
 const row=node('div',null,'recipe-extra-row');
 const sel=node('select');sel.setAttribute('aria-label','Insumo extra');option(sel,'Seleccionar extra','');for(const s of supplies)option(sel,s.nombre+' ('+s.unit+')',s.id);sel.value=line.id;
 const amount=node('input');amount.type='number';amount.min='1';amount.step='1';amount.value=line.amount||'';amount.setAttribute('aria-label','Cantidad extra');amount.placeholder='Cantidad';
 const price=node('input');price.type='number';price.min='0';price.step='0.01';price.value=line.price;price.setAttribute('aria-label','Precio extra MXN');price.placeholder='Precio extra';
 sel.onchange=()=>{line.id=sel.value;const s=supplies.find(x=>x.id===line.id);line.price=s?.cobrableComoExtra?Number(s.precioExtraDefault||0):0;price.value=line.price;updateSummary();};
 amount.oninput=()=>{line.amount=Number(amount.value);updateSummary();};price.oninput=()=>{line.price=price.value===''?NaN:Number(price.value);updateSummary();};
 row.append(sel,amount,price,button('Quitar',()=>{extras.splice(i,1);renderRecipe();}));box.append(row);
 }
}
function loadDraft(){selectedProduct=$('recipeProduct').value; $('recipeState').textContent=recipes.get(selectedProduct)?.estado==='activa'?'Receta activa':recipes.has(selectedProduct)?'Receta en borrador':'Sin receta';draft=(recipes.get(selectedProduct)?.lines||[]).map(x=>({...x}));extras=(recipes.get(selectedProduct)?.extras||[]).map(x=>({...x}));renderRecipe();}
function renderProducts(){const sel=$('recipeProduct'),old=sel.value;sel.replaceChildren();option(sel,'Seleccionar producto','');for(const p of products)option(sel,p.nombre,p.id);sel.value=products.some(p=>p.id===old)?old:'';if(sel.value!==selectedProduct)loadDraft();}
function subscribe(id){
 eventId=id;const token=++generation;stops.forEach(fn=>fn());stops=[];supplies=[];products=[];moves=[];recipes.clear();draft=[];extras=[];selectedProduct='';loaded.clear();$('recipeProduct').replaceChildren();renderSupplies();renderRecipe();
 if(!id){status('Selecciona un evento');return;}
 status('Cargando inventario…');
 const watch=(name,handler)=>stops.push(db.collection(name).where('eventId','==',id).onSnapshot(snap=>{if(token!==generation)return;handler(snap.docs.map(d=>({...d.data(),id:d.id})));loaded.add(name);if(loaded.size===4)status('');},e=>{if(token===generation)status('No se pudo acceder a '+name+': '+e.message);}));
 watch('insumos',rows=>{supplies=rows;renderSupplies();renderRecipe();});
 watch('articulos',rows=>{products=rows;renderProducts();});
 watch('recetas_borrador',rows=>{recipes=new Map(rows.map(r=>[r.productId,r]));if(!draft.length&&!extras.length)loadDraft();else $('recipeState').textContent=recipes.get(selectedProduct)?.estado==='activa'?'Receta activa':recipes.has(selectedProduct)?'Receta en borrador':'Sin receta';});
 watch('movimientos_insumos',rows=>{moves=rows;renderSupplies();});
}
function setEvent(id){$('smartEvent').value=id;$('recipeEvent').value=id;subscribe(id);}
function open(next){
 mode=next;
 if(!eventStop){$('smartEvent').onchange=()=>setEvent($('smartEvent').value);$('recipeEvent').onchange=()=>setEvent($('recipeEvent').value);$('smartSearch').oninput=renderSupplies;$('smartFilter').onchange=renderSupplies;$('smartNew').onclick=()=>edit();$('recipeProduct').onchange=loadDraft;$('recipeAdd').onclick=()=>{if(!selectedProduct)return showError('Selecciona un producto');draft.push({id:'',amount:1});renderRecipe();};$('recipeSave').onclick=()=>saveRecipe('borrador');$('recipeActivate').onclick=()=>saveRecipe('activa');$('recipeCreateSupply').onclick=()=>edit(null,true);$('recipeExtraAdd').onclick=()=>{if(!selectedProduct)return showError('Selecciona un producto');extras.push({id:'',amount:1,price:0});renderRecipe();};
 eventStop=db.collection('eventos').onSnapshot(snap=>{const events=snap.docs.map(d=>({id:d.id,...d.data()}));for(const key of ['smartEvent','recipeEvent']){const sel=$(key);sel.replaceChildren();option(sel,'Seleccionar evento','');for(const e of events)option(sel,e.nombre+(e.activo===false?' (archivado)':''),e.id);}const id=events.some(e=>e.id===eventId)?eventId:events.find(e=>e.activo)?.id||'';if(id!==eventId||!stops.length)setEvent(id);else{$('smartEvent').value=id;$('recipeEvent').value=id;}},e=>status(e.message));}
}
async function edit(s,fromRecipe=false){
 if(busy||!eventId)return showError('Selecciona un evento');const ev=eventId;
 const form=node('div',null,'smart-modal-form');const fields={};for(const [key,label,value,type] of [['nombre','Nombre',s?.nombre||'','text'],['stock','Cantidad inicial',0,'number'],['minStock','Stock mínimo',s?.minStock||0,'number'],['costPerUnit','Costo por unidad base (MXN)',s?.costPerUnit||0,'number']]){if(s&&key==='stock')continue;const l=node('label',label),i=node('input');i.type=type;i.value=value;i.className='smart-modal-input';if(type==='number'){i.min='0';i.step=key==='costPerUnit'?'0.000001':'1';}fields[key]=i;l.append(i);form.append(l);}
 const u=node('select');for(const unit of units)option(u,unit,unit);u.value=s?.unit||'unidad';u.disabled=!!s;const unitLabel=node('label','Unidad base (g, ml o unidad)');unitLabel.append(u);form.append(unitLabel);const chargeLabel=node('label',null,'smart-modal-check');const charge=node('input');charge.type='checkbox';charge.checked=s?.cobrableComoExtra===true;chargeLabel.append(charge,node('span','Se cobra como extra'));const extraLabel=node('label','Precio sugerido por porción extra (MXN)');const extra=node('input');extra.type='number';extra.min='0';extra.step='0.01';extra.value=s?.precioExtraDefault||0;extraLabel.append(extra);extraLabel.hidden=!charge.checked;charge.onchange=()=>{extraLabel.hidden=!charge.checked;};form.append(chargeLabel,extraLabel);
 const result=await Swal.fire({title:s?'Editar insumo':'Nuevo insumo',html:form,customClass:{popup:'genesaret-smart-modal'},width:680,showCancelButton:true,cancelButtonText:'Cancelar',confirmButtonText:'Guardar',preConfirm:()=>{try{const nombre=fields.nombre.value.trim(),minStock=numeric(fields.minStock.value,'Mínimo'),costPerUnit=Number(fields.costPerUnit.value);if(!nombre||nombre.length>100||!Number.isFinite(costPerUnit)||costPerUnit<0||!units.includes(u.value))throw Error('Datos inválidos');const precioExtraDefault=charge.checked?Number(extra.value):0;if(!Number.isFinite(precioExtraDefault)||precioExtraDefault<0||charge.checked&&precioExtraDefault<=0)throw Error('Ingresa un precio extra positivo');return{nombre,minStock,costPerUnit,cobrableComoExtra:charge.checked,precioExtraDefault:Math.round(precioExtraDefault*100)/100,unit:u.value,stock:s?s.stock:numeric(fields.stock.value,'Cantidad')};}catch(e){Swal.showValidationMessage(e.message);}}});
 if(!result.isConfirmed)return;busy=true;
 try{const uid=auth.currentUser.uid,ref=s?db.collection('insumos').doc(s.id):db.collection('insumos').doc(),log=db.collection('movimientos_insumos').doc();await db.runTransaction(async tx=>{const profile=await tx.get(db.collection('usuarios').doc(uid));const event=await tx.get(db.collection('eventos').doc(ev));const old=s?await tx.get(ref):null;checkAdmin(profile);if(!event.exists||event.data().activo!==true)throw Error('Evento inactivo');if(s&&(!old.exists||old.data().eventId!==ev))throw Error('Insumo inválido');const {stock,...details}=result.value;if(s)tx.update(ref,details);else{tx.set(ref,{...details,stock,eventId:ev,createdAt:new Date()});if(stock)tx.set(log,{eventId:ev,insumoId:ref.id,nombre:details.nombre,unit:details.unit,delta:stock,stockFinal:stock,motivo:'Inventario inicial',usuarioId:uid,fecha:new Date()});}});if(fromRecipe&&!s&&eventId===ev&&selectedProduct){draft.push({id:ref.id,amount:1,removable:false});renderRecipe();}showSuccess('Insumo guardado');}catch(e){showError(e.message);}finally{busy=false;}
}
async function movement(s,type){
 if(busy)return;const ev=eventId;const amount=node('input');amount.type='number';amount.min='1';amount.step='1';amount.className='swal2-input';const reason=node('input');reason.placeholder='Compra, donación, merma, ajuste…';reason.className='swal2-input';const form=node('div');form.append(node('p','Cantidad en '+s.unit),amount,node('p','Motivo obligatorio'),reason);
 const res=await Swal.fire({title:type==='entrada'?'Entrada de '+s.nombre:'Salida de '+s.nombre,html:form,customClass:{popup:'genesaret-smart-modal'},showCancelButton:true,cancelButtonText:'Cancelar',confirmButtonText:'Registrar',preConfirm:()=>{try{const n=numeric(amount.value,'Cantidad');if(!n||!reason.value.trim())throw Error('Cantidad positiva y motivo obligatorio');return{n,reason:reason.value.trim()};}catch(e){Swal.showValidationMessage(e.message);}}});if(!res.isConfirmed)return;busy=true;
 try{const uid=auth.currentUser.uid,ref=db.collection('insumos').doc(s.id),log=db.collection('movimientos_insumos').doc();await db.runTransaction(async tx=>{const [p,e,d]=await Promise.all([tx.get(db.collection('usuarios').doc(uid)),tx.get(db.collection('eventos').doc(ev)),tx.get(ref)]);checkAdmin(p);if(!e.exists||e.data().activo!==true||!d.exists||d.data().eventId!==ev)throw Error('Evento o insumo inválido');const old=d.data(),delta=res.value.n*(type==='entrada'?1:-1),stock=old.stock+delta;if(!Number.isSafeInteger(stock)||stock<0)throw Error('Stock insuficiente');tx.update(ref,{stock});tx.set(log,{eventId:ev,insumoId:s.id,nombre:old.nombre,unit:old.unit,delta,stockFinal:stock,motivo:res.value.reason,usuarioId:uid,fecha:new Date()});});showSuccess('Movimiento registrado');}catch(e){showError(e.message);}finally{busy=false;}
}
async function saveRecipe(estado){
 if(busy||!selectedProduct||!draft.length)return;const ev=eventId,productId=selectedProduct,lines=draft.map(x=>({...x,removable:x.removable===true})),extraLines=extras.map(x=>({id:x.id,amount:x.amount,price:Math.round(x.price*100)/100}));if(new Set(extraLines.map(x=>x.id)).size!==extraLines.length||extraLines.some(x=>!x.id||!Number.isSafeInteger(x.amount)||x.amount<=0||!Number.isFinite(x.price)||x.price<0))return showError('Revisa los extras');if(new Set(lines.map(x=>x.id)).size!==lines.length)return showError('No repitas ingredientes; suma sus cantidades');if(lines.some(x=>!x.id||!Number.isSafeInteger(x.amount)||x.amount<=0))return showError('Revisa las cantidades');busy=true;updateSummary();
 try{const uid=auth.currentUser.uid,ref=db.collection('recetas_borrador').doc(productId);await db.runTransaction(async tx=>{const [p,e,product,...docs]=await Promise.all([tx.get(db.collection('usuarios').doc(uid)),tx.get(db.collection('eventos').doc(ev)),tx.get(db.collection('articulos').doc(productId)),...[...lines,...extraLines].map(l=>tx.get(db.collection('insumos').doc(l.id)))]);checkAdmin(p);if(!e.exists||e.data().activo!==true||!product.exists||product.data().eventId!==ev||docs.some(d=>!d.exists||d.data().eventId!==ev))throw Error('Producto o ingrediente inválido');tx.set(ref,{eventId:ev,productId,lines,extras:extraLines,estado,updatedAt:new Date(),usuarioId:uid});tx.update(db.collection('articulos').doc(productId),{recetaActiva:estado==='activa'?{lines:lines.map((l,i)=>({...l,nombre:docs[i].data().nombre})),extras:extraLines.map((l,i)=>({...l,nombre:docs[lines.length+i].data().nombre}))}:null});});$('recipeState').textContent=estado==='activa'?'Receta activa':'Receta en borrador';showSuccess(estado==='activa'?'Receta activada':'Receta guardada como borrador');}catch(e){showError(e.message);}finally{busy=false;updateSummary();}
}
root.GenesaretInventory={open};
})(globalThis);
