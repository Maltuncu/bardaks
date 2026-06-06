# BARDAKS_DECISIONS.md

Bu dosya Bardaks B2B projesindeki kalici is kararlarini tutar.
Bu kararlar tekrar tartisilmayacak varsayimlar olarak kullanilmalidir.

## Ana Hedef

Bardaks B2B; firma, urun, fiyat, siparis, uretim, tahsilat, finans, takvim ve rapor yonetim sistemi olacak.

Gercek kullanim basladiginda sistem profesyonel urun disipliniyle calismalidir:

- Kullanici veri girerken sistem sasmayacak.
- Ekranda gorunen fiyat ile DB hesabi celismeyecek.
- Islem gecmisi kaybolmayacak.
- Yanlis islem sessizce gecmeyecek.
- Mudur geliştirici gibi dusunmek zorunda kalmayacak.

## Gercek Veri Girişi

- Gercek veri girişi henuz baslamayacak.
- Mudur/firma/fiyat/siparis/tahsilat gibi gercek kayitlar, sistem uctan uca hazir olmadan girilmeyecek.
- Eski import/farazi veriler gercek veri kabul edilmeyecek.
- Clean start sonrasi temiz zemin korunacak.

## Fiyat ve KDV (GUNCEL KALICI KARAR — 2026-06-05, eski "KDV dahil girilir" politikasi IPTAL)

- Firma/urun birim satis fiyati **KDV HARIC** girilir.
- UI fiyat input etiketi: "Satis Fiyati (KDV haric)".
- DB `birim_fiyat_kdv_haric` saklar; girilen deger dogrudan saklanir (dahil->haric donusumu YOK).
- Maliyet **KDV haric**tir; etiket "Maliyet (KDV haric)".
- Birim net kar hesabi **KDV haric baz**da yapilir: `birim_net_kar = satis_haric - maliyet`, `marj = net / satis_haric`.
- **KDV dahil tutar YALNIZ** satir toplami, genel toplam ve rapor/fatura toplamlarinda gosterilir; birim fiyat girisinde/gosteriminde KDV dahil kullanilmaz.
- Kullanici 120 yazinca sistem bunu KDV haric kabul eder; ustune tekrar KDV haric'e cevirmek icin bolme YAPMAZ (cift donusum yasak).
- KDV orani urun bazlidir; `urunler.kdv_orani` default'u %1.
- Uygulayan faz: PRICE-VAT-POLICY-CHANGE-1 (deploy 8ffe86f). Migration yok (aktif fiyat 0 idi).

## Baseline Tarih

- `01.01.2025` fiyat baslangic tarihi, sistem acilis/baseline fiyat tarihi olarak kabul edilebilir.
- Kaydin sisteme girildigi tarih ile fiyatin gecerlilik tarihi ayri kavramlardir.
- Mudurun yaptigi fiyat ekleme/degistirme/kaldirma islemleri ayrica loglanmalidir.

## Urun

- Urunler hard-delete edilmez.
- Satis disina cikan urunler pasiflestirilir.
- Yari mamul ve malzeme urunleri siparis ekraninda gorunmez.
- Yari mamul ve malzeme urunleri firma fiyat/katalog eklemeye sizmamalidir.
- Satis urunu mantigi korunmalidir.

## Firma Katalogu

- Her firmanin kendi urun katalogu vardir.
- Firma hangi urunleri aliyorsa firma ekranindan o urunler eklenir.
- Aktif firma fiyat kaydi varsa firma o urunu aliyor/satiyor kabul edilir.
- Fiyat yoksa veya expired ise firma o urunu almiyor kabul edilir.
- Simdilik ayri `firma_urunleri` tablosu gereksizdir; mevcut `firma_urun_fiyat` modeli yeterlidir.

## Fiyat Gecmisi

- Firma fiyat gecmisi korunmalidir.
- Fiyat degisiminde mevcut aktif kayit hard-update ile ezilmemelidir.
- Dogru model: eski aktif kaydi expire et, yeni kayit insert et.
- Log degeri DB CHECK'e uygun olmalidir.
- Bilinen CHECK degerleri: `eklendi`, `cikarildi`, `fiyat_degisti`.
- `guncellendi` gibi CHECK disi degerler kullanilmaz.

## Siparis

- Mudur firma secer.
- Sadece o firmaya tanimli aktif satilabilir urunler listelenir.
- Siparis ekraninda kullaniciyi yaniltacak KDV haric/dahil karisikligi olmamalidir.
- Siparis, cari ve kar hesabi birbirini bozmamalidir.

## Maliyet

- Maliyet baslangicta 0 olabilir.
- Sistem 0 maliyetle kirilmadan calismalidir.
- Gercek maliyet sonra girilirse ilgili silinmemis siparislerin kar hesaplari recompute edilmelidir.
- Maliyet gecmisi henuz tam cozulmus degildir.
- Ileride `urun_maliyet_gecmisi` tablosu gerekebilir.

## Tahsilat ve Odeme

- Tahsilat sistemi financial truth icin kritiktir.
- Firmanin borcundan dusen tutar brut tahsilattir.
- Banka/kasaya giren gercek para net tahsilattir.
- POS komisyonu ayrica izlenmelidir.
- Nakit, havale/EFT, kart/POS ve cek ayrimi gerekir.
- Cekte vade, durum ve tahsil ayrimi gerekir.
- Kismi odeme desteklenmelidir.
- Tahsilat siparis/fatura/cari ile iliskili olmalidir.

## Audit ve Bildirim

- Mudurun yaptigi kritik islemler loglanmalidir.
- Fiyat ekleme, fiyat degistirme, fiyat kaldirma loglanmalidir.
- Siparis, tahsilat, urun, firma ve maliyet islemleri de audit kapsaminda ele alinmalidir.
- Yonetici ekranindaki bildirim ile DB audit log ayni sey olmayabilir; bu ayrim kontrol edilmelidir.

## UX ve Marka

- Arayuz sade, modern, yormayan ve profesyonel B2B panel gibi olmalidir.
- Bardaks kurumsal ruhu: mavi, sade, monoline, temiz is paneli.
- Firma ekrani ana merkez olacaktir.
- Landing page mantigi degil, isletme paneli mantigi onceliklidir.

