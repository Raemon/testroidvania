# THE PIN — Core Mechanic Design

## 1. The Mechanic

**Pitch.** You carry one weapon: a heavy iron stake, the Pin. You throw it in eight directions and it *stays where it lands*. Embedded in a wall it's a ledge you can stand on; embedded in an enemy it nails them to the wall; embedded in a machine it stops the machine. Recall it and it flies back through anything, cutting what it passes. Later, you can fly *to* it instead. Every traversal, combat, and puzzle verb in the game is "where did I put my Pin, and am I going to it or is it coming to me?" — and while it's out there, all you have is a short jab. The Pin is a piece of world state you author: the map's mental model includes your own tool.

### Spec

**Constants.** 16px tiles. Internal resolution 384x216 (24x13.5 tiles), integer-scaled. Fixed 60Hz step, integer-frame timers, all velocities in px/frame. No RNG anywhere in sim; enemies are pattern-driven.

**Inputs.** Left/Right/Up/Down - **Jump** (Z) - **Jab** (X) - **Throw / Recall** (C) - **Zip** (V, unlocked). Aim = held direction at the press frame (8-way; neutral = facing). A 12px dashed aim line is always drawn from the player — cheap, procedural, and it makes 8-way aim legible.

**Player.** Hitbox 10x18. Run 2.2 (ground accel 0.3 / decel 0.4, air accel 0.2). Jump vy -5.2, gravity 0.26 (0.18 while Jump held during the first 12 rising frames), release cuts rising vy by half, max fall 6.0. Coyote 6f, jump buffer 8f. -> ~3.25-tile jump height, ~5.5-tile jump length. No wall-slide, no double jump — the Pin *is* the vertical tool.

**Jab.** Always available. 3f startup / 4f active / 9f recovery, 16x12 box in front, 1 damage, 2px/f knockback. It's the "I've thrown my weapon and I'm exposed" fallback, not a primary attack.

**Pin states.** `Held -> Flying -> {Embedded | Pinned(enemy) | Dropped} -> Returning -> Held`.

- **Throw** (Held, C press): 4f startup (aim locked at press), then Pin flies at 9 px/f in a straight line, hitbox 12x4 oriented along travel. Range 176px (11 tiles = 20f). Past range it loses force: gravity 0.3 until it hits floor -> **Dropped** (lies flat, no platform, still recallable, walk over it to pick up).
- **Embed:** on contact with a *pinnable* surface, stops 8px deep -> **Embedded**. Produces a **platform**: a 16x4 one-way solid protruding perpendicular from the surface (wall pins) or a 4x16 pole (floor/ceiling pins). Down+Jump drops through. Landing snap: if the player's feet are within 4px above and +/-6px horizontally of the platform, snap on. Crucially, a horizontal throw embeds at *chest height*, so "throw at wall, hop onto it" is the same jump every time.
- **Enemy hit:** 2 damage. If the enemy is *light* (mass class 0) and a pinnable surface lies within 48px behind it along the throw vector, it's carried at 9 px/f and **Pinned** for 90f: no movement, no attacks, takes 2 from Jab (crit). After 90f it wriggles free; Pin drops to **Dropped**. *Heavy* enemies (mass 1) take 2 damage + knockback and the Pin drops. Bosses have explicitly pinnable parts.
- **Non-pinnable surface (metal):** "clang" — white flash, drops straight down to Dropped. This is the single most important readability event in the game and gets a distinct sound + 6f screen-edge flash.
- **Recall** (any non-Held state, C press): Pin flies straight at the player's center at 13 px/f, **phasing through all terrain**, 1 damage + knockback to anything on its line. Catch radius 10px -> Held; 4f before the next throw is allowed. Recall works from any distance, always, and is never disabled. If the Pin would leave room bounds or enter a kill volume, it auto-recalls after 30f. Off-screen Pin gets an edge-of-screen arrow.
- **Zip** (V, unlock 1; Pin must be Embedded/Pinned): player flies at 12 px/f in a straight line to the Pin, gravity off, enemy contact damage suppressed (projectiles still hurt), 1 damage to enemies passed through. Jump at any frame cancels the zip and converts current zip velocity into player velocity (capped at run/fall limits) — this is the skill ceiling. Arrival: wall pin -> **Hang** (facing wall; Jump = wall-kick vx 3.0 away / vy -5.0; Down = drop; C = recall, you fall). Floor pin -> stand on its cap. Ceiling pin -> hang below, Jump = drop. Zip *into a Pinned enemy* = **Skewer**: 3 damage, frees them with 20f stun.

**Materials (three, and only three).** Everything in the world is one of: **Wood** (brown, grain lines — pinnable from the start), **Stone** (grey, crack marks — pinnable after Deep Pin), **Metal** (blue-steel, rivet dots — never pinnable; ricochets after Ricochet). Mechanism cores are drawn as a bullseye ring. That's the entire visual vocabulary the gating needs; no sprites required.

## 2. Why It's Good (Not Just Novel)

**Traversal.** The Pin is a *placeable ledge* plus, later, a *placeable grapple point*. Throw-hop-jump-recall-throw is a rhythm with a real cadence (the recall flight time is your limiter, not a cooldown bar), and Zip-cancel-into-jump lets good players carry momentum across rooms. Unlike a grapple, the anchor is persistent: you can leave a Pin in a wall, go do something, and it's still there — which lets level design ask "leave it here on purpose."

**Combat.** One throw does three things depending on what it hits (damage / pin / platform), and every throw costs you your weapon. The core loop — throw -> enemy pinned -> close in (jab crit, or Zip-skewer) -> recall through the next enemy — is a readable three-beat with a built-in vulnerability window. Enemies are differentiated by *mass* (pinnable vs. not) and by *where they stand* (a light enemy in front of metal can't be pinned; in front of wood it can) — so combat reads off the same material language as traversal. Bosses are "find the pinnable part while the rest is metal."

**Gating.** Gates are physical and legible: *what material is that wall*, *how far is it*, *is there a corner in the way*, *is that thing moving too fast*. Every unlock re-tags a class of surface the player has already bounced off and remembers. And because the Pin is world state, gates can also be "hold this open / hold this still" — pin a gear and the door stays up while you go through, then recall from the other side. That's a puzzle verb, not just a key.

**Why not a grapple hook?** Because a grapple is transient — swing and it's gone — so it only ever means one thing. The Pin *staying put* is what lets one verb serve platform, trap, brake, and anchor.

## 3. The Ability Ladder

Base kit (start): Throw / Embed-in-wood / Stand-on-Pin / Recall / Jab. ~5 zones, ~10 min each, unlock at the end of each.

| # | Unlock | Traversal | Combat | Re-opens |
|---|---|---|---|---|
| 1 | **Zip** — fly to the Pin | Cross gaps > 5.5 tiles; reach any wood surface within 11 tiles; Hang + wall-kick; zip-cancel momentum tricks | Instant close on pinned enemy -> Skewer (3 dmg); zip *through* a projectile lane as a dodge | Zone 1's tall wooden shafts where you could pin the beam but not reach it; the gap beside the start room |
| 2 | **Deep Pin** — embeds in stone *and* mechanism cores (freezes them while embedded) | Stop a fast-cycling platform, piston, or fan to walk past; stone is ~60% of the map | Freeze a boss's swinging arm / turret; pin heavier-armored "stone-shell" enemies (they become mass 0 once cracked by 2 jabs) | The stone Quarry off the hub; every "too fast" mechanism you saw in Zone 1 |
| 3 | **Reel** — recall drags whatever it's in back to you (enemies, crates, rail-mounted platforms), at 6 px/f, stopping at obstacles | Pull crates across gaps to make steps; pull a rail platform to your side; pull distant levers | Yank enemies off ledges into hazards or into jab range; drag a shield-carrier out of formation | The crate rooms and out-of-reach levers scattered through Zones 1-2 (all placed before this unlock, none needed for critical path until now) |
| 4 | **Ricochet** — one mirror-bounce off metal; range keeps counting | Bank a Pin into an alcove around a corner, then Zip to it; enter metal-lined rooms | Hit shielded enemies from behind; pin an enemy *to the wall behind you* by bouncing it off the ceiling | The Foundry's metal chutes and every riveted room that just "clanged" until now |
| 5 | **Twin Pin + Wire** — two Pins; a taut wire forms between them if both are embedded, <=14 tiles apart, and unobstructed (raycast). Wire is walkable if slope <= 30 degrees, else a zip-line toward the lower Pin. Zip targets the most recently thrown Pin (or the *other* one when hanging), Recall recalls both | Chain-zip across ceilings; string a wire across a cavern; leave one Pin as a return anchor | Wire is a tripwire (1 dmg + stagger to enemies crossing); pin two enemies; recall both = crossing slashes | The great cavern under the hub (the one you fell past in minute five), which is the way to the final area |

Note that every unlock gives the *existing* throw a new outcome against a surface the player already touched; none of them is a new button except Zip.

## 4. Failure Modes and Guardrails

- **"Where's my Pin?" / stranded without it.** Recall is unconditional and phases through walls; auto-recall from pits/out-of-room after 30f; death returns it; off-screen arrow. The player can never be in an unwinnable state because of Pin position.
- **Throwing feels like disarming yourself.** That's the intended tension, but Jab must always feel usable (fast, no cooldown), pinned enemies are helpless for 90f, and recall is faster than throw (13 vs 9 px/f). Tuning target: a full throw-pin-jab-jab-recall on a 4HP enemy in ~60f.
- **Standing on a 1-tile stick is fiddly.** 16x4 platform + landing snap + deterministic chest-height embed so the hop is always the same. Playtest metric: a fresh player should land "throw then jump on" 9/10 times by minute three.
- **8-way aim ambiguity.** Aim line always visible; direction locks on press; diagonals are exactly 45 degrees; levels are built on a 45-degree grid so intended shots are always clean.
- **Zip into hazards.** Zip is jump-cancelable at any frame, and the zip path is the aim line the player just threw along, so nothing is a surprise. No i-frames (so it's not a free dodge), but contact damage is suppressed so skewering doesn't punish you.
- **Which walls pin?** Three materials, nothing else, ever; strong hatch patterns; the clang event is loud and visual. No "pinnable but only sometimes" surfaces. Mechanism cores always show the bullseye.
- **Throw-recall spam trivializes combat.** Recall damage is 1 and only along its line; Pin-in-wall damages nothing; pinned enemies escape after 90f; heavies and bosses can't be pinned except at marked parts; 4f post-catch lock keeps the rhythm from becoming a machine gun.
- **Twin Pin predictability.** Fixed rules (Zip -> most recent / the other; Recall -> both) and the wire only forms in clean geometry with a visible dashed "blocked" line when it doesn't. No slack, no swinging.
- **Reel stalls.** Dragged objects stop at the first obstacle and the Pin pops free and returns alone, so recall never hangs.

## 5. Alternatives Rejected

1. **Polarity magnetism** (attract/repel to red/blue tiles, Teslagrad-style) — best-in-class gating and trivially drawable, but momentum-based movement is miserable to make precise without physics tuning, and combat reduces to push/pull.
2. **Solid clone + swap** (stamp a solid copy of yourself, swap places with it) — great puzzles and a good gating surface (plates, lasers, doors), but it's slow and puzzle-first; the swap is the only fun part, and Zip gets that with more speed and a real combat role.
3. **Recoil movement** (every attack propels you) — unifies traversal and combat most tightly of anything considered, but it makes precise platforming unreliable, and the ability ladder collapses into "more recoil."
