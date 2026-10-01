import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// Older privacy/media suites need a tiny, consented fixture independently of the
// product's evolving 30-persona world. This helper can mutate only a test-owned DB.
export async function legacyDemoFixture(
  db: Pool,
  api: string,
  databaseName: string,
) {
  assert.match(databaseName, /^sangai_test_[a-f0-9]{32}$/);
  const actual = await db.query("SELECT current_database() AS name");
  assert.equal(actual.rows[0].name, databaseName);
  await db.query("DELETE FROM users WHERE demo");
  const names = ["Aarav", "Anaya", "Samira", "Rohan", "Nisha"];
  const ids = names.map(
    (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  );
  for (const [i, id] of ids.entries()) {
    await db.query(
      `INSERT INTO users(id,email,password_hash,name,birth_date,city,bio,interests,prompt,gender,demo,email_verified_at,adult_declared_at,onboarded_at,onboarding_step)
      VALUES($1,$2,'fixture-never-password-login',$3,'1998-04-14','Kathmandu','Fictional isolated privacy fixture',$4,'Coffee and a walk',$5,true,now(),now(),now(),5)`,
      [
        id,
        `legacy-demo-${i}@sangai.invalid`,
        names[i],
        ["Coffee", "Hiking"],
        i % 2 ? "Woman" : "Man",
      ],
    );
  }
  const tokens: string[] = [];
  for (const id of ids) {
    const response = await fetch(api + "/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    assert.equal(response.status, 201);
    tokens.push((await response.json()).token);
  }
  for (const [a, b] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ]) {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const response = await fetch(api + "/discovery/" + ids[to], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + tokens[from],
        },
        body: JSON.stringify({ action: "like", clientId: randomUUID() }),
      });
      assert.equal(response.status, 201);
    }
  }
  for (const [i, author] of ids.slice(0, 3).entries())
    await db.query("INSERT INTO posts(id,author,body) VALUES($1,$2,$3)", [
      randomUUID(),
      author,
      `Fictional fixture moment ${i + 1}`,
    ]);
  await db.query(
    "INSERT INTO stories(id,author,body) VALUES($1,$2,'Synthetic story')",
    [randomUUID(), ids[1]],
  );
  await db.query(
    "INSERT INTO messages(id,sender,recipient,body,client_id) VALUES($1,$2,$3,'Hi! Coffee and a walk?','fixture-hello')",
    [randomUUID(), ids[1], ids[0]],
  );
}
