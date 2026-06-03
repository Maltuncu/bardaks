/* Bardaks ERP — Batch Üretim Operasyon Motoru (companion)
   Mevcut koda dokunmaz. sb + CURRENT global'lerini kullanır.
   Backend: public.apply_batch_transition RPC (atomic, idempotent, per-row guard).
   Implements: batch engine + operator reality layer + reconciliation + realtime coalescing. */
(function(){
  'use strict';
  if(window.__UB_LOADED){ return; } window.__UB_LOADED = true;

  /* ---------- utils ---------- */
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  function waitFor(cond, cb, tries){ tries=(tries==null)?80:tries; if(cond()){cb();return;} if(tries<=0){console.warn('UB: sb/CURRENT yok');return;} setTimeout(function(){waitFor(cond,cb,tries-1);},250); }
  function uuid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);}); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function notify(t,b){ try{ if(typeof toast==='function'){ toast(t,b||''); return; } }catch(e){} }
  function $(id){ return document.getElementById(id); }
  function trDate(d){ if(!d) return ''; var p=String(d).slice(0,10).split('-'); return p[2]+'.'+p[1]; }

  var firmaMap = {};
  var SEL = {};            // order_id -> true
  var ORDERS = [];         // active orders cache
  var BUSY = false;        // a batch is in flight (PROCESSING/UNKNOWN) -> block second press
  var rtTimer = null;      // realtime debounce timer
  var rtChannel = null;
  var pendingUnknown = []; // batches awaiting reconciliation (offline tray)

  var REASON_TR = {
    already_in_target:'zaten o durumda', locked:'kilitli', deleted:'silinmiş',
    not_found:'bulunamadı', invalid_transition:'uygun değil', no_permission:'yetki yok'
  };
  var FROM_TO_LABEL = { 'bekleyen>uretimde':'Üretime Al', 'uretimde>hazir':'Hazır Yap' };

  ready(function(){
    waitFor(function(){ return typeof sb!=='undefined' && sb && typeof CURRENT!=='undefined' && CURRENT && CURRENT.rol; }, init);
  });

  function init(){
    try{
      if(['admin','mudur','imalathane'].indexOf(CURRENT.rol)<0) return;
      injectStyles(); injectUI(); subscribeRealtime();
      // crash recovery: re-enter UNKNOWN for any in-flight batch from a previous session
      try{ var saved=JSON.parse(localStorage.getItem('ub_inflight')||'[]'); if(saved.length){ pendingUnknown=saved; setTimeout(resolvePending,1500); } }catch(e){}
      window.addEventListener('online', resolvePending);
    }catch(e){ console.warn('UB init',e); }
  }

  /* ---------- styles ---------- */
  function injectStyles(){
    var css=''
    +'#ub-fab{position:fixed;left:18px;bottom:78px;z-index:9000;background:#1e5ba8;color:#fff;border:none;border-radius:30px;padding:12px 18px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}'
    +'#ub-ov{position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.55);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:14px}'
    +'#ub-ov.open{display:flex}'
    +'#ub-panel{background:#fff;color:#1a2b40;max-width:760px;width:100%;border-radius:14px;padding:16px;box-shadow:0 12px 44px rgba(0,0,0,.4);font-family:inherit}'
    +'#ub-panel h2{margin:0;font-size:18px}'
    +'.ub-x{float:right;background:none;border:none;color:#6b7b8f;font-size:24px;cursor:pointer;line-height:1}'
    +'.ub-bar{position:sticky;top:0;z-index:2;background:#e1ebf6;border-radius:10px;padding:10px 12px;margin:10px 0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
    +'.ub-bar.hide{display:none}'
    +'.ub-btn{background:#1e5ba8;color:#fff;border:none;border-radius:8px;padding:9px 13px;font-weight:700;cursor:pointer;font-size:13px}'
    +'.ub-btn.ok{background:#2e8b57}.ub-btn.sec{background:#eef2f7;color:#1a2b40;border:1px solid #d7e0ec}'
    +'.ub-btn[disabled]{opacity:.5;cursor:not-allowed}'
    +'.ub-grp{font-size:13px;font-weight:800;margin:14px 2px 6px;display:flex;align-items:center;gap:8px}'
    +'.ub-row{display:flex;align-items:center;gap:11px;padding:10px 8px;border:1px solid #e3d8ba;border-radius:10px;margin-bottom:7px;background:#fff;transition:.15s}'
    +'.ub-row.sel{border-color:#1e5ba8;background:#f4f8fd}'
    +'.ub-row.proc{border-color:#1e5ba8}'
    +'.ub-row.proc .ub-nm:after{content:" · işleniyor…";color:#1e5ba8;font-weight:600;animation:ubpulse 1s infinite}'
    +'.ub-row.done{border-color:#2e8b57;background:#f1faf5}'
    +'.ub-row.skip{border-color:#c8941a;background:#fdf8ec}'
    +'.ub-row.verify{border-color:#c8941a}'
    +'.ub-row.verify .ub-nm:after{content:" · doğrulanıyor…";color:#c8941a;font-weight:600}'
    +'@keyframes ubpulse{50%{opacity:.45}}'
    +'.ub-cb{width:20px;height:20px;accent-color:#1e5ba8;flex-shrink:0}'
    +'.ub-nm{flex:1;min-width:0;font-size:14px;font-weight:600}'
    +'.ub-sub{font-size:12px;color:#6b7b8f;font-weight:400}'
    +'.ub-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px}'
    +'.ub-tag.bek{background:#eef0f2;color:#6b7b8f}.ub-tag.ure{background:rgba(200,148,26,.16);color:#a9760f}.ub-tag.haz{background:rgba(30,91,168,.14);color:#1e5ba8}'
    +'.ub-chip{font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;background:#fdf8ec;color:#a9760f}'
    +'.ub-banner{border-radius:10px;padding:11px 13px;margin:10px 0;font-size:13px;font-weight:600}'
    +'.ub-banner.warn{background:#fdf8ec;color:#8a6212;border:1px solid #e8cf94}'
    +'.ub-banner.err{background:#fdecec;color:#a23;border:1px solid #efc2c2}'
    +'.ub-empty{text-align:center;color:#6b7b8f;padding:34px}';
    var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
  }

  /* ---------- UI shell ---------- */
  function injectUI(){
    var b=document.createElement('button'); b.id='ub-fab'; b.textContent='🏭 Batch Üretim';
    b.onclick=openBatch; document.body.appendChild(b);
    var o=document.createElement('div'); o.id='ub-ov'; o.innerHTML='<div id="ub-panel"></div>';
    o.addEventListener('click',function(e){ if(e.target===o) close(); });
    document.body.appendChild(o);
  }
  function close(){ $('ub-ov').classList.remove('open'); }

  async function ensureFirms(){
    try{ if(typeof FIRMALAR!=='undefined' && FIRMALAR && FIRMALAR.length){ FIRMALAR.forEach(function(f){firmaMap[f.id]=f.ad;}); return; } }catch(e){}
    try{ var r=await sb.from('firmalar').select('id,ad'); (r.data||[]).forEach(function(f){firmaMap[f.id]=f.ad;}); }catch(e){}
  }

  async function openBatch(){
    $('ub-ov').classList.add('open');
    $('ub-panel').innerHTML='<button class="ub-x" onclick="UB.close()">×</button><h2>🏭 Batch Üretim</h2>'
      +'<div class="ub-sub" style="margin-top:2px">Çoklu sipariş tek işlemde · seç ve tek tıkla durum geçir</div>'
      +'<div id="ub-banners"></div><div id="ub-bar" class="ub-bar hide"></div><div id="ub-list"><div class="ub-empty">Yükleniyor…</div></div>';
    SEL={};
    await ensureFirms();
    await loadActive();
  }

  async function loadActive(){
    var list=$('ub-list'); if(!list) return;
    try{
      var r=await sb.from('siparisler').select('id,firma_id,durum,teslim_tarihi,tarih,siparis_no,toplam_kdv_dahil')
        .in('durum',['bekleyen','uretimde']).eq('is_deleted',false)
        .order('teslim_tarihi',{ascending:true,nullsFirst:false}).limit(300);
      if(r.error) throw r.error;
      ORDERS=r.data||[];
      renderList();
    }catch(e){ list.innerHTML='<div class="ub-banner err">Liste yüklenemedi. Bağlantıyı kontrol et, tekrar aç.</div>'; }
  }

  function grpOf(s){
    var today=new Date().toISOString().slice(0,10);
    var yd=new Date(); yd.setDate(yd.getDate()+1); var yarin=yd.toISOString().slice(0,10);
    var t=(s.teslim_tarihi||s.tarih||'').slice(0,10);
    if(!t) return 'sonraki';
    if(t<today) return 'geciken'; if(t===today) return 'bugun'; if(t===yarin) return 'yarin'; return 'sonraki';
  }
  var GRP_LABEL={geciken:'🔴 GECİKEN',bugun:'📅 BUGÜN',yarin:'⏭️ YARIN',sonraki:'🗓️ SONRAKİ'};

  function renderList(){
    var list=$('ub-list'); if(!list) return;
    if(!ORDERS.length){ list.innerHTML='<div class="ub-empty">Bekleyen/üretimdeki sipariş yok ✓</div>'; renderBar(); return; }
    var groups={geciken:[],bugun:[],yarin:[],sonraki:[]};
    ORDERS.forEach(function(s){ groups[grpOf(s)].push(s); });
    var h='';
    ['geciken','bugun','yarin','sonraki'].forEach(function(g){
      var arr=groups[g]; if(!arr.length) return;
      h+='<div class="ub-grp">'+GRP_LABEL[g]+' ('+arr.length+') '
        +'<button class="ub-btn sec" style="font-size:11px;padding:4px 9px" onclick="UB.selGroup(\''+g+'\')">Tümünü seç</button></div>';
      arr.forEach(function(s){
        var tagCls=s.durum==='bekleyen'?'bek':(s.durum==='uretimde'?'ure':'haz');
        var tag=s.durum==='bekleyen'?'Bekleyen':(s.durum==='uretimde'?'Üretimde':'Hazır');
        h+='<div class="ub-row'+(SEL[s.id]?' sel':'')+'" id="ub-r-'+s.id+'" data-grp="'+g+'">'
          +'<input type="checkbox" class="ub-cb" '+(SEL[s.id]?'checked':'')+' onchange="UB.toggle(\''+s.id+'\',this.checked)">'
          +'<div class="ub-nm">'+esc(firmaMap[s.firma_id]||'—')+'<div class="ub-sub">'+esc(s.siparis_no||'')+' · teslim '+trDate(s.teslim_tarihi||s.tarih)+'</div></div>'
          +'<span class="ub-tag '+tagCls+'">'+tag+'</span></div>';
      });
    });
    list.innerHTML=h; renderBar();
  }

  function selectedIds(){ return Object.keys(SEL).filter(function(k){return SEL[k];}); }

  function renderBar(){
    var bar=$('ub-bar'); if(!bar) return;
    var ids=selectedIds();
    if(!ids.length || BUSY){ bar.classList.add('hide'); if(BUSY) renderBusyBar(bar,ids); return; }
    bar.classList.remove('hide');
    bar.innerHTML='<b>'+ids.length+' seçili</b>'
      +'<div style="flex:1"></div>'
      +'<button class="ub-btn" onclick="UB.run(\'bekleyen\',\'uretimde\')">▶ Üretime Al</button>'
      +'<button class="ub-btn ok" onclick="UB.run(\'uretimde\',\'hazir\')">✓ Hazır Yap</button>'
      +'<button class="ub-btn sec" onclick="UB.clearSel()">Temizle</button>';
  }
  function renderBusyBar(bar,ids){
    bar.classList.remove('hide');
    bar.innerHTML='<b>'+ids.length+' işleniyor…</b><div style="flex:1"></div><button class="ub-btn" disabled>Gönderiliyor…</button>';
  }

  /* ---------- selection ---------- */
  function toggle(id,on){ if(BUSY) return; SEL[id]=!!on; var row=$('ub-r-'+id); if(row) row.classList.toggle('sel',!!on); renderBar(); }
  function selGroup(g){ if(BUSY) return; ORDERS.forEach(function(s){ if(grpOf(s)===g) SEL[s.id]=true; }); renderList(); }
  function clearSel(){ if(BUSY) return; SEL={}; renderList(); }

  /* ---------- batch engine (operator reality layer) ---------- */
  function deriveKey(actor,from,to,ids,batchId){ return actor+'|'+from+'>'+to+'|'+ids.slice().sort().join(',')+'|'+batchId; }

  async function run(from,to){
    if(BUSY) return;
    var ids=selectedIds();
    if(!ids.length){ banner('warn','Önce en az bir sipariş seç.'); return; }
    var batchId=uuid();
    var key=deriveKey(CURRENT.id||CURRENT.auth_id||'a',from,to,ids,batchId);
    BUSY=true; clearBanner();
    ids.forEach(function(id){ var r=$('ub-r-'+id); if(r){ r.classList.add('proc'); r.classList.remove('sel'); } });
    renderBar();
    persistInflight({batchId:batchId,key:key,ids:ids,from:from,to:to});

    try{
      var res=await withTimeout(sb.rpc('apply_batch_transition',{
        p_batch_id:batchId, p_idempotency_key:key, p_order_ids:ids, p_from:from, p_to:to
      }), 13000);
      if(res.error) throw res.error;
      clearInflight(batchId);
      applyResult(res.data, from, to);
    }catch(e){
      // ack lost / network / timeout -> UNKNOWN (never assume failure)
      enterUnknown({batchId:batchId,key:key,ids:ids,from:from,to:to});
    }
  }

  function withTimeout(p,ms){ return Promise.race([p, new Promise(function(_,rej){ setTimeout(function(){rej(new Error('timeout'));},ms); })]); }

  function applyResult(data,from,to){
    BUSY=false;
    if(!data){ banner('err','Beklenmeyen yanıt. Liste yenileniyor.'); finishBatch(); return; }
    var status=data.status, counts=data.counts||{}, items=data.items||[];
    var actLabel=FROM_TO_LABEL[from+'>'+to]||to;

    if(status==='completed'){
      markRows(items);
      notify('✅ '+(counts.applied||0)+' sipariş '+actLabel.toLowerCase()+'ndi','');
      banner('warn','', true);
      setTimeout(finishBatch, 900);
      return;
    }
    if(status==='partial'){
      markRows(items);
      banner('warn','✓ '+(counts.applied||0)+' işlendi · '+(counts.skipped||0)+' atlandı. Atlananların nedeni satırlarda gösteriliyor.');
      setTimeout(finishBatch, 2200);
      return;
    }
    // failed
    if(data.reason==='no_permission'){
      banner('err','Bu işlem için yetkin yok ('+(CURRENT.rol)+'). İmalathane yalnızca üretime alma ve hazır yapma yapabilir.');
    } else {
      markRows(items);
      var why=summarizeSkips(items);
      banner('err','Hiçbir sipariş ilerletilemedi. '+(why||'Seçilen siparişler bu adıma uygun değil.')+' İstersen seçimi düzeltip tekrar dene.');
    }
    BUSY=false;
    setTimeout(finishBatch, 2600);
  }

  function summarizeSkips(items){
    var m={}; (items||[]).forEach(function(it){ if(it.outcome!=='applied'){ m[it.reason]=(m[it.reason]||0)+1; } });
    var parts=Object.keys(m).map(function(r){ return m[r]+' '+( REASON_TR[r]||r ); });
    return parts.length?('Neden: '+parts.join(', ')+'.'):'';
  }

  function markRows(items){
    (items||[]).forEach(function(it){
      var row=$('ub-r-'+it.order_id); if(!row) return;
      row.classList.remove('proc');
      if(it.outcome==='applied'){ row.classList.add('done'); }
      else {
        row.classList.add('skip');
        var nm=row.querySelector('.ub-nm');
        if(nm && !row.querySelector('.ub-chip')){ var c=document.createElement('span'); c.className='ub-chip'; c.textContent=REASON_TR[it.reason]||it.reason; row.appendChild(c); }
      }
    });
  }

  function finishBatch(){ SEL={}; BUSY=false; loadActive(); }

  /* ---------- UNKNOWN state + reconciliation ---------- */
  function enterUnknown(b){
    BUSY=true;
    b.ids.forEach(function(id){ var r=$('ub-r-'+id); if(r){ r.classList.remove('proc'); r.classList.add('verify'); } });
    if(navigator.onLine===false){
      banner('warn','Bağlantı yok. Sonuç bağlantı gelince doğrulanacak — verin güvende, hiçbir şey kaybolmadı.');
    } else {
      banner('warn','Bağlantı kesildi, sonuç doğrulanıyor — verin güvende.');
      reconcile(b, 0);
    }
  }

  async function reconcile(b, attempt){
    if(attempt>6){ // give up active polling; keep parked for online event
      banner('warn','Sonuç henüz doğrulanamadı. Bağlantı gelince otomatik tamamlanacak — verin güvende.');
      return;
    }
    try{
      var r=await sb.from('batch_records').select('status,counts,items').eq('batch_id', b.batchId).maybeSingle();
      if(r.data){ // server has the truth
        clearInflight(b.batchId);
        BUSY=false;
        applyResult({status:r.data.status, counts:r.data.counts, items:r.data.items}, b.from, b.to);
        return;
      }
      // not found yet -> either never committed or in-flight; safe to resend SAME key (idempotent)
      if(attempt===2){
        try{
          var res=await withTimeout(sb.rpc('apply_batch_transition',{
            p_batch_id:b.batchId, p_idempotency_key:b.key, p_order_ids:b.ids, p_from:b.from, p_to:b.to
          }), 12000);
          if(!res.error && res.data){ clearInflight(b.batchId); BUSY=false; applyResult(res.data,b.from,b.to); return; }
        }catch(e){}
      }
      setTimeout(function(){ reconcile(b, attempt+1); }, 2200);
    }catch(e){
      setTimeout(function(){ reconcile(b, attempt+1); }, 2500);
    }
  }

  function persistInflight(b){ pendingUnknown=pendingUnknown.filter(function(x){return x.batchId!==b.batchId;}); pendingUnknown.push(b); save(); }
  function clearInflight(id){ pendingUnknown=pendingUnknown.filter(function(x){return x.batchId!==id;}); save(); }
  function save(){ try{ localStorage.setItem('ub_inflight', JSON.stringify(pendingUnknown)); }catch(e){} }
  function resolvePending(){ pendingUnknown.slice().forEach(function(b){ reconcile(b,0); }); }

  /* ---------- banners ---------- */
  function banner(kind,msg,clear){ var c=$('ub-banners'); if(!c) return; if(clear){ c.innerHTML=''; return; } if(!msg){ c.innerHTML=''; return; } c.innerHTML='<div class="ub-banner '+kind+'">'+esc(msg)+'</div>'; }
  function clearBanner(){ var c=$('ub-banners'); if(c) c.innerHTML=''; }

  /* ---------- realtime (coalesced, single render) ---------- */
  function subscribeRealtime(){
    try{
      rtChannel=sb.channel('ub-uretim-rt').on('postgres_changes',{event:'*',schema:'public',table:'siparisler'},function(){
        if(!$('ub-ov')||!$('ub-ov').classList.contains('open')) return;
        if(BUSY) return; // our own batch echoes are ignored; we refresh on confirm
        if(rtTimer) clearTimeout(rtTimer);
        rtTimer=setTimeout(function(){ loadActive(); }, 280); // debounce window 280ms -> one refetch
      }).subscribe();
    }catch(e){ console.warn('UB rt',e); }
  }

  /* ---------- public ---------- */
  window.UB={ close:close, toggle:toggle, selGroup:selGroup, clearSel:clearSel, run:run };
})();

/* === UTL + index_bridge.js yükleyici (PRE-4B.5R: utl.js index_bridge'den ÖNCE) ===
   index.html runtime'da window.UTL yoktu -> index_bridge override'ları kurulamıyordu (UTL_MISSING).
   Fix: index_bridge.js'i ancak utl.js yüklendikten SONRA enjekte et. Sıra garanti, double-load guard'lı.
   4B.5B1A cache-bust: index_bridge.js?v=… ile per-client browser-cache non-determinism giderildi.
   utl.js client() mevcut sayfa 'sb'sini paylaşır (auth/RLS regresyonu yok). rapor.html bu yoldan etkilenmez. */
(function(){
  try{
    if(document.querySelector('script[data-ib]')) return;           // index_bridge zaten kuyrukta/yüklü
    function loadIB(){
      if(document.querySelector('script[data-ib]')) return;         // çift enjeksiyon guard
      var b=document.createElement('script'); b.src='index_bridge.js?v=4B.5B1A-25d00de'; b.setAttribute('data-ib','1'); document.body.appendChild(b);
    }
    if(window.UTL && window.UTL.mutate){ loadIB(); return; }         // UTL zaten varsa direkt IB
    var existing=document.querySelector('script[data-utl]');         // utl.js zaten enjekte edildiyse onload'ını bekle
    if(existing){ existing.addEventListener('load',loadIB); existing.addEventListener('error',loadIB); return; }
    var u=document.createElement('script'); u.src='utl.js'; u.setAttribute('data-utl','1');
    u.onload=loadIB; u.onerror=loadIB;                              // utl.js düşse bile IB yine yüklenir (eski UTL_MISSING davranışı korunur; regresyon yok)
    document.body.appendChild(u);
  }catch(e){
    try{ if(!document.querySelector('script[data-ib]')){ var b=document.createElement('script'); b.src='index_bridge.js?v=4B.5B1A-25d00de'; b.setAttribute('data-ib','1'); document.body.appendChild(b); } }catch(e2){}
  }
})();

/* === finguard.js (4F.0/4F.1) yükleyici — legacy/import firma bakiye/alacak UI redaksiyonu === */
(function(){ try{ if(document.querySelector('script[data-fg]')) return; var s=document.createElement('script'); s.src='finguard.js?v=4F.1-001'; s.setAttribute('data-fg','1'); document.body.appendChild(s); }catch(e){} })();

/* === ux_polish.css (UX-1B/4F.1) yükleyici — companion görsel cila (CSS-only) === */
(function(){ try{ if(document.querySelector('link[data-uxp]')) return; var l=document.createElement('link'); l.rel='stylesheet'; l.href='ux_polish.css?v=4f1-001'; l.setAttribute('data-uxp','1'); document.head.appendChild(l); }catch(e){} })();
