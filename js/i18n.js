/* =============== GLOBAL LANGUAGE SYSTEM (ID / EN) ===============
 * Menyediakan pilihan Bahasa Indonesia ('id') & English ('en') di menu Settings.
 * - Menyimpan preferensi di localStorage ('acb_lang_v1') & state.lang.
 * - Menerjemahkan otomatis:
 *   1) Seluruh deskripsi passive kartu (74 unit), nama Artefak, Pet, Skill Tree,
 *      Premium Packs, World Boss Shop, Profile Tabs, dan Leaderboard Notes secara in-place.
 *   2) Seluruh teks UI statis & dinamis (Backpack, Card Index, Trait, Weather,
 *      Profile, Titles, Story, Infinite Tower, World Boss, Leaderboard, Settings, Toast)
 *      secara real-time menggunakan kamus frasa + regex + MutationObserver ringan.
 */
(function () {
  var LANG_STORAGE_KEY = 'acb_lang_v1';

  function getLang() {
    try {
      if (typeof state !== 'undefined' && state && (state.lang === 'en' || state.lang === 'id')) {
        return state.lang;
      }
      var saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'id') return saved;
    } catch (e) {}
    return 'en';
  }

  /* ================== 1. TERJEMAHAN PASSIVE KARTU (74 UNIT) ================== */
  var CARD_DESC_EN = {
    'CH_UNSTOPPABLE_FIST': '15% chance to open attacks with two consecutive strikes.',
    'CH_COPY_NINJA': 'Sharingan copies ALL enemy passives in every battle — turning the opponent\'s techniques against them.',
    'CH_AWAKENED_DARK_AVENGER': '25% chance for attacks to turn into a current thrust dealing ×1.4 damage.',
    'CH_AWAKENED_PROMISED_CHILD': '30% chance for attacks to pierce enemy defense.',
    'CH_SIX_PATHS_OF_PAIN': '25% chance to repel any enemy attack, reducing incoming damage to zero.',
    'CH_BIJUU_BEAST': '30% chance to sweep 2-3 times in a row, then absorb 15% of damage dealt as HP.',
    'CH_ULTIMATE_WARRIOR': '20% chance for attacks to become a Masenko blast dealing ×1.5 damage.',
    'CH_BODY_SWITCHER': '20% chance to strike twice in a row, then absorb 12% of damage dealt as HP.',
    'CH_NAMEKIAN_SAGE': '45% chance to fire a piercing beam that ignores enemy defense.',
    'CH_AWAKENED_PRIDEFUL_PRINCE': 'While HP is above 60%, every attack deals +35% bonus damage.',
    'CH_AWAKENED_EARTHS_STRONGEST': '25% chance to unleash a volley of 2-3 consecutive shots.',
    'CH_AWAKENED_GALACTIC_TYRANT': '20% chance to nullify enemy damage and convert it into HP recovery, plus 15% lifesteal.',
    'CH_CURSED_DOLL': '18% chance to open attacks with two consecutive hammer strikes.',
    'CH_SHADOW_SUMMONER': 'For the first 2 turns, 24% chance to summon a parrying shadow that reduces enemy damage to zero.',
    'CH_CURSED_FIST': '30% chance for strikes to become a cursed fist dealing ×1.6 damage.',
    'CH_RIKAS_BLESSING': '30% chance to roar 2-3 times in a row, then absorb 14% of damage dealt as HP.',
    'CH_LIMITLESS_MASTER': '40% chance to unleash Hollow Purple, completely piercing enemy defense.',
    'CH_KING_OF_CURSES': '22% chance to nullify enemy damage and convert it into HP recovery, plus 18% lifesteal.',
    'CH_PORCO_PILLAR': '30% chance to crush with primordial jaws for ×1.5 damage.',
    'CH_AWAKENED_STAND_USER': '20% chance to strike twice in a row — his Stand moves faster than its user.',
    'CH_GOLD_EXPERIENCE Requiem': 'Absorbs 20% of total damage dealt as HP — the opponent\'s efforts always return to zero.',
    'CH_THE WORLD': '25% chance to stop time: enemy damage is nullified and converted into HP recovery, plus 15% lifesteal.',
    'CH_OPALESTONE_DREAM': '25% of all enemy attacks are deflected by a white opal dream, dealing zero damage.',
    'CH_HEAVENS_DOOR': '40% chance to rewrite the enemy\'s defense pages — completely piercing defense.',
    'CH_TANJIRO_BLADE': '30% chance to unleash Sun Breathing for 2-3 consecutive slashes.',
    'CH_NEZUKO_BAMBOO': 'Absorbs 18% of total damage dealt as HP — demon blood regenerates itself.',
    'CH Zenitsu_THUNDER': '35% chance for attacks to strike like lightning for ×1.7 damage.',
    'CH_INUIZO_MASK': '25% chance to pounce twice in a row with dual rusted chainsaws.',
    'CH_SANEMI_WIND': '35% chance for a windstorm to sweep 2-3 times in a row.',
    'CH_SHINOBU_BUTTERFLY': '45% chance for a venomous sting to pierce all defense, then absorb 15% damage as HP.',
    'CH_RULER': 'Upon death, revives with 100% HP (once). All attacks deal 2x damage. Enemy damage reduction is completely ignored. Immune to all status effects.',
    'CH_OTHERWORLDLY': '60% chance to dodge any attack. Each dodge grants +15% permanent ATK (stacks up to 3 times). Every 2nd attack uses One Percent of his power: dealing 2x damage and ignoring damage reduction. Upon taking fatal damage for the first time, survives at 1 HP and gains +15% ATK.',
    'CH_DEVIL_HUNTER': 'Cycles through styles in order each turn: TRICKSTER (dodges enemy attacks that turn), SWORDMASTER (1.5x damage), ROYALGUARD (takes 50% less damage and counters for 30% of damage taken), GUNSLINGER (attacks also hit the next target for 40%).',
    'CH_NINE_TAIL': 'For 4 turns, gains 1.75x all stats and each attack permanently reduces enemy Max HP by 12%. After 4 turns, this card dies.',
    'CH_SHADOW_HEIR': 'On entry, Amenotejikara makes the first enemy attack miss and Shadow Heir immediately counters for 15x damage. Every 3 turns, evades the next attack. Every 4th attack becomes Susanoo Chidori, dealing 3x damage and ignoring damage reduction. Below 30% HP, Perfect Susanoo activates, granting 40% damage reduction and burning enemies for 20% Max HP for 2 turns.',
    'CH_FABLED_SOLDIER': 'On entry, if the active enemy\'s current HP is less than 20% of Fabled Soldier\'s stats, instantly destroys them. Attacks deal 1.3x base damage.',
    'CH_IMMORTAL_COLOSSUS': 'On entry, transforms: 1.5x all stats. Every 3 turns, Wall Titans march to deal 20% of ATK to all enemy cards. Upon death, The Rumbling continues for 2 more turns — enemies take 10% Max HP per turn even after falling.',
    'CH_TRICKSTER_ACE': 'After being attacked, attaches Bungee Gum to the enemy — for 2 turns, all Trickster Ace attacks deal +30% bonus damage to that foe. If the gummed foe dies, the gum transfers to the next entering enemy.',
    'CH_UNDYING_ROGUE': 'Whenever Undying Rogue defeats a card, permanently steals 15% of its stats (ATK & HP) and adds them to his own.',
    'CH_SHADOW_MONARCH': 'On kill, resurrects the defeated card as a shadow with 40% of its stats. The shadow fights in Shadow Monarch\'s place for 2 turns, or until the shadow falls.',
    'CH_SHADOW_KING': 'Defeated enemies arise as permanent Shadows with 75% of their original stats in the party backline (excludes Boss NPCs). Upon fatal damage for the first time, swaps places with his first Shadow: reviving at full HP in the backline. Whenever a Shadow dies, absorbs 35% of its stats. While any Shadow is alive, deals +30% damage and takes 15% less damage.',
    'CH_ROYAL_VANGUARD': 'Whenever any card in your party dies, Royal Vanguard permanently gains +25% ATK (stacks each time an ally falls).',
    'CH_REGRESSOR': 'Upon death, if Regressor has killed at least one card in this battle, revives with 40% HP and refreshes all skills. Each kill banks one Regression charge; each revival consumes one.',
    'CH_SIXFOLD_PROPHET': 'On entry, deals 20% of the enemy\'s current total HP split evenly across all enemy cards as direct damage.',
    'CH_THRILLER_KING': 'On entry, all enemy cards take 8% Max HP damage. Every turn Thriller King is alive, the active enemy takes 10% Max HP damage (Boss NPCs are immune to both). Upon death, splits with 70% of his stats up to 3 times.',
    'CH_THREEBLADE_RONIN': 'Every 4th attack, Ashura emerges: dealing 3x damage. Below 20% HP, Threeblade Ronin refuses to fall — surviving 1 extra turn after reaching 0 HP while still able to attack.',
    'CH_WILDHEART_HUNTER': 'Below 30% HP, the next attack deals 2.2x damage. Wildheart Hunter dies at the end of the turn.',
    'CH_SUNBREATH_SWORDSMAN': 'The first hit against any newly entering card deals +35% bonus damage.',
    'CH_YOUNG_SHADOW_HEIR': '50% chance on attack to burn the enemy for 8% Max HP per turn for 2 turns.',
    'CH_YOUNG_SPIRIT_VESSEL': 'Summons a shadow clone — automatically dodges the first incoming attack!',
    'CH_DARKIN_LORD': '(AWAKENED Weather Exclusive) THE WORLD ENDER: 3-stage attack cycle — Hit 1 deals 150% damage, Hit 2 deals 40% damage to all enemies (including bench), Hit 3 pierces the active foe and the one behind for 80% each. Heals for 30% of all damage dealt. First death: revives with 40% damage reduction and +30% stronger healing.',
    'CH_PSYCHIC_ESPER': '(AWAKENED Weather Exclusive) PSYCHIC BARRAGE: Instead of normal attacks, hurls 5 psychic boulders dealing 190% damage to random enemies including bench slots. Consecutive hits on the same target grant +10% damage per boulder. First death: revives at full HP and hurls 10 boulders per attack.',
    'CH_SUN_GOD': '(AWAKENED Weather Exclusive) RUBBER FIELD: Takes 50% less damage, reflects 50% damage back to the attacker, and inflicts DIZZY (+20% damage taken, stacks up to 9 turns). On first attack in battle: unleashes BAJRANG GUN (260% defense-piercing damage + 1-turn STUN) and blasts ALL enemy bench units for 90% ATK (once per battle).',
    'CH_ABSOLUTE_ZERO': '(ICE AGE Weather Exclusive) On entry, freezes the active enemy card for 2 turns and deals 2x damage to frozen targets. Killing a frozen target transfers Freeze to the next enemy card (1 turn).',
    'CH_ICE_QUEEN': '(ICE AGE Weather Exclusive) Freezes enemies for 1 turn whenever they enter the arena. Each attack has a 25% chance to freeze the enemy for 1 turn, and deals 1.9x damage to frozen targets.',
    'CH_THE_STRUGGLER': '(ECLIPSE Weather Exclusive) Loses 5% Max HP each turn, but permanently gains +15% ATK per turn (stacking). Below 20% HP, BERSERKER ARMOR activates: death immunity for 2 turns (HP can drop below 0) with 2x attack damage. After 2 turns, The Struggler perishes.',
    'CH_WHITE_HAWK': '(ECLIPSE Weather Exclusive) Whenever attacked, permanently strips the enemy\'s abilities. Every 3 turns, guaranteed to dodge the next enemy attack. White Hawk always controls the battlefield.',
    'CH_HAVOC_WREACKER': '(ARCANE Weather Exclusive) SUPER MEGA DEATH ROCKET: On every entry, immediately fires a rocket dealing 50% ATK to the entire enemy lineup (max 3x per battle) — hitting bench units too. On kill, GET EXCITED!: immediately attacks again without waiting for the enemy\'s turn.',
    'CH_TIME_TRICKSTER': '(ARCANE Weather Exclusive) V-DRIVE RESONANCE: Upon death, revives with 75% Max HP (once), immediately strikes the enemy for the healed amount, and stuns them for 1 turn.',
    'CH_YORDLE_INVENTOR': '(ARCANE Weather Exclusive) EVOLUTION TURRET: Summons 2 turrets on entry, gaining +1 turret every 3 turns. Each turret grants +25% ATK. When hit, 40% chance for a turret to absorb all damage (destroying 1 turret).',
    'CH_DUMB_HAIR_GUY': '(GOOFY Weather Exclusive) Won\'t stop eating: heals 25% Max HP each turn, but attacks deal 0.5x damage while eating. Every 3 turns finishes eating: unleashes an unmissable 4x strike, then absorbs +25% of damage dealt as flat ATK and +50% as Max HP (up to 10x base stats). Then starts eating again.',
    'CH_DUMB_STRETCHY_GUY': '(GOOFY Weather Exclusive) Every attack triggers random chaos: Gum-Gum Balloon (attack misses, but reflects 50% of the next enemy hit), Gum-Gum Fireworks (hits all enemies for 50% ATK), or Gum-Gum Flop (misses, but heals 40% Max HP).',
    'CH_GLITCHED_ENTITY': '(GLITCH Weather Exclusive) On entry, duplicates data: HP and ATK stats are doubled (2x). Every hit corrupts the enemy\'s Max HP by 8% permanently (stacking). Immune to all negative status effects.',
    'CH_THE_GRIEFER': '(GLITCH Weather Exclusive) On entry, corrupts enemy abilities: every 3 turns, the enemy glitches and hits itself for 200% of The Griefer\'s ATK, while your entire party gains +10% damage for the rest of battle. Deals 1.5x attack damage. On first death, retreats and returns behind your last card with 50% HP.',
    'CH_HEIGHT_OF_PAINTING': '(DOODLE Weather Exclusive) On entry, Twilight of Valhalla activates for 4 turns: 60% damage reduction, +15% ATK per turn, and HP cannot drop below 1. When the painting ends, heals 40% Max HP. Every 3rd attack is a Masterpiece: 3x damage and stuns the enemy for 1 turn.',
    'CH_INK_ANAMLOY': '(DOODLE Weather Exclusive) Gains 30% damage reduction while in the arena. Every hit inflicts Ink Corruption, permanently reducing enemy ATK by 10% (max 5 stacks). Every 3rd attack heals for 50% of damage dealt. Upon death, revives once with 50% HP and stuns the enemy for 1 turn.',
    'CH_BLIZZARD_BADDIE': '(WINDY Weather Exclusive) On entry, creates a psychic barrier that reduces incoming damage by 30% for 3 turns. Each hit mitigated by the barrier heals 10% Max HP.',
    'CH_PAPER_PAL': '(WINDY Weather Exclusive) On entry, paper shards deal 10% ATK to all enemy cards. Attacks have a 25% chance to pierce for 1.5x damage.',
    'CH_BLESSED_MAGE': '(LIGHTRAIN Weather Exclusive) Gains +20% to all stats throughout the battle. Every 2 turns, Spirit Dive activates: the next attack deals 2x damage.',
    'CH_THUNDER_PRODIGY': '(LIGHTRAIN Weather Exclusive) Falls asleep for 1 turn on entry. The first attack after waking deals 4x damage, and excess overkill damage carries over to strike the next enemy.',
    'CH_10TH_CAPTAIN': '(SNOWFALL Weather Exclusive) On entry, freezes the active enemy card for 2 turns. Deals 1.5x damage to frozen enemies. Permanently takes 20% reduced damage (Ice Shell).',
    'CH_OCEANS_GUARDIAN': '(SNOWFALL Weather Exclusive) On entry, summons heavy rain for 3 turns: healing 20% Max HP every turn during rain. Every 3rd attack sends a shockwave dealing 15% ATK to the active enemy.',
    'CH_IMMORTAL_VAMPIRE': '(THUNDERSTORM Weather Exclusive) On entry and every 4 turns, stops time: stunning the active enemy for 2 turns while attacks cannot be dodged. Every kill restores 25% Max HP.',
    'CH_SEA_SOVEREIGN': '(THUNDERSTORM Weather Exclusive) Every attack strikes 3 times (50% damage each). Every 4 turns unleashes 40-DAY FLOOD: 2x damage with guaranteed execution on enemies below 20% HP.',
    'CH_PUPPETEER': '(SANDSTORM Weather Exclusive) Every hit injects puppet poison: permanently reducing enemy ATK by 10% (stacking). Puppet body grants 20% incoming damage reduction.',
    'CH_SAND_VESSEL': '(SANDSTORM Weather Exclusive) Every 3 turns unleashes SAND BURIAL: a guaranteed 2x damage hit that ignores dodge. Between Sand Burials, auto-blocks 25% of incoming damage.',
    'CH_BLESSED_SORCERER': '(MONSOON Weather Exclusive) Limitless Infinity: takes 50% reduced damage from all sources. Every 2nd attack unleashes HOLLOW PURPLE: 2.5x damage ignoring all damage reduction. Below 20% HP: UNLIMITED VOID — stuns the enemy for 2 turns and heals to 50% HP (once per battle).',
    'CH_MOON_MOTHER': '(MONSOON Weather Exclusive) When an enemy enters the arena, AMENOMINAKA shifts them to another dimension: disabling enemy active abilities for 2 turns. Every 4th attack unleashes ALL-KILLING ASH BONES: 3x damage ignoring damage reduction, executing enemies below 25% HP.',
    'CH_ALMIGHTY_TYRANT': '(AURORA Weather Exclusive) THE ALMIGHTY: dodges enemy attacks every 3rd turn. Upon falling, alters the future: revives at 60% HP and disables enemy abilities for 2 turns (once per battle).',
    'CH_DEMON_SLIME': '(AURORA Weather Exclusive) PREDATOR: GLUTTONY: On every kill, permanently absorbs 25% of the enemy\'s ATK & Max HP and copies their ability — replacing the previous copy — while active in battle.',
    'CH_LUCK_VOLTIA': 'On entry, immediately strikes for 60% ATK. Every 3rd attack has a 50% chance to stun the enemy for 1 turn. Each successful stun grants +8% permanent ATK (max 5 stacks).',
    'CH_NOBLE_COMPANION': 'While Noble Companion is in the party, all party cards deal +20% bonus damage.',
    'CH_BLOODMOON_DEMON': 'Regenerates 10% Max HP each turn (stops below 20% HP). When hit, 40% chance to burn the attacker\'s blood for 10% of their Max HP. Below 20% HP: Awakened Mode, attacks deal 2x damage.',
    'CH_GREEN_BEAST': 'Each hit opens 1 Gate: +15% permanent ATK (max 5). At full Gates, each attack costs 8% of own Max HP.',
    'CH_DRAGON_SIN': 'When attacked, counters for 30% of Dragon Sin\'s ATK back at the attacker.',
    'CH_FROST_WIZARD': 'Attacks strike twice (the second hit deals 40% damage).',
    'CH_RUBBERBOUND_CAPTAIN': '25% chance on attack to strike again for 75% damage.',
    'CH_ICE_REAPER': 'Upon death, freezes the enemy card for 3 turns and permanently cuts their ATK by 30%.',
    'CH_FROSTBANE': 'On entry, freezes the enemy for 2 turns. Attacks against frozen targets deal 1.5x damage.',
    'CH_COPYBLADE_MENTOR': 'On entry or when a new enemy enters, copies the opponent\'s ability for 6 turns.',
    'CH_NULLBLADE_KNIGHT': 'On entry, disables enemy abilities for 2 turns. Immune to stat-altering abilities. Attacks deal 1.3x damage.',
    'CH_TITAN_HUNTER': '35% chance to dodge any attack. Each successful dodge boosts the next attack by +40% damage.',
    'CH_CRIMSON_WARLORD': 'On entry and every 4 turns: calls down a meteor shower — ALL enemy cards lose 15% of their Max HP (Boss NPCs immune). Attacks deal 1.3x damage. Takes 20% reduced damage (Susano\'o).',
    'CH_LIGHTBORNE_ADMIRAL': 'Attacks hit the active enemy plus the next lineup card for 90% damage. Deals 1.5x attack damage. On entry, blinds the enemy: their first attack misses.',
    'CH_SOUL_REAPER': 'Upon death, revives with 50% HP and +20% ATK (once per battle).',
    'CH_GALACTIC_TYRANT': 'Every 3rd attack becomes Death Beam: ignores damage reduction and hits the next lineup card. Below 50% HP: evolves into Golden Galactic Tyrant, gaining +70% ATK and 25% permanent damage reduction.',
    'CH_SOLAR_BRAWLER': 'Every turn, all stats grow by +20% (compounding). The longer the fight, the deadlier he becomes.',
    'CH_TREMOR_EMPEROR': 'On entry: triggers a quake — ALL enemy cards lose 10% of their Max HP. Every attack sends a 15% ATK shockwave to the entire enemy lineup. On fatal damage: survives for 1 extra turn (still attacking).',
    'CH_ANT_KING': '+5% all stats every turn. Every kill permanently absorbs 15% of enemy stats and heals 25% Max HP. On fatal damage: revives once with 50% HP and +50% ATK.',
    'CH_TIME_MASTER': 'When an enemy enters, permanently disables their abilities. The first fatal attack is reversed — surviving at 1 HP (once per battle).',
    'CH_OMNI_SOVEREIGN': 'On entry, if the enemy\'s total stats are weaker than Omni Sovereign\'s, erases them from battle completely.',
    'CH_ASTRAL_DEVOURER': 'Adapts for +15% stats every turn. Every 2nd attack unleashes Gamma Ray Burst: 4x damage and pierces all enemy lineup cards for 20% ATK. On fatal damage: reverts to previous turn\'s starting HP with +15% ATK (once).',
    'CH_BALD_KING': '(GALACTIC Weather Exclusive) SERIOUS PUNCH: Charges for 2 turns without attacking, then on the 3rd turn unleashes a 5x damage punch + 10% shockwave to the entire enemy lineup. 3-turn cooldown.',
    'CH_METEOR_CONQUEROR': '(GALACTIC Weather Exclusive) METEORIC BURST: On entry, blasts the enemy for 15% Max HP and doubles (2x) all stats for 3 turns. Afterwards, overheats: losing 10% Max HP each turn.',
    'CH_ETERNAL_DRAGON': 'IMMUNE to all negative status effects (stun, burn, etc.). 50% chance to fire ICE BLAST: 3 consecutive hits dealing 75% ATK each.'
  };

  /* ================== 2. TERJEMAHAN ARTEFAK, PET, SKILL TREE, DATA OBJEK ================== */
  var ART_NAME_EN = {
    'manik': 'FORTUNE BEAD',
    'medal': 'LUCKY MEDAL',
    'giok': 'LUCKY JADE',
    'batu': 'FORTUNE STONE',
    'cincin': 'FROST RING',
    'intan': 'POWER DIAMOND',
    'pedang-api': 'FLAME SWORD',
    'helm-abyss': 'ABYSS HELM',
    'tameng-surgawi': 'CELESTIAL SHIELD',
    'tome-infinity': 'TOME OF INFINITY'
  };

  var PET_NAME_EN = {
    'doll': 'CURSED DOLL',
    'otherworldly': 'OTHERWORLDLY BEING',
    'titan': 'BEAST TITAN',
    'dragon': 'BONE DRAGON',
    'nine-tail': 'NINE-TAILS',
    'bijuu': 'BIJUU',
    'kyubi': 'KYUBI FOX',
    'nebula-wisp': 'NEBULA WISP',
    'next-bot': 'NEXT-BOT',
    'cyber-kitsune': 'CYBER KITSUNE'
  };

  var TREE_NODE_EN = {
    'root': { name: 'FOUNDATION', desc: '+1 FLAT LUCK · +3% ROLL SPEED' },
    'lk1':  { name: 'KEEN EYE', desc: '+2 FLAT LUCK' },
    'lk2':  { name: 'INSIGHT', desc: '+4 FLAT LUCK' },
    'lk3':  { name: 'SOLAR GRACE', desc: '+8 FLAT LUCK' },
    'lk4':  { name: 'BLESSED', desc: '+15 FLAT LUCK' },
    'lk5':  { name: 'FORTUNE ESTUARY', desc: '+30 FLAT LUCK' },
    'sp1':  { name: 'SWIFT', desc: '+5% ROLL SPEED' },
    'sp2':  { name: 'RAPID', desc: '+8% ROLL SPEED' },
    'sp3':  { name: 'LIGHTNING', desc: '+12% ROLL SPEED' },
    'sp4':  { name: 'FLASH', desc: '+18% ROLL SPEED' },
    'sp5':  { name: 'LIGHTSPEED', desc: '+25% ROLL SPEED' },
    'amp1': { name: 'AMPLIFICATION I', desc: '+10% LUCK' },
    'amp2': { name: 'AMPLIFICATION II', desc: '+20% LUCK' },
    'amp3': { name: 'AMPLIFICATION III', desc: '+35% LUCK' },
    'amp4': { name: 'AMPLIFICATION IV', desc: '+60% LUCK' },
    'ult':  { name: 'SINGULARITY', desc: '+50 FLAT · +100% LUCK · +30% SPEED' }
  };

  var PREMIUM_DESC_EN = {
    'roll_5k': '5,000 Instant Rolls — processed in 1 second',
    'roll_10k': '10,000 Instant Rolls — processed in 1 second',
    'roll_25k': '25,000 Instant Rolls — processed in 1 second',
    'roll_50k': '50,000 Instant Rolls — processed in 1 second',
    'roll_100k': '100,000 Instant Rolls — maximum pull in 1 second',
    'pet_kitsune': 'Exclusive Pet — +250 FLAT & +300% LUCK',
    'art_tome': 'Exclusive Artifact — +150 FLAT & +200% LUCK'
  };

  var WB_SHOP_EN = {
    'card-shadow-king': { name: 'SHADOW KING', sub: 'EXCLUSIVE WORLD BOSS CARD · TIER EX', desc: '100% guaranteed EX Shadow King card + unlocks Shadow King in the gacha Roll pool.' },
    'card-eternal':     { name: 'ETERNAL DRAGON', sub: 'EXCLUSIVE RAID CARD · TIER BOSS', desc: '100% guaranteed BOSS Eternal Dragon card + unlocks Eternal Dragon in the gacha Roll pool.' },
    'art-abyss':        { name: 'ABYSS HELM', sub: 'WORLD BOSS ARTIFACT', desc: '+80 FLAT & +120% LUCK when equipped in an artifact slot.' },
    'pet-nebula':       { name: 'NEBULA WISP', sub: 'WORLD BOSS PET', desc: '+150 FLAT & +220% LUCK when equipped as your active pet.' },
    'pot-mythic':       { name: 'MYTHIC POTION ×1', sub: 'CONSUMABLE · AWAKENED WEATHER', desc: '100% guaranteed AWAKENED weather (×100 LUCK) for 5 minutes.' },
    'pot-weather-5':    { name: 'WEATHER POTION ×5', sub: 'BUNDLE OF 5 POTIONS', desc: '5× random weather rolls (5 minutes duration per potion).' },
    'pot-luck3':        { name: 'LUCK POTION L3 ×1', sub: 'CONSUMABLE · 5 MINUTES', desc: '+25 FLAT & +50% LUCK for 5 minutes.' },
    'pot-speed3':       { name: 'SPEED POTION L3 ×1', sub: 'CONSUMABLE · 5 MINUTES', desc: '+75% ROLL SPEED for 5 minutes.' }
  };

  var RK_NOTE_EN = {
    'world_boss': 'Top total damage dealt to the World Boss in a single battle.',
    'infinite_tower': 'Highest floor reached in the Infinite Tower.',
    'story': 'Story campaign progression (cleared stages weighted by difficulty).',
    'level': 'Highest Hunter Level & EXP progression.',
    'power': 'Highest total Combat Power from your 4-card active deck.',
    'rebirth': 'Total Rebirths completed by the Hunter.'
  };

  var PROF_TAB_EN = {
    'overview': 'OVERVIEW',
    'collection': 'COLLECTION',
    'progress': 'PROGRESS',
    'equipment': 'EQUIPMENT',
    'items': 'ITEMS & BUFFS',
    'stats': 'STATISTICS',
    'achievements': 'ACHIEVEMENTS'
  };

  /* Sinkronisasi data in-place agar template literal di seluruh file JS otomatis berbahasa Inggris/Indonesia */
  function syncDataObjectsLang(lang) {
    var isEn = (lang === 'en');
    try {
      // 1. STORY_BIBLE.units & MASTER_CARD_INDEX & CARDS
      if (typeof STORY_BIBLE !== 'undefined' && STORY_BIBLE && Array.isArray(STORY_BIBLE.units)) {
        STORY_BIBLE.units.forEach(function (u) {
          if (!u.__origDesc) u.__origDesc = u.desc;
          u.desc = (isEn && CARD_DESC_EN[u.id]) ? CARD_DESC_EN[u.id] : u.__origDesc;
        });
      }
      if (typeof MASTER_CARD_INDEX !== 'undefined' && Array.isArray(MASTER_CARD_INDEX)) {
        MASTER_CARD_INDEX.forEach(function (c) {
          if (c && c.passive) {
            if (!c.passive.__origDesc) c.passive.__origDesc = c.passive.desc;
            c.passive.desc = (isEn && CARD_DESC_EN[c.char_id]) ? CARD_DESC_EN[c.char_id] : c.passive.__origDesc;
          }
        });
      }
      if (typeof CARDS !== 'undefined' && CARDS) {
        Object.keys(CARDS).forEach(function (id) {
          var c = CARDS[id];
          if (c && c.passive) {
            if (!c.passive.__origDesc) c.passive.__origDesc = c.passive.desc;
            c.passive.desc = (isEn && CARD_DESC_EN[id]) ? CARD_DESC_EN[id] : c.passive.__origDesc;
          }
        });
      }

      // 2. ART_DEFS & PET_DEFS
      if (typeof ART_DEFS !== 'undefined' && Array.isArray(ART_DEFS)) {
        ART_DEFS.forEach(function (a) {
          if (!a.__origName) a.__origName = a.name;
          a.name = (isEn && ART_NAME_EN[a.id]) ? ART_NAME_EN[a.id] : a.__origName;
        });
      }
      if (typeof PET_DEFS !== 'undefined' && Array.isArray(PET_DEFS)) {
        PET_DEFS.forEach(function (p) {
          if (!p.__origName) p.__origName = p.name;
          p.name = (isEn && PET_NAME_EN[p.id]) ? PET_NAME_EN[p.id] : p.__origName;
        });
      }

      // 3. TREE_NODES
      if (typeof TREE_NODES !== 'undefined' && Array.isArray(TREE_NODES)) {
        TREE_NODES.forEach(function (n) {
          if (!n.__origName) n.__origName = n.name;
          if (!n.__origDesc) n.__origDesc = n.desc;
          if (isEn && TREE_NODE_EN[n.id]) {
            n.name = TREE_NODE_EN[n.id].name;
            n.desc = TREE_NODE_EN[n.id].desc;
          } else {
            n.name = n.__origName;
            n.desc = n.__origDesc;
          }
        });
      }

      // 4. PREMIUM_PACKS
      if (typeof PREMIUM_PACKS !== 'undefined' && Array.isArray(PREMIUM_PACKS)) {
        PREMIUM_PACKS.forEach(function (pk) {
          if (!pk.__origDesc) pk.__origDesc = pk.desc;
          if (isEn) {
            if (PREMIUM_DESC_EN[pk.id]) {
              pk.desc = PREMIUM_DESC_EN[pk.id];
            } else {
              pk.desc = translateTextString(pk.__origDesc);
            }
          } else {
            pk.desc = pk.__origDesc;
          }
        });
      }

      // 5. WB_SHOP
      if (typeof WB_SHOP !== 'undefined' && Array.isArray(WB_SHOP)) {
        WB_SHOP.forEach(function (it) {
          if (!it.__origName) it.__origName = it.name;
          if (!it.__origSub) it.__origSub = it.sub;
          if (!it.__origDesc) it.__origDesc = it.desc;
          if (isEn && WB_SHOP_EN[it.id]) {
            it.name = WB_SHOP_EN[it.id].name;
            it.sub = WB_SHOP_EN[it.id].sub;
            it.desc = WB_SHOP_EN[it.id].desc;
          } else {
            it.name = it.__origName;
            it.sub = it.__origSub;
            it.desc = it.__origDesc;
          }
        });
      }

      // 6. PROF_TABS
      if (typeof PROF_TABS !== 'undefined' && Array.isArray(PROF_TABS)) {
        PROF_TABS.forEach(function (tb) {
          if (!tb.__origLabel) tb.__origLabel = tb.label;
          tb.label = (isEn && PROF_TAB_EN[tb.id]) ? PROF_TAB_EN[tb.id] : tb.__origLabel;
        });
      }

      // 7. RK_BOARDS
      if (typeof RK_BOARDS !== 'undefined' && RK_BOARDS) {
        Object.keys(RK_BOARDS).forEach(function (k) {
          var b = RK_BOARDS[k];
          if (!b.__origNote) b.__origNote = b.note;
          b.note = (isEn && RK_NOTE_EN[k]) ? RK_NOTE_EN[k] : b.__origNote;
        });
      }
    } catch (e) {
      console.warn('[i18n] syncDataObjectsLang error:', e);
    }
  }

  function setLang(lang) {
    lang = (lang === 'en') ? 'en' : 'id';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
      if (typeof state !== 'undefined' && state) {
        state.lang = lang;
        if (typeof save === 'function') save();
      }
    } catch (e) {}
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('data-lang', lang);

    syncDataObjectsLang(lang);

    if (lang === 'id') {
      restoreOriginalDOM(document.body);
      if (typeof render === 'function') render();
    } else {
      if (typeof render === 'function') render();
      translateSubtree(document.body);
    }
  }

  /* ================== 3. KAMUS FRASA EKSAK (trimmed string -> English) ================== */
  var EXACT_MAP = {
    // Auth & Loading
    'Memuat…': 'Loading…',
    'Memproses…': 'Processing…',
    'Akun berhasil dibuat': 'Account Created Successfully',
    'Silakan masuk dengan akun barumu.': 'Please sign in with your new account.',
    'KE LOGIN': 'GO TO LOGIN',
    'Verifikasi Berhasil': 'Verification Successful',
    'AKSES DIBERIKAN': 'ACCESS GRANTED',
    'Selamat datang kembali, Hunter': 'Welcome back, Hunter',
    'Masuki Arena': 'Enter Arena',
    'MASUK': 'LOGIN',
    'DAFTAR': 'REGISTER',
    'BUAT AKUN': 'CREATE ACCOUNT',
    'nama shinobi': 'shinobi username',
    'Progres tersinkron ke Cloud': 'Progress synced to Cloud',

    // Topbar, Footer Menu & Navigation
    'Buka profil': 'Open Profile',
    'Ganti Avatar dari Galeri': 'Change Avatar from Gallery',
    'PROFIL': 'PROFILE',
    'PENGATURAN': 'SETTINGS',
    'Pengaturan': 'Settings',
    'KELUAR': 'LOG OUT',
    'Keluar Akun': 'Log Out',
    'KEMBALI KE LOBBY': 'BACK TO LOBBY',
    'Kembali ke Lobby': 'Back to Lobby',
    'KEMBALI': 'BACK',
    'Kembali': 'Back',
    'SELESAI': 'FINISH',
    'MAIN LAGI': 'PLAY AGAIN',
    'KLIK DI LUAR UNTUK KELUAR': 'CLICK OUTSIDE TO EXIT',
    'TUTUP': 'CLOSE',
    'Tutup': 'Close',
    'BATAL': 'CANCEL',
    'Batal': 'Cancel',
    'BELI': 'BUY',
    'AKTIFKAN': 'ACTIVATE',
    'TUMPUK': 'STACK',
    'Sembunyikan': 'Hide',
    'KLIK': 'CLICK',
    'UNTUK BUKA BACKPACK': 'TO OPEN BACKPACK',

    // Settings Page
    'Kecepatan aksi & giliran:': 'Action & turn speed:',
    'Kalau battle terasa hening, cek status di bawah lalu tekan tes nada.': 'If battle feels silent, check the status below and press tone test.',
    'TES NADA': 'TEST TONE',
    'TES SFX RAID (HIT + DENTUMAN)': 'TEST RAID SFX (HIT + IMPACT)',
    'AUTO RESTART DARI LANTAI 1': 'AUTO RESTART FROM FLOOR 1',
    'AUTO RESTART AKTIF — kalah = langsung mulai run baru dari Lantai 1.': 'AUTO RESTART ON — defeat immediately starts a new run from Floor 1.',
    'Auto restart mati — kalah = kembali ke menu Tower.': 'Auto restart off — defeat returns to the Tower menu.',
    'RESET DATA LOKAL': 'RESET LOCAL DATA',
    'Reset Semua & Main Dari Awal': 'Reset All & Start Fresh',
    'Yakin? Tap lagi untuk reset': 'Are you sure? Tap again to reset',
    'BAHASA / LANGUAGE': 'LANGUAGE / BAHASA',
    'Pilih bahasa tampilan antarmuka game (tersimpan otomatis).': 'Select the game interface display language (saved automatically).',

    // Global Luck & Weather Dock
    'Buff keberuntungan seluruh server (+10×/stack)': 'Server-wide luck buff (+10×/stack)',
    'Belum aktif — buff keberuntungan untuk seluruh server': 'Inactive — server-wide luck buff for all players',
    'Belum aktif — efek untuk semua pemain': 'Inactive — effect applies to all players',
    'AKTIVASI GLOBAL LUCK': 'ACTIVATE GLOBAL LUCK',
    'TUMPUK GLOBAL LUCK': 'STACK GLOBAL LUCK',
    'KONFIRMASI': 'CONFIRMATION',
    'AKUN': 'ACCOUNT',
    'EFEK': 'EFFECT',
    'DURASI': 'DURATION',
    'HARGA': 'PRICE',
    'SALDO': 'BALANCE',
    'SALDO:': 'BALANCE:',
    '+1 JAM per aktivasi (maks. 10 jam)': '+1 HOUR per activation (max 10 hours)',
    'DIBATALKAN': 'CANCELLED',
    'Pembelian Global Luck dibatalkan': 'Global Luck purchase cancelled',
    'GEMS TIDAK CUKUP': 'NOT ENOUGH GEMS',
    'SUDAH MAX STACK': 'MAX STACK REACHED',
    'BUFF AKTIF': 'ACTIVE BUFF',
    'CUACA AKTIF': 'ACTIVE WEATHER',
    'TIDAK AKTIF': 'INACTIVE',
    'KOSONG': 'EMPTY',

    // Backpack (Deck, Tree, Items, Artifacts, Pets)
    'TAS KARTU': 'CARD BACKPACK',
    'KOLEKSI KARTU': 'CARD COLLECTION',
    'DECK AKTIF': 'ACTIVE DECK',
    'SIMPAN DECK': 'SAVE DECK',
    'KOLEKSI': 'COLLECTION',
    'SEMUA': 'ALL',
    '🔍 Cari kartu…': '🔍 Search cards…',
    'Cari kartu…': 'Search cards…',
    'Kartu tidak ditemukan.': 'No cards found.',
    'Tidak ada kartu varian ini.': 'No cards of this variant.',
    'Belum punya kartu. Tekan 🎲 untuk Roll.': 'No cards yet. Press 🎲 to Roll.',
    'TERKUNCI': 'LOCKED',
    'TERPASANG': 'EQUIPPED',
    'DIMILIKI': 'OWNED',
    'SUDAH DIMILIKI': 'OWNED',
    'BELUM DIMILIKI': 'NOT OWNED',
    'MILIKI': 'OWNED',
    'SIAP!': 'READY!',
    'PASANG': 'EQUIP',
    'LEPAS': 'UNEQUIP',
    'JUAL': 'SELL',
    'KUNCI': 'LOCK',
    'BUKA KUNCI': 'UNLOCK',
    'SEMUA NODE TERBUKA': 'ALL NODES UNLOCKED',
    'beli node buat naikkan stat': 'unlock nodes to boost stats',
    'naikkan LV buat dapet SP': 'level up to earn SP',
    'Butuh lk5 & sp5 terbuka': 'Requires lk5 & sp5 unlocked',
    'JUMLAH DIMILIKI:': 'OWNED QUANTITY:',
    'JUMLAH PAKET:': 'PACK QUANTITY:',
    'JUMLAH ROLL:': 'ROLL AMOUNT:',
    'PAKAI SEKARANG': 'USE NOW',
    'GABUNG SEMUA': 'MERGE ALL',
    'ARTEFAK · 2 SLOT': 'ARTIFACTS · 2 SLOTS',
    'PET · 1 SLOT': 'PET · 1 SLOT',
    'Klik slot untuk lepas': 'Click slot to unequip',
    'Beli artefak dulu untuk pasang': 'Buy an artifact first to equip',
    'SLOT KOSONG': 'EMPTY SLOT',
    'BELI ARTEFAK DULU': 'BUY AN ARTIFACT FIRST',
    'PET AKTIF': 'ACTIVE PET',
    'BELUM ADA PET AKTIF — BELI & PASANG DI BAWAH': 'NO ACTIVE PET — BUY & EQUIP BELOW',
    'Belum punya item di tas.': 'No items in your backpack yet.',
    'Gacha cuaca acak 5 menit (tidak mengubah kartu di tas).': 'Random 5-minute weather roll (does not affect cards in your backpack).',
    '100% pasti cuaca AWAKENED (×100 LUCK) selama 5 menit.': '100% guaranteed AWAKENED weather (×100 LUCK) for 5 minutes.',

    // Artifact & Pet Names (for DOM fallback)
    'MANIK REZEKI': 'FORTUNE BEAD',
    'MEDAL KEBERUNTUNGAN': 'LUCKY MEDAL',
    'GIOK HOKI': 'LUCKY JADE',
    'BATU UNTUNG': 'FORTUNE STONE',
    'CINCIN ES': 'FROST RING',
    'INTAN KUASA': 'POWER DIAMOND',
    'PEDANG API': 'FLAME SWORD',
    'HELM ABYSS': 'ABYSS HELM',
    'TAMENG SURGAWI': 'CELESTIAL SHIELD',
    'BONEKA TERKUTUK': 'CURSED DOLL',
    'MAKHLUK LAIN': 'OTHERWORLDLY BEING',
    'TITAN BUAS': 'BEAST TITAN',
    'EKOR SEMBILAN': 'NINE-TAILS',

    // Skill Tree Node Names (for DOM fallback)
    'FONDASI': 'FOUNDATION',
    'PEKA': 'KEEN EYE',
    'TERLIHAT': 'INSIGHT',
    'MENTARI': 'SOLAR GRACE',
    'BERTUAH': 'BLESSED',
    'MUARA REZEKI': 'FORTUNE ESTUARY',
    'RINGAN': 'SWIFT',
    'CEPAT': 'RAPID',
    'PETIR': 'LIGHTNING',
    'KILAT': 'FLASH',
    'CAHAYA': 'LIGHTSPEED',
    'AMPLIFIKASI I': 'AMPLIFICATION I',
    'AMPLIFIKASI II': 'AMPLIFICATION II',
    'AMPLIFIKASI III': 'AMPLIFICATION III',
    'AMPLIFIKASI IV': 'AMPLIFICATION IV',
    'SINGULARITAS': 'SINGULARITY',

    // Profile & Titles Modal
    'RINGKASAN': 'OVERVIEW',
    'PROGRES': 'PROGRESS',
    'EKUIPMEN': 'EQUIPMENT',
    'ITEM & BUFF': 'ITEMS & BUFFS',
    'STATISTIK': 'STATISTICS',
    'PENCAPAIAN': 'ACHIEVEMENTS',
    'WAKTU BERMAIN': 'PLAY TIME',
    'KARTU UNIK': 'UNIQUE CARDS',
    'HADIAH HARIAN': 'DAILY REWARD',
    'ARTEFAK DIMILIKI': 'ARTIFACTS OWNED',
    'PET DIMILIKI': 'PETS OWNED',
    'BUKA TITLE SELECTOR': 'OPEN TITLE SELECTOR',
    'Pilih gelar untuk ditampilkan di profil & leaderboard': 'Select a title to display on your profile & leaderboard',
    'TANPA TITLE': 'NO TITLE',
    'Tidak menampilkan gelar di profil': 'Do not display a title on your profile',
    'DIPAKAI': 'EQUIPPED',
    'PAKAI': 'EQUIP',
    'BELUM TERBUKA': 'LOCKED',

    // Card Index Modal
    'VARIAN TERKUMPUL': 'VARIANTS COLLECTED',
    'SEMUA VARIAN LENGKAP': 'ALL VARIANTS COMPLETE',
    'KLAIM REWARD': 'CLAIM REWARD',
    'BELUM BISA KLAIM': 'LOCKED',
    'Tidak ada kartu yang cocok': 'No matching cards',

    // Trait Synthesis & Weather Machine & Premium Shop
    'TANPA TRAIT': 'NO TRAIT',
    'ROLL UNTUK MENGAKTIFKAN MODIFIER': 'ROLL TO ACTIVATE MODIFIER',
    'CENTANG TARGET AUTO': 'CHECK AUTO TARGET',
    'centang di DROP RATE': 'check in DROP RATE',
    'Pilih Kartu': 'Select Card',
    'Belum ada kartu di tas': 'No cards in backpack yet',
    'SEMUA ITEM': 'ALL ITEMS',
    'INSTAN ROLL': 'INSTANT ROLL',
    'PET & ARTEFAK': 'PETS & ARTIFACTS',
    'WEATHER INSTAN': 'INSTANT WEATHER',

    // Leaderboard & Inspection Modal
    'PAPAN PERINGKAT GLOBAL': 'GLOBAL LEADERBOARD',
    'Memuat data peringkat dari server…': 'Loading leaderboard data from server…',
    'Memuat profil Hunter…': 'Loading Hunter profile…',
    'Gagal memuat profil.': 'Failed to load profile.',
    'KARTU UTAMA': 'MAIN CARD',
    'UNIT TERKUAT': 'STRONGEST UNIT',
    'KARTU LOBBY': 'LOBBY CARD',
    'PERINGKAT': 'STANDINGS',
    'BELUM ADA KARTU': 'NO CARD EQUIPPED',
    'MENUNGGU PEMAIN': 'WAITING FOR PLAYERS',
    'PEMAIN (TOP 50)': 'PLAYERS (TOP 50)',
    'POSISI KAMU': 'YOUR RANK',
    'KAMU BELUM PUNYA SKOR DI KATEGORI INI': 'NO SCORE RECORDED IN THIS CATEGORY YET',
    'Belum ada skor tercatat di kategori ini.': 'No scores recorded in this category yet.',

    // Story, Tower, World Boss, Daily Login
    'MULAI BATTLE': 'START BATTLE',
    'MULAI RAID': 'START RAID',
    'MULAI TOWER': 'START TOWER',
    'MENANG!': 'VICTORY!',
    'KALAH!': 'DEFEAT!',
    'HADIAH': 'REWARDS',
    'LANTAI': 'FLOOR',
    'GILIRAN': 'TURN',
    'SUDAH DIKLAIM HARI INI · KEMBALI BESOK': 'CLAIMED TODAY · COME BACK TOMORROW',
    'STAGE MASIH TERKUNCI': 'STAGE LOCKED',
    'SIAP TEMPUR': 'COMBAT READY',
    'POWER KURANG': 'LOW POWER',
    'REPLAY TERKUNCI': 'REPLAY LOCKED',
    'BAB TERKUNCI': 'CHAPTER LOCKED',
    'POWER KAMU': 'YOUR POWER',
    'GATE MUSUH': 'ENEMY GATE',
    'Kekuatan belum cukup · Upgrade kartu': 'Insufficient power · Upgrade your cards',

    // Daily Login & Watch Ads Modal
    'LOGIN HARIAN': 'DAILY LOGIN',
    '7 HARI LOGIN REWARD': '7-DAY LOGIN REWARD',
    'RESET DALAM': 'RESETS IN',
    '✓ DIKLAIM': '✓ CLAIMED',
    '★ SIAP KLAIM': '★ READY TO CLAIM',
    '🔒 TERKUNCI': '🔒 LOCKED',
    '✓ SUDAH DIKLAIM HARI INI · KEMBALI BESOK': '✓ CLAIMED TODAY · COME BACK TOMORROW',
    '📦 BUKA BACKPACK': '📦 OPEN BACKPACK',
    'Backpack → Tab Item': 'Backpack → Items Tab',
    'Lihat di Backpack': 'View in Backpack',
    'REFRESH 5 MENIT': '5-MIN REFRESH',
    'COOLDOWN 30 MENIT': '30-MIN COOLDOWN',
    'SIAP DITONTON · DURASI 5 MENIT': 'READY TO WATCH · 5-MINUTE DURATION',
    'SIAP DITONTON · REFRESH TIAP 30 MENIT': 'READY TO WATCH · REFRESHES EVERY 30 MIN',
    '🎬 TONTON IKLAN · AKTIFKAN 2× LUCK': '🎬 WATCH AD · ACTIVATE 2× LUCK',
    '🎬 TONTON IKLAN · KLAIM PACK 100K': '🎬 WATCH AD · CLAIM 100K PACK',
    '🍀 MENYIAPKAN 2× LUCK OVERDRIVE (5 MENIT)…': '🍀 PREPARING 2× LUCK OVERDRIVE (5 MINUTES)…',
    '📦 MENYIAPKAN INSTAN ROLL PACK 100K…': '📦 PREPARING INSTANT ROLL PACK 100K…',
    '2× LUCK AKTIF (5 MENIT)!': '2× LUCK ACTIVE (5 MINUTES)!',
    'Total keberuntunganmu digandakan ×2 selama 5 menit!': 'Your total luck is doubled (×2) for 5 minutes!',
    'INSTAN PACK 100K DITERIMA!': '100K INSTANT PACK CLAIMED!',
    '100.000 tarikan kartu instan berhasil dibuka!': '100,000 instant card pulls opened!',
    'BUFF MASIH AKTIF': 'BUFF STILL ACTIVE',
    'Tunggu durasi 5 menit selesai untuk menonton lagi.': 'Wait for the 5-minute duration to finish before watching again.',
    'MASIH COOLDOWN': 'ON COOLDOWN',

    // === Batch 2026-10-26: completed EN coverage ===
    // index.html
    'Total HP + ATK kartu utama + TAG': 'Total HP + ATK of main card + TAG',
    'Gems — didapat dari grinding (Tower / World Boss / Story)': 'Gems — earned from grinding (Tower / World Boss / Story)',
    'Tutup profil': 'Close profile',
    'Tutup Title': 'Close Title',
    'Tutup Update Log': 'Close Update Log',
    'Putar HP-mu': 'Rotate your phone',
    'Game ini dirancang untuk layar mendatar (landscape). Putar ponselmu untuk bermain.': 'This game is designed for landscape mode. Rotate your phone to play.',
    'Akhiri pertempuran': 'End battle',
    'KARTU RUN INI': 'CARDS THIS RUN',
    'Toko Resmi Premium Syndicate — Tarik ribuan kartu instan, koleksi artefak & pet sakti, serta aktivasi anomali cuaca legendaris langsung dengan Premium Gems!': 'Official Premium Syndicate Store — Pull thousands of instant cards, collect powerful artifacts & pets, and activate legendary weather anomalies instantly with Premium Gems!',
    'Papan peringkat': 'Leaderboard',
    'PROFIL PLAYER': 'PLAYER PROFILE',
    'Bab Sebelumnya': 'Previous Chapter',
    'Bab Berikutnya': 'Next Chapter',
    'Kartu Sebelumnya': 'Previous Card',
    'Kartu Berikutnya': 'Next Card',
    'Auto Roll (nyala/mati)': 'Auto Roll (on/off)',
    // battle.js
    'Enemy Relic I (Kosong)': 'Enemy Relic I (Empty)',
    'Enemy Relic II (Kosong)': 'Enemy Relic II (Empty)',
    'Enemy Familiar (Kosong)': 'Enemy Familiar (Empty)',
    'HAPUS EKSISTENSI': 'ERASE EXISTENCE',
    'ARMOR HABIS': 'ARMOR DEPLETED',
    'BARRIER HABIS': 'BARRIER DEPLETED',
    'DIZZY HABIS': 'DIZZY WORE OFF',
    'GERBANG PENUH...': 'ALL GATES OPEN...',
    'GILIRAN MUSUH': 'ENEMY TURN',
    'DR aktif': 'DR active',
    'semua musuh': 'all enemies',
    'BAB': 'CHAPTER',
    // boot.js
    'BAHASA AKTIF: INDONESIA (ID)': 'ACTIVE LANGUAGE: INDONESIAN (ID)',
    'Simpan semua kartu & backpack langsung ke Supabase.': 'Save all cards & backpack directly to Supabase.',
    'SIMPAN CLOUD SEKARANG': 'SAVE TO CLOUD NOW',
    'BAHASA DIUBAH': 'LANGUAGE CHANGED',
    'Bahasa tampilan diubah ke Indonesia': 'Display language changed to Indonesian',
    'MENYIMPAN KE CLOUD...': 'SAVING TO CLOUD...',
    'Semua kartu & backpack berhasil disimpan ke server.': 'All cards & backpack saved to the server.',
    'GAGAL MENYIMPAN': 'SAVE FAILED',
    'Gagal menyimpan ke cloud': 'Failed to save to cloud',
    'Antarmuka game berhasil dimuat ulang.': 'Game interface reloaded.',
    'SUARA:': 'SOUND:',
    'MATI': 'OFF',
    'NYALA': 'ON',
    'SFX sedang MATI — tekan SUARA dulu.': 'SFX is OFF — press SOUND first.',
    'CyberSfx tidak termuat': 'CyberSfx not loaded',
    'Username tidak boleh ada spasi.': 'Username cannot contain spaces.',
    'Mendaftarkan ke Cloud…': 'Registering to Cloud…',
    'Menghubungkan ke Cloud…': 'Connecting to Cloud…',
    'Tidak dapat terhubung ke server Supabase. Pastikan internet aktif dan refresh halaman.': 'Cannot connect to the Supabase server. Make sure your internet is on and refresh the page.',
    'Username ini sudah terdaftar di server (dengan password berbeda). Silakan klik MASUK atau pilih username lain.': 'This username is already registered (with a different password). Click SIGN IN or choose another username.',
    'Terlalu banyak percobaan daftar dalam waktu singkat. Tunggu 1 menit lalu coba lagi.': 'Too many sign-up attempts in a short time. Wait 1 minute and try again.',
    'Fitur Confirm Email di Supabase masih aktif. Matikan dulu di pengaturan Auth Supabase.': 'Supabase Confirm Email is still enabled. Disable it in Supabase Auth settings first.',
    'Username itu sudah dipakai di server. Coba masuk.': 'That username is already taken. Try signing in.',
    'Username itu sudah terdaftar di server. Silakan masuk (Login).': 'That username is already registered. Please sign in (Login).',
    'Akun belum memiliki data di server. Silakan klik DAFTAR untuk membuat akun di Cloud.': 'This account has no data on the server yet. Click SIGN UP to create a Cloud account.',
    'Username belum terdaftar di server atau password salah.': 'Username not registered or wrong password.',
    'Keluar dari akun ini?': 'Log out of this account?',
    'Fitur Manual Cloud Save di menu Pengaturan (simpan seluruh kartu & backpack langsung ke Supabase).': 'Manual Cloud Save in the Settings menu (save all cards & backpack directly to Supabase).',
    'Pembersihan partikel pertempuran (0 FX particles) untuk meningkatkan performa di HP kentang.': 'Battle particle cleanup (0 FX particles) for better performance on low-end phones.',
    'Perbaikan navigasi scroll pada halaman Pengaturan.': 'Fixed scroll navigation on the Settings page.',
    'Tombol Refresh Game UI untuk memuat ulang elemen tampilan tanpa refresh halaman.': 'Refresh Game UI button to reload interface elements without refreshing the page.',
    'Tombol Update Log baru di header navigasi.': 'New Update Log button in the navigation header.',
    'Integrasi resmi CrazyGames SDK v3 (Rewarded Ads dengan hadiah 2x Global Luck & Instant 100K Pack).': 'Official CrazyGames SDK v3 integration (Rewarded Ads granting 2x Global Luck & Instant 100K Pack).',
    'Sistem 7-Day Attendance Reward horizontal baru dengan Instant Roll Packs langsung ke Backpack.': 'New horizontal 7-Day Attendance Reward system with Instant Roll Packs sent straight to the Backpack.',
    'BGM baru Cyberpunk Electronic Synthwave di Lobby dengan autoplay gesture unlock.': 'New Cyberpunk Electronic Synthwave BGM in the Lobby with gesture-unlocked autoplay.',
    'Dukungan multi-bahasa penuh (English & Bahasa Indonesia) dengan selector di Pengaturan.': 'Full multi-language support (English & Indonesian) with a selector in Settings.',
    'Pembaruan Leaderboard v2 dengan podium visual Top 3 dan dossier profil publik.': 'Leaderboard v2 update with a Top 3 visual podium and public profile dossiers.',
    'HANYA FILE GAMBAR YANG DIPERBOLEHKAN': 'ONLY IMAGE FILES ARE ALLOWED',
    'FOTO PROFIL BERHASIL DIUPDATE!': 'PROFILE PHOTO UPDATED!',
    'Game ini membutuhkan koneksi internet aktif ke server Supabase. Periksa jaringan kamu untuk melanjutkan permainan.': 'This game requires an active internet connection to the Supabase server. Check your network to continue playing.',
    '— progresmu langsung tersimpan di Cloud.': '— your progress is saved straight to the Cloud.',
    // cards-fx.js
    '(kartu hilang)': '(missing card)',
    'Tidak ada efek khusus — hanya menaikkan ATK & HP.': 'No special effect — only boosts ATK & HP.',
    'MUTASI KARTU': 'CARD MUTATION',
    // data.js (story / card descriptions)
    'Kabar tentang gerbang yang terbuka itu menyebar cepat: siapa pun yang berhasil menumbangkan seluruh penjaga berhak melewati desa dan mengambil sumber tenaga yang tersimpan di menara tengahnya.': 'News of the open gate spread fast: whoever defeats every guardian earns the right to pass through the village and claim the power source stored in its central tower.',
    'Kamu melangkah masuk dari gerbang luar. Setiap penjaga yang kamu kalahkan akan mencatat jurusnya ke dalam kartumu — jadi kalah sekali pun bukan berarti pulang tangan kosong.': 'You step in through the outer gate. Every guardian you defeat records its technique into your cards — so even a loss never means going home empty-handed.',
    'Suara langkah menggema dari dalam terowongan. Setiap kutukan yang kamu kalahkan akan mencatat tekniknya ke dalam kartumu, jadi meski kalah kamu tetap pulang membawa sebagian dari kutukan mereka.': 'Footsteps echo from inside the tunnel. Every curse you defeat records its technique into your cards, so even if you lose you still bring home a piece of their curses.',
    'Kota ini penuh dengan penduduk yang \'terlalu sempurna\'. Mereka tidak bicara, hanya menunggu pembedahan dari tiga ahli waris yang bangkit kembali untuk menyelesaikan ritual nenek moyang mereka.': 'This city is full of residents who are \'too perfect\'. They never speak, only await dissection by three heirs who have risen again to complete their ancestors\' ritual.',
    'Tiap entitas yang kamu taklukkan akan meninggalkan jejak darah di tanganmu. Jejak itu bukan kutukan—tapi tanda bahwa kamu berhak melanjutkan perjalanan ke tempat di mana segalanya bermula.': 'Every entity you conquer leaves a trace of blood on your hands. That trace is no curse—but a sign that you have earned the right to journey on to where it all began.',
    'Sharingan menyalin SELURUH passive lawan di tiap pertarungan — jurus musuh dipakai balik oleh Copy Ninja.': 'Sharingan copies ALL of the opponent\'s passives every fight — the Copy Ninja turns enemy techniques back on them.',
    '25% serangan berubah jadi tusukan arus dengan damage ×1.4.': '25% of attacks become a current thrust dealing ×1.4 damage.',
    '25% setiap serangan musuh ditolak sampai tidak menghasilkan damage sama sekali.': '25% chance each enemy attack is repelled, dealing no damage at all.',
    '20% serangan berubah jadi ledakan Masenko dengan damage ×1.5.': '20% of attacks become a Masenko blast dealing ×1.5 damage.',
    '45% peluang tembakan tembus yang menembus pertahanan musuh.': '45% chance of a piercing shot that ignores enemy defense.',
    'Selama HP masih di atas 60%, setiap serangan membawa 35% damage tambahan.': 'While HP stays above 60%, every attack deals 35% bonus damage.',
    '20% peluang meniadakan damage musuh dan mengubahnya jadi pemulihan HP, plus menyerap 15% damage.': '20% chance to nullify enemy damage and convert it into HP recovery, plus 15% lifesteal.',
    '18% peluang membuka serangan dengan dua hantaman palu beruntun.': '18% chance to open with two consecutive hammer strikes.',
    'Dua turn pertama punya 24% peluang melepas bayangan penangkis sampai damage musuh jadi nol.': 'During the first two turns, 24% chance to release a parrying shadow that reduces enemy damage to zero.',
    '30% pukulan berubah jadi tinju kutukan dengan damage ×1.6.': '30% of hits become a cursed fist dealing ×1.6 damage.',
    '40% peluang melepas Purple yang menembus total pertahanan musuh.': '40% chance to unleash Purple, fully piercing enemy defense.',
    '30% serangan menghantam dengan rahang purba dengan damage ×1.5.': '30% of attacks strike with primordial jaws dealing ×1.5 damage.',
    '20% peluang memukul dua kali beruntun — stand-nya bergerak lebih cepat dari penggunanya.': '20% chance to strike twice in a row — the stand moves faster than its user.',
    'Menyerap 20% dari total damage yang diberikan jadi HP — usaha lawan selalu kembali ke nol.': 'Absorbs 20% of total damage dealt as HP — the opponent\'s efforts always return to zero.',
    '25% peluang menghentikan waktu: damage musuh ditiadakan dan berubah jadi pemulihan HP, plus menyerap 15% damage.': '25% chance to stop time: enemy damage is nullified and turned into HP recovery, plus 15% lifesteal.',
    '25% setiap serangan musuh dibelokkan oleh mimpi opal putih sampai tidak menghasilkan damage.': '25% chance each enemy attack is deflected by a white opal dream, dealing no damage.',
    '40% peluang serangan menulis ulang halaman pertahanan musuh — menembus total pertahanan.': '40% chance an attack rewrites the enemy\'s defense page — fully piercing defense.',
    'Menyerap 18% dari total damage yang diberikan jadi HP — darah iblis memulihkan dirinya sendiri.': 'Absorbs 18% of total damage dealt as HP — demon blood heals itself.',
    '35% serangan menyambar seperti petir dengan damage ×1.7.': '35% of attacks strike like lightning dealing ×1.7 damage.',
    '25% peluang menerkam dua kali beruntun dengan dual gergaji berkarat.': '25% chance to pounce twice in a row with rusty twin saws.',
    'Ketika Undying Rogue mengalahkan sebuah kartu, secara permanen curi 15% dari stat-nya (ATK & HP) dan tambahkan ke stat miliknya sendiri.': 'When Undying Rogue defeats a card, it permanently steals 15% of its stats (ATK & HP) and adds them to its own.',
    'Ketika kartu apapun di party-mu mati, Royal Vanguard mendapatkan +25% serangan secara permanen (menumpuk tiap kali ada kartu party yang jatuh).': 'Whenever any card in your party dies, Royal Vanguard permanently gains +25% attack (stacks each time a party card falls).',
    'Di bawah 30% HP, serangan berikutnya memberikan damage 2.2x. Wildheart Hunter mati di akhir giliran.': 'Below 30% HP, the next attack deals 2.2x damage. Wildheart Hunter dies at the end of the turn.',
    'Hit pertama melawan kartu baru manapun memberikan 35% damage lebih.': 'The first hit against any new card deals 35% more damage.',
    'Memanggil bayangan klon - menghindari serangan pertama!': 'Summons a shadow clone - dodges the first attack!',
    '35% kesempatan menghindar serangan apapun. Tiap sukses menghindar, serangan berikutnya +40% damage.': '35% chance to dodge any attack. Each successful dodge gives the next attack +40% damage.',
    'TIDAK PERNAH terkena status effect apapun (stun, burn, dan efek negatif lainnya). 50% peluang menembakkan ICE BLAST: 3 serangan beruntun masing-masing 75% ATK.': 'NEVER affected by any status effect (stun, burn, and other debuffs). 50% chance to fire ICE BLAST: 3 consecutive attacks of 75% ATK each.',
    // devtools-guard.js
    'DEVTOOLS / INSPECT TERBUKA': 'DEVTOOLS / INSPECT OPEN',
    'Save akan': 'Your save will be',
    'DIKEMBALIKAN KE AWAL': 'RESET TO THE START',
    '(coin, kartu, item, progres, peringkat).': '(coins, cards, items, progress, rank).',
    'Tutup DevTools sekarang untuk membatalkan.': 'Close DevTools now to cancel.',
    'AKUN DEVELOPER — DIKECUALIKAN': 'DEVELOPER ACCOUNT — EXEMPT',
    'SAVE DIRESET KE AWAL': 'SAVE RESET TO START',
    'RESET GAGAL': 'RESET FAILED',
    'Username ini ada di daftar': 'This username is on the',
    ', jadi progres tidak dihapus.': 'list, so progress was not erased.',
    'Tidak ada sesi login, jadi hanya save lokal yang dibersihkan.': 'No login session, so only the local save was cleared.',
    'Server menolak reset (sesi Auth tidak siap). Muat ulang lalu coba lagi.': 'Server rejected the reset (Auth session not ready). Reload and try again.',
    // panels.js
    'Mata mulai tajam cari yang langka.': 'Your eye for rare finds sharpens.',
    'Peluang kartu bagus naik.': 'Chance of good cards increases.',
    'Rezeki mulai ngalir.': 'Fortune starts flowing.',
    'Semua aliran hoki bermuara ke lo. +10% pengali luck.': 'All streams of luck flow to you. +10% luck multiplier.',
    'Roll mulai ngebut.': 'Rolls speed up.',
    'Mentok jalur speed pohon (kumulatif 5.0×) — total roll speed bisa lebih tinggi +potion/cuaca.': 'Speed tree path maxed (cumulative 5.0×) — total roll speed can go higher with potions/weather.',
    'CUACA': 'WEATHER',
    'SELAMA 30 MENIT!': 'FOR 30 MINUTES!',
    'ROTASI CUACA SERVER · 30 MENIT': 'SERVER WEATHER ROTATION · 30 MIN',
    'Kumpulkan 15 varian index untuk klaim!': 'Collect 15 index variants to claim!',
    'Koleksi 10 kartu unik': 'Collect 10 unique cards',
    'Dapatkan minimal 1 kartu Shiny': 'Get at least 1 Shiny card',
    'Capai lantai 10 Infinite Tower': 'Reach Infinite Tower floor 10',
    'Belum ada kartu': 'No cards yet',
    'KARTU UTAMA ·': 'MAIN CARD ·',
    'KARTU UTAMA · —': 'MAIN CARD · —',
    'Artefak kosong': 'No artifact',
    'KARTU': 'CARDS',
    'Tanpa kartu': 'No card',
    'HARI': 'DAY',
    'AKTIF': 'ACTIVE',
    'Roll kartu pertama': 'Roll your first card',
    'Kumpulkan 10 kartu unik': 'Collect 10 unique cards',
    'Dapatkan 1 kartu shiny': 'Get 1 shiny card',
    '· belum': '· not yet',
    'BELUM ADA TITLE': 'NO TITLE YET',
    'Selesaikan misi awal untuk membuka pencapaian': 'Complete the starter missions to unlock achievements',
    'KARTU ·': 'CARD ·',
    'TIDAK ADA': 'NONE',
    'BELUM ADA ARTEFAK': 'NO ARTIFACTS YET',
    'Beli di toko untuk membuka slot': 'Buy in the shop to unlock slots',
    'BELUM ADA PET': 'NO PETS YET',
    'Dapatkan pet dari raid / tower': 'Get pets from raids / tower',
    'Tutup Backpack': 'Close Backpack',
    'Aktif:': 'Active:',
    'SPECIAL ROLL PACK - Berisi 5.000 tarikan kartu instan ke dalam koleksi.': 'SPECIAL ROLL PACK - Contains 5,000 instant card pulls for your collection.',
    'SPECIAL ROLL PACK - Berisi 10.000 tarikan kartu instan ke dalam koleksi.': 'SPECIAL ROLL PACK - Contains 10,000 instant card pulls for your collection.',
    'SPECIAL ROLL PACK - Berisi 25.000 tarikan kartu instan ke dalam koleksi.': 'SPECIAL ROLL PACK - Contains 25,000 instant card pulls for your collection.',
    'SPECIAL ROLL PACK - Berisi 50.000 tarikan kartu instan ke dalam koleksi.': 'SPECIAL ROLL PACK - Contains 50,000 instant card pulls for your collection.',
    'STOK TIDAK CUKUP': 'NOT ENOUGH STOCK',
    'Potion habis': 'Out of potions',
    'ROLL LEBIH JELEK · CUACA TETEP': 'WORSE ROLL · WEATHER UNCHANGED',
    'WEATHER AKTIF · 5 MENIT': 'WEATHER ACTIVE · 5 MIN',
    'MENIT': 'MIN',
    'INTAN ROLL habis': 'Out of ROLL GEMS',
    'PACK HABIS': 'OUT OF PACKS',
    'TIDAK ADA ITEM': 'NO ITEMS',
    'SP kurang': 'Not enough SP',
    'Buka node sebelumnya dulu': 'Unlock the previous node first',
    'Udah dibuka': 'Already unlocked',
    'GAK BISA': 'CAN\'T DO THAT',
    'COIN KURANG': 'NOT ENOUGH COINS',
    'GEMS KURANG': 'NOT ENOUGH GEMS',
    'ITEM TIDAK DIKENAL': 'UNKNOWN ITEM',
    'TIDAK DIJUAL DI SINI': 'NOT SOLD HERE',
    'AKUN BELUM TERSINKRON': 'ACCOUNT NOT SYNCED',
    'SERVER TIDAK MERESPONS': 'SERVER NOT RESPONDING',
    'DROP BASE DI INF TOWER': 'BASE DROPS IN INF TOWER',
    'TRANSAKSI GAGAL': 'TRANSACTION FAILED',
    'Rubah legendaris masa depan! Memberikan +250 Flat Luck & +300% Luck saat dipasang.': 'Legendary fox of the future! Grants +250 Flat Luck & +300% Luck when equipped.',
    '5.000 tarikan kartu instan ke dalam inventori.': '5,000 instant card pulls into your inventory.',
    '10.000 tarikan kartu instan ke dalam inventori.': '10,000 instant card pulls into your inventory.',
    '25.000 tarikan kartu instan ke dalam inventori.': '25,000 instant card pulls into your inventory.',
    '50.000 tarikan kartu instan ke dalam inventori.': '50,000 instant card pulls into your inventory.',
    'tarikan kartu instan': 'instant card pulls',
    'tarikan kartu instan ke dalam Backpack.': 'instant card pulls into your Backpack.',
    'Artefak permanen masuk Backpack.': 'Permanent artifact goes to your Backpack.',
    'Pet sakti masuk Backpack.': 'Powerful pet goes to your Backpack.',
    'CUACA SERVER': 'SERVER WEATHER',
    'langsung aktif untuk': 'instantly active for',
    'SEMUA PEMAIN DI SERVER': 'ALL PLAYERS ON THE SERVER',
    '30 MENIT': '30 MINUTES',
    'SUDAH DIMILIKI (ARTEFAK)': 'ALREADY OWNED (ARTIFACT)',
    'SUDAH DIMILIKI (PET)': 'ALREADY OWNED (PET)',
    'AKTIFKAN KE SEMUA SERVER (30 MENIT)': 'ACTIVATE FOR WHOLE SERVER (30 MIN)',
    'DIMILIKI DI BACKPACK:': 'OWNED IN BACKPACK:',
    'SUDAH PUNYA': 'ALREADY OWNED',
    'sudah ada di Backpack!': 'is already in your Backpack!',
    'Saldo tidak mencukupi!': 'Insufficient balance!',
    'Gems untuk beli ini!': 'Gems to buy this!',
    'PEMBELIAN BERHASIL!': 'PURCHASE SUCCESSFUL!',
    'Terjadi kesalahan saat transaksi': 'An error occurred during the transaction',
    'POTION HABIS': 'OUT OF POTIONS',
    'Tidak ada Weather Potion tersisa!': 'No Weather Potions left!',
    '× SINTESIS CUACA': '× WEATHER SYNTHESIS',
    'Anomali aktif:': 'Active anomaly:',
    'PILIH TARGET': 'SELECT TARGET',
    'Centang target cuaca pada daftar di sebelah kanan terlebih dahulu!': 'Check a target weather in the list on the right first!',
    'Dibutuhkan Weather Potion untuk memulai auto-synthesis!': 'A Weather Potion is required to start auto-synthesis!',
    'AUTO SELESAI': 'AUTO FINISHED',
    'Weather Potion habis!': 'Out of Weather Potions!',
    'SINTESIS CUACA': 'WEATHER SYNTHESIS',
    'PILIH DARI DAFTAR': 'PICK FROM LIST',
    'PILIH TARGET AUTO': 'SELECT AUTO TARGET',
    '× AKTIF!': '× ACTIVE!',
    'Global Luck sudah 100× — tidak bisa ditambah lagi': 'Global Luck is already 100× — cannot be increased further',
    '(dari': '(from',
    'GAGAL': 'FAILED',
    'Cloud tidak tersedia': 'Cloud unavailable',
    'Transaksi gagal': 'Transaction failed',
    '🍀 GLOBAL LUCK AKTIF!': '🍀 GLOBAL LUCK ACTIVE!',
    'BELI GEMS': 'BUY GEMS',
    'Masukkan kode redeem dari Trakteer': 'Enter your Trakteer redeem code',
    'TUKAR': 'REDEEM',
    'Kode redeem dibeli di Trakteer Shop. Satu kode hanya bisa dipakai 1x.': 'Redeem codes are bought at the Trakteer Shop. Each code can only be used once.',
    'BELI DI TRAKTEER': 'BUY ON TRAKTEER',
    'Saldo kamu:': 'Your balance:',
    'BELI SEKARANG': 'BUY NOW',
    'Pembayaran lewat Google Play Billing. Gems masuk otomatis setelah pembelian terverifikasi.': 'Payment via Google Play Billing. Gems are added automatically once the purchase is verified.',
    'Gems didapat dari grinding: Tower, Boss Raid & Story.': 'Gems are earned by grinding: Tower, Boss Raid & Story.',
    'Modul top-up belum siap. Muat ulang halaman.': 'Top-up module not ready. Reload the page.',
    '⏳ TUNGGU': '⏳ WAIT',
    'TUNGGU': 'WAIT',
    'lagi untuk klaim Pack 100K.': 'more to claim the 100K Pack.',
    // raid.js
    'POOL UTUH · BUKA SETELAH UPDATE': 'POOL INTACT · OPENS AFTER UPDATE',
    'LOGIN UNTUK IKUT HITUNGAN POOL': 'LOG IN TO COUNT TOWARD THE POOL',
    'SERVER BELUM SIAP — MAIN LOKAL TETAP BISA': 'SERVER NOT READY — LOCAL PLAY STILL WORKS',
    'HUNTER · DAMAGE HARI INI': 'HUNTER · TODAY\'S DAMAGE',
    'LOGIN UNTUK PAPAN GLOBAL': 'LOG IN FOR THE GLOBAL BOARD',
    'BELUM ADA SKOR HARI INI — JADI YANG PERTAMA': 'NO SCORES TODAY — BE THE FIRST',
    'Reward kemarin sudah diklaim': 'Yesterday\'s reward already claimed',
    'Gagal klaim reward — coba lagi': 'Failed to claim reward — try again',
    'KLAIM': 'CLAIM',
    'POOL TUMBANG / ATTEMPT HABIS': 'POOL DEPLETED / NO ATTEMPTS LEFT',
    'BUKA SETELAH UPDATE': 'OPENS AFTER UPDATE',
    'TIDAK BISA DEPLOY': 'CANNOT DEPLOY',
    'Kembali ke lobby': 'Back to lobby',
    'HARIAN': 'DAILY',
    'JUARA HARIAN': 'DAILY CHAMPION',
    'TOP HUNTER HARI INI': 'TODAY\'S TOP HUNTERS',
    'PAPAN PENUH': 'FULL BOARD',
    'BOSS INI BELUM TERSEDIA': 'THIS BOSS IS NOT AVAILABLE YET',
    'WORLD BOSS SUDAH TUMBANG · RESET 00:00 WIB': 'WORLD BOSS DEFEATED · RESETS 00:00 WIB',
    'ATTEMPT HARI INI HABIS · RESET 00:00 WIB': 'NO ATTEMPTS LEFT TODAY · RESETS 00:00 WIB',
    'Papan peringkat belum tersedia': 'Leaderboard not available yet',
    'Kembali ke hub raid': 'Back to raid hub',
    'PILIH KARTU RAID': 'SELECT RAID CARD',
    'Tidak ada kartu yang cocok dengan pencarian.': 'No cards match your search.',
    'GAGAL MULAI RUN · COBA LAGI': 'FAILED TO START RUN · TRY AGAIN',
    'MENGIRIM DAMAGE KE WORLD BOSS…': 'SENDING DAMAGE TO WORLD BOSS…',
    '· SISA': '· LEFT',
    'MAIN LOKAL · DAMAGE TIDAK DIKIRIM': 'LOCAL PLAY · DAMAGE NOT SENT',
    'RUN SELESAI': 'RUN COMPLETE',
    'Damage run ini': 'Damage this run',
    'DARI POOL 10B': 'OF THE 10B POOL',
    'Damage terbaik 1 run masuk papan peringkat harian. Reward rank diklaim besok di hub.': 'Your best single-run damage goes on the daily leaderboard. Rank rewards are claimed tomorrow in the hub.',
    'RAID LAGI': 'RAID AGAIN',
    'Tukar 100 TOKEN WORLD BOSS menjadi 20 GEM premium. Bisa ditukar berulang tanpa batas — keran GEM dari World Boss.': 'Exchange 100 WORLD BOSS TOKENS for 20 premium GEMS. Unlimited exchanges — the World Boss GEM faucet.',
    'Koin untuk roll trait & kebutuhan lain.': 'Coins for trait rolls & other needs.',
    'Kartu BOSS eksklusif — beli SEKALI, roll terbuka PERMANEN di semua gacha. Chance dasar 1 in 25 jt · ICE BLAST 50% (3×75% ATK) · immune semua status effect.': 'Exclusive BOSS card — buy ONCE, roll unlocked PERMANENTLY in all gacha. Base chance 1 in 25M · ICE BLAST 50% (3×75% ATK) · immune to all status effects.',
    'Kartu BOSS eksklusif — beli SEKALI, LANGSUNG didapat + roll terbuka PERMANEN di semua gacha. Chance dasar 1 in 100 jt · NECROMANCER \'ETERNAL LEGION\' (Shadow Army).': 'Exclusive BOSS card — buy ONCE, get it INSTANTLY + roll unlocked PERMANENTLY in all gacha. Base chance 1 in 100M · NECROMANCER \'ETERNAL LEGION\' (Shadow Army).',
    'Artefak CRAYON V2 — +80 flat & +120% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot artefak, equip 2 slot).': 'CRAYON V2 Artifact — permanent +80 flat & +120% LUCK. Buy ONCE, goes straight to Backpack (artifact slot, equip 2 slots).',
    'Pet CRAYON V2 — +150 flat & +220% LUCK permanen. Beli SEKALI, langsung masuk Backpack (slot pet, equip 1).': 'CRAYON V2 Pet — permanent +150 flat & +220% LUCK. Buy ONCE, goes straight to Backpack (pet slot, equip 1).',
    '+3 FLAT LUCK · 5 MENIT': '+3 FLAT LUCK · 5 MIN',
    '+5 FLAT & +10% LUCK · 5 MENIT': '+5 FLAT & +10% LUCK · 5 MIN',
    '+10 FLAT & +20% LUCK · 5 MENIT': '+10 FLAT & +20% LUCK · 5 MIN',
    'SPEED +0.2× · 5 MENIT': 'SPEED +0.2× · 5 MIN',
    'SPEED +0.5× · 5 MENIT': 'SPEED +0.5× · 5 MIN',
    'SPEED +1.0× · 5 MENIT': 'SPEED +1.0× · 5 MIN',
    'TOKEN KURANG': 'NOT ENOUGH TOKENS',
    'BATAS HARIAN': 'DAILY LIMIT',
    'coba lagi': 'try again',
    'Kartu itu sudah ada di Deck kamu': 'That card is already in your Deck',
    'Sudah dibeli — permanen di Backpack': 'Already purchased — permanently in Backpack',
    'TUKAR TOKEN → GEM (TANPA BATAS)': 'EXCHANGE TOKEN → GEM (UNLIMITED)',
    'Roll gacha sudah permanen terbuka': 'Gacha roll already permanently unlocked',
    'Permanen tersimpan di Backpack': 'Permanently stored in Backpack',
    'KEMBALI KE WORLD BOSS': 'BACK TO WORLD BOSS',
    'DECK SYNAPSE KOSONG. Buka kartu terlebih dahulu via Gacha Summon.': 'SYNAPSE DECK EMPTY. Unlock cards first via Gacha Summon.',
    'Ganti target kartu': 'Change target card',
    'Ganti Target Kartu': 'Change Target Card',
    'Roll menyuntikkan trait mod ke target & berhenti otomatis jika target matrix cocok.': 'Rolling injects a trait mod into the target & stops automatically when the target matrix matches.',
    'Deck kosong.': 'Deck is empty.',
    'Tidak ada kartu yang cocok.': 'No matching cards.',
    'kartu target': 'target card',
    'Auto roll akan mulai mengganti trait ini. Trait hanya aman kalau sudah dicentang sebagai target (auto berhenti saat kena). Sisa coin:': 'Auto roll will start replacing this trait. A trait is only safe if checked as a target (auto stops when hit). Coins left:',
    'Trait ini akan': 'This trait will be',
    'kalau kamu roll lagi. Sisa coin:': 'if you roll again. Coins left:',
    'TRAIT LANGKA TERPASANG': 'RARE TRAIT APPLIED',
    'LANJUT AUTO': 'CONTINUE AUTO',
    'TRAIT LANGKA · AUTO ROLL BERHENTI': 'RARE TRAIT · AUTO ROLL STOPPED',
    'TRAIT LANGKA': 'RARE TRAIT',
    'STOP · SIMPAN INI': 'STOP · KEEP THIS',
    'SIMPAN': 'KEEP',
    'SIMPAN memasang trait ini ke kartu target. ROLL LAGI membuang hasil ini dan mencoba lagi (bayar coin lagi).': 'KEEP applies this trait to the target card. ROLL AGAIN discards this result and tries again (costs coins again).',
    'COIN UNTUK AUTO ROLL': 'COINS FOR AUTO ROLL',
    'AUTO ROLL STOP · COIN HABIS': 'AUTO ROLL STOPPED · OUT OF COINS',
    // ranking.js
    'Rarest Pull · kartu paling langka yang pernah di-roll · reset mingguan (Senin).': 'Rarest Pull · rarest card ever rolled · resets weekly (Monday).',
    'Lihat profil player': 'View player profile',
    'BARU': 'NEW',
    'Slot Terbuka': 'Open Slot',
    'MODUL TIDAK TERSEDIA': 'MODULE UNAVAILABLE',
    'Mode Offline · Sambungkan koneksi internet untuk sinkronisasi ranking dunia.': 'Offline Mode · Connect to the internet to sync world rankings.',
    'Server belum merespons · Coba tekan tombol sinkronisasi lagi sebentar lagi.': 'Server not responding yet · Try pressing the sync button again shortly.',
    'KAMU BELUM PUNYA SKOR': 'YOU HAVE NO SCORE YET',
    'LOGIN UNTUK MENCATAT SKOR': 'LOG IN TO RECORD SCORES',
    'BARU SAJA': 'JUST NOW',
    'MENIT LALU': 'MIN AGO',
    'JAM LALU': 'HR AGO',
    'HARI LALU': 'DAYS AGO',
    'Belum ada skor': 'No score yet',
    'KARTU PALING LANGKA (RAREST PULL)': 'RAREST CARD (RAREST PULL)',
    'Belum ada kartu utama': 'No main card yet',
    'SERVER TIDAK TERHUBUNG': 'SERVER NOT CONNECTED',
    'Profil player hanya tersedia saat online.': 'Player profiles are only available online.',
    'MEMUAT PROFIL…': 'LOADING PROFILE…',
    'PROFIL TIDAK DITEMUKAN': 'PROFILE NOT FOUND',
    'belum pernah tersimpan di server.': 'has never been saved to the server.',
    'GAGAL MEMUAT': 'FAILED TO LOAD',
    'Coba buka lagi sebentar lagi.': 'Try opening again shortly.',
    // rpc-guard.js
    'AKSES RPC DI LUAR GAME': 'RPC ACCESS OUTSIDE THE GAME',
    'coin · gem · kartu · item · progres · peringkat': 'coins · gems · cards · items · progress · rank',
    'Save sudah dikunci di server — menutup tab tidak membantu.': 'Save is already locked on the server — closing the tab won\'t help.',
    'RESET GAGAL — COBA LAGI': 'RESET FAILED — TRY AGAIN',
    'Server sedang menyelesaikan reset.': 'Server is finishing the reset.',
    // sheetfx.js
    'Kekuatan pasif kartu bangkit menembus batas pertahanan.': 'The card\'s passive power awakens, breaking through defenses.',
    // state.js
    'BAB SELESAI': 'CHAPTER COMPLETE',
    'PROGRES BELUM TERBUKA': 'PROGRESS NOT UNLOCKED',
    'Coba lagi nanti': 'Try again later',
    'GEM GAGAL': 'GEM FAILED',
    'SELESAI ·': 'COMPLETE ·',
    'sebelum replay stage ini': 'before replaying this stage',
    '🎁 KLAIM DAY': '🎁 CLAIM DAY',
    '× INSTAN ROLL PACK 100K (SIMPAN KE BACKPACK)': '× INSTANT ROLL PACK 100K (SAVE TO BACKPACK)',
    'Akan dicoba lagi': 'Will retry',
    '✓ SELESAI': '✓ DONE',
    '▾ BUKA LEVEL': '▾ OPEN LEVEL',
    'UNTUK BUKA MODE INI': 'TO UNLOCK THIS MODE',
    'STORY · BAB N': 'STORY · CHAPTER N',
    'CERITA ·': 'STORY ·',
    'gagal membuka cerita': 'failed to open story',
    'TERKUNCI — SELESAIKAN STAGE 0': 'LOCKED — COMPLETE STAGE 0',
    // supabase-sync.js
    'ITEM TANPA BAYAR · COIN DI-RESET 0': 'UNPAID ITEM · COINS RESET TO 0',
    'COIN TIDAK SAH · SALDO DI-RESET 0': 'INVALID COINS · BALANCE RESET TO 0',
    'NILAI TIDAK SAH DI-NOL-KAN ·': 'INVALID VALUES ZEROED ·',
    'GAGAL KONEKSI:': 'CONNECTION FAILED:',
    'GAGAL BELI PACK': 'PACK PURCHASE FAILED',
    'GAGAL BELI ITEM': 'ITEM PURCHASE FAILED',
    'GAGAL BELI CUACA': 'WEATHER PURCHASE FAILED',
    'AKUN TIDAK DITEMUKAN': 'ACCOUNT NOT FOUND',
    'GAGAL MENGHUBUNGI SERVER SUPABASE': 'FAILED TO REACH SUPABASE SERVER',
    'GAGAL POTONG GEMS': 'FAILED TO DEDUCT GEMS',
    'GAGAL MENGHUBUNGI CLOUD:': 'FAILED TO REACH CLOUD:',
    'SESI LOGIN TIDAK LENGKAP': 'INCOMPLETE LOGIN SESSION',
    'GAGAL MENGHUBUNGI CLOUD': 'FAILED TO REACH CLOUD',
    'Akun kamu baru saja masuk di perangkat lain. Permainan di perangkat ini telah ditutup.': 'Your account just signed in on another device. The game on this device has been closed.',
    'KEMBALI KE LOGIN': 'BACK TO LOGIN',
    // topup.js
    'LOGIN DULU': 'LOG IN FIRST',
    'Top-up hanya untuk akun yang sudah login.': 'Top-up is only for logged-in accounts.',
    'PEMBAYARAN BERHASIL!': 'PAYMENT SUCCESSFUL!',
    'Gems masuk ke akunmu. Saldo sekarang': 'Gems added to your account. Current balance',
    'Paket tidak ditemukan.': 'Package not found.',
    'Sesi login tidak lengkap. Silakan logout lalu login ulang.': 'Login session incomplete. Please log out and log in again.',
    'Modul pembelian tidak tersedia di perangkat ini.': 'Purchase module not available on this device.',
    '❌ PEMBELIAN GAGAL': '❌ PURCHASE FAILED',
    'Tidak bisa memulai pembelian.': 'Could not start the purchase.',
    'Pembelian gagal.': 'Purchase failed.',
    'Pembelian tidak terkonfirmasi.': 'Purchase not confirmed.',
    'ℹ️ PEMBELIAN SELESAI': 'ℹ️ PURCHASE COMPLETE',
    '❌ VERIFIKASI GAGAL': '❌ VERIFICATION FAILED',
    'Gagal memverifikasi pembelian ke Google Play.': 'Failed to verify the purchase with Google Play.',
    'Verifikasi pembelian gagal.': 'Purchase verification failed.',
    'ℹ️ TOKO BELUM DIKONFIGURASI': 'ℹ️ STORE NOT CONFIGURED',
    'Link toko Trakteer belum diatur. Bookmark dulu halaman ini, atau cek kembali nanti.': 'Trakteer store link not set. Bookmark this page or check back later.',
    'TOKO BELUM SIAP': 'STORE NOT READY',
    'Link toko Trakteer belum dikonfigurasi.': 'Trakteer store link not configured.',
    '🛒 LALU KE TOKO TRAKTEER': '🛒 THEN GO TO THE TRAKTEER STORE',
    'Selesaikan pembayaran di tab toko. Setelah bayar, kode redeem dikirim ke Anda.': 'Complete payment in the store tab. After paying, a redeem code is sent to you.',
    'Kembali ke sini dan masukkan kodenya di tab PUNYA KODE.': 'Come back here and enter the code in the HAVE A CODE tab.',
    '❌ SERVER BELUM SIAP': '❌ SERVER NOT READY',
    'Modul sinkronisasi cloud belum termuat. Muat ulang halaman.': 'Cloud sync module not loaded. Reload the page.',
    '⚠️ KODE KOSONG': '⚠️ EMPTY CODE',
    'Masukkan kode redeem dulu.': 'Enter a redeem code first.',
    '❌ SESI TIDAK LENGKAP': '❌ INCOMPLETE SESSION',
    'Kode tidak ditemukan. Cek kembali kode dari Trakteer.': 'Code not found. Double-check your Trakteer code.',
    'Kode ini sudah dinonaktifkan.': 'This code has been deactivated.',
    'Kode ini sudah kedaluwarsa.': 'This code has expired.',
    'Kode ini sudah pernah dipakai akun lain.': 'This code was already used by another account.',
    'Akun tidak ditemukan di server.': 'Account not found on the server.',
    'Data tidak valid.': 'Invalid data.',
    'Kode tidak valid atau sudah dipakai.': 'Code is invalid or already used.',
    '❌ KODE GAGAL DITERIMA': '❌ CODE REJECTED',
    'ℹ️ KODE SUDAH DIPAKAI': 'ℹ️ CODE ALREADY USED',
    'Kode ini sudah pernah ditukar. Saldo tidak ditambah lagi.': 'This code was already redeemed. Balance was not increased again.',
    'SUDAH DIPAKAI': 'ALREADY USED',
    'Kode ini sudah pernah ditukar.': 'This code was already redeemed.',
    // tower-lobby.js
    'BOS LANTAI': 'FLOOR BOSS',
    'MULAI PENETRASI': 'BEGIN PENETRATION',
    'Tukar 100 TOKEN INF menjadi 10 GEM premium. Bisa ditukar berulang tanpa batas — keran utama GEM dari grinding menara.': 'Exchange 100 INF TOKENS for 10 premium GEMS. Unlimited exchanges — the main GEM faucet from tower grinding.',
    'TUKAR TOKEN → GEM': 'EXCHANGE TOKEN → GEM',
    'Roll sudah permanen terbuka': 'Roll already permanently unlocked',
    'TOKEN INF TIDAK CUKUP': 'NOT ENOUGH INF TOKENS',
    'LOCKED // BELI DULU': 'LOCKED // BUY FIRST',
    'SUDAH TERBUKA': 'ALREADY UNLOCKED',
    'Roll kartu ini sudah permanen terbuka': 'This card\'s roll is already permanently unlocked',
    'TUKAR BERHASIL': 'EXCHANGE SUCCESSFUL',
    'TUKAR GAGAL': 'EXCHANGE FAILED',
    'BELI GAGAL': 'PURCHASE FAILED',
    'LANTAI': 'FLOOR',
    'yang di belakangnya': 'behind it',
    'LANTAI BELUM TERBUKA': 'FLOOR NOT UNLOCKED',
    'BATAS COIN HARIAN': 'DAILY COIN LIMIT',
    'Coin lantai ini tidak dibayar server': 'This floor\'s coins were not paid by the server',
    'BATAS TOKEN HARIAN': 'DAILY TOKEN LIMIT',
    'Token lantai ini tidak dibayar server': 'This floor\'s tokens were not paid by the server',
    '· MASUK BACKPACK': '· SENT TO BACKPACK',
    'DI DEK · SLOT': 'IN DECK · SLOT',
    'PASANG KE DEK': 'ADD TO DECK',
    'Kosong — klik untuk buka Backpack': 'Empty — click to open Backpack',
    'Kosong — klik untuk pasang Pet': 'Empty — click to equip a Pet',
    'Rebirth: tukar essence duplikat jadi luck permanen': 'Rebirth: exchange duplicate essence for permanent luck',
    'ESSENCE KURANG': 'NOT ENOUGH ESSENCE',
    'Masuk World Boss': 'Enter World Boss',
    'Masuk Infinite Tower': 'Enter Infinite Tower',
    'Buka Weather Machine': 'Open Weather Machine',
    'Install aplikasi ke perangkat': 'Install the app on your device',
    'Toko Premium - Beli Roll Pack': 'Premium Store - Buy Roll Packs',
    'Buka Katalog Kartu': 'Open Card Catalog',
    'Roll Trait untuk kartu aktif': 'Roll Traits for the active card',
    'Buka daftar misi': 'Open mission list',
    'Buka Leaderboard': 'Open Leaderboard',
    'World Boss · rank harian': 'World Boss · daily rank',
    'PASTI SETIAP LANTAI': 'GUARANTEED EVERY FLOOR',
    'TARIKAN KARTU INSTAN': 'INSTANT CARD PULLS',
    '100 tarikan dijamin per lantai (tabung dulu, di-roll saat run tamat)': '100 pulls guaranteed per floor (banked, rolled when the run ends)',
    '+1 per lantai biasa · +5 per lantai bos (kelipatan 5)': '+1 per normal floor · +5 per boss floor (multiples of 5)',
    'INSTAN PACK · DROP ACAK PER LANTAI': 'INSTANT PACK · RANDOM DROP PER FLOOR',
    'Masuk tab ITEM di Backpack · siap pakai': 'Goes to the ITEM tab in Backpack · ready to use',
    'Semua drop dihitung': 'All drops are calculated',
    'per lantai': 'per floor',
    'yang dit taklukkan. Peluang Instan Pack, artefak & pet': 'conquered. Instant Pack, artifact & pet chances',
    // roll-system.js
    'Tidak ada kartu di backpack! Roll dulu ya.': 'No cards in your backpack! Roll first.',
    'Pilih Kartu untuk Slot': 'Choose a Card for Slot',
    'Backpack kosong!': 'Backpack is empty!',
    'Mulai Roll Cards': 'Start Rolling Cards',
    'Kartu:': 'Card:',
    'Semua slot sudah equipped! Unequip dulu salah satu.': 'All slots are equipped! Unequip one first.'
  };

  // Masukkan seluruh CARD_DESC_EN ke EXACT_MAP (key = deskripsi asli bahasa Indonesia jika ditemukan)
  try {
    if (typeof STORY_BIBLE !== 'undefined' && STORY_BIBLE && Array.isArray(STORY_BIBLE.units)) {
      STORY_BIBLE.units.forEach(function (u) {
        var orig = u.__origDesc || u.desc;
        if (orig && CARD_DESC_EN[u.id]) {
          EXACT_MAP[orig.trim()] = CARD_DESC_EN[u.id];
        }
      });
    }
  } catch (e) {}

  /* ================== 4. POLA REGEX / SUBSTRING DINAMIS ================== */
  var PATTERN_PAIRS = [
    // Auth & Welcome
    [/Masuk untuk melanjutkan/g, 'Sign in to continue'],
    [/perjalananmu/g, 'your journey'],
    [/menaklukkan arena dan membangun shadow army\./g, 'conquering the arena and building your shadow army.'],
    [/Buat akun baru untuk mulai/g, 'Create a new account to start'],
    [/petualanganmu/g, 'your adventure'],
    [/di arena dan kumpulkan kartu terkuat\./g, 'in the arena and collect the strongest cards.'],
    [/Selamat datang kembali/g, 'Welcome back'],
    [/Selamat datang/g, 'Welcome'],

    // Settings & Audio
    [/SUARA:\s*MATI/g, 'SOUND: OFF'],
    [/SUARA:\s*NYALA/g, 'SOUND: ON'],
    [/SUARA:\s*-/g, 'SOUND: -'],
    [/SFX:\s*MATI/g, 'SFX: OFF'],
    [/SFX:\s*NYALA/g, 'SFX: ON'],
    [/belum dibuat/g, 'not created'],
    [/LEVEL KAMU:/g, 'YOUR LEVEL:'],
    [/SPEED AKTIF:/g, 'ACTIVE SPEED:'],
    [/Berikutnya terbuka di LV/g, 'Next unlocks at LV'],
    [/Terbuka di LV\s+(\d+)/g, 'Unlocks at LV $1'],
    [/Kecepatan Battle\s+(\d+)×/g, 'Battle Speed $1×'],
    [/SUDAH MAX/g, 'MAXED OUT'],
    [/di LV /g, 'at LV '],

    // Global Luck & Weather Broadcasts
    [/AKTIFKAN\s*·/g, 'ACTIVATE ·'],
    [/TUMPUK\s*\+10×\s*·/g, 'STACK +10× ·'],
    [/(\d+)\s*tumpuk/gi, '$1 stacks'],
    [/Tumpukan ke/g, 'Stack to'],
    [/Aktifkan/g, 'Activate'],
    [/untuk semua pemain/g, 'for all players'],
    [/untuk semua server!/g, 'for the entire server!'],
    [/SELURUH SERVER MENDAPATKAN/g, 'THE ENTIRE SERVER RECEIVES'],
    [/UNTUK SEMUA PEMAIN!/g, 'FOR ALL PLAYERS!'],
    [/DIONSOROI OLEH:/g, 'SPONSORED BY:'],
    [/DISPONSORI OLEH:/g, 'SPONSORED BY:'],
    [/DIAKTIFKAN OLEH/gi, 'ACTIVATED BY'],
    [/Diaktifkan oleh/g, 'Activated by'],
    [/Oleh:/g, 'By:'],
    [/Gems langsung dipotong dan/g, 'Gems are deducted immediately and'],
    [/tidak bisa dikembalikan/g, 'are non-refundable'],
    [/Aktivasi berlaku untuk seluruh server\./g, 'Activation applies to the entire server.'],
    [/Butuh\s+([\d.,]+)\s+Gems/g, 'Requires $1 Gems'],

    // Backpack, Items, Artifacts, Pets, Tree
    [/SPECIAL ROLL PACK\s*-\s*Berisi\s+([\d.,]+)\s+tarikan instan!\s*Buka untuk langsung menggacha\s+([\d.,]+)\s+kartu sekaligus dalam 1 detik\./g, 'SPECIAL ROLL PACK - Contains $1 instant pulls! Open to instantly roll $2 cards at once in 1 second.'],
    [/selama 5 menit per pot \(durasi menumpuk\)\.\s*3× L(\d+)\s*bisa digabung jadi 1× L(\d+)\./g, 'for 5 minutes per potion (duration stacks). 3× L$1 can be merged into 1× L$2.'],
    [/selama 5 menit per pot \(durasi menumpuk\)\.\s*Level tertinggi\./g, 'for 5 minutes per potion (duration stacks). Max level.'],
    [/PAKAI\s+(\d+)\s+PAKET\s*·\s*TOTAL\s+([\d.,]+)\s+TARIKAN/g, 'OPEN $1 PACKS · TOTAL $2 PULLS'],
    [/GABUNG SEMUA\s*\((\d+)×\s*→\s*(\d+)\s*L(\d+)\)/g, 'MERGE ALL ($1× → $2 L$3)'],
    [/BELI\s*·/g, 'BUY ·'],
    [/TOKO WORLD BOSS\s*·/g, 'WORLD BOSS SHOP ·'],
    [/TOKO WORLD BOSS/g, 'WORLD BOSS SHOP'],
    [/TOKO PREMIUM\s*·/g, 'PREMIUM SHOP ·'],
    [/TOKO PREMIUM/g, 'PREMIUM SHOP'],
    [/DROP INFINITE TOWER/g, 'INFINITE TOWER DROP'],
    [/DIMILIKI DI BACKPACK:\s*(\d+)x/g, 'OWNED IN BACKPACK: $1x'],
    [/(\d+)\s+kartu dipasang/g, '$1 cards equipped'],
    [/Peluang asli:/g, 'Base odds:'],
    [/varian lagi menuju \+1 Pack 5K/g, 'more variants for +1 5K Pack'],

    // Premium Shop & Weather Machine
    [/(\d+)rb\s+Tarikan Instan\s+—\s+proses dalam 1 detik/g, '$1K Instant Rolls — processed in 1 second'],
    [/100rb\s+Tarikan Instan\s+—\s+tarikan maksimal dalam 1 detik/g, '100K Instant Rolls — maximum pull in 1 second'],
    [/Pet Eksklusif\s+—/g, 'Exclusive Pet —'],
    [/Artefak Eksklusif\s+—/g, 'Exclusive Artifact —'],
    [/Langsung aktifkan cuaca\s+([A-Z0-9 _-]+)\s+selama 30 menit untuk SEMUA PEMAIN!/g, 'Instantly activate $1 weather for 30 minutes for ALL PLAYERS!'],
    [/pasti dapat minimal 1 RARE/g, 'guaranteed at least 1 RARE'],
    [/pasti dapat AWAKENED/g, 'guaranteed AWAKENED'],
    [/MENGACAK CUACA…/g, 'ROLLING WEATHER…'],
    [/MEMBUKA MYTHIC…/g, 'OPENING MYTHIC…'],

    // Trait Synthesis
    [/MENGGACHA TRAIT…/g, 'ROLLING TRAIT…'],
    [/STOP AUTO\s*\((\d+)\)/g, 'STOP AUTO ($1)'],
    [/Pilih minimal 1 trait target untuk Auto Roll/g, 'Select at least 1 target trait for Auto Roll'],
    [/TRAIT DIDAPAT!/g, 'TRAIT ACQUIRED!'],
    [/Auto Roll berhenti setelah\s+(\d+)\s+roll/g, 'Auto Roll stopped after $1 rolls'],
    [/DIAMOND HABIS/g, 'OUT OF DIAMONDS'],

    // Story, Tower, Raid, Daily
    [/KLAIM DAY\s+(\d+)/g, 'CLAIM DAY $1'],
    [/Total 7 hari:/g, '7-Day Total:'],
    [/diklaim siklus ini/g, 'claimed this cycle'],
    [/SELESAIKAN SEMUA LEVEL BAB\s+(\d+)\s+DI MODE\s+([A-Z]+)\s+UNTUK BUKA BAB INI DI MODE\s+([A-Z]+)/g, 'CLEAR ALL CHAPTER $1 STAGES ON $2 TO UNLOCK THIS CHAPTER ON $3'],
    [/SELESAIKAN SEMUA LEVEL BAB 1 DI MODE\s+([A-Z]+)\s+UNTUK BUKA MODE INI/g, 'CLEAR ALL CHAPTER 1 STAGES ON $1 TO UNLOCK THIS MODE'],
    [/SELESAIKAN STAGE\s+0(\d+)/g, 'CLEAR STAGE 0$1'],
    [/Selesaikan Stage\s+0(\d+)\s+terlebih dahulu!/g, 'Clear Stage 0$1 first!'],
    [/TERKUNCI\s*—\s*SELESAIKAN STAGE\s+0(\d+)/g, 'LOCKED — CLEAR STAGE 0$1'],
    [/BAB\s+0(\d+)\s*·\s*BAB\s+(\d+)/g, 'CHAPTER 0$1 · CHAPTER $2'],
    [/BAB\s+(\d+)\s+SELESAI/g, 'CHAPTER $1 CLEARED'],
    [/CERITA\s*·\s*BAB\s+(\d+)/g, 'STORY · CHAPTER $1'],
    [/STORY\s*·\s*BAB\s+(\d+)/g, 'STORY · CHAPTER $1'],
    [/BAB\s+(\d+)/g, 'CHAPTER $1'],
    [/PROGRES\s+(\d+)\/(\d+)/g, 'PROGRESS $1/$2'],
    [/SIAP LAGI/g, 'READY IN'],
    [/POWER KURANG\s*—\s*MASUK/g, 'LOW POWER — ENTER ANYWAY'],
    [/Lantai\s+(\d+)/g, 'Floor $1'],
    [/LANTAI\s+(\d+)/g, 'FLOOR $1'],
    [/Giliran\s+(\d+)/g, 'Turn $1'],
    [/GILIRAN\s+(\d+)/g, 'TURN $1'],

    // Passive & Combat Generic Phrases (fallback for any dynamic battle/card text)
    [/\(Eksklusif cuaca\s+([A-Z0-9 _-]+)\)/g, '($1 Weather Exclusive)'],
    [/peluang membuka serangan dengan dua pukulan beruntun/g, 'chance to open attacks with two consecutive strikes'],
    [/peluang menyerang dua kali beruntun/g, 'chance to strike twice in a row'],
    [/peluang serangan menembus pertahanan musuh/g, 'chance for attacks to pierce enemy defense'],
    [/menyerap\s+(\d+)%\s+damage jadi HP/g, 'absorbs $1% of damage dealt as HP'],
    [/Saat masuk arena/g, 'On entry'],
    [/Saat masuk/g, 'On entry'],
    [/Saat mati/g, 'Upon death'],
    [/Setiap giliran/g, 'Every turn'],
    [/Setiap\s+(\d+)\s+giliran/g, 'Every $1 turns'],
    [/Setiap serangan ke-(\d+)/g, 'Every $1th attack'],
    [/Tiap serangan ke-(\d+)/g, 'Every $1th attack'],
    [/selama\s+(\d+)\s+giliran/g, 'for $1 turns'],
    [/(\d+)\s+giliran/g, '$1 turns'],
    [/pengurangan damage/g, 'damage reduction'],
    [/kartu aktif musuh/g, 'active enemy card'],

    // Watch Ads Dynamic Strings
    [/Tonton iklan singkat untuk mengaktifkan/g, 'Watch a short ad to activate'],
    [/selama 5 menit atau klaim/g, 'for 5 minutes or claim a free'],
    [/gratis!/g, 'for free!'],
    [/Menggandakan \(/g, 'Doubles ('],
    [/\) total keberuntunganmu selama/g, ') your total luck for'],
    [/5 menit/g, '5 minutes'],
    [/penuh\. Bisa ditonton lagi segera setelah durasi buff 5 menit habis!/g, 'straight. Can be watched again right after the 5-minute buff expires!'],
    [/Bisa ditonton lagi segera setelah durasi buff 5 minutes habis!/g, 'Can be watched again right after the 5-minute buff expires!'],
    [/Langsung mendapatkan & membuka/g, 'Instantly receive & open'],
    [/100\.000 tarikan kartu instan/g, '100,000 instant card pulls'],
    [/sekaligus! Bisa ditonton kembali setiap/g, 'at once! Can be watched again every'],
    [/30 menit/g, '30 minutes'],
    [/AKTIF DI MODAL\s*·\s*SISA/g, 'ACTIVE IN MODAL · LEFT'],
    [/COOLDOWN\s*·\s*SIAP DALAM/g, 'COOLDOWN · READY IN'],
    [/REWARD DALAM\s+(\d+)s/g, 'REWARD IN $1s'],
    [/⏳ AKTIF\s*\(/g, '⏳ ACTIVE ('],
    [/⏳ TUNGGU\s+/g, '⏳ WAIT '],
    [/sisa\s+(\d+:\d+)/g, '$1 left'],
    [/SIKLUS LOGIN:/g, 'LOGIN CYCLE:'],
    [/HARI\s+(\d+)\s*\/\s*7/g, 'DAY $1 / 7'],
    [/📦 STOK PACK 100K DI BACKPACK:/g, '📦 100K PACKS IN BACKPACK:'],
    [/⏳ RESET HARIAN:/g, '⏳ DAILY RESET:'],
    [/(\d+(?:\.\d+)?[KM])\s+ROLL\s+INSTAN/g, '$1 INSTANT ROLLS'],
    [/🎁 KLAIM DAY\s+(\d+)\s*·\s*\+(\d+)× INSTAN ROLL PACK 100K \(SIMPAN KE BACKPACK\)/g, '🎁 CLAIM DAY $1 · +$2× 100K INSTANT ROLL PACK (SAVE TO BACKPACK)'],
    [/Total 7 Hari:/g, '7-Day Total:'],
    [/(\d+)× Instan Roll Pack 100K \(([\d.,]+)\s*Roll\)/g, '$1× 100K Instant Roll Packs ($2 Rolls)'],
    [/otomatis masuk ke/g, 'automatically stored in'],
    [/\+(\d+)× INSTAN ROLL PACK 100K disimpan ke Backpack!/g, '+$1× 100K INSTANT ROLL PACK saved to Backpack!'],

    // Additional generic patterns
    [/skill di-refresh/g, 'skill refreshed'],
    [/saat masuk arena/gi, 'on arena entry'],
    [/saat masuk/gi, 'on entry'],
    [/total stat musuh/gi, 'total enemy stats'],
    [/TWILIGHT HABIS \+/g, 'TWILIGHT DEPLETED +'],
    [/TURRET BLOCK! sisa/g, 'TURRET BLOCK! remaining'],
    [/SELESAI \(/g, 'CLEARED ('],
    [/First clear bonus/gi, 'First clear bonus'],
    [/Nada GAGAL:/g, 'Tone FAILED:'],
    [/SFX GAGAL:/g, 'SFX FAILED:'],
    [/Gagal mendaftar ke server:/g, 'Failed to register with server:'],
    [/Pendaftaran cloud gagal:/g, 'Cloud registration failed:'],
    [/tidak bisa di-dodge/gi, 'cannot be dodged'],
    [/mati di akhir giliran/gi, 'dies at the end of turn'],
    [/sebar rata ke semua kartu/gi, 'distributed evenly across all cards'],
    [/cuaca terbaik pernah/gi, 'best weather recorded'],
    [/berhasil diaktifkan pada iterasi #/g, 'successfully activated on iteration #'],
    [/DAMAGE GAGAL DIKIRIM \(/g, 'DAMAGE FAILED TO SEND ('],
    [/TOKEN KURANG — butuh/g, 'INSUFFICIENT TOKENS — need'],
    [/TOKEN KURANG/g, 'INSUFFICIENT TOKENS'],
    [/TUKAR BERHASIL/g, 'EXCHANGE SUCCESSFUL'],
    [/TUKAR GAGAL/g, 'EXCHANGE FAILED'],
    [/BELI GAGAL/g, 'PURCHASE FAILED'],
    [/untuk buka roll/g, 'to unlock roll'],
    [/KLAIM REWARD \(\+/g, 'CLAIM REWARD (+'],
    [/ROLL LAGI · LANJUT AUTO ·/g, 'ROLL AGAIN · CONTINUE AUTO ·'],
    [/ROLL LAGI ·/g, 'ROLL AGAIN ·'],
    [/Belum ada player di peringkat #/g, 'No player yet at rank #'],
    [/balik ke lobby/gi, 'return to lobby'],
    [/GEMS DI CLOUD TIDAK CUKUP \(/g, 'CLOUD GEMS INSUFFICIENT ('],
    [/DROP INSTAN PACK · LANTAI/g, 'INSTANT PACK DROP · FLOOR'],
    [/DROP LANGKAH · LANTAI/g, 'RARE DROP · FLOOR'],
    [/RUN BERAKHIR DI LANTAI/g, 'RUN ENDED AT FLOOR'],
    [/LANTAI DITAKLUKKAN:/g, 'FLOORS CONQUERED:'],
    [/· KARTU \+/g, '· CARD +'],
    [/DI DEK · SLOT/g, 'IN DECK · SLOT'],
    [/PASANG KE DEK/g, 'EQUIP TO DECK'],
    [/BOS LANTAI/g, 'FLOOR BOSS'],
    [/MULAI PENETRASI/g, 'BEGIN PENETRATION'],
    [/LANTAI BELUM TERBUKA/g, 'FLOOR NOT UNLOCKED'],
    [/BATAS COIN HARIAN/g, 'DAILY COIN LIMIT'],
    [/BATAS TOKEN HARIAN/g, 'DAILY TOKEN LIMIT'],
    [/Coin lantai ini tidak dibayar server/g, 'Floor coin not granted by server'],
    [/Token lantai ini tidak dibayar server/g, 'Floor token not granted by server'],
    [/PASTI SETIAP LANTAI/g, 'GUARANTEED EVERY FLOOR'],
    [/TARIKAN KARTU INSTAN/g, 'INSTANT CARD PULLS'],
    [/INSTAN PACK · DROP ACAK PER LANTAI/g, 'INSTANT PACK · RANDOM FLOOR DROP']
  ];

  function translateTextString(str) {
    if (!str || !str.trim()) return str;
    var trimmed = str.trim();
    if (EXACT_MAP[trimmed]) {
      return str.replace(trimmed, EXACT_MAP[trimmed]);
    }
    var out = str;
    for (var i = 0; i < PATTERN_PAIRS.length; i++) {
      out = out.replace(PATTERN_PAIRS[i][0], PATTERN_PAIRS[i][1]);
    }
    return out;
  }

  function translateSubtree(root) {
    if (!root || getLang() !== 'en') return;

    // 1. Translate attributes (placeholder, title, data-t)
    if (root.nodeType === 1) {
      var els = root.querySelectorAll ? [root].concat(Array.prototype.slice.call(root.querySelectorAll('[placeholder],[title],[data-t]'))) : [root];
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.hasAttribute && el.hasAttribute('placeholder')) {
          var ph = el.getAttribute('placeholder');
          if (!el.hasAttribute('data-orig-ph') || (el.getAttribute('data-last-en-ph') && ph !== el.getAttribute('data-last-en-ph'))) {
            el.setAttribute('data-orig-ph', ph);
          }
          var tPh = translateTextString(el.getAttribute('data-orig-ph'));
          el.setAttribute('data-last-en-ph', tPh);
          if (ph !== tPh) el.setAttribute('placeholder', tPh);
        }
        if (el.hasAttribute && el.hasAttribute('title')) {
          var ti = el.getAttribute('title');
          if (!el.hasAttribute('data-orig-title') || (el.getAttribute('data-last-en-title') && ti !== el.getAttribute('data-last-en-title'))) {
            el.setAttribute('data-orig-title', ti);
          }
          var tTi = translateTextString(el.getAttribute('data-orig-title'));
          el.setAttribute('data-last-en-title', tTi);
          if (ti !== tTi) el.setAttribute('title', tTi);
        }
        if (el.hasAttribute && el.hasAttribute('data-t')) {
          var dt = el.getAttribute('data-t');
          if (!el.hasAttribute('data-orig-dt') || (el.getAttribute('data-last-en-dt') && dt !== el.getAttribute('data-last-en-dt'))) {
            el.setAttribute('data-orig-dt', dt);
          }
          var tDt = translateTextString(el.getAttribute('data-orig-dt'));
          el.setAttribute('data-last-en-dt', tDt);
          if (dt !== tDt) el.setAttribute('data-t', tDt);
        }
      }
    }

    // 2. Walk text nodes (supports dynamic .textContent reuse)
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentNode;
      if (!parent) continue;
      var tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') continue;
      var val = node.nodeValue;
      if (!val || !val.trim()) continue;
      // Jika node.nodeValue berubah dari luar (mis. #spDesc.textContent = ...), perbarui __origIdText
      if (node.__origIdText === undefined || (node.__lastEnText !== undefined && val !== node.__lastEnText)) {
        node.__origIdText = val;
      }
      var translated = translateTextString(node.__origIdText);
      node.__lastEnText = translated;
      if (node.nodeValue !== translated) {
        node.nodeValue = translated;
      }
    }
  }

  function restoreOriginalDOM(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.querySelectorAll) {
      var els = [root].concat(Array.prototype.slice.call(root.querySelectorAll('[data-orig-ph],[data-orig-title],[data-orig-dt]')));
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.hasAttribute('data-orig-ph')) el.setAttribute('placeholder', el.getAttribute('data-orig-ph'));
        if (el.hasAttribute('data-orig-title')) el.setAttribute('title', el.getAttribute('data-orig-title'));
        if (el.hasAttribute('data-orig-dt')) el.setAttribute('data-t', el.getAttribute('data-orig-dt'));
      }
    }
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      if (node.__origIdText !== undefined && node.nodeValue !== node.__origIdText) {
        node.nodeValue = node.__origIdText;
      }
      node.__lastEnText = undefined;
    }
  }

  /* MutationObserver supaya setiap panel/modal/toast/hover popup baru otomatis diterjemahkan saat EN aktif */
  var _rafPending = false;
  var _observer = new MutationObserver(function () {
    if (getLang() !== 'en') return;
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(function () {
      if (getLang() !== 'en') { _rafPending = false; return; }
      try {
        _observer.disconnect();
        translateSubtree(document.body);
      } finally {
        _rafPending = false;
        if (document.body && getLang() === 'en') {
          _observer.observe(document.body, { childList: true, subtree: true });
        }
      }
    });
  });

  function initLangObserver() {
    var cur = getLang();
    document.documentElement.setAttribute('lang', cur);
    document.documentElement.setAttribute('data-lang', cur);
    syncDataObjectsLang(cur);
    if (document.body) {
      if (cur === 'en') translateSubtree(document.body);
      _observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangObserver);
  } else {
    initLangObserver();
  }

  window.GameLang = {
    get: getLang,
    set: setLang,
    syncData: syncDataObjectsLang,
    t: function (idText, enText) {
      return getLang() === 'en' ? (enText !== undefined ? enText : translateTextString(idText)) : idText;
    },
    refresh: function () {
      var cur = getLang();
      syncDataObjectsLang(cur);
      if (cur === 'en' && document.body) translateSubtree(document.body);
    }
  };
  window.tLang = window.GameLang.t;
})();
