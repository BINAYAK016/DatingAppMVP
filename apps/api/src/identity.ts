import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import { z } from "zod";
import { digest, hashPassword, session } from "./auth";
import { one, pool, tx } from "./db";
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
    otpConfigured:
      !!process.env.OTP_HASH_SECRET && process.env.OTP_HASH_SECRET.length >= 32,
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
    requireTLS:
      !["mailpit", "localhost", "127.0.0.1", "::1"].includes(
        process.env.SMTP_HOST,
      ) && process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    dnsTimeout: 8000,
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
type Purpose = "verify" | "reset";
function codeHash(id: string, user: string, purpose: string, code: string) {
  const secret = process.env.OTP_HASH_SECRET;
  if (!secret || secret.length < 32)
    throw new ServiceUnavailableException(
      "Email verification is not configured. Please try again later.",
    );
  return (
    "hmac:" +
    createHmac("sha256", secret)
      .update(`${id}:${user}:${purpose}:${code}`)
      .digest("hex")
  );
}
function timing(challenge: any) {
  return {
    resendAt: new Date(
      new Date(challenge.created_at).getTime() + 60000,
    ).toISOString(),
    expiresAt: new Date(challenge.expires_at).toISOString(),
  };
}
async function issueChallenge(user: string, purpose: Purpose) {
  const reserved = await tx(async (db) => {
    const u = await one(
      db,
      "SELECT * FROM users WHERE id=$1 AND NOT suspended AND NOT demo FOR UPDATE",
      [user],
    );
    if (!u) throw new UnauthorizedException("Please sign in again.");
    if (purpose === "verify" && u.email_verified_at)
      return { verified: true as const };
    const recent = await one(
      db,
      "SELECT * FROM auth_challenges WHERE user_id=$1 AND purpose=$2 AND created_at>now()-interval '1 minute' ORDER BY created_at DESC LIMIT 1",
      [user, purpose],
    );
    if (recent) return { cooldown: recent };
    const counts = await one(
      db,
      "SELECT count(*) FILTER(WHERE created_at>now()-interval '1 hour')::int AS hourly,count(*)::int AS daily FROM auth_challenges WHERE user_id=$1 AND purpose=$2 AND created_at>now()-interval '1 day'",
      [user, purpose],
    );
    if (counts.hourly >= 5 || counts.daily >= 15)
      throw new BadRequestException(
        "You’ve requested several codes. Please wait an hour before trying again.",
      );
    const previous = await one(
      db,
      "SELECT id,token_hash FROM auth_challenges WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [user, purpose],
    );
    let code: string;
    do {
      code = randomInt(0, 1000000).toString().padStart(6, "0");
    } while (
      previous &&
      previous.token_hash.replace(/^pending:/, "") ===
        (previous.token_hash.includes("hmac:")
          ? codeHash(previous.id, user, purpose, code)
          : digest(code))
    );
    const id = randomUUID();
    const hash = codeHash(id, user, purpose, code);
    // A pending challenge is not redeemable. SMTP never runs under the global DB lock.
    const challenge = await one(
      db,
      "INSERT INTO auth_challenges(id,user_id,purpose,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '15 minutes') RETURNING *",
      [id, user, purpose, "pending:" + hash],
    );
    return { id, hash, code, email: u.email, challenge };
  });
  if ("verified" in reserved) return { ok: true, verified: true };
  if ("cooldown" in reserved)
    return {
      ok: true,
      sent: false,
      sending: reserved.cooldown.token_hash.startsWith("pending:"),
      ...timing(reserved.cooldown),
    };
  try {
    await mail(reserved.email, purpose, reserved.code);
  } catch {
    await tx(async (db) => {
      await db.query(
        "DELETE FROM auth_challenges WHERE id=$1 AND token_hash LIKE 'pending:%'",
        [reserved.id],
      );
    });
    throw new ServiceUnavailableException(
      "We couldn’t send the email. Please try again shortly.",
    );
  }
  const activated = await tx(async (db) => {
    const pending = await one(
      db,
      "SELECT id FROM auth_challenges WHERE id=$1 AND used_at IS NULL AND expires_at>now() AND token_hash LIKE 'pending:%' FOR UPDATE",
      [reserved.id],
    );
    if (!pending) return false;
    await db.query(
      "UPDATE auth_challenges SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL AND id<>$3",
      [user, purpose, reserved.id],
    );
    await db.query(
      "UPDATE auth_challenges SET token_hash=$2 WHERE id=$1 AND token_hash LIKE 'pending:%'",
      [reserved.id, reserved.hash],
    );
    return true;
  });
  return { ok: true, sent: activated, ...timing(reserved.challenge) };
}
export async function sendVerification(actor: string) {
  return issueChallenge(actor, "verify");
}
async function consume(
  db: import("./db").DB,
  user: string,
  purpose: string,
  code: string,
) {
  const attempts = await one(
    db,
    "SELECT COALESCE(sum(attempts),0)::int AS total FROM auth_challenges WHERE user_id=$1 AND purpose=$2 AND created_at>now()-interval '1 hour'",
    [user, purpose],
  );
  if (attempts.total >= 20) return "limited" as const;
  const row = await one(
    db,
    "SELECT * FROM auth_challenges WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL AND token_hash NOT LIKE 'pending:%' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
    [user, purpose],
  );
  if (!row) return "invalid" as const;
  if (new Date(row.expires_at).getTime() <= Date.now())
    return "expired" as const;
  if (row.attempts >= 5) return "exhausted" as const;
  await db.query("UPDATE auth_challenges SET attempts=attempts+1 WHERE id=$1", [
    row.id,
  ]);
  // Existing opaque challenges remain valid until expiry/consumption; new codes use HMAC.
  const expected = row.token_hash.startsWith("hmac:")
    ? codeHash(row.id, user, purpose, code.trim())
    : digest(code.trim());
  if (
    row.token_hash.length !== expected.length ||
    !timingSafeEqual(Buffer.from(row.token_hash), Buffer.from(expected))
  )
    return "invalid" as const;
  await db.query("UPDATE auth_challenges SET used_at=now() WHERE id=$1", [
    row.id,
  ]);
  return "ok" as const;
}
function verificationError(result: string) {
  return result === "expired"
    ? "That code has expired. Resend a new code."
    : result === "exhausted"
      ? "Too many incorrect codes. Resend a new code."
      : result === "limited"
        ? "Too many attempts. Please wait an hour before trying again."
        : "That code isn’t correct. Please try again.";
}
export async function verifyEmail(actor: string, code: string) {
  const result = await tx(async (db) => {
    const result = await consume(db, actor, "verify", code);
    if (result !== "ok") return result;
    await db.query("UPDATE users SET email_verified_at=now() WHERE id=$1", [
      actor,
    ]);
    return "ok";
  });
  if (result !== "ok") throw new BadRequestException(verificationError(result));
  return { ok: true };
}
export async function forgot(email: string) {
  if (!process.env.SMTP_HOST || !authConfig().otpConfigured)
    throw new ServiceUnavailableException(
      "Email delivery is not configured on this beta server.",
    );
  const u = await one(
    pool,
    "SELECT * FROM users WHERE email=$1 AND NOT demo AND NOT suspended",
    [email.toLowerCase()],
  );
  // Public recovery responses stay uniform; do not reveal which address exists.
  if (u) await issueChallenge(u.id, "reset").catch(() => {});
  return {
    ok: true,
    message: "If an account exists, a reset code has been sent.",
    resendAt: new Date(Date.now() + 60000).toISOString(),
  };
}
export async function reset(email: string, code: string, password: string) {
  const ok = await tx(async (db) => {
    const u = await one(
      db,
      "SELECT id FROM users WHERE email=$1 AND NOT suspended AND NOT demo",
      [email.toLowerCase()],
    );
    if (!u || (await consume(db, u.id, "reset", code)) !== "ok") return false;
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
