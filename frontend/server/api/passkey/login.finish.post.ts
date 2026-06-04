import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { getChallengeCookie, clearChallengeCookie, setSessionCookie } from '../../utils/session'
import { challenges, credentials, usersById, createSession } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const { rpID, origin } = config.webauthn as { rpName: string; rpID: string; origin: string }

  const expectedChallenge = getChallengeCookie(event)

  const challengeData = challenges.get(expectedChallenge)
  if (!challengeData || challengeData.used || challengeData.expiresAt < Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'Challenge inválido o expirado' })
  }

  const credentialRecord = credentials.get(body.credential?.id)
  if (!credentialRecord) {
    throw createError({ statusCode: 400, statusMessage: 'Credencial no encontrada' })
  }

  const verification = await verifyAuthenticationResponse({
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

  if (!verification.verified) {
    throw createError({ statusCode: 401, statusMessage: 'Verificación FIDO2 fallida' })
  }

  // Anti-clone: si el counter retrocede, bloquear
  const newCounter = verification.authenticationInfo.newCounter
  if (newCounter !== 0 && newCounter <= credentialRecord.counter) {
    throw createError({ statusCode: 401, statusMessage: 'Anomalía detectada en la credencial' })
  }

  credentialRecord.counter = newCounter
  credentialRecord.lastUsedAt = Date.now()
  challengeData.used = true
  clearChallengeCookie(event)

  const user = usersById.get(credentialRecord.userId)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'Usuario no encontrado' })

  const sessionId = createSession(user.id)
  setSessionCookie(event, sessionId)

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
