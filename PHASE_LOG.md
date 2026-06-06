# PHASE_LOG.md

Bu dosya Bardaks B2B fazlarinin kisa karar kaydidir.
Uzun auditleri tekrar okumamak icin her faz burada tek satir/az satir halinde tutulur.

## Tamamlanan Fazlar

| Faz | Durum | Kisa sonuc | Kanit / Not |
|---|---|---|---|
| CLEAN-START | PASS | Import siparisleri ve cari etkileri temizlendi; firmalar/urunler/fiyat gecmisi korundu | aktif siparis 0, aktif kalem 0, cari_ozet 0 |
| PRODUCT-2 | PASS | `satis_urunu` mantigi eklendi; yari mamul/malzeme siparisten gizlendi | 45 satilabilir urun kaldi |
| COST-1 | PASS | Maliyet 0 toleransli; maliyet degisince recompute calisiyor | Sonra COST-HISTORY ile snapshot modele gecildi |
| CATALOG-A | PASS | Farazi aktif firma fiyatlari soft-expire edildi | aktif fiyat 0, toplam 116, fiyat gecmisi korundu |
| CATALOG-B | PASS | firma_takvim fiyat/katalog ekrani hizalandi | serbest metin urun ekleme kaldirilmaya baslandi; log CHECK notu |
| PRICE-VAT-1 | PASS | KDV dahil fiyat girisi DB haric storage ile hizalandi | commit 511d554; DB mutation 0; canlı fiyat etiketi dogrulandi |
| PRICE-VAT-2 | PASS | Siparis birim fiyat gosterimi KDV dahil yapildi; #5 input donusumu dahil edildi | commit 95a2e25; mock/local-state PASS; canlı-modal pending aktif fiyat 0 |
| ORDER-CATALOG-LOCK-1 | PASS | firma_takvim katalog-disi/serbest siparis girişi kapatildi; uid=null guard eklendi | commit 0453912; DB mutation 0; runtime buton yok + guard PASS |
| COST-HISTORY-2 | PASS | Ana kar snapshot tabanli tarihsel modele gecti; guncel marj ayri view/RPC oldu | schema changed; data mutation 0; BEGIN/ROLLBACK mock PASS; backup_COST-HISTORY-2_2026-06-05.sql |
| PAYMENT-2a | PASS | Tahsilat DB/RPC omurgasi eklendi: +5 kolon, +4 CHECK, partial unique index, `tahsilat_kaydet`, `tahsilat_iptal` | schema changed yes; data mutation 0; mock 6/6 PASS; backup_PAYMENT-2a_2026-06-05.sql |
| PAYMENT-2b | PASS | index.html tahsilat UI `tahsilat_kaydet`/`tahsilat_iptal` RPC'ye gecti; param fix; hesap dropdown | deploy 31defe9c; runtime kayit+iptal test (Outlier havale 100) zinciri PASS |
| ACCOUNTS-1 | PASS | accounts audit trigger + uniq ad index + hesap_ekle/guncelle/pasiflestir RPC (bakiye!=0 pasif engeli) | schema additive; mock 6/6 PASS; backup_ACCOUNTS-1_2026-06-05.sql; Pilot Banka/POS olusturuldu |
| FINTX-1 | PASS | netkar_banka manuel hareket `fintx_kaydet` (gelir/gider, server yon) + `fintx_iptal`; addHesap->hesap_ekle | deploy 9ba4f5a1; mock 8/8 PASS; backup_FINTX-1 |
| LEGACY-1 | PASS | bardaks_b2b.html head redirect->index.html; eski direct-insert write yollari kapatildi | deploy 1ffdfb24; runtime redirect PASS |
| COST-DISPLAY-1 | PASS | Panel ana kar DB snapshot'a hizalandi (Sigma brut_kar/net_kar); live-cost yalniz "simulasyon" etiketi | deploy e348318; runtime panel render PASS |
| PAYMENT-3 | PASS | Cek lifecycle: cek_tahsil_et/karsiliksiz_yap/iptal_et RPC + cari_ozet view (karsiliksiz/iptal cari geri acar) + UI Bekleyen Cekler karti | deploy 74ca1e78; mock 7/7 PASS; backup_PAYMENT-3 |
| FIRMA-MERKEZI-3 | PASS | firma_takvim 8 sekme; MVP Ozet/Bakiye/Tahsilat/Cek yalniz mevcut RPC/view | deploy 72f43674; runtime Ozet+Tahsilat render PASS |
| PRICE-MARGIN-UI-1 | PASS | Fiyat satirinda Maliyet+Birim net kar+marj (KDV haric baz); editPrice canli onizleme; maliyet update urunler trigger'li | deploy 17093182; kar DB'ye yazilmaz |
| PRICE-VAT-POLICY-CHANGE-1 | PASS | Fiyat inputlari KDV dahil->KDV HARIC; dahil->haric donusumleri kaldirildi; KDV dahil yalniz toplam/rapor/fatura | deploy 8ffe86f; 3 dosya; statik donusum 0; migration yok (aktif fiyat 0) |

## Acik Riskler

| Risk | Durum | Faz |
|---|---|---|
| Tahsilat UI RPC kullanmiyordu | KAPANDI | PAYMENT-2b |
| Cek lifecycle (tahsil/karsiliksiz/iptal, cari+banka etkisi) | KAPANDI | PAYMENT-3 |
| Manuel fintx + legacy direct-insert bypass | KAPANDI | FINTX-1 / LEGACY-1 |
| Kar gosterimi live-cost vs snapshot celiskisi | KAPANDI | COST-DISPLAY-1 |
| Fatura/siparis tahsilat allocation yok | Acik | PAYMENT-4 (backlog) |
| Dekont Storage yok, simdilik URL/metin | Acik | backlog |
| Cek admin-correction (tahsil_edildi->karsiliksiz, fintx reversal) | Acik | backlog |
| Pilot Banka/POS placeholder ad; gercek banka bilgisi girilmedi | Acik (setup) | go-live setup |
| Urun maliyetleri girilmedi (kar sisebilir) | Acik (veri kalitesi) | go-live setup |
| Gercek fiyat 0; fiyat-giris modal gorseli + tam runtime go-live'da | Acik | go-live |

## Financial Truth Durumu

Cek dahil tum odeme tipleri (nakit/havale/kart/cek) + manuel fintx + cari + banka/kasa bakiye + snapshot kar raporu **teknik READY** (write yalniz guard'li RPC, okuma canonical view/snapshot). Kalanlar setup/veri-kalitesi, teknik bloker degil.

## Guncel Siradaki Faz

Go-live setup (pilot hesap gercek ad + urun maliyet girisi) veya backlog: FIRMA-RAPOR-1 (firma rapor + snapshot arsiv), TAX-RESERVE-1 (vergi karsiligi), cek admin-correction. Kullanici secimine gore.

