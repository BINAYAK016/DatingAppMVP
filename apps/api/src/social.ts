import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import {
  DB,
  matched,
  one,
  pool,
  profile,
  publicFields,
  requireCircle,
  requireMatch,
  rows,
  tx,
} from "./db";
import { gameCatalog, profileInput, text, uuid } from "./validation";
import { z } from "zod";

export async function notify(
  db: DB,
  recipient: string,
  actor: string,
  kind: string,
  body: string,
) {
  await db.query(
    "INSERT INTO notifications(id,recipient,actor,kind,body) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), recipient, actor, kind, body],
  );
}
export async function ownMedia(db: DB, actor: string, id?: string | null) {
  if (!id) return;
  uuid.parse(id);
  if (
    !(await one(db, "SELECT 1 FROM media WHERE id=$1 AND owner=$2", [
      id,
      actor,
    ]))
  )
    throw new ForbiddenException("Choose your own uploaded media.");
}
function eligible(a: any, b: any): boolean {
  return (
    !a.paused &&
    !b.paused &&
    !a.suspended &&
    !b.suspended &&
    b.age >= a.preferences.minAge &&
    b.age <= a.preferences.maxAge &&
    a.age >= b.preferences.minAge &&
    a.age <= b.preferences.maxAge &&
    (!a.preferences.cities.length || a.preferences.cities.includes(b.city)) &&
    (!b.preferences.cities.length || b.preferences.cities.includes(a.city)) &&
    (!a.preferences.genders.length ||
      a.preferences.genders.includes(b.gender)) &&
    (!b.preferences.genders.length || b.preferences.genders.includes(a.gender))
  );
}
export async function allowedPost(db: DB, actor: string, id: string) {
  const p = await one(db, "SELECT * FROM posts WHERE id=$1", [id]);
  if (!p || !(await matched(db, actor, p.author)))
    throw new NotFoundException("Post unavailable.");
  return p;
}
export async function feed(
  db: DB,
  actor: string,
  before?: string,
  beforeId?: string,
) {
  const candidates = await rows(
    db,
    `SELECT p.*,m.kind FROM posts p LEFT JOIN media m ON m.id=p.media_id JOIN users u ON u.id=p.author WHERE NOT u.suspended AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor=$1 AND b.target=p.author) OR (b.actor=p.author AND b.target=$1)) AND ($2::timestamptz IS NULL OR (p.created_at,p.id)<($2::timestamptz,COALESCE($3::uuid,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))) AND (p.author=$1 OR EXISTS (SELECT 1 FROM connections c WHERE c.a=LEAST($1::uuid,p.author) AND c.b=GREATEST($1::uuid,p.author) AND c.state='matched')) ORDER BY p.created_at DESC,p.id DESC LIMIT 30`,
    [actor, before || null, beforeId || null],
  );
  const out = [];
  for (const p of candidates)
    if (await matched(db, actor, p.author)) {
      const comments = await rows(
        db,
        "SELECT * FROM comments WHERE post_id=$1 ORDER BY created_at DESC LIMIT 50",
        [p.id],
      );
      const visible = [];
      for (const c of comments)
        if (await matched(db, actor, c.author))
          visible.push({ ...c, author: await profile(db, c.author) });
      const reactions = await rows(
        db,
        "SELECT actor FROM reactions WHERE post_id=$1",
        [p.id],
      );
      let count = 0;
      for (const r of reactions) if (await matched(db, actor, r.actor)) count++;
      out.push({
        ...p,
        author: await profile(db, p.author),
        comments: visible.reverse(),
        likes: count,
        liked: reactions.some((r) => r.actor === actor),
      });
    }
  return out;
}
export async function state(actor: string) {
  return tx(async (db) => {
    const me = await one(
      db,
      `SELECT ${publicFields},email,preferences,paused,notifications FROM users WHERE id=$1`,
      [actor],
    );
    const potential = await rows(
      db,
      `SELECT ${publicFields},preferences FROM users u WHERE id<>$1 AND NOT suspended AND NOT paused AND NOT EXISTS(SELECT 1 FROM blocks WHERE (actor=$1 AND target=u.id) OR (actor=u.id AND target=$1)) ORDER BY created_at LIMIT 200`,
      [actor],
    );
    const cs = await rows(db, "SELECT * FROM connections WHERE a=$1 OR b=$1", [
      actor,
    ]);
    const matches = [];
    const discover = [];
    for (const p of potential) {
      const c = cs.find((c) => c.a === p.id || c.b === p.id);
      const preferences = p.preferences;
      delete p.preferences;
      if (c?.state === "matched" && (await matched(db, actor, p.id)))
        matches.push({
          ...p,
          followed: !!(await one(
            db,
            "SELECT 1 FROM follows WHERE actor=$1 AND target=$2",
            [actor, p.id],
          )),
        });
      else if (
        !c &&
        !me.paused &&
        p.age >= me.preferences.minAge &&
        p.age <= me.preferences.maxAge &&
        me.age >= preferences.minAge &&
        me.age <= preferences.maxAge &&
        (!me.preferences.cities.length ||
          me.preferences.cities.includes(p.city)) &&
        (!preferences.cities.length || preferences.cities.includes(me.city)) &&
        (!me.preferences.genders.length ||
          me.preferences.genders.includes(p.gender)) &&
        (!preferences.genders.length || preferences.genders.includes(me.gender))
      )
        discover.push(p);
    }
    // Paused users remain available to existing matches, but leave discovery.
    const pausedMatches = await rows(
      db,
      `SELECT ${publicFields} FROM users u WHERE u.paused AND NOT u.suspended AND EXISTS(SELECT 1 FROM connections c WHERE c.a=LEAST($1::uuid,u.id) AND c.b=GREATEST($1::uuid,u.id) AND c.state='matched')`,
      [actor],
    );
    for (const p of pausedMatches)
      if (await matched(db, actor, p.id))
        matches.push({ ...p, followed: false });
    const requests = [];
    for (const c of cs.filter(
      (c) => c.state === "pending" && c.sender !== actor,
    )) {
      const from = await profile(db, c.sender);
      if (from) requests.push({ ...c, from });
    }
    const storyRows = await rows(
      db,
      `SELECT s.*,m.kind FROM stories s LEFT JOIN media m ON m.id=s.media_id WHERE s.expires_at>now() ORDER BY s.created_at DESC LIMIT 200`,
    );
    const stories = [];
    for (const s of storyRows)
      if (await matched(db, actor, s.author))
        stories.push({ ...s, author: await profile(db, s.author) });
    const circles = [];
    for (const c of await rows(
      db,
      `SELECT c.* FROM circles c JOIN circle_members m ON m.circle_id=c.id WHERE m.user_id=$1 ORDER BY c.created_at DESC`,
      [actor],
    )) {
      try {
        const ids = await requireCircle(db, actor, c.id);
        circles.push({
          ...c,
          members: await Promise.all(ids.map((id) => profile(db, id))),
        });
      } catch {
        /* Invalid cliques are not discoverable. */
      }
    }
    const notifications = await rows(
      db,
      `SELECT n.* FROM notifications n JOIN users source ON source.id=n.actor WHERE n.recipient=$1 AND NOT source.suspended AND NOT EXISTS(SELECT 1 FROM blocks WHERE (actor=$1 AND target=n.actor) OR (actor=n.actor AND target=$1)) ORDER BY n.created_at DESC LIMIT 50`,
      [actor],
    );
    return {
      me,
      matches,
      discover,
      requests,
      feed: await feed(db, actor),
      stories,
      circles,
      notifications,
      games: gameCatalog,
    };
  });
}
export async function updateProfile(actor: string, body: unknown) {
  const p = profileInput.parse(body);
  await pool.query(
    "UPDATE users SET name=$2,city=$3,bio=$4,intent=$5,interests=$6,prompt=$7,gender=$8,preferences=$9 WHERE id=$1",
    [
      actor,
      p.name,
      p.city,
      p.bio,
      p.intent,
      p.interests,
      p.prompt,
      p.gender,
      JSON.stringify(p.preferences),
    ],
  );
  return { ok: true };
}
export async function connect(actor: string, target: string, note: string) {
  return tx(async (db) => {
    if (actor === target) throw new BadRequestException();
    const available = await one(
      db,
      `SELECT 1 FROM users WHERE id=$1 AND NOT suspended AND NOT paused AND NOT EXISTS(SELECT 1 FROM blocks WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1))`,
      [target, actor],
    );
    if (!available) throw new NotFoundException("Profile unavailable.");
    const a = await one(
      db,
      `SELECT ${publicFields},preferences,paused,suspended FROM users WHERE id=$1`,
      [actor],
    );
    const b = await one(
      db,
      `SELECT ${publicFields},preferences,paused,suspended FROM users WHERE id=$1`,
      [target],
    );
    if (!a || !b || !eligible(a, b))
      throw new NotFoundException(
        "Profile unavailable for your current preferences.",
      );
    const result = await db.query(
      `INSERT INTO connections(a,b,sender,note,state) VALUES(LEAST($1::uuid,$2::uuid),GREATEST($1::uuid,$2::uuid),$1,$3,'pending') ON CONFLICT DO NOTHING`,
      [actor, target, note],
    );
    if (result.rowCount)
      await notify(
        db,
        target,
        actor,
        "request",
        "A new connection request is waiting.",
      );
    return { ok: true };
  });
}
export async function answerRequest(
  actor: string,
  target: string,
  accept: boolean,
) {
  return tx(async (db) => {
    if (
      await one(
        db,
        "SELECT 1 FROM blocks WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1)",
        [actor, target],
      )
    )
      throw new ForbiddenException();
    if (!(await profile(db, target))) throw new NotFoundException();
    const r = await db.query(
      `UPDATE connections SET state=$3 WHERE a=LEAST($1::uuid,$2::uuid) AND b=GREATEST($1::uuid,$2::uuid) AND sender=$2 AND state='pending'`,
      [actor, target, accept ? "matched" : "declined"],
    );
    if (!r.rowCount) throw new NotFoundException("Request unavailable.");
    if (accept)
      await notify(db, target, actor, "match", "You have a new mutual match.");
    return { ok: true };
  });
}
export async function disconnect(
  actor: string,
  target: string,
  block: boolean,
) {
  return tx(async (db) => {
    if (actor === target) throw new BadRequestException();
    if (block)
      await db.query(
        "INSERT INTO blocks VALUES($1,$2) ON CONFLICT DO NOTHING",
        [actor, target],
      );
    await db.query(
      `UPDATE connections SET state='ended' WHERE a=LEAST($1::uuid,$2::uuid) AND b=GREATEST($1::uuid,$2::uuid)`,
      [actor, target],
    );
    await db.query(
      "DELETE FROM follows WHERE (actor=$1 AND target=$2) OR (actor=$2 AND target=$1)",
      [actor, target],
    );
    await db.query(
      "DELETE FROM notifications WHERE (recipient=$1 AND actor=$2) OR (recipient=$2 AND actor=$1)",
      [actor, target],
    );
    return { ok: true };
  });
}
export async function createPost(actor: string, body: unknown) {
  const p = z
    .object({ body: z.string().trim().max(2000), mediaId: uuid.nullish() })
    .refine((v) => v.body || v.mediaId)
    .parse(body);
  return tx(async (db) => {
    await ownMedia(db, actor, p.mediaId);
    const id = randomUUID();
    await db.query(
      "INSERT INTO posts(id,author,body,media_id) VALUES($1,$2,$3,$4)",
      [id, actor, p.body, p.mediaId || null],
    );
    return { id };
  });
}
export async function react(actor: string, id: string) {
  return tx(async (db) => {
    await allowedPost(db, actor, id);
    const r = await db.query(
      "DELETE FROM reactions WHERE actor=$1 AND post_id=$2",
      [actor, id],
    );
    if (!r.rowCount)
      await db.query("INSERT INTO reactions VALUES($1,$2)", [id, actor]);
    return { ok: true };
  });
}
export async function comment(actor: string, id: string, body: string) {
  return tx(async (db) => {
    const p = await allowedPost(db, actor, id);
    await db.query(
      "INSERT INTO comments(id,post_id,author,body) VALUES($1,$2,$3,$4)",
      [randomUUID(), id, actor, body],
    );
    if (p.author !== actor)
      await notify(
        db,
        p.author,
        actor,
        "comment",
        "A match replied to your moment.",
      );
    return { ok: true };
  });
}
export async function follow(actor: string, target: string) {
  return tx(async (db) => {
    await requireMatch(db, actor, target);
    const r = await db.query(
      "DELETE FROM follows WHERE actor=$1 AND target=$2",
      [actor, target],
    );
    if (!r.rowCount)
      await db.query("INSERT INTO follows VALUES($1,$2)", [actor, target]);
    return { ok: true };
  });
}
export async function createStory(actor: string, body: unknown) {
  const p = z
    .object({ body: z.string().max(300), mediaId: uuid.nullish() })
    .refine((v) => v.body || v.mediaId)
    .parse(body);
  return tx(async (db) => {
    await ownMedia(db, actor, p.mediaId);
    const id = randomUUID();
    await db.query(
      "INSERT INTO stories(id,author,body,media_id) VALUES($1,$2,$3,$4)",
      [id, actor, p.body, p.mediaId || null],
    );
    return { id };
  });
}
export async function createCircle(actor: string, body: unknown) {
  const p = z
    .object({
      name: text(60),
      description: z.string().max(300),
      members: z.array(uuid).min(1).max(9),
    })
    .parse(body);
  return tx(async (db) => {
    const ids = [...new Set([actor, ...p.members])];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        await requireMatch(db, ids[i], ids[j]);
    const id = randomUUID();
    await db.query(
      "INSERT INTO circles(id,owner,name,description) VALUES($1,$2,$3,$4)",
      [id, actor, p.name, p.description],
    );
    for (const member of ids)
      await db.query("INSERT INTO circle_members VALUES($1,$2)", [id, member]);
    return { id };
  });
}
export async function getCircle(actor: string, id: string) {
  return tx(async (db) => {
    const members = await requireCircle(db, actor, id);
    const circle = await one(db, "SELECT * FROM circles WHERE id=$1", [id]);
    const posts = await rows(
      db,
      "SELECT * FROM circle_posts WHERE circle_id=$1 ORDER BY created_at DESC LIMIT 100",
      [id],
    );
    const visiblePosts = [];
    for (const p of posts) {
      if (await matched(db, actor, p.author))
        visiblePosts.push({ ...p, author: await profile(db, p.author) });
    }
    const eventRows = await rows(
      db,
      "SELECT * FROM events WHERE circle_id=$1 ORDER BY scheduled_at",
      [id],
    );
    const events = [];
    for (const e of eventRows) {
      if (!(await matched(db, actor, e.host))) continue;
      const rsvps = (
        await rows(db, "SELECT user_id FROM rsvps WHERE event_id=$1", [e.id])
      ).map((r) => r.user_id);
      e.going = [];
      for (const id of rsvps)
        if (members.includes(id) && (await matched(db, actor, id)))
          e.going.push(id);
      events.push(e);
    }
    return {
      ...circle,
      members: await Promise.all(members.map((m) => profile(db, m))),
      posts: visiblePosts,
      events,
    };
  });
}
export async function circlePost(actor: string, id: string, body: string) {
  return tx(async (db) => {
    await requireCircle(db, actor, id);
    await db.query("INSERT INTO circle_posts VALUES($1,$2,$3,$4,now())", [
      randomUUID(),
      id,
      actor,
      body,
    ]);
    return { ok: true };
  });
}
export async function leaveCircle(actor: string, id: string) {
  return tx(async (db) => {
    const c = await one(db, "SELECT * FROM circles WHERE id=$1", [id]);
    if (!c) throw new NotFoundException();
    if (c.owner === actor)
      await db.query("DELETE FROM circles WHERE id=$1", [id]);
    else
      await db.query(
        "DELETE FROM circle_members WHERE circle_id=$1 AND user_id=$2",
        [id, actor],
      );
    return { ok: true };
  });
}
export async function createEvent(actor: string, id: string, body: unknown) {
  const p = z
    .object({
      title: text(100),
      venue: text(150),
      scheduledAt: z.iso.datetime({ offset: true }),
    })
    .refine((v) => new Date(v.scheduledAt) > new Date(), {
      message: "Choose a future time.",
    })
    .parse(body);
  return tx(async (db) => {
    await requireCircle(db, actor, id);
    const eid = randomUUID();
    await db.query(
      "INSERT INTO events(id,circle_id,host,title,venue,scheduled_at) VALUES($1,$2,$3,$4,$5,$6)",
      [eid, id, actor, p.title, p.venue, p.scheduledAt],
    );
    return { id: eid };
  });
}
export async function rsvp(actor: string, id: string) {
  return tx(async (db) => {
    const e = await one(db, "SELECT * FROM events WHERE id=$1", [id]);
    if (!e) throw new NotFoundException();
    await requireCircle(db, actor, e.circle_id);
    const r = await db.query(
      "DELETE FROM rsvps WHERE event_id=$1 AND user_id=$2",
      [id, actor],
    );
    if (!r.rowCount)
      await db.query("INSERT INTO rsvps VALUES($1,$2)", [id, actor]);
    return { ok: true };
  });
}
