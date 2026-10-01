-- Additive Games 2.0. Legacy version 0/1 rows and routes remain supported.
ALTER TABLE games ADD COLUMN definition_version integer NOT NULL DEFAULT 1 CHECK(definition_version>0);
ALTER TABLE games ADD COLUMN revision integer NOT NULL DEFAULT 0 CHECK(revision>=0);
ALTER TABLE games ADD COLUMN state_data jsonb NOT NULL DEFAULT '{}';
ALTER TABLE games ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE games ADD COLUMN accepted_at timestamptz;
ALTER TABLE games ADD COLUMN client_id text;
ALTER TABLE games ADD COLUMN invite_hash text;
ALTER TABLE games ADD COLUMN next_tick_at timestamptz;
CREATE UNIQUE INDEX games_v2_invite_retry ON games(host,client_id) WHERE version=2;
CREATE UNIQUE INDEX games_v2_one_open_pair ON games(LEAST(host,guest),GREATEST(host,guest)) WHERE version=2 AND state IN ('invited','active');
CREATE INDEX games_v2_pair_open ON games(LEAST(host,guest),GREATEST(host,guest),created_at DESC,id DESC) WHERE version=2 AND state IN ('invited','active');
CREATE INDEX games_v2_due ON games(next_tick_at,id) WHERE version=2 AND state IN ('invited','active');
CREATE TABLE game_events (
 id uuid PRIMARY KEY,
 game_id uuid NOT NULL REFERENCES games ON DELETE CASCADE,
 sequence integer NOT NULL CHECK(sequence>0),
 actor uuid REFERENCES users ON DELETE CASCADE,
 type text NOT NULL,
 client_id text NOT NULL CHECK(length(client_id) BETWEEN 1 AND 100),
 payload_hash text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(game_id,sequence), UNIQUE(game_id,actor,client_id)
);
CREATE TABLE game_results (
 game_id uuid PRIMARY KEY REFERENCES games ON DELETE CASCADE,
 definition_version integer NOT NULL,
 summary jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ADD COLUMN resource_type text;
ALTER TABLE notifications ADD COLUMN resource_id uuid;
ALTER TABLE notifications ADD COLUMN dedupe_key text;
CREATE UNIQUE INDEX notifications_dedupe ON notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
