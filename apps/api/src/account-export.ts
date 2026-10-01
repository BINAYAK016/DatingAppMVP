import { rows, one, readTx } from "./db";
import { privateProfileFields } from "./identity";
import { gameExportV2 } from "./game-v2";
export async function exportAccount(actor: string) {
  return readTx(async (db) => ({
    profile: await one(
      db,
      `SELECT id,name,city,bio,intent,interests,prompt,gender,languages,hobbies,profession,education,lifestyle,avatar_id,${privateProfileFields},created_at FROM users WHERE id=$1`,
      [actor],
    ),
    profileMedia: await rows(
      db,
      "SELECT media_id,position FROM profile_media WHERE user_id=$1",
      [actor],
    ),
    discovery: await rows(
      db,
      "SELECT id,target,kind,created_at,undone_at FROM discovery_actions WHERE actor=$1",
      [actor],
    ),
    matches: await rows(
      db,
      "SELECT a,b,state,created_at FROM connections WHERE (a=$1 OR b=$1) AND state<>'pending'",
      [actor],
    ),
    posts: await rows(db, "SELECT * FROM posts WHERE author=$1", [actor]),
    postMedia: await rows(
      db,
      "SELECT pm.post_id,pm.media_id,pm.position FROM post_media pm JOIN posts p ON p.id=pm.post_id WHERE p.author=$1 ORDER BY pm.post_id,pm.position",
      [actor],
    ),
    stories: await rows(db, "SELECT * FROM stories WHERE author=$1", [actor]),
    comments: await rows(db, "SELECT * FROM comments WHERE author=$1", [actor]),
    saved: await rows(
      db,
      "SELECT post_id,created_at FROM saved_posts WHERE actor=$1",
      [actor],
    ),
    messages: await rows(
      db,
      "SELECT id,recipient,body,media_id,post_id,created_at FROM messages WHERE sender=$1",
      [actor],
    ),
    snaps: await rows(
      db,
      "SELECT id,recipient,caption,media_id,created_at,expires_at,opened_at FROM snaps WHERE sender=$1",
      [actor],
    ),
    games: (
      await rows(
        db,
        "SELECT * FROM games WHERE host=$1::uuid OR guest=$1::uuid",
        [actor],
      )
    ).map((game) =>
      game.version === 2
        ? gameExportV2(game, actor)
        : {
            id: game.id,
            host: game.host,
            guest: game.guest,
            kind: game.kind,
            state: game.state,
            created_at: game.created_at,
            my_answers: game.answers?.[actor] ?? null,
            my_guesses: game.guesses?.[actor] ?? null,
          },
    ),
    dates: await rows(db, "SELECT * FROM plans WHERE host=$1 OR guest=$1", [
      actor,
    ]),
    media: await rows(
      db,
      "SELECT id,kind,mime,purpose,created_at FROM media WHERE owner=$1",
      [actor],
    ),
    blocks: await rows(db, "SELECT target FROM blocks WHERE actor=$1", [actor]),
    reports: await rows(
      db,
      "SELECT id,reason,context,state,resolution,created_at FROM reports WHERE reporter=$1",
      [actor],
    ),
    identities: await rows(
      db,
      "SELECT provider,subject FROM auth_identities WHERE user_id=$1",
      [actor],
    ),
  }));
}
