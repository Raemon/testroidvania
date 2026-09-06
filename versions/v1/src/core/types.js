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
 */

/**
 * The Pin. Phase 2 owns its behaviour; Phase 1 only carries the shape.
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
 * A parsed room: the compiled form of a `src/content/rooms/*.js` module.
 * @typedef {object} Room
 * @property {string} id
 * @property {number} w             width in tiles
 * @property {number} h             height in tiles
 * @property {string[]} grid        one string per row, `grid[ty][tx]` is a glyph
 * @property {Door[]} doors
 * @property {Hazard[]} hazards
 * @property {{kind:string, at:[number,number]}[]} spawns
 * @property {{id:string, kind:string, at:[number,number], ability?:AbilityId}[]} pickups
 * @property {[number, number][]} route waypoints in tile coords, for the servo
 * @property {number[]|null} macro  RLE input tape, only if the servo cannot solve the room
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
 * @typedef {object} GameState
 * @property {number} tick                 integer frames since start; the only clock
 * @property {Seed} rng                    sim RNG stream; cosmetics use a separate one
 * @property {number} seed                 the seed the run started from
 * @property {InputMask} input             input applied this frame
 * @property {InputMask} prevInput         input applied last frame, for edge detection
 * @property {string} room                 id of the loaded room
 * @property {Room} roomData               the compiled room; shared, never mutated
 * @property {Player} player
 * @property {Pin} pin
 * @property {Entity[]} entities
 * @property {number} nextEntityId
 * @property {Progress} progress
 * @property {Liveness} liveness
 * @property {SimError[]} errors           step() reports failures here, never throws
 * @property {boolean} debug               enables invariant checking in the harness
 */

export {};
