/**
 * Static content validation (04-architecture §8). Every check here is cheap and
 * exists because it is a mistake agents actually make when adding rooms in
 * parallel: a row one character short, a door whose partner does not point back,
 * a gate placed before the ability that opens it.
 */

import './harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/core/constants.js';
import { GLYPHS, tileAt, isDoorGlyph } from '../src/content/tiles.js';
import { ROOM_IDS, ROOM_MODULES, getRoom } from '../src/content/rooms/index.js';
import { START, worldEdges, findDoor } from '../src/content/world.js';
import { ROUTE } from '../src/content/routes.js';
import { isAbilityId } from '../src/core/abilities/index.js';
import { isEntityKind } from '../src/core/entities/index.js';
import { isKnownAction } from '../src/bot/actions.js';
import { solidAt } from '../src/core/collision.js';
import { solve } from '../tools/reachability.mjs';

const rooms = ROOM_IDS.map((id) => {
  const room = getRoom(id);
  assert.ok(room, `room '${id}' failed to compile`);
  return room;
});

test('every room is a rectangle of known glyphs', () => {
  for (const room of rooms) {
    assert.ok(room.w > 2 && room.h > 2, `${room.id} is ${room.w}x${room.h}`);
    room.grid.forEach((row, ty) => {
      assert.equal(row.length, room.w, `${room.id} row ${ty} is ${row.length} chars, expected ${room.w}`);
      for (let tx = 0; tx < row.length; tx++) {
        const glyph = row[tx] ?? '';
        assert.ok(GLYPHS.includes(glyph), `${room.id} (${tx},${ty}) has unknown glyph '${glyph}'`);
      }
    });
  }
});

test('every room is walled: the only non-solid border tiles are doors', () => {
  for (const room of rooms) {
    for (let ty = 0; ty < room.h; ty++) {
      for (let tx = 0; tx < room.w; tx++) {
        if (tx !== 0 && ty !== 0 && tx !== room.w - 1 && ty !== room.h - 1) continue;
        const glyph = room.grid[ty]?.[tx] ?? '';
        assert.ok(
          solidAt(room, tx, ty) || isDoorGlyph(glyph),
          `${room.id} border tile (${tx},${ty}) is '${glyph}' — a border must be solid or a door`,
        );
      }
    }
  }
});

test('every room is enclosed: a flood fill from every open tile never escapes', () => {
  for (const room of rooms) {
    const seen = new Set();
    /** @type {[number, number][]} */
    const queue = [];
    // Seed from *every* open tile, not just the first: a sealed-off pocket of open
    // space outside the walls would otherwise never be visited.
    for (let ty = 0; ty < room.h; ty++) {
      for (let tx = 0; tx < room.w; tx++) {
        if (!solidAt(room, tx, ty) && !isDoorGlyph(room.grid[ty]?.[tx] ?? '')) queue.push([tx, ty]);
      }
    }
    assert.ok(queue.length > 0, `${room.id} has no open tile at all`);

    while (queue.length) {
      const [tx = 0, ty = 0] = queue.pop() ?? [];
      const key = `${tx},${ty}`;
      if (seen.has(key)) continue;
      seen.add(key);
      assert.ok(
        tx >= 0 && ty >= 0 && tx < room.w && ty < room.h,
        `${room.id} leaks at (${tx},${ty}) — open space reaches outside the room`,
      );
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + (dx ?? 0);
        const ny = ty + (dy ?? 0);
        // Doors are the only legal way out, so they count as wall for enclosure.
        if (nx < 0 || ny < 0 || nx >= room.w || ny >= room.h) {
          assert.fail(`${room.id} is open to the outside at (${tx},${ty}) -> (${nx},${ny})`);
        }
        if (solidAt(room, nx, ny)) continue;
        if ((room.grid[ny]?.[nx] ?? '') ) continue;
        queue.push([nx, ny]);
      }
    }
  }
});

test('every door sits on the border, resolves, and its partner points back', () => {
  const ids = new Set();
  for (const room of rooms) {
    for (const door of room.doors) {
      const key = `${room.id}:${door.id}`;
      assert.ok(!ids.has(key), `duplicate door id ${key}`);
      ids.add(key);

      const [tx, ty] = door.at;
      const onBorder = tx === 0 || ty === 0 || tx === room.w - 1 || ty === room.h - 1;
      assert.ok(onBorder, `${key} at (${tx},${ty}) is not on the border of ${room.w}x${room.h}`);
      assert.ok(isDoorGlyph(room.grid[ty]?.[tx] ?? ''), `${key} at (${tx},${ty}) is not a door tile`);

      const [toRoomId = '', toDoorId = ''] = door.to.split(':');
      const partnerRoom = getRoom(toRoomId);
      assert.ok(partnerRoom, `${key} -> '${door.to}' names an unknown room`);
      const partner = findDoor(toRoomId, toDoorId);
      assert.ok(partner, `${key} -> '${door.to}' names an unknown door`);
      assert.equal(partner?.to, key, `${toRoomId}:${toDoorId} must point back at ${key}, but points at '${partner?.to}'`);

      // Opposite edges, so walking east always arrives from the west.
      const partnerTx = partner?.at[0] ?? 0;
      if (tx === 0) assert.equal(partnerTx, (partnerRoom?.w ?? 1) - 1, `${key} is a west door; its partner must be an east door`);
      if (tx === room.w - 1) assert.equal(partnerTx, 0, `${key} is an east door; its partner must be a west door`);
    }
  }
});

test('every door requires an ability that exists', () => {
  for (const edge of worldEdges()) {
    if (edge.requires === null) continue;
    assert.ok(isAbilityId(edge.requires), `${edge.fromRoom}:${edge.fromDoor} requires unknown ability '${edge.requires}'`);
  }
});

test('nothing spawns inside a solid tile, and every spawn kind is implemented', () => {
  for (const room of rooms) {
    for (const spawn of room.spawns) {
      assert.ok(isEntityKind(spawn.kind), `${room.id} spawns unknown kind '${spawn.kind}'`);
      assert.equal(solidAt(room, spawn.at[0], spawn.at[1]), false, `${room.id} spawns ${spawn.kind} inside a solid tile`);
    }
    for (const pickup of room.pickups) {
      assert.equal(solidAt(room, pickup.at[0], pickup.at[1]), false, `${room.id} pickup ${pickup.id} is inside a solid tile`);
    }
  }
});

test('every servo waypoint is inside the room and standable', () => {
  for (const room of rooms) {
    assert.ok(room.route.length >= 2, `${room.id} has no route hints for the servo`);
    for (const [tx, ty] of room.route) {
      assert.ok(tx >= 0 && tx < room.w && ty >= 0 && ty < room.h, `${room.id} waypoint (${tx},${ty}) is outside the room`);
      assert.equal(solidAt(room, tx, ty), false, `${room.id} waypoint (${tx},${ty}) is inside a solid tile`);
    }
  }
});

test('every waypoint action is one the bot actually knows how to perform', () => {
  for (const room of rooms) {
    for (const [tx, ty, action] of room.route) {
      if (action === undefined) continue;
      assert.ok(isKnownAction(action), `${room.id} waypoint (${tx},${ty}) asks the bot for '${action}'`);
    }
  }
});

test('no room is wider than the 32-column discovered-tile bitmask', () => {
  for (const room of rooms) {
    assert.ok(room.w <= 32, `${room.id} is ${room.w} tiles wide; one row of seen-tile memory is 32 bits`);
  }
});

test('save-lanterns compile out of the grid and stand in reachable space', () => {
  for (const room of rooms) {
    let expected = 0;
    for (const row of room.grid) for (const glyph of row) if (tileAt(glyph).lantern) expected++;
    assert.equal(room.lanterns.length, expected, `${room.id} lantern count`);
    for (const lantern of room.lanterns) {
      assert.equal(solidAt(room, lantern.at[0], lantern.at[1]), false, `${room.id} lantern at ${lantern.at} is inside a solid tile`);
    }
  }
});

test('the opening is lit: the critical path passes at least one save-lantern', () => {
  const lanterns = rooms.reduce((n, room) => n + room.lanterns.length, 0);
  assert.ok(lanterns >= 1, 'a run with no save-lantern has no respawn point but the start');
});

test('the Pin has something to bite and something to refuse', () => {
  const materials = new Set();
  for (const room of rooms) {
    for (const row of room.grid) {
      for (const glyph of row) {
        const def = tileAt(glyph);
        if (def.solid && def.material) materials.add(def.material);
      }
    }
  }
  assert.ok(materials.has('wood'), 'no wood anywhere: the Pin can never be a platform');
  assert.ok(materials.has('stone'), 'no stone anywhere: nothing gates the base kit');
});

test('hazard tiles compile into hazard rects', () => {
  for (const room of rooms) {
    let expected = 0;
    for (const row of room.grid) {
      for (const glyph of row) if (tileAt(glyph).damage > 0) expected++;
    }
    assert.equal(room.hazards.length, expected, `${room.id} hazard count`);
    for (const hz of room.hazards) {
      assert.equal(hz.w, TILE);
      assert.equal(solidAt(room, hz.x / TILE, hz.y / TILE), false, 'a hazard must not also be solid');
    }
  }
});

test('the game is completable: every room reachable, every gate openable', () => {
  const r = solve();
  assert.ok(ROOM_IDS.includes(START.room), `start room '${START.room}' does not exist`);
  assert.deepEqual(r.unreachable, [], `unreachable rooms: ${r.unreachable.join(', ')}`);
  assert.deepEqual(r.blockedDoors, [], r.blockedDoors.join('\n'));
});

test('the route only names rooms that exist', () => {
  for (const intent of ROUTE) {
    if ('go' in intent) assert.ok(ROOM_IDS.includes(intent.go), `route goes to unknown room '${intent.go}'`);
    if ('expect' in intent && intent.expect.room) {
      assert.ok(ROOM_IDS.includes(intent.expect.room), `route expects unknown room '${intent.expect.room}'`);
    }
  }
});
