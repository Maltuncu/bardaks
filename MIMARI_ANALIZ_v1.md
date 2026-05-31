# Bardaks B2B — Kurumsal Katman Mimari Analizi v1

> Mevcut sistem (RLS, Audit, Soft Delete, Durum Makinesi, Cari, Sipariş, Üretim Panosu, Finans, Nakit Projeksiyon, Risk, KPI, Gider, Brüt Kâr, Yedek, Pano, Bildirim) **canlı ve tamam**. Bu doküman yalnızca **eksik kurumsal katmanları** tasarlar. Mevcut tablolar (`urunler`, `siparis_kalemleri`, `siparisler`, `firmalar`, `expenses`, `tahsilatlar`, `audit_logs`, `kullanicilar`) korunur, üzerine inşa edilir.

## ⚠️ Mimar Notu — Önce Bunu Oku

Modül 1 (Stok & Hammadde / reçete-bazlı otomatik düşüm) **daha önce bilerek 'over-engineering' diye kırmızı çizgiye konmuştu.** Üretim hacmi büyüdüyse mantıklı — ama küçük işletmede tam otomatik reçete düşümü, her siparişte imalathaneye **reçete bakım yükü** bindirir ve sistemi yavaşlatır. Tavsiyem: her modülü **MVP-hafif** başlat, otomasyonu sonra ekle.

## Öncelik Matrisi (mimar tavsiyesi)

| Modül | Değer | Karmaşıklık | Küçük-işl. uyumu | Önerilen Faz |
|---|---|---|---|---|
| 3. Net Kâr V2 | ★★★★★ | Düşük | Mükemmel | **Faz A (ilk)** |
| 2. Banka/Kasa/POS Mutabakat | ★★★★★ | Orta | İyi | **Faz A** |
| 5. Alarm Motoru | ★★★★ | Düşük | İyi | **Faz B** |
| 4. RBAC (granular yetki) | ★★★ | Orta | Orta | Faz B |
| 6. Dosya/Evrak | ★★★ | Düşük | İyi | Faz B |
| 1. Stok & Hammadde | ★★★★ | **Yüksek** | Riskli (bakım yükü) | **Faz C (en son, MVP-hafif)** |
| 7. AI Karar Destek | ★★★★ | Orta | İyi | Faz C |

**Mantık:** önce paranın gerçeğini gör (Net Kâr V2 + Banka mutabakat), sonra sistem seni uyarsın (Alarm), sonra yetki/evrak disiplini, en son ağır olan stok ve akıllı katman.

---

# MODÜL 3 — GERÇEK NET KÂR MOTORU V2
*(En yüksek değer/çaba oranı — buradan başla)*

**1. Neden gerekli:** Şu an kâr = Satış − Ürün Maliyeti. Kargo, komisyon (POS/B2B), iskonto, promosyon, iade ve fire görünmüyor → kâr **şişik**. Gerçek kârlılık kanal ve müşteri bazında saklı.

**2. Veri modeli:** Siparişe bağlı çok-tipli ek maliyet kalemleri. Mevcut `siparisler.brut_kar` korunur; üstüne `net_kar` katmanı.

**3. SQL şeması:**
```sql
CREATE TABLE siparis_ek_maliyet (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  siparis_id uuid REFERENCES siparisler(id),
  tip text CHECK (tip IN ('kargo','komisyon','iskonto','promosyon','iade','fire')),
  tutar numeric NOT NULL CHECK (tutar>=0),
  aciklama text, created_by text, olusturma timestamptz DEFAULT now(),
  is_deleted boolean DEFAULT false
);
ALTER TABLE siparisler ADD COLUMN net_kar numeric DEFAULT 0;
-- net_kar = brut_kar - SUM(ek_maliyet). Trigger ile (mevcut fn_recompute_brut_kar mantığına benzer).
```

**4. İş akışı:** Sipariş detayında '+ Ek Maliyet' → tip+tutar gir → trigger net_kar'ı günceller. Toplu: ay sonu kargo/komisyon faturası tek seferde dağıtılır.

**5. Dashboard:** Panele 'Gerçek Net Kâr' (brüt yanına), 'Maliyet Kırılımı' pasta (ürün/kargo/komisyon/iade/fire), 'Kanal Kârlılığı' (B2B vs POS).

**6. Riskler:** Ek maliyet girilmezse net_kar=brüt kalır (yanıltıcı). Çözüm: girilmeyen sipariş için 'maliyet eksik' rozeti (mevcut maliyet-uyarı paterni).

**7. MVP:** `siparis_ek_maliyet` tablosu + manuel giriş + net_kar trigger + panelde tek satır.
**8. İleri:** Otomatik komisyon (POS hareketinden), ay-sonu toplu kargo dağıtımı, kanal/ürün kârlılık raporu.

---

# MODÜL 2 — BANKA / KASA / POS MUTABAKAT

**1. Neden gerekli:** Cari tahsilat kaydı 'parayı aldım' der ama gerçekten bankaya/kasaya girdi mi? Eksik/hatalı tahsilatlar ve POS komisyon kayıpları görünmez.

**2. Veri modeli:** Hesaplar (kasa/banka/POS) + her hesabın para hareketleri + cari tahsilat ↔ banka hareketi eşleştirme.

**3. SQL şeması:**
```sql
CREATE TABLE accounts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  ad text NOT NULL,                       -- 'Kasa','İş Bankası','Ziraat','POS'
  tip text CHECK (tip IN ('kasa','banka','pos')),
  banka_adi text, iban text,
  acilis_bakiye numeric DEFAULT 0, aktif boolean DEFAULT true
);
CREATE TABLE financial_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id uuid REFERENCES accounts(id),
  tip text CHECK (tip IN ('gelir','gider','transfer','tahsilat','odeme')),
  yon int CHECK (yon IN (-1,1)),          -- +1 giriş, -1 çıkış
  tutar numeric NOT NULL,
  tarih date NOT NULL DEFAULT current_date,
  karsi_account_id uuid REFERENCES accounts(id),   -- transfer için
  ilgili_tahsilat_id uuid REFERENCES tahsilatlar(id),
  ilgili_expense_id uuid REFERENCES expenses(id),
  ilgili_firma_id uuid REFERENCES firmalar(id),
  mutabakat_durumu text DEFAULT 'bekliyor' CHECK (mutabakat_durumu IN ('bekliyor','eslesti')),
  aciklama text, created_by text, olusturma timestamptz DEFAULT now()
);
-- Hesap bakiyesi = acilis_bakiye + SUM(yon*tutar). View ile hesapla.
CREATE VIEW hesap_bakiye AS
 SELECT a.id, a.ad, a.tip, a.acilis_bakiye + COALESCE(SUM(t.yon*t.tutar),0) AS bakiye
 FROM accounts a LEFT JOIN financial_transactions t ON t.account_id=a.id GROUP BY a.id;
```

**4. İş akışı:** Tahsilat girilince opsiyonel 'hangi hesaba düştü?' → financial_transaction oluşur, mutabakat 'eslesti'. Ay sonu: banka ekstresi ↔ sistem; eşleşmeyen = eksik tahsilat raporu.

**5. Dashboard:** 'Hesaplar' kartı (her hesabın bakiyesi), 'Eşleşmeyen Hareketler' listesi, POS komisyon özeti.

**6. Riskler:** Çift kayıt (hem tahsilat hem transaction) → tek kaynak: tahsilat girince transaction OTOMATİK üret (trigger). Manuel banka hareketi ayrı.

**7. MVP:** accounts + financial_transactions + hesap bakiye kartı + manuel hareket girişi.
**8. İleri:** Banka ekstresi CSV import + otomatik eşleştirme algoritması (tutar+tarih+firma), uyumsuzluk alarmı.

---

# MODÜL 5 — ERP ALARM MOTORU

**1. Neden gerekli:** Sistem raporluyor ama uyarmıyor. Kritik durumlar (nakit negatif, stok bitti, tahsilat gecikti) gözden kaçıyor.

**2. Veri modeli:** Kural tanımları + üretilen alarmlar. Mevcut `bildirimler` + Make.com ile entegre.

**3. SQL şeması:**
```sql
CREATE TABLE alert_rules (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tip text CHECK (tip IN ('risk_dusuk','nakit_negatif','kritik_stok','tahsilat_gecikme','marj_dusuk')),
  esik_deger numeric, aktif boolean DEFAULT true,
  kanal text DEFAULT 'inapp'   -- inapp / whatsapp / email
);
CREATE TABLE alerts (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  rule_id uuid REFERENCES alert_rules(id),
  seviye text CHECK (seviye IN ('info','warning','critical')),
  mesaj text NOT NULL,
  ilgili_entity text, ilgili_id uuid,
  durum text DEFAULT 'yeni' CHECK (durum IN ('yeni','okundu','cozuldu')),
  olusturma timestamptz DEFAULT now()
);
```

**4. İş akışı:** Edge Function (pg_cron veya zamanlı) kuralları değerlendirir → eşik aşılırsa `alerts` ekler → mevcut bildirim/Make.com akışı tetiklenir. Tekrar eden alarm bastırma (aynı kural 24s içinde 1 kez).

**5. Dashboard:** Panel üstünde 'Alarm Merkezi' (kırmızı=critical), nav badge, 'cozuldu' işaretleme.

**6. Riskler:** Alarm spam'i → eşik + cooldown şart. Yanlış pozitif → eşikleri ayarlardan düzenlenebilir yap.

**7. MVP:** alert_rules + alerts + 2 kural (nakit negatif, tahsilat gecikme) + panel kartı.
**8. İleri:** Tüm kurallar + WhatsApp push + trend bazlı (marj düşüş eğilimi) tahminsel alarm.

---

# MODÜL 4 — GELİŞMİŞ YETKİ MATRİSİ (RBAC)

**1. Neden gerekli:** 3 sabit rol esnek değil. 'Müdür tahsilat görsün ama silemesin' gibi ince ayar yapılamıyor.

**2. Veri modeli:** İzinler + roller + rol-izin eşleşmesi. Mevcut `kullanicilar.rol` → `role_id`.

**3. SQL şeması:**
```sql
CREATE TABLE permissions (id text PRIMARY KEY, aciklama text);
-- 'siparis_gor','siparis_duzenle','fiyat_degistir','tahsilat_gor','tahsilat_sil','gider_ekle',...
CREATE TABLE roles (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, ad text UNIQUE);
CREATE TABLE role_permissions (role_id uuid REFERENCES roles(id), permission_id text REFERENCES permissions(id), PRIMARY KEY(role_id,permission_id));
ALTER TABLE kullanicilar ADD COLUMN role_id uuid REFERENCES roles(id);
-- RLS yardımcı:
CREATE FUNCTION auth_has(p text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM kullanicilar k JOIN role_permissions rp ON rp.role_id=k.role_id
   WHERE k.auth_id=auth.uid() AND rp.permission_id=p);
$$;
-- RLS: USING (auth_has('tahsilat_gor')) gibi.
```

**4. İş akışı:** Geçiş: 3 mevcut rolü roles'a taşı, role_permissions'ı bugünkü davranışla doldur (sıfır regresyon). Sonra ince ayar.

**5. Dashboard:** Admin'e 'Yetki Yönetimi' ekranı — rol × izin matrisi (checkbox tablosu).

**6. Riskler:** RLS'te her tabloda auth_has çağrısı → performans. Çözüm: STABLE fn + az sayıda izin. Yanlış geçiş = kilitlenme → önce mevcut davranışı birebir kopyala.

**7. MVP:** Tablolar + auth_has + 3 rolü migrate + matris ekranı (salt-okunur).
**8. İleri:** Kullanıcıya özel izin override, izin bazlı UI gizleme, denetim (kim neyi yetkisiyle yaptı — audit'e bağla).

---

# MODÜL 6 — DOSYA & EVRAK YÖNETİMİ

**1. Neden gerekli:** Baskı onayı, tasarım, sözleşme, logo siparişe bağlı değil → WhatsApp'ta kayboluyor, versiyon karışıyor.

**2. Veri modeli:** Belge kayıtları + Supabase Storage + versiyonlama.

**3. SQL şeması:**
```sql
CREATE TABLE belgeler (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  siparis_id uuid REFERENCES siparisler(id),
  firma_id uuid REFERENCES firmalar(id),
  tip text CHECK (tip IN ('pdf','tasarim','logo','baski_onayi','sozlesme')),
  dosya_yolu text NOT NULL,            -- Storage path: belgeler/{siparis_id}/{uuid}.ext
  versiyon int DEFAULT 1,
  parent_belge_id uuid REFERENCES belgeler(id),  -- yeni versiyon eskiyi işaret eder
  onay_durumu text DEFAULT 'bekliyor' CHECK (onay_durumu IN ('bekliyor','onaylandi','reddedildi')),
  yukleyen text, olusturma timestamptz DEFAULT now(), is_deleted boolean DEFAULT false
);
-- Storage bucket 'belgeler' (private, RLS: admin/mudur).
```

**4. İş akışı:** Sipariş detayına 'Belge Ekle' → Storage'a yükle → kayıt. Baskı onayı: yükle → müşteriye gönder → 'onaylandi'. Yeni dosya = yeni versiyon (eski silinmez).

**5. Dashboard:** Sipariş detayında 'Belgeler' sekmesi (tip ikonları + versiyon + onay rozeti + indir).

**6. Riskler:** Storage maliyeti/boyut → tip başına limit. Erişim sızıntısı → bucket private + RLS şart (paylaşım butonu YOK — mevcut güvenlik kuralı).

**7. MVP:** belgeler tablosu + Storage bucket + yükle/indir + versiyon.
**8. İleri:** Baskı onay akışı (müşteri linki), önizleme, e-imza/sözleşme durumu.

---

# MODÜL 1 — STOK & HAMMADDE YÖNETİMİ
*(En yüksek karmaşıklık — MVP-hafif başla, otomasyonu sona bırak)*

**1. Neden gerekli:** '5000 ürün siparişinde kaç bardak/kapak/koli düşer' bilinmiyor → ambalaj/hammadde aniden bitiyor, maliyet net değil.

**2. Veri modeli:** Hammadde kartı + ürün reçetesi (BOM) + stok hareketi + rezervasyon. Mevcut `urunler`'e bağlanır.

**3. SQL şeması:**
```sql
CREATE TABLE hammaddeler (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  kod text, ad text NOT NULL,
  birim text CHECK (birim IN ('kg','adet','koli','litre')),
  birim_maliyet numeric DEFAULT 0,
  mevcut_stok numeric DEFAULT 0,
  min_stok numeric DEFAULT 0, kritik_stok numeric DEFAULT 0,
  fire_orani numeric DEFAULT 0          -- % otomatik fire payı
);
CREATE TABLE urun_recete (              -- 1 ürün için hammadde sarfı (BOM)
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  urun_id uuid REFERENCES urunler(id),
  hammadde_id uuid REFERENCES hammaddeler(id),
  miktar numeric NOT NULL               -- 1 adet ürün başına
);
CREATE TABLE stok_hareketleri (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  hammadde_id uuid REFERENCES hammaddeler(id),
  tip text CHECK (tip IN ('giris','cikis','sayim','fire','rezervasyon','rezerv_iptal')),
  miktar numeric NOT NULL,
  kaynak text, siparis_id uuid REFERENCES siparisler(id),
  aciklama text, yapan text, zaman timestamptz DEFAULT now()
);
```

**4. İş akışı (MVP-hafif önerisi):** Sipariş 'uretimde'ye geçince reçeteye göre **rezervasyon** önerisi gösterilir (otomatik düşmez). 'hazir'da onayla → stok düşer (cikis hareketi + fire). Otomatik düşüm Faz C-ileri.

**5. Dashboard:** 'Stok Durumu' (renkli: yeşil/sarı=kritik/kırmızı=min altı), 'Bu siparişte düşecek hammadde' önizleme, sayım ekranı.

**6. Riskler:** ⚠️ **Reçete bakımı imalathaneye yük** — 49 ürün × hammadde girişi. Yanlış reçete = yanlış stok. Çözüm: sadece kritik ambalaj (bardak/kapak/koli) ile başla, gıda hammaddesini sonra.

**7. MVP:** hammaddeler + stok_hareketleri + manuel giriş/çıkış + min/kritik alarm (Alarm Motoru'na bağlı). Reçete opsiyonel.
**8. İleri:** urun_recete + sipariş bazlı otomatik rezervasyon/düşüm, lot/parti, FIFO maliyet, tedarikçi sipariş önerisi.

---

# MODÜL 7 — AI KARAR DESTEK KATMANI

**1. Neden gerekli:** Veri var ama 'ne yapmalıyım?' yok. Yönetici sayıları yorumlamak zorunda.

**2. Veri modeli:** Üretilen öneriler. Veri kaynağı mevcut tablolar (siparisler, tahsilatlar, risk, marj).

**3. SQL şeması:**
```sql
CREATE TABLE oneriler (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tip text,            -- 'uyuyan_musteri','riskli_musteri','marj_erozyonu','nakit_sikisikligi','ara'
  firma_id uuid REFERENCES firmalar(id),
  mesaj text NOT NULL,
  oncelik int DEFAULT 2,   -- 1 yüksek
  durum text DEFAULT 'yeni' CHECK (durum IN ('yeni','goruldu','uygulandi','yoksay')),
  gecerlilik date, olusturma timestamptz DEFAULT now()
);
```

**4. Analiz algoritmaları (önce kural-bazlı, sonra AI):**
- Son sipariş > 90 gün → 'X müşteri uyumakta, ara'
- Risk skoru ay-ay artıyor → 'X riskli hale geliyor'
- Ürün marjı 3 ayda düşüyor → 'X ürün marj erozyonu'
- 30g nakit projeksiyon < 0 → 'Nakit sıkışıklığı yaklaşıyor'

**5. Dashboard:** Panelde 'Bugün Ne Yapmalıyım?' kartı — öncelikli öneri listesi (uygulandı/yoksay butonları).

**6. Riskler:** Kötü öneri = güven kaybı. Çözüm: önce şeffaf kural-bazlı (neden'i göster), AI'yı (mevcut Claude API anahtarı) açıklama/önceliklendirme için kullan, karar için değil.

**7. MVP:** oneriler tablosu + 4 kural (Edge Function cron) + panel kartı.
**8. İleri:** Claude API ile doğal dil öneri + neden açıklaması, öneri etkisi takibi (uyguladım → sonuç).

---

## Önerilen Uygulama Sırası
1. **Faz A:** Net Kâr V2 → Banka/Kasa Mutabakat (paranın gerçeği)
2. **Faz B:** Alarm Motoru → RBAC → Dosya/Evrak (disiplin & kontrol)
3. **Faz C:** Stok (MVP-hafif) → AI Karar Destek (ölçek & zeka)

Her faz: önce DB (migration, push gerekmez) → sonra arayüz (tek push). Mevcut paternler (trigger, RLS, audit, soft-delete) aynen kullanılır.
