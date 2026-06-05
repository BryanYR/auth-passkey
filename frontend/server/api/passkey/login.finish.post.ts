import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { getChallengeCookie, clearChallengeCookie, setSessionCookie } from '../../utils/session'
import * as db from '../../utils/db'
import { applyRateLimit } from '../../utils/rateLimiter'
import { logSecurityEvent } from '../../utils/securityLogger'

export default defineEventHandler(async (event) => {
  // Fase 4: rate limiting más estricto en finish — 5 req/min por IP
  const { ip } = applyRateLimit(event, 'passkey:login:finish', 5)

  const body = await readBody(event)
  const config = useRuntimeConfig()
  const { rpID, origin } = config.webauthn as { rpName: string; rpID: string; origin: string }

  const expectedChallenge = getChallengeCookie(event)

  const challengeData = await db.getChallenge(expectedChallenge)
  if (!challengeData || challengeData.used || challengeData.expiresAt < Date.now()) {
    logSecurityEvent({ event: 'passkey.auth.failure', ip, reason: 'challenge_invalid_or_expired' })
    throw createError({ statusCode: 400, statusMessage: 'Challenge inválido o expirado' })
  }

  const credentialRecord = await db.getCredentialByCredentialID(body.credential?.id)
  if (!credentialRecord) {
    logSecurityEvent({ event: 'passkey.auth.failure', ip, reason: 'credential_not_found' })
    throw createError({ statusCode: 400, statusMessage: 'Credencial no encontrada' })
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body.credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: credentialRecord.credentialID,
        credentialPublicKey: credentialRecord.credentialPublicKey,
        counter: credentialRecord.counter,
        transports: credentialRecord.transports as AuthenticatorTransport[],
      },
    })
  } catch {
    logSecurityEvent({ event: 'passkey.auth.failure', ip, credentialId: credentialRecord.id, userId: credentialRecord.userId, reason: 'fido2_verification_exception' })
    throw createError({ statusCode: 401, statusMessage: 'Verificación FIDO2 fallida' })
  }

  if (!verification.verified) {
    logSecurityEvent({ event: 'passkey.auth.failure', ip, credentialId: credentialRecord.id, userId: credentialRecord.userId, reason: 'fido2_not_verified' })
    throw createError({ statusCode: 401, statusMessage: 'Verificación FIDO2 fallida' })
  }

  const newCounter = verification.authenticationInfo.newCounter

  // Fase 4: synced passkeys (iCloud, Google PW Manager) siempre tienen counter=0 — es normal.
  // Solo aplicar validación anti-clone en passkeys no sincronizadas.
  const isSyncedPasskey = credentialRecord.backedUp
  if (!isSyncedPasskey && newCounter <= credentialRecord.counter) {
    logSecurityEvent({
      event: 'passkey.counter_anomaly',
      ip,
      credentialId: credentialRecord.id,
      userId: credentialRecord.userId,
      meta: { storedCounter: credentialRecord.counter, receivedCounter: newCounter },
    })
    throw createError({ statusCode: 401, statusMessage: 'Anomalía de seguridad detectada en la credencial' })
  }

  await db.updateCredentialCounter(credentialRecord.credentialID, newCounter, Date.now())
  await db.markChallengeUsed(expectedChallenge)
  clearChallengeCookie(event)

  const user = await db.getUserById(credentialRecord.userId)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado' })

  const sessionId = await db.createSession(user.id)
  setSessionCookie(event, sessionId)

  logSecurityEvent({
    event: 'passkey.auth.success',
    ip,
    userId: user.id,
    credentialId: credentialRecord.id,
    meta: { step: 'finish', syncedPasskey: isSyncedPasskey },
  })

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  }
})
