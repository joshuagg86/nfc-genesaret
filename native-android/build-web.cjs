'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dest=path.join(__dirname,'www');
execFileSync(process.execPath,[path.join(root,'build-training-hosting.cjs')],{cwd:root,stdio:'inherit'});
const source=path.join(root,'.training-hosting');
if(fs.existsSync(dest)&&fs.lstatSync(dest).isSymbolicLink())throw Error('Directorio inesperado');
fs.rmSync(dest,{recursive:true,force:true});fs.cpSync(source,dest,{recursive:true});
const p=path.join(dest,'config.js');
const release=process.argv.includes('--release');
let s=fs.readFileSync(p,'utf8');
const old="const genesaretTraining = ['genesaret-capacitacion.web.app','genesaret-capacitacion.firebaseapp.com'].includes(location.hostname);";
if(!s.includes(old)||!s.includes('const firebaseConfig=trainingConfig;'))throw Error('No se pudo verificar configuración');
const admin=path.join(dest,'admin.html');let html=fs.readFileSync(admin,'utf8');
if(release){
 s=fs.readFileSync(path.join(root,'config.js'),'utf8');
 if(!s.includes(old)||!s.includes("const firebaseConfig = genesaretLocalTest"))throw Error('Configuración original inesperada');
 s=s.replace(old,"const genesaretTraining = sessionStorage.getItem('gene.native.environment') !== 'production';");
 s=s.replace("if (!genesaretLocalTest && !genesaretTraining) db.enablePersistence()","if (false) db.enablePersistence()");
 s=s.replace("if (!genesaretLocalTest && !genesaretTraining && 'serviceWorker' in navigator)","if (false && 'serviceWorker' in navigator)");
 s=s.replace("if(login){const a=document.createElement('a');","if(login){const a=document.createElement('a');a.addEventListener('click',e=>{e.preventDefault();window.GeneSwitchEnvironment();});");
 s += "\nwindow.GeneSwitchEnvironment=async function(){if(window.geneSwitchBusy)return;const target=genesaretTraining?'producción REAL':'capacitación';if(!confirm('Cambiar a '+target+' y cerrar sesión?'))return;window.geneSwitchBusy=true;try{if(auth.currentUser){await Promise.race([db.waitForPendingWrites(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Hay operaciones pendientes o falta conexión')),10000))]);await auth.signOut();}sessionStorage.setItem('gene.native.environment',genesaretTraining?'production':'training');location.replace('index.html');}catch(e){alert('No se pudo cambiar de entorno: '+e.message);}finally{window.geneSwitchBusy=false;}};\n";
 const switchPattern=/onclick="location\.href=window\.GenesaretTraining[^"]*"/;
 if(!switchPattern.test(html))throw Error('Selector de entorno no encontrado');
 html=html.replace(switchPattern,'onclick="GeneSwitchEnvironment()"');
}else{
 s=s.replace(old,'const genesaretTraining = true;');
 s=s.replace("if(login){const a=", "if(false&&login){const a=");
 html=html.replace(/<button[^>]*onclick="location\.href=window\.GenesaretTraining[^"]*"[^>]*>[\s\S]*?<\/button>/g,'');
 if(html.includes('location.href=window.GenesaretTraining'))throw Error('Cambio de entorno no eliminado');
}
fs.writeFileSync(p,s);
fs.writeFileSync(admin,html);
console.log(release?'Paquete Android comercial: inicia en capacitación y permite cambiar a producción con confirmación.':'Paquete Android local: solo capacitación.');
fs.copyFileSync(path.join(__dirname,'gene-native-nfc.js'),path.join(dest,'gene-native-nfc.js'));
for(const name of ['admin.html','vendedor.html']){
 const file=path.join(dest,name);
 let page=fs.readFileSync(file,'utf8');
 page=page.replace(/<script src="config\.js[^"]*"><\/script>/,match=>match+'<script src="gene-native-nfc.js"></script>');
 if(!page.includes('gene-native-nfc.js'))throw Error('No se pudo instalar puente NFC');
 fs.writeFileSync(file,page);
}
const js=path.join(dest,'admin.js');let code=fs.readFileSync(js,'utf8');
const oldCode="let id = '';\n            for (const record of event.message.records) {\n                id = decoder.decode(record.data);\n            }\n            buscarPulseraAdmin(id);";
if(!code.includes(oldCode))throw Error('No se encontró lectura NFC de caja');
code=code.replace(oldCode,"let id = event.serialNumber || '';\n            if(!id)for (const record of event.message.records) { id = decoder.decode(record.data); }\n            if(!id){showError('Chip sin identificador');resetAdminNFC();return;}\n            buscarPulseraAdmin(id.replace(/:/g,'').toUpperCase());");
fs.writeFileSync(js,code);
