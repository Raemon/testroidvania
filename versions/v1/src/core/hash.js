/**
 * FNV-1a over a canonical walk of the state. Object keys are sorted so two states
 * that differ only in insertion order hash the same, and every number is checked
 * for finiteness — which makes `hash()` the project's NaN detector for free
 * (04-architecture §3, §6 rule 1).
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Thrown by {@link hash} when the walk finds a NaN or an Infinity. Carries the
 * path so the failure names the field, not just the state.
 */
export class NonFiniteError extends Error {
  /** @param {string} path @param {number} value */
  constructor(path, value) {
    super(`non-finite number at ${path}: ${value}`);
    this.name = 'NonFiniteError';
    this.path = path;
    this.value = value;
  }
}

/**
 * @param {number} h
 * @param {string} s
 * @returns {number}
 */
function mix(h, s) {
  let acc = h;
  for (let i = 0; i < s.length; i++) {
    acc ^= s.charCodeAt(i);
    acc = Math.imul(acc, FNV_PRIME);
  }
  return acc >>> 0;
}

/**
 * Canonical serialization of a number. `-0` folds to `0` so an incidental sign
 * flip on a stopped velocity is not a behaviour change.
 * @param {number} n
 * @param {string} path
 * @returns {string}
 */
function numToken(n, path) {
  if (!Number.isFinite(n)) throw new NonFiniteError(path, n);
  return n === 0 ? '0' : String(n);
}

/**
 * @param {unknown} value
 * @param {number} h
 * @param {string} path
 * @param {Set<object>} seen
 * @returns {number}
 */
function walk(value, h, path, seen) {
  if (value === null) return mix(h, 'null');
  switch (typeof value) {
    case 'undefined': return mix(h, 'undef');
    case 'boolean': return mix(h, value ? 'T' : 'F');
    case 'number': return mix(h, 'n' + numToken(value, path));
    case 'string': return mix(mix(h, 's' + value.length + ':'), value);
    case 'bigint': return mix(h, 'b' + value.toString());
    case 'function': throw new Error(`function in state at ${path} — state must be plain data`);
    case 'symbol': throw new Error(`symbol in state at ${path} — state must be plain data`);
    default: break;
  }
  const obj = /** @type {object} */ (value);
  if (seen.has(obj)) throw new Error(`cycle in state at ${path}`);
  seen.add(obj);
  let acc = h;
  if (Array.isArray(obj)) {
    acc = mix(acc, `[${obj.length}`);
    for (let i = 0; i < obj.length; i++) acc = walk(obj[i], acc, `${path}[${i}]`, seen);
    acc = mix(acc, ']');
  } else {
    const keys = Object.keys(obj).sort();
    acc = mix(acc, `{${keys.length}`);
    for (const k of keys) {
      acc = mix(acc, k);
      acc = walk(/** @type {Record<string, unknown>} */ (obj)[k], acc, `${path}.${k}`, seen);
    }
    acc = mix(acc, '}');
  }
  seen.delete(obj);
  return acc;
}

/**
 * @param {unknown} value
 * @returns {string} 8 lowercase hex digits
 * @throws {NonFiniteError} on any NaN or Infinity reachable from `value`
 */
export function hash(value) {
  return (walk(value, FNV_OFFSET, '$', new Set()) >>> 0).toString(16).padStart(8, '0');
}
