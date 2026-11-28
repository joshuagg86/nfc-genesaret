'use strict';
// Privileged one-time maintenance; never run from a browser.
// Requires Application Default Credentials with Firestore write access.
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {createHash}=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const PROJECT='nfc-genesaret';
if(process.env.FIRESTORE_EMULATOR_HOST)throw Error('No ejecutar con emulador configurado');
const args=process.argv.slice(2);
if(!(args.length===1&&args[0]==='--preview')&&!(args.length===2&&args[0]==='--apply'&&/^[a-f0-9]{64}$/.test(args[1])))throw Error('Uso: --preview o --apply HASH');
const db=getFirestore(initializeApp({credential:applicationDefault(),projectId:PROJECT}));
const erase=['recargas','transacciones','anulaciones','pedidos_autoservicio','estaciones_presencia','cajas_activas','turnos_caja','liquidaciones','ventas_integridad','lotes_produccion','bitacora_stock','movimientos_insumos'];
const keep=['usuarios','eventos','articulos','insumos','categorias','recetas_borrador','pulseras','chips','estaciones_venta','estaciones_asignaciones','estaciones_codigos'];
const eventSubs=['pedidos_cocina','preparacion_pedidos','confirmaciones_caja','contadores'];
const plan=[];
async function inspect(ref, action, patch){
 const children=await ref.listCollections();
 if(children.length)throw Error('Subcolección no prevista: '+ref.path);
 const snap=await ref.get();if(!snap.exists)return;
 plan.push({ref,action,patch,stamp:snap.updateTime});
}
async function eraseCollection(col,allowedSubs=[]){
 for(const ref of await col.listDocuments()){
  for(const child of await ref.listCollections()){
   if(!allowedSubs.includes(child.id))throw Error('Subcolección no prevista: '+child.path);
   await eraseCollection(child);
  }
  const snap=await ref.get();if(snap.exists)plan.push({ref,action:'delete',stamp:snap.updateTime});
 }
}
async function main(){
 const roots=await db.listCollections();
 const unknown=roots.filter(c=>![...erase,...keep].includes(c.id));
 if(unknown.length)throw Error('Colecciones no previstas: '+unknown.map(c=>c.id).join(', '));
 for(const name of erase)await eraseCollection(db.collection(name),name==='turnos_caja'?['movimientos']:[]);
 for(const ref of await db.collection('eventos').listDocuments()){
  for(const c of await ref.listCollections()){
   if(!eventSubs.includes(c.id))throw Error('Subcolección no prevista: '+c.path);
   await eraseCollection(c);
  }
 }
 for(const name of ['articulos','insumos','pulseras','chips']){
  for(const ref of await db.collection(name).listDocuments()){
   const snap=await ref.get();if(!snap.exists)continue;
   const d=snap.data(),patch=name==='chips'?{saldoActual:0,ultimaTransaccion:FieldValue.delete(),ultimaActualizacion:FieldValue.serverTimestamp()}:name==='pulseras'?{saldoActual:0,saldoInicial:0}:{stock:name==='articulos'&&d.esInfinito===true?99999:0};
   if('ultimaVentaId' in d)patch.ultimaVentaId=FieldValue.delete();
   await inspect(ref,'reset',patch);
   // Use the exact snapshot that provided the stock mode for optimistic concurrency.
   plan[plan.length-1].stamp=snap.updateTime;
  }
 }
 plan.sort((a,b)=>a.ref.path.localeCompare(b.ref.path));
 const hash=createHash('sha256').update(JSON.stringify(plan.map(x=>[x.ref.path,x.action,x.stamp.seconds,x.stamp.nanoseconds,x.patch?.stock??null]))).digest('hex');
 const counts={};for(const x of plan){const k=x.ref.parent.path+' · '+x.action;counts[k]=(counts[k]||0)+1;}
 console.log('PROYECTO:',PROJECT);console.table(counts);console.log('Total operaciones:',plan.length);console.log('HASH:',hash);
 if(args[0]==='--preview'){console.log('SOLO LECTURA. No se modificó ningún dato.');return;}
 if(hash!==args[1])throw Error('Los datos cambiaron desde la vista previa. Ejecuta una nueva vista previa.');
 if(plan.length>500)throw Error('Más de 500 operaciones: se requiere otra estrategia de mantenimiento.');
 if(!plan.length)return;
 const backup=[];
 for(const x of plan){const s=await x.ref.get();if(!s.exists||!s.updateTime.isEqual(x.stamp))throw Error('Registro cambió antes del respaldo');backup.push({path:x.ref.path,data:s.data()});}
 function encode(v){if(v===null||typeof v!=='object')return v;if(v instanceof require('firebase-admin/firestore').Timestamp)return {type:'timestamp',seconds:v.seconds,nanoseconds:v.nanoseconds};if(v instanceof require('firebase-admin/firestore').GeoPoint)return {type:'geopoint',latitude:v.latitude,longitude:v.longitude};if(v instanceof require('firebase-admin/firestore').DocumentReference)return {type:'reference',path:v.path};if(Buffer.isBuffer(v))return {type:'bytes',base64:v.toString('base64')};if(Array.isArray(v))return {type:'array',value:v.map(encode)};return {type:'map',value:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))};}
 const dest=path.join(os.homedir(),'Downloads','genesaret-reset-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
 fs.writeFileSync(dest,JSON.stringify({project:PROJECT,hash,documents:backup.map(x=>({path:x.path,fields:encode(x.data)}))},null,2),{flag:'wx',mode:0o600});console.log('Respaldo previo guardado:',dest);
 const batch=db.batch();
 for(const x of plan){const pre={lastUpdateTime:x.stamp};if(x.action==='delete')batch.delete(x.ref,pre);else batch.update(x.ref,x.patch,pre);}
 await batch.commit();console.log('REINICIO COMPLETADO: '+plan.length+' operaciones en un lote atómico.');
}
main().catch(e=>{console.error('DETENIDO:',e.message);process.exitCode=1;});
