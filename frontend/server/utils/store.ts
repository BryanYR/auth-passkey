import { randomBytes, pbkdf2Sync } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types  (implementación movida a db.ts — aquí solo los contratos)
// ---------------------------------------------------------------------------

export interface User {
  id: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  country: string
  city: string
  dni: string
  gender: string
  phone: string
  createdAt: number
}

export interface Session {
  userId: string
  createdAt: number
}

export interface WebAuthnChallenge {
  userId: string | null
  type: 'registration' | 'authentication'
  expiresAt: number
  used: boolean
}

export interface StoredCredential {
  id: string
  userId: string
  credentialID: string
  credentialPublicKey: Uint8Array
  counter: number
  deviceType: string
  backedUp: boolean
  transports: string[]
  friendlyName: string
  lastUsedAt: number | null
  createdAt: number
}

// ---------------------------------------------------------------------------
// Pure helpers (sin dependencia de BD)
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const computed = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return computed === hash
}
