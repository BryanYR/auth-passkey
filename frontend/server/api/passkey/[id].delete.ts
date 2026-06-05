import { requireAuth } from '../../utils/session'
import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id') as string

  const removed = await db.removeCredential(id, user.id)
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: 'Credencial no encontrada' })
  }

  return { success: true }
})
