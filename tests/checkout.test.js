const assert = require('node:assert/strict');
require('../checkout.js');
const makeDb = () => {
 const data = new Map(Object.entries({'eventos/e':{activo:true},'usuarios/u':{role:'vendedor',name:'Test',activo:true},'pulseras/p':{saldoActual:100,nombre:'Cliente'},'articulos/a':{eventId:'e',precio:30,stock:2,nombre:'Café',vendedorAsignadoId:'otro'}}));
 const db = {collection:c=>({doc:id=>c+'/'+id}),async runTransaction(fn){const pending=[];const result=await fn({get:async ref=>({exists:data.has(ref),data:()=>data.get(ref)}),set:(ref,val)=>pending.push(()=>data.set(ref,val)),update:(ref,val)=>pending.push(()=>data.set(ref,{...data.get(ref),...val}))});pending.forEach(op=>op());return result;}};
 return {db,data};
};
(async()=>{
 const {db,data}=makeDb();
 const opts={db,auth:{currentUser:{uid:'u'}},eventId:'e',items:[{id:'a',cantidad:1,precio:30}],pulseraId:'p',pulseraNombre:'Cliente',metodo:'nfc',estado:'pagado',carritoId:'one'};
 await GenesaretCheckout.commit(opts);
 assert.equal(data.get('pulseras/p').saldoActual,70);
 assert.equal(data.get('articulos/a').stock,1);
 assert.equal(data.get('transacciones/one_0').ventaFueraDePuesto,true);
 await assert.rejects(GenesaretCheckout.commit(opts),/registrada/);
 await assert.rejects(GenesaretCheckout.commit({...opts,carritoId:'two',items:[{id:'a',cantidad:2,precio:30}]}),/Stock insuficiente/);
 assert.equal(data.get('pulseras/p').saldoActual,70);
 await assert.rejects(GenesaretCheckout.commit({...opts,carritoId:'three',items:[{id:'a',cantidad:1,precio:20}]}),/catálogo cambió/);
 data.get('pulseras/p').saldoActual=10;
 await assert.rejects(GenesaretCheckout.commit({...opts,carritoId:'four'}),/Saldo insuficiente/);
 assert.equal(data.get('articulos/a').stock,1);
 console.log('Checkout: OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
