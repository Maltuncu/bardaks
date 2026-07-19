/* Bardaks Push — OneSignal v16 (Custom Code) companion.
   Mevcut koda dokunmaz. index.html <head> manifest + ikonlar zaten var.
   App ID public; REST key burada YOK (yalnız Supabase Vault'ta). */
(function(){
  'use strict';
  var APP_ID = 'a0e645c5-5155-455b-99f9-fdd74d8a844a';

  // 1) Deferred kuyruğu SDK'dan ÖNCE hazır olmalı
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function(OneSignal){
    try{
      await OneSignal.init({
        appId: APP_ID,
        serviceWorkerParam: { scope: '/bardaks/' },
        serviceWorkerPath: 'bardaks/OneSignalSDKWorker.js',
        autoResubscribe: true,
        welcomeNotification: { disable: true }
      });
      window.__OS = OneSignal;
      bindUser(OneSignal);
      try{ OneSignal.Notifications.addEventListener('permissionChange', updateBell); }catch(e){}
      updateBell();
    }catch(e){ console.warn('OneSignal init', e); }
  });

  // 2) SDK'yı yükle
  var sdk = document.createElement('script');
  sdk.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  sdk.defer = true;
  document.head.appendChild(sdk);

  // 3) Oturum açılınca kullanıcıyı eşle (external_id = kullanicilar.id, tag rol)
  function bindUser(OneSignal, tries){
    tries = (tries==null) ? 180 : tries;
    try{
      if(typeof CURRENT!=='undefined' && CURRENT && CURRENT.id){
        OneSignal.login(String(CURRENT.id));
        if(CURRENT.rol) OneSignal.User.addTag('rol', String(CURRENT.rol));
        return;
      }
    }catch(e){}
    if(tries>0) setTimeout(function(){ bindUser(OneSignal, tries-1); }, 500);
  }

  // 4) "Bildirimleri Aç" düğmesi — yalnız izin verilmemişse görünür, verilince gizlenir
  function addBell(){
    if(typeof CURRENT==='undefined' || !CURRENT){ setTimeout(addBell, 800); return; }
    if(document.getElementById('os-bell')) return;
    var b = document.createElement('button');
    b.id = 'os-bell'; b.type = 'button';
    b.textContent = 'Bildirimleri Aç';
    b.style.cssText = 'position:fixed;left:14px;bottom:82px;z-index:9000;background:#1e5ba8;color:#fff;border:none;border-radius:22px;padding:10px 15px;font-size:13px;font-weight:700;box-shadow:0 3px 12px rgba(16,32,56,.28);cursor:pointer;display:none';
    b.onclick = async function(){
      var OS = window.__OS;
      if(!OS){ alert('Bildirim sistemi yükleniyor — birkaç saniye sonra tekrar dene.'); return; }
      try{
        if(typeof OS.Notifications.isPushSupported==='function' && !OS.Notifications.isPushSupported()){
          alert('Bu tarayıcı/cihaz web push desteklemiyor.\n\niPhone ise: Safari → Paylaş → "Ana Ekrana Ekle", sonra o simgeden aç ve tekrar dene.');
          return;
        }
        await OS.Notifications.requestPermission();
        updateBell();
      }catch(e){ alert('Bildirim izni hatası: ' + ((e&&e.message)||e)); }
    };
    document.body.appendChild(b);
    updateBell();
  }

  function updateBell(){
    try{
      var b = document.getElementById('os-bell'); var OS = window.__OS;
      if(!b) return;
      var izinVar = OS ? !!OS.Notifications.permission : false;
      b.style.display = izinVar ? 'none' : 'block';
    }catch(e){}
  }

  if(document.readyState!=='loading') addBell();
  else document.addEventListener('DOMContentLoaded', addBell);
})();
