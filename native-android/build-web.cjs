'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dest=path.join(__dirname,'www');
execFileSync(process.execPath,[path.join(root,'build-training-hosting.cjs')],{cwd:root,stdio:'inherit'});
const source=path.join(root,'.training-hosting');
if(fs.existsSync(dest)&&fs.lstatSync(dest).isSymbolicLink())throw Error('Directorio inesperado');
fs.rmSync(dest,{recursive:true,force:true});fs.cpSync(source,dest,{recursive:true});
const p=path.join(dest,'config.js');let s=fs.readFileSync(p,'utf8');
const old="const genesaretTraining = ['genesaret-capacitacion.web.app','genesaret-capacitacion.firebaseapp.com'].includes(location.hostname);";
if(!s.includes(old)||!s.includes('const firebaseConfig=trainingConfig;'))throw Error('No se pudo verificar aislamiento de capacitación');
s=s.replace(old,'const genesaretTraining = true;');
s=s.replace("if(login){const a=", "if(false&&login){const a=");
fs.writeFileSync(p,s);
const admin=path.join(dest,'admin.html');let html=fs.readFileSync(admin,'utf8');
html=html.replace(/<button[^>]*onclick="location\.href=window\.GenesaretTraining[^"]*"[^>]*>[\s\S]*?<\/button>/g,'');
if(html.includes('location.href=window.GenesaretTraining'))throw Error('Cambio de entorno no eliminado');
fs.writeFileSync(admin,html);
console.log('Paquete Android local: solo capacitación, sin acceso a producción.');

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
