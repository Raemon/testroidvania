#!/usr/bin/env node
/** `npm run play` — the same static server the tests use, left running for a human. */

import { startServer } from '../test/harness/server.js';

const server = await startServer();
process.stdout.write(
  `PINLIGHT is at ${server.origin}/\n` +
  `  arrows / WASD to move, Z or space to jump, down + jump to drop through platforms\n` +
  `  ?debug=1 turns on the canvas guard and invariants, ?bot=1 hands over to the autopilot\n` +
  `  ctrl-c to stop\n`,
);
process.on('SIGINT', () => {
  server.close().then(() => process.exit(0));
});
