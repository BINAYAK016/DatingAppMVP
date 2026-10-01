import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { PoolClient } from "pg";
import { DB, one, pool, publicFields, readTx, requireMatch, rows } from "./db";
import { swipeInTx } from "./discovery";
import { actionGameV2InTx, gamesV2Enabled, inviteGameV2InTx } from "./game-v2";
import { queueMediaDeletion } from "./media";
import {
  DemoEligibilityContext,
  demoEntityId,
  demoIds,
  demoPersonas,
  id,
} from "./demoPersonas";
import { DemoMediaPreparationError, ensureDemoMedia } from "./demoMedia";
import { demoModeEnabled } from "./demo-mode";
import { RateLimitExceeded } from "./rate-limit";

export const DEMO_WORLD_VERSION = 1;
export const demoEnabled = demoModeEnabled;
const worldLock = 20261002;
type Persona = (typeof demoPersonas)[number];
type Asset = Awaited<ReturnType<typeof ensureDemoMedia>> & { purpose: string };
type Assets = {
  all: Asset[];
  profiles: Map<string, Asset[]>;
  get: (owner: number, purpose: string, slot?: number) => Asset;
};
type Scenario = {
  key: string;
  actor: string;
  target: string;
  state: string;
  description: string;
  id?: string;
};

export function demoConfig() {
  return {
    enabled: demoEnabled(),
    version: DEMO_WORLD_VERSION,
    synthetic: true,
    groups: { men: 10, women: 10, lgbtq: 10 },
    groupLabels: { men: "Men", women: "Women", lgbtq: "LGBTQ+ / Other" },
    resetShared: true,
  };
}
function requireDemo() {
  if (!demoEnabled())
    throw new ForbiddenException("The demo environment is not enabled.");
}
const selectorQuery = z
  .object({
    group: z.enum(["men", "women", "lgbtq"]).optional(),
    limit: z.coerce.number().int().min(1).max(10).default(6),
    cursor: z.string().max(200).optional(),
  })
  .strict();
export async function demoUsersPage(query: unknown = {}) {
  requireDemo();
  const input = selectorQuery.parse(query);
  let after = 0;
  if (input.cursor) {
    try {
      const decoded = z
        .object({
          v: z.literal(1),
          after: z.number().int().min(1).max(30),
          group: z.string(),
        })
        .strict()
        .parse(
          JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")),
        );
      if (decoded.group !== (input.group || "all")) throw new Error("group");
      after = decoded.after;
    } catch {
      throw new BadRequestException("Choose a valid demo profile page.");
    }
  }
  const wanted = demoPersonas.filter(
    (p) => (!input.group || p.selectorGroup === input.group) && p.index > after,
  );
  return readTx(async (db) => {
    const found = await rows(
      db,
      `SELECT ${publicFields} FROM users WHERE id=ANY($1::uuid[]) AND demo AND NOT suspended ORDER BY array_position($1::uuid[],id) LIMIT $2`,
      [wanted.map((p) => p.id), input.limit + 1],
    );
    const people = new Map(found.map((p) => [p.id, p]));
    const page = wanted
      .filter((p) => people.has(p.id))
      .slice(0, input.limit + 1);
    const selected = page.slice(0, input.limit);
    return {
      items: selected.map((p) => ({
        ...people.get(p.id),
        demo_group: p.selectorGroup,
        orientation: p.orientation,
        pronouns: p.pronouns,
        looking_for: p.profile.preferences.genders,
      })),
      nextCursor:
        page.length > input.limit
          ? Buffer.from(
              JSON.stringify({
                v: 1,
                after: selected.at(-1)!.index,
                group: input.group || "all",
              }),
            ).toString("base64url")
          : null,
    };
  });
}

async function verifyScope(db: DB, actor?: string) {
  requireDemo();
  const installed = await one(
    db,
    "SELECT version FROM demo_world_metadata WHERE singleton",
  );
  if (installed?.version > DEMO_WORLD_VERSION)
    throw new ConflictException(
      "This demo world needs a newer server version. No data was reset.",
    );
  if (
    actor &&
    (!demoIds.includes(actor) ||
      !(await one(
        db,
        "SELECT 1 FROM users WHERE id=$1 AND demo AND NOT suspended",
        [actor],
      )))
  )
    throw new ForbiddenException(
      "Choose a demo profile before resetting the demo world.",
    );
  if (
    await one(db, "SELECT 1 FROM users WHERE id=ANY($1::uuid[]) AND NOT demo", [
      demoIds,
    ])
  )
    throw new ConflictException(
      "A demo identifier is occupied by a normal account. No data was reset.",
    );
  // Cross-environment references cannot be produced by normal API permissions.
  // Fail closed on legacy/manual references rather than cascading normal data.
  if (
    await one(
      db,
      `SELECT 1 FROM media m WHERE m.owner=ANY($1::uuid[]) AND (
    EXISTS(SELECT 1 FROM users u WHERE u.avatar_id=m.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM profile_media pm JOIN users u ON u.id=pm.user_id WHERE pm.media_id=m.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM posts p JOIN users u ON u.id=p.author WHERE p.media_id=m.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM post_media pm JOIN posts p ON p.id=pm.post_id JOIN users u ON u.id=p.author WHERE pm.media_id=m.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM stories s JOIN users u ON u.id=s.author WHERE s.media_id=m.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM messages x JOIN users u ON u.id=x.sender WHERE x.media_id=m.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM snaps x JOIN users u ON u.id=x.sender WHERE x.media_id=m.id AND NOT u.demo)
  ) LIMIT 1`,
      [demoIds],
    )
  )
    throw new ConflictException(
      "Demo media is referenced outside the demo world. No data was reset.",
    );
  if (
    await one(
      db,
      `SELECT 1 FROM posts p WHERE p.author=ANY($1::uuid[]) AND (
    EXISTS(SELECT 1 FROM comments c JOIN users u ON u.id=c.author WHERE c.post_id=p.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM reactions r JOIN users u ON u.id=r.actor WHERE r.post_id=p.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM saved_posts s JOIN users u ON u.id=s.actor WHERE s.post_id=p.id AND NOT u.demo) OR
    EXISTS(SELECT 1 FROM messages m JOIN users u ON u.id=m.sender WHERE m.post_id=p.id AND NOT u.demo)
  ) LIMIT 1`,
      [demoIds],
    )
  )
    throw new ConflictException(
      "Demo posts are referenced outside the demo world. No data was reset.",
    );
  if (
    await one(
      db,
      `WITH RECURSIVE descendants AS (
    SELECT id FROM comments WHERE author=ANY($1::uuid[])
    UNION SELECT c.id FROM comments c JOIN descendants parent ON c.parent_id=parent.id
  ) SELECT 1 FROM descendants d JOIN comments c ON c.id=d.id
    WHERE NOT(c.author=ANY($1::uuid[])) LIMIT 1`,
      [demoIds],
    )
  )
    throw new ConflictException(
      "Demo comments have replies outside the demo world. No data was reset.",
    );
}

async function prepareAssets(
  generation: string,
  db: PoolClient,
): Promise<Assets> {
  const all: Asset[] = [],
    profiles = new Map<string, Asset[]>();
  const indexed = new Map<string, Asset>();
  const add = async (
    persona: Persona,
    role: Parameters<typeof ensureDemoMedia>[1],
    purpose: string,
    slot = 0,
  ) => {
    const asset = {
      ...(await ensureDemoMedia(persona, role, slot, generation)),
      purpose,
    };
    all.push(asset);
    return asset;
  };
  try {
    for (const persona of demoPersonas) {
      const gallery = [await add(persona, "avatar", "profile")];
      const count =
        persona.index === 1
          ? 6
          : persona.index === 2
            ? 3
            : persona.index % 3 === 0
              ? 2
              : 1;
      for (let slot = 1; slot < count; slot++)
        gallery.push(await add(persona, "profile", "profile", slot));
      profiles.set(persona.id, gallery);
    }
    for (const owner of [1, 2, 3, 26, 4, 5, 21, 23, 25]) {
      const persona = demoPersonas.find((p) => p.id === id(owner))!;
      const count = owner === 1 ? 6 : [2, 3, 26].includes(owner) ? 3 : 1;
      for (let slot = 0; slot < count; slot++)
        indexed.set(
          `${owner}:post:${slot}`,
          await add(persona, "feed", "post", slot),
        );
    }
    for (const owner of [1, 3, 21])
      indexed.set(
        `${owner}:video:0`,
        await add(
          demoPersonas.find((p) => p.id === id(owner))!,
          "video",
          "post",
        ),
      );
    for (const owner of [2, 3, 26, 5, 21, 23]) {
      const persona = demoPersonas.find((p) => p.id === id(owner))!;
      for (let slot = 0; slot < 3; slot++)
        indexed.set(
          `${owner}:story:${slot}`,
          await add(persona, "story", "story", slot),
        );
    }
    indexed.set(
      "2:story-video:0",
      await add(
        demoPersonas.find((p) => p.id === id(2))!,
        "video",
        "story",
        1,
      ),
    );
    indexed.set(
      "2:snap:0",
      await add(
        demoPersonas.find((p) => p.id === id(2))!,
        "story",
        "snap",
        3,
      ),
    );
    indexed.set(
      "1:snap:0",
      await add(
        demoPersonas.find((p) => p.id === id(1))!,
        "story",
        "snap",
        3,
      ),
    );
    indexed.set(
      "3:snap-video:0",
      await add(
        demoPersonas.find((p) => p.id === id(3))!,
        "video",
        "snap",
        2,
      ),
    );
    indexed.set(
      "3:message:0",
      await add(
        demoPersonas.find((p) => p.id === id(3))!,
        "chat",
        "chat",
        0,
      ),
    );
    return {
      all,
      profiles,
      get: (owner, purpose, slot = 0) => {
        const asset = indexed.get(`${owner}:${purpose}:${slot}`);
        if (!asset) throw new Error("Missing private demo asset.");
        return asset;
      },
    };
  } catch (error: any) {
    const cleanupPaths = [
      ...all.map((m) => m.path),
      ...(error instanceof DemoMediaPreparationError ? error.cleanupPaths : []),
    ];
    if (cleanupPaths.length)
      await worldTx(db, (client) => queueMediaDeletion(client, cleanupPaths));
    throw error;
  }
}
async function clearActivity(db: DB) {
  for (const [table, condition] of [
    [
      "notifications",
      "recipient=ANY($1::uuid[]) AND (actor=ANY($1::uuid[]) OR actor IS NULL)",
    ],
    ["game_readiness", "actor=ANY($1::uuid[]) AND target=ANY($1::uuid[])"],
    ["games", "host=ANY($1::uuid[]) AND guest=ANY($1::uuid[])"],
    ["plans", "host=ANY($1::uuid[]) AND guest=ANY($1::uuid[])"],
    ["messages", "sender=ANY($1::uuid[]) AND recipient=ANY($1::uuid[])"],
    ["snaps", "sender=ANY($1::uuid[]) AND recipient=ANY($1::uuid[])"],
    ["saved_posts", "actor=ANY($1::uuid[])"],
    ["comments", "author=ANY($1::uuid[])"],
    ["reactions", "actor=ANY($1::uuid[])"],
    ["posts", "author=ANY($1::uuid[])"],
    ["stories", "author=ANY($1::uuid[])"],
    ["profile_media", "user_id=ANY($1::uuid[])"],
    ["follows", "actor=ANY($1::uuid[]) AND target=ANY($1::uuid[])"],
    ["blocks", "actor=ANY($1::uuid[]) AND target=ANY($1::uuid[])"],
    ["discovery_actions", "actor=ANY($1::uuid[]) AND target=ANY($1::uuid[])"],
    ["connections", "a=ANY($1::uuid[]) AND b=ANY($1::uuid[])"],
  ])
    await db.query(`DELETE FROM ${table} WHERE ${condition}`, [demoIds]);
  await db.query(
    "UPDATE users SET avatar_id=NULL WHERE id=ANY($1::uuid[]) AND demo",
    [demoIds],
  );
}
async function restoreProfiles(db: DB, assets: Assets, anchor: Date) {
  for (const persona of demoPersonas) {
    const p = persona.profile;
    await db.query(
      `INSERT INTO users(id,email,password_hash,name,birth_date,city,bio,intent,interests,prompt,gender,preferences,color,demo,languages,hobbies,profession,education,lifestyle,email_verified_at,adult_declared_at,onboarded_at,onboarding_step,notifications,push_token,created_at)
      VALUES($1,$2,'demo-entry-only',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,$14,$15,$16,$17,NULL,$18,$18,5,false,NULL,$18)
      ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,name=EXCLUDED.name,birth_date=EXCLUDED.birth_date,city=EXCLUDED.city,bio=EXCLUDED.bio,intent=EXCLUDED.intent,interests=EXCLUDED.interests,prompt=EXCLUDED.prompt,gender=EXCLUDED.gender,preferences=EXCLUDED.preferences,color=EXCLUDED.color,languages=EXCLUDED.languages,hobbies=EXCLUDED.hobbies,profession=EXCLUDED.profession,education=EXCLUDED.education,lifestyle=EXCLUDED.lifestyle,email_verified_at=EXCLUDED.email_verified_at,adult_declared_at=EXCLUDED.adult_declared_at,onboarded_at=EXCLUDED.onboarded_at,onboarding_step=5,paused=false,suspended=false,posts_visible=true,stories_visible=true,messages_enabled=true,interactions_enabled=true,data_saver=false,notifications=false,push_token=NULL WHERE users.demo`,
      [
        persona.id,
        `demo${persona.index}@sangai.invalid`,
        p.name,
        persona.birthDate,
        p.city,
        p.bio,
        p.intent,
        p.interests,
        p.prompt,
        p.gender,
        JSON.stringify(p.preferences),
        persona.color,
        p.languages,
        p.hobbies,
        p.profession,
        p.education,
        JSON.stringify(p.lifestyle),
        anchor,
      ],
    );
  }
  for (const asset of assets.all) {
    const existing = await one(db, "SELECT owner FROM media WHERE id=$1", [
      asset.id,
    ]);
    if (existing && existing.owner !== asset.owner)
      throw new ConflictException(
        "A demo media identifier is already in use. No data was reset.",
      );
    await db.query(
      `INSERT INTO media(id,owner,kind,path,mime,purpose,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,path=EXCLUDED.path,mime=EXCLUDED.mime,purpose=EXCLUDED.purpose,created_at=EXCLUDED.created_at`,
      [
        asset.id,
        asset.owner,
        asset.kind,
        asset.path,
        asset.mime,
        asset.purpose,
        anchor,
      ],
    );
    await db.query(
      "INSERT INTO demo_world_media(media_id,owner,world_version) VALUES($1,$2,$3) ON CONFLICT(media_id) DO UPDATE SET owner=EXCLUDED.owner,world_version=EXCLUDED.world_version",
      [asset.id, asset.owner, DEMO_WORLD_VERSION],
    );
  }
  for (const [owner, gallery] of assets.profiles) {
    await db.query("UPDATE users SET avatar_id=$2 WHERE id=$1 AND demo", [
      owner,
      gallery[0].id,
    ]);
    for (const [position, media] of gallery.entries())
      await db.query(
        "INSERT INTO profile_media(user_id,media_id,position) VALUES($1,$2,$3)",
        [owner, media.id, position],
      );
  }
}

export const demoMatchPairs = [
  [1, 2],
  [1, 3],
  [1, 26],
  [4, 5],
  [21, 22],
  [23, 24],
  [25, 27],
  [26, 29],
] as const;
export const demoDecisions = [
  [19, 1, "like", "instant-match"],
  [1, 17, "like", "outgoing-like"],
  [1, 18, "pass", "previous-pass"],
] as const;
export const demoMatches = demoMatchPairs.map(
  ([a, b]) => [id(a), id(b)] as const,
);
export const demoScenarioContext: DemoEligibilityContext = {
  matchedPairs: demoMatches,
  decisions: [
    ...demoMatches.flatMap(([actor, target]) => [
      { actor, target },
      { actor: target, target: actor },
    ]),
    ...demoDecisions.map(([actor, target]) => ({
      actor: id(actor),
      target: id(target),
    })),
  ],
};
const chatLines = [
  "Hello! Your profile mentioned a quiet bookshop. What have you been reading?",
  "A collection of short stories. One chapter and a cup of tea feels like a good evening.",
  "That sounds lovely. I found a tiny cafe with a shelf of books near the square.",
  "A book swap and coffee could be a fun first plan. What is your favourite kind of story?",
  "I enjoy travel writing, especially the small everyday details.",
  "Same here. A walk without a strict route usually turns into a good afternoon.",
  "Do you have a song for slow weekends? I am making a little playlist.",
  "I keep adding acoustic songs. Send me one you think I should hear.",
  "Here is a purely fictional photo from our demo afternoon. No real location is being shared.",
  "We should try the This or That game when you have a moment.",
];
async function restoreRelationships(db: DB, anchor: Date) {
  const scenarios: Scenario[] = [];
  for (const [a, b] of demoMatchPairs) {
    await swipeInTx(db, id(a), id(b), {
      action: "like",
      clientId: demoEntityId("swipe", `${a}-${b}`),
    });
    const result = await swipeInTx(db, id(b), id(a), {
      action: "like",
      clientId: demoEntityId("swipe", `${b}-${a}`),
    });
    if (!result.matched)
      throw new Error("Demo scenario did not produce a real reciprocal match.");
    scenarios.push({
      key: `match-${a}-${b}`,
      actor: id(a),
      target: id(b),
      state: "matched",
      description:
        "Both users explicitly liked each other through the normal matching engine.",
    });
  }
  for (const [a, b, action, key] of demoDecisions) {
    await swipeInTx(db, id(a), id(b), {
      action,
      clientId: demoEntityId("swipe", `${a}-${b}`),
    });
    scenarios.push({
      key,
      actor: id(a),
      target: id(b),
      state: action === "pass" ? "passed" : "unreturned-like",
      description:
        key === "instant-match"
          ? "Aarav can Like this compatible prospect to experience a new real match."
          : key === "outgoing-like"
            ? "The prospect has not returned Aarav's Like."
            : "Aarav has already passed this prospect.",
    });
  }
  scenarios.push({
    key: "normal-like",
    actor: id(1),
    target: id(27),
    state: "untouched",
    description:
      "Like Tavi, switch to that profile, then Like Aarav to create a real match.",
  });
  const lengths = [4, 75, 1, 0, 4, 3, 2, 0];
  for (const [pairIndex, [a, b]] of demoMatchPairs.entries()) {
    await requireMatch(db, id(a), id(b));
    for (let i = 0; i < lengths[pairIndex]; i++) {
      const sender = i % 2 ? id(a) : id(b),
        recipient = i % 2 ? id(b) : id(a);
      await db.query(
        "INSERT INTO messages(id,sender,recipient,body,client_id,created_at,read_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          demoEntityId("message", `${a}-${b}-${i}`),
          sender,
          recipient,
          lengths[pairIndex] > 50
            ? `Demo conversation ${i + 1}: ${chatLines[i % chatLines.length]}`
            : chatLines[i % chatLines.length],
          `demo-v1-${a}-${b}-${i}`,
          new Date(anchor.getTime() - (lengths[pairIndex] - i + 180) * 60000),
          i === lengths[pairIndex] - 1 ? null : anchor,
        ],
      );
    }
  }
  return scenarios;
}

const postBodies = [
  "Found a quiet corner for a sketch and a cup of tea. What is your favourite way to slow down?",
  "A fictional weekend photo diary: the light, a small detail, and the long way home.",
  "Small question for a big appetite: steamed momos, fried momos, or both? 🥟",
  "A little motion from the demo studio. Four seconds of colour to brighten the day.",
  "Which song always earns a place on your weekend playlist? Tell me the story behind it.",
  "A few snapshots from our imaginary morning. Swipe through the tiny things we noticed.",
  "I used to plan every weekend down to the minute. Recently I tried leaving an afternoon open, carrying a notebook, and choosing a direction after each turn. The best part was a conversation about an old sign outside a cafe. What small surprise has made your day lately?",
  "Tonight's plan: a chapter, warm tea, and absolutely no competitive screen time.",
  "Would you rather learn a dance together or try a recipe neither person has cooked before?",
  "A new notebook and a small list of things to try. What belongs on your list?",
];
async function restoreSocial(db: DB, assets: Assets, anchor: Date) {
  for (const owner of [1, 2, 3, 26, 4, 5, 21, 23, 25]) {
    const count = [1, 2, 3, 26].includes(owner) ? 10 : 2;
    for (let i = 0; i < count; i++) {
      const postId = demoEntityId("post", `${owner}-${i}`),
        mode = i % 10;
      const attachments =
        mode === 1
          ? [assets.get(owner, "post", 0)]
          : mode === 5
            ? Array.from({ length: owner === 1 ? 6 : 3 }, (_, slot) =>
                assets.get(owner, "post", slot),
              )
            : mode === 3 && [1, 3, 21].includes(owner)
              ? [assets.get(owner, "video")]
              : [];
      await db.query(
        "INSERT INTO posts(id,author,body,media_id,client_id,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          postId,
          id(owner),
          postBodies[mode],
          attachments[0]?.id || null,
          demoEntityId("publish", `${owner}-${i}`),
          new Date(anchor.getTime() - (i * 5 + owner) * 60000),
        ],
      );
      for (const [position, media] of attachments.entries())
        await db.query(
          "INSERT INTO post_media(post_id,media_id,position) VALUES($1,$2,$3)",
          [postId, media.id, position],
        );
      const commenter =
        owner === 1
          ? id([2, 3, 26][i % 3])
          : [2, 3, 26].includes(owner)
            ? id(1)
            : undefined;
      if (commenter && i % 2 === 0) {
        await requireMatch(db, commenter, id(owner));
        const commentId = demoEntityId("comment", `${owner}-${i}`);
        await db.query(
          "INSERT INTO comments(id,post_id,author,body,created_at) VALUES($1,$2,$3,$4,$5)",
          [
            commentId,
            postId,
            commenter,
            "That sounds like a good afternoon. I would bring an extra cup of tea.",
            new Date(anchor.getTime() - i * 60000),
          ],
        );
        if (i === 0)
          await db.query(
            "INSERT INTO comments(id,post_id,author,body,parent_id,created_at) VALUES($1,$2,$3,$4,$5,$6)",
            [
              demoEntityId("reply", `${owner}-${i}`),
              postId,
              id(owner),
              "An excellent addition to the fictional plan. 😊",
              commentId,
              anchor,
            ],
          );
      }
      if (commenter && i % 3 === 0)
        await db.query("INSERT INTO reactions(post_id,actor) VALUES($1,$2)", [
          postId,
          commenter,
        ]);
    }
  }
  for (const owner of [2, 3])
    await db.query("INSERT INTO saved_posts(actor,post_id) VALUES($1,$2)", [
      id(1),
      demoEntityId("post", `${owner}-0`),
    ]);
  const stories = [
    [2, 0],
    [2, 1],
    [2, 2],
    [3, 0],
    [26, 0],
    [26, 1],
    [21, 0],
    [23, 0],
    [5, 0],
  ] as const;
  for (const [index, [owner, slot]] of stories.entries())
    await db.query(
      "INSERT INTO stories(id,author,body,media_id,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6)",
      [
        demoEntityId("story", `${owner}-${slot}`),
        id(owner),
        owner === 5
          ? "This fictional story has expired."
          : [
              "A little light in the demo studio.",
              "Another small moment in this fictional photo sequence.",
              "A slow afternoon and a sketchbook.",
            ][slot],
        assets.get(owner, "story", slot).id,
        new Date(anchor.getTime() + (owner === 5 ? -3600000 : 23 * 3600000)),
        new Date(anchor.getTime() - (20 - index) * 60000),
      ],
    );
  await db.query(
    "INSERT INTO stories(id,author,body,media_id,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6)",
    [
      demoEntityId("story", "2-video"),
      id(2),
      "A four-second fictional studio video. No real people or addresses.",
      assets.get(2, "story-video").id,
      new Date(anchor.getTime() + 23 * 3600000),
      new Date(anchor.getTime() - 5 * 60000),
    ],
  );
  for (const [owner, recipient, kind] of [
    [2, 1, "snap"],
    [1, 2, "snap"],
    [3, 1, "snap-video"],
  ] as const) {
    await requireMatch(db, id(owner), id(recipient));
    await db.query(
      "INSERT INTO snaps(id,sender,recipient,media_id,caption,expires_at,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        demoEntityId("snap", `${owner}-${recipient}`),
        id(owner),
        id(recipient),
        assets.get(owner, kind).id,
        "A purely fictional view-once hello. Open only when you are ready.",
        new Date(anchor.getTime() + 23 * 3600000),
        new Date(anchor.getTime() - 3 * 60000),
      ],
    );
  }
  await db.query(
    "INSERT INTO messages(id,sender,recipient,body,client_id,media_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
    [
      demoEntityId("message", "3-1-photo"),
      id(3),
      id(1),
      "A fictional snapshot from the demo afternoon.",
      "demo-v1-photo-chat",
      assets.get(3, "message").id,
      new Date(anchor.getTime() - 4 * 60000),
    ],
  );
}
async function restoreGames(db: DB, scenarios: Scenario[]) {
  if (!gamesV2Enabled()) return;
  const make = async (host: number, guest: number, kind: string, key: string) =>
    inviteGameV2InTx(
      db,
      id(host),
      id(guest),
      { kind, clientId: `demo-v1-${key}` },
      demoEntityId("game", key),
    );
  const act = async (
    actor: number,
    game: Awaited<ReturnType<typeof make>>,
    action: string,
    payload: unknown = {},
  ) =>
    actionGameV2InTx(db, id(actor), game.id, {
      clientId: `demo-v1-${game.id}-${game.revision}-${actor}-${action}`,
      expectedRevision: game.revision,
      action,
      payload,
    });
  const pending = await make(2, 1, "two-truths", "pending");
  scenarios.push({
    key: "game-pending",
    id: pending.id,
    actor: id(2),
    target: id(1),
    state: pending.state,
    description:
      "Aarav has an invitation that still requires explicit acceptance.",
  });
  let active = await make(1, 3, "this-or-that", "active");
  active = await act(3, active, "accept");
  active = await act(1, active, "choice", {
    questionId: active.definition.questions[0].id,
    choiceId: "0",
  });
  scenarios.push({
    key: "game-active",
    id: active.id,
    actor: id(1),
    target: id(3),
    state: active.state,
    description:
      "Both players consented. The first host choice stays private until the shared reveal.",
  });
  let complete = await make(1, 26, "would-you-rather", "complete");
  complete = await act(26, complete, "accept");
  for (const actor of [1, 26])
    for (const [index, q] of complete.definition.questions.entries())
      complete = await act(actor, complete, "choice", {
        questionId: q.id,
        choiceId: String((index + (actor === 26 ? 1 : 0)) % q.options.length),
      });
  scenarios.push({
    key: "game-complete",
    id: complete.id,
    actor: id(1),
    target: id(26),
    state: complete.state,
    description:
      "Both players completed all choices through the real game action engine.",
  });
  scenarios.push({
    key: "game-available",
    actor: id(4),
    target: id(5),
    state: "available",
    description:
      "Matched with no existing game; invite and explicitly accept from the other profile.",
  });
}
async function restoreDates(db: DB, anchor: Date, scenarios: Scenario[]) {
  for (const [target, state, title, days] of [
    [2, "proposed", "Coffee and a book swap", 3],
    [3, "accepted", "A relaxed walk and momos", 5],
  ] as const) {
    await requireMatch(db, id(1), id(target));
    const planId = demoEntityId("plan", `1-${target}`);
    await db.query(
      "INSERT INTO plans(id,host,guest,title,venue,scheduled_at,state,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        planId,
        id(1),
        id(target),
        title,
        "Fictional demo cafe · no booking or exact address",
        new Date(anchor.getTime() + days * 86400000),
        state,
        anchor,
      ],
    );
    scenarios.push({
      key: `date-${state}`,
      id: planId,
      actor: id(1),
      target: id(target),
      state,
      description:
        "A fictional date plan only; no booking or external message.",
    });
  }
}

async function restore(
  db: DB,
  assets: Assets,
  generation: string,
  actor?: string,
) {
  await verifyScope(db, actor);
  const anchor = new Date();
  anchor.setMilliseconds(0);
  const oldMedia = await rows(
    db,
    "SELECT id,path FROM media WHERE owner=ANY($1::uuid[])",
    [demoIds],
  );
  await clearActivity(db);
  await restoreProfiles(db, assets, anchor);
  const scenarios = await restoreRelationships(db, anchor);
  await restoreSocial(db, assets, anchor);
  await restoreGames(db, scenarios);
  await restoreDates(db, anchor, scenarios);
  await db.query(
    "UPDATE notifications SET push_state='skipped' WHERE recipient=ANY($1::uuid[])",
    [demoIds],
  );
  const retained = assets.all.map((m) => m.id);
  const obsolete = await rows(
    db,
    `DELETE FROM media m WHERE m.owner=ANY($1::uuid[]) AND NOT(m.id=ANY($2::uuid[]))
    AND NOT EXISTS(SELECT 1 FROM users WHERE avatar_id=m.id)
    AND NOT EXISTS(SELECT 1 FROM profile_media WHERE media_id=m.id)
    AND NOT EXISTS(SELECT 1 FROM posts WHERE media_id=m.id)
    AND NOT EXISTS(SELECT 1 FROM post_media WHERE media_id=m.id)
    AND NOT EXISTS(SELECT 1 FROM stories WHERE media_id=m.id)
    AND NOT EXISTS(SELECT 1 FROM messages WHERE media_id=m.id)
    AND NOT EXISTS(SELECT 1 FROM snaps WHERE media_id=m.id) RETURNING m.path`,
    [demoIds, retained],
  );
  await queueMediaDeletion(db, [
    ...oldMedia.filter((m) => retained.includes(m.id)).map((m) => m.path),
    ...obsolete.map((m) => m.path),
  ]);
  const counts = await one(
    db,
    `SELECT
    (SELECT count(*)::int FROM users WHERE id=ANY($1::uuid[]) AND demo) AS users,
    (SELECT count(*)::int FROM connections WHERE a=ANY($1::uuid[]) AND b=ANY($1::uuid[]) AND state='matched') AS matches,
    (SELECT count(*)::int FROM messages WHERE sender=ANY($1::uuid[]) AND recipient=ANY($1::uuid[])) AS messages,
    (SELECT count(*)::int FROM posts WHERE author=ANY($1::uuid[])) AS posts,
    (SELECT count(*)::int FROM stories WHERE author=ANY($1::uuid[])) AS stories,
    (SELECT count(*)::int FROM snaps WHERE sender=ANY($1::uuid[]) AND recipient=ANY($1::uuid[])) AS snaps,
    (SELECT count(*)::int FROM games WHERE host=ANY($1::uuid[]) AND guest=ANY($1::uuid[])) AS games,
    (SELECT count(*)::int FROM plans WHERE host=ANY($1::uuid[]) AND guest=ANY($1::uuid[])) AS plans`,
    [demoIds],
  );
  const result = {
    ok: true,
    version: DEMO_WORLD_VERSION,
    resetAt: anchor.toISOString(),
    counts,
    scenarios,
    inventory: {
      ...demoInventory,
      games: gamesV2Enabled() ? demoInventory.games : [],
    },
  };
  await db.query(
    "INSERT INTO demo_world_metadata(singleton,version,generation,reset_at,manifest) VALUES(true,$1,$2,$3,$4) ON CONFLICT(singleton) DO UPDATE SET version=EXCLUDED.version,generation=EXCLUDED.generation,reset_at=EXCLUDED.reset_at,manifest=EXCLUDED.manifest",
    [DEMO_WORLD_VERSION, generation, anchor, JSON.stringify(result)],
  );
  return result;
}
async function worldTx<T>(db: PoolClient, run: (db: PoolClient) => Promise<T>) {
  try {
    await db.query("BEGIN");
    // The same lock taken by the ordinary tx() mutation helper; all matching,
    // permissions and cleanup transitions remain serialized with this reset.
    await db.query("SELECT pg_advisory_xact_lock(20260929)");
    const result = await run(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
async function withWorldLock<T>(run: (db: PoolClient) => Promise<T>) {
  const db = await pool.connect();
  let acquired = false;
  try {
    // Serialize file staging without holding a transaction or mutation lock
    // while JPEG/video fixtures are generated. Other API reads remain available.
    acquired = !!(
      await one(db, "SELECT pg_try_advisory_lock($1) AS acquired", [worldLock])
    ).acquired;
    if (!acquired)
      throw new RateLimitExceeded(
        5,
        "The demo world is already restoring. Please retry shortly.",
      );
    return await run(db);
  } finally {
    try {
      if (acquired)
        await db.query("SELECT pg_advisory_unlock($1)", [worldLock]);
      db.release();
    } catch (error) {
      // A connection whose unlock failed must not return to the reusable pool.
      db.release(true);
      throw error;
    }
  }
}
export async function initializeDemoWorld() {
  if (!demoEnabled()) return { initialized: false };
  return withWorldLock(async (db) => {
    const current = await one(
      db,
      "SELECT version FROM demo_world_metadata WHERE singleton",
    );
    if (current && current.version >= DEMO_WORLD_VERSION)
      return { initialized: false };
    await verifyScope(db);
    const generation = `v${DEMO_WORLD_VERSION}-${randomUUID()}`;
    const assets = await prepareAssets(generation, db);
    try {
      const result = await worldTx(db, (client) =>
        restore(client, assets, generation),
      );
      return { initialized: true, ...result };
    } catch (error) {
      await worldTx(db, (client) =>
        queueMediaDeletion(
          client,
          assets.all.map((m) => m.path),
        ),
      );
      throw error;
    }
  });
}
export async function resetDemoWorld(actor: string) {
  requireDemo();
  return withWorldLock(async (db) => {
    await verifyScope(db, actor);
    const generation = `v${DEMO_WORLD_VERSION}-${randomUUID()}`;
    const assets = await prepareAssets(generation, db);
    try {
      return await worldTx(db, (client) =>
        restore(client, assets, generation, actor),
      );
    } catch (error) {
      await worldTx(db, (client) =>
        queueMediaDeletion(
          client,
          assets.all.map((m) => m.path),
        ),
      );
      throw error;
    }
  });
}

// Safe synthetic manifest, deliberately excluding DOB, email, session tokens,
// private game choices and unpublished answer keys. Runtime storage generations
// and event/notification UUIDs are bookkeeping, not scenario identities.
const label = (index: number) => demoPersonas[index - 1].profile.name;
export const demoInventory = {
  profiles: demoPersonas.map((p) => ({
    id: p.id,
    name: p.profile.name,
    age: p.age,
    city: p.profile.city,
    gender: p.profile.gender,
    group: p.selectorGroup,
    orientation: p.orientation,
    pronouns: p.pronouns,
    lookingFor: p.profile.preferences.genders,
    demo: true,
  })),
  matches: demoMatchPairs.map(([a, b]) => ({
    users: [id(a), id(b)],
    names: [label(a), label(b)],
  })),
  conversations: demoMatchPairs.map(([a, b], index) => ({
    users: [id(a), id(b)],
    names: [label(a), label(b)],
    messages: [4, 76, 1, 0, 4, 3, 2, 0][index],
  })),
  stories: [
    ...(
      [
        [2, 0],
        [2, 1],
        [2, 2],
        [3, 0],
        [26, 0],
        [26, 1],
        [21, 0],
        [23, 0],
        [5, 0],
      ] as const
    ).map(([owner, slot]) => ({
      id: demoEntityId("story", `${owner}-${slot}`),
      author: id(owner),
      name: label(owner),
      kind: "image",
      state: owner === 5 ? "expired" : "active",
    })),
    {
      id: demoEntityId("story", "2-video"),
      author: id(2),
      name: label(2),
      kind: "video",
      state: "active",
    },
  ],
  posts: [1, 2, 3, 26, 4, 5, 21, 23, 25].flatMap((owner) =>
    Array.from(
      { length: [1, 2, 3, 26].includes(owner) ? 10 : 2 },
      (_, slot) => ({
        id: demoEntityId("post", `${owner}-${slot}`),
        author: id(owner),
        name: label(owner),
        format:
          slot === 1
            ? "photo"
            : slot === 5
              ? "photos"
              : slot === 3 && [1, 3, 21].includes(owner)
                ? "video"
                : "text",
      }),
    ),
  ),
  games: [
    {
      id: demoEntityId("game", "pending"),
      players: [id(2), id(1)],
      names: [label(2), label(1)],
      kind: "two-truths",
      state: "invited",
      version: 2,
    },
    {
      id: demoEntityId("game", "active"),
      players: [id(1), id(3)],
      names: [label(1), label(3)],
      kind: "this-or-that",
      state: "active",
      version: 2,
    },
    {
      id: demoEntityId("game", "complete"),
      players: [id(1), id(26)],
      names: [label(1), label(26)],
      kind: "would-you-rather",
      state: "complete",
      version: 2,
    },
  ],
  plans: [2, 3].map((target) => ({
    id: demoEntityId("plan", `1-${target}`),
    players: [id(1), id(target)],
    names: [label(1), label(target)],
    state: target === 2 ? "proposed" : "accepted",
    fictional: true,
  })),
  snaps: [
    [2, 1],
    [1, 2],
    [3, 1],
  ].map(([sender, recipient]) => ({
    id: demoEntityId("snap", `${sender}-${recipient}`),
    sender: id(sender),
    recipient: id(recipient),
    names: [label(sender), label(recipient)],
    kind: sender === 3 ? "video" : "image",
    state: "unopened",
  })),
};
