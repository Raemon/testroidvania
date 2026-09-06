# AESTHETIC DIRECTION — "Lantern & Ink"

## 1. THE VISUAL PITCH

**A drowned cathedral-city rendered as cut-paper stage scenery: flat layered silhouettes in deep ink, and the only warm thing in the world is the light the player carries.** Think Limbo's layered depth and Hollow Knight's ink weight, but lit like a stained-glass window at night — nearly everything is a dark shape, and color lives only in a few bright points (the player's light, enemy eyes, hazards, the region's bioluminescence). The look is built from value contrast and silhouette, which is exactly what canvas 2D is good at, and exactly what hides the absence of sprites.

**Visual language:**

- **Shape language.** Terrain is hard-edged, chamfered, architectural — 45-degree chamfers on every exposed corner, 4px. Living things are soft: circles, capsules, teardrops. Hazards are the only spiky things in the world. Instant three-way read: *angular = stone, round = alive, spiked = pain.*
- **Line weight.** No outlines on terrain (silhouette does the work). Entities get a 1.5px "ink" outline in the darkest ink color plus a 1.5px rim highlight on the side facing the player's light. UI lines are 2px, round caps, round joins everywhere. Nothing uses square caps.
- **Silhouette rules.** Every entity must be identifiable as a black shape on white. Enemies: each archetype gets one dominant silhouette. If two enemies have the same silhouette they are the same enemy with a different palette.
- **Readability by light, not color.** The player is the only *light-valued* moving thing: cream paper body (#EFE4C8) with dark ink details. Enemies are always *dark* bodies with exactly one bright feature — the eye — in the region accent color. Hazards are a *globally constant* hot coral (#FF4D5A) regardless of region, with animated diagonal hatching so they read even to colorblind players. Interactables pulse a warm cream glow ring at 0.8 Hz — the same warmth as the player, signaling "this is for you."
- **Depth by value.** Farthest = lightest, nearest = darkest. Foreground terrain is near-black; the sky/void is the lightest band. Fog planes sit between layers. This is the single most important rule; it is what makes the scene look composed instead of flat.

---

## 2. PALETTE SYSTEM

### 2a. Global value structure (the bands)

Every color belongs to a band. Bands have a fixed *lightness* range; regions change the *hue*. Values are approximate HSL L%.

| Band | L% | Role |
|---|---|---|
| **Void** | 10-12 | Farthest sky / abyss. Gradient top->bottom, slightly darker at bottom. |
| **Far** | 15-18 | Distant skyline silhouettes (parallax 0.2). |
| **Mid** | 20-26 | Nearer architecture (parallax 0.45-0.7). |
| **Fog** | 30-38 @ alpha 0.10-0.25 | Gradient planes between layers; also the "darkness" overlay tint. |
| **Terrain** | 3-5 | Collidable foreground. The darkest thing on screen. |
| **Terrain edge** | 38-46 | 2px top-edge bevel; 1px in darker (L 2%) on bottom edges. |
| **Enemy body** | 30-36 | Always >= 12 L-points from terrain and >= 8 from Mid. |
| **Accent** | 75-88, high chroma | Enemy eyes, region bioluminescence, ability color, glow. |
| **Hazard** | constant | #FF4D5A fill, #FFD3A0 highlight hatching. Same in every region. |
| **Player** | 85-90 | #EFE4C8 paper body, #1A1410 ink details, #FFF1C9 light core, #FFB347 flame. |
| **UI** | cream on ink | #F3E9D2 text, #9C8F78 dim text, #0B0D12 panel ink, #F3E9D2 @ 0.25 rules. |

### 2b. Per-region hue sets

Hazard, player and UI colors do **not** change between regions.

**Cistern** (waterlogged crypts; hue ~200)
```
void #0F1A24   far #16283A   mid #1E3A4E   fog #2A5468
terrain #070B10   edge #3C6A7C   enemy #24384A   accent #5FE3D0
```

**Ossuary / high places** (bone gardens, dust; hue ~275)
```
void #150F22   far #221A36   mid #2F2549   fog #4A3B6B
terrain #0A0710   edge #6B5A8C   enemy #3A2E52   accent #C9A0FF
```

**Foundry** (dead furnaces, ember light from below; hue ~18)
```
void #1C0F0B   far #2E1810   mid #452416   fog #6B3A22
terrain #0D0604   edge #8C4E2E   enemy #4A2A1C   accent #FFB84D
```
Accent is deliberately yellow-orange, not red, so it never competes with hazard coral. The Foundry's ground glow is a *bottom-up* void gradient — the only region lit from below.

**Verdant / overgrowth** (hue ~95)
```
void #0F1A12   far #1A2C1B   mid #29402A   fog #4A6A3E
terrain #060A06   edge #6E8C4A   enemy #2E4230   accent #C8F26A
```

**Finale — The Lantern Heart** (last 2-3 rooms + ending): *invert the value structure.* Void #E8E0CC, far #D2C8AE, mid #B8AC90, terrain #2A2418, edge #6B5D44, accent #FFD97A. Having spent the whole game in the dark, the inversion is the payoff.

### 2c. Keeping a dark enemy legible on a dark background

Three guarantees, all cheap, all always-on:

1. **The eye.** Every enemy has one accent-colored eye (L >= 75%) with a pre-rendered 12px glow sprite. Contrast ratio vs. any band >= 7:1. Even if the body vanishes, the eye tells you where and which way it faces.
2. **Backlight halo.** Behind every entity, a radial gradient in the region's *fog* color, radius 1.6x body, alpha 0.18 -> 0. Separates a L-33 body from a L-4 terrain block and from a L-24 mid layer alike.
3. **Directional rim.** A 1.5px stroke of the region *edge* color along the side of the silhouette facing the player (compute sign of dx; draw the silhouette path offset by (-sign*1.5, -1), stroke in edge color, then draw the body over it). Enemies visibly "catch the light."

Plus: enemy bodies are never darker than L 30%, terrain never lighter than L 5%.

---

## 3. RENDERING TECHNIQUES (ranked by impact / cost)

**1. Value-banded parallax silhouettes with fog planes.** *Impact: enormous. Cost: nearly free.*
Per region, a seeded generator makes 3 skylines: a list of (x, height, shape) where shape in {block, arch, spire, buttress}. Each layer is rendered *once* to an offscreen canvas 2x screen width, then scrolled with drawImage at parallax 0.2 / 0.45 / 0.7 (mod width for wrap). Between each pair of layers, a full-width linear gradient rect (fog color, alpha 0.22 at bottom -> 0 at 55% height). The void band is a vertical gradient. Total: 3 drawImage + 4 gradient fills per frame.

**2. Light-source darkness overlay.** *Impact: this is the identity. Cost: one full-screen composite.*
Maintain an offscreen "darkness" canvas. Each frame: fill with region fog color at alpha 0.55 (0.70 Ossuary, 0.40 Verdant). Then with `globalCompositeOperation = 'destination-out'`, draw a radial gradient at the light position: alpha 1.0 at r=0, 0.85 at r=90, 0 at r=260 (radii flicker +/-4% with a 7 Hz + 13 Hz sine sum). Also punch holes for every light source (save-lanterns r=140, enemy eyes r=28, hazards r=40, bioluminescent plants r=50). Draw the darkness canvas over the world, *under* the UI. Cost: 1 fill + N radial gradients (N < 20) + 1 drawImage.

**3. Procedural terrain bevels, cached per room.** *Impact: high — this is what stops tiles looking like tiles. Cost: zero per frame after caching.*
When a room loads, render its terrain once to an offscreen canvas: for every solid cell, fill terrain color; every exposed top edge, a 2px line in edge color; exposed bottom edge, 1px in L-2% black; exposed left/right, 1px in edge color at 40% alpha; every exposed convex corner gets a 4px 45-degree chamfer (fill a triangle in the void color). Add deterministic "mortar" cracks: seeded random, 1 in 6 cells gets a 1px line in L-2% black. Draw with one drawImage.

**4. Pre-rendered glow sprites (no per-frame shadowBlur).** *Impact: high. Cost: low if done this way, ruinous otherwise.*
At load, for each accent color and for the player light, render radial-gradient circles at 16/32/64/128 px to small canvases. Draw them with `'lighter'` composite. `ctx.shadowBlur` is **banned in the game loop**. Budget: <= 150 glow draws per frame.

**5. Ambient particle field.** *Impact: medium-high (the scene breathes). Cost: low.*
One pooled system, 400 particles max, plain arrays. Per region: Cistern — 80 slow-rising bubbles/motes, 1-2px, accent at alpha 0.35; Ossuary — 120 falling dust flecks, cream, alpha 0.25; Foundry — 60 rising embers with brightness flicker; Verdant — 90 drifting spores with sine x-wobble. Seeded RNG per room so screenshots reproduce.

**6. Volumetric light shafts.** *Impact: high in rooms that have them. Cost: 3-6 gradient fills.*
Room data marks "windows." For each: a parallelogram (top width 40, bottom width 160, height to floor, slant -15 deg) filled with a linear gradient from accent-tinted cream at alpha 0.10 (top) to 0 (bottom), composite `'lighter'`. Sway the bottom x by +/-6px on a 0.1 Hz sine. Drawn *behind* mid parallax but in front of far parallax.

**7. Entity ink-and-rim rendering.** *Impact: medium-high. Cost: 2x the silhouette path per entity.*
Every entity: halo (2c.2) -> rim pass -> body fill -> ink stroke 1.5px in #0B0D12 -> features (eye + glow sprite).

**8. Water plane with reflection.** *Impact: very high in Cistern. Cost: ~60 drawImage strips.*
Room marks a water surface at y = W. Draw world above W normally. Then draw the canvas region from (W-200 .. W) *flipped* into the area below W, in 4px-tall horizontal strips, each x-offset by `sin(t*2.1 + row*0.35)*3` px, alpha 0.35, then overlay a linear gradient (fog color, alpha 0.5->0.85). A 1px line of accent at 40% alpha marks the surface, with 3-4 slow-moving highlight dashes. Entering water spawns ring ripples.

**9. Motion trails.** *Impact: medium. Cost: trivial.*
Ring buffer of last 8 positions/poses at 16 ms intervals. Draw the body capsule at each with alpha 0.30*(1-i/8), composite `'lighter'`.

**10. Screen grade: vignette + region tint + hit flash.** *Impact: medium. Cost: 2 draws.*
Pre-render a vignette (radial gradient, transparent center -> #000 at alpha 0.45 at corners) once; drawImage every frame. Then a full-screen rect in the region's fog color with `'multiply'` at alpha 0.12 — this unifies every element into the region's hue. Hit flash: full-screen rect, hazard coral, alpha 0.35 decaying over 90 ms, `'lighter'`. Low health (< 25%): vignette alpha pulses 0.45 -> 0.65 at 1.2 Hz, tints toward #3A0A10.

**11. Camera language.** Camera lerps to target at 0.08/frame; leads 40px in facing direction; hit-stop 3 frames on any melee hit; screen shake as decaying seeded noise (6px on hurt, 12px on boss stomp, decay 0.85/frame — additive to camera, never to UI). Room transitions: 220 ms slide + darkness overlay alpha to 1.0 and back.

**12. Deterministic film grain.** Pre-render a 256x256 noise tile (cream, alpha 0-0.05). Each frame draw it tiled with offset `(hash(frame)%256, hash(frame*7)%256)`. Reproducible because the offset is a function of frame count. **Skip CRT/scanlines entirely** — they fight the cut-paper concept.

**13. Heat shimmer (Foundry only).** Same strip trick as water: redraw the bottom 120px in 4px strips with `sin(t*6 + row*0.5)*1.5` x-offset. ~30 draws.

Perf floor for all of the above: ~800 draw ops. Well inside budget.

---

## 4. ANIMATION WITHOUT SPRITES

**Approach: small 2D capsule rigs + procedural gait + spring-driven secondary motion.** Each character is a list of *bones* (point pairs) with a thickness, drawn as round-capped thick lines, plus a few shape primitives. Poses come from parameters, not keyframes. Secondary elements are Verlet chains. Everything is a function of (velocity, grounded, time, phase) — deterministic, no animation data.

Common rig services (write once, use everywhere):
- `spring(current, target, vel, stiffness, damping, dt)`
- `verletChain(points, anchor, gravity, segLen, iterations=3)`
- `ik2(hip, footTarget, upperLen, lowerLen, bendSign)` — analytic two-bone IK
- `squashStretch(scaleY)` — apply `scale(1/scaleY, scaleY)` about the feet

### Player
Height 36px, width 18px visual (hitbox smaller; see game-feel doc).

- **Body:** capsule from hip (0,-14) to shoulder (0,-26), thickness 9, fill #EFE4C8, ink 1.5px.
- **Head/hood:** circle r=6 at (0,-31) with a teardrop hood (Bezier) trailing back 6px. Face is a dark crescent (#1A1410) on the facing side.
- **Legs:** 2 x ik2, upper 9, lower 9, thickness 5. Hip at (+/-2,-14). Foot targets: `phase = distanceTraveled / 28` (stride 28px). Foot i uses `phase + i*0.5`; x = `cos(2*PI*phase)*11`, y = `max(0, sin(2*PI*phase))*(-6)`. Idle: feet planted +/-5, body bobs 1px at 0.9 Hz.
- **Weapon arm:** a bone from shoulder to hand at (facing*9, -22). What hangs from the hand is a *pendulum*: angle spring toward `-vx*0.012` with stiffness 60, damping 6, plus gravity restoring. Flame/glow height scales with `1 + |pendulumVel|*0.05` and flickers +/-10% at 11 Hz (seeded noise). This is the light-source position for section 3.2.
- **Scarf:** Verlet chain, 7 segments x 5px, anchored at the neck, gravity 0.35, wind = `-vx*0.4` on every point, damping 0.96. Tapered polyline (thickness 4 -> 1.5), color #B8452E — the only saturated red on the player, the "hero flag".
- **Lean:** body rotation = `clamp(vx*0.035, -0.25, 0.25)` rad about the hip.
- **Squash/stretch:** jump takeoff scaleY 1.18 for 60 ms -> 1.0 over 120 ms. Rising 1.06; apex 1.0; falling fast (vy > 6) 1.10. Landing scaleY 0.72 for 70 ms, then spring back (stiffness 180, damping 12), overshooting to ~1.05 once. Dust puff of 6 particles on land.
- **Attack:** arm rotates -50 deg (anticipation, 50 ms) -> +120 deg (strike, 70 ms) -> return (spring, 200 ms). A 30-degree arc of glow sprites trails the weapon head. Hit-stop 3 frames on contact.
- **Hurt:** rig flashes solid #FF4D5A for 2 frames, then alternates alpha 1.0/0.4 at 12 Hz for the i-frame window; scarf gets a +6 velocity impulse away from the hit.
- **Dash:** scaleX 1.35 / scaleY 0.8 for the dash duration; trail (3.9); scarf goes fully horizontal.

### Enemy archetype A — "Tick" (ground crawler)
Body: ellipse 22x14, region enemy color, ink outline. One eye r=3 accent on the facing side. Six legs: three per side, each a 2-bone ik2 (7+7), thickness 2, hip at +/-(4, 8, 12) along the body. **Tripod gait:** legs {L1, R2, L3} share phase p, the others p+0.5; `p = distance/16`; foot x-target = hipX + facing*(cos(2*PI*p)*6), lift 3px on swing. Idle: each leg gets a seeded random 0.3 Hz micro-adjust of +/-1px. Body bobs 1px opposite the swinging tripod. On alert (player within 140px): eye glow doubles (32px), body raises 3px, 120 ms anticipation before lunge. Death: body flattens to scaleY 0.3, legs splay outward over 200 ms, then 10 accent particles + fade.

### Enemy archetype B — "Drift Jelly" (floater)
Body: bell — a half-ellipse 18 wide, height `h = 12 + 3*sin(2*PI*t*0.8)`; when h is shrinking, apply an upward impulse 0.4 (it "pumps" and rises — visually motivated locomotion). Fill enemy color at alpha 0.85 with a lighter inner ellipse (fog color at alpha 0.5) — the only semi-translucent enemy. Eye r=2.5 accent, centered. Four tendrils: Verlet chains of 6 segments x 4px, anchored at bell rim at x in {-7,-2,2,7}, gravity 0.15, wind = -vel*0.6, damping 0.97, drawn 1.5px in accent at alpha 0.6. Tendril tips are the hurtbox; they glow (8px sprite) when charged. Attack: bell contracts to h=6 over 200 ms, then a 4-step 16px accent glow pulses down the tendrils and it lunges. Death: bell pops — 6 arc-shaped fragments fly outward and fade in 300 ms.

### Enemy archetype C — "Reliquary Knight" (tall sentinel / miniboss)
Height 64. Body: capsule hip (0,-28) -> shoulder (0,-52), thickness 14. Head: a rounded rect 10x12 "visor" with a single horizontal eye-slit 8x2 in accent (its whole face is the eye). Legs: ik2 (16+16), thickness 7, stride 40; a landing bob (body y +3 for 80 ms) on each footfall with 2px camera shake and a 4-particle dust puff. Arms: ik2 (14+14); the right arm holds a blade — a long tapered polygon 44px in *ink* color with a 1px edge in edge color (it reads because it is darker than the body with a bright edge). Cape: Verlet chain 9 x 6px anchored at both shoulders (two chains, filled polygon between them). Telegraph: blade raises over 400 ms (shoulder rotates -140 deg), eye-slit brightens to 100% and its glow goes to 64px; then a 90 ms swing to +40 deg with a 5-glow-sprite arc; recovery 500 ms with the blade dragging (spark particles). Hurt: only the rim flashes accent; no i-frame blink (it should feel heavy). Death: kneels (legs bend, body y +18 over 600 ms), eye-slit fades over 1.5 s, cape settles, then 24 falling rect fragments.

---

## 5. UI / HUD / TYPOGRAPHY

**Decision: a code-defined stroke font ("Wick") for everything the player sees; system font only for debug overlays.** System fonts vary by OS, so screenshot tests would be flaky and the game would look different on every machine; a stroke font is 100% deterministic and *is* an identity. Wick: uppercase A-Z, 0-9, and `. , : ! ? - / ( ) '` — 46 glyphs, each a list of polylines on a 4-wide x 6-tall unit grid. Drawn with lineWidth = 0.14*size, round caps and joins, letter-spacing 0.25 em. Two weights: *regular* (0.14) and *display* (0.22, plus a 0.06 offset ink shadow). Lowercase renders as small caps at 0.78 size. At 12px it's still readable because every stroke is >= 1.7px.

### HUD
- **Health = flames.** Top-left, a row of small lanterns (each 10x14 rounded rect outline in cream at alpha 0.7, with a flame teardrop inside, 6px tall, #FFB347 with #FFF1C9 core). Losing a point: that flame *gutters* — shrinks over 300 ms with 4 rising smoke particles, leaving an empty outline. Regaining: relights with a spark. At 1 HP the last flame flickers hard (height +/-30% at 9 Hz).
- **Abilities.** Bottom-left, a row of 28px circles in ink with a 1.5px cream ring. Each ability is a 16px stroke glyph in its region's accent. Cooldown: the ring fills as an arc. Unobtained abilities are not shown at all.
- **Mini-map.** Top-right, 120x80, ink panel at alpha 0.6 with a 1px cream rule; shows the 5x3 rooms around the current one as 1px rounded rects in cream alpha 0.5, current room filled in region accent at alpha 0.6 with a pulsing dot.
- **No text popups in-game** except item names on pickup (Wick display 20px, rises 12px and fades over 1.2 s).

### Map screen
Full-screen ink panel (#0B0D12 at alpha 0.92) over the paused game. Rooms are rounded rects (radius 3) in cream, but each vertex is jittered +/-1.5px by a seeded hash of the room id — so it looks hand-drawn and is byte-identical every time. Explored rooms: filled cream at alpha 0.12, 1.5px cream outline. Seen-but-not-entered: dashed outline, alpha 0.4. A 2px inner border in the room's *region accent* so regions read as territories. Doors: 3px gaps in the outline; locked doors get a small hazard-coral tick. Icons: save-lantern, boss (a circle with two dots), unclaimed items you've *seen* (a small "?"). Current room pulses accent alpha 0.3 -> 0.7 at 0.8 Hz. Region name in Wick display 28px top-center with a 1px underline rule; completion % bottom-right. The panel carries the film grain at 2x alpha so it reads as paper.

### Pause screen
The game stays rendered underneath, frozen. The darkness overlay ramps 0.55 -> 0.85 over 250 ms and the light radius shrinks to 60% — the world literally dims. Center: a vertical menu in Wick display 24px (RESUME / MAP / OPTIONS / QUIT TO TITLE), 44px line height; the selected item is accent-colored with a small flame glyph to its left that flickers. Options: music, sfx, screen shake, flash reduction.

### Title screen
Void gradient (Cistern) with far and mid parallax drifting at 4px/s. Above center, a single lantern hangs on a 90px chain from the top of the screen, swinging as a damped pendulum (period 2.4 s, amplitude decaying from 18 to 6 degrees over 20 s, then sustained by "wind" gusts every 8-14 s). Its light is the only light: the darkness overlay is at 0.75 and the lantern's hole (r=200) sweeps across the title, so the title glyphs — the game name in Wick display 72px, cream, with a 0.06-em ink shadow — are *revealed by the swing*. Motes drift. "PRESS ANY KEY" in Wick 16px at alpha pulsing 0.3-0.8 at 0.5 Hz. On keypress: the lantern drops, falls to the floor with a bounce (squash 0.7), the flame flares to r=600 washing the screen to cream over 300 ms, then the game fades in from cream. One continuous shot from title to gameplay.

### Ending / credits
Credits scroll bottom->top over the relit city: role in Wick 14px dim (#9C8F78), name in Wick display 22px cream, 90px between entries, 28 px/s. Parallax layers scroll *sideways* so the camera appears to travel. Final card: the lantern glyph alone, flame steady, "THANK YOU FOR PLAYING" in Wick 18px; holds until input.

---

## 6. AUDIO PITCH

**Wet stone and glass.** Every sound lives inside one huge dark hall: a shared synthesized reverb, sparse bell-like tones, subterranean drones, and SFX made of tiny filtered clicks and breaths rather than arcade blips. The music is slow and modal, more atmosphere than melody, until combat pulls a pulse out of the dark. Nothing is ever harsh; the whole score sits below 8 kHz and the loudest thing is always the player's own light.

### 6a. Synth palette

Shared infrastructure (built once):
- **Reverb:** ConvolverNode with a generated impulse: 2.8 s stereo buffer of white noise x `exp(-t*3.2)`, run through a one-pole lowpass with cutoff sweeping 6 kHz -> 800 Hz across the tail, plus a 12 ms pre-delay of silence. Cistern 2.8 s; Ossuary 3.6 s dry-ish; Foundry 1.6 s brighter; Verdant 2.2 s with a 60 ms early reflection bump. Only tail length and lowpass change per region.
- **Feedback delay:** DelayNode (dotted 8th at region tempo) -> GainNode 0.38 -> lowpass 2.2 kHz -> back into the delay. Wet send per voice.
- **Noise buffer:** 2 s white noise AudioBuffer, looped, shared by all noise voices.

| Voice | Recipe |
|---|---|
| **Bell** | 2 sine oscs: f and f*2.756 (inharmonic partial). Amp: A 4 ms, exp decay to 0 over 1.8 s (partial over 0.5 s). Partial gain 0.35. Lowpass 5 kHz. Reverb send 0.55, delay send 0.3. |
| **Pad** | 3 sawtooth detuned -7/0/+7 cents into lowpass 380 Hz with an LFO (sine 0.08 Hz) modulating cutoff +/-180 Hz. Amp: A 1.8 s, R 3.5 s. Gain 0.12. Reverb send 0.7. |
| **Drone** | sine at f + triangle at f/2 (gain 0.5) + sine at f*1.5 (gain 0.15, combat only). Very slow amp LFO (0.05 Hz, +/-15%). Highpass 30 Hz. Never stops; changes pitch with a 4 s glide. |
| **Pluck** | Karplus-Strong-ish: 8 ms noise burst -> DelayNode (1/f s) -> Gain 0.985 -> lowpass 3.5 kHz -> feedback. Tapped after the filter. Decays in ~1 s. |
| **Sub** | sine at f, A 25 ms, D 0.35 s. Gain 0.5. No reverb (keeps the low end dry). |
| **Breath** | noise -> bandpass (center = param, Q 1.2) -> amp env. The workhorse for SFX. |
| **Tick** | sine with pitch env f0 -> f0*0.5 over 30 ms; amp A 1 ms, D 40 ms. UI and footsteps. |

### 6b. Music

**Engine:** a 16th-note step sequencer with lookahead scheduling (setInterval 25 ms, schedule up to 120 ms ahead against `AudioContext.currentTime`). Song data per region = tempo, mode root, a chord loop (4 chords x 2 bars), and 4-5 *layers*, each a 16- or 32-step pattern of (step -> note offset, velocity). Layers are gain-controlled; the sequencer never stops or restarts when state changes — only layer gains ramp (linearRampToValueAtTime, 1.5 s in / 3 s out), so there is no "combat music starts" jolt.

**State -> layers:** an `intensity` scalar 0..1: exploration 0 (drone + pad + sparse bells), an enemy aware of the player 0.45 (+ bass pluck pulse), damage in the last 4 s 0.75 (+ percussion), boss 1.0 (+ lead, tempo +8 BPM via a 2-bar ramp, percussion doubles). Intensity rises fast (0.5 s) and falls slow (6 s), so music doesn't flap. Region change crossfades over 4 s. Save-lantern rooms force intensity 0 and add a 5th-above harmony to the pad.

**Cistern, concretely.** D Dorian, 72 BPM, 4/4, 16 steps per bar.
- Chords (2 bars each): **Dm9 -> Fmaj7 -> Am7 -> Cmaj7**. Bass roots D2 (MIDI 38), F2 (41), A2 (45), C3 (48).
- **Drone:** D1 (26) sine + D0 triangle, constant. (Moves to A1 during Am7 bars, 4 s glide.)
- **Pad:** chord tones voiced closed above C4 — Dm9: D4 F4 A4 E5; Fmaj7: F4 A4 C5 E5; Am7: A4 C5 E5 G5; Cmaj7: C5 E5 G5 B5. Retrigger every 2 bars.
- **Bell arp** (32-step over 2 bars; "." = rest; degrees relative to chord root using chord tones {1,3,5,7,9}):
  `1 . . 5 . . 9 . . . 3 . . . 7 . | . . 5 . . . 1 . . 9 . . . . 3 .`
  Bells voiced in octave 5-6. Every 8th playthrough a seeded RNG drops 2 random notes — the arp never sounds like a loop.
- **Bass pluck** (intensity >= 0.45): 16-step `R . . . . . R . . . R . . . b7 .`
- **Percussion** (intensity >= 0.75): "stone" kick = Sub 55 Hz with pitch env 110->55 over 40 ms on steps 1 and 9; "drip" = Tick 2.4 kHz on steps 4, 7, 12 (vel 0.25); "hiss" = Breath (bandpass 6 kHz, 60 ms) on every off-beat 8th at vel 0.12.
- **Lead** (boss only): Pluck, 4-bar phrase D5 F5 A5 G5 | F5 E5 D5 . | C5 D5 F5 E5 | D5 . A4 . , vel 0.5, delay send 0.5.

Other regions: **Ossuary** — F# Phrygian, 60 BPM, F#m -> Gmaj7 -> F#m -> Bm (the bII gives the unease), bells replaced by a detuned pad and slow pluck, percussion is bone-dry Ticks with no reverb. **Foundry** — A minor pentatonic with a b5 blue note, 96 BPM, one chord (Am) with a bass ostinato `A . A . C . A . G . A . Eb . A .` in Pluck, Sub kicks on all four beats; the "melody" is a rising pad every 8 bars. **Verdant** — G Lydian, 84 BPM, Gmaj7 -> Amaj7 -> Gmaj7 -> Bm7 (the #4 lift), bells in octave 6 with heavy delay, a Pluck lead answering in call-and-response; the brightest material in the game.

### 6c. SFX recipes

Every SFX gets a deterministic +/-4% pitch variation from a seeded RNG (seeded by frame count so replays match).

1. **Jump** — Breath, bandpass 900 -> 1800 Hz over 80 ms, A 5 ms D 110 ms; plus Tick 520 Hz vel 0.3. 120 ms.
2. **Land** — Sub 90 -> 45 Hz over 60 ms, A 2 ms D 120 ms, gain scaled by fall speed; plus Breath bandpass 400 Hz Q 0.8, 60 ms. 130 ms.
3. **Footstep** — Tick 1100 Hz (stone) / 700 Hz (metal) / 380 Hz with Breath 200 Hz (water), vel 0.15, alternate L/R pan +/-0.15. 45 ms.
4. **Weapon swing** — Breath bandpass 2.5 kHz -> 600 Hz over 90 ms (a whoosh that darkens), A 10 ms D 100 ms. 110 ms.
5. **Hit enemy** — Tick 240 -> 80 Hz over 50 ms vel 0.7 + Breath bandpass 3 kHz 30 ms + Bell at 1319 Hz (E6) vel 0.2 with reverb 0.6 (the "glass" in every hit). 350 ms incl. tail.
6. **Player hurt** — Sub 120 -> 40 Hz 90 ms + Breath lowpass 500 Hz 150 ms + a *detuned* Bell pair (440 & 466 Hz, beating) vel 0.35 decaying 700 ms. Ducks music. 700 ms.
7. **Enemy death** — 3 Ticks descending (880, 660, 440 Hz) 40 ms apart, then Breath bandpass 1.2 kHz -> 200 Hz over 300 ms with reverb 0.8. 400 ms.
8. **Pickup** — Bell 1568 Hz (G6) vel 0.25, plus a second Bell a fifth up 50 ms later; chained pickups within 1 s step up the D Dorian scale (max 8 steps). 600 ms.
9. **Ability pickup** — a rising Pad chord (Dm9 -> Dmaj9 modulation, 2 s), 5 Bell strikes ascending D5 A5 D6 F#6 A6 at 120 ms spacing, delay send 0.6, reverb 0.9; Sub swell 55 Hz 1.5 s. 4 s.
10. **Door open (stone)** — Breath lowpass 300 -> 120 Hz over 600 ms, gain 0.5, with 8 Tick "grinds" at 90 Hz every 70 ms; ends with Sub thud 60 Hz. 800 ms.
11. **Save lantern lit** — Breath bandpass 3 kHz 40 ms ("fwoomp") -> Breath lowpass 800 Hz 400 ms -> Bell D6 vel 0.4 + Bell A6 vel 0.2 with reverb 0.9. 1.2 s.
12. **Hazard contact** — as Player hurt plus 3 Ticks at 3 kHz 15 ms apart, no reverb on the ticks. 700 ms.
13. **Dash** — Breath bandpass 1.5 kHz -> 4 kHz over 120 ms, A 5 ms D 140 ms, delay send 0.4; plus sine 200 -> 400 Hz 100 ms at vel 0.15. 160 ms.
14. **Menu** — move: Tick 1200 Hz vel 0.2, 30 ms, dry. Confirm: Bell 1047 Hz (C6) vel 0.3, reverb 0.5, 500 ms. Back: Tick 800 -> 400 Hz 60 ms.
15. **Map open / close** — Breath bandpass 2 kHz 80 ms ("paper") + Tick 600 Hz; close = reversed sweep. 100 ms.
16. **Boss roar / stomp** — roar: 2 saw oscs at 55 & 82 Hz through lowpass 400 -> 1200 -> 300 Hz over 900 ms, A 80 ms D 900 ms, plus Breath lowpass 300 Hz; stomp: Sub 70 -> 30 Hz 120 ms at gain 0.9 + Breath 150 Hz 200 ms. Screen shake tied to stomp.
17. **Low-health heartbeat** — every 1.1 s: Sub 60 Hz 80 ms vel 0.4 then 50 Hz 80 ms vel 0.25, 140 ms apart. Sidechains music -3 dB on each beat.

### 6d. Mix

**Graph:** each voice -> its bus (`sfx`, `music`, `ui`) -> bus gain -> `master` DynamicsCompressor (threshold -12 dB, knee 6, ratio 4, attack 8 ms, release 180 ms) -> a second DynamicsCompressor as a limiter (threshold -2 dB, ratio 20, attack 1 ms, release 60 ms) -> destination. Reverb and delay are *sends*.

**Levels:** music 0.55, sfx 0.8, ui 0.5, reverb return 0.35, delay return 0.25. Music peaks around -16 dBFS, SFX -10.

**Ducking:** on Player hurt and Boss stomp, music bus ramps to 0.6x over 40 ms and back over 900 ms. During ability pickup, SFX bus ducks to 0.3x. Pause: a lowpass on the music bus sweeps to 600 Hz over 300 ms.

**Anti-harshness rules (these prevent the web-game-audio mess):**
- No unfiltered square or sawtooth ever reaches the output; every voice ends in a lowpass <= 8 kHz.
- Minimum amp attack 1 ms, minimum release 8 ms, always via ramps — **never `gain.value = 0`** (that's the click).
- **Voice limiting:** max 3 concurrent per SFX id; a 4th steals the oldest (ramp out over 10 ms). Max 24 SFX voices total.
- Same SFX cannot retrigger within 35 ms.
- Pitch variation +/-4% on every SFX so repeats don't phase into a buzz.
- Distance attenuation for enemy sounds: gain = clamp(1 - dist/600, 0.1, 1), pan = clamp(dx/500, -0.7, 0.7).
- AudioContext created and `resume()`d on first user gesture; until then every play call is a no-op.
- The drone is high-passed at 30 Hz and Sub is the *only* voice allowed below 60 Hz.

---

## 7. SIGNATURE MOMENTS

### 7.1 Ability pickup — "the light learns a color"
1. The ability sits in a stone alcove as a floating accent-colored ember (glow 32px, bobbing 4px at 0.6 Hz) with 12 orbiting motes. Its darkness-hole radius is 90.
2. Player touches it. **Hit-stop 12 frames.** All particles freeze. Music intensity forced to 0; SFX bus ducks.
3. The ember flies to the player's light over 400 ms on an ease-in curve; on arrival the flame *changes color* to the ability's accent for 2 s, and its darkness hole expands from r=260 to r=900 over 1.2 s (the whole room lights up — you see architecture you couldn't see before), then settles back to 320 (permanently +60: **every ability makes the world literally brighter**).
4. Audio: the rising Pad chord and the five ascending Bells; Sub swell under it.
5. Item name in Wick display 28px rises from the player; below it, in Wick 14px dim, the input hint. The scarf whips outward in a 360-degree ring of 24 accent particles.
6. Music returns over 3 s, now with a new permanent bell note added to the arp (each ability adds one).

### 7.2 Boss entrance
1. Player enters a wide hall; the door grinds shut behind (SFX 10). Music intensity drops to 0; only the drone remains, then glides down a tritone over 3 s.
2. Ahead, past the light's reach, a single horizontal accent slit appears at head height (glow 64px). Two seconds of nothing but that and dust.
3. **Stomp** (SFX 16, shake 12px): the darkness overlay flashes to alpha 0.2 for 2 frames — the whole hall revealed for a split second, the boss silhouette 300px away, then dark again. Stomp again 1.2 s later: 200px. Third: 100px, now within light range; its rim-light catches, the cape settles.
4. The boss raises its weapon (400 ms telegraph), the eye flares, and the *title* draws itself in Wick display 32px at the bottom, stroke by stroke over 600 ms (animate polyline length), region-accent colored.
5. Boss music enters on the downbeat of the swing: percussion full, lead phrase, tempo ramp. Reverb switches to the 3.6 s variant for this room only.

### 7.3 Region reveal
1. A long vertical shaft climbed from the Foundry: ember palette, bottom-lit void, heat shimmer.
2. As the player rises, the region crossfade begins 4 rooms early: the palette lerps per band, driven by player y, not time — so it's reversible and deterministic.
3. The top: the first light shaft the player has ever seen, at alpha 0.16, cream-green, crossing the whole screen diagonally. Spores drift down through it.
4. The darkness overlay alpha, >= 0.40 the entire game, ramps to 0.22 over the last room. The player's light, for the first time, isn't the brightest thing on screen.
5. Music: the Foundry ostinato thins to a single Pluck, the Verdant bells enter one at a time on the G Lydian chord with delay send 0.7; the #4 (C#6) lands as the player's feet touch the top ledge. Region name in Wick display 36px, letter-spaced 0.5 em, fades in over 1.5 s, holds 2 s.

### 7.4 Lighting a save-lantern
Small, but it happens many times and should be lovely every time. The unlit save-lantern is a tall 20x60 iron lantern (ink with an edge-colored rim) on a plinth. Player presses up: the arm reaches out (300 ms), a 3-frame hit-stop, then SFX 11's "fwoomp" as the flame appears — a teardrop that overshoots to 2x size and springs back — and its darkness hole opens 0 -> r=140 over 500 ms with an ease-out. Twelve motes spiral up. Health flames relight one per 80 ms with a spark each. The music adds its fifth-harmony pad. The mini-map's room icon gets the lantern glyph. Nothing else — no text, no menu.

### 7.5 The ending — relighting the city
1. The final strike. The inverted palette washes to pure cream over 2 s with a Sub swell and a single Bell at D6, reverb 1.0.
2. Cut to black (600 ms, silence except the reverb tail).
3. Fade up on the *first room of the game*, but the camera is pulled back 3x (the whole cathedral-city as parallax silhouettes fills the screen). Completely dark: darkness overlay at 0.95. The player's light is a single point.
4. One by one — every 700 ms, accelerating to every 150 ms — every save-lantern the player lit during the game lights up at its true world position on this pulled-back map (data you already have). Each is a Bell at a D Dorian scale note ascending, delay send 0.6, and a darkness hole opening to r=140. After 8, the bells become the full arp; after 20, the drone changes to D major.
5. When the last is lit, the darkness overlay ramps to 0 over 6 s. The city is fully visible for the first time, void lerped toward dawn (#0F1A24 -> #3A4A5C at the horizon). The far layer begins to scroll sideways. Credits begin. The player's small figure stays on screen, scarf drifting, light swinging, idle-breathing, for the whole scroll.

---

## 8. CHEAP WINS vs. EXPENSIVE — if only six things ship

1. **Palette system + value-banded parallax + fog planes.** Without this nothing else matters; with only this the game already looks composed. Cost: low.
2. **Light-source darkness overlay + pre-rendered glow sprites.** The identity and the readability system in one. Cost: low-medium.
3. **Player rig with gait, squash/stretch, scarf, and pendulum light.** The player is on screen 100% of the time. Cost: medium.
4. **Audio chain + the 17 SFX.** Shared reverb, buses, limiter, voice limiting. Good soft reverberant SFX make a game feel finished even with placeholder art. Cost: medium.
5. **Sequencer + one region's material done properly + 3-layer intensity.** Reused with different data for the others. Cost: medium.
6. **Wick stroke font + flame HUD + map screen.** Deterministic typography, the health metaphor, a hand-inked map. Cost: medium.

Next tier: terrain bevel caching, water reflection, the two enemy rigs, the ability-pickup moment, the title screen. Leave for last: light shafts, film grain, heat shimmer, the Knight rig, the inverted finale palette, and the ending sequence — beautiful, but polish on top of the six above.
