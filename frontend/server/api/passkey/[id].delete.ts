import { requireAuth } from '../../utils/session'
import { removeCredential } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const id = getRouterParam(event, 'id') as string

  const removed = removeCredential(id, user.id)
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Credencial no encontrada' })
  }

  return { success: true }
})
