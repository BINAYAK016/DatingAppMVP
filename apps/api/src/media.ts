import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { matched, one, pool, tx } from "./db";
const exec = promisify(execFile);
export const uploadDir = resolve(process.env.UPLOAD_DIR || "uploads");
export async function upload(actor: string, file: Express.Multer.File) {
  if (!file || file.size > 20 * 1024 * 1024)
    throw new BadRequestException("Choose a photo or a video up to 20 MB.");
  await mkdir(uploadDir, { recursive: true });
  const id = randomUUID();
  const isVideo = file.mimetype.startsWith("video/");
  let path = "";
  if (isVideo) {
    const raw = join(uploadDir, `${id}.input`);
    path = join(uploadDir, `${id}.mp4`);
    await writeFile(raw, file.buffer);
    try {
      const { stdout } = await exec(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "json", raw],
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
    } catch {
      await unlink(path).catch(() => {});
      throw new BadRequestException(
        "Video must be valid, at most 30 seconds, and supported by the beta encoder.",
      );
    } finally {
      await unlink(raw).catch(() => {});
    }
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
  await pool.query(
    "INSERT INTO media(id,owner,kind,path,mime) VALUES($1,$2,$3,$4,$5)",
    [
      id,
      actor,
      isVideo ? "video" : "image",
      path,
      isVideo ? "video/mp4" : "image/jpeg",
    ],
  );
  return { id, kind: isVideo ? "video" : "image" };
}
export async function authorizedMedia(actor: string, id: string) {
  return tx(async (db) => {
    const m = await one(db, "SELECT * FROM media WHERE id=$1", [id]);
    if (!m) throw new NotFoundException();
    if (m.owner === actor) return m;
    if (!(await matched(db, actor, m.owner))) {
      // Discovery exposes ONLY the explicitly selected profile photo, never social media.
      const p = await one(
        db,
        `SELECT 1 FROM users u WHERE id=$1 AND avatar_id=$2 AND NOT paused AND NOT suspended AND NOT EXISTS(SELECT 1 FROM blocks WHERE (actor=$1 AND target=$3) OR (actor=$3 AND target=$1))`,
        [m.owner, id, actor],
      );
      if (!p) throw new NotFoundException("Media unavailable.");
      return m;
    }
    const visible = await one(
      db,
      `SELECT 1 WHERE EXISTS(SELECT 1 FROM users WHERE id=$1 AND avatar_id=$2) OR EXISTS(SELECT 1 FROM posts WHERE author=$1 AND media_id=$2) OR EXISTS(SELECT 1 FROM stories WHERE author=$1 AND media_id=$2 AND expires_at>now()) OR EXISTS(SELECT 1 FROM snaps WHERE recipient=$3 AND sender=$1 AND media_id=$2 AND view_until>now() AND expires_at>now())`,
      [m.owner, id, actor],
    );
    if (!visible) throw new NotFoundException("Media unavailable.");
    return m;
  });
}
export async function cleanup() {
  await pool.query("DELETE FROM sessions WHERE expires_at<now()");
  await pool.query("DELETE FROM stories WHERE expires_at<now()");
  await pool.query(
    "DELETE FROM snaps WHERE expires_at<now() OR view_until<now()",
  );
  const stale = await pool.query(
    `DELETE FROM media m WHERE created_at<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM users WHERE avatar_id=m.id) AND NOT EXISTS(SELECT 1 FROM posts WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM stories WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM snaps WHERE media_id=m.id) RETURNING path`,
  );
  for (const m of stale.rows) await unlink(m.path).catch(() => {});
}
