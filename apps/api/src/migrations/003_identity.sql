ALTER TABLE users ALTER COLUMN birth_date DROP NOT NULL;
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN adult_declared_at timestamptz;
ALTER TABLE users ADD COLUMN onboarded_at timestamptz;
ALTER TABLE users ADD COLUMN onboarding_step integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN languages text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN hobbies text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN profession text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN education text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN lifestyle jsonb NOT NULL DEFAULT '{}';
UPDATE users SET email_verified_at=now(),adult_declared_at=now(),onboarded_at=now(),onboarding_step=5 WHERE demo;
CREATE TABLE auth_identities (
 provider text NOT NULL, subject text NOT NULL, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 PRIMARY KEY(provider,subject), UNIQUE(provider,user_id)
);
CREATE TABLE auth_challenges (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN ('verify','reset')), token_hash text NOT NULL,
 attempts integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL, used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenge_user ON auth_challenges(user_id,purpose,created_at DESC);
