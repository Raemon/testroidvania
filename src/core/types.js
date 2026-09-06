/**
 * The GameState schema. Every later agent annotates against these typedefs, so
 * fields for Phase 2/3 systems (pin, abilities, entities, progress) are declared
 * here now even though nothing implements their behaviour yet. Declaring the shape
 * early is what lets `tsc --checkJs` catch `state.playr` and `player.hpp`.
 *
 * Rules that the types cannot express but which hold everywhere:
 *  - all positions and velocities are world units / units-per-frame (60 Hz fixed);
 *  - all timers are integer frame counts, counting down to 0;
 *  - `step()` returns a fresh object graph for anything that changed (R3).
 */

/** @typedef {number} InputMask 16-bit mask of `IN` bits for one frame. */
/** @typedef {number} Seed 32-bit unsigned mulberry32 state. */

/**
 * @typedef {'idle'|'run'|'jump'|'fall'|'hurt'|'dead'} PlayerAnimState
 */

/**
 * @typedef {'zip'|'deepPin'|'reel'|'ricochet'|'twinPin'} AbilityId
 */

/**
 * @typedef {'wood'|'stone'|'metal'} Material
 */

/**
 * @typedef {'held'|'flying'|'embedded'|'pinned'|'dropped'|'returning'} PinState
 */

/**
 * An axis-aligned box. `x`,`y` is the top-left corner.
 * @typedef {{ x:number, y:number, w:number, h:number }} AABB
 */

/**
 * @typedef {object} Player
 * @property {number} x            left edge of the hitbox
 * @property {number} y            top edge of the hitbox
 * @property {number} vx
 * @property {number} vy
 * @property {number} w
 * @property {number} h
 * @property {boolean} grounded
 * @property {boolean} onOneWay   standing on a one-way platform, so down+jump drops through
 * @property {-1|1} facing
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} iframes      frames of invulnerability remaining
 * @property {number} hurtFrames   frames of lost control remaining
 * @property {PlayerAnimState} state
 * @property {number} coyote       frames of coyote time remaining
 * @property {number} jumpBuffer   frames a buffered jump press stays live
 * @property {number} jumpFrames   frames since the current jump started, 0 when not jumping
 * @property {boolean} jumpHeld    JUMP was held on the previous frame of this jump
 * @property {boolean} jumpCut     the one-shot jump-cut has already fired
 * @property {number} dropThrough  frames one-way platforms are ignored
 * @property {number} fallFrames   consecutive frames with vy > 0
 * @property {{x:number,y:number}} safeGround last standing position, for hazard respawn
 * @property {boolean} perch       standing on a wall pin; horizontal input is ignored
 * @property {boolean} hang        hanging off an embedded wall pin
 * @property {boolean} hangBelow   hanging under a ceiling pin's pole (Zip arrival)
 * @property {number} hangCooldown frames before a pin may be grabbed again
 * @property {number} zipFrames    frames elapsed in the current Zip, 0 when not zipping
 * @property {number} zipVx        the Zip's own velocity, for the jump-cancel carry
 * @property {number} zipVy
 * @property {number} throwFreeze  frames of frozen horizontal velocity during a throw
 * @property {number} jabFrames    frames elapsed in the current jab, 0 when idle
 * @property {number} jabHits      entities already hit by the current jab
 * @property {number} deadFrames   frames spent dead, counting up to the respawn
 * @property {number} stride       distance walked since the last footstep
 * @property {boolean} inWater     the body is in water, for the entry/exit ripple
 * @property {string} nearDoor     door id the player is close enough to open, '' for none
 */

/**
 * The Pin. `x`,`y` is its anchor: the centre while flying or dropped, the surface
 * contact point while embedded, the hand while held. `nx`,`ny` is the surface
 * normal it stands out along, which is what turns an embed into a platform.
 *
 * @typedef {object} Pin
 * @property {PinState} state
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {number} travelled     units flown since the throw, for the range cap
 * @property {Material|null} surface material it is embedded in
 * @property {-1|1} dirX
 * @property {-1|0|1} dirY
 * @property {number|null} hostId   entity a `pinned` Pin is stuck through
 * @property {number} startup       frames of throw startup left; the Pin is still held
 * @property {-1|0|1} aimX          aim locked at the press frame
 * @property {-1|0|1} aimY
 * @property {number} nx            surface normal, pointing out of the material
 * @property {number} ny
 * @property {boolean} inert        spent: past range or clanged, so it only falls
 * @property {number} clang         frames of clang flash left
 * @property {number} away          frames spent out of bounds or in a kill volume
 * @property {number} lock          frames before the next throw is allowed
 * @property {number} hostTimer     frames a `pinned` enemy stays helpless
 * @property {number} bounces       mirror-bounces already spent (A4 Ricochet)
 * @property {number|null} propId   prop this Pin is embedded in, freezing it (A2)
 */

/**
 * @typedef {object} Entity
 * @property {number} id            unique within a room lifetime
 * @property {string} kind          key into content ENTITY_KINDS
 * @property {string} roomId
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {number} vx
 * @property {number} vy
 * @property {number} hp
 * @property {number} maxHp
 * @property {-1|1} facing
 * @property {number} hitLockout    frames before the same attack may hit again
 * @property {Record<string, number>} timers  per-kind frame counters
 * @property {0|1} mass             0 light (pinnable), 1 heavy (00-BIBLE §6)
 * @property {string} mode          per-kind behaviour state, e.g. 'dormant'
 * @property {boolean} pinned       nailed to a wall: helpless, and harmless to touch
 * @property {number} stun          frames of lost control
 * @property {number} flash         frames of hit flash left, for the renderer
 * @property {number} targetX       what a light-tracking enemy is charging at
 * @property {number} targetY
 * @property {Material|null} pinMaterial  the Pin embeds in this body itself, gated by
 *   the same three-way material read as terrain: wood always, stone after Deep Pin,
 *   metal never. This is how a boss gets "explicitly pinnable parts" (§D3).
 * @property {number} reel          frames left being dragged home by A3 Reel
 * @property {string} owner         boss id this body is a part of, '' for none
 */

/**
 * @typedef {object} Door
 * @property {string} id
 * @property {[number, number]} at  tile coordinates on the room border
 * @property {string} to            'roomId:doorId' of the partner
 * @property {AbilityId|null} requires
 */

/**
 * @typedef {object} Hazard
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} kind
 */

/**
 * A rail platform: a solid that rides a fixed track between two points. It is the
 * one dynamic solid in the game — free-body crates were cut (06-revision-1 §C) —
 * and it is what A2 freezes and A3 drags.
 *
 * @typedef {object} Prop
 * @property {number} id
 * @property {string} kind          key into PROP_KINDS
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {number} ax            track end A, in world units
 * @property {number} ay
 * @property {number} bx            track end B
 * @property {number} by
 * @property {number} t             position along the track, 0..1
 * @property {-1|1} dir
 * @property {number} speed         units per frame along the track
 * @property {boolean} frozen       a Deep Pin is in its core
 * @property {number} reel          frames left being dragged by A3 Reel
 * @property {Material} material    what the Pin makes of it; rails are metal until A2
 */

/**
 * A parsed room: the compiled form of a `src/content/rooms/*.js` module.
 * @typedef {object} Room
 * @property {string} id
 * @property {number} w             width in tiles
 * @property {number} h             height in tiles
 * @property {string[]} grid        one string per row, `grid[ty][tx]` is a glyph
 * @property {Door[]} doors
 * @property {Hazard[]} hazards
 * @property {{kind:string, at:[number,number]}[]} spawns
 * @property {{kind:string, at:[number,number], to:[number,number]}[]} rails
 * @property {{id:string, kind:string, at:[number,number], ability?:AbilityId, afterBoss?:string}[]} pickups
 * @property {{at:[number,number], x:number, y:number}[]} lanterns save-lanterns, compiled from the grid
 * @property {Waypoint[]} route     waypoints in tile coords, for the servo
 * @property {number[]|null} macro  RLE input tape, only if the servo cannot solve the room
 */

/**
 * A servo waypoint: a tile to stand on, plus an optional action to perform once
 * standing there. Actions are the bot's half of the Pin — see `src/bot/servo.js`.
 * @typedef {[number, number] | [number, number, string]} Waypoint
 */

/**
 * One light hole in the darkness overlay. The renderer owns how it is drawn; the
 * sim owns where the lights are, because §D2 enemies aim at them.
 * @typedef {object} Light
 * @property {number} x
 * @property {number} y
 * @property {number} r
 * @property {'aura'|'pin'|'hazard'|'eye'|'lantern'} kind
 */

/**
 * @typedef {object} Progress
 * @property {AbilityId[]} abilities      monotonically non-decreasing (invariant 12)
 * @property {string[]} bossesKilled
 * @property {string[]} pickupsTaken
 * @property {string[]} lanternsLit
 * @property {Record<string, boolean>} flags
 * @property {number} deaths
 */

/**
 * @typedef {object} Violation
 * @property {string} code
 * @property {number} tick
 * @property {string} room
 * @property {string} detail
 */

/**
 * One thing that happened during a frame. Fields are uniform across every kind so
 * the list hashes cheaply and a consumer never has to test for a missing key.
 * @typedef {object} SimEvent
 * @property {string} kind          one of EVENT_KINDS
 * @property {number} x             world units
 * @property {number} y
 * @property {Material|null} material  the surface involved, for footsteps and impacts
 * @property {number|null} id       the entity involved, when there is one
 */

/**
 * @typedef {object} SimError
 * @property {number} tick
 * @property {string} where   subsystem name
 * @property {string} message
 */

/**
 * Rolling window backing the softlock detector (04 §6 rule 17). Not a view concern:
 * it is part of the simulation so replays reproduce the detection exactly.
 * @typedef {object} Liveness
 * @property {number} fingerprint       hash of the quantized progress fingerprint
 * @property {number} sameFor           frames the fingerprint has been unchanged
 * @property {number} inputFramesInWindow  frames with non-zero input in that window
 */

/**
 * The two Pins obey one ordering rule, checked every frame: **if either Pin is in
 * the hand, it is `pin`.** `pinB` is the one that is out there. That is what keeps
 * "Throw when you are holding something" and "Recall when you are not" a single
 * unambiguous button even with A5 Twin Pin, and it is why invariant RECALL_REFUSED
 * still reads only `pin`.
 *
 * @typedef {object} GameState
 * @property {number} tick                 integer frames since start; the only clock
 * @property {Seed} rng                    sim RNG stream; cosmetics use a separate one
 * @property {number} seed                 the seed the run started from
 * @property {InputMask} input             input applied this frame
 * @property {InputMask} prevInput         input applied last frame, for edge detection
 * @property {string} room                 id of the loaded room
 * @property {Room} roomData               the compiled room; shared, never mutated
 * @property {Player} player
 * @property {Pin} pin                     the primary Pin; see PIN_HELD_FIRST below
 * @property {Pin} pinB                    the older of the two Pins; dormant until A5
 * @property {Prop[]} props
 * @property {Entity[]} entities
 * @property {number} nextEntityId
 * @property {Progress} progress
 * @property {Liveness} liveness
 * @property {SimEvent[]} events           what happened this frame; rebuilt every step
 * @property {Light[]} lights              every light hole this frame, brightest first
 * @property {Record<string, number[]>} discovered per-room seen-tile bitmask, one number per row
 * @property {string[]} brokenTiles        'tx,ty' of tiles crumbled away in this room
 * @property {number} hitstop              frames the world is frozen for impact
 * @property {number} flash                frames of screen-edge flash (the clang read)
 * @property {number} shake                frames of screenshake left
 * @property {{room:string, x:number, y:number}} respawn last lit save-lantern
 * @property {SimError[]} errors           step() reports failures here, never throws
 * @property {boolean} debug               enables invariant checking in the harness
 */

export {};
