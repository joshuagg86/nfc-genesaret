(async()=>{
'use strict';
if(!['localhost','127.0.0.1'].includes(location.hostname)||location.port!=='8000'||firebase.app().options.projectId!=='nfc-genesaret')throw Error('Solo localhost:8000, proyecto real');
const u=auth.currentUser;
if(!u)throw Error('Inicia sesión como administrador');
const p=(await db.collection('usuarios').doc(u.uid).get({source:'server'})).data();
if(!p||p.activo!==true||!['admin','administrador'].includes(p.role))throw Error('Administrador activo requerido');
const roots=['usuarios','eventos','articulos','insumos','categorias','recetas_borrador','lotes_produccion','bitacora_stock','movimientos_insumos','pulseras','recargas','transacciones','anulaciones','estaciones_venta','estaciones_asignaciones','estaciones_codigos','pedidos_autoservicio','estaciones_presencia','cajas_activas','turnos_caja','liquidaciones','ventas_integridad'];
const encode=v=>{
 if(v===null)return {type:'null'};
 if(v instanceof firebase.firestore.Timestamp)return {type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds};
 if(v instanceof firebase.firestore.GeoPoint)return {type:'geopoint',latitude:v.latitude,longitude:v.longitude};
 if(v instanceof firebase.firestore.DocumentReference)return {type:'reference',path:v.path};
 if(v instanceof firebase.firestore.Blob)return {type:'bytes',base64:v.toBase64()};
 if(Array.isArray(v))return {type:'array',value:v.map(encode)};
 if(typeof v==='object')return {type:'map',value:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))};
 if(['string','number','boolean'].includes(typeof v))return {type:typeof v,value:typeof v==='number'&&!Number.isFinite(v)?String(v):v};
 throw Error('Tipo no reconocido');
};
const started=new Date().toISOString(),documents=[],counts={};
async function scan(path){const snap=await db.collection(path).get({source:'server'});counts[path]=snap.size;for(const d of snap.docs)documents.push({path:d.ref.path,fields:encode(d.data())});return snap.docs;}
for(const root of roots){const docs=await scan(root);if(root==='eventos')for(const d of docs)for(const sub of ['pedidos_cocina','preparacion_pedidos','confirmaciones_caja','contadores'])await scan(d.ref.path+'/'+sub);if(root==='turnos_caja')for(const d of docs)await scan(d.ref.path+'/movimientos');}
const backup={format:'genesaret-known-collections-v1',project:'nfc-genesaret',started,finished:new Date().toISOString(),scope:'Known app collections only; excludes Authentication, Storage, rules, indexes and unknown collection paths',counts,documents};
const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='genesaret-respaldo-'+started.replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
console.log('RESPALDO LOCAL GENERADO:',documents.length,'documentos de',Object.keys(counts).length,'rutas. Verifica tu carpeta Descargas. No compartas el archivo.');console.table(counts);
})().catch(e=>console.error('RESPALDO NO COMPLETADO:',e.message));