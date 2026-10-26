'use strict';
// tuning.js: the single tuning file. Every Slayer-spec number (HP, speeds, damage tiers, cooldowns, i-frames,
// endless scaling, relic ranks/costs/shards, elites, traps, gold, crown, potions, caps) lives here and is read by all systems.
// =====================================================================
// Slayer-faithful numbers, transcribed from docs/slayer_ability_spec.md (David's authoritative spec).
// Every kit, relic and the Endless scaler reads its numbers from here so the tests can check them.
// Distance: 1 m = 32 px = one tile (T).
// =====================================================================
const MTR = 32;
// Internal HP is 2x the spec's 100/75/50 (David's latest), so every enemy and hazard hit on a hero is scaled by the same 2x to keep the balance.
const HP_SCALE = 2;
const LOW_HP = { below: 0.25, speed: 0.15, time: 0.5 };
const TRAP_DMG = n => n >= 37 ? 80 : n >= 20 ? 40 : 20;   // per tick, by floor band (already in internal HP units)
const RELIC_COST = [4000, 12000, 32000];
const ENDLESS_MAX_ROOMS = 12;
const POTION_CAP = 5;
const WEAPON_PRICE = 15000;   // David: every alternate weapon, every hero, flat, no ranks. Default weapon is free.            // per hero; extra potions stay on the floor
const DEATH_CONTACT_TIME = 0.9;  // seconds of contact with Death to drain a full bar
const MASTERY_CAP = 0.25;
const GOLD_MAGNET = 1.2 * MTR;
const SHATTER = { mul: 2, r: MTR, stagger: 0.4 };
const UNDERDOG = { enter: 0.4, exit: 0.2, bonus: 0.15 };
const SPAWNER_HITS = [3, 6, 12];                  // standard hits per spawner tier; T3/T4 count as 3
const ELF_LIGHT_ARROWS_HIT_SPAWNERS = true;       // CONFLICT flag: older guide said they don't; latest source says they do
const STUN_BREAK = { hits: 3, window: 1.5, immune: 0.5, pulseR: MTR };
const RELIC_CD_MUL = [1, 0.82, 0.65];   // generic relics: Rank II ~18% less cooldown, Rank III ~35% less
// damage tiers (base damage before mastery/buff multipliers)
const DMG = { light: 10, medium: 18, heavy: 32, massive: 60 };
// T1-T4 damage tiers (frame-data section): every attack is tagged or inferred from its base damage.
// T1 Light: minimal stagger. T2 Disrupt: hard recovery on medium foes. T3 Heavy/Stun: cancels elite casts, resets aggro to the hitter. T4 Execute: kills non-elites or launches.
const TIER_OF = { light: 1, medium: 2, heavy: 3, massive: 4 };
const TIER_STAGGER = [0, 0.08, 0.5, 0.9, 1.2];
function dmgTier(dmg, src) { const base = dmg / ((src && src.mods && src.mods.dmg) || 1); return base >= 100 ? 4 : base >= 28 ? 3 : base >= 15 ? 2 : 1; }   // reference scale: only 100+ hits are T4 by size; executes need an explicit tier 4 or 'lethal'
// speed ratings (frame-data section, overrides the earlier tiers): multiplier on a 140 px/s base
const SPEED_BASE = 140;
const SPEC = {
  hero: {
    brannoc: { hp: 200, uiHp: 100, speed: 1.0, iframes: 3.5, iframeNote: 'during Whirlwind spin' },
    sela: { hp: 150, uiHp: 75, speed: 1.25, iframes: Infinity, iframeNote: 'front shield, continuous while held' },
    mirelle: { hp: 100, uiHp: 50, speed: 0.95, iframes: 0.8, iframeNote: 'teleport dash' },
    kestrel: { hp: 100, uiHp: 50, speed: 1.5, iframes: 0.4, iframeNote: 'combat roll' },
    vesper: { hp: 100, uiHp: 50, speed: 1.35, iframes: 2.0, iframeNote: 'ghostwalk' },
    // Highlord David (paladin, our own design): HP 200, speed 0.95, Valkyrie shield rules, armored Righteous Advance
    paladin: { hp: 200, uiHp: 100, speed: 0.95, iframes: 0.15, iframeNote: 'Righteous Advance start-up (armored for the whole dash)' },
  },
  // Warrior -> Sir Theo
  theo: { combo: 7, strongHits: [4, 7], comboArc: 1.6, comboR: 58, finisherR: 1.5 * MTR, finisherFrames: 24,
    chargeCd: 0.6, chargeDmg: 'medium', chargeDist: 230, chargeWidth: 6,   // Rush: Slayer dashes have no real cooldown (0.6s is our spam guard)
    rushStartup: 0.1, rushSpeedMul: 1.5, rushBump: 0.4, rushWin: 0.15, superRoot: 0.15, heavyStun: 1.0,   // short start-up, faster than running, heavy bump recovery
    smashCd: 0, smashWindup: 0.2, smashTime: 0.83, smashFwd: 34, smashR: 64, smashStunR: 110,   // Smash: 50 per 0.83s = ~60 DPS (reference ~60)
    leapDist: 120, leapTime: 0.36, leapCd: 0, leapDmg: 'heavy', leapR: 90, leapStun: 1.2,
    titanRoot: 0.8, spinSlideSpeed: 0.9, spinSlideGrip: 2.5,
    spinCd: 10, spinDmg: 'heavy', spinTicksPerSec: 8 / 2.5, spinR: 2.0 * MTR, spinTime: 2.5 },
  // Valkyrie -> Dawnbringer Gela
  gela: { combo: 7, comboDmg: 'light', stunHits: [4, 7], stun: 1.0, comboArc: 1.4, comboR: 56,
    thrustDmg: 'heavy', thrustCd: 0, thrustWindupFrames: 12, thrustLungeFrames: 8, thrustRecovery: 0.45, perfectWindow: 0.2, chargeCd: 2,
    thrustHeavyStun: 1.2, wallStun: 0.6, javelinWindup: 0.1, slashStep: 6, stunLockPad: 0.3,
    shieldReach: 10, reflectMul: 3.5, bashEvery: 0.2, bashWindow: 0.5, bashR: 110, bashKnock: 320, bashInterruptR: 340,
    blockArc: Math.PI / 2, reflectAfter: 10,
    throwDmg: 'medium', throwChains: 4, execCd: 9, execDmg: 'massive', execR: 90 },
  // Wizard -> Sorceress Zoey. key = first element + second element
  zoey: { pulseDmg: 'light', spells: {
    // cooldowns from the Neoseeker FAQ (Oct 2026): Serpents 6, Fireball 2, Freezing Wave 3, Cold Sphere 20, Shock Blast 1/s, Chain Lightning 1/s, Storm Barrier 20
    'ember+ember': { cd: 0, dmg: 'medium' }, 'ember+rime': { cd: 6, dmg: 'medium' }, 'ember+storm': { cd: 2, dmg: 'heavy' },
    'rime+rime': { cd: 0, dmg: 'light' }, 'rime+ember': { cd: 3, dmg: null }, 'rime+storm': { cd: 20, dmg: null },
    'storm+storm': { cd: 20, dmg: 'medium' }, 'storm+rime': { cd: 1, dmg: 'medium' }, 'storm+ember': { cd: 1, dmg: 'medium' } } },
  // Elf -> Ranger Isaac
  isaac: { rapidDmg: 14, rapidRate: 0.25, sniperDmg: 'heavy', sniperDraw: 0.75,   /* Neoseeker FAQ: aimed shots ~1.3/s */ bombR: 95 * 1.4, bombShotR: 95, rollCd: 1.5, rollIframes: 0.4, mortarCd: 6, mortarDmg: 'heavy', mortarR: 3.0 * MTR, rootTime: 2.5 },
  // Necromancer -> Vesper Linda
  vesper: { reapDmg: 'medium', reapArc: 140 * Math.PI / 180, reapR: 64, ghostCd: 0, ghostIframes: 0.3, shadesDmg: 'heavy', essenceMax: 100, essenceGrunt: 3, essenceElite: 10, raiseCost: 10, essencePerHit: 0,
    // Soul Power (Slayer Necromancer): 0-100. Bars 1-5 = souls 10-50 (strength), 50-100 = tier 2, 100 = FULL (bonus). The ability empties it.
    soulBar: 10, soulHeavy: 6, soulBoss: 20, soulSpawner: 15, soulGhost: 3, soulGhostCap: 5,
    ghostDist: 150, ghostTime: 0.22, ghostEnd: 0.2,                          // short teleport-dash, no start delay, a landing delay
    slashMax: 120, slashR: 46, slashRoot: 0.25,                              // Skeleton Slash: auto-ranges to the nearest foe, no minimum range; rooted while swinging
    smashMin: 70, smashMax: 210, smashDef: 140, smashWindup: 0.3, smashRoot: 0.3, smashCd: 1.0, smashFrontR: 36, smashLife: 0.7,   // Skeleton Smash: ~1/s
    soldierLife: 15, archerLife: 20, archerHp: 16, archerRate: 1.5, archerFire: 22, minionCap: 25,
    dominateR: 90, dominateT: [3, 5, 7, 10, 15], dominateHaste: 1.5, dominateHeal: 2,
    hungerCast: 0.8, hungerR: 80, hungerTime: 6, hungerDps: 8, hungerHeal: 4 },
  zoeyTeleport: { iframes: 48 / 60, vulnerable: 6 / 60 },
  // Paladin -> Highlord David (light element). Radii in px (1m = 32px).
  paladin: { combo: 3, comboArc: 2.4, comboR: 68, finisherArc: 3.1, finisherR: 82,
    judgmentCd: 1.6, judgmentMaxCharge: 0.8, judgmentMinCharge: 0.25, judgmentR: 78, judgmentStun: 1.2,
    blockArc: 2.9, perfectWindow: 0.2,
    advanceCd: 5, advanceDist: 170, advanceWidth: 14,
    consCd: 12, consR: 3 * MTR, consTime: 5, consTick: 0.5, consHeal: 2 * 2,   // 2 bar HP per tick = 4 internal HP
    auraR: 4 * MTR, auraMit: 0.10,
    slamCd: 9, slamR: 4 * MTR,
    hammerCd: 6, hammerRange: 320, hammerSpeed: 640,
    lanceCd: 7, lanceLen: 12 * MTR, lanceWidth: 18, lanceUndeadMul: 2,
    pulseCd: 10, pulseR: 4 * MTR, pulseShield: 30, pulseShieldTime: 3,
    wingsTime: 4, wingsBurstR: 7 * MTR, layR: 6 * MTR },
  // Weapon signature cooldowns for the shop lineup (seconds)
  weapons: {
    brannoc: { base: 10, axe: 5, turbo: 7, demonic: 6 },
    sela: { base: 9, splitter: 6, vanguard: 0, ricochet: 8 },
    kestrel: { base: 6, thorn: 5, sparks: 8, dusk: 7 },
    vesper: { base: 0, lantern: 0, marrow: 0, scepter: 0 },
    paladin: { base: 9, hammer: 6, lance: 7, sanctuary: 10 },
  },
  // 'Weapon precise numbers' (authoritative)
  wpn: {
    spinR: 2.0 * MTR, spinFrames: 210,
    axeSpeed: 640, axeLife: 0.8,
    turboR: 3.0 * MTR, turboArc: Math.PI / 2, turboStun: 1.6,
    cleaveR: 2.6 * MTR, cleaveArc: 5.0, cleaveStunR: 1.2 * MTR, cleaveRoot: 0.5, demonicBurn: 4,
    execR: 2.5 * MTR, execArc: 2 * Math.PI, execKnock: 900, crushStun: 2.0, crushWindow: 0.7,
    splitterFan: Math.PI / 4, splitterSpeed: 760,
    deflectR: 70, deflectWidth: 22, deflectMax: 6, deflectWindow: 0.5,
    ricochetTargets: 4, ricochetHop: 4.0 * MTR, ricochetInterrupt: 0.4,
    mortarR: 3.0 * MTR, mortarSpawnerHits: 3,
    rootLen: 14 * MTR, rootWidth: 10, rootTime: 5,
    sparksTrigger: 1.0 * MTR, sparksSnare: 3, sparksR: 2.5 * MTR,
    smokeR: 2.0 * MTR, smokeInvis: 4.0, smokeLife: 4,
    raiseCost: 20, shadesCost: 100, detonateCost: 10, detonateR: 3.0 * MTR,
  },
  voidCd: 5, pyroCdMul: 1.2, pyroR: 1.8 * MTR, pyroSpawnerHits: 2, voidR: 2.2 * MTR, voidTime: 4, spellQueue: 0.35,
  // utility talismans
  talisman: { feastFood: 2, feastFeast: 1, aegisR: 3 * MTR, aegisTime: 6, aegisHeal: 4, dreadR: 3.5 * MTR, dreadTime: 6, dreadFear: 1.0, dreadDps: 6, valkCount: 3, valkTime: 10 },
  potion: { shockR: 12 * MTR, shockStagger: 0.6, foodInv: 0.5, aiFreeze: 1.5, exitGold: 500, spawnerStop: 4 },
  gateBank: { min: 1, flash: 1.6 },
  stuck: { overlap: 0.1, frozen: 0.5 },   // anti-stuck safety net: seconds overlapping geometry / frozen while steering before a nudge
  // Slayer camera: zooms out to frame a big battle room plus every player, back to 1x in corridors and small rooms
  cam: { battleKinds: ['L', 'A'], margin: 1.5 * 32, hud: 96, min: 0.58, coopPad: 120, rate: 2.2, follow: 0.14, maxDpr: 2.5 },
  splash: { fadeIn: 0.6, hold: 2.0, fadeOut: 0.6, maxWait: 1.5, logo: 400 },   // Tezois Studio splash on page load (seconds, logo px)   // gate crossings bank carried gold (min amount to trigger, HUD flash seconds)
  crown: { goldMul: 2, floatTime: 5, endBonus: 500, slow: 0.1, aggroR: 10 * MTR },
  coins: { capPerPlayer: 5 },
  bubble: { after: 20 },
  elites: { lichShieldEvery: 12, lichShieldTime: 3, totemHaste: 0.4, totemHp: 1, meteorWindup: 1.6, meteorCdOnCancel: 6 },
};
const heroSpeed = id => SPEED_BASE * SPEC.hero[id].speed;
const dmgOf = tier => DMG[tier] || 0;

// ================================================================ David's deliberate deviations (Oct 2026 batch)
// Every number for the six changes below lives here; docs/slayer_ability_spec.md "David's deliberate deviations" explains them.
const SLOWEST_HERO_SPEED = () => Math.min(...Object.keys(SPEC.hero).map(heroSpeed));   // 133 px/s (Zoey and Highlord David, 0.95)
const DEV = {
  // 1. DASH: one dedicated button for every hero (KB1 F / middle mouse, KB2 Numpad6 / Comma, gamepad LT or L3).
  //    cdKey = the cooldown it shares with the hero's existing mobility move, so both inputs stay in sync.
  dash: {
    brannoc: { move: 'Rush', cdKey: 'defend', cd: 0.6 },        // SPEC.theo.chargeCd
    sela: { move: 'Shield Charge', cdKey: 'scharge', cd: 2 },            // SPEC.gela.chargeCd (no longer needs the shield raised)
    kestrel: { move: 'Combat Roll', cdKey: 'defend', cd: 1.5 },          // SPEC.isaac.rollCd
    mirelle: { move: 'Blink', cdKey: 'dash', cd: 3, dist: 150, dur: 0.16, iframes: 0.22 },   // new short blink for Zoey
    vesper: { move: 'Ghostwalk', cdKey: 'defend', cd: 0 },               // SPEC.vesper.ghostCd 
    paladin: { move: 'Righteous Advance', cdKey: 'advance', cd: 5 },     // SPEC.paladin.advanceCd (no longer needs the shield raised)
  },
  // 2. COOLDOWN HUD: ready flash length (s) and pip size (px)
  hud: { readyFlash: 0.45, pipR: 12, pipGap: 29 },
  // 4. ENEMY PROJECTILES: every foe missile (bosses too) is slowed, then capped. Range is kept (life is stretched to match).
  //    Dodge budget at the cap: reaction 0.35s + sidestep (hero r 13 + missile r 7 + 4 px margin) / 133 px/s = 0.53s,
  //    and a missile at the cap needs 0.80s to cross even the closest firing distance (160 px). Shockwave rings use the same cap.
  proj: { mul: 0.65, capMul: 1.5, react: 0.35, sidestepPx: 24, minRange: 160 },   // cap = 1.5 x slowest hero = 200 px/s
  // 5. ENEMY WALK SPEED: ground foes never move faster than 90% of the slowest hero (= 120 px/s), after every multiplier
  //    (Endless x1.15, totem haste, frenzy, lurker dive, boss rage) and for charges/dashes too.
  //    Exempt: grave wisps and wraith-type phantoms (beh 'wraith': wraith, shiver sprite) keep their speed.
  ground: { capMul: 0.9, exemptTypes: ['wisp'], exemptBeh: ['wraith'], chargeTime: 1.1, bossChargeTime: 1.2 },
  // 6. DAMAGE ORDER (main < secondary < special, per hit and per use). Main attacks are unchanged; only these changed.
  // 7. ROOMS (Slayer-style stages): room sizes in tiles [wMin, wMax, hMin, hMax]; old generator rooms were 6-12 x 5-9 (large = 108 tiles)
  //    large battle rooms are ~2.7x that (19-24 x 12-15, avg ~290 tiles); medium ~145, small ~63, treasure ~45.
  rooms: { sizes: { L: [19, 24, 12, 15], M: [13, 16, 9, 11], S: [8, 10, 6, 8], T: [6, 8, 5, 7] }, corridorW: 2, maxW: 120, maxH: 84,
    // room activation: a room's foes and spawners stay dormant until a hero steps inside, or one of its foes sees a hero
    // (walls and pillars block sight; sight range in px), or something in it is hit. Then the whole room wakes.
    sightR: 330, sightEvery: 0.2, wakeDelay: [0.25, 0.7] },
  // 8. DAMAGE (David's Slayer reference, Oct 25 2026: docs/slayer_damage_reference_from_david.md). Hero damage uses the reference
  //    numbers 1:1 because our enemy HP already sits on the reference scale (small ~30, strong ~48, casters 60-96).
  //    Rates are tuned so every melee hero out-damages Isaac's Quick Shot (David's rule) while swinging slower than he shoots.
  dmg: {
    theo: { combo: [14, 14, 14, 42, 14, 14, 42], weakT: 0.28, strongT: 0.45, finRec: 0.6,   // hit 7 has a long recovery; 154 per 2.45s nominal (~2.8s with hitstop) = ~54 DPS (reference ~46)
      rush: 8, superSlash: [42, 14, 14, 42], leap: 50,   // Rush; Super Slash = hit 4 during Rush, chain continues 5-7; Smash and Leap 50 Lethal
      spinTick: 20, spinTicks: 8, spinTime: 2.5,                                 // Destructo Spin 8 x 20 = 160, 2.5s invulnerable
      axe: 28, turbo: 140, turboAoe: 14, demonic: 140, titanMul: 1.65 },
    gela: { combo: [8, 8, 8, 42, 8, 8, 42], weakT: 0.22, strongT: 0.32,      // 124 per 1.74s nominal (~2.2s with hitstop) = ~56 DPS (reference ~47)
      thrust: 42, charge: 8, bash: 8, javelin: 28, execHit: 70, ricochet: 56, ricochetSpawnerMul: 2, splitter: 28, intercept: 14 },
    paladin: { combo: [18, 18, 48], weakT: 0.38, finT: 0.55,                  // our own: 84 per 1.31s nominal (~1.5s with hitstop) = ~56 DPS, slowest swings
      judgmentMin: 25, judgmentMax: 50, advance: 8, slam: 70, hammer: 28, lance: 56, pulse: 8, wingsBurst: 106 },
    isaac: { quick: 14, quickRate: 0.25, quickSpawnerHits: 0.5,              // 4/s x 14 = 56 DPS; 8 vs spawners -> half a hit
      powerMin: 14, powerMax: 36, sniperSpawnerHits: 1.5, sniperLife: 6,     // Sniper Shot 36 Lethal, unlimited range, half vs spawners
      bomb: 56, explosiveDirect: 2, mortar: 56, root: 22, rootAfter: 14, smoke: 14, heart: 438, sprite: 14 },
    zoey: { bolt: 22, boltRate: 0.55,                                         // Firebolts 1.8/s x 22 = 40 DPS
      mortar: 56, serpentPass: 16, serpentBurn: 8, serpentBurnT: 12,         // Fireball 56; Flaming Serpents 16 + 96 burn over 12s
      rayDps: 56, freeze: 3, orbLife: 9, thunderclap: 14, arcChain: 22, ward: 6,
      hellDps: 40, scorch: 70, scorchBurn: 44 / 8, pyreLife: 9, pyreDps: 72 / 9, gloomMin: 4, undertowSlow: 5, veil: 6, nova: 106 },
    vesper: { reap: 8, reapT: 0.4, spikes: 46, spikesSplash: 2, ghost: 4, ghostSlow: 5,   // Slash 2.5/s x 8 = 20 DPS; Smash 46; Ghostwalk 4 + slow
      raiseBurst: 48, raiseBurstR: 64, drain: 5,
      minion: { warrior: 8, spear: 8, archer: 14, wraith: 28 } },
  },
};
const PROJ_CAP = () => DEV.proj.capMul * SLOWEST_HERO_SPEED();
const GROUND_CAP = () => DEV.ground.capMul * SLOWEST_HERO_SPEED();
const foeSpeedExempt = f => !!(f && f.d && (DEV.ground.exemptBeh.includes(f.d.beh) || DEV.ground.exemptTypes.includes(f.type)));
// scale a foe step (px this tick) down to the ground cap; exempt foes pass through unchanged
const capFoeStep = (f, step, dt) => foeSpeedExempt(f) ? step : Math.min(step, GROUND_CAP() * dt);

// ---- Endless Mode scaling. David's FINAL ruling: 'formula'. The table is kept behind the switch.
const ENDLESS_SCALING = 'formula';   // 'formula' | 'table'
const ENDLESS_TABLE = [   // floors from, hp, dmg, elite rate, modifier
  { from: 1, hp: 1.0, dmg: 1.0, elite: 0.05, mod: 'traps' }, { from: 11, hp: 1.5, dmg: 1.3, elite: 0.2, mod: 'fast' },
  { from: 26, hp: 2.2, dmg: 1.7, elite: 0.45, mod: 'traps2' }, { from: 37, hp: 3.0, dmg: 2.0, elite: 0.75, mod: 'nofood' }, { from: 50, hp: 3.0, dmg: 2.5, elite: 1, mod: 'elitespawn' }];
const ENDLESS = {
  mode: ENDLESS_SCALING,
  row: n => ENDLESS_TABLE.filter(r => n >= r.from).pop(),
  formulaHp: n => Math.min(3.5, Math.pow(1.05, n - 1)),   // x1.05 compounding, capped at 3.5x (reached at floor 27)
  formulaDmg: n => Math.min(2, 1 + 0.02 * (n - 1)),      // +2% linear, capped at 2.0x (floor 51)
  hpMul: n => ENDLESS.mode === 'table' ? ENDLESS.row(n).hp : ENDLESS.formulaHp(n),
  dmgMul: n => ENDLESS.mode === 'table' ? ENDLESS.row(n).dmg : ENDLESS.formulaDmg(n),
  // floor bands: wave composition and traps only
  tier: n => n >= 40 ? 3 : n >= 20 ? 2 : 1,             // 1-19 grunts, 20+ elites join, 40+ minibosses in waves
  eliteRate: n => ENDLESS.row(n).elite,
  speedMul: n => n >= 11 && n < 26 ? 1.15 : 1,
  goldMul: n => n >= 37 ? 0.75 : 1,
  allEliteSpawners: n => n >= 50,
  spawnerHpMul: n => n >= 40 ? 2 : n >= 20 ? 1.5 : 1,
  foodCutoff: 37,
  loop: () => (typeof RULE === 'function' && RULE('extendedRealms') ? 48 : 18),   // faithful: 18 floors (crypt, cave, lava). Extended Realms: 8 areas x 6 = 48
  area: n => Math.floor(((n - 1) % ENDLESS.loop()) / 6),
  biome: n => ['crypt', 'cave', 'lava', 'forest', 'swamp', 'desert', 'frozen', 'fortress'][ENDLESS.area(n)],
  checkpoint: n => n % ENDLESS.loop() === 1,          // saves at 1, 19, 37, 55 ... (Extended Realms: 1, 49, 97 ...) through hub portals
  hunter: n => n % 6 === 0,                           // the unkillable hunter on 6, 12, 18, 24 ...
  coinFloor: n => n % 3 === 0,                        // a skull-coin podium every 3rd floor
  coopCount: players => [1, 1.6, 2.2, 2.8][players - 1] || 1,
  soloEliteHp: 0.75,
};
function addEssence(h, v, kill) {   // Soul Power; Dominate (scepter) heals per bar filled from KILLS while the meter isn't full
  const S = SPEC.vesper, before = h.souls || 0; if (before >= S.essenceMax) return;
  h.souls = Math.min(S.essenceMax, before + v);
  if (kill && h.weapon === 'scepter') { const n = Math.floor(h.souls / S.soulBar) - Math.floor(before / S.soulBar); if (n > 0 && typeof healHero === 'function') healHero(h, n * S.dominateHeal); }
}
const soulBars = h => Math.min(5, Math.floor((h.souls || 0) / SPEC.vesper.soulBar));
const soulFull = h => (h.souls || 0) >= SPEC.vesper.essenceMax;

// ---- Relics (Rank II = halfway between I and III). Shards recharge Rank III relics instead of a potion.
const lerpRank = (a, c) => [a, (a + c) / 2, c];
const RELIC_SPEC = {
  mirror: { clones: lerpRank(2, 4), time: lerpRank(6, 10), cd: lerpRank(60, 45), spread: lerpRank(2 * MTR, 5 * MTR), taunt: [false, false, true] },
  haste: { speed: lerpRank(0.3, 0.5), time: lerpRank(4, 7), cd: lerpRank(40, 25), burstR: [0, 0, 3 * MTR] },
  feather: { slow: lerpRank(3, 6), cd: lerpRank(50, 35), range: [6 * MTR, 6 * MTR, Infinity], cone: [true, true, false], stun: [0, 0, 1.2] },
  hoar: { freeze: lerpRank(4, 8), cd: lerpRank(45, 30), range: lerpRank(3 * MTR, 8 * MTR), shape: ['line', 'line', 'circle'] },
};
RELIC_SPEC.feather.stun[1] = 0.6;

// ---------------------------------------------------------------- gameplay rule toggles (Options > Gameplay rules)
// Rules sourced from unverified summaries default ON so they can be switched off if they don't match Slayer.
const RULE_DEFAULTS = { spawnerCleanup: true, tileCap: true, spearCap: true, orbCap: true, potionFoodInv: true, underdogGold: true, crownLinger: true, reviveShock: true, bombSiege: false, goldMul: 1, extendedRealms: false };
const RULE_INFO = [
  ['spawnerCleanup', 'Spawner cleanup', 'Endless floor 70+: blocked off-screen spawners lose 25% health every 60s.'],
  ['tileCap', '12-tile floor cap', 'Endless floors use at most 12 rooms; past floor 50 they pack tighter.'],
  ['spearCap', 'Intercept spear cap', 'The intercept spear deflects at most 6 projectiles per 30 frames.'],
  ['orbCap', 'Slow orb cap', 'The Ice + Lightning slow orb slows at most 30 enemies.'],
  ['potionFoodInv', 'Potion protects food', 'Potion use makes floor food invulnerable for 0.5s.'],
  ['underdogGold', 'Underdog gold', 'Co-op: a player far behind the gold leader gets bonus gold from enemy drops.'],
  ['crownLinger', 'Crown slowdown lingers', 'The crown\'s -10% speed lasts 45 frames after it drops.'],
  ['reviveShock', 'Solo revive shockwave', 'Reviving solo with a skull coin sends out a map-wide shockwave.'],
  ['bombSiege', 'Bomb Siege', 'Spawners ignore light projectiles and only take explosives and heavy hits.'],
  ['extendedRealms', 'Extended Realms', "David's twist: 5 extra areas (Forest, Swamp, Desert, Frozen Wastes, Dark Fortress) join the Endless loop, making it 48 floors. Checkpoints at 1, 49, 97..."]];
const GOLD_MULS = [1, 1.5, 2, 3];
function RULE(k) { const s = typeof SAVE !== 'undefined' && SAVE && SAVE.settings; return s && s[k] !== undefined ? s[k] : RULE_DEFAULTS[k]; }

// alternate weapons: flat price, every hero (data.js lists them without prices)
for (const id in WEAPONS) for (const w of WEAPONS[id]) w.cost = w.id === 'base' ? 0 : WEAPON_PRICE;

// ---------------------------------------------------------------- crypt roster (floors 1-6). Roles from the Slayer roster, original names.
const FOE_STATS = {
  barrow: { name: 'Barrow Brute', role: 'Monstrous Mummy (tank)', hp: 110, spd: 46, r: 17, dmg: 18, beh: 'melee', reach: 32, windup: 0.75, cleave: true, gold: 14, style: 'hulk', col: '#8a7a5a', heavy: true },
  blight: { name: 'Blightwrapped', role: 'Corrupted Mummy (poison)', hp: 40, spd: 58, r: 13, dmg: 10, beh: 'melee', reach: 24, windup: 0.5, deathPool: { r: 54, time: 4, dps: 10 }, gold: 8, style: 'shambler', col: '#6a7a4a' },
  warden: { name: 'Crypt Warden', role: 'Skeleton Defender (sword and shield)', hp: 36, spd: 80, r: 12, dmg: 9, beh: 'shield', reach: 22, windup: 0.45, gold: 7, style: 'skeleton', col: '#d8ccb0' },
  marshal: { name: 'Bone Marshal', role: 'Skeleton Commander (buffs and rallies skeletons)', hp: 150, spd: 74, r: 15, dmg: 16, beh: 'melee', reach: 30, windup: 0.55, cleave: true, rally: { every: 9, count: 2, aura: 170 }, gold: 30, style: 'skeleton', col: '#5a4a4a', elite: true, heavy: true },
  lich: { name: 'Vharos, the Frost-Crowned', role: 'Lich (mini-boss)', hp: 700, spd: 60, r: 18, dmg: 14, beh: 'caster', range: 360, keep: 240, rate: 1.6, pspd: 240, summon: 'warden', freezeShot: 1.4, barrier: true, nova: { every: 7, r: 110, freeze: 1.4, windup: 0.9 }, gold: 300, style: 'robed', col: '#3a5a9a', elite: true, heavy: true, miniboss: true },
};
// existing crypt types get role-correct behaviour flags
// cave floors (7-12 in each endless cycle; world II)
Object.assign(FOE_STATS, {
  savage: { name: 'Gloomtusk Raider', role: 'Savage Orc', hp: 30, spd: 92, r: 13, dmg: 11, beh: 'melee', reach: 24, windup: 0.4, gold: 6, style: 'goblin', col: '#5a8a3a' },
  spiderwar: { name: 'Fangback Stalker', role: 'Spider Warrior (pounces)', hp: 34, spd: 112, r: 13, dmg: 12, beh: 'charger', reach: 22, windup: 0.45, gold: 7, style: 'spider', col: '#3a2a3a' },
  dweller: { name: 'Mire Lurker', role: 'Lake Dweller (submerges, surfaces to spit)', hp: 40, spd: 90, r: 13, dmg: 9, beh: 'lurker', pspd: 280, lurk: { under: [2, 3.2], up: 2.6, rise: 260, keep: 150, spread: 0.22, rate: 1.1 }, gold: 8, style: 'goblin', col: '#3a8a8a' },
  // lava floors (13-18; world III)
  novice: { name: 'Ashbound Initiate', role: 'Cultist Novice', hp: 14, spd: 104, r: 11, dmg: 6, beh: 'melee', reach: 20, windup: 0.32, gold: 3, style: 'cultist', col: '#7a2a2a' },
  horror: { name: 'The Maw Below', role: 'Demon Horror (mini-boss)', hp: 900, spd: 58, r: 22, dmg: 22, beh: 'melee', reach: 42, windup: 0.7, cleave: true, nova: { every: 8, r: 130, burn: 3, windup: 1.0, col: '#ff7a3a' }, rally: { every: 10, count: 3, aura: 0, type: 'imp' }, gold: 400, style: 'demon', col: '#7a1a2a', elite: true, heavy: true, miniboss: true },
});
const FOE_PATCH = { hexcaller: { freezeShot: 0, barrier: false, shotCol: '#9aff7a' }, wraith: { phase: true },
  broodmother: { hp: 800, r: 22, miniboss: true, gold: 350, nova: { every: 9, r: 120, slow: 2.5, windup: 0.9, col: '#e8e8f0' } } };
const CRYPT = { lichCampaignWave: 3, lichEndlessFloor: 5, ghostAlpha: 0.78 };
// enemy type -> sprite in assets/heroes/foes (hero pixel style)
const FOE_SPRITE = { shambler: 'husk', barrow: 'barrow', blight: 'blight', bloater: 'swollen', wraith: 'ghost', hexcaller: 'hexer', bonesoldier: 'sentry', warden: 'warden', marshal: 'marshal', lich: 'lich', ossuary: 'king',
  savage: 'savage', shieldbrute: 'shieldwall', hulk: 'juggernaut', goblin: 'scavenger', totemist: 'shaman', spiderling: 'spawn', spiderwar: 'spiderwar', dweller: 'dweller', broodmother: 'queen', rootmaw: 'behemoth',
  novice: 'novice', zealot: 'zealot', pyromancer: 'acolyte', conjurer: 'sorcerer', imp: 'imp', ravager: 'fiend', horror: 'horror', forgemaster: 'demonlord', sovereign: 'sword' };
Object.assign(FOES, FOE_STATS); for (const k in FOE_PATCH) Object.assign(FOES[k], FOE_PATCH[k]);

// ---------------------------------------------------------------- Extended Realms (David's twist; Options > Gameplay rules, default OFF)
// Each area: grunt, fast swarmer, tank, ranged/caster elite, special + a mini-boss (floor 5 of the area) and a boss (floor 3).
const XAREA_RULES = { bossFloor: 3, minibossFloor: 5 };
const XFOE_STATS = {
  // Forest
  fscout: { name: 'Thornwood Skulker', role: 'Goblin scout (grunt)', hp: 24, spd: 112, r: 11, dmg: 9, beh: 'melee', reach: 20, windup: 0.3, gold: 5, style: 'goblin', col: '#4a7a2a' },
  wolf: { name: 'Ashpelt Wolf', role: 'Wolf (fast swarmer)', hp: 16, spd: 168, r: 11, dmg: 7, beh: 'swarm', reach: 16, windup: 0.22, gold: 3, style: 'spider', col: '#7a7a80' },
  ftroll: { name: 'Mossback Troll', role: 'Forest troll (tank, regenerates)', hp: 140, spd: 52, r: 17, dmg: 20, beh: 'melee', reach: 32, windup: 0.75, cleave: true, regen: 4, gold: 16, style: 'hulk', col: '#5a6a3a', heavy: true },
  wisp: { name: 'Glimmerwisp', role: 'Wisp (caster elite)', hp: 70, spd: 90, r: 11, dmg: 11, beh: 'caster', range: 340, keep: 240, rate: 1.8, pspd: 250, freezeShot: 0, shotCol: '#7affb0', fly: true, gold: 28, style: 'wraith', col: '#5affa0', elite: true },
  strangler: { name: 'Strangleroot', role: 'Entangler (special: rooted, snaring vines)', hp: 60, spd: 0, r: 15, dmg: 8, beh: 'ranged', range: 320, keep: 0, rate: 1.6, pspd: 260, shot: { kind: 'web', col: '#7aa04a', slow: 2.2, r: 8 }, gold: 10, style: 'bigspider', col: '#5a7a3a' },
  // Swamp
  ghoul: { name: 'Fen Ghoul', role: 'Ghoul (grunt)', hp: 30, spd: 92, r: 12, dmg: 10, beh: 'melee', reach: 22, windup: 0.38, gold: 5, style: 'shambler', col: '#7a8a5a' },
  leech: { name: 'Bog Leech', role: 'Leech (fast swarmer)', hp: 12, spd: 150, r: 9, dmg: 5, beh: 'swarm', reach: 14, windup: 0.2, gold: 2, style: 'spider', col: '#7a2a2a' },
  bogtroll: { name: 'Peat Hulk', role: 'Bog troll (tank, rots into a poison pool)', hp: 150, spd: 48, r: 18, dmg: 20, beh: 'melee', reach: 32, windup: 0.75, deathPool: { r: 64, time: 5, dps: 12 }, gold: 16, style: 'hulk', col: '#4a5a2a', heavy: true },
  croaker: { name: 'Mire Croaker', role: 'Swamp shaman (caster elite, raises ghouls)', hp: 80, spd: 70, r: 13, dmg: 11, beh: 'caster', range: 330, keep: 230, rate: 2.0, pspd: 230, summon: 'ghoul', freezeShot: 0, shotCol: '#9aff3a', gold: 30, style: 'robed', col: '#4a7a3a', elite: true },
  spitter: { name: 'Blight Spitter', role: 'Plague spitter (special: lobs poison pools)', hp: 44, spd: 58, r: 15, dmg: 12, beh: 'lobber', range: 360, keep: 220, rate: 2.4, lobPool: { r: 50, time: 4, dps: 10 }, gold: 10, style: 'bloater', col: '#8aa03a' },
  // Desert / ruins
  dmummy: { name: 'Dune-Wrapped', role: 'Desert mummy (grunt)', hp: 32, spd: 84, r: 12, dmg: 10, beh: 'melee', reach: 24, windup: 0.4, gold: 5, style: 'shambler', col: '#c8b080' },
  scarab: { name: 'Gilded Scarab', role: 'Scarab (fast swarmer)', hp: 9, spd: 158, r: 8, dmg: 4, beh: 'swarm', reach: 12, windup: 0.18, gold: 2, style: 'spider', col: '#2a8a8a' },
  sentinel: { name: 'Sandstone Sentinel', role: 'Sand guardian (tank, shield, immune to elements)', hp: 150, spd: 50, r: 17, dmg: 18, beh: 'shield', reach: 30, windup: 0.6, armored: true, gold: 16, style: 'hulk', col: '#a08a5a', heavy: true },
  suncult: { name: 'Sunscorch Hierarch', role: 'Sun cultist (caster elite)', hp: 80, spd: 70, r: 13, dmg: 12, beh: 'caster', range: 340, keep: 240, rate: 2.0, pspd: 240, summon: 'dmummy', freezeShot: 0, shotCol: '#ffb040', gold: 30, style: 'pyro', col: '#e0c070', elite: true },
  jackal: { name: 'Jackal Templar', role: 'Anubis guard (special: spear lunge)', hp: 90, spd: 88, r: 14, dmg: 16, beh: 'charger', reach: 34, windup: 0.5, gold: 14, style: 'skeleton', col: '#2a2a2a', heavy: true },
  // Frozen wastes
  fskel: { name: 'Rimebone Soldier', role: 'Frost skeleton (grunt)', hp: 26, spd: 96, r: 11, dmg: 9, beh: 'melee', reach: 22, windup: 0.34, gold: 4, style: 'skeleton', col: '#bfe0ff' },
  sprite: { name: 'Shiver Sprite', role: 'Ice spirit (fast swarmer, freezing touch)', hp: 9, spd: 130, r: 10, dmg: 10, beh: 'wraith', touchFreeze: 0.8, gold: 3, style: 'wraith', col: '#9fe8ff' },
  yeti: { name: 'Hoarfrost Yeti', role: 'Yeti (tank, charges)', hp: 150, spd: 62, r: 18, dmg: 20, beh: 'charger', reach: 30, windup: 0.6, gold: 18, style: 'hulk', col: '#e8eef4', heavy: true },
  rimemage: { name: 'Rime Magus', role: 'Frost mage (caster elite, freezing bolts)', hp: 80, spd: 66, r: 13, dmg: 12, beh: 'caster', range: 340, keep: 250, rate: 2.0, pspd: 230, summon: 'fskel', freezeShot: 1.0, gold: 30, style: 'robed', col: '#6a9ad0', elite: true },
  igolem: { name: 'Glacier Golem', role: 'Ice golem (special: shatters into a freezing burst)', hp: 120, spd: 44, r: 18, dmg: 18, beh: 'melee', reach: 30, windup: 0.8, deathFreeze: { r: 90, t: 1.2 }, gold: 16, style: 'hulk', col: '#8ab8e8', heavy: true },
  // Dark fortress
  thrall: { name: 'Ironsworn Thrall', role: 'Fortress soldier (grunt, halberd reach)', hp: 36, spd: 88, r: 12, dmg: 12, beh: 'melee', reach: 30, windup: 0.42, gold: 6, style: 'skeleton', col: '#4a4048' },
  assassin: { name: 'Veil Assassin', role: 'Shadow assassin (fast swarmer)', hp: 18, spd: 175, r: 11, dmg: 9, beh: 'swarm', reach: 18, windup: 0.18, gold: 5, style: 'cultist', col: '#3a2a4a' },
  bulwark: { name: 'Cursed Bulwark', role: 'Cursed guardian (tank, tower shield)', hp: 170, spd: 56, r: 17, dmg: 20, beh: 'shield', reach: 30, windup: 0.6, gold: 18, style: 'shieldbrute', col: '#6a5a3a', heavy: true },
  chanter: { name: 'Doom Chanter', role: 'Doom cultist (caster elite, front barrier)', hp: 90, spd: 66, r: 13, dmg: 13, beh: 'caster', range: 340, keep: 250, rate: 1.9, pspd: 240, summon: 'thrall', freezeShot: 0, shotCol: '#c07aff', barrier: true, gold: 32, style: 'robed', col: '#5a2a7a', elite: true },
  abyssal: { name: 'Abyssal Ravener', role: 'Abyssal demon (special: charging brute)', hp: 140, spd: 80, r: 17, dmg: 22, beh: 'charger', reach: 34, windup: 0.55, gold: 20, style: 'demon', col: '#3a1a4a', heavy: true },
  // mini-bosses
  alpha: { name: 'Grimfang, the Pack Alpha', role: 'Forest mini-boss', hp: 850, spd: 120, r: 20, dmg: 18, beh: 'charger', reach: 34, windup: 0.5, rally: { every: 9, count: 3, aura: 0, type: 'wolf' }, nova: { every: 8, r: 130, slow: 2.5, windup: 0.9, col: '#c8c8d0' }, gold: 350, style: 'hulk', col: '#3a3a40', elite: true, heavy: true, miniboss: true },
  hag: { name: 'Old Mother Fen', role: 'Swamp mini-boss', hp: 800, spd: 64, r: 18, dmg: 14, beh: 'caster', range: 360, keep: 240, rate: 1.4, pspd: 240, summon: 'leech', freezeShot: 0, shotCol: '#9aff3a', nova: { every: 7, r: 120, pool: { r: 70, time: 4, dps: 12 }, windup: 1.0, col: '#9aff3a' }, gold: 350, style: 'robed', col: '#4a6a2a', elite: true, heavy: true, miniboss: true },
  pharaohq: { name: 'Queen Nefrabet', role: 'Pharaoh (desert mini-boss)', hp: 850, spd: 60, r: 18, dmg: 15, beh: 'caster', range: 360, keep: 240, rate: 1.5, pspd: 240, summon: 'scarab', freezeShot: 0, shotCol: '#ffd27a', barrier: true, nova: { every: 8, r: 120, slow: 2.5, windup: 0.9, col: '#e8c87a' }, gold: 350, style: 'robed', col: '#c8a040', elite: true, heavy: true, miniboss: true },
  boneknight: { name: 'Sir Varric, the Bone Knight', role: 'Bone Knight (frozen mini-boss)', hp: 950, spd: 66, r: 19, dmg: 22, beh: 'melee', reach: 40, windup: 0.6, cleave: true, rally: { every: 10, count: 2, aura: 170 }, nova: { every: 8, r: 120, freeze: 1.2, windup: 1.0, col: '#9fd8ff' }, gold: 400, style: 'skeleton', col: '#6a7a8a', elite: true, heavy: true, miniboss: true },
  succubus: { name: 'Lady Morwen, the Veiled', role: 'Succubus (fortress mini-boss)', hp: 900, spd: 90, r: 17, dmg: 15, beh: 'caster', range: 360, keep: 240, rate: 1.3, pspd: 260, summon: 'assassin', freezeShot: 0, shotCol: '#e07aff', fly: true, nova: { every: 7, r: 130, windup: 0.9, col: '#c07aff' }, gold: 400, style: 'robed', col: '#7a2a6a', elite: true, heavy: true, miniboss: true },
};
// generic Extended Realms boss: stalks, then cycles its attacks. acts: slam (telegraphed ring), volley (radial shots), rain (telegraphs under heroes), summon, charge
const XBOSS_STATS = {
  ancient: { name: 'The Eldergrove Ancient', role: 'Forest Ancient (forest boss)', hp: 2200, r: 38, dmg: 26, spd: 36, col: '#5a4a2a', ai: 'x', acts: ['slam', 'rain', 'summon', 'volley'], projCol: '#7ad04a', fx: { slow: 2 }, summon: 'wolf', slamCol: '#7ad04a' },
  colossus: { name: 'The Rot Colossus', role: 'Plague Abomination (swamp boss)', hp: 2300, r: 40, dmg: 26, spd: 40, col: '#5a6a2a', ai: 'x', acts: ['slam', 'volley', 'rain', 'summon'], projCol: '#9aff3a', fx: { pool: { r: 60, time: 4, dps: 12 } }, summon: 'leech', slamCol: '#9aff3a' },
  sunpharaoh: { name: 'Akhet-Ra, the Sun-Eater', role: 'Tomb Pharaoh (desert boss)', hp: 2400, r: 36, dmg: 28, spd: 52, col: '#c8a040', ai: 'x', acts: ['charge', 'volley', 'rain', 'summon'], projCol: '#ffd27a', fx: {}, summon: 'scarab', slamCol: '#ffb040' },
  frosttitan: { name: 'Ymrask, the Frost Titan', role: 'Frost Titan (frozen boss)', hp: 2600, r: 40, dmg: 30, spd: 34, col: '#8ab8e8', ai: 'x', acts: ['slam', 'volley', 'rain', 'summon'], projCol: '#bfe8ff', fx: { freeze: 1.0 }, summon: 'sprite', slamCol: '#bfe8ff' },
  deathknight: { name: 'Sir Malgrave, the Death Knight', role: 'Death Knight (fortress boss)', hp: 2800, r: 36, dmg: 32, spd: 60, col: '#3a2a4a', ai: 'x', acts: ['charge', 'slam', 'volley', 'summon'], projCol: '#c07aff', fx: {}, summon: 'thrall', slamCol: '#c07aff' },
};
const XAREAS = [
  { id: 'x1', key: 'forest', name: 'The Thornwild', short: 'Thornwild', foes: ['fscout', 'fscout', 'wolf', 'wolf', 'wolf', 'ftroll', 'strangler'], elite: ['wisp'], spawn: ['fscout', 'wolf', 'wolf', 'fscout'], miniboss: 'alpha', boss: 'ancient', decor: 'shrub',
    theme: { floor: [46, 58, 36], wall: '#34502a', top: '#46663a', dark: '#1a2a12', moss: '#8ab04a', pit: '#0a1206', pitGlow: null, fog: 'rgba(120,220,120,0.05)', detail: 'grass' } },
  { id: 'x2', key: 'swamp', name: 'The Rotting Fen', short: 'Rotting Fen', foes: ['ghoul', 'ghoul', 'leech', 'leech', 'bogtroll', 'spitter'], elite: ['croaker'], spawn: ['ghoul', 'leech', 'leech', 'ghoul'], miniboss: 'hag', boss: 'colossus', decor: 'reeds',
    theme: { floor: [42, 50, 40], wall: '#3a4a36', top: '#52624a', dark: '#161e14', moss: '#7a9a2a', pit: '#1a2a10', pitGlow: '#7ab02a', fog: 'rgba(150,200,80,0.07)', detail: 'puddle' } },
  { id: 'x3', key: 'desert', name: 'The Sunken Sands', short: 'Sunken Sands', foes: ['dmummy', 'dmummy', 'scarab', 'scarab', 'scarab', 'sentinel', 'jackal'], elite: ['suncult'], spawn: ['dmummy', 'scarab', 'scarab', 'dmummy'], miniboss: 'pharaohq', boss: 'sunpharaoh', decor: 'bones',
    theme: { floor: [104, 86, 58], wall: '#8a6a40', top: '#a8855a', dark: '#3a2a16', moss: '#c8a060', pit: '#2a1a08', pitGlow: null, fog: 'rgba(255,210,140,0.05)', detail: 'sand' } },
  { id: 'x4', key: 'frozen', name: 'The Rimefrost Wastes', short: 'Rimefrost', foes: ['fskel', 'fskel', 'sprite', 'sprite', 'yeti', 'igolem'], elite: ['rimemage'], spawn: ['fskel', 'sprite', 'fskel', 'sprite'], miniboss: 'boneknight', boss: 'frosttitan', decor: 'icicle',
    theme: { floor: [70, 86, 102], wall: '#5a7a98', top: '#86a6c4', dark: '#22324a', moss: '#e8f4ff', pit: '#0a1420', pitGlow: '#7ad0ff', fog: 'rgba(200,230,255,0.07)', detail: 'snow' } },
  { id: 'x5', key: 'fortress', name: 'The Ebon Citadel', short: 'Ebon Citadel', foes: ['thrall', 'thrall', 'assassin', 'assassin', 'bulwark', 'abyssal'], elite: ['chanter'], spawn: ['thrall', 'assassin', 'thrall', 'assassin'], miniboss: 'succubus', boss: 'deathknight', decor: 'chains',
    theme: { floor: [40, 34, 44], wall: '#3a3040', top: '#544860', dark: '#141018', moss: '#8a2a3a', pit: '#0a0610', pitGlow: '#a03aff', fog: 'rgba(150,60,200,0.06)', detail: 'rune' } },
];
Object.assign(FOES, XFOE_STATS);
Object.assign(FOE_FAMILY, { fskel: 'bones', boneknight: 'bones', thrall: 'bones', ghoul: 'shrouds', dmummy: 'shrouds', wolf: 'gobs', fscout: 'gobs', leech: 'gobs', scarab: 'gobs', assassin: 'cult', chanter: 'cult', suncult: 'cult', abyssal: 'fiends', succubus: 'fiends' });
Object.assign(FOE_SPRITE, {
  fscout: 'fscout', wolf: 'wolf', ftroll: 'ftroll', wisp: 'wisp', strangler: 'strangler', ghoul: 'ghoul', leech: 'leech', bogtroll: 'bogtroll', croaker: 'croaker', spitter: 'spitter',
  dmummy: 'dmummy', scarab: 'scarab', sentinel: 'sentinel', jackal: 'jackal', suncult: 'suncult', fskel: 'fskel', sprite: 'icesprite', yeti: 'yeti', rimemage: 'rimemage', igolem: 'igolem',
  thrall: 'thrall', assassin: 'assassin', bulwark: 'bulwark', chanter: 'chanter', abyssal: 'abyssal', alpha: 'alpha', hag: 'hag', pharaohq: 'pharaohq', boneknight: 'boneknight', succubus: 'succubus',
  ancient: 'ancient', colossus: 'colossus', sunpharaoh: 'sunpharaoh', frosttitan: 'frosttitan', deathknight: 'deathknight' });
ENDLESS.worldFor = n => { const a = ENDLESS.area(n); return a < 3 ? WORLDS[a] : XAREAS[a - 3]; };
