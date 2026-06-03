/* Bardaks ERP — index_bridge.js  [Phase 4B.1 + 4B.2 + runtime sentinel]
   AMAÇ: durumIlerlet + durumDegistir WRITE-path'ini UTL.mutate.single (apply_batch_transition, N=1) üzerine taşır.
   - READ path eski kalır; her ikisi TAM REPLACEMENT (double-write yok); realtime'a dokunulmaz.
   - SENTINEL: window.IB_STATUS ile runtime'da yüklenme + override durumu kanıtlanır. */
(function(){
  'use strict';
  var VERSION = '4B.2';
  // sentinel: erken init (yüklendi ama henüz override edilmedi)
  window.IB_STATUS = { loaded:false, version:VERSION, overrides:{durumIlerlet:false, durumDegistir:false}, loaded_at:null, error:null };
  if(window.__IB_LOADED){ window.IB_STATUS.error='DOUBLE_LOAD'; return; } window.__IB_LOADED = true;

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  function waitFor(c,cb,t){ t=(t==null)?120:t; if(c()){cb();return;} if(t<=0){ window.IB_STATUS.error='UTL_MISSING'; try{console.warn('IB: UTL/bağımlılık yok -> IB_STATUS.error=UTL_MISSING');}catch(e){} return; } setTimeout(function(){waitFor(c,cb,t-1);},250); }
  function T(t,b){ try{ if(typeof toast==='function'){ toast(t,b||''); return; } }catch(e){} }
  function dAd(d){ try{ return (typeof durumAd==='function')?durumAd(d):d; }catch(e){ return d; } }
  function refresh(){ try{ if(typeof closeModal==='function') closeModal(); }catch(e){} try{ if(typeof renderSiparis==='function') renderSiparis(); }catch(e){} }
  function refreshU(){ try{ if(typeof renderUretim==='function') renderUretim(); }catch(e){} }

  ready(function(){
    waitFor(function(){ return window.UTL && window.UTL.mutate && typeof sb!=='undefined' && sb
      && typeof durumIlerlet==='function' && typeof CURRENT!=='undefined' && CURRENT; }, install);
  });

  async function doTransition(sid, yeni, rfn){
    var cur;
    try{
      var r = await sb.from('siparisler').select('durum,kilitli').eq('id',sid).single(); // READ path (4B'de eski)
      if(r.error || !r.data){ T('⚠️ Sipariş bulunamadı',''); return; }
      cur = r.data;
    }catch(e){ T('⚠️ Bağlantı sorunu','Tekrar dene'); return; }
    if(cur.kilitli){ T('🔒 Kilitli','Faturalı/kilitli sipariş ilerletilemez'); return; }

    var res; // WRITE path (STANDARDIZE): tek mutation hattı = batch RPC (N=1)
    try{ res = await window.UTL.mutate.single(sid, cur.durum, yeni); }
    catch(e){ T('⚠️ İşlenemedi','Bağlantıyı kontrol et, tekrar dene'); return; }

    if(res.state==='confirmed'){
      var st = res.result && res.result.status;
      if(st==='completed'){ T('✅ Güncellendi', dAd(yeni)); rfn(); }
      else if(st==='failed'){
        var rs = res.result && res.result.reason;
        T('⛔ Yapılamadı', rs==='no_permission' ? ('Bu işleme yetkin yok ('+CURRENT.rol+')')
          : (dAd(cur.durum)+' → '+dAd(yeni)+' geçişi uygun değil'));
      } else { T('✓ Kısmen işlendi',''); rfn(); }
    } else if(res.state==='unknown'){
      T('⏳ Doğrulanıyor','Bağlantı kontrol ediliyor — veri güvende');
      reconcile(res.batch_id, cur.durum, yeni, 0, rfn);
    } else {
      T('⚠️ İşlenemedi', res.reason||'');
    }
  }

  function install(){
    try{
      // TAM REPLACEMENT — index.html onclick'leri window.* çağırır; üzerine yazıyoruz (legacy write çağrılmaz)
      window.durumIlerlet  = function(sid, yeni){ return doTransition(sid, yeni, refresh);  }; // 4B.1
      window.durumDegistir = function(sid, yeni){ return doTransition(sid, yeni, refreshU); }; // 4B.2
      // sentinel: override'ların gerçekten kurulduğunu doğrula
      var okI = (typeof window.durumIlerlet==='function');
      var okD = (typeof window.durumDegistir==='function');
      window.IB_STATUS = { loaded:true, version:VERSION,
        overrides:{ durumIlerlet:okI, durumDegistir:okD }, loaded_at:new Date().toISOString(), error:(okI&&okD)?null:'OVERRIDE_FAILED' };
      try{ console.log('IB_READY version='+VERSION+' overrides='+okI+'/'+okD); }catch(e){}
    }catch(e){
      window.IB_STATUS.error='OVERRIDE_FAILED'; window.IB_STATUS.loaded=true;
      try{ console.warn('IB: OVERRIDE_FAILED', e); }catch(e2){}
    }
  }

  async function reconcile(bid, from, yeni, n, rfn){
    if(!bid || n>6){ T('⏳ Sonuç beklemede','Bağlantı gelince güncellenecek — veri güvende'); return; }
    try{
      var r = await sb.from('batch_records').select('status,counts').eq('batch_id', bid).maybeSingle();
      if(r.data){
        if(r.data.status==='completed'){ T('✅ Güncellendi', dAd(yeni)); }
        else if(r.data.status==='failed'){ T('ℹ️ Geçiş uygulanmadı', dAd(from)+' korundu'); }
        else { T('ℹ️ Sonuç', r.data.status); }
        if(rfn) rfn(); return;
      }
    }catch(e){}
    setTimeout(function(){ reconcile(bid, from, yeni, n+1, rfn); }, 2200);
  }
})();
