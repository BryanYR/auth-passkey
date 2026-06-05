import * as db from '../../utils/db'
import { applyRateLimit } from '../../utils/rateLimiter'

export default defineEventHandler(async (event) => {
  applyRateLimit(event, 'auth:check-passkey', 10) // 10 req/min por IP

  const { email } = await readBody(event)

  if (!email) return { hasPasskey: false }

  const user = await db.getUserByEmail(email)
  if (!user) return { hasPasskey: false }

  const creds = await db.getCredentialsByUserId(user.id)
  return { hasPasskey: creds.length > 0 }
})
