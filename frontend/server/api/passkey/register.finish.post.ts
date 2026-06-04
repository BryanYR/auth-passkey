import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { requireAuth, getChallengeCookie, clearChallengeCookie } from '../../utils/session'
import { challenges, addCredential } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const { rpID, origin } = config.webauthn as { rpName: string; rpID: string; origin: string }

  const expectedChallenge = getChallengeCookie(event)

  const challengeData = challenges.get(expectedChallenge)
  if (!challengeData || challengeData.used || challengeData.expiresAt < Date.now() || challengeData.userId !== user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Challenge inválido o expirado' })
  }

  const verification = await verifyRegistrationResponse({
    response: body.credential,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  })

  if (!verification.verified || !verification.registrationInfo) {
    throw createError({ statusCode: 400, statusMessage: 'Verificación FIDO2 fallida' })
  }

  challengeData.used = true
  clearChallengeCookie(event)

  const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo

  const stored = addCredential({
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

  return { success: true, credentialId: stored.id }
})
