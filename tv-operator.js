(function(){
'use strict';
const $=id=>document.getElementById(id);
let unlockedUid=null,timer=null,role=null,epoch=0;
const isAdmin=()=>['admin','administrador'].includes(role);
function lock(){unlockedUid=null;clearTimeout(timer);$('tvControls').hidden=true;$('tvBack').hidden=true;}
function adminControls(user){unlockedUid=user.uid;$('tvControls').hidden=false;$('tvBack').hidden=false;$('tvLock').hidden=true;$('tvSettings').hidden=true;}
function allowed(){return !!auth.currentUser&&auth.currentUser.uid===unlockedUid;}
function unlock(uid){unlockedUid=uid;$('tvControls').hidden=false;$('tvBack').hidden=!['admin','administrador'].includes(role);clearTimeout(timer);timer=setTimeout(lock,120000);}
$('tvLock').onclick=()=>{if(!isAdmin())lock();};
$('tvSettings').onclick=async()=>{
 if(allowed()){lock();return;}
 const user=auth.currentUser;if(!user){location.replace('index.html');return;}
 const token=epoch;
 const result=await Swal.fire({title:'Configuración del operador',text:'Introduce la contraseña de esta cuenta para acceder a los controles.',input:'password',inputAttributes:{autocomplete:'current-password'},showCancelButton:true,confirmButtonText:'Desbloquear',cancelButtonText:'Cancelar',showLoaderOnConfirm:true,allowOutsideClick:()=>!Swal.isLoading(),customClass:{popup:'genesaret-smart-modal'},preConfirm:async value=>{
 try{if(!value||!user.email)throw Error();await user.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(user.email,value));const p=await db.collection('usuarios').doc(user.uid).get();if(!p.exists||p.data().activo===false||!['admin','administrador',document.body.dataset.mode==='tv'?'tv':'cocina'].includes(p.data().role))throw Error();role=p.data().role;return true;}catch(e){Swal.showValidationMessage('No se pudo verificar la contraseña o el acceso.');return false;}
 }});
 if(result.isConfirmed&&token===epoch&&auth.currentUser?.uid===user.uid)unlock(user.uid);
};
$('tvLogout').onclick=async()=>{
 if(!allowed())return;
 const r=await Swal.fire({title:'¿Cerrar sesión?',text:'La pantalla dejará de mostrar los pedidos.',showCancelButton:true,confirmButtonText:'Cerrar sesión',cancelButtonText:'Volver',customClass:{popup:'genesaret-smart-modal'}});
 if(r.isConfirmed&&allowed()){try{await auth.signOut();location.replace('index.html');}catch(e){Swal.fire({icon:'error',title:'No se pudo cerrar sesión',text:e.message});}}
};
auth.onAuthStateChanged(async user=>{const token=++epoch;role=null;lock();$('tvLock').hidden=false;$('tvSettings').hidden=false;if(!user){location.replace('index.html');return;}try{const p=await db.collection('usuarios').doc(user.uid).get({source:'server'});if(token!==epoch||auth.currentUser?.uid!==user.uid)return;if(p.exists&&p.data().activo===true){role=p.data().role;if(isAdmin())adminControls(user);}}catch(e){console.warn('No se pudo verificar el rol del operador',e);}});
})();