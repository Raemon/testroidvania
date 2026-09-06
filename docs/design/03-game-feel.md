# Game Feel Spec — Moment-to-Moment Pass

## 0. Reference frame (assumptions every number below depends on)

| Thing | Value | Why |
|---|---|---|
| Timestep | 60 Hz fixed, all sim values in **px/frame** (px/f) | Deterministic replay; no dt multiplication anywhere in sim |
| Internal resolution | **480x270**, integer-scaled to the window | 30x17 tiles visible; 4x scale on 1080p; crisp shapes |
| Tile | **16 px** | |
| Player hitbox | **12 w x 20 h** (feet at bottom, ~0.75x1.25 tiles) | Fits 1-tile gaps with 2px slop each side |
| Player visual | Capsule/rounded rect ~14x22, drawn separately from hitbox so squash/stretch never affects collision | |
| RNG | One seeded stream for sim, a **separate** seeded stream for cosmetic particles/audio; cosmetics never read sim RNG | Replays stay bit-exact regardless of particle budget |

Everything else is relative to those.

---

## 1. Platforming Feel

### 1.1 Numeric table

| Parameter | Value | Derived / notes |
|---|---|---|
| Max run speed | **2.6 px/f** (156 px/s, ~10 tiles/s) | Brisk; the game is small, so traversal should feel fast |
| Ground accel | **0.45 px/f2** | 0->max in **6 frames** |
| Ground friction (no input) | **0.65 px/f2** | max->0 in **4 frames**. Stops feel crisp, not slidey |
| Turnaround boost | accel x **1.6** when input opposes velocity | Reversal in ~4 frames; kills the "ice" feeling |
| Air accel | **0.30 px/f2** | 0->max in ~9 frames; player can fully steer a jump |
| Air drag (no input) | **0.10 px/f2** | Momentum mostly preserved in air |
| Jump initial vy | **-4.70 px/f** | |
| Rise gravity | **0.195 px/f2** | Apex at **24 frames**, height **56 px = 3.5 tiles** |
| Fall gravity | **0.31 px/f2** (rise x 1.6) | Fall from apex takes ~19 frames; total full-jump airtime ~= **43 frames** |
| Apex hang | gravity x **0.5** while abs(vy) < 0.6 | ~5 frames of float at the top; makes precise landings feel generous |
| Terminal velocity | **6.0 px/f** (360 px/s) | Reached after ~20 frames of falling |
| Fast-fall (hold down, airborne) | terminal **8.0**, fall gravity x 1.4 | Optional; cheap and satisfying |
| Jump cut (release early) | if rising, `vy *= 0.45`, once | Only applies **after frame 4** of the jump so a 1-frame tap still gives a consistent minimum |
| Min jump height | ~= **22 px (1.4 tiles)** | From a 3-4 frame tap |
| Coyote time | **6 frames** (100 ms) | Also granted when walking off a *moving* platform |
| Jump buffer | **8 frames** (133 ms) | Buffered press fires on the first grounded frame |
| Full-jump horizontal reach at max speed | ~= 43 x 2.6 = **112 px = 7 tiles** | Level design rule: **5-tile gaps are "safe", 6 is "tight", 7 is "pixel-perfect (don't)"** |
| Max jump-able wall | **3 tiles** | 4-tile walls are the universal "you need an unlock" gate |
| Ceiling corner correction | if head hits ceiling and player's edge is within **4 px** of the ceiling's corner, shift horizontally out and preserve vy | Feels like the game reads your mind |
| Ledge nudge (horizontal) | if running into a wall and the wall top is within **3 px** above the feet, pop up onto it | Only 3 px — anything more reads as auto-climb |
| Falling-edge nudge | if landing and only <= **2 px** of foot overlaps a platform edge, snap onto it | |
| Slope handling | none — **no slopes**. Everything is AABB tiles | Overnight budget; slopes are where platformers eat a night |
| One-way platforms | yes, drop-through with **down + jump**, 8 frames of ignore | Cheap, hugely expands room design |

### 1.2 Generic dash (placeholder — [CORE HOOK] = Zip)

| Dash param | Value |
|---|---|
| Startup freeze | **2 frames** (player frozen, world runs, direction is read at the end of the freeze) |
| Duration | **10 frames** at **6.5 px/f** = 65 px ~ 4 tiles |
| Gravity during dash | 0 |
| End lag | **4 frames**, speed clamped to 2.6 (max run) — no "stop" |
| Cooldown | **12 frames**; refill on ground contact or on landing a hit |
| Cancel windows | jump cancels dash from frame 6+; attack cancels from frame 8+ |

### 1.3 Generic attack (placeholder — [CORE HOOK] = Jab)

Melee slash, hitbox 24x20 in facing direction. **3 windup / 5 active / 8 recovery = 16 frames**. Recovery cancellable into dash or jump from frame 10. Hitting an enemy pushes the player back **1.5 px/f** (recoil), which prevents body-blocking and feels punchy. Down-slash while airborne pogos: sets vy = -3.5 on hit.

### 1.4 Input

Read keyboard state at the top of the frame into a `{held, pressed, released}` triple; sim reads only that. Rebindable at minimum: Z/X/C or J/K/L + arrows/WASD; **space is always jump** regardless.

---

## 2. Combat Feel

### 2.1 Hitstop (freeze frames)

Whole-world freeze (sim doesn't tick; render does — particles spawned that frame are drawn, camera shake still animates so it doesn't look like a crash).

| Event | Frames |
|---|---|
| Player hit connects (normal enemy) | **3** |
| Player hit connects (boss) | **4** |
| Player kills an enemy | **5** |
| Player takes damage | **6** |
| Boss phase change / boss killed | **12**, then slow-mo 0.25x for 30 frames |
| Parry/counter | **8** |

Rule: hitstop **does not stack** — a new event replaces the remaining freeze only if it's longer. Cap 12 frames outside of boss kills. Multi-hit attacks (3+ hits) get hitstop only on the final hit.

### 2.2 Knockback

| Target | Impulse | Decay |
|---|---|---|
| Enemy hit by player | **3.0 px/f** away from player, +0.5 up | x0.80/frame (dead in ~10 frames) |
| Heavy/boss hit by player | 0 px (they don't move) — instead **the player** gets recoil 2.0 | Weight = the enemy doesn't budge |
| Player damaged | **3.5 px/f** away from source, **-2.5 vy** | Control lost **10 frames**, then i-frames continue |
| Player hits enemy while airborne | player recoil 1.5 px/f + vy clamped to >= -1.0 | Small "bump" so aerial combos feel stable |

Knockback never pushes the player into a hazard: if the knockback path crosses spikes/pits within 10 frames, halve it.

### 2.3 Screenshake — with discipline

Implementation: one shared `shake` amplitude (px) and `shakeFrames`; each frame offset = amplitude x (seeded noise per axis, -1..1), amplitude decays **linearly to 0** over shakeFrames. Offsets are in *render* only, rounded to integer px. Two sources at once -> **take the max**, never sum.

| Event | Amplitude | Frames |
|---|---|---|
| Player hit connects | **1 px** | 4 |
| Enemy killed | **2 px** | 6 |
| Player damaged | **3 px** | 10 |
| Player lands from terminal velocity | 2 px | 5 |
| Boss ground-slam / heavy telegraphed hit | **5 px** | 14 |
| Boss death | 6 px | 24 |
| Hard cap | **6 px, 24 frames** | never exceed |

Non-negotiable: **no shake on jump, dash, or footsteps.** Add a settings toggle (0 / 50% / 100%).

### 2.4 Invulnerability

| Who | i-frames | Visual |
|---|---|---|
| Player after damage | **60 frames** | Body alpha alternates 1.0 / 0.35 in **4-on/4-off** blocks; hitbox for *hazards* (spikes) still active after frame 20 so you can't i-frame through spike corridors |
| Player during dash/zip | default **none** (contact damage suppressed instead) | |
| Enemy per-attack lockout | **8 frames** after being hit by the same attack instance | Prevents one swing hitting 3x |
| Boss between phases | full invuln during the 12-frame freeze + 45-frame transition | Boss glows white then settles into new color |

### 2.5 Hit flash

Enemy on hit: fill **solid white** for **3 frames**, then lerp from white to a **red tint (mix 0.5)** over 6 frames, back to base.

Player on damage: **whole screen** flash — draw a white rect at alpha **0.35** for 2 frames, then a **red vignette** (radial gradient, alpha 0.25) for 12 frames. Also drop the master audio volume to 0.5 for 6 frames (audio "hitstop").

### 2.6 Damage numbers — no

No floating numbers. Instead: enemy HP shown as a **thin bar under the enemy for 90 frames after last hit** (fades), bosses get a full-width bottom bar with **phase notches**.

### 2.7 Enemy attack frame budgets

| Enemy class | Telegraph | Windup | Active | Recovery | Time before damage |
|---|---|---|---|---|---|
| Light (hopper, dart) | 10 | 6 | 4 | 14 | 16 f (267 ms) |
| Medium (lunger, spitter) | 14 | 10 | 6 | 20 | 24 f (400 ms) |
| Heavy (slammer, shield) | 20 | 12 | 8 | 30 | 32 f (533 ms) |
| Boss light attack | 14 | 10 | 6 | 20 | 24 f |
| Boss heavy attack | 24 | 14 | 8-10 | 40 | 38 f |
| Boss projectile volley | 20 | 8 | (projectiles live 90-150 f) | 30 | 28 f |

Hard rules:
- **>= 16 frames** of visible telegraph+windup before *anything* deals damage. **>= 24** for anything that does 2 damage.
- Recovery is always **>= 1.5x active + windup** so every attack is punishable by design.
- Enemies never attack during the player's 10-frame damage stagger — they retreat/reset instead.
- Enemies never attack within **20 frames** of entering the screen.

### 2.8 Readability with no sprite art

The single rule that carries the game: **warm = hurts you, cool = for you, neutral = inert.**

- **Player**: cyan/white capsule. Player attacks: white-cyan arcs.
- **Enemies at rest**: desaturated purple/magenta polygons. Each enemy class has one silhouette: light = small triangle, medium = diamond/kite, heavy = hexagon, shielded = hexagon with a bright edge on the shield side. Bosses are composites of those primitives.
- **Telegraph**: enemy body color lerps from base -> **orange** over the telegraph phase, hits **white on the single frame before active**, then goes **red** during active. Same 4-color ramp for every enemy in the game.
- **Anticipation pose**: during windup, squash **opposite** the attack direction. The wind-up motion always points *away* from where the hit will land.
- **Attack zone preview**: during windup, draw the eventual hitbox as an outline at **alpha 0.3** (wedge for lunges, circle for slams, line for beams), filling to alpha 0.8 red on active. Heavy/boss attacks get it always; light enemies get it only for the first region.
- **Hazards**: red-orange triangles (spikes) with a faint red glow. Never any other red-orange static geometry.
- **Interactables** (doors, checkpoints, unlock pedestals): green/teal with a slow **pulse (1.0->1.15 scale, 90-frame period)**. Nothing else pulses.

---

## 3. Feedback Layers

### 3.1 Squash & stretch (visual only; hitbox untouched)

Scale is a (sx, sy) pair that lerps back to (1,1) at **0.2/frame** unless overridden. Anchor at the feet.

| Event | (sx, sy) | Hold |
|---|---|---|
| Jump takeoff | (0.75, 1.30) | set once, lerp back |
| Landing | (1.30, 0.70) at >= 4 px/f fall speed, scaling to (1.45, 0.55) at terminal | 3 frames hold then lerp |
| Dash/Zip | (1.45, 0.65) along axis (rotate for vertical) | for duration |
| Turnaround | (0.85, 1.10) | 1 frame |
| Damaged | (1.20, 0.80) pulsing 2x | 10 frames |
| Run lean | rotate body **+/-6 deg** into movement direction, proportional to vx/max | continuous |
| Idle | (1.0, 1.0) breathing +/-0.03 on a 90-frame sine | continuous |

### 3.2 Particles

One pool, **512 max**, oldest evicted. Every particle: pos, vel, life, color, size, gravity flag, shape (circle/rect/line). Cosmetic RNG stream only.

| Emitter | Count | Spec |
|---|---|---|
| Landing dust | 4 + floor(fallSpeed) | grey-white circles, size 2-3, vel +/-1.2 horizontal / -0.5 up, life 14-20 f, no gravity, shrink to 0 |
| Run dust | 1 every **8 frames** at > 80% max speed | behind the feet, drifts opposite to motion |
| Jump puff | 5 | ring pattern, life 10 f |
| Dash ghosts (afterimages) | 1 every **2 frames** during dash | draw player silhouette at alpha 0.5 -> 0 over 12 f, tinted cyan |
| Hit sparks | 8 | thin **line** particles (length 6, width 1) fanned +/-40 deg along attack direction, white->yellow, vel 3-5, life 8 f |
| Enemy death | 12 + 1 ring | fragments in the enemy's base color, sizes 3-5, gravity on, bounce once; plus a ring (stroke circle) expanding 0->48 px over 12 f, alpha 0.8->0 |
| Player death | 24 + ring | cyan/white, slower, life 40 f |
| Collect / unlock | 16 + ring + screen flash 0.2 | ascending, sparkle-twinkle (alpha noise) |
| Checkpoint activate | 10 rising green motes, then a standing gentle 1-per-20-frames emitter forever | |
| Boss slam | 20 ground-hugging rect chunks fanned along the floor | plus 5 px shake |

### 3.3 Camera

Camera state: `pos`, `target`; render uses `round(pos)`.

| Param | Value |
|---|---|
| Horizontal deadzone | **+/-16 px** around player center |
| Vertical deadzone | **-24 / +32 px** (asymmetric: more room below because falls are faster) |
| Horizontal lookahead | **+40 px** in facing direction; the lookahead offset itself lerps at **0.05/frame** and facing must be held **6 frames** before it flips |
| Follow lerp | **0.12/frame** horizontal, **0.08/frame** vertical |
| Ground snap | when grounded, vertical target = feet - 150 px (feet sit at ~55% screen height) and the vertical deadzone is ignored |
| Fast-fall follow | if falling >= 20 frames, vertical lerp -> 0.25 |
| Room clamp | camera never shows outside room bounds |
| Small rooms | rooms <= 480x270: camera is fixed; no follow at all |
| Boss arenas | fixed camera with +/-8 px follow "breathing" so shakes have room |

### 3.4 Room transitions

Player crosses a room boundary -> sim pauses -> **14-frame scroll** (ease-out cubic) of the camera into the new room while the player is drawn sliding **12 px** into it -> sim resumes with the player's velocity preserved (horizontal) or set to -2.0 vy if entering from below. During the scroll: 1 whoosh SFX, player's i-frames = 20 on arrival. Vertical transitions downward pause an extra 6 frames at the end.

Area (biome) transitions additionally cross-fade the background gradient and the music pattern over 2 bars. No fade-to-black anywhere except death and the title.

### 3.5 Priority order if time runs out

1. Hit flash (white 3f) + hitstop
2. Squash/stretch on jump/land + landing dust
3. Camera lookahead + ground snap
4. Dash ghosts
5. Hit sparks (lines) + enemy death fragments + ring
6. Screenshake (small!)
7. Screen flash/vignette on damage
8. Room scroll transition
9. Run dust, idle breathing, run lean
10. Everything else

---

## 4. Audio

### 4.1 Engine

One `AudioContext`, one master gain -> compressor -> destination. SFX built from oscillators + noise buffer (1 s of seeded white noise, looped) through a `BiquadFilter` and a gain envelope. All SFX are **fire-and-forget functions of (time)**. Master duck to 0.5 during player-damage hitstop. Same-SFX rate limit: **1 per 3 frames**, pitch-randomize +/-4% (cosmetic RNG).

### 4.2 SFX list

| # | Event | Recipe |
|---|---|---|
| 1 | **Jump** | Square, **220->440 Hz** linear ramp over 60 ms. Env: A 3 ms, D 100 ms to 0. Gain 0.25. Low-pass 3 kHz |
| 2 | **Land** | Noise -> low-pass 500 Hz, env A 1 ms, D 50 ms, gain 0.3; plus sine **90 Hz** thump, D 70 ms, gain scaled 0.1-0.4 by fall speed |
| 3 | **Footstep** | Noise -> band-pass 900 Hz Q 2, D 25 ms, gain 0.12; one per 8 frames at speed; pitch +/-8% |
| 4 | **Dash/Zip** | Noise -> band-pass sweep **2400->500 Hz** over 120 ms + square 700->350 Hz same window. Env A 2 ms, D 130 ms. Gain 0.3 |
| 5 | **Attack swing** | Noise -> high-pass 2.5 kHz, D 60 ms with a quick band-pass sweep 4k->1.5k. Gain 0.2. Miss = this alone |
| 6 | **Hit connect** | Square **160 Hz**, D 40 ms, gain 0.35 + noise burst D 30 ms + sine 70 Hz D 60 ms. Play *at* hitstop start. Bosses: pitch x0.75, add 20 ms D on a saw 90 Hz |
| 7 | **Enemy death** | Saw **320->50 Hz** exponential over 220 ms + noise low-pass sweep 3k->200. Env A 2 ms, D 240 ms. Gain 0.4 |
| 8 | **Player hurt** | Two saws detuned +/-12 cents, **420->140 Hz** over 250 ms, through a `WaveShaper` (tanh x 4) for grit. Gain 0.45 |
| 9 | **Player death** | Descending 4-note arpeggio (triangle): root, b7, 5, b3 in the region's key, 120 ms each, then a 600 ms low sine 55 Hz fade. Music ducks to 0 |
| 10 | **Collect / unlock** | Triangle ascending major triad + octave (4 notes x 55 ms), then a 400 ms sine at the top note with a 6 Hz vibrato. Gain 0.35. Unlock = same with a 2nd voice a fifth up |
| 11 | **Checkpoint** | Two triangle notes, perfect fifth, 150 ms each, soft (gain 0.2), + tiny sparkle (high sine 2.4k, D 300 ms, gain 0.05) |
| 12 | **Enemy telegraph tick** | Square **110 Hz**, 30 ms, gain 0.15, fires on the *white* frame before active. Every attack in the game shares this tick |
| 13 | **Boss heavy windup** | Saw 55 Hz + sine 55 Hz, 400 ms swell (A 300 ms), gain 0.4, ends exactly on the tick |
| 14 | **Room transition** | Noise -> low-pass sweep 300->2000->300 Hz over 230 ms, gain 0.15 |
| 15 | **UI blip** | Sine 880 Hz, D 40 ms, gain 0.15 |

### 4.3 Adaptive music — a tractable tracker

**Structure**: a step sequencer running at **16 steps per bar**, four channels, scheduled with the standard lookahead pattern (a 25 ms `setInterval` scheduling up to **120 ms** ahead against `audioContext.currentTime`). Music is not part of the deterministic sim; it *reads* game state and never writes it.

| Channel | Voice | Pattern data |
|---|---|---|
| Bass | Square/triangle mix, low-pass 600 Hz, D 200 ms | 16-step array of scale degrees or rests |
| Pad | Two detuned saws through low-pass 900 Hz, A 400 ms R 800 ms | chord per bar (root + quality), 4-bar progression |
| Lead | Triangle or pulse (25%), short delay (feedback 0.3, 3/16 note) | 2-4 phrases of 16-32 steps, picked by seeded RNG on phrase boundaries |
| Perc | Kick = sine 150->40 Hz D 120 ms; hat = noise HP 6k D 30 ms; snare = noise BP 1.8k D 100 ms + sine 200 D 60 | 16-step hit masks |

**A region defines**: key + scale (e.g., D dorian), BPM (**explore 100-120, tense 130, boss 150**), one pattern per channel per intensity layer.

**Intensity layers** (0-3), swapped **only on bar boundaries**:
- 0 Explore: pad + sparse bass
- 1 Enemies alive in room: + perc (hats/kick)
- 2 Player HP <= 2 or >= 3 enemies: + lead, bass doubles
- 3 Boss: boss patterns, all channels, +30 BPM

Transitions between regions: cross-fade gain over **2 bars**. Boss kill: cut to silence for 1 bar, then hub motif. Death: music gain -> 0 over 300 ms, restart on respawn at layer 0.

---

## 5. Death & Failure

Principles for a 60-minute game: **the punishment is the retry itself.**

| Param | Value |
|---|---|
| Player HP | **5**, all damage is 1 (bosses' heavy attacks 2) |
| HP regen | none passively; **full heal at checkpoints**; enemies drop a heal pickup at ~20% chance (sim RNG), guaranteed if player HP <= 1 and no drop in the last 3 kills |
| Checkpoint density | every **60-90 s** of expected play, i.e., **every 2-3 rooms**; always: room *after* an unlock, room *before* a boss door, both ends of any long vertical shaft |
| Checkpoint activation | walk-through, automatic. No interaction prompt |
| Death penalty | **none**. No currency, no corpse run, no lost progress except position. Collected items and killed **mini**-bosses stay dead; regular enemies respawn |
| Hazard "soft death" (spikes, pits) | not a death: **-1 HP**, 6-frame freeze, 20-frame fade, respawn at the **last safe ground position in the same room**. Total ~ **40 frames** |
| Hard death (HP 0) | 6-frame freeze + 24-frame burst/fade -> 12 frames black -> respawn with 12-frame fade-in. Total **54 frames** (0.9 s). Input accepted from the first respawn frame |
| Boss retry | checkpoint is **adjacent to the boss door**, <= 3 s walk. Boss HP resets; boss intro is **a 60-frame** appearance the first time, **skipped** on retries |
| Death counter | shown on end screen only. Never during play |

Do not add: lives, currency loss, "return to bench" penalties, unskippable death animations, boss cutscenes on retry, or a "Continue?" prompt.

---

## 6. The First 90 Seconds

Zero text. Every lesson is a room shape with exactly one solution and no way to fail it.

**Beat 0 — 0:00-0:03. Arrival.** Screen fades from white. Player capsule drops **2 tiles** onto a floor in a small fixed-camera room — the landing plays squash + dust + SFX #2 before the player has touched a key. Music layer 0.

**Beat 1 — 0:03-0:10. Movement.** Only exit is right. Floor is flat for **10 tiles** — long enough to hit max speed and see run dust and the lean. A slow green pulsing thing is visible ahead: that's the goal, and it's the only thing that pulses.

**Beat 2 — 0:10-0:15. Step up.** A **1-tile step**, then a **2-tile step**. The player *must* press jump. On the first jump, SFX #1 + takeoff stretch.

**Beat 3 — 0:15-0:22. Gap.** A **3-tile gap** over a shallow pit (2 tiles deep, floor of the pit is safe, 1-tile step ladder back up). Failure costs 2 seconds and teaches "falling is fine." Second gap: **4 tiles**, pit again.

**Beat 4 — 0:22-0:30. Variable jump.** A **ceiling corridor 3 tiles tall** with a **1-tile gap** in the floor. A full jump slams the ceiling. The gap is trivially crossable with a tap. Right after: a 2-tile gap under a 4-tile ceiling that a full jump clears easily.

**Beat 5 — 0:30-0:40. First room transition + drop.** Corridor ends going **down** (a 1-tile-wide shaft, 8 tiles deep). Landing at terminal velocity: big squash, 2 px shake, big dust. There's a **checkpoint** right there so they have seen one before they can die.

**Beat 6 — 0:40-0:60. First enemy.** Flat **20-tile** floor with one **light enemy (small triangle)** that walks back and forth and does **not** attack — contact-damage patroller at **1.0 px/f**. It can be jumped over. Beyond it: a 3-tile wall. Then a **4-tile wall** they cannot clear. Dead end. Except—

**Beat 7 — 0:60-0:80. The first unlock.** A section of floor **crumbles** after 30 frames of standing. Below: a small round room with the **first unlock pedestal**. Walk into it: 12-frame hitstop, white flash 0.2, SFX #10, particles, and the player's capsule gains a **visible change**. [CORE HOOK: the unlock room's exit must be solvable *only* with the new mechanic, and the solution must be the mechanic's most basic input pressed once.]

**Beat 8 — 0:80-0:90. Prove it, then reward.** Back up through a second route to the room from Beat 6 where the light enemy now stands between the player and the exit with no room to jump — 3-tile ceiling. They must use the new mechanic on it. Hit flash, hitstop, death fragments, SFX #7, +2 px shake. The exit leads into the first real area and the music jumps to layer 1 for the first time.

Layout rules extracted, for the whole game:
- Every new verb gets: (1) a room where it's the only possible input, (2) a room where it's used against the previously-taught obstacle, (3) then freedom.
- No enemy attacks (only contact damage) until the player has a way to kill enemies.
- Pits in the first 5 rooms have floors.
- Checkpoint before the first enemy, ever.

---

## 7. Juice Budget — the 5 if only 5

1. **Input forgiveness: coyote (6f) + jump buffer (8f) + variable jump + corner correction (4 px).** The difference between "the game ate my input" and "I'm good at this."
2. **Hitstop (3/5/6f) + white hit flash (3f).** Combat without these is two shapes overlapping.
3. **Squash & stretch on jump/land + landing dust.** The player character is on screen 100% of the time.
4. **Camera: lookahead (40 px, lerp 0.05) + ground snap + fast-fall follow.** Bad camera is the most common reason a browser platformer feels amateur.
5. **The six core SFX (#1 jump, #2 land, #6 hit, #7 enemy death, #8 hurt, #10 collect) + the telegraph tick (#12).** A silent game with great SFX feels better than a musical game with silent hits.

Explicitly cut from the top 5: **screenshake** (add 6th, small), **particles beyond landing dust**, **room scroll transitions** (a hard cut is fine), **music** (7th).
