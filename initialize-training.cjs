'use strict';
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {getAuth}=require('firebase-admin/auth');
const {randomBytes,randomInt}=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
if(process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error('No usar con emuladores');
const source=initializeApp({projectId:'nfc-genesaret',credential:applicationDefault()},'source-readonly');
const target=initializeApp({projectId:'genesaret-capacitacion',credential:applicationDefault()},'training');
const src=getFirestore(source),dst=getFirestore(target),auth=getAuth(target);
const config=['eventos','articulos','insumos','categorias','recetas_borrador'];
async function main(){
 if(process.argv[2]!=='--initialize-training'||process.argv.length!==3)throw Error('Uso: --initialize-training');
 if((await dst.listCollections()).length||(await auth.listUsers(1)).users.length)throw Error('Capacitación no está vacía. No se sobrescribirá.');
 const sets={};for(const n of config)sets[n]=await src.collection(n).get();
 const events=sets.eventos.docs.filter(d=>d.data().activo===true);
 if(!events.length)throw Error('No hay eventos activos');
 const roles=['admin','vendedor','cocina','tv','autoservicio'];
 const users=roles.map(role=>({uid:'training-'+role,email:role+'@genesaret-capacitacion.example',password:randomBytes(18).toString('base64url'),role}));
 const dest=path.join(os.homedir(),'Downloads','genesaret-capacitacion-accesos-'+Date.now()+'.json');
 fs.writeFileSync(dest,JSON.stringify(users,null,2),{flag:'wx',mode:0o600});
 console.log('Accesos de capacitación guardados en:',dest);
 const batch=dst.batch();let count=0;const set=(ref,data)=>{if(++count>450)throw Error('Configuración demasiado grande');batch.set(ref,data);};
 for(const u of users)set(dst.collection('usuarios').doc(u.uid),{name:'Capacitación '+u.role,email:u.email,role:u.role,activo:true,createdAt:FieldValue.serverTimestamp()});
 for(const n of config)for(const d of sets[n].docs){
  const v={...d.data()};delete v.ultimaVentaId;
  if(n==='articulos'){v.stock=v.esInfinito===true?99999:100;if(v.vendedorAsignadoId&&v.vendedorAsignadoId!=='todos')v.vendedorAsignadoId='training-vendedor';}
  if(n==='insumos')v.stock=1000;
  set(dst.collection(n).doc(d.id),v);
 }
 const codes=new Set();for(const e of events){let code;do{code=String(randomInt(100000,1000000));}while(codes.has(code));codes.add(code);const id=code;set(dst.collection('estaciones_venta').doc(id),{nombre:'Caja de capacitación',eventId:e.id,vendedorId:'training-vendedor',activo:true,codigoVinculacion:code,fecha:FieldValue.serverTimestamp()});set(dst.collection('estaciones_asignaciones').doc(e.id+'_training-vendedor'),{estacionId:id,eventId:e.id,vendedorId:'training-vendedor'});set(dst.collection('estaciones_codigos').doc(code),{estacionId:id});}
 const created=[];
 try{for(const u of users){await auth.createUser({uid:u.uid,email:u.email,password:u.password,displayName:'Capacitación '+u.role});created.push(u.uid);}await batch.commit();}
 catch(e){console.error('Inicialización no confirmada; conserva el archivo de accesos y revisa el proyecto de capacitación. No se realizaron escrituras en producción.');throw e;}
 console.log('CAPACITACIÓN INICIALIZADA:',count,'documentos,',created.length,'cuentas.');
}
main().catch(e=>{console.error('DETENIDO:',e.message);process.exitCode=1;});
