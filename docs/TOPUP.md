# Top-Up Gems (Xendit Invoice) — Setup & Deploy

Alur: **Client → Supabase Edge Function → Xendit Invoice → webhook → kredit gems (server-side)**

Gems **tidak pernah** ditambah dari browser. Client hanya:
1. minta Edge Function `create-invoice` bikin invoice,
2. buka `invoice_url` (QRIS / VA / e-Wallet),
3. polling `order-status` tiap 3 detik; kalau `paid`, saldo disinkron dari cloud.

---

## 1. File yang dibuat

| Path | Isi |
|---|---|
| `supabase/migrations/0001_topup_orders.sql` | tabel `topup_orders` + fungsi DB `settle_topup()` (idempotent), `set_topup_status()`, `merge_player_state()`, `spend_gems()` |
| `supabase/functions/_shared/packs.ts` | whitelist paket (harga + gems) & verifikasi user |
| `supabase/functions/create-invoice/index.ts` | bikin order + invoice Xendit |
| `supabase/functions/xendit-webhook/index.ts` | callback Xendit → kredit gems 1x |
| `supabase/functions/order-status/index.ts` | polling status + fallback sinkron ke Xendit |
| `js/topup.js` | client flow (invoice, polling, status UI) |
| `js/panels.js` | modal top-up sekarang memanggil `Topup.buy(packId)` (simulasi dihapus) |
| `js/supabase-sync.js` | helper `CloudDB.invokeFunction()` + `CloudDB.getCloudGems()` |

---

## 2. Database

Buka **Supabase Dashboard → SQL Editor**, paste isi `supabase/migrations/0001_topup_orders.sql`, klik Run.

atau CLI:
```bash
npx supabase login
npx supabase link --project-ref utfptyzpwsbqfjybiaye
npx supabase db push
```

---

## 3. Secrets (WAJIB, jangan di-commit)

```bash
npx supabase secrets set \
  XENDIT_SECRET_KEY=xnd_production_xxxxx \
  XENDIT_CALLBACK_TOKEN=<token_random_panjang> \
  TOPUP_REDIRECT_URL=https://<domain-game-anda>/
```
`SUPABASE_SERVICE_ROLE_KEY` & `SUPABASE_URL` sudah otomatis tersedia di Edge Functions.

> `XENDIT_SECRET_KEY` hanya dipakai server. Kalau bocor, langsung revoke di dashboard Xendit.

---

## 4. Deploy Edge Functions

```bash
npx supabase functions deploy create-invoice
npx supabase functions deploy order-status
npx supabase functions deploy xendit-webhook --no-verify-jwt
```

URL webhook:
```
https://utfptyzpwsbqfjybiaye.supabase.co/functions/v1/xendit-webhook
```

---

## 5. Dashboard Xendit

- **Developers → Callbacks → Invoice** → isi *Invoice Paid URL* = URL webhook di atas.
- Kalau Xendit dashboard minta **callback token**, isi dengan nilai yang sama dengan `XENDIT_CALLBACK_TOKEN`.
- Test mode: pakai **secret key test** (`xnd_test_...`) + simulator invoice untuk QA, ganti ke production saat live.

---

## 6. Test checklist

| Skenario | Cara uji | Harapan |
|---|---|---|
| Invoice sukses | Beli paket → QRIS/VA tampil | `invoice_url` terbuka, order `pending` |
| Bayar & kredit | Bayar di halaman invoice | webhook jalan → `order.status = paid` → saldo naik **sesuai angka server** |
| Duplikat webhook | Kirim ulang notifikasi Xendit yang sama | `settle_topup` return `already: true`, saldo **tidak** naik lagi |
| Gagal / expire | Jangan bayar sampai invoice expire | order jadi `expired`, tidak ada kredit |
| Salah password | Panggil `create-invoice` dengan `password_hash` ngawur | 401, tidak ada order dibuat |
| Paket ngawur | `pack_id: "free999"` | 400 `PAKET_TIDAK_VALID` |

Manual test webhook (butuh service role / SQL editor):
```sql
select public.settle_topup('aab_xxx_xxx');
```

---

## 7. Catatan keamanan / limitasi

- **Autentikasi game masih berbasis hash password buatan sendiri (`hashPass`, djb2-ish) dan disimpan di `player_saves`.** Edge Function membandingkan hash yang sama, jadi konsisten — tapi hash ini lemah.
- **Saldo gems kini server-authoritative**, walau lewat jalur RPC:
  - `merge_player_state()` — dipanggil `CloudDB.saveState()`. Saldo cloud selalu menang; nilai `premiumGems` lokal yang lebih besar **diabaikan** (jadi tidak bisa di-cheat lewat localStorage).
  - `spend_gems()` — dipanggil `CloudDB.verifyAndDeductGems()`. Pengurangan saldo dilakukan di dalam transaksi DB (`SELECT ... FOR UPDATE`), jadi tidak bisa minus dan tidak menimpa kredit top-up yang masuk bersamaan.
  - `settle_topup()` — kredit dari webhook, idempotent (row lock + cek `status='paid'`).
  - Kalau RPC belum ter-deploy, client jatuh ke PATCH biasa yang **tetap** menulis nilai saldo cloud (fallback aman).
- **Kelemahan yang masih ada:** `player_saves` masih bisa ditulis via anon key (belum ada RLS ketat di tabel itu). Artinya user masih bisa mengarang `save_data` lain (mis. kartu/roll) walau **gems sudah aman** karena saldo selalu dibaca ulang dari server. Untuk produksi sungguhan, RLS `player_saves` sebaiknya ditutup dan penulisan lewat Edge Function — ini pekerjaan terpisah, sengaja tidak diubah di commit ini supaya flow auth tidak terganggu.
- Kalau webhook Xendit gagal, `order-status` punya **fallback** yang menanyakan status invoice langsung ke API Xendit, jadi kredit tetap bisa terjadi lewat polling client.
- Timeout polling client: 15 menit (`MAX_POLL_MS`). Invoice Xendit: 3600 detik (1 jam) — session yang展出 dibiarkan user menekan "Cek Status".

---

## 8. Menambah / mengubah paket

Ubah **dua tempat** (harus sama):
1. `supabase/functions/_shared/packs.ts` → `TOPUP_PACKS` (sumber kebenaran server),
2. `js/panels.js` → `TOPUP_PACKS` (tampilan + `id`).

Server mengabaikan harga/gems dari client sepenuhnya, jadi mismatch hanya bikin tampilan beda, bukan cheat.
