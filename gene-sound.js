(function(){
'use strict';
const key='gene.sound.enabled';
let ctx,last=0;
const patterns={success:[[660,0,.11],[880,.12,.19]],scan:[[1050,0,.09]],error:[[330,0,.16],[220,.18,.22]],balance:[[440,0,.12],[330,.14,.12],[220,.28,.22]],order:[[523,0,.14],[659,.16,.14],[784,.32,.22]],ready:[[784,0,.12],[1047,.14,.15],[1319,.31,.24]]};
function enabled(){try{return localStorage.getItem(key)!=='off';}catch{return true;}}
function update(){document.querySelectorAll('[data-gene-sound]').forEach(b=>{b.setAttribute('aria-pressed',String(enabled()));b.textContent=enabled()?(ctx?.state==='running'?'Sonidos activados':'Activar audio'):'Sonidos desactivados';});}
async function unlock(){if(!enabled())return false;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;ctx ||= new C();if(ctx.state!=='running')await ctx.resume();update();return ctx.state==='running';}catch{return false;}}
function play(type){if(!enabled()||ctx?.state!=='running')return;const now=ctx.currentTime;if(now-last<.08&&last!==0)return;last=now;try{for(const [f,offset,len] of patterns[type]||patterns.error){const o=ctx.createOscillator(),g=ctx.createGain(),t=now+offset;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.18,t+.012);g.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(g);g.connect(ctx.destination);o.start(t);o.stop(t+len+.02);}}catch{}}
async function toggle(){if(enabled()&&ctx?.state==='running'){try{localStorage.setItem(key,'off');}catch{}update();return;}try{localStorage.setItem(key,'on');}catch{}if(await unlock())play('scan');update();}
window.GeneSound={play,unlock,toggle,enabled};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-gene-sound]'))void unlock();},{capture:true,passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')if(!e.target.closest('[data-gene-sound]'))void unlock();},{capture:true});
document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-gene-sound]').forEach(b=>b.addEventListener('click',toggle));update();});
})();
