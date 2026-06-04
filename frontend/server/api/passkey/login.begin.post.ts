import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { setChallengeCookie } from '../../utils/session'
import { users, getCredentialsByUserId, challenges } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const config = useRuntimeConfig()
  const { rpID } = config.webauthn as { rpName: string; rpID: string; origin: string }

  let allowCredentials: { id: string; transports: AuthenticatorTransport[] }[] | undefined

  if (body?.email) {
    const user = users.get((body.email as string).toLowerCase().trim())
    if (user) {
      const creds = getCredentialsByUserId(user.id)
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

  challenges.set(options.challenge, {
    userId: null,
    type: 'authentication',
    expiresAt: Date.now() + 5 * 60 * 1000,
    used: false,
  })

  setChallengeCookie(event, options.challenge)

  return options
})
