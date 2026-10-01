import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { DB, one, pool, publicFields, rows, tx } from "./db";
import { registerInput } from "./validation";
import { demoModeEnabled } from "./demo-mode";
import { demoIds } from "./demoPersonas";
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function passwordMatches(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  return timingSafeEqual(
    Buffer.from(key, "hex"),
    scryptSync(password, salt, 64),
  );
}
export async function session(db: DB, id: string) {
  const token = randomBytes(32).toString("hex");
  await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')", [
    digest(token),
    id,
  ]);
  return {
    token,
    user: await one(
      db,
      `SELECT ${publicFields},email,paused,preferences,notifications FROM users WHERE id=$1`,
      [id],
    ),
  };
}
export async function authenticate(header?: string) {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new UnauthorizedException("Please sign in.");
  const s = await one(
    pool,
    `SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND NOT u.suspended`,
    [digest(token)],
  );
  if (!s)
    throw new UnauthorizedException(
      "Your session expired. Please sign in again.",
    );
  return s.id as string;
}
export async function register(body: unknown) {
  const d = registerInput.parse(body);
  return tx(async (db) => {
    if (await one(db, "SELECT 1 FROM users WHERE email=$1", [d.email]))
      throw new BadRequestException(
        "Unable to create account with these details.",
      );
    const id = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,password_hash,name,birth_date,city) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        d.email,
        hashPassword(d.password),
        d.name || "",
        d.birthDate || null,
        d.city || "",
      ],
    );
    return session(db, id);
  });
}
export async function login(email: string, password: string) {
  const user = await one(
    pool,
    "SELECT * FROM users WHERE email=$1 AND NOT suspended",
    [email.toLowerCase()],
  );
  if (!user || !passwordMatches(password, user.password_hash))
    throw new UnauthorizedException("Email or password is incorrect.");
  return session(pool, user.id);
}
export async function demoAccounts() {
  if (!demoModeEnabled()) return [];
  return rows(
    pool,
    `SELECT ${publicFields} FROM users WHERE demo AND NOT suspended AND id=ANY($1::uuid[]) ORDER BY name LIMIT 30`,
    [demoIds],
  );
}
export async function demoLogin(id: string) {
  if (!demoModeEnabled() || !demoIds.includes(id))
    throw new ForbiddenException();
  if (
    !(await one(
      pool,
      "SELECT 1 FROM users WHERE id=$1 AND demo AND NOT suspended",
      [id],
    ))
  )
    throw new ForbiddenException();
  return session(pool, id);
}
