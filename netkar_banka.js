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
      if(CURRENT.rol!=='admin' && CURRENT.rol!=='mudur') return;
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

/* === Auth UX katmanı (companion): mail hatirla + sifremi unuttum + recovery === */
(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  var isRecovery = /type=recovery/.test(location.hash || '');
  var coreReloaded=false;

  function reloadCore(){
    try{
      if(typeof loadCoreData!=='function') return;
      loadCoreData().then(function(){
        try{
          if(typeof CURRENT==='undefined' || !CURRENT || typeof showPage!=='function') return;
          var a=document.querySelector('.nav-item.active');
          var pid=a?a.getAttribute('data-page'):(CURRENT.rol==='imalathane'?'uretim':'panel');
          showPage(pid);
        }catch(e){}
      });
    }catch(e){}
  }
  function hookAuth(tries){
    tries = (tries==null)?60:tries;
    if(typeof sb==='undefined' || !sb || !sb.auth){ if(tries>0) setTimeout(function(){hookAuth(tries-1);},200); return; }
    try{
      sb.auth.onAuthStateChange(function(event, session){
        if(event==='PASSWORD_RECOVERY'){ showRecovery(); }
        if(event==='SIGNED_IN' && session && session.user){
          if(session.user.email){ try{ localStorage.setItem('bardaks_last_email', session.user.email); }catch(e){} }
          if(!coreReloaded){ coreReloaded=true; setTimeout(reloadCore, 700); }
        }
      });
    }catch(e){ if(tries>0) setTimeout(function(){hookAuth(tries-1);},200); }
  }
  hookAuth();

  ready(function(){
    try{
      var le = localStorage.getItem('bardaks_last_email');
      var ei = $('emailInput');
      if(le && ei && !ei.value){ ei.value = le; var pi=$('passInput'); if(pi) setTimeout(function(){ try{pi.focus();}catch(e){} },80); }
    }catch(e){}
    var card = document.querySelector('#login .login-card');
    if(card && !$('nbForgot')){
      var d=document.createElement('div'); d.style.cssText='text-align:center;margin-top:10px';
      d.innerHTML='<a href="#" id="nbForgot" style="font-size:13px;color:#1e5ba8;text-decoration:none">Sifremi unuttum</a>';
      card.appendChild(d);
      $('nbForgot').addEventListener('click', function(e){ e.preventDefault(); forgot(); });
    }
    if(isRecovery) showRecovery();
  });

  async function forgot(){
    var ei=$('emailInput'), err=$('loginError');
    var email = ei ? ei.value.trim() : '';
    if(!email){ if(err){ err.style.color='#c0392b'; err.textContent='Once e-postani yaz, sonra "Sifremi unuttum"a bas'; } return; }
    if(err){ err.style.color='#6b7b8f'; err.textContent='Baglanti gonderiliyor...'; }
    try{
      var r=await sb.auth.resetPasswordForEmail(email,{ redirectTo: location.origin + location.pathname });
      if(r.error) throw r.error;
      if(err){ err.style.color='#2e8b57'; err.textContent=email+' adresine sifirlama baglantisi gonderildi. Mailindeki linke tikla.'; }
    }catch(e){ if(err){ err.style.color='#c0392b'; err.textContent='Hata: '+(e.message||e); } }
  }

  function showRecovery(){
    if($('nbRecovery')){ $('nbRecovery').style.display='flex'; return; }
    var ov=document.createElement('div'); ov.id='nbRecovery';
    ov.style.cssText='position:fixed;inset:0;z-index:99999;background:radial-gradient(ellipse at top,#fff,#faf3df 70%);display:flex;align-items:center;justify-content:center;padding:20px;font-family:inherit';
    ov.innerHTML='<div style="background:#fff;border:1px solid #e3d8ba;border-radius:12px;padding:28px;width:100%;max-width:360px;box-shadow:0 4px 20px rgba(30,91,168,.12)">'
      +'<h2 style="font-size:18px;margin:0 0 6px;color:#1a2b40">Yeni Sifre Belirle</h2>'
      +'<div style="font-size:13px;color:#6b7b8f;margin-bottom:14px">Hesabin icin yeni bir sifre gir.</div>'
      +'<input type="password" id="nbP1" placeholder="Yeni sifre (en az 6)" style="width:100%;padding:11px 13px;border:1px solid #e3d8ba;border-radius:9px;margin-bottom:8px;box-sizing:border-box;font-size:15px">'
      +'<input type="password" id="nbP2" placeholder="Tekrar" style="width:100%;padding:11px 13px;border:1px solid #e3d8ba;border-radius:9px;box-sizing:border-box;font-size:15px">'
      +'<button id="nbSave" style="width:100%;margin-top:14px;background:#1e5ba8;color:#fff;border:none;font-weight:700;padding:12px;border-radius:9px;cursor:pointer;font-size:14px">Kaydet</button>'
      +'<div id="nbRErr" style="text-align:center;margin-top:12px;font-size:13px"></div></div>';
    document.body.appendChild(ov);
    $('nbSave').addEventListener('click', saveNewPass);
    $('nbP2').addEventListener('keydown', function(e){ if(e.key==='Enter') saveNewPass(); });
  }

  async function saveNewPass(){
    var p1=$('nbP1').value, p2=$('nbP2').value, err=$('nbRErr');
    if((p1||'').length<6){ err.style.color='#c0392b'; err.textContent='En az 6 karakter'; return; }
    if(p1!==p2){ err.style.color='#c0392b'; err.textContent='Sifreler uyusmuyor'; return; }
    try{
      var r=await sb.auth.updateUser({ password:p1 });
      if(r.error) throw r.error;
      err.style.color='#2e8b57'; err.textContent='Sifre guncellendi, yonlendiriliyorsun...';
      setTimeout(function(){ location.href = location.origin + location.pathname; }, 1200);
    }catch(e){ err.style.color='#c0392b'; err.textContent='Hata: '+(e.message||e); }
  }
})();

/* === Sipariş Esnek + Firma Yönetim Overlay === */
(function(){
  'use strict';
  function waitApp(cb,t){ t=t||80; if(typeof openYeniSiparis==='function'&&typeof URUNLER!=='undefined') cb(); else if(t>0) setTimeout(function(){waitApp(cb,t-1);},200); }
  waitApp(function(){

    window.ysLoadUrunler = function(){
      var fid = document.getElementById('ysFirma').value;
      var fiyatlar = (typeof FIYATLAR!=='undefined'?FIYATLAR:[]).filter(function(p){return p.firma_id===fid;});
      var manuals = (window.ysSatirlar||[]).filter(function(s){return s._manual;});
      window.ysSatirlar = fiyatlar.map(function(p){
        return {urun_id:p.urun_id, ad:p.urun_ad, fiyat:p.birim_fiyat_kdv_haric, kdv:p.kdv_orani, adet:0};
      }).concat(manuals);
      ysRenderSatirlar();
    };

    window.ysRenderSatirlar = function(){
      var c=document.getElementById('ysUrunler'); if(!c) return;
      var rows=window.ysSatirlar;
      c.innerHTML = '<label style="display:flex;justify-content:space-between;align-items:center">Ürünler <button class="btn btn-sec btn-sm" onclick="ysEklePanel()" style="font-size:12px">➕ Ürün Ekle</button></label>'
        + (rows.length ? rows.map(function(s,i){
          return '<div class="flex-between" style="padding:7px 0;border-bottom:1px solid var(--border)">'
            +'<div style="flex:1"><div style="font-size:14px">'+(s.ad||'?')+(s._manual?' <span style="font-size:10px;color:var(--accent)">yeni</span>':'')+'</div>'
            +'<div style="font-size:12px;color:var(--text-dim)">'+(typeof TL==='function'?TL(s.fiyat):s.fiyat)+'/br · KDV %'+(s.kdv||1)+'</div></div>'
            +'<input type="number" min="0" style="width:66px;text-align:center" value="'+(s.adet||0)+'" oninput="ysSatirlar['+i+'].adet=Number(this.value)||0;ysHesap()">'
            +'<button onclick="ysSilSatir('+i+')" style="margin-left:4px;background:none;border:none;color:#e05c5c;font-size:18px;cursor:pointer;padding:2px 6px">✕</button></div>';
        }).join('') : '<div style="padding:12px;color:var(--text-dim);text-align:center">Ürün yok. ➕ ile ekle.</div>');
      ysHesap();
    };

    window.ysSilSatir = function(i){ window.ysSatirlar.splice(i,1); ysRenderSatirlar(); };

    window.ysEklePanel = function(){
      if(document.getElementById('ysAddPnl')) return;
      var urunOpts = (typeof URUNLER!=='undefined'?URUNLER:[]).filter(function(u){return u.aktif!==false;}).map(function(u){
        return '<option value="'+u.id+'" data-ad="'+u.ad+'" data-fiyat="'+(u.varsayilan_fiyat||0)+'" data-kdv="'+(u.kdv_orani||1)+'">'+u.ad+'</option>';
      }).join('');
      var h = '<div id="ysAddPnl" style="background:var(--surface2,#1f232c);border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:10px">'
        +'<div style="font-weight:700;font-size:14px;margin-bottom:8px">Ürün Ekle</div>'
        +'<select id="ysKatSec" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;margin-bottom:6px" onchange="ysKatDoldur()"><option value="">— Katalogdan seç —</option>'+urunOpts+'</select>'
        +'<input id="ysYeniAd" placeholder="Ürün adı (serbest)" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;margin-bottom:4px;box-sizing:border-box">'
        +'<div style="display:flex;gap:6px"><input id="ysYeniFiyat" type="number" step="0.01" placeholder="Birim fiyat" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;box-sizing:border-box">'
        +'<input id="ysYeniKdv" type="number" value="1" placeholder="KDV %" style="width:60px;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;box-sizing:border-box"></div>'
        +'<div style="display:flex;gap:6px;margin-top:8px"><button class="btn btn-sm" onclick="ysEkleOnayla()" style="flex:1">Ekle</button>'
        +'<button class="btn btn-sec btn-sm" onclick="document.getElementById(\'ysAddPnl\').remove()" style="flex:1">İptal</button></div></div>';
      var c=document.getElementById('ysUrunler'); if(c) c.insertAdjacentHTML('beforeend',h);
    };

    window.ysKatDoldur = function(){
      var sel=document.getElementById('ysKatSec'); if(!sel||!sel.value) return;
      var o=sel.options[sel.selectedIndex];
      var ai=document.getElementById('ysYeniAd'), fi=document.getElementById('ysYeniFiyat'), ki=document.getElementById('ysYeniKdv');
      if(ai) ai.value=o.getAttribute('data-ad')||'';
      if(fi) fi.value=o.getAttribute('data-fiyat')||'';
      if(ki) ki.value=o.getAttribute('data-kdv')||'1';
    };

    window.ysEkleOnayla = function(){
      var sel=document.getElementById('ysKatSec');
      var ad=(document.getElementById('ysYeniAd')||{}).value||'';
      var fiyat=parseFloat((document.getElementById('ysYeniFiyat')||{}).value)||0;
      var kdv=parseFloat((document.getElementById('ysYeniKdv')||{}).value)||1;
      var uid=sel&&sel.value?sel.value:null;
      if(!ad.trim()){ alert('Ürün adı gir'); return; }
      if(fiyat<=0){ alert('Fiyat gir'); return; }
      if(window.ysSatirlar.some(function(s){return s.ad===ad.trim();})){ alert(ad+' zaten listede'); return; }
      window.ysSatirlar.push({urun_id:uid, ad:ad.trim(), fiyat:fiyat, kdv:kdv, adet:1, _manual:true});
      var pnl=document.getElementById('ysAddPnl'); if(pnl) pnl.remove();
      ysRenderSatirlar();
    };

    // ── Firma Yönetim: uygulama içi tam ekran overlay ──
    if(typeof CURRENT!=='undefined' && CURRENT && (CURRENT.rol==='admin'||CURRENT.rol==='mudur')){
      var rs=document.createElement('style');
      rs.textContent='#rapor-ov{position:fixed;inset:0;z-index:9500;background:#0f1115;display:none;flex-direction:column}'
        +'#rapor-ov.open{display:flex}'
        +'#rapor-ov .ro-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#181b22;border-bottom:1px solid #2a2f3a;flex-shrink:0}'
        +'#rapor-ov .ro-bar b{font-size:16px;color:#d4a04f}'
        +'#rapor-ov .ro-x{background:none;border:none;color:#e8eaed;font-size:22px;cursor:pointer;padding:4px 10px}'
        +'#rapor-ov iframe{flex:1;border:none;width:100%;background:#0f1115}';
      document.head.appendChild(rs);

      var rov=document.createElement('div'); rov.id='rapor-ov';
      rov.innerHTML='<div class="ro-bar"><b>📄 Firma Yönetim</b><button class="ro-x" onclick="document.getElementById(\'rapor-ov\').classList.remove(\'open\')">✕ Kapat</button></div>'
        +'<iframe id="rapor-frame" src="about:blank"></iframe>';
      document.body.appendChild(rov);

      var rb=document.createElement('button');
      rb.style.cssText='position:fixed;left:18px;bottom:18px;z-index:9000;background:#d4a04f;color:#1a1208;border:none;border-radius:30px;padding:12px 18px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer';
      rb.textContent='📄 Firma Yönetim';
      rb.onclick=function(){
        var f=document.getElementById('rapor-frame');
        if(!f.src || f.src==='about:blank') f.src='firma_takvim.html';
        document.getElementById('rapor-ov').classList.add('open');
      };
      document.body.appendChild(rb);
    }

  });
})();
