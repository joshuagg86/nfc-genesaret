'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'android/app/src/main');
const pkg=path.join(base,'java/com/genesaret/pos/training');
const activity=path.join(pkg,'MainActivity.java'),manifest=path.join(base,'AndroidManifest.xml');
let a=fs.readFileSync(activity,'utf8'),m=fs.readFileSync(manifest,'utf8');
if(!a.includes('registerPlugin(GeneNfcPlugin.class)')){
 if(!/public class MainActivity extends BridgeActivity\s*\{\s*\}/.test(a))throw Error('MainActivity tiene cambios propios; no se sobrescribirá');
 a=a.replace(/public class MainActivity extends BridgeActivity\s*\{\s*\}/,'public class MainActivity extends BridgeActivity {\n @Override public void onCreate(android.os.Bundle savedInstanceState){\n registerPlugin(GeneNfcPlugin.class);\n super.onCreate(savedInstanceState);\n }\n}');
}
if(!m.includes('android.permission.NFC'))m=m.replace('</manifest>','<uses-permission android:name="android.permission.NFC" />\n<uses-feature android:name="android.hardware.nfc" android:required="false" />\n</manifest>');
fs.copyFileSync(path.join(__dirname,'GeneNfcPlugin.java'),path.join(pkg,'GeneNfcPlugin.java'));
fs.writeFileSync(activity,a);fs.writeFileSync(manifest,m);
console.log('NFC nativo configurado; iconos y recursos existentes conservados.');
