import { randomUUID } from "node:crypto";
import { matched, one, pool } from "./db";
let running = false;
async function settle(
  id: string,
  claim: string,
  state: string,
  reason: string | null,
  retrySeconds = 0,
) {
  await pool.query(
    `WITH held AS (UPDATE push_delivery_claims SET claim_id=NULL,claimed_until=NULL,last_error=$4,next_attempt_at=now()+$5*interval '1 second' WHERE notification_id=$1 AND claim_id=$2 RETURNING notification_id)
     UPDATE notifications n SET push_state=$3 FROM held WHERE n.id=held.notification_id`,
    [id, claim, state, reason, retrySeconds],
  );
}
// Claims are shared across API processes; local running only prevents interval
// overlap. Provider acceptance still is not proof of device delivery.
export async function dispatchPush() {
  if (process.env.ENABLE_PUSH !== "true" || running) return;
  running = true;
  try {
    await pool.query(
      `UPDATE notifications n SET push_state=CASE WHEN created_at<=now()-interval '1 hour' THEN 'expired' ELSE 'failed' END
       WHERE push_state='pending' AND (created_at<=now()-interval '1 hour' OR push_attempts>=3)
       AND NOT EXISTS(SELECT 1 FROM push_delivery_claims c WHERE c.notification_id=n.id AND c.claimed_until>now())`,
    );
    await pool.query(
      `INSERT INTO push_delivery_claims(notification_id)
       SELECT n.id FROM notifications n WHERE n.push_state='pending' AND n.push_attempts<3 AND n.created_at>now()-interval '1 hour'
       AND NOT EXISTS(SELECT 1 FROM push_delivery_claims c WHERE c.notification_id=n.id)
       ORDER BY n.created_at,n.id LIMIT 100 ON CONFLICT DO NOTHING`,
    );
    for (let i = 0; i < 20; i++) {
      const claim = randomUUID();
      const n = await one(
        pool,
        `WITH due AS (SELECT n.id FROM notifications n JOIN push_delivery_claims c ON c.notification_id=n.id
         WHERE n.push_state='pending' AND n.push_attempts<3 AND n.created_at>now()-interval '1 hour' AND c.next_attempt_at<=now()
         AND (c.claimed_until IS NULL OR c.claimed_until<=now()) ORDER BY n.created_at,n.id LIMIT 1 FOR UPDATE OF n,c SKIP LOCKED),
         claimed AS (UPDATE push_delivery_claims c SET claim_id=$1,claimed_until=now()+interval '30 seconds' FROM due WHERE c.notification_id=due.id RETURNING c.notification_id)
         UPDATE notifications n SET push_attempts=push_attempts+1 FROM claimed WHERE n.id=claimed.notification_id RETURNING n.*`,
        [claim],
      );
      if (!n) break;
      const recipient = await one(
        pool,
        "SELECT push_token,notifications,suspended FROM users WHERE id=$1",
        [n.recipient],
      );
      const allowed =
        n.kind !== "request" &&
        recipient?.push_token &&
        recipient.notifications &&
        !recipient.suspended &&
        (await matched(pool, n.actor, n.recipient));
      if (!allowed) {
        await settle(n.id, claim, "skipped", "NOT_ALLOWED");
        continue;
      }
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: recipient.push_token,
            title: "Sangai",
            body: "You have a new update.",
            data: { url: "/(tabs)/chat" },
            sound: null,
          }),
          signal: AbortSignal.timeout(8000),
        });
        const ticket: any = await response.json();
        if (response.ok && ticket.data?.status === "ok")
          await settle(n.id, claim, "accepted", null);
        else if (ticket.data?.details?.error === "DeviceNotRegistered") {
          // Do not clear a replacement endpoint registered while delivery ran.
          await pool.query(
            "UPDATE users SET push_token=NULL WHERE id=$1 AND push_token=$2",
            [n.recipient, recipient.push_token],
          );
          await settle(n.id, claim, "invalid-token", "DEVICE_NOT_REGISTERED");
        } else
          await settle(
            n.id,
            claim,
            n.push_attempts >= 3 ? "failed" : "pending",
            "PROVIDER_ERROR",
            15 * 2 ** (n.push_attempts - 1),
          );
      } catch {
        await settle(
          n.id,
          claim,
          n.push_attempts >= 3 ? "failed" : "pending",
          "NETWORK_ERROR",
          15 * 2 ** (n.push_attempts - 1),
        );
      }
    }
  } finally {
    running = false;
  }
}
