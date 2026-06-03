/* Bardaks ERP — index_bridge.js  [Phase 4B.1 + 4B.2 + 4B.4 + sentinel]
   - durumIlerlet + durumDegistir WRITE-path -> UTL.mutate.single (apply_batch_transition, N=1). TAM REPLACEMENT, double-write yok.
   - 4B.4 Undo: son batch için admin/müdür'e "↩ Geri Al" (revert_last_operation). Optimistic YOK. İmalathane göremez.
   - READ path eski; realtime'a dokunulmaz. index.html'e dokunulmaz. */
(function(){
  'use strict';
  var VERSION = '4B.4';
  window.IB_STATUS = { loaded:false, version:VERSION, overrides:{durumIlerlet:false, durumDegistir:false}, undo:false, loaded_at:null, error:null };
  if(window.__IB_LOADED){ window.IB_STATUS.error='DOUBLE_LOAD'; return; } window.__IB_LOADED = true;

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  function waitFor(c,cb,t){ t=(t==null)?120:t; if(c()){cb();return;} if(t<=0){ window.IB_STATUS.error='UTL_MISSING'; try{console.warn('IB: UTL yok -> UTL_MISSING');}catch(e){} return; } setTimeout(function(){waitFor(c,cb,t-1);},250); }
  function T(t,b){ try{ if(typeof toast==='function'){ toast(t,b||''); return; } }catch(e){} }
  function dAd(d){ try{ return (typeof durumAd==='function')?durumAd(d):d; }catch(e){ return d; } }
  function refresh(){ try{ if(typeof closeModal==='function') closeModal(); }catch(e){} try{ if(typeof renderSiparis==='function') renderSiparis(); }catch(e){} }
  function refreshU(){ try{ if(typeof renderUretim==='function') renderUretim(); }catch(e){} }
  function canUndo(){ try{ return !!(CURRENT && (CURRENT.rol==='admin'||CURRENT.rol==='mudur')); }catch(e){ return false; } }

  var LAST_BATCH=null, undoTimer=null;

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

    var res; // WRITE path: tek mutation hattı = batch RPC (N=1)
    try{ res = await window.UTL.mutate.single(sid, cur.durum, yeni); }
    catch(e){ T('⚠️ İşlenemedi','Bağlantıyı kontrol et, tekrar dene'); return; }

    if(res.state==='confirmed'){
      var st = res.result && res.result.status;
      if(st==='completed'){ T('✅ Güncellendi', dAd(yeni)); rfn(); showUndo(res.batch_id, dAd(cur.durum)+' → '+dAd(yeni)); }
      else if(st==='failed'){
        var rs = res.result && res.result.reason;
        T('⛔ Yapılamadı', rs==='no_permission' ? ('Bu işleme yetkin yok ('+CURRENT.rol+')')
          : (dAd(cur.durum)+' → '+dAd(yeni)+' geçişi uygun değil'));
      } else { T('✓ Kısmen işlendi',''); rfn(); }
    } else if(res.state==='unknown'){
      T('⏳ Doğrulanıyor','Bağlantı kontrol ediliyor — veri güvende');
      reconcile(res.batch_id, cur.durum, yeni, 0, rfn);
    } else { T('⚠️ İşlenemedi', res.reason||''); }
  }

  /* ---------- 4B.4 Undo UI (admin/müdür) ---------- */
  function ensureUndoUI(){
    if(document.getElementById('ib-undo')) return;
    var css='#ib-undo{position:fixed;left:50%;transform:translateX(-50%);bottom:120px;z-index:9600;background:#1a2b40;color:#fff;border-radius:30px;padding:9px 14px;display:none;align-items:center;gap:10px;box-shadow:0 6px 20px rgba(0,0,0,.4);font-size:13px;max-width:92vw}'
      +'#ib-undo.show{display:flex}#ib-undo b{font-weight:700}'
      +'#ib-undo button{background:#d4a04f;color:#1a1208;border:none;border-radius:20px;padding:6px 12px;font-weight:700;cursor:pointer;font-size:13px}'
      +'#ib-undo button[disabled]{opacity:.5;cursor:not-allowed}#ib-undo .x{background:none;color:#9aa0ac;padding:4px 8px}';
    var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
    var d=document.createElement('div'); d.id='ib-undo';
    d.innerHTML='<span id="ib-undo-msg"></span><button id="ib-undo-btn">↩ Geri Al</button><button class="x" id="ib-undo-x">✕</button>';
    document.body.appendChild(d);
    document.getElementById('ib-undo-x').onclick=hideUndo;
    document.getElementById('ib-undo-btn').onclick=doUndo;
  }
  function showUndo(batchId,label){
    if(!canUndo() || !batchId) return; // imalathane göremez
    LAST_BATCH={id:batchId,label:label};
    ensureUndoUI();
    var u=document.getElementById('ib-undo'), btn=document.getElementById('ib-undo-btn');
    document.getElementById('ib-undo-msg').innerHTML='<b>'+label+'</b> — geri alınabilir';
    btn.disabled=false; btn.textContent='↩ Geri Al';
    u.classList.add('show');
    if(undoTimer) clearTimeout(undoTimer); undoTimer=setTimeout(hideUndo,20000);
  }
  function hideUndo(){ var u=document.getElementById('ib-undo'); if(u) u.classList.remove('show'); }
  function disableUndo(msg,hideMs){ var btn=document.getElementById('ib-undo-btn'); if(btn){ btn.disabled=true; btn.textContent=msg||'yapılamaz'; } if(undoTimer) clearTimeout(undoTimer); undoTimer=setTimeout(hideUndo,hideMs||4000); }
  async function doUndo(){
    if(!LAST_BATCH){ hideUndo(); return; }
    var btn=document.getElementById('ib-undo-btn'); if(btn){ btn.disabled=true; btn.textContent='Geri alınıyor…'; } // NO optimistic veri değişimi
    var res;
    try{ res=await window.UTL.mutate.undo(LAST_BATCH.id); }
    catch(e){ if(btn){ btn.disabled=false; btn.textContent='↩ Tekrar dene'; } T('⚠️ Bağlantı','Tekrar dene'); return; }
    if(res.state==='confirmed'){
      var d=res.data||{};
      if(d.status==='reverted'){ T('↩ Geri alındı', (d.reverted||0)+' sipariş eski durumuna döndü'); refresh(); refreshU(); hideUndo(); }
      else if(d.status==='noop'){ if((d.skipped||0)>0){ T('⛔ Geri alınamadı','Sipariş kilitli ya da değişmiş'); disableUndo('geri alınamadı'); } else { T('ℹ️ Zaten geri alınmış',''); disableUndo('zaten geri alınmış'); } }
      else if(d.status==='failed'){ T('⛔ Geri alınamadı', d.reason==='no_permission'?'Bu işleme yetkin yok':(d.reason||'')); disableUndo('yapılamaz'); }
      else { disableUndo(''); }
    } else { // unknown -> ASLA optimistic; sonuç doğrulanıyor
      if(btn){ btn.disabled=false; btn.textContent='↩ Tekrar dene'; }
      T('⏳ Doğrulanıyor','Sonuç bekleniyor — veri güvende');
    }
  }

  function install(){
    try{
      window.durumIlerlet  = function(sid, yeni){ return doTransition(sid, yeni, refresh);  }; // 4B.1
      window.durumDegistir = function(sid, yeni){ return doTransition(sid, yeni, refreshU); }; // 4B.2
      var okI=(typeof window.durumIlerlet==='function'), okD=(typeof window.durumDegistir==='function');
      window.IB_STATUS = { loaded:true, version:VERSION,
        overrides:{ durumIlerlet:okI, durumDegistir:okD }, undo:true, undo_role:canUndo(),
        loaded_at:new Date().toISOString(), error:(okI&&okD)?null:'OVERRIDE_FAILED' };
      try{ console.log('IB_READY version='+VERSION+' overrides='+okI+'/'+okD+' undo=true'); }catch(e){}
    }catch(e){ window.IB_STATUS.error='OVERRIDE_FAILED'; window.IB_STATUS.loaded=true; try{console.warn('IB OVERRIDE_FAILED',e);}catch(e2){} }
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
