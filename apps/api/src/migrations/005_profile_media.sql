CREATE TABLE profile_media(user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,media_id uuid NOT NULL REFERENCES media ON DELETE CASCADE,position integer NOT NULL,PRIMARY KEY(user_id,media_id));
INSERT INTO profile_media(user_id,media_id,position) SELECT u.id,u.avatar_id,0 FROM users u JOIN media m ON m.id=u.avatar_id;
