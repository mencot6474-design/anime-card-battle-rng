/* =============== FOE PASSIVES (passive kartu musuh = passive kartu player) ===============
   Dimuat SETELAH battle.js & tower-lobby.js. Dipanggil dari hook kecil di battle.js / tower-lobby.js.
   State per-musuh disimpan di bt.es.__fp (objek es unik per gelombang/battle, jadi otomatis reset).
   Aturan keamanan: damage tambahan dari passive musuh dibatasi 25% max HP kartu player dan tidak
   pernah membunuh sendiri (min 1 HP) - pukulan akhir tetap harus lewat serangan utama. */
function foeState(){
  if(!bt||!bt.es)return {};
  if(!bt.es.__fp)Object.defineProperty(bt.es,"__fp",{value:{turns:0,atkN:0,sp:0,gates:0,style:0,we:0,turret:0,spTurn:0,spCd:0,atkBuff:0},enumerable:false,writable:true});
  return bt.es.__fp;
}
function foeActiveFx(){return (bt&&bt.eAbilityOff>0)?{}:((bt&&bt.efx)||{});}
function foePlayerImmune(){try{const f=resolveFx(bt.eq,bt.efx);return !!(f&&f.statusImmune);}catch(e){return false;}}
/* damage flat ke kartu player dari passive musuh: capped 25% max HP, minimal sisa 1 HP */
function foeHitPlayer(raw,label,delay){
  if(!bt||bt.over||!(bt.pHp>0))return 0;
  const d=Math.max(1,Math.min(Math.round(bt.pMax*0.25),Math.round(raw)));
  bt.pHp=Math.max(1,bt.pHp-d);
  setBar("hpMe","hpMeT",bt.pHp,bt.pMax);
  setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.me","hit");floatText(".fighter.me",label+" -"+fmt(d),"burn");}},bsMs(delay||400));
  return d;
}
function foeFloat(txt,cls,delay){setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.foe",txt,cls||"crit");},bsMs(delay||200));}

/* ---- 1. SAAT MASUK (dipanggil di akhir applyFoeEntryPassives) ---- */
function foeEntryPassives(){
  if(!bt||bt.over||bt.eAbilityOff>0)return;
  const efx=bt.efx||{},st=foeState();
  if(efx.dupEntry&&!st.dup){
    st.dup=true;
    bt.es.hp=Math.round(bt.es.hp*2);bt.eHp=bt.es.hp;bt.es.atk=Math.round(bt.es.atk*2);
    setTimeout(()=>{if(bt&&!bt.over){setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);floatText(".fighter.foe","DATA DUPLICATED x2","crit");}},bsMs(420));
  }
  if(efx.entryAtkPct&&!st.eap){
    st.eap=true;
    foeHitPlayer(bt.es.atk*efx.entryAtkPct.pct/100,passiveName(bt.eid),460);
  }
  if(efx.entryShatter&&!st.esh){
    st.esh=true;
    foeHitPlayer(bt.pHp*efx.entryShatter.pct/100,"ALMIGHTY PUSH",500);
  }
  if(efx.meteorShower&&!st.msEntry){
    st.msEntry=true;
    foeHitPlayer(bt.pMax*efx.meteorShower.pct/100,"KEDATANGAN BINTANG",480);
  }
  if(efx.quake&&!st.qkEntry){
    st.qkEntry=true;
    foeHitPlayer(bt.pMax*efx.quake.pct/100,"GURA GURA GUM-GUM",480);
  }
  if(efx.sleepStrike&&!st.sleepInit){
    st.sleepInit=true;
    st.sleepLeft=efx.sleepStrike.turns;
    st.sleepArmed=true;
  }
  if(efx.turret&&!st.turretInit){
    st.turretInit=true;
    st.turret=efx.turret.start||2;
  }
  if(efx.senzu&&!st.senzuInit){
    st.senzuInit=true;
    st.senzuTurn=0;
    foeFloat("MUNCH MUNCH!","heal",420);
  }
  if(efx.stretch&&!st.stretchInit){
    st.stretchInit=true;
    foeFloat("GOMU GOMU... WAIT WHAT?!","crit",480);
  }
  if(efx.partyDmg&&!st.partyDmgInit){
    st.partyDmgInit=true;
    bt.es.atk=Math.round(bt.es.atk*(1+efx.partyDmg.pct/100));
    foeFloat("NARASI +"+efx.partyDmg.pct+"% DMG","heal",420);
  }
}

/* ---- 2. TIAP GILIRAN MUSUH, sebelum menyerang (dalam blok bt.pHp>0&&bt.eHp>0) ----
   Return true jika giliran musuh selesai tanpa menyerang (mis. tertidur / charging / mati overheat) */
function foeTurnPassives(){
  if(!bt||bt.over||!(bt.pHp>0)||!(bt.eHp>0))return false;
  const efx=foeActiveFx(),st=foeState();
  st.turns++;
  st.trickNext=false;st.royalNow=false;st.gunsNow=false;
  st.causalPrev=(st.causalNow==null)?bt.eHp:st.causalNow;st.causalNow=bt.eHp;

  /* HEAVY RAIN musuh: pulih healPct% max HP tiap giliran */
  if(bt.eRain&&bt.eRain.left>0){
    const rh=Math.max(1,Math.round(bt.es.hp*bt.eRain.healPct/100));
    bt.eHp=Math.min(bt.es.hp,bt.eHp+rh);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    foeFloat("HUJAN +"+fmt(rh),"heal",260);
    bt.eRain.left--;
  }
  /* UNLIMITED VOID (BLESSED SORCERER): HP < below% -> pulih ke healPct% + stun player */
  if(efx.unlimitedVoid&&!st.voidUsed&&bt.eHp<bt.es.hp*efx.unlimitedVoid.below/100){
    st.voidUsed=true;
    bt.eHp=Math.max(bt.eHp,Math.round(bt.es.hp*efx.unlimitedVoid.healPct/100));
    setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    foeFloat("UNLIMITED VOID","heal",220);
    if(!foePlayerImmune()){
      bt.pStun=Math.max(bt.pStun||0,efx.unlimitedVoid.turns);
      setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","UNLIMITED VOID","crit");},bsMs(460));
    }
  }
  /* TWILIGHT OF VALHALLA musuh: +atkPct% ATK tiap giliran; habis -> heal */
  if(efx.valhalla&&(bt.eValhallaLeft||0)>0){
    const vl=efx.valhalla;
    bt.es.atk=Math.round(bt.es.atk*(1+vl.atkPct/100));
    bt.eValhallaLeft--;
    foeFloat("TWILIGHT +"+vl.atkPct+"% ATK","heal",240);
    if(bt.eValhallaLeft<=0){
      const vh=Math.max(1,Math.round(bt.es.hp*vl.healPct/100));
      bt.eHp=Math.min(bt.es.hp,bt.eHp+vh);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
      foeFloat("TWILIGHT HABIS +"+fmt(vh),"heal",460);
    }
  }
  /* TURRET tambah tiap every giliran */
  if(efx.turret&&st.turns%efx.turret.every===0){
    st.turret=(st.turret||0)+1;
    foeFloat("TURRET +1 ("+st.turret+")","heal",320);
  }
  if(efx.dodgeEvery&&st.turns%efx.dodgeEvery.turns===0)st.dodgeArmed=true;
  if(efx.turnMaxHp&&!foePlayerImmune())foeHitPlayer(bt.pMax*efx.turnMaxHp.pct/100,"BIOKINESIS",300);
  if(efx.shockAll)foeHitPlayer(bt.es.atk*efx.shockAll.pct/100,"GEMPA",460);
  if(efx.splash)foeHitPlayer(bt.es.atk*efx.splash.pct/100,"YASAKANI",500);
  if(efx.meteorShower&&st.turns>1&&st.turns%efx.meteorShower.every===0){
    foeHitPlayer(bt.pMax*efx.meteorShower.pct/100,"METEOR BERIKUTNYA",520);
  }
  /* LIFETIME: self-destruct setelah turns giliran */
  if(efx.lifetime&&st.turns>=efx.lifetime.turns){
    bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
    foeFloat("LIFETIME UP","crit",200);
    setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
    return true;
  }
  /* OVERHEAT: setelah delay giliran -> rugi pct% max HP */
  if(efx.overheat&&st.turns>efx.overheat.delay){
    const oh=Math.max(1,Math.round(bt.es.hp*efx.overheat.pct/100));
    bt.eHp=Math.max(1,bt.eHp-oh);
    setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    setTimeout(()=>{if(bt&&!bt.over){anim(".fighter.foe","hit");floatText(".fighter.foe","OVERHEAT -"+fmt(oh),"burn");}},bsMs(220));
  }
  /* BERSERKER ARMOR musuh */
  if(efx.berserker){
    const bzk=efx.berserker;
    if((st.berserkLeft||0)>0){
      st.berserkLeft--;
      foeFloat("BERSERKER TURNS "+st.berserkLeft,"crit",240);
      if(st.berserkLeft<=0){
        st.berserkOn=false;bt.eHp=0;setBar("hpFoe","hpFoeT",0,bt.es.hp);
        foeFloat("ARMOR HABIS","crit",220);
        setTimeout(()=>{if(bt&&!bt.over)foeDown();},bsMs(700));
        return true;
      }
    }
    const bzd=Math.max(1,Math.round(bt.es.hp*bzk.selfDmgPct/100));
    bt.eHp=Math.max(1,bt.eHp-bzd);
    bt.es.atk=Math.round(bt.es.atk*(1+bzk.atkGainPct/100));
    setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    foeFloat("BERSERK -"+fmt(bzd)+" +"+bzk.atkGainPct+"% ATK","burn",200);
    if(!st.berserkOn&&bt.eHp<=bt.es.hp*bzk.lowPct/100){
      st.berserkOn=true;st.berserkLeft=bzk.undyingTurns;
      foeFloat("BERSERKER ARMOR!","crit",420);
    }
  }
  /* SLEEP STRIKE (THUNDER PRODIGY): tidur N giliran */
  if(efx.sleepStrike&&(st.sleepLeft||0)>0){
    st.sleepLeft--;
    if(st.sleepLeft===0){st.sleepArmed=true;foeFloat("BANGUN!","heal",200);}
    else foeFloat("TERTIDUR","miss",200);
    bt.turn++;schedPhase(700,playerPhase);
    return true;
  }
  /* SERIOUS PUNCH (BALD KING): charge sebelum memukul */
  if(efx.seriousPunch){
    if((st.spCd||0)>0){
      st.spCd--;
      if(st.spCd>0)foeFloat("SERIOUS PUNCH · CD "+st.spCd,"miss",200);
      bt.turn++;schedPhase(700,playerPhase);
      return true;
    }
    st.spTurn=(st.spTurn||0)+1;
    if(st.spTurn<efx.seriousPunch.charge){
      foeFloat("CHARGING... "+st.spTurn+"/"+efx.seriousPunch.charge,"miss",200);
      bt.turn++;schedPhase(700,playerPhase);
      return true;
    }
    st.spTurn=0;st.spCd=efx.seriousPunch.cd;st.spArmed=true;
  }
  return false;
}

/* ---- 3. MODIFIER SERANGAN UTAMA: dipanggil sesudah eHits terbentuk; return pengali damage ---- */
function foeAttackMods(eHits){
  const efx=foeActiveFx(),st=foeState();
  let mult=1;
  st.atkN=(st.atkN||0)+1;
  if(efx.everyNth&&st.atkN%efx.everyNth.n===0){mult*=efx.everyNth.mult;foeFloat(efx.everyNth.text||"SUSANOO CHIDORI","crit");}
  if(efx.everySecond&&st.atkN%2===0){mult*=efx.everySecond.mult;foeFloat("ONE PERCENT","crit");}
  if(efx.sandBurial&&st.atkN%efx.sandBurial.every===0){mult*=efx.sandBurial.mult;foeFloat("SAND BURIAL","crit");}
  if(efx.grieferAtk)mult*=efx.grieferAtk.mult;
  if(efx.openingHit&&!st.open){st.open=true;mult*=(1+efx.openingHit.pct/100);foeFloat("OPENING HIT","crit");}
  if(efx.desperateStrike&&!st.ds&&bt.eHp<bt.es.hp*efx.desperateStrike.below/100){st.ds=true;mult*=efx.desperateStrike.mult;foeFloat(efx.desperateStrike.text||"DESPERATE STRIKE","crit");}
  if(efx.sleepStrike&&st.sleepArmed){st.sleepArmed=false;mult*=efx.sleepStrike.mult;foeFloat(efx.sleepStrike.text||"THUNDERCLAP FLASH","crit");}
  if(efx.seriousPunch&&st.spArmed){st.spArmed=false;mult*=efx.seriousPunch.mult;foeFloat("SERIOUS PUNCH","crit");}
  if(efx.berserker&&st.berserkOn&&(st.berserkLeft||0)>0)mult*=efx.berserker.atkMult;
  if(efx.valhalla&&efx.valhalla.master&&st.atkN%3===0){
    mult*=efx.valhalla.master.mult;foeFloat("MASTERPIECE!","crit");
    if(efx.valhalla.master.stun&&!foePlayerImmune())bt.pStun=Math.max(bt.pStun||0,efx.valhalla.master.stun);
  }
  if(efx.styleSwitching){
    const STYLES=["TRICKSTER","SWORDMASTER","ROYALGUARD","GUNSLINGER"];
    const si=(st.style||0)%4;st.style=(st.style||0)+1;
    foeFloat(STYLES[si],"crit",120);
    if(si===0)st.trickNext=true;
    else if(si===1)mult*=1.5;
    else if(si===2)st.royalNow=true;
    else if(si===3)eHits.push({mult:0.4});
  }
  if(efx.turret&&(st.turret||0)>0)mult*=(1+st.turret*efx.turret.atkPct/100);
  if(efx.senzu){
    const sl=efx.senzu;
    st.senzuTurn=(st.senzuTurn||0)+1;
    const fin=(st.senzuTurn%sl.every===0);
    const heal=Math.round(bt.es.hp*sl.healPct/100);
    bt.eHp=Math.min(bt.es.hp,bt.eHp+heal);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    mult*=fin?sl.strikeMult:sl.eatMult;
    foeFloat(fin?"FINISH THE MEAL!":"MUNCH MUNCH +"+fmt(heal),"heal",300);
  }
  if(efx.stretch){
    const sc=efx.stretch;const r=Math.floor(Math.random()*3);
    if(r===0){st.balloon=sc.balloon.reflect;mult=0.2;foeFloat("GUM-GUM BALLOON!","heal",300);}
    else if(r===1){mult*=sc.fireworks.mult;foeFloat("GUM-GUM FIREWORKS!","crit",300);}
    else{mult=0.2;const fh=Math.round(bt.es.hp*sc.flop.healPct/100);bt.eHp=Math.min(bt.es.hp,bt.eHp+fh);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);foeFloat("GUM-GUM FLOP +"+fmt(fh),"heal",300);}
  }
  if(efx.worldEnder){
    const we=efx.worldEnder;const ph=(st.we||0)%3;st.we=(st.we||0)+1;
    eHits.length=0;
    if(ph===0)eHits.push({mult:we.cyc1});
    else if(ph===1)eHits.push({mult:we.cyc2});
    else eHits.push({mult:we.pierce});
    foeFloat(ph===0?"WORLD ENDER":ph===1?"WORLD ENDER - ALL":"WORLD ENDER - PIERCE","crit",240);
  }
  if(efx.bungeeGum&&(st.gum||0)>0){mult*=(1+efx.bungeeGum.bonus/100);st.gum--;}
  if(efx.tripleHit){eHits.length=0;for(let i=0;i<efx.tripleHit.hits;i++)eHits.push({mult:efx.tripleHit.mult});}
  if(efx.eightGates&&(st.gates||0)<efx.eightGates.max){
    st.gates=(st.gates||0)+1;
    bt.es.atk=Math.round(bt.es.atk*(1+efx.eightGates.atkPct/100));
    foeFloat("GERBANG "+st.gates+"/"+efx.eightGates.max+" +"+efx.eightGates.atkPct+"%","crit",360);
    if(st.gates>=efx.eightGates.max){
      const gd=Math.max(1,Math.round(bt.es.hp*efx.eightGates.selfPct/100));
      bt.eHp=Math.max(1,bt.eHp-gd);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    }
  }
  return mult;
}
/* pemicu setelah musuh berhasil kena player */
function foeOnHitLanded(etotal){
  if(!bt||bt.over||!(etotal>0))return;
  const efx=foeActiveFx(),st=foeState();
  if(efx.bungeeGum){st.gum=efx.bungeeGum.turns;foeFloat("BUNGEE GUM","crit",300);}
  if(efx.worldEnder&&bt.eHp>0){
    const wh=Math.max(1,Math.round(etotal*efx.worldEnder.healPct/100*(st.weRev?1.3:1)));
    bt.eHp=Math.min(bt.es.hp,bt.eHp+wh);setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
    foeFloat("LIFESTEAL +"+fmt(wh),"heal",420);
  }
}

/* ---- 4. PERTAHANAN musuh terhadap serangan player (dipanggil dari loop shots di playerPhase) ----
   return {evade:bool, dr:persen pengurangan damage tambahan} */
function foeDefenseVs(pen,tsLock){
  const efx=foeActiveFx(),st=foeState();
  let dr=0;
  if(efx.autoBlock)dr=Math.max(dr,efx.autoBlock.pct);
  if(efx.puppetBody)dr=Math.max(dr,efx.puppetBody.dr);
  if(st.wdr)dr=Math.max(dr,st.wdr);
  if(st.royalNow)dr=Math.max(dr,50);
  if(efx.lowHpAura&&bt.eHp<bt.es.hp*efx.lowHpAura.below/100&&efx.lowHpAura.dr)dr=Math.max(dr,efx.lowHpAura.dr);
  if(!pen&&!tsLock){
    if(st.trickNext){st.trickNext=false;foeFloat("TRICKSTER","miss");return {evade:true,dr:dr};}
    if(st.dodgeArmed){st.dodgeArmed=false;foeFloat("DODGE","miss");return {evade:true,dr:dr};}
    if(efx.dodgeAtk&&Math.random()*100<efx.dodgeAtk.chance){
      if((st.dodgeStacks||0)<(efx.dodgeAtk.max||3)){
        st.dodgeStacks=(st.dodgeStacks||0)+1;
        bt.es.atk=Math.round(bt.es.atk*(1+efx.dodgeAtk.pct/100));
      }
      foeFloat("DODGE","miss");return {evade:true,dr:dr};
    }
    if(efx.entryCounter&&!st.counterUsed){
      st.counterUsed=true;foeFloat(efx.entryCounter.text||"AMENOTEJIKARA","miss");
      if(efx.entryCounter.mult>0)foeHitPlayer(bt.es.atk*efx.entryCounter.mult,"COUNTER",520);
      return {evade:true,dr:dr};
    }
    if(efx.turret&&(st.turret||0)>0&&Math.random()*100<efx.turret.blockPct){
      st.turret--;
      foeFloat("TURRET BLOCK! sisa "+st.turret,"crit",320);
      return {evade:true,dr:dr};
    }
  }
  return {evade:false,dr:dr};
}

/* ---- 5. BANGKIT / TAHAN MATI: dipanggil di awal foeDown; true = musuh selamat ---- */
function foeTrySave(){
  if(!bt||bt.over||bt.aftermath)return false;
  const efx=foeActiveFx(),st=foeState();
  let label=null;
  if(efx.reversal&&!st.rv){st.rv=true;bt.eHp=1;label="GOLD EXPERIENCE REQUIEM!";}
  else if(efx.causality&&!st.cs){
    st.cs=true;bt.eHp=Math.max(1,st.causalPrev||Math.round(bt.es.hp*0.5));
    bt.es.atk=Math.round(bt.es.atk*(1+efx.causality.atkPct/100));
    label="KAUSALITAS DIBALIK!";
    if(window.causalityFx)window.causalityFx(".fighter.foe");
  }
  else if(efx.deathStay&&!st.dstay){st.dstay=true;bt.eHp=1;label="GURA GURA HOLD!";}
  else if(efx.deathDefy&&!st.ddefy){st.ddefy=true;bt.eHp=1;label="ASHURA STANDS";}
  else if(efx.lastStand&&!st.ls){st.ls=true;bt.eHp=1;bt.es.atk=Math.round(bt.es.atk*(1+efx.lastStand.pct/100));label="1% AWAKENED";}
  else if(efx.worldEnder&&!st.weRev){st.weRev=true;bt.eHp=bt.es.hp;st.wdr=efx.worldEnder.revive.dr;label="THE WORLD ENDER";if(window.worldEnderReviveFx)window.worldEnderReviveFx(".fighter.foe");}
  else if(efx.revive&&!st.rev){
    st.rev=true;
    bt.eHp=(efx.revive.pct!=null)?Math.max(1,Math.round(bt.es.hp*efx.revive.pct/100)):bt.es.hp;
    if(efx.revive.atkPct)bt.es.atk=Math.round(bt.es.atk*(1+efx.revive.atkPct/100));
    if(efx.revive.stun&&!foePlayerImmune())bt.pStun=Math.max(bt.pStun||0,efx.revive.stun);
    label="REVIVE!";
  }
  else if(efx.rewind&&!st.rw){
    st.rw=true;
    const rh=Math.max(1,Math.round(bt.es.hp*efx.rewind.pct/100));
    bt.eHp=Math.min(bt.es.hp,rh);
    foeHitPlayer(rh,"REWIND",620);
    if(efx.rewind.stun&&!foePlayerImmune())bt.pStun=Math.max(bt.pStun||0,efx.rewind.stun);
    label="V-DRIVE RESONANCE";
  }
  else if(efx.splitDeath&&(st.sp||0)<efx.splitDeath.times){
    st.sp=(st.sp||0)+1;
    const k=efx.splitDeath.pct/100;
    bt.es.hp=Math.max(1,Math.round(bt.es.hp*k));bt.es.atk=Math.max(1,Math.round(bt.es.atk*k));bt.eHp=bt.es.hp;
    label="SPLIT!";
  }
  if(!label){
    /* Efek post-mortem musuh saat beneran mati */
    if(efx.deathHex&&!st.dhex){
      st.dhex=true;
      if(!foePlayerImmune()){
        bt.pStun=Math.max(bt.pStun||0,efx.deathHex.turns);bt.pFreeze=efx.deathHex.turns;
        setTimeout(()=>{if(bt&&!bt.over)floatText(".fighter.me","HAKKA NO TOGAME · BEKU","crit");},bsMs(520));
      }
      bt.pPoisonCut=Math.min(90,(bt.pPoisonCut||0)+efx.deathHex.atkCut);
    }
    return false;
  }
  bt.eHp=Math.max(1,bt.eHp);
  setBar("hpFoe","hpFoeT",bt.eHp,bt.es.hp);
  foeFloat(label,"heal",300);
  /* lanjutkan rantai giliran yang tadinya diputus oleh kill ini */
  if(bt.curPhase==="enemy"){bt.turn++;schedPhase(1100,playerPhase);}
  else schedPhase(1100,enemyPhase);
  return true;
}
