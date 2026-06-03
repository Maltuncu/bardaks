/* Bardaks ERP — finguard.js  [Phase 4F.0 + 4F.1]
   Manual Financial Cutover öncesi: legacy/import firma alacak/bakiye değerlerini
   UI'da financial truth gibi GÖSTERME. Veri/DB/realtime/mutation/observe DOKUNULMAZ — yalnız görsel redaksiyon.
   index.html'e dokunmaz; renderPanel + renderFinans çıktısını render SONRASI redakte eder. Kill-switch'li.
   Eşleşme ASCII-önek (Türkçe etiketlerin önekiyle), kullanıcı metni tam Türkçe.
   4F.1: panel 'Tahsilat Oranı' da redakte (cutover öncesi ödeme verisi eksik -> yanıltıcı). */
(function(){
  'use strict';
  var FVER='4F.0';
  window.FINGUARD = window.FINGUARD || 'on';
  if(window.__FINGUARD_LOADED){ if(window.FINGUARD_STATUS){ window.FINGUARD_STATUS.error='DOUBLE_LOAD'; } return; }
  window.__FINGUARD_LOADED = true;

  var ST = { loaded:true, version:FVER, mode:window.FINGUARD, error:null, redactions:0, wrapped:{renderPanel:false, renderFinans:false} };
  window.FINGUARD_STATUS = ST;

  var NOTE = 'Finansal doğrulama bekliyor';
  var SUB  = 'Bakiye/alacak manual cutover sonrası aktif';

  function redactPanel(){
    try{
      if(window.FINGUARD==='off') return;
      var el=document.getElementById('page-panel'); if(!el) return;
      var labels=el.querySelectorAll('.stat-label');
      Array.prototype.forEach.call(labels,function(lb){
        var t=(lb.textContent||'').trim();
        if(t.indexOf('Tahsil Edilmemi')===0 || t.indexOf('Vadesi Ge')===0 || t.indexOf('Tahsilat Oran')===0){
          var val=lb.parentNode && lb.parentNode.querySelector('.stat-value');
          if(val && val.getAttribute('data-fg')!=='1'){ val.textContent='—'; val.style.color='var(--text-dim)'; val.title=NOTE; val.setAttribute('data-fg','1'); ST.redactions++; }
        }
      });
      var cards=el.querySelectorAll('.card');
      Array.prototype.forEach.call(cards,function(c){
        var ct=c.querySelector('.card-title');
        if(ct && (ct.textContent||'').indexOf('Firma Bazl')===0 && c.getAttribute('data-fg')!=='1'){
          c.setAttribute('data-fg','1');
          c.innerHTML='<div class="card-title">Firma Bazlı Açık Bakiye</div><div style="font-size:13px;color:var(--text-dim)">⏳ '+NOTE+' — import edilen bakiyeler doğrulanana kadar gizli. '+SUB+'.</div>';
          ST.redactions++;
        }
      });
    }catch(e){ ST.error=ST.error||'REDACT_PANEL_FAIL'; }
  }

  function redactFinans(){
    try{
      if(window.FINGUARD==='off') return;
      var el=document.getElementById('page-finans'); if(!el) return;
      var cards=el.querySelectorAll('.card');
      Array.prototype.forEach.call(cards,function(c){
        var ct=c.querySelector('.card-title'); if(!ct) return;
        var t=(ct.textContent||'').trim();
        if((t.indexOf('Nakit Projeksiyon')>=0 || t.indexOf('Firma Risk')>=0) && c.getAttribute('data-fg')!=='1'){
          c.setAttribute('data-fg','1');
          c.innerHTML='<div class="card-title">'+t+'</div><div style="font-size:13px;color:var(--text-dim)">⏳ '+NOTE+' — bu bölüm import/legacy bakiyeye dayandığından manual cutover sonrası aktif olacak.</div>';
          ST.redactions++;
        }
      });
    }catch(e){ ST.error=ST.error||'REDACT_FINANS_FAIL'; }
  }

  function wrap(name, redactFn){
    try{
      var orig=window[name];
      if(typeof orig!=='function') return false;
      if(orig.__fgw){ ST.wrapped[name]=true; return true; }
      var w=function(){
        var ret=orig.apply(this, arguments);
        function after(){ try{ redactFn(); }catch(e){} }
        if(ret && typeof ret.then==='function'){ ret.then(after, after); }
        else { setTimeout(after,0); }
        return ret;
      };
      w.__fgw=true; w.__fgorig=orig;
      window[name]=w; ST.wrapped[name]=true; return true;
    }catch(e){ ST.error=ST.error||'WRAP_FAIL'; return false; }
  }

  function pass(){ var a=wrap('renderPanel',redactPanel); var b=wrap('renderFinans',redactFinans); return a&&b; }

  window.FINGUARD_DISABLE=function(){ window.FINGUARD='off'; ST.mode='off'; return 'off'; };
  window.FINGUARD_ENABLE =function(){ window.FINGUARD='on'; ST.mode='on'; redactPanel(); redactFinans(); return 'on'; };

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded',fn); }
  ready(function(){
    pass();
    redactPanel(); redactFinans();
    var n=40; var iv=setInterval(function(){ n--; var ok=pass(); redactPanel(); redactFinans(); if(ok || n<=0){ clearInterval(iv); } }, 250);
    try{ console.log('FINGUARD_READY mode=on version='+FVER); }catch(e){}
  });
})();
