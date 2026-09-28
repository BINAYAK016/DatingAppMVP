import { matched, one, pool, rows } from "./db";
let running = false;
// Optional private-beta adapter. In-app notifications remain authoritative.
// Provider acceptance is not proof of device delivery. Production needs receipt
// polling, per-installation endpoints, durable backoff and credential management.
export async function dispatchPush() {
  if (process.env.ENABLE_PUSH !== "true" || running) return;
  running = true;
  try {
    const queue = await rows(
      pool,
      `SELECT n.*,u.push_token,u.notifications,u.suspended,source.suspended AS actor_suspended FROM notifications n JOIN users u ON u.id=n.recipient JOIN users source ON source.id=n.actor WHERE push_state='pending' AND push_attempts<3 AND n.created_at>now()-interval '1 hour' ORDER BY n.created_at LIMIT 20`,
    );
    for (const n of queue) {
      const blocked = await one(
        pool,
        "SELECT 1 FROM blocks WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1)",
        [n.recipient, n.actor],
      );
      const allowed =
        n.kind === "request"
          ? !!(await one(
              pool,
              "SELECT 1 FROM connections WHERE sender=$1 AND (a=$2 OR b=$2) AND state='pending'",
              [n.actor, n.recipient],
            ))
          : await matched(pool, n.actor, n.recipient);
      if (
        !n.push_token ||
        !n.notifications ||
        n.suspended ||
        n.actor_suspended ||
        blocked ||
        !allowed
      ) {
        await pool.query(
          "UPDATE notifications SET push_state='skipped' WHERE id=$1",
          [n.id],
        );
        continue;
      }
      await pool.query(
        "UPDATE notifications SET push_attempts=push_attempts+1 WHERE id=$1",
        [n.id],
      );
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: n.push_token,
            title: "Sangai",
            body: "You have a new update.",
            data: { url: "/inbox" },
            sound: null,
          }),
          signal: AbortSignal.timeout(8000),
        });
        const ticket: any = await response.json();
        if (response.ok && ticket.data?.status === "ok")
          await pool.query(
            "UPDATE notifications SET push_state='accepted' WHERE id=$1",
            [n.id],
          );
        else if (ticket.data?.details?.error === "DeviceNotRegistered") {
          await pool.query("UPDATE users SET push_token=NULL WHERE id=$1", [
            n.recipient,
          ]);
          await pool.query(
            "UPDATE notifications SET push_state='invalid-token' WHERE id=$1",
            [n.id],
          );
        }
      } catch {
        /* Retry boundedly on next interval; never log tokens. */
      }
    }
  } finally {
    running = false;
  }
}
