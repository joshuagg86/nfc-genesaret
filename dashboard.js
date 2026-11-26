(function(root){
'use strict';
let stops=[], data={}, failed=false, ready=new Set();
const collections=['eventos','pulseras','recargas','transacciones','articulos'];
const el=id=>document.getElementById(id);
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const mx=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n);
const time=v=>v?.toDate?v.toDate():new Date(v||0);
const set=(id,v)=>{el('overview-'+id).textContent=v;};
function row(target,label,value,sub){
 const line=document.createElement('div');line.className='overview-row';
 const left=document.createElement('span');left.textContent=label;
 if(sub){const small=document.createElement('small');small.textContent=sub;left.append(small);}
 const right=document.createElement('strong');right.textContent=value;line.append(left,right);target.append(line);return line;
}
function bars(id,entries,format){
 const target=el(id);target.replaceChildren();
 if(!entries.length){target.textContent='Sin movimientos registrados';return;}
 const max=Math.max(1,...entries.map(x=>x[1]));
 for(const [label,value] of entries){const item=document.createElement('div');row(item,label,format(value));const track=document.createElement('div');track.className='overview-bar';const fill=document.createElement('b');fill.style.width=Math.max(0,value/max*100)+'%';track.append(fill);item.append(track);target.append(item);}
}
function render(){
 if(failed||ready.size!==collections.length)return;
 const select=el('overviewEvent'), selected=select.value;
 select.replaceChildren(new Option('Todos los eventos',''));
 for(const e of data.eventos.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre))))select.add(new Option((e.nombre||'Evento')+(e.activo===false?' (archivado)':''),e.key));
 select.value=[...select.options].some(o=>o.value===selected)?selected:'';
 const scope=items=>items.filter(x=>!select.value||x.eventId===select.value);
 const wallets=scope(data.pulseras), loads=scope(data.recargas), sales=scope(data.transacciones), products=scope(data.articulos);
 const paid=sales.filter(s=>s.estadoPago!=='pendiente'&&s.estadoPago!=='cancelado'&&s.estadoPago!=='anulado');
 const sum=(items,field)=>items.reduce((n,x)=>n+num(x[field]),0);
 const methods={nfc:0,efectivo:0,transferencia:0,otro:0}, ranking=new Map();
 for(const s of paid){const method=s.metodoPago==='qr'?'nfc':s.metodoPago|| (s.pulseraId?'nfc':'otro');methods[Object.hasOwn(methods,method)?method:'otro']+=num(s.monto);if(s.articulo)ranking.set(s.articulo,(ranking.get(s.articulo)||0)+(num(s.cantidad)||1));}
 set('recargas',mx(loads.reduce((n,x)=>n+Math.max(0,num(x.monto)),0)));set('ventas',mx(sum(paid,'monto')));set('saldo',mx(sum(wallets,'saldoActual')));set('operaciones',new Set(sales.map(s=>s.carritoId||s.key)).size+loads.length);set('pulseras',wallets.length);set('nfc',mx(methods.nfc));set('pendientes',mx(sum(sales.filter(s=>s.estadoPago==='pendiente'),'monto')));
 bars('overviewRanking',[...ranking].sort((a,b)=>b[1]-a[1]).slice(0,5),v=>v+' uds.');bars('overviewMethods',[['NFC / QR',methods.nfc],['Efectivo',methods.efectivo],['Transferencia',methods.transferencia],['Otros',methods.otro]].filter(x=>x[1]>0),mx);
 const feed=el('overviewFeed');feed.replaceChildren();
 const activity=[...sales.map(s=>({label:s.articulo||'Venta',amount:s.monto,date:s.fecha,sub:s.estadoPago==='pendiente'?'Pendiente':'Venta'})),...loads.map(s=>({label:'Recarga de pulsera',amount:s.monto,date:s.fecha,sub:'Recarga'}))].sort((a,b)=>time(b.date)-time(a.date)).slice(0,12);
 for(const x of activity)row(feed,x.label,mx(num(x.amount)),x.sub+' · '+time(x.date).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}));
 if(!activity.length)feed.textContent='Sin actividad reciente';
 const stock=el('overviewStock');stock.replaceChildren();
 for(const p of products.filter(p=>!p.esInfinito&&p.stock!=null&&num(p.stock)<=5).sort((a,b)=>num(a.stock)-num(b.stock)))row(stock,p.nombre||'Producto',num(p.stock)<=0?'Agotado':num(p.stock)+' disponibles');
 if(!stock.children.length)stock.textContent='Sin alertas de inventario';
 el('overviewStatus').textContent='Datos recibidos · '+(select.selectedOptions[0]?.textContent||'Todos los eventos');
}
function start(db){
 stops.forEach(stop=>stop());stops=[];data={};ready.clear();failed=false;
 el('overviewEvent').onchange=render;
 for(const name of collections)stops.push(db.collection(name).onSnapshot(snapshot=>{data[name]=snapshot.docs.map(d=>({...d.data(),key:d.id}));ready.add(name);render();},()=>{failed=true;el('overviewStatus').textContent='No se pudieron cargar todos los datos. Revisa conexión y permisos; las cifras no están actualizadas.';for(const id of ['recargas','ventas','saldo','operaciones','pulseras','nfc','pendientes'])set(id,'—');for(const id of ['overviewRanking','overviewMethods','overviewFeed','overviewStock'])el(id).textContent='Datos no disponibles';}));
}
root.GenesaretDashboard={start};
})(globalThis);
