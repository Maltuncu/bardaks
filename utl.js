/* Bardaks ERP — UTL (Unified Truth Layer)  [PHASE A — architecture only]
   TEK TRUTH = Supabase. Snapshot (window.ORD/PROD/FMAP) yalnız adapter üzerinden okunur.
   Bu dosya hiçbir UI'a henüz BAĞLANMAZ; var olması mevcut davranışı değiştirmez.
   Kural: UI asla sb.from / RPC / snapshot array'ine doğrudan dokunmaz — yalnız UTL görür. */
(function(global){
  'use strict';

  var SUPABASE_URL = 'https://kfpgqqjmkutjzdmzkwaa.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmcGdxcWpta3V0anpkbXprd2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTk2NzcsImV4cCI6MjA5NTE5NTY3N30.Y1ov7w7eDIJfzHYFeWPuU3D8fVMj3uMhXHB18y7Nfbs';

  /* ---- supabase client: mevcut sayfanın sb'sini paylaş (oturum için), yoksa kendi oluştur ---- */
  function client(){
    try{ if(typeof sb!=='undefined' && sb) return sb; }catch(e){}
    if(global.__utl_sb) return global.__utl_sb;
    if(global.supabase && global.supabase.createClient){ global.__utl_sb = global.supabase.createClient(SUPABASE_URL,SUPABASE_KEY); return global.__utl_sb; }
    return null;
  }

  /* ===================== CACHE (key/value + TTL + tags) ===================== */
  var _cache = {};
  var cache = {
    get:function(key){ var e=_cache[key]; if(!e) return null; if(Date.now()>e.exp){ delete _cache[key]; return null; } return e.val; },
    set:function(key,data,ttlMs,tags){ _cache[key]={val:data,exp:Date.now()+(ttlMs||15000),tags:tags||[]}; return data; },
    invalidate:function(tags){ if(!tags){ _cache={}; return; } Object.keys(_cache).forEach(function(k){ if(_cache[k].tags.some(function(t){return tags.indexOf(t)>=0;})) delete _cache[k]; }); }
  };
  async function cached(key,ttl,tags,fn){ var hit=cache.get(key); if(hit!=null) return hit; var v=await fn(); return cache.set(key,v,ttl,tags); }

  /* ===================== SNAPSHOT ADAPTER (UTL içinde, dışarı kapalı) ===================== */
  // 5 ölçülmüş kimlik çakışması -> kanonik ada normalize
  var PROD_CANON = {
    'magnolia':'Magnolia','spoonfull':'Spoonfull','san sebastian':'San Sebastian',
    'lotus cup':'Lotus Cup','fıstık cup':'Fıstık Cup'
  };
  function canonAd(n){ var k=String(n||'').toLowerCase().replace(/\s+/g,' ').trim(); return PROD_CANON[k]||n; }
  function hasSnapshot(){ try{ return typeof global.ORD!=='undefined' && Array.isArray(global.ORD) && typeof global.PROD!=='undefined'; }catch(e){ return false; } }

  function snapshotOrders(){
    if(!hasSnapshot()) return [];
    var FMAP=global.FMAP||{}, PROD=global.PROD||[], out=[];
    global.ORD.forEach(function(o,i){
      var code=o[0], tarih=o[1], lines=o[2]||[];
      var haric=0; var kalemler=lines.map(function(it){
        var fiyat=Number(it[2])||0, adet=Number(it[1])||0; haric+=adet*fiyat;
        return { urun_id:null, urun_ad:canonAd(PROD[it[0]]), adet:adet, birim_fiyat:fiyat, kdv:1 };
      });
      out.push({
        id:'snap:'+code+':'+tarih+':'+i, firma_id:FMAP[code]||null, firma_kod:code,
        tarih:tarih, durum:'tamamlandi', source:'snapshot',
        kdv_haric:haric, kdv_dahil:Math.round(haric*1.01*100)/100, kalemler:kalemler
      });
    });
    return out;
  }

  function applyFilter(rows,f){
    f=f||{};
    return rows.filter(function(r){
      if(f.from && r.tarih < f.from) return false;
      if(f.to   && r.tarih > f.to)   return false;
      if(f.firma_id && r.firma_id !== f.firma_id) return false;
      if(f.durum && r.durum !== f.durum) return false;
      return true;
    });
  }

  /* ===================== NORMALIZED READS (DB + snapshot birleşik) ===================== */
  async function dbOrders(f){
    var c=client(); if(!c) return [];
    var q=c.from('siparisler').select('id,firma_id,tarih,durum,toplam_kdv_haric,toplam_kdv_dahil').eq('is_deleted',false).neq('durum','iptal');
    if(f&&f.from) q=q.gte('tarih',f.from); if(f&&f.to) q=q.lte('tarih',f.to);
    if(f&&f.firma_id) q=q.eq('firma_id',f.firma_id); if(f&&f.durum) q=q.eq('durum',f.durum);
    var r=await q.limit(5000);
    return (r.data||[]).map(function(s){ return {id:s.id,firma_id:s.firma_id,tarih:s.tarih,durum:s.durum,source:'db',kdv_haric:Number(s.toplam_kdv_haric)||0,kdv_dahil:Number(s.toplam_kdv_dahil)||0}; });
  }

  var UTL = {
    /* ---- entity reads ---- */
    getOrders: function(filter){
      var key='orders:'+JSON.stringify(filter||{});
      return cached(key,12000,['orders'],async function(){
        var db=await dbOrders(filter);
        var snap=applyFilter(snapshotOrders(),filter);
        return db.concat(snap); // union; snapshot Phase B sonrası boşalır
      });
    },
    getItems: function(filter){
      var key='items:'+JSON.stringify(filter||{});
      return cached(key,12000,['items'],async function(){
        var c=client(); if(!c) return [];
        // DB items (sipariş filtresine göre)
        var ords=await UTL.getOrders(filter);
        var dbIds=ords.filter(function(o){return o.source==='db';}).map(function(o){return o.id;});
        var dbItems=[];
        if(dbIds.length){ var r=await c.from('siparis_kalemleri').select('siparis_id,urun_id,urun_ad,adet,birim_fiyat_kdv_haric,kdv_orani').in('siparis_id',dbIds).eq('is_deleted',false);
          dbItems=(r.data||[]).map(function(k){return {order_id:k.siparis_id,urun_id:k.urun_id,urun_ad:k.urun_ad,adet:Number(k.adet)||0,birim_fiyat:Number(k.birim_fiyat_kdv_haric)||0,kdv:k.kdv_orani||1,source:'db'};}); }
        // snapshot items
        var snapItems=[]; applyFilter(snapshotOrders(),filter).forEach(function(o){ o.kalemler.forEach(function(k){ snapItems.push({order_id:o.id,urun_id:null,urun_ad:k.urun_ad,adet:k.adet,birim_fiyat:k.birim_fiyat,kdv:1,source:'snapshot'}); }); });
        return dbItems.concat(snapItems);
      });
    },
    getFirms: function(){ return cached('firms',60000,['firms'],async function(){ var c=client(); if(!c) return []; var r=await c.from('firmalar').select('id,ad,aktif').eq('aktif',true).order('ad'); return r.data||[]; }); },
    getProducts: function(){ return cached('products',60000,['products'],async function(){ var c=client(); if(!c) return []; var r=await c.from('urunler').select('id,ad,kategori,varsayilan_fiyat,kdv_orani,birim_maliyet').eq('aktif',true).order('ad'); return r.data||[]; }); },

    /* ---- composite views ---- */
    getFirmView: async function(firmaId,filter){
      var f=Object.assign({},filter||{},{firma_id:firmaId});
      var orders=await UTL.getOrders(f);
      var byDurum={bekleyen:[],uretimde:[],hazir:[],diger:[]};
      orders.forEach(function(o){ (byDurum[o.durum]||byDurum.diger).push(o); });
      var agg=await UTL.aggregates.financial(f);
      return { firma_id:firmaId, orders:orders, byDurum:byDurum, financial:agg };
    },
    getReportView: async function(filter){
      return { daily:await UTL.aggregates.daily(filter), firm:await UTL.aggregates.firm(filter), financial:await UTL.aggregates.financial(filter) };
    },

    /* ---- aggregates: live RPC (DB) + snapshot adapter merge ---- */
    aggregates: {
      daily: function(filter){ var key='agg:daily:'+JSON.stringify(filter||{});
        return cached(key,12000,['aggregates'],async function(){
          var c=client(); var db=[]; if(c){ var r=await c.rpc('rapor_daily',rpcArgs(filter)); db=r.data||[]; }
          var snap={}; applyFilter(snapshotOrders(),filter).forEach(function(o){ var d=snap[o.tarih]=snap[o.tarih]||{tarih:o.tarih,siparis_sayisi:0,toplam_adet:0,kdv_haric:0,kdv_dahil:0}; d.siparis_sayisi++; o.kalemler.forEach(function(k){d.toplam_adet+=k.adet;}); d.kdv_haric+=o.kdv_haric; d.kdv_dahil+=o.kdv_dahil; });
          return mergeBy('tarih',db,Object.values(snap));
        }); },
      firm: function(filter){ var key='agg:firm:'+JSON.stringify(filter||{});
        return cached(key,12000,['aggregates'],async function(){
          var c=client(); var db=[]; if(c){ var r=await c.rpc('rapor_firm',rpcArgs(filter)); db=r.data||[]; }
          var snap={}; applyFilter(snapshotOrders(),filter).forEach(function(o){ var key2=o.firma_id||o.firma_kod; var d=snap[key2]=snap[key2]||{firma_id:o.firma_id,firma_ad:o.firma_kod,siparis_sayisi:0,toplam_adet:0,kdv_haric:0,kdv_dahil:0}; d.siparis_sayisi++; o.kalemler.forEach(function(k){d.toplam_adet+=k.adet;}); d.kdv_haric+=o.kdv_haric; d.kdv_dahil+=o.kdv_dahil; });
          return mergeBy('firma_id',db,Object.values(snap));
        }); },
      financial: function(filter){ var key='agg:fin:'+JSON.stringify(filter||{});
        return cached(key,12000,['aggregates','financial'],async function(){
          var c=client(); var base={ciro_haric:0,ciro_dahil:0,urun_maliyet:0,gider:0,tahsilat:0,brut_kar:0,net_kar:0};
          if(c){ var r=await c.rpc('rapor_financial',rpcArgs(filter)); if(r.data&&r.data[0]) base=r.data[0]; }
          applyFilter(snapshotOrders(),filter).forEach(function(o){ base.ciro_haric=Number(base.ciro_haric)+o.kdv_haric; base.ciro_dahil=Number(base.ciro_dahil)+o.kdv_dahil; });
          return base;
        }); }
    },

    /* ---- mutations: TEK giriş = apply_batch_transition (bulk + tek + undo) ---- */
    state:'confirmed',
    mutate: {
      batch: async function(ids,from,to){ return runBatch(ids,from,to); },
      single: async function(id,from,to){ return runBatch([id],from,to); }, // N=1 batch
      undo: async function(arg){
        var c=client(); if(!c) return {state:'unknown',reason:'no_client'};
        var args = /^[0-9a-f-]{36}$/i.test(arg) ? {p_batch_id:arg} : {p_order_id:arg};
        try{ var r=await c.rpc('revert_last_operation',args); if(r.error) throw r.error; cache.invalidate(['orders','items','aggregates','financial']); UTL.state='confirmed'; return {state:'confirmed',data:r.data}; }
        catch(e){ return {state:'unknown',reason:'revert_unavailable',detail:(e&&e.message)||String(e)}; } // revert RPC henüz deploy edilmemiş olabilir
      }
    },

    /* ---- single coalesced realtime ---- */
    subscribe: function(onChange){
      var c=client(); if(!c) return function(){};
      var timer=null;
      var ch=c.channel('utl-rt')
        .on('postgres_changes',{event:'*',schema:'public',table:'siparisler'},flush)
        .on('postgres_changes',{event:'*',schema:'public',table:'siparis_kalemleri'},flush)
        .on('postgres_changes',{event:'*',schema:'public',table:'tahsilatlar'},flush)
        .on('postgres_changes',{event:'*',schema:'public',table:'expenses'},flush)
        .subscribe();
      function flush(){ if(timer) clearTimeout(timer); timer=setTimeout(function(){ cache.invalidate(['orders','items','aggregates','financial']); try{ onChange&&onChange(); }catch(e){} }, 280); }
      return function(){ try{ c.removeChannel(ch); }catch(e){} };
    },

    cache: cache,
    _snapshotActive: hasSnapshot   // teşhis: snapshot adapter aktif mi
  };

  function rpcArgs(f){ f=f||{}; return {p_from:f.from||null,p_to:f.to||null,p_firma:f.firma_id||null,p_durum:f.durum||null}; }
  function mergeBy(keyName,a,b){ var m={}; (a||[]).concat(b||[]).forEach(function(row){ var k=row[keyName]||'_'; if(!m[k]){ m[k]=Object.assign({},row); } else { ['siparis_sayisi','toplam_adet','kdv_haric','kdv_dahil'].forEach(function(fld){ if(row[fld]!=null) m[k][fld]=(Number(m[k][fld])||0)+(Number(row[fld])||0); }); } }); return Object.values(m); }

  function uuid(){ return (global.crypto&&crypto.randomUUID)?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);}); }
  async function runBatch(ids,from,to){
    var c=client(); if(!c) return {state:'unknown',reason:'no_client'};
    var actor=''; try{ actor=(typeof CURRENT!=='undefined'&&CURRENT)?(CURRENT.id||CURRENT.auth_id||''):''; }catch(e){}
    var bId=uuid(); var key=actor+'|'+from+'>'+to+'|'+ids.slice().sort().join(',')+'|'+bId;
    UTL.state='processing';
    try{
      var r=await c.rpc('apply_batch_transition',{p_batch_id:bId,p_idempotency_key:key,p_order_ids:ids,p_from:from,p_to:to});
      if(r.error) throw r.error;
      cache.invalidate(['orders','items','aggregates','financial']);
      UTL.state='confirmed';
      return {state:'confirmed',batch_id:bId,result:r.data};
    }catch(e){
      UTL.state='unknown'; // ack kaybı -> reconcile: batch_records sorgusu (çağıran katman yapar)
      return {state:'unknown',batch_id:bId,idempotency_key:key,reason:'ack_lost',detail:(e&&e.message)||String(e)};
    }
  }

  global.UTL = UTL;
})(window);
