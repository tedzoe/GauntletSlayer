'use strict';
// ---------------------------------------------------------------- heroes (original characters)
// Display names, one place to rename any hero ('Title Name' format).
const HERO_NAMES = {
  theo: 'Sir Theo', gela: 'Dawnbringer Gela', isaac: 'Ranger Isaac',
  zoey: 'Sorceress Zoey', vesper: 'Vesper Linda', paladin: 'Highlord David',
};
const PALADIN_NAME = HERO_NAMES.paladin;   // the paladin hero
const GELA_NAME = HERO_NAMES.gela;         // the valkyrie shield fighter
// internal ids are kept stable for save data: 'brannoc' = Sir Theo's spinner kit, 'sela' = Gela's shield kit,
// 'kestrel' = Isaac, 'mirelle' = Zoey.
const HEROES = [
  { id: 'brannoc', name: HERO_NAMES.theo, title: 'Knight of the Ember Cape', role: 'Melee spinner', sprite: 'theo',
    color: '#c0473a', dark: '#4a1a16', skin: '#e3b48f', accent: '#ffd9a0',
    hp: 150, speed: 146, armor: 0.28,
    blurb: 'A brave young knight with a long halberd and a battered shield. A seven-swing combo with heavy 4th and 7th blows, a stunning Smash, an untouchable Rush that flows into a Super Slash or a Leap, and a whirlwind that nothing can touch.',
    moves: ['7-swing combo (4th and 7th heavy)', 'Smash (stuns first, Lethal)', 'Rush (untouchable; + attack / + smash)', 'Whirlwind (invulnerable)'] },
  { id: 'sela', name: HERO_NAMES.gela, title: 'Valkyrie of the Storm', role: 'Shield fighter', sprite: 'gela',
    color: '#7fb6d8', dark: '#23384a', skin: '#e0b490', accent: '#d8f0ff',
    hp: 135, speed: 148, armor: 0.33,
    blurb: 'A storm-born valkyrie with a rune spear and a knotwork shield. She turns missiles aside with a wind barrier, bashes, lunges, and hurls her shield or a lightning spear.',
    moves: ['7-strike spear combo', 'Spear Lunge (block cancels)', 'Shield Block (perfect block reflects; Lunge = Shield Charge)', 'Shield Throw'] },
  { id: 'kestrel', name: HERO_NAMES.isaac, title: 'Elf of the Greenwood', role: 'Archer', sprite: 'isaac',
    color: '#a8823e', dark: '#3a2a14', skin: '#d8a882', accent: '#e8f5a0',
    hp: 100, speed: 178, armor: 0.1,
    blurb: 'A quick, sharp-eyed young elf with a longbow. Rapid shots, a charged sniper shot that pierces everything at full draw, a fast roll, and bombs he can drop mid-roll.',
    moves: ['Rapid Shot (hold)', 'Sniper Shot (hold to draw)', 'Combat Roll', 'Bomb (shoot it = explosive arrow)'] },
  { id: 'mirelle', name: HERO_NAMES.zoey, title: 'Weaver of Runes', role: 'Rune caster', sprite: 'zoey',
    color: '#6a5ae8', dark: '#1d1a66', skin: '#e9c3a0', accent: '#c8b8ff',
    hp: 100, speed: 145, armor: 0.1,
    blurb: 'A starlit sorceress who writes spells in midair. She combines two of three runes to prime one of nine spells, then casts it.',
    moves: ['Cast primed spell', 'Rune: Storm', 'Rune: Rime', 'Rune: Ember'] },
  { id: 'vesper', name: HERO_NAMES.vesper, title: 'Mistress of Soul-Fire', role: 'Necromancer', sprite: 'vesper',
    color: '#8a5ad0', dark: '#38215c', skin: '#d8cfd8', accent: '#b07aff',
    hp: 110, speed: 150, armor: 0.15,
    blurb: 'A necromancer in tattered black and violet. Her bone servants strike at whatever is nearest, a hammer skeleton smashes the ground at mid range, Ghostwalk carries her through enemies, and Soul Power from kills calls the dead.',
    moves: ['Skeleton Slash (finds its range)', 'Skeleton Smash (Lethal, foes attack it)', 'Ghostwalk (no cooldown)', 'Soul Power ability (1-5 souls, FULL bonus)'] },
  { id: 'paladin', name: HERO_NAMES.paladin, title: 'Lion of the Dawn', role: 'Paladin', sprite: 'paladin',
    color: '#d8b048', dark: '#3a2a10', skin: '#a8784f', accent: '#ffe9a0',
    hp: 180, speed: 128, armor: 0.42,
    blurb: 'A holy paladin in gold and white. A three-swing Crusader combo, a charged Judgment overhead, a Holy Bulwark that throws missiles back, consecrated ground that burns foes and mends allies, and an aura that shields everyone near him.',
    moves: ['Crusader combo (3 swings)', 'Judgment (hold to charge)', 'Holy Bulwark (block; +Heavy = Righteous Advance)', 'Holy Slam / weapon (Block + it = Consecration)'] },
];
const HERO = Object.fromEntries(HEROES.map(h => [h.id, h]));

// weapons change the weapon ability (and sometimes more). 'base' is owned from the start.
const WEAPONS = {   // shop lineup (David). Each weapon swaps the hero's signature ability. Prices are set from WEAPON_PRICE in tuning.js.
  brannoc: [
    { id: 'base', name: 'Ashwood Halberd', ability: 'Destructo-Spin', desc: 'Spin through the crowd: T3 hits around you (2m), untouchable for 3.5s. 12s cooldown.' },
    { id: 'axe', name: 'Bearded Throwing Axe', ability: 'Thrown Axe', desc: 'Hurl an axe straight ahead: T2, no splash. 5s cooldown.' },
    { id: 'turbo', name: 'Quakehammer', ability: 'Turbo-Slam', desc: 'Slam a 90-degree cone out to 3m: T3 + hard stun, cancels elite wind-ups. 7s cooldown.' },
    { id: 'demonic', name: 'Hellforged Cleaver', ability: 'Demonic Cleave', desc: 'A 1m x 6m shockwave: T2, leaves burning ground for 4s. 8s cooldown.' },
  ],
  sela: [
    { id: 'base', name: 'Knotwork Roundshield', ability: 'Extreme Prejudice', desc: 'A 180-degree, 2.5m sweep that hurls foes back. No direct damage; a foe slammed into a wall takes T4 and a 2s stun. 9s.' },
    { id: 'splitter', name: 'Splitwing Targe', ability: 'Shield Splitter', desc: 'Three piercing shields in a 45-degree fan, T2 each. 6s cooldown.' },
    { id: 'vanguard', name: 'Vanguard Lance', ability: 'Deflecting Thrust', desc: 'Replaces the lunge: a quick T1 poke that breaks up to 6 missiles per half-second. No cooldown, no stamina.' },
    { id: 'ricochet', name: 'Stormrim Buckler', ability: 'Shield Ricochet', desc: 'The shield hops between up to 4 foes (4m hops), T2 + interrupt each, then returns. 8s cooldown.' },
  ],
  kestrel: [
    { id: 'base', name: 'Gilded Recurve', ability: 'Mortar Shot', desc: 'Lob a shell onto a 3m circle: T3, triple hits on spawners. Mid-roll: drop a bomb (2s fuse); while drawing: load an explosive arrow. All three share one 6s cooldown.' },
    { id: 'thorn', name: 'Thornwood Bow', ability: 'Rooting Shot', desc: 'A long thin piercing shot, T2, roots everything it passes for 2.5s. 5s cooldown.' },
    { id: 'sparks', name: 'Sparkwire Bow', ability: 'Sparks Trap', desc: 'Plant a hidden mine: 1m trigger, T2, snares the group for 3s. 8s cooldown.' },
    { id: 'dusk', name: 'Duskstrike', ability: 'Smoke Bomb', desc: 'A 2m smoke cloud that staggers foes nearby (T1): they lose track of you and you are invisible for 4s, until you shoot or roll. A shot from hiding hits twice as hard. 5s cooldown.' },
  ],
  mirelle: [
    { id: 'base', name: 'Spellweaver', ability: 'Ember / Rime / Storm', desc: 'The standard nine-spell matrix, T1-T3, cooldowns 0-10s. The next combo can be queued during recovery.', schools: ['ember', 'rime', 'storm'] },
    { id: 'hollow', name: 'Hollow Chapters', ability: 'Shadow fields', desc: 'All nine spells become lingering T2 shadow and gravity zones with even 5s cooldowns.', schools: ['ember', 'rime', 'storm'] },
    { id: 'ashen', name: 'Firebound Tomes', ability: 'Explosive splashes', desc: 'All nine spells become T3 explosive circles at the target point with extra spawner damage; cooldowns +20%.', schools: ['ember', 'rime', 'storm'] },
  ],
  vesper: [
    { id: 'base', name: 'Ossuary Staff', ability: 'Raise Skeletons', desc: 'Spends all Soul Power: one skeleton warrior per soul (max 5) rises in front of you for 15s. Full meter: tougher, harder-hitting skeletons.' },
    { id: 'lantern', name: 'Wraith Lantern', ability: 'Summon Shades', desc: 'Spends all Soul Power: two homing shades per soul (20 at full) that hunt foes and burst on impact. They wait at your side until something shows up.' },
    { id: 'marrow', name: 'Marrow Reliquary', ability: 'Bone Archers', desc: 'Spends all Soul Power: one fragile skeleton archer per soul (max 5) rises behind you for 20s, stunning foes as it climbs out. They stack. Full meter: fire arrows.' },
    { id: 'scepter', name: 'Crimson Scepter', ability: 'Dominate', desc: 'Spends all Soul Power: foes around you (not bosses) turn on their friends, 3-15s by souls. Full meter: they move and strike faster. Kills heal you a little.' },
  ],
  paladin: [
    { id: 'base', name: 'Oathkeeper', ability: 'Holy Slam', desc: 'A pillar of light around you: T3, 4m. 9s cooldown.' },
    { id: 'hammer', name: 'Dawnhammer', ability: 'Hammer of Light', desc: 'Throw a hammer that pierces everything and flies back: T2. 6s cooldown.' },
    { id: 'lance', name: 'Sunspear', ability: 'Radiant Lance', desc: 'A straight beam of light: T3, pierces, double damage to shadow and undead. 7s cooldown.' },
    { id: 'sanctuary', name: 'Reliquary Blade', ability: 'Sanctuary Pulse', desc: 'A 4m ring that throws foes back (T1) and shields allies inside for 3s (absorbs 30 HP). 10s cooldown.' },
  ],
};
// talismans = unique potion abilities (each use costs one potion)
const TALISMANS = {
  brannoc: [{ id: 'base', name: "Quartermaster's Horn", cost: 0, desc: 'No damage: food appears around every hero (even past floor 37).' },
            { id: 'titan', name: "Titan's Draught", cost: 3500, desc: 'Grow huge, invulnerable, +60% damage for 7s.' }],
  sela: [{ id: 'base', name: "Valkyrie's Call", cost: 0, desc: 'Three spectral shieldmaidens fight beside you for 10s; raven wings lift the fallen and heal everyone.' },
         { id: 'aegis', name: 'Shieldwall Oath', cost: 3500, desc: 'No damage: a 3m field for 6s that stops missiles and keeps foes out, healing allies inside.' }],
  kestrel: [{ id: 'base', name: 'Heartpiercer', cost: 0, desc: 'An arrow that pierces everything for massive (T4) damage.' },
            { id: 'sprites', name: 'Grove Sprites', cost: 3500, desc: 'Three sprites circle you for 12s and shred anything they touch.' }],
  mirelle: [{ id: 'base', name: 'Arcane Nova', cost: 0, desc: 'A screen-wide blast of raw magic (T4).' },
            { id: 'bastion', name: 'Bastion Bubble', cost: 3500, desc: 'A dome that shoves foes out and stops missiles for 7s.' }],
  vesper: [{ id: 'base', name: 'Hungering Heart', cost: 0, desc: 'After a slow cast (your weapon ability cuts it short), a 6s ring around you drains and slows foes and heals you per foe. Ghosts in it die. You are not immune.' },
           { id: 'rekindle', name: 'Rekindle', cost: 3500, desc: 'Bring back the ally who fell longest ago (solo: big heal + invulnerability).' }],
  paladin: [{ id: 'base', name: 'Golden Wings', cost: 0, desc: '4s of flight and invulnerability, then a radiant T4 burst where you land.' },
            { id: 'layhands', name: 'Lay on Hands', cost: 3500, desc: 'Fully heal yourself and allies within 6m; downed allies in range rise at once (no skull coin).' }],
};
// relics: one slot, cooldown based, 3 ranks
const RELIC_COST_TABLE = [4000, 12000, 32000];   // David: 4000 / 12000 / 32000 (48000 total), gold is per hero
const RELICS = [
  { id: 'feather', name: 'Gale Plume', cost: RELIC_COST_TABLE, cd: 50, desc: ['6m front gust: knocks back lesser foes, 3s slow', '4.5s slow, faster cooldown', 'Whole-screen gust: stuns everything, 6s slow'] },
  { id: 'haste', name: 'Quickstep Anklets', cost: RELIC_COST_TABLE, cd: 40, desc: ['+30% speed for 4s', '+40% for 5.5s', '+50% for 7s + 3m stun burst'] },
  { id: 'squall', name: 'Squall Charm', cost: RELIC_COST_TABLE, cd: 40, desc: ['Slow whirlwind (3.5s, 14 per hit) throws foes; destroys ghosts, skeletons, spiderlings', 'Bigger whirlwind, 22 per hit', '20s whirlwind, 35s cooldown'] },
  { id: 'quill', name: 'Gilded Quill', cost: RELIC_COST_TABLE, cd: 20, desc: ['Turn nearby food & potions into gold (20s cooldown)', 'No change (as in Slayer)', '10s cooldown'] },
  { id: 'ember', name: 'Emberstride Boots', cost: RELIC_COST_TABLE, cd: 60, desc: ['2s speed burst, fire trail burns 5s', '3s burst, 50s cooldown', '40s cooldown'] },
  { id: 'hoar', name: 'Hoarfrost Ring', cost: RELIC_COST_TABLE, cd: 45, desc: ['Freeze a 3m line for 4s', '5.5m line, 6s', '8m circle around you, 8s'] },
  { id: 'idol', name: 'Gargoyle Idol', cost: RELIC_COST_TABLE, cd: 80, desc: ['Gargoyle for 30s: 17 lethal 50-damage fireballs', 'Faster spit: 25 fireballs', '60s cooldown'] },
  { id: 'rift', name: 'Riftmark', cost: RELIC_COST_TABLE, cd: 30, desc: ['Mark a foe in sight; 2s later blink onto it: 154 damage, 14 around', 'Invulnerable until you land', '24s cooldown'] },
  { id: 'shade', name: 'Shade Orb', cost: RELIC_COST_TABLE, cd: 40, desc: ['You and allies nearby turn invisible for 6s', '12s invisibility', '30s cooldown'] },
  { id: 'lyre', name: 'Lure Lyre', cost: RELIC_COST_TABLE, cd: 20, desc: ['Charm nearby foes for 10s (they take double damage)', '15s charm', '10s cooldown, 10s charm'] },
  { id: 'mirror', name: 'Twin Mirror', cost: RELIC_COST_TABLE, cd: 60, desc: ['2 clones for 6s', '3 clones for 8s', '4 clones for 10s that draw enemy fire'] },
];
const RELIC = Object.fromEntries(RELICS.map(r => [r.id, r]));

// masteries: lifetime challenges with tiered stat rewards (stored per hero)
// Built on the original's structure: passive, per hero, tracked by lifetime counters, tiered rewards.
// hero: only shown/earned by that hero. Single-feat masteries have one tier.
const T3 = (a, b, c) => [a, b, c];
const pct = v => `${Math.round(v * 100)}%`;
const FOE_FAMILY = { bonesoldier: 'bones', bonearcher: 'bones', warden: 'bones', marshal: 'bones', shambler: 'shrouds', bloater: 'shrouds', wraith: 'shrouds', barrow: 'shrouds', blight: 'shrouds', hexcaller: 'lich', lich: 'lich',
  goblin: 'gobs', totemist: 'gobs', spiderling: 'gobs', spiderwar: 'gobs', dweller: 'gobs', rockthrower: 'brutes', shieldbrute: 'brutes', hulk: 'brutes', savage: 'brutes', broodmother: 'queen',
  zealot: 'cult', novice: 'cult', pyromancer: 'cult', conjurer: 'cult', imp: 'fiends', firebrand: 'fiends', ravager: 'fiends', horror: 'fiends' };
const SKELETAL = f => FOE_FAMILY[f.type] === 'bones';   // one-shot by Theo's charge and Gela's shield block
const MASTERIES = [
  // ---- class masteries
  { id: 'th_charge', hero: 'brannoc', group: 'Class', name: 'Bull Rush', stat: 'chargeThrough', tiers: [50], reward: () => ({ leap: 1 }), text: () => 'Charge becomes a leaping smash' },
  { id: 'th_spin', hero: 'brannoc', group: 'Class', name: 'Cyclone Reaper', stat: 'spinKills', tiers: T3(1000, 4000, 12000), reward: t => ({ ability: [0.05, 0.1, 0.15][t] }), text: t => `Whirlwind -${[5, 10, 15][t]}% cooldown` },
  { id: 'th_dmg', hero: 'brannoc', group: 'Class', name: 'Ironhide', stat: 'dmgTaken', tiers: T3(1500, 6000, 15000), reward: t => ({ armor: [0.03, 0.06, 0.1][t], bubble: t >= 2 ? 1 : 0 }), text: t => `+${[3, 6, 10][t]}% armor${t >= 2 ? ' + damage-immunity bubble' : ''}` },
  { id: 'ge_block', hero: 'sela', group: 'Class', name: 'Mirror Ward', stat: 'blockedShots', tiers: [10], reward: () => ({ reflect: 1 }), text: () => 'Shield block reflects projectiles' },
  { id: 'ge_throw', hero: 'sela', group: 'Class', name: "The Gull's Flight", stat: 'throwKills', tiers: T3(1000, 4000, 12000), reward: t => ({ ability: [0.05, 0.1, 0.15][t] }), text: t => `Shield throw -${[5, 10, 15][t]}% cooldown` },
  { id: 'ge_dmg', hero: 'sela', group: 'Class', name: 'Stormborn', stat: 'dmgTaken', tiers: T3(1200, 5000, 12000), reward: t => ({ armor: [0.03, 0.06, 0.1][t], bubble: t >= 2 ? 1 : 0 }), text: t => `+${[3, 6, 10][t]}% armor${t >= 2 ? ' + damage-immunity bubble' : ''}` },
  { id: 'zo_fire', hero: 'mirelle', group: 'Class', name: 'Cinderheart', stat: 'elem_fire', tiers: T3(800, 3000, 8000), reward: t => ({ dmg: [0.02, 0.04, 0.06][t] }), text: t => `+${[2, 4, 6][t]}% damage` },
  { id: 'zo_ice', hero: 'mirelle', group: 'Class', name: 'Rimeweaver', stat: 'elem_ice', tiers: T3(800, 3000, 8000), reward: t => ({ ability: [0.04, 0.08, 0.12][t] }), text: t => `Spells -${[4, 8, 12][t] / 2}% cooldown` },
  { id: 'zo_storm', hero: 'mirelle', group: 'Class', name: 'Thundercaller', stat: 'elem_storm', tiers: T3(800, 3000, 8000), reward: t => ({ speed: [0.02, 0.04, 0.06][t] }), text: t => `+${[2, 4, 6][t]}% move speed` },
  { id: 'zo_dmg', hero: 'mirelle', group: 'Class', name: 'Learned the Hard Way', stat: 'dmgTaken', tiers: T3(1000, 4000, 10000), reward: t => ({ armor: [0.03, 0.06, 0.1][t], bubble: t >= 2 ? 1 : 0 }), text: t => `+${[3, 6, 10][t]}% armor${t >= 2 ? ' + damage-immunity bubble' : ''}` },
  { id: 'is_prec', hero: 'kestrel', group: 'Class', name: 'Deadeye', stat: 'precisionKills', tiers: [50], reward: () => ({ dmg: 0.05 }), text: () => '+5% damage' },
  { id: 'is_bomb', hero: 'kestrel', group: 'Class', name: 'Blastwright', stat: 'bombKills', tiers: T3(1000, 4000, 12000), reward: t => ({ ability: [0.05, 0.1, 0.15][t] }), text: t => `Bombs -${[5, 10, 15][t]}% cooldown` },
  { id: 'is_dmg', hero: 'kestrel', group: 'Class', name: 'Greenwood Grit', stat: 'dmgTaken', tiers: T3(1000, 4000, 10000), reward: t => ({ armor: [0.03, 0.06, 0.1][t], bubble: t >= 2 ? 1 : 0 }), text: t => `+${[3, 6, 10][t]}% armor${t >= 2 ? ' + damage-immunity bubble' : ''}` },
  { id: 've_min', hero: 'vesper', group: 'Class', name: 'Legion of Bone', stat: 'minionKills', tiers: T3(1000, 4000, 12000), reward: t => ({ ability: [0.05, 0.1, 0.15][t] }), text: t => `Raise Dead -${[5, 10, 15][t]}% cooldown` },
  { id: 've_dmg', hero: 'vesper', group: 'Class', name: 'Grave-Hardened', stat: 'dmgTaken', tiers: T3(1000, 4000, 10000), reward: t => ({ armor: [0.03, 0.06, 0.1][t], bubble: t >= 2 ? 1 : 0 }), text: t => `+${[3, 6, 10][t]}% armor${t >= 2 ? ' + damage-immunity bubble' : ''}` },
  { id: 'da_slam', hero: 'paladin', group: 'Class', name: 'Hammer of Dawn', stat: 'signature', tiers: T3(100, 600, 2500), reward: t => ({ ability: [0.1, 0.2, 0.3][t] }), text: t => `Holy Slam -${[10, 20, 30][t]}% cooldown` },
  { id: 'da_dmg', hero: 'paladin', group: 'Class', name: 'Unbroken Oath', stat: 'dmgTaken', tiers: T3(1500, 6000, 15000), reward: t => ({ armor: [0.03, 0.06, 0.1][t], bubble: t >= 2 ? 1 : 0 }), text: t => `+${[3, 6, 10][t]}% armor${t >= 2 ? ' + damage-immunity bubble' : ''}` },
  // ---- loot & food
  { id: 'props', group: 'Loot & Food', name: 'Fortune Favors the Clumsy', stat: 'props', tiers: T3(200, 800, 5000), reward: t => ({ gold: [0.03, 0.06, 0.1][t] }), text: t => `+${[3, 6, 10][t]}% gold found` },
  { id: 'smash', group: 'Loot & Food', name: 'Eating off the Floor', stat: 'foodSmashed', tiers: T3(25, 150, 500), reward: t => ({ smashHeal: [0.15, 0.25, 0.4][t] }), text: t => `Destroyed food still heals ${[15, 25, 40][t]}%` },
  { id: 'food', group: 'Loot & Food', name: 'Bottomless Belly', stat: 'eaten', tiers: T3(600, 2500, 6000), reward: t => ({ food: [0.1, 0.2, 0.35][t] }), text: t => `Food heals +${[10, 20, 35][t]}%` },
  { id: 'gold', group: 'Loot & Food', name: 'Hoarder', stat: 'gold', tiers: T3(5000, 25000, 100000), reward: t => ({ gold: [0.05, 0.1, 0.2][t] }), text: t => `+${[5, 10, 20][t]}% gold found` },
  // ---- kills by family
  { id: 'kills', group: 'Kills', name: 'Endless Slaughter', stat: 'kills', tiers: T3(5000, 20000, 50000), reward: t => ({ dmg: [0.05, 0.12, 0.25][t] }), text: t => `+${[5, 12, 25][t]}% damage (all attacks)` },
  { id: 'f_bones', group: 'Kills', name: 'Bone Breaker', stat: 'fam_bones', tiers: T3(1500, 5000, 15000), reward: t => ({ dmg: [0.01, 0.02, 0.03][t] }), text: t => `+${[1, 2, 3][t]}% damage` },
  { id: 'f_shrouds', group: 'Kills', name: 'Shroud Ripper', stat: 'fam_shrouds', tiers: T3(1500, 5000, 15000), reward: t => ({ dmg: [0.01, 0.02, 0.03][t] }), text: t => `+${[1, 2, 3][t]}% damage` },
  { id: 'f_lich', group: 'Kills', name: 'Lichbane', stat: 'fam_lich', tiers: T3(10, 25, 50), reward: t => ({ hp: [5, 10, 15][t] }), text: t => `+${[5, 10, 15][t]} max health` },
  { id: 'f_gobs', group: 'Kills', name: 'Vermin Sweeper', stat: 'fam_gobs', tiers: T3(1500, 5000, 15000), reward: t => ({ dmg: [0.01, 0.02, 0.03][t] }), text: t => `+${[1, 2, 3][t]}% damage` },
  { id: 'f_brutes', group: 'Kills', name: 'Brute Breaker', stat: 'fam_brutes', tiers: T3(1500, 5000, 15000), reward: t => ({ dmg: [0.01, 0.02, 0.03][t] }), text: t => `+${[1, 2, 3][t]}% damage` },
  { id: 'f_queen', group: 'Kills', name: "Broodmother's Bane", stat: 'fam_queen', tiers: T3(10, 25, 50), reward: t => ({ hp: [5, 10, 15][t] }), text: t => `+${[5, 10, 15][t]} max health` },
  { id: 'f_cult', group: 'Kills', name: 'Heretic Hunter', stat: 'fam_cult', tiers: T3(1500, 5000, 15000), reward: t => ({ dmg: [0.01, 0.02, 0.03][t] }), text: t => `+${[1, 2, 3][t]}% damage` },
  { id: 'f_fiends', group: 'Kills', name: 'Fiendslayer', stat: 'fam_fiends', tiers: T3(1500, 5000, 15000), reward: t => ({ dmg: [0.01, 0.02, 0.03][t] }), text: t => `+${[1, 2, 3][t]}% damage` },
  { id: 'spawners', group: 'Kills', name: 'Nest Breaker', stat: 'spawners', tiers: T3(25, 120, 400), reward: t => ({ spawnerDmg: [0.15, 0.3, 0.5][t] }), text: t => `+${[15, 30, 50][t]}% damage to spawners` },
  // ---- bosses and flawless Unfair chapters, one per area
  { id: 'b_ossuary', group: 'Areas', name: 'The Rib-King Unmade', stat: 'boss_ossuary', tiers: [1], reward: () => ({ hp: 10 }), text: () => '+10 max health' },
  { id: 'b_rootmaw', group: 'Areas', name: 'Root and Ruin', stat: 'boss_rootmaw', tiers: [1], reward: () => ({ hp: 10 }), text: () => '+10 max health' },
  { id: 'b_forgemaster', group: 'Areas', name: 'Anvil Cold', stat: 'boss_forgemaster', tiers: [1], reward: () => ({ hp: 10 }), text: () => '+10 max health' },
  { id: 'b_sovereign', group: 'Areas', name: 'The Hollow Crown Falls', stat: 'boss_sovereign', tiers: [1], reward: () => ({ hp: 15 }), text: () => '+15 max health' },
  { id: 'u_w1', group: 'Areas', name: 'Necropolis Unbowed', stat: 'flawless_w1', tiers: [1], reward: () => ({ armor: 0.03 }), text: () => '+3% armor (Unfair chapter, no deaths)' },
  { id: 'u_w2', group: 'Areas', name: 'Caverns Unbowed', stat: 'flawless_w2', tiers: [1], reward: () => ({ armor: 0.03 }), text: () => '+3% armor (Unfair chapter, no deaths)' },
  { id: 'u_w3', group: 'Areas', name: 'Foundry Unbowed', stat: 'flawless_w3', tiers: [1], reward: () => ({ armor: 0.03 }), text: () => '+3% armor (Unfair chapter, no deaths)' },
  // ---- deaths
  { id: 'crown', group: 'Loot & Food', name: 'Butterfingers Royal', stat: 'crownDrops', tiers: T3(20, 80, 200), reward: t => ({ gold: [0.02, 0.04, 0.06][t] }), text: t => `+${[2, 4, 6][t]}% gold found` },
  { id: 'deaths', group: 'Deaths', name: 'Dying for a Living', stat: 'deaths', tiers: T3(10, 40, 100), reward: t => ({ reviveInvuln: [2, 3, 5][t] }), text: t => `${[2, 3, 5][t]}s ethereal after reviving` },
  { id: 'd_area', group: 'Deaths', name: 'Went Out with a Bang', stat: 'death_area', tiers: [1], reward: () => ({ armor: 0.01 }), text: () => '+1% armor' },
  { id: 'd_spike', group: 'Deaths', name: 'Pinned and Punctured', stat: 'death_spike', tiers: [1], reward: () => ({ armor: 0.01 }), text: () => '+1% armor' },
  { id: 'd_frozen', group: 'Deaths', name: 'Cold Storage', stat: 'death_frozen', tiers: [1], reward: () => ({ armor: 0.01 }), text: () => '+1% armor' },
  { id: 'd_eight', group: 'Deaths', name: 'Deader than Dead', stat: 'deaths8', tiers: [1], reward: () => ({ reviveInvuln: 1 }), text: () => '+1s ethereal after reviving' },
  { id: 'd_barrel', group: 'Deaths', name: 'Hold My Barrel', stat: 'death_barrel', tiers: [1], reward: () => ({ armor: 0.01 }), text: () => '+1% armor' },
  { id: 'd_blade', group: 'Deaths', name: 'Sliced Thin', stat: 'death_blade', tiers: [1], reward: () => ({ armor: 0.01 }), text: () => '+1% armor' },
  // ---- modes
  { id: 'endless', group: 'Modes', name: 'Into the Deep', stat: 'endlessFloors', tiers: T3(10, 40, 120), reward: t => ({ speed: [0.03, 0.06, 0.1][t] }), text: t => `+${[3, 6, 10][t]}% move speed` },
  { id: 'arena', group: 'Modes', name: 'Pit Champion', stat: 'arenaWaves', tiers: T3(12, 60, 200), reward: t => ({ armor: [0.03, 0.06, 0.1][t] }), text: t => `+${[3, 6, 10][t]}% armor` },
];
const MASTERY_TRACK = { chargeThrough: 'foes charged through', spinKills: 'Whirlwind kills', dmgTaken: 'damage taken', blockedShots: 'projectiles blocked with the shield', throwKills: 'shield-throw kills',
  elem_fire: 'ember-spell kills', elem_ice: 'rime-spell kills', elem_storm: 'storm-spell kills', precisionKills: 'bomb or power-shot kills', bombKills: 'bomb kills', minionKills: 'kills by your raised dead',
  signature: 'missiles reflected or foes slammed', props: 'props destroyed', foodSmashed: 'food destroyed', eaten: 'health worth of food eaten (counts at full health)', gold: 'gold picked up', kills: 'foes slain',
  spawners: 'spawners destroyed', deaths: 'deaths', death_area: 'die to area damage', death_spike: 'die on a spike trap', death_frozen: 'die while frozen', deaths8: 'die 8 times on one floor',
  death_barrel: 'die holding a blasting barrel', crownDrops: 'times the crown was knocked off', death_blade: 'die to a blade trap', endlessFloors: 'Endless floors cleared', arenaWaves: 'Colosseum waves cleared' };
const masteriesFor = id => MASTERIES.filter(ms => !ms.hero || ms.hero === id);
const SIGNATURE = { brannoc: 'foes struck by your weapon ability', sela: 'attacks blocked', kestrel: 'power-shot kills', mirelle: 'spells cast', vesper: 'dead raised', paladin: 'foes struck by your weapon ability' };
Object.assign(MASTERY_TRACK, { fam_bones: 'skeletons slain', fam_shrouds: 'shamblers, bloaters and wraiths slain', fam_lich: 'hexcallers and liches slain',
  fam_gobs: 'goblins and spiders slain', fam_brutes: 'brutes slain', fam_queen: 'Broodmothers slain', fam_cult: 'cultists slain', fam_fiends: 'imps and fiends slain',
  boss_ossuary: 'defeat the Ossuary King', boss_rootmaw: 'defeat Rootmaw, the Deep Hunger', boss_forgemaster: 'defeat Forgemaster Vael', boss_sovereign: 'defeat Hollowfang, the Sovereign Blade',
  flawless_w1: 'clear a Necropolis floor on Unfair with no deaths', flawless_w2: 'clear a Caverns floor on Unfair with no deaths', flawless_w3: 'clear a Foundry floor on Unfair with no deaths' });
// display text for a mastery's tracked feat: never the internal stat key
const masteryTrack = (ms, heroId) => ms.stat === 'signature' && SIGNATURE[heroId] ? SIGNATURE[heroId] : MASTERY_TRACK[ms.stat] || ms.stat.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
const masteryTier = (ms, i) => ms.tiers.length > 1 ? ' ' + ['I', 'II', 'III'][i] : '';   // single-tier feats have no numeral

// ---------------------------------------------------------------- foes (original archetypes)
// beh: melee | ranged | lobber | caster | charger | exploder | swarm | wraith | shield | brood | reaper
const FOES = {
  // world I – undead
  shambler: { name: 'Linen Husk', role: 'Risen Mummy', hp: 34, spd: 52, r: 13, dmg: 11, beh: 'melee', reach: 24, windup: 0.55, gold: 6, style: 'shambler', col: '#7f8f6a' },
  bonesoldier: { name: 'Grave Sentry', role: 'Skeleton Soldier', hp: 18, spd: 96, r: 11, dmg: 7, beh: 'melee', reach: 20, windup: 0.35, gold: 4, style: 'skeleton', col: '#e8e0c8' },
  bonearcher: { name: 'Grave Bowman', role: 'Necromancer summon only', hp: 14, spd: 80, r: 11, dmg: 8, beh: 'ranged', range: 300, keep: 200, rate: 1.8, pspd: 330, gold: 5, style: 'skelarcher', col: '#d8d0b8' },
  bloater: { name: 'Swollen Embalmed', role: 'Bloated Mummy (explodes)', hp: 40, spd: 44, r: 16, dmg: 9, beh: 'melee', reach: 22, windup: 0.6, deathBlast: 20, gold: 8, style: 'bloater', col: '#8fa05a' },
  hexcaller: { name: 'Bone Hexer', role: 'Necromancer (summoner)', hp: 70, spd: 70, r: 13, dmg: 10, beh: 'caster', range: 340, keep: 240, rate: 2.2, pspd: 230, summon: 'bonesoldier', gold: 30, style: 'robed', col: '#6a3a9a', elite: true },
  wraith: { name: 'Grave Wisp', role: 'Ghost', hp: 7, spd: 118, r: 10, dmg: 12, beh: 'wraith', gold: 3, style: 'wraith', col: '#bfe0ff' },
  // world II – beasts
  goblin: { name: 'Burrow Scrounger', role: 'Grunt Scavenger', hp: 11, spd: 122, r: 10, dmg: 5, beh: 'melee', reach: 18, windup: 0.28, gold: 3, style: 'goblin', col: '#7aa83a' },
  spiderling: { name: 'Skitterling', role: 'Spider Spawn', hp: 6, spd: 155, r: 8, dmg: 3, beh: 'swarm', reach: 14, windup: 0.18, gold: 1, style: 'spider', col: '#3a3030' },
  hulk: { name: 'Gloomtusk Juggernaut', role: 'Orc Juggernaut (elite charger)', hp: 95, spd: 58, r: 19, dmg: 22, beh: 'charger', reach: 30, windup: 0.6, gold: 25, style: 'hulk', col: '#8a6a4a', heavy: true, elite: true },
  shieldbrute: { name: 'Gloomtusk Shieldwall', role: 'Armored orc (immune to elemental effects)', armored: true, hp: 48, spd: 70, r: 14, dmg: 12, beh: 'shield', reach: 24, windup: 0.5, gold: 10, style: 'shieldbrute', col: '#6a7a5a' },
  rockthrower: { name: 'Cave Hurler', role: 'legacy (not in Slayer roster)', hp: 40, spd: 60, r: 15, dmg: 16, beh: 'lobber', range: 360, keep: 230, rate: 2.6, gold: 12, style: 'troll', col: '#6a8a8a' },
  broodmother: { name: 'Vexmother, the Web Queen', role: 'Spider Queen (mini-boss)', hp: 85, spd: 62, r: 18, dmg: 10, beh: 'brood', range: 300, keep: 200, rate: 3, pspd: 260, summon: 'spiderling', gold: 30, style: 'bigspider', col: '#4a2a3a', heavy: true, elite: true },
  // world III – cult & fiends
  zealot: { name: 'Ashbound Zealot', role: 'Cultist Zealot', hp: 22, spd: 102, r: 11, dmg: 8, beh: 'melee', reach: 20, windup: 0.32, gold: 5, style: 'cultist', col: '#8a2a2a' },
  pyromancer: { name: 'Cinder Acolyte', role: 'Cultist fire caster', hp: 26, spd: 76, r: 12, dmg: 9, beh: 'ranged', range: 320, keep: 220, rate: 2.0, pspd: 300, firePool: true, gold: 8, style: 'pyro', col: '#c84a1a' },
  imp: { name: 'Cinder Imp', role: 'Demon Imp', hp: 12, spd: 140, r: 9, dmg: 5, beh: 'ranged', range: 240, keep: 140, rate: 1.4, pspd: 360, fly: true, gold: 4, style: 'imp', col: '#e05a2a' },
  firebrand: { name: 'Ember Thrall', role: 'legacy exploder (not in Slayer roster)', hp: 12, spd: 128, r: 10, dmg: 24, beh: 'exploder', gold: 4, style: 'firebrand', col: '#a03020' },
  totemist: { name: 'Burrow Hexdrummer', role: 'Grunt Shaman (elite, haste totem)', hp: 60, spd: 66, r: 14, dmg: 9, beh: 'ranged', range: 280, keep: 220, rate: 2.4, pspd: 280, totem: true, gold: 25, style: 'goblin', col: '#4a9a6a', elite: true },
  totem: { hp: 1, spd: 0, r: 10, dmg: 0, beh: 'totem', gold: 0, style: 'goblin', col: '#9adf6a' },
  conjurer: { name: 'Ashbound Hierophant', role: 'Cultist Sorcerer (elite)', hp: 80, spd: 70, r: 13, dmg: 12, beh: 'caster', range: 340, keep: 260, rate: 2.6, pspd: 240, conjure: true, gold: 30, style: 'pyro', col: '#c03a6a', elite: true },
  ravager: { name: 'Brimstone Fiend', role: 'Demon Fiend (elite brute)', hp: 125, spd: 70, r: 20, dmg: 20, beh: 'melee', reach: 40, windup: 0.7, cleave: true, gold: 30, style: 'demon', col: '#7a1a2a', heavy: true, elite: true },
  // special
  reaper: { name: 'The Pale Collector', hp: 1e9, spd: 132, r: 14, dmg: 30, beh: 'reaper', gold: 0, style: 'reaper', col: '#0b0b12', heavy: true },
};
const WORLDS = [
  { id: 'w1', name: 'The Sunken Necropolis', short: 'Necropolis', foes: ['bonesoldier', 'bonesoldier', 'shambler', 'shambler', 'warden', 'blight', 'bloater', 'wraith', 'barrow'], elite: ['hexcaller', 'marshal'], miniboss: 'lich', spawn: ['bonesoldier', 'shambler', 'warden', 'wraith', 'blight'],
    floors: [{ map: 'w1f1', name: 'The Bonewalk' }, { map: 'maze', name: "The Collector's Labyrinth", gimmick: 'reaper' }, { map: 'w1f3', name: 'Charnel Court', arena: true }, { map: 'w1boss', name: 'Throne of Ribs', boss: 'ossuary' }],
    theme: { floor: [56, 58, 62], wall: '#5e6670', top: '#7a838e', dark: '#2a2f36', moss: '#3e5a48', pit: '#06080a', pitGlow: null, fog: 'rgba(120,160,190,0.05)' } },
  { id: 'w2', name: 'The Gloomroot Caverns', short: 'Caverns', foes: ['goblin', 'goblin', 'savage', 'savage', 'spiderling', 'spiderling', 'spiderwar', 'shieldbrute', 'dweller'], elite: ['hulk', 'totemist'], spawn: ['goblin', 'spiderling', 'savage', 'spiderwar'], miniboss: 'broodmother',
    floors: [{ map: 'w2f1', name: 'Rootfall Hollow' }, { map: 'w2f2', name: 'The Lightless Burrows', gimmick: 'dark' }, { map: 'w2f3', name: 'The Gnawing Pit', arena: true }, { map: 'w2boss', name: 'Maw of the Deep Root', boss: 'rootmaw' }],
    theme: { floor: [58, 50, 40], wall: '#6a5440', top: '#86705a', dark: '#2e2418', moss: '#4a6a2a', pit: '#050403', pitGlow: null, fog: 'rgba(120,200,90,0.04)' } },
  { id: 'w3', name: 'The Ember Foundry', short: 'Foundry', foes: ['novice', 'novice', 'zealot', 'zealot', 'pyromancer', 'imp', 'imp'], elite: ['ravager', 'conjurer'], spawn: ['novice', 'zealot', 'imp', 'pyromancer'], miniboss: 'horror',
    floors: [{ map: 'w3f1', name: 'Slag Gate' }, { map: 'w3f2', name: 'The Cinderfall Run', gimmick: 'meteors' }, { map: 'w3f3', name: 'The Crucible', arena: true }, { map: 'w3boss', name: 'The Great Anvil', boss: 'forgemaster' }],
    theme: { floor: [52, 36, 34], wall: '#5a2e28', top: '#7a4436', dark: '#240e0c', moss: '#6a2a10', pit: '#ff5a10', pitGlow: '#ffb040', fog: 'rgba(255,100,40,0.05)' } },
  { id: 'fin', name: 'The Hollow Throne', short: 'Hollow Throne', foes: ['bonesoldier', 'goblin', 'zealot', 'warden', 'pyromancer', 'wraith', 'shieldbrute'], elite: ['hexcaller', 'hulk', 'ravager'], spawn: ['bonesoldier', 'goblin', 'zealot', 'imp'],
    floors: [{ map: 'f1', name: 'Antechamber of Echoes' }, { map: 'fboss', name: 'The Hollow Throne', boss: 'sovereign' }],
    theme: { floor: [44, 38, 56], wall: '#4a3e66', top: '#625488', dark: '#1c1630', moss: '#5a3a8a', pit: '#120a24', pitGlow: '#7a4aff', fog: 'rgba(160,110,255,0.05)' } },
];
const HUB_THEME = { floor: [70, 58, 46], wall: '#6e5a44', top: '#8c765c', dark: '#30251a', moss: '#5a6a3a', pit: '#0a1622', pitGlow: '#3a8aff', fog: null };
const ARENA_THEME = { floor: [88, 74, 56], wall: '#7a6450', top: '#987e66', dark: '#3a2c20', moss: '#6a5a3a', pit: '#100806', pitGlow: '#ff6a20', fog: null };
const ARENA_MODS = [
  { id: 'glass', name: 'Glass Cannons', desc: 'Everyone deals and takes +50% damage' },
  { id: 'famine', name: 'Famine', desc: 'No food appears between waves' },
  { id: 'frenzy', name: 'Frenzy', desc: 'Foes move 30% faster' },
  { id: 'volatile', name: 'Volatile', desc: 'Slain foes explode after a moment' },
  { id: 'reaper', name: "Collector's Hour", desc: 'The Pale Collector stalks the arena' },
  { id: 'gilded', name: 'Gilded', desc: 'Double gold' },
  { id: 'elite', name: 'Champions', desc: 'Every wave brings extra elites' },
];
