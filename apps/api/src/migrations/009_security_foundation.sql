CREATE TABLE rate_limit_counters (
 key_hash text PRIMARY KEY,
 hits integer NOT NULL CHECK(hits>0),
 expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limit_expiry ON rate_limit_counters(expires_at);

CREATE TABLE media_deletion_jobs (
 id uuid PRIMARY KEY,
 path text NOT NULL UNIQUE,
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 claim_id uuid,
 claimed_until timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_deletion_due ON media_deletion_jobs(next_attempt_at,created_at);

CREATE TABLE push_delivery_claims (
 notification_id uuid PRIMARY KEY REFERENCES notifications(id) ON DELETE CASCADE,
 claim_id uuid,
 claimed_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text
);
CREATE INDEX push_delivery_due ON push_delivery_claims(next_attempt_at);
