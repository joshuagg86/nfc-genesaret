'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:__dirname,stdio:'inherit'});
run(process.execPath,['install-nfc.cjs']);
run(process.execPath,['build-web.cjs','--release']);
const config=path.join(__dirname,'capacitor.config.json');
const original=fs.readFileSync(config,'utf8'),c=JSON.parse(original);
const gradle=path.join(__dirname,'android/app/build.gradle');
const strings=path.join(__dirname,'android/app/src/main/res/values/strings.xml');
let g=fs.readFileSync(gradle,'utf8'),s=fs.readFileSync(strings,'utf8');
if(!/applicationId\s+["']com\.genesaret\.pos(?:\.training)?["']/.test(g)||!/versionCode\s+\d+/.test(g)||!/versionName\s+["'][^"']+["']/.test(g))throw Error('Gradle inesperado');
const version=Math.max(3,Number(g.match(/versionCode\s+(\d+)/)[1]));
g=g.replace(/applicationId\s+["']com\.genesaret\.pos(?:\.training)?["']/,'applicationId "com.genesaret.pos"').replace(/versionCode\s+\d+/,'versionCode '+version).replace(/versionName\s+["'][^"']+["']/,'versionName "3.0.0"');
for(const [name,value] of [['app_name','Cafetería Gene'],['title_activity_main','Cafetería Gene'],['package_name','com.genesaret.pos'],['custom_url_scheme','com.genesaret.pos']]){
 const re=new RegExp('(<string name="'+name+'">)[^<]*(</string>)');
 if(re.test(s))s=s.replace(re,'$1'+value+'$2');
}
c.appId='com.genesaret.pos';c.appName='Cafetería Gene';
try{fs.writeFileSync(config,JSON.stringify(c,null,2)+'\n');run('npx',['cap','sync','android']);fs.writeFileSync(gradle,g);fs.writeFileSync(strings,s);}finally{fs.writeFileSync(config,original);}
console.log('Versión comercial 3.0.0 preparada. Genera APK release firmada, no debug.');
