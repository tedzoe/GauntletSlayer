# Slayer Edition class ability spec (provided by David, authoritative)

## Warrior -> Sir Theo. Base HP 100
- Light combo: 4 axe swings, no cooldown. Swings 1-3 do light damage in a narrow front arc. Swing 4 does medium damage in a 360-degree close radius that clears minor mobs.
- Furious Charge: dash forward that knocks back and tramples. Medium damage, 5s cooldown, narrow line. Instantly kills standard skeleton grunts.
- Leap Cleave: high-arcing overhead slam. Heavy damage, 3s cooldown, medium circular impact that applies hard hit-stun.
- Weapon unlock, Destructo-Spin: sustained 360 whirlwind. Heavy damage, ticks several times per second, 12s cooldown, large circle that follows the moving Warrior. Full i-frames while spinning.

## Valkyrie -> Dawnbringer Gela. Base HP 75
- Slash chain: 7 strikes, light damage, no cooldown, front cone. Strikes 4 and 7 stun elites.
- Spear Thrust: heavy damage, no cooldown, straight piercing line, high single-target damage. A shield tap cancels its recovery (from the earlier guide).
- Shield Block: held or toggled, front 90-degree arc. Deflects projectiles and cancels explosive trap damage. Lesser skeletons that walk into it are crushed instantly. After 10 blocks, the mastery unlocks reflect.
- Shield Throw: chains between enemies and comes back (from the earlier guides).
- Weapon unlock, Extreme Prejudice: big sweeping strike. Massive/execute damage, 9s cooldown, wide front semicircle with push-back.

## Wizard -> Sorceress Zoey. Base HP 50
- Basic shot (energy pulse): light damage, no cooldown, straight line. The only basic projectile that does NOT break floor food.
- Spell matrix (first element + second element):
  - Fire + Fire, Fireball: medium damage, no cooldown, small splash.
  - Fire + Ice, Teleport: medium damage, 6s cooldown, long linear move that leaves a burning trail.
  - Fire + Lightning, Fire Bomb: heavy damage, 4s cooldown, lobbed with a large splash.
  - Ice + Ice, Ice Beam: continuous light damage, no cooldown, ray that slows.
  - Ice + Fire, Cascade cone: medium damage, 5s cooldown, expanding cone that freezes.
  - Ice + Lightning, Slow Orb: no damage, 8s cooldown, large slow-moving bubble that slows everything inside.
  - Lightning + Lightning, Storm Barrier: continuous medium damage, 10s cooldown, ring around the caster that zaps skeletons.
  - Lightning + Ice, Chain Lightning: medium damage, 3s cooldown, jumps between nearby enemies.
  - Lightning + Fire, Arc Blast: medium damage, 2s cooldown, short-range knockback shockwave.

## Elf -> Ranger Isaac. Base HP 50
- Rapid Fire: light damage, no cooldown, straight line.
- Sniper Shot: heavy damage, 1.5s draw, pierces lesser enemies.
- Combat Roll / Vault: 1.5s cooldown, short i-frames.
- Bomb: delayed explosion. Sniper + bomb makes a bomb arrow. Can drop a bomb mid-roll (from the earlier guide).
- Weapon unlock, Mortar Shot: heavy damage, 6s cooldown, targeted ground circle with a medium-large radius, good against spawners.

## Necromancer -> Vesper Linda. Base HP 50
- Soul Reap: medium damage, no cooldown, wide front sweep. Each hit fills the soul essence bar.
- Raise Skeletons: minions that do sustained light damage, limited only by stored essence. They spawn around her, have collision, and act as decoys.
- Ghostwalk: 4s cooldown dash that makes her intangible, so she passes through enemies without taking damage.
- Weapon unlock, Summon Shades: heavy damage, uses the full essence bar, phantoms seek the nearest enemies.

## Highlord David
No Slayer counterpart. Use a hybrid built from these rules, and David must approve it.

# Endless Mode scaling (from David, authoritative)
- Enemy HP: +5% compound per floor through floor 50, capped at 3x base from floor 51 on.
- Enemy damage: +2% linear per floor, so 2x at floor 50.
- Wave tiers:
  - Floors 1-19: tier 1 grunts (skeletons, mummies, orcs).
  - Floors 20-39: tier 2 elites join (orc shaman, cultist sorcerer, shielded skeleton), and spawners get +50% HP.
  - Floor 40+: tier 3 minibosses (lich, demon) appear in normal waves, and spawner HP is capped at 2x base.

# Relics (from David, authoritative). Use original display names.
- Relics are powered by potions or cooldown shards (loose crystal shards).
- Ring of Mirrors (illusion clones that mirror your weapon attacks):
  - Rank I: 2 clones for 6s, 60s cooldown, costs 1 potion, clones spawn in a 2m cluster.
  - Rank III: 4 clones for 10s, 45s cooldown, can be recharged with shards, clones spread over 5m and draw enemy attention.
- Boots of Ranadam (speed):
  - Rank I: +30% speed for 4s, 40s cooldown.
  - Rank III: +50% speed for 7s, 25s cooldown, plus a 3m knockback-and-stun burst on activation.
- Golden Feather (shockwave that knocks back and slows):
  - Rank I: knocks back lesser enemies and slows them for 3s, 50s cooldown, 6m front cone.
  - Rank III: hard-stuns everything on screen plus a 6s slow, 35s cooldown, 360 degrees across the whole screen.
- Freeze Token:
  - Rank I: freezes for 4s, 45s cooldown, 3m line.
  - Rank III: freezes for 8s, 30s cooldown, 8m circle centered on the caster.
- Rank II for each: interpolate halfway between Rank I and Rank III.
- Distance scale: 1m = 32px (adjust to tile size if different and state it).

# Endless Mode extra rules (from David, AI search summary, treat as authoritative unless it clearly conflicts)
- No food from floor 37 on: health food stops spawning entirely, and drops and chests give gold instead of meat. Health only returns through abilities and talismans (for example the Warrior's 'The Prize'-style talisman).
- Co-op multiplier: enemy count rises a lot with each player added (2, 3, 4). In solo play, high-tier enemies (liches and similar) have lower HP.
- 18-floor loop: progress saves every 18 floors (1, 19, 37, 55...) through hub portals. Each 18-floor cycle is 6 Crypt floors, then 6 Cave floors, then 6 Lava floors.
- Death chase: an invulnerable Death-style hunter drops in on the last floor of each 6-floor group (6, 12, 18, 24...).
- Elements: auto-target attacks (wizard lightning, the Valkyrie's bouncing shield, mirror clones) also target and destroy food and potions. Some late units resist elements (an armored type is immune to elemental bonus effects), and a shadow wraith type is very weak to light damage, which fits Highlord David's holy attacks.

# Weapons, potions, elites, and stat matrix (from David, AI summary)
## Weapon variants (change the secondary ability)
- Warrior alternate weapon: Leap becomes a straight-line shockwave that leaves a fire trail.
- Valkyrie alternate: Shield Throw fires 3 smaller piercing shields in a front cone. CONFLICT: the earlier guide says 'Mark of the Commander' is a TALISMAN (potion-cost Summon Valkyries). Keep Summon Valkyries as a talisman AND add the 3-shield throw as a weapon variant.
- Wizard alternate (void school): shadow spells with heavy damage over time, plus the void vacuum from the earlier guide.
- Elf alternate: precision arrows root targets for 2.5s.
## Potions
- Using a potion casts the hero's equipped Talisman if one is equipped; otherwise it powers relics. Make this behavior clear in the loadout UI.
- Every potion use also sends out a 12m shockwave that briefly staggers enemies and resets their aggro.
- Using a potion gives food on the floor 0.5s of invulnerability (a low-priority detail, implement it if simple).
## Elites
- Lich lord: periodically casts a front shield that absorbs damage. The sniper shot and the fire bomb get through it.
- Orc shaman: drops a 1-HP totem that gives nearby enemies +40% move and attack speed.
- Cultist sorcerer: long teleport wind-up, then a tracking meteor on a player. Any melee hit during the wind-up cancels it and puts it on a 6s cooldown.
## Stat matrix
| Hero | HP | Speed | i-frames | Best mastery perk |
|---|---|---|---|---|
| Warrior/Theo | 100 | Slow | 3.5s during spin | -10% damage taken |
| Valkyrie/Gela | 75 | Medium | front shield continuous | perfect block explodes |
| Wizard/Zoey | 50 | Slow | 0.8s teleport dash | +15% potion range |
| Elf/Isaac | 50 | Hyper-fast | 0.4s roll | +10% run speed |
| Necro/Vesper | 50 | Fast | 2.0s ghostwalk | +25% essence per kill |
- Speed tiers: Slow 1.0, Medium 1.1, Fast 1.2, Hyper-fast 1.35 (relative values; state the numbers you pick). The Valkyrie also has a Shield Charge burst move.

# Frame data and scaling engine (from David, AI summary; NEWEST, overrides earlier speed tiers)
## Damage tiers
- T1 Light: clears grunts, minimal stagger.
- T2 Disrupt: hard recovery frames on medium enemies.
- T3 Heavy/Stun: cancels elite casts and resets attack tracking.
- T4 Execute: instant kill or big knockback.
- Assign a tier to every attack.
## Per hero (60fps frames)
- Warrior: speed 1.0. Spin i-frames 3.5s. The 4th swing has a 1.5m circle hitbox active for 24 frames. Furious Charge has armor that ignores T1/T2 hits (no stagger).
- Valkyrie: speed 1.25. Perfect block: raising the shield just before a hit gives no stamina drain and reflects the projectile at 150% damage. The shield has stamina; a Demon Brute charge breaks a normal block. Spear thrust has a 12-frame wind-up and a 4-frame lunge hitbox.
- Wizard: speed 0.95. The next element input can be buffered during spell recovery. Teleport gives 48 i-frames, then 6 vulnerable frames at the end.
- Elf: speed 1.50. Sniper is fully charged at 90 frames, and a full charge pierces infinitely until a wall. A roll cancels Rapid Fire recovery.
- Necro: speed 1.35. Essence bar max 100: +5 per grunt kill, +25 per elite kill, a skeleton raise costs 20. Skeletons draw enemy aggro over players unless a player deals T3 damage to that enemy.
## Potions (combine with the earlier rules)
- Using one freezes standard monster AI across the screen for 1.5s (as well as the 12m stagger).
- Each potion held at the level exit gives +500 gold on the end-of-floor screen.
- A potion explosion that hits a spawner stops it spawning for 4s.
## Endless table (CONFLICTS with the earlier per-floor formula; awaiting David's pick, default to this table)
| Floors | HP | Damage | Elite rate | Modifier |
|---|---|---|---|---|
| 1-10 | 1.0 | 1.0 | 5% | basic traps |
| 11-25 | 1.5 | 1.3 | 20% | enemies +15% speed |
| 26-36 | 2.2 | 1.7 | 45% | trap damage x2 |
| 37+ | 3.0 | 2.0 | 75% | no food, gold -25% |
| 50+ | 3.0 | 2.5 | 100% | all spawners spawn elites |
## Elites
- Lich: barrier every 12s. While it's up the lich is immune to status effects and reflects T1 projectiles (the sniper shot and fire bomb get through).
- Demon Brute: a charge that breaks a normal shield block.
- Cultist conjurer: every 20s, unless interrupted by a T3 hit, summons 6 shielded skeletons onto a player.
## Talisman reference
- The Warrior talisman (Prize-like) spawns food when a potion is used. That matters after the floor-37 food cutoff.
- The Wizard talisman (Bookmark-like) does a screen-wide blast.

# FINAL endless ruling (David, latest; overrides the table)
- ENDLESS_SCALING = 'formula'. HP = base * 1.05^(floor-1), capped at 3.5x. NOTE: compounding reaches 3.5x around floor 27, so the cap takes effect there even though the source says scaling stops 'after floor 50'; the math wins. Damage = base * (1 + 0.02*(floor-1)), uncapped, about 2x at floor 50.
- Floor bands affect ONLY wave composition and traps: tier 2 elites from floor 20, minibosses from 40, food removed from 37, plus the earlier table's elite rates and trap modifiers (traps x2 from floor 26, gold -25% from 37, all elite spawners from 50) for composition only.

# More mechanics (David, latest)
- Damage-immunity bubble (a mastery unlock from the damage-taken masteries): after 20s without taking damage, a bubble forms that fully blocks the next hit from any source, then pops and restarts its timer. It does not stop you dropping the crown.
- Crown: one per floor. Whoever holds it gets x2 on gold they pick up. Any hit, including T1, knocks it out. It floats for 5s, then disappears if nobody grabs it. Holding it at floor end also gives the earlier end-of-floor loot bonus.
- Skull coins: shared party respawn tokens that appear on podiums at fixed floor intervals in endless. Carry cap is 5 solo, 5 per player in co-op (20 with 4 players).
- Elf: the normal bomb has a 40% bigger radius than the bomb shot.
- Wizard basic shot never destroys food; every other hero's projectiles and slashes do.
- Co-op: one hero per player. A hero already locked in by another player can't be picked on the select screen (show it as taken).
- Skeleton instant kills: Warrior charge, a Valkyrie shield block when a skeleton swings into it, and the wizard Storm Barrier (lightning + lightning) on contact.

# Latest (David): HP, relic costs, traps
- Health cap confirmed: HP x1.05 per floor, capped at 3.5x (around floor 27). Damage +2%/floor, capped at 2.0x around floor 50.
- Internal HP: Warrior 200, Valkyrie 150, Wizard/Elf/Necro 100. The UI still shows the earlier 100/75/50 proportions as a bar. Scale all enemy damage so the earlier balance holds.
- Low health: below 25% the hero flashes red and gets +15% speed for 0.5s (once each time they drop below the threshold).
- Relic prices: Rank I 4000, Rank II 12000 (about 15-20% less cooldown), Rank III 32000 (about 30-40% less cooldown, shard recharge). Total 48000 per relic. Gold is per hero.
- Trap damage per tick: 20 on floors 1-19, 40 on 20-36, 80 from 37 on.

# Latest (David): crown, stun break, necro and wizard extras, spawners
- Crown holder: -10% move speed, and enemies within 10m switch to the crown holder.
- Stun break (all heroes): taking 3 T1/T2 stagger hits within 1.5s gives 0.5s of stun immunity plus a 1m knockback pulse.
- Necro alternate weapon: pressing summon while skeletons are active makes them all charge the nearest enemies and explode (T3 heavy, 3m radius). Soul Reap is a 140-degree front arc, and every enemy it hits adds essence.
- Wizard teleport: the start point gets a 1m medium fire blast that sets off barrels (and hurts allies standing near a barrel). An element pressed during the 6-frame end recovery is buffered and fires a basic shot as soon as recovery ends.
- Spawners: tier 1 takes 3 standard hits, tier 2 takes 6, tier 3 takes 12. T3/T4 abilities do 3x structure damage (e.g. 4 mortar hits on a tier 3). CONFLICT: the earlier guide said the Elf's light arrows don't damage spawners. Default: they DO count as standard hits (per this latest source), behind the flag ELF_LIGHT_ARROWS_HIT_SPAWNERS=true.

# Latest (David): shards, weapon alternates, object weights
- Elf light arrows hit spawners as standard hits (confirmed). Also add the setting 'Bomb Siege' (off by default): when it's on, spawners ignore light projectiles and only take explosives and heavy hits. Put it in Options/Gameplay.
- Rank III shard meter, 100 units: a small shard gives +10, a large cache +25, and a potion fully refills it. Cost per cast: Mirrors and Freeze 50, Boots and Feather 35. Shards come from chests, jars, and elites.
- Valkyrie alternate weapon (intercept spear): a well-timed spear poke knocks a projectile away in a random direction. No stamina cost, usable while moving.
- Elf alternate weapon (sparks): replaces the mortar with a hidden proximity mine. 1m trigger radius, T2 medium damage, 3s root. Enemies that spawn inside the root field are rooted at the spawn point.
- Object weights: T1 objects (barrels, jars) break from any hit, and a charge or roll goes through them. T2 objects (iron chests, stone slabs) stop dashes; the Warrior's charge into one cancels with 10 frames of hit-stun, and they need T3 hits to break.
- Ghost food is a lag BUG: do NOT replicate it.

# Latest (David): gold, shatter, Death, underdog, solo revive
- Gold magnet: gold within 1.2m is pulled to the hero. Gold launched from chests or barrels can't be picked up for its first 15 frames.
- Shatter: a frozen enemy hit by T3/T4 takes x2 damage. If that kills it, it bursts and lightly staggers minor enemies within 1m.
- Death hunter: immune to everything, but a potion used next to it causes a 3s recovery, and it then picks a new target.
- Underdog (co-op): if a player's gold is more than 40% below the leader's, gold dropped by mobs (not chests or crown) gives that player +15% until they are within 20% of the leader.
- Solo skull-coin revive: on respawn, a map-wide shockwave knocks down minor enemies and pushes elites away from the spawn point, plus normal revive i-frames.

# Latest (David): crown delay, recoil, spear cap, spawner cleanup
- Crown drop: the -10% speed stays for 45 frames after the crown is knocked out.
- Elf full-charge sniper: 0.2m recoil opposite to the aim direction (it can push you into hazards).
- Valkyrie intercept spear: at most 6 projectiles destroyed per 30 frames; any beyond that hit normally.
- Endless floor 70+: every 60s, an off-screen spawner that has been blocked from spawning for 3 or more cycles loses 25% of its health.

# Latest (David): tile cap, ice orb cap, mastery cap
- Endless floors use at most 12 room tiles. Past floor 50 the map doesn't grow; tiles pack tighter, with narrower paths between spawners.
- Wizard Ice + Lightning slow orb: slows at most 30 enemies; any beyond that, by entry order, move at full speed.
- Mastery stat cap: total passive mastery bonus per stat is capped at +25%. Relic buffs (e.g. Boots +50%) are NOT clipped by this cap, since clipping them would break the relic spec. Note this in the report.
- Online relic-loadout desync bug: do NOT replicate it.

# FINAL resolutions (David)
- HP: the engine uses 200/150/100, and the UI bar shows 100/75/50 proportions.
- The +25% mastery cap applies ONLY to stat multipliers (move speed, damage mitigation). The 50k-kill +25% damage is its own separate multiplier, not capped. Relic buffs are also not capped.
- Speeds: Warrior 1.0, Wizard 0.95, Valkyrie 1.25, Necro 1.35, Elf 1.50. Highlord David: 0.95-1.0, as the bulkiest hero; pick 0.95 and state it.
- Optimizations, approved by default:
  1) Put every number in one tuning file (tuning.js) that all systems read.
  2) A Gameplay options toggle for each unverified AI-summary rule (all default ON): spawner cleanup, 12-tile cap, spear projectile cap, ice orb cap, potion food i-frames, underdog gold, crown lingering slowdown, solo revive shockwave. Also Bomb Siege (default OFF) and a gold multiplier (default 1x).
  3) A hidden debug overlay (F3 or backtick) showing damage numbers, cooldowns, floor scaling, and essence/shard meters.

# David confirmations
- Potion carry cap: 5 per hero. Extra potions stay on the floor (don't auto-pick them up past 5). Potion strength stays as specced.
- Floor 37 rules (no food, 80 trap damage, Death) are confirmed as correct.
- Death contact is lethal: touching Death drains HP extremely fast (effectively a down within about 1s, ignoring armor and the bubble). It's invulnerable; only potions stagger it.

# Highlord David: PALADIN kit (David: he's a paladin, needs paladin moves). Replaces the Warrior/Valkyrie hybrid.
HP 200 (bar shows 100), speed 0.95, all attacks light-element, same button layout as the other heroes.
- Light: Crusader combo, 3 greatsword swings (T1, T1, then a T2 radiant arc finisher).
- Heavy: Judgment, a charged overhead (T3) that stuns. Hold to charge.
- Block: Holy Bulwark, a front shield block that reflects missiles (uses the Valkyrie stamina and perfect-block rules).
- Dash: Righteous Advance, a short armored charge (T1/T2 hits can't stagger it), 5s cooldown.
- Signature: Consecration, a holy ground circle (3m, 5s) that does T1 ticks to enemies and heals allies inside for 2 HP per tick. 12s cooldown.
- Passive: Devotion Aura, allies within 4m take 10% less damage (it's an aura, so the mastery cap doesn't apply).
- Weapon unlock (default): Holy Slam, a pillar of light (T3, medium radius, 9s).
- Alternate weapon: Hammer of Light, a thrown hammer that returns (T2, pierces, 6s).
- Talisman (potion), default: Golden Wings, 4s of flight and invulnerability plus a radiant burst on landing (T4, large radius).
- Alternate talisman: Lay on Hands, which fully heals self and allies within 6m and instantly revives a downed ally in range (without using a skull coin).

# The four 'zero damage' moves are utility by design (David)
- Valkyrie Extreme Prejudice: the swing does 0 damage, applies a big knockback in the front semicircle, and an enemy knocked into a wall takes T4 crush damage.
- Warrior talisman (Prize-like): 0 damage; spawns food around the team (works even after the floor-37 cutoff).
- Valkyrie talisman alternate (aegis): 0 damage; a stationary field that blocks projectiles and melee and heals allies over time. KEEP Summon Valkyries as Gela's default talisman (from the earlier guide); the aegis is an alternate.
- Necro talisman (dream-catcher-like): 0 burst damage; leaves a mist that makes enemies flee (fear) and deals low damage over time.
- Zoey's nova potion: check what it's meant to do; it should be the wizard's arcane-blast-style talisman, which DOES damage (screen blast).
- Tests should check the utility effects (knockback distance, wall crush, food spawned, fear applied, DoT ticking, field blocking), not upfront damage.

# Weapon shop lineup (David, authoritative). Bought with gold per hero; the equipped weapon swaps the hero's signature ability. Original display names in game.
## Warrior / Theo
- Default: Destructo-Spin. Heavy, multi-tick, 12s, large circle that moves with him, 3.5s i-frames.
- Alt 1: Thrown Axe. Medium, 5s, mid-range straight projectile.
- Alt 2: Turbo-Slam. Heavy plus hard stun, 7s, 90-degree front cone shockwave that cancels elite wind-ups.
- Alt 3: Demonic Cleave. T2 plus fire damage over time, 8s, long straight shockwave that leaves a fire path.
## Valkyrie / Gela
- Default: Extreme Prejudice. 0 damage, wall crush T4, 9s, wide front semicircle knockback.
- Alt 1: Shield Splitter. Medium, 6s, 3 piercing shields in a cone.
- Alt 2: Deflecting Thrust. Light, no cooldown, replaces her thrust; breaks up to 6 projectiles per 0.5s, no stamina cost.
- Alt 3: Shield Ricochet. Medium plus stun, 8s, bounces between up to 4 enemies and staggers each.
## Wizard / Zoey (each weapon reworks the whole 9-spell school)
- Default: the standard elemental school (already specced).
- Alt 1: Void school. All spells become lingering shadow or gravity fields that deal heavy damage over time; cooldowns are evened out.
- Alt 2: Pyromancy school. All combos become explosive splashes with bigger bursts and spawner damage, but longer cooldowns (+30%).
## Elf / Isaac
- Default: Mortar Shot. Heavy, 6s, targeted ground circle, 3x damage to spawners.
- Alt 1: Rooting Shot. Medium, 5s, piercing line, 2.5s root.
- Alt 2: Sparks mine. T2, 8s, 1m trigger, 3s snare zone.
- Alt 3: Smoke Bomb. 0 damage, 7s, 2m cloud; enemies lose track of him and he is invisible for 2s.
## Necromancer / Vesper
- Default: Raise Skeletons. 20 essence each, minions draw aggro.
- Alt 1: Summon Shades. Uses all 100 essence; heavy damage; shades target the highest-HP elites first.
- Alt 2: Sacrificial Detonation. 10 essence; all minions charge and explode, T3, 3m.
## Paladin / Highlord David (our own design, same structure, light element)
- Default: Holy Slam. T3, 9s, pillar of light in a medium radius.
- Alt 1: Hammer of Light. T2, 6s, thrown hammer that pierces and comes back.
- Alt 2: Radiant Lance. T3, 7s, a straight beam of light that pierces and does x2 damage to shadow and undead enemies.
- Alt 3: Sanctuary Pulse. T1, 10s, a 4m ring that knocks enemies back and gives allies inside a 3s damage shield (absorbs 30 internal HP).
## Pricing (none was given; propose): alternate weapons cost 6000 / 12000 / 20000 gold each. Put these in tuning.js and flag them in the report as estimates.

# Weapon precise numbers (David, authoritative; overrides the lineup above where they differ)
- Destructo-Spin: T3 multi-tick, 2.0m circle that follows him, 210 frames (3.5s) of full i-frames, 12s.
- Thrown Axe: T2, 5s, straight projectile with no AoE. It replaces the spin.
- Turbo-Slam: T3 plus hard stun, 7s, 90-degree cone out to 3.0m. Armor level 4 override: it resets elite Lich/Shaman wind-ups.
- Demonic Cleave: T2 impact, 8s, a 1.0m x 6.0m line. Leaves a fire surface for 4.0s that ticks T1 and applies a burning DoT.
- Extreme Prejudice: 0 direct damage, 9s, 180-degree arc with 2.5m radius, high-velocity knockback. Wall crush = T4 plus a 2.0s hard stun.
- Shield Splitter: T2 per shield, 6s, 3 piercing shields in a 45-degree fan.
- Deflecting Thrust: T1, replaces the basic thrust, narrow line, breaks at most 6 missiles per 30 frames.
- Shield Ricochet: T2 plus a brief interrupt, 8s, up to 4 targets, 4.0m maximum hop range.
- Spellweaver: base matrix T1-T3, cooldowns 0-10s. Add a SPELL QUEUE BUFFER: the next combo can be entered during the current spell's recovery.
- Hollow Chapters: all 9 spells become persistent T2 DoT shadow/gravity zones, with even cooldowns.
- Firebound Tomes: T3 explosive circle splashes at the target point, +20% cooldown (replaces the +30% above), boosted spawner damage.
- Mortar Shot: T3, 6s, 3.0m target circle, x3 hit count on spawners (a T3 spawner with 12 hits dies in 4 mortars).
- Rooting Shot: T2, 5s, long thin piercing line, 150 frames (2.5s) hard root.
- Sparks trap: T2, 8s, 1.0m trigger, 3s group snare.
- Smoke Bomb: 0 damage, 7s, 2.0m cloud at the cast spot, aggro wipe, 2.0s full invisibility.
- Raise Skeletons: T1 per swing, 20 essence, no cooldown, spawn on caster, aggro aura (enemies prefer skeletons).
- Summon Shades: T3, uses the full 100 essence, ignores trash, locks onto the highest-HP elite.
- Sacrificial Detonation: T3, 10 essence, no cooldown, all skeletons rush forward and explode in a 3.0m radius centered on each skeleton.

# Gear pricing (David, authoritative)
- Every alternate weapon costs a flat 15000 gold, the same for every hero, Highlord David included. There are no ranks or upgrades; the weapon is complete once bought. This replaces the 6000/12000/20000 estimates above. The default weapon is free.
- Relics: 4000 + 12000 + 32000 = 48000 per relic. This confirms the existing numbers.
- Cosmetic armor, headgear, and capes cost about 5000 to 100000 gold each in the original. Those are reserved for later, since we use our own art; implement them only if David asks.
- Crown bonus: holding the crown when you cross a floor exit grants +500 gold.
- Gold is banked only when you cross a gate or exit. Gold picked up on a floor is lost if you quit or die before the exit. (Confirm this matches the current implementation.)

# Enemy art reference (David, inspiration only; art/enemy-reference/)
- Sheets: skeleton (sword/spear/archer/shield guard/robed/elite, plus rise-from-ground summon), goblin (grunt/spearman/archer/shaman/brute/scout), mummy, a 9-boss sheet, and an 8-biome roster.
- These map onto the Slayer loop as follows. Crypt floors use the skeleton sheet and the crypt row; the Lich is the elite caster. Cave floors use goblins (archers, shamans as elite casters, brutes and orc warriors as elites) plus cave spiders. Lava floors use the volcanic row (imps, hell hounds, demon brutes). Death Incarnate or the Death Knight is the look for Death.
- Boss candidates: Lich Lord (crypt), Cave Behemoth (cave), Demon Lord (lava).
- Forest, swamp, desert/mummy, frozen, and dark fortress are extra biomes beyond Slayer. Park them as a possible later twist for David; they are not part of the faithful build.
- Use these only after the weapons and paladin work, as the style target for redrawing the enemy sprites in the same pixel style as the heroes.

# Enemy roster (from gauntlet-archive wiki, Enemies page). Copy the ROLES only; display names stay original.
## Crypt floors: Risen / Monstrous / Corrupted / Bloated Mummy; Skeleton Soldier / Defender (sword and shield) / Commander; Ghost; Necromancer (enemy caster); Lich (mini-boss); Mummy King (boss).
## Cave floors: Savage Orc; Orc Juggernaut; Grunt Scavenger; Grunt Shaman; Spider Spawn; Spider Warrior; Lake Dweller; Spider Queen (mini-boss); Beast boss.
## Lava/temple floors: Cultist Novice / Zealot / Sorcerer; Demon Fiend; Demon Imp; Demon Horror (mini-boss); Morak (boss); a sentient sword boss.
## Everywhere: Death Incarnate (Death).
- Notes: Skeletal Archers were removed in Slayer because they are now the Necromancer's summons. Enemy archers should not be a regular spawn type.
- Art mapping from art/enemy-reference: Mummies use the mummy sheet (crypt floors, not a separate desert biome). Skeleton Soldier/Defender/Commander use the skeleton sheet's sword, shield guard, and elite. Ghost and Necromancer/Lich use the crypt row. Orcs use the orc grunt and warrior. Grunts use the goblin sheet (scavenger = grunt, shaman = shaman). Spiders use the cave spider and giant spider. Cultists and imps use the volcanic row. Demon Fiend uses the demon brute. The Mummy King, Beast, and Morak boss looks come from Tomb Pharaoh, Cave Behemoth, and Demon Lord. Death uses Death Incarnate.
- David approved: build our own version of EVERY enemy role that's missing (original names and art in the hero pixel style, with the reference sheets as the style guide), each matching the original's role and behavior (melee, tank, caster, summoner, ghost, explode-on-death, mini-boss, boss).

# Extra areas (David's twist, approved to build 2026-10-25)
- Five new areas from the biome_roster and bosses sheets: Forest (beasts), Swamp (poison), Desert/Ruins (cursed sand), Frozen Wastes (ice undead), Dark Fortress (endgame).
- These go behind an Options/Gameplay toggle "Extended Realms", default OFF. With it OFF the game is the faithful 3-theme Slayer loop and must stay unchanged.
- Each area has 6 floors, the same as the others, with its own tile set, enemy roster (grunt, fast swarmer, tank, ranged or caster elite, special), a mini-boss, and a boss, all with original names. Bosses: Forest Ancient, Plague Abomination, Tomb Pharaoh (desert), Frost Titan, Death Knight. Mini-bosses: Pharaoh, Bone Knight, Succubus, and so on from the roster sheet.
- With the toggle ON, the endless loop becomes 8 areas x 6 = 48 floors. Death and the scaling rules are unchanged, and the save floors become 1, 49, 97 and so on.

# David's deliberate deviations (Oct 2026). These override the Slayer Edition rules above.
Every number lives in `DEV` in tuning.js. tests/devtest.js checks all of it.

0. **Name.** The game is now called **Gauntlet Slayer**: the page title, the title-screen logo (GAUNTLET / S L A Y E R) and the README.
1. **Dash for every hero.** Every hero dashes on one button:
   - Keyboard 1: F or middle mouse.
   - Keyboard 2: Numpad6 or Comma.
   - Gamepad: LT or L3. LT no longer doubles as Defend; Defend is RT or R3.

   Each hero's dash is their existing Slayer mobility move, and it shares that move's cooldown key, so the original button still works:

   | Hero | Dash move | Cooldown |
   |---|---|---|
   | Theo | Furious Charge | 5s |
   | Gela | Shield Charge (no longer needs the shield up) | 2s |
   | Isaac | Combat Roll | 1.5s |
   | Zoey | Blink (new): 150 px, 0.22s i-frames | 3s |
   | Vesper | Ghostwalk | 4s |
   | David | Righteous Advance (no longer needs the shield up) | 5s |

   The dash goes in the steered direction, or the facing direction when standing still.
2. **Cooldown HUD.** The original shows one big ability icon. Each player panel now has a move bar instead: main, secondary, special, dash, extra abilities (Gela Bash, David Consecration), relic, and potions.
   - **Cooling:** a radial sweep with a seconds countdown.
   - **Unavailable:** greyed out (no essence, no potion, shield thrown).
   - **Ready:** lit, with a 0.45s flash on becoming ready.
   - **In use:** a pulsing ring.
3. **Pets, clones and summons attack any hostile in reach, spawners and generators included.** The nearest target wins. This covers Vesper's minions, Mirror clones, valkyries, sprites, the gargoyle and shades.
4. **Enemy missiles are slowed for every foe and boss.**
   - Speed = original × 0.65, capped at 1.5 × the slowest hero (200 px/s). Life is stretched so range is unchanged, and homing turn rates scale with speed.
   - Boss shockwave rings use the same cap. Enemy lobs take at least reaction time + the time to walk out of the circle.
   - Dodge budget: reaction 0.35s + sidestep 24 px / 133 px/s = 0.53s. A capped missile needs 0.80s to cross 160 px.
5. **Ground enemies never move faster than 90% of the slowest hero (0.9 × 133 = 120 px/s).**
   - Applied at the movement step, after every multiplier (Endless ×1.15, totem haste, frenzy, lurker dive, boss rage), in every realm.
   - Charges are capped too. Charger runs last 1.1s and boss charges 1.2s, and the boss charge telegraph is shortened to match.
   - Grave Wisps (wraith), Shiver Sprites and Glimmerwisps keep their speed. Hollowfang (hovering sword) keeps its drift. Death is capped like everyone else.
6. **Damage order: main < secondary < special, per hit and per activation.** Main attacks are unchanged.

   | Hero | Main (per hit) | Secondary before → after | Special before → after |
   |---|---|---|---|
   | Theo | 10 / 18 finisher | Leap 32 → 32 | Spin 10.7 × 17 ticks (182) → 38 × 11 ticks at 3/s (418) |
   | Gela | 10 | Thrust 32 → 32 | Extreme Prejudice 0 → 40 hit (wall crush T4 kept) |
   | David | 10 / 18 finisher | Judgment 24-32 → 24-32 | Holy Slam 32 → 42 |
   | Isaac | 10 per arrow | Power Shot 10-32 → 14-34 | Mortar 32 → 44; bomb / explosive arrow 32 → 44 |
   | Zoey | Cinder Bolt 18 | Serpents 18/12 → 26/24, Thunderclap 12 → 26, Arc Chain 13 → 24 | Magma Mortar 30 → 46 |
   | Vesper | Soul Reap 18 | Bone Spikes 30 → 30 | Raise Skeletons: no hit → 40 grave burst where each minion rises (once per foe per cast) |

   Alternate weapon signatures are unchanged.
