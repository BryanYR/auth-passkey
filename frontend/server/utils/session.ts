import { getCookie, setCookie, deleteCookie, createError } from 'h3'
import type { H3Event } from 'h3'
import { sessions, usersById } from './store'

export const SESSION_COOKIE = 'auth_session'
export const CHALLENGE_COOKIE = 'webauthn_challenge'

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export function setSessionCookie(event: H3Event, sessionId: string) {
  setCookie(event, SESSION_COOKIE, sessionId, {
    ...COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, SESSION_COOKIE, COOKIE_BASE)
}

export function setChallengeCookie(event: H3Event, challenge: string) {
  setCookie(event, CHALLENGE_COOKIE, challenge, {
    ...COOKIE_BASE,
    maxAge: 300, // 5 minutes
  })
}

export function clearChallengeCookie(event: H3Event) {
  deleteCookie(event, CHALLENGE_COOKIE, COOKIE_BASE)
}

export function requireAuth(event: H3Event) {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (!sessionId) throw createError({ statusCode: 401, statusMessage: 'No autenticado' })

  const session = sessions.get(sessionId)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Sesión inválida' })

  const user = usersById.get(session.userId)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Usuario no encontrado' })

  return { session, user }
}

export function getChallengeCookie(event: H3Event): string {
  const challenge = getCookie(event, CHALLENGE_COOKIE)
  if (!challenge) throw createError({ statusCode: 400, statusMessage: 'Challenge expirado o no encontrado' })
  return challenge
}
