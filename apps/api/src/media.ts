import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, stat, open } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import type { Response } from "express";
import sharp from "sharp";
import { DB, matched, one, pool, tx } from "./db";
import { eligibility } from "./discovery";
import { RateLimitExceeded } from "./rate-limit";
const exec = promisify(execFile);
export const uploadDir = resolve(process.env.UPLOAD_DIR || "uploads");
function boundedConfig(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 32)
    throw new Error(`Invalid media concurrency configuration: ${name}`);
  return value;
}
function semaphore(total: number, perActor: number) {
  let active = 0;
  const actors = new Map<string, number>();
  return (actor: string) => {
    const current = actors.get(actor) || 0;
    if (active >= total || current >= perActor)
      throw new RateLimitExceeded(
        5,
        "Uploads are busy. Please try again shortly.",
      );
    active++;
    actors.set(actor, current + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active--;
      const remaining = (actors.get(actor) || 1) - 1;
      if (remaining) actors.set(actor, remaining);
      else actors.delete(actor);
    };
  };
}
// The middleware reserves BEFORE Multer buffers a multipart body. Encoder work
// remains independently bounded even if the response closes during processing.
export const reserveUpload = semaphore(
  boundedConfig("MAX_UPLOAD_REQUESTS", 4),
  boundedConfig("MAX_UPLOAD_REQUESTS_PER_ACCOUNT", 2),
);
const reserveProcessing = semaphore(
  boundedConfig("MAX_MEDIA_PROCESSING", 2),
  boundedConfig("MAX_MEDIA_PROCESSING_PER_ACCOUNT", 1),
);
function privatePath(path: string) {
  const absolute = resolve(path);
  const within = relative(uploadDir, absolute);
  if (
    !within ||
    within === ".." ||
    within.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) ||
    isAbsolute(within)
  )
    throw new Error("Media deletion path is outside private storage.");
  return absolute;
}
async function unlinkIfPresent(path: string) {
  try {
    await unlink(privatePath(path));
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error;
  }
}
export async function removeMediaFiles(path: string) {
  await unlinkIfPresent(path);
  if (path.endsWith(".mp4")) await unlinkIfPresent(path + ".jpg");
}
async function discardUploadFiles(paths: string[]) {
  if (!paths.length) return;
  try {
    await tx((db) => queueMediaDeletion(db, paths));
  } catch (error) {
    // If the database is unavailable, remove what can be removed rather than
    // creating untracked files. A simultaneous filesystem failure is surfaced.
    for (const path of paths) await removeMediaFiles(path);
    throw error;
  }
  // Once queued, a failed immediate drain must not replace the upload error.
  // The maintenance worker retries these durable jobs after its lease expires.
  await drainMediaDeletions().catch(() => {});
}
export async function upload(actor: string, file: Express.Multer.File) {
  if (!file || file.size > 20 * 1024 * 1024)
    throw new BadRequestException("Choose a photo or a video up to 20 MB.");
  const release = reserveProcessing(actor);
  try {
    return await processUpload(actor, file);
  } finally {
    release();
  }
}
async function processUpload(actor: string, file: Express.Multer.File) {
  await mkdir(uploadDir, { recursive: true });
  const id = randomUUID();
  const isVideo = file.mimetype.startsWith("video/");
  let path = "";
  let raw = "";
  try {
    if (isVideo) {
      // Force a self-contained container; never let a disguised playlist resolve URLs.
      const container =
        file.buffer.subarray(4, 8).toString() === "ftyp"
          ? "mov"
          : file.buffer
                .subarray(0, 4)
                .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
            ? "matroska"
            : null;
      if (!container)
        throw new BadRequestException("Choose an MP4, MOV or WebM video file.");
      const inputOptions = [
        "-protocol_whitelist",
        "file,pipe",
        "-f",
        container,
        ...(container === "mov"
          ? ["-enable_drefs", "0", "-use_absolute_path", "0"]
          : []),
      ];
      raw = join(uploadDir, `${id}.input`);
      path = join(uploadDir, `${id}.mp4`);
      try {
        await writeFile(raw, file.buffer);
        const { stdout } = await exec(
          "ffprobe",
          [
            "-v",
            "error",
            ...inputOptions,
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            raw,
          ],
          { timeout: 15000 },
        );
        const duration = Number(JSON.parse(stdout).format.duration);
        if (!Number.isFinite(duration) || duration > 30 || duration <= 0)
          throw new Error("duration");
        await exec(
          "ffmpeg",
          [
            "-nostdin",
            "-y",
            ...inputOptions,
            "-i",
            raw,
            "-t",
            "30",
            "-vf",
            "scale=720:720:force_original_aspect_ratio=decrease:force_divisible_by=2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "27",
            "-c:a",
            "aac",
            "-b:a",
            "96k",
            "-map_metadata",
            "-1",
            "-movflags",
            "+faststart",
            path,
          ],
          { timeout: 90000, maxBuffer: 1024 * 1024 },
        );
        await exec(
          "ffmpeg",
          [
            "-nostdin",
            "-y",
            "-i",
            path,
            "-frames:v",
            "1",
            "-vf",
            "scale=480:480:force_original_aspect_ratio=decrease",
            path + ".jpg",
          ],
          { timeout: 15000, maxBuffer: 1024 * 1024 },
        );
      } catch {
        throw new BadRequestException(
          "Video must be valid, at most 30 seconds, and supported by the beta encoder.",
        );
      }
      await discardUploadFiles([raw]);
    } else {
      path = join(uploadDir, `${id}.jpg`);
      try {
        await sharp(file.buffer, { limitInputPixels: 40000000 })
          .rotate()
          .resize(1440, 1440, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toFile(path);
      } catch {
        throw new BadRequestException(
          "Choose a valid image under 40 megapixels.",
        );
      }
    }
    // Account deletion selects and queues this owner's paths under the same
    // lock. Metadata must not appear between that selection and its cascade.
    await tx((db) =>
      db.query(
        "INSERT INTO media(id,owner,kind,path,mime) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          actor,
          isVideo ? "video" : "image",
          path,
          isVideo ? "video/mp4" : "image/jpeg",
        ],
      ),
    );
    return { id, kind: isVideo ? "video" : "image" };
  } catch (error) {
    await discardUploadFiles([path, raw].filter(Boolean));
    throw error;
  }
}
export async function authorizedMedia(
  actor: string,
  id: string,
  thumbnail = false,
) {
  const media = await tx(async (db) => {
    const m = await one(db, "SELECT * FROM media WHERE id=$1", [id]);
    if (!m) throw new NotFoundException();
    if (m.owner === actor) return m;
    if (!(await matched(db, actor, m.owner))) {
      // Discovery exposes ONLY the explicitly selected profile photo, never social media.
      const p = await one(
        db,
        `SELECT 1 FROM users u CROSS JOIN users me WHERE u.id=$1 AND (u.avatar_id=$2 OR EXISTS(SELECT 1 FROM profile_media WHERE user_id=u.id AND media_id=$2)) AND me.id=$3 AND ${eligibility}`,
        [m.owner, id, actor],
      );
      if (!p) throw new NotFoundException("Media unavailable.");
      return m;
    }
    const visible = await one(
      db,
      `SELECT 1 WHERE EXISTS(SELECT 1 FROM users WHERE id=$1 AND avatar_id=$2) OR EXISTS(SELECT 1 FROM profile_media WHERE user_id=$1 AND media_id=$2) OR EXISTS(SELECT 1 FROM posts p JOIN users u ON u.id=p.author WHERE p.author=$1 AND (p.media_id=$2 OR EXISTS(SELECT 1 FROM post_media pm WHERE pm.post_id=p.id AND pm.media_id=$2)) AND u.posts_visible) OR EXISTS(SELECT 1 FROM stories s JOIN users u ON u.id=s.author WHERE s.author=$1 AND s.media_id=$2 AND s.expires_at>now() AND u.stories_visible) OR EXISTS(SELECT 1 FROM messages WHERE sender=$1 AND recipient=$3 AND media_id=$2) OR EXISTS(SELECT 1 FROM snaps WHERE recipient=$3 AND sender=$1 AND media_id=$2 AND view_until>now() AND expires_at>now())`,
      [m.owner, id, actor],
    );
    if (!visible) throw new NotFoundException("Media unavailable.");
    return m;
  });
  if (!thumbnail) return media;
  if (media.kind !== "video") return media;
  try {
    await stat(media.path + ".jpg");
  } catch {
    throw new NotFoundException("Preview unavailable.");
  }
  return { ...media, path: media.path + ".jpg", mime: "image/jpeg" };
}
export async function cleanup() {
  await pool.query("DELETE FROM sessions WHERE expires_at<now()");
  await pool.query("DELETE FROM stories WHERE expires_at<now()");
  await pool.query(
    "DELETE FROM snaps WHERE expires_at<now() OR view_until<now()",
  );
  await tx(async (db) => {
    // Attachment claims share this lock. Orphan selection must begin after their
    // commit so a stale DELETE snapshot cannot cascade a newly attached photo.
    const stale = await db.query(
      `DELETE FROM media m WHERE created_at<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM users WHERE avatar_id=m.id) AND NOT EXISTS(SELECT 1 FROM profile_media WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM posts WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM post_media WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM stories WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM snaps WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM messages WHERE media_id=m.id) RETURNING path`,
    );
    await queueMediaDeletion(
      db,
      stale.rows.map((m) => m.path),
    );
  });
  await drainMediaDeletions();
}

export async function queueMediaDeletion(db: DB, paths: string[]) {
  const files = new Set<string>();
  for (const path of paths) {
    files.add(privatePath(path));
    if (path.endsWith(".mp4")) files.add(privatePath(path + ".jpg"));
  }
  for (const path of files)
    await db.query(
      "INSERT INTO media_deletion_jobs(id,path) VALUES($1,$2) ON CONFLICT(path) DO NOTHING",
      [randomUUID(), path],
    );
}
export async function drainMediaDeletions(limit = 20) {
  const claim = randomUUID();
  const jobs = await pool.query(
    `WITH due AS (SELECT id FROM media_deletion_jobs WHERE next_attempt_at<=now() AND (claimed_until IS NULL OR claimed_until<=now()) ORDER BY created_at,id LIMIT $1 FOR UPDATE SKIP LOCKED)
     UPDATE media_deletion_jobs j SET claim_id=$2,claimed_until=now()+interval '30 seconds',attempts=LEAST(attempts+1,30) FROM due WHERE j.id=due.id RETURNING j.*`,
    [Math.max(1, Math.min(100, Math.floor(limit))), claim],
  );
  let deleted = 0,
    failed = 0;
  for (const job of jobs.rows) {
    try {
      await unlinkIfPresent(job.path);
      await pool.query(
        "DELETE FROM media_deletion_jobs WHERE id=$1 AND claim_id=$2",
        [job.id, claim],
      );
      deleted++;
    } catch (error: any) {
      failed++;
      const code =
        typeof error.code === "string" && /^[A-Z0-9_]{1,40}$/.test(error.code)
          ? error.code
          : "DELETE_FAILED";
      await pool.query(
        "UPDATE media_deletion_jobs SET claim_id=NULL,claimed_until=NULL,last_error=$3,next_attempt_at=now()+$4*interval '1 second' WHERE id=$1 AND claim_id=$2",
        [
          job.id,
          claim,
          code,
          Math.min(3600, 5 * 2 ** Math.min(job.attempts, 10)),
        ],
      );
    }
  }
  return { deleted, failed };
}

export async function sendAuthorizedMedia(
  actor: string,
  id: string,
  thumbnail: boolean,
  res: Response,
) {
  const media = await authorizedMedia(actor, id, thumbnail);
  let file;
  try {
    file = await open(media.path, "r");
  } catch (error: any) {
    if (error.code === "ENOENT")
      throw new NotFoundException("Media unavailable.");
    throw new ServiceUnavailableException(
      "Media is temporarily unavailable. Try again shortly.",
    );
  }
  try {
    const info = await file.stat();
    const range = res.req.headers.range;
    let start: number | undefined, end: number | undefined;
    if (range) {
      const parsed = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!parsed) {
        res.status(416).set("Content-Range", `bytes */${info.size}`).end();
        return;
      }
      start = Number(parsed[1]);
      end = Math.min(
        parsed[2] ? Number(parsed[2]) : info.size - 1,
        info.size - 1,
      );
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start > end ||
        start >= info.size
      ) {
        res.status(416).set("Content-Range", `bytes */${info.size}`).end();
        return;
      }
    }
    res.set({
      "Content-Type": media.mime,
      "Cache-Control": "private, no-store",
      "Accept-Ranges": "bytes",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    if (start !== undefined && end !== undefined)
      res.status(206).set({
        "Content-Range": `bytes ${start}-${end}/${info.size}`,
        "Content-Length": String(end - start + 1),
      });
    else res.set("Content-Length", String(info.size));
    await pipeline(file.createReadStream({ start, end }), res);
  } catch (error) {
    if (!res.headersSent && !res.destroyed) throw error;
    res.destroy();
  } finally {
    await file.close().catch(() => {});
  }
}
