const fs=require('node:fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,collection,query,where,getDocs,serverTimestamp}=require('firebase/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-genesaret-security',firestore:{rules:fs.readFileSync('firestore.rules.draft','utf8')}});
 try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
  const db=c.firestore();
  const seed={
   'usuarios/admin':{role:'admin',activo:true},
   'usuarios/seller1':{role:'vendedor',activo:true},
   'usuarios/seller2':{role:'vendedor',activo:true},
   'usuarios/kiosk':{role:'autoservicio',activo:true},
   'usuarios/kitchen':{role:'cocina',activo:true},
   'usuarios/tv':{role:'tv',activo:true},
   'usuarios/inactive':{role:'vendedor',activo:false},
   'eventos/cafe':{activo:true},
   'articulos/sandwich':{eventId:'cafe',nombre:'Sándwich',stock:10,precio:35},
   'pulseras/wallet':{saldoActual:100,activo:true,bloqueada:false},
   'transacciones/a':{eventId:'cafe',vendedorId:'seller1',monto:35},
   'transacciones/b':{eventId:'cafe',vendedorId:'seller2',monto:35},
   'turnos_caja/open':{vendedorId:'seller1',estado:'abierto',fondoInicial:10000,efectivoVentas:0,entradas:0,salidas:0},
   'turnos_caja/closed':{vendedorId:'seller1',estado:'cerrado',fondoInicial:10000,efectivoVentas:0,entradas:0,salidas:0},
   'eventos/cafe/pedidos_cocina/order':{estado:'activo',vendedorId:'seller1',items:[{name:'Sándwich',qty:1,notes:[]}],numeroPedido:1,pagoPendiente:false},
   'eventos/cafe/preparacion_pedidos/order':{estado:'preparando'},
   'estaciones_venta/station':{eventId:'cafe',vendedorId:'seller1',activo:true}
  };
  for(const [p,v] of Object.entries(seed))await setDoc(doc(db,p),v);
 });
 const db=id=>env.authenticatedContext(id).firestore();
 const anon=env.unauthenticatedContext().firestore();
 let count=0;
 const test=async(name,op,allowed)=>{await (allowed?assertSucceeds(op()):assertFails(op()));console.log('OK '+name);count++;};
 const read=(u,p)=>()=>getDoc(doc(u,p));
 const update=(u,p,data)=>()=>updateDoc(doc(u,p),data);
 await test('Anónimo no lee inventario',read(anon,'articulos/sandwich'),false);
 await test('Anónimo no escribe',update(anon,'articulos/sandwich',{stock:0}),false);
 await test('Inactivo no lee inventario',read(db('inactive'),'articulos/sandwich'),false);
 await test('Vendedor no cambia su rol',update(db('seller1'),'usuarios/seller1',{role:'admin'}),false);
 await test('Admin lee todas las cuentas',()=>getDocs(collection(db('admin'),'usuarios')),true);
 await test('Vendedor lee sus ventas',()=>getDocs(query(collection(db('seller1'),'transacciones'),where('vendedorId','==','seller1'))),true);
 await test('Vendedor no lee ventas ajenas',read(db('seller1'),'transacciones/b'),false);
 await test('Vendedor no cambia precio',update(db('seller1'),'articulos/sandwich',{precio:1}),false);
 await test('Vendedor no aumenta saldo NFC',update(db('seller1'),'pulseras/wallet',{saldoActual:1000}),false);
 await test('Vendedor no modifica turno cerrado',update(db('seller1'),'turnos_caja/closed',{efectivoVentas:100}),false);
 await test('Otro vendedor no lee turno',read(db('seller2'),'turnos_caja/open'),false);
 await test('Autoservicio consulta catálogo',read(db('kiosk'),'articulos/sandwich'),true);
 await test('Autoservicio no consulta ventas',read(db('kiosk'),'transacciones/a'),false);
 await test('Autoservicio no consulta pulseras',read(db('kiosk'),'pulseras/wallet'),false);
 await test('Cocina lee preparación',read(db('kitchen'),'eventos/cafe/pedidos_cocina/order'),true);
 await test('Cocina no lee finanzas',read(db('kitchen'),'transacciones/a'),false);
 await test('TV lee preparación',read(db('tv'),'eventos/cafe/pedidos_cocina/order'),true);
 await test('TV no cambia estado',update(db('tv'),'eventos/cafe/preparacion_pedidos/order',{estado:'listo',updatedBy:'tv',updatedAt:serverTimestamp()}),false);
 await test('Cocina cambia estado',update(db('kitchen'),'eventos/cafe/preparacion_pedidos/order',{estado:'listo',updatedBy:'kitchen',updatedAt:serverTimestamp()}),true);
 console.log(count+' pruebas de acceso completadas. No equivalen a una auditoría integral de cobros.');
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
