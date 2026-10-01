import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import sharp from "sharp";
import {
  DemoPersona,
  demoEntityId,
  demoIds,
  demoTimestamp,
} from "./demoPersonas";

export type DemoMediaRole =
  "avatar" | "profile" | "feed" | "story" | "chat" | "video";
export type DemoMediaRecord = {
  id: string;
  owner: string;
  kind: "image" | "video";
  path: string;
  mime: "image/jpeg" | "video/mp4";
  created_at: string;
  thumbnailPath?: string;
};
export type DemoMediaOptions = { rootDir?: string };
export class DemoMediaPreparationError extends Error {
  constructor(
    kind: "image" | "video",
    readonly cleanupPaths: readonly string[],
  ) {
    super(
      `Synthetic demo ${kind} generation failed. Check the bundled artwork and private storage.`,
    );
    this.name = "DemoMediaPreparationError";
  }
}
const inFlight = new Map<string, Promise<DemoMediaRecord>>();
const palettes = [
  ["#E7EBD9", "#72845B", "#D8A788", "#49372F", "#FCF8ED"],
  ["#F8E3DC", "#AA536B", "#BC805F", "#332B35", "#FFF6EC"],
  ["#DFE8F4", "#657EAD", "#E1AE8B", "#352B29", "#FFF9F0"],
  ["#EDE3F4", "#8E759E", "#976846", "#292C35", "#FFF8E9"],
  ["#F3E8C9", "#A28246", "#C8916B", "#413431", "#FFFFF7"],
  ["#D9EEE7", "#537F76", "#EBC2A3", "#483B34", "#FFF9EF"],
];
function escapeXml(value: string) {
  return value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}
function svg(
  content: string,
  width: number,
  height: number,
  background = "#FFFBF8",
) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 720 ${height}"><rect width="720" height="${height}" fill="${background}"/><g transform="translate(0,${(height - 960) / 2})">${content}</g></svg>`;
}
function portrait(persona: DemoPersona) {
  const [background, coat, skin, hair, paper] =
    palettes[(persona.index - 1) % palettes.length];
  const style = persona.index % 5;
  const glasses = persona.index % 4 === 0;
  const hairstyle =
    style === 0
      ? `<path d="M211 485Q147 281 218 225Q338 138 450 217Q550 246 512 492L470 488Q447 382 476 300Q379 335 252 291L250 484Z" fill="${hair}"/>`
      : style === 1
        ? `<path d="M217 302Q209 211 307 190Q446 170 496 265L499 323Q422 299 400 240Q340 306 217 302Z" fill="${hair}"/>`
        : style === 2
          ? `<path d="M212 359Q181 243 286 208Q391 153 468 226Q537 272 500 379L476 303Q335 289 244 310Z" fill="${hair}"/><g fill="${hair}"><circle cx="245" cy="238" r="40"/><circle cx="301" cy="211" r="43"/><circle cx="360" cy="205" r="45"/><circle cx="424" cy="224" r="44"/><circle cx="470" cy="264" r="39"/></g>`
          : style === 3
            ? `<path d="M211 315Q206 203 343 188Q490 180 506 319L474 281Q389 256 241 295Z" fill="${hair}"/><path d="M227 312Q209 400 233 452M487 313Q509 400 488 456" stroke="${hair}" stroke-width="30" fill="none" stroke-linecap="round"/>`
            : `<path d="M220 325Q197 220 324 190Q458 164 502 293L484 340Q446 292 436 247Q343 332 220 325Z" fill="${hair}"/><circle cx="455" cy="217" r="45" fill="${hair}"/>`;
  return svg(
    `
    <rect width="720" height="960" fill="${background}"/>
    <circle cx="586" cy="155" r="132" fill="${paper}" opacity=".85"/>
    <path d="M0 771Q204 670 401 788T720 751V960H0Z" fill="${coat}" opacity=".14"/>
    <path d="M66 736L104 518M100 621Q157 591 138 561Q98 546 95 590M89 673Q27 632 47 604Q84 588 96 645" stroke="${coat}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".55"/>
    <path d="M149 858Q150 614 308 577L419 577Q573 626 583 858Z" fill="${coat}"/>
    <path d="M309 496H420V618Q363 671 309 618Z" fill="${skin}"/>
    <path d="M310 568Q359 590 419 565V593Q361 619 310 598Z" fill="${hair}" opacity=".10"/>
    <ellipse cx="235" cy="377" rx="24" ry="41" fill="${skin}"/>
    <ellipse cx="485" cy="377" rx="24" ry="41" fill="${skin}"/>
    <path d="M236 297Q244 232 361 222Q477 235 484 297L479 418Q466 536 361 558Q253 537 239 418Z" fill="${skin}"/>
    ${hairstyle}
    <path d="M277 343Q297 330 318 341M402 341Q421 330 445 343" stroke="${hair}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="301" cy="373" rx="6" ry="8" fill="${hair}"/><ellipse cx="422" cy="373" rx="6" ry="8" fill="${hair}"/>
    <path d="M365 374L354 420Q365 426 376 420" stroke="${hair}" stroke-opacity=".27" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="285" cy="424" rx="21" ry="11" fill="#B66865" opacity=".22"/><ellipse cx="438" cy="424" rx="21" ry="11" fill="#B66865" opacity=".22"/>
    <path d="M326 465Q363 484 398 463" stroke="${hair}" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${glasses ? `<g stroke="${hair}" stroke-width="6" fill="none"><rect x="263" y="350" width="77" height="51" rx="18"/><rect x="386" y="350" width="77" height="51" rx="18"/><path d="M340 366Q363 355 386 366M244 366H263M463 366H485"/></g>` : ""}
    <path d="M310 619L359 663L413 619M361 665V801" stroke="${paper}" stroke-width="5" fill="none" opacity=".72"/>
    <circle cx="360" cy="709" r="5" fill="${paper}"/><circle cx="360" cy="749" r="5" fill="${paper}"/>
    <rect x="40" y="855" width="640" height="72" rx="18" fill="${paper}" opacity=".93"/>
    <text x="63" y="888" font-family="sans-serif" font-size="24" font-weight="bold" fill="#2C2529">${escapeXml(persona.profile.name)}</text>
    <text x="63" y="911" font-family="sans-serif" font-size="13" letter-spacing="2" fill="#75666D">FICTIONAL DEMO · ILLUSTRATION ${String(persona.index).padStart(2, "0")}</text>
  `,
    720,
    960,
  );
}
function scene(persona: DemoPersona, role: DemoMediaRole, slot: number) {
  const [background, accent, , , paper] =
    palettes[(persona.index + slot) % palettes.length];
  const variant = (persona.index + slot) % 4;
  const themes = [
    "A SMALL COFFEE BREAK",
    "A SLOW AFTERNOON",
    "TAKE THE SCENIC PATH",
    "A LITTLE CREATIVE TIME",
  ];
  const illustration =
    variant === 0
      ? `<rect x="135" y="435" width="450" height="195" rx="21" fill="${paper}"/><ellipse cx="358" cy="662" rx="246" ry="24" fill="${accent}" opacity=".17"/><path d="M274 455H423L407 608Q351 633 291 608Z" fill="${accent}"/><path d="M420 477Q504 466 493 530Q484 569 414 563" fill="none" stroke="${accent}" stroke-width="24"/><path d="M324 401Q305 375 331 354M374 401Q357 373 382 347" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity=".5"/><path d="M167 564L206 548L237 566L216 595L183 598Z" fill="#D6A16C"/><circle cx="591" cy="270" r="65" fill="#F0C984"/>`
      : variant === 1
        ? `<path d="M126 443Q245 414 347 457L347 674Q233 632 126 655Z" fill="${paper}"/><path d="M353 457Q471 414 595 443L595 655Q469 632 353 674Z" fill="${accent}" opacity=".85"/><path d="M350 458V673" stroke="#8B7765" stroke-width="9"/><g stroke="${accent}" opacity=".3" stroke-width="6"><path d="M155 483L314 494M155 520L314 531M155 557L314 568M155 594L314 605"/></g><path d="M238 402Q170 337 216 295Q268 299 284 392" fill="${accent}" opacity=".6"/><path d="M245 415L250 335" stroke="${accent}" stroke-width="7"/>`
        : variant === 2
          ? `<circle cx="538" cy="286" r="69" fill="#F1C787"/><path d="M26 655L232 312L438 655Z" fill="${accent}" opacity=".55"/><path d="M250 688L453 379L698 688Z" fill="${accent}"/><path d="M178 405L232 312L287 405L253 386L232 396L208 381Z" fill="${paper}"/><path d="M411 443L453 379L505 445L465 427L449 438Z" fill="${paper}"/><path d="M0 730Q179 632 369 719T720 711V810H0Z" fill="${accent}" opacity=".4"/><path d="M262 810Q385 741 316 696Q269 664 377 637" fill="none" stroke="${paper}" stroke-width="25" stroke-linecap="round"/>`
          : `<rect x="154" y="319" width="410" height="365" rx="20" fill="${paper}"/><rect x="187" y="353" width="344" height="245" rx="8" fill="${background}"/><circle cx="280" cy="430" r="49" fill="#D89C87"/><path d="M193 567L342 421L505 583Z" fill="${accent}" opacity=".75"/><path d="M221 699L186 780M498 699L533 780" stroke="${accent}" stroke-width="15" stroke-linecap="round"/><path d="M578 480L589 687L630 677L611 475Z" fill="#A68665"/><path d="M578 480Q568 420 594 397Q627 415 611 475Z" fill="${accent}"/>`;
  return svg(
    `
    <rect width="720" height="960" fill="${background}"/>
    <circle cx="76" cy="142" r="184" fill="${paper}" opacity=".55"/>
    <path d="M32 209H178M54 238H154" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity=".25"/>
    ${illustration}
    <text x="360" y="184" text-anchor="middle" font-family="sans-serif" font-size="25" font-weight="bold" letter-spacing="2" fill="#2C2529">${themes[variant]}</text>
    <rect x="40" y="855" width="640" height="72" rx="18" fill="${paper}" opacity=".93"/>
    <text x="63" y="888" font-family="sans-serif" font-size="22" fill="#2C2529">${escapeXml(persona.profile.name)}'s ${role === "profile" ? "weekend sketch" : "demo moment"}</text>
    <text x="63" y="911" font-family="sans-serif" font-size="13" letter-spacing="2" fill="#75666D">FICTIONAL DEMO · GENERATED ARTWORK</text>
  `,
    720,
    role === "story" ? 1280 : 960,
    background,
  );
}
function safePath(root: string, ...segments: string[]) {
  const path = resolve(root, ...segments);
  const within = relative(root, path);
  if (
    !within ||
    within === ".." ||
    within.startsWith(".." + (process.platform === "win32" ? "\\" : "/")) ||
    isAbsolute(within)
  )
    throw new Error("Demo media must stay inside private storage.");
  return path;
}
async function exists(path: string) {
  try {
    return (await stat(path)).isFile();
  } catch (error: any) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function removeTemporary(path: string) {
  try {
    await unlink(path);
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function imageBytes(
  persona: DemoPersona,
  role: DemoMediaRole,
  slot: number,
) {
  return sharp(
    Buffer.from(
      role === "avatar" ? portrait(persona) : scene(persona, role, slot),
    ),
    { limitInputPixels: 2000000 },
  )
    .jpeg({ quality: 85, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
async function generate(
  record: DemoMediaRecord,
  persona: DemoPersona,
  role: DemoMediaRole,
  slot: number,
) {
  await mkdir(resolve(record.path, ".."), { recursive: true });
  if (await exists(record.path)) {
    if (record.kind === "image") {
      const meta = await sharp(record.path).metadata();
      if (meta.format !== "jpeg" || !meta.width || !meta.height)
        throw new Error("Existing demo image is invalid.");
    } else {
      const video = await readFile(record.path);
      const poster = await sharp(record.thumbnailPath!).metadata();
      if (
        video.length > 1024 * 1024 ||
        video.subarray(4, 8).toString() !== "ftyp" ||
        poster.format !== "jpeg"
      )
        throw new Error(
          "Existing demo video or its private thumbnail is invalid.",
        );
    }
    return record;
  }
  const suffix = randomUUID();
  const temporary = `${record.path}.${suffix}.tmp`;
  const poster = `${record.path}.${suffix}.poster.jpg`;
  try {
    if (record.kind === "image") {
      const bytes = await imageBytes(persona, role, slot);
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, record.path);
    } else {
      // Original code-generated scenery, encoded once with the project's Docker
      // ffmpeg. Node startup/tests need no host encoder or external service.
      const assetDir = resolve(__dirname, "../src/demo-assets");
      const video = await readFile(join(assetDir, "trail.mp4"));
      if (
        video.length > 1024 * 1024 ||
        video.subarray(4, 8).toString() !== "ftyp"
      )
        throw new Error("Bundled synthetic video is invalid.");
      await writeFile(temporary, video, { flag: "wx" });
      await writeFile(poster, await readFile(join(assetDir, "trail.jpg")), {
        flag: "wx",
      });
      await rename(poster, record.thumbnailPath!);
      await rename(temporary, record.path);
    }
    return record;
  } catch {
    // The record was not returned/attached. Give the coordinator all staging
    // paths, including partially published sidecars, for durable ledger cleanup.
    throw new DemoMediaPreparationError(record.kind, [
      record.path,
      ...(record.thumbnailPath ? [record.thumbnailPath] : []),
      temporary,
      poster,
    ]);
  } finally {
    try {
      await Promise.all([temporary, poster].map(removeTemporary));
    } catch {
      throw new DemoMediaPreparationError(record.kind, [
        record.path,
        ...(record.thumbnailPath ? [record.thumbnailPath] : []),
        temporary,
        poster,
      ]);
    }
  }
}
// Stable media IDs, generation-specific private paths: old deletion jobs cannot
// remove a new reset's files. Call before the reset TX, then insert/attach these
// records atomically using the existing private media tables and authorization.
export function ensureDemoMedia(
  persona: DemoPersona,
  role: DemoMediaRole,
  slot = 0,
  generation = "baseline-v1",
  options: DemoMediaOptions = {},
): Promise<DemoMediaRecord> {
  if (
    !demoIds.includes(persona.id) ||
    persona.id !== demoIds[persona.index - 1]
  )
    throw new Error("Only catalog demo personas may own generated demo media.");
  if (
    !["avatar", "profile", "feed", "story", "chat", "video"].includes(role) ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot > 5
  )
    throw new Error("Invalid demo media role or slot.");
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(generation))
    throw new Error("Invalid private demo storage generation.");
  const root = resolve(options.rootDir || process.env.UPLOAD_DIR || "uploads");
  const folder = safePath(root, "demo", persona.id, generation);
  const path = safePath(
    root,
    relative(root, folder),
    `${role}-${slot}.${role === "video" ? "mp4" : "jpg"}`,
  );
  const record: DemoMediaRecord = {
    id: demoEntityId("media", `${persona.index}:${role}:${slot}`),
    owner: persona.id,
    kind: role === "video" ? "video" : "image",
    path,
    mime: role === "video" ? "video/mp4" : "image/jpeg",
    created_at: demoTimestamp(persona.index * 60 + slot),
    ...(role === "video" ? { thumbnailPath: path + ".jpg" } : {}),
  };
  const pending = inFlight.get(path);
  if (pending) return pending;
  const operation = generate(record, persona, role, slot).finally(() =>
    inFlight.delete(path),
  );
  inFlight.set(path, operation);
  return operation;
}
export async function ensureDemoPersonaMedia(
  persona: DemoPersona,
  generation = "baseline-v1",
  options: DemoMediaOptions = {},
) {
  const avatar = await ensureDemoMedia(
    persona,
    "avatar",
    0,
    generation,
    options,
  );
  const count = persona.index === 1 ? 6 : persona.index % 4 === 0 ? 1 : 3;
  const profile = [avatar];
  // Sequential encoders bound preparation memory. The main photo is gallery0.
  for (let slot = 1; slot < count; slot++)
    profile.push(
      await ensureDemoMedia(persona, "profile", slot, generation, options),
    );
  return { avatar, profile };
}
