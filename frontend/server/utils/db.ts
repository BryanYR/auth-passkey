import { Pool } from 'pg'
import { randomBytes } from 'node:crypto'
import type { User, Session, WebAuthnChallenge, StoredCredential } from './store'

let _pool: Pool | null = null

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: true,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  }
  return _pool
}

// ---------------------------------------------------------------------------
// Row mappers (DB snake_case → TS camelCase)
// ---------------------------------------------------------------------------

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    passwordHash: row.password_hash as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    country: row.country as string,
    city: row.city as string,
    dni: row.dni as string,
    gender: row.gender as string,
    phone: row.phone as string,
    createdAt: new Date(row.created_at as string).getTime(),
  }
}

function rowToCredential(row: Record<string, unknown>): StoredCredential {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    credentialID: row.credential_id as string,
    credentialPublicKey: new Uint8Array(row.public_key as Buffer),
    counter: Number(row.counter),
    deviceType: row.device_type as string,
    backedUp: row.backed_up as boolean,
    transports: row.transports as string[],
    friendlyName: row.friendly_name as string,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string).getTime() : null,
    createdAt: new Date(row.created_at as string).getTime(),
  }
}

// ---------------------------------------------------------------------------
// User operations
// ---------------------------------------------------------------------------

export async function getUserByEmail(email: string): Promise<User | null> {
  const { rows } = await getPool().query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()],
  )
  return rows[0] ? rowToUser(rows[0]) : null
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await getPool().query(
    'SELECT * FROM users WHERE id = $1',
    [id],
  )
  return rows[0] ? rowToUser(rows[0]) : null
}

export async function createUser(data: Omit<User, 'createdAt'>): Promise<User> {
  const { rows } = await getPool().query(
    `INSERT INTO users
       (id, email, password_hash, first_name, last_name, country, city, dni, gender, phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [data.id, data.email, data.passwordHash, data.firstName, data.lastName,
     data.country, data.city, data.dni, data.gender, data.phone],
  )
  return rowToUser(rows[0])
}

// ---------------------------------------------------------------------------
// Session operations
// ---------------------------------------------------------------------------

export async function getSession(sessionId: string): Promise<Session | null> {
  const { rows } = await getPool().query(
    'SELECT * FROM sessions WHERE id = $1',
    [sessionId],
  )
  if (!rows[0]) return null
  return { userId: rows[0].user_id as string, createdAt: new Date(rows[0].created_at as string).getTime() }
}

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString('hex')
  await getPool().query(
    'INSERT INTO sessions (id, user_id) VALUES ($1, $2)',
    [sessionId, userId],
  )
  return sessionId
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getPool().query('DELETE FROM sessions WHERE id = $1', [sessionId])
}

// ---------------------------------------------------------------------------
// Challenge operations
// ---------------------------------------------------------------------------

export async function getChallenge(challenge: string): Promise<WebAuthnChallenge | null> {
  const { rows } = await getPool().query(
    `SELECT * FROM webauthn_challenges
     WHERE challenge = $1 AND expires_at > NOW()`,
    [challenge],
  )
  if (!rows[0]) return null
  return {
    userId: (rows[0].user_id as string | null) ?? null,
    type: rows[0].type as 'registration' | 'authentication',
    expiresAt: new Date(rows[0].expires_at as string).getTime(),
    used: rows[0].used as boolean,
  }
}

export async function saveChallenge(challenge: string, data: WebAuthnChallenge): Promise<void> {
  await getPool().query(
    `INSERT INTO webauthn_challenges (challenge, user_id, type, expires_at, used)
     VALUES ($1, $2, $3, $4, $5)`,
    [challenge, data.userId, data.type, new Date(data.expiresAt), data.used],
  )
}

export async function markChallengeUsed(challenge: string): Promise<void> {
  await getPool().query(
    'UPDATE webauthn_challenges SET used = TRUE WHERE challenge = $1',
    [challenge],
  )
}

// ---------------------------------------------------------------------------
// Credential operations
// ---------------------------------------------------------------------------

export async function getCredentialsByUserId(userId: string): Promise<StoredCredential[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM passkey_credentials WHERE user_id = $1 ORDER BY created_at ASC',
    [userId],
  )
  return rows.map(rowToCredential)
}

export async function getCredentialByCredentialID(credentialID: string): Promise<StoredCredential | null> {
  const { rows } = await getPool().query(
    'SELECT * FROM passkey_credentials WHERE credential_id = $1',
    [credentialID],
  )
  return rows[0] ? rowToCredential(rows[0]) : null
}

export async function addCredential(data: Omit<StoredCredential, 'id'>): Promise<StoredCredential> {
  const { rows } = await getPool().query(
    `INSERT INTO passkey_credentials
       (user_id, credential_id, public_key, counter, device_type, backed_up, transports, friendly_name, last_used_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.userId,
      data.credentialID,
      Buffer.from(data.credentialPublicKey),
      data.counter,
      data.deviceType,
      data.backedUp,
      data.transports,
      data.friendlyName,
      data.lastUsedAt ? new Date(data.lastUsedAt) : null,
    ],
  )
  return rowToCredential(rows[0])
}

export async function updateCredentialCounter(credentialID: string, counter: number, lastUsedAt: number): Promise<void> {
  await getPool().query(
    'UPDATE passkey_credentials SET counter = $1, last_used_at = $2 WHERE credential_id = $3',
    [counter, new Date(lastUsedAt), credentialID],
  )
}

export async function removeCredential(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    'DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2',
    [id, userId],
  )
  return (rowCount ?? 0) > 0
}

export async function updateCredentialName(id: string, userId: string, friendlyName: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    'UPDATE passkey_credentials SET friendly_name = $1 WHERE id = $2 AND user_id = $3',
    [friendlyName, id, userId],
  )
  return (rowCount ?? 0) > 0
}
