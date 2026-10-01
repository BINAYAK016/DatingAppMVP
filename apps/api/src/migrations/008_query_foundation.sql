-- Match these indexes to the bounded projection and cursor queries. The existing
-- global mutation lock remains; pure reads use a separate permission snapshot.
CREATE INDEX comments_post_recent ON comments(post_id,created_at DESC,id DESC);
CREATE INDEX messages_unread_recipient ON messages(recipient,sender) WHERE read_at IS NULL;
CREATE INDEX stories_author_recent ON stories(author,created_at DESC,id DESC);
CREATE INDEX stories_expiry ON stories(expires_at);
CREATE INDEX posts_author_recent ON posts(author,created_at DESC,id DESC);
CREATE INDEX saved_posts_actor_recent ON saved_posts(actor,created_at DESC,post_id DESC);
