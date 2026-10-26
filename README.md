# Gauntlet Slayer

An original browser action-dungeon crawler that plays like a modern twin-stick "slayer" dungeon game:
six distinct heroes, combo/charge abilities, potion abilities, relics, weapon swaps, masteries,
three themed worlds with bosses, a final area, Endless mode, a daily arena, and 2–4 player local co-op.

All six heroes use sprite sets made from David's approved concept art (portraits on the select screen and HUD,
animated strips in play). Foes, levels and effects are drawn procedurally in code (Vesper Linda's raised dead use
sprites cut from her minion sheet); audio is WebAudio synthesis. No libraries, no build step needed to play.

## Run
```
cd crypt-game && python3 -m http.server 8765   # then open http://localhost:8765/
```
Serving over http is the recommended way. Double-clicking `index.html` (file://) also works, because the hero
images are embedded as data URIs in the generated `assets.js` (~1.9 MB). If you delete `assets.js`, the game
must be served over http (browsers block loading the manifest/PNGs from file://); without the art it falls back
to procedural drawings.

## Heroes
Display names live in one constant, `HERO_NAMES` in `data.js` (format "Title Name"); change a name there and the
select screen, HUD, shrine and control notes all follow. Internal ids (`brannoc`, `sela`, …) are kept so old saves load.

| Hero (id) | Role | Size | Primary | Secondary | Defend | Ability (weapon) | Potion (talisman) |
|---|---|---|---|---|---|---|---|
| **Sir Theo** (`brannoc`) | Melee spinner, polearm | 1.25× | 3-hit Cleave | Overhead Smash | Rush (then Primary = Rush Strike, Secondary = Leap Slam) | Whirlwind (hold, steer) · Earthsplitter · Hatchet Hurl | Flask grenade · Titan's Draught |
| **Dawnbringer Gela** (`sela`) | Norse valkyrie, spear + shield | 1.05× | Spear thrusts (Shield Bash while blocking) | Lance Lunge (hold to charge) | Wind Block: swirling wind barrier reflects missiles | Shield Throw · Spear of Storms (lightning spear that pins/roots the first foe, arcs to 2 more) · Intercept · Thunderstrike | Valkyrie's Call (raven-feather wings: revive + heal allies, +30% damage) · Shieldwall Oath |
| **Ranger Isaac** (`kestrel`) | Archer | 0.8× | Rapid Quick Shots | Power Shot (charged, piercing) | Dodge Roll | Magic Bomb · Root Field · Smoke Bomb | Heartpiercer · Grove Sprites |
| **Sorceress Zoey** (`mirelle`) | Rune caster | 1.0× (glides) | Cast the primed spell | Storm rune | Rime rune | Ember rune | Arcane Nova · Bastion Bubble |
| **Vesper Linda** (`vesper`) | Necromancer | 1.0× | Soul Bolt | Bone Spikes (hold to aim; eruption roots foes) | Ghostwalk / Dark Rift (phase through foes, harvest souls) | Raise Dead · Raise Wardens · Wraith Lantern (costs souls; hold with 10 souls = Bone Golem) · Life Drain (Hungering Skull) | Death Nova · Rekindle |
| **Highlord David** (`paladin`) | Holy juggernaut, greatsword + shield | 1.35× | 3-hit greatsword combo | Heavy Overhead | Shield Block (golden barrier reflects missiles) | Holy Slam (pillar of light + shockwave) · Lionheart (Slam heals) | Golden Wings (4 s invulnerable, heals allies, burns foes) · Rallying Light |

**Vesper Linda's dead.** Souls (max 10, shown as violet pips in her HUD) come from kills near her, Ghostwalk and Life Drain.
Ossuary Staff raises a skeleton warrior (sword + shield), spearman, archer in turn (3 souls, max 5 minions). Marrow Reliquary
raises a skeleton guard (tanky, taunts nearby foes) or a bone mage (violet soul bolts). Wraith Lantern looses two flying wraiths
that chill foes (2 souls). Holding Ability with a full 10 souls raises a Bone Golem (one at a time, heavy slams).
Death Nova blasts everything around her with soul-fire and refunds souls.

**Zoey's 9 spells.** The first rune picks the school and the second picks the spell:
- Ember + Ember / Rime / Storm = Cinder Bolt / Twin Serpents (fiery dash) / Magma Mortar
- Rime + Ember / Rime / Storm = Flash Freeze / Frost Ray (channel) / Winter Orb
- Storm + Ember / Rime / Storm = Thunderclap / Arc Chain / Static Ward

Alternate books replace one school: the Hollow Grimoire turns Storm into Void (Undertow, Gloom Torrent, Veil), and the Ashen Codex turns Rime into Infernal (Scorch, Hellbreath, Pyre Orb).

**Relics** (one slot, cooldown, 3 ranks): Quickstep Anklets, Squall Charm, Gilded Quill, Emberstride Boots, Hoarfrost Ring, Gargoyle Idol, Riftmark, Shade Orb, Lure Lyre, Twin Mirror.

**Masteries** are lifetime per-hero feats that grant stat bonuses: kills, spawners, food eaten, gold, food smashed, deaths, bosses, signature move, Endless floors and arena waves.

## Structure and modes
- **Wayfarer's Rest (camp hub):** walk up to a station to use it.
  - World portals, Endless, Daily Arena.
  - Peddler (shop), Armory (loadout), Mastery Tablet, Hero Shrine, Options.
  - Extra players can drop in here.
- **World I, The Sunken Necropolis:** The Bonewalk, then The Reaper's Labyrinth (an invulnerable Reaper hunts you through a generated maze), then Charnel Court (arena waves), then Throne of Ribs (boss: the Ossuary King).
- **World II, Gloomroot Caverns:** Rootfall Hollow, then The Lightless Burrows (darkness), then The Gnawing Pit (arena), then Maw of the Deep Root (boss: Rootmaw, which burrows).
- **World III, Ember Foundry:** Slag Gate, then The Cinderfall Run (falling meteors), then The Crucible (arena), then The Great Anvil (boss: Forgemaster Vael).
- **The Hollow Throne (final area, unlocked after all 3 worlds):** Antechamber of Echoes, then Hollowfang, the Sovereign Blade (a cursed sentient greatsword). It is shielded by crystal pylons and summons the Pale Collector in phase 2.
- **Endless Descent:** generated floors cycle through Necropolis, Caverns and Foundry every 6 depths.
  - A Reaper stalks every 6th depth, and dark floors appear.
  - A checkpoint is saved every 18 depths. Depths 19+ are Hard and 37+ are Brutal, with more gold.
- **Daily Arena (The Proving Pit):** 6 waves with 2 modifiers seeded by the date (Glass Cannons, Famine, Frenzy, Volatile, Reaper's Hour, Gilded, Elite Guard).
- **Shared rules:**
  - Gold is a shared party purse. A hero who dies drops 20% of it, and reviving costs gold (the price rises with each death).
  - Gold is secured when a floor is cleared and banked at camp, where it buys weapons, talismans and relic ranks.
  - Spawners, keys (max 5) and locked gates, destructible food and potions, legendary chests, spike traps and pits.
  - Optional health drain (Options).
  - Hit-stop, screen shake, knockback and particles throughout.
- Progress is saved in `localStorage` under the key `delvebound_slayers_v2`.

## Enemies
Mini-bosses get the big health bar at the top of the screen when you're near them (or once they're hurt). Each area's mini-boss appears in wave 3 of its arena floor in the campaign, and on the 5th floor of each 6-floor group in Endless (5, 11, 17, 23, ...).

### Crypt (floors 1-6)
Original names, Slayer roles. Stats live in `tuning.js` (`FOE_STATS`, `FOE_PATCH`, `CRYPT`); sprites in `assets/heroes/foes/` (built by `spritework/build_foes.py`).

| Ours | Role | Behaviour |
|---|---|---|
| Linen Husk | Risen Mummy | slow melee grunt |
| Barrow Brute | Monstrous Mummy | slow, heavy, cleaving tank |
| Blightwrapped | Corrupted Mummy | melee; leaves a poison pool when killed |
| Swollen Embalmed | Bloated Mummy | bursts on death, hurting everything nearby |
| Grave Sentry | Skeleton Soldier | fast melee grunt |
| Crypt Warden | Skeleton Defender | sword and shield; frontal hits do 15% unless heavy (guard break) |
| Bone Marshal | Skeleton Commander (elite) | hastes nearby skeletons, calls two more every 9s |
| Grave Wisp | Ghost | floats through walls, dives into heroes |
| Bone Hexer | Necromancer (elite caster) | homing bolts, raises skeletons, blinks away |
| Vharos, the Frost-Crowned | Lich (mini-boss) | freezing bolts, front barrier, telegraphed frost nova, summons wardens. Charnel Court wave 3; endless floor 5 of each crypt cycle |
| The Ossuary King | Mummy King (crypt boss) | Throne of Ribs |

Skeletal archers are no longer a regular spawn (they are Vesper's summons).

### Caves (floors 7-12)
| Ours | Slayer role | Behaviour |
|---|---|---|
| Gloomtusk Raider | Savage Orc | sturdy melee grunt |
| Gloomtusk Shieldwall | armored orc | frontal shield; immune to elemental effects |
| Gloomtusk Juggernaut | Orc Juggernaut (elite) | winds up and charges, shoves its own allies aside |
| Burrow Scrounger | Grunt Scavenger | fast, weak swarm melee |
| Burrow Hexdrummer | Grunt Shaman (elite) | spells; drops a 1-HP totem giving nearby foes +40% speed |
| Skitterling | Spider Spawn | tiny, fast swarm |
| Fangback Stalker | Spider Warrior | pounces from range |
| Mire Lurker | Lake Dweller | untouchable while submerged; surfaces near you and spits a 3-shot slowing fan |
| Vexmother, the Web Queen | Spider Queen (mini-boss) | webs, spawns Skitterlings, telegraphed web burst that slows |
| Rootmaw, the Deep Hunger | Beast (cave boss) | burrows and surfaces; Cave Behemoth look |

### Lava temple (floors 13-18)
| Ours | Slayer role | Behaviour |
|---|---|---|
| Ashbound Initiate | Cultist Novice | weak, fast melee |
| Ashbound Zealot | Cultist Zealot | flaming-blade melee |
| Cinder Acolyte | fire cultist | fireballs that leave burning pools |
| Ashbound Hierophant | Cultist Sorcerer (elite) | long teleport wind-up then a tracking meteor; a melee hit cancels it |
| Cinder Imp | Demon Imp | flying fireball skirmisher |
| Brimstone Fiend | Demon Fiend (elite) | heavy cleaving brute |
| The Maw Below | Demon Horror (mini-boss) | cleaves, telegraphed fire nova that leaves fire, summons imps |
| Forgemaster Vael | demon-lord boss | Demon Lord look |
| Hollowfang, the Sovereign Blade | sentient sword (final boss) | floating cursed greatsword |

Legacy units no longer in the rotation: Grave Bowman, Cave Hurler, Ember Thrall.

## Extended Realms (optional, default OFF)

Five extra areas that go beyond the faithful game. Turn them on in **Options → Gameplay rules → Extended Realms**.

- **OFF (default):** nothing changes. The endless loop is 18 floors (crypt, caves, lava), with save floors 1, 19, 37…
- **ON:** the endless loop is 48 floors. After lava (floors 13-18) it continues through Forest, Swamp, Desert/Ruins, Frozen Wastes and Dark Fortress, then wraps back to the crypt on floor 49. Save floors are 1, 49, 97… Floors 1-18 play exactly as with the toggle OFF. Death and difficulty scaling are unchanged, and Death still hunts every 6th floor.
- Each area has its own tile set and decor, plus a roster with a grunt, a fast swarmer, a tank, a ranged or caster elite and a special.
- Each area boss appears on that area's 3rd floor. The exit stays sealed until the boss dies. The mini-boss (with the big health bar) appears on the 5th floor.
- Extended Realms are endless-mode only. The campaign is the faithful three worlds.
- Stats are in `tuning.js` (`XFOE_STATS`, `XBOSS_STATS`, `XAREAS`, `XAREA_RULES`). The bosses share one data-driven AI (`BOSS_AI.xboss` in `bosses.js`), and each boss cycles its own `acts`: slam, charge, volley, rain and summon. Below 50% HP they enrage and act 35% faster.

### The Thornwild (floors 19-24; boss on 21, mini-boss on 23)

| Id | Name | Role | HP | Speed | Dmg | Behavior / notes |
|---|---|---|---|---|---|---|
| fscout | Thornwood Skulker | Goblin scout (grunt) | 24 | 112 | 9 | melee |
| wolf | Ashpelt Wolf | Wolf (fast swarmer) | 16 | 168 | 7 | swarm |
| ftroll | Mossback Troll | Forest troll (tank, regenerates) | 140 | 52 | 20 | melee (regen) |
| strangler | Strangleroot | Entangler (special: rooted, snaring vines) | 60 | 0 | 8 | ranged (shot) |
| wisp | Glimmerwisp | Wisp (caster elite) | 70 | 90 | 11 | caster (fly) |
| alpha | Grimfang, the Pack Alpha | Forest mini-boss | 850 | 120 | 18 | charger (nova, rally) |
| ancient | The Eldergrove Ancient | Area boss | 2200 | 36 | 26 | slam → rain → summon → volley; summons wolf |

### The Rotting Fen (floors 25-30; boss on 27, mini-boss on 29)

| Id | Name | Role | HP | Speed | Dmg | Behavior / notes |
|---|---|---|---|---|---|---|
| ghoul | Fen Ghoul | Ghoul (grunt) | 30 | 92 | 10 | melee |
| leech | Bog Leech | Leech (fast swarmer) | 12 | 150 | 5 | swarm |
| bogtroll | Peat Hulk | Bog troll (tank, rots into a poison pool) | 150 | 48 | 20 | melee (deathPool) |
| spitter | Blight Spitter | Plague spitter (special: lobs poison pools) | 44 | 58 | 12 | lobber (lobPool) |
| croaker | Mire Croaker | Swamp shaman (caster elite, raises ghouls) | 80 | 70 | 11 | caster (summon) |
| hag | Old Mother Fen | Swamp mini-boss | 800 | 64 | 14 | caster (nova, summon) |
| colossus | The Rot Colossus | Area boss | 2300 | 40 | 26 | slam → volley → rain → summon; summons leech |

### The Sunken Sands (floors 31-36; boss on 33, mini-boss on 35)

| Id | Name | Role | HP | Speed | Dmg | Behavior / notes |
|---|---|---|---|---|---|---|
| dmummy | Dune-Wrapped | Desert mummy (grunt) | 32 | 84 | 10 | melee |
| scarab | Gilded Scarab | Scarab (fast swarmer) | 9 | 158 | 4 | swarm |
| sentinel | Sandstone Sentinel | Sand guardian (tank, shield, immune to elements) | 150 | 50 | 18 | shield (armored) |
| jackal | Jackal Templar | Anubis guard (special: spear lunge) | 90 | 88 | 16 | charger |
| suncult | Sunscorch Hierarch | Sun cultist (caster elite) | 80 | 70 | 12 | caster (summon) |
| pharaohq | Queen Nefrabet | Pharaoh (desert mini-boss) | 850 | 60 | 15 | caster (nova, barrier, summon) |
| sunpharaoh | Akhet-Ra, the Sun-Eater | Area boss | 2400 | 52 | 28 | charge → volley → rain → summon; summons scarab |

### The Rimefrost Wastes (floors 37-42; boss on 39, mini-boss on 41)

| Id | Name | Role | HP | Speed | Dmg | Behavior / notes |
|---|---|---|---|---|---|---|
| fskel | Rimebone Soldier | Frost skeleton (grunt) | 26 | 96 | 9 | melee |
| sprite | Shiver Sprite | Ice spirit (fast swarmer, freezing touch) | 9 | 130 | 10 | wraith (touchFreeze) |
| yeti | Hoarfrost Yeti | Yeti (tank, charges) | 150 | 62 | 20 | charger |
| igolem | Glacier Golem | Ice golem (special: shatters into a freezing burst) | 120 | 44 | 18 | melee (deathFreeze) |
| rimemage | Rime Magus | Frost mage (caster elite, freezing bolts) | 80 | 66 | 12 | caster (summon) |
| boneknight | Sir Varric, the Bone Knight | Bone Knight (frozen mini-boss) | 950 | 66 | 22 | melee (nova, rally) |
| frosttitan | Ymrask, the Frost Titan | Area boss | 2600 | 34 | 30 | slam → volley → rain → summon; summons sprite |

### The Ebon Citadel (floors 43-48; boss on 45, mini-boss on 47)

| Id | Name | Role | HP | Speed | Dmg | Behavior / notes |
|---|---|---|---|---|---|---|
| thrall | Ironsworn Thrall | Fortress soldier (grunt, halberd reach) | 36 | 88 | 12 | melee |
| assassin | Veil Assassin | Shadow assassin (fast swarmer) | 18 | 175 | 9 | swarm |
| bulwark | Cursed Bulwark | Cursed guardian (tank, tower shield) | 170 | 56 | 20 | shield |
| abyssal | Abyssal Ravener | Abyssal demon (special: charging brute) | 140 | 80 | 22 | charger |
| chanter | Doom Chanter | Doom cultist (caster elite, front barrier) | 90 | 66 | 13 | caster (barrier, summon) |
| succubus | Lady Morwen, the Veiled | Succubus (fortress mini-boss) | 900 | 90 | 15 | caster (nova, summon, fly) |
| deathknight | Sir Malgrave, the Death Knight | Area boss | 2800 | 60 | 32 | charge → slam → volley → summon; summons thrall |

## Controls
| Action | Keyboard + Mouse (P1) | Gamepad (standard mapping) | Keyboard 2 (P2) |
|---|---|---|---|
| Move | WASD (arrows too when playing solo) | Left stick / D-pad | Arrow keys |
| Aim | Mouse | Right stick (also fires primary; casts for Zoey) | Movement direction + soft auto-aim |
| Primary | Left click / J | X | Numpad1 / . |
| Secondary | Right click / K | Y | Numpad2 / / |
| Defend / mobility | Shift / L | RT or R3 | Numpad3 / Right Shift |
| Dash (every hero) | F / Middle click | LT or L3 | Numpad6 / Comma |
| Weapon ability | Space / I | B | Numpad0 / Right Ctrl |
| Potion | Q | LB | Numpad4 / ; |
| Relic | E | RB | Numpad5 / ' |
| Interact / confirm | Enter / Click | A | Numpad1 / NumpadEnter |
| Pause | Esc / P | Start | Numpad + |

Zoey on a gamepad: Y = Ember, X = Rime, B = Storm. Cast with the right stick or a trigger.

Other keys: M toggles sound and F toggles fullscreen on menus. Up to 4 players: keyboard+mouse, the second keyboard cluster, and any gamepads (press confirm on the hero-select screen or at camp to join).

## Hero sprite sets (swappable)
Each sprite hero has one folder, `assets/heroes/<name>/` (`theo`, `gela`, `isaac`, `zoey`, `vesper`, `paladin`), containing the
images and a `manifest.json`; `assets/heroes/minions/` holds Vesper's raised-dead sprites (one `down` strip per kind).
To swap in new art, replace the files, edit the manifest, then run `python3 tools/build_assets.py` to regenerate `assets.js`.

```json
{   // (comments shown for documentation; real manifests are plain JSON)
  "scale": 0.6,                    // pixel scale for this art (so a "normal" hero looks right)
  "smooth": true,                  // high-quality smoothing when scaling (false = nearest-neighbour pixel art)
  "bodyScale": 1.25,               // hero size relative to normal (multiplies "scale")
  "hitbox": 15,                    // collision radius in px (normal hero = 13)
  "movement": {
    "style": "heavy",              // "heavy" | "glide" | "nimble" | "walk"
    "speedMul": 0.94, "animRate": 0.8, "bob": 1.0, "stepDust": true,
    "hover": 7, "hoverBob": 3, "hoverHz": 0.35, "glow": "#b89cff",   // glide only
    "rollTime": 0.72, "rollDist": 1.12, "rollCd": 0.8               // dodge-roll multipliers
  },
  "portrait": "portrait.jpg",
  "dirs": ["down", "up", "left", "right"],
  "anims": {
    "idle":  { "file": "idle_{dir}.png", "frames": 4, "fps": 4, "loop": true,
               "frameW": 76, "frameH": 133, "footY": 128, "originX": 38 },
    "run":   { "file": "run_{dir}.png",  "frames": 6, "fps": 10, "loop": true },
    "attack": {}, "hurt": {}, "death": {}, "block": {}, "heavy": {}, "slam": {}, "ult": {}, "throw": {}, "spin": {}, "channel": {}
  }
}
```
- Strips are horizontal: frame *i* is at x = i × frameW. Each animation carries its own `frameW`, `frameH`, `footY`, `originX`.
- `{dir}` is replaced by each entry of `dirs`. A missing direction falls back to `down`; a missing animation falls back to `idle`.
- Animations the game looks for: `idle`, `run`, `attack`, `hurt`, `death` (all heroes); `block`, `heavy`, `slam`, `ult` (Highlord David);
  `block`, `throw`, `slam`, `ult` (Gela); `spin` (Sir Theo); `slam` (raise / spikes), `ult` (Death Nova), `channel` (Life Drain) for Vesper Linda.
- Pose priority: death > hurt > spin > ult > slam > heavy > throw > block > channel/lunge/attack > run > idle.
- Body and movement fields are read from the manifest data, so they apply even before images finish loading.
- To add another sprite hero: add `sprite: '<name>'` to its entry in `data.js`, create the folder and manifest, and rebuild `assets.js`.

**Sprite pipeline** (`tools/sprite_pipeline/`, Python + Pillow): keys the concept sheets' navy background to transparency,
segments figures, normalizes every hero's front idle to the same stored body height, and builds the strips. Idle frames come
straight from the concept/master sheets; run cycles, hurt/death motion and attack timing are procedural transforms of the
generated poses (`build_sprites.py <hero>`; `build_sprites.py minions` for Vesper's dead). Sir Theo's source figures were
chibi-proportioned; `theo_head_fix.py` shrinks his head and lengthens his shins so he matches the other five, and
`build_sprites.py` uses those fixed figures when they exist.

## Files
- `index.html`: entry point.
- `audio.js`: synthesized sound effects.
- `input.js`: keyboard, mouse and Gamepad API.
- `data.js`: heroes, weapons, talismans, relics, masteries, foes and worlds.
- `maps.js`: hand-made floor layouts.
- `engine.js`: tiles, collision, flow-field pathing, effects and camera.
- `combat.js`: foes, AI, damage, projectiles, hazards, pickups and allies.
- `heroes.js`: the six hero kits, spells, potions and relics.
- `bosses.js`: four bosses.
- `modes.js`: save, hub, campaign, Endless, arena and generators.
- `assets.js`: GENERATED embedded hero art (from `assets/heroes/*/manifest.json` via `tools/build_assets.py`).
- `sprites.js`: manifest-driven sprite loading/animation, portraits.
- `render.js`: procedural art and hero overlays.
- `assets/heroes/<name>/`: sprite strips, portrait, manifest.
- `tests/`: headless Chrome test suites (puppeteer-core). `cd tests && npm install && npm test` runs them all; set `CHROME=/path/to/chrome` if Chrome isn't found. The tests serve the game folder themselves, so all paths are relative. `node enemyshots.js` and `node menushots.js` refresh the screenshots. `xrealmtest.js` covers the Extended Realms toggle, every new enemy, mini-boss and boss. `xrealmshots.js` regenerates screenshots 75-84.
- `ui.js`: HUD, menus and screens.
- `main.js`: loop and scenes.
- `screenshots/`: images captured by headless Chrome.
