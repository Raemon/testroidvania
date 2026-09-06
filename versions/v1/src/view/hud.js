/**
 * The DOM HUD. Every field carries a `data-testid`, because the harness asserts
 * the HUD text equals the sim state at every intent boundary — that comparison is
 * the oracle for "the view is reading a stale copy of state" (04-architecture §5).
 *
 * The field list is exported so the harness enumerates it rather than hard-coding
 * ids: adding a HUD field automatically adds it to the desync check.
 */

/** @typedef {import('../core/types.js').GameState} GameState */

/**
 * Each entry is `[testid, read]`. `read` must be a pure function of state and must
 * return a string — the harness compares strings, so formatting lives here only.
 * @type {[string, (s: Readonly<GameState>) => string][]}
 */
export const HUD_FIELDS = [
  ['hud-room', (s) => s.room],
  ['hud-tick', (s) => String(s.tick)],
  ['hud-hp', (s) => String(s.player.hp)],
  ['hud-maxhp', (s) => String(s.player.maxHp)],
  ['hud-state', (s) => s.player.state],
  ['hud-x', (s) => s.player.x.toFixed(2)],
  ['hud-y', (s) => s.player.y.toFixed(2)],
  ['hud-vx', (s) => s.player.vx.toFixed(2)],
  ['hud-vy', (s) => s.player.vy.toFixed(2)],
  ['hud-grounded', (s) => (s.player.grounded ? 'yes' : 'no')],
  ['hud-abilities', (s) => (s.progress.abilities.length ? s.progress.abilities.join(',') : 'none')],
  ['hud-errors', (s) => String(s.errors.length)],
];

/**
 * @param {Document} doc
 * @returns {(state: Readonly<GameState>) => void}
 */
export function createHud(doc) {
  /** @type {Map<string, Element>} */
  const nodes = new Map();
  for (const [id] of HUD_FIELDS) {
    const el = doc.querySelector(`[data-testid="${id}"]`);
    if (!el) throw new Error(`hud: no element with data-testid="${id}" — index.html is out of date`);
    nodes.set(id, el);
  }
  /** @type {Map<string, string>} */
  const last = new Map();

  return (state) => {
    for (const [id, read] of HUD_FIELDS) {
      const text = read(state);
      if (last.get(id) === text) continue;
      last.set(id, text);
      const el = nodes.get(id);
      if (el) el.textContent = text;
    }
  };
}
