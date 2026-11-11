/* ==========================================================================
   js/rebirth-hazard.js — REBIRTH SYSTEM & 5s UNSKIPPABLE SHOWCASE (WoB HAZARD)
   Port of _tmp/proto_rebirth_v1.html.

   Mechanics:
     - Luck Multiplier(count) = count <= 0 ? 1 : count * 5
       (R0: x1, R1: x5, R2: x10, R3: x15, R4: x20...)
     - Threshold(count) = REBIRTH_BASE * 2^count (1,000,000 * 2^count)
     - 8-tier evolving SVG Rebirth Crest (R0 Spark Core -> R7+ Eternal Monarch)
     - Exact 5.00s (5000ms) strictly unskippable showcase driven by performance.now()
     - Single 1x DPR additive FX canvas (#rbShowCv) + compositor CSS transforms
   ========================================================================== */
(function () {
  "use strict";

  const SHOWCASE_MS = 5000;

  const ST = {
    showcaseActive: false,
    showcaseLocked: false,
    showcaseRunId: 0,
    closing: false,
    curtainTimers: []
  };

  let _crestUid = 0;
  const REBIRTH_TIERS = [
    { name: "SPARK CORE",       c1: "#94a3b8", c2: "#c084fc", c3: "#e2e8f0", badge: "UNAWAKENED" },
    { name: "HAZARD IGNITION",  c1: "#f3e600", c2: "#ffffff", c3: "#ffb020", badge: "AWAKENED" },
    { name: "QUANTUM PRISM",    c1: "#22d3ee", c2: "#f3e600", c3: "#ffffff", badge: "RESONANT" },
    { name: "ASTRAL PHOENIX",   c1: "#c084fc", c2: "#ffd700", c3: "#f5d0fe", badge: "ASCENDANT" },
    { name: "SOLAR SOVEREIGN",  c1: "#ffd700", c2: "#ff5e3a", c3: "#fff3b0", badge: "SUPREME" },
    { name: "CRIMSON OVERLORD", c1: "#ff2a55", c2: "#f3e600", c3: "#ff99ac", badge: "TRANSCENDENT" },
    { name: "CELESTIAL SERAPH", c1: "#7df9ff", c2: "#c084fc", c3: "#ffd700", badge: "MYTHIC" },
    { name: "ETERNAL MONARCH",  c1: "#ffffff", c2: "#ffd700", c3: "#ff0055", badge: "OMNIVERSAL" }
  ];

  function tierOf(rank) {
    const idx = Math.min(REBIRTH_TIERS.length - 1, Math.max(0, Number(rank) || 0));
    return REBIRTH_TIERS[idx];
  }

  function rebirthCrestSvg(rank) {
    const r = Math.max(0, Number(rank) || 0);
    const t = tierOf(r);
    const gid = "rbCg" + (++_crestUid);
    const defs = `<defs>
      <linearGradient id="${gid}a" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${t.c2}"/>
        <stop offset="52%" stop-color="${t.c1}"/>
        <stop offset="100%" stop-color="${t.c3}"/>
      </linearGradient>
      <radialGradient id="${gid}r" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity=".95"/>
        <stop offset="42%" stop-color="${t.c1}" stop-opacity=".55"/>
        <stop offset="100%" stop-color="${t.c1}" stop-opacity="0"/>
      </radialGradient>
    </defs>`;
    let body = "";
    if (r === 0) {
      body = `
        <circle cx="60" cy="60" r="42" fill="none" stroke="${t.c1}" stroke-width="2" stroke-dasharray="12 8" opacity=".55"/>
        <polygon points="60,24 88,60 60,96 32,60" fill="none" stroke="${t.c2}" stroke-width="2.5"/>
        <polygon points="60,38 74,60 60,82 46,60" fill="url(#${gid}a)" opacity=".88"/>
        <circle cx="60" cy="60" r="6" fill="#fff"/>`;
    } else if (r === 1) {
      body = `
        <circle cx="60" cy="60" r="46" fill="none" stroke="${t.c1}" stroke-width="2.2" stroke-dasharray="20 8"/>
        <polygon points="60,8 67,28 53,28" fill="${t.c1}"/>
        <polygon points="60,112 67,92 53,92" fill="${t.c1}"/>
        <polygon points="8,60 28,53 28,67" fill="${t.c1}"/>
        <polygon points="112,60 92,53 92,67" fill="${t.c1}"/>
        <polygon points="60,24 94,60 60,96 26,60" fill="#09090d" stroke="url(#${gid}a)" stroke-width="3.2"/>
        <polygon points="60,38 78,60 60,82 42,60" fill="url(#${gid}a)"/>
        <circle cx="60" cy="60" r="7" fill="#050505" stroke="#fff" stroke-width="2"/>`;
    } else if (r === 2) {
      body = `
        <polygon points="60,10 100,32 100,88 60,110 20,88 20,32" fill="none" stroke="${t.c1}" stroke-width="1.8" opacity=".6"/>
        <path d="M12 44 L36 52 L28 68 Z M108 44 L84 52 L92 68 Z" fill="${t.c2}"/>
        <rect x="33" y="33" width="54" height="54" fill="none" stroke="${t.c1}" stroke-width="2.6"/>
        <rect x="33" y="33" width="54" height="54" transform="rotate(45 60 60)" fill="#07080d" stroke="${t.c2}" stroke-width="2.6"/>
        <polygon points="60,31 82,60 60,89 38,60" fill="url(#${gid}a)"/>
        <polygon points="60,46 70,60 60,74 50,60" fill="#fff"/>`;
    } else if (r === 3) {
      body = `
        <circle cx="60" cy="60" r="46" fill="url(#${gid}r)" opacity=".45"/>
        <path d="M52 56 L14 26 L26 52 L8 50 L30 68 L16 74 L46 78 Z" fill="url(#${gid}a)" opacity=".92"/>
        <path d="M68 56 L106 26 L94 52 L112 50 L90 68 L104 74 L74 78 Z" fill="url(#${gid}a)" opacity=".92"/>
        <polygon points="60,10 74,48 60,108 46,48" fill="#0a0714" stroke="${t.c2}" stroke-width="2.6"/>
        <polygon points="60,22 69,50 60,92 51,50" fill="url(#${gid}a)"/>
        <circle cx="24" cy="24" r="3.5" fill="${t.c2}"/><circle cx="96" cy="24" r="3.5" fill="${t.c2}"/>
        <circle cx="60" cy="54" r="7" fill="#fff"/>`;
    } else if (r === 4) {
      body = `
        <circle cx="60" cy="60" r="48" fill="url(#${gid}r)" opacity=".55"/>
        <line x1="18" y1="18" x2="102" y2="102" stroke="${t.c2}" stroke-width="4" stroke-linecap="round"/>
        <line x1="102" y1="18" x2="18" y2="102" stroke="${t.c2}" stroke-width="4" stroke-linecap="round"/>
        <polygon points="60,6 70,40 108,32 80,60 108,88 70,80 60,114 50,80 12,88 40,60 12,32 50,40" fill="url(#${gid}a)" stroke="#050505" stroke-width="1.5"/>
        <polygon points="60,28 84,60 60,92 36,60" fill="#0b0805" stroke="${t.c1}" stroke-width="2.6"/>
        <circle cx="60" cy="60" r="11" fill="${t.c1}" stroke="#fff" stroke-width="2"/>`;
    } else if (r === 5) {
      body = `
        <circle cx="60" cy="60" r="50" fill="url(#${gid}r)" opacity=".6"/>
        <path d="M40 38 C24 18, 12 22, 18 46 C26 36, 36 42, 44 52 Z" fill="${t.c1}"/>
        <path d="M80 38 C96 18, 108 22, 102 46 C94 36, 84 42, 76 52 Z" fill="${t.c1}"/>
        <polygon points="60,10 66,24 54,24" fill="${t.c2}"/>
        <polygon points="10,68 24,62 20,76" fill="${t.c2}"/><polygon points="110,68 96,62 100,76" fill="${t.c2}"/>
        <polygon points="34,98 44,86 48,100" fill="${t.c1}"/><polygon points="86,98 76,86 72,100" fill="${t.c1}"/>
        <polygon points="60,24 90,54 76,98 44,98 30,54" fill="#0d0407" stroke="url(#${gid}a)" stroke-width="3"/>
        <polygon points="60,38 76,60 60,84 44,60" fill="url(#${gid}a)"/>
        <polygon points="60,48 67,60 60,72 53,60" fill="#fff"/>`;
    } else if (r === 6) {
      body = `
        <circle cx="60" cy="60" r="52" fill="url(#${gid}r)" opacity=".65"/>
        <circle cx="60" cy="60" r="47" fill="none" stroke="${t.c1}" stroke-width="1.6" stroke-dasharray="10 5"/>
        <path d="M48 44 L8 14 L22 44 Z M46 60 L4 54 L22 72 Z M48 76 L14 102 L34 86 Z" fill="${t.c1}" opacity=".9"/>
        <path d="M72 44 L112 14 L98 44 Z M74 60 L116 54 L98 72 Z M72 76 L106 102 L86 86 Z" fill="${t.c2}" opacity=".9"/>
        <polygon points="60,14 96,60 60,106 24,60" fill="#070912" stroke="url(#${gid}a)" stroke-width="2.8"/>
        <polygon points="60,28 80,60 60,92 40,60" fill="url(#${gid}a)"/>
        <circle cx="60" cy="60" r="9" fill="#fff" stroke="${t.c3}" stroke-width="2.5"/>`;
    } else {
      const extraStars = r >= 8
        ? `<circle cx="20" cy="20" r="3" fill="#fff"/><circle cx="100" cy="20" r="3" fill="#fff"/><circle cx="20" cy="100" r="3" fill="#fff"/><circle cx="100" cy="100" r="3" fill="#fff"/>`
        : "";
      body = `
        <circle cx="60" cy="60" r="54" fill="url(#${gid}r)" opacity=".75"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="${t.c2}" stroke-width="2" stroke-dasharray="14 6"/>
        <path d="M36 28 L44 10 L54 24 L60 6 L66 24 L76 10 L84 28 Z" fill="${t.c2}" stroke="#050505" stroke-width="1.2"/>
        <path d="M46 54 L6 30 L18 58 L8 72 L42 78 Z" fill="url(#${gid}a)"/>
        <path d="M74 54 L114 30 L102 58 L112 72 L78 78 Z" fill="url(#${gid}a)"/>
        <polygon points="60,24 92,48 80,96 40,96 28,48" fill="#09070e" stroke="${t.c1}" stroke-width="2.8"/>
        <polygon points="60,32 82,60 60,92 38,60" fill="url(#${gid}a)"/>
        <polygon points="60,46 70,60 60,74 50,60" fill="${t.c3}" stroke="#fff" stroke-width="1.8"/>
        ${extraStars}`;
    }
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}${body}</svg>`;
  }

  function el(id) { return document.getElementById(id); }
  function fmtN(n) { return (typeof fmt === "function") ? fmt(n) : Math.round(Number(n) || 0).toLocaleString("en-US"); }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(Math.floor(n));
  }
  function getCount() { return (typeof rebirthCount === "function") ? rebirthCount() : 0; }
  function getEssence() { return (typeof rebirthEssence === "function") ? rebirthEssence() : 0; }
  function getThreshold(c) {
    const base = (typeof REBIRTH_BASE === "number") ? REBIRTH_BASE : 1000000;
    return Math.round(base * Math.pow(2, Math.max(0, c)));
  }
  function getMult(c) {
    if (typeof rebirthLuckMult === "function") return rebirthLuckMult(c);
    return c <= 0 ? 1 : c * 5;
  }

  /* ============================== PROCEDURAL AUDIO ========================= */
  const RebirthSfx = (() => {
    let ac = null;
    function muted() { return !!(typeof state !== "undefined" && state && state.muted); }
    function ctx() {
      if (muted()) return null;
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) { try { ac = new AC(); } catch (e) {} }
      }
      if (ac && ac.state === "suspended") ac.resume().catch(() => {});
      return ac;
    }
    function tone(o) {
      const c = ctx(); if (!c) return;
      const dur = o.dur || 0.14, delay = o.delay || 0, t0 = c.currentTime + delay;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || "sine";
      const f1 = Math.max(20, o.f1 || 440), f2 = Math.max(20, o.f2 || f1);
      osc.frequency.setValueAtTime(f1, t0);
      if (f2 !== f1) osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(o.gain || 0.1, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    }
    function noise(o) {
      const c = ctx(); if (!c) return;
      const dur = o.dur || 0.16, delay = o.delay || 0, t0 = c.currentTime + delay;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.3);
      const src = c.createBufferSource(); src.buffer = buf;
      const flt = c.createBiquadFilter();
      flt.type = o.filter || "bandpass";
      flt.frequency.setValueAtTime(o.f1 || 1600, t0);
      if (o.f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, o.f2), t0 + dur);
      flt.Q.value = o.q || 1.4;
      const g = c.createGain();
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(o.gain || 0.12, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(c.destination);
      src.start(t0); src.stop(t0 + dur + 0.03);
    }
    return {
      unlock() { ctx(); },
      click() {
        if (typeof window.playSound === "function") window.playSound("click");
        else tone({ type: "triangle", f1: 680, f2: 420, dur: 0.06, gain: 0.06 });
      },
      lock() { tone({ type: "square", f1: 190, f2: 140, dur: 0.08, gain: 0.05 }); },
      play5s() {
        // Act I (0.0s -> 1.0s): deep compression charge
        tone({ type: "sine", f1: 55, f2: 210, dur: 0.95, gain: 0.18 });
        tone({ type: "sawtooth", f1: 110, f2: 440, dur: 0.95, gain: 0.07 });
        // Act II (1.0s -> 2.15s): dimensional rift slash + riser
        noise({ filter: "bandpass", f1: 3800, f2: 620, dur: 0.24, gain: 0.17, delay: 1.0 });
        tone({ type: "sawtooth", f1: 1400, f2: 220, dur: 0.18, gain: 0.10, delay: 1.0 });
        tone({ type: "triangle", f1: 240, f2: 880, dur: 1.05, gain: 0.08, delay: 1.10 });
        // Act III (2.15s): Ascension Supernova boom + grand chord
        tone({ type: "sine", f1: 145, f2: 32, dur: 0.75, gain: 0.24, delay: 2.15 });
        noise({ filter: "lowpass", f1: 1800, f2: 160, dur: 0.55, gain: 0.20, delay: 2.15 });
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          tone({ type: "triangle", f1: f, f2: f * 1.005, dur: 0.65, gain: 0.09, delay: 2.18 + idx * 0.05 });
        });
        // Act IV (3.3s -> 4.2s): Telemetry lock ticks
        [3.35, 3.60, 3.85].forEach((d, i) => {
          tone({ type: "sine", f1: 880 + i * 140, f2: 1020 + i * 140, dur: 0.09, gain: 0.06, delay: d });
        });
        // Act V (5.0s): Protocol unlocked chime
        tone({ type: "sine", f1: 784, f2: 1568, dur: 0.22, gain: 0.09, delay: 4.98 });
      }
    };
  })();

  /* ==================== 1x DPR ADDITIVE CANVAS FX ENGINE =================== */
  const ShowFx = (() => {
    let cv = null, ctx = null;
    const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 800, H = 600, running = false, rafId = 0;
    let t0 = 0, last = 0, elapsed = 0, time = 0;
    let palC1 = "#f3e600", palC2 = "#c084fc";
    let streaks = [], streams = [], rings = [], bokeh = [], glints = [], ribbons = [];
    let burstFired = false, rift1Fired = false, rift2Fired = false;
    const cache = {};

    function ensureCanvas() {
      if (!cv) {
        cv = el("rbShowCv");
        if (cv) ctx = cv.getContext("2d");
      }
      return !!(cv && ctx);
    }

    function hexA(hex, a) {
      let h = String(hex).replace("#", "");
      if (h.length === 3) h = h.split("").map(x => x + x).join("");
      const n = parseInt(h, 16);
      if (isNaN(n)) return `rgba(243,230,0,${a})`;
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    function sprite(key, size, paint) {
      if (cache[key]) return cache[key];
      const c = document.createElement("canvas"); c.width = c.height = size;
      paint(c.getContext("2d"), size); cache[key] = c; return c;
    }
    function glowTex(col) {
      return sprite("g" + col, 96, (g, s) => {
        const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        r.addColorStop(0, "rgba(255,255,255,.95)");
        r.addColorStop(.25, hexA(col, .58));
        r.addColorStop(.62, hexA(col, .18));
        r.addColorStop(1, hexA(col, 0));
        g.fillStyle = r; g.fillRect(0, 0, s, s);
      });
    }
    function streakTex(col) {
      return sprite("s" + col, 128, (g, s) => {
        g.translate(s / 2, s / 2); g.scale(1, .2);
        const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
        r.addColorStop(0, "rgba(255,255,255,.95)");
        r.addColorStop(.38, hexA(col, .58));
        r.addColorStop(1, hexA(col, 0));
        g.fillStyle = r; g.beginPath(); g.arc(0, 0, s / 2, 0, 7); g.fill();
      });
    }
    function glintTex() {
      return sprite("gl", 128, (g, s) => {
        g.translate(s / 2, s / 2);
        for (const rot of [0, Math.PI / 2]) {
          g.save(); g.rotate(rot); g.scale(1, .13);
          const r = g.createRadialGradient(0, 0, 0, 0, 0, s / 2);
          r.addColorStop(0, "rgba(255,255,255,1)");
          r.addColorStop(.4, "rgba(255,255,255,.55)");
          r.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = r; g.beginPath(); g.arc(0, 0, s / 2, 0, 7); g.fill();
          g.restore();
        }
        const c = g.createRadialGradient(0, 0, 0, 0, 0, s * .18);
        c.addColorStop(0, "rgba(255,255,255,1)");
        c.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = c; g.beginPath(); g.arc(0, 0, s * .18, 0, 7); g.fill();
      });
    }
    function raysTex(col) {
      return sprite("y" + col, 512, (g, s) => {
        g.translate(s / 2, s / 2);
        for (let i = 0; i < 12; i++) {
          g.save(); g.rotate(i * Math.PI / 6);
          const r = g.createLinearGradient(0, 0, s / 2, 0);
          r.addColorStop(0, hexA(col, .28));
          r.addColorStop(.55, hexA(col, .09));
          r.addColorStop(1, hexA(col, 0));
          g.fillStyle = r;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(s / 2, -s * .046); g.lineTo(s / 2, s * .046); g.closePath(); g.fill();
          g.restore();
        }
      });
    }

    function pathThrough(pts) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const l = pts[pts.length - 1];
      ctx.lineTo(l.x, l.y);
    }
    function drawRibbon(rb, cx, cy) {
      const N = 48;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = rb.ph + t * rb.arc;
        const r = rb.rx * (0.84 + 0.16 * Math.sin(t * 4.5 + time * 0.05));
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * rb.squash });
      }
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      const chunks = [[0, .25, .42], [.25, .55, 1], [.55, .8, .9], [.8, 1, .38]];
      for (const [c0, c1, am] of chunks) {
        const sub = pts.slice(Math.floor(c0 * N), Math.ceil(c1 * N) + 1);
        if (sub.length < 2) continue;
        pathThrough(sub); ctx.strokeStyle = hexA(rb.col, .16 * am * rb.fade); ctx.lineWidth = 12; ctx.stroke();
        pathThrough(sub); ctx.strokeStyle = hexA(rb.col, .28 * am * rb.fade); ctx.lineWidth = 5; ctx.stroke();
        pathThrough(sub); ctx.strokeStyle = `rgba(255,255,255,${(.38 * am * rb.fade).toFixed(3)})`; ctx.lineWidth = 1.6; ctx.stroke();
      }
    }

    function resize() {
      if (!ensureCanvas()) return;
      const sc = el("rebirthShowcase");
      const r = sc ? sc.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
      W = cv.width = Math.max(300, Math.round(r.width));
      H = cv.height = Math.max(300, Math.round(r.height));
    }
    function center() {
      const sc = el("rebirthShowcase");
      const em = el("rbsEmblem");
      if (sc && em) {
        const fr = sc.getBoundingClientRect();
        const er = em.getBoundingClientRect();
        if (er.width > 0) return { x: er.left - fr.left + er.width / 2, y: er.top - fr.top + er.height / 2 };
      }
      return { x: W * 0.5, y: H * 0.42 };
    }
    function spawnGlint(x, y, sz) {
      glints.push({ x, y, sz, rot: Math.random() * 1.57, life: 0, max: 32 + Math.random() * 24 });
    }
    function spawnRiftBurst(cx, cy, col) {
      for (let i = 0; i < (RM ? 4 : 16); i++) {
        const ang = (i / 16) * Math.PI * 2 + (Math.random() - .5) * .2;
        const spd = 3 + Math.random() * 7;
        streaks.push({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, len: 28 + Math.random() * 44, col: i % 2 ? "#ffffff" : col, life: 0, max: 30 + Math.random() * 16 });
      }
      rings.push({ x: cx, y: cy, r: 12, maxR: Math.min(W, H) * 0.55, col, delay: 0, life: 0, max: 34 });
      for (let j = 0; j < (RM ? 0 : 6); j++) spawnGlint(cx + (Math.random() - .5) * 140, cy + (Math.random() - .5) * 140, 22 + Math.random() * 24);
    }
    function spawnBurst(cx, cy) {
      const cols = [palC1, palC2, "#7df9ff", "#ffffff"];
      for (let i = 0; i < (RM ? 8 : 34); i++) {
        const ang = (i / 34) * Math.PI * 2 + (Math.random() - .5) * .2;
        const spd = 4.5 + Math.random() * 11.5;
        streaks.push({
          x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          len: 40 + Math.random() * 72, col: cols[i % cols.length], life: 0, max: 46 + Math.random() * 26
        });
      }
      for (let k = 0; k < 4; k++) {
        rings.push({ x: cx, y: cy, r: 16, maxR: Math.max(W, H) * (0.42 + k * 0.16), col: k === 1 ? palC2 : k === 2 ? "#7df9ff" : palC1, delay: k * 5, life: 0, max: 46 });
      }
      for (let j = 0; j < (RM ? 2 : 12); j++) {
        spawnGlint(cx + (Math.random() - .5) * Math.min(W, 420) * .65, cy + (Math.random() - .5) * Math.min(H, 340) * .55, 22 + Math.random() * 32);
      }
      for (let b = 0; b < (RM ? 0 : 18); b++) {
        bokeh.push({
          x: Math.random() * W, y: H + 20 + Math.random() * 120,
          vx: (Math.random() - .5) * .6, vy: -1.1 - Math.random() * 1.4,
          sz: 12 + Math.random() * 24, col: b % 2 ? palC1 : palC2, a: 0.48 + Math.random() * 0.42,
          life: 0, max: 130 + Math.random() * 90
        });
      }
      if (!RM) {
        const baseR = Math.min(W, H) * 0.31;
        ribbons = [
          { rx: baseR, squash: 0.56, ph: 0, sp: 0.028, arc: 4.8, col: palC1, fade: 1 },
          { rx: baseR * 1.18, squash: 0.48, ph: 2.6, sp: -0.022, arc: 4.1, col: palC2, fade: 1 }
        ];
      }
    }

    function tick(now) {
      if (!running || !ctx) return;
      const dt = Math.min(2.2, (now - last) / 16.667);
      last = now;
      time += dt;
      elapsed = now - t0;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      const c = center();
      const sec = elapsed / 1000;

      if (sec < 2.15 && !RM) {
        for (const st of streams) {
          st.ang += st.w * dt * (1 + sec * 1.35);
          st.dist = Math.max(12, st.dist - st.inward * dt * (1 + sec * 1.6));
          if (st.dist <= 14) st.dist = st.maxD;
          const x = c.x + Math.cos(st.ang) * st.dist;
          const y = c.y + Math.sin(st.ang) * st.dist;
          ctx.save();
          ctx.translate(x, y); ctx.rotate(st.ang);
          ctx.globalAlpha = 0.78;
          ctx.drawImage(streakTex(st.col), -st.len / 2, -st.len * .11, st.len, st.len * .22);
          ctx.restore();
        }
        drawRibbon({ rx: Math.max(48, Math.min(W, H) * (0.34 - sec * 0.09)), squash: 0.62, ph: sec * 4.5, sp: 0.04, arc: 4.6, col: sec < 1.0 ? "#c084fc" : "#f3e600", fade: 0.78 }, c.x, c.y);

        if (sec >= 1.0 && !rift1Fired) { rift1Fired = true; spawnRiftBurst(c.x, c.y, "#c084fc"); }
        if (sec >= 1.28 && !rift2Fired) { rift2Fired = true; spawnRiftBurst(c.x, c.y, "#f3e600"); }

        if (sec >= 1.0) {
          const intensity = Math.min(1, (sec - 1.0) / 0.55);
          ctx.globalAlpha = 0.44 * intensity;
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2 + sec * 2.1;
            const r1 = Math.min(W, H) * (0.22 + ((i * 37) % 10) * 0.018);
            const r2 = Math.max(W, H) * 0.85;
            ctx.strokeStyle = i % 3 === 0 ? "#f3e600" : i % 3 === 1 ? "#c084fc" : "#7df9ff";
            ctx.lineWidth = i % 4 === 0 ? 2.4 : 1.2;
            ctx.beginPath();
            ctx.moveTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
            ctx.lineTo(c.x + Math.cos(a) * r2, c.y + Math.sin(a) * r2);
            ctx.stroke();
          }
        }
      }

      const glowScale = sec < 1.0 ? 130 + sec * 110 : sec < 2.15 ? 240 : 320;
      const glowCol = sec < 2.15 ? palC2 : palC1;
      ctx.globalAlpha = sec < 2.15 ? 0.65 : 0.48;
      ctx.drawImage(glowTex(glowCol), c.x - glowScale / 2, c.y - glowScale / 2, glowScale, glowScale);

      if (sec >= 2.15) {
        if (!burstFired) { burstFired = true; spawnBurst(c.x, c.y); }
        const raySz = Math.max(W, H) * 1.18;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(sec * (RM ? 0 : 0.28));
        ctx.globalAlpha = Math.min(0.68, (sec - 2.15) * 1.6);
        ctx.drawImage(raysTex(palC1), -raySz / 2, -raySz / 2, raySz, raySz);
        ctx.rotate(-sec * (RM ? 0 : 0.45));
        ctx.globalAlpha = Math.min(0.50, (sec - 2.15) * 1.3);
        ctx.drawImage(raysTex(palC2), -raySz * 0.44, -raySz * 0.44, raySz * 0.88, raySz * 0.88);
        ctx.restore();

        for (const rb of ribbons) {
          rb.ph += rb.sp * dt;
          drawRibbon(rb, c.x, c.y);
        }
        if (!RM && Math.random() < 0.08 * dt && glints.length < 14) {
          spawnGlint(c.x + (Math.random() - .5) * Math.min(W, 360) * .65, c.y + (Math.random() - .5) * Math.min(H, 280) * .5, 16 + Math.random() * 22);
        }
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const rg = rings[i];
        if (rg.delay > 0) { rg.delay -= dt; continue; }
        rg.life += dt;
        const p = rg.life / rg.max;
        if (p >= 1) { rings.splice(i, 1); continue; }
        const rad = rg.r + (rg.maxR - rg.r) * (1 - Math.pow(1 - p, 3));
        ctx.globalAlpha = (1 - p) * 0.9;
        ctx.strokeStyle = rg.col;
        ctx.lineWidth = Math.max(1.5, (1 - p) * 8);
        ctx.beginPath(); ctx.arc(rg.x, rg.y, rad, 0, Math.PI * 2); ctx.stroke();
      }

      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.life += dt;
        const p = s.life / s.max;
        if (p >= 1) { streaks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vx *= Math.pow(0.95, dt); s.vy *= Math.pow(0.95, dt);
        ctx.save();
        ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.globalAlpha = (1 - p) * 0.95;
        ctx.drawImage(streakTex(s.col), -s.len / 2, -s.len * .13, s.len, s.len * .26);
        ctx.restore();
      }

      for (let i = glints.length - 1; i >= 0; i--) {
        const gl = glints[i];
        gl.life += dt;
        const p = gl.life / gl.max;
        if (p >= 1) { glints.splice(i, 1); continue; }
        const sc = gl.sz * (1 - Math.pow(2, -10 * Math.min(1, p * 2.2)));
        const a = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
        ctx.save(); ctx.translate(gl.x, gl.y); ctx.rotate(gl.rot);
        ctx.globalAlpha = Math.max(0, a);
        ctx.drawImage(glintTex(), -sc / 2, -sc / 2, sc, sc);
        ctx.restore();
      }

      for (let i = bokeh.length - 1; i >= 0; i--) {
        const b = bokeh[i];
        b.life += dt;
        const p = b.life / b.max;
        if (p >= 1) {
          if (sec > 2.2) { b.life = 0; b.y = H + 20; b.x = Math.random() * W; }
          else { bokeh.splice(i, 1); continue; }
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        ctx.globalAlpha = Math.sin(Math.PI * p) * b.a;
        ctx.drawImage(glowTex(b.col), b.x - b.sz / 2, b.y - b.sz / 2, b.sz, b.sz);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      rafId = requestAnimationFrame(tick);
    }

    return {
      start(c1, c2) {
        this.stop();
        if (!ensureCanvas()) return;
        resize();
        palC1 = c1 || "#f3e600";
        palC2 = c2 || "#c084fc";
        t0 = performance.now(); last = t0; elapsed = 0; time = 0;
        burstFired = false; rift1Fired = false; rift2Fired = false;
        streaks = []; rings = []; bokeh = []; glints = []; ribbons = [];
        const maxD = Math.max(W, H) * 0.65;
        streams = Array.from({ length: RM ? 0 : 22 }, (_, i) => ({
          ang: (i / 22) * Math.PI * 2,
          dist: 40 + (i % 5) * (maxD / 5),
          maxD,
          inward: 3.0 + (i % 3) * 1.2,
          w: (i % 2 ? 1 : -1) * 0.028,
          len: 36 + (i % 4) * 14,
          col: i % 3 === 0 ? palC1 : i % 3 === 1 ? palC2 : "#7df9ff"
        }));
        running = true;
        rafId = requestAnimationFrame(tick);
      },
      resize() { if (running) resize(); },
      stop() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        if (ctx) ctx.clearRect(0, 0, W, H);
      }
    };
  })();

  /* ============================== RENDER MODAL ============================ */
  function renderGuideTable() {
    const tbl = el("rbhGuideTable"); if (!tbl) return;
    const cnt = getCount();
    tbl.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7].map(c => {
      const r = c + 1;
      const t = tierOf(r);
      const isCur = c === cnt;
      return `<div class="rbh-gt-cell ${isCur ? "cur" : ""}" style="border-top:2px solid ${t.c1}">
        <div class="rbh-gt-ic">${rebirthCrestSvg(r)}</div>
        <k>RANK R${c}→R${r}</k>
        <b>${compact(getThreshold(c))}</b>
        <em>${t.name}</em>
        <span>×${getMult(r)} LUCK</span>
      </div>`;
    }).join("");
  }

  function renderRebirthModal() {
    const grid = el("rbhGrid");
    if (!grid) return;
    const cnt = getCount();
    const es = getEssence();
    const th = getThreshold(cnt);
    const mult = getMult(cnt);
    const nextMult = getMult(cnt + 1);
    const gainMult = nextMult - mult;
    const curTier = tierOf(cnt);
    const nxtTier = tierOf(cnt + 1);
    const ready = es >= th;
    const ratio = Math.max(0, Math.min(1, th > 0 ? (es / th) : 1));
    const pct = Math.min(100, Math.round(ratio * 100));
    const need = Math.max(0, th - es);
    const surplus = Math.max(0, es - th);
    const lv = (typeof state !== "undefined" && state && state.playerLv) ? state.playerLv : 1;

    const tagCycle = el("rbhTagCycle"); if (tagCycle) tagCycle.textContent = "CYCLE R" + cnt;
    const tagMult = el("rbhTagMult"); if (tagMult) tagMult.textContent = "×" + mult + " LUCK";
    const pRank = el("rbhPillRank"); if (pRank) pRank.classList.toggle("ready", ready);
    const pRankVal = el("rbhPillRankVal"); if (pRankVal) pRankVal.textContent = "R" + cnt + " · " + curTier.badge;
    const pLuckVal = el("rbhPillLuckVal"); if (pLuckVal) pLuckVal.textContent = "×" + mult;
    const pPool = el("rbhPillPool"); if (pPool) pPool.classList.toggle("ready", ready);
    const pPoolVal = el("rbhPillPoolVal"); if (pPoolVal) pPoolVal.textContent = compact(es) + " / " + compact(th) + " (" + pct + "%)";

    const ladder = [0, 1, 2].map(off => {
      const r = cnt + off;
      const t = tierOf(r);
      const cls = off === 0 ? "cur" : (off === 1 ? "nxt" : "");
      return `<div class="rbh-lad-node ${cls}" style="--nxt-c:${t.c1}">
        <k>${off === 0 ? "ACTIVE" : off === 1 ? "TARGET" : "NEXT"}</k>
        <div class="rbh-lad-ic">${rebirthCrestSvg(r)}</div>
        <b>R${r}</b>
        <span>×${getMult(r)}</span>
      </div>`;
    }).join("");

    grid.innerHTML = `
      <div class="rbh-box core ${ready ? "is-ready" : ""}" style="--tier-c:${curTier.c1}">
        <span class="rbh-crn tl"></span><span class="rbh-crn br"></span>
        <div class="rbh-sec-k"><span><i></i>CORE REACTOR</span><b>${ready ? "CRITICAL" : curTier.badge}</b></div>

        <div class="rbh-sigil">
          <div class="rbh-sigil-rings">
            <div class="rbh-sigil-aura"></div>
            <svg class="rbh-rings-svg" viewBox="0 0 160 160" aria-hidden="true">
              <circle class="rbh-rg r1" cx="80" cy="80" r="76" fill="none" stroke-width="1.6" stroke-dasharray="6 5"/>
              <circle class="rbh-rg r2" cx="80" cy="80" r="64" fill="none" stroke-width="1.2" stroke-dasharray="2 5"/>
              <polygon class="rbh-rg r3" points="80,26 127,53 127,107 80,134 33,107 33,53" fill="none" stroke-width="1.5"/>
            </svg>
          </div>
          <div class="rbh-sigil-core">
            <div class="rbh-sigil-core-in">${rebirthCrestSvg(cnt)}</div>
          </div>
          <div class="rbh-rank-plate"><k>RANK</k><b>R${cnt}</b></div>
        </div>

        <div class="rbh-core-meta">
          <div class="rbh-core-title">${curTier.name}</div>
          <div class="rbh-core-sub">CYCLE R${cnt} · LEVEL ${lv}</div>
        </div>

        <div class="rbh-ladder">${ladder}</div>
      </div>

      <div class="rbh-box info">
        <span class="rbh-crn tl"></span><span class="rbh-crn br"></span>
        <div class="rbh-sec-k"><span><i></i>MULTIPLIER &amp; CREST EVOLUTION</span><b>×5 PER REBIRTH</b></div>

        <div class="rbh-compare">
          <div class="rbh-cmp">
            <k>CURRENT · R${cnt}</k>
            <div class="rbh-cmp-row">
              <span class="rbh-cmp-ic">${rebirthCrestSvg(cnt)}</span>
              <b>×${mult}</b>
            </div>
            <span>${curTier.name}</span>
          </div>
          <div class="rbh-cmp-mid">
            <div class="rbh-cmp-arr">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
            </div>
            <span class="rbh-cmp-delta">+${gainMult}× GAIN</span>
          </div>
          <div class="rbh-cmp next" style="--nxt-c:${nxtTier.c1}">
            <k>NEXT · R${cnt + 1}</k>
            <div class="rbh-cmp-row">
              <span class="rbh-cmp-ic">${rebirthCrestSvg(cnt + 1)}</span>
              <b>×${nextMult}</b>
            </div>
            <span>${nxtTier.name}</span>
          </div>
        </div>

        <div class="rbh-meter-card">
          <div class="rbh-mc-head">
            <span class="rbh-mc-lbl"><i></i>ESSENCE POOL CHARGE</span>
            <span class="rbh-mc-nums"><b>${fmtN(es)}</b> / ${fmtN(th)}</span>
          </div>
          <div class="rbh-track" role="progressbar" aria-valuemin="0" aria-valuemax="${th}" aria-valuenow="${es}" aria-label="Rebirth Essence Charge">
            <div class="rbh-track-fill ${ready ? "ready" : ""}" style="transform:scaleX(${ratio.toFixed(4)})"></div>
            <div class="rbh-track-ticks"></div>
          </div>
          <div class="rbh-mc-foot">
            <span class="rbh-mc-pct ${ready ? "ready" : ""}">${pct}% CHARGED</span>
            <span class="rbh-mc-need ${ready ? "ready" : ""}">${
              ready
                ? (surplus > 0 ? ("✓ READY · +" + fmtN(surplus) + " SURPLUS CARRIES OVER") : "✓ THRESHOLD MET · READY TO ASCEND")
                : ("NEED " + fmtN(need) + " MORE ESSENCE")
            }</span>
          </div>
        </div>

        <div class="rbh-conv">
          <div class="rbh-conv-top"><b>DUPLICATE TRANSMUTATION</b><span>AUTO-CONVERT ON PULL</span></div>
          <div class="rbh-conv-desc">Every duplicate card from <b>Summon Rolls</b> or <b>Instant Packs</b> fuels your Essence Pool without erasing Cards or Decks.</div>
          <div class="rbh-conv-chips">
            <span class="rbh-cchip">TIER <b>20–600</b></span>
            <span class="rbh-cchip g">GOLD <b>×2</b></span>
            <span class="rbh-cchip r">RAINBOW <b>×3</b></span>
            <span class="rbh-cchip s">SECRET <b>×5</b></span>
            <span class="rbh-cchip u">ULTIMA <b>×8</b></span>
            <span class="rbh-cchip sh">SHINY <b>×2</b></span>
          </div>
        </div>
      </div>

      <div class="rbh-box act">
        <span class="rbh-crn tl"></span><span class="rbh-crn br"></span>
        <div class="rbh-act-head">
          <div class="rbh-status-pill ${ready ? "ready" : "charging"}">
            <i></i><span>${ready ? "READY FOR OVERRIDE" : "CHARGING ESSENCE"}</span>
          </div>
          <div class="rbh-act-title">ASCENSION PROTOCOL</div>
        </div>

        <div class="rbh-perks">
          <div class="rbh-perk">
            <span class="rbh-perk-ic">✓</span>
            <span><b>Permanent Power:</b> Luck Multiplier climbs from <b>×${mult}</b> to <em>×${nextMult}</em> (+5× per Rebirth cycle).</span>
          </div>
          <div class="rbh-perk">
            <span class="rbh-perk-ic">✓</span>
            <span><b>Zero Progress Loss:</b> All Cards, Decks, Levels, Skill Tree, Relics &amp; Pets stay 100% intact.</span>
          </div>
          <div class="rbh-perk">
            <span class="rbh-perk-ic">✓</span>
            <span><b>Surplus Carryover:</b> ${
              ready && surplus > 0
                ? `<em>+${fmtN(surplus)} Essence</em> transfers directly into Cycle R${cnt + 1}.`
                : `Excess Essence above ${compact(th)} automatically rolls into R${cnt + 1}.`
            }</span>
          </div>
        </div>

        <div class="rbh-ignite-wrap">
          <button type="button" class="rbh-ignite-btn" id="rbhIgniteBtn" ${ready ? "" : "disabled"}>
            <span class="rbh-ig-top">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              <span>${ready ? "ACTIVATE REBIRTH" : "INSUFFICIENT ESSENCE"}</span>
            </span>
            <span class="rbh-ig-sub">${ready ? `ASCEND TO R${cnt + 1} · ×${nextMult} LUCK` : `${pct}% CHARGED · NEED ${compact(need)}`}</span>
          </button>
          <div class="rbh-ignite-note">${ready ? "TRIGGERS <b>5.0s UNSKIPPABLE</b> ASCENSION SHOWCASE" : "KEEP SUMMONING DUPLICATES TO FILL CORE"}</div>
        </div>
      </div>
    `;

    const ignite = el("rbhIgniteBtn");
    if (ignite) ignite.onclick = executeRebirthFromModal;

    const g = el("rbhGuide");
    if (g && g.classList.contains("open")) renderGuideTable();
  }

  /* ==================== 5.0-SECOND UNSKIPPABLE SHOWCASE ==================== */
  let showRaf = 0;
  let lockBumpTimer = null;

  function setShowcasePhase(cls) {
    const sc = el("rebirthShowcase");
    if (!sc) return;
    sc.classList.remove("phase-charge", "phase-rupture", "phase-burst", "phase-recal", "phase-done");
    if (cls) sc.classList.add(cls);
  }

  function pulseShowcaseLock() {
    RebirthSfx.lock();
    const b = el("rbsLockBadge");
    if (b) {
      b.classList.remove("bump");
      void b.offsetWidth;
      b.classList.add("bump");
      clearTimeout(lockBumpTimer);
      lockBumpTimer = setTimeout(() => b.classList.remove("bump"), 350);
    }
    const n = el("rbsLockNotice");
    if (n) {
      const span = n.querySelector("span");
      if (span) span.textContent = "LOCK ACTIVE — WATCH SEQUENCE TO COMPLETE";
    }
  }

  function startShowcase5s(data) {
    const sc = el("rebirthShowcase");
    if (!sc) return;
    const runId = ++ST.showcaseRunId;
    ST.showcaseActive = true;
    ST.showcaseLocked = true;
    document.body.classList.add("rb-showcase-active");

    const oldTier = tierOf(data.oldCnt);
    const newTier = tierOf(data.newCnt);
    const oldHtml = `<div class="rbs-half-ic">${rebirthCrestSvg(data.oldCnt)}</div><div class="rbs-half-num">R${data.oldCnt}</div>`;

    sc.style.setProperty("--old-c", oldTier.c1);
    sc.style.setProperty("--new-c", newTier.c1);
    const rbsOldL = el("rbsOldL"); if (rbsOldL) rbsOldL.innerHTML = oldHtml;
    const rbsOldR = el("rbsOldR"); if (rbsOldR) rbsOldR.innerHTML = oldHtml;
    const rbsNewCrest = el("rbsNewCrest"); if (rbsNewCrest) rbsNewCrest.innerHTML = rebirthCrestSvg(data.newCnt);
    const rbsNewNum = el("rbsNewNum"); if (rbsNewNum) rbsNewNum.textContent = "R" + data.newCnt;
    const rbsNewLbl = el("rbsNewLbl"); if (rbsNewLbl) rbsNewLbl.textContent = newTier.name + " UNLOCKED";
    const rbsSubCopy = el("rbsSubCopy"); if (rbsSubCopy) rbsSubCopy.textContent = "CYCLE R" + data.newCnt + " // " + newTier.name + " FORM AWAKENED";
    const rbsOldMult = el("rbsOldMult"); if (rbsOldMult) rbsOldMult.textContent = "×" + data.oldMult;
    const rbsNewMult = el("rbsNewMult"); if (rbsNewMult) rbsNewMult.textContent = "×" + data.newMult;
    const rbsBoostTag = el("rbsBoostTag"); if (rbsBoostTag) rbsBoostTag.textContent = "+" + (data.newMult - data.oldMult) + "× LUCK GAIN";
    const rbsNextTh = el("rbsNextTh"); if (rbsNextTh) rbsNextTh.textContent = fmtN(data.nextTh);
    const rbsSurplus = el("rbsSurplus"); if (rbsSurplus) rbsSurplus.textContent = fmtN(data.surplus);
    const rbsChargeTitle = el("rbsChargeTitle"); if (rbsChargeTitle) rbsChargeTitle.textContent = "COMPRESSING ESSENCE CORE...";
    const rbsChargeSub = el("rbsChargeSub"); if (rbsChargeSub) rbsChargeSub.textContent = "CORE DENSITY: 100% // LIMITER BREACH IMMINENT";
    const rbsPhaseLbl = el("rbsPhaseLbl"); if (rbsPhaseLbl) rbsPhaseLbl.textContent = "PHASE 01 // ESSENCE SINGULARITY";
    const rbsLockTxt = el("rbsLockTxt"); if (rbsLockTxt) rbsLockTxt.textContent = "LOCKED · UNSKIPPABLE";
    const rbsLockIcon = el("rbsLockIcon"); if (rbsLockIcon) rbsLockIcon.innerHTML = '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>';
    const rbsNotice = el("rbsLockNotice");
    if (rbsNotice) {
      const sp = rbsNotice.querySelector("span");
      if (sp) sp.textContent = "MANDATORY ASCENSION VIEWING · CANNOT SKIP";
    }
    const rbsFill = el("rbsProgFill"); if (rbsFill) rbsFill.style.transform = "scaleX(0)";

    sc.classList.remove("is-unlocked", "vis");
    setShowcasePhase("phase-charge");
    sc.classList.add("on");
    void sc.offsetWidth;
    sc.classList.add("vis");

    ShowFx.start(newTier.c1, newTier.c2);
    RebirthSfx.play5s();

    const startMs = performance.now();
    let curPhase = 1;

    function step(now) {
      if (!ST.showcaseActive || ST.showcaseRunId !== runId) return;
      const elapsed = Math.min(SHOWCASE_MS, now - startMs);
      const pct = elapsed / SHOWCASE_MS;
      const remSec = Math.max(0, (SHOWCASE_MS - elapsed) / 1000).toFixed(1).padStart(4, "0") + "s";

      const pf = el("rbsProgFill"); if (pf) pf.style.transform = "scaleX(" + pct.toFixed(4) + ")";
      const cd = el("rbsCountdown"); if (cd) cd.textContent = remSec;
      const ft = el("rbsFootTimer"); if (ft) ft.textContent = remSec;

      if (curPhase === 1) {
        const dens = Math.min(999, Math.round(100 + (elapsed / 1000) * 899));
        const sub = el("rbsChargeSub");
        if (sub) sub.textContent = "CORE DENSITY: " + dens + "% // LIMITER BREACH IMMINENT";
      }
      if (elapsed >= 1000 && curPhase === 1) {
        curPhase = 2;
        setShowcasePhase("phase-rupture");
        const ph = el("rbsPhaseLbl"); if (ph) ph.textContent = "PHASE 02 // DIMENSIONAL RUPTURE";
        const ct = el("rbsChargeTitle"); if (ct) ct.textContent = "SHATTERING CYCLE LIMITER...";
        const cs = el("rbsChargeSub"); if (cs) cs.textContent = "RANK R" + data.oldCnt + " CONTAINMENT FRACTURED";
      } else if (elapsed >= 2150 && curPhase === 2) {
        curPhase = 3;
        setShowcasePhase("phase-burst");
        const ph = el("rbsPhaseLbl"); if (ph) ph.textContent = "PHASE 03 // ASCENSION SUPERNOVA";
      } else if (elapsed >= 3300 && curPhase === 3) {
        curPhase = 4;
        setShowcasePhase("phase-recal");
        const ph = el("rbsPhaseLbl"); if (ph) ph.textContent = "PHASE 04 // LUCK RECALIBRATION";
      }

      if (elapsed < SHOWCASE_MS) {
        showRaf = requestAnimationFrame(step);
      } else {
        curPhase = 5;
        ST.showcaseLocked = false;
        setShowcasePhase("phase-done");
        sc.classList.add("is-unlocked");
        const ph = el("rbsPhaseLbl"); if (ph) ph.textContent = "PHASE 05 // PROTOCOL COMPLETE";
        const lt = el("rbsLockTxt"); if (lt) lt.textContent = "UNLOCKED · COMPLETE";
        const li = el("rbsLockIcon"); if (li) li.innerHTML = '<path d="M20 6L9 17l-5-5"/>';
        const btn = el("rbsContinue");
        if (btn) btn.focus({ preventScroll: true });
        if (typeof window.cgHappyTime === "function") { try { window.cgHappyTime(); } catch (e) {} }
      }
    }

    cancelAnimationFrame(showRaf);
    showRaf = requestAnimationFrame(step);
  }

  function closeShowcase() {
    if (!ST.showcaseActive) return;
    if (ST.showcaseLocked) { pulseShowcaseLock(); return; }
    RebirthSfx.click();
    ST.showcaseActive = false;
    ST.showcaseRunId++;
    cancelAnimationFrame(showRaf);
    ShowFx.stop();
    document.body.classList.remove("rb-showcase-active");
    const sc = el("rebirthShowcase");
    if (sc) sc.classList.remove("vis");
    setTimeout(() => {
      if (!ST.showcaseActive && sc) {
        sc.classList.remove("on", "is-unlocked");
        setShowcasePhase("");
        const cnt = getCount();
        const mult = getMult(cnt);
        if (typeof updateRebirthUI === "function") updateRebirthUI();
        if (typeof renderShell === "function") renderShell();
        if (typeof toast === "function") {
          toast("ASCENSION SAVED", "Cycle R" + cnt + " active · Permanent Luck ×" + mult, "#6be08a");
        }
      }
    }, 220);
  }

  function executeRebirthFromModal() {
    if (ST.showcaseActive) return;
    if (typeof canRebirth !== "function" || !canRebirth()) {
      const need = Math.max(0, getThreshold(getCount()) - getEssence());
      RebirthSfx.lock();
      if (typeof toast === "function") {
        toast("INSUFFICIENT ESSENCE", "Need " + fmtN(need) + " more duplicate essence.", "#ff4d5e");
      }
      return;
    }

    RebirthSfx.unlock();
    const oldCnt = getCount();
    const oldMult = getMult(oldCnt);

    if (typeof doRebirth !== "function" || !doRebirth()) return;

    const newCnt = getCount();
    const newMult = getMult(newCnt);
    const nextTh = getThreshold(newCnt);
    const surplus = getEssence();

    renderRebirthModal();
    if (typeof updateRebirthUI === "function") updateRebirthUI();
    if (typeof renderShell === "function") renderShell();

    startShowcase5s({ oldCnt, newCnt, oldMult, newMult, nextTh, surplus });
  }

  /* ============================ HAZARD CURTAIN ============================= */
  function clearCurtainTimers() {
    for (let i = 0; i < ST.curtainTimers.length; i++) clearTimeout(ST.curtainTimers[i]);
    ST.curtainTimers = [];
  }
  function setCurtainCopy(mode) {
    const sr = el("rbHzSerial");
    if (sr) sr.textContent = (0x1000 + Math.floor(Math.random() * 0xefff)).toString(16).toUpperCase();
    const kick = el("rbHzKick"), title = el("rbHzTitle"), water = el("rbHzWater"), sub = el("rbHzSub"), foot = el("rbHzFoot");
    if (mode === "open") {
      if (kick) kick.innerHTML = "// ASCENSION <b>PROTOCOL</b>";
      if (title) title.textContent = "REBIRTH SYSTEM";
      if (water) water.textContent = "REBIRTH";
      if (sub) sub.textContent = "DUPLICATE ESSENCE TRANSMUTATION · PERMANENT LUCK MULTIPLIER";
      if (foot) foot.textContent = "SYNCING CORE";
    } else {
      if (kick) kick.innerHTML = "// MATRIX <b>STANDBY</b>";
      if (title) title.textContent = "STANDBY";
      if (water) water.textContent = "LOCK";
      if (sub) sub.textContent = "ASCENSION CORE SEALED — PROGRESS SECURED";
      if (foot) foot.textContent = "RETURN TO LOBBY";
    }
  }
  function bannerOpen() {
    const hz = el("rebirthCurtain");
    if (!hz) {
      const sh = el("rbhShell"); if (sh) sh.classList.add("is-entered");
      return;
    }
    clearCurtainTimers();
    setCurtainCopy("open");
    hz.className = ""; void hz.offsetWidth;
    hz.classList.add("on", "smooth", "sweep");
    ST.curtainTimers.push(setTimeout(() => hz.classList.add("revealed"), 920));
    ST.curtainTimers.push(setTimeout(() => {
      hz.classList.remove("on", "smooth", "sweep", "revealed");
      const sh = el("rbhShell"); if (sh) sh.classList.add("is-entered");
    }, 1580));
  }
  function bannerClose(onCovered) {
    const hz = el("rebirthCurtain");
    if (!hz) { if (onCovered) onCovered(); return; }
    clearCurtainTimers();
    setCurtainCopy("close");
    hz.className = ""; hz.classList.add("on", "smooth", "revealed");
    void hz.offsetWidth;
    hz.classList.remove("revealed");
    ST.curtainTimers.push(setTimeout(() => { if (onCovered) onCovered(); }, 540));
    ST.curtainTimers.push(setTimeout(() => hz.classList.add("revealed"), 760));
    ST.curtainTimers.push(setTimeout(() => hz.classList.remove("on", "smooth", "revealed"), 1500));
  }

  /* ========================== MODAL OPEN / CLOSE =========================== */
  let _wired = false;
  function wireListeners() {
    if (_wired) return;
    _wired = true;

    const closeBtn = el("rbhClose");
    if (closeBtn) closeBtn.addEventListener("click", () => closeRebirthModal());

    const modal = el("rebirthModal");
    if (modal) modal.addEventListener("click", e => { if (e.target === modal) closeRebirthModal(); });

    const gBtn = el("rbhGuideBtn");
    if (gBtn) gBtn.addEventListener("click", () => {
      RebirthSfx.click();
      renderGuideTable();
      const g = el("rbhGuide"); if (g) g.classList.add("open");
    });

    const gClose = el("rbhGuideClose");
    if (gClose) gClose.addEventListener("click", () => { RebirthSfx.click(); const g = el("rbhGuide"); if (g) g.classList.remove("open"); });

    const gOverlay = el("rbhGuide");
    if (gOverlay) gOverlay.addEventListener("click", e => { if (e.target === gOverlay) gOverlay.classList.remove("open"); });

    const sc = el("rebirthShowcase");
    if (sc) sc.addEventListener("click", e => {
      if (!ST.showcaseActive) return;
      if (ST.showcaseLocked) { e.stopPropagation(); pulseShowcaseLock(); }
    });

    const contBtn = el("rbsContinue");
    if (contBtn) contBtn.addEventListener("click", closeShowcase);
  }

  function openRebirthModal() {
    if (ST.showcaseActive) return;
    ST.closing = false;
    wireListeners();
    if (typeof window.playSound === "function") window.playSound("open");
    else if (typeof sfx !== "undefined" && sfx.hit) sfx.hit();

    renderRebirthModal();
    const modal = el("rebirthModal");
    const shell = el("rbhShell");
    if (modal) modal.classList.add("show");
    if (shell) { shell.classList.remove("is-leaving"); shell.classList.add("is-entered"); }
    document.body.classList.add("rb-open", "hide-docks-modal");
    bannerOpen();
  }

  function closeRebirthModal(opts) {
    if (ST.showcaseActive) { pulseShowcaseLock(); return; }
    const modal = el("rebirthModal");
    if (!modal || !modal.classList.contains("show")) return;
    if (ST.closing && !(opts && opts.instant)) return;
    ST.closing = true;
    RebirthSfx.click();

    const g = el("rbhGuide"); if (g) g.classList.remove("open");

    const doHide = () => {
      ST.closing = false;
      modal.classList.remove("show");
      document.body.classList.remove("rb-open");
      const keepIds = ["dailyModal", "premiumModal", "weatherMachineModal", "watchAdsModal", "profModal", "rankModal", "indexModal", "traitModal", "deckModal", "skillModal", "titlesModal"];
      const keepHide = keepIds.some(id => { const node = document.getElementById(id); return node && node.classList.contains("show"); });
      if (!keepHide) document.body.classList.remove("hide-docks-modal");
      if (typeof updateRebirthUI === "function") updateRebirthUI();
      if (typeof renderShell === "function") renderShell();
    };

    if (opts && opts.instant) {
      clearCurtainTimers();
      const hz = el("rebirthCurtain"); if (hz) hz.className = "";
      doHide();
      return;
    }
    try { bannerClose(doHide); } catch (e) { doHide(); }
  }

  /* Capture-phase keyboard guard: strictly blocks Escape / Space / Enter during 5s showcase */
  document.addEventListener("keydown", e => {
    if (ST.showcaseActive) {
      if (ST.showcaseLocked) {
        if (e.key === "Escape" || e.code === "Space" || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          pulseShowcaseLock();
        }
        return;
      }
      if (e.key === "Escape" || e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        closeShowcase();
        return;
      }
    }
    if (e.key === "Escape") {
      const g = el("rbhGuide");
      if (g && g.classList.contains("open")) {
        e.preventDefault();
        e.stopPropagation();
        g.classList.remove("open");
        return;
      }
      const m = el("rebirthModal");
      if (m && m.classList.contains("show")) {
        e.preventDefault();
        e.stopPropagation();
        closeRebirthModal();
      }
    }
  }, true);

  window.addEventListener("resize", () => { if (ST.showcaseActive) ShowFx.resize(); });

  window.rebirthTierMeta = tierOf;
  window.rebirthCrestSvg = rebirthCrestSvg;
  window.openRebirthModal = openRebirthModal;
  window.closeRebirthModal = closeRebirthModal;
  window.renderRebirthModal = renderRebirthModal;
  window.executeRebirthFromModal = executeRebirthFromModal;
  window.__rbShowcaseLocked = () => ST.showcaseLocked;
  window.__rbShowcaseActive = () => ST.showcaseActive;
})();
