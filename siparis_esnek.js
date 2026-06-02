/* siparis_esnek.js — Sipariş girişinde ürün ekle/çıkar override
   netkar_banka.js'ten sonra yüklenir, openYeniSiparis/ysLoadUrunler'i değiştirir.
   DB zaten urun_id nullable → serbest ürün destekleniyor. */
(function(){
  'use strict';
  function waitApp(cb,t){ t=t||80; if(typeof openYeniSiparis==='function'&&typeof URUNLER!=='undefined') cb(); else if(t>0) setTimeout(function(){waitApp(cb,t-1);},200); }
  waitApp(function(){

    // ── ysLoadUrunler override: render + ekle/sil ──
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

    window.ysSilSatir = function(i){
      window.ysSatirlar.splice(i,1);
      ysRenderSatirlar();
    };

    // ── Ürün ekleme paneli ──
    window.ysEklePanel = function(){
      if(document.getElementById('ysAddPnl')) return;
      var urunOpts = (typeof URUNLER!=='undefined'?URUNLER:[]).filter(function(u){return u.aktif!==false;}).map(function(u){
        return '<option value="'+u.id+'" data-ad="'+u.ad+'" data-fiyat="'+(u.varsayilan_fiyat||0)+'" data-kdv="'+(u.kdv_orani||1)+'">'+u.ad+'</option>';
      }).join('');
      var h = '<div id="ysAddPnl" style="background:var(--surface2,#1f232c);border:1px solid var(--border);border-radius:10px;padding:12px;margin-top:10px">'
        +'<div style="font-weight:700;font-size:14px;margin-bottom:8px">Ürün Ekle</div>'
        +'<select id="ysKatSec" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;margin-bottom:6px" onchange="ysKatDoldur()">'
        +'<option value="">— Katalogdan seç (opsiyonel) —</option>'+urunOpts+'</select>'
        +'<input id="ysYeniAd" placeholder="Ürün adı (serbest)" style="width:100%;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;margin-bottom:4px;box-sizing:border-box">'
        +'<div style="display:flex;gap:6px">'
        +'<input id="ysYeniFiyat" type="number" step="0.01" placeholder="Birim fiyat" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;box-sizing:border-box">'
        +'<input id="ysYeniKdv" type="number" value="1" placeholder="KDV %" style="width:60px;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;box-sizing:border-box"></div>'
        +'<div style="display:flex;gap:6px;margin-top:8px">'
        +'<button class="btn btn-sm" onclick="ysEkleOnayla()" style="flex:1">Ekle</button>'
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

    // ── Rapor FAB butonu ──
    if(typeof CURRENT!=='undefined' && CURRENT && (CURRENT.rol==='admin'||CURRENT.rol==='mudur')){
      var rb=document.createElement('a');
      rb.href='rapor.html';
      rb.target='_blank';
      rb.style.cssText='position:fixed;left:18px;bottom:18px;z-index:9000;background:#d4a04f;color:#1a1208;border:none;border-radius:30px;padding:12px 18px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;text-decoration:none';
      rb.textContent='📄 Rapor';
      document.body.appendChild(rb);
    }

  });
})();
