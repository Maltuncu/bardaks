/* Bardaks ERP — index_bridge.js  [Phase 4B.1]
   AMAÇ: durumIlerlet WRITE-path'ini UTL.mutate.single (apply_batch_transition, N=1) üzerine taşır.
   - READ path eski kalır (4B'de read standardize edilmez; sadece write).
   - durumIlerlet TAM REPLACEMENT (eski fonksiyon bir daha çağrılmaz -> double-write yok).
   - Realtime'a DOKUNULMAZ (4B.5'e bırakıldı -> render storm/loop riski yok).
   - index.html dosyasına dokunmaz; netkar_banka.js loader'ı ile yüklenir. */
(function(){
  'use strict';
  if(window.__IB_LOADED){ return; } window.__IB_LOADED = true;

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  function waitFor(c,cb,t){ t=(t==null)?120:t; if(c()){cb();return;} if(t<=0){console.warn('IB: bağımlılık yok');return;} setTimeout(function(){waitFor(c,cb,t-1);},250); }
  function T(t,b){ try{ if(typeof toast==='function'){ toast(t,b||''); return; } }catch(e){} }
  function dAd(d){ try{ return (typeof durumAd==='function')?durumAd(d):d; }catch(e){ return d; } }
  function refresh(){ try{ if(typeof closeModal==='function') closeModal(); }catch(e){} try{ if(typeof renderSiparis==='function') renderSiparis(); }catch(e){} }

  ready(function(){
    waitFor(function(){ return window.UTL && window.UTL.mutate && typeof sb!=='undefined' && sb
      && typeof durumIlerlet==='function' && typeof CURRENT!=='undefined' && CURRENT; }, install);
  });

  function install(){
    // TAM REPLACEMENT: index.html'deki onclick'ler window.durumIlerlet'i çağırır; burada üzerine yazıyoruz.
    window.durumIlerlet = async function(sid, yeni){
      var cur;
      try{
        // READ path (4B'de değişmedi): mevcut durum + kilit
        var r = await sb.from('siparisler').select('durum,kilitli').eq('id',sid).single();
        if(r.error || !r.data){ T('⚠️ Sipariş bulunamadı',''); return; }
        cur = r.data;
      }catch(e){ T('⚠️ Bağlantı sorunu','Tekrar dene'); return; }
      if(cur.kilitli){ T('🔒 Kilitli','Faturalı sipariş ilerletilemez'); return; }

      // WRITE path (STANDARDIZE): tek mutation hattı = batch RPC (N=1)
      var res;
      try{ res = await window.UTL.mutate.single(sid, cur.durum, yeni); }
      catch(e){ T('⚠️ İşlenemedi','Bağlantıyı kontrol et, tekrar dene'); return; }

      if(res.state==='confirmed'){
        var st = res.result && res.result.status;
        if(st==='completed'){ T('✅ Güncellendi', dAd(yeni)); refresh(); }
        else if(st==='failed'){
          var rs = res.result && res.result.reason;
          T('⛔ Yapılamadı', rs==='no_permission' ? ('Bu işleme yetkin yok ('+CURRENT.rol+')')
            : (dAd(cur.durum)+' → '+dAd(yeni)+' geçişi uygun değil'));
        } else { T('✓ Kısmen işlendi',''); refresh(); }
      } else if(res.state==='unknown'){
        // ack kaybı -> reconcile (batch_records read); ASLA failure varsayma
        T('⏳ Doğrulanıyor','Bağlantı kontrol ediliyor — veri güvende');
        reconcile(res.batch_id, cur.durum, yeni, 0);
      } else {
        T('⚠️ İşlenemedi', res.reason||'');
      }
    };
    try{ console.log('IB: durumIlerlet -> UTL.mutate.single (Phase 4B.1) aktif'); }catch(e){}
  }

  async function reconcile(bid, from, yeni, n){
    if(!bid || n>6){ T('⏳ Sonuç beklemede','Bağlantı gelince güncellenecek — veri güvende'); return; }
    try{
      var r = await sb.from('batch_records').select('status,counts').eq('batch_id', bid).maybeSingle();
      if(r.data){
        if(r.data.status==='completed'){ T('✅ Güncellendi', dAd(yeni)); }
        else if(r.data.status==='failed'){ T('ℹ️ Geçiş uygulanmadı', dAd(from)+' korundu'); }
        else { T('ℹ️ Sonuç', r.data.status); }
        refresh(); return;
      }
    }catch(e){}
    setTimeout(function(){ reconcile(bid, from, yeni, n+1); }, 2200);
  }
})();
