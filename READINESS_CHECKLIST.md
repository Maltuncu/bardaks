# READINESS_CHECKLIST.md

Bu dosya Bardaks B2B icin gercek veri girişi ve production-ready oncesi kapanmasi gereken kontrol listesidir.

Durum degerleri:

- PASS
- PARTIAL
- FAIL
- UNKNOWN

Kanit yoksa PASS yazilmaz.

## Production Ready Tanimi

Sistem production-ready sayilmak icin en azindan su zincirleri uctan uca dogrulanmis olmalidir:

- Firma katalogu
- KDV haric fiyat girisi + KDV dahil toplam gosterimi (satir/genel toplam/rapor/fatura)
- Siparis olusturma
- Siparis kalem/toplam/KDV/kar hesabi
- Cari etki
- Tahsilat/odeme
- Brüt/net/komisyon ayrimi
- Maliyet ve recompute
- Audit log
- Yonetici bildirimleri
- RLS/yetki
- Soft-delete/geri alma
- Runtime dogrulama

## 1. Fiyat / KDV / Firma Katalogu

Kontrol sorulari:

- Firma fiyatlari KDV HARIC giriliyor mu? (etiket "Satis Fiyati (KDV haric)")
- Girilen KDV haric fiyat DB'ye dogrudan (donusumsuz) `birim_fiyat_kdv_haric` olarak saklaniyor mu?
- KDV dahil yalniz satir/genel toplam + rapor/fatura toplamlarinda mi gosteriliyor?
- Urun bazli KDV orani (toplam hesabinda) kullaniliyor mu?
- Firma fiyat gecmisi expire+insert mantigiyla korunuyor mu?
- Aktif/pasif fiyat mantigi dogru mu?
- Baslangic/bitiş tarihi raporlanabilir mi?
- Firma katalogu aktif fiyat kaydindan turetiliyor mu?
- Yari mamul/malzeme urunleri fiyat ekleme ve siparise siziyor mu?
- Log CHECK disi `guncellendi` gibi degerler kaldi mi?

Blokaj sayilacak durumlar:

- Girilen KDV haric fiyat dahil sanilip `/(1+kdv/100)` ile bolunup yanlis dusuk saklaniyorsa (cift donusum).
- Birim fiyat girisinde/gosteriminde KDV dahil deger kullaniliyorsa (KDV dahil yalniz toplam/rapor/fatura olmali).
- Fiyat gecmisi eziliyorsa.
- Firma katalogu ile aktif fiyat mantigi ayrisiyorsa.

## 2. Siparis Akisi

Kontrol sorulari:

- Firma secilince sadece o firmaya ait aktif satilabilir urunler geliyor mu?
- Siparis ekraninda birim fiyat KDV HARIC olarak net etiketlenmis mi? (birim = haric)
- Satir toplam ve genel toplam KDV DAHIL dogru hesaplaniyor mu? (haric * adet * (1+kdv/100))
- Siparis cari etkisini dogru olusturuyor mu?
- Siparis iptal/soft-delete cari ve kar hesaplarini geri aliyor mu?
- Kalem guncelleme cari etkisini dogru revize ediyor mu?
- Maliyet 0 iken sistem kirilmiyor mu?
- Maliyet sonra girilince kar recompute zinciri calisiyor mu?

Blokaj sayilacak durumlar:

- Birim fiyat KDV haric olarak net etiketlenmemisse VEYA satir/genel toplam (KDV dahil) yanlis hesaplaniyorsa.
- Siparis cari bakiyeyi yanlis etkiliyorsa.
- Iptal/soft-delete finansal izi bozmuyorsa.

## 3. Tahsilat / Odeme / Cari

Kontrol sorulari:

- Tahsilat tablosu gercek isletme ihtiyacini karsiliyor mu?
- Brut tahsilat firma borcunu dusuyor mu?
- Net tahsilat banka/kasa girisini temsil ediyor mu?
- POS komisyon orani ve tutari izleniyor mu?
- Nakit, havale/EFT, kart/POS, cek ayrimi var mi?
- Cek no, vade tarihi, cek durumu var mi?
- Dekont/makbuz dosyasi iliskisi var mi?
- Banka/kasa hesabi iliskisi var mi?
- Kismi odeme destekleniyor mu?
- Tahsilat siparis/fatura/cari ile eslesiyor mu?
- Yanlis tahsilat iptal/geri alma akisi var mi?

Blokaj sayilacak durumlar:

- Brut ve net tahsilat ayni anlamda kullaniliyorsa.
- POS komisyonu takip edilemiyorsa.
- Cari ozet finansal truth olarak guvenilir degilse.
- Yanlis tahsilat geri alinamiyorsa.

## 4. Maliyet / Kar

Kontrol sorulari:

- Urun maliyeti nerede tutuluyor?
- Eksik/null maliyet 0 kabul edilip sistem kirilmadan calisiyor mu?
- Kar hesabi siparis anindaki maliyetle mi, guncel maliyetle mi yapiliyor?
- Maliyet degisince eski siparis karlarinin recompute edilmesi is anlami olarak dogru mu?
- Maliyet gecmisi gerekli mi?
- `urun_maliyet_gecmisi` ihtiyaci net mi?

Blokaj sayilacak durumlar:

- Maliyet yok diye siparis veya rapor kiriliyorsa.
- Kar raporu tarihsel olarak yanlis yorumlaniyorsa.
- Maliyet degisikligi auditlenmiyorsa.

## 5. Audit Log / Yonetici Bildirimleri

Kontrol sorulari:

- Fiyat ekleme/degistirme/kaldirma loglaniyor mu?
- Siparis olusturma/duzenleme/iptal loglaniyor mu?
- Tahsilat ekleme/iptal loglaniyor mu?
- Urun/firma/maliyet islemleri loglaniyor mu?
- Actor/user bilgisi var mi?
- Eski deger/yeni deger var mi?
- Tarih/saat var mi?
- Firma/urun/siparis/tahsilat referansi var mi?
- Loglar yonetici ekraninda gorunuyor mu?
- UI bildirimi ile DB logu ayrimi net mi?

Blokaj sayilacak durumlar:

- Kritik finansal islem loglanmiyorsa.
- Logda kimin yaptigi belli degilse.
- Yonetici bildirimi sadece UI mesajindan ibaretse.

## 6. Yetki / RLS / Guvenlik

Kontrol sorulari:

- Supabase RLS acik mi?
- Admin, mudur ve kullanici rolleri ayrilmis mi?
- Anon key ile kritik tablo mutation yapilabiliyor mu?
- Kritik finansal mutation RPC uzerinden mi yapilmali?
- RPC'lerde yetki kontrolu var mi?
- Frontend tarafinda gizlenen ama DB'de acik kalan yetki acigi var mi?
- Audit ve rollback garantisi var mi?

Blokaj sayilacak durumlar:

- RLS kapali kritik tablo varsa.
- Frontend'den dogrudan finansal tablo bozulabiliyorsa.
- Rol ayrimi yoksa.

## 7. UX / Operasyon

Kontrol sorulari:

- Mudur is gunune hangi ekrandan baslayacak?
- Firma ekrani ana merkez olarak yeterli mi?
- Fiyat, siparis, tahsilat ve gecmis akislari sade mi?
- Yanlis islemde sistem uyariyor mu?
- Geri alma/pasife alma akisi anlasilir mi?
- Arayuz profesyonel B2B panel hissi veriyor mu?
- Gereksiz teknik terimler muduru yoruyor mu?

Blokaj sayilacak durumlar:

- Mudur ayni is icin farkli ekranlar arasinda kayboluyorsa.
- KDV dahil/haric gibi finansal anlamlar belirsizse.
- Yanlis islemi engelleyen veya geri aldiran akiş yoksa.

## 8. Raporlanabilirlik / Urun Analitigi

Kontrol sorulari:

- Firma bazli urun alimlari raporlanabiliyor mu?
- Fiyat gecmisi raporlanabiliyor mu?
- Satis grafigi, kar, tahsilat, acik bakiye raporlanabiliyor mu?
- Urun eklenme tarihinden beri satis ve karlilik izlenebiliyor mu?
- Pasif urunler raporda dogru davraniyor mu?
- Gecmis fiyat/maliyet degisimleri raporlari bozuyor mu?

Blokaj sayilacak durumlar:

- Finansal rapor cari/tahsilat/siparis zincirinden tutarsiz uretiliyorsa.
- Fiyat veya maliyet gecmisi olmadigi icin rapor yanlis anlam uretiyorsa.

## 9. QA / Runtime / Deploy

Kontrol sorulari:

- Son deploy hangi commit?
- Canli site hangi dosyalari calistiriyor?
- HTML/JS truncate riski var mi?
- Syntax check yapildi mi?
- Canli ekranda hangi akişlar acildi?
- Sadece kod okunarak mi, runtime'da mi dogrulandi?
- Hangi save/mutation akislari hic denenmedi?
- DB read-back yapildi mi?
- Test mutation yapildiysa temizlendi mi?

Blokaj sayilacak durumlar:

- Runtime kaniti olmadan verified denmisse.
- Canli site eski commit calistiriyorsa.
- Save akisi hic test edilmeden production hazir denmisse.

## Faz Siralama Prensibi

Once finansal dogruluk, sonra operasyonel akiş, sonra UX cilasi.

Onerilen ana sira:

1. SYSTEM-READINESS-AUDIT
2. PRICE-VAT eksik kapatma
3. ORDER-FINANCE zinciri
4. PAYMENT/CARI zinciri
5. AUDIT/NOTIFICATION zinciri
6. RLS/SECURITY denetimi
7. UX/OPERATION toparlama
8. MANAGER-PILOT

