# PETA STRUKTUR GAME — Anime Card Battle RNG

Vanilla JS SPA. Tanpa build step untuk web. Semua state global, semua render via string HTML.
Baca file ini dulu; jangan baca `style.css` (48.4k baris) atau `index.html` utuh kecuali terpaksa — pakai anchor di bawah + grep.

---

## 1. ATURAN KERJA (WAJIB)

1. **Jangan refactor besar / hapus kode** tanpa diminta eksplisit. User sensitif ke perubahan tak diminta.
2. **ART JANGAN DISENTUH.** Jangan ganti / timpa / pindah file gambar apa pun (kartu, pet, artefak, item, thumbnail, `assets/**`) kecuali user minta tersurat "ganti art". "Optimasi" tidak pernah berarti menyentuh gambar.
3. **Cache-busting:** setiap edit file JS/CSS → naikkan `?v=` di `index.html` (script JS di baris ~710–725, CSS di baris 15–17). Kalau tidak, user lihat versi lama.
4. **CSS append-only:** perubahan gaya ditambahkan di **akhir `css/style.css`** sebagai blok override. Jangan edit aturan lama di tengah file (bisa menabrak ratusan layar lain).
5. **Commit** pakai identitas inline (tidak ada global config):
   `git -c user.name="Qoder Agent" -c user.email="agent@qoder.local" commit -m "..."`
   Stage **file spesifik**, jangan `git add -A`. Jangan commit `js/supabase-sync.js`, `manifest.json`, `sw.js` yang kotor, dan folder untracked (`android/`, `www/`, `node_modules/`, `supabase/`, `docs/`, `dist/`, `assets/sprites/`, `js/config.js`, `js/pwa.js`, `js/topup.js`, `capacitor.config.json`, `package*.json`).
6. Push/pull hanya kalau diminta. Remote: `origin` → GitHub `mencot6474-design/anime-card-battle-rng` (branch `master`). `gh` CLI tidak ada.
7. Responsif wajib dicek: desktop 1400×900, HP 500×844, HP landscape ~850×390.
8. Preview dev server: `http://127.0.0.1:8123` (node_repl static server dengan Range + no-cache). **Jangan dimatikan** — itu preview milik user.
9. **Performa = fitur.** User pakai HP/PC kentang. Setiap FX baru wajib ikut aturan di §2b (canvas bersama, `FXQ`, `FXDPR`, animasi composited). Jangan tambah `box-shadow`/`text-shadow`/`background-position`/custom property yang dianimasikan di subtree battle.

---

## 2. PETA FILE

```
index.html            shell, semua modal/screen markup, urutan script
css/style.css         48.4k baris — SEMUA gaya utama (append override di akhir)
                      blok PERF/LAYOUT terbaru: baris 48209–48411
css/story-carousel.css  CSS khusus modal story (diload setelah style.css)
css/sl-system.css     roll/gacha system
css/anim-prototipe.css  halaman prototipe (tidak dipakai game)
js/data.js            STORY_BIBLE, luck helper, data cerita/unit
js/config.js          config runtime (Supabase dll)
js/supabase-sync.js   CloudDB (pull/push save)
js/panels.js          gacha roll, profil, backpack, premium, weather, topup, global luck
js/topup.js           modal topup (render terpisah)
js/cards-fx.js        CARDS (index kartu), DIFFS, FX/skill text, mutasi
                      + GLOBAL: FXQ(n) kuota partikel (~70%), FXDPR() = 1 (baris 2–4)
js/anime-archetype-attacks.js  definisi attack per archetype
                      + SATU canvas bersama #animeAtkCanvas (ensureSharedCanvas /
                        registerFrame / sharedTick, ~baris 90–135)
js/state.js           state global, auth, renderShell, home, mission, story hook
js/sheetfx.js         efek lembar/slash battle (canvas FX terpisah, DPR via FXDPR)
js/battle.js          battle engine + render (semua canvas pakai FXDPR, partikel via FXQ)
js/tower-lobby.js     lobby hub, tower, backpack toggle, modal helper
js/foe-passives.js    passive musuh
js/story-carousel.js  modal story (IIFE, ekspor ke window)
js/raid.js            raid hub/battle/shop + index card + trait/auto-roll
js/boot.js            router, enterGame, settings, foot menu, label BUILD
js/pwa.js             install prompt/service worker
js/coret.js           fitur coret dev (tombol float #crFab)
assets/{cards,pets,artifacts,images,raid,vfx,audio,bg,frames,sprites}
tools/cap-sync.mjs    copy web → www (Capacitor)
docs/TOPUP.md, test-roll-system.md, *-prototype.html, prototipe.html
```

Urutan load (penting — fungsi global saling pakai):
`data → config → supabase-sync → panels → topup → cards-fx → anime-archetype-attacks → state → sheetfx → battle → tower-lobby → foe-passives → story-carousel → raid → boot → pwa → coret`

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
10. Kontrol build: label di `js/boot.js:592` — `BUILD <tanggal>-perfN · VP W×H · AUD`. Kalau balas "masih lag", cek angka `perfN` dan `VP` dulu (VP 1600 = viewport desktop dipakai).

---

## 3. STATE & DATA MODEL

- `let state=null, currentUser=null` — `js/state.js:25`
- `freshState()` — `js/state.js:12` = bentuk save:
  `coins, playerLv, cleared[], clearedDiff{}, deck[4], stacks{}, battle{}, player{luckBase,luckFlat,luckPercent,exp,lv,sp,tree{}}, weather{}, potions{}, luckPots{}, speedPots{}, artOwned[], artSlots[], petOwned[], petEquipped[], premiumGems, rollPacks{}`
- Persist: localStorage `aab-state-v2:<username>`; cloud pull saat `enterGame()`.
- `const app=document.getElementById("app")` — `js/state.js:309`; semua view di-render ke sini.
- Routing: `render()` `js/boot.js:197` → `#/` home, `#/raid`, `#/tower`, `#/settings`, default lobby.
- `enterGame()` `js/boot.js:442`.

Rantai data kartu:
`STORY_BIBLE` (`js/data.js:100`, chapters → levels → unit/reward/boss)
→ `MASTER_CARD_INDEX` (`js/panels.js:1665`, diturunkan dari units)
→ `CARDS` (`js/cards-fx.js:5`, `Object.fromEntries(MASTER_CARD_INDEX...)`)
→ `DIFFS` (`js/cards-fx.js:153`), `CHAPTERS` (`js/panels.js:1655`).
Mutasi: `MUT_MULT / MUT_CHANCE_MULT / MUT_LABEL / MUT_COLOR` (`js/cards-fx.js` ~124–135).

Helper kartu: `cardImg, cardName, cardStats, traitChip, mutChip, fxOf, skillText` (cards-fx.js).
Luck: `luckChance, totalLuck, fmtChance` (data.js).

---

## 4. PETA LAYAR (modal → buka → render → CSS anchor)

| Layar | Modal / root | Buka | Render | CSS (style.css ±) |
|---|---|---|---|---|
| Home | `#app` | `render()` | `renderHome` (state.js:485) → `renderLobby` (tower-lobby.js:975) | lobby 3436+ |
| Story | `#storyModal` | `openStory` (state.js:486 → `window.openStoryCarousel`) | `openStory` IIFE (story-carousel.js:69) | `css/story-carousel.css:21` `.sc-window` |
| Index kartu | `#indexModal` | `openIndex` (raid.js:715) | `ixRender` (raid.js:730) | 47800 |
| Trait / skill tree | `#traitModal` | `openTrait` (raid.js:948) | `renderTrait` (raid.js:952) | 47834 |
| Weather machine | `#weatherMachineModal` | `openWeatherMachine` (panels.js:1981) | `renderWeatherMachine` (panels.js:2206) | 47834 |
| Premium shop | `#premiumModal` | `openPremiumShop` (panels.js:1735) | `renderPremiumShop` (panels.js:1751) | 47816, base 45337 |
| Profil | `#profModal` | `openProfileModal` (panels.js:678) | `renderProfile` (panels.js:767) | 529, fullscreen 47505/47701 |
| Backpack | `#backpackPanel` | `toggleBackpack` (tower-lobby.js:1111) | `renderBackpackPanel` (panels.js:978) | 47859, base 2539 |
| Backpack tab item | — | — | `renderBpItems` (1071) / tree 1430 / arts 1502 / pets 1520 | — |
| Mission | `#missionModal` | `openMission` (state.js:460) | — | — |
| Start battle | `#startModal` | `openStart` (state.js:535) | — | — |
| Deck pick | `#deckPickModal` | `openDeckPick` (raid.js:1065) | `renderDeckPick` (raid.js:1067) | — |
| Battle | `#app` view | `startBattle` (battle.js:1730) | `renderBattle` (battle.js:241) | battle 3992, grid base 4100, full 4152 |
| Tower | `#app` view | `startTowerBattle` (tower-lobby.js:503) | `renderTower` (121) / `renderTowerBattle` (482) | tower 3436 |
| Raid | `#app` view | `startRaid` (raid.js:223) | `renderRaid` (14) / hub 22 / pick 171 / battle 203 / result 436 / shop 488 | — |
| Topup | `#topupModal` | `openTopup` (panels.js:2853) | `renderTopupModal` (panels.js:2735) | topup 46922 |
| Titles | `#titlesModal` | `openTitlesModal` (panels.js:697) | `renderTitlesModal` (718) | — |
| Settings | `#app` view | `#/settings` | `renderSettings` (boot.js:9) | — |

Markup modal ada di `index.html` (baris kunci):
welcome 66, authScreen 74, app 221, profModal 123, titlesModal 200, rollResultPop 290, `#modal` 313, indexModal 315, premiumModal 337, weatherMachineModal 384, missionModal 400, dailyModal 450, storyModal 460 (header 468–486, dock 502–526), startModal 531, traitModal 546, deckPickModal 559, rarePromptModal 569, towerDropModal 574, backpackPanel 708, topupModal 734.

### Pola layar full-screen (index/premium/trait/weather/story/backpack/profil)
`position:fixed; inset:0; width:100vw; height:100dvh; border-radius:0; min-height:0!important`
Box dalam = `display:flex; flex-direction:column; overflow:hidden`; header `flex:none` (padding-right 110–120px supaya tidak ketutup tombol dev `#crFab`), body `flex:1; min-height:0` dan hanya body yang scroll.
Backpack bukan `display:fixed` bawaan — `toggleBackpack` set inline transform; dinetralkan CSS `transform:none!important`.

### Layout layar main = PC di semua device
- `<meta name="viewport" content="width=1600, ...">` (index.html:5) — HP/PWA me-render layout desktop lalu mengecilkan, jadi komposisi 3 kolom sama seperti PC.
- `html,body{text-size-adjust:100%}` (style.css:48379) mematikan font boosting Chrome/WebView HP (penyebab teks melimpah & "nabrak").
- Jaring pengaman `@media(max-width:700px)` (style.css:48386 & 48406) memaksa arena battle tetap 3 kolom: `minmax(0,1fr) clamp(48px,12vw,96px) minmax(0,1fr)`, kartu `max-height:min(58dvh,420px)`, kolom VS `flex-direction:column; width:100%; min-width:0` (dulu 210px menabrak kartu).
- Jangan pakai `100dvh - konstanta` untuk tinggi arena; di viewport pendek (landscape HP) rumus itu runtuh.

---

## 5. SISTEM

- **Gacha/roll** — `startRollAnimation` panels.js:536; CSS `sl-system.css` + style.css 1368; roll packs & luck multiplier di `state.player`.
- **Battle** — engine + render di `battle.js`; damage/FX/attack archetype di `anime-archetype-attacks.js` + `sheetfx.js`; passive lawan `foe-passives.js`. `shakeScreen` = no-op, `hitStop` tak mem-pause apa pun, `speedLines` hanya dipakai 1 serangan.
- **Tower** — `tower-lobby.js` (hub, shop 301, battle 482, start 503) + `openTowerDropModal` 1143.
- **Raid** — `raid.js` (hub/pick/battle/result/shop, auto-roll ~1075).
- **Story** — `story-carousel.js` IIFE; mengekspor `window.openStoryCarousel/openStory/closeStory/openMission/selectStoryStage/slideStoryStage/changeStoryChapter/initStoryCarousel`.
- **Weather** — `WEATHERS` (panels.js ~17), `WEATHER` map, `weatherSvg(id,sz)`, dock `renderWeatherDock` 232, tick `startWeatherTick` 316, machine modal 1981/2206.
- **Buff dock** — `renderBuffDock` panels.js:277.
- **Trait/skill tree** — `renderTrait` raid.js:952, auto-roll ~1075.
- **Backpack** — render di panels.js (deck 978, item 1071, tree 1430, artefact 1502, pet 1520); toggle + header close di tower-lobby.js:1111.
- **Premium shop** — panels.js 1735/1751, CSS 45337 + 47816.
- **Profil** — panels.js 678/767, CSS 529 + 47505.
- **Global luck widget** — panels.js 2393/2469/2484, CSS 46776.
- **Topup** — panels.js 2735/2853 + topup.js; dokumentasi `docs/TOPUP.md`.
- **Cloud sync** — supabase-sync.js (CloudDB), config di js/config.js.
- **PWA** — pwa.js + manifest.json + sw.js.
- **Dev coret** — coret.js, tombol float `#crFab` (kanan atas; layar full-screen WAJIB kasih padding kanan).

---

## 6. RESEP "MAU UBAH X"

- **Tambah/ubah kartu** → `STORY_BIBLE` (data.js) untuk unit cerita; `MASTER_CARD_INDEX` (panels.js:1665) untuk index; art di `assets/cards/art/<slug>.png`. Jangan cascade tier/skill kalau hanya diminta ganti art — dan jangan sentuh art tanpa permintaan tersurat.
- **Ubah skill/trait** → `cards-fx.js` (`skillText`, `fxOf`), trait tree `renderTrait` (raid.js:952), passive musuh `foe-passives.js`.
- **Ubah FX serangan** → `anime-archetype-attacks.js` (definisi) + `sheetfx.js` (render efek) + `assets/vfx`. Semua murni canvas (tanpa background video); wajib lewat `registerFrame` + `FXQ`, jangan bikin canvas baru.
- **Ubah tampilan layar** → cari id modal di `index.html`, render function di tabel atas, lalu **append** override CSS di akhir `css/style.css`.
- **Ubah gacha/rate** → panels.js area roll (536+), `roll-system.js` (prototipe), `sl-system.css`.
- **Ubah ekonomi/harga** → konstanta di panels.js (premium/topup), raid.js (`TRAIT_COST`), tower-lobby.js (shop).
- **Ubah save/state** → `freshState` state.js:12 + migrasi di `enterGame` boot.js:442 + supabase-sync.js.
- **Tambah layar** → markup di index.html, render fn, route di `render()` boot.js:197 atau tombol di lobby tower-lobby.js:975.
- **Kejar performa** → cek §2b dulu (canvas bersama, FXDPR, FXQ, animasi composited, backdrop-filter); blok override terakhir ada di style.css 48209–48411.

---

## 7. GOTCHA

- Cache-bust `?v=` wajib naik setiap edit; user pakai browser cache agresif. "Masih bug" sering = cache (hard refresh dulu).
- CSS 48.4k baris: anchor section di atas hanya perkiraan; pakai `grep -n "\.nama-kelas"`. Semua override baru taruh paling bawah supaya menang specificity/order.
- Banyak modal punya `.show` class; buka = `classList.add("show")`, tutup = hapus setelah animasi (delay ~300ms).
- Jangan baca `index.html` penuh — grep id/markup yang dibutuhkan.
- Headless Edge di Windows punya lebar minimum ~500px; viewport 390 dilaporkan ~492. Pakai 500×844 untuk uji HP.
- Animasi dev harus dimatikan sebelum mengukur layout headless.
- Asset gambar besar (artifacts 18M, pets 13M, cards 12M) — jangan base64 inline.
- `assets/` di-commit; `backups/`, `_tmp/`, `dist/`, `www/`, `node_modules/` bukan sumber utama.
- `evaluate_script` browser-use memakai key `function` (string fungsi), bukan `expression`; tab hidden bikin rAF/screenshot tak bisa dipercaya → verifikasi lewat computed style / sampling canvas.
- Viewport sempit: jangan ukur dari `100dvh - konstanta`; cek juga bahwa override lama `@media(max-width:700px)` (mis. `.vs-col{flex-direction:row}` di 19184) tidak menang atas blok baru di EOF.
