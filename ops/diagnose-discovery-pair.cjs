// Run inside the existing API container; never import main.js or run migrations.
// Output is limited to the requested names, failed rule labels and queue position.
const { pool } = require("./dist/db");
const { eligibility, candidatesPage } = require("./dist/discovery");

const names = process.argv.slice(2);
const normalize = (value) => value.toLowerCase().replace(/\s+/g, "");

const checks = {
  viewer_profile_incomplete:
    "me.demo OR (me.email_verified_at IS NOT NULL AND me.adult_declared_at IS NOT NULL AND me.onboarded_at IS NOT NULL)",
  other_profile_incomplete:
    "u.demo OR (u.email_verified_at IS NOT NULL AND u.adult_declared_at IS NOT NULL AND u.onboarded_at IS NOT NULL)",
  viewer_paused: "NOT me.paused",
  other_person_paused: "NOT u.paused",
  suspended_account: "NOT me.suspended AND NOT u.suspended",
  different_demo_and_real_account_types: "u.demo=me.demo",
  viewer_age_filter:
    "EXTRACT(YEAR FROM age(u.birth_date)) BETWEEN (me.preferences->>'minAge')::int AND (me.preferences->>'maxAge')::int",
  other_person_age_filter:
    "EXTRACT(YEAR FROM age(me.birth_date)) BETWEEN (u.preferences->>'minAge')::int AND (u.preferences->>'maxAge')::int",
  viewer_city_filter:
    "me.preferences->'cities'='[]'::jsonb OR me.preferences->'cities' ? u.city",
  other_person_city_filter:
    "u.preferences->'cities'='[]'::jsonb OR u.preferences->'cities' ? me.city",
  viewer_gender_filter:
    "me.preferences->'genders'='[]'::jsonb OR me.preferences->'genders' ? u.gender",
  other_person_gender_filter:
    "u.preferences->'genders'='[]'::jsonb OR u.preferences->'genders' ? me.gender",
  viewer_relationship_intent_filter:
    "COALESCE(me.preferences->'intents','[]'::jsonb)='[]'::jsonb OR me.preferences->'intents' ? u.intent",
  other_person_relationship_intent_filter:
    "COALESCE(u.preferences->'intents','[]'::jsonb)='[]'::jsonb OR u.preferences->'intents' ? me.intent",
  block_between_accounts:
    "NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor=me.id AND b.target=u.id) OR (b.actor=u.id AND b.target=me.id))",
  matched_declined_or_ended_connection:
    "NOT EXISTS(SELECT 1 FROM connections c WHERE c.a=LEAST(me.id,u.id) AND c.b=GREATEST(me.id,u.id) AND c.state IN ('matched','declined','ended'))",
  viewer_already_swiped:
    "NOT EXISTS(SELECT 1 FROM discovery_actions d WHERE d.actor=me.id AND d.target=u.id AND d.undone_at IS NULL)",
};

async function run() {
  if (names.length !== 2 || normalize(names[0]) === normalize(names[1]))
    throw new Error("Supply two distinct display names.");
  if (typeof eligibility !== "string" || typeof candidatesPage !== "function")
    throw new Error("Installed discovery module does not support this check.");
  const db = await pool.connect();
  try {
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await db.query("SET LOCAL statement_timeout='10s'");
    await db.query("SET LOCAL lock_timeout='3s'");
    const keys = names.map(normalize);
    const found = (
      await db.query(
        "SELECT id,name,regexp_replace(lower(btrim(name)),'[[:space:]]+','','g') AS name_key FROM users WHERE regexp_replace(lower(btrim(name)),'[[:space:]]+','','g')=ANY($1::text[])",
        [keys],
      )
    ).rows;
    const selected = keys.map((key) =>
      found.filter((person) => person.name_key === key),
    );
    if (selected.some((matches) => matches.length !== 1)) {
      console.log(
        JSON.stringify(
          {
            status: "Exact account selection required; no pair evaluated.",
            accounts: names.map((name, i) => ({
              name,
              count: selected[i].length,
            })),
          },
          null,
          2,
        ),
      );
      process.exitCode = 1;
      return;
    }
    const [a, b] = selected.map(([person]) => person);
    const ruleColumns = Object.entries(checks)
      .map(([label, rule]) => `COALESCE((${rule}),false) AS "${label}"`)
      .join(",");
    for (const [viewer, target] of [
      [a, b],
      [b, a],
    ]) {
      const result = (
        await db.query(
          `SELECT COALESCE((${eligibility}),false) AS server_rules_pass,${ruleColumns} FROM users me CROSS JOIN users u WHERE me.id=$1 AND u.id=$2`,
          [viewer.id, target.id],
        )
      ).rows[0];
      const excludedBy = Object.keys(checks).filter((key) => !result[key]);
      if (!result.server_rules_pass && excludedBy.length === 0)
        excludedBy.push("another_installed_server_discovery_rule");
      const eligible = result.server_rules_pass && excludedBy.length === 0;
      const page = eligible ? await candidatesPage(db, viewer.id) : null;
      const index = page
        ? page.items.findIndex((person) => person.id === target.id)
        : -1;
      console.log(
        JSON.stringify(
          {
            viewer: viewer.name,
            candidate: target.name,
            eligible,
            excludedBy,
            positionInCurrentEightCards: index < 0 ? null : index + 1,
            beyondCurrentBatch: eligible && index < 0,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    try {
      await db.query("ROLLBACK");
    } finally {
      db.release();
    }
  }
}

run()
  .catch((error) => {
    // Database errors can include private field values or connection information.
    console.error("Discovery diagnostic failed:", error.code || error.name);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
