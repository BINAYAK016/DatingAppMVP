ALTER TABLE games ADD COLUMN state text NOT NULL DEFAULT 'invited' CHECK(state IN ('invited','active','complete','declined','cancelled','expired'));
ALTER TABLE games ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE games ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes';
ALTER TABLE games ADD COLUMN guesses jsonb NOT NULL DEFAULT '{}';
-- Old games did not have mutual live consent. Retain history without starting them.
UPDATE games SET state=CASE WHEN answers ? host::text AND answers ? guest::text THEN 'complete' ELSE 'cancelled' END,version=0;
CREATE TABLE game_readiness (
 actor uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE,
 target uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, CHECK(actor<>target)
);
CREATE INDEX game_pair ON games(host,guest,created_at DESC);
