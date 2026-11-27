const fs=require('node:fs'),assert=require('node:assert/strict');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const firebase=require('firebase/compat/app');require('firebase/compat/firestore');
(async()=>{
 const env=await initializeTestEnvironment({projectId:'demo-genesaret-security',firestore:{rules:fs.readFileSync('firestore.rules.settlement-test','utf8')}});
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
 const variantKey=s=>JSON.stringify([[...(s.removed||[])].sort(),[...(s.extra||[])].sort()]);
 const subsets=a=>a.reduce((all,id)=>all.concat(all.map(x=>x.concat(id))),[[]]);
 const buildCatalog=p=>ctx.GenesaretCheckout.buildIntegrityCatalog(p);
 async function publishRecipe(id,op,patch){
 const ref=admin.doc('articulos/'+id);
 const p=op==='set'?patch:{...(await ref.get()).data(),...patch};
 await ref[op]({...patch,catalogoIntegridad:buildCatalog(p)});
 }

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
 await publishRecipe('recipe','set',{eventId:'cafe',nombre:'Sándwich personalizable',stock:20,precio:35,requiereCocina:true,recetaActiva:recipe});
 const recipeBuy=(id,price,removed=[],extra=[])=>checkout(id,'transferencia',[{id:'recipe',cantidad:1,precio:price,selection:{removed,extra}}]);
 await test('Receta base: descuenta una porción',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeBase',35));assert.equal((await data(admin,'insumos/queso')).stock,before-1);assert.equal((await data(admin,'movimientos_insumos/recipeBase_queso')).delta,-1);});
 await test('Extra cobrable: descuenta dos porciones y cobra 40',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeExtra',40,[],['queso']));assert.equal((await data(admin,'insumos/queso')).stock,before-2);assert.equal((await data(admin,'transacciones/recipeExtra_0')).monto,40);});
 await test('Quitar ingrediente: no descuenta insumo',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeRemoved',35,['queso']));assert.equal((await data(admin,'insumos/queso')).stock,before);});
 await test('Reincorporar ingrediente: sin cargo adicional',async()=>{const before=(await data(admin,'insumos/queso')).stock;await assertSucceeds(recipeBuy('recipeRestored',35,['queso'],['queso']));assert.equal((await data(admin,'insumos/queso')).stock,before-1);});
 await test('Extra gratuito de otro insumo: conserva precio y descuenta ambos',async()=>{await publishRecipe('recipe','update',{recetaActiva:{...recipe,extras:[{id:'jitomate',nombre:'Jitomate',amount:1,price:0}]}});const a=(await data(admin,'insumos/queso')).stock,b=(await data(admin,'insumos/jitomate')).stock;await assertSucceeds(recipeBuy('recipeFree',35,[],['jitomate']));assert.equal((await data(admin,'insumos/queso')).stock,a-1);assert.equal((await data(admin,'insumos/jitomate')).stock,b-1);});
 await publishRecipe('recipe','update',{recetaActiva:recipe});
 const forgedRecipe=async(id,{price=40,selection={removed:[],extra:['queso']},usage=[{id:'queso',amount:1},{id:'queso',amount:1}],delta=2,skipSupply=false,skipMovement=false}={})=>{
 const p=await data(admin,'articulos/recipe'),q=await data(admin,'insumos/queso'),batch=cashier.batch();
 batch.set(cashier.doc('ventas_integridad/'+id),{vendedorId:'seller1',eventId:'cafe',metodoPago:'transferencia',estadoPago:'pagado',pulseraId:null,lineas:1,total:price});
 batch.set(cashier.doc('transacciones/'+id+'_0'),{eventId:'cafe',vendedorId:'seller1',articuloId:'recipe',cantidad:1,precioUnitario:price,monto:price,estadoPago:'pagado',metodoPago:'transferencia',carritoId:id,pulseraId:null,lineasVenta:1,descuentoProducto:1,descuentoInsumos:usage,seleccionIntegridad:{removed:[...selection.removed].sort(),extra:[...selection.extra].sort()},varianteIntegridad:variantKey(selection)});
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
 await publishRecipe('recipe','update',{recetaActiva:{...recipe,lines:[{...recipe.lines[0],removable:false}]}});
 await test('Bloquea quitar ingrediente obligatorio',()=>assertFails(forgedRecipe('recipeMandatory',{price:35,selection:{removed:['queso'],extra:[]},usage:[],skipSupply:true})));
 // Expanded recipe and cart coverage; preserve all previous assertions.
 await admin.doc('insumos/pan').set({eventId:'cafe',nombre:'Pan',unit:'porcion',stock:40,costPerUnit:3});
 await admin.doc('insumos/lechuga').set({eventId:'cafe',nombre:'Lechuga',unit:'porcion',stock:40,costPerUnit:1});
 const expanded={lines:[{id:'pan',nombre:'Pan',amount:1,removable:false},{id:'queso',nombre:'Queso',amount:1,removable:true}],extras:[{id:'queso',nombre:'Queso',amount:1,price:5},{id:'lechuga',nombre:'Lechuga',amount:1,price:0}]};
 await publishRecipe('recipe','update',{recetaActiva:expanded,stock:30});
 await admin.doc('insumos/queso').update({stock:40});
 await admin.doc('articulos/agua').update({stock:20});
 await test('Receta de dos ingredientes obligatorios o incluidos',async()=>{
 const a=(await data(admin,'insumos/pan')).stock,b=(await data(admin,'insumos/queso')).stock;
 await assertSucceeds(recipeBuy('expandedBase',35));
 assert.equal((await data(admin,'insumos/pan')).stock,a-1);assert.equal((await data(admin,'insumos/queso')).stock,b-1);
 });
 await test('Dos extras simultaneos: cobrable y gratuito',async()=>{
 const a=(await data(admin,'insumos/queso')).stock,b=(await data(admin,'insumos/lechuga')).stock;
 await assertSucceeds(recipeBuy('expandedExtras',40,[],['queso','lechuga']));
 assert.equal((await data(admin,'insumos/queso')).stock,a-2);assert.equal((await data(admin,'insumos/lechuga')).stock,b-1);
 assert.equal((await data(admin,'transacciones/expandedExtras_0')).monto,40);
 });
 await test('Carrito mixto: receta y bebida',async()=>{
 const a=(await data(admin,'insumos/pan')).stock,b=(await data(admin,'articulos/agua')).stock;
 await assertSucceeds(checkout('expandedMixed','transferencia',[{id:'recipe',cantidad:1,precio:35},{id:'agua',cantidad:1,precio:10}]));
 assert.equal((await data(admin,'insumos/pan')).stock,a-1);assert.equal((await data(admin,'articulos/agua')).stock,b-1);
 assert.equal((await data(admin,'ventas_integridad/expandedMixed')).total,45);
 });
 await admin.doc('articulos/papas').set({eventId:'cafe',nombre:'Papas',precio:20,stock:20,requiereCocina:false});
 await admin.doc('articulos/panDulce').set({eventId:'cafe',nombre:'Pan dulce',precio:12,stock:20,requiereCocina:false});
 await test('Carrito de cuatro productos distintos',async()=>{
 const products=[['agua',10],['sandwich',35],['papas',20],['panDulce',12]];
 const before=await Promise.all(products.map(([id])=>data(admin,'articulos/'+id)));
 await assertSucceeds(checkout('fourProducts','transferencia',products.map(([id,precio])=>({id,precio,cantidad:1}))));
 for(let i=0;i<products.length;i++)assert.equal((await data(admin,'articulos/'+products[i][0])).stock,before[i].stock-1);
 assert.equal((await data(admin,'ventas_integridad/fourProducts')).total,77);
 });
 await test('Receta ampliada rechaza selección duplicada',async()=>{await assert.rejects(recipeBuy('duplicateExtra',45,[],['queso','queso']),/personalizaci.n inv.lida/i);});
 await test('Reglas ampliadas bloquean omitir un ingrediente obligatorio',()=>assertFails(forgedRecipe('expandedMissing',{price:35,selection:{removed:['pan'],extra:[]},usage:[],skipSupply:true})));
 await publishRecipe('recipe2','set',{eventId:'cafe',nombre:'Chapata',stock:20,precio:45,requiereCocina:true,recetaActiva:{lines:[{id:'pan',nombre:'Pan',amount:1,removable:false},{id:'queso',nombre:'Queso',amount:1,removable:true}],extras:[{id:'queso',nombre:'Queso',amount:1,price:5}]}});
 await test('Dos recetas con insumos compartidos y extra',async()=>{
 const p=(await data(admin,'insumos/pan')).stock,q=(await data(admin,'insumos/queso')).stock;
 await assertSucceeds(checkout('multiRecipe','transferencia',[{id:'recipe',cantidad:1,precio:40,selection:{removed:[],extra:['queso']}},{id:'recipe2',cantidad:1,precio:45}]));
 assert.equal((await data(admin,'insumos/pan')).stock,p-2);assert.equal((await data(admin,'insumos/queso')).stock,q-3);
 assert.equal((await data(admin,'movimientos_insumos/multiRecipe_queso')).delta,-3);
 assert.equal((await data(admin,'ventas_integridad/multiRecipe')).total,85);
 });
 await test('Receta después de bebida',async()=>{
 const p=(await data(admin,'insumos/pan')).stock;
 await assertSucceeds(checkout('recipeSecond','transferencia',[{id:'agua',cantidad:1,precio:10},{id:'recipe2',cantidad:1,precio:45}]));
 assert.equal((await data(admin,'insumos/pan')).stock,p-1);
 });
 await publishRecipe('recipe','update',{recetaActiva:{lines:[...expanded.lines,{id:'jitomate',nombre:'Jitomate',amount:1,removable:true},{id:'lechuga',nombre:'Lechuga',amount:1,removable:true}],extras:expanded.extras}});
 await test('Receta de cuatro ingredientes con extra cobrable',async()=>{
 const ids=['pan','queso','jitomate','lechuga'],before=await Promise.all(ids.map(id=>data(admin,'insumos/'+id)));
 await assertSucceeds(recipeBuy('fourIngredients',40,[],['queso']));
 for(let i=0;i<ids.length;i++)assert.equal((await data(admin,'insumos/'+ids[i])).stock,before[i].stock-(i===1?2:1));
 });
 await test('Receta de cuatro ingredientes con dos retirados',async()=>{
 const ids=['pan','queso','jitomate','lechuga'],before=await Promise.all(ids.map(id=>data(admin,'insumos/'+id)));
 await assertSucceeds(recipeBuy('fourRemoved',35,['jitomate','lechuga']));
 for(let i=0;i<ids.length;i++)assert.equal((await data(admin,'insumos/'+ids[i])).stock,before[i].stock-(i<2?1:0));
 });
 await test('Bloquea consumo compartido incompleto en venta de dos recetas',async()=>{
 const id='sharedUnder',batch=cashier.batch(),a=await data(admin,'articulos/recipe2'),b=await data(admin,'articulos/recipe');
 // Both lines consume pan and cheese, but the stock/movement only accounts for one cheese.
 batch.set(cashier.doc('ventas_integridad/'+id),{vendedorId:'seller1',eventId:'cafe',metodoPago:'transferencia',estadoPago:'pagado',pulseraId:null,lineas:2,total:80});
 const common={eventId:'cafe',vendedorId:'seller1',cantidad:1,estadoPago:'pagado',metodoPago:'transferencia',carritoId:id,pulseraId:null,lineasVenta:2,descuentoProducto:1,descuentoInsumos:[{id:'pan',amount:1},{id:'queso',amount:1}]};
 batch.set(cashier.doc('transacciones/'+id+'_0'),{...common,articuloId:'recipe',precioUnitario:35,monto:35,seleccionIntegridad:{removed:['jitomate','lechuga'],extra:[]},varianteIntegridad:variantKey({removed:['jitomate','lechuga'],extra:[]})});
 batch.set(cashier.doc('transacciones/'+id+'_1'),{...common,articuloId:'recipe2',precioUnitario:45,monto:45,seleccionIntegridad:{removed:[],extra:[]},varianteIntegridad:variantKey({removed:[],extra:[]})});
 batch.update(cashier.doc('articulos/recipe'),{stock:b.stock-1,ultimaVentaId:id});
 batch.update(cashier.doc('articulos/recipe2'),{stock:a.stock-1,ultimaVentaId:id});
 for(const [i,n] of [['pan',2],['queso',1]]){const d=await data(admin,'insumos/'+i);batch.update(cashier.doc('insumos/'+i),{stock:d.stock-n,ultimaVentaId:id});batch.set(cashier.doc('movimientos_insumos/'+id+'_'+i),{eventId:'cafe',insumoId:i,usuarioId:'seller1',motivo:'Venta',delta:-n,stockFinal:d.stock-n,carritoId:id});}
 await assertFails(batch.commit());
 });
 await test('Vendedor no puede modificar catálogo de variantes',()=>assertFails(cashier.doc('articulos/recipe').update({catalogoIntegridad:{variants:{}}})));
 await test('Catálogo desactualizado no autoriza cobros',async()=>{
 const p=await data(admin,'articulos/recipe');
 await admin.doc('articulos/recipe').update({precio:36});
 try{await assertFails(recipeBuy('staleCatalog',36));}
 finally{await publishRecipe('recipe','update',{precio:p.precio});}
 });
 await test('Variante autorizada con cantidad de dos unidades',async()=>{
 const q=(await data(admin,'insumos/queso')).stock;
 await assertSucceeds(checkout('variantQty2','transferencia',[{id:'recipe',cantidad:2,precio:40,selection:{removed:[],extra:['queso']}}]));
 assert.equal((await data(admin,'insumos/queso')).stock,q-4);
 assert.equal((await data(admin,'transacciones/variantQty2_0')).monto,80);
 });
 await test('Dos variantes del mismo producto descuentan stock acumulado',async()=>{
 const p=(await data(admin,'articulos/recipe')).stock,q=(await data(admin,'insumos/queso')).stock;
 await assertSucceeds(checkout('repeatVariant','transferencia',[{id:'recipe',cantidad:1,precio:35,selection:{removed:['queso'],extra:[]}},{id:'recipe',cantidad:1,precio:40,selection:{removed:[],extra:['queso']}}]));
 assert.equal((await data(admin,'articulos/recipe')).stock,p-2);
 assert.equal((await data(admin,'insumos/queso')).stock,q-2);
 assert.equal((await data(admin,'ventas_integridad/repeatVariant')).total,75);
 });
 await test('Dos variantes no pueden vender más unidades que el stock',async()=>{
 const p=(await data(admin,'articulos/recipe')).stock;
 await admin.doc('articulos/recipe').update({stock:1});
 try{await assert.rejects(checkout('repeatOver','transferencia',[{id:'recipe',cantidad:1,precio:35},{id:'recipe',cantidad:1,precio:40,selection:{removed:[],extra:['queso']}}]),/stock insuficiente/i);
 assert.equal((await data(admin,'articulos/recipe')).stock,1);
 assert.equal((await admin.doc('ventas_integridad/repeatOver').get()).exists,false);}
 finally{await admin.doc('articulos/recipe').update({stock:p});}
 });
 await test('Reglas bloquean descuento parcial de producto repetido',async()=>{
 const id='repeatForged',batch=cashier.batch(),p=await data(admin,'articulos/agua');
 batch.set(cashier.doc('ventas_integridad/'+id),{vendedorId:'seller1',eventId:'cafe',metodoPago:'transferencia',estadoPago:'pagado',pulseraId:null,lineas:2,total:20});
 const l={eventId:'cafe',vendedorId:'seller1',articuloId:'agua',cantidad:1,precioUnitario:10,monto:10,estadoPago:'pagado',metodoPago:'transferencia',carritoId:id,pulseraId:null,lineasVenta:2,descuentoProducto:1,descuentoInsumos:[]};
 batch.set(cashier.doc('transacciones/'+id+'_0'),l);batch.set(cashier.doc('transacciones/'+id+'_1'),l);
 batch.update(cashier.doc('articulos/agua'),{stock:p.stock-1,ultimaVentaId:id});
 await assertFails(batch.commit());
 });
 await test('Catálogo generado coincide con motor de recetas',async()=>{
 const p=await data(admin,'articulos/recipe'),catalog=buildCatalog(p);
 for(const v of Object.values(catalog.variants)){
 const d=ctx.GenesaretCheckout.resolveRecipe(p,v.selection);
 assert.equal(v.price,d.price/100);assert.deepEqual(v.usage,d.usage.map(x=>({id:x.id,amount:x.amount})));
 }
 assert.ok(Object.keys(catalog.variants).length>4);
 });
 // The checkout merges identical variants in the UI and rejects duplicate keys.
 // Seed distinct real catalog products to exercise the rule capacity instead.
 const capacityProducts=[['agua',10],['sandwich',35],['papas',20],['panDulce',12],['cafe',7],['te',10],['galleta',8],['jugo',15],['fruta',18]];
 for(const [id,precio] of capacityProducts){
 await admin.doc('articulos/'+id).set({eventId:'cafe',nombre:id,precio,stock:30,requiereCocina:false,costoUnitario:2});
 }
 await test('Carrito real de ocho partidas simples',async()=>{
 const items=capacityProducts.slice(0,8).map(([id,precio])=>({id,precio,cantidad:1}));
 const before=await Promise.all(items.map(x=>data(admin,'articulos/'+x.id)));
 await assertSucceeds(checkout('eightLines','transferencia',items));
 for(let j=0;j<items.length;j++)assert.equal((await data(admin,'articulos/'+items[j].id)).stock,before[j].stock-1);
 assert.equal((await data(admin,'ventas_integridad/eightLines')).total,items.reduce((n,x)=>n+x.precio,0));
 });
 await test('Carrito de seis partidas con receta y extras',async()=>{
 const p=(await data(admin,'articulos/recipe')).stock,q=(await data(admin,'insumos/queso')).stock;
 const items=[{id:'recipe',cantidad:1,precio:40,selection:{removed:[],extra:['queso']}},{id:'agua',cantidad:1,precio:10},{id:'papas',cantidad:1,precio:20},{id:'panDulce',cantidad:1,precio:12},{id:'recipe',cantidad:1,precio:35,selection:{removed:['queso'],extra:[]}},{id:'te',cantidad:1,precio:10}];
 await assertSucceeds(checkout('sixMixed','transferencia',items));
 assert.equal((await data(admin,'articulos/recipe')).stock,p-2);
 assert.equal((await data(admin,'insumos/queso')).stock,q-2);
 assert.equal((await data(admin,'ventas_integridad/sixMixed')).total,127);
 });
 await test('Carrito fuera del límite se rechaza sin cambios',async()=>{
 const items=capacityProducts.map(([id,precio])=>({id,precio,cantidad:1}));
 const before=await Promise.all(items.map(x=>data(admin,'articulos/'+x.id)));
 await assertFails(checkout('nineLines','transferencia',items));
 for(let j=0;j<items.length;j++)assert.equal((await data(admin,'articulos/'+items[j].id)).stock,before[j].stock);
 assert.equal((await admin.doc('ventas_integridad/nineLines').get()).exists,false);
 assert.equal((await admin.doc('transacciones/nineLines_0').get()).exists,false);
 });
 await test('Vendedor abre segundo turno después del cierre',async()=>{
 const batch=cashier.batch();
 batch.set(cashier.doc('turnos_caja/shift2'),{vendedorId:'seller1',estado:'abierto',fondoInicial:10000,efectivoVentas:0,entradas:0,salidas:0,abiertoAt:firebase.firestore.FieldValue.serverTimestamp()});
 batch.set(cashier.doc('cajas_activas/seller1'),{turnoId:'shift2'});
 await assertSucceeds(batch.commit());
 assert.equal((await data(admin,'cajas_activas/seller1')).turnoId,'shift2');
 });
 const shiftRef=cashier.doc('turnos_caja/shift2');
 const move=(id,type,amount,delta=amount)=>{
 const batch=cashier.batch();
 batch.update(shiftRef,{[type]:firebase.firestore.FieldValue.increment(delta),ultimoMovimientoId:id});
 batch.set(shiftRef.collection('movimientos').doc(id),{tipo:type,importe:amount,motivo:'Prueba',usuarioId:'seller1',fecha:firebase.firestore.FieldValue.serverTimestamp()});
 return batch.commit();
 };
 await test('Entrada y salida vinculadas a bitácora',async()=>{
 await assertSucceeds(move('in','entradas',2000));
 await assertSucceeds(move('out','salidas',1500));
 const d=await data(admin,'turnos_caja/shift2');
 assert.equal(d.entradas,2000);assert.equal(d.salidas,1500);
 });
 await test('Caja bloquea incremento de ventas sin cobro',()=>assertFails(shiftRef.update({efectivoVentas:5000,ultimaVentaId:'fakeCash'})));
 await test('Caja bloquea entrada sin bitácora',()=>assertFails(shiftRef.update({entradas:9999,ultimoMovimientoId:'fakeIn'})));
 await test('Caja bloquea bitácora sin movimiento real',()=>assertFails(shiftRef.collection('movimientos').doc('orphan').set({tipo:'entradas',importe:500,motivo:'Prueba',usuarioId:'seller1',fecha:firebase.firestore.FieldValue.serverTimestamp()})));
 await test('Caja bloquea diferencia entre movimiento y bitácora',()=>assertFails(move('wrong','entradas',100,200)));
 await test('Caja bloquea salida superior al efectivo disponible',()=>assertFails(move('tooMuch','salidas',999999)));
 await test('Caja bloquea reutilizar movimiento registrado',()=>assertFails(move('in','entradas',2000)));
 await test('Venta en efectivo acredita el turno con manifiesto',async()=>{
 await assertSucceeds(checkout('cashLinked','efectivo',[{id:'agua',cantidad:2,precio:10}]));
 const d=await data(admin,'turnos_caja/shift2');
 assert.equal(d.efectivoVentas,2000);assert.equal(d.ultimaVentaId,'cashLinked');
 });
 await test('Caja bloquea reutilizar venta para acreditar efectivo',()=>assertFails(shiftRef.update({efectivoVentas:4000,ultimaVentaId:'cashLinked'})));
 await test('Caja bloquea manipulación por vendedor ajeno',()=>assertFails(db('seller2').doc('turnos_caja/shift2').update({entradas:3000})));
 require('./reversals.js');
 const cancel=async(id,restore=true,actor='admin')=>{
 globalThis.db=db(actor);globalThis.auth={currentUser:{uid:actor}};
 let step=0;globalThis.Swal={fire:async()=>++step===1?{isConfirmed:true,value:'Prueba de devolución'}:{isConfirmed:restore,isDismissed:false,isDenied:!restore}};
 return ctx.GenesaretReversals.cancelSale(id+'_0');
 };
 await test('Devolución efectivo reduce turno y recupera productos',async()=>{
 const p=(await data(admin,'articulos/agua')).stock;
 await assertSucceeds(cancel('cashLinked'));
 assert.equal((await data(admin,'turnos_caja/shift2')).efectivoVentas,0);
 assert.equal((await data(admin,'articulos/agua')).stock,p+2);
 const t=await data(admin,'transacciones/cashLinked_0');assert.equal(t.estadoPago,'cancelado');
 const a=await data(admin,'anulaciones/'+t.anulacionId);assert.equal(a.monto,20);assert.equal(a.usuarioId,'admin');
 });
 await test('Devolución duplicada no restaura dos veces',async()=>{
 const p=(await data(admin,'articulos/agua')).stock;
 await assert.rejects(cancel('cashLinked'),/cancelada|inconsistente/i);
 assert.equal((await data(admin,'articulos/agua')).stock,p);
 });
 await test('Devolución NFC devuelve saldo exacto',async()=>{
 const w=(await data(admin,'pulseras/wallet')).saldoActual;
 await assertSucceeds(cancel('nfc',false));
 assert.equal((await data(admin,'pulseras/wallet')).saldoActual,w+35);
 });
 await test('Cancelación con receta restaura consumo registrado',async()=>{
 const q=(await data(admin,'insumos/queso')).stock,p=(await data(admin,'articulos/recipe')).stock;
 await assertSucceeds(cancel('repeatVariant'));
 assert.equal((await data(admin,'insumos/queso')).stock,q+2);
 assert.equal((await data(admin,'articulos/recipe')).stock,p+2);
 });
 await test('Cancelación sin recuperar no modifica inventario',async()=>{
 const p=(await data(admin,'articulos/agua')).stock;
 await assertSucceeds(cancel('transfer',false));
 assert.equal((await data(admin,'articulos/agua')).stock,p);
 });
 await test('Turno cerrado no permite devolución de efectivo',async()=>{
 const p=(await data(admin,'articulos/sandwich')).stock;
 await assert.rejects(cancel('cash'),/turno original.*cerrado/i);
 assert.equal((await data(admin,'articulos/sandwich')).stock,p);
 assert.equal((await data(admin,'transacciones/cash_0')).estadoPago,'pagado');
 });
 await test('Vendedor no puede cancelar una venta cobrada directamente',()=>assertFails(cashier.doc('transacciones/mixed_0').update({estadoPago:'cancelado'})));
 await test('Vendedor no puede fabricar una anulación',()=>assertFails(cashier.doc('anulaciones/fakeRefund').set({monto:20,usuarioId:'seller1'})));
 await test('Vendedor no puede aumentar saldo por devolución falsa',()=>assertFails(cashier.doc('pulseras/wallet').update({saldoActual:999})));
 await test('Bitácora de anulación existente no puede editarse',async()=>{
 const t=await data(admin,'transacciones/cashLinked_0');
 await assertFails(admin.doc('anulaciones/'+t.anulacionId).update({monto:999}));
 });
 const settle=(ids,amount,actor='seller1')=>ctx.GenesaretCheckout.settlePending(db(actor),{currentUser:{uid:actor}},ids,amount);
 await test('Fiado efectivo reserva stock sin aumentar caja',async()=>{
 const p=(await data(admin,'articulos/agua')).stock,c=(await data(admin,'turnos_caja/shift2')).efectivoVentas;
 await assertSucceeds(checkout('debtCash','efectivo',[{id:'agua',cantidad:2,precio:10}],{estado:'pendiente'}));
 assert.equal((await data(admin,'articulos/agua')).stock,p-2);
 assert.equal((await data(admin,'turnos_caja/shift2')).efectivoVentas,c);
 });
 await test('Liquida deuda en efectivo sin volver a descontar stock',async()=>{
 const p=(await data(admin,'articulos/agua')).stock,c=(await data(admin,'turnos_caja/shift2')).efectivoVentas;
 await assertSucceeds(settle(['debtCash_0'],20));
 const t=await data(admin,'transacciones/debtCash_0');assert.equal(t.estadoPago,'pagado');
 assert.equal((await data(admin,'articulos/agua')).stock,p);assert.equal((await data(admin,'turnos_caja/shift2')).efectivoVentas,c+2000);
 assert.equal((await data(admin,'liquidaciones/'+t.liquidacionId)).total,20);
 });
 await test('Cobro pendiente duplicado se rechaza',async()=>{
 const c=(await data(admin,'turnos_caja/shift2')).efectivoVentas;
 await assert.rejects(settle(['debtCash_0'],20),/cobrada|cambi/);
 assert.equal((await data(admin,'turnos_caja/shift2')).efectivoVentas,c);
 });
 await test('Fiado transferencia y liquidación de dos partidas con cocina',async()=>{
 await admin.doc('articulos/sandwich').update({requiereCocina:true});
 assert.equal((await data(admin,'articulos/sandwich')).requiereCocina,true);
 const c=(await data(admin,'turnos_caja/shift2')).efectivoVentas,p=(await data(admin,'articulos/sandwich')).stock;
 await assertSucceeds(checkout('debtTransfer','transferencia',[{id:'sandwich',cantidad:1,precio:35},{id:'agua',cantidad:1,precio:10}],{estado:'pendiente'}));
 const kitchenBefore=await data(admin,'eventos/cafe/pedidos_cocina/debtTransfer');assert.ok(kitchenBefore,'El pedido debe existir en cocina');assert.equal(kitchenBefore.items.length,1);assert.equal(kitchenBefore.pagoPendiente,true);
 await assertSucceeds(settle(['debtTransfer_0','debtTransfer_1'],45));
 assert.equal((await data(admin,'eventos/cafe/pedidos_cocina/debtTransfer')).pagoPendiente,false);
 assert.equal((await data(admin,'articulos/sandwich')).stock,p-1);
 assert.equal((await data(admin,'turnos_caja/shift2')).efectivoVentas,c);
 });
 await test('Bloquea liquidación de otra cuenta',async()=>{
 await assertSucceeds(checkout('debtProtected','efectivo',[{id:'agua',cantidad:1,precio:10}],{estado:'pendiente'}));
 await assert.rejects(settle(['debtProtected_0'],10,'seller2'));
 assert.equal((await data(admin,'transacciones/debtProtected_0')).estadoPago,'pendiente');
 });
 await test('Bloquea marcar deuda pagada sin registro',()=>assertFails(cashier.doc('transacciones/debtProtected_0').update({estadoPago:'pagado',fechaPago:firebase.firestore.FieldValue.serverTimestamp()})));
 await test('Bloquea liquidación con efectivo inventado',async()=>{
 const id='fakeSettlement',batch=cashier.batch();
 batch.update(cashier.doc('transacciones/debtProtected_0'),{estadoPago:'pagado',fechaPago:firebase.firestore.FieldValue.serverTimestamp(),turnoCajaId:'shift2',liquidacionId:id});
 batch.update(cashier.doc('turnos_caja/shift2'),{efectivoVentas:firebase.firestore.FieldValue.increment(5000),ultimaLiquidacionId:id});
 batch.set(cashier.doc('liquidaciones/'+id),{vendedorId:'seller1',transacciones:['debtProtected_0'],total:50,efectivo:50,turnoCajaId:'shift2',fecha:firebase.firestore.FieldValue.serverTimestamp()});
 await assertFails(batch.commit());
 assert.equal((await data(admin,'transacciones/debtProtected_0')).estadoPago,'pendiente');
 });
 await test('Registro de liquidación no puede modificarse',async()=>{
 const t=await data(admin,'transacciones/debtCash_0');await assertFails(cashier.doc('liquidaciones/'+t.liquidacionId).update({total:1}));
 });
 console.log('Resultado: '+passed+' correctas, '+failed+' fallidas. Las fallidas requieren corrección antes de publicar.');
 if(failed)process.exitCode=1;
 }finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1;});
