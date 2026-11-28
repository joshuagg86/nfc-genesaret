(function(){
'use strict';
if(!window.GenesaretTraining||firebase.app().options.projectId!=='genesaret-capacitacion')return;
const button=document.getElementById('trainingResetButton');
if(!button)return;
const roots=['recargas','transacciones','anulaciones','pedidos_autoservicio','estaciones_presencia','cajas_activas','turnos_caja','liquidaciones','ventas_integridad','lotes_produccion','bitacora_stock','movimientos_insumos','pulseras'];
const subs=['pedidos_cocina','preparacion_pedidos','confirmaciones_caja','contadores'];
const lock=db.collection('training_control').doc('reset');
let busy=false;
const server={source:'server'};
async function reset(){
 if(busy)return;const user=auth.currentUser;if(!user)return;
 const profile=await db.collection('usuarios').doc(user.uid).get(server);
 if(!profile.exists||profile.data().activo!==true||!['admin','administrador'].includes(profile.data().role))throw Error('Administrador activo requerido');
 const result=await Swal.fire({title:'Reiniciar capacitación',text:'Se borrarán ventas, pulseras de prueba, pedidos y turnos. Se repondrá inventario ficticio. Pide a los participantes cerrar sus pantallas antes de continuar. Escribe REINICIAR para confirmar.',input:'text',showCancelButton:true,confirmButtonText:'Reiniciar prácticas',cancelButtonText:'Cancelar',customClass:{popup:'genesaret-smart-modal'},inputValidator:v=>v==='REINICIAR'?undefined:'Escribe REINICIAR'});
 if(!result.isConfirmed)return;
 busy=true;button.disabled=true;
 let owns=false,committed=false;
 try{
  await db.runTransaction(async tx=>{const s=await tx.get(lock);if(s.exists){if(s.data().owner!==user.uid)throw Error('Otro administrador está reiniciando');}else tx.set(lock,{owner:user.uid,startedAt:firebase.firestore.FieldValue.serverTimestamp()});});
  owns=true;
  const plan=[];
  const addDelete=s=>{for(const d of s.docs)plan.push({ref:d.ref});};
  const [events,shifts,products,ingredients]=await Promise.all(['eventos','turnos_caja','articulos','insumos'].map(n=>db.collection(n).get(server)));
  const queries=roots.filter(n=>n!=='turnos_caja').map(n=>db.collection(n).get(server));
  for(const e of events.docs)for(const n of subs)queries.push(e.ref.collection(n).get(server));
  for(const s of shifts.docs)queries.push(s.ref.collection('movimientos').get(server));
  for(const s of await Promise.all(queries))addDelete(s);
  addDelete(shifts);
  const clear=firebase.firestore.FieldValue.delete();
  for(const d of products.docs)plan.push({ref:d.ref,patch:{stock:d.data().esInfinito===true?99999:100,ultimaVentaId:clear}});
  for(const d of ingredients.docs)plan.push({ref:d.ref,patch:{stock:1000,ultimaVentaId:clear}});
  if(plan.length>499)throw Error('Más de 499 registros. Se requiere limpieza administrativa por lotes.');
  if(auth.currentUser?.uid!==user.uid)throw Error('Sesión modificada');
  const batch=db.batch();
  for(const x of plan){if(x.patch)batch.update(x.ref,x.patch);else batch.delete(x.ref);}
  batch.delete(lock);
  await batch.commit();committed=true;owns=false;
  await Swal.fire({icon:'success',title:'Capacitación reiniciada',text:plan.length+' registros procesados. Recarga todas las pantallas de capacitación.'});
  location.reload();
 }finally{
  if(owns&&!committed){try{await lock.delete();}catch(e){console.error('Bloqueo de mantenimiento pendiente',e);}}
  busy=false;button.disabled=false;
 }
}
auth.onAuthStateChanged(async user=>{button.hidden=true;button.style.display='none';if(!user)return;try{const p=await db.collection('usuarios').doc(user.uid).get(server);if(auth.currentUser?.uid===user.uid&&p.exists&&p.data().activo===true&&['admin','administrador'].includes(p.data().role)){button.hidden=false;button.style.display='';}}catch(e){console.error(e);}});
button.onclick=()=>reset().catch(e=>Swal.fire({icon:'error',title:'No se pudo reiniciar',text:e.message}));
})();
