const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');require('firebase/compat/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-genesaret-security',firestore:{rules:fs.readFileSync('firestore.rules.draft','utf8')}});
 let passed=0,failed=0;
 const test=async(name,fn)=>{try{await fn();console.log('OK '+name);passed++;}catch(e){console.error('FALLO '+name+': '+e.message);failed++;}};
 try{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async c=>{
 const seed={
 'usuarios/admin':{role:'admin',activo:true,name:'Admin'},'usuarios/seller1':{role:'vendedor',activo:true,name:'Vendedor 1'},'usuarios/seller2':{role:'vendedor',activo:true,name:'Vendedor 2'},'usuarios/kiosk':{role:'autoservicio',activo:true},'usuarios/kitchen':{role:'cocina',activo:true},'usuarios/tv':{role:'tv',activo:true},
 'eventos/cafe':{activo:true},'articulos/sandwich':{eventId:'cafe',nombre:'Sándwich',stock:10,precio:35,requiereCocina:true,costoUnitario:15},'articulos/agua':{eventId:'cafe',nombre:'Agua',stock:10,precio:10,requiereCocina:false,costoUnitario:5},
 'pulseras/wallet':{saldoActual:100,activo:true,bloqueada:false,nombre:'Prueba'},
 'estaciones_venta/station':{eventId:'cafe',vendedorId:'seller1',activo:true},
 'cajas_activas/seller1':{turnoId:'shift'},'turnos_caja/shift':{vendedorId:'seller1',estado:'abierto',fondoInicial:10000,efectivoVentas:0,entradas:0,salidas:0}
 };for(const [p,d] of Object.entries(seed))await c.firestore().doc(p).set(d);
 });
 const db=id=>env.authenticatedContext(id).firestore();
 const cashier=db('seller1'),kiosk=db('kiosk'),kitchen=db('kitchen'),admin=db('admin');
 const ctx=vm.createContext({firebase,console});for(const path of ['cash-turns.js','checkout.js'])vm.runInContext(fs.readFileSync(path,'utf8'),ctx,{filename:path});
 const checkout=(id,method,items=[{id:'sandwich',cantidad:1,precio:35}],extra={})=>ctx.GenesaretCheckout.commit({db:cashier,auth:{currentUser:{uid:'seller1'}},eventId:'cafe',items,pulseraId:method==='nfc'?'wallet':null,pulseraNombre:'Cliente prueba',metodo:method,estado:'pagado',carritoId:id,...extra});
 const data=async(d,p)=>(await d.doc(p).get()).data();
 await test('Venta efectivo real: stock, turno, folio y cocina',async()=>{await assertSucceeds(checkout('cash','efectivo'));assert.equal((await data(admin,'articulos/sandwich')).stock,9);assert.equal((await data(admin,'turnos_caja/shift')).efectivoVentas,3500);assert.equal((await data(admin,'eventos/cafe/contadores/pedidos')).ultimo,1);assert.equal((await data(kitchen,'eventos/cafe/pedidos_cocina/cash')).items.length,1);});
 await test('NFC real: descuento saldo y sin efectivo adicional',async()=>{await assertSucceeds(checkout('nfc','nfc'));assert.equal((await data(admin,'pulseras/wallet')).saldoActual,65);assert.equal((await data(admin,'turnos_caja/shift')).efectivoVentas,3500);});
 await test('Transferencia y producto listo: no aparece en cocina',async()=>{await assertSucceeds(checkout('transfer','transferencia',[{id:'agua',cantidad:1,precio:10}]));assert.equal((await admin.doc('eventos/cafe/pedidos_cocina/transfer').get()).exists,false);assert.equal((await data(admin,'articulos/agua')).stock,9);});
 await test('Reintento de venta no duplica saldo ni stock',async()=>{const before=await data(admin,'pulseras/wallet');await assert.rejects(checkout('nfc','nfc'));assert.equal((await data(admin,'pulseras/wallet')).saldoActual,before.saldoActual);});
 await test('Saldo insuficiente no modifica inventario',async()=>{const before=await data(admin,'articulos/sandwich');await assert.rejects(checkout('insufficient','nfc',[{id:'sandwich',cantidad:3,precio:35}]));assert.equal((await data(admin,'articulos/sandwich')).stock,before.stock);});
 await test('Pedido autoservicio, cobro y confirmación',async()=>{await assertSucceeds(kiosk.doc('pedidos_autoservicio/order').set({eventId:'cafe',items:[{id:'sandwich',cantidad:1,precio:35}],total:35,estado:'pendiente',estacionId:'station',vendedorId:'seller1',creadoPor:'kiosk',fecha:firebase.firestore.FieldValue.serverTimestamp()}));await assertSucceeds(checkout('kioskSale','efectivo',undefined,{selfOrderId:'order'}));assert.equal((await data(admin,'pedidos_autoservicio/order')).estado,'cobrado');assert.equal((await data(kiosk,'eventos/cafe/confirmaciones_caja/seller1')).total,35);});
 await test('Vendedor ajeno no cancela pedido',async()=>{await assertFails(db('seller2').doc('pedidos_autoservicio/order').update({estado:'cancelado',canceladoPor:'seller2',canceladoAt:new Date()}));});
 await test('Cierre de caja conserva diferencia correcta',async()=>{const d=await data(admin,'turnos_caja/shift'),expected=d.fondoInicial+d.efectivoVentas+d.entradas-d.salidas;await assertSucceeds(cashier.doc('turnos_caja/shift').update({estado:'cerrado',efectivoEsperado:expected,efectivoContado:expected,diferencia:0,cerradoAt:firebase.firestore.FieldValue.serverTimestamp()}));});
 console.log('--- Pruebas de integridad adversariales (deben bloquearse) ---');
 await test('No se permite venta inventada a precio manipulado',()=>assertFails(cashier.doc('transacciones/fake').set({eventId:'cafe',vendedorId:'seller1',articuloId:'sandwich',cantidad:1,precioUnitario:1,monto:1,estadoPago:'pagado',metodoPago:'efectivo',carritoId:'fake'})));
 await test('No se permite bajar saldo NFC sin venta',()=>assertFails(cashier.doc('pulseras/wallet').update({saldoActual:0})));
 await test('No se permite bajar stock sin venta',()=>assertFails(cashier.doc('articulos/agua').update({stock:0})));
 console.log('Resultado: '+passed+' correctas, '+failed+' fallidas. Las fallidas requieren corrección antes de publicar.');
 if(failed)process.exitCode=1;
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
