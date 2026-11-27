(function(root){
'use strict';
function start(stationId,role,code=null){
 const uid=auth.currentUser?.uid;if(!uid)return ()=>{};
 const doc=db.collection('estaciones_presencia').doc(),station=db.collection('estaciones_venta').doc(stationId);
 let closed=false,busy=false;
 async function beat(){if(closed||busy||!navigator.onLine||auth.currentUser?.uid!==uid)return;busy=true;
 try{await db.runTransaction(async tx=>{const [s,p]=await Promise.all([tx.get(station),tx.get(db.collection('usuarios').doc(uid))]);if(closed||!s.exists||!s.data().activo||s.data().archivada||!p.exists||p.data().activo===false)throw Error('Estación no disponible');if(role==='caja'?s.data().vendedorId!==uid:!['autoservicio','admin','administrador'].includes(p.data().role)||(s.data().codigoVinculacion||s.id)!==code)throw Error('Sesión no autorizada');tx.set(doc,{stationId,role,uid,code:code||null,lastSeen:firebase.firestore.FieldValue.serverTimestamp()});});}catch(e){console.warn('Presencia no confirmada',e);}finally{busy=false;}}
 const timer=setInterval(beat,25000);window.addEventListener('online',beat);beat();
 return ()=>{closed=true;clearInterval(timer);window.removeEventListener('online',beat);if(auth.currentUser?.uid===uid)doc.delete().catch(()=>{});};
}
root.GenesaretPresence={start};
})(globalThis);