import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { requireAuth, getChallengeCookie, clearChallengeCookie } from '../../utils/session'
import * as db from '../../utils/db'
import { getClientIP } from '../../utils/rateLimiter'
import { logSecurityEvent } from '../../utils/securityLogger'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const ip = getClientIP(event)
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const { rpID, origin } = config.webauthn as { rpName: string; rpID: string; origin: string }

  const expectedChallenge = getChallengeCookie(event)

  const challengeData = await db.getChallenge(expectedChallenge)
  if (!challengeData || challengeData.used || challengeData.expiresAt < Date.now() || challengeData.userId !== user.id) {
    logSecurityEvent({ event: 'passkey.registration.failure', ip, userId: user.id, reason: 'challenge_invalid_or_expired' })
    throw createError({ statusCode: 400, statusMessage: 'Challenge inválido o expirado' })
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body.credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })
  } catch {
    logSecurityEvent({ event: 'passkey.registration.failure', ip, userId: user.id, reason: 'fido2_verification_exception' })
    throw createError({ statusCode: 400, statusMessage: 'Verificación FIDO2 fallida' })
  }

  if (!verification.verified || !verification.registrationInfo) {
    logSecurityEvent({ event: 'passkey.registration.failure', ip, userId: user.id, reason: 'fido2_not_verified' })
    throw createError({ statusCode: 400, statusMessage: 'Verificación FIDO2 fallida' })
  }

  await db.markChallengeUsed(expectedChallenge)
  clearChallengeCookie(event)

  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo

  const stored = await db.addCredential({
    userId: user.id,
    credentialID: typeof credentialID === 'string' ? credentialID : Buffer.from(credentialID as unknown as Uint8Array).toString('base64url'),
    credentialPublicKey: credentialPublicKey as unknown as Uint8Array,
    counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: body.credential?.response?.transports ?? [],
    friendlyName: (body.friendlyName as string | undefined)?.trim() || 'Mi Passkey',
    lastUsedAt: null,
    createdAt: Date.now(),
  })

  logSecurityEvent({
    event: 'passkey.registration.success',
    ip,
    userId: user.id,
    credentialId: stored.id,
    meta: { deviceType: credentialDeviceType, backedUp: credentialBackedUp, friendlyName: stored.friendlyName },
  })

  return { success: true, credentialId: stored.id }
})
