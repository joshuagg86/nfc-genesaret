(function(){
const cap=window.Capacitor;
if(!cap || cap.getPlatform()!=='android')return;
const plugin=cap.registerPlugin('GeneNfc');
let sequence=0;
class NativeReader{
 async scan(){
  const token=++sequence;
  const result=await plugin.read();
  setTimeout(()=>{if(token===sequence&&!document.hidden&&typeof this.onreading==='function')this.onreading({serialNumber:result.uid,message:{records:[]}});},0);
 }
}
Object.defineProperty(window,'NDEFReader',{value:NativeReader,configurable:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){sequence++;plugin.cancel().catch(()=>{});}});
window.addEventListener('pagehide',()=>{sequence++;plugin.cancel().catch(()=>{});});
})();
