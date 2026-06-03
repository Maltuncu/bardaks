# BARDAKS — BRAND & VISUAL GUIDE

> Bardaks görsel kimliği ve illüstrasyon kullanım kuralları. Bu döküman **referanstır** — uygulama (kod/asset) ayrı, onaylı adımlarda yapılır. Reality-lock geçerli. Son güncelleme: 2026-06-03.

---

## 1. Bardaks Visual Identity

- Sıcak **butik kafe / patisserie** hissi.
- Krem / off-white sıcaklık (hafif, baskın değil).
- **Bardaks mavisi** tek-renk line art.
- **Monoline / mürekkep-eskiz** (ink sketch) tarz.
- Bol **negatif alan**.
- Merkezi, küçük tek obje.
- Zanaatkâr, sakin, **kurumsal-olmayan**.
- Gradient YOK · parlak/glossy efekt YOK · çok-renkli illüstrasyon paleti YOK.
- Hafif tarama/detay çizgileri var, ağır dolgu yok.

---

## 2. Illustration Subjects

- Kafe dükkân cephesi (storefront)
- Kahve fincanı
- Kek / tatlı dilimleri
- Kruvasan / pasta
- Müşteri / sosyal etkileşim ikonu
- Bardaks logosu

---

## 3. Usage Rules

**İllüstrasyon KULLAN:**

- Login
- Loading
- Empty state'ler
- Onboarding / help
- Müşteri portalı karşılama
- "Sipariş yok" (no orders yet)
- "Üretim kuyruğu boş" (production queue empty)
- "Finansal doğrulama bekliyor" (financial verification pending)
- "Firma seç" (select a firm)
- Davet / müşteri-facing sayfalar

**İllüstrasyon KULLANMA:**

- Yoğun admin dashboard dekorasyonu
- Veri hiyerarşisini değiştirmek/yerini almak
- Tek operasyon ekranında birden fazla dekoratif görsel
- İç panel içinde pazarlama "hero"su
- Büyük renkli yüzeyler

---

## 4. UI Direction

| Katman | Yön |
|---|---|
| **Admin / iç panel** | Data-first, nötr, sakin, **mavi aksan**; illüstrasyon **yalnız** empty/idle state'lerde. |
| **Müşteri portalı** | Daha sıcak, daha çok illüstrasyon — ama yine sade ve temiz. |

**Hedef:** Sıcak zanaatkâr Bardaks marka dili + Apple-benzeri sakin netlik + profesyonel B2B operasyon kullanılabilirliği.

---

## 5. Color Discipline

- **Bardaks mavisi** = marka aksanı (aktif sekme, primary action, seçili durum, küçük gösterge, link/ikon vurgusu).
- **Krem** = ince sıcaklık dokunuşu, **baskın defter zemini DEĞİL**.
- Beyaz / nötr yüzeyler.
- **Semantik kırmızı/yeşil** yalnız durumlar için (borç/kâr, uyarı/onay).
- Aşırı renk paleti YOK.

---

## 6. Future First Application

Önerilen ilk UI kullanımı (ayrı, onaylı adımda):

- **"Finansal doğrulama bekliyor"** empty-state / finguard alanı.
- Küçük **monoline Bardaks mavisi** illüstrasyon + bol negatif alan.
- **Veri davranışı değişmez.**
- **index.html rewrite YOK** — companion ile, finguard redaksiyonu bozulmadan.

---

## Notlar

- Bu döküman yalnız **görsel dil**; faz/kapı kilitleri için bkz. `ROADMAP_LOCKS.md`.
- İllüstrasyonları kullanmak için repo'ya **asset dosyaları** (tek-renk monoline SVG/PNG) gerekir — kullanıcı sağlar veya tarife uygun üretilir; her ikisi de ayrı onaylı adım.
- Admin paneli **data-first** kalır; bu kılavuz onu landing'e çevirmez.
