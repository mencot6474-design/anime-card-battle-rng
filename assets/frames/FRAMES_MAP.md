# Custom Game Frames Library — Anime Card Battle RPG

Koleksi aset bingkai kustom (vector SVG) untuk menghilangkan tampilan kotak bersudut tumpul (*simple border-radius*) agar antarmuka memiliki siluet khas game aksi AAA/konsol (Wuthering Waves, Solo Leveling: Arise, Genshin Impact, Honkai Star Rail).

---

## 📁 Direktori: `assets/frames/`

### 1. Bingkai Kartu Hunter / Showcase Utama (Card Aesthetics)

| File Bingkai | Deskripsi & Dimensi | Penggunaan & Tema |
| :--- | :--- | :--- |
| [`frame-holo-glass.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-holo-glass.svg) | **Holo Glass HUD (310x460)** ⭐ *Default* | Tampilan sci-fi minimalis modern dengan braket sudut presisi `[ ]`, *laser target crosshairs*, dan telemetri neural. |
| [`frame-gilded-ssr.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-gilded-ssr.svg) | **Gilded Celestial Sovereign (310x460)** | Bingkai emas mewah (*WuWa / Genshin 5★*) dengan mahkota *Solar Diamond*, permata kristal sudut, dan filigri kerajaan. |
| [`frame-tactical-mech.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-tactical-mech.svg) | **Tactical Obsidian Mech (310x460)** | Sasis armor militer (*Solo Leveling / Arknights*) dengan aksen *hazard stripes*, sirkuit cyan neon, dan header `OVERDRIVE`. |
| [`frame-void-relic.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-void-relic.svg) | **Void Relic / Shadow Sovereign (310x460)** | Duri obsidian dan cakar gothic bergerigi dengan urat retakan mana ungu gelap dan batu konduit jiwa. |
| [`frame-hero-card.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-hero-card.svg) | **Octagonal Cyber-Armor (310x460)** | Plat armor oktagonal dengan klem mekanik sudut dan indikator sirip cyan. |
| [`frame-card-ssr.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-card-ssr.svg) | **Golden Sun Crest (310x460)** | Bingkai emas prestise untuk kartu SSR / UR dengan kapasitor energi kristal. |

---

### 2. Bingkai Antarmuka & HUD Modular

| File Bingkai | Deskripsi & Dimensi | Penggunaan Utama |
| :--- | :--- | :--- |
| [`frame-banner-combat.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-banner-combat.svg) | Tactical Angled Bevel (580x120, resizable) | Banner mode tempur utama: Story Campaign & World Boss Raid. |
| [`frame-pod-hex.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-pod-hex.svg) | Chamfered Tech Capsule (280x84, resizable) | Kapsul modul menu: Deck & Party, Trait Refine, Card Index, Weather, Shop, Rebirth. |
| [`frame-dialog-modal.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-dialog-modal.svg) | High-Tech Dialog Frame (480x320, resizable) | Jendela modal / pop-up aksi, detail kartu, dan konfirmasi. |
| [`frame-button-cta.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-button-cta.svg) | Angled Sci-Fi Prism (240x56, resizable) | Tombol aksi primer (SUMMON/ROLL, DEPLOY, CLAIM REWARD). |
| [`frame-slot.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-slot.svg) | Square Chamfer Slot (64x64) | Slot striker, pet pendamping, dan slot perlengkapan artefak. |
| [`frame-avatar.svg`](file:///C:/Users/HDD/Documents/Qoder/2026-09-29/dedf0eda/assets/frames/frame-avatar.svg) | Hexagonal Profile Pod (54x54) | Avatar profil pemain di topbar dan ranking leaderboard. |

---

## 🎮 Cara Penggunaan di CSS:

```html
<div class="hero-card-plate theme-holo">
  <div class="hero-card-art">
    <div class="hero-standee-char"></div>
  </div>
  <img class="hero-frame-svg" src="assets/frames/frame-holo-glass.svg" alt="Holo Glass Frame" />
</div>
```
