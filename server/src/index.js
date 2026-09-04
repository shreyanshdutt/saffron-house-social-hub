// Boot. Reads env, opens the database, applies the schema, serves.
// Makes NO external API call — there is no scan, no handle discovery and no
// sampler in this commit.

import { loadDotEnv, config } from './config.js';
import { openAndMigrate } from './db.js';
import { createServer } from './http.js';

loadDotEnv();
const cfg = config();          // throws if PLACES_RETENTION_DAYS exceeds §14.3
const db = openAndMigrate(cfg.databasePath);
const server = createServer(db);

// Localhost only, deliberately: the API is unauthenticated (see README).
server.listen(cfg.port, '127.0.0.1', () => {
  console.log(`saffron-house-server on http://127.0.0.1:${cfg.port}`);
  console.log(`  database        ${cfg.databasePath}`);
  console.log(`  places retention ${cfg.retentionDays} days (Google Maps Platform terms §14.3)`);
  console.log('  external API calls: none in this build');
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(); db.close(); process.exit(0); });
}
