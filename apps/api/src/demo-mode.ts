import { demoIds } from "./demoPersonas";

export function demoModeEnabled() {
  return process.env.DEMO_MODE === "true" && process.env.ENABLE_DEMO === "true";
}
// Authenticated fictional-world preview affects profile media only. Discovery,
// matching and every social-content permission continue using real eligibility.
export function demoProfilePreviewSql() {
  if (!demoModeEnabled()) return "FALSE";
  const ids = demoIds.map((id) => `'${id}'::uuid`).join(",");
  return `(me.demo AND u.demo AND me.id IN (${ids}) AND u.id IN (${ids})
    AND NOT me.suspended AND NOT u.suspended
    AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor=me.id AND b.target=u.id) OR (b.actor=u.id AND b.target=me.id)))`;
}
