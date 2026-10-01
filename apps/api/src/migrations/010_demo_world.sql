-- Ownership metadata only. Ordinary users and sessions remain outside the
-- synthetic-world scope; resets never delete its stable user records.
CREATE TABLE demo_world_metadata (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 version integer NOT NULL CHECK(version>0),
 generation text NOT NULL,
 reset_at timestamptz NOT NULL,
 manifest jsonb NOT NULL DEFAULT '{}'
);
CREATE TABLE demo_world_media (
 media_id uuid PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
 owner uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 world_version integer NOT NULL CHECK(world_version>0)
);
CREATE INDEX demo_world_media_owner ON demo_world_media(owner);
