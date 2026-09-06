# REVISION 1 — post-design critique

**This file overrides `00-BIBLE.md` wherever they differ.** Read order is now:
`06-revision-1.md` -> `00-BIBLE.md` -> the five source docs.

A pre-implementation critique found three real problems and a pile of unresolved
conflicts. Everything below is a decision, not a suggestion.

---

## A. THE THREE REAL PROBLEMS

### A1. The first six minutes were a stool, not a game
Before Zip, the Pin is a 0.75-tile step and a way to make enemies hold still, and
every kill ends with a 68-frame walk to retrieve your weapon. That is the exact
window in which a browser player decides whether to keep going.

**Fix:** Roots shrinks from 8 rooms to 5. **Zip lands at ~minute 3, not minute 6.**
Keep a short pre-Zip stretch — the Pin-as-stool makes Zip land harder — but two
minutes, not six.

### A2. The Ricochet gate was unbuildable
"Bounce off metal" does not get you *up* a sheer metal wall. The gate kind was
wrong, not the ability.

**Fix:** the Surface gate is renamed the **Blind gate** and redefined: a pinnable
surface with *no straight-line throw path from any reachable standing position*,
because metal is in the way. You bank around the corner. Ricochet survives; the
broken gate does not.

### A3. The Ascent replayed rooms the player had never climbed
Every region loop exited into Spine tier N+1, so the Spine's own gates were
"alternate routes" nobody took. At minute 54 the finale asked for five climbs on a
clock, with a chaser, that the player had never done once.

**Fix: every region exit now deposits the player at the tier N *floor*, and the next
region's door sits above the tier N gate.** Each Spine gate is climbed exactly once,
with the ability that opens it, within 60 seconds of earning it. The Ascent then
genuinely is the recap it claims to be.

New Spine progression:

| Gate | Ability | When first climbed |
|---|---|---|
| S1 -> S2 | A1 Zip | leaving Roots |
| S2 -> S3 | A2 Deep Pin | leaving Foundry |
| S3 -> S4 | A3 Reel | leaving Cistern |
| S4 -> S5 | A4 Ricochet | same trip; the Apex door sits at the S5 landing |
| S1 floor hatch -> Core | A5 Twin Pin | after the Plunge |

The S5 Crown door itself stays sealed until the finale.

---

## B. THE REACH TABLE — gates are derived from this, not guessed

Jump clears **3.5 tiles up (56px)**, 7 tiles across at full speed.

| Situation | Base kit reach |
|---|---|
| Horizontal throw at wood, stand on pin, jump | 12px + 56px = **4.25 tiles** |
| Diagonal (45deg) throw from 3 tiles out, stand on pin, jump | 48px + 56px = **6.5 tiles** |
| Floor pin | a 1-tile step |
| **Max climb on a wood wall, base kit** | **6.5 tiles** (one Pin = one boost; you cannot chain) |
| Stone wall, pre-Deep-Pin | not pinnable, so **3.5 tiles**, same as a bare jump |

Consequences that are now law:

- A **wood** height gate must be **8+ tiles**. A 4-tile wood wall is walkable on day
  one and is not a gate.
- A **stone** wall of **4+ tiles** *is* a valid base-kit gate, because stone is not
  pinnable until Deep Pin.
- After Zip, **all wood is a ladder** (throw -> zip -> hang -> wall-kick -> recall ->
  throw higher). That is intended. Wood height gates stop being gates after A1.

### Gate kinds, redefined against the table

| Gate | Ability | Physical definition |
|---|---|---|
| **Height** | A1 Zip | target ledge 8-11 tiles up, wood in the throw lane |
| **Barrier** | A2 Deep Pin | a slag block; pin it, recall shatters it |
| **Gap** | A3 Reel | far side >11 tiles (beyond throw range), nothing pinnable between; Reel drags a rail platform across |
| **Blind** | A4 Ricochet | the only pinnable surface has no straight-line path from anywhere you can stand; bank off metal |
| **Hazard** | A5 Twin Pin | a void column wider than one throw+zip; needs chain-zip |

---

## C. SCOPE CUTS (accepted)

| Cut | Replaced by |
|---|---|
| **The Wire** (raycast, slope test, walkable-vs-zipline, tripwire) | **Twin Pin = two Pins, chain-zip, two lights.** The most complex feature in the game, introduced at minute 45, in the region with the fewest rooms. Chain-zip crosses the hazard gate and is the same button the player already knows. |
| **Crates** (free-body pushable solids) | **Reel drags enemies, rail platforms on fixed tracks, and levers.** A dynamic solid colliding with terrain, the player and other crates is a classic all-night bug for one puzzle. |
| **K2 and K3** (ability recap rooms) | The Ascent *is* the recap. Core = K1 seal, K4 bench, K5 boss, E1 ending. |
| **Anchor phase 3 (the Crown)** | A third fight to build and tune for sixty seconds of scripted coda. Reaching S5 opens the door and the ending begins. **The Ascent is the finale.** |
| **Rooms R4, F5, C5, X2** | Already the documented cut list. |
| **Wick stroke font** | *Deferred, not cut.* System monospace with a fixed fallback until everything else is green. 46 hand-authored glyphs is an hour that ships last. |
| **The second music engine** | 03 and 05 specify different sequencers. **05's wins** — it has the reverb/limiter chain that keeps web audio from sounding harsh. Cistern material first. |

**Room budget: 43 -> 35.** Spine 5, Roots 5, Foundry 8, Cistern 8, Apex 5, Core 4.
The old 43-room math assumed 30 s/room for a competent player; real first-timers run
~1.7x slower, which made it a 90-minute game.

---

## D. FUN CHANGES (accepted)

### D1. Perch, Hang, and the throw freeze
The three fixes that make the base-kit Pin stop being fiddly:

1. **Perch.** Landing on a wall pin centers the player on it and **ignores horizontal
   input until Jump or Down.** A 16x4 platform under a 12-wide player with 6.5px of
   slide is otherwise a nervous place to stand.
2. **Hang on fall-past.** Falling within 8px of an embedded wall pin snaps into the
   **Hang** state that Zip-arrival already needs (Jump = wall-kick vx 3.0 / vy -5.0,
   Down = drop). This gives the *base kit* a climb rhythm — throw, jump, grab,
   wall-kick — instead of a single step.
3. **Throw freeze.** Horizontal velocity is frozen during the 4-frame throw startup,
   so "stand 3 tiles out, throw diagonal" is repeatable instead of drifting.

### D2. LOS enemies track the light, not the player
**Chargers and Turrets acquire a target only if it is inside a light hole** — and
they track *the light*, not the player. A thrown Pin sitting across the room is a
decoy.

This is the change that makes Pin-as-light a real mechanic rather than decoration.
It creates a *choice* about where the light goes — the "leave it there on purpose"
verb the mechanic doc promised — instead of a *penalty* for throwing it. Bounded to
two archetypes so darkness never becomes free stealth against everything.

### D3. Enemy HP, chosen against the damage table
Throw 2, recall 1, jab 1, skewer 3. Without numbers, throw+recall is a risk-free
ranged kill on everything.

- **Light enemies: 4 HP.** Throw+recall leaves 1, forcing a jab or a skewer — so
  every kill requires closing distance at least once.
- **Heavy enemies: 8 HP.**
- **Bosses:** per-boss, with explicitly pinnable parts.

### D4. Unlit save-lanterns are the collectible
Three health shards is thin for the genre's core "I can see it and can't reach it"
loop. Add **8-10 extra unlit save-lanterns** off the critical path, visible from it,
some gated by later abilities.

Lighting one adds a bell to the region's arp and a light to the ending sequence —
which already relights every lantern the player lit. Zero new entities, one counter,
and **the ending scales with how much you explored.**

### D5. Darkness calibration
The critique's measurement: a held-Pin hole of r=260 in a 480-wide viewport lights
essentially the whole screen, so the darkness was a haze pretending to be a system.
The danger is someone "fixing" that by shrinking radii, which produces the annoying
version where you want the Pin thrown *and* held.

**Do not shrink the radii. Do not build any room that requires the light to solve.**
The light is a feel layer plus D2; that is all.

- Ability aura growth: **+40px each** (90 -> 250 by the end) so it is actually
  perceptible, replacing the imperceptible +15.
- Discovered-terrain memory: alpha **0.25**, not 0.12. At 0.12 it is a rumour.
- Overlay alpha **caps at 0.55 everywhere**, including Apex.
- When the Pin is thrown the hand is not empty: an **ember in the palm** carries the
  90px aura, and the rig must draw it.

---

## E. CONFLICTS THE BIBLE MISSED, NOW RESOLVED

| Conflict | Resolution |
|---|---|
| First unlock at 60-80s (03) vs minute 6 (02) | **~minute 3** (see A1) |
| 4-tile wall as universal gate vs pin-hop reach | **Superseded by the reach table (B).** Wood needs 8+, stone 4+. |
| Save-lantern activation: walk-through vs press-up vs throw the Pin | **Walk-through.** No prompt, no input. The Pin's flame reaches out to light it — the visual carries the metaphor, the player does nothing. |
| Aura growth +60/settle-to-320 (05) vs +15 (Bible) | **+40 per ability** (D5) |
| Screenshake 12px on stomp (05) vs 6px cap (Bible) | **6px cap wins.** |
| Two music engines (03 §4.3 vs 05 §6b) | **05's** (C) |
| `[CORE HOOK]` placeholders in 03 §6 never filled | **Filled in F below.** |

---

## F. THE FIRST 90 SECONDS, REWRITTEN FOR THE PIN

Replaces `03-game-feel.md` §6 beats 6-8. Beats 0-5 (arrival, running, step-up, gap,
variable jump, the drop and first save-lantern) are unchanged.

**Beat 6 — 0:40-0:55. The Pin is a step.** A flat room ends in a **wood** wall
2 tiles high with a ledge on top — too high to jump onto from a standstill, trivially
solved by a horizontal throw and a hop. The wall is the only wood in the room and it
is hatched. The player has one button they have not pressed.

**Beat 7 — 0:55-1:10. The Pin is a ladder.** A **wood** wall 5 tiles high. A
horizontal throw only reaches 4.25 — it is visibly not enough. Standing back and
throwing diagonally puts the Pin 3 tiles up and the hop clears it. The room is 6
tiles wide so there is room to back up and no room to be confused. **This is the
spacing lesson, and it is the single most important teaching room in the game.**

**Beat 8 — 1:10-1:30. The Pin is a weapon.** A crawler patrols in front of a wood
wall. Throwing at it pins it to the wood, helpless. Jab, jab. It dies. Then recall —
and the light comes back to your hand for the first time in a way you *notice*,
because you were watching the crawler and not the Pin.

The exit is a **stone** wall 4 tiles high: the first thing the Pin cannot solve, and
the reason Roots exists.

---

## G. PIN EDGE CASES — specified, because this is where a night gets lost

| Situation | Behaviour |
|---|---|
| Room transition with the Pin embedded | Pin **snaps to Held**, always. No exceptions. |
| Pin vs. moving platforms | All moving platforms are **metal** (clang) until Deep Pin; after it, embedding **freezes the platform**, which is A2's traversal use. |
| Pin vs. crumble tiles | The tile crumbles on embed; the Pin drops to Dropped. |
| Pin vs. water | Sinks slowly to the floor, stays recallable, **and the light still works underwater** — it looks lovely and costs nothing. |
| Pin vs. one-way platforms | Not pinnable. Passes through. |
| Pin vs. save-lantern | Lanterns light on walk-through (E); the Pin is not thrown at them. |
| Pin leaves the room / enters a kill volume | Auto-recall after 30f, as already specified. |
| Player dies | Pin returns to Held on respawn. |

**The invariant behind all of these: the player can never be stranded, and Recall is
never disabled.** Any future feature must preserve that.

---

## H. THE DARKNESS: MEASURED, AND SETTLED

Two independent measured reviews and one implementation pass have now put numbers
on the darkness, so this is settled rather than re-litigated.

**The arithmetic bug (fixed).** The overlay washed with `#091217` (L6) at alpha
0.55 over terrain `#070B10` (L5), producing L5 — *zero effect on the terrain it
was supposed to hide*. It only dimmed the background the light cannot reach, and
in doing so crushed the far/mid/terrain separation the cut-paper look depends on.
Fixed by compositing the light `source-atop` the world only, filling the distance
in behind with a flat dim, and carrying the difference in hue rather than value.

**The remaining limit (accepted, not a bug).** With the Pin in hand the light hole
is r=260 in a 480x270 view — a 520px diameter across a 480px-wide screen. **The
light is larger than the viewport**, so there is almost nothing left for the
overlay to darken. Measured mean |ΔL| between "overlay on" and "overlay off" went
from 2.01 to 3.06 against a target of ~8, and it cannot reach 8 by tuning the
wash.

What did improve, and is what actually matters:

| | before | after |
|---|---|---|
| floor falloff (0/60/120/200/300 px from the light) | 25 / 13 / 12 / 10 / 9 | **36 / 24 / 18 / 15 / 10** |
| lit-to-unlit range along the floor | 16 L-points | **26 L-points** |
| distance reacting to the Pin being thrown | -0.38 L | **+0.02 L** (inert, correct) |

**The decision.** The darkness stays a *feel layer*, exactly as §D5 says. We do not
chase a dramatic number, because the only ways to get one are all worse:

- **Shrinking the radii** is forbidden (§D5) and produces the version players hate,
  where you want the Pin thrown and held at once.
- **Raising the overlay alpha** past 0.55 makes Apex-style precision rooms hostile.
- **Zooming the camera out** so the light covers proportionally less would work
  arithmetically, but it rescales every tuned number in the game.

**What makes the light a decision instead is §D2, not the overlay**: line-of-sight
enemies track *the light*, so a thrown Pin is a decoy. That is the mechanic; the
overlay is atmosphere. Anyone tempted to "make the darkness matter" should
strengthen D2 and leave the radii alone.
