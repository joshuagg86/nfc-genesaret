'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const root=__dirname;
const dest=path.join(root,'.training-hosting');
fs.mkdirSync(dest,{recursive:true});
const files=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
const excluded=/^(audit-|backup-|seed-|reset-|firestore-|test|sw\.js$)/;
for(const file of files){
 if(file.includes('/')||excluded.test(file)||!(/\.(html|js|css|png|jpg|jpeg|svg|ico|webp|woff2?|ttf)$/i.test(file)||file==='manifest.json'))continue;
 let bytes=fs.readFileSync(path.join(root,file));
 if(file==='config.js'){
  let s=bytes.toString();
  const start=s.indexOf('const firebaseConfig ='),end=s.indexOf('// 1. Inicializar Firebase');
  if(start<0||end<0||!s.includes('genesaret-capacitacion.web.app'))throw Error('Configuración de entrenamiento no encontrada');
  s=s.slice(0,start)+"if(!genesaretTraining)throw Error('Este paquete solo funciona en Genesaret Capacitación');\nconst firebaseConfig=trainingConfig;\n\n"+s.slice(end);
  bytes=Buffer.from(s);
 }
 fs.writeFileSync(path.join(dest,file),bytes);
}
for(const f of ['index.html','admin.html','config.js','vendedor.html','cocina.html','tv-pedidos.html','autoservicio.html'])if(!fs.existsSync(path.join(dest,f)))throw Error('Falta '+f);
console.log('Paquete capacitación preparado:',dest);
