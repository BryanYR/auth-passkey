import { requireAuth } from '../../utils/session'
import { getCredentialsByUserId } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const creds = getCredentialsByUserId(user.id)

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
