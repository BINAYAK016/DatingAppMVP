import assert from "node:assert/strict";
import type { Pool } from "pg";

/** Call only after the fixture's servers and pools have been stopped. */
export async function dropIsolatedDatabase(admin: Pool, database: string) {
  assert.match(
    database,
    /^sangai_(?:auth|test|browser|games|migration|demo_world|scalability|security|read_load)_[a-f0-9]{32}$/,
    "Only an owned random test database can be removed",
  );
  // pg-pool can resolve end() before client socket-close callbacks finish.
  // FORCE would send 57P01 to those closing clients and fail the test later.
  let openConnections = 0;
  for (let attempt = 0; attempt < 200; attempt++) {
    openConnections = (
      await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname=$1", [
        database,
      ])
    ).rowCount!;
    if (openConnections === 0) break;
    await new Promise((done) => setTimeout(done, 25));
  }
  assert.equal(
    openConnections,
    0,
    "Fixture connections must close before drop",
  );
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
}
