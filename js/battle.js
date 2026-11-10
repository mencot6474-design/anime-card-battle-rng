/* =============== BATTLE =============== */
let bt=null;
/* Token generasi GLOBAL — bukan per-battle, supaya cb basi dari battle sebelumnya gak pernah cocok lagi */
let FGEN=0;
/* ===== BATTLE SPEED: multiplier pacing seluruh engine battle (cerita + Infinite Tower).
   Semua jeda dijadwalkan lewat schedPhase()/bsMs(ms) → dibagi bt.speed. bt.speed dibekukan per battle
   dari battleSpeedEff() (state.battleSpeed; terkunci level: LV10→2x, LV25→3x, LV50→4x).
   Skala linear → urutan antar-timeout di dalam satu fase tetap aman. ===== */
function battleSpeedMax(){const lv=(state&&state.playerLv)||1;return lv>=50?4:lv>=25?3:lv>=10?2:1;}
function battleSpeedEff(){let s=(state&&state.battleSpeed)||1;if(s<1)s=1;const m=battleSpeedMax();return Math.min(Math.floor(s),m);}
function bsMs(ms){const m=(bt&&bt.speed)||1;return m<=1?ms:Math.max(0,Math.round(ms/m));}
/* FX canvas ult dipakai di battle cerita/tower DAN raid (engine terpisah). Guard `!bt` dulu
   membunuh animasi di raid karena `bt` null → canvas dihapus di frame pertama. */
function fxEngineOver(){
  if(typeof raid!=="undefined"&&raid&&!raid.over&&typeof raidView!=="undefined"&&raidView==="battle")return false;
  return !(typeof bt!=="undefined"&&bt&&!bt.over);
}
/* Tombol speed in-battle (di .vs-col): cycle 1x→2x→3x→4x→1x — hanya tier yang sudah terbuka per level.
   Efek langsung ke bt.speed (timeout berikutnya) + persist state.battleSpeed (ikut ke settings & battle berikut). */
function wireSpeedBtn(){
  const b=document.getElementById("bspeedBtn");
  if(!b)return;
  let grp=document.getElementById("pgrSpeedGroup");
  if(!grp){
    grp=document.createElement("div");
    grp.id="pgrSpeedGroup";
    grp.className="pgr-speed-group";
    b.style.display="none";
    b.parentNode.insertBefore(grp,b.nextSibling);
  }
  const upd=()=>{
    const m=battleSpeedMax();
    const sp=battleSpeedEff();
    const tiers=[{v:1,lv:1},{v:2,lv:10},{v:3,lv:25},{v:4,lv:50}];
    grp.innerHTML=tiers.map(t=>{
      const locked=t.v>m;
      const act=sp===t.v;
      return `<button type="button" class="pgr-spd-btn${act?' active':''}" data-spd="${t.v}" ${locked?'disabled':''} title="${locked?'Unlocks at LV '+t.lv:'Battle Speed '+t.v+'×'}">${t.v}×</button>`;
    }).join("");
    grp.querySelectorAll(".pgr-spd-btn").forEach(btn=>{
      btn.onclick=()=>{
        const v=Number(btn.dataset.spd)||1;
        if(v>battleSpeedMax())return;
        state.battleSpeed=v;
        save();
        if(bt)bt.speed=battleSpeedEff();
        if(window.CyberSfx&&window.CyberSfx.katanaSlash)window.CyberSfx.katanaSlash(1.3);
        upd();
      };
    });
  };
  upd();
}
function battleCardNameHtml(name,mut,shiny){
  const esc=String(name).replace(/"/g,'&quot;');
  if(mut&&!shiny)return `<div class="f-name f-mut-name f-mut-${mut}" data-text="${esc}">${mut==='rainbow'?mutText(mut,name):name}</div>`;
  if(!shiny)return `<div class="f-name">${name}</div>`;
  const vars=mut==='gold'?'--sh-base:#E0BC6E;--sh-edge:rgba(224,188,110,.95);--sh-glow:rgba(224,188,110,.55)':mut==='rainbow'?'--sh-base:#B58CFF;--sh-edge:rgba(90,200,250,.95);--sh-glow:rgba(181,140,255,.55)':mut==='secret'?'--sh-base:#A855F7;--sh-edge:rgba(168,85,247,.95);--sh-glow:rgba(168,85,247,.55)':mut==='ultima'?'--sh-base:#FF0055;--sh-edge:rgba(255,51,102,.95);--sh-glow:rgba(255,0,85,.6)':'';
  return `<div class="f-name f-name-shine${mut?' f-name-shine-'+mut:''}" data-text="${esc}"${vars?` style="${vars}"`:''}>${name}</div>`;
}
/* ===== ORNATE CYBER-RELIC TCG FRAME HELPERS (PGR × SOLO LEVELING) ===== */
function tcgElemGlyph(type,isFoe){
  const t=String(type||"").toLowerCase();
  if(t.includes("frost")||t.includes("ice")||t.includes("snow"))return "❄️";
  if(t.includes("fire")||t.includes("flame")||t.includes("solar"))return "🔥";
  if(t.includes("sorcerer")||t.includes("esper")||t.includes("magic"))return "✦";
  if(t.includes("titan")||t.includes("beast")||t.includes("conqueror"))return "❖";
  if(t.includes("shadow")||t.includes("demon")||t.includes("vampire"))return "🌙";
  if(t.includes("time")||t.includes("requiem")||t.includes("cosmic"))return "⏳";
  if(t.includes("dragon")||t.includes("raid")||t.includes("boss"))return "🐉";
  return isFoe?"☣":"✦";
}
function tcgStarsForTier(tier){
  if(tier==="EX"||tier==="BOSS")return "★★★★★";
  if(tier==="UR")return "★★★★☆";
  if(tier==="SSR")return "★★★☆☆";
  if(tier==="SR")return "★★☆☆☆";
  return "★☆☆☆☆";
}
function tcgOrnateSvgHtml(isFoe){
  const c1=isFoe?"#ff2a5f":"#00f5d4";
  const c2=isFoe?"#ffaa00":"#c77dff";
  return `<svg class="tcg-ornate-svg" viewBox="0 0 220 316" fill="none" preserveAspectRatio="none">
    <path d="M4,26 L4,10 L14,2 L36,2 L28,8 L10,8 L10,22 Z" fill="${c1}"/>
    <path d="M216,26 L216,10 L206,2 L184,2 L192,8 L210,8 L210,22 Z" fill="${c1}"/>
    <path d="M4,290 L4,306 L14,314 L36,314 L28,308 L10,308 L10,294 Z" fill="${c2}"/>
    <path d="M216,290 L216,306 L206,314 L184,314 L192,308 L210,308 L210,294 Z" fill="${c2}"/>
    <rect x="8" y="8" width="204" height="300" rx="11" stroke="rgba(255,255,255,0.24)" stroke-width="1"/>
    <line x1="6" y1="115" x2="6" y2="195" stroke="${c1}" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="214" y1="145" x2="214" y2="210" stroke="${c2}" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="12,12 17,17 12,22 7,17" fill="${c1}"/>
    <polygon points="208,12 213,17 208,22 203,17" fill="${c1}"/>
    <polygon points="12,294 17,299 12,304 7,299" fill="${c2}"/>
    <polygon points="208,294 213,299 208,304 203,299" fill="${c2}"/>
  </svg>
  <svg class="cyber-stun-lock" viewBox="0 0 220 260" fill="none">
    <polygon points="110,12 200,62 200,198 110,248 20,198 20,62" stroke="#ffaa00" stroke-width="2" stroke-dasharray="10 6" fill="rgba(255,170,0,0.06)"/>
    <rect x="35" y="114" width="150" height="32" fill="rgba(6,8,16,0.92)" stroke="#ffaa00" stroke-width="1.5"/>
    <text x="110" y="135" fill="#fde047" font-family="Russo One, Rajdhani, sans-serif" font-size="11" font-weight="800" text-anchor="middle" letter-spacing="2">SYSTEM LOCK</text>
  </svg>
  <div class="cryo-glass-overlay"></div>`;
}
function fmtBattleK(n){
  n=Number(n)||0;
  const s=n<0?"-":"";
  const a=Math.abs(n);
  if(a>=1e12)return s+Math.round(a/1e12)+"T";
  if(a>=1e9)return s+Math.round(a/1e9)+"B";
  if(a>=1e6)return s+Math.round(a/1e6)+"M";
  if(a>=1e3)return s+Math.round(a/1e3)+"K";
  return s+Math.round(a);
}
window.fmtBattleK=fmtBattleK;

function tcgPlayerEquipRailHtml(){
  const slots=(state&&Array.isArray(state.artSlots))?state.artSlots:[null,null];
  const a1=slots[0]?ART_DEFS.find(x=>x.id===slots[0]):null;
  const a2=slots[1]?ART_DEFS.find(x=>x.id===slots[1]):null;
  const pet=state&&state.petEquipped?PET_DEFS.find(x=>x.id===state.petEquipped):null;
  const s1=a1?`<div class="tcg-item-socket" title="${a1.name} (${luckTxt(a1)})"><img src="${a1.img}" alt="${a1.name}"><span class="sock-tier-dot"></span></div>`:`<div class="tcg-item-socket empty" title="Artifact Slot 1 (Empty)"><span class="sock-empty-dot"></span></div>`;
  const s2=a2?`<div class="tcg-item-socket" title="${a2.name} (${luckTxt(a2)})"><img src="${a2.img}" alt="${a2.name}"><span class="sock-tier-dot"></span></div>`:`<div class="tcg-item-socket empty" title="Artifact Slot 2 (Empty)"><span class="sock-empty-dot"></span></div>`;
  const sp=pet?`<div class="tcg-item-socket pet-socket" title="${pet.name} (${luckTxt(pet)})"><img src="${pet.img}" alt="${pet.name}"><span class="sock-tier-dot"></span></div>`:`<div class="tcg-item-socket pet-socket empty" title="Pet Slot (Empty)"><span class="sock-empty-dot"></span></div>`;
  return `<div class="tcg-equip-rail me-equip-rail">${s1}${s2}${sp}</div>`;
}
window.tcgPlayerEquipRailHtml=tcgPlayerEquipRailHtml;

function tcgFoeEquipRailHtml(){
  return `<div class="tcg-equip-rail foe-equip-rail">
    <div class="tcg-item-socket empty" title="Enemy Relic I (Empty)"><span class="sock-empty-dot"></span></div>
    <div class="tcg-item-socket empty" title="Enemy Relic II (Empty)"><span class="sock-empty-dot"></span></div>
    <div class="tcg-item-socket pet-socket empty" title="Enemy Familiar (Empty)"><span class="sock-empty-dot"></span></div>
  </div>`;
}
window.tcgFoeEquipRailHtml=tcgFoeEquipRailHtml;

/* ===== HAZARD CARD INFO: tag, chance, badge, nama, skill =====
   Menumpuk DI ATAS art (di dalam .f-banner) supaya tampang kartu sama dengan
   prototipe hazard. Semua nilai dari data kartu yang sudah ada. */
function hzEsc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function hzCardInfoHtml(o){
  o=o||{};
  var cd=(o.char&&typeof CARDS!=="undefined")?CARDS[o.char]:null;
  var out="";
  var ch="";
  if(cd&&cd.chance){
    try{ ch="1 IN "+fmt(cd.chance); }catch(e){ ch="1 IN "+cd.chance; }
  }
  var tag=o.tag||"";
  if(tag||ch){
    out+='<div class="hz-card-top">'+
      (tag?'<span class="hz-tag'+(o.side==="foe"?" foe":"")+'">'+hzEsc(tag)+'</span>':'')+
      (ch?'<span class="hz-chance">'+hzEsc(ch)+'</span>':'')+
      '</div>';
  }
  var badges="";
  if(o.shiny) badges+='<span class="hz-b hz-b-shiny">SHINY</span>';
  var ml=(o.mut&&typeof MUT_LABEL!=="undefined")?MUT_LABEL[o.mut]:"";
  if(ml) badges+='<span class="hz-b hz-b-mut">'+hzEsc(ml)+'</span>';
  var tn="";
  try{
    if(o.trait&&o.trait!=="none"&&typeof TRAIT!=="undefined"&&TRAIT[o.trait]){
      tn=TRAIT[o.trait].name||"";
    }
  }catch(e){}
  if(tn) badges+='<span class="hz-b hz-b-trait">TRAIT &middot; '+hzEsc(tn)+'</span>';
  if(badges) out+='<div class="hz-card-badges">'+badges+'</div>';
  if(o.name) out+='<div class="hz-card-name">'+hzEsc(o.name)+'</div>';
  var sk=(o.skill&&String(o.skill).trim())?String(o.skill).trim():"";
  if(sk) out+='<div class="hz-card-skill">'+hzEsc(sk)+'</div>';
  if(!out) return "";
  return '<div class="hz-card-info">'+out+'</div>';
}

/* Badge kartu (SHINY / mutasi / TRAIT) — kanan atas tanpa titik SVG, trait asli. */
function hzBadgeHtml(mut,trait,shiny,role){
  var out="";
  if(role) out+='<span class="c-badge b-role">'+role+'</span>';
  if(shiny) out+='<span class="c-badge b-shiny">SHINY</span>';
  var m=(mut&&mut!=="none")?String(mut).toLowerCase():"";
  var ml=(m&&typeof MUT_LABEL!=="undefined"&&MUT_LABEL[m])?MUT_LABEL[m]:(m?m.toUpperCase():"");
  if(ml) out+='<span class="c-badge b-mut-'+m+'">'+ml+'</span>';
  try{
    if(trait&&trait!=="none"&&typeof TRAIT!=="undefined"&&TRAIT[trait]){
      var tc=(typeof TRAIT_COLOR!=="undefined"&&TRAIT_COLOR[trait])||TRAIT[trait].color||"#6be08a";
      var gem=(typeof traitGem==="function")?traitGem(14,trait):"";
      var pill='<span class="hc-trait hc-gem hz-trait-gem" style="color:'+tc+';border-color:'+tc+'">'+gem+'</span>';
      out+=(typeof traitChip==="function")?traitChip(trait,pill):pill;
    }
  }catch(e){}
  return out;
}

function hzSkillDescEn(charId, fallback){
  var raw="";
  try{
    if(charId&&window.GameLang&&typeof window.GameLang.cardDescEn==="function"){
      raw=window.GameLang.cardDescEn(charId);
    }
    if(!raw&&charId&&typeof CARDS!=="undefined"&&CARDS[charId]&&CARDS[charId].passive){
      raw=CARDS[charId].passive.desc||CARDS[charId].passive.name||"";
    }
  }catch(e){}
  if(!raw) raw=fallback||"";
  if(window.tLang){ try{ raw=window.tLang(raw); }catch(e){} }
  var safe=String(raw||"").replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});
  safe=safe.replace(/([+-]?\d+(?:\.\d+)?%|×\d+(?:\.\d+)?|\b\d+(?:\.\d+)?x\b)/gi,"<b>$1</b>");
  safe=safe.replace(/\b(STUN|FREEZE|FROZEN|BLEED|BURN|POISON|PIERCE|DODGE|IMMUNE|REVIVE|LIFESTEAL)\b/gi,"<em>$1</em>");
  return safe;
}

function foeFighterInnerHtml(en,es,opts){
  opts=opts||{};
  const hpId=opts.hpId||"hpFoe",hpTid=opts.hpTid||"hpFoeT";
  const maxHp=Math.max(1,es.hp||1);
  const curHp=opts.curHp!=null?Math.max(0,Math.min(maxHp,opts.curHp)):maxHp;
  const hpPct=Math.max(0,Math.min(100,curHp/maxHp*100));
  const fmtHp=opts.hpFmt||fmtBattleK;
  const mut=(opts.mut||(en&&en.mut)||"none").toLowerCase();
  const cid=(en&&(en.id||en.char))||null;
  const role=opts.subtitle||(en&&en.boss?"FLOOR BOSS":"TARGET");
  const desc=hzSkillDescEn(cid, opts.skill||(en&&en.skill)||(en&&en.passive&&(en.passive.desc||en.passive.name))||"");
  return `<div class="fc-frame card-shell mut-${mut}">
    <span class="mut-ring"></span>
    <img class="fc-art card-art" src="${en.img}" alt="${en.name}">
    <div class="fc-vig card-shade"></div>
    <div class="fc-top card-top-bar">
      <div class="fc-badges card-badges">${hzBadgeHtml(mut,null,false,role)}</div>
    </div>
    <div class="card-body">
      <div class="fc-name card-title">${en.name}</div>
      <div class="fc-skill card-desc">${desc}</div>
      <div class="fc-stats card-inline-stats">
        <span class="fc-st hp cis-hp">HP: <b id="foeInlineHp">${fmtHp(curHp)}</b></span>
        <span class="fc-st atk cis-dmg">DMG: <b id="foeInlineDmg">${fmtBattleK(es.atk)}</b></span>
      </div>
    </div>
  </div>
  <div class="fc-foot">
    <div class="fc-hp unit-hp-pill">
      <i id="${hpId}" class="unit-hp-fill" style="width:${hpPct}%"></i>
      <span class="unit-hp-segs"></span>
      <b id="${hpTid}" class="unit-hp-txt">${fmtHp(curHp)} / ${fmtHp(maxHp)}</b>
    </div>
  </div>`;
}
window.foeFighterInnerHtml=foeFighterInnerHtml;

function meFighterHtml(s,opts){
  opts=opts||{};
  const st=s.sk?{hp:s.skHp,atk:s.skAtk}:cardStats(s.char,s.mut,s.trait,s.shiny);
  const maxHp=opts.maxHp!=null?Math.max(1,opts.maxHp):Math.max(1,st.hp||1);
  const curHp=opts.curHp!=null?Math.max(0,Math.min(maxHp,opts.curHp)):maxHp;
  const hpPct=Math.max(0,Math.min(100,curHp/maxHp*100));
  const cd=CARDS[s.char]||null;
  const mut=(s.mut||"none").toLowerCase();
  const desc=hzSkillDescEn(s.char, (cd&&cd.passive&&(cd.passive.desc||cd.passive.name))||"");
  const pos=(cd&&cd.pos)?` style="object-position:${cd.pos}"`:"";
  return `<div class="fc-frame card-shell mut-${mut}${s.shiny?" is-shiny":""}">
    <span class="mut-ring"></span>
    <img class="fc-art card-art" src="${cardImg(s.char)}" alt="${cardName(s.char)}"${pos}>
    <div class="fc-vig card-shade"></div>
    <div class="fc-top card-top-bar">
      <div class="fc-badges card-badges">${hzBadgeHtml(mut,s.trait,!!s.shiny,"OPERATOR")}</div>
    </div>
    <div class="card-body">
      <div class="fc-name card-title">${cardName(s.char)}</div>
      <div class="fc-skill card-desc">${desc}</div>
      <div class="fc-stats card-inline-stats">
        <span class="fc-st hp cis-hp">HP: <b id="meInlineHp">${fmtBattleK(curHp)}</b></span>
        <span class="fc-st atk cis-dmg">DMG: <b id="meAtkT">${fmtBattleK(st.atk)}</b></span>
      </div>
    </div>
  </div>
  <div class="fc-foot">
    <div class="fc-hp unit-hp-pill">
      <i id="hpMe" class="unit-hp-fill" style="width:${hpPct}%"></i>
      <span class="unit-hp-segs"></span>
      <b id="hpMeT" class="unit-hp-txt">${fmtBattleK(curHp)} / ${fmtBattleK(maxHp)}</b>
    </div>
  </div>`;
}
function meShadowHtml(sh){
  return `<div class="fc-frame card-shell mut-secret">
    <span class="mut-ring"></span>
    <img class="fc-art card-art" src="${sh.img}" alt="${sh.name}" style="filter:grayscale(.35) brightness(.72) hue-rotate(215deg) saturate(1.5)">
    <div class="fc-vig card-shade"></div>
    <div class="fc-top card-top-bar">
      <div class="fc-badges card-badges"><span class="c-badge b-mut-secret">SHADOW</span></div>
    </div>
    <div class="card-body">
      <div class="fc-name card-title">${sh.name}</div>
      <div class="fc-skill card-desc"><b>SHADOW EXCHANGE</b> &middot; Fights in the Monarch's place until turns expire or HP reaches zero.</div>
      <div class="fc-stats card-inline-stats">
        <span class="fc-st hp cis-hp">HP: <b id="meInlineHp">${fmtBattleK(sh.maxHp)}</b></span>
        <span class="fc-st atk cis-dmg">DMG: <b id="meAtkT">${fmtBattleK(sh.atk)}</b></span>
      </div>
    </div>
  </div>
  <div class="fc-foot">
    <div class="fc-hp unit-hp-pill">
      <i id="hpMe" class="unit-hp-fill" style="width:100%"></i>
      <span class="unit-hp-segs"></span>
      <b id="hpMeT" class="unit-hp-txt">${fmtBattleK(sh.maxHp)} / ${fmtBattleK(sh.maxHp)}</b>
    </div>
  </div>`;
}
function endPossession(){
  if(!bt||!bt.shadow)return;
  const s=bt.shadow;bt.shadow=null;
  bt.pHp=s.retHp;bt.pMax=s.retMax;
  updateMeCard();setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MONARCH RETURNS","heal");},200);
}
/* ===== SHADOW ARMY (SHADOW KING) =====
   Shadow = fighter asli yang di-append ke bt.fighters (slot di belakang party) dengan
   stat 75% musuh yang tumbang. Disimpan di stack: {sk:true, skAtk, skHp, dead}. */
function skIsShadow(f){return !!(f&&f.sk);}
function skLivingShadows(){return bt?bt.fighters.filter(f=>skIsShadow(f)&&!f.dead):[];}
function skFirstShadowIdx(){
  if(!bt)return -1;
  for(let i=bt.active+1;i<bt.fighters.length;i++){const f=bt.fighters[i];if(skIsShadow(f)&&!f.dead)return i;}
  return -1;
}
function skKingFx(){if(!bt)return null;const k=bt.fighters.find(f=>f&&!skIsShadow(f)&&(PASSIVE_FX[f.char]||{}).shadowArmy);return k?(PASSIVE_FX[k.char].shadowArmy):null;}
function skKingChar(){if(!bt)return"";const k=bt.fighters.find(f=>f&&!skIsShadow(f)&&(PASSIVE_FX[f.char]||{}).shadowArmy);return k?k.char:"";}
/* Rail cadangan pemain (bukan rail musuh di kolom .foe-side) + tile King paling belakang. */
function skPlayerRail(){
  const me=document.querySelector(".fighter.me");
  const col=me?me.closest(".me-col"):document.querySelector(".me-col:not(.foe-side)");
  return col?col.querySelector(".bench-rail"):null;
}
/* Tile King di rail (bukan asumsi "paling belakang" — urutan party bisa berubah setelah tag-in). */
function skKingTile(){
  const kc=skKingChar();if(!kc)return null;
  const rail=skPlayerRail();if(!rail)return null;
  const want=cardThumb(kc);
  return [...rail.querySelectorAll(".bench-sq:not(.empty)")].find(el=>{
    const im=el.querySelector("img");return im&&im.getAttribute("src")===want;
  })||null;
}
/* Semua state battle di-key per SLOT (index), jadi saat tukar posisi nilainya ikut dipindah. */
const SK_SLOT_ARRAYS=["revUsed","atkBuff","dodgeStack","atkCount","standUsed","styleCount","burstStart","entryGuard","dodgeArmed","dodgeCount","execGuard","shatterGuard","wtCount","snatchAtk","snatchHp","regressCharges","bioGuard","splitLeft","splitMult","defyUsed","dsState","atkEntryGuard","sleepLeft","sleepArmed","shockCount","hvCount","hvUses","hvEntryGuard","weCount","bajrangUsed","meteorGuard"];
function skRotateToRear(a,s){
  /* Shadow di slot s maju ke slot aktif a; King turun ke barisan paling belakang. Slot < a (sudah tumbang) tetap. */
  const order=[];
  for(let i=0;i<a;i++)order.push(i);
  order.push(s);
  for(let i=a;i<bt.fighters.length;i++)if(i!==a&&i!==s)order.push(i);
  order.push(a);
  bt.fighters=order.map(i=>bt.fighters[i]);
  SK_SLOT_ARRAYS.forEach(k=>{const arr=bt[k];if(Array.isArray(arr)){const old=arr.slice();bt[k]=order.map(i=>old[i]);}});
}

function updateMeCard(){if(!bt)return;const f=document.querySelector(".fighter.me");if(f){if(bt.shadow){f.className="fighter me shadow-fighter";f.dataset.tier="EX";f.dataset.char="";f.style.borderColor="#7c3aed";f.innerHTML=meShadowHtml(bt.shadow);return;}f.className="fighter me"+mutGlow(bt.eq.mut)+shinyCls(bt.eq)+(isFullArt(bt.eq.char)?" full-art":"")+(bt.eq.sk?" shadow-fighter":"");f.dataset.tier=bt.eq.tier||cardTier(bt.eq.char)||"";f.dataset.char=bt.eq.char;f.style.borderColor=bt.eq.mut&&bt.eq.mut!=="none"?MUT_COLOR[bt.eq.mut]:"";f.innerHTML=meFighterHtml(bt.eq,{curHp:bt.pHp,maxHp:bt.pMax});}}
function benchTile(s){
  const tier=s.tier||cardTier(s.char)||"";
  const col=(tier&&TIER_COLOR[tier])||"var(--line2)";
  return `<div class="bench-sq${s.sk?" shadow-sq":""}" data-tier="${tier}" style="border-color:${col}" title="${s.sk?"SHADOW · ":""}${cardName(s.char)}"><img src="${cardThumb(s.char)}" alt="${cardName(s.char)}" width="48" height="48" decoding="async"><span class="bhp"><i style="width:100%"></i></span></div>`;
}
/* Rail cadangan = 3 kotak gambar sejajar (sisa dek setelah fighter aktif), ditambal placeholder biar tetap 3. */
function benchRailHtml(remaining,caption){
  const list=remaining||[];
  const cap=caption||"DECK STANDBY";
  let html="";
  for(let i=0;i<3;i++) html += i<list.length ? benchTile(list[i]) : `<div class="bench-sq empty">—</div>`;
  return `<div class="bench-rail" data-caption="${cap}">${html}</div>`;
}
/* Bench = kartu dek yang BELUM bertanding (setelah fighter aktif). Saat render awal bt belum ada → pakai equippedList. */
function benchHtml(){
  const list=(bt&&bt.fighters)?bt.fighters.slice(bt.active+1):equippedList().slice(1);
  return benchRailHtml(list,"DECK STANDBY");
}
function renderBattle(){
  document.body.classList.add("battle-full", "on-battle");
  const lv=state.battle.level,en=enemyOf(lv),es=enemyStats(lv);
  const eq=equipped();
  app.innerHTML=`
  <div class="battle-grid">
  ${tcgPlayerEquipRailHtml()}
  ${tcgFoeEquipRailHtml()}
  <div class="me-col">
    <div class="fighter me${eq?mutGlow(eq.mut):''}${shinyCls(eq)}${eq&&isFullArt(eq.char)?' full-art':''}" data-tier="${eq?eq.tier:''}" data-char="${eq?eq.char:''}"${eq?mutEdge(eq.mut):''}>${meFighterHtml(eq)}</div>
    ${benchHtml()}
  </div>
  <div class="vs-col"><div class="s" id="turnLabel" style="display:none"></div><button class="bspeed-btn" id="bspeedBtn" type="button">1×</button></div>
  <div class="me-col foe-side">
    <div class="fighter foe${mutGlow(diffOf().mut)}" data-tier="${en.tier||''}"${mutEdge(diffOf().mut)}>
      ${foeFighterInnerHtml(en,es,{mut:diffOf().mut})}
    </div>
    ${benchRailHtml([],"STORY MODE (SINGLE TARGET)")}
  </div>
  </div>`;
  wireSpeedBtn();
  if (typeof window.syncBattleBackground === "function") window.syncBattleBackground();
  /* HAZARD ARENA: layer visual (arena, HUD, party, pile) + banner masuk. */
  if (typeof window.hzBattleDecorate === "function") { try { window.hzBattleDecorate(); } catch(e){ console.error("hz decorate", e); } }
  if (typeof window.hzCurtainIn === "function") {
    window.hzCurtainIn(function(){ playFight(startBattle, {skipIntro:true}); });
  } else {
    playFight(startBattle);
  }
}
function floatText(sel,txt,cls,customLbl){
  const f=typeof sel==="string"?document.querySelector(sel):sel;if(!f)return;
  const r=f.getBoundingClientRect();if(!r.width)return;
  let l=document.getElementById("dmgLayer");
  if(!l){l=document.createElement("div");l.id="dmgLayer";document.body.appendChild(l);}
  const d=document.createElement("div");
  const raw=String(txt||"");
  const cStr=String(cls||"");
  let lbl=customLbl||"";
  let num=raw;
  if(!lbl){
    const m=raw.match(/^(.+?)\s+([+-][\d,]+(?:\s*\(.+\))?)$/);
    if(m){lbl=m[1];num=m[2];}
    else if(raw.startsWith("-")){lbl="";}
    else if(raw.startsWith("+")){lbl="";}
    else if(raw==="DODGE"||raw==="MISS"){lbl="TIME FRACTURE";num=raw==="DODGE"?"MATRIX EVADE":"MISS";}
    else if(raw==="FROZEN"){lbl="ABSOLUTE ZERO";num="CRYO STASIS";}
    else if(raw==="STUNNED"||raw==="STUN"){lbl="SYSTEM RESTRAINT";num="PARALYZED";}
    else if(raw==="BURN"){lbl="PLASMA IGNITION";num="PLASMA BURN";}
    else if(raw.includes("TAG-IN")){lbl="SHADOW SWAP";num=raw;}
    else{lbl=cStr.includes("heal")?"SYSTEM BUFF":cStr.includes("burn")?"CORRUPTION":cStr.includes("miss")?"TACTICAL":"OVERDRIVE";}
  }
  /* Label teks di atas ANGKA damage dihapus: cukup angkanya saja.
     Teks status (DODGE/MISS/IMMUNE/...) tetap karena num-nya bukan angka. */
  if(/^[+-][\d,]/.test(String(num).trim())) lbl="";
  d.className="dmg-float pgr-pop"+(cStr?" "+cStr:"");
  const isMini=cStr.includes("mini");
  const jx=(Math.random()-0.5)*(isMini?10:28);
  const jy=(Math.random()-0.5)*(isMini?8:22);
  d.style.left=(r.left+r.width/2+jx)+"px";
  d.style.top=(r.top+r.height*0.18+jy)+"px";
  d.innerHTML=(lbl?`<span class="lbl">${lbl}</span>`:"")+`<span class="num">${num}</span>`;
  l.appendChild(d);setTimeout(()=>d.remove(),980);
}
function anim(sel,cls,noPair){
  const el=document.querySelector(sel);if(!el)return;
  if(cls==="ko"){el.classList.add("ko");}

}
/* ---------- GALAXY ROAR (Eternal Dragon): charge bola beku -> sembur laser es -> ledakan percikan beku ----------
   Semua timing dibaca dari GALAXY supaya mesin battle (schedPhase / raid.timer / dlyAt) dan
   animasinya tidak saling lepas: kerusakan & getar kartu jatuh tepat di menit GALAXY.hit. */
const GALAXY={chg:520,hit:900,total:2100};
const PSY_T={first:560,step:110,fly:240};
const BJ_T={first:520};
const HP_T={first:560};
const HR_T={first:480};
const WE_T={first:320};
const GR_T={first:620};
let MADARA_T={wind:280,slash:520,step:120,total:2760};
/* Legacy canvas attack FX removed — all attacks use prototype Hazard Basic Attack choreography */
function psyBarrageFx(){}
function rubberBounceFx(){}
function showDizzyCrown(){}
function bajrangGunFx(){}
function hollowPurpleFx(){}
function havocRocketFx(){}
function worldEnderFx(){}
function worldEnderReviveFx(){}
function gammaRayFx(){}
function causalityFx(){}
window.psyBarrageFx=psyBarrageFx;
window.rubberBounceFx=rubberBounceFx;
window.showDizzyCrown=showDizzyCrown;
window.bajrangGunFx=bajrangGunFx;
window.hollowPurpleFx=hollowPurpleFx;
window.havocRocketFx=havocRocketFx;
window.worldEnderFx=worldEnderFx;
window.worldEnderReviveFx=worldEnderReviveFx;
window.gammaRayFx=gammaRayFx;
window.causalityFx=causalityFx;
function startBattle(){
  window.cutInShown=false;
  if(bt&&bt.timer){clearTimeout(bt.timer);bt.timer=null;}
  const lv=state.battle.level,en=enemyOf(lv),es=enemyStats(lv);
  const fighters=equippedList();if(!fighters.length)fighters.push(equipped());
  const eq=fighters[0],base=cardStats(eq.char,eq.mut,eq.trait,eq.shiny);
  const eid=en.id||null;
  let efx=eid?(PASSIVE_FX[eid]||{}):{};
  /* SHARINGAN COPY sbg lawan (Kakashi): sekali di awal battle, salin seluruh passive kartu pemain */
  if(efx.copy){const own={...efx};delete own.copy;efx=Object.assign({},fxOf(eq)||{},own);delete efx.copy;}
  bt={t0:Date.now(),dmgDone:0,speed:battleSpeedEff(),fgen:++FGEN,lv,en,es,eq,fighters,eid,efx,active:0,cutInShown:false,revUsed:new Array(fighters.length).fill(false),justTagged:false,pHp:base.hp,pMax:base.hp,eHp:es.hp,turn:1,over:false,eBurn:0,ePoison:0,pGuardDr:0,eAbilityOff:0,voidUsed:false,pCopyFx:null,spCd:[],spTurn:[],spArmed:[],spWave:[],meteorGuard:[],phase2used:false,domainUsed:false,domainLeft:0,eStun:0,pStun:0,pDr:0,pDrTurns:0,atkBuff:new Array(fighters.length).fill(0),dodgeStack:new Array(fighters.length).fill(0),atkCount:new Array(fighters.length).fill(0),standUsed:new Array(fighters.length).fill(false),styleCount:new Array(fighters.length).fill(0),burstStart:new Array(fighters.length).fill(1),entryGuard:new Array(fighters.length).fill(false),dodgeArmed:new Array(fighters.length).fill(false),dodgeCount:new Array(fighters.length).fill(0),execGuard:new Array(fighters.length).fill(false),shatterGuard:new Array(fighters.length).fill(false),wtCount:new Array(fighters.length).fill(0),snatchAtk:new Array(fighters.length).fill(0),snatchHp:new Array(fighters.length).fill(0),regressCharges:new Array(fighters.length).fill(0),bioGuard:new Array(fighters.length).fill(false),splitLeft:new Array(fighters.length).fill(0),splitMult:new Array(fighters.length).fill(1),rumbling:0,rumblingPct:0,defyUsed:new Array(fighters.length).fill(false),defyHold:false,openGuard:true,dsState:new Array(fighters.length).fill(0),aftermath:false,gumTurns:0,trickNext:false,royalNow:false,gunsNow:false,psychic:null,atkEntryGuard:new Array(fighters.length).fill(false),sleepLeft:new Array(fighters.length).fill(0),sleepArmed:new Array(fighters.length).fill(false),overflow:0,rain:null,freezeLeft:0,shockCount:new Array(fighters.length).fill(0),shadow:null,freezeNext:false,valhallaLeft:0,paintHits:[],eInk:0,eInkPct:0,wc:null,rearIdx:-1,rearWaiting:false,rearUsed:[],senzu:{},senzuFin:false,balloon:0,stretchShot:0,turret:0,hvCount:new Array(fighters.length).fill(0),hvUses:new Array(fighters.length).fill(0),hvEntryGuard:new Array(fighters.length).fill(false),eHvUses:0,excited:false,weCount:new Array(fighters.length).fill(0),weRevived:false,pbRocks:0,pbKey:"",pbStreak:0,rubber:false,rbBounce:0,dizzyStack:0,dizzyLeft:0,bajrangUsed:new Array(fighters.length).fill(false)};
  // BURST: kartu pertama masuk arena langsung dapat boost HP kalau punya fx.burst
  const fx0=resolveFx(eq,efx);
  if(fx0.burst){bt.pMax=Math.round(base.hp*fx0.burst.mult);bt.pHp=bt.pMax;}
  if(fx0.transform){bt.pMax=Math.round(base.hp*fx0.transform.mult);bt.pHp=bt.pMax;}
  if(fx0.entryCounter)bt.entryGuard[0]=true;
  if(fx0.executeOnEntry)bt.execGuard[0]=true;
  if(fx0.entryShatter)bt.shatterGuard[0]=true;
  if(fx0.entryMaxHp)bt.bioGuard[0]=true;
  if(fx0.meteorWave)bt.meteorGuard[0]=true;
  if(fx0.entryAtkPct)bt.atkEntryGuard[0]=true;
  if(fx0.havocRocket)bt.hvEntryGuard[0]=true;
  armShotFx(fx0,0);partyDmgApply(fx0);
  if(fx0.psychicBarrier)bt.psychic={left:fx0.psychicBarrier.turns,dr:fx0.psychicBarrier.dr,healPct:fx0.psychicBarrier.healPct};
  if(fx0.sleepStrike){bt.sleepLeft[0]=fx0.sleepStrike.turns;bt.sleepArmed[0]=true;}
   if(fx0.entryFreeze&&!foeStatusImmune()){bt.eStun=fx0.entryFreeze.turns;bt.freezeLeft=fx0.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","FROZEN","crit"),bsMs(300));}
   if(fx0.heavyRain)bt.rain={left:fx0.heavyRain.turns,healPct:fx0.heavyRain.healPct};
   if(fx0.timeStop&&!foeStatusImmune()){bt.eStun=fx0.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
  if(fx0.dimensionShift){bt.eAbilityOff=fx0.dimensionShift.turns;setTimeout(()=>floatText(".fighter.foe","AMENOMINAKA","crit"),bsMs(300));}
bt.pGuardDr=(fx0&&fx0.puppetBody)?fx0.puppetBody.dr:((fx0&&fx0.autoBlock)?fx0.autoBlock.pct:0);
if(fx0.valhalla){bt.valhallaLeft=fx0.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(fx0.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(fx0.turret)bt.turret=fx0.turret.start;
bt.rubber=!!(fx0&&fx0.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(fx0.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(fx0.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(fx0.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:fx0.worldCorrupt.every,pct:fx0.worldCorrupt.pct,dmgUp:fx0.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  bt.fighters.forEach((f,i)=>{const x=resolveFx(f,efx);if(x.splitDeath)bt.splitLeft[i]=x.splitDeath.times;});
  applyFoeEntryPassives();
  schedPhase(700,step);
}
function applyFoeEntryPassives(){
  if(!bt||bt.over)return;
  const efx=bt.efx||{};
  if(bt.eAbilityOff>0)return;
  if(efx.burst){
    bt.es.hp=Math.round(bt.es.hp*efx.burst.mult);
    bt.eHp=bt.es.hp;
    setTimeout(()=>{if(bt&&!bt.over){setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);floatText(".fighter.foe","BURST +HP","heal");}},bsMs(300));
  }
  if(efx.transform){
    bt.es.hp=Math.round(bt.es.hp*efx.transform.mult);
    bt.eHp=bt.es.hp;
    setTimeout(()=>{if(bt&&!bt.over){setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);floatText(".fighter.foe","TRANSFORMATION","heal");}},bsMs(300));
  }
  if(efx.psychicBarrier){
    bt.ePsychic={left:efx.psychicBarrier.turns,dr:efx.psychicBarrier.dr,healPct:efx.psychicBarrier.healPct};
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","PSYCHIC BARRIER","heal");},bsMs(320));
  }
  if(efx.valhalla){
    bt.eValhallaLeft=efx.valhalla.turns;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","TWILIGHT OF VALHALLA","crit");},bsMs(360));
  }
  if(efx.rubberField){
    bt.eRubber=true;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","RUBBER FIELD","crit");},bsMs(360));
  }
  if(efx.entryFreeze){
    const pfx=resolveFx(bt.eq,efx);
    if(pfx&&pfx.statusImmune){
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","IMMUNE · FREEZE","heal");},bsMs(300));
    }else{
      bt.pStun=Math.max(bt.pStun||0,efx.entryFreeze.turns);bt.pFreeze=efx.entryFreeze.turns;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","FROZEN","crit");},bsMs(300));
    }
  }
  if(efx.dimensionShift){
    bt.pAbilityOff=efx.dimensionShift.turns;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","AMENOMINAKA","crit");},bsMs(300));
  }
  if(efx.heavyRain){
    bt.eRain={left:efx.heavyRain.turns,healPct:efx.heavyRain.healPct};
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","HEAVY RAIN","heal");},bsMs(320));
  }
  if(efx.meteorWave){
    const d=Math.min(Math.round(bt.pMax*0.25), Math.round(bt.es.hp*(efx.meteorWave.pct||15)/100));
    bt.pHp=Math.max(1,bt.pHp-d);
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","METEOR WAVE -"+fmt(d),"burn");}},bsMs(340));
  }
  if(efx.entryMaxHp){
    const d=Math.round(bt.pMax*(efx.entryMaxHp.pct||20)/100);
    bt.pHp=Math.max(1,bt.pHp-d);
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","BIO CORRUPTION -"+fmt(d),"burn");}},bsMs(340));
  }
  if(efx.havocRocket&&(bt.eHvUses||0)<(efx.havocRocket.maxUses||3)){
    bt.eHvUses=(bt.eHvUses||0)+1;
    bt.eHavocAnimTurn=true; /* sama seperti sisi player: roket menggantikan animasi basic */
    const rawD=Math.max(1,Math.round(bt.es.atk*(efx.havocRocket.pct||50)/100));
    const d=Math.min(Math.round(bt.pMax*0.25), rawD);
    bt.pHp=Math.max(1,bt.pHp-d);
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    if(window.havocRocketFx)havocRocketFx({fromSel:".fighter.foe",toSel:".fighter.me"});
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");shakeScreen(true);speedLines(true);sfx.crit();critBoom();floatText(".fighter.me","SUPER MEGA DEATH ROCKET -"+fmt(d)+" ("+bt.eHvUses+"/"+(efx.havocRocket.maxUses||3)+")","burn");}},bsMs(HR_T.first));
  }
  if(typeof foeEntryPassives==="function")foeEntryPassives();
}
function tagIn(){
  const prevFighter=bt.fighters[bt.active]||bt.eq||null;
  const next=bt.active+1;
  if(next>=bt.fighters.length)return false;
  const nextFighter=bt.fighters[next]||null;
  bt.active=next;bt.eq=bt.fighters[next];bt.justTagged=true;
  const base=bt.eq.sk?{hp:bt.eq.skHp,atk:bt.eq.skAtk}:cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
  bt.pMax=base.hp+(bt.snatchHp[next]||0);bt.pHp=bt.pMax;
  bt.burstStart[next]=bt.turn;
  bt.entryGuard[next]=false;bt.dodgeArmed[next]=false;bt.dodgeCount[next]=0;bt.execGuard[next]=false;bt.wtCount[next]=0;bt.shatterGuard[next]=false;bt.bioGuard[next]=false;
  let nfx=resolveFx(bt.eq,bt.efx);
  /* Shadow cuma bawa stat, bukan passive kartu asalnya. */
  if(bt.eq.sk)nfx={};
  if(nfx.burst){bt.pMax=Math.round(base.hp*nfx.burst.mult);bt.pHp=bt.pMax;}
  if(nfx.transform){bt.pMax=Math.round(base.hp*nfx.transform.mult);bt.pHp=bt.pMax;}
  /* SHADOW ARMY: HP hasil serapan Shadow yang tumbang nambah max HP King saat dia masuk lagi */
  if(nfx.shadowArmy&&bt.skAbsorb&&bt.skAbsorb.hp>0){bt.pMax+=bt.skAbsorb.hp;bt.pHp=bt.pMax;}
  if(nfx.entryCounter)bt.entryGuard[next]=true;
  if(nfx.executeOnEntry)bt.execGuard[next]=true;
  if(nfx.entryShatter)bt.shatterGuard[next]=true;
  if(nfx.entryMaxHp)bt.bioGuard[next]=true;
  if(nfx.meteorWave)bt.meteorGuard[next]=true;
  if(nfx.entryAtkPct)bt.atkEntryGuard[next]=true;
  if(nfx.havocRocket)bt.hvEntryGuard[next]=true;
  armShotFx(nfx,next);
  if(nfx.psychicBarrier)bt.psychic={left:nfx.psychicBarrier.turns,dr:nfx.psychicBarrier.dr,healPct:nfx.psychicBarrier.healPct};
  if(nfx.sleepStrike){bt.sleepLeft[next]=nfx.sleepStrike.turns;bt.sleepArmed[next]=true;}
   if(nfx.entryFreeze&&!foeStatusImmune()){bt.eStun=nfx.entryFreeze.turns;bt.freezeLeft=nfx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","FROZEN","crit"),bsMs(300));}
   if(nfx.heavyRain)bt.rain={left:nfx.heavyRain.turns,healPct:nfx.heavyRain.healPct};
   if(nfx.timeStop&&!foeStatusImmune()){bt.eStun=nfx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
bt.pGuardDr=(nfx&&nfx.puppetBody)?nfx.puppetBody.dr:((nfx&&nfx.autoBlock)?nfx.autoBlock.pct:0);
if(nfx.valhalla){bt.valhallaLeft=nfx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(nfx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(nfx.turret)bt.turret=nfx.turret.start;
bt.rubber=!!(nfx&&nfx.rubberField);if(bt.rubber)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","RUBBER FIELD","crit");},bsMs(520));
if(nfx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(nfx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(nfx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:nfx.worldCorrupt.every,pct:nfx.worldCorrupt.pct,dmgUp:nfx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
  // fase 1: kartu aktif sekarang tumbang
  const meEl=document.querySelector(".fighter.me");
  if(meEl){meEl.classList.remove("tag-enter");meEl.classList.add("ko");koFx(meEl);}
  floatText(".fighter.me","KO","crit");
  if(typeof window.hzAnimateDeathAndSwap==="function"){
    try{window.hzAnimateDeathAndSwap("me",prevFighter,nextFighter);}catch(e){}
  }
  // fase 2: kartu dek berikutnya naik masuk arena; rail bench diperbarui ke sisa setelahnya
  setTimeout(()=>{
    if(!bt||bt.over)return;
    const me2=document.querySelector(".fighter.me");
    if(me2){me2.classList.remove("ko");me2.style.opacity="1";}
    updateMeCard();
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    const rail=document.querySelector(".bench-rail");if(rail)rail.outerHTML=benchRailHtml(bt.fighters.slice(bt.active+1));
    const me3=document.querySelector(".fighter.me");
    if(me3){me3.classList.add("tag-enter");enterFx(me3);setTimeout(()=>me3.classList.remove("tag-enter"),650);}
    floatText(".fighter.me","TAG-IN!","tagin");
    if(typeof window.hzBattleSync==="function"){try{window.hzBattleSync();}catch(e){}}
  },bsMs(960));
  return true;
}
function trySave(){
  /* Guard cb basi: panggilan stale (timer lama / battle mati) atau HP masih penuh → jangan proses kematian */
  if(!bt||bt.over||bt.pHp>0)return true;
  /* BAYANGAN JATUH: yang mati cuma summoned shadow — Monarch balik utuh, bukan tag-in/kalah */
  if(bt.shadow){endPossession();return true;}
  const a=bt.active;
  /* SHADOW tumbang: stat-nya cuma stat (tanpa passive asli) & King menyerap absorbPct% stat-nya */
  if(bt.eq.sk){
    const deadChar=bt.eq.char;
    bt.eq.dead=true;
    const kf=skKingFx();
    if(kf){
      const ap=(kf.absorbPct!=null)?kf.absorbPct:35;
      const aa=Math.round(bt.eq.skAtk*ap/100),hh=Math.round(bt.eq.skHp*ap/100);
      bt.skAbsorb=bt.skAbsorb||{atk:0,hp:0};
      bt.skAbsorb.atk+=aa;bt.skAbsorb.hp+=hh;
      /* FX LEGION ABSORB: Shadow pecah -> serpihan ditarik ke tile King di rail belakang */
      const meEl=document.querySelector(".fighter.me");
      if(window.skfxAbsorb&&meEl)window.skfxAbsorb({meEl,toEl:skKingTile(),art:cardImg(deadChar),thumb:cardThumb(deadChar),atk:aa,hp:hh});
      else setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","LEGION ABSORB +"+fmt(aa)+" ATK +"+fmt(hh)+" HP","heal");},bsMs(320));
    }
  }
  const fx=bt.eq.sk?{}:resolveFx(bt.eq,bt.efx);
  /* SHADOW ARMY: kematian PERTAMA King -> tukar posisi dengan Shadow pertama (Shadow maju, King hidup
     penuh di barisan paling belakang). Kalau belum ada Shadow, mati normal. */
  if(fx.shadowArmy&&!bt.skSwapped){
    const sIdx=skFirstShadowIdx();
    if(sIdx>=0){
      /* Snapshot sebelum rotasi: tile Shadow (asal) + art King/Shadow buat FX terbang */
      const meEl=document.querySelector(".fighter.me");
      const railEl=skPlayerRail();
      const railSlots=railEl?[...railEl.querySelectorAll(".bench-sq")]:[];
      const fromEl=railSlots[sIdx-(bt.active+1)]||null;
      /* rect diambil SEKARANG: rail bakal di-render ulang dan elemen ini terlepas dari DOM */
      const fromRect=fromEl?(()=>{const r=fromEl.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2,bottom:r.bottom};})():null;
      const shadowChar=bt.fighters[sIdx].char;
      const kingChar=skKingChar();
      bt.skSwapped=true;bt.justTagged=true;
      const slot=bt.active;
      skRotateToRear(slot,sIdx);
      bt.eq=bt.fighters[slot];
      bt.pMax=bt.eq.skHp;bt.pHp=bt.pMax;bt.pGuardDr=0;
      updateMeCard();setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      const meEl2=document.querySelector(".fighter.me");
      if(meEl2){meEl2.classList.add("tag-enter");setTimeout(()=>{try{meEl2.classList.remove("tag-enter");}catch(e){}},650);}
      const rail=skPlayerRail();if(rail)rail.outerHTML=benchRailHtml(bt.fighters.slice(bt.active+1));
      /* FX SHADOW EXCHANGE: Shadow terbang ke arena, King ke tile paling belakang */
      if(window.skfxExchange&&meEl2)window.skfxExchange({meEl:meEl2,fromRect,kingTile:skKingTile(),
        kingArt:cardImg(kingChar),kingThumb:cardThumb(kingChar),shadowArt:cardImg(shadowChar),shadowThumb:cardThumb(shadowChar)});
      else setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SHADOW EXCHANGE","heal");},bsMs(300));
      return true;
    }
  }
  /* REGRESSION (Regressor): mati TAPI punya kill tersimpan → bangkit di hpPct% max HP, habisin 1 charge,
     & "skill di-refresh": semua flag sekali-per-battle/window kartu ini di-reset biar balik kayak baru */
  if(fx.regression&&(bt.regressCharges[a]||0)>0){
    bt.regressCharges[a]--;
    bt.pHp=Math.max(1,Math.round(bt.pMax*fx.regression.hpPct/100));
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;bt.weRevived=false;bt.pbRocks=0;bt.pbKey="";bt.pbStreak=0;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;bt.shockCount[a]=0;
    if(fx.entryCounter)bt.entryGuard[a]=true;
    if(fx.executeOnEntry)bt.execGuard[a]=true;
    if(fx.entryShatter)bt.shatterGuard[a]=true;
    if(fx.entryMaxHp)bt.bioGuard[a]=true;
    if(fx.meteorWave)bt.meteorGuard[a]=true;
    if(fx.entryAtkPct)bt.atkEntryGuard[a]=true;
    armShotFx(fx,a);
    if(fx.psychicBarrier)bt.psychic={left:fx.psychicBarrier.turns,dr:fx.psychicBarrier.dr,healPct:fx.psychicBarrier.healPct};
    if(fx.sleepStrike){bt.sleepLeft[a]=fx.sleepStrike.turns;bt.sleepArmed[a]=true;}
     if(fx.entryFreeze&&!foeStatusImmune()){bt.eStun=fx.entryFreeze.turns;bt.freezeLeft=fx.entryFreeze.turns;setTimeout(()=>floatText(".fighter.foe","FROZEN","crit"),bsMs(300));}
     if(fx.heavyRain)bt.rain={left:fx.heavyRain.turns,healPct:fx.heavyRain.healPct};
     if(fx.timeStop&&!foeStatusImmune()){bt.eStun=fx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(300));}
bt.pGuardDr=(fx&&fx.puppetBody)?fx.puppetBody.dr:((fx&&fx.autoBlock)?fx.autoBlock.pct:0);
if(fx.valhalla){bt.valhallaLeft=fx.valhalla.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT OF VALHALLA","crit");},bsMs(360));}
if(fx.senzu){const _szb=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);bt.senzu={baseAtk:_szb.atk,baseHp:bt.pMax,atkSum:0,hpSum:0,turn:0};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MUNCH MUNCH!","heal");},bsMs(420));}
if(fx.turret)bt.turret=fx.turret.start;
bt.rubber=!!(fx&&fx.rubberField);
if(fx.stretch){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOMU GOMU... WAIT WHAT?!","crit");},bsMs(520));}
if(fx.dupEntry){bt.pMax=Math.round(bt.pMax*2);bt.pHp=bt.pMax;bt.atkBuff[bt.active]+=100;setTimeout(()=>{if(bt&&!bt.over){setBar("hpMe","hpMeT",bt.pHp,bt.pMax);floatText(".fighter.me","DATA DUPLICATED x2","crit");}},bsMs(420));}
if(fx.worldCorrupt){bt.wc={c:0,atk:Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk),every:fx.worldCorrupt.every,pct:fx.worldCorrupt.pct,dmgUp:fx.worldCorrupt.dmgUp};setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","ABILITY CORRUPTED","crit");},bsMs(520));}
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGRESSION","heal");},bsMs(400));
    return true;
  }
  /* SPLIT DEATH (BIOKINESIS): mati TAPI charge terbelah masih ada -> badan baru pct% stat (kumulatif),
     HP penuh di max baru, ATK menyusut via bt.splitMult. Flag sekali-per-battle di-refresh kayak regression,
     TAPI efek "on entry" TIDAK re-arm (biar entry damage gak triple-dip tiap split). */
  if(fx.splitDeath&&(bt.splitLeft[a]||0)>0){
    bt.splitLeft[a]--;
    bt.splitMult[a]=(bt.splitMult[a]||1)*fx.splitDeath.pct/100;
    bt.pMax=Math.max(1,Math.round(bt.pMax*fx.splitDeath.pct/100));
    bt.pHp=bt.pMax;
    bt.revUsed[a]=false;bt.standUsed[a]=false;bt.burstStart[a]=bt.turn;bt.weRevived=false;bt.pbRocks=0;bt.pbKey="";bt.pbStreak=0;
    bt.dodgeCount[a]=0;bt.dodgeArmed[a]=false;bt.atkCount[a]=0;bt.wtCount[a]=0;bt.shockCount[a]=0;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SPLIT!","heal");},bsMs(400));
    return true;
  }
  /* V-DRIVE RESONANCE (TIME TRICKSTER): mati -> bangkit pct% max HP (sekali) + damage musuh sejumlah heal itu + stun */
  if(fx.rewind&&!bt.revUsed[a]){
    bt.revUsed[a]=true;
    const rh=Math.max(1,Math.round(bt.pMax*fx.rewind.pct/100));
    bt.pHp=Math.min(bt.pMax,rh);
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    if(bt.eHp>0){
      bt.eHp-=rh;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","REWIND -"+fmt(rh),"crit");}},bsMs(420));
    }
    if(fx.rewind.stun&&!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.rewind.stun);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","REWOUND!","crit");},bsMs(560));}
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","V-DRIVE RESONANCE +"+fmt(rh),"heal");},bsMs(300));
    return true;
    }
  /* THE WORLD ENDER (DARKIN LORD): kematian PERTAMA -> revive penuh + DR 40% permanen + heal bonus */
  if(fx.worldEnder&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=bt.pMax;bt.weRevived=true;
    bt.pDr=Math.max(bt.pDr||0,fx.worldEnder.revive.dr);bt.pDrTurns=9999;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    if(window.worldEnderReviveFx)worldEnderReviveFx(".fighter.me");
    setTimeout(()=>floatText(".fighter.me","THE WORLD ENDER","crit"),bsMs(400));
    return true;
  }
  /* PSYCHIC OVERLOAD (PSYCHIC ESPER): kematian PERTAMA -> full HP + 10 batu per serangan */
  if(fx.psychicBarrage&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=bt.pMax;bt.pbRocks=fx.psychicBarrage.reviveRocks;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>floatText(".fighter.me","PSYCHIC OVERLOAD","crit"),bsMs(400));
    return true;
  }
  if(fx.revive&&!bt.revUsed[a]){
    bt.revUsed[a]=true;bt.pHp=(fx.revive.pct!=null)?Math.max(1,Math.round(bt.pMax*fx.revive.pct/100)):bt.pMax;if(fx.revive.atkPct)bt.atkBuff[a]+=fx.revive.atkPct;
    if(fx.revive.lock){bt.eAbilityOff=Math.max(bt.eAbilityOff||0,fx.revive.lock);setTimeout(()=>floatText(".fighter.foe","ALTER THE FUTURE","crit"),bsMs(600));}
    setTimeout(()=>floatText(".fighter.me","REVIVE!","heal"),bsMs(400));
    if(fx.revive.stun&&!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.revive.stun);setTimeout(()=>floatText(".fighter.foe","INK DEMON STUN","crit"),bsMs(520));}
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    return true;
  }
  /* LAST STAND: fatal pertama ditahan di 1 HP (bukan bangkit penuh) + langsung dapat bonus ATK */
  if(fx.lastStand&&!bt.standUsed[a]){
    bt.standUsed[a]=true;bt.pHp=1;bt.atkBuff[a]+=fx.lastStand.pct;
    setTimeout(()=>floatText(".fighter.me","1% AWAKENED","crit"),bsMs(400));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    return true;
  }
  /* PRIDE OF THE PRINCE: kartu party ini beneran jatuh (revive/lastStand gak nolong) → semua Royal Vanguard di party +pct% ATK permanen (stack di atkBuff, kepakai pas dia masuk/aktif) */
  for(let i=0;i<bt.fighters.length;i++){const pfx=resolveFx(bt.fighters[i],bt.efx);if(pfx.prideOfPrince)bt.atkBuff[i]=(bt.atkBuff[i]||0)+pfx.prideOfPrince.pct;}
  /* RUMBLING: kartu ini beneran tumbang (revive/lastStand gak nolong) → nyalain DoT post-mortem */
  if(fx.rumbling){bt.rumbling=fx.rumbling.turns;bt.rumblingPct=fx.rumbling.pct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","THE RUMBLING","burn");},bsMs(600));}
  /* DEATH HEX (ICE REAPER): beneran tumbang -> freeze turns + ePoison atkCut */
  if(fx.deathHex){
    if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.deathHex.turns);bt.freezeLeft=Math.max(bt.freezeLeft||0,fx.deathHex.turns);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","HAKKA NO TOGAME · FROZEN","crit");},bsMs(520));}
    bt.ePoison=Math.min(90,(bt.ePoison||0)+fx.deathHex.atkCut);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","-"+fx.deathHex.atkCut+"% ATK PERMANEN","burn");},bsMs(640));
  }
  /* DEATH REAR (THE GRIEFER): mati PERTAMA kali -> remove dari rotasi sekarang, nunggu balik di belakang party */
  if(fx.deathRear&&!bt.rearUsed[a]){
    bt.rearUsed[a]=true;bt.rearIdx=a;bt.rearWaiting=true;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REMOVED FROM LINE","miss");},bsMs(400));
  }
  if(a+1<bt.fighters.length){tagIn();return true;}
  /* LAST CARD MATI tapi Rumbling masih jalan → jangan langsung kalah; masuk mode aftermath (DoT tick doang) */
  if(bt.rumbling>0){bt.aftermath=true;return true;}
  /* REAR RETURN (THE GRIEFER): rantai party habis -> balik sebagai kartu terakhir dgn hpPct% HP */
  if(bt.rearWaiting&&bt.rearIdx>=0){
    const ri=bt.rearIdx;bt.rearWaiting=false;
    const rfx=resolveFx(bt.fighters[ri],bt.efx);
    bt.active=ri;bt.eq=bt.fighters[ri];bt.justTagged=true;
    const rbase=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
    bt.pMax=rbase.hp+(bt.snatchHp[ri]||0);
    bt.pHp=Math.max(1,Math.round(bt.pMax*((((rfx.deathRear||{}).hpPct)||50)/100)));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","WORLD REWIND!","heal");},bsMs(400));
    return true;
  }
  return false;
}
function setBar(id,tid,cur,max){
  const b=document.getElementById(id);if(!b)return;
  /* Akumulasi damage pemain untuk MVP di popup hasil (prototipe). */
  if(id==="hpFoe"&&bt&&!bt.over){
    const prev=typeof bt._lastFoeHp==="number"?bt._lastFoeHp:max;
    if(prev>cur)bt.dmgDone=(bt.dmgDone||0)+(prev-cur);
    bt._lastFoeHp=cur;
  }
  const pct=Math.max(0,Math.min(100,cur/max*100))+"%";
  b.style.width=pct;
  const tr=b.parentElement?b.parentElement.querySelector(".hp-trail"):null;
  if(tr)tr.style.width=pct;
  /* label di dalam bar: "cur / max" (prototipe) + inline HP di kartu */
  const t=tid?document.getElementById(tid):null;
  if(t)t.textContent=fmtBattleK(Math.max(0,cur))+" / "+fmtBattleK(Math.max(0,max));
  if(id==="hpMe"){
    const ih=document.getElementById("meInlineHp");
    if(ih)ih.textContent=fmtBattleK(Math.max(0,cur));
  }else if(id==="hpFoe"||id==="hpRaid"){
    const ih=document.getElementById("foeInlineHp");
    if(ih)ih.textContent=fmtBattleK(Math.max(0,cur));
  }
  if(typeof window.hzBattleSync==="function"){try{window.hzBattleSync();}catch(e){}}
}
function step(){ if(!bt||bt.over)return; schedPhase(0,playerPhase); }
// Safe scheduler: guarantees the battle can never hang. If a phase throws,
// the chain is broken (no next timer) — so we force an end instead of freezing.
function schedPhase(ms,fn){
  if(!bt)return;
  clearTimeout(bt.timer);/* timer basi dibatalkan: schedule terakhir menang — cegah rantai giliran dobel */
  bt.timer=setTimeout(()=>{
    bt.timer=null;
    try{ fn(); }
    catch(err){
      console.error("battle phase error",err);
      if(bt&&!bt.over){ bt.timer=null; endBattle(bt.eHp<=0); }
    }
  },bsMs(ms));
}
/* ===== Renderer serangan SATU untuk semua kartu: user & musuh tinggal tukar sisi (A=penyerang, D=target) ===== */
let _hzAtkAnimMe=null,_hzAtkAnimFoe=null,_hzRecAnimMe=null,_hzRecAnimFoe=null,_hzHitTimer=null;
function triggerStageShake(){
  const g=document.getElementById("hzArena")||document.querySelector(".battle-grid");
  if(!g)return;
  g.classList.remove("shake");
  void g.offsetWidth;
  g.classList.add("shake");
  setTimeout(()=>g.classList.remove("shake"),340);
}
function attackLunge(sel,wind){
  const atkEl=typeof sel==="string"?document.querySelector(sel):sel;
  if(!atkEl)return;
  const isMe=atkEl.classList.contains("me");
  const defEl=document.querySelector(isMe?".fighter.foe":".fighter.me");
  if(!defEl)return;
  const atkCol=atkEl.closest(".me-col")||atkEl.parentElement;
  const defCol=defEl.closest(".me-col")||defEl.parentElement;

  /* Cancel any in-flight WAAPI animations so getBoundingClientRect() measures true resting positions */
  try{
    if(_hzAtkAnimMe){_hzAtkAnimMe.cancel();_hzAtkAnimMe=null;}
    if(_hzAtkAnimFoe){_hzAtkAnimFoe.cancel();_hzAtkAnimFoe=null;}
    if(_hzRecAnimMe){_hzRecAnimMe.cancel();_hzRecAnimMe=null;}
    if(_hzRecAnimFoe){_hzRecAnimFoe.cancel();_hzRecAnimFoe=null;}
    if(typeof atkEl.getAnimations==="function")atkEl.getAnimations().forEach(a=>a.cancel());
    if(typeof defEl.getAnimations==="function")defEl.getAnimations().forEach(a=>a.cancel());
  }catch(e){}
  if(_hzHitTimer){clearTimeout(_hzHitTimer);_hzHitTimer=null;}

  const atkCard=atkEl.querySelector(".card-shell")||atkEl;
  const defCard=defEl.querySelector(".card-shell")||defEl;
  const fromR=atkCard.getBoundingClientRect();
  const toR=defCard.getBoundingClientRect();
  if(!fromR.width||!toR.width)return;
  const fromCx=fromR.left+fromR.width/2, fromCy=fromR.top+fromR.height/2;
  const toCx=toR.left+toR.width/2, toCy=toR.top+toR.height/2;
  const dx=(toCx-fromCx)*0.58;
  const dy=(toCy-fromCy)*0.58;
  const windX=-dx*0.16, windY=-dy*0.16;
  const tiltWind=isMe?-5:5;
  const tiltStrike=isMe?9:-9;
  const totalMs=Math.max(260,Math.round(bsMs(620)));
  const hitMs=Math.round(totalMs*0.44);

  if(atkCol)atkCol.style.zIndex="28";
  if(defCol)defCol.style.zIndex="15";
  atkEl.style.zIndex="28";
  defEl.style.zIndex="15";

  const resetZ=()=>{
    if(atkCol)atkCol.style.zIndex="";
    if(defCol)defCol.style.zIndex="";
    atkEl.style.zIndex="";
    defEl.style.zIndex="";
  };

  if(typeof atkEl.animate==="function"){
    const animRef=atkEl.animate([
      {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:0,easing:"cubic-bezier(0.32, 0, 0.67, 0)"},
      {transform:`translate3d(${windX.toFixed(1)}px,${windY.toFixed(1)}px,0) scale(0.95) rotate(${tiltWind}deg)`,offset:0.22,easing:"cubic-bezier(0.16, 1, 0.3, 1)"},
      {transform:`translate3d(${dx.toFixed(1)}px,${dy.toFixed(1)}px,0) scale(1.08) rotate(${tiltStrike}deg)`,offset:0.44,easing:"cubic-bezier(0.22, 1, 0.36, 1)"},
      {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:1}
    ],{duration:totalMs,fill:"none"});
    if(isMe)_hzAtkAnimMe=animRef;else _hzAtkAnimFoe=animRef;
    if(animRef&&animRef.finished){
      animRef.finished.then(resetZ).catch(resetZ);
    }else{
      setTimeout(resetZ,totalMs+40);
    }
  }else{
    setTimeout(resetZ,totalMs+40);
  }

  _hzHitTimer=setTimeout(()=>{
    _hzHitTimer=null;
    const curAtkEl=document.querySelector(isMe?".fighter.me":".fighter.foe");
    const curDefEl=document.querySelector(isMe?".fighter.foe":".fighter.me");
    const curDefCard=curDefEl?(curDefEl.querySelector(".card-shell")||curDefEl):null;
    const liveToR=curDefCard?curDefCard.getBoundingClientRect():toR;
    if(typeof window.fxImpactSlash==="function"){
      try{window.fxImpactSlash(fromR,liveToR.width?liveToR:toR,isMe);}catch(e){}
    }
    triggerStageShake();
    const recoilX=(toCx-fromCx)>0?18:-18;
    const recoilY=(toCy-fromCy)>0?-12:12;
    const recoilRot=isMe?5:-5;
    if(curDefEl&&typeof curDefEl.animate==="function"){
      try{curDefEl.getAnimations().forEach(a=>a.cancel());}catch(e){}
      const recRef=curDefEl.animate([
        {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:0},
        {transform:`translate3d(${recoilX}px,${recoilY}px,0) scale(0.94) rotate(${recoilRot}deg)`,offset:0.26},
        {transform:`translate3d(${(-recoilX*0.35).toFixed(1)}px,${(-recoilY*0.35).toFixed(1)}px,0) scale(1.02) rotate(${(-recoilRot*0.3).toFixed(1)}deg)`,offset:0.62},
        {transform:"translate3d(0,0,0) scale(1) rotate(0deg)",offset:1}
      ],{duration:Math.max(160,Math.round(bsMs(380))),easing:"cubic-bezier(0.22, 1, 0.36, 1)",fill:"none"});
      if(isMe)_hzRecAnimFoe=recRef;else _hzRecAnimMe=recRef;
    }
  },hitMs);
}
function shakeScreen(big){triggerStageShake();}
function hitStop(ms){}
function speedLines(big){}
function enterFx(el){
  if(!el)return;
  const r=el.getBoundingClientRect();
  if(r.width&&typeof window.fxDeployBurst==="function"){
    try{window.fxDeployBurst(r,!el.classList.contains("foe"));}catch(e){}
  }
}
function koFx(el){}
function performAttack(o){
  const A=o.A,D=o.D,id=o.id,shots=o.shots;
  const md=o.ranton&&id==="CH_EX_MADARA";
  const galaxy=!!o.galaxy;
  const psy=!!o.psychic;
  const hstep=psy?PSY_T.step:o.domainStrike?80:160;
  /* Exact hit moment of attackLunge (620ms * 0.44 = 273ms) */
  const hitDelay=273;

  const startHp=Math.max(0,Math.min(o.defMax,o.defHpStart));
  const endHp=Math.max(0,o.defHpEnd);
  const span=Math.max(0,startHp-endHp);
  const hpAt=(cum)=>o.total>0?Math.max(endHp,Math.round(startHp-span*Math.min(1,cum/o.total))):endHp;
  attackLunge(A,true);
  if(!bt)return;
  const self=(o.domainStrike?o.fx.domain:o.ariseMode?o.fx.barrage:null);
  if(self&&self.selfStun&&o.recharge)setTimeout(()=>{if(bt&&o.recharge)o.recharge(self);},bsMs(180));
  const susStart=(o.ranton&&id==="CH_EX_MADARA"&&!bt.over)?MADARA_T.slash:hitDelay;
  const dlyAt=i=> galaxy ? hitDelay : md ? (susStart+i*MADARA_T.step) : (susStart+i*hstep);
  let cum=0,barEnd=hitDelay;
  shots.forEach((s,i)=>{
    if(s.evade||s.miss){setTimeout(()=>floatText(D,s.evade?"DODGE":"MISS","miss"),bsMs(hitDelay));return;}
    if(s.void){setTimeout(()=>floatText(D,"VOID","miss"),bsMs(hitDelay));return;}
    const ft=dlyAt(i);
    if(i>0){
      setTimeout(()=>{
        if(bt&&!bt.over&&typeof window.playAnimeArchetypeAttack==="function"){
          try{window.playAnimeArchetypeAttack(id,A,D);}catch(e){}
        }
      },bsMs(ft));
    }
    cum+=s.d;barEnd=Math.max(barEnd,ft);const stepHp=hpAt(cum);
    setTimeout(()=>floatText(D,"-"+fmt(s.d),(o.crit&&i===shots.length-1)?"crit":""),bsMs(ft));
    setTimeout(()=>setBar(o.barId,o.barTid,stepHp,o.defMax),bsMs(ft));
    if(s.pierce)setTimeout(()=>floatText(D,"PIERCE","crit"),bsMs(ft+60));
  });
  /* Wait until the attacker card finishes returning to rest (620ms) before triggering death / next step */
  const finishWait=Math.max(660,barEnd+380);
  setTimeout(()=>{
    try{
      if(bt&&!bt.over)setBar(o.barId,o.barTid,endHp,o.defMax);
      if(bt&&o.onAnimEnd)o.onAnimEnd();
    }catch(err){
      console.error("onAnimEnd error",err);
      if(bt&&!bt.over){ try{ bt.timer=null; endBattle(bt.eHp<=0); }catch(e2){ console.error("force endBattle error",e2); } }
    }
  },bsMs(finishWait));
  if(o.barrageN>1)setTimeout(()=>floatText(D,(o.iceBlast?"ICE BLAST ×":o.domainStrike?"UNLIMITED VOID ×":o.ariseMode?"ARISE ×":md?"TENSA ×":"CLEAVE ×")+o.barrageN,"crit"),bsMs(md?MADARA_T.slash:hitDelay+60));
  else if(shots.length>1&&!o.ranton)setTimeout(()=>floatText(D,"DOUBLE!","crit"),bsMs(hitDelay+60));
}
function setTurnPill(side,label){
  const col=document.querySelector(".vs-col");if(!col)return;
  const t=col.querySelector(".t");if(!t)return;
  col.classList.toggle("foe",side==="foe");
  t.textContent=label;
}
function playerPhase(){
  if(!bt||bt.over)return;
  bt.curPhase="player";
  bt.foeDowning=false;/* kill berikutnya baru sah setelah giliran ini mulai */
  if(bt.turn>300){ endBattle(bt.eHp<=bt.pHp); return; }
  /* AFTERMATH: kartu terakhir udah mati, Rumbling doang yang jalan — bisa nyulik menang, abis itu kalah */
  if(bt.aftermath){
    if(bt.rumbling>0&&foeStatusImmune()){bt.rumbling=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · RUMBLING","heal"),bsMs(160));}
    if(bt.rumbling>0){
      const rd=Math.round(bt.es.hp*(bt.rumblingPct||10)/100);
      bt.eHp-=rd;bt.rumbling--;
      setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUMBLING -"+fmt(rd),"burn");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
      bt.turn++;schedPhase(1000,playerPhase);return;
    }
    endBattle(false);return;
  }
  /* SHADOW MONARCH: bayangan megang slot — tiap giliran dihitung mundur, habis → Monarch balik */
  if(bt.shadow){ if(bt.shadow.turnsLeft<=0){ endPossession(); } else { bt.shadow.turnsLeft--; } }
  bt.justTagged=false;
  bt.trickNext=false;bt.royalNow=false;bt.gunsNow=false;
  const id=bt.eq.char,t=bt.turn;let fx=resolveFx(bt.eq,bt.efx);
  if(bt.shadow)fx={};
  if(bt.eq.sk)fx={};
  /* UNLIMITED VOID (BLESSED SORCERER): HP < below% max -> set ke healPct% + stun musuh turns, sekali per battle */
  if(fx.unlimitedVoid&&!bt.voidUsed&&bt.pHp<bt.pMax*fx.unlimitedVoid.below/100){
    bt.voidUsed=true;
    bt.pHp=Math.max(bt.pHp,Math.round(bt.pMax*fx.unlimitedVoid.healPct/100));
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","UNLIMITED VOID","heal");},bsMs(220));
    if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE Â· VOID","heal"),bsMs(460));}
    else{bt.eStun+=fx.unlimitedVoid.turns;setTimeout(()=>floatText(".fighter.foe","UNLIMITED VOID","crit"),bsMs(460));}
  }
  document.getElementById("turnLabel").innerHTML=(bt.tower&&towerRun)?("FLOOR <b>"+towerRun.floor+"</b> &middot; WAVE <b>"+(towerRun.idx+1)+"/"+towerRun.waves.length+"</b>"):("TURN <b>"+t+"</b>");
  setTurnPill("you","YOUR TURN");
  /* EVOLUTION TURRET (YORDLE INVENTOR): tiap `every` giliran -> +1 turret */
  if(fx.turret&&bt.turn%fx.turret.every===0){bt.turret++;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TURRET +1 ("+bt.turret+")","heal");},bsMs(320));}
  /* RUMBLING: DoT sisa dari kartu yang udah mati — jalan tiap giliran walau kartu udah ganti */
  if(bt.rumbling>0&&foeStatusImmune()){bt.rumbling=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · RUMBLING","heal"),bsMs(160));}
  if(bt.rumbling>0){
    const rd=Math.round(bt.es.hp*(bt.rumblingPct||10)/100);
    bt.eHp-=rd;bt.rumbling--;
    setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUMBLING -"+fmt(rd),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  /* HEAVY RAIN (OCEAN'S GUARDIAN): selama hujan aktif, kartu ini pulih `healPct`% max HP tiap giliran — jalan walau kena stun (spt turnMaxHp); hujan habis setelah `left` giliran */
  if(bt.rain&&bt.rain.left>0){
    const rh=Math.max(1,Math.round(bt.pMax*bt.rain.healPct/100));
    bt.pHp=Math.min(bt.pMax,bt.pHp+rh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","HUJAN +"+fmt(rh),"heal");},bsMs(260));
    bt.rain.left--;
  }
  /* rotasi snapshot HP buat CAUSALITY (ASTRAL DEVOURER): pHp awal giliran ini jadi hp pembanding giliran berikutnya */
  bt.causalPrev=(bt.causalNow==null)?bt.pHp:bt.causalNow;bt.causalNow=bt.pHp;
  /* STAT GROW (SOLAR BRAWLER / ANT KING): semua stat naik pct% compound per giliran */
  if(fx.statGrow&&bt.pHp>0){const sgd=Math.round(bt.pMax*fx.statGrow.pct/100);bt.pMax+=sgd;bt.pHp+=sgd;bt.atkBuff[bt.active]+=fx.statGrow.pct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","STATS +"+fx.statGrow.pct+"%","heal");},bsMs(300));}
  /* REGEN (BLOODMOON DEMON): pulih pct% max HP tiap giliran, jalan walau kena stun; berhenti di bawah stopBelow% max HP */
  if(fx.regen&&bt.pHp>0&&!(fx.regen.stopBelow!=null&&bt.pHp<bt.pMax*fx.regen.stopBelow/100)){const rh2=Math.max(1,Math.round(bt.pMax*fx.regen.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+rh2);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","REGEN +"+fmt(rh2),"heal");},bsMs(260));}
  /* METEOR PERIODIC (CRIMSON WARLORD): tiap `every` giliran sejak masuk -> aoe pct% max HP musuh (boss kebal) */
  if(fx.meteorShower&&bt.pHp>0&&bt.eHp>0){bt.msLast=bt.msLast||new Array(bt.fighters.length).fill(-99);if(bt.msLast[bt.active]==null||bt.msLast[bt.active]<-90)bt.msLast[bt.active]=bt.turn;if(bt.turn-bt.msLast[bt.active]>=fx.meteorShower.every){aoeMaxHpFire(fx.meteorShower.pct,"NEXT METEOR",true);bt.msLast[bt.active]=bt.turn;}}
  /* TURN MAX HP (BIOKINESIS): tiap giliran kartu ini aktif & hidup, kartu aktif musuh rugi pct% MAX HP (flat).
     Ditaruh SEBELUM cek stun biar aura tetap nyala walau kartu kena stun. Boss NPC kebal. */
  if(fx.turnMaxHp&&!bt.en.boss&&!foeStatusImmune()&&bt.eHp>0){
    const td=Math.max(1,Math.round(bt.es.hp*fx.turnMaxHp.pct/100));
    bt.eHp-=td;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BIOKINESIS -"+fmt(td),"burn");}},bsMs(200));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
  }
  if((bt.pFreeze||0)>0)bt.pFreeze--;
  if(bt.pStun>0){
    if(fx.statusImmune){
      /* STATUS IMMUNE: stun DIBATALKAN — giliran tetap jalan */
      bt.pStun=0;
      setTimeout(()=>floatText(".fighter.me","IMMUNE · STUN","heal"),bsMs(200));
    }else{
      bt.pStun--;
      const lbl=(bt.pDrTurns>0&&bt.pDr)?"STUN · DR "+bt.pDr+"%":"STUN";
      setTimeout(()=>floatText(".fighter.me",lbl,"crit"),bsMs(200));
      schedPhase(600,enemyPhase);
      return;
    }
  }
  const efx=bt.efx||{};
  const a=bt.active;
  /* SLEEP STRIKE (THUNDER PRODIGY): tidur N giliran sejak masuk — serangan dilewati;
     begitu hitung tidur habis, serangan berikutnya di-arm ×mult (lihat blok dmgMult) */
  if(fx.sleepStrike&&(bt.sleepLeft[a]||0)>0){
    bt.sleepLeft[a]--;
    if(bt.sleepLeft[a]===0){bt.sleepArmed[a]=true;setTimeout(()=>floatText(".fighter.me","AWAKE!","heal"),bsMs(200));}
    else setTimeout(()=>floatText(".fighter.me","ASLEEP","miss"),bsMs(200));
    schedPhase(600,enemyPhase);
    return;
  }
    /* SERIOUS PUNCH (BALD KING): charge giliran tanpa menyerang -> giliran ke-charge arm pukulan -> cd giliran */
  if(fx.seriousPunch){
    if((bt.spCd[a]||0)>0){bt.spCd[a]=(bt.spCd[a]||0)-1;if(bt.spCd[a]>0)setTimeout(()=>floatText(".fighter.me","SERIOUS PUNCH Â· CD "+bt.spCd[a],"miss"),bsMs(200));schedPhase(600,enemyPhase);return;}
    bt.spTurn[a]=(bt.spTurn[a]||0)+1;
    if(bt.spTurn[a]<fx.seriousPunch.charge){setTimeout(()=>floatText(".fighter.me","CHARGING... "+bt.spTurn[a]+"/"+fx.seriousPunch.charge,"miss"),bsMs(200));schedPhase(600,enemyPhase);return;}
    bt.spTurn[a]=0;bt.spCd[a]=fx.seriousPunch.cd;bt.spArmed[a]=true;
  }
  /* DESPERATE STRIKE: di bawah below% HP -> serangan berikutnya ×mult, sesudahnya tewas di akhir giliran */
  if(fx.desperateStrike&&bt.dsState[a]===0&&bt.pHp>0&&bt.pHp<bt.pMax*fx.desperateStrike.below/100)bt.dsState[a]=1;
  /* DODGE EVERY: setiap N giliran sejak masuk, pasti hindari serangan musuh giliran ini */
  if(fx.dodgeEvery){bt.dodgeCount[a]=(bt.dodgeCount[a]||0)+1;if(bt.dodgeCount[a]%fx.dodgeEvery.turns===0)bt.dodgeArmed[a]=true;}
  /* EXECUTE ON ENTRY (SUPERNOVA): on entry, kalau HP musuh < pct% HP kartu ini, hancurkan instan */
  /* ERASE (OMNI SOVEREIGN): entry -> total stat musuh < milik kartu ini -> hapus (pola executeOnEntry) */
  if(fx.eraseOnEntry&&bt.eraseGuard&&bt.eraseGuard[a]){
    bt.eraseGuard[a]=false;
    const ownS=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny);
    if(bt.eHp>0&&(bt.es.hp+bt.es.atk)<(ownS.hp+ownS.atk)){
      bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
      setTimeout(()=>{anim(".fighter.foe","ko");floatText(".fighter.foe","ERASE EXISTENCE","crit");},bsMs(200));
      setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
      return;
    }
  }
  if(fx.executeOnEntry&&bt.execGuard[a]){
    bt.execGuard[a]=false;
    const thr=Math.round(cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).hp*fx.executeOnEntry.pct/100);
    if(bt.eHp>0&&bt.eHp<thr){
      bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
      setTimeout(()=>{anim(".fighter.foe","ko");floatText(".fighter.foe","SUPERNOVA","crit");},bsMs(200));
      setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
      return;
    }
  }
    /* METEORIC BURST (METEOR CONQUEROR): on entry, ledakan meteror -> damage FLAT pct% MAX HP kartu ini ke musuh aktif (bypass evasion/void), sekali per masuk */
  if(fx.meteorWave&&bt.meteorGuard[a]){
    bt.meteorGuard[a]=false;
    if(bt.eHp>0){
      const md=Math.max(1,Math.round(bt.pMax*fx.meteorWave.pct/100));
      bt.eHp-=md;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","METEORIC BURST -"+fmt(md),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* ENTRY SHATTER (ALMIGHTY PUSH): on entry, ledakan memecah -> damage flat sebesar pct% dari total HP musuh saat ini (bypass evasion/void, spt wallTitans) */
  if(fx.entryShatter&&bt.shatterGuard[a]){
    bt.shatterGuard[a]=false;
    if(bt.eHp>0){
      const sd=Math.max(1,Math.round(bt.eHp*fx.entryShatter.pct/100));
      bt.eHp-=sd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","ALMIGHTY PUSH -"+fmt(sd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* PAPER STORM (PAPER PAL): on entry, serpihan kertas memberikan damage FLAT sebesar pct% dari ATK kartu ini ke kartu aktif musuh (bypass evasion/void spt entryShatter). Sekali per masuk. */
  if(fx.entryAtkPct&&bt.atkEntryGuard[a]){
    bt.atkEntryGuard[a]=false;
    if(bt.eHp>0){
      const ownAtk=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
      const pd=Math.max(1,Math.round(ownAtk*fx.entryAtkPct.pct/100));
      bt.eHp-=pd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe",passiveName(id)+" -"+fmt(pd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* ENTRY MAX HP (BIOKINESIS): on entry, kartu aktif musuh rugi pct% MAX HP sebagai damage flat (bypass evasion/void).
     Boss NPC kebal. Guard sekali-per-masuk persis pola entryShatter. */
  if(fx.entryMaxHp&&bt.bioGuard[a]){
    bt.bioGuard[a]=false;
    if(bt.eHp>0&&!bt.en.boss&&!foeStatusImmune()){
      const bd=Math.max(1,Math.round(bt.es.hp*fx.entryMaxHp.pct/100));
      bt.eHp-=bd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BIOKINESIS -"+fmt(bd),"crit");}},bsMs(200));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* SUPER MEGA DEATH ROCKET (HAVOC WREACKER): setiap masuk aktif langsung luncurkan roket, maks 3x per battle */
  if(fx.havocRocket&&bt.hvEntryGuard[a]&&(bt.hvUses[a]||0)<(fx.havocRocket.maxUses||3)){
    bt.hvEntryGuard[a]=false;
    bt.hvUses[a]=(bt.hvUses[a]||0)+1;
    bt.havocAnimTurn=true; /* roket = ult ronde ini → basic archetype di-skip supaya tidak dobel */
    if(bt.eHp>0){
      const ownAtk=cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
      const rk=Math.max(1,Math.round(ownAtk*(fx.havocRocket.pct||50)/100));
      bt.eHp-=rk;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);
      if(window.havocRocketFx)havocRocketFx({fromSel:".fighter.me",toSel:".fighter.foe"});
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");shakeScreen(true);speedLines(true);sfx.crit();critBoom();floatText(".fighter.foe","SUPER MEGA DEATH ROCKET -"+fmt(rk)+" ("+bt.hvUses[a]+"/"+(fx.havocRocket.maxUses||3)+")","crit");}},bsMs(HR_T.first));
      lineupAoeHit(rk);
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));return;}
    }
  }
  /* LIFETIME: kartu self-destruct setelah N giliran sejak masuk arena */
  if(fx.lifetime&&(t-(bt.burstStart[a]||1))>=fx.lifetime.turns){
    bt.pHp=0;setBar("hpMe","hpMeT",0,bt.pMax);
    setTimeout(()=>{anim(".fighter.me","ko");floatText(".fighter.me","LIFETIME UP","crit");},bsMs(200));
    setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?1350:700,playerPhase);},bsMs(900));
    return;
  }
  /* BURST: revert HP ke normal kalau masa burst sudah lewat (tanpa lifetime) */
  if(fx.burst&&(t-(bt.burstStart[a]||1))>=fx.burst.turns){
    const baseHp=cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).hp;
    if(bt.pMax>baseHp){bt.pMax=baseHp;if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}
  }
    /* OVERHEAT (METEOR CONQUEROR): setelah delay giliran sejak masuk -> rugi pct% MAX HP sendiri tiap giliran; habis -> tewas (pola lifetime) */
  if(fx.overheat&&(t-(bt.burstStart[a]||1))>=fx.overheat.delay){
    const oh=Math.max(1,Math.round(bt.pMax*fx.overheat.pct/100));
    bt.pHp=Math.max(0,bt.pHp-oh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","OVERHEAT -"+fmt(oh),"burn");}},bsMs(200));
    if(bt.pHp<=0){setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?1350:700,playerPhase);},bsMs(900));return;}
  }
  /* BERSERKER ARMOR (THE STRUGGLER): tiap giliran rugi selfDmgPct% max HP + atkGainPct% ATK stack; HP < lowPct% -> undying undyingTurns giliran + xatkMult; habis -> tewas */
  if(fx.berserker){
    const bzk=fx.berserker;
    if((bt.berserkLeft||0)>0){
      bt.berserkLeft--;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BERSERKER TURNS "+bt.berserkLeft,"crit");},bsMs(240));
      if(bt.berserkLeft<=0){
        bt.berserkOn=false;
        setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","ARMOR BROKEN","crit");}},bsMs(220));
        setTimeout(()=>{if(bt&&!bt.over)endBattle(false);},bsMs(900));
        return;
      }
    }
    const bzd=Math.max(1,Math.round(bt.pMax*bzk.selfDmgPct/100));
    bt.pHp-=bzd;bt.atkBuff[a]+=bzk.atkGainPct;
    setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","BERSERK -"+fmt(bzd)+" +"+bzk.atkGainPct+"% ATK","burn");}},bsMs(200));
    if(!bt.berserkOn&&bt.pHp<=bt.pMax*bzk.lowPct/100){
      bt.berserkOn=true;bt.berserkLeft=bzk.undyingTurns;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BERSERKER ARMOR!","crit");},bsMs(420));
    }
    if(bt.pHp<=0&&!bt.berserkOn){
      setTimeout(()=>{if(!bt||bt.over)return;if(!trySave()){endBattle(false);return;}schedPhase(bt.justTagged?1350:700,playerPhase);},bsMs(900));
      return;
    }
  }
   /* TWILIGHT OF VALHALLA (HEIGHT OF PAINTING): tiap giliran selama aktif -> +atkPct% ATK stack; countdown habis -> heal healPct% max HP */
   if(fx.valhalla&&(bt.valhallaLeft||0)>0){
     const vl=fx.valhalla;
     bt.atkBuff[a]+=vl.atkPct;bt.valhallaLeft--;
     setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT +"+vl.atkPct+"% ATK","heal");},bsMs(240));
     if(bt.valhallaLeft<=0){
       const vh=Math.max(1,Math.round(bt.pMax*vl.healPct/100));
       bt.pHp=Math.min(bt.pMax,bt.pHp+vh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
       setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT ENDS +"+fmt(vh),"heal");},bsMs(460));
     }
   }
  let atk=bt.eq.sk?bt.eq.skAtk:cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
  if(bt.atkBuff[a])atk=Math.round(atk*(1+bt.atkBuff[a]/100));
  /* MIRROR status musuh: puppet poison & ink corrupt motong ATK pemain (pola ePoison/eInk) */
  if(bt.pPoisonCut)atk=Math.max(1,Math.round(atk*(1-Math.min(90,bt.pPoisonCut)/100)));
  if((bt.pInk||0)>0&&bt.pInkPct>0)atk=Math.max(1,Math.round(atk*(1-(bt.pInk*bt.pInkPct)/100)));
  /* SPLIT DEATH: ATK badan hasil terbelah ikut menyusut (kumulatif, gaya snatchAtk) */
  if(bt.splitMult&&bt.splitMult[a])atk=Math.round(atk*bt.splitMult[a]);
  if(fx.lowHpAtk&&bt.pHp<bt.pMax*fx.lowHpAtk.below/100)atk=Math.round(atk*(1+fx.lowHpAtk.bonus/100));
  if(fx.burst&&(t-(bt.burstStart[a]||1))<fx.burst.turns)atk=Math.round(atk*fx.burst.mult);
  if(fx.transform)atk=Math.round(atk*fx.transform.mult);
  if(bt.snatchAtk&&bt.snatchAtk[a])atk+=bt.snatchAtk[a];
  if(bt.shadow)atk=bt.shadow.atk;
  let dmgMult=1;
  /* SHADOW ARMY (SHADOW KING): stat serapan permanen; selama masih ada Shadow hidup damage +atkUp% */
  if(fx.shadowArmy){
    if(bt.skAbsorb&&bt.skAbsorb.atk>0)atk+=bt.skAbsorb.atk;
    if(skLivingShadows().length)dmgMult*=(1+(fx.shadowArmy.atkUp||30)/100);
  }
  if(fx.dmgMult)dmgMult*=fx.dmgMult;
  /* OPENING HIT: serangan pertama ke kartu musuh BARU ×(1+pct%) — guard dibuang saat percobaan pertama (miss/evade tetap habis) */
  /* DODGE-NEXT (TITAN HUNTER nextOnly): bonus damage dari dodge dipakai di serangan ini (sekali pakai) */
  if(fx.dodgeAtk&&fx.dodgeAtk.nextOnly){bt.dodgeNext=bt.dodgeNext||new Array(bt.fighters.length).fill(0);if((bt.dodgeNext[a]||0)>0){dmgMult*=1+bt.dodgeNext[a]/100;bt.dodgeNext[a]=0;setTimeout(()=>floatText(".fighter.me","COUNTER DODGE +"+fx.dodgeAtk.pct+"%","crit"),bsMs(150));}}
  if(fx.openingHit&&bt.openGuard&&bt.eHp>0){dmgMult*=(1+fx.openingHit.pct/100);bt.openGuard=false;}
  /* DESPERATE STRIKE dilepas: ×mult sekali lalu state=2 -> mati di awal enemyPhase (lihat blok dsState) */
  if(fx.desperateStrike&&bt.dsState[a]===1){dmgMult*=fx.desperateStrike.mult;bt.dsState[a]=2;setTimeout(()=>floatText(".fighter.me",fx.desperateStrike.text||"DESPERATE STRIKE","crit"),bsMs(200));}
  /* SLEEP STRIKE dilepas: serangan pertama setelah bangun ×mult sekali; overkill disimpan di bt.overflow (dihantamkan ke musuh berikutnya di advanceTowerFoe) */
  let sleepHit=false;
  if(fx.sleepStrike&&bt.sleepArmed[a]){sleepHit=true;dmgMult*=fx.sleepStrike.mult;bt.sleepArmed[a]=false;setTimeout(()=>floatText(".fighter.me",fx.sleepStrike.text||"THUNDERCLAP FLASH","crit"),bsMs(220));}
    /* SERIOUS PUNCH dilepas: giliran ke-charge -> xmult + arm shockwave 10% (dipakai di blok hits) */
  if(fx.seriousPunch&&bt.spArmed[a]){bt.spArmed[a]=false;dmgMult*=fx.seriousPunch.mult;setTimeout(()=>floatText(".fighter.me","SERIOUS PUNCH","crit"),bsMs(200));}
  /* FREEZE (10TH CAPTAIN): selama target BEKU (bt.freezeLeft>0, tick paralel eStun di enemyPhase) serangan kartu ini ×mult */
  if(fx.entryFreeze&&(bt.freezeLeft||0)>0)dmgMult*=fx.entryFreeze.mult;
  /* FREEZE BONUS (ICE QUEEN): selama target BEKU, serangan kartu ini xmult */
  if(fx.hitFreeze&&(bt.freezeLeft||0)>0)dmgMult*=fx.hitFreeze.mult;
   /* MASTERPIECE (HEIGHT OF PAINTING): serangan ke-3 -> xmult + arm stun (dilepas setelah hit, guard statusImmune) */
   let masterpiece=false;
   if(fx.valhalla&&fx.valhalla.master){bt.paintHits[a]=(bt.paintHits[a]||0)+1;if(bt.paintHits[a]%3===0){masterpiece=true;dmgMult*=fx.valhalla.master.mult;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","MASTERPIECE!","crit");},bsMs(220));}}
  /* BERSERKER ARMOR aktif (THE STRUGGLER): serangan xatkMult */
  /* DIZZY (RUBBER FIELD): penyerang kena DIZZY -> semua damage yang diterima +20% per stack */
  if((bt.dizzyStack||0)>0&&(bt.dizzyLeft||0)>0)dmgMult*=(1+bt.dizzyStack*0.2);
  if(fx.berserker&&bt.berserkOn&&(bt.berserkLeft||0)>0)dmgMult*=fx.berserker.atkMult;
  /* SATU PERSEN (Ultra Instinct): tiap serangan GENAP (ke-2, ke-4, ...) = 1% kekuatan penuh → ×mult damage + tembus damage reduction musuh */
  let pen=!!fx.ignoreDef;
  if(fx.everySecond){bt.atkCount[a]++;if(bt.atkCount[a]%2===0){dmgMult*=fx.everySecond.mult;pen=true;setTimeout(()=>floatText(".fighter.me","ONE PERCENT","crit"),bsMs(220));}}
  /* SUSANOO CHIDORI: tiap serangan ke-N → ×mult damage + menembus pengurangan damage */
  let gammaRayHit=false;
  if(fx.everyNth){bt.atkCount[a]++;if(bt.atkCount[a]%fx.everyNth.n===0){dmgMult*=fx.everyNth.mult;pen=true;if(fx.everyNth.text==="GAMMA RAY BURST")gammaRayHit=true;setTimeout(()=>floatText(".fighter.me",fx.everyNth.text||"SUSANOO CHIDORI","crit"),bsMs(gammaRayHit?(180+GR_T.first-120):220));}}if(fx.everyNth&&fx.everyNth.next&&bt.atkCount[a]>0&&bt.atkCount[a]%fx.everyNth.n===0&&bt.eHp>0){const nd=Math.max(1,Math.round(atk*(fx.everyNth.next/100)));if(fx.everyNth.all&&bt.tower&&towerRun){lineupAoeHit(nd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GAMMA RAY -"+fmt(nd),"crit");},bsMs(gammaRayHit?(180+GR_T.first+120):420));}else if(!fx.everyNth.all&&bt.tower&&towerRun){lineupNextHit(nd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DEATH BEAM -"+fmt(nd),"crit");},bsMs(420));}}
  /* THE WORLD (Immortal Vampire): serangan ke-`every` -> stun musuh `turns` giliran lagi (entry stun sudah arming di 4 titik masuk) */
  if(fx.timeStop){bt.atkCount[a]++;if(bt.atkCount[a]%fx.timeStop.every===0&&!foeStatusImmune()){bt.eStun=fx.timeStop.turns;setTimeout(()=>floatText(".fighter.foe","THE WORLD","crit"),bsMs(220));}}
  /* 40-DAY FLOOD (Sea Sovereign): serangan ke-`every` -> ×mult + tembus DR + eksekusi kalau musuh <= exec% HP */
  let floodHit=false;
  if(fx.flood){bt.atkCount[a]++;if(bt.atkCount[a]%fx.flood.every===0){floodHit=true;dmgMult*=fx.flood.mult;pen=true;const isHP=(fx.flood.label==="HOLLOW PURPLE");setTimeout(()=>floatText(".fighter.foe",(fx.flood.label||"40-DAY FLOOD"),"crit"),bsMs(isHP?(180+HP_T.first-80):220));}}
/* SAND BURIAL (Sand Vessel): serangan ke-`every` -> guaranteed hit xmult, bypass dodge/void via tsLock */
let sandHit=false;
if(fx.sandBurial){bt.atkCount[a]++;if(bt.atkCount[a]%fx.sandBurial.every===0){sandHit=true;dmgMult*=fx.sandBurial.mult;setTimeout(()=>floatText(".fighter.foe","SAND BURIAL","crit"),bsMs(220));}}
  /* BAJRANG GUN (Sun God): serangan pertama per battle -> xmult damage + stun + aoe ke cadangan tower */
  let bajrangActive=false;
  if(fx.bajrangGun&&!bt.bajrangUsed[a]){
    bt.bajrangUsed[a]=true;
    bajrangActive=true;dmgMult*=fx.bajrangGun.mult;pen=true;
    if(!foeStatusImmune()){bt.eStun=Math.max(bt.eStun||0,fx.bajrangGun.stun||1);}
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BAJRANG GUN!","crit");},bsMs(180+BJ_T.first-80));
    if(bt.tower&&towerRun&&fx.bajrangGun.aoePct){
      const aoeDmg=Math.max(1,Math.round(atk*(fx.bajrangGun.aoePct/100)));
      setTimeout(()=>{if(bt&&!bt.over){lineupAoeHit(aoeDmg);floatText(".fighter.foe","AOE QUAKE -"+fmt(aoeDmg),"crit");}},bsMs(180+BJ_T.first+40));
    }
  }
  /* STYLE SWITCHING (Devil Hunter): 4 mode bergilir tiap giliran kartu ini menyerang */
  if(fx.styleSwitching){
    const STYLES=["TRICKSTER","SWORDMASTER","ROYALGUARD","GUNSLINGER"];
    const si=bt.styleCount[a]%4;bt.styleCount[a]++;
    setTimeout(()=>floatText(".fighter.me",STYLES[si],"crit"),bsMs(120));
    if(si===0)bt.trickNext=true;
    else if(si===1)dmgMult*=1.5;
    else if(si===2)bt.royalNow=true;
    else if(si===3)bt.gunsNow=true;
  }
  if(fx.highHpDmg&&bt.pHp>bt.pMax*fx.highHpDmg.above/100)dmgMult*=(1+fx.highHpDmg.bonus/100);
  if(fx.grieferAtk)dmgMult*=fx.grieferAtk.mult;
  if(fx.turret&&bt.turret>0)dmgMult*=(1+bt.turret*fx.turret.atkPct/100);
  /* SENZU MUNCH (DUMB HAIR GUY): heal tiap giliran; makan -> x0.5 dmg; finish meal tiap N giliran -> x4 strike */
  if(fx.senzu){
    const sl=fx.senzu;
    bt.senzu.turn++;
    const fin=(bt.senzu.turn%sl.every===0);
    const heal=Math.round(bt.pMax*sl.healPct/100);
    bt.pHp=Math.min(bt.pMax,bt.pHp+heal);
    dmgMult*=fin?sl.strikeMult:sl.eatMult;
    bt.senzuFin=fin;
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me",fin?"FINISH THE MEAL!":"MUNCH MUNCH +"+heal,"heal");},bsMs(300));
  }
  /* GOMU GOMU (DUMB STRETCHY GUY): tiap serangan trigger random 1 dari 3 */
  if(fx.stretch){
    const st=fx.stretch;const r=Math.floor(Math.random()*3);
    if(r===0){bt.balloon=st.balloon.reflect;dmgMult=0;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM BALLOON!","heal");},bsMs(300));}
    else if(r===1){dmgMult=0;bt.stretchShot=Math.round(cardStats(bt.eq.char,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk*st.fireworks.mult);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM FIREWORKS!","crit");},bsMs(300));}
    else{dmgMult=0;const fh=Math.round(bt.pMax*st.flop.healPct/100);bt.pHp=Math.min(bt.pMax,bt.pHp+fh);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GUM-GUM FLOP +"+fh,"heal");},bsMs(300));}
  }
  /* BUNGEE GUM: selama gum masih nempel di musuh (ditempel waktu musuh nyerang), serangan ×(1+bonus%) lalu hitung mundur */
  if(fx.bungeeGum&&bt.gumTurns>0){dmgMult*=(1+fx.bungeeGum.bonus/100);bt.gumTurns--;}
  const hits=[{mult:1}];

  /* THE WORLD ENDER (DARKIN LORD): cycle 3 serangan - 150% / 40% semua / 80% pierce + 80% di belakang */

  let weExtra=0,wePhase=-1;

  if(fx.worldEnder){

    const we=fx.worldEnder;const ph=bt.weCount[a]%3;bt.weCount[a]++;wePhase=ph;

    hits.length=0;

    if(ph===0){hits.push({mult:we.cyc1});}

    else if(ph===1){hits.push({mult:we.cyc2});weExtra=Math.round(atk*dmgMult*we.cyc2);lineupAoeHit(weExtra);}

    else{hits.push({mult:we.pierce});weExtra=Math.round(atk*dmgMult*we.pierce);lineupNextHit(weExtra);pen=true;}

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me",ph===0?"WORLD ENDER I · CLEAVE":ph===1?"WORLD ENDER II · SWEEP ALL":"WORLD ENDER III · PIERCE","crit");},bsMs(240));

  }

  /* PSYCHIC BARRAGE (PSYCHIC ESPER): alih-alih menyerang - N batu acak ke musuh aktif / cadangan tower */

  if(fx.psychicBarrage){

    const pb=fx.psychicBarrage;const n=bt.pbRocks||pb.rocks;bt.psyN=n;

    hits.length=0;

    let railDirty=false;

    for(let i=0;i<n;i++){

      let target=null;

      if(bt.tower&&towerRun){

        const alive=[];

        for(let j=towerRun.idx+1;j<towerRun.waves.length;j++){const w=towerRun.waves[j];if(w&&!w.dead)alive.push(w);}

        if(alive.length&&Math.random()<0.5)target=alive[Math.floor(Math.random()*alive.length)];

      }

      const key=target?("W"+towerRun.waves.indexOf(target)):"A";

      if(key===bt.pbKey)bt.pbStreak++;else bt.pbStreak=0;

      bt.pbKey=key;

      const m=pb.mult*(1+bt.pbStreak*(pb.streakPct||10)/100);

      if(target){

        if(target.hp==null)target.hp=target.es.hp;

        const d=Math.round(atk*dmgMult*m);

        target.hp-=d;

        if(target.hp<=0){target.hp=0;target.dead=true;}

        railDirty=true;

      }else{

        hits.push({mult:m});

      }

    }

    if(!hits.length)hits.push({mult:0});

    if(railDirty){const rail=document.querySelector(".foe-rail");if(rail)rail.outerHTML=towerEnemyBenchRail();}

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","PSYCHIC BARRAGE x"+n,"crit");},bsMs(300));

  }
  if(fx.seriousPunch&&bt.spWave[a]){bt.spWave[a]=false;hits.push({mult:(fx.seriousPunch.wavePct||10)/100});lineupAoeHit(Math.round(atk*dmgMult*((fx.seriousPunch.wavePct||10)/100)));}
  if(fx.tripleHit){hits.length=0;for(let tri=0;tri<fx.tripleHit.hits;tri++)hits.push({mult:fx.tripleHit.mult});}
  if(typeof fx.double==="object"){if(Math.random()*100<(fx.double.chance!=null?fx.double.chance:100))hits.push({mult:(fx.double.pct!=null?fx.double.pct:100)/100});}else if(fx.double&&Math.random()*100<fx.double)hits.push({mult:1});
  let crit=false;
  if(fx.crit&&Math.random()*100<fx.crit.chance){crit=true;hits[hits.length-1].mult*=fx.crit.mult;}
  else if(Math.random()*100<BASE_CRIT.chance){crit=true;hits[hits.length-1].mult*=BASE_CRIT.mult;}
  let purple=false;
  if(fx.purple&&Math.random()*100<fx.purple.chance){purple=true;crit=true;hits[hits.length-1].mult*=fx.purple.mult;}
  let ranton=false;
  if(fx.ranton&&Math.random()*100<fx.ranton.chance){ranton=true;crit=true;hits.length=0;const rh=Math.max(1,fx.ranton.hits||5),rm=fx.ranton.mult||1;for(let k=0;k<rh;k++)hits.push({mult:rm});}
  let barrageN=0,iceBlastN=0;
  if(fx.barrage&&Math.random()*100<fx.barrage.chance){const n=fx.barrage.min+Math.floor(Math.random()*(fx.barrage.max-fx.barrage.min+1));const bm=fx.barrage.mult||1;if(bm!==1){hits.length=0;for(let i=0;i<n;i++)hits.push({mult:bm});}else{while(hits.length<n)hits.push({mult:1});}barrageN=hits.length;}
  if(ranton&&!barrageN)barrageN=hits.length;
  /* ICE BLAST (kartu BOSS): chance% -> ganti hit jadi N tembakan @ pct% ATK, label float di performAttack */
  if(fx.iceBlast&&Math.random()*100<fx.iceBlast.chance){const n=Math.max(1,fx.iceBlast.hits||3),pm=(fx.iceBlast.pct!=null?fx.iceBlast.pct:100)/100;hits.length=0;for(let i=0;i<n;i++)hits.push({mult:pm});iceBlastN=n;barrageN=n;}
  // DOMAIN EXPANSION (Gojo, disamakan dengan Shrine Sukuna): 100% tiap ronde → 15 sambaran @30% ATK + lifesteal + recharge (stun 1 & DR 50% 2 ronde)
  let domainStrike=false;
  if(fx.domain&&id==="CH_EX_GOJO"&&Math.random()*100<(fx.domain.chance||100)){const dn=fx.domain.min||10,dm=(fx.domain.mult!=null?fx.domain.mult:0.3);hits.length=0;for(let i=0;i<dn;i++)hits.push({mult:dm});barrageN=dn;crit=false;purple=false;ranton=false;domainStrike=true;}
  bt.domainNow=domainStrike;
  /* Galaxy Roar = SATU semburan: semua damage ditumpuk ke satu sambaran supaya laser & ledakannya sinkron */
  const galaxy=id==="CH_ETERNAL_DRAGON"&&purple;
  if(galaxy){const m=hits[hits.length-1].mult;hits.length=0;hits.push({mult:m});barrageN=0;}
  const ariseMode=id==="CH_EX_JINWOO"&&barrageN>=9;
  if(bt.gunsNow)hits.push({mult:0.4});
/* THE WORLD: selama time stop aktif serangan tidak bisa di-dodge/void */
  let tsLock=!!(fx.timeStop&&(bt.eStun||0)>0)||!!sandHit;
    let total=0;const shots=[];
  hits.forEach(h=>{
    let d=Math.round(atk*dmgMult*h.mult);
    if(!pen&&!tsLock&&efx.evasion&&t<=efx.evasion.turns&&Math.random()*100<efx.evasion.chance){shots.push({d:0,evade:true});return;}
    const pierce=!!(fx.pierce&&Math.random()*100<fx.pierce)||wePhase===2;
    if(!pen&&!tsLock&&efx.void&&!pierce&&Math.random()*100<efx.void){shots.push({d:0,void:true});return;}
    const fDef=(typeof foeDefenseVs==="function")?foeDefenseVs(pen||pierce,tsLock):{evade:false,dr:0};
    if(fDef.evade){shots.push({d:0,evade:true});return;}
    let eDr=fDef.dr||0;
    if(efx.iceShell)eDr=Math.max(eDr,efx.iceShell);
    if(efx.dmgCut&&efx.dmgCut.pct)eDr=Math.max(eDr,efx.dmgCut.pct);
    if(efx.valhalla&&(bt.eValhallaLeft||0)>0&&efx.valhalla.dmgCut)eDr=Math.max(eDr,efx.valhalla.dmgCut);
    if(bt.ePsychic&&bt.ePsychic.left>0)eDr=Math.max(eDr,bt.ePsychic.dr||0);
    if(bt.eRubber&&!pierce)eDr=Math.max(eDr,50);
    if(eDr>0&&!pierce)d=Math.max(1,Math.round(d*(1-eDr/100)));
    shots.push({d,miss:false,pierce});total+=d;
  });
if(floodHit&&total>0&&total<bt.eHp&&((fx.flood.exec!=null?fx.flood.exec:20)>0)&&bt.eHp<=bt.es.hp*((fx.flood.exec!=null?fx.flood.exec:20)/100))total=bt.eHp;
/* HITOKUGUTSU (Puppeteer): tiap hit -> puppet poison -pct% ATK musuh permanen (stacking s/d 90%) */
if(fx.puppetPoison&&total>0){bt.ePoison=Math.min(90,(bt.ePoison||0)+fx.puppetPoison.pct);setTimeout(()=>floatText(".fighter.foe","PUPPET -"+fx.puppetPoison.pct+"% ATK","burn"),bsMs(360));}
if(fx.inkCorrupt&&total>0){bt.eInk=Math.min(fx.inkCorrupt.max,(bt.eInk||0)+1);bt.eInkPct=fx.inkCorrupt.pct;setTimeout(()=>floatText(".fighter.foe","INK CORRUPTION","burn"),bsMs(380));}
    const eHpNext=bt.eHp-total,foeDead=eHpNext<=0;
  /* THUNDERCLAP FLASH overflow: sisa damage serangan sleepStrike yang membunuh target disimpan buat musuh berikutnya */
  if(sleepHit&&foeDead&&eHpNext<0)bt.overflow=-eHpNext;
  const _fgFoe=(bt.fgen||0);const foeDownCb=()=>{if(bt&&!bt.over&&(bt.fgen||0)===_fgFoe)foeDown();};
  performAttack({
    A:".fighter.me",D:".fighter.foe",id,fx,
    barId:"hpFoe",barTid:"hpFoeT",defMax:bt.es.hp,
    defHpStart:bt.eHp+total,defHpEnd:eHpNext,
    shots,total,crit,purple,
    ranton,domainStrike,ariseMode,barrageN,galaxy,iceBlast:!!iceBlastN,bajrang:bajrangActive,hollowPurple:(floodHit&&fx.flood&&(fx.flood.label==="HOLLOW PURPLE")),havoc:!!bt.havocAnimTurn,psychic:fx.psychicBarrage?{n:bt.psyN||fx.psychicBarrage.rocks,revived:!!bt.pbRocks}:null,worldEnder:wePhase>=0?{phase:wePhase,revived:!!bt.weRevived}:null,gammaRay:gammaRayHit,
    onAnimEnd:foeDead?foeDownCb:null,
    recharge:(b)=>{if(!bt)return;bt.pStun=(fx&&fx.statusImmune)?0:b.selfStun;bt.pDrTurns=b.selfDrTurns||b.selfStun;bt.pDr=b.selfDr||0;setTimeout(()=>floatText(".fighter.me","RECHARGE","miss"),bsMs(1200));}
  });
  bt.havocAnimTurn=false;
  bt.eHp=eHpNext;
  /* ===== MIRROR PASSIVE LAWAN - kartu musuh prok saat kena serangan (counter/poison/ink/drain) ===== */
  const efxM=(bt.eAbilityOff>0)?{}:(bt.efx||{});
  if(total>0&&bt.eHp>0&&bt.pHp>0){
    if(bt.eRubber){
      const rb=Math.min(Math.round(bt.pMax*0.2), Math.round(total*0.5));
      bt.pHp=Math.max(0,bt.pHp-rb);
      if(window.rubberBounceFx)rubberBounceFx();
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","RUBBER BOUNCE -"+fmt(rb),"rubber");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(320));
      if(bt.pHp<=0)setTimeout(()=>{if(bt&&!bt.over){if(!trySave())endBattle(false);}},bsMs(900));
    }
    if(bt.ePsychic&&bt.ePsychic.left>0){
      const bh=Math.max(1,Math.round(bt.es.hp*bt.ePsychic.healPct/100));
      bt.eHp=Math.min(bt.es.hp,bt.eHp+bh);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","PSYCHIC BARRIER +"+fmt(bh),"heal");},bsMs(360));
      bt.ePsychic.left--;
      if(bt.ePsychic.left<=0)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","BARRIER DOWN","miss");},bsMs(520));
    }
    if(efxM.counterHit&&Math.random()*100<efxM.counterHit.chance){
      const cb=(efxM.counterHit.base==="foeMaxHp")?bt.pMax:bt.es.atk;
      const rawCd=Math.max(1,Math.round(cb*efxM.counterHit.pct/100));
      const cd=Math.min(Math.round(bt.pMax*0.25), rawCd);
      bt.pHp=Math.max(0,bt.pHp-cd);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me",(efxM.counterHit.base==="foeMaxHp"?"BLOOD IGNITE -":"FULL COUNTER -")+fmt(cd),"crit");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(560));
      if(bt.pHp<=0)setTimeout(()=>{if(bt&&!bt.over){if(!trySave())endBattle(false);}},bsMs(900));
    }
    if(efxM.puppetPoison){bt.pPoisonCut=Math.min(90,(bt.pPoisonCut||0)+efxM.puppetPoison.pct);setTimeout(()=>floatText(".fighter.me","POISON -"+efxM.puppetPoison.pct+"% ATK","burn"),bsMs(360));}
    if(efxM.inkCorrupt){bt.pInk=Math.min(efxM.inkCorrupt.max,(bt.pInk||0)+1);bt.pInkPct=efxM.inkCorrupt.pct;setTimeout(()=>floatText(".fighter.me","INK CORRUPTION","burn"),bsMs(380));}
    if(efxM.hpDrain&&!fx.statusImmune){bt.pMax=Math.max(1,Math.round(bt.pMax*(1-efxM.hpDrain.pct/100)));if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","HP DRAIN","crit");setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}},bsMs(360));}
  }
  if(ranton&&total>0&&bt.eHp>0&&fx.ranton.stun){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else bt.eStun=fx.ranton.stun;}
   if(masterpiece&&bt.eHp>0&&fx.valhalla.master.stun){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eStun=Math.max(bt.eStun||0,fx.valhalla.master.stun);setTimeout(()=>floatText(".fighter.foe","MASTERPIECE STUN","crit"),bsMs(520));}}
  /* HP DRAIN: tiap serangan yang kena memotong MAX HP musuh secara permanen (compounding) */
  if(fx.hpDrain&&total>0&&bt.eHp>0&&!foeStatusImmune()){
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*(1-fx.hpDrain.pct/100)));
    if(bt.eHp>bt.es.hp)bt.eHp=bt.es.hp;
    setTimeout(()=>floatText(".fighter.foe","HP DRAIN","crit"),bsMs(360));
  }
    /* THE WORLD ENDER lifesteal: heal healPct% dari semua damage giliran ini (x1.3 setelah revive) */

  if(fx.worldEnder&&total+weExtra>0){

    const wh=Math.max(1,Math.round((total+weExtra)*fx.worldEnder.healPct/100*(bt.weRevived?1.3:1)));

    bt.pHp=Math.min(bt.pMax,bt.pHp+wh);

    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","LIFESTEAL +"+fmt(wh),"heal");},bsMs(720));

  }

  /* WALL TITANS: tiap `every` giliran, berbaris ngasih bonus pct% ATK ke musuh (di luar serangan normal) */
  if(fx.wallTitans){bt.wtCount[a]=(bt.wtCount[a]||0)+1;if(bt.wtCount[a]%fx.wallTitans.every===0&&bt.eHp>0){const wt=Math.round(atk*fx.wallTitans.pct/100);bt.eHp-=wt;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","WALL TITANS -"+fmt(wt),"crit");}},bsMs(520));}}
  /* SHOCKWAVE (OCEAN'S GUARDIAN): setiap serangan ke-`every`, kartu aktif musuh kena flat pct% ATK di luar serangan normal (gaya wallTitans; arena 1 musuh aktif = "all enemies" jatuh ke kartu aktif) */
  if(fx.shockwave){bt.shockCount[a]=(bt.shockCount[a]||0)+1;if(bt.shockCount[a]%fx.shockwave.every===0&&bt.eHp>0){const sw=Math.round(atk*fx.shockwave.pct/100);bt.eHp-=sw;lineupAoeHit(sw);setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","SHOCKWAVE -"+fmt(sw),"crit");}},bsMs(560));}}
  if(fx.lifesteal&&total>0){
    const ls=Math.round(total*fx.lifesteal/100);bt.pHp=Math.min(bt.pMax,bt.pHp+ls);
    setTimeout(()=>floatText(".fighter.me","+"+fmt(ls),"heal"),bsMs(300));
  }
   /* INK DRAIN (INK ANAMLOY): serangan ke-every -> heal pct% dari damage yang DIBERIKAN serangan itu */
   if(fx.inkDrain&&total>0){bt.paintHits[a]=(bt.paintHits[a]||0)+1;if(bt.paintHits[a]%fx.inkDrain.every===0){const ih=Math.max(1,Math.round(total*fx.inkDrain.pct/100));bt.pHp=Math.min(bt.pMax,bt.pHp+ih);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","INK DRAIN +"+fmt(ih),"heal");},bsMs(320));}}
  if(fx.burn&&total>0&&Math.random()*100<fx.burn.chance){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eBurn=fx.burn.turns;setTimeout(()=>floatText(".fighter.foe","BURN","burn"),bsMs(360));}}
  /* HIT FREEZE (ICE QUEEN): chance% per serangan -> bekukan musuh turns giliran (pola burn, guard statusImmune) */
  /* SENZU FINISH MEAL (DUMB HAIR GUY): gain 25% damage sbg flat ATK + 50% sbg max HP, cap maxMultx base */
  if(fx.senzu&&bt.senzuFin&&total>0&&bt.eHp>0){
    const sl=fx.senzu;
    let gA=Math.round(total*sl.atkGain/100);let gH=Math.round(total*sl.hpGain/100);
    gA=Math.max(0,Math.min(gA,bt.senzu.baseAtk*(sl.maxMult-1)-bt.senzu.atkSum));
    gH=Math.max(0,Math.min(gH,bt.senzu.baseHp*(sl.maxMult-1)-bt.senzu.hpSum));
    if(gA>0){bt.senzu.atkSum+=gA;bt.atkBuff[a]+=Math.round(gA/bt.senzu.baseAtk*100);}
    if(gH>0){bt.senzu.hpSum+=gH;bt.pMax=Math.round(bt.senzu.baseHp+bt.senzu.hpSum);if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;}
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","SENZU GROW +ATK +MAX HP","crit");},bsMs(360));
  }
  if(fx.senzu)bt.senzuFin=false;
  /* FIREWORKS (DUMB STRETCHY GUY): pukulan ekstra xmult ATK dasar ke musuh */
  if(bt.stretchShot){
    const fd=bt.stretchShot;bt.stretchShot=0;
    if(bt.eHp>0){
      bt.eHp-=fd;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","FIREWORKS -"+fmt(fd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(340));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
  }
  /* MAX CORRUPT (GLITCHED ENTITY): serangan kena -> max HP musuh turun pct% permanen, clamp eHp */
  if(fx.maxCorrupt&&total>0&&bt.eHp>0){
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*(100-fx.maxCorrupt.pct)/100));
    if(bt.eHp>bt.es.hp)bt.eHp=bt.es.hp;
    setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.foe","MAX HP CORRUPT","burn");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(340));
  }
  if(fx.hitFreeze&&total>0&&bt.eHp>0&&Math.random()*100<fx.hitFreeze.chance){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{bt.eStun=fx.hitFreeze.turns;bt.freezeLeft=fx.hitFreeze.turns;setTimeout(()=>floatText(".fighter.foe","FROZEN","crit"),bsMs(360));}}
  /* PERFECT SUSANOO (low HP): di bawah ambang, serangan membakar musuh selama N giliran */
  if(fx.lowHpAura&&total>0&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&bt.eHp>0){if(foeStatusImmune()){setTimeout(()=>floatText(".fighter.foe","IMMUNE","heal"),bsMs(360));}else{if(fx.lowHpAura.burn)bt.eBurn=fx.lowHpAura.burn.turns;setTimeout(()=>floatText(".fighter.foe","PERFECT SUSANOO","burn"),bsMs(360));}}
  /* STUN PUNCH (LUCK VOLTIA): counter tiap serangan kena; serangan ke-every -> roll stun + atkBuff permanen */
  if(fx.stunPunch&&total>0&&bt.eHp>0){
    bt.punchCount=bt.punchCount||new Array(bt.fighters.length).fill(0);bt.stunGain=bt.stunGain||new Array(bt.fighters.length).fill(0);
    bt.punchCount[a]=(bt.punchCount[a]||0)+1;
    if(bt.punchCount[a]%fx.stunPunch.every===0&&Math.random()*100<fx.stunPunch.chance&&!foeStatusImmune()){
      bt.eStun=Math.max(bt.eStun||0,fx.stunPunch.turns);
      if(bt.stunGain[a]<(fx.stunPunch.max||5)){bt.stunGain[a]++;bt.atkBuff[a]+=fx.stunPunch.atkPct;}
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","STUN! +"+fx.stunPunch.atkPct+"% ATK","crit");},bsMs(360));
    }
  }
  /* EIGHT GATES (GREEN BEAST): gerbang tiap kena -> atkBuff; gerbang penuh -> rugi selfPct% max HP (mati via gateKill) */
  if(fx.eightGates&&total>0&&bt.eHp>0&&bt.pHp>0){
    bt.gateCount=bt.gateCount||new Array(bt.fighters.length).fill(0);
    if(bt.gateCount[a]<fx.eightGates.max){bt.gateCount[a]++;bt.atkBuff[a]+=fx.eightGates.atkPct;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GATE "+bt.gateCount[a]+"/"+fx.eightGates.max+" +"+fx.eightGates.atkPct+"%","crit");},bsMs(380));}
    if(bt.gateCount[a]>=fx.eightGates.max){
      const gd=Math.max(1,Math.round(bt.pMax*fx.eightGates.selfPct/100));bt.pHp=Math.max(0,bt.pHp-gd);
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","GATE PRICE -"+fmt(gd),"burn");setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}},bsMs(440));
      if(bt.pHp<=0)bt.gateKill=true;
    }
  }
  /* SHOCK ALL (TREMOR EMPEROR): shockwave flat pct% ATK ke seluruh lineup musuh / aktif (story) */
  if(fx.shockAll&&total>0&&bt.eHp>0){
    const sd=Math.max(1,Math.round(atk*fx.shockAll.pct/100));
    if(bt.tower&&towerRun){lineupAoeHit(sd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","QUAKE -"+fmt(sd),"crit");},bsMs(460));}
    else{bt.eHp-=sd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","QUAKE -"+fmt(sd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(460));}
  }
  /* SPLASH (LIGHTBORNE ADMIRAL): tembusan flat pct% ATK ke lineup BERIKUTNYA / aktif lagi (story) */
  if(fx.splash&&total>0&&bt.eHp>0){
    const pd=Math.max(1,Math.round(atk*fx.splash.pct/100));
    if(bt.tower&&towerRun){lineupNextHit(pd);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","YASAKANI -"+fmt(pd),"crit");},bsMs(500));}
    else{bt.eHp-=pd;setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","YASAKANI -"+fmt(pd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(500));}
  }
  setBar("hpFoe","hpFoeT",bt.eHp+total,bt.es.hp);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  /* STATUS IMMUNE: burn musuh dibatalkan tanpa tick damage */
  if(bt.eBurn>0&&foeStatusImmune()){bt.eBurn=0;setTimeout(()=>floatText(".fighter.foe","IMMUNE · BURN","heal"),bsMs(300));}
  if(bt.eBurn>0&&bt.eHp>0){
    const bPct=fx.burn?fx.burn.pct:(fx.lowHpAura&&fx.lowHpAura.burn?fx.lowHpAura.burn.pct:0);
    const bd=Math.round(bt.es.hp*bPct/100);bt.eHp-=bd;bt.eBurn--;
    setTimeout(()=>{anim(".fighter.foe","hit");floatText(".fighter.foe","-"+fmt(bd),"burn");if(window.burnSheetTick)burnSheetTick();},bsMs(420));
  }
  if(bt.eHp<=0){
    // mati karena racun (bukan karena sambaran yang sudah dijadwalkan onAnimEnd)
    if(!foeDead)setTimeout(foeDownCb,bsMs(620));
    return;
  }
  schedPhase(bajrangActive?BJ_T.first+1300:gammaRayHit?1500:wePhase>=0?1350:fx.psychicBarrage?Math.max(1000,PSY_T.first+(Math.max(1,bt.psyN||1)-1)*PSY_T.step+640):galaxy?GALAXY.total+160:ariseMode?2200:domainStrike?1700:ranton?MADARA_T.total+160:1000,enemyPhase);
}
function enemyPhase(){
  if(!bt||bt.over)return;
  bt.curPhase="enemy";
  bt.foeDowning=false;/* kill berikutnya baru sah setelah giliran ini mulai */
  /* DEATH DEFY selesai: kartu sudah dapat giliran ekstranya (menyerang) -> tumbang sekarang,
     sebelum musuh sempat menyerang balik. Pola penutup = deathStep (turn++ / trySave / playerPhase). */
  if(bt.defyHold){
    bt.defyHold=false;bt.pHp=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","ASHURA FADES","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;
      bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?1350:700,playerPhase);
    },bsMs(900));
    return;
  }
  /* DESPERATE STRIKE tuntas: serangan pamungkas sudah dilepaskan -> mati di akhir giliran (trySave normal) */
  if(bt.dsState&&bt.dsState[bt.active]===2){
    bt.dsState[bt.active]=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","LAST GASP","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;
      bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?1350:700,playerPhase);
    },bsMs(900));
    return;
  }
  /* EIGHT GATES harga: kartu tumbang di akhir giliran dia (pola dsState) */
  if(bt.gateKill){
    bt.gateKill=false;bt.pHp=0;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","ko");floatText(".fighter.me","GATES FULL...","crit");}},bsMs(150));
    setTimeout(()=>{
      if(!bt||bt.over)return;bt.turn++;
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?1350:700,playerPhase);
    },bsMs(900));
    return;
  }
  setTurnPill("foe","ENEMY TURN");
  if(bt.dizzyLeft>0){bt.dizzyLeft--;if(bt.dizzyLeft<=0){bt.dizzyStack=0;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DIZZY ENDS","miss");},bsMs(300));}}
  const id=bt.eq.char,t=bt.turn;let fx=resolveFx(bt.eq,bt.efx);
  if(bt.shadow)fx={};
  if(bt.eq.sk)fx={};
  const efx=(bt.eAbilityOff>0)?{}:(bt.efx||{});
  let eDomain=false,eArise=false,eranton=false,eGalaxy=false,eIceBlast=false,eBajrang=false,ePsychicActive=null,eWorldEnder=null,eGammaRay=false;
  /* FREEZE tick (10TH CAPTAIN): hitungan beku turun tiap giliran musuh — paralel dgn eStun, sebelum blok stun biar bonus ×mult habis pas 2 giliran */
  if(bt.freezeLeft>0)bt.freezeLeft--;
  if(bt.eAbilityOff>0)bt.eAbilityOff--;
  if(bt.copyLeft>0)bt.copyLeft--;
  /* REGEN musuh */
  if(efx.regen&&bt.eHp>0&&bt.eHp>=Math.round(bt.es.hp*(efx.regen.stopBelow||0)/100)){
    const rh=Math.max(1,Math.round(bt.es.hp*efx.regen.pct/100));
    bt.eHp=Math.min(bt.es.hp,bt.eHp+rh);
    setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","REGEN +"+fmt(rh),"heal");},bsMs(200));
  }
  /* STAT GROW musuh */
  if(efx.statGrow&&bt.eHp>0){
    const sg=efx.statGrow.pct||5;
    bt.es.hp=Math.round(bt.es.hp*(1+sg/100));bt.eHp=Math.round(bt.eHp*(1+sg/100));
    bt.es.atk=Math.round(bt.es.atk*(1+sg/100));
    setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","STAT GROW +"+sg+"%","heal");},bsMs(240));
  }
  if(bt.eStun>0){
    if(efx.statusImmune){
      /* STATUS IMMUNE: stun musuh dibatalkan — musuh tetap menyerang */
      bt.eStun=0;
      setTimeout(()=>floatText(".fighter.foe","IMMUNE · STUN","heal"),bsMs(200));
    }else{
      bt.eStun--;
      anim(".fighter.foe","hit",true);
      setTimeout(()=>floatText(".fighter.foe","STUNNED","crit"),bsMs(200));
      bt.turn++;
      schedPhase(1000,playerPhase);
      return;
    }
  }
  /* ===== MIRROR PASSIVE LAWAN - DoT burn pemain + proc serangan sisi musuh ===== */
  if((bt.pBurn||0)>0&&fx.statusImmune){bt.pBurn=0;setTimeout(()=>floatText(".fighter.me","IMMUNE - BURN","heal"),bsMs(300));}
  if((bt.pBurn||0)>0&&bt.pHp>0){
    const pbPct=efx.burn?efx.burn.pct:(efx.lowHpAura&&efx.lowHpAura.burn?efx.lowHpAura.burn.pct:0);
    const pbd=Math.round(bt.pMax*pbPct/100);bt.pHp=Math.max(0,bt.pHp-pbd);bt.pBurn--;
    setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","-"+fmt(pbd),"burn");if(window.burnSheetTick)burnSheetTick("me");}},bsMs(420));
    if(bt.pHp<=0){bt.turn++;setTimeout(()=>{if(bt&&!bt.over){if(!trySave())endBattle(false);}},bsMs(800));return;}
  }
  if(bt.pHp>0&&bt.eHp>0){
    if(typeof foeTurnPassives==="function"&&foeTurnPassives())return;
    const eA=bt.es.atk;
    if(efx.wallTitans){bt.eWt=(bt.eWt||0)+1;if(bt.eWt%efx.wallTitans.every===0){const d2=Math.min(Math.round(bt.pMax*0.25), Math.round(eA*efx.wallTitans.pct/100));bt.pHp=Math.max(0,bt.pHp-d2);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","WALL TITANS -"+fmt(d2),"burn");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(520));}}
    if(efx.shockwave){bt.eShock=(bt.eShock||0)+1;if(bt.eShock%efx.shockwave.every===0){const d2=Math.min(Math.round(bt.pMax*0.25), Math.round(eA*efx.shockwave.pct/100));bt.pHp=Math.max(0,bt.pHp-d2);setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me","SHOCKWAVE -"+fmt(d2),"burn");setBar("hpMe","hpMeT",Math.max(0,bt.pHp),bt.pMax);}},bsMs(560));}}
    if(efx.maxCorrupt){bt.pMax=Math.max(1,Math.round(bt.pMax*(100-efx.maxCorrupt.pct)/100));if(bt.pHp>bt.pMax)bt.pHp=bt.pMax;setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.me","MAX HP CORRUPT","burn");setBar("hpMe","hpMeT",bt.pHp,bt.pMax);}},bsMs(340));}
    if(efx.burn&&Math.random()*100<efx.burn.chance){if(fx.statusImmune){setTimeout(()=>floatText(".fighter.me","IMMUNE","heal"),bsMs(360));}else{bt.pBurn=(bt.pBurn||0)+efx.burn.turns;setTimeout(()=>floatText(".fighter.me","BURN","burn"),bsMs(360));}}
    if(efx.lowHpAura&&efx.lowHpAura.burn&&bt.eHp<bt.es.hp*efx.lowHpAura.below/100){if(fx.statusImmune){setTimeout(()=>floatText(".fighter.me","IMMUNE","heal"),bsMs(360));}else{bt.pBurn=(bt.pBurn||0)+efx.lowHpAura.burn.turns;setTimeout(()=>floatText(".fighter.me","PERFECT SUSANOO","burn"),bsMs(360));}}
    if(efx.hitFreeze&&Math.random()*100<efx.hitFreeze.chance){if(fx.statusImmune){setTimeout(()=>floatText(".fighter.me","IMMUNE","heal"),bsMs(360));}else{bt.pStun=Math.max(bt.pStun||0,efx.hitFreeze.turns);bt.pFreeze=efx.hitFreeze.turns;setTimeout(()=>floatText(".fighter.me","FROZEN","crit"),bsMs(360));}}
    if(efx.stunPunch){bt.ePunchN=(bt.ePunchN||0)+1;if(bt.ePunchN%efx.stunPunch.every===0&&Math.random()*100<efx.stunPunch.chance&&!fx.statusImmune){bt.pStun=Math.max(bt.pStun||0,efx.stunPunch.turns);setTimeout(()=>floatText(".fighter.me","STUN!","crit"),bsMs(360));}}
    if(efx.timeStop){bt.eTsN=(bt.eTsN||0)+1;if(bt.eTsN%efx.timeStop.every===0&&!fx.statusImmune){bt.pStun=Math.max(bt.pStun||0,efx.timeStop.turns);setTimeout(()=>floatText(".fighter.me","THE WORLD","crit"),bsMs(360));}}
    if(bt.pHp<=0){bt.turn++;setTimeout(()=>{if(bt&&!bt.over){if(!trySave())endBattle(false);}},bsMs(800));return;}
  }
  // DOMAIN aktif ronde ini (Gojo): damage musuh dikurangi 50%
  const domainOn = bt.domainNow;
  const pa=bt.active;
  const entryTrig=!!(fx.entryCounter&&bt.entryGuard[pa]);
  const dodgeTrig=!!(fx.dodgeEvery&&bt.dodgeArmed[pa]);
  /* PIERCE lawan (Promised Child, Namekian, Limitless, Heaven's Door, Shinobu): tembus total pertahanan pemain */
  const ePierce=!!(efx.ignoreDef||(efx.pierce&&Math.random()*100<efx.pierce));
  const evade=!ePierce&&!!(entryTrig||dodgeTrig||(fx.evasion&&t<=fx.evasion.turns&&Math.random()*100<fx.evasion.chance)||(fx.dodgeAtk&&Math.random()*100<fx.dodgeAtk.chance)||bt.trickNext);
  const eVoid=!!(efx.void&&Math.random()*100<efx.void);
  if(evade){
    if(entryTrig)bt.entryGuard[pa]=false;
    if(dodgeTrig)bt.dodgeArmed[pa]=false;
    /* ULTRA INSTINCT: tiap berhasil menghindar → +pct% ATK permanen, stack sampai max (khusus dodgeAtk; evasion biasa gak kepengaruh) */
    if(fx.dodgeAtk&&fx.dodgeAtk.nextOnly){bt.dodgeNext=bt.dodgeNext||new Array(bt.fighters.length).fill(0);bt.dodgeNext[bt.active]=(bt.dodgeNext[bt.active]||0)+fx.dodgeAtk.pct;}else if(fx.dodgeAtk&&bt.dodgeStack[bt.active]<fx.dodgeAtk.max){bt.dodgeStack[bt.active]++;bt.atkBuff[bt.active]+=fx.dodgeAtk.pct;setTimeout(()=>floatText(".fighter.me","+"+fx.dodgeAtk.pct+"% ATK","heal"),bsMs(420));}
    if(id==="CH_EX_MADARA"){
      anim(".fighter.foe","lunge-l");
      setTimeout(()=>{if(window.playMatrixDodgeFx)window.playMatrixDodgeFx(".fighter.me");floatText(".fighter.me","LIMBO","miss");},bsMs(220));
    }else{
      setTimeout(()=>{if(window.playMatrixDodgeFx)window.playMatrixDodgeFx(".fighter.me");floatText(".fighter.me",entryTrig?(fx.entryCounter.text||"AMENOTEJIKARA"):bt.trickNext?"TRICKSTER":"DODGE","miss");},bsMs(200));
    }
    /* AMENOTEJIKARA counter: balasan instan mult× ATK ke musuh (dilewati kalau mult 0 = klon murni menghindar) */
    if(entryTrig){
      const cAtk=Math.round(cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk*(1+(bt.atkBuff[pa]||0)/100)*(fx.entryCounter.mult||0));
      if(cAtk>0){
        bt.eHp-=cAtk;
        setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","COUNTER -"+fmt(cAtk),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(520));
        if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
      }
    }
  }else if(eVoid){
    anim(".fighter.foe","lunge-l");
    const vh=Math.round(bt.es.atk*efx.void/100*2);
    setTimeout(()=>floatText(".fighter.me","VOID","miss"),bsMs(200));
    if(bt.eHp>0){bt.eHp=Math.min(bt.es.hp,bt.eHp+vh);setTimeout(()=>floatText(".fighter.foe","+"+fmt(vh),"heal"),bsMs(420));setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);}
  }else{
    let eAtk=bt.es.atk,edmgMult=1;
if(bt.ePoison>0)eAtk=Math.max(1,Math.round(eAtk*(1-Math.min(90,bt.ePoison)/100)));
    if((bt.eInk||0)>0&&bt.eInkPct>0)eAtk=Math.max(1,Math.round(eAtk*(1-(bt.eInk*bt.eInkPct)/100)));
    if(efx.lowHpAtk&&bt.eHp<bt.es.hp*efx.lowHpAtk.below/100){
      eAtk=Math.round(eAtk*(1+efx.lowHpAtk.bonus/100));
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","DESPERATE ATK +"+efx.lowHpAtk.bonus+"%","crit");},bsMs(180));
    }
    if(efx.dmgMult&&efx.dmgMult>1){
      edmgMult*=efx.dmgMult;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","BOOST DMG x"+efx.dmgMult,"crit");},bsMs(180));
    }
    if(efx.highHpDmg&&bt.eHp>bt.es.hp*efx.highHpDmg.above/100){
      edmgMult*=(1+efx.highHpDmg.bonus/100);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","APEX STRIKE +"+efx.highHpDmg.bonus+"%","crit");},bsMs(180));
    }
    const eHits=[{mult:1}];let ecrit=false,epurple=false,eBarrageN=0;
    if(typeof efx.double==="object"){if(Math.random()*100<(efx.double.chance!=null?efx.double.chance:100))eHits.push({mult:(efx.double.pct!=null?efx.double.pct:100)/100});}else if(efx.double&&Math.random()*100<efx.double)eHits.push({mult:1});
    if(efx.crit&&Math.random()*100<efx.crit.chance){ecrit=true;eHits[eHits.length-1].mult*=efx.crit.mult;}
    else if(Math.random()*100<BASE_CRIT.chance){ecrit=true;eHits[eHits.length-1].mult*=BASE_CRIT.mult;}
    if(efx.purple&&Math.random()*100<efx.purple.chance){epurple=true;ecrit=true;eHits[eHits.length-1].mult*=efx.purple.mult;}
    if(efx.ranton&&Math.random()*100<efx.ranton.chance){eranton=true;ecrit=true;eHits.length=0;const rh=Math.max(1,efx.ranton.hits||5),rm=efx.ranton.mult||1;for(let k=0;k<rh;k++)eHits.push({mult:rm});}
    if(efx.barrage&&Math.random()*100<efx.barrage.chance){const n=efx.barrage.min+Math.floor(Math.random()*(efx.barrage.max-efx.barrage.min+1));const bm=efx.barrage.mult||1;if(bm!==1){eHits.length=0;for(let i=0;i<n;i++)eHits.push({mult:bm});}else{while(eHits.length<n)eHits.push({mult:1});}eBarrageN=eHits.length;}
    if(eranton&&!eBarrageN)eBarrageN=eHits.length;
    /* ICE BLAST (kartu BOSS sebagai LAWAN): N tembakan @ pct% ATK */
    if(efx.iceBlast&&Math.random()*100<efx.iceBlast.chance){const n=Math.max(1,efx.iceBlast.hits||3),pm=(efx.iceBlast.pct!=null?efx.iceBlast.pct:100)/100;eHits.length=0;for(let i=0;i<n;i++)eHits.push({mult:pm});eIceBlast=true;eBarrageN=n;}
    if(efx.domain&&bt.eid==="CH_EX_GOJO"&&Math.random()*100<(efx.domain.chance||100)){const dn=efx.domain.min||10,dm=(efx.domain.mult!=null?efx.domain.mult:.3);eHits.length=0;for(let i=0;i<dn;i++)eHits.push({mult:dm});eBarrageN=dn;ecrit=false;epurple=false;eranton=false;eDomain=true;}
    eArise=bt.eid==="CH_EX_JINWOO"&&eBarrageN>=9;
    eGalaxy=bt.eid==="CH_ETERNAL_DRAGON"&&epurple;
    if(eGalaxy){const m=eHits[eHits.length-1].mult;eHits.length=0;eHits.push({mult:m});eBarrageN=0;}
    eBajrang=false;
    if(efx.bajrangGun&&!bt.eBajrangUsed){
      bt.eBajrangUsed=true;eBajrang=true;edmgMult*=efx.bajrangGun.mult;
      if(!fx.statusImmune)bt.pStun=Math.max(bt.pStun||0,efx.bajrangGun.stun||1);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","BAJRANG GUN!","crit");},bsMs(180+BJ_T.first-80));
    }
    let eHollowPurple=false;
    if(efx.flood&&efx.flood.label==="HOLLOW PURPLE"){
      bt.eFloodCount=(bt.eFloodCount||0)+1;
      if(bt.eFloodCount%efx.flood.every===0){
        eHollowPurple=true;edmgMult*=efx.flood.mult;
        setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","HOLLOW PURPLE","crit");},bsMs(180+HP_T.first-80));
      }
    }
    ePsychicActive=null;
    if(efx.psychicBarrage){
      const pbn=efx.psychicBarrage.rocks||5;
      eHits.length=0;for(let i=0;i<pbn;i++)eHits.push({mult:efx.psychicBarrage.mult||1.9});
      eBarrageN=pbn;
      ePsychicActive={n:pbn,revived:false};
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","PSYCHIC BARRAGE x"+pbn,"crit");},bsMs(300));
    }
    if(typeof foeAttackMods==="function"){edmgMult*=foeAttackMods(eHits);if(eHits.length>1&&!eBarrageN)eBarrageN=eHits.length;}
    const fst=(typeof foeState==="function")?foeState():((bt&&bt.es&&bt.es.__fp)||bt.foeSt||{});
    if(efx.worldEnder){eWorldEnder={phase:((fst.we||1)-1)%3,revived:!!fst.weRev};}
    if(efx.everyNth&&efx.everyNth.text==="GAMMA RAY BURST"&&fst&&fst.atkN%efx.everyNth.n===0){eGammaRay=true;ecrit=true;}
    let etotal=0;const eShots=eHits.map(h=>{let d=Math.round(eAtk*edmgMult*h.mult);let drR=(bt.pDrTurns>0&&bt.pDr>0)?bt.pDr:0;if((bt.pGuardDr||0)>drR)drR=bt.pGuardDr;const pWe=!!(eWorldEnder&&eWorldEnder.phase===2)||eGammaRay;if(drR>0&&!ePierce&&!pWe){d=Math.round(d*(1-drR/100));}etotal+=d;return{d,pierce:ePierce||pWe};});
    /* ROYALGUARD: damage masuk dipangkas 50% (dibalas 30% di bawah) */
    if(!ePierce&&bt.royalNow&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*0.5));etotal=eShots.reduce((x,s)=>x+s.d,0);}
    /* PERFECT SUSANOO (low HP): damage masuk dipangkas `dr`% */
    if(!ePierce&&fx.lowHpAura&&bt.pHp<bt.pMax*fx.lowHpAura.below/100&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.lowHpAura.dr/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);setTimeout(()=>floatText(".fighter.me","PERFECT SUSANOO","heal"),bsMs(320));}
    /* PSYCHIC BLIZZARD (BLIZZARD BADDIE): barrier aktif -> pangkas damage `dr`% + heal `healPct`% max HP per serangan yang diredam; barrier habis setelah `left` giliran */
    if(!ePierce&&bt.psychic&&bt.psychic.left>0&&etotal>0){
      eShots.forEach(s=>s.d=Math.round(s.d*(1-bt.psychic.dr/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);
      const bh=Math.max(1,Math.round(bt.pMax*bt.psychic.healPct/100));
      bt.pHp=Math.min(bt.pMax,bt.pHp+bh);setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","PSYCHIC BARRIER +"+fmt(bh),"heal");},bsMs(360));
      bt.psychic.left--;
      if(bt.psychic.left<=0)setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","BARRIER DOWN","miss");},bsMs(520));
    }
    /* ICE SHELL (10TH CAPTAIN): selama kartu ini AKTIF di arena, damage masuk dipangkas `iceShell`% permanen (tanpa timer; hilang pas tag-out) */
    if(!ePierce&&fx.iceShell&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.iceShell/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}
    /* SHADOW ARMY (SHADOW KING): selama masih ada Shadow hidup, damage masuk dipangkas dr% */
    if(!ePierce&&fx.shadowArmy&&skLivingShadows().length&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-(fx.shadowArmy.dr||15)/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}
   /* TWILIGHT OF VALHALLA (HEIGHT OF PAINTING): selama aktif, damage masuk dipangkas dmgCut% */
   if(!ePierce&&fx.valhalla&&(bt.valhallaLeft||0)>0&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.valhalla.dmgCut/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}
   /* INK WARD (INK ANAMLOY): selama kartu aktif, damage masuk dipangkas dmgCut% (pola iceShell) */
   if(!ePierce&&fx.dmgCut&&etotal>0){eShots.forEach(s=>s.d=Math.round(s.d*(1-fx.dmgCut.pct/100)));etotal=eShots.reduce((x,s)=>x+s.d,0);}

    /* RUBBER FIELD (SUN GOD): serangan dipotong 50%, sisanya disimpan buat memantul balik + penyerang jadi DIZZY */

    bt.rbBounce=0;

    if(!ePierce&&bt.rubber&&etotal>0){

      const full=etotal;

      eShots.forEach(s=>s.d=Math.round(s.d*0.5));etotal=eShots.reduce((x,s)=>x+s.d,0);

      bt.rbBounce=full-etotal;

      if(!foeStatusImmune()){bt.dizzyStack=(bt.dizzyStack||0)+1;bt.dizzyLeft=9;setTimeout(()=>{if(bt&&!bt.over){floatText(".fighter.foe","DIZZY x"+bt.dizzyStack,"burn");if(window.showDizzyCrown)showDizzyCrown(".fighter.foe");}},bsMs(420));}

    }
    /* EVOLUTION TURRET (YORDLE INVENTOR): kena serangan -> chance% turret nahan semua damage, 1 turret hancur */
    if(!ePierce&&fx.turret&&bt.turret>0&&etotal>0&&Math.random()*100<fx.turret.blockPct){
      etotal=0;eShots.forEach(s=>s.d=0);bt.turret--;
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TURRET BLOCK! left "+bt.turret,"crit");},bsMs(320));
    }    /* GUM-GUM BALLOON (DUMB STRETCHY GUY): reflect % dari hit musuh berikutnya (sekali pakai) */
    if(!ePierce&&bt.balloon>0&&etotal>0){
      const rd=Math.max(1,Math.round(etotal*bt.balloon/100));
      bt.balloon=0;bt.eHp-=rd;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","BALLOON -"+fmt(rd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(380));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));}
    }
    if(bt.pDrTurns>0&&bt.pDr>0){bt.pDrTurns--;setTimeout(()=>floatText(".fighter.me","DR ACTIVE","heal"),bsMs(340));}
    /* BUNGEE GUM: tiap kali musuh KENA menempel ke Trickster (serangan masuk), tempel/renew gum 2 giliran */
    if(fx.bungeeGum&&etotal>0){bt.gumTurns=fx.bungeeGum.turns;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","BUNGEE GUM","crit");},bsMs(300));}
    /* GODHAND CAUSALITY (WHITE HAWK): diserang & kena -> ability musuh dimatikan permanen */
    if(fx.stripAbility&&etotal>0){bt.eAbilityOff=999;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe","GODHAND - ABILITY ERASED","crit");},bsMs(300));}
    const meStart=bt.pHp;
    bt.pHp-=etotal;
    if(fx.valhalla&&(bt.valhallaLeft||0)>0&&bt.pHp<1){bt.pHp=1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","TWILIGHT HOLD!","heal");},bsMs(300));}
    /* REVERSAL (TIME MASTER): serangan mematikan PERTAMA dibalik -> 1 HP (sekali) */
    if(fx.reversal&&bt.pHp<=0){bt.reversalUsed=bt.reversalUsed||new Array(bt.fighters.length).fill(false);if(!bt.reversalUsed[bt.active]){bt.reversalUsed[bt.active]=true;bt.pHp=1;setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GOLD EXPERIENCE REQUIEM!","crit");},bsMs(400));}}
    /* CAUSALITY (ASTRAL DEVOURER): fatal -> balik ke HP awal giliran sebelumnya + atkBuff */
    if(fx.causality&&bt.pHp<=0){bt.causalUsed=bt.causalUsed||new Array(bt.fighters.length).fill(false);if(!bt.causalUsed[bt.active]){bt.causalUsed[bt.active]=true;bt.pHp=Math.max(1,bt.causalPrev||bt.pMax);bt.atkBuff[bt.active]+=fx.causality.atkPct;if(window.causalityFx)causalityFx(".fighter.me");setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","KAUSALITAS DIBALIK! +"+fx.causality.atkPct+"% ATK","crit");},bsMs(400));}}
    const pDead=bt.pHp<=0&&!(fx.berserker&&bt.berserkOn&&(bt.berserkLeft||0)>0);
    // kartu tumbang: tag-in / kalah BARU dijalankan setelah seluruh animasi sambaran musuh selesai
    const deathStep=()=>{
      if(!bt||bt.over)return;
      if(domainOn){bt.domainNow=false;}
      bt.turn++;
      /* DEATH STAY (TREMOR EMPEROR): fatal -> bertahan 1 giliran extra (masih menyerang), jatuh di awal enemyPhase berikutnya */
      if(fx.deathStay){bt.stayUsed=bt.stayUsed||new Array(bt.fighters.length).fill(false);if(!bt.stayUsed[bt.active]){bt.stayUsed[bt.active]=true;bt.defyHold=true;bt.pHp=1;setBar("hpMe","hpMeT",1,bt.pMax);setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","GURA GURA HOLD!","crit");},bsMs(400));schedPhase(1100,playerPhase);return;}}
      /* DEATH DEFY (THREEBLADE RONIN): fatal saat HP sebelum pukulan masih < pct% max
         -> TIDAK tumbang: bertahan di 0 HP, dapat 1 giliran ekstra (masih bisa menyerang),
         lalu jatuh di awal enemyPhase berikutnya. Sekali per battle. (fx={}=saat shadow -> gak trigger) */
      if(fx.deathDefy&&!bt.defyUsed[bt.active]&&meStart<bt.pMax*fx.deathDefy.pct/100){
        bt.defyUsed[bt.active]=true;bt.defyHold=true;bt.pHp=0;
        setBar("hpMe","hpMeT",0,bt.pMax);
        setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","ASHURA STANDS","crit");},bsMs(400));
        schedPhase(1100,playerPhase);
        return;
      }
      if(!trySave()){endBattle(false);return;}
      schedPhase(bt.justTagged?1350:700,playerPhase);
    };
    performAttack({
      A:".fighter.foe",D:".fighter.me",id:bt.eid,fx:efx,
      barId:"hpMe",barTid:"hpMeT",defMax:bt.pMax,
      defHpStart:meStart,defHpEnd:Math.max(0,bt.pHp),
      shots:eShots,total:etotal,crit:ecrit,purple:epurple,
      ranton:eranton,domainStrike:eDomain,ariseMode:eArise,barrageN:eBarrageN,galaxy:eGalaxy,iceBlast:eIceBlast,bajrang:eBajrang,hollowPurple:eHollowPurple,havoc:!!bt.eHavocAnimTurn,psychic:ePsychicActive,worldEnder:eWorldEnder,gammaRay:eGammaRay,
      onAnimEnd:pDead?deathStep:null,
      recharge:(b)=>{if(!bt)return;bt.eStun=b.selfStun;setTimeout(()=>floatText(".fighter.foe","RECHARGE","miss"),bsMs(1200));}
    });
    bt.eHavocAnimTurn=false;
    setBar("hpMe","hpMeT",meStart,bt.pMax);
    if(typeof foeOnHitLanded==="function")foeOnHitLanded(etotal);
    if(efx.lifesteal&&etotal>0&&bt.eHp>0){
      const lh=Math.round(etotal*efx.lifesteal/100);bt.eHp=Math.min(bt.es.hp,bt.eHp+lh);
      setTimeout(()=>floatText(".fighter.foe","+"+fmt(lh),"heal"),bsMs(280));
      setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    }
        /* MIRROR INK DRAIN: musuh heal pct% dari damage yang baru DIBERIKAN */
    if(efx.inkDrain&&etotal>0){bt.ePaint=(bt.ePaint||0)+1;if(bt.ePaint%efx.inkDrain.every===0){const ih=Math.max(1,Math.round(etotal*efx.inkDrain.pct/100));bt.eHp=Math.min(bt.es.hp,bt.eHp+ih);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);setTimeout(()=>floatText(".fighter.foe","INK DRAIN +"+fmt(ih),"heal"),bsMs(320));}}
    /* COUNTER HIT (DRAGON SIN base atk / BLOODMOON base foeMaxHp): kena serangan -> balas flat */
  if(fx.counterHit&&etotal>0&&bt.eHp>0&&Math.random()*100<fx.counterHit.chance){
    const cb=(fx.counterHit.base==="foeMaxHp")?bt.es.hp:cardStats(id,bt.eq.mut,bt.eq.trait,bt.eq.shiny).atk;
    const cd=Math.max(1,Math.round(cb*fx.counterHit.pct/100));
    bt.eHp-=cd;
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe",(fx.counterHit.base==="foeMaxHp"?"BLOOD IGNITE -":"FULL COUNTER -")+fmt(cd),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));
    if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
  }
  /* ROYALGUARD counter: balas 30% dari damage yang baru diterima ke musuh */
    if(bt.royalNow&&!pDead&&etotal>0){
      const ctr=Math.round(etotal*0.3);bt.eHp-=ctr;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","COUNTER -"+fmt(ctr),"crit");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(560));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
        /* RUBBER FIELD bounce: separuh damage serangan musuh memantul balik ke penyerang */
    if(bt.rbBounce>0&&!pDead){
      const rb=bt.rbBounce;bt.rbBounce=0;
      bt.eHp-=rb;
      if(window.rubberBounceFx)rubberBounceFx();
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","RUBBER -"+fmt(rb),"rubber");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(320));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }

    if(pDead)return;
  }
  /* WORLD CORRUPT (THE GRIEFER): counter giliran musuh; tiap every -> musuh self-hit + party +dmgUp% dmg */
  if(bt.wc&&bt.eHp>0&&bt.pHp>0){
    bt.wc.c++;
    if(bt.wc.c%bt.wc.every===0){
      const wd=Math.max(1,Math.round(bt.wc.atk*bt.wc.pct/100));
      bt.eHp-=wd;
      for(let i=0;i<bt.fighters.length;i++)bt.atkBuff[i]=(bt.atkBuff[i]||0)+bt.wc.dmgUp;
      setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","GLITCH! -"+fmt(wd),"crit");floatText(".fighter.me","+"+bt.wc.dmgUp+"% DMG","heal");setBar("hpFoe","hpFoeT",Math.max(0,bt.eHp),bt.es.hp);}},bsMs(500));
      if(bt.eHp<=0){setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(900));return;}
    }
  }
  if(domainOn){bt.domainNow=false;}
  bt.turn++;
  schedPhase(bt.justTagged?1350:(eBajrang?BJ_T.first+1300:eGammaRay?1500:eWorldEnder?1350:ePsychicActive?Math.max(1000,PSY_T.first+(ePsychicActive.n-1)*PSY_T.step+640):eGalaxy?GALAXY.total+160:eArise?2200:eDomain?1700:eranton?MADARA_T.total+160:1000),playerPhase);
}
function endBattle(win){
  if(!bt||bt.over)return;
  if(bt.timer){clearTimeout(bt.timer);bt.timer=null;}
  bt.over=true;
  /* klimaks: kartu yang kalah beneran tumbang (dulu final death gak ada animasi mati sama sekali) */
  try{
    const deadEl=document.querySelector(win?".fighter.foe":".fighter.me");
    if(deadEl&&!deadEl.classList.contains("ko")){deadEl.classList.add("ko");koFx(deadEl);}
    if(typeof window.hzAnimateDeathAndSwap==="function"){
      window.hzAnimateDeathAndSwap(win?"foe":"me",win?(bt.en||null):(bt.eq||null),null);
    }
  }catch(e){console.error("endBattle fx error",e);}
  setTimeout(()=>{
    /* Banner keluar hazard TIDAK dipakai untuk hasil battle (revisi user):
       popup VICTORY/DEFEAT (atau DROP REPORT tower) tampil dulu; banner exit
       hanya dipakai saat pemain benar-benar keluar dari popup ke lobby lewat
       leaveBattleToLobby()/hzEnd. Ini menghentikan banner exit yang dulu muncul
       tiap selesai battle dan tiap naik lantai di Tower Infinite. */
    try{
      if(bt&&bt.tower){ towerEnd(win); }
      else if(bt){ finish(win); }
      /* bt keburu di-null tapi masih di tower battle → tetap tutup lewat towerEnd
         (null-safe utk bt) supaya pendingRolls cair, popup roll muncul & pemain balik hub. */
      else if(towerRun&&towerView==="battle"){ towerEnd(win); }
      else{ console.error("endBattle: no battle context, win="+win); }
    }catch(err){
      console.error("finish error",err);
      let recovered=false;
      try{ if(!win&&towerRun){ towerEnd(false); recovered=true; } }catch(e2){ console.error("towerEnd retry error",e2); }
      try{save();}catch(e){}
      if(recovered)return;
      bt=null;state.battle=null;render();
    }
  },bsMs(win?2000:950));
}
function finish(win){
  clearTimeout(bt.timer);bt.over=true;
  const lv=bt.lv,first=!diffProg()[state.diff][lv];
  const reward=win?(first?firstClearReward(lv):Math.round(firstClearReward(lv)*.2)):0;
  /* 0028: coin HANYA ditambah lokal saat tidak ada sesi cloud. Kalau ada sesi,
     saldo menunggu jawaban RPC (server yang membayar). Dulu angka optimis
     ditahan walau klaim gagal, sehingga coin lokal bisa jauh di atas saldo
     server — persis pola yang dipakai penalti 0028 untuk mendeteksi F12. */
  const coinLocal=!(typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.claimStoryCoins);
  if(win&&!first)storySetCd(lv);
  if(win){state.cleared[lv]=true;diffProg()[state.diff][lv]=true;if(coinLocal)state.coins+=reward;xpGain(20);
    fanfare();
    /* 0025: coin dibayar server (first clear sekali, replay ber-cooldown 5 menit).
       Angka lokal di atas cuma untuk UI; klaim yang menetapkan saldo sebenarnya.
       COOLDOWN = server belum setuju (mis. replay terlalu cepat) → tarik kembali. */
    (async()=>{
      if(!(typeof currentUser!=="undefined"&&currentUser&&window.CloudDB&&window.CloudDB.claimStoryCoins))return;
      let res=null;
      try{res=await window.CloudDB.claimStoryCoins(currentUser,lv,state.diff);}catch(e){res=null;}
      if(res&&res.ok){try{renderShell();save();}catch(e){}return;}
      if(coinLocal&&res&&(res.msg==="COOLDOWN"||res.msg==="ALREADY"||res.msg==="DAILY_CAP"||res.msg==="UNREACHABLE")){
        state.coins=Math.max(0,(state.coins||0)-reward);
      }
      /* res null = jaringan: saldo tetap angka server (tidak ada tambahan lokal). */
      try{renderShell();save();}catch(e){}
    })();
  }else sfx.lose();
  state.history.unshift({char:bt.eq.char,tier:bt.eq.tier,enemy:bt.en.name+(bt.en.boss?", "+bt.en.epithet:""),boss:bt.en.boss,level:lv,result:win?"VICTORY":"DEFEAT"});
  state.history=state.history.slice(0,120);
  save();renderShell();
  const ov=document.getElementById("overlay");
  const ch=chapOf(lv),chDone=win&&chapClearedMode(ch,state.diff),nxtCh=CHAPTERS.find(c=>c.no===ch.no+1);
  /* GEM story dibayar TIAP stage: first clear sekali per (stage x mode), replay
     tiap kali kooldown stage itu lewat — plus bonus saat bab tamat. */
  let gemGain=0,gemLabel="";
  if(win){
    if(first){const g=claimStageGem(lv,state.diff);if(g){gemGain=g;gemLabel="STAGE "+lv;}}
    else{const g=claimStoryRepeatGem(lv,state.diff);if(g){gemGain=g;gemLabel="REPLAY STAGE "+lv;}}
    if(chDone){const b=claimStoryMilestone(ch.no,state.diff);if(b){gemGain+=b;gemLabel+=(gemLabel?" + ":"")+"CHAPTER "+ch.no;}}
  }
  const ovCard=document.getElementById("ovCard");
  if(ovCard){
    ovCard.classList.toggle("is-win",!!win);
    ovCard.classList.toggle("is-lose",!win);
  }
  const eyeText=chDone?"CHAPTER "+ch.no+" CLEARED ("+diffOf().l+")":win?(first?"FIRST CLEAR":"MISSION CLEARED"):"MISSION FAILED";
  document.getElementById("ov-eyebrow").textContent=eyeText;
  const sysMeta=document.getElementById("ovSysMeta");
  if(sysMeta)sysMeta.textContent=win?"[QUEST COMPLETE : REWARD GRANTED]":"[TACTICAL RETREAT : UNIT DEFEATED]";
  const serial=document.getElementById("ovSysSerial");
  if(serial)serial.textContent="0x"+(0x1000+Math.floor(Math.random()*0xefff)).toString(16).toUpperCase();
  const ti=document.getElementById("ov-title");
  ti.textContent=win?"VICTORY":"DEFEAT";
  ti.className="ov-title disp"+(win?"":" lose");
  const tiBg=document.getElementById("ovTitleBg");
  if(tiBg)tiBg.textContent=win?"VICTORY":"DEFEAT";

  /* Bintang: prototipe 3 bintang, makin cepat makin penuh. Kalah = 0. */
  const starsEl=document.getElementById("ovStars");
  if(starsEl){
    const got=win?(bt.turn<=6?3:bt.turn<=10?2:1):0;
    const list=starsEl.querySelectorAll(".ov-star");
    for(let i=0;i<list.length;i++)list[i].classList.toggle("off",i>=got);
    starsEl.style.display="flex";
  }

  const rwCard=document.getElementById("ovRewardCard");
  if(rwCard){rwCard.style.display=win?"flex":"none";rwCard.classList.toggle("hide",!win);}
  const rw=document.getElementById("ov-reward");
  if(rw){
    rw.style.display=win?"inline-flex":"none";
    rw.classList.toggle("hide",!win);
    rw.innerHTML='<span class="ov-rw-ic">'+coinIcon(16)+'</span>'
      +'<span class="ov-rw-info"><span class="ov-rw-v">+'+fmt(reward)+'</span>'
      +'<span class="ov-rw-l">COINS</span></span>';
  }
  const ms=document.getElementById("ovGemMilestone");
  if(ms){
    const showGem=!!(win&&gemGain>0);
    ms.classList.toggle("hide",!showGem);
    if(showGem){
      ms.style.display="flex";
      ms.innerHTML='<img class="ov-gem-ms-ic" src="assets/images/premium-currency.webp" alt="" width="30" height="30">'
        +'<div class="ov-gem-ms-txt">'
          +'<span class="ov-gem-ms-k">STORY GEM &bull; '+gemLabel.toUpperCase()+' &bull; '+diffOf().l+'</span>'
          +'<span class="ov-gem-ms-v">+'+gemGain+' <small>GEM</small></span>'
        +'</div>';
    }else{
      ms.style.display="none";
      ms.innerHTML="";
    }
  }
  const tokEl=document.getElementById("ovTokenGain");
  if(tokEl){tokEl.style.display="none";tokEl.classList.add("hide");tokEl.innerHTML="";}

  /* MVP: kartu operator yang menang + total damage yang dicatat setBar. */
  const mvp=document.getElementById("ovMvp");
  if(mvp){
    const showMvp=!!(win&&bt.eq);
    mvp.classList.toggle("hide",!showMvp);
    if(showMvp){
      const ch2=bt.eq.char;
      const img=document.getElementById("ovMvpImg");
      if(img){
        try{img.src=(typeof cardThumb==="function")?cardThumb(ch2):(typeof cardImg==="function"?cardImg(ch2):"");}catch(e){}
        img.alt="";
      }
      const nEl=document.getElementById("ovMvpName");
      if(nEl){try{nEl.textContent=cardName(ch2);}catch(e){nEl.textContent=bt.en.name;}}
      const sEl=document.getElementById("ovMvpSub");
      if(sEl){
        const bits=[];
        if(bt.eq.shiny)bits.push("SHINY");
        try{if(bt.eq.mut&&bt.eq.mut!=="none"&&typeof MUT_LABEL!=="undefined"&&MUT_LABEL[bt.eq.mut])bits.push(MUT_LABEL[bt.eq.mut]);}catch(e){}
        try{if(bt.eq.trait&&bt.eq.trait!=="none"&&typeof traitLabel==="function"){const tl=traitLabel(bt.eq.trait);if(tl)bits.push("TRAIT "+tl);}}catch(e){}
        sEl.textContent=bits.length?bits.join(" · "):"DECK OPERATOR";
      }
      const dEl=document.getElementById("ovMvpDmg");
      if(dEl)dEl.innerHTML=fmt(Math.round(bt.dmgDone||0))+"<br>DMG";
      mvp.style.display="flex";
    }else{
      mvp.style.display="none";
    }
  }

  const cStat=document.getElementById("ovCombatStatus");
  if(cStat){
    cStat.textContent=win?"SECURED":"LOST";
    cStat.className="ov-tel-val"+(win?" win":" lose");
  }
  const turnsEl=document.getElementById("ovTurns");
  if(turnsEl)turnsEl.textContent=String(bt.turn||0).padStart(2,"0");
  const timeEl=document.getElementById("ovTime");
  if(timeEl){
    const secs=Math.max(0,Math.round((Date.now()-(bt.t0||Date.now()))/1000));
    timeEl.textContent=String(Math.floor(secs/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");
  }

  document.getElementById("ov-note").textContent=win?(first?"First clear bonus":"Replay clear")+" · "+bt.turn+" turn":"Not enough power · Upgrade your card";
  const nx=document.getElementById("ov-next");nx.style.display="";
  if(win&&lv<ch.to){
    nx.innerHTML='<span>STAGE '+(lv+1)+'</span> <span class="ov-btn-icon">❯</span>';
    nx.onclick=()=>{ov.classList.remove("show");startStoryBattle(lv+1);};
  }else if(win&&nxtCh){
    nx.innerHTML='<span>RETURN</span> <span class="ov-btn-icon">❯</span>';
    nx.onclick=()=>leaveBattleToLobby();
  }else{
    nx.innerHTML='<span>COMPLETE</span> <span class="ov-btn-icon">❯</span>';
    nx.onclick=()=>leaveBattleToLobby();
  }
  document.getElementById("ov-again").onclick=()=>{ov.classList.remove("show");startStoryBattle(lv);};
  ov.classList.add("show");
}
/* Keluar dari popup hasil ke lobby. Banner exit hazard baru dipakai DI SINI:
   popup VICTORY/DEFEAT tampil dulu, lalu curtain menutup layar saat benar-benar
   berpindah ke lobby. Lanjut stage berikutnya / replay / naik lantai tower TIDAK
   lewat sini, jadi tidak ada banner exit di tengah alur battle. */
function leaveBattleToLobby(){
  const ov=document.getElementById("overlay");
  if(ov)ov.classList.remove("show");
  const done=()=>{
    try{ stopBattleLoop(); }catch(e){}
    try{ stopRaid(); }catch(e){}
    try{ stopTower(); }catch(e){}
    state.battle=null; bt=null;
    try{ closeStory(); }catch(e){}
    try{ render(); }catch(e){ console.error("leaveBattleToLobby render",e); }
  };
  if(typeof window.hzCurtainOut==="function"){
    try{ window.hzCurtainOut(done); return; }catch(e){}
  }
  done();
}
document.getElementById("overlay").addEventListener("click",e=>{
  if(e.target.id!=="overlay")return;
  if(bt&&bt.tower){document.getElementById("overlay").classList.remove("show");stopBattleLoop();towerView="hub";render();return;}
  leaveBattleToLobby();
});
let towerLossAutoPending=false; /* auto-restart tower: nunggu popup roll ditutup (reset di stopTower/towerStartRun) */
let rollPopTimer=null; /* auto-claim popup hasil roll: 5 detik tutup sendiri biar AFK/auto-run gak macet */
function closeRollPop(){ if(rollPopTimer){clearTimeout(rollPopTimer);rollPopTimer=null;} const pop=document.getElementById("rollResultPop"); if(pop)pop.classList.remove("show"); rollPopClosed(); }
function armRollPopAutoClose(ms){
  if(rollPopTimer)clearTimeout(rollPopTimer);
  rollPopTimer=setTimeout(()=>{
    rollPopTimer=null;
    const pop=document.getElementById("rollResultPop");
    if(!pop||!pop.classList.contains("show"))return;
    try{sfx.hit();}catch(e){}
    pop.classList.remove("show"); /* kartu+potion SUDAH tersimpan (instantRoll save()) — ini tampilan doang: tutup = auto-claim */
    rollPopClosed();
  },ms);
}
function rollPopClosed(){ if(!towerLossAutoPending)return; towerLossAutoPending=false; if(state&&state.tower&&state.tower.auto){ try{ towerStartRun(); }catch(e){ console.error("tower auto-restart error",e); } } }
const rrCloseEl = document.getElementById("rrClose");
if (rrCloseEl) rrCloseEl.onclick=()=>{try{sfx.hit();}catch(e){}closeRollPop();};
const rrBackEl = document.querySelector("#rollResultPop .rr-back");
if (rrBackEl) rrBackEl.onclick=()=>{closeRollPop();};

