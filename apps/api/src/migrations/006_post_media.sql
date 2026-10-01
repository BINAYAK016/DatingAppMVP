-- Add ordered attachments while preserving posts.media_id for older clients.
CREATE TABLE post_media (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 5),
  PRIMARY KEY (post_id, media_id),
  UNIQUE (post_id, position)
);
CREATE INDEX post_media_media_idx ON post_media(media_id);
INSERT INTO post_media(post_id,media_id,position)
SELECT id,media_id,0 FROM posts WHERE media_id IS NOT NULL;

-- Publishing retries keep the same identifier and cannot duplicate a post.
ALTER TABLE posts ADD COLUMN client_id uuid;
CREATE UNIQUE INDEX posts_author_client_idx ON posts(author,client_id) WHERE client_id IS NOT NULL;
