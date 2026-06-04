import { generateRegistrationOptions } from '@simplewebauthn/server'
import { requireAuth, setChallengeCookie } from '../../utils/session'
import { getCredentialsByUserId, challenges } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const config = useRuntimeConfig()
  const { rpName, rpID } = config.webauthn as { rpName: string; rpID: string; origin: string }

  const existing = getCredentialsByUserId(user.id)

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: `${user.firstName} ${user.lastName}`,
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({
      id: c.credentialID,
      transports: c.transports as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  challenges.set(options.challenge, {
    userId: user.id,
    type: 'registration',
    expiresAt: Date.now() + 5 * 60 * 1000,
    used: false,
  })

  setChallengeCookie(event, options.challenge)

  return options
})
