# World Structure & Pacing

A 60-minute metroidvania is not a small big-metroidvania. It is a different shape: one hub, four loops, three bosses, zero fat. Everything below is built around one structural idea — **a central vertical shaft (the Spine) with four regions hanging off it as one-way loops, and a final plunge that turns the whole map into the last loop.**

Setting: you are a small spark woken inside a dead, planted-over machine called the Vessel. Regions are its organs. You climb it to its crown, then fall to its core to restart it.

---

## 1. BUDGET

| Thing | Count | Why this number |
|---|---|---|
| Rooms | **43** | Spine 5, Roots 8, Foundry 9, Cistern 9, Apex 6, Core 6 (incl. ending). ~30% are 2-screen rooms, none bigger than 2x2 screens. |
| Regions | **4 + hub + finale** | Roots, Foundry, Cistern, Apex; the Spine (hub); the Core (final stretch). |
| Bosses | **3** (+1 miniboss) | Stoker (~min 15), Diver (~min 33), Anchor (final, ~min 51-56). Miniboss "Sentinel" is a scaled-up existing enemy — no new code. |
| Enemy archetypes | **6** | Crawler, Hopper, Turret, Charger, Drifter, Shell. Each region uses 2-3 with palette + stat variants. ~60 placements total. |
| Abilities | **5** (A1-A5) | Landed at ~min 6, 18, 28, 36, 45. Each is a different *gate kind*. |
| Health shards | **3**, optional | +1 HP each. Each a <=60s detour off a path you're already on. |
| Benches (save/respawn) | **7** | Region entrances + before each boss + before final. Death = respawn at bench, full HP, no penalty. |
| Engine hazard/prop primitives | **~12** | static tile, spike, timed-lava, water volume, current volume, crumble tile, wind (room property), void tile (A5-gated), moving platform, one-way door, barrier tile (A2), bench/pickup. |

**Time math (competent player):** 43 rooms x ~30s first visit = ~22 min. ~25 revisit transits x ~8s = ~3.5 min. Three bosses at ~3.5 min each including one death = ~10.5 min. Three ability gauntlets x 2 min = 6 min. Platforming deaths/retries ~8 min. Plunge + ending ~3 min. **~= 53 min, leaving ~7 min slack.** If the sim says a region runs long, cut a room from it — never add a room elsewhere to compensate.

**Deliberately cut:** teleport/fast-travel network, currency/shop, NPCs/dialogue, secondary weapons, multiple endings, more than 3 optional pickups, more than 6 enemy types, any room that exists only to be "big."

---

## 2. REGIONS

Each region has exactly one hazard type, one traversal verb, 2-3 enemies, and a distinct tile silhouette.

### Spine (hub) — 5 rooms, S1-S5 stacked vertically
- **Palette:** neutral grey-blue, dim. Lights up tier by tier as you unlock it. Music: a low drone that adds a voice per tier.
- **Silhouette:** flat rectangles, long verticals.
- **Hazard/enemies:** none. Ever. This is the rest space and the map's ruler.
- **Mechanic:** each tier's climb is gated by the ability you get in the region at that tier — the Spine *is* the ability demo. Dropping down is always free.
- **Graph position:** center. Every region enters from a tier and exits into the tier above.

### Roots — 8 rooms, minutes 2-10, bottom of the Spine
- **Palette:** olive/moss on dark brown; thorns as magenta triangles. Music: sparse, wooden.
- **Silhouette:** rounded blobs, irregular ledges.
- **Hazard:** thorns (static spikes). Teaches "that shape hurts."
- **Enemies:** Crawler (patrol, turns at ledges), Hopper (arc-jumps toward you). Nothing shoots.
- **Traversal verb:** **climbing.** Delivers **A1** via a no-enemy gauntlet (R5).
- **Differs by:** the only region with no ranged threat and no dynamic hazard. Pure onboarding.

### Foundry — 9 rooms, minutes 10-21, tier 2
- **Palette:** charcoal with ember orange; lava as pulsing orange bands. Music: 4/4 industrial pulse — the region's timing hazards are on the beat.
- **Silhouette:** hard rectangles with rivet dots.
- **Hazard:** timed lava (tiles cycle solid<->lethal on a fixed period) + moving platforms.
- **Enemies:** Turret (fires on interval), Charger (dormant until line-of-sight, then dashes).
- **Traversal verb:** **timing.** Delivers **A2** via **Boss 1 (Stoker)**.
- **Differs by:** first dynamic hazard; first enemies that force positioning.

### Cistern — 9 rooms, minutes 21-36, tier 3
- **Palette:** deep teal; water as translucent cyan bands with white foam line. Music: reverb-heavy, slower tempo.
- **Silhouette:** arches and brick courses.
- **Hazard:** water (halves jump height, drowns after N seconds submerged) + currents (push volumes).
- **Enemies:** Drifter (slow sine-flyer, 1 HP, punishes standing still), Shell (armored, only hurt from above/behind, blocks corridors).
- **Traversal verb:** **momentum / horizontal.** Delivers **A3** via gauntlet (C6) and **A4** via **Boss 2 (Diver)**.
- **Differs by:** first region where the *air* is hostile and where enemies require an angle.

### Apex — 6 rooms, minutes 36-46, tier 4
- **Palette:** pale violet and white; wind drawn as streaking lines; crumble tiles show cracks. Music: high, thin, fast.
- **Silhouette:** thin needles and diagonals.
- **Hazard:** wind (constant horizontal force per room, can flip mid-room) + crumble platforms.
- **Enemies:** elite variants of Hopper, Drifter, Shell. Miniboss **Sentinel** (a giant Shell with Charger AI) in X4.
- **Traversal verb:** **precision under pressure**, combining A1-A4. Delivers **A5** via gauntlet (X5). Exits by the **Plunge** (X6), a 4-screen freefall to the bottom of the Spine.
- **Differs by:** no new mechanics — it's the exam. The only region with no boss.

### Core — 6 rooms, minutes 46-60, *below* tier 1
- **Palette:** black with red lines; void fields as static noise. Music: drone from the Spine, distorted.
- **Silhouette:** hex/circuit.
- **Hazard:** void fields (A5-gated) plus one instance of every other hazard.
- **Enemies:** Charger, Shell, Crawler — familiar things in unfamiliar colors.
- **Traversal verb:** **recap.** K2 needs A1+A2, K3 needs A3+A4, K1 needs A5. Then the final boss.

---

## 3. THE MAP GRAPH

### Gate kinds

A gate is good when the player can (a) recognize it as a gate on first sight, (b) recognize what opens it once they have the ability, and (c) never confuse it with terrain. Rule: **each gate kind has one unique tile silhouette + color used nowhere else, and each ability opens exactly one gate kind.**

| Gate kind | Owned by | How it reads | Where the Spine uses it |
|---|---|---|---|
| **Height gate** — a ledge one unit above max reach | A1 | "I need to get up there" | S1->S2 |
| **Barrier gate** — a distinct cracked block in a doorway; the only *explicit* lock | A2 | "That's a door" | S2->S3 (the "slag") |
| **Gap gate** — a pit wider than max horizontal, far ledge always visible | A3 | "I need to get over there" | S3->S4 |
| **Surface gate** — a tall smooth wall of a distinct texture with nothing to stand on | A4 | "I need to go up *that*" | S4->S5 |
| **Hazard gate** — a column/field of a lethal substance you must pass *through* | A5 | "I need to survive that" | S1->Core (floor hatch) |

Anti-patterns to enforce in the sim: gates requiring two abilities at once; a one-way drop leading to a place that needs an ability you can't have yet (soft-lock); gate tiles that resemble non-gate tiles. **Foreshadow twice, pay off once:** every gate kind appears at least twice as a visible-but-impassable tease before its ability, once as the mandatory pay-off within 60s of getting it.

### The graph

```
                      === one-way / opens after event      --- two-way
                      (Ax) gate requiring ability x         * bench   # boss   + ability

 SPINE                                    REGIONS (each is a loop: in at tier N, out at tier N+1)
 =====
 [S5 Crown]  <- final showdown only        (Apex has no exit here; it exits by the Plunge)
   ^ (A4) sheer wall
 [S4 Gallery] ---------------------> X1* - X2 - X3 - X4 Sentinel - X5+A5 - X6 PLUNGE ====\
   ^ (A3) gap             <=== C9 exit via C2-upper (shard 3 behind A4 wall)             |
 [S3 Throat] ----------------------> C1* - C2 - C3 - C4 - C5 - C6+A3 - C7 - C8* - C9#Diver+A4
   ^ (A2) slag barrier                                     |  rung (A3), both sides seen early
   ^                      <=== F9 exit                     |
 [S2 Awakening] -- (A1 ledge) -----> F1* - F2 - F3 - F4 ---/ - F5 - F6* - F7#Stoker+A2 - F8 - F9
   ^ (A1) ledge           <=== R8 exit (drops onto S2's upper ledge = Foundry door)       |
 [S1 Floor] -----------------------> R1* - R2 - R3 - R4 - R5+A1 - R6 - R7 - R8            |
   | (A5) hatch                                   <========== Plunge landing =============/
 [K1 Seal] - K2 (A1+A2) - K3 (A3+A4) - K4* - K5#Anchor === chase up S1->S5 === S5 finale - E1 Ending
```

Start position: an alcove in **S2**. From it the player sees the Foundry door on a ledge they can't reach (A1 tease #1) and can drop to S1, where they see the void hatch in the floor (A5 tease #1) and the Roots door.

### The loops, explicitly

| Loop | Path | Closed by | Payoff moment |
|---|---|---|---|
| **L1 Roots** | S1 -> R1..R5 (A1) -> R6..R8 -> drops into R2-upper -> S2 ledge | A1 | You emerge *directly above your start room*, on the ledge with the Foundry door you couldn't reach at minute 0. |
| **L2 Foundry** | S2 -> F1..F7 (Boss 1, A2) -> F8 slagway (A2 x3) -> F9 -> S3 | A2 | F8 runs underneath F2-F3; you see the conveyor room from below. |
| **L3 Cistern** | S3 -> C1..C6 (A3) -> C7..C9 (Boss 2, A4) -> C2-upper -> S4 | A3, A4 | The exit crosses the top half of the first big water room. |
| **L4 Apex / Plunge** | S4 -> X1..X5 (A5) -> X6 freefall -> S1 | A5 | The biggest loop: the whole map's height in one 20-second fall, landing beside the hatch from minute 1. |
| **L5 Spine** | S1->S2->S3->S4->S5, each tier gated by the ability from the region below | A1-A4 | The backup/alternate side of every loop. Also the final chase. |
| **L6 Rung** | F4 <-> C4 through a flooded vent | A3 | Optional. Shard 2 sits in F4 across a gap you saw at minute 13. |
| **L7 Finale** | Core -> S1 -> S2 -> S3 -> S4 -> S5 | everything | The Spine, climbed for the last time, on a clock. |

### Room-by-room

**Spine.** S1 Floor: Roots door W, Plunge landing E, void hatch center floor (A5), ceiling ledge to S2 (A1). S2 Awakening: start alcove; upper ledge W = Roots-exit one-way + Foundry door (A1 from floor); slag barrier up (A2). S3 Throat: Cistern door W, Foundry exit enters E, shaft jogs across a gap to S4 (A3). S4 Gallery: Apex door E, Cistern exit enters W, sheer walls up (A4). S5 Crown: sealed summit door; opens only in the finale.

**Roots.** R1 Gate *: crawlers. R2 Trunk (2 tall): climb; upper ledge is the loop exit, unreachable now (A1 tease #2). R3 Thicket: hoppers, thorns; shard 1 high on a ledge (A1). R4 Burrow: crawler+thorn corridor, one-way drop to R5. R5 Shrine +A1: no enemies, three rising beats. R6 Canopy: height gates, hoppers. R7 Vine Run: mandatory A1 ledges; side path back to R3-upper for shard 1. R8 Hollow: short, drops into R2-upper.

**Foundry.** F1 Vestibule *. F2 Conveyor: turrets, moving platforms. F3 Crucible (2 wide): lava cycles. F4 Vents: chargers; shard 2 across a gap (A3 tease #1); vent door to C4 (A3). F5 Press: lava + platforms on a tighter beat. F6 Antechamber *. F7 Stoker #+A2. F8 Slagway: three barriers (A2), chargers. F9 Flue: vertical climb out to S3.

**Cistern.** C1 Sluice *. C2 Basin (2 tall): water intro; upper half is the exit route and holds shard 3 behind an A4 wall. C3 Channel: currents, drifters. C4 Undercroft: shells; vent to F4 (A3). C5 Weir: gap tease #2, drifters. C6 Shrine +A3. C7 Rapids (2 wide): mandatory gaps + currents + turrets. C8 Deep *. C9 Diver #+A4; after the fight, an A4 wall opens the way up to C2-upper.

**Apex.** X1 Stair *: wind intro. X2 Buttress: crumble + elite hoppers. X3 Belfry (2 tall): vertical wind + drifters. X4 Watch: Sentinel miniboss. X5 Shrine +A5: the hardest gauntlet, all of A1-A4. X6 Plunge (1 wide x 4 tall): freefall with A5 flourishes; lands in S1.

**Core.** K1 Seal: void fields (A5). K2 Reactor Stair: A1+A2 with chargers. K3 Coil: A3+A4 with shells and one of every hazard. K4 Threshold *. K5 Anchor # phase 1. Phase 2 = S1-S5 in "rising void" variant. E1 Hull: ending run + credits.

---

## 4. MINUTE-BY-MINUTE

Intensity 0-5. "Rest" beats are deliberate: every ability pickup is followed by 1-2 minutes of using it on things that can't hurt you much.

| Min | Where | What the player is doing | Int. |
|---|---|---|---|
| 0 | S2 | Wake. Walk, jump. See Foundry door above (can't reach). Drop to S1. See the hatch in the floor (can't pass). Enter Roots. | 1 |
| 2 | R1-R4 | Crawlers, hoppers, thorns. First bench. Learn that magenta hurts. See R2's high ledge and R3's shard. | 2 |
| 5 | R5 | **A1 gauntlet.** No enemies. Three rising beats. | 2 |
| 6 | R5 -> R6-R7 | **A1 acquired.** Use it immediately on three height gates. Optional 30s to shard 1. | 2 |
| 9 | R8 -> R2-upper -> S2 | Loop closes: land above your own start room. Foundry door is right there. | 1 |
| 10 | F1-F3 | Bench. Turrets, moving platforms, lava on the beat. | 3 |
| 13 | F4-F5 | Chargers. See shard 2 across a gap (A3 tease). Tightest timing yet. | 3 |
| 15 | F6-F7 | Bench. **Boss 1: Stoker.** Ground slams + lava waves. ~2.5 min including one death. | 4 |
| 18 | F8-F9 | **A2 acquired.** Break three barriers, climb the Flue. Rest beat. | 2 |
| 21 | S3 -> C1 | Bench. Spine tier 3 lights up. | 1 |
| 22 | C2-C5 | Water halves your jump. Currents. Drifters punish idling; shells need an angle. See the A4 wall in C2, the gap in C5. | 3 |
| 26 | C6 | **A3 gauntlet.** Gaps that get wider, currents that help then hurt. | 3 |
| 28 | C6 -> C4 | **A3 acquired.** Optional: vent to F4, shard 2, back. ~60s. | 2 |
| 30 | C7 | Rapids. Gaps + currents + turrets. First real platforming peak. | 4 |
| 33 | C8-C9 | Bench. **Boss 2: Diver.** Submerges, geysers, forces you onto small platforms. ~3 min. | 4 |
| 36 | C9 -> C2-upper -> S4 | **A4 acquired.** Climb out of the arena. Shard 3 is a 20s detour. Spine tier 4. | 2 |
| 38 | X1-X3 | Bench. Wind. Crumble. Elites. Everything you know, faster. | 4 |
| 41 | X4 | **Sentinel** miniboss. ~90s. | 4 |
| 43 | X5 | **A5 gauntlet.** Hardest pure platforming in the game. | 4 |
| 45 | X5 -> X6 | **A5 acquired.** The Plunge: 20 seconds of falling past every tier you climbed. Zero challenge, pure release. | 1 |
| 46 | S1 -> K1-K3 | Through the hatch you saw at minute 1. Recap rooms: A5, then A1+A2, then A3+A4. | 4 |
| 50 | K4 | Bench. Silence. The calm before. | 1 |
| 51 | K5 | **Final boss, phase 1: the Anchor.** Grounded fight, three attacks, arena floor breaks at 50%. | 5 |
| 54 | S1->S5 | **Phase 2: the Ascent.** Void rises from the Core; climb every Spine tier with the ability that opened it, in order, on a clock. Checkpoint at each tier. | 5 |
| 56 | S5 | **Phase 3: the Crown.** A short, near-scripted final exchange (three hits during telegraphed openings). | 4 |
| 57 | E1 | The Vessel lights up region by region. Run right along the hull; credits draw on the same canvas. Timer + death count shown. | 0 |
| 60 | — | End. | |

Difficulty shape: three rising sawteeth (peaks at 15, 33, 43) then one long climb from 46 to 56 with a single rest at 50.

---

## 5. BACKTRACKING WITHOUT TEDIUM

1. **No region is ever re-entered on the critical path.** Every region is a one-way loop: enter from Spine tier N, exit into tier N+1. The exit route passes *near* the entrance (so the loop is felt) but through new rooms. The only re-traversed space is the Spine, which has no enemies.
2. **Gravity is the fast-travel system.** The Spine is vertical; going down is free. Going up costs ~5s per tier once you have the ability. Worst-case "get anywhere" time after A4 is ~25 seconds.
3. **The Plunge replaces the "go back through everything with all your powers" beat.** Same emotional payoff (look how far you've come), zero cost.
4. **Optional content is only ever a detour off the path you're already on.** Each shard is <=60s from the point where you first have its ability.
5. **The map screen shows unpassed gates by kind.** Pause map: rooms visited, benches, and a small icon on every gate you've *seen* but not passed, colored by gate kind. This is the single cheapest anti-tedium feature and it is not optional.
6. **Benches are placed so death never costs traversal.** A death costs the room you died in, never the region.
7. **Enemies respawn on room entry, but the only rooms you revisit are Spine tiers (no enemies) and the two-tall exit rooms which have none on the upper half.**

Not doing: teleporters, warp benches, a "return to hub" item.

---

## 6. THE ENDING

**Beat 1 — the Anchor (K5, ~3 min).** A grounded boss fight in the deepest room. Three attacks (a sweep you jump, a slam you dodge sideways, a pull that drags you toward it). At 50% the arena floor collapses into the void and the fight ends: it is not dead, it is *chasing*.

**Beat 2 — the Ascent (S1->S5, ~2 min).** The void rises through the Spine at a fixed, deterministic rate tuned to a competent pace +30%. The player climbs S1->S2 with A1, breaks through S2->S3 with A2, crosses the S3 gap with A3, scales S4 with A4, and at S5 the sealed Crown door opens for A5. The whole game's ability ladder replayed in 120 seconds in the one space the player has known since minute 0. Checkpoint at each tier.

**Beat 3 — the Crown (S5, ~1 min).** The Anchor breaches the summit behind you. Three telegraphed openings, three hits. Short and near-scripted on purpose: the Ascent was the real fight; this is the punctuation.

**Denouement — the Hull (E1, ~2 min).** The Crown opens onto the outside of the Vessel. The player runs right along a flat hull as, behind them, the regions light up in order — olive, ember, teal, violet — and the Spine drone resolves into a chord. Credits draw on the canvas as they run. At the far edge: run time and death count.

Why it's earned: the player has used every ability in the last ten minutes, in the order they got them, in the space they started in. The map itself is the final boss arena.

---

## Notes for the build

- **Room format:** char grid + header (`id, region, size, exits[dir=room], par_seconds, bench, spawns[type@x,y], gates[kind@x,y]`). One file per room; the map graph is derivable from headers.
- **Sim checks to run every build:** (a) reachability from S2 with each ability prefix {}, {A1}, {A1,A2}, ... — the critical-path room set must be exactly the expected one and no room needing A(n+1) is reachable via a one-way drop; (b) a golden-path input recording per room whose total <= 50 min; (c) every gate kind appears >=2 times before its ability's room in golden-path order.
- **Tuning knob if over time:** cut rooms in this order — R4, F5, C5, X2.
