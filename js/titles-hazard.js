/* ==========================================================================
   TITLES-HAZARD.JS — SOLO GOD AURA ENGINE & ASSETS (29 MASTER TITLES)
   100% Organic Plasma Flame, Concentric Shockwaves, 14 Wings, 14 Crests
   ========================================================================== */

const TITLE_ICONS = window.TITLE_ICONS = {
  // Tower Inf
  tower_10: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L29 16L38 18L30 26L32 40L24 32L16 40L18 26L10 18L19 16L24 2Z" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/><path d="M24 10V26M18 20H30" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="20" r="3" fill="#38bdf8"/></svg>`,
  tower_50: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 44L24 8L36 44L24 36L12 44Z" fill="#4338ca" stroke="#818cf8" stroke-width="2"/><path d="M6 24L24 14L42 24L24 30L6 24Z" fill="#6366f1" opacity="0.8"/><circle cx="24" cy="22" r="4" fill="#c084fc"/></svg>`,
  tower_100: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L32 12H16L24 2Z" fill="#fbbf24"/><path d="M14 14H34V34H14V14Z" fill="#b45309" stroke="#fde047" stroke-width="2"/><path d="M8 36H40L44 44H4L8 36Z" fill="#78350f" stroke="#fbbf24" stroke-width="1.5"/><circle cx="24" cy="24" r="5" fill="#fff" stroke="#f59e0b" stroke-width="2"/></svg>`,
  tower_200: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L34 22H14L24 2Z" fill="#e11d48"/><path d="M12 24L24 46L36 24L24 28L12 24Z" fill="#9f1239" stroke="#fda4af" stroke-width="2"/><path d="M4 18C16 14 32 14 44 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
  tower_300: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" fill="#1e1b4b" stroke="#c084fc" stroke-width="2"/><circle cx="24" cy="24" r="9" fill="#000" stroke="#a855f7" stroke-width="3"/><path d="M8 8L40 40M40 8L8 40" stroke="#e9d5ff" stroke-width="1.5" stroke-dasharray="3 3"/></svg>`,
  tower_400: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L36 20L24 44L12 20L24 2Z" fill="#047857" stroke="#34d399" stroke-width="2"/><ellipse cx="24" cy="22" rx="20" ry="8" stroke="#6ee7b7" stroke-width="2" stroke-dasharray="4 2"/><circle cx="24" cy="22" r="4" fill="#a7f3d0"/></svg>`,
  tower_500: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L36 14L46 24L36 34L24 46L12 34L2 24L12 14L24 2Z" fill="url(#t500Grad)" stroke="#ffd700" stroke-width="2"/><circle cx="24" cy="24" r="8" fill="#000" stroke="#fff" stroke-width="2"/><path d="M24 16V32M16 24H32" stroke="#ffd700" stroke-width="2"/><defs><linearGradient id="t500Grad" x1="2" y1="2" x2="46" y2="46"><stop stop-color="#ff0055"/><stop offset="0.5" stop-color="#ffd700"/><stop offset="1" stop-color="#00f0ff"/></linearGradient></defs></svg>`,

  // Story Mode
  story_easy: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 6H36L42 42H6L12 6Z" fill="#334155" stroke="#94a3b8" stroke-width="2"/><path d="M24 12V36M16 24H32" stroke="#f1f5f9" stroke-width="2.5"/></svg>`,
  story_normal: `<svg viewBox="0 0 48 48" fill="none"><path d="M6 10L24 2L42 10V34L24 46L6 34V10Z" fill="#0369a1" stroke="#38bdf8" stroke-width="2"/><path d="M16 20L24 12L32 20L24 38L16 20Z" fill="#fff"/></svg>`,
  story_hard: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 4L42 12V26C42 38 24 46 24 46C24 46 6 38 6 26V12L24 4Z" fill="#92400e" stroke="#f59e0b" stroke-width="2.5"/><path d="M14 16L34 36M34 16L14 36" stroke="#fef08a" stroke-width="3" stroke-linecap="round"/></svg>`,
  story_extreme: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="22" r="14" fill="#0e7490" stroke="#06b6d4" stroke-width="2"/><path d="M14 26L10 42L22 36L24 46L26 36L38 42L34 26" fill="#0891b2"/><circle cx="18" cy="20" r="3" fill="#fff"/><circle cx="30" cy="20" r="3" fill="#fff"/></svg>`,
  story_nightmare: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 4C12 16 4 24 4 32C4 40 13 46 24 46C35 46 44 40 44 32C44 24 36 16 24 4Z" fill="#581c87" stroke="#c084fc" stroke-width="2"/><circle cx="24" cy="30" r="10" fill="#2e1065" stroke="#f3e8ff" stroke-width="2"/><circle cx="24" cy="30" r="4" fill="#ff0055"/></svg>`,
  story_apocalypse: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L30 16L46 18L34 28L38 44L24 36L10 44L14 28L2 18L18 16L24 2Z" fill="#991b1b" stroke="#ff0055" stroke-width="2.5"/><circle cx="24" cy="24" r="8" fill="#ea580c" stroke="#fde047" stroke-width="2"/></svg>`,

  // Gems Spent
  gem_1k: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L42 16L24 46L6 16L24 2Z" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/><path d="M6 16H42M14 16L24 46L34 16" stroke="#e0f2fe" stroke-width="1.5"/></svg>`,
  gem_5k: `<svg viewBox="0 0 48 48" fill="none"><path d="M16 6L24 16L16 34L8 16L16 6Z" fill="#059669" stroke="#34d399" stroke-width="1.8"/><path d="M32 6L40 16L32 34L24 16L32 6Z" fill="#059669" stroke="#34d399" stroke-width="1.8"/><path d="M24 16L34 28L24 46L14 28L24 16Z" fill="#10b981" stroke="#6ee7b7" stroke-width="2.2"/></svg>`,
  gem_10k: `<svg viewBox="0 0 48 48" fill="none"><path d="M8 18L14 38H34L40 18L30 26L24 8L18 26L8 18Z" fill="#86198f" stroke="#e879f9" stroke-width="2"/><circle cx="24" cy="8" r="3" fill="#fae8ff"/><circle cx="8" cy="18" r="2.5" fill="#fae8ff"/><circle cx="40" cy="18" r="2.5" fill="#fae8ff"/></svg>`,
  gem_50k: `<svg viewBox="0 0 48 48" fill="none"><rect x="8" y="8" width="32" height="32" rx="6" fill="#78350f" stroke="#facc15" stroke-width="2.5"/><circle cx="24" cy="24" r="10" stroke="#fde047" stroke-width="2.5" stroke-dasharray="4 2"/><path d="M24 16V32M16 24H32" stroke="#fff" stroke-width="3"/></svg>`,
  gem_100k: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L44 14L24 46L4 14L24 2Z" fill="url(#g100kGrad)" stroke="#fff" stroke-width="2.5"/><path d="M4 14H44M12 14L24 46L36 14" stroke="#fff" stroke-width="1.5"/><defs><linearGradient id="g100kGrad" x1="4" y1="2" x2="44" y2="46"><stop stop-color="#38bdf8"/><stop offset="0.5" stop-color="#ec4899"/><stop offset="1" stop-color="#facc15"/></linearGradient></defs></svg>`,

  // Collector
  col_100: `<svg viewBox="0 0 48 48" fill="none"><rect x="14" y="6" width="22" height="30" rx="3" transform="rotate(-15 14 6)" fill="#1e3a8a" stroke="#60a5fa" stroke-width="2"/><rect x="18" y="10" width="22" height="30" rx="3" transform="rotate(15 18 10)" fill="#1d4ed8" stroke="#93c5fd" stroke-width="2"/><rect x="13" y="12" width="22" height="32" rx="3" fill="#2563eb" stroke="#fff" stroke-width="2"/></svg>`,
  col_250: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 6C18 6 10 10 4 12V38C10 36 18 34 24 36C30 34 38 36 44 38V12C38 10 30 6 24 6Z" fill="#581c87" stroke="#c084fc" stroke-width="2.5"/><path d="M24 6V36" stroke="#f5d0fe" stroke-width="2.5"/><circle cx="24" cy="20" r="5" fill="#fbbf24"/></svg>`,
  col_500: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="#f472b6" stroke-width="2" stroke-dasharray="4 3"/><circle cx="24" cy="24" r="11" fill="#3b0764" stroke="#a855f7" stroke-width="2"/><circle cx="24" cy="24" r="5" fill="#fbbf24"/><path d="M6 24C16 10 32 10 42 24C32 38 16 38 6 24Z" stroke="#38bdf8" stroke-width="2"/></svg>`,

  // World Boss Top DMG
  wb_1m: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 28L24 8L36 28L24 42L12 28Z" fill="#c2410c" stroke="#f97316" stroke-width="2.5"/><path d="M4 24L18 20L22 4M44 24L30 20L26 4" stroke="#ffedd5" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  wb_5m: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L34 14L32 38L24 46L16 38L14 14L24 2Z" fill="#991b1b" stroke="#ef4444" stroke-width="2.5"/><path d="M8 18L40 18M10 28L38 28" stroke="#fee2e2" stroke-width="2.5"/></svg>`,
  wb_10m: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" fill="#450a0a" stroke="#ff0055" stroke-width="2.5"/><path d="M8 18L40 32M8 32L40 18" stroke="#ffd700" stroke-width="3"/><circle cx="24" cy="24" r="7" fill="#000" stroke="#fff" stroke-width="2.5"/></svg>`,

  // Total Rolls
  roll_100m: `<svg viewBox="0 0 48 48" fill="none"><rect x="10" y="10" width="24" height="24" rx="5" transform="rotate(-15 10 10)" fill="#831843" stroke="#ec4899" stroke-width="2.5"/><circle cx="18" cy="20" r="2.5" fill="#fff"/><circle cx="28" cy="18" r="2.5" fill="#fff"/><circle cx="23" cy="28" r="2.5" fill="#fff"/></svg>`,
  roll_500m: `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="#8b5cf6" stroke-width="2.5"/><circle cx="24" cy="24" r="11" fill="#2e1065" stroke="#c084fc" stroke-width="2.5"/><path d="M24 4V44M4 24H44" stroke="#ddd6fe" stroke-width="2"/></svg>`,
  roll_1b: `<svg viewBox="0 0 48 48" fill="none"><path d="M12 24C12 16 20 16 24 24C28 32 36 32 36 24C36 16 28 16 24 24C20 32 12 32 12 24Z" stroke="#ffd700" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="24" r="5" fill="#ff0055" stroke="#fff" stroke-width="2"/></svg>`,

  // Starter
  rookie: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 4L42 18V38L24 30L6 38V18L24 4Z" fill="#0369a1" stroke="#38bdf8" stroke-width="2.5"/><path d="M24 14V26M18 20H30" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
  shiny_hunter: `<svg viewBox="0 0 48 48" fill="none"><path d="M24 2L29 16L44 20L32 30L34 46L24 36L14 46L16 30L4 20L19 16L24 2Z" fill="#0891b2" stroke="#67e8f9" stroke-width="2"/><circle cx="24" cy="24" r="5" fill="#fff"/></svg>`
};

function getWingAnimClass(type) {
  if (type === "spire_blades" || type === "hypersonic_jets" || type === "titan_thrusters") return "wing-anim-thrusters";
  if (type === "strata_shatter" || type === "diamond_prism") return "wing-anim-shards";
  if (type === "solar_citadel" || type === "divine_seraph_6") return "wing-anim-seraph";
  if (type === "void_singularity" || type === "supernova_wings") return "wing-anim-tendrils";
  if (type === "quantum_rings") return "wing-anim-gimbal";
  if (type === "muramasa_blades") return "wing-anim-blades";
  if (type === "oni_horns") return "wing-anim-demon";
  if (type === "card_constellation") return "wing-anim-cards";
  if (type === "ouroboros_infinity") return "wing-anim-dragons";
  return "wing-anim-seraph";
}

function getCrownAnimClass(type) {
  if (type === "spire_apex") return "crown-anim-spire";
  if (type === "war_hammer") return "crown-anim-hammer";
  if (type === "citadel_monolith") return "crown-anim-solar";
  if (type === "hypersonic_needle") return "crown-anim-mach";
  if (type === "singularity_core" || type === "abyss_matrix") return "crown-anim-void";
  if (type === "godhead_crown") return "crown-anim-godhead";
  if (type === "slayer_katana") return "crown-anim-katana";
  if (type === "calamity_skull") return "crown-anim-oni";
  if (type === "apocalypse_omega") return "crown-anim-omega";
  if (type === "hyper_diamond") return "crown-anim-diamond";
  if (type === "omni_grimoire") return "crown-anim-grimoire";
  if (type === "world_breaker") return "crown-anim-railgun";
  if (type === "ouroboros_sigil") return "crown-anim-ouroboros";
  return "crown-anim-godhead";
}

function renderDistinctWingSvg(type, isRight, col) {
  const c = col || "#38bdf8";
  const flip = isRight ? 'transform:scaleX(-1)' : '';
  const uid = 'w_' + Math.random().toString(36).substring(2, 7);

  // 1. Spire Blades (Quad Ascension Laser Needles)
  if (type === "spire_blades") {
    return `<svg width="72" height="50" viewBox="0 0 76 52" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="40%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.8"/>
        </linearGradient>
      </defs>
      <!-- Main Ascendant Lance Blade -->
      <polygon points="72,46 54,26 62,4 40,28 26,14 14,38 72,46" fill="url(#${uid}g)"/>
      <polygon points="62,4 46,26 38,10 24,30 50,44" fill="#082f49" opacity="0.6"/>
      <!-- Luminous Energy Spine Needles -->
      <line x1="62" y1="4" x2="42" y2="30" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="40" y1="28" x2="22" y2="40" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="26" y1="14" x2="16" y2="36" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
      <!-- Energy Thruster Core -->
      <circle cx="56" cy="38" r="3.5" fill="#fff" filter="drop-shadow(0 0 6px ${c})"/>
    </svg>`;
  }

  // 2. Strata Shatter (Floating Telekinetic Crystal Shards - Independent Suspended Shards)
  if (type === "strata_shatter") {
    return `<svg width="72" height="50" viewBox="0 0 76 52" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="50%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#042f2e"/>
        </linearGradient>
      </defs>
      <!-- Shard 1 (Top Great Crystal) -->
      <polygon points="68,36 50,22 58,4 72,18" fill="url(#${uid}g1)" stroke="#fff" stroke-width="1.6"/>
      <line x1="58" y1="4" x2="68" y2="36" stroke="#fff" stroke-width="1.2"/>
      <!-- Shard 2 (Mid Telekinetic Shard) -->
      <polygon points="46,42 28,26 36,12 48,24" fill="${c}" stroke="#fff" stroke-width="1.4" opacity="0.9"/>
      <!-- Shard 3 (Inner Orbit Shard) -->
      <polygon points="26,38 12,30 18,18 30,24" fill="${c}" opacity="0.75" stroke="#fff" stroke-width="1"/>
      <!-- Floating Energy Spark Nodes -->
      <circle cx="52" cy="12" r="2.5" fill="#fff"/>
      <circle cx="32" cy="20" r="2" fill="#fff"/>
      <circle cx="64" cy="28" r="2.5" fill="${c}"/>
    </svg>`;
  }

  // 3. Solar Citadel (Sunburst Radiating Laurels)
  if (type === "solar_citadel") {
    return `<svg width="74" height="52" viewBox="0 0 76 52" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}sg" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#f59e0b"/>
          <stop offset="50%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <!-- Outer Coronal Arc -->
      <path d="M72,44 C48,42 24,30 4,4 C14,20 28,38 52,48 C62,52 68,48 72,44 Z" fill="url(#${uid}sg)"/>
      <!-- Inner Radiant Laurel Blades -->
      <path d="M68,32 L36,18 M58,22 L26,8 M46,12 L18,2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      <polygon points="72,44 60,34 68,26" fill="#fef08a"/>
      <polygon points="56,38 46,28 52,20" fill="#fef08a" opacity="0.8"/>
      <circle cx="28" cy="18" r="2.5" fill="#fff"/>
    </svg>`;
  }

  // 4. Hypersonic Jets (Swept-Forward Fighter Thrusters with Blue Afterburner Cones)
  if (type === "hypersonic_jets") {
    return `<svg width="76" height="48" viewBox="0 0 78 50" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}jet" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="35%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <!-- Swept Stabilizer Wing Blade -->
      <polygon points="74,32 46,20 4,4 36,30 52,42 74,32" fill="url(#${uid}jet)" stroke="#fff" stroke-width="1.8"/>
      <line x1="46" y1="20" x2="4" y2="4" stroke="#fff" stroke-width="2.4"/>
      <!-- Afterburner Flame Cones -->
      <polygon class="thruster-cone" points="56,43 76,33 68,45" fill="#38bdf8" filter="drop-shadow(0 0 8px #38bdf8)"/>
      <polygon class="thruster-cone" points="60,42 74,34 68,43" fill="#ffffff"/>
      <!-- Aerodynamic Panel Line -->
      <line x1="38" y1="30" x2="50" y2="38" stroke="#38bdf8" stroke-width="1.5"/>
    </svg>`;
  }

  // 5. Void Singularity (Sung Jin-Woo Shadow Monarch Undulating Mist)
  if (type === "void_singularity") {
    return `<svg width="74" height="52" viewBox="0 0 76 52" fill="none" style="${flip}">
      <defs>
        <radialGradient id="${uid}void" cx="70%" cy="70%" r="65%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="30%" stop-color="${c}"/>
          <stop offset="70%" stop-color="#581c87"/>
          <stop offset="100%" stop-color="#090514" stop-opacity="0.9"/>
        </radialGradient>
      </defs>
      <!-- Undulating Liquid Shadow Mantle -->
      <path d="M70,48 C50,48 30,34 6,6 C14,24 26,44 48,50 C58,52 66,50 70,48 Z" fill="url(#${uid}void)"/>
      <!-- Sinuous Tendril Ribs -->
      <path d="M60,34 C44,34 26,22 12,8" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M52,42 C38,40 24,30 18,18" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Orbiting Soul Orbs -->
      <circle cx="16" cy="14" r="3.5" fill="#fff" filter="drop-shadow(0 0 8px #c084fc)"/>
      <circle cx="34" cy="30" r="2.8" fill="${c}"/>
      <circle cx="56" cy="42" r="3" fill="#fff"/>
    </svg>`;
  }

  // 6. Quantum Rings (3D Gyroscopic Gimbal Rings with Electron Nodes)
  if (type === "quantum_rings") {
    return `<svg width="72" height="50" viewBox="0 0 76 52" fill="none" style="${flip}">
      <!-- Outer Gimbal Ring -->
      <ellipse cx="38" cy="26" rx="34" ry="14" stroke="${c}" stroke-width="2.5" transform="rotate(-22 38 26)"/>
      <!-- Inner Gimbal Ring -->
      <ellipse cx="38" cy="26" rx="22" ry="9" stroke="#ffffff" stroke-width="2" transform="rotate(28 38 26)"/>
      <!-- Core Singularity Ring -->
      <circle cx="38" cy="26" r="6" stroke="#fff" stroke-width="1.8" fill="${c}" fill-opacity="0.6"/>
      <!-- Orbiting Quantum Electron Nodes -->
      <circle cx="12" cy="16" r="3.5" fill="#fff" filter="drop-shadow(0 0 8px #fff)"/>
      <circle cx="62" cy="36" r="3.2" fill="${c}"/>
      <circle cx="48" cy="14" r="2.4" fill="#fff"/>
    </svg>`;
  }

  // 7. Divine Seraph 6 (6-Winged Seraphim Anatomy with Golden Veins)
  if (type === "divine_seraph_6") {
    return `<svg width="76" height="54" viewBox="0 0 80 56" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}sr1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="45%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>
        <linearGradient id="${uid}sr2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="50%" stop-color="#ffd700"/>
          <stop offset="100%" stop-color="#d97706"/>
        </linearGradient>
      </defs>
      <!-- Top Primary Seraph Wing -->
      <path d="M74,22 C52,22 32,10 6,2 C18,10 32,22 52,28 L74,22 Z" fill="url(#${uid}sr1)" filter="drop-shadow(0 0 8px ${c})"/>
      <path d="M6,2 C22,12 36,24 54,28" stroke="#fff" stroke-width="2"/>
      <!-- Mid Secondary Seraph Wing (Gold Vein) -->
      <path d="M78,34 C56,34 36,24 10,16 C22,24 38,36 58,40 L78,34 Z" fill="url(#${uid}sr2)"/>
      <path d="M10,16 C26,26 42,38 60,40" stroke="#fff" stroke-width="1.8"/>
      <!-- Lower Tertiary Seraph Wing -->
      <path d="M68,48 C48,48 34,40 14,32 C26,38 38,48 52,52 L68,48 Z" fill="url(#${uid}sr1)" opacity="0.85"/>
      <!-- Radiant Feather Stars -->
      <circle cx="26" cy="18" r="3" fill="#fff"/>
      <circle cx="48" cy="30" r="2.5" fill="#ffd700"/>
    </svg>`;
  }

  // 8. Muramasa Blades (Gate Katana Arsenal - 4 Fanned Spirit Katana Blades)
  if (type === "muramasa_blades") {
    return `<svg width="74" height="48" viewBox="0 0 76 50" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}bld" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="35%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#082f49"/>
        </linearGradient>
      </defs>
      <!-- Primary Great Katana Blade -->
      <path d="M72,36 C42,36 20,20 4,2 C26,16 46,28 72,36 Z" fill="url(#${uid}bld)" stroke="#fff" stroke-width="1.8"/>
      <line x1="4" y1="2" x2="72" y2="36" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
      <!-- Secondary Upper Katana Blade -->
      <path d="M64,22 C38,22 18,10 6,0 C24,10 42,18 64,22 Z" fill="#ffffff" opacity="0.85"/>
      <line x1="6" y1="0" x2="64" y2="22" stroke="${c}" stroke-width="1.8"/>
      <!-- Lower Parrying Blade -->
      <path d="M58,46 C36,46 18,34 8,20 C24,28 40,40 58,46 Z" fill="url(#${uid}bld)" opacity="0.75"/>
      <circle cx="22" cy="14" r="3" fill="#fff"/>
    </svg>`;
  }

  // 9. Oni Horns (Jagged Demonic Scythe Horns with Crimson Lightning)
  if (type === "oni_horns") {
    return `<svg width="74" height="52" viewBox="0 0 76 54" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}oni" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="40%" stop-color="${c}"/>
          <stop offset="85%" stop-color="#881337"/>
          <stop offset="100%" stop-color="#000000"/>
        </linearGradient>
      </defs>
      <!-- Menacing Heavy Demon Scythe Horn -->
      <path d="M70,48 C50,42 34,26 18,2 C22,22 32,38 54,50 L70,48 Z" fill="url(#${uid}oni)" stroke="#ff0055" stroke-width="2"/>
      <!-- Serrated Inner Scythe Teeth -->
      <polygon points="50,42 42,30 36,40" fill="#fff"/>
      <polygon points="38,32 30,22 26,30" fill="#fff"/>
      <!-- Blood Lightning Arc -->
      <path d="M54,34 L40,24 L44,18 L24,4" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" filter="drop-shadow(0 0 6px #ff0055)"/>
      <circle cx="36" cy="28" r="3" fill="#ff0055"/>
    </svg>`;
  }

  // 10. Supernova Wings (Solar Flare Coronal Prominences)
  if (type === "supernova_wings") {
    return `<svg width="76" height="52" viewBox="0 0 78 54" fill="none" style="${flip}">
      <defs>
        <linearGradient id="${uid}sn" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stop-color="#ef4444"/>
          <stop offset="50%" stop-color="${c}"/>
          <stop offset="100%" stop-color="#fef08a"/>
        </linearGradient>
      </defs>
      <path d="M74,44 C50,44 26,26 2,2 C12,18 24,38 48,48 C60,52 68,48 74,44 Z" fill="url(#${uid}sn)"/>
      <path d="M58,26 C38,22 24,12 10,2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
      <polygon points="44,22 58,12 50,30" fill="#fff"/>
      <circle cx="20" cy="8" r="3" fill="#fff"/>
    </svg>`;
  }

  // 11. Diamond Prism (Floating Octahedral Diamond Facet Shards)
  if (type === "diamond_prism") {
    return `<svg width="72" height="50" viewBox="0 0 76 52" fill="none" style="${flip}">
      <!-- Great Faceted Crystal -->
      <polygon points="66,34 46,12 32,36 52,50" fill="${c}" stroke="#fff" stroke-width="2"/>
      <polygon points="46,12 32,36 18,22" fill="#ffffff" opacity="0.85" stroke="#fff" stroke-width="1.5"/>
      <polygon points="32,36 52,50 38,48 18,22" fill="#0369a1" opacity="0.6"/>
      <line x1="46" y1="12" x2="52" y2="50" stroke="#fff" stroke-width="2"/>
      <!-- Satellite Prisms -->
      <polygon points="24,18 10,4 2,16 16,24" fill="${c}" stroke="#fff" stroke-width="1.4"/>
      <circle cx="46" cy="12" r="3" fill="#fff"/>
    </svg>`;
  }

  // 12. Card Constellation (Orbiting 5-Card Royal Spread)
  if (type === "card_constellation") {
    return `<svg width="74" height="48" viewBox="0 0 76 50" fill="none" style="${flip}">
      <!-- Card 3 (Outer) -->
      <rect x="46" y="4" width="24" height="34" rx="3" transform="rotate(28 46 4)" fill="#090514" stroke="${c}" stroke-width="2"/>
      <!-- Card 2 (Mid) -->
      <rect x="26" y="8" width="24" height="34" rx="3" transform="rotate(12 26 8)" fill="${c}" stroke="#fff" stroke-width="1.8" opacity="0.9"/>
      <!-- Card 1 (Inner) -->
      <rect x="6" y="14" width="24" height="34" rx="3" transform="rotate(-6 6 14)" fill="#ffffff" stroke="#000" stroke-width="1.5" opacity="0.85"/>
      <!-- Holographic Foil Glints -->
      <line x1="48" y1="10" x2="64" y2="34" stroke="#fff" stroke-width="1.8"/>
      <circle cx="38" cy="22" r="3" fill="#fff"/>
    </svg>`;
  }

  // 13. Titan Thrusters (Heavy Industrial Hydraulic Booster Plates)
  if (type === "titan_thrusters") {
    return `<svg width="74" height="46" viewBox="0 0 76 48" fill="none" style="${flip}">
      <!-- Titanium Armor Plate -->
      <rect x="30" y="10" width="40" height="26" rx="3" fill="#18181b" stroke="${c}" stroke-width="2.5"/>
      <rect x="42" y="16" width="18" height="14" fill="#09090b" stroke="#fff" stroke-width="1.5"/>
      <!-- High-Pressure Plasma Exhaust -->
      <polygon points="30,23 4,12 4,34 30,23" fill="${c}" opacity="0.95"/>
      <line x1="4" y1="23" x2="30" y2="23" stroke="#fff" stroke-width="2.5"/>
      <!-- Steam Vent Node -->
      <circle cx="62" cy="23" r="3" fill="#facc15"/>
    </svg>`;
  }

  // 14. Ouroboros Infinity (Dual Coiled Infinity Dragons with Celestial Fire)
  return `<svg width="76" height="52" viewBox="0 0 78 54" fill="none" style="${flip}">
    <path d="M72,36 C56,36 42,22 22,22 C12,22 4,28 4,38 C4,48 14,52 24,48 C44,42 58,52 72,36 Z" stroke="${c}" stroke-width="3" fill="none"/>
    <path d="M72,36 C56,36 42,22 22,22" stroke="#ffffff" stroke-width="1.8"/>
    <circle cx="22" cy="22" r="4.5" fill="#ff0055" filter="drop-shadow(0 0 6px #ff0055)"/>
    <circle cx="60" cy="36" r="4" fill="#ffd700"/>
    <polygon points="76,34 68,26 74,42" fill="#ffd700"/>
  </svg>`;
}


function renderDistinctCrownSvg(type, col) {
  const c = col || "#ffd700";
  const uid = 'c_' + Math.random().toString(36).substring(2, 7);

  // 1. Spire Apex (Ascendant Laser Beacon with Expanding Sonic Rings)
  if (type === "spire_apex") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <!-- Rotating Celestial Ring Behind -->
      <circle class="crest-halo-ring" cx="24" cy="20" r="14" stroke="${c}" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.6"/>
      <!-- Ascendant Needle Spear -->
      <polygon points="24,2 32,16 42,32 6,32 16,16" fill="${c}" stroke="#ffffff" stroke-width="1.8"/>
      <line x1="24" y1="2" x2="24" y2="32" stroke="#ffffff" stroke-width="2"/>
      <circle cx="24" cy="18" r="4" fill="#ffffff" filter="drop-shadow(0 0 8px #ffffff)"/>
    </svg>`;
  }

  // 2. War Hammer (Seismic Runic Hammer Cracking Anvil with Molten Magma)
  if (type === "war_hammer") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <circle class="crest-halo-ring" cx="24" cy="20" r="15" stroke="${c}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>
      <!-- Runic Hammer Head -->
      <rect x="8" y="6" width="32" height="16" rx="3" fill="#18181b" stroke="${c}" stroke-width="2.4"/>
      <rect x="21" y="22" width="6" height="14" fill="#ffffff"/>
      <line x1="4" y1="14" x2="44" y2="14" stroke="#ff0055" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="24" cy="14" r="3.5" fill="#ffffff"/>
    </svg>`;
  }

  // 3. Citadel Monolith (Roman Triumphal Sun Arch with Rotating 12-Ray Solar Dial)
  if (type === "citadel_monolith") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <circle class="crest-halo-ring" cx="24" cy="18" r="16" stroke="#ffd700" stroke-width="1.6" stroke-dasharray="3 3"/>
      <!-- Monolith Arch Body -->
      <path d="M12,34 V12 L24,4 L36,12 V34 H12 Z" fill="${c}" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="24" cy="18" r="5.5" fill="#ffffff"/>
      <line x1="24" y1="4" x2="24" y2="34" stroke="#000000" stroke-width="2"/>
    </svg>`;
  }

  // 4. Hypersonic Needle (Rocket Piercing Twin Barrier Shock Cones)
  if (type === "hypersonic_needle") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <ellipse cx="24" cy="24" rx="18" ry="7" stroke="${c}" stroke-width="2" stroke-dasharray="5 3"/>
      <ellipse cx="24" cy="16" rx="12" ry="5" stroke="#ffffff" stroke-width="1.6"/>
      <!-- Mach Needle Core -->
      <polygon points="24,2 30,26 18,26" fill="${c}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="24" cy="14" r="3" fill="#ffffff"/>
    </svg>`;
  }

  // 5. Singularity Core (Black Hole Accretion Disk with Orbiting Dark Matter Orbs)
  if (type === "singularity_core") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <circle class="crest-halo-ring" cx="24" cy="19" r="16" stroke="#c084fc" stroke-width="1.8" stroke-dasharray="5 3"/>
      <circle cx="24" cy="19" r="11" fill="#000000" stroke="${c}" stroke-width="2.5"/>
      <ellipse cx="24" cy="19" rx="20" ry="6" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="24" cy="19" r="4" fill="#ffffff"/>
      <circle cx="38" cy="14" r="2.5" fill="#c084fc"/>
    </svg>`;
  }

  // 6. Abyss Matrix (Hexagonal Dark Matter Lattice with Floating Soul Orbs)
  if (type === "abyss_matrix") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <polygon points="24,4 40,14 40,28 24,36 8,28 8,14" stroke="${c}" stroke-width="2" fill="none"/>
      <circle cx="24" cy="20" r="7" fill="${c}" stroke="#ffffff" stroke-width="1.8"/>
      <circle cx="24" cy="20" r="3" fill="#ffffff"/>
      <circle cx="10" cy="12" r="2.5" fill="#ffffff"/>
      <circle cx="38" cy="12" r="2.5" fill="#ffffff"/>
    </svg>`;
  }

  // 7. Godhead Crown (12-Point Sacred Geometry Godhead Crown)
  if (type === "godhead_crown") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <!-- 12-Star Halo Dial -->
      <circle class="crest-halo-ring" cx="24" cy="19" r="16" stroke="#ffd700" stroke-width="1.8" stroke-dasharray="4 2"/>
      <polygon points="24,3 38,28 10,28" stroke="#ffffff" stroke-width="1.8" fill="none"/>
      <polygon points="24,35 38,10 10,10" stroke="${c}" stroke-width="1.8" fill="none"/>
      <circle cx="24" cy="19" r="4.5" fill="#ffd700" stroke="#ffffff" stroke-width="1.5" filter="drop-shadow(0 0 8px #ffd700)"/>
    </svg>`;
  }

  // 8. Slayer Katana (Crossed Muramasa Katanas with Hamon Temper Line)
  if (type === "slayer_katana") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <circle class="crest-halo-ring" cx="24" cy="19" r="15" stroke="${c}" stroke-width="1.5" stroke-dasharray="8 4"/>
      <!-- Crossed Blades -->
      <line x1="6" y1="6" x2="42" y2="32" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <line x1="42" y1="6" x2="6" y2="32" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
      <line x1="8" y1="8" x2="40" y2="30" stroke="${c}" stroke-width="1.4"/>
      <circle cx="24" cy="19" r="5" fill="${c}" stroke="#ffffff" stroke-width="1.5"/>
    </svg>`;
  }

  // 9. Calamity Skull (Horned Demon Skull with Crackling Crimson Lightning)
  if (type === "calamity_skull") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <!-- Demonic Horns -->
      <path d="M10,6 C16,14 18,22 14,32 C20,26 28,26 34,32 C30,22 32,14 38,6 C34,16 30,20 24,18 C18,20 14,16 10,6 Z" fill="${c}" stroke="#ff0055" stroke-width="2"/>
      <!-- Glowing Red Eye Sockets -->
      <circle cx="19" cy="22" r="2.8" fill="#ff0055" filter="drop-shadow(0 0 6px #ff0055)"/>
      <circle cx="29" cy="22" r="2.8" fill="#ff0055" filter="drop-shadow(0 0 6px #ff0055)"/>
      <circle cx="19" cy="22" r="1.2" fill="#ffffff"/>
      <circle cx="29" cy="22" r="1.2" fill="#ffffff"/>
    </svg>`;
  }

  // 10. Apocalypse Omega (Collapsing Supernova in Greek Omega Ω Seal)
  if (type === "apocalypse_omega") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <circle class="crest-halo-ring" cx="24" cy="18" r="16" stroke="#ff0055" stroke-width="1.8" stroke-dasharray="4 2"/>
      <!-- Omega Arch -->
      <path d="M10,32 H18 C18,20 30,20 30,32 H38" stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"/>
      <!-- Supernova Core -->
      <circle cx="24" cy="15" r="6" fill="#ff0055" stroke="#ffffff" stroke-width="2" filter="drop-shadow(0 0 8px #ff0055)"/>
      <circle cx="24" cy="15" r="2.5" fill="#ffffff"/>
    </svg>`;
  }

  // 11. Hyper Diamond (Levitating Octahedral Diamond & 4 Orbiting Gem Shards)
  if (type === "hyper_diamond") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <circle class="crest-halo-ring" cx="24" cy="19" r="15" stroke="${c}" stroke-width="1.5" stroke-dasharray="5 3"/>
      <!-- Great Octahedral Diamond -->
      <polygon points="24,4 38,19 24,34 10,19" fill="${c}" stroke="#ffffff" stroke-width="2"/>
      <polygon points="24,4 38,19 24,19" fill="#ffffff" opacity="0.8"/>
      <line x1="10" y1="19" x2="38" y2="19" stroke="#ffffff" stroke-width="1.6"/>
      <circle cx="24" cy="19" r="3" fill="#ffffff"/>
    </svg>`;
  }

  // 12. Omni Grimoire (Floating Open Grimoire with Ethereal Rune Sparks)
  if (type === "omni_grimoire") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <!-- Open Tome Body -->
      <path d="M24,10 C18,7 8,8 4,12 V32 C8,28 18,28 24,31 C30,28 40,28 44,32 V12 C40,8 30,7 24,10 Z" fill="${c}" stroke="#ffffff" stroke-width="2"/>
      <line x1="24" y1="10" x2="24" y2="31" stroke="#000000" stroke-width="2"/>
      <!-- Floating Soul Orb -->
      <circle cx="24" cy="5" r="3.5" fill="#ffffff" filter="drop-shadow(0 0 8px #c084fc)"/>
    </svg>`;
  }

  // 13. World Breaker (Orbital Railgun Reticle Locked onto Fractured Planetoid)
  if (type === "world_breaker") {
    return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
      <circle class="crest-halo-ring" cx="24" cy="19" r="16" stroke="#ef4444" stroke-width="2" stroke-dasharray="8 4"/>
      <!-- Shattered Planet Core -->
      <circle cx="24" cy="19" r="10" fill="#18181b" stroke="${c}" stroke-width="2.5"/>
      <!-- Railgun Targeting Crosshairs -->
      <line x1="4" y1="19" x2="44" y2="19" stroke="#ff0055" stroke-width="2.5"/>
      <line x1="24" y1="4" x2="24" y2="34" stroke="#ff0055" stroke-width="2.5"/>
      <circle cx="24" cy="19" r="3.5" fill="#ffffff"/>
    </svg>`;
  }

  // 14. Ouroboros Sigil (Golden Infinity Dragon Serpents Coiled in Singularity)
  return `<svg width="48" height="38" viewBox="0 0 48 38" fill="none">
    <circle class="crest-halo-ring" cx="24" cy="19" r="16" stroke="${c}" stroke-width="1.8" stroke-dasharray="6 3"/>
    <path d="M14,19 C14,12 20,12 24,19 C28,26 34,26 34,19 C34,12 28,12 24,19 C20,26 14,26 14,19 Z" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="24" cy="19" r="3.5" fill="#ff0055" filter="drop-shadow(0 0 6px #ff0055)"/>
    <circle cx="14" cy="19" r="2.5" fill="#ffd700"/>
    <circle cx="34" cy="19" r="2.5" fill="#ffd700"/>
  </svg>`;
}



// 5. MASTER TITLES CATALOG (29 TITLES)
const MASTER_TITLES = [
    {
      id: "TOWER_10",
      name: "SPIRE IGNITION",
      kanji: "初陣",
      subTag: "// FL.10 ASCENDANT",
      cls: "title-spire_ignition",
      desc: "Ignited ascension through Infinite Spire Floor 10.",
      req: "Tower Floor 10+",
      colors: ["#38bdf8","#ffffff","#0284c7"],
      wing: "spire_blades",
      crown: "spire_apex",
      iconKey: "tower_10"
    },
    {
      id: "TOWER_50",
      name: "STRATA CRUSHER",
      kanji: "地裂",
      subTag: "// FL.50 SHATTERED",
      cls: "title-strata_crusher",
      desc: "Shattered rock and gravity at Tower Floor 50.",
      req: "Tower Floor 50+",
      colors: ["#818cf8","#e0e7ff","#4f46e5"],
      wing: "strata_shatter",
      crown: "war_hammer",
      iconKey: "tower_50"
    },
    {
      id: "TOWER_100",
      name: "CENTURION OVERDRIVE",
      kanji: "百覇",
      subTag: "// FL.100 SUMMIT",
      cls: "title-centurion_overdrive",
      desc: "Scaled the legendary 100th floor monolith citadel.",
      req: "Tower Floor 100+",
      colors: ["#fbbf24","#fffbeb","#d97706"],
      wing: "solar_citadel",
      crown: "citadel_monolith",
      iconKey: "tower_100"
    },
    {
      id: "TOWER_200",
      name: "STRATO PIERCER",
      kanji: "穿空",
      subTag: "// FL.200 STRATOSPHERE",
      cls: "title-strato_piercer",
      desc: "Pierced the stratosphere at orbital Floor 200.",
      req: "Tower Floor 200+",
      colors: ["#f43f5e","#ffe4e6","#be123c"],
      wing: "hypersonic_jets",
      crown: "hypersonic_needle",
      iconKey: "tower_200"
    },
    {
      id: "TOWER_300",
      name: "VOID HORIZON",
      kanji: "虚淵",
      subTag: "// FL.300 SINGULARITY",
      cls: "title-void_horizon",
      desc: "Crossed dimensional event horizon at Floor 300.",
      req: "Tower Floor 300+",
      colors: ["#c084fc","#f3e8ff","#7e22ce"],
      wing: "void_singularity",
      crown: "singularity_core",
      iconKey: "tower_300"
    },
    {
      id: "TOWER_400",
      name: "ABYSS EMPEROR",
      kanji: "冥王",
      subTag: "// FL.400 GRAVITON",
      cls: "title-abyss_emperor",
      desc: "Harnessed dark-matter gravitas at Floor 400.",
      req: "Tower Floor 400+",
      colors: ["#34d399","#ecfdf5","#047857"],
      wing: "quantum_rings",
      crown: "abyss_matrix",
      iconKey: "tower_400"
    },
    {
      id: "TOWER_500",
      name: "INFINITE GODHEAD",
      kanji: "無限神",
      subTag: "// FL.500 SOVEREIGN",
      cls: "title-infinite_godhead",
      desc: "Achieved omnipotent godhead apex at Floor 500.",
      req: "Tower Floor 500+",
      colors: ["#ffd700","#ff0055","#00f0ff"],
      wing: "divine_seraph_6",
      crown: "godhead_crown",
      iconKey: "tower_500"
    },
    {
      id: "STORY_EASY",
      name: "ROOKIE STRIKER",
      kanji: "初陣",
      subTag: "// EASY CLEARED",
      cls: "title-rookie_striker",
      desc: "Cleared all 30 story operations on Easy.",
      req: "Clear All Story Easy",
      colors: ["#94a3b8","#f1f5f9","#475569"],
      wing: "muramasa_blades",
      crown: "spire_apex",
      iconKey: "story_easy"
    },
    {
      id: "STORY_NORMAL",
      name: "CHRONICLE BLADE",
      kanji: "英雄録",
      subTag: "// NORMAL PROTOCOL",
      cls: "title-chronicle_blade",
      desc: "Cleared all 30 story operations on Normal.",
      req: "Clear All Story Normal",
      colors: ["#38bdf8","#bae6fd","#0369a1"],
      wing: "muramasa_blades",
      crown: "slayer_katana",
      iconKey: "story_normal"
    },
    {
      id: "STORY_HARD",
      name: "IRON PROTOCOL",
      kanji: "鋼鉄防壁",
      subTag: "// HARD SECURED",
      cls: "title-iron_protocol",
      desc: "Cleared all 30 story operations on Hard.",
      req: "Clear All Story Hard",
      colors: ["#f59e0b","#fef3c7","#b45309"],
      wing: "strata_shatter",
      crown: "citadel_monolith",
      iconKey: "story_hard"
    },
    {
      id: "STORY_EXTREME",
      name: "CALAMITY REAPER",
      kanji: "災厄断滅",
      subTag: "// EXTREME EXECUTED",
      cls: "title-calamity_reaper",
      desc: "Cleared all 30 story operations on Extreme.",
      req: "Clear All Story Extreme",
      colors: ["#06b6d4","#cffafe","#0e7490"],
      wing: "oni_horns",
      crown: "calamity_skull",
      iconKey: "story_extreme"
    },
    {
      id: "STORY_NIGHTMARE",
      name: "NIGHTMARE PURGER",
      kanji: "悪夢屠殺",
      subTag: "// NIGHTMARE EXTINCT",
      cls: "title-nightmare_purger",
      desc: "Purged all nightmares across 30 sectors.",
      req: "Clear All Story Nightmare",
      colors: ["#c084fc","#f3e8ff","#7e22ce"],
      wing: "oni_horns",
      crown: "calamity_skull",
      iconKey: "story_nightmare"
    },
    {
      id: "STORY_APOCALYPSE",
      name: "APOCALYPSE ENDBRINGER",
      kanji: "終焉覇者",
      subTag: "// APOCALYPSE TRANSCENDED",
      cls: "title-apocalypse_endbringer",
      desc: "Extinguished extinction itself on Apocalypse.",
      req: "Clear All Story Apocalypse",
      colors: ["#ff0055","#ffaa00","#ffd700"],
      wing: "supernova_wings",
      crown: "apocalypse_omega",
      iconKey: "story_apocalypse"
    },
    {
      id: "GEMS_1K",
      name: "GEM NOVA",
      kanji: "晶光",
      subTag: "// 1,000 GEMS",
      cls: "title-gem_nova",
      desc: "Invested 1,000 Premium Gems into the Arsenal.",
      req: "Spend 1,000+ Gems",
      colors: ["#38bdf8","#e0f2fe","#0284c7"],
      wing: "spire_blades",
      crown: "spire_apex",
      iconKey: "gem_1k"
    },
    {
      id: "GEMS_5K",
      name: "EMERALD FORTUNE",
      kanji: "翠嵐",
      subTag: "// 5,000 GEMS",
      cls: "title-emerald_fortune",
      desc: "Invested 5,000 Premium Gems into the Arsenal.",
      req: "Spend 5,000+ Gems",
      colors: ["#34d399","#d1fae5","#059669"],
      wing: "quantum_rings",
      crown: "abyss_matrix",
      iconKey: "gem_5k"
    },
    {
      id: "GEMS_10K",
      name: "JEWEL EMPEROR",
      kanji: "宝冠",
      subTag: "// 10,000 GEMS",
      cls: "title-jewel_emperor",
      desc: "Invested 10,000 Premium Gems into the Arsenal.",
      req: "Spend 10,000+ Gems",
      colors: ["#e879f9","#fae8ff","#a21caf"],
      wing: "diamond_prism",
      crown: "citadel_monolith",
      iconKey: "gem_10k"
    },
    {
      id: "GEMS_50K",
      name: "ASTRAL TREASURY",
      kanji: "星天財閥",
      subTag: "// 50,000 GEMS",
      cls: "title-astral_treasury",
      desc: "Invested 50,000 Premium Gems into the Arsenal.",
      req: "Spend 50,000+ Gems",
      colors: ["#facc15","#fef08a","#c2410c"],
      wing: "solar_citadel",
      crown: "citadel_monolith",
      iconKey: "gem_50k"
    },
    {
      id: "GEMS_100K",
      name: "HYPER DIAMOND OVERLORD",
      kanji: "金剛神皇",
      subTag: "// 100,000 GEMS",
      cls: "title-hyper_diamond_overlord",
      desc: "Transcended wealth with 100,000 Gems invested.",
      req: "Spend 100,000+ Gems",
      colors: ["#ffffff","#7df9ff","#ff007f"],
      wing: "diamond_prism",
      crown: "hyper_diamond",
      iconKey: "gem_100k"
    },
    {
      id: "COL_100",
      name: "CODEX MANIAC",
      kanji: "百面録",
      subTag: "// 100 VARIANTS",
      cls: "title-codex_maniac",
      desc: "Gathered 100 unique card variants into Codex.",
      req: "100+ Variants Owned",
      colors: ["#60a5fa","#dbeafe","#1d4ed8"],
      wing: "card_constellation",
      crown: "spire_apex",
      iconKey: "col_100"
    },
    {
      id: "COL_250",
      name: "ARCHIVE DOMINATOR",
      kanji: "魔導典",
      subTag: "// 250 VARIANTS",
      cls: "title-archive_dominator",
      desc: "Gathered 250 unique card variants into Codex.",
      req: "250+ Variants Owned",
      colors: ["#c084fc","#f5d0fe","#6b21a8"],
      wing: "card_constellation",
      crown: "omni_grimoire",
      iconKey: "col_250"
    },
    {
      id: "COL_500",
      name: "OMNI CODEX GOD",
      kanji: "全知全能",
      subTag: "// 500 VARIANTS",
      cls: "title-omni_codex_god",
      desc: "Gathered 500 variants into the Omniscient Archive.",
      req: "500+ Variants Owned",
      colors: ["#ff00ff","#00ffff","#ffd700"],
      wing: "card_constellation",
      crown: "omni_grimoire",
      iconKey: "col_500"
    },
    {
      id: "WB_1M",
      name: "TITAN BUSTER",
      kanji: "巨人殺",
      subTag: "// 1,000,000 DMG",
      cls: "title-titan_buster",
      desc: "Dealt 1,000,000+ damage in a single World Boss raid.",
      req: "1,000,000+ WB DMG",
      colors: ["#f97316","#ffedd5","#9a3412"],
      wing: "titan_thrusters",
      crown: "calamity_skull",
      iconKey: "wb_1m"
    },
    {
      id: "WB_5M",
      name: "CALAMITY BEHEMOTH",
      kanji: "災獣屠殺",
      subTag: "// 5,000,000 DMG",
      cls: "title-calamity_behemoth",
      desc: "Dealt 5,000,000+ damage in a single World Boss raid.",
      req: "5,000,000+ WB DMG",
      colors: ["#ef4444","#fee2e2","#7f1d1d"],
      wing: "titan_thrusters",
      crown: "calamity_skull",
      iconKey: "wb_5m"
    },
    {
      id: "WB_10M",
      name: "WORLD SHATTERER",
      kanji: "星辰崩壊",
      subTag: "// 10,000,000 DMG",
      cls: "title-world_shatterer",
      desc: "Shattered planetary boss with 10M+ raid damage.",
      req: "10,000,000+ WB DMG",
      colors: ["#ffd700","#ff0055","#18181b"],
      wing: "titan_thrusters",
      crown: "world_breaker",
      iconKey: "wb_10m"
    },
    {
      id: "ROLL_100M",
      name: "DESTINY GAMBLER",
      kanji: "狂賭",
      subTag: "// 100M ROLLS",
      cls: "title-destiny_gambler",
      desc: "Pulled 100,000,000 cards across destiny rolls.",
      req: "100,000,000+ Rolls",
      colors: ["#ec4899","#fce7f3","#9d174d"],
      wing: "hypersonic_jets",
      crown: "spire_apex",
      iconKey: "roll_100m"
    },
    {
      id: "ROLL_500M",
      name: "FATE WEAVER",
      kanji: "輪廻紡",
      subTag: "// 500M ROLLS",
      cls: "title-fate_weaver",
      desc: "Spun 500,000,000 cards into the cosmic tapestry.",
      req: "500,000,000+ Rolls",
      colors: ["#8b5cf6","#ede9fe","#4c1d95"],
      wing: "strata_shatter",
      crown: "singularity_core",
      iconKey: "roll_500m"
    },
    {
      id: "ROLL_1B",
      name: "SINGULARITY LORD",
      kanji: "百億神引",
      subTag: "// 1,000,000,000 ROLLS",
      cls: "title-singularity_lord",
      desc: "Achieved the legendary 1 Billion Gacha Singularity.",
      req: "1,000,000,000+ Rolls",
      colors: ["#ffd700","#ff0055","#00ffff"],
      wing: "ouroboros_infinity",
      crown: "ouroboros_sigil",
      iconKey: "roll_1b"
    },
    {
      id: "ROOKIE",
      name: "ROOKIE",
      kanji: "初陣",
      subTag: "// OPERATOR REGISTERED",
      cls: "title-rookie",
      desc: "Initial operator title assigned to all hunters.",
      req: "Default Title",
      colors: ["#38bdf8","#ffffff","#0284c7"],
      wing: "spire_blades",
      crown: "spire_apex",
      iconKey: "rookie"
    },
    {
      id: "SHINY_HUNTER",
      name: "SHINY HUNTER",
      kanji: "星撃",
      subTag: "// SHINY SECURED",
      cls: "title-shiny_hunter",
      desc: "Discovered at least 1 ultra-rare Shiny card.",
      req: "Obtain 1 Shiny Card",
      colors: ["#22d3ee","#ffffff","#0891b2"],
      wing: "spire_blades",
      crown: "spire_apex",
      iconKey: "shiny_hunter"
    }
  ];

function evalTitleUnlocked(t) {
  if (typeof state === 'undefined' || !state) return (t.id === 'ROOKIE');
  const s = state;
  switch (t.id) {
    case 'ROOKIE': return true;
    case 'TOWER_10': return ((s.tower && s.tower.best) || 0) >= 10;
    case 'TOWER_50': return ((s.tower && s.tower.best) || 0) >= 50;
    case 'TOWER_100': return ((s.tower && s.tower.best) || 0) >= 100;
    case 'TOWER_200': return ((s.tower && s.tower.best) || 0) >= 200;
    case 'TOWER_300': return ((s.tower && s.tower.best) || 0) >= 300;
    case 'TOWER_400': return ((s.tower && s.tower.best) || 0) >= 400;
    case 'TOWER_500': return ((s.tower && s.tower.best) || 0) >= 500;
    case 'STORY_EASY': return !!(s.clearedDiff && Object.keys(s.clearedDiff.easy || {}).length >= 30);
    case 'STORY_NORMAL': return !!(s.clearedDiff && Object.keys(s.clearedDiff.normal || {}).length >= 30);
    case 'STORY_HARD': return !!(s.clearedDiff && Object.keys(s.clearedDiff.hard || {}).length >= 30);
    case 'STORY_EXTREME': return !!(s.clearedDiff && Object.keys(s.clearedDiff.extreme || {}).length >= 30);
    case 'STORY_NIGHTMARE': return !!(s.clearedDiff && Object.keys(s.clearedDiff.nightmare || {}).length >= 30);
    case 'STORY_APOCALYPSE': return !!(s.clearedDiff && Object.keys(s.clearedDiff.apocalypse || {}).length >= 30);
    case 'GEMS_1K': return (s.gemsSpent || 0) >= 1000;
    case 'GEMS_5K': return (s.gemsSpent || 0) >= 5000;
    case 'GEMS_10K': return (s.gemsSpent || 0) >= 10000;
    case 'GEMS_50K': return (s.gemsSpent || 0) >= 50000;
    case 'GEMS_100K': return (s.gemsSpent || 0) >= 100000;
    case 'COL_100': return ((s.stacks || []).length >= 100);
    case 'COL_250': return ((s.stacks || []).length >= 250);
    case 'COL_500': return ((s.stacks || []).length >= 500);
    case 'WB_1M': return (typeof wbBestRunDmg === 'function' ? wbBestRunDmg() : 0) >= 1000000;
    case 'WB_5M': return (typeof wbBestRunDmg === 'function' ? wbBestRunDmg() : 0) >= 5000000;
    case 'WB_10M': return (typeof wbBestRunDmg === 'function' ? wbBestRunDmg() : 0) >= 10000000;
    case 'ROLL_100M': return (s.totalRolls || 0) >= 100000000;
    case 'ROLL_500M': return (s.totalRolls || 0) >= 500000000;
    case 'ROLL_1B': return (s.totalRolls || 0) >= 1000000000;
    case 'SHINY_HUNTER': return ((s.stacks || []).filter(x => x.shiny).length >= 1);
    default: return false;
  }
}

function getTitlesList() {
  return MASTER_TITLES.map(t => Object.assign({}, t, { unlocked: evalTitleUnlocked(t) }));
}

window.MASTER_TITLES = MASTER_TITLES;
window.TITLE_DEFS = MASTER_TITLES;
window.evalTitleUnlocked = evalTitleUnlocked;
window.getTitlesList = getTitlesList;



// 6. SOLO GOD AURA HTML BUILDER (NO SWEEP SHEEN LINE)
function renderSoloGodAuraHtml(t, options) {
  if (!t) return '';
  const opt = options || {};
  const isBob = opt.bob ?? true;
  const col1 = (t.colors && t.colors[0]) || '#38bdf8';
  const col2 = (t.colors && t.colors[1]) || '#ffffff';
  const col3 = (t.colors && t.colors[2]) || '#0284c7';
  const grad = 'linear-gradient(180deg, ' + col2 + ' 0%, ' + col1 + ' 65%, ' + col3 + ' 100%)';
  const safeCls = t.cls || ('title-' + (t.name || '').toLowerCase().replace(/\s+/g, '_'));

  const wingAnimCls = (typeof getWingAnimClass === 'function') ? getWingAnimClass(t.wing) : 'wing-anim-seraph';
  const crownAnimCls = (typeof getCrownAnimClass === 'function') ? getCrownAnimClass(t.crown) : 'crown-anim-spire';

  const kanjiHtml = t.kanji ? ('<span class="sga-kanji-stamp">' + t.kanji + '</span>') : '';

  return [
    '<div class="solo-god-lockup ' + safeCls + (isBob ? '' : ' no-bob') + '" style="--aura-col:' + col1 + ';--aura-glow:' + col1 + '80;--aura-edge:' + col3 + ';--text-grad:' + grad + ';--stroke-w:1.4px;">',
    '  <!-- 1. Multi-Layer Organic Plasma Flame & Circular Shockwaves -->',
    '  <div class="sga-aura-field">',
    '    <div class="sga-flame-pillar"></div>',
    '    <div class="sga-flame-core"></div>',
    '    <div class="sga-shockwave-circle sw1"></div>',
    '    <div class="sga-shockwave-circle sw2"></div>',
    '    <!-- High-Voltage Lightning Arcs -->',
    '    <div class="sga-lightning-wrap">',
    '      <svg class="sga-bolt b1" width="30" height="24" viewBox="0 0 30 24"><polyline points="2,4 12,2 10,12 24,10 18,22"/></svg>',
    '      <svg class="sga-bolt b2" width="34" height="24" viewBox="0 0 34 24"><polyline points="4,22 14,14 10,10 26,6 20,2"/></svg>',
    '      <svg class="sga-bolt b3" width="24" height="28" viewBox="0 0 24 28"><polyline points="18,2 6,10 14,14 2,24"/></svg>',
    '    </div>',
    '    <!-- Rising Spirit Ion Embers -->',
    '    <div class="sga-embers" style="color:' + col1 + ';">',
    '      <span class="sga-ember"></span><span class="sga-ember"></span>',
    '      <span class="sga-ember"></span><span class="sga-ember"></span>',
    '    </div>',
    '  </div>',
    '  <!-- 2. Gyroscopic Top Crest & Radiant Halo Emblem -->',
    '  <div class="sga-crest-mount ' + crownAnimCls + '">',
    '    ' + ((typeof renderDistinctCrownSvg === 'function') ? renderDistinctCrownSvg(t.crown, col1) : ''),
    '  </div>',
    '  <!-- 3. Left Articulated 3D Wing Flank -->',
    '  <div class="sga-wing-mount sga-wing-l ' + wingAnimCls + '">',
    '    ' + ((typeof renderDistinctWingSvg === 'function') ? renderDistinctWingSvg(t.wing, false, col1) : ''),
    '  </div>',
    '  <!-- 4. Pure Floating Anime Graffiti Text -->',
    '  <div class="sga-text-stage">',
    '    ' + kanjiHtml,
    '    <span class="sga-core-text">' + t.name + '</span>',
    '    <span class="sga-kicker-tag">' + (t.subTag || '// ASCENDANT') + '</span>',
    '  </div>',
    '  <!-- 5. Right Articulated 3D Wing Flank -->',
    '  <div class="sga-wing-mount sga-wing-r ' + wingAnimCls + '">',
    '    ' + ((typeof renderDistinctWingSvg === 'function') ? renderDistinctWingSvg(t.wing, true, col1) : ''),
    '  </div>',
    '</div>'
  ].join('\n');
}
window.renderSoloGodAuraHtml = renderSoloGodAuraHtml;

// 7. GLOBAL RENDERER COMPATIBILITY
function renderTitleCrownHtml(titleIdOrName, variantCls) {
  const key = titleIdOrName || (window.state && window.state.playerTitle) || 'ROOKIE';
  const defs = (typeof window.getTitlesList === 'function') ? window.getTitlesList() : ((typeof TITLE_DEFS !== 'undefined') ? TITLE_DEFS : (window.TITLE_DEFS || []));
  let t = defs.find(x => x.id === key || x.name === key);
  if (!t && defs.length > 0) {
    t = defs.find(x => x.id === 'ROOKIE') || defs[defs.length - 2] || defs[0];
  }
  if (t) {
    return renderSoloGodAuraHtml(t);
  }
  const name = String(key).toUpperCase();
  const cls = variantCls || ('title-' + name.toLowerCase().replace(/\s+/g, '_'));
  return '<div class="card-floating-title ' + cls + '"><span class="cft-pill"><span class="cft-text">' + name + '</span></span></div>';
}
window.renderTitleCrownHtml = renderTitleCrownHtml;
