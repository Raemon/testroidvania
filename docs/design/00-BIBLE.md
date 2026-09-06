# THE DESIGN BIBLE — authoritative synthesis

> **SUPERSEDED IN PART.** `06-revision-1.md` overrides this file wherever they
> differ — it moves Zip to minute 3, redefines the gate kinds against a computed
> reach table, restructures the Spine so the finale recaps climbs the player has
> actually done, cuts the Wire and crates, and sets enemy HP. Read it first.

This file **overrides** the five source design docs (01-05) wherever they conflict.
Read this first. Read the source docs for detail on their own subject.

Working title: **PINLIGHT**

---

## 0. The one-line pitch

A cut-paper metroidvania in the dark, where your only weapon is also your only
light — an iron Pin you throw, which stays wherever it lands.

---

## 1. THE UNIFICATION (the most important decision in the project)

The mechanic doc gives us the **Pin**: a throwable stake that stays where it lands
and becomes a platform, a trap, a brake, or an anchor.

The aesthetic doc gives us **Lantern & Ink**: a world of dark silhouettes where the
player carries the only warm light.

**These are the same object.** The Pin glows. It is the lantern.

Consequences, all of them good:

- **Throwing is a real cost.** You give up your weapon *and* your light. The room
  goes dim where you are, and bright where the Pin is.
- **Throwing is a verb for seeing.** Lob the Pin into a dark shaft to find out
  what's down there. Scouting becomes a mechanic, not a chore.
- **Recall is relief.** The light rushing back to your hand is the best feeling in
  the game and it happens hundreds of times.
- **The darkness overlay stops being decoration.** It is a gameplay system with a
  player-controlled light source, which is genuinely novel and not at all meta.
- **Twin Pin (A5) becomes spectacular.** Two lights. You can illuminate two places
  at once, or leave a light behind you as a breadcrumb.
- **The ending pays off literally.** "Relight the city" is what the whole game has
  been teaching you to do.

### Guardrails (non-negotiable — darkness must never be annoying)

1. **The player always has a personal aura**: hole radius **90px**, even with the
   Pin thrown across the room. Local platforming is always legible. You are never
   groping in the dark at your own feet.
2. **The Pin's light is the *big* radius: 260px** when held (so held = you see the
   room), and it travels with the Pin when thrown.
3. **Terrain you have already seen stays faintly visible** — a per-room "discovered"
   bitmask rendered at alpha 0.12. You never re-explore a room blind.
4. **Hazards are self-lit.** Spikes, lava, void fields punch their own light holes
   (r=40) and are the constant coral #FF4D5A. You can always see what will kill you.
5. **Enemy eyes are self-lit** (r=28). You can always see what is coming.
6. **Every ability permanently increases the aura** (+15px each; 90 -> 165 by the
   end). The world literally gets brighter as you get stronger.
7. **Accessibility option: "Bright Mode"** raises the base aura to 400px and drops
   the overlay alpha to 0.25. One multiplier, ships day one.

---

## 2. RESOLVED CONFLICTS

| Topic | Sources disagreed | **RESOLUTION** |
|---|---|---|
| Internal resolution | 384x216 vs 480x270 vs 1280x720 | **World space is 480x270 units. Tile = 16 units. This is VECTOR art, not pixel art** — the canvas backing store is sized to the device and we `ctx.scale()` world->device. Fine 1.5px strokes and gradients stay crisp at any size. All physics numbers below are in world units. |
| Player hitbox | 10x18 vs 12x20 | **12 wide x 20 tall.** Visual rig may overhang (~18x36); hitbox is never scaled by squash/stretch. |
| Attack button | "Jab" vs "melee slash" | **Jab.** 3f startup / 4f active / 9f recovery, 16x12 box, 1 damage. The fallback when the Pin is away. |
| Dash | generic dash vs Zip | **There is no generic dash. Zip (A1) is the dash.** Before A1 the player has no dash at all — the Pin's platform is the only vertical tool, which is what makes A1 land so hard. |
| Save points | "benches" vs "save-lanterns" | **Save-lanterns.** You light them *with the Pin*. 7 of them. |
| Region names/palettes | world doc vs aesthetic doc | See section 3. |
| Boss count | 3+miniboss vs 4 | **3 bosses + 1 miniboss** (Stoker, Diver, Anchor; Sentinel is the miniboss). |
| Enemy count | 6 archetypes vs 3 rigs | **6 archetypes built from 3 rigs.** See section 4. |
| Music complexity | full 4-region tracker | **One sequencer, per-region data.** Ship Cistern's material first; other regions are data files. |

---

## 3. REGIONS — final mapping

| Region | Rooms | Palette (from 05) | Hazard | Traversal verb | Grants |
|---|---|---|---|---|---|
| **Spine** (hub) | S1-S5 | neutral: void `#12161C` far `#1A2029` mid `#252D38` fog `#3A4553` terrain `#080A0D` edge `#4E5A68` accent `#9FB3C8` | none, ever | the ruler of the map | — |
| **Roots** | R1-R8 | Verdant (hue 95) | thorns (static spikes) | climbing | **A1 Zip** |
| **Foundry** | F1-F9 | Foundry (hue 18) | timed lava, moving platforms | timing | **A2 Deep Pin** (Boss: Stoker) |
| **Cistern** | C1-C9 | Cistern (hue 200) | water, currents | momentum | **A3 Reel**, **A4 Ricochet** (Boss: Diver) |
| **Apex** | X1-X6 | Ossuary (hue 275) | wind, crumble tiles | precision | **A5 Twin Pin** (miniboss: Sentinel) |
| **Core** | K1-K5, E1 | Lantern Heart *inverted* | void fields | recap | ending (Boss: Anchor) |

---

## 4. THE ABILITY LADDER, LOCKED

| # | id | Name | Gate kind it opens | One-line |
|---|---|---|---|---|
| A1 | `zip` | **Zip** | **Height** — a ledge above max reach | Fly to your embedded Pin at 12 px/f. Jump-cancellable. |
| A2 | `deepPin` | **Deep Pin** | **Barrier** — a cracked slag block | Pin embeds in stone and in mechanism cores (freezing them). Recall shatters slag. |
| A3 | `reel` | **Reel** | **Gap** — a pit wider than a jump | Recall drags what the Pin is in back to you: crates, rail platforms, enemies. |
| A4 | `ricochet` | **Ricochet** | **Surface** — a sheer metal wall | One mirror-bounce off metal; range keeps counting. |
| A5 | `twinPin` | **Twin Pin & Wire** | **Hazard** — a lethal void field | Two Pins; a taut walkable wire forms between them. Two lights. |

Each ability also grants **+15px light aura**.

**Foreshadow twice, pay off once.** Every gate kind appears at least twice as a
visible-but-impassable tease before its ability, and once as a mandatory payoff
within 60 seconds of getting it.

---

## 5. MATERIALS — the three-way read

Three materials, nothing else, ever. In a dark world they are distinguished by
**edge color + hatch pattern**, which survives the darkness overlay:

| Material | Edge treatment | Pin behaviour |
|---|---|---|
| **Wood** | warm edge, diagonal grain hatching | pinnable from the start |
| **Stone** | cool edge, short crack ticks | pinnable after **Deep Pin** |
| **Metal** | bright edge, rivet dots | never pinnable; **clangs** (white flash + 6f screen-edge flash + distinct SFX); ricochets after **Ricochet** |

Mechanism cores draw a bullseye ring. That is the entire gating vocabulary.

---

## 6. ENEMIES — 6 archetypes from 3 rigs

| Archetype | Rig | Mass | Behaviour |
|---|---|---|---|
| Crawler | Tick | light | patrols, turns at ledges |
| Hopper | Tick (2 legs, longer) | light | arc-jumps toward the player |
| Charger | Tick (low, wide) | light | dormant until line-of-sight, then dashes |
| Turret | Tick (legless, anchored) | heavy | fires on a fixed interval |
| Drifter | Drift Jelly | light | slow sine-flyer, 1 HP |
| Shell | Knight (small) | heavy | armored; only hurt from above/behind; blocks corridors |

**Mass is the combat gating rule:** light enemies can be *pinned to a wall* (helpless
90f); heavy ones take damage + knockback and the Pin drops. A light enemy standing in
front of **metal** cannot be pinned — so combat reads off the same material language
as traversal.

---

## 7. NUMBERS THAT ARE NOW LAW

Take these from `03-game-feel.md` verbatim. The short version:

- 60 Hz fixed timestep, all velocities in px/frame, no `dt` anywhere in the sim.
- Run 2.6, ground accel 0.45, friction 0.65, air accel 0.30.
- Jump vy -4.70, rise gravity 0.195, fall gravity 0.31, terminal 6.0.
- Coyote 6f, jump buffer 8f, jump-cut x0.45 after frame 4.
- Jump clears **3.5 tiles up, 7 tiles across** at full speed. **4-tile walls are the
  universal "you need an unlock" gate.** 5-tile gaps safe, 6 tight, 7 never.
- Player 5 HP (+3 shards = 8 max). All damage 1, boss heavies 2.
- i-frames 60f. Hitstop 3/5/6f. Screenshake capped at 6px/24f, max-not-sum.
- No slopes. One-way platforms with down+jump drop-through.

Pin: throw 9 px/f, range 176px, recall 13 px/f phasing through terrain, zip 12 px/f.
Recall is **unconditional and never disabled** — the player can never be stranded.

---

## 8. BUILD ORDER (enforced)

Nothing in a later phase starts before the phase before it is green.

**Phase 1 — Foundation.** `core/step.js`, `hash.js`, purity checker, test harness
(static server + Chromium + turbo rAF), tilemap collision, player movement, one
test room, a smoke test and a two-room browser playthrough test. **Everything else
waits on this.**

**Phase 2 — Verbs.** The Pin (all states), Jab, combat, damage/death, save-lanterns,
room transitions, the bot servo. Playthrough test grows to cover them.

**Phase 3 — Content & systems in parallel.** Abilities; entities; bosses; rooms;
renderer; audio; HUD/map/menus.

**Phase 4 — Critique loops.** Repeat until the answers stop being actionable:
1. What's least fun about this, or what would make it more fun?
2. Can we factor the code into smaller, easier-to-reason-about pieces?
3. Are all the comments and docs correct?
4. Is there a redundant system we could streamline?
5. What would improve the visual and audio aesthetics *and their implementation*?

**Scope cut order if we run long:** R4, F5, C5, X2, then drop optional shard 2, then
merge C7 into C8. Never cut: the Spine, any ability, any boss, the Plunge, the ending.
