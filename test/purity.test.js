import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPurity, stripCommentsAndStrings } from '../tools/check-purity.mjs';

test('src/core and src/content contain no banned globals or escaping imports', () => {
  const violations = checkPurity();
  assert.deepEqual(violations, [], `purity violations:\n${violations.join('\n')}`);
});

test('the scanner ignores banned names inside comments and strings', () => {
  const src = [
    '// Math.random is banned here',
    '/* Date.now too */',
    'const s = "window.document";',
    'const t = `setTimeout`;',
    'const real = Math.random;',
  ].join('\n');
  const stripped = stripCommentsAndStrings(src);
  assert.equal(stripped.split('\n').length, 5, 'line numbers must be preserved');
  assert.ok(!/Math\.random/.test(stripped.split('\n')[0] ?? ''), 'comment must be blanked');
  assert.ok(!/Date\.now/.test(stripped.split('\n')[1] ?? ''), 'block comment must be blanked');
  assert.ok(!/document/.test(stripped.split('\n')[2] ?? ''), 'string must be blanked');
  assert.ok(!/setTimeout/.test(stripped.split('\n')[3] ?? ''), 'template must be blanked');
  assert.ok(/Math\.random/.test(stripped.split('\n')[4] ?? ''), 'real code must survive');
});

test('the scanner runs in well under a second', () => {
  const started = process.hrtime.bigint();
  checkPurity();
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 500, `purity scan took ${ms.toFixed(0)}ms`);
});
