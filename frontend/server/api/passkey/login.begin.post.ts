import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { setChallengeCookie } from '../../utils/session'
import * as db from '../../utils/db'
import { applyRateLimit } from '../../utils/rateLimiter'
import { logSecurityEvent } from '../../utils/securityLogger'

export default defineEventHandler(async (event) => {
  // Fase 4: rate limiting — 10 req/min por IP
  const { ip } = applyRateLimit(event, 'passkey:login:begin', 10)

  const body = await readBody(event)
  const config = useRuntimeConfig()
  const { rpID } = config.webauthn as { rpName: string; rpID: string; origin: string }

  let allowCredentials: { id: string; transports: AuthenticatorTransport[] }[] | undefined

  if (body?.email) {
    const user = await db.getUserByEmail(body.email as string)
    if (user) {
      const creds = await db.getCredentialsByUserId(user.id)
      if (creds.length > 0) {
        allowCredentials = creds.map(c => ({
          id: c.credentialID,
          transports: c.transports as AuthenticatorTransport[],
        }))
      }
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
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
