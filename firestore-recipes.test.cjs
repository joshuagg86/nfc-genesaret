const fs=require('node:fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');require('firebase/compat/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-genesaret-security',firestore:{rules:fs.readFileSync('firestore.rules.recipe-test','utf8')}});
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
 globalThis.firebase=firebase;for(const path of ['cash-turns.js','checkout.js'])require('./'+path);const ctx=globalThis;
 const checkout=(id,method,items=[{id:'sandwich',cantidad:1,precio:35}],extra={})=>ctx.GenesaretCheckout.commit({db:cashier,auth:{currentUser:{uid:'seller1'}},eventId:'cafe',items,pulseraId:method==='nfc'?'wallet':null,pulseraNombre:'Cliente prueba',metodo:method,estado:'pagado',carritoId:id,experimentalIntegrity:true,...extra});
 const data=async(d,p)=>(await d.doc(p).get()).data();
 await test('Venta efectivo real: stock, turno, folio y cocina',async()=>{await assertSucceeds(checkout('cash','efectivo'));assert.equal((await data(admin,'articulos/sandwich')).stock,9);assert.equal((await data(admin,'turnos_caja/shift')).efectivoVentas,3500);assert.equal((await data(admin,'eventos/cafe/contadores/pedidos')).ultimo,1);assert.equal((await data(kitchen,'eventos/cafe/pedidos_cocina/cash')).items.length,1);});
 await test('NFC real: descuento saldo y sin efectivo adicional',async()=>{await assertSucceeds(checkout('nfc','nfc'));assert.equal((await data(admin,'pulseras/wallet')).saldoActual,65);assert.equal((await data(admin,'turnos_caja/shift')).efectivoVentas,3500);});
 await test('Transferencia y producto listo: no aparece en cocina',async()=>{await assertSucceeds(checkout('transfer','transferencia',[{id:'agua',cantidad:1,precio:10}]));assert.equal((await admin.doc('eventos/cafe/pedidos_cocina/transfer').get()).exists,false);assert.equal((await data(admin,'articulos/agua')).stock,9);});
 await test('Reintento de venta no duplica saldo ni stock',async()=>{const before=await data(admin,'pulseras/wallet');assert.ok(before);assert.equal((await admin.doc('transacciones/nfc_0').get()).exists,true,'La venta original debe existir');await assert.rejects(checkout('nfc','nfc'),/registrad|duplicad|existe|procesad/i);assert.equal((await data(admin,'pulseras/wallet')).saldoActual,before.saldoActual);});
 await test('Saldo insuficiente no modifica inventario',async()=>{const before=await data(admin,'articulos/sandwich');await assert.rejects(checkout('insufficient','nfc',[{id:'sandwich',cantidad:3,precio:35}]),/saldo|insuficiente/i);assert.equal((await data(admin,'articulos/sandwich')).stock,before.stock);});
 await test('Pedido autoservicio, cobro y confirmación',async()=>{await assertSucceeds(kiosk.doc('pedidos_autoservicio/order').set({eventId:'cafe',items:[{id:'sandwich',cantidad:1,precio:35}],total:35,estado:'pendiente',estacionId:'station',vendedorId:'seller1',creadoPor:'kiosk',fecha:firebase.firestore.FieldValue.serverTimestamp()}));await assertSucceeds(checkout('kioskSale','efectivo',undefined,{selfOrderId:'order'}));assert.equal((await data(admin,'pedidos_autoservicio/order')).estado,'cobrado');assert.equal((await data(kiosk,'eventos/cafe/confirmaciones_caja/seller1')).total,35);});
 await test('Vendedor ajeno no cancela pedido',async()=>{await assertFails(db('seller2').doc('pedidos_autoservicio/order').update({estado:'cancelado',canceladoPor:'seller2',canceladoAt:new Date()}));});
 await test('Cierre de caja conserva diferencia correcta',async()=>{const d=await data(admin,'turnos_caja/shift'),expected=d.fondoInicial+d.efectivoVentas+d.entradas-d.salidas;await assertSucceeds(cashier.doc('turnos_caja/shift').update({estado:'cerrado',efectivoEsperado:expected,efectivoContado:expected,diferencia:0,cerradoAt:firebase.firestore.FieldValue.serverTimestamp()}));});
 await test('Venta mixta de dos productos con validación cruzada',async()=>{const a=await data(admin,'articulos/agua'),p=await data(admin,'articulos/sandwich');await assertSucceeds(checkout('mixed','transferencia',[{id:'agua',cantidad:1,precio:10},{id:'sandwich',cantidad:1,precio:35}]));assert.equal((await data(admin,'articulos/agua')).stock,a.stock-1);assert.equal((await data(admin,'articulos/sandwich')).stock,p.stock-1);});
 console.log('--- Pruebas de integridad adversariales (deben bloquearse) ---');
 await test('No se permite venta inventada a precio manipulado',()=>assertFails(cashier.doc('transacciones/fake').set({eventId:'cafe',vendedorId:'seller1',articuloId:'sandwich',cantidad:1,precioUnitario:1,monto:1,estadoPago:'pagado',metodoPago:'efectivo',carritoId:'fake'})));
 await test('No se permite bajar saldo NFC sin venta',()=>assertFails(cashier.doc('pulseras/wallet').update({saldoActual:0})));
 await test('No se permite bajar stock sin venta',()=>assertFails(cashier.doc('articulos/agua').update({stock:0})));
 await test('No se permite manifiesto sin partidas de venta',()=>assertFails(cashier.doc('ventas_integridad/orphan').set({vendedorId:'seller1',eventId:'cafe',metodoPago:'efectivo',estadoPago:'pagado',pulseraId:null,lineas:1,total:35})));
 // Full atomic writes: these exercise the rules directly, bypassing the browser's checkout checks.
 const fakeBatch=async(id,{price=35,total=35,quantity=1,stockDelta=1,method='efectivo',walletDelta=35,omitStock=false,omitWallet=false,extraLine=false}={})=>{
 const batch=cashier.batch(), product=cashier.doc('articulos/sandwich'), wallet=cashier.doc('pulseras/wallet');
 const p=await data(admin,'articulos/sandwich'),w=await data(admin,'pulseras/wallet');
 const pulseraId=method==='nfc'?'wallet':null;
 batch.set(cashier.doc('ventas_integridad/'+id),{vendedorId:'seller1',eventId:'cafe',metodoPago:method,estadoPago:'pagado',pulseraId,lineas:1,total});
 const line={eventId:'cafe',vendedorId:'seller1',articuloId:'sandwich',cantidad:quantity,precioUnitario:price,monto:price*quantity,estadoPago:'pagado',metodoPago:method,carritoId:id,pulseraId,lineasVenta:1,descuentoProducto:quantity,descuentoInsumos:[]};
 batch.set(cashier.doc('transacciones/'+id+'_0'),line);
 if(extraLine)batch.set(cashier.doc('transacciones/'+id+'_1'),line);
 if(!omitStock)batch.update(product,{stock:p.stock-stockDelta,ultimaVentaId:id});
 if(method==='nfc'&&!omitWallet)batch.update(wallet,{saldoActual:w.saldoActual-walletDelta,ultimaVentaId:id});
 return batch.commit();
 };
 await test('Bloquea venta completa con precio inferior al catálogo',()=>assertFails(fakeBatch('cheap',{price:1,total:1})));
 await test('Bloquea venta completa con total inconsistente',()=>assertFails(fakeBatch('wrongTotal',{total:1})));
 await test('Bloquea venta completa sin descontar producto',()=>assertFails(fakeBatch('noStock',{omitStock:true})));
 await test('Bloquea descuento excesivo de inventario',()=>assertFails(fakeBatch('extraStock',{stockDelta:2})));
 await test('Bloquea NFC sin descontar saldo',()=>assertFails(fakeBatch('noWallet',{method:'nfc',omitWallet:true})));
 await test('Bloquea NFC con descuento inferior',()=>assertFails(fakeBatch('underWallet',{method:'nfc',walletDelta:1})));
 await test('Bloquea partida adicional no declarada',()=>assertFails(fakeBatch('extraLine',{extraLine:true})));
 await test('Bloquea reutilización de venta previa',()=>assertFails(cashier.doc('articulos/agua').update({stock:0,ultimaVentaId:'mixed'})));
 const buy=(uid,id)=>checkout(id,'transferencia',[{id:'agua',cantidad:1,precio:10}],{db:db(uid),auth:{currentUser:{uid}}});
 await test('Ambos vendedores pueden vender individualmente',async()=>{
 await admin.doc('articulos/agua').update({stock:2});
 await assertSucceeds(buy('seller1','baseline1'));
 await assertSucceeds(buy('seller2','baseline2'));
 assert.equal((await data(admin,'articulos/agua')).stock,0);
 assert.equal((await data(admin,'transacciones/baseline1_0')).vendedorId,'seller1');
 assert.equal((await data(admin,'transacciones/baseline2_0')).vendedorId,'seller2');
 });
 await test('Dos vendedores compiten por la última unidad',async()=>{
 await admin.doc('articulos/agua').update({stock:1});
 const before=(await data(admin,'eventos/cafe/contadores/pedidos')).ultimo;
 const results=await Promise.allSettled([buy('seller1','race1'),buy('seller2','race2')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const loser=results.findIndex(r=>r.status==='rejected'),winner=1-loser;
 const error=results[loser].reason;
 assert.match(error.message,/stock insuficiente|PERMISSION_DENIED|permission-denied|insufficient permissions/i);
 assert.equal((await data(admin,'articulos/agua')).stock,0);
 assert.equal((await data(admin,'eventos/cafe/contadores/pedidos')).ultimo,before+1);
 assert.equal((await data(admin,'transacciones/race'+(winner+1)+'_0')).vendedorId,'seller'+(winner+1));
 assert.equal((await admin.doc('transacciones/race'+(loser+1)+'_0').get()).exists,false);
 assert.equal((await admin.doc('ventas_integridad/race'+(loser+1)).get()).exists,false);
 await assert.rejects(buy('seller'+(loser+1),'race'+(loser+1)),/stock insuficiente/i);
 if(!/stock insuficiente/i.test(error.message))console.log('AVISO: la colisión fue rechazada por reglas; el reintento confirmó stock insuficiente.');
 });
 await test('Bloquea confirmación de pago inventada',()=>assertFails(cashier.doc('eventos/cafe/confirmaciones_caja/seller1').set({carritoId:'fakeConfirm',total:35,kitchen:false,numeroPedido:999,fecha:firebase.firestore.FieldValue.serverTimestamp(),vendedorId:'seller1'})));
 await test('Bloquea movimiento ficticio de insumos',()=>assertFails(cashier.doc('movimientos_insumos/fake').set({eventId:'cafe',insumoId:'fake',usuarioId:'seller1',motivo:'Venta',delta:-1})));
 await admin.doc('insumos/queso').set({eventId:'cafe',nombre:'Queso',unit:'porción',stock:20,costPerUnit:4});
 await admin.doc('insumos/jitomate').set({eventId:'cafe',nombre:'Jitomate',unit:'porción',stock:20,costPerUnit:2});
 const recipe={lines:[{id:'queso',nombre:'Queso',amount:1,removable:true}],extras:[{id:'queso',nombre:'Queso',amount:1,price:5}]};
 await admin.doc('articulos/recipe').set({eventId:'cafe',nombre:'Sándwich personalizable',stock:20,precio:35,requiereCocina:true,recetaActiva:recipe});
 const recipeBuy=(id,price,removed=[],extra=[])=>checkout(id,'transferencia',[{id:'recipe',cantidad:1,precio:price,selection:{removed,extra}}]);
 await test('Receta base: descuenta una porción',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeBase',35));assert.equal((await data(admin,'insumos/queso')).stock,before-1);assert.equal((await data(admin,'movimientos_insumos/recipeBase_queso')).delta,-1);});
 await test('Extra cobrable: descuenta dos porciones y cobra 40',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeExtra',40,[],['queso']));assert.equal((await data(admin,'insumos/queso')).stock,before-2);assert.equal((await data(admin,'transacciones/recipeExtra_0')).monto,40);});
 await test('Quitar ingrediente: no descuenta insumo',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeRemoved',35,['queso']));assert.equal((await data(admin,'insumos/queso')).stock,before);});
 await test('Reincorporar ingrediente: sin cargo adicional',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeRestored',35,['queso'],['queso']));assert.equal((await data(admin,'insumos/queso')).stock,before-1);});
 await test('Extra gratuito de otro insumo: conserva precio y descuenta ambos',async()=>{await admin.doc('articulos/recipe').update({recetaActiva:{...recipe,extras:[{id:'jitomate',nombre:'Jitomate',amount:1,price:0}]}});const a=(await data(admin,'insumos/queso')).stock,b=(await data(admin,'insumos/jitomate')).stock;await assertSucceeds(recipeBuy('recipeFree',35,[],['jitomate']));assert.equal((await data(admin,'insumos/queso')).stock,a-1);assert.equal((await data(admin,'insumos/jitomate')).stock,b-1);});
 await admin.doc('articulos/recipe').update({recetaActiva:recipe});
 const forgedRecipe=async(id,{price=40,selection={removed:[],extra:['queso']},usage=[{id:'queso',amount:1},{id:'queso',amount:1}],delta=2,skipSupply=false,skipMovement=false}={})=>{
 const p=await data(admin,'articulos/recipe'),q=await data(admin,'insumos/queso'),batch=cashier.batch();
 batch.set(cashier.doc('ventas_integridad/'+id),{vendedorId:'seller1',eventId:'cafe',metodoPago:'transferencia',estadoPago:'pagado',pulseraId:null,lineas:1,total:price});
 batch.set(cashier.doc('transacciones/'+id+'_0'),{eventId:'cafe',vendedorId:'seller1',articuloId:'recipe',cantidad:1,precioUnitario:price,monto:price,estadoPago:'pagado',metodoPago:'transferencia',carritoId:id,pulseraId:null,lineasVenta:1,descuentoProducto:1,descuentoInsumos:usage,seleccionIntegridad:selection});
 batch.update(cashier.doc('articulos/recipe'),{stock:p.stock-1,ultimaVentaId:id});
 if(!skipSupply){batch.update(cashier.doc('insumos/queso'),{stock:q.stock-delta,ultimaVentaId:id});if(!skipMovement)batch.set(cashier.doc('movimientos_insumos/'+id+'_queso'),{eventId:'cafe',insumoId:'queso',usuarioId:'seller1',motivo:'Venta',delta:-delta,stockFinal:q.stock-delta,carritoId:id});}
 return batch.commit();
 };
 await test('Bloquea extra cobrable sin pagar',()=>assertFails(forgedRecipe('recipeCheap',{price:35})));
 await test('Bloquea receta sin descuento de insumos',()=>assertFails(forgedRecipe('recipeNoSupply',{skipSupply:true})));
 await test('Bloquea descuento incorrecto de insumos',()=>assertFails(forgedRecipe('recipeWrongDelta',{delta:1})));
 await test('Bloquea consumo sin bitácora',()=>assertFails(forgedRecipe('recipeNoLog',{skipMovement:true})));
 await test('Bloquea omitir ingrediente de la lista de consumos',()=>assertFails(forgedRecipe('recipeWrongUsage',{usage:[{id:'queso',amount:1}]})));
 await test('Bloquea extra no autorizado',()=>assertFails(forgedRecipe('recipeUnknown',{selection:{removed:[],extra:['otro']}})));
 await admin.doc('articulos/recipe').update({recetaActiva:{...recipe,lines:[{...recipe.lines[0],removable:false}]}});
 await test('Bloquea quitar ingrediente obligatorio',()=>assertFails(forgedRecipe('recipeMandatory',{price:35,selection:{removed:['queso'],extra:[]},usage:[],skipSupply:true})));
 console.log('Resultado: '+passed+' correctas, '+failed+' fallidas. Las fallidas requieren corrección antes de publicar.');
 if(failed)process.exitCode=1;
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
