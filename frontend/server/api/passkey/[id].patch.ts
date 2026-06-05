import { requireAuth } from '../../utils/session'
import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)

  if (!body.friendlyName?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Nombre requerido' })
  }

  const updated = await db.updateCredentialName(id, user.id, body.friendlyName.trim())
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Credencial no encontrada' })
  }

  return { success: true }
})
