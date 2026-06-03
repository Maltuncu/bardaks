# BARDAKS B2B — ROADMAP LOCKS

> Reality-lock geçerli. Bu dosya **kilitleri** (geçilemez kapılar, dokunulmaz dosyalar, faz sırası) kayıt altına alır. Son güncelleme: 2026-06-03.

---

## 1. AKTİF KAPI (GATE) — şu an buradayız

| Kapı | Durum | Geçiş koşulu |
|---|---|---|
| **PRE-4B.5R** (UTL loader + diagnostics) | ✅ **CLOSED** | Canlı runtime proof alındı (IB loaded/error null/overrides true, RT_AUDIT ok) |
| **4B.5B1A** (observe-only router) | ✅ **VERIFIED** | Deterministik default-load doğrulandı (versiyonlu URL; observe mode/subscribed/error-null) |
| **4B.5B1B** (gerçek realtime konsolidasyon) | ⛔ **NOT ALLOWED** | **Gerçek N=1 event baseline ölçülmeden başlanamaz** |

**Kural:** Bir kapı, canlı runtime'da kanıt alınana kadar **açık** sayılır (**closed sayılmaz**). Runtime proof yoksa "verified" denmez.

### 4B.5B1A observe baseline — açık ölçüm
- **Real N=1 event baseline: PENDING.** Observe sayaçları (`events`, `duplicateCandidateCount`, `lastEvent`, `RT_AUDIT.duplicateWindowHits`) henüz **gerçek bir operasyonla** ölçülmedi.
- **Sentetik production order YASAK** — açık onay olmadan oluşturulmayacak. Terminal siparişler zorla değiştirilmeyecek.
- Baseline, **doğal operasyona** bırakıldı: gerçek bir `bekleyen→uretimde`/`uretimde→hazir` geçişi olduğunda read-back ile ölçülecek.

### PRE-4B.5R runtime acceptance (geçti)
`UTL=true` · `typeof UTL.mutate.single="function"` · `IB_STATUS.loaded=true` · `IB_STATUS.error=null` · `overrides={durumIlerlet:true,durumDegistir:true}` · `RT_AUDIT=true`/`error=null`. Login öncesi `IB_STATUS.error="AUTH_PENDING"` normaldir (`UTL_MISSING` değil).

---

## 2. DOSYA KİLİTLERİ (reality-lock)

Aşağıdaki dosyalar **kontrollü adım dışında değiştirilmez**:

- `index.html` — monolith, elle rewrite YOK. (Companion script tag'lerine `?v=` ekleme = Seçenek 2; **henüz onaylanmadı**.)
- `firma_takvim.html` — dokunulmaz.
- `rapor.html` — dokunulmaz.
- Companion'lar (`uretim_batch.js`, `utl.js`, `index_bridge.js`) yalnız onaylı faz adımında, additive/minimal olarak.

**Değişmez invariantlar:** veri fiziksel silinmez (soft delete), RLS korunur, finansal hesapta yuvarlama yok / kuruş hassasiyeti korunur, mutation tek hat = `apply_batch_transition` (double-write yok).

---

## 3. REALTIME KONSOLİDASYON (4B.5B1B) — kapı açılınca yapılacaklar

Kaynak: PHASE 4B.5 audit. Konsolidasyon hedefi:

```
UTL.subscribe(onChange) → tek kanal → debounce(280ms) → cache.invalidate → tek render router
```

Kapatılacak bulgular (öncelik sırası):

| # | Bulgu | Aksiyon |
|---|---|---|
| **D6** | `siparis_kalemleri` index runtime'da realtime gap | tek kanala bağla |
| **D1** | `siparisler` için 2–3 katlı refresh (siparis-rt + ub-uretim-rt + index_bridge) | tek kanala indir |
| **D2** | `renderUretim` ↔ `loadActive` çift render | tek `onChange` render router |
| D3 | `siparis-rt` ad çakışması (index.html ↔ bardaks_b2b.html) | legacy izolasyonu |
| D4 | `refreshSohbetBadge` polling + realtime overlap | tekilleştir |
| D5 | `uretim_batch.js` çift script yükleme (guard'lı) | gözlemle |

**Not:** 4B.5B1A'daki geçici `rtc-observe-rt` observe kanalı **kalıcı mimari değildir** — final konsolidasyonda +1 observe channel kalmayacak.

Konsolidasyon sonrası hedef: index runtime'da **2 kanal → 1**, siparisler için **2–3 refresh → 1**.

---

## 4. TAMAMLANAN ADIMLAR (commit log)

| Adım | Sonuç | Commit |
|---|---|---|
| PHASE 4B.5 audit | Statik audit (4 kanal, D1–D6) | — |
| PRE-4B.5R loader fix | `uretim_batch.js` UTL-first loader | `57b2956` |
| PRE-4B.5R guard | `utl.js` `__UTL_LOADED` | `a778c04` |
| PRE-4B.5R2 sync | `index_bridge.js`: RT_AUDIT canlıya + error semantics | `2b5fe18` |
| ROADMAP_LOCKS ilk | Kapı/dosya/faz kilitleri | `4cd9c5f` |
| Roadmap locks (4F/UX/portal) | Financial cutover + ürün kilitleri | `780f4fd` |
| 4B.5B1A observe router | Observe-only telemetry (RT_CONSOLIDATE) | `25d00de` |
| 4B.5B1A cache-bust | `uretim_batch.js` loader → `index_bridge.js?v=…` (deterministik default-load) | `15f3b70` |
| **4F.0 finguard** | Legacy import firma alacak/bakiye UI redaksiyonu (finguard.js companion) | `ff20bbc` |

**Error semantics (4B.5R2):** `UTL_MISSING` yalnız UTL/UTL.mutate yoksa · `SB_MISSING` · `BRIDGE_FN_MISSING` · `CURRENT_MISSING` · `AUTH_PENDING` (login beklerken, CURRENT gelince install).

---

## 5. PHASE 4F — MANUAL FINANCIAL CUTOVER 🔒

> **4F.0 DONE (deployed + verified, commit `ff20bbc`):** `finguard.js` companion devrede — legacy/import firma **alacak/bakiye** değerleri UI'da (renderPanel + renderFinans) gizlendi, yerine "Finansal doğrulama bekliyor" gösteriliyor. **Yalnız görsel redaksiyon; veri silinmedi, DB değişmedi, index.html'e dokunulmadı.** Functional + **default-load verified: yes**. Manual Financial Cutover hâlâ gerekli ("financial truth ready" DENMEDİ).

**İş kararı:** Excel/snapshot import verileri yanlış çekilmiş olabilir → import edilmiş firma değerleri, tahsilatlar, giderler, bakiyeler ve finansal toplamlar **otomatik financial truth kabul edilmez**.

**Kurallar (lock):**
- Legacy/import veri **silinmez**, ama **unverified** kabul edilir.
- Financial truth = **manuel doğrulanmış** veri.
- Sistem aktif kullanıma geçmeden önce firma bakiyeleri, alınan ödemeler, giderler ve aktif siparişler **admin/müdür tarafından elle doğrulanacak**.
- **"Financial truth ready"** ancak manual cutover tamamlanınca denebilir.
- Rapor / firma_takvim / index toplamlarında legacy unverified veri ile verified financial data **karışmayacak**.

**Önerilen alanlar (ileride; bu turda schema DEĞİŞMEDİ):** `source` (legacy_import/manual/system), `verified`, `verified_by`, `verified_at`.

**Cutover checklist:** 1) Firma listesi doğrulandı · 2) Açılış bakiyesi girildi/sıfırlandı · 3) Ödemeler manuel girildi · 4) Giderler manuel girildi · 5) Aktif siparişler doğrulandı · 6) Rapor/firma_takvim/index aynı sonucu gösteriyor · 7) Legacy veri truth'tan ayrıldı · 8) Admin/müdür onayı · 9) Aktif kullanım moduna alındı.

---

## 6. PHASE UX — PROFESSIONAL UI AUDIT & REDESIGN 🔒

İç sistem profesyonel, sade, rahat bir B2B operasyon paneli olacak.

**Kurallar (lock):** realtime/mutation stabilitesi + financial cutover netleşmeden **büyük rewrite YOK** · iç panel yoğun ama ferah · imalathane ekranı mobil/hızlı/sade · admin/müdür ekranı detaylı ama düzenli · buton/sekme/durum renkleri standardize · hero/landing/gradient/orb YOK · kart içinde kart YOK · alert yerine banner/toast/state · Excel hissi değil B2B SaaS hissi · değişiklikler **küçük fazlarla, stabilite korunarak**.

---

## 7. PHASE CUSTOMER PORTAL — INVITE-ONLY FIRM PORTAL 🔒

Firmalara link verip kendi siparişlerini geçmeleri uzun vadeli hedef; ama iç sistem **single-truth + financial cutover + security** tamamlanmadan **açılmayacak**.

**Kurallar (lock):** herkese açık kayıt YOK (davetli) · firma yalnız kendi `firma_id` verisini görür (**RLS/security şart**) · sipariş oluşturma + eski siparişten tekrar sipariş + durum takibi + dosya/not · **ödeme/bakiye görünümü** ancak **verified financial data** (4F) sonrası · şimdilik **implementation YOK**.

---

## 8. ÜRÜN ROADMAP (uzun vade — MİMARİ_ANALİZ_v1)

Sıra kilidi: **paranın gerçeği → disiplin/kontrol → ölçek/zeka.**

| Faz | Modüller |
|---|---|
| **Faz A** | 3. Net Kâr V2 → 2. Banka/Kasa/POS Mutabakat |
| **Faz B** | 5. Alarm Motoru → 4. RBAC → 6. Dosya/Evrak |
| **Faz C** | 1. Stok & Hammadde (**MVP-hafif**) → 7. AI Karar Destek |

**Lock:** Modül 1 (otomatik reçete düşümü) → Faz C, MVP-hafif (rezervasyon önerisi, otomatik düşüm değil).

---

## 9. GLOBAL LOCKS & AÇIK FOLLOW-UP'LAR

- ✅ **PRE-4B.5R: CLOSED** (runtime verified).
- ✅ **4B.5B1A observe router: deterministic default-load VERIFIED** (versiyonlu URL, commit `15f3b70`).
- ✅ **4F.0 finguard: deployed + default-load VERIFIED** (commit `ff20bbc`) — legacy/import firma alacak/bakiye UI'da gizli; **yalnız görsel redaksiyon, veri silinmedi**; Manual Financial Cutover hâlâ gerekli ("financial truth ready" yok).
- 🟡 **Real N=1 event baseline: PENDING** — doğal operasyona bırakıldı; observe sayaçları gerçek bir geçişle ölçülecek.
- 🔴 **Açık onay olmadan sentetik production order YOK**; terminal siparişler zorla değiştirilmez.
- 🔴 **4B.5B1B, gerçek event baseline ölçülmeden BAŞLAMAZ.**
- 🔴 **Manual financial cutover (4F) tamamlanmadan "financial truth ready" YOK.**
- 🔴 **UX redesign (6) büyük rewrite olarak başlamaz** — küçük fazlar.
- 🔴 **Customer portal (7), security/RLS + verified financial data olmadan başlamaz.**
- ℹ️ Tam zincir cache-determinizmi için Seçenek 2 (index.html `?v=`) onay bekliyor; `utl.js` loader versiyonlaması da gerekirse ayrı adım.
