# BARDAKS B2B — ROADMAP LOCKS

> Reality-lock geçerli. Bu dosya **kilitleri** (geçilemez kapılar, dokunulmaz dosyalar, faz sırası) kayıt altına alır. Son güncelleme: 2026-06-03.

---

## 1. AKTİF KAPI (GATE) — şu an buradayız

| Kapı | Durum | Geçiş koşulu |
|---|---|---|
| **PRE-4B.5R** (UTL loader + diagnostics) | 🔴 **OPEN** | Canlı browser'da runtime proof alınana kadar açık |
| **4B.5B1** (gerçek realtime konsolidasyon) | ⛔ **NOT ALLOWED** | PRE-4B.5R kapanmadan başlanamaz |

**Kural:** PRE-4B.5R blocker, GitHub Pages canlı runtime'da aşağıdaki kontroller `yes` dönene kadar **açık** sayılır (**closed sayılmaz**). Runtime proof yoksa "verified" denmez.

### PRE-4B.5R runtime acceptance (login sonrası, `?v=2b5fe18`)

| Alan | Beklenen |
|---|---|
| `UTL` | `true` |
| `typeof UTL.mutate.single` | `"function"` |
| `CURRENT` | `true` (login) |
| `IB_STATUS.loaded` | `true` |
| `IB_STATUS.error` | `null` (login öncesi `AUTH_PENDING` normaldir, `UTL_MISSING` DEĞİL) |
| `IB_STATUS.overrides` | `{durumIlerlet:true, durumDegistir:true}` |
| `RT_AUDIT` | `true` |
| `RT_AUDIT.wrapped.UTLMutateSingle` | `true` |
| `RT_AUDIT.error` | `null` |

---

## 2. DOSYA KİLİTLERİ (reality-lock)

Aşağıdaki dosyalar **kontrollü adım dışında değiştirilmez**:

- `index.html` — monolith, elle rewrite YOK.
- `firma_takvim.html` — dokunulmaz.
- `rapor.html` — dokunulmaz.
- Companion'lar (`uretim_batch.js`, `utl.js`, `index_bridge.js`) yalnız onaylı faz adımında, additive/minimal olarak.

**Değişmez invariantlar:** veri fiziksel silinmez (soft delete), RLS korunur, finansal hesapta yuvarlama yok / kuruş hassasiyeti korunur, mutation tek hat = `apply_batch_transition` (double-write yok).

---

## 3. REALTIME KONSOLİDASYON (4B.5B1) — kapı açılınca yapılacaklar

Kaynak: PHASE 4B.5 audit. Konsolidasyon hedefi:

```
UTL.subscribe(onChange) → tek kanal (utl-rt) → debounce(280ms) → cache.invalidate → tek render router
```

Kapatılacak bulgular (öncelik sırası):

| # | Bulgu | Aksiyon |
|---|---|---|
| **D6** | `siparis_kalemleri` index runtime'da realtime gap | UTL.subscribe + index render'a bağla |
| **D1** | `siparisler` için 2–3 katlı refresh (siparis-rt + ub-uretim-rt + index_bridge) | tek kanala indir |
| **D2** | `renderUretim` ↔ `loadActive` çift render | tek `onChange` render router |
| D3 | `siparis-rt` ad çakışması (index.html ↔ bardaks_b2b.html) | legacy izolasyonu |
| D4 | `refreshSohbetBadge` polling + realtime overlap | tekilleştir |
| D5 | `uretim_batch.js` çift script yükleme (guard'lı) | gözlemle |

Konsolidasyon sonrası hedef: index runtime'da **2 kanal → 1**, siparisler için **2–3 refresh → 1**.

---

## 4. TAMAMLANAN ADIMLAR (commit log)

| Adım | Sonuç | Commit |
|---|---|---|
| PHASE 4B.5 audit | Statik audit raporu (4 kanal, D1–D6) | — |
| 4B.5B0 sentinel | RT_AUDIT telemetry (local) | — |
| PRE-4B.5R loader fix | `uretim_batch.js` UTL-first loader | `57b2956` |
| PRE-4B.5R guard | `utl.js` `__UTL_LOADED` | `a778c04` |
| PRE-4B.5R2 sync | `index_bridge.js`: RT_AUDIT canlıya + error semantics ayrıştırma | `2b5fe18` |
| ROADMAP_LOCKS ilk | Kapı/dosya/faz kilitleri | `4cd9c5f` |

**Error semantics (4B.5R2):** `UTL_MISSING` yalnız UTL/UTL.mutate yoksa · `SB_MISSING` · `BRIDGE_FN_MISSING` · `CURRENT_MISSING` · `AUTH_PENDING` (login beklerken, kalıcı fail değil, CURRENT gelince install).

---

## 5. PHASE 4F — MANUAL FINANCIAL CUTOVER 🔒

**İş kararı:** Excel/snapshot import verileri yanlış çekilmiş olabilir. Bu nedenle import edilmiş firma değerleri, tahsilatlar, giderler, bakiyeler ve finansal toplamlar **otomatik financial truth kabul edilmez**.

**Kurallar (lock):**

- Legacy/import veri **silinmez**, ama **unverified** kabul edilir.
- Financial truth = **manuel doğrulanmış** veri.
- Sistem aktif kullanıma geçmeden önce firma bakiyeleri, alınan ödemeler, giderler ve aktif siparişler **admin/müdür tarafından elle doğrulanacak**.
- **"Financial truth ready"** ancak manual cutover tamamlanınca denebilir.
- Rapor / firma_takvim / index finansal toplamlarında legacy unverified veri ile verified financial data **karışmayacak**.
- Financial parity raporlarında Excel/import verisi **verified kabul edilmeyecek**.

**Önerilen (ileride uygulanacak — bu turda schema DEĞİŞMEDİ) alanlar:**

- `source`: `legacy_import` / `manual` / `system`
- `verified`: `true` / `false`
- `verified_by`
- `verified_at`

**Cutover checklist:**

1. Firma listesi doğrulandı.
2. Her firma için açılış bakiyesi girildi veya sıfırlandı.
3. Alınan ödemeler manuel girildi.
4. Giderler manuel girildi.
5. Aktif siparişler doğrulandı.
6. Rapor / firma_takvim / index aynı finansal sonucu gösteriyor.
7. Legacy/import veri financial truth'tan ayrıldı.
8. Admin/müdür onayı verildi.
9. Sistem aktif kullanım moduna alındı.

---

## 6. PHASE UX — PROFESSIONAL UI AUDIT & REDESIGN 🔒

**Ürün hedefi:** İç sistem profesyonel, sade, rahat kullanılabilir bir B2B operasyon paneli olacak.

**Kurallar (lock):**

- Bu faz, realtime/mutation stabilitesi ve financial cutover planı **netleşmeden büyük rewrite olarak başlamaz**.
- İç panel: **yoğun ama ferah** operasyon merkezi.
- İmalathane ekranı: **mobil, hızlı, çok sade**.
- Admin/müdür ekranı: **detaylı ama düzenli ve taranabilir**.
- Butonlar, sekmeler, durum renkleri ve aksiyonlar **standardize** edilecek.
- Gereksiz hero/landing/gradient/orb **YOK**.
- Kart içinde kart **YOK**.
- Alert yerine **kontrollü banner/toast/state** katmanı.
- Yerel Excel hissi değil, **profesyonel B2B SaaS/operasyon paneli** hissi.
- Tasarım değişiklikleri **veri doğruluğu ve runtime stabilitesi bozulmadan küçük fazlarla**.

---

## 7. PHASE CUSTOMER PORTAL — INVITE-ONLY FIRM PORTAL 🔒

**İş hedefi:** Firmalara link verilip kendi siparişlerini sistemden geçmeleri uzun vadeli doğru hedeftir; ama iç sistem **single-truth + financial cutover + security** tamamlanmadan **açılmayacak**.

**Kurallar (lock):**

- İlk sürüm **herkese açık kayıt YOK** — **davetli** firma portalı.
- Firma kullanıcıları **sadece kendi `firma_id`** verisini görebilecek (**RLS/security şart**).
- Firma: sipariş oluşturabilecek; eski siparişten **tekrar sipariş** verebilecek; **sipariş durumu** takip edebilecek; **dosya/not** ekleyebilecek.
- **Ödeme/bakiye görünümü** ancak **verified financial data** (PHASE 4F) tamamlandıktan sonra açılacak.
- Şimdilik **implementation YOK** — sadece roadmap lock.

---

## 8. ÜRÜN ROADMAP (uzun vade — MİMARİ_ANALİZ_v1)

Sıra kilidi: **paranın gerçeği → disiplin/kontrol → ölçek/zeka.**

| Faz | Modüller |
|---|---|
| **Faz A** | 3. Net Kâr V2 → 2. Banka/Kasa/POS Mutabakat |
| **Faz B** | 5. Alarm Motoru → 4. RBAC (granular yetki) → 6. Dosya/Evrak |
| **Faz C** | 1. Stok & Hammadde (**MVP-hafif**, reçete otomatik düşüm en son) → 7. AI Karar Destek |

**Lock:** Modül 1 (otomatik reçete düşümü) küçük işletmede bakım yükü riski → Faz C, MVP-hafif başlar (rezervasyon önerisi, otomatik düşüm değil).

---

## 9. GLOBAL LOCKS & AÇIK FOLLOW-UP'LAR

- 🔴 **Runtime proof kapanmadan 4B.5B1 YOK.**
- 🔴 **Manual financial cutover (PHASE 4F) tamamlanmadan "financial truth ready" YOK.**
- 🔴 **UX redesign (PHASE UX) büyük rewrite olarak başlamayacak** — küçük fazlar, stabilite korunarak.
- 🔴 **Customer portal (PHASE 7) implementation, security/RLS + verified financial data olmadan başlamayacak.**

Açık işler:

- **Runtime proof** (PRE-4B.5R) — browser connector bağlanınca veya kullanıcı manuel; bu kapanmadan 4B.5B1 yok.
- **RT_AUDIT telemetry yorumu** — login sonrası `durumDegistir/durumIlerlet` ile `duplicateWindowHits` ölçümü (D1/D2 kanıtı).
