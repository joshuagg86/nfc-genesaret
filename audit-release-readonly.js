(async function(){
'use strict';
if(!['localhost','127.0.0.1'].includes(location.hostname)||location.port!=='8000'||firebase.app().options.projectId!=='nfc-genesaret')throw Error('Ejecuta únicamente en localhost:8000 con el proyecto real.');
const user=auth.currentUser;if(!user)throw Error('Inicia sesión como administrador.');
const profile=(await db.collection('usuarios').doc(user.uid).get({source:'server'})).data();
if(!profile||profile.activo!==true||!['admin','administrador'].includes(profile.role))throw Error('Se requiere administrador activo.');
const names=['usuarios','eventos','articulos','insumos','pulseras','transacciones','estaciones_venta','cajas_activas','turnos_caja','pedidos_autoservicio'];
const sets={};for(const n of names){sets[n]=await db.collection(n).get({source:'server'});}
const map=n=>new Map(sets[n].docs.map(d=>[d.id,d.data()]));
const users=map('usuarios'),events=map('eventos'),supplies=map('insumos'),shifts=map('turnos_caja');
const findings=[];const note=(level,collection,id,reason)=>findings.push({nivel:level,coleccion:collection,id,motivo:reason});
const equal=(a,b)=>{const norm=v=>Array.isArray(v)?v.map(norm):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,norm(v[k])])):v;return JSON.stringify(norm(a))===JSON.stringify(norm(b));};
for(const [id,u] of users)if(typeof u.activo!=='boolean'||!['admin','administrador','vendedor','autoservicio','cocina','tv'].includes(u.role))note('revisar','usuarios',id,'Rol o estado no compatible');
for(const [id,p] of map('articulos')){
 if(events.get(p.eventId)?.activo!==true)continue;
 if(typeof p.precio!=='number'||!Number.isFinite(p.precio)||p.precio<=0)note('bloqueo','articulos',id,'Precio inválido');
 if(!p.esInfinito&&(!Number.isFinite(p.stock)||p.stock<0))note('bloqueo','articulos',id,'Stock inválido');
 if(p.recetaActiva){try{const expected=GenesaretCheckout.buildIntegrityCatalog(p);if(!equal(expected,p.catalogoIntegridad))note('migrar','articulos',id,'Regenerar catálogo de variantes');
 for(const l of [...p.recetaActiva.lines,...p.recetaActiva.extras]){if(supplies.get(l.id)?.eventId!==p.eventId)note('bloqueo','articulos',id,'Insumo ausente o de otro evento: '+l.id);if(!Number.isInteger(l.amount)||l.amount<=0)note('bloqueo','articulos',id,'Cantidad de insumo no entera o inválida');}
 }catch(e){note('bloqueo','articulos',id,e.message);}}
}
for(const [id,s] of map('pulseras'))if(!Number.isFinite(s.saldoActual)||s.saldoActual<0)note('revisar','pulseras',id,'Saldo no numérico o negativo');
for(const [id,s] of map('cajas_activas'))if(s.turnoId!=null&&(shifts.get(s.turnoId)?.vendedorId!==id||shifts.get(s.turnoId)?.estado!=='abierto'))note('bloqueo','cajas_activas',id,'Turno activo inconsistente');
for(const [id,s] of shifts)if(s.estado==='abierto')note('revisar','turnos_caja',id,'Cerrar o conciliar antes del cambio');
for(const [id,s] of map('pedidos_autoservicio'))if(s.estado==='pendiente')note('revisar','pedidos_autoservicio',id,'Pedido pendiente al momento de migrar');
for(const [id,s] of map('transacciones'))if(s.estadoPago==='pendiente'&&(!users.has(s.vendedorId)||!Number.isFinite(s.monto)||!['efectivo','transferencia'].includes(s.metodoPago)))note('revisar','transacciones',id,'Adeudo histórico requiere revisión');
const summary=names.map(n=>({coleccion:n,documentos:sets[n].size}));
console.table(summary);console.table(findings);
const groups={};
for(const [id,u] of users){
 const role=typeof u.role==='string'?u.role:'(sin rol)';
 const active=typeof u.activo==='boolean'?String(u.activo):'(ausente o no booleano)';
 const key=JSON.stringify([role,active]);
 if(!groups[key])groups[key]={rol:role,activo:active,cantidad:0};
 groups[key].cantidad++;
}
console.log('PERFILES AGRUPADOS (sin datos personales)');
console.table(Object.values(groups));
const pending=Array.from(map('pedidos_autoservicio')).filter(([id,o])=>o.estado==='pendiente').map(([id,o],i)=>({referencia:i+1,evento:events.get(o.eventId)?.nombre||'Sin evento reconocido',vendedor:users.get(o.vendedorId)?.role||'Sin vendedor reconocido',total:o.total??null,fecha:o.fecha?.toDate?.()?.toISOString()||'Sin fecha',partidas:Array.isArray(o.items)?o.items.length:0}));
console.log('PEDIDOS SIN COBRAR');
console.table(pending);
console.log('RESUMEN PARA COMPARTIR',JSON.stringify({perfiles:Object.values(groups),pedidos:pending}));
const counts={bloqueo:0,migrar:0,revisar:0};for(const f of findings)counts[f.nivel]++;
console.log('AUDITORÍA SOLO LECTURA — '+JSON.stringify(counts));return {summary,findings,counts};
})().catch(e=>console.error('Auditoría detenida:',e.message));