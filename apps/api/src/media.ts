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
import { eligibility } from "./discovery";
const exec = promisify(execFile);
export const uploadDir = resolve(process.env.UPLOAD_DIR || "uploads");
export async function removeMediaFiles(path: string) {
  await unlink(path).catch(() => {});
  if (path.endsWith(".mp4")) await unlink(path + ".jpg").catch(() => {});
}
export async function upload(actor: string, file: Express.Multer.File) {
  if (!file || file.size > 20 * 1024 * 1024)
    throw new BadRequestException("Choose a photo or a video up to 20 MB.");
  await mkdir(uploadDir, { recursive: true });
  const id = randomUUID();
  const isVideo = file.mimetype.startsWith("video/");
  let path = "";
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
    const raw = join(uploadDir, `${id}.input`);
    path = join(uploadDir, `${id}.mp4`);
    await writeFile(raw, file.buffer);
    try {
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
      await removeMediaFiles(path);
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
      await removeMediaFiles(path);
      throw new BadRequestException(
        "Choose a valid image under 40 megapixels.",
      );
    }
  }
  try {
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
  } catch (error) {
    await removeMediaFiles(path);
    throw error;
  }
  return { id, kind: isVideo ? "video" : "image" };
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
  const stale = await pool.query(
    `DELETE FROM media m WHERE created_at<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM users WHERE avatar_id=m.id) AND NOT EXISTS(SELECT 1 FROM profile_media WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM posts WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM post_media WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM stories WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM snaps WHERE media_id=m.id) AND NOT EXISTS(SELECT 1 FROM messages WHERE media_id=m.id) RETURNING path`,
  );
  for (const m of stale.rows) await removeMediaFiles(m.path);
}
