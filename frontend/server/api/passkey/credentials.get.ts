import { requireAuth } from '../../utils/session'
import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const creds = await db.getCredentialsByUserId(user.id)

  return creds.map(c => ({
    id: c.id,
    credentialID: c.credentialID,
    friendlyName: c.friendlyName,
    deviceType: c.deviceType,
    backedUp: c.backedUp,
    transports: c.transports,
    lastUsedAt: c.lastUsedAt,
    createdAt: c.createdAt,
  }))
})
