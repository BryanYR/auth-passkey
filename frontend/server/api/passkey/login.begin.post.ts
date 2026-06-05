import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { setChallengeCookie } from '../../utils/session'
import * as db from '../../utils/db'
import { applyRateLimit } from '../../utils/rateLimiter'
import { logSecurityEvent } from '../../utils/securityLogger'

export default defineEventHandler(async (event) => {
  // Fase 4: rate limiting — 10 req/min por IP
  const { ip } = applyRateLimit(event, 'passkey:login:begin', 10)

  const config = useRuntimeConfig()
  const { rpID } = config.webauthn as { rpName: string; rpID: string; origin: string }

  // Discoverable credentials: sin allowCredentials el browser muestra su selector
  // nativo con todas las passkeys registradas para este dominio (auth-passkey.vercel.app).
  // Evita problemas de ID mismatch y es el flujo recomendado por FIDO Alliance.
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  })

  await db.saveChallenge(options.challenge, {
    userId: null,
    type: 'authentication',
    expiresAt: Date.now() + 5 * 60 * 1000,
    used: false,
  })

  setChallengeCookie(event, options.challenge)

  logSecurityEvent({ event: 'passkey.auth.success', ip, meta: { step: 'begin' } })

  return options
})
