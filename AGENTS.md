# PETA STRUKTUR GAME — Anime Card Battle RNG

Vanilla JS SPA. Tanpa build step untuk web. Semua state global, semua render via string HTML.
Baca file ini dulu; jangan baca `style.css` (49.3k baris) atau `index.html` utuh kecuali terpaksa — pakai anchor di bawah + grep.

---

## 1. ATURAN KERJA (WAJIB)

1. **Jangan refactor besar / hapus kode** tanpa diminta eksplisit. User sensitif ke perubahan tak diminta.
2. **ART JANGAN DISENTUH.** Jangan ganti / timpa / pindah file gambar apa pun (kartu, pet, artefak, item, thumbnail, `assets/**`) kecuali user minta tersurat "ganti art". "Optimasi" tidak pernah berarti menyentuh gambar.
3. **Cache-busting:** setiap edit file JS/CSS → naikkan `?v=` di `index.html` (script JS di baris 736–760, CSS di baris 15–18). Kalau tidak, user lihat versi lama.
4. **CSS append-only:** perubahan gaya ditambahkan di **akhir `css/style.css`** sebagai blok override. Jangan edit aturan lama di tengah file (bisa menabrak ratusan layar lain).
5. **Commit** pakai identitas inline (tidak ada global config):
   `git -c user.name="Qoder" -c user.email="qoder@local" commit -m "..."`
   Stage **file spesifik**, JANGAN `git add -A` (folder prototipe bisa nyangkut).
   Yang **sudah dilacak git dan wajar di-commit**: `js/config.js`, `js/pwa.js`, `js/topup.js`, `sw.js`, `manifest.json`, `docs/TOPUP.md`, `test-roll-system.md`, seluruh `supabase/migrations/*.sql` + `supabase/functions/**`.
   Yang **di-ignore / jangan pernah dipaksa masuk**: `android/`, `www/`, `dist/`, `node_modules/`, `backups/`, `_tmp/`, `vibe_images/`, `proto/`, `supabase/.temp/`, `prototipe.html`, `*-prototype.html`, `demo-*.html`, `js/anim-prototipe.js`, `css/anim-prototipe.css`, `*.bak-*`.
6. Push hanya kalau diminta. Remote: `origin` → GitHub `mencot6474-design/anime-card-battle-rng`. **Push `master` = deploy** (GitHub Pages langsung, dan build Netlify ikut ke-trigger — kuota Netlify sudah lewat per 2026-10-25, jadi build-nya cuma gagal). Kalau user minta "jangan ke netlify", dorong ke branch samping: `git push origin master:wb-balance`. `gh` CLI tidak ada.
7. Responsif wajib dicek: desktop 1400×900, HP 500×844, HP landscape ~850×390.
8. Preview dev server: `http://127.0.0.1:8123` (node_repl static server dengan Range + no-cache). **Jangan dimatikan** — itu preview milik user.
9. **Performa = fitur.** User pakai HP/PC kentang. Setiap FX baru wajib ikut aturan di §2b (canvas bersama, `FXQ`, `FXDPR`, animasi composited). Jangan tambah `box-shadow`/`text-shadow`/`background-position`/custom property yang dianimasikan di subtree battle.

---

## 2. PETA FILE

```
index.html            shell, semua modal/screen markup, urutan script (767 baris)
css/style.css         49.5k baris — SEMUA gaya utama (append override di akhir)
                      blok PERF/LAYOUT: 48395–48476; blok terbaru (full-art,
                      shadow-king FX, world boss) lanjut sampai 48571–49022+;
                      blok LEADERBOARD v2 (podium+border) mulai 49298,
                      blok SHEET PROFIL PLAYER PUBLIK mulai 49462
css/story-carousel.css  CSS khusus modal story (diload setelah style.css)
css/world-boss.css    814 baris — gaya hub World Boss / kartu ultima (juga diload)
css/sl-system.css     roll/gacha system
css/anim-prototipe.css  halaman prototipe (tidak dipakai game) — LOKAL SAJA, sudah di-.gitignore
js/data.js            STORY_BIBLE (baris 100), luck helper, data cerita/unit
js/config.js          config runtime (Supabase dll)
js/supabase-sync.js   CloudDB: saveState (51) + flag p_skip_stacks + withPub (66),
                      earnGems, leaderboard (393) / avatars (404) / profile (411) /
                      submitScore (420), wbState/wbStart/wbSubmit/wbClaim
js/panels.js          gacha roll, profil, backpack, premium, weather, topup, global luck
js/topup.js           modal topup (render terpisah)
js/cards-fx.js        CARDS (index kartu), DIFFS (157), FX/skill text, mutasi (128+)
                      + GLOBAL: FXQ(n) kuota partikel 70% (baris 2), FXDPR() = 1 (4)
                      + konstanta raid/WB: WB_POOL_HP 167, RAID_DMG_SCALE 168
js/anime-archetype-attacks.js  definisi attack per archetype
                      + SATU canvas bersama #animeAtkCanvas (ensureSharedCanvas /
                        registerFrame / sharedTick, ~baris 90–135)
js/shadow-king-fx.js  FX passive Shadow King (arise/shadow exchange/legion absorb),
                      engine hasil port dari prototipe; timing lewat bsMs()
js/fps-lock.js        frame-rate lock global untuk semua loop JS-driven (partikel,
                      camLoop, shared attack tick) — progres pakai performance.now()
js/state.js           state global, auth, renderShell, home, mission, story hook,
                      save/cloud push (lihat §3)
js/sheetfx.js         efek lembar/slash battle (canvas FX terpisah, DPR via FXDPR)
js/battle.js          battle engine + render (semua canvas pakai FXDPR, partikel via FXQ)
js/tower-lobby.js     lobby hub, tower, backpack toggle, modal helper
js/foe-passives.js    passive musuh
js/story-carousel.js  modal story (IIFE, ekspor ke window)
js/raid.js            raid hub/battle/shop + index card + trait/auto-roll + World Boss
js/ranking.js         leaderboard 5 papan (world_boss, world_boss_b, inf_tower,
                      deck_power, rarest_pull) via RPC get_leaderboard — layout v2:
                      podium top-3 + border (RK_BD1 79 / RK_BD23 80), baris
                      RANK|AV|NAMA|SKOR|Δ (rkRowsHtml 242), tab pil di bawah,
                      foto profil asli (rkFillAvatars 161) + sheet profil player
                      (openRkProfile 566)
js/boot.js            router, enterGame, settings, foot menu, label BUILD
js/pwa.js             install prompt/service worker
js/coret.js           fitur coret dev (tombol float #crFab)
sw.js / manifest.json PWA (service worker + precache) — tracked, naikkan versi sw bila perlu
supabase/migrations/  0001–0012 SQL (topup, earn_gems, redeem, world boss 0005–0009 &
                      0011, leaderboard 0010, hemat save 0012) — JALANKAN manual di
                      Supabase SQL Editor; CLI tidak login
supabase/functions/   Deno edge: create-invoice, order-status, play-verify,
                      redeem-code, trakteer-webhook (+ _shared/packs.ts)
tools/cap-sync.mjs    copy web → www (Capacitor)
assets/{cards,pets,artifacts,images,raid,vfx,audio,bg,frames,sprites,ui}
                      assets/ui = dekor UI (lb-top1.mp4 border podium #1,
                      lb-ring.png border podium #2/#3) — JANGAN sentuh tanpa diminta
docs/TOPUP.md, test-roll-system.md
Bahan uji coba (TIDAK dilacak git, tidak ikut deploy): `proto/`, `prototipe.html`,
`*-prototype.html`, `demo-*.html`, `js/anim-prototipe.js`, `css/anim-prototipe.css`.
```

Urutan load (penting — fungsi global saling pakai; `index.html` baris 736–760):
`fps-lock → data → config → supabase-sync → panels → topup → cards-fx → anime-archetype-attacks → state → sheetfx → battle → tower-lobby → shadow-king-fx → foe-passives → story-carousel → raid → ranking → boot → pwa → coret`

`panels.js` dimuat **sebelum** `cards-fx.js` (CARDS dipakai saat render, bukan saat load). `raid.js` dimuat **setelah** `tower-lobby.js`.
`cards-fx.js` harus tetap dimuat **sebelum** `anime-archetype-attacks.js`, `sheetfx.js`, dan `battle.js` karena `FXQ`/`FXDPR` dipakai ketiganya.

---

## 2b. PERFORMA & FX (KONTRAK WAJIB)

Tujuan: HP kentang tetap main tanpa frame drop. Semua efek baru harus ikut aturan ini.

0. **Tidak ada layer background video/gambar di belakang kartu.** Semua jurus (termasuk EX) murni animasi canvas, seperti anime referensi. CSS mati `.jinwoo-bgfx` / `.madara-bgfx` sudah dihapus (2026-10-23) — jangan dihidupkan lagi. FX juga tidak bercabang per tier.
1. **Satu canvas untuk FX serangan archetype.** `anime-archetype-attacks.js` sudah memakai `#animeAtkCanvas` bersama:
   - `getCanvas()` → `ensureSharedCanvas()` (buat sekali, resize saat viewport berubah).
   - Tulis animasi sebagai `function frame(now){ ...; return true/false; }` lalu `registerFrame(frame)`.
   - `return false` = efek selesai, otomatis di-unregister. **Jangan** `cv.remove()` / `requestAnimationFrame` sendiri / bikin `<canvas>` baru per serangan.
   - `sharedTick` clear sekali per frame lalu memanggil semua frame aktif — tidak ada canvas menumpuk saat efek overlap.
2. **Resolusi canvas FX = 1x.** Semua canvas FX (archetype, `sheetfx`, `battle.js`) memakai `FXDPR()`, bukan `devicePixelRatio`. Overlay glow tidak butuh DPR penuh.
3. **Kuota partikel lewat `FXQ(n)`** (≈70%). Jangan tulis jumlah partikel mentah yang besar. `sheetfx` juga punya cap (`Math.min(24, FXQ(...))` untuk shard, `Math.min(30, ...)` untuk spark).
4. **Hindari `shadowBlur` per partikel.** Untuk glow banyak objek, pakai pass halo (bentuk lebih besar + `globalAlpha` rendah). `shadowBlur` masih boleh untuk objek sedikit (arc/beam/ring).
5. **CSS battle hanya animasi composited** (`transform`, `opacity`). Sudah dibekukan/diganti di blok PERF: `--battle-border-shift` (tak terpakai), aura Jin-Woo, nama shiny/mutasi, `.sp-crystal`, `.sp-num`, sheen banner shiny, `.bd-chip`.
6. **`backdrop-filter` dilarang** di permukaan besar / di atas background beranimasi (modal, topbar, footer, fighter body). Latar sudah opaque — tambahkan alpha, jangan blur.
7. **`background-attachment:fixed`** hanya boleh kalau tidak ada scroll; lobby sudah dipindah ke `scroll`.
8. **Grid panjang** pakai `content-visibility:auto` (`.ix-cell`, `.bp-tile`, `.bp-shop`).
9. Saat modal penuh terbuka / tab hidden, animasi dekoratif di-pause (`body.perf-paused`, `body:has(...modal.show)`).
10. Kontrol build: label di `js/boot.js:592` — `BUILD <tanggal>-perfN · VP W×H · AUD`. Kalau balas "masih lag", cek angka `perfN` dan `VP` dulu (VP 1900 = viewport desktop dipakai).

---

## 3. STATE & DATA MODEL

- `let state=null, currentUser=null` — `js/state.js:25` (dua-duanya top-level `let`: tes in-page harus assign identifier polos, bukan `window.state`)
  **`window.state` itu undefined, selalu.** `let` top-level tidak jadi properti window, jadi `if (window.state) window.state.premiumGems = x` adalah tulisannya *silent no-op* — tidak error, tidak berubah. Pernah bikin gems hasil `earn_gems` tidak pernah muncul di topbar (player mengira reward hilang). Di `supabase-sync.js` pakai `this._st()` (167) untuk membaca state dan `this._paint()` (173) untuk menggambar ulang topbar setelah saldo berubah.
- `freshState()` — `js/state.js:12` = bentuk save:
  `coins, playerLv, cleared[], clearedDiff{}, deck[4], stacks[](array, bukan map), battle{}, player{luckBase,luckFlat,luckPercent,exp,lv,sp,tree{}}, weather{}, potions{}, luckPots{}, speedPots{}, artOwned[], artSlots[], petOwned[], petEquipped[], premiumGems, rollPacks{}`
- Persist lokal: localStorage `aab-state-v2:<username>`. Contoh terukur 2026-10-25: 96,9 KB JSON, `stacks` = 73,8 KB (562 item), sisanya 23 KB.
- Rantai save/cloud (`js/state.js`):
  `save()` (421) → tulis localStorage + diff-check `_cloudStateKey()` (356; playSec dikecualikan; identik = skip total) → debounce 400 ms → `_cloudPush()` (393) → `CloudDB.saveState` → RPC `merge_player_state`.
  Anti-bandwidth: `CLOUD_PUSH_MIN_MS = 30000` (364) membatasi push saat auto-roll, `CLOUD_STACKS_MIN_MS = 60000` (365) membatasi kirim inventori saat rolling; `flushCloudSave()` (410) dan `pushCloudNow()` (417) selalu kirim inventori penuh (dipakai saat roll berhenti dan sebelum RPC yang membaca saldo di server).
  Payload ringan dibuat di `supabase-sync.js:51` (`skipStacks` → `p_skip_stacks`): salinan state tanpa `stacks`. Kalau RPC gagal → fallback PATCH **pakai state utuh** (sengaja, supaya inventori cloud tidak terhapus).
  **`pub` (ringkasan profil publik)** disuntik `buildPubSummary()` (state.js:371) ke `opts.pub` dan dipasang lewat `withPub()` di `supabase-sync.js:66` — WAJIB di kedua jalur (RPC `p_save_data` DAN fallback PATCH), karena jalur PATCH menimpa `body.save_data` dengan `stateObj` mentah di baris ~114; pernah cuma kena jalur RPC sehingga profil player lain kosong. `merge_player_state` mengganti `save_data` secara utuh, jadi key turunan seperti `pub` harus ikut terkirim lagi tiap push.
  **KEY INTI WAJIB DINORMALKAN** di `loadStateFor` (blok setelah `titles`, state.js ~103): `coins, playerLv, xp, summons, lastClaim, muted, history, cleared, weather, weatherBest`. Alasannya nyata — baris cloud `admin` kembali TANPA `coins`/`playerLv`, dan `renderShell` memanggil `fmt(state.coins)` → `TypeError` dan seluruh layar mati. `fmt` (cards-fx.js:302) sekarang juga tahan `undefined`/`NaN` (tampil 0), tapi itu pagar kedua, bukan pengganti normalisasi. Field baru = tambah satu baris di blok itu.
- **KOOLDOWN REPLAY STORY = PER STAGE.** `state.storyCd` map `"<diff>:<lv>"` → until-ms (state.js:262 `storyCdLeft(lv)`, :267 `storySetCd(lv)`, setter cuma dipanggil `battle.js:3166` saat menang replay). Dulu `storyCdUntil` satu timestamp global — sekali replay mengunci SEMUA stage; key lama dibuang di `loadStateFor` (state.js:128), sengaja tidak dipetakan ke stage mana pun. Aturan turunannya: (1) jangan pernah panggil `storyCdLeft()` tanpa `lv`; (2) kartu carousel menandai dirinya `data-lv` (story-carousel.js:211) supaya tick 1 detik (`updateStoryCdUI` state.js:311) bisa hitung per kartu — dock/BUTON ikut stage terpilih via `updateStoryCarouselPositions`; (3) GEM replay dibayar per BAB (`claimStoryRepeatGem`), jadi kooldown per stage = faucet gem naik kelipatan jumlah stage yang sudah tamat di bab itu.
- `const app=document.getElementById("app")` — `js/state.js:564`; semua view di-render ke sini.
- Routing: `render()` `js/boot.js:197` → `#/` home, `#/raid`, `#/tower`, `#/settings`, default lobby.
- `enterGame()` `js/boot.js:442`.

Rantai data kartu:
`STORY_BIBLE` (`js/data.js:100`, chapters → levels → unit/reward/boss)
→ `MASTER_CARD_INDEX` (`js/panels.js:1755`, diturunkan dari units)
→ `CARDS` (`js/cards-fx.js:5`, `Object.fromEntries(MASTER_CARD_INDEX...)`)
→ `DIFFS` (`js/cards-fx.js:157`), `CHAPTERS` (`js/panels.js:1745`).
Mutasi: `SHINY_MULT` (126), `MUT_MULT / MUT_CHANCE_MULT / MUT_LABEL / MUT_COLOR` (`js/cards-fx.js` 128–136).

Helper kartu: `cardImg, cardName, cardStats, traitChip, mutChip, fxOf, skillText` (cards-fx.js).
Luck: `luckChance, totalLuck, fmtChance` (data.js).

---

## 4. PETA LAYAR (modal → buka → render → CSS anchor)

| Layar | Modal / root | Buka | Render | CSS (style.css ±) |
|---|---|---|---|---|
| Home | `#app` | `render()` | `renderHome` (state.js:775) → `renderLobby` (tower-lobby.js:1032) | lobby 3436+ |
| Story | `#storyModal` | `openStory` (state.js:776 → `window.openStoryCarousel`) | `openStory` IIFE (story-carousel.js:69) | `css/story-carousel.css:21` `.sc-window` |
| Index kartu | `#indexModal` | `openIndex` (raid.js:1108) | `ixRender` (raid.js:1154) | 47800 |
| Trait / skill tree | `#traitModal` | `openTrait` (raid.js:1378) | `renderTrait` (raid.js:1382) | 47834 |
| Weather machine | `#weatherMachineModal` | `openWeatherMachine` (panels.js:2071) | `renderWeatherMachine` (panels.js:2299) | 47834 |
| Premium shop | `#premiumModal` | `openPremiumShop` (panels.js:1825) | `renderPremiumShop` (panels.js:1841) | 47816, base 45337 |
| Profil | `#profModal` | `openProfileModal` (panels.js:733) | `renderProfile` (panels.js:822) | 529, fullscreen 47505/47701 |
| Backpack | `#backpackPanel` | `toggleBackpack` (tower-lobby.js:1194) | `renderBackpackPanel` (panels.js:1066) | 47859, base 2539 |
| Backpack tab item | — | — | `renderBpItems` (1161) / tree 1520 / arts 1592 / pets 1610 | — |
| Mission | `#missionModal` | `openMission` (state.js:750) | — | — |
| Start battle | `#startModal` | `openStart` (state.js:825) | — | — |
| Deck pick | `#deckPickModal` | `openDeckPick` (raid.js:1495) | `renderDeckPick` (raid.js:1497) | — |
| Battle | `#app` view | `startBattle` (battle.js:1746) | `renderBattle` (battle.js:257) | battle 3992, grid base 4100, full 4152 |
| Tower | `#app` view | `startTowerBattle` (tower-lobby.js:548) | `renderTower` (121) / `renderTowerBattle` (527) | tower 3436 |
| Raid | `#app` view | `startRaid` (raid.js:547) | `renderRaid` (241; hub 79, view dispatch 244–247, WB shop 812) | — |
| Topup | `#topupModal` | `openTopup` (panels.js:2962) | `renderTopupModal` (panels.js:2840) | topup 46922 |
| Titles | `#titlesModal` | `openTitlesModal` (panels.js:752) | `renderTitlesModal` (773) | — |
| Settings | `#app` view | `#/settings` | `renderSettings` (boot.js:9) | — |

Markup modal ada di `index.html` (baris kunci):
welcomeModal 67, topbar 93, authScreen 75, app 222, profModal 124, rollResultPop 292, `#modal` 315, indexModal 317, premiumModal 339, weatherMachineModal 386, missionModal 402, dailyModal 475, storyModal 485 (dock intel story ±528–533), startModal 557, traitModal 572, deckPickModal 585, rarePromptModal 595, towerDropModal 600, footMenu 717, backpackPanel 734, blok `<script>` 736–760 (`coret.js` 760), topupModal 763.

### Pola layar full-screen (index/premium/trait/weather/story/backpack/profil)
`position:fixed; inset:0; width:100vw; height:100dvh; border-radius:0; min-height:0!important`
Box dalam = `display:flex; flex-direction:column; overflow:hidden`; header `flex:none` (padding-right 110–120px supaya tidak ketutup tombol dev `#crFab`), body `flex:1; min-height:0` dan hanya body yang scroll.
Backpack bukan `display:fixed` bawaan — `toggleBackpack` set inline transform; dinetralkan CSS `transform:none!important`.

### Layout layar main = PC di semua device
- `<meta name="viewport" content="width=1900, ...">` (index.html:5) — HP/PWA me-render layout desktop lalu mengecilkan, jadi komposisi 3 kolom sama seperti PC.
- `html,body{text-size-adjust:100%}` (style.css:48474) mematikan font boosting Chrome/WebView HP (penyebab teks melimpah & "nabrak").
- Jaring pengaman `@media(max-width:700px)` (style.css:48481 & 48501) memaksa arena battle tetap 3 kolom: `minmax(0,1fr) clamp(48px,12vw,96px) minmax(0,1fr)`, kartu `max-height:min(58dvh,420px)`, kolom VS `flex-direction:column; width:100%; min-width:0` (dulu 210px menabrak kartu).
- Jangan pakai `100dvh - konstanta` untuk tinggi arena; di viewport pendek (landscape HP) rumus itu runtuh.

---

## 5. SISTEM

- **Gacha/roll** — `startRollAnimation` panels.js:589; CSS `sl-system.css` + style.css 1368; roll packs & luck multiplier di `state.player`. Banner/video index di `raid.js` (`CARDS` cards-fx.js:5).
- **Battle** — engine + render di `battle.js` (`renderBattle` 257, `startBattle` 1746); damage/FX/attack archetype di `anime-archetype-attacks.js` + `sheetfx.js` + `shadow-king-fx.js`; passive lawan `foe-passives.js`. Markup kartu musuh dipakai bersama lewat `foeFighterInnerHtml` (normal + raid/WB; opsi `hpFmt` untuk angka ringkas). `shakeScreen` = no-op, `hitStop` tak mem-pause apa pun, `speedLines` hanya dipakai 1 serangan.
- **Frame-rate lock** — `js/fps-lock.js` membungkus loop JS-driven supaya gerakan tidak cepat saat FPS naik; jangan bypass dengan `requestAnimationFrame` mentah di FX baru.
- **Tower** — `tower-lobby.js` (`renderTower` 121, shop 260, `startTowerBattle` 548, `renderTowerBattle` 527) + `openTowerDropModal` 1228.
- **Raid / auto-roll** — `raid.js` (`renderRaid` 241, `startRaid` 547, `startAutoRoll` 1576). Auto-roll = sumber beban cloud terbesar; lihat §3 sebelum mengubah ritme save.
- **World Boss** — boss list `WB_BOSSES` raid.js:28 (`RAID_ETERNAL_DRAGON` → `world_boss`, `RAID_SHADOW_KING` → `world_boss_b`), WB shop 812 (token→gem 100:20), poll leaderboard 1×/menit (164). Damage run di-skala `RAID_DMG_SCALE = 100` (cards-fx.js:168), pool HP `WB_POOL_HP = 1e12` (167), format ringkas `fmtBig` raid.js:87. Sisi server: RPC `wb_state/wb_start/wb_submit/wb_claim` (supabase-sync.js 339–386) + migration `0005`–`0009`, `0011`. **Ambang hadiah "participant" = `best_dmg >= 1e9` (0008:92)** — perlu ditinjau lagi karena damage sudah ÷100.
- **Leaderboard** — `js/ranking.js`: `RK_BOARDS` (12) = world_boss, world_boss_b, inf_tower, deck_power, rarest_pull; `lbState` (352) cache namespace `aab-lb2-`; refresh `RK_REFRESH_DAY_MS = 60000` (619) — ini penyumbang egress berkala terbesar, tab hidden ikut di-skip. Submit via `CloudDB.submitScore` (supabase-sync.js:420) dengan plafon 1e21 (migration 0010).
  Layout v2 (podium + border): `rkRender` (266) merakit `rkPodiumHtml` (204) → `rkPodHtml` (188) → `rkRowsHtml` (242). Border #1 = video `assets/ui/lb-top1.mp4` (`mix-blend-mode:screen` + mask bulat) — **jangan pakai `transform` pada `.rk-pod1`**, transform bikin stacking context yang mematikan screen-blend (kotak hitam menutupi podium); naik-turun podium pakai `margin`. Border #2/#3 = `assets/ui/lb-ring.png` (sudah di-keying transparan). Profil (`inset:8%`, z2) digambar LEBAR dari lubang lalu **ditimpa border-nya** (z3): lubang hasil ukur = ring 57,5% dengan pusat 7,6% di atas tengah (`top:-3%`), video 52–56% dengan pusat 7,8% di bawah tengah (`top:-22%`); `margin-bottom` pada `.rk-ava` memberi ruang overhang border supaya nama tidak tertimpa. Δ posisi dihitung lokal (`rkDeltaHtml` 223, cache `aab-lb-delta`) — server tidak menyimpan peringkat sebelumnya.
  **Foto profil player lain** (`RK_AV_KEY` 102, cache `aab-lb-av`): foto = `save_data.customAvatar` yang sudah dikecilkan ke 96px WebP q0.75 di boot.js:570 (±5,6 KB; JPEG q0.78 fallback). Egres Supabase hanya menghitung DOWNLOAD, jadi foto TIDAK ikut di row leaderboard — client minta nama yang belum ada di cache lewat RPC `get_player_avatars(usernames[])` (≤80 per panggilan, `rkFillAvatars` 161) lalu `rkAvPaint` (138) menempelkannya ke `[data-rkav]`. Wadah avatar menyimpan `data-rkfb` = thumbnail kartu dari `meta.av` sebagai cadangan, **wajib** disaring `rkAvSrc` (92) / `RK_DATA_IMG` (105) karena isinya datang dari player lain; menggantinya dengan URL bebas = XSS/egress tak terbatas.
  **Sheet profil publik** (`openRkProfile` 571 → `rpHtml` 499, markup `#rkProfModal` index.html:444, CSS blok `SHEET PROFIL PLAYER PUBLIK` style.css:49462): bacanya lewat RPC `get_player_profile(username)` yang hanya membukakan key `pub`, `playSec`, `customAvatar`, `updated_at` — BUKAN save lengkap. `pub` dibangun client (`buildPubSummary` state.js:371, ikut terkirim di kedua jalur `saveState` — lihat §4) jadi server tidak perlu tahu rumus game. Semua isi `pub` dianggap tidak dipercaya: angka di-clamp, string di-escape, `mut` di-whitelist (`RK_MUTS` 458), `char` wajib ada di `CARDS` sebelum `hubCardHtml` dipanggil. **`pub` kosong ≠ nol** — player lama (save sebelum `pub` ada) digambar strip `—` + hint (`hasPub` ranking.js:505), JANGAN `LV 1 / POWER 0`: angka bohong lebih buruk dari angka kosong. Yang tetap nyata walau `pub` kosong: `playSec` dan posisi papan. Sisi server (migration `0013`): `playSec` tersimpan sebagai **float** (`"65076.964…"`) sehingga `::int` langsung melempar `22P02` dan seluruh profil gagal — cast hanya setelah lolos regex angka, lewat `round()::numeric`. Data URL avatar jangan dipotong `left(...,24000)` (base64 setengah tetap ditolak client); saring dengan `length(...) <= 24000`.
- **Story** — `story-carousel.js` IIFE; mengekspor `window.openStoryCarousel/openStory/closeStory/openMission/selectStoryStage/slideStoryStage/changeStoryChapter/initStoryCarousel`.
- **Weather** — `WEATHERS` (panels.js ~17), `WEATHER` map, `weatherSvg(id,sz)`, dock `renderWeatherDock` 232, tick `startWeatherTick` 316, machine modal 2071/2299.
- **Buff dock** — `renderBuffDock` panels.js:277.
- **Trait/skill tree** — `renderTrait` raid.js:1382, auto-roll 1576.
- **Backpack** — render di panels.js (`renderBackpackPanel` 1066, item 1161, tree 1520, artefact 1592, pet 1610); toggle + header close di tower-lobby.js:1194.
- **Premium shop** — panels.js 1825/1841, CSS 45337 + 47816.
- **Profil** — panels.js 733/822, CSS 529 + 47505.
- **Global luck widget** — panels.js 1606 / 2464 / 2470, CSS 46776.
- **Topup** — panels.js 2840/2962 + topup.js; dokumentasi `docs/TOPUP.md`; edge function di `supabase/functions/`.
- **Cloud sync** — `supabase-sync.js` (CloudDB) + `js/config.js`; URL + anon key ada di baris 2–3 (publishable, memang publik). Save: §3. Tarik saldo gem: `earnGems` 305 (server authoritative). Cek schema live pakai probe HTTP (`PGRST202` = fungsi belum ada).
- **PWA** — pwa.js + manifest.json + sw.js (precache; kalau ganti file besar, naikkan versi sw).
- **Dev coret** — coret.js, tombol float `#crFab` (kanan atas; layar full-screen WAJIB kasih padding kanan).

---

## 6. RESEP "MAU UBAH X"

- **Tambah/ubah kartu** → `STORY_BIBLE` (data.js:100) untuk unit cerita; `MASTER_CARD_INDEX` (panels.js:1755) untuk index; art di `assets/cards/art/<slug>.png` (deck/list pakai `assets/cards/thumb/`). Jangan cascade tier/skill kalau hanya diminta ganti art — dan jangan sentuh art tanpa permintaan tersurat.
- **Ubah skill/trait** → `cards-fx.js` (`skillText`, `fxOf`), trait tree `renderTrait` (raid.js:1382), passive musuh `foe-passives.js` + `shadow-king-fx.js`.
- **Ubah FX serangan** → `anime-archetype-attacks.js` (definisi) + `sheetfx.js` (render efek) + `assets/vfx`. Semua murni canvas (tanpa background video); wajib lewat `registerFrame` + `FXQ`, jangan bikin canvas baru.
- **Ubah tampilan layar** → cari id modal di `index.html` (lihat daftar baris di §4), render function di tabel §4, lalu **append** override CSS di akhir `css/style.css`.
- **Ubah gacha/rate** → panels.js area roll (589+), `sl-system.css`, konstanta `DIFFS`/mutasi di cards-fx.js (128–160). Prototipe ritme roll ada di `_tmp/`/`proto/` (tidak dilacak git).
- **Ubah ekonomi/harga** → konstanta di panels.js (premium/topup), `TRAIT_COST` + `WB_SHOP` (raid.js:812), shop tower di tower-lobby.js:260.
- **Ubah save/state** → `freshState` state.js:12 + migrasi di `enterGame` boot.js:442 + `supabase-sync.js`. Kalau menambah field besar (mis. inventori baru), pikirkan dulu dampaknya ke payload push (§3) — `stacks` sudah 74 KB.
- **Ubah RPC / kena limit Supabase** → buat migration baru di `supabase/migrations/00NN_*.sql`, JALANKAN manual di Supabase SQL Editor (CLI belum login), lalu probe lewat HTTP RPC pakai anon key untuk memastikan signature diterima. Migration yang menambah parameter fungsi harus di-`drop` signature lamanya dulu (ambigu 4 vs 5 arg).
- **Tambah layar** → markup di index.html, render fn, route di `render()` boot.js:197 atau tombol di lobby tower-lobby.js:1032.
- **Kejar performa** → cek §2b dulu (canvas bersama, FXDPR, FXQ, animasi composited, backdrop-filter); blok override PERF/LAYOUT 48395–48476, override terbaru sampai akhir file (49.3k).

---

## 7. GOTCHA

- Cache-bust `?v=` wajib naik setiap edit; user pakai browser cache agresif. "Masih bug" sering = cache (hard refresh dulu).
- CSS 49.3k baris: anchor section di atas hanya perkiraan; pakai `grep -n "\.nama-kelas"`. Semua override baru taruh paling bawah supaya menang specificity/order.
- Banyak modal punya `.show` class; buka = `classList.add("show")`, tutup = hapus setelah animasi (delay ~300ms).
- Jangan baca `index.html` penuh — grep id/markup yang dibutuhkan.
- Headless Edge di Windows punya lebar minimum ~500px; viewport 390 dilaporkan ~492. Pakai 500×844 untuk uji HP.
- Animasi dev harus dimatikan sebelum mengukur layout headless.
- Asset gambar besar (artifacts 18M, pets 13M, cards 12M) — jangan base64 inline.
- `assets/` di-commit; `backups/`, `_tmp/`, `dist/`, `www/`, `node_modules/` bukan sumber utama. Halaman prototipe (`proto/`, `prototipe.html`, `demo-*.html`, `*-prototype.html`, `anim-prototipe.*`) sengaja TIDAK dilacak — jangan pernah `git add -A`.
- **Supabase free tier menagih EGRESS saja** (5 GB/cycle); upload/ingress gratis. Jadi mengecilkan payload save menolong kuota internet pemain, bukan kuota Supabase. Yang makan egress: read periodik (leaderboard poll 60 dtk) dan `getUser(select=*)` — fallback PATCH memanggilnya tiap save, jadi pastikan RPC utama tidak pernah jatuh (kalau RPC error di console = migration belum jalan).
- `fetch()` TIDAK meng-compress request body — ukuran upload = ukuran JSON mentah.
- `evaluate_script` browser-use memakai key `function` (string fungsi), bukan `expression`; tab hidden bikin rAF/screenshot tak bisa dipercaya → verifikasi lewat computed style / sampling canvas.
- Viewport sempit: jangan ukur dari `100dvh - konstanta`; cek juga bahwa override lama `@media(max-width:700px)` (mis. `.vs-col{flex-direction:row}` di 19184) tidak menang atas blok baru di EOF.
