CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL,
 name text NOT NULL, birth_date date NOT NULL, city text NOT NULL, bio text NOT NULL DEFAULT '',
 intent text NOT NULL DEFAULT 'A meaningful relationship', interests text[] NOT NULL DEFAULT '{}',
 prompt text NOT NULL DEFAULT '', gender text NOT NULL DEFAULT 'Prefer not to say',
 preferences jsonb NOT NULL DEFAULT '{"cities":[],"genders":[],"minAge":18,"maxAge":80}',
 avatar_id uuid, color text NOT NULL DEFAULT '#E8DCD0', paused boolean NOT NULL DEFAULT false,
 suspended boolean NOT NULL DEFAULT false, demo boolean NOT NULL DEFAULT false,
 notifications boolean NOT NULL DEFAULT true, push_token text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id uuid REFERENCES users ON DELETE CASCADE, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS connections (
 a uuid REFERENCES users ON DELETE CASCADE, b uuid REFERENCES users ON DELETE CASCADE,
 sender uuid REFERENCES users ON DELETE CASCADE, note text NOT NULL DEFAULT '',
 state text NOT NULL CHECK(state IN ('pending','matched','declined','ended')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(a,b), CHECK(a<b)
);
CREATE TABLE IF NOT EXISTS blocks (actor uuid REFERENCES users ON DELETE CASCADE, target uuid REFERENCES users ON DELETE CASCADE, PRIMARY KEY(actor,target), CHECK(actor<>target));
CREATE TABLE IF NOT EXISTS media (
 id uuid PRIMARY KEY, owner uuid REFERENCES users ON DELETE CASCADE, kind text NOT NULL CHECK(kind IN ('image','video')),
 path text NOT NULL, mime text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS posts (
 id uuid PRIMARY KEY, author uuid REFERENCES users ON DELETE CASCADE, body text NOT NULL,
 media_id uuid REFERENCES media ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reactions (post_id uuid REFERENCES posts ON DELETE CASCADE, actor uuid REFERENCES users ON DELETE CASCADE, PRIMARY KEY(post_id,actor));
CREATE TABLE IF NOT EXISTS comments (id uuid PRIMARY KEY, post_id uuid REFERENCES posts ON DELETE CASCADE, author uuid REFERENCES users ON DELETE CASCADE, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS follows (actor uuid REFERENCES users ON DELETE CASCADE, target uuid REFERENCES users ON DELETE CASCADE, PRIMARY KEY(actor,target), CHECK(actor<>target));
CREATE TABLE IF NOT EXISTS stories (id uuid PRIMARY KEY, author uuid REFERENCES users ON DELETE CASCADE, body text NOT NULL DEFAULT '', media_id uuid REFERENCES media ON DELETE CASCADE, expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS messages (id uuid PRIMARY KEY, sender uuid REFERENCES users ON DELETE CASCADE, recipient uuid REFERENCES users ON DELETE CASCADE, body text NOT NULL, client_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(sender,recipient,client_id));
CREATE TABLE IF NOT EXISTS snaps (id uuid PRIMARY KEY, sender uuid REFERENCES users ON DELETE CASCADE, recipient uuid REFERENCES users ON DELETE CASCADE, media_id uuid REFERENCES media ON DELETE CASCADE, caption text NOT NULL DEFAULT '', opened_at timestamptz, view_until timestamptz, expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS circles (id uuid PRIMARY KEY, owner uuid REFERENCES users ON DELETE CASCADE, name text NOT NULL, description text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS circle_members (circle_id uuid REFERENCES circles ON DELETE CASCADE, user_id uuid REFERENCES users ON DELETE CASCADE, PRIMARY KEY(circle_id,user_id));
CREATE TABLE IF NOT EXISTS circle_posts (id uuid PRIMARY KEY, circle_id uuid REFERENCES circles ON DELETE CASCADE, author uuid REFERENCES users ON DELETE CASCADE, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS games (id uuid PRIMARY KEY, host uuid REFERENCES users ON DELETE CASCADE, guest uuid REFERENCES users ON DELETE CASCADE, kind text NOT NULL, answers jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS plans (id uuid PRIMARY KEY, host uuid REFERENCES users ON DELETE CASCADE, guest uuid REFERENCES users ON DELETE CASCADE, title text NOT NULL, venue text NOT NULL, scheduled_at timestamptz NOT NULL, state text NOT NULL DEFAULT 'proposed', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS events (id uuid PRIMARY KEY, circle_id uuid REFERENCES circles ON DELETE CASCADE, host uuid REFERENCES users ON DELETE CASCADE, title text NOT NULL, venue text NOT NULL, scheduled_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rsvps (event_id uuid REFERENCES events ON DELETE CASCADE, user_id uuid REFERENCES users ON DELETE CASCADE, PRIMARY KEY(event_id,user_id));
CREATE TABLE IF NOT EXISTS reports (id uuid PRIMARY KEY, reporter uuid REFERENCES users ON DELETE SET NULL, target uuid REFERENCES users ON DELETE SET NULL, reason text NOT NULL, context text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'open', resolution text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit (id uuid PRIMARY KEY, action text NOT NULL, target uuid, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notifications (id uuid PRIMARY KEY, recipient uuid REFERENCES users ON DELETE CASCADE, actor uuid REFERENCES users ON DELETE CASCADE, kind text NOT NULL, body text NOT NULL, read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS posts_recent ON posts(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS messages_pair ON messages(sender,recipient,created_at);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(recipient,created_at DESC);
CREATE INDEX IF NOT EXISTS circle_members_user ON circle_members(user_id);
CREATE INDEX IF NOT EXISTS media_owner ON media(owner);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_state text NOT NULL DEFAULT 'pending';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_attempts integer NOT NULL DEFAULT 0;
