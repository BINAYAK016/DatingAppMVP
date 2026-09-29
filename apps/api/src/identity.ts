import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import { z } from "zod";
import { digest, hashPassword, session } from "./auth";
import { DB, one, pool, tx } from "./db";
import { cities, profileInput, text } from "./validation";

export const privateProfileFields =
  "email,email_verified_at,adult_declared_at,onboarded_at,onboarding_step,birth_date,preferences,paused,notifications,posts_visible,stories_visible,messages_enabled,interactions_enabled,data_saver";
export const accountReady = (u: any) =>
  !!u.demo || !!(u.email_verified_at && u.adult_declared_at && u.onboarded_at);
export async function requireReadyAccount(actor: string) {
  const u = await one(
    pool,
    "SELECT demo,email_verified_at,adult_declared_at,onboarded_at FROM users WHERE id=$1",
    [actor],
  );
  if (!u || !accountReady(u))
    throw new ForbiddenException(
      "Verify your email and finish your adult profile first.",
    );
}
export function authConfig() {
  return {
    google: !!process.env.GOOGLE_CLIENT_ID,
    emailDelivery: !!process.env.SMTP_HOST,
    localMail: process.env.SMTP_HOST === "mailpit",
  };
}
async function mail(email: string, purpose: string, token: string) {
  if (!process.env.SMTP_HOST)
    throw new ServiceUnavailableException(
      "Email delivery is not configured on this beta server.",
    );
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 8000,
    socketTimeout: 10000,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || "Sangai <beta@sangai.invalid>",
    to: email,
    subject:
      purpose === "verify"
        ? "Verify your Sangai email"
        : "Reset your Sangai password",
    text: `Your Sangai ${purpose === "verify" ? "verification" : "password reset"} code is:\n\n${token}\n\nEnter this code in Sangai within 15 minutes. It can be used once. If you did not request it, ignore this email.`,
  });
}
export async function issueChallenge(
  db: DB,
  u: any,
  purpose: "verify" | "reset",
) {
  if (
    await one(
      db,
      "SELECT 1 FROM auth_challenges WHERE user_id=$1 AND purpose=$2 AND created_at>now()-interval '1 minute'",
      [u.id, purpose],
    )
  )
    return;
  const token = randomBytes(12).toString("hex");
  // No raw challenge is logged, returned by the API, or stored in PostgreSQL.
  await mail(u.email, purpose, token);
  await db.query(
    "UPDATE auth_challenges SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL",
    [u.id, purpose],
  );
  await db.query(
    "INSERT INTO auth_challenges(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes')",
    [randomUUID(), u.id, purpose, digest(token)],
  );
}
export async function sendVerification(actor: string) {
  return tx(async (db) => {
    const u = await one(db, "SELECT * FROM users WHERE id=$1", [actor]);
    if (!u.email_verified_at) await issueChallenge(db, u, "verify");
    return { ok: true };
  });
}
async function consume(db: DB, user: string, purpose: string, code: string) {
  const row = await one(
    db,
    "SELECT * FROM auth_challenges WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL AND expires_at>now() AND attempts<5 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    [user, purpose],
  );
  if (!row) return false;
  await db.query("UPDATE auth_challenges SET attempts=attempts+1 WHERE id=$1", [
    row.id,
  ]);
  if (row.token_hash !== digest(code.trim())) return false;
  await db.query("UPDATE auth_challenges SET used_at=now() WHERE id=$1", [
    row.id,
  ]);
  return true;
}
export async function verifyEmail(actor: string, code: string) {
  const ok = await tx(async (db) => {
    if (!(await consume(db, actor, "verify", code))) return false;
    await db.query("UPDATE users SET email_verified_at=now() WHERE id=$1", [
      actor,
    ]);
    return true;
  });
  if (!ok)
    throw new BadRequestException(
      "Code is invalid or expired. Request a new code.",
    );
  return { ok: true };
}
export async function forgot(email: string) {
  if (!process.env.SMTP_HOST)
    throw new ServiceUnavailableException(
      "Email delivery is not configured on this beta server.",
    );
  await tx(async (db) => {
    const u = await one(
      db,
      "SELECT * FROM users WHERE email=$1 AND NOT demo AND NOT suspended",
      [email.toLowerCase()],
    );
    if (u) await issueChallenge(db, u, "reset");
  });
  return {
    ok: true,
    message: "If an account exists, a reset code has been sent.",
  };
}
export async function reset(email: string, code: string, password: string) {
  const ok = await tx(async (db) => {
    const u = await one(
      db,
      "SELECT id FROM users WHERE email=$1 AND NOT suspended AND NOT demo",
      [email.toLowerCase()],
    );
    if (!u || !(await consume(db, u.id, "reset", code))) return false;
    await db.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
      u.id,
      hashPassword(password),
    ]);
    await db.query("DELETE FROM sessions WHERE user_id=$1", [u.id]);
    return true;
  });
  if (!ok)
    throw new BadRequestException(
      "Code is invalid or expired. Request a new code.",
    );
  return { ok: true };
}
export async function googleSignIn(idToken: string) {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience)
    throw new ServiceUnavailableException(
      "Google sign-in is not configured on this beta server.",
    );
  let payload;
  try {
    payload = (
      await new OAuth2Client().verifyIdToken({ idToken, audience })
    ).getPayload();
  } catch {
    throw new UnauthorizedException("Google sign-in could not be verified.");
  }
  if (!payload?.sub || !payload.email || !payload.email_verified)
    throw new UnauthorizedException("Use a verified Google email.");
  const { sub, email } = payload;
  return tx(async (db) => {
    const identity = await one(
      db,
      "SELECT user_id FROM auth_identities WHERE provider='google' AND subject=$1",
      [sub],
    );
    if (identity) {
      if (
        !(await one(db, "SELECT 1 FROM users WHERE id=$1 AND NOT suspended", [
          identity.user_id,
        ]))
      )
        throw new UnauthorizedException();
      return session(db, identity.user_id);
    }
    // Never automatically link an existing password account by email alone.
    if (
      await one(db, "SELECT 1 FROM users WHERE email=$1", [email.toLowerCase()])
    )
      throw new BadRequestException(
        "Sign in with your existing email account. Google linking is not enabled in this beta.",
      );
    const id = randomUUID();
    await db.query(
      "INSERT INTO users(id,email,password_hash,name,city,email_verified_at) VALUES($1,$2,$3,'','',now())",
      [id, email.toLowerCase(), hashPassword(randomUUID())],
    );
    await db.query(
      "INSERT INTO auth_identities(provider,subject,user_id) VALUES('google',$1,$2)",
      [sub, id],
    );
    return session(db, id);
  });
}
const basics = z.object({
  name: text(60),
  birthDate: z.iso.date(),
  city: z.enum(cities),
  gender: text(40),
  adult: z.literal(true),
});
export async function onboarding(actor: string, raw: unknown) {
  const { step, data } = z
    .object({ step: z.number().int().min(0).max(4), data: z.unknown() })
    .parse(raw);
  return tx(async (db) => {
    const u = await one(db, "SELECT * FROM users WHERE id=$1 FOR UPDATE", [
      actor,
    ]);
    if (!u.email_verified_at && !u.demo)
      throw new ForbiddenException("Verify your email first.");
    if (step > u.onboarding_step)
      throw new BadRequestException("Complete the previous step first.");
    if (step === 0) {
      const p = basics.parse(data);
      const adult = await one(
        db,
        "SELECT $1::date<=CURRENT_DATE-interval '18 years' AND $1::date>='1900-01-01'::date AS valid",
        [p.birthDate],
      );
      if (!adult.valid)
        throw new BadRequestException("Sangai is for adults aged 18 or older.");
      if (
        u.adult_declared_at &&
        String(new Date(u.birth_date).toISOString().slice(0, 10)) !==
          p.birthDate
      )
        throw new BadRequestException(
          "Birth date cannot be changed after your adult declaration.",
        );
      await db.query(
        "UPDATE users SET name=$2,birth_date=$3,city=$4,gender=$5,adult_declared_at=COALESCE(adult_declared_at,now()) WHERE id=$1",
        [actor, p.name, p.birthDate, p.city, p.gender],
      );
    } else if (step === 1) {
      const p = z.object({ bio: text(600) }).parse(data);
      if (!u.avatar_id && !u.demo)
        throw new BadRequestException("Add a profile photo to continue.");
      await db.query("UPDATE users SET bio=$2 WHERE id=$1", [actor, p.bio]);
    } else if (step === 2) {
      const p = z
        .object({
          intent: z.enum([
            "Serious relationship",
            "Marriage",
            "Casual dating",
            "Friendship first",
            "Still figuring it out",
          ]),
          interests: z.array(text(32)).min(1).max(12),
          languages: z.array(text(40)).max(8),
          hobbies: z.array(text(40)).max(8),
        })
        .parse(data);
      await db.query(
        "UPDATE users SET intent=$2,interests=$3,languages=$4,hobbies=$5 WHERE id=$1",
        [actor, p.intent, p.interests, p.languages, p.hobbies],
      );
    } else if (step === 3) {
      const p = z
        .object({
          preferences: profileInput.shape.preferences,
          lifestyle: profileInput.shape.lifestyle,
          profession: z.string().max(100),
          education: z.string().max(100),
        })
        .parse(data);
      await db.query(
        "UPDATE users SET preferences=$2,lifestyle=$3,profession=$4,education=$5 WHERE id=$1",
        [
          actor,
          JSON.stringify(p.preferences),
          JSON.stringify(p.lifestyle),
          p.profession,
          p.education,
        ],
      );
    } else {
      const p = z.object({ prompt: text(300) }).parse(data);
      if (
        !u.adult_declared_at ||
        !u.bio ||
        !u.interests.length ||
        (!u.avatar_id && !u.demo)
      )
        throw new BadRequestException("Complete all profile sections first.");
      await db.query(
        "UPDATE users SET prompt=$2,onboarded_at=now() WHERE id=$1",
        [actor, p.prompt],
      );
    }
    await db.query(
      "UPDATE users SET onboarding_step=GREATEST(onboarding_step,$2) WHERE id=$1",
      [actor, step + 1],
    );
    return { ok: true };
  });
}
