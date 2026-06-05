import { verifyPassword } from '../../utils/store'
import { setSessionCookie } from '../../utils/session'
import * as db from '../../utils/db'
import { applyRateLimit } from '../../utils/rateLimiter'
import { logSecurityEvent } from '../../utils/securityLogger'

export default defineEventHandler(async (event) => {
  // Fase 4: rate limiting contra brute force — 5 intentos/min por IP
  const { ip } = applyRateLimit(event, 'auth:login', 5)

  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Correo y contraseña requeridos' })
  }

  const user = await db.getUserByEmail(email)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    logSecurityEvent({
      event: 'auth.login.failure',
      ip,
      meta: { email },
      reason: 'invalid_credentials',
    })
    throw createError({ statusCode: 401, statusMessage: 'Correo o contraseña incorrectos' })
  }

  const sessionId = await db.createSession(user.id)
  setSessionCookie(event, sessionId)

  logSecurityEvent({ event: 'auth.login.success', ip, userId: user.id })

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  }
})
