# DB_CONTRACTS.md

Bu dosya Bardaks B2B icin DB, view, RPC ve veri anlami sozlesmelerini tutar.
Claude degisiklik yapmadan once buradaki kontratlari kontrol etmelidir.

## Genel Ilkeler

- Gercek veri hard-delete edilmez.
- Finansal gecmis ezilmez.
- Fiyat gecmisi korunur.
- Kritik islemler auditlenir.
- Birim satis fiyati kullaniciya KDV HARIC gosterilir/girilir; KDV dahil yalniz satir/genel toplam ve rapor/fatura toplamlarinda gosterilir.
- DB birim fiyati KDV haric saklar (`birim_fiyat_kdv_haric`).
- Veri anlami UI metniyle celismemelidir.

## `urunler`

Beklenen anlam:

- Urun ana havuzudur.
- Satis urunu, yari mamul, malzeme ayrimi burada veya ilgili alanlarda temsil edilir.
- Satis disina cikan urun pasiflestirilir.
- KDV orani urun bazlidir.
- Bilinen karar: `kdv_orani` default %1.
- Maliyet baslangicta 0 olabilir.

Kirilmayacak sozlesmeler:

- Urun hard-delete edilmez.
- Yari mamul/malzeme siparis ekranina sizmaz.
- Satis urunu filtresi korunur.
- KDV orani fiyat hesaplarinda urun bazli kullanilir.

Riskli degisiklikler:

- KDV oranini sabit kabul etmek.
- Pasif urunu raporlardan tamamen yok etmek.
- Maliyet null ise hesaplari kirmak.

## `firma_urun_fiyat`

Beklenen anlam:

- Firma bazli urun fiyat gecmisini tutar.
- Aktif fiyat kaydi varsa firma o urunu aliyor/satiyor kabul edilir.
- Aktif fiyat yoksa veya kayit expired ise firma o urunu almiyor kabul edilir.
- DB'de bilinen fiyat kolonu: `birim_fiyat_kdv_haric`.
- Kullanici birim satis fiyatini KDV HARIC girer; girilen deger DB'ye dogrudan saklanir.

KDV sozlesmesi (GUNCEL KALICI KARAR — 2026-06-05; eski "Input: KDV dahil" IPTAL):

- Input: **KDV haric** (etiket: "Satis Fiyati (KDV haric)").
- Storage: `birim_fiyat_kdv_haric` (girilen deger dogrudan; donusum YOK).
- Display/View (birim fiyat): **KDV haric**.
- KDV dahil YALNIZ satir toplami, genel toplam, rapor/fatura toplamlarinda gosterilir.
- Donusum: birim fiyat girisinde dahil->haric donusumu YAPILMAZ. (Eski `haric = dahil/(1+kdv/100)` formulu artik KULLANILMAZ.)
- Toplam gosterimi icin: `satir_dahil = round(haric * adet * (1 + kdv_orani/100), 2)` — yalniz toplam/rapor seviyesinde.

Kirilmayacak sozlesmeler:

- Fiyat degisiminde gecmis ezilmez.
- Dogru model: aktif kaydi expire et, yeni kayit insert et.
- Aktif fiyatlar firma katalogunu belirler.
- Yari mamul/malzeme fiyat eklemeye sizmaz.

Riskli degisiklikler:

- `birim_fiyat_kdv_dahil` gibi ikinci fiyat kolonu eklemek; gerekirse once mimari gerekce sun.
- Mevcut aktif fiyat kaydini dogrudan update ederek tarihsel gecmisi bozmak.
- **Girilen KDV haric fiyati dahil sanip `/(1+kdv/100)` ile bolmek (cift donusum); fiyat yanlis dusuk saklanir — YASAK.**
- Birim fiyat girisinde/gosteriminde KDV dahil deger kullanmak (KDV dahil yalniz toplam/rapor/fatura).

## Firma Urun Loglari

Bilinen CHECK degerleri:

- `eklendi`
- `cikarildi`
- `fiyat_degisti`

Kirilmayacak sozlesmeler:

- `guncellendi` gibi CHECK disi deger kullanilmaz.
- Log, islem gecmisinin kanitidir.
- UI basari mesaji audit log yerine gecmez.

Loglarda ideal alanlar:

- actor/user
- islem tipi
- firma referansi
- urun referansi
- eski deger
- yeni deger
- tarih/saat

## Siparis

Beklenen anlam:

- Siparis firma uzerinden olusur.
- Kalemlerde sadece firmanin aktif satilabilir urunleri yer alir.
- Yari mamul/malzeme siparis kalemine sizmaz.
- Siparis cari ve kar hesaplarini etkiler.

Kirilmayacak sozlesmeler:

- Ekranda gorunen fiyat ile hesaplanan toplam celismemelidir.
- KDV dahil/hariç anlamlari acik olmalidir.
- Iptal veya soft-delete cari etkisini dogru geri almalidir.
- Kalem guncelleme finansal etkiyi tutarli revize etmelidir.

Riskli degisiklikler:

- Sadece frontend filtresiyle yari mamul gizlemek; DB/RPC tarafinda da kontrol gerekebilir.
- Siparis iptalinde sadece UI durumunu degistirip cari etkisini birakmak.

## Cari

Beklenen anlam:

- Cari, firmanin borc/alacak durumunu temsil eder.
- Siparis borc etkisi yaratir.
- Tahsilat borcu dusurur.
- Cari ozet financial truth icin dogrulanmadan kesin kaynak kabul edilmez.

Kirilmayacak sozlesmeler:

- Brut tahsilat firma borcunu dusen tutardir.
- Net tahsilat banka/kasa giren gercek paradir.
- POS komisyonu cari borcu tekrar artirmaz; ayri gider/komisyon olarak izlenir.

Riskli degisiklikler:

- Brut ve net tahsilati ayni alan gibi kullanmak.
- POS komisyonunu yok saymak.
- Tahsilati siparis/fatura ile iliskisiz birakmak.

## Tahsilat

Beklenen anlam:

- Tahsilat firmadan alinan odemeyi temsil eder.
- Odeme yontemi ayrilmalidir: nakit, havale/EFT, kart/POS, cek.
- Kismi odeme desteklenmelidir.
- Yanlis tahsilat iptal/geri alma akisi olmalidir.

Gereken alanlar veya iliskiler:

- firma
- siparis/fatura baglantisi
- odeme tarihi
- odeme yontemi
- brut tahsilat
- net tahsilat
- POS komisyon orani
- POS komisyon tutari
- banka/kasa hesabi
- valor tarihi
- cek no
- cek vade tarihi
- cek durumu
- dekont/makbuz dosyasi

Kirilmayacak sozlesmeler:

- Brut tahsilat borcu dusurur.
- Net tahsilat kasa/banka gercegidir.
- Cek alindi, vadesi geldi, tahsil edildi, karsiliksiz gibi durumlar ayrilmalidir.

## Maliyet ve Kar

Beklenen anlam:

- Maliyet 0 olabilir.
- Null/eksik maliyet sistemi kirmamalidir.
- Kar hesabi maliyetle iliskilidir.
- Maliyet degisince silinmemis siparislerde recompute mantigi calisabilir.

Acik karar ihtiyaci:

- Kar tarihsel olarak siparis anindaki maliyetle mi korunacak?
- Yoksa guncel maliyetle yeniden mi hesaplanacak?
- Maliyet gecmisi icin `urun_maliyet_gecmisi` gerekli mi?

Riskli degisiklikler:

- Maliyet gecmisi olmadan tarihsel kar raporuna kesin dogru demek.
- Maliyet null oldugunda kar hesaplarini patlatmak.

## View / RPC

Genel sozlesme:

- View'lar veri anlamini sade ve tutarli sunmalidir.
- RPC'ler kritik finansal mutationlarda tercih edilebilir.
- RPC kullaniliyorsa yetki, audit ve rollback mantigi kontrol edilmelidir.

KDV view sozlesmesi:

- `firma_urun_fiyat` haric saklar; view KDV dahil deger yalniz satir/genel toplam ve rapor/fatura icin uretir (birim fiyat KDV haric gosterilir).
- View hesaplamasi urun bazli `kdv_orani` kullanmalidir.
- Round farklari kullaniciyi yaniltmayacak seviyede olmalidir.

RPC riskleri:

- RLS bypass riski.
- Audit olmadan mutation.
- Partial failure durumunda yari kayit kalmasi.

## RLS / Yetki

Beklenen anlam:

- Kritik tablolarda RLS durumu bilinmelidir.
- Admin, mudur ve diger kullanici rolleri ayrilmalidir.
- Frontend gizleme yetki guvenligi degildir.
- Anon key ile kritik mutation yapilamamali veya kontrollu RPC ile sinirlanmalidir.

Blokaj sayilacak durumlar:

- Finansal tabloda RLS kapali ve anon mutation acik.
- Rol kontrolu sadece UI seviyesinde.
- Audit olmadan finansal mutation.

## Deploy / Runtime

Sozlesme:

- Commit atildi demek runtime dogrulandi demek degildir.
- GitHub read-back dogru dosya demektir, canli site dogru commit calistiriyor demek olmayabilir.
- Runtime acilip ilgili ekran gorulmeden "runtime verified" denmez.
- Save/mutation akisi denenmediyse acikca belirtilir.

Kanitsiz ifadeler yasak:

- "Hazir"
- "Verified"
- "Production ready"
- "Financial truth ready"

Bu ifadeler sadece ilgili kanit varsa kullanilir.

