ALTER TABLE messages ADD COLUMN media_id uuid REFERENCES media ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN post_id uuid REFERENCES posts ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN read_at timestamptz;
ALTER TABLE comments ADD COLUMN parent_id uuid REFERENCES comments ON DELETE CASCADE;
CREATE TABLE saved_posts(actor uuid NOT NULL REFERENCES users ON DELETE CASCADE,post_id uuid NOT NULL REFERENCES posts ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor,post_id));
ALTER TABLE media ADD COLUMN purpose text NOT NULL DEFAULT '';
UPDATE media m SET purpose=CASE
 WHEN EXISTS(SELECT 1 FROM users WHERE avatar_id=m.id) THEN 'profile'
 WHEN EXISTS(SELECT 1 FROM posts WHERE media_id=m.id) THEN 'post'
 WHEN EXISTS(SELECT 1 FROM stories WHERE media_id=m.id) THEN 'story'
 WHEN EXISTS(SELECT 1 FROM snaps WHERE media_id=m.id) THEN 'snap'
 ELSE '' END;
ALTER TABLE users ADD COLUMN posts_visible boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN stories_visible boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN messages_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN interactions_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN data_saver boolean NOT NULL DEFAULT false;
