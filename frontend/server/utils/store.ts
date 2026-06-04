import { randomBytes, pbkdf2Sync } from 'node:crypto'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Types
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
  credentialID: string         // Base64URLString
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
// In-memory store — PROTOTYPE ONLY, replace with DB in production
// ---------------------------------------------------------------------------

export const users = new Map<string, User>()              // email → User
export const usersById = new Map<string, User>()          // id → User
export const sessions = new Map<string, Session>()        // sessionId → Session
export const challenges = new Map<string, WebAuthnChallenge>() // challenge → entry
export const credentials = new Map<string, StoredCredential>() // credentialID → entry
export const credentialsByUser = new Map<string, Set<string>>() // userId → Set<credentialID>

// ---------------------------------------------------------------------------
// Password utilities
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

// ---------------------------------------------------------------------------
// Session utilities
// ---------------------------------------------------------------------------

export function createSession(userId: string): string {
  const sessionId = randomBytes(32).toString('hex')
  sessions.set(sessionId, { userId, createdAt: Date.now() })
  return sessionId
}

// ---------------------------------------------------------------------------
// Credential utilities
// ---------------------------------------------------------------------------

export function getCredentialsByUserId(userId: string): StoredCredential[] {
  const ids = credentialsByUser.get(userId)
  if (!ids) return []
  return Array.from(ids)
    .map(id => credentials.get(id))
    .filter((c): c is StoredCredential => !!c)
}

export function addCredential(credential: Omit<StoredCredential, 'id'>): StoredCredential {
  const stored: StoredCredential = { id: randomUUID(), ...credential }
  credentials.set(credential.credentialID, stored)
  if (!credentialsByUser.has(credential.userId)) {
    credentialsByUser.set(credential.userId, new Set())
  }
  credentialsByUser.get(credential.userId)!.add(credential.credentialID)
  return stored
}

export function removeCredential(credentialUUID: string, userId: string): boolean {
  // credentialUUID is the internal UUID (stored.id), not the credentialID
  const entry = Array.from(credentials.values()).find(
    c => c.id === credentialUUID && c.userId === userId
  )
  if (!entry) return false
  credentials.delete(entry.credentialID)
  credentialsByUser.get(userId)?.delete(entry.credentialID)
  return true
}
