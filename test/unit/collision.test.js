import '../harness/trap.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, PLAYER_W, PLAYER_H, LEDGE_NUDGE } from '../../src/core/constants.js';
import { sweepX, sweepY, moveBox, overlapsSolid, solidAt, oneWayAt } from '../../src/core/collision.js';

/**
 * Build a throwaway room from ASCII, so each test states its geometry inline.
 * @param {string[]} rows
 * @returns {import('../../src/core/types.js').Room}
 */
function room(rows) {
  return {
    id: 'test', w: rows[0]?.length ?? 0, h: rows.length, grid: rows,
    doors: [], hazards: [], spawns: [], pickups: [], route: [], macro: null,
  };
}

const FLAT = room([
  '........',
  '........',
  '........',
  '########',
]);

test('glyph lookup treats outside the room as solid', () => {
  assert.equal(solidAt(FLAT, -1, 0), true);
  assert.equal(solidAt(FLAT, 0, 99), true);
  assert.equal(solidAt(FLAT, 0, 0), false);
  assert.equal(solidAt(FLAT, 0, 3), true);
});

test('a rightward sweep stops flush against the wall face', () => {
  const wall = room(['..#', '..#', '###']);
  const box = { x: 0, y: 0, w: PLAYER_W, h: PLAYER_H };
  const r = sweepX(wall, box, 40);
  assert.equal(r.hit, true);
  assert.equal(r.x, 2 * TILE - PLAYER_W, 'flush against the left face of column 2');
  assert.equal(overlapsSolid(wall, { ...box, x: r.x }), false);
});

test('a leftward sweep stops flush against the wall face', () => {
  const wall = room(['#..', '#..', '###']);
  const r = sweepX(wall, { x: 2 * TILE, y: 0, w: PLAYER_W, h: PLAYER_H }, -40);
  assert.equal(r.hit, true);
  assert.equal(r.x, TILE);
});

test('a fast downward sweep lands on the floor instead of tunnelling through it', () => {
  const r = sweepY(FLAT, { x: 0, y: 0, w: PLAYER_W, h: PLAYER_H }, 200, false);
  assert.equal(r.hit, true);
  assert.equal(r.y, 3 * TILE - PLAYER_H);
  assert.equal(overlapsSolid(FLAT, { x: 0, y: r.y, w: PLAYER_W, h: PLAYER_H }), false);
});

test('one-way platforms block from above and pass through from below', () => {
  const plat = room([
    '........',
    '..====..',
    '........',
    '########',
  ]);
  assert.equal(oneWayAt(plat, 2, 1), true);
  assert.equal(solidAt(plat, 2, 1), false);

  const above = sweepY(plat, { x: 2 * TILE, y: 0, w: PLAYER_W, h: PLAYER_H }, 40, false);
  assert.equal(above.hit, true);
  assert.equal(above.landedOnOneWay, true);
  assert.equal(above.y, TILE - PLAYER_H);

  const below = sweepY(plat, { x: 2 * TILE, y: 2 * TILE, w: PLAYER_W, h: PLAYER_H }, -30, false);
  assert.equal(below.hit, false, 'rising through a one-way must not be blocked');

  const ignoring = sweepY(plat, { x: 2 * TILE, y: 0, w: PLAYER_W, h: PLAYER_H }, 40, true);
  assert.equal(ignoring.hit, false, 'drop-through ignores the platform entirely');
});

test('the ledge nudge steps over a lip of 3px or less but not more', () => {
  const step = room(['...', '..#', '###']);
  const lipTop = TILE;                       // top face of the block in column 2
  const nudged = moveBox(step, { x: 0, y: lipTop - PLAYER_H + LEDGE_NUDGE, w: PLAYER_W, h: PLAYER_H }, 4, 0, false);
  assert.ok(nudged.x > 0, 'a 3px lip is stepped over');
  assert.equal(nudged.hitWall, false);

  const blocked = moveBox(step, { x: 0, y: lipTop - PLAYER_H + LEDGE_NUDGE + 3, w: PLAYER_W, h: PLAYER_H }, 4, 0, false);
  assert.equal(blocked.hitWall, true, 'a 6px lip is a wall');
});

test('ceiling corner correction slides the player past a shoulder-width miss', () => {
  // A one-tile hole in the ceiling; the player is 3px to the left of clearing it.
  const corridor = room([
    '###.###',
    '.......',
    '.......',
    '#######',
  ]);
  const holeX = 3 * TILE;
  const start = { x: holeX - 3, y: TILE, w: PLAYER_W, h: PLAYER_H };
  const r = moveBox(corridor, start, 0, -4, false);
  assert.ok(r.y < TILE, 'the jump continued upward');
  assert.equal(r.hitCeiling, false);
  assert.notEqual(r.x, start.x, 'the player was nudged sideways');
  assert.equal(overlapsSolid(corridor, { x: r.x, y: r.y, w: PLAYER_W, h: PLAYER_H }), false);
});

test('the player never ends up inside a solid tile, at any speed or angle', () => {
  const maze = room([
    '..#....',
    '..#.##.',
    '.......',
    '###.###',
    '.......',
    '#######',
  ]);
  for (let vx = -20; vx <= 20; vx += 3) {
    for (let vy = -20; vy <= 20; vy += 3) {
      for (let px = 0; px < maze.w * TILE; px += 5) {
        const box = { x: px, y: 2 * TILE + 4, w: PLAYER_W, h: PLAYER_H };
        if (overlapsSolid(maze, box)) continue;
        const r = moveBox(maze, box, vx, vy, false);
        assert.equal(
          overlapsSolid(maze, { x: r.x, y: r.y, w: PLAYER_W, h: PLAYER_H }),
          false,
          `moving (${vx}, ${vy}) from x=${px} ended inside a solid at (${r.x}, ${r.y})`,
        );
      }
    }
  }
});
