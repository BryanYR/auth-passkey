import { Pool } from 'pg'

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  first_name    TEXT        NOT NULL DEFAULT '',
  last_name     TEXT        NOT NULL DEFAULT '',
  country       TEXT        NOT NULL DEFAULT '',
  city          TEXT        NOT NULL DEFAULT '',
  dni           TEXT        NOT NULL DEFAULT '',
  gender        TEXT        NOT NULL DEFAULT '',
  phone         TEXT        NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge  TEXT        NOT NULL UNIQUE,
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('registration','authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS passkey_credentials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,
  public_key    BYTEA       NOT NULL,
  counter       BIGINT      NOT NULL DEFAULT 0,
  device_type   TEXT        NOT NULL DEFAULT '',
  backed_up     BOOLEAN     NOT NULL DEFAULT FALSE,
  transports    TEXT[]      NOT NULL DEFAULT '{}',
  friendly_name TEXT        NOT NULL DEFAULT 'Mi Passkey',
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_user_id     ON passkey_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_passkey_cred_id     ON passkey_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_challenge_expires   ON webauthn_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
`

export default defineNitroPlugin(async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  })
  try {
    await pool.query(SQL)
    console.log('[DB] Migración completada — tablas listas')
  } catch (err) {
    console.error('[DB] Error en migración:', err)
    throw err
  } finally {
    await pool.end()
  }
})
