/* Bardaks ERP — index_bridge.js  [Phase 4B.1 + 4B.2 + 4B.4 + 4B.5R2 diagnostics + RT_AUDIT sentinel]
   - durumIlerlet + durumDegistir WRITE-path -> UTL.mutate.single (apply_batch_transition, N=1). TAM REPLACEMENT, double-write yok.
   - 4B.4 Undo: son batch için admin/müdür'e "↩ Geri Al" (revert_last_operation). Optimistic YOK. İmalathane göremez.
   - 4B.5R2: IB_STATUS error semantics ayrıştırıldı (UTL_MISSING / SB_MISSING / BRIDGE_FN_MISSING / CURRENT_MISSING + AUTH_PENDING) + RT_AUDIT telemetry sentinel.
   - READ path eski; realtime'a dokunulmaz. index.html'e dokunulmaz. */
(function(){
  'use strict';
  var VERSION = '4B.4';
  window.IB_STATUS = { loaded:false, version:VERSION, overrides:{durumIlerlet:false, durumDegistir:false}, undo:false, loaded_at:null, error:null, diag:null };
  if(window.__IB_LOADED){ window.IB_STATUS.error='DOUBLE_LOAD'; return; } window.__IB_LOADED = true;

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }

  /* PRE-4B.5R2: eksik parçayı DOĞRU isimlendir. UTL_MISSING yalnız UTL/UTL.mutate gerçekten yoksa kullanılır.
     CURRENT/login eksikliği AYRI: AUTH_PENDING -> kalıcı fail DEĞİL, polling sürer, CURRENT gelince install. */
  function ibDiag(){
    if(!(window.UTL && window.UTL.mutate)) return 'UTL_MISSING';
    if(typeof sb==='undefined' || !sb) return 'SB_MISSING';
    if(typeof durumIlerlet!=='function') return 'BRIDGE_FN_MISSING';
    if(typeof CURRENT==='undefined' || !CURRENT) return 'CURRENT_MISSING';
    return null;
  }
  function waitInstall(n){
    if(window.IB_STATUS.loaded) return;
    var d = ibDiag();
    if(d===null){ install(); return; }
    window.IB_STATUS.diag = d;
    if(d==='CURRENT_MISSING'){
      window.IB_STATUS.error = 'AUTH_PENDING';                           // login bekleniyor; override KALICI fail değil
      if(n < 2400){ setTimeout(function(){ waitInstall(n+1); }, 250); }  // ~10 dk polling; CURRENT gelince install, error null olur
      else { window.IB_STATUS.error = 'CURRENT_MISSING'; }
      return;
    }
    if(n >= 120){ window.IB_STATUS.error = d; try{ console.warn('IB not ready -> '+d); }catch(e){} return; }  // UTL/sb/bridge ~30s sonra GERÇEK spesifik error
    setTimeout(function(){ waitInstall(n+1); }, 250);
  }

  function T(t,b){ try{ if(typeof toast==='function'){ toast(t,b||''); return; } }catch(e){} }
  function dAd(d){ try{ return (typeof durumAd==='function')?durumAd(d):d; }catch(e){ return d; } }
  function refresh(){ try{ if(typeof closeModal==='function') closeModal(); }catch(e){} try{ if(typeof renderSiparis==='function') renderSiparis(); }catch(e){} }
  function refreshU(){ try{ if(typeof renderUretim==='function') renderUretim(); }catch(e){} }
  function canUndo(){ try{ return !!(CURRENT && (CURRENT.rol==='admin'||CURRENT.rol==='mudur')); }catch(e){ return false; } }

  var LAST_BATCH=null, undoTimer=null;

  ready(function(){ waitInstall(0); });

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
        loaded_at:new Date().toISOString(), error:(okI&&okD)?null:'OVERRIDE_FAILED', diag:null };
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

/* ============================================================
   Phase 4B.5B0 — Runtime Telemetry Sentinel  (ADDITIVE / READ-ONLY)
   Companion-only. index.html'e DOKUNMAZ. Realtime/render davranışı DEĞİŞMEZ.
   Sadece sayım + timing. Safe-wrap: orijinal this/arguments/return korunur.
   Hata kodları: DOUBLE_LOAD, WRAP_FAILED, UTL_MISSING.
   ============================================================ */
(function(){
  'use strict';
  var SVER = '4B.5B0';
  function now(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }

  /* ---- DOUBLE_LOAD guard ---- */
  if(window.__RT_AUDIT_LOADED || (window.RT_AUDIT && window.RT_AUDIT.loaded)){
    try{ if(window.RT_AUDIT) window.RT_AUDIT.error = window.RT_AUDIT.error || 'DOUBLE_LOAD'; }catch(e){}
    try{ console.warn('RT_AUDIT DOUBLE_LOAD ignored'); }catch(e){}
    return;
  }
  window.__RT_AUDIT_LOADED = true;

  var RT = {
    loaded: true,
    version: SVER,
    loaded_at: new Date().toISOString(),
    error: null,
    counters: {
      renderSiparis: 0, renderUretim: 0, renderPanel: 0,
      refreshSohbetBadge: 0, mutationRefreshes: 0, duplicateWindowHits: 0
    },
    lastCalls: {},
    duplicateWindowMs: 400,
    wrapped: {
      renderSiparis: false, renderUretim: false, renderPanel: false,
      refreshSohbetBadge: false, UTLMutateSingle: false
    }
  };
  window.RT_AUDIT = RT;

  /* sayaç + duplicate-window + timing kaydı */
  function hit(key, counterKey){
    var t = now();
    if(counterKey){ RT.counters[counterKey] = (RT.counters[counterKey]||0) + 1; }
    var last = RT.lastCalls[key];
    if(last && (t - last.at) <= RT.duplicateWindowMs){ RT.counters.duplicateWindowHits++; }
    RT.lastCalls[key] = { at: t, duration_ms: (last && last.duration_ms!=null) ? last.duration_ms : null };
    return t;
  }
  function dur(key, t0){ try{ var d = Math.round(now() - t0); if(RT.lastCalls[key]) RT.lastCalls[key].duration_ms = d; }catch(e){} }

  /* global window fonksiyonunu güvenli sar (counterKey = artırılacak sayaç) */
  function wrapGlobal(name, counterKey){
    try{
      var orig = window[name];
      if(typeof orig !== 'function') return false;            // missing -> retry / false bırak
      if(orig.__rtw){ RT.wrapped[name] = true; return true; }  // zaten sarılı
      var w = function(){
        var t0 = hit(name, counterKey);
        var ret;
        try{ ret = orig.apply(this, arguments); }
        catch(e){ dur(name, t0); throw e; }                    // sync throw korunur
        if(ret && typeof ret.then === 'function'){
          try{ ret.then(function(){ dur(name, t0); }, function(){ dur(name, t0); }); }catch(e){}
        } else { dur(name, t0); }
        return ret;                                            // orijinal dönüş (aynı promise) korunur
      };
      w.__rtw = true; w.__rtorig = orig;
      window[name] = w;
      RT.wrapped[name] = true;
      return true;
    }catch(e){ RT.error = RT.error || 'WRAP_FAILED'; try{console.warn('RT_AUDIT WRAP_FAILED', name, e);}catch(e2){} return false; }
  }

  /* UTL.mutate.single — yalnız sayım/timing; sonuç ve davranış DEĞİŞMEZ */
  function wrapUTL(){
    try{
      if(!(window.UTL && window.UTL.mutate && typeof window.UTL.mutate.single === 'function')) return false;
      var orig = window.UTL.mutate.single;
      if(orig.__rtw){ RT.wrapped.UTLMutateSingle = true; return true; }
      var w = function(){
        var t0 = hit('UTLMutateSingle', 'mutationRefreshes');
        var ret;
        try{ ret = orig.apply(this, arguments); }
        catch(e){ dur('UTLMutateSingle', t0); throw e; }
        if(ret && typeof ret.then === 'function'){
          try{ ret.then(function(){ dur('UTLMutateSingle', t0); }, function(){ dur('UTLMutateSingle', t0); }); }catch(e){}
        } else { dur('UTLMutateSingle', t0); }
        return ret;
      };
      w.__rtw = true; w.__rtorig = orig;
      window.UTL.mutate.single = w;
      RT.wrapped.UTLMutateSingle = true;
      return true;
    }catch(e){ RT.error = RT.error || 'WRAP_FAILED'; try{console.warn('RT_AUDIT WRAP_FAILED UTL', e);}catch(e2){} return false; }
  }

  var RENDERS = ['renderSiparis','renderUretim','renderPanel','refreshSohbetBadge'];
  function passRenders(){
    var all = true;
    for(var i=0;i<RENDERS.length;i++){
      if(!RT.wrapped[RENDERS[i]]){ if(!wrapGlobal(RENDERS[i], RENDERS[i])) all = false; }
    }
    return all;
  }

  function startReady(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  startReady(function(){
    /* ilk senkron deneme: index.html fonksiyon bildirimleri zaten mevcut */
    passRenders();
    wrapUTL();

    /* kalanlar için sınırlı arkaplan denemesi (UTL artık utl.js loader-fix ile mevcut) */
    var tries = 40; // ~10s @250ms
    var iv = setInterval(function(){
      tries--;
      var rOk = passRenders();
      var uOk = RT.wrapped.UTLMutateSingle || wrapUTL();
      if((rOk && uOk) || tries<=0){
        clearInterval(iv);
        if(!RT.wrapped.UTLMutateSingle){ RT.error = RT.error || 'UTL_MISSING'; } // utl.js gerçekten yüklenemediyse
      }
    }, 250);

    try{ console.log('RT_AUDIT_READY version='+SVER); }catch(e){}
  });
})();
