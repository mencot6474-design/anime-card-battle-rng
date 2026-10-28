# AAA Lobby Backgrounds Library — Anime Card Battle RPG

Koleksi aset latar belakang lingkungan pemandangan (*panoramic environment landscapes*) berkualitas game aksi komersial AAA (terinspirasi dari *Wuthering Waves, Genshin Impact, Honkai: Star Rail, Solo Leveling: Arise*).

Seluruh aset tersedia dalam format **WebP** (terkompresi ringan untuk web game CrazyGames) dan **JPEG** (kualitas master).

---

## 📁 Direktori: `assets/bg/`

| File Background | Resolusi | Tema & Inspirasi | Suasana & Nuansa Visual |
| :--- | :--- | :--- | :--- |
| [`lobby-wuwa-genshin.webp`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/bg/lobby-wuwa-genshin.webp) | 1376x768 (16:9) | **Cosmic Sanctuary**<br>*(WuWa Solaris-3 × Genshin Celestia)* | Kuil kuno melayang di atas samudra awan malam, bulan retak, dan tirai *aurora borealis* cyan-ungu etereal. |
| [`lobby-solaris-city.webp`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/bg/lobby-solaris-city.webp) | 1376x768 (16:9) | **Solaris Cyberpunk Sunset**<br>*(Wuthering Waves Jinzhou City)* | Gedung pencakar langit pagoda oriental futuristik, cincin gelombang suara anti-gravitasi, semburat senja keemasan *god-rays*. |
| [`lobby-void-abyss.webp`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/bg/lobby-void-abyss.webp) | 1376x768 (16:9) | **Void Abyss**<br>*(Genshin Spiral Abyss × Solo Leveling Rift)* | Vortex galaksi astral berputar, monolit obsidian hitam berurat retakan energi mana ungu gelap, dan matriks konstelasi bintang. |
| [`lobby-astral-observatory.webp`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/bg/lobby-astral-observatory.webp) | 1376x768 (16:9) | **Astral Observatory**<br>*(Honkai Star Rail Herta Station)* | Kubah observatorium kaca futuristik berlantai marmer reflektif menghadap planet bercincin kosmik cyan dan berkas starlight. |
| [`lobby.jpg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/bg/lobby.jpg) | 1024x458 | **Classic Spire Interior** | Ruang menara interior lobby versi dasar. |
| [`tower.jpg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/bg/tower.jpg) | 1024x458 | **Infinite Tower Stage** | Latar belakang pertempuran pendakian lantai Infinite Tower. |

---

## 🎮 Cara Penggunaan di CSS:

```css
.stage-bg-layer {
  position: absolute;
  inset: -35px;
  background-image: url('assets/bg/lobby-wuwa-genshin.webp');
  background-size: cover;
  background-position: center 38%;
  filter: brightness(0.65) saturate(1.15) contrast(1.08);
  transform: scale(1.05);
  pointer-events: none;
  z-index: 1;
}
```
