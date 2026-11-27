const fs=require('node:fs');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const projectId='demo-genesaret-security';
(async()=>{
 const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080,rules:fs.readFileSync('firestore.rules.integration-test','utf8')}});
 try{
 const users=[];
 for(const role of ['admin','vendedor','autoservicio','cocina','tv']){
 const email=role+'@demo.test',password='GenesaretDemo2026';
 const call=async action=>{const r=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:'+action+'?key=demo-local-only',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});return r.json();};
 let d=await call('signUp');if(d.error?.message==='EMAIL_EXISTS')d=await call('signInWithPassword');if(!d.localId)throw Error(JSON.stringify(d.error));
 users.push({id:d.localId,role,email,name:role+' demo',activo:true,createdAt:new Date()});
 }
 await env.withSecurityRulesDisabled(async c=>{
 const db=c.firestore();
 for(const u of users){const {id,...data}=u;await db.doc('usuarios/'+id).set(data);}
 await db.doc('eventos/cafe').set({nombre:'Cafetería DEMO',activo:true});
 await db.doc('articulos/agua').set({nombre:'Agua',eventId:'cafe',precio:10,stock:30,categoria:'bebidas',requiereCocina:false,costoUnitario:5});
 await db.doc('articulos/sandwich').set({nombre:'Sándwich',eventId:'cafe',precio:35,stock:30,categoria:'comida',requiereCocina:true,costoUnitario:15});
 await db.doc('pulseras/demo').set({nombre:'Cliente DEMO',saldoActual:100,activo:true,bloqueada:false});
 });
 console.log('Demo local lista. Usuarios: admin, vendedor, autoservicio, cocina, tv @demo.test. Contraseña: GenesaretDemo2026');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
