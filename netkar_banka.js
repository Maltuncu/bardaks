/* Bardaks B2B — Net Kâr V2 + Banka/Kasa eklenti modülü (companion)
   Mevcut koda dokunmaz. Sadece sb + CURRENT global'lerini kullanır.
   admin/müdür için sağ-alt köşede "💰 Net & Banka" butonu açar. */
(function(){
  'use strict';
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  function waitFor(cond, cb, tries){
    tries = (tries==null)?60:tries;
    if(cond()){ cb(); return; }
    if(tries<=0){ console.warn('NB: sb/CURRENT bulunamadı'); return; }
    setTimeout(function(){ waitFor(cond, cb, tries-1); }, 250);
  }
  function fmt(n){ return (Number(n)||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₺'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function notify(m){ try{ if(typeof toast==='function'){ toast('✅ '+m,''); return; } }catch(e){} alert(m); }

  var firmaMap={}, curTab='netkar';

  ready(function(){
    waitFor(function(){ return typeof sb!=='undefined' && sb && typeof CURRENT!=='undefined' && CURRENT && CURRENT.rol; }, init);
  });

  function init(){
    try{
      if(CURRENT.rol!=='admin' && CURRENT.rol!=='mudur') return; // imalathane finansal görmez
      injectStyles(); injectUI();
    }catch(e){ console.warn('NB init', e); }
  }

  function injectStyles(){
    var css=''
    +'#nb-fab{position:fixed;right:18px;bottom:18px;z-index:9000;background:#16a34a;color:#fff;border:none;border-radius:30px;padding:12px 18px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}'
    +'#nb-ov{position:fixed;inset:0;z-index:9001;background:rgba(0,0,0,.6);display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:18px}'
    +'#nb-ov.open{display:flex}'
    +'#nb-panel{background:#0f172a;color:#e2e8f0;max-width:860px;width:100%;border-radius:14px;padding:18px;box-shadow:0 12px 44px rgba(0,0,0,.55);font-family:inherit}'
    +'#nb-panel h2{margin:0;font-size:18px}'
    +'.nb-tabs{display:flex;gap:8px;margin:12px 0}'
    +'.nb-tab{flex:1;padding:10px;border-radius:8px;background:#1e293b;text-align:center;cursor:pointer;font-weight:600;font-size:13px}'
    +'.nb-tab.active{background:#16a34a;color:#fff}'
    +'.nb-card{background:#1e293b;border-radius:10px;padding:12px;margin-bottom:8px}'
    +'.nb-row{display:flex;justify-content:space-between;align-items:center;gap:8px}'
    +'.nb-btn{background:#16a34a;color:#fff;border:none;border-radius:8px;padding:8px 12px;font-weight:600;cursor:pointer;font-size:13px}'
    +'.nb-btn.sec{background:#334155}.nb-btn.sm{padding:5px 9px;font-size:12px}'
    +'.nb-input,.nb-sel{width:100%;padding:9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;margin:4px 0;font-size:13px;box-sizing:border-box}'
    +'.nb-dim{color:#94a3b8;font-size:12px}.nb-pos{color:#22c55e}.nb-neg{color:#ef4444}'
    +'.nb-pill{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;background:#334155}'
    +'.nb-close{float:right;background:none;border:none;color:#94a3b8;font-size:24px;cursor:pointer;line-height:1}';
    var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
  }

  function injectUI(){
    var b=document.createElement('button'); b.id='nb-fab'; b.textContent='💰 Net & Banka';
    b.onclick=open; document.body.appendChild(b);
    var o=document.createElement('div'); o.id='nb-ov'; o.innerHTML='<div id="nb-panel"></div>';
    o.addEventListener('click',function(e){ if(e.target===o) close(); });
    document.body.appendChild(o);
  }

  function open(){ document.getElementById('nb-ov').classList.add('open'); render('netkar'); }
  function close(){ document.getElementById('nb-ov').classList.remove('open'); }

  function render(tab){
    curTab=tab||curTab;
    document.getElementById('nb-panel').innerHTML=
      '<button class="nb-close" onclick="NB.close()">×</button>'
      +'<h2>💰 Net Kâr & Banka</h2><div class="nb-dim">Gerçek net kâr + kasa/banka mutabakatı</div>'
      +'<div class="nb-tabs"><div class="nb-tab '+(curTab==='netkar'?'active':'')+'" onclick="NB.tab(\'netkar\')">Net Kâr / Ek Maliyet</div>'
      +'<div class="nb-tab '+(curTab==='banka'?'active':'')+'" onclick="NB.tab(\'banka\')">Banka & Kasa</div></div>'
      +'<div id="nb-body" class="nb-dim">Yükleniyor…</div>';
    if(curTab==='netkar') loadNetKar(); else loadBanka();
  }

  async function ensureFirms(){
    if(Object.keys(firmaMap).length) return;
    try{ var r=await sb.from('firmalar').select('id,ad'); (r.data||[]).forEach(function(f){ firmaMap[f.id]=f.ad; }); }catch(e){}
  }

  async function loadNetKar(){
    var body=document.getElementById('nb-body'); await ensureFirms();
    try{
      var r=await sb.from('siparisler').select('id,firma_id,durum,brut_kar,net_kar').eq('is_deleted',false).limit(80);
      var sip=r.data||[];
      if(r.error) throw r.error;
      if(!sip.length){ body.innerHTML='<div class="nb-dim">Sipariş yok</div>'; return; }
      body.innerHTML=sip.map(function(s){
        var net=Number(s.net_kar)||0, brut=Number(s.brut_kar)||0, fark=brut-net;
        return '<div class="nb-card"><div class="nb-row"><div><b>'+esc(firmaMap[s.firma_id]||'—')+'</b> <span class="nb-pill">'+esc(s.durum||'')+'</span></div>'
          +'<button class="nb-btn sm" onclick="NB.ek(\''+s.id+'\')">+ Ek Maliyet</button></div>'
          +'<div class="nb-row" style="margin-top:6px"><span class="nb-dim">Brüt: '+fmt(brut)+'</span>'
          +'<span class="'+(net>=0?'nb-pos':'nb-neg')+'"><b>Net: '+fmt(net)+'</b></span></div>'
          +(fark>0?'<div class="nb-dim">Ek maliyet: −'+fmt(fark)+'</div>':'')+'</div>';
      }).join('');
    }catch(e){ body.innerHTML='<div class="nb-neg">Hata: '+esc(e.message||e)+'</div>'; }
  }

  async function ek(sid){
    var body=document.getElementById('nb-body');
    var list=[];
    try{ var r=await sb.from('siparis_ek_maliyet').select('*').eq('siparis_id',sid).eq('is_deleted',false); list=r.data||[]; }catch(e){}
    body.innerHTML='<button class="nb-btn sec sm" onclick="NB.tab(\'netkar\')">‹ Geri</button>'
      +'<div class="nb-card" style="margin-top:8px"><b>Ek Maliyet Ekle</b>'
      +'<select class="nb-sel" id="nb-tip"><option value="kargo">Kargo</option><option value="komisyon">Komisyon</option><option value="iskonto">İskonto</option><option value="promosyon">Promosyon</option><option value="iade">İade</option><option value="fire">Fire</option></select>'
      +'<input class="nb-input" id="nb-tutar" type="number" placeholder="Tutar ₺">'
      +'<input class="nb-input" id="nb-acik" placeholder="Açıklama (opsiyonel)">'
      +'<button class="nb-btn" onclick="NB.saveEk(\''+sid+'\')">Kaydet</button></div>'
      +(list.length?'<div class="nb-card"><b>Mevcut Ek Maliyetler</b>'+list.map(function(x){return '<div class="nb-row" style="margin-top:6px"><span>'+esc(x.tip)+(x.aciklama?' · '+esc(x.aciklama):'')+'</span><span class="nb-neg">−'+fmt(x.tutar)+' <button class="nb-btn sec sm" onclick="NB.delEk(\''+x.id+'\',\''+sid+'\')">Sil</button></span></div>';}).join('')+'</div>':'');
  }

  async function saveEk(sid){
    var tip=document.getElementById('nb-tip').value;
    var tutar=parseFloat(document.getElementById('nb-tutar').value);
    var acik=document.getElementById('nb-acik').value||null;
    if(!(tutar>0)){ alert('Geçerli bir tutar gir'); return; }
    var r=await sb.from('siparis_ek_maliyet').insert({siparis_id:sid,tip:tip,tutar:tutar,aciklama:acik,created_by:(CURRENT.ad_soyad||'')});
    if(r.error){ alert('Hata: '+r.error.message); return; }
    notify('Ek maliyet eklendi'); ek(sid);
  }
  async function delEk(id,sid){
    var r=await sb.from('siparis_ek_maliyet').update({is_deleted:true,deleted_by:(CURRENT.ad_soyad||''),deleted_at:new Date().toISOString()}).eq('id',id);
    if(r.error){ alert('Hata: '+r.error.message); return; }
    notify('Silindi'); ek(sid);
  }

  async function loadBanka(){
    var body=document.getElementById('nb-body'); await ensureFirms();
    try{
      var rb=await sb.from('hesap_bakiye').select('*'); if(rb.error) throw rb.error;
      var hesaplar=rb.data||[];
      var esle=[]; try{ var re=await sb.from('eslesmeyen_tahsilatlar').select('*').limit(40); esle=re.data||[]; }catch(e){}
      body.innerHTML=
        '<div class="nb-row"><b>Hesaplar</b><button class="nb-btn sm" onclick="NB.addHesap()">+ Hesap</button></div>'
        +(hesaplar.length?hesaplar.map(function(h){return '<div class="nb-card"><div class="nb-row"><div><b>'+esc(h.ad)+'</b> <span class="nb-pill">'+esc(h.tip)+'</span></div><b>'+fmt(h.bakiye)+'</b></div><div style="margin-top:6px"><button class="nb-btn sm" onclick="NB.addHar(\''+h.id+'\',\''+esc(h.ad).replace(/&#39;/g,"\\u0027")+'\')">+ Hareket</button></div></div>';}).join(''):'<div class="nb-dim">Hesap yok — "+ Hesap" ile ekle</div>')
        +'<div style="margin-top:14px"><b>Eşleşmeyen Tahsilatlar</b> <span class="nb-dim">(banka/kasa hareketi bulunmayan)</span></div>'
        +(esle.length?esle.map(function(t){return '<div class="nb-card nb-row"><span>'+esc(firmaMap[t.firma_id]||'—')+' · '+esc(t.tarih||'')+'</span><span class="nb-neg">'+fmt(t.tutar)+'</span></div>';}).join(''):'<div class="nb-dim">Eşleşmeyen tahsilat yok ✓</div>');
    }catch(e){ body.innerHTML='<div class="nb-neg">Hata: '+esc(e.message||e)+'</div>'; }
  }

  async function addHesap(){
    var ad=prompt('Hesap adı (örn. İş Bankası, POS-1):'); if(!ad) return;
    var tip=(prompt('Tip: kasa / banka / pos','banka')||'').trim().toLowerCase();
    if(['kasa','banka','pos'].indexOf(tip)<0){ alert('Tip kasa/banka/pos olmalı'); return; }
    var acilis=parseFloat(prompt('Açılış bakiyesi (₺):','0'))||0;
    var r=await sb.from('accounts').insert({ad:ad,tip:tip,acilis_bakiye:acilis,created_by:(CURRENT.ad_soyad||'')});
    if(r.error){ alert('Hata: '+r.error.message); return; }
    notify('Hesap eklendi'); loadBanka();
  }
  async function addHar(accId,accAd){
    var tip=(prompt('Hareket tipi: gelir / gider / tahsilat / odeme / transfer','tahsilat')||'').trim().toLowerCase();
    if(['gelir','gider','transfer','tahsilat','odeme'].indexOf(tip)<0){ alert('Geçersiz tip'); return; }
    var tutar=parseFloat(prompt('Tutar (₺):')); if(!(tutar>0)){ alert('Geçerli tutar gir'); return; }
    var acik=prompt('Açıklama (opsiyonel):','')||null;
    var yon=(tip==='gelir'||tip==='tahsilat')?1:-1;
    var r=await sb.from('financial_transactions').insert({account_id:accId,tip:tip,yon:yon,tutar:tutar,aciklama:acik,created_by:(CURRENT.ad_soyad||'')});
    if(r.error){ alert('Hata: '+r.error.message); return; }
    notify('Hareket eklendi ('+accAd+')'); loadBanka();
  }

  window.NB={ close:close, tab:render, ek:ek, saveEk:saveEk, delEk:delEk, addHesap:addHesap, addHar:addHar };
})();
