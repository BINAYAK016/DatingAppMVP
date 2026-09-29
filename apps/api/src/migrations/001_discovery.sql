-- Expand only. Retired circle/event rows remain for a restricted rollback window.
CREATE TABLE discovery_actions (
 id uuid PRIMARY KEY, actor uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 target uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('like','pass','super')),
 ordinal bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), undone_at timestamptz,
 CHECK(actor<>target)
);
CREATE UNIQUE INDEX discovery_active_pair ON discovery_actions(actor,target) WHERE undone_at IS NULL;
CREATE INDEX discovery_latest ON discovery_actions(actor,ordinal DESC) WHERE undone_at IS NULL;
-- A written request is one person's consent only. Never infer a reciprocal Like.
INSERT INTO discovery_actions(id,actor,target,kind,created_at)
 SELECT gen_random_uuid(),sender,CASE WHEN sender=a THEN b ELSE a END,'like',created_at
 FROM connections WHERE state='pending';
DELETE FROM notifications WHERE kind='request';
