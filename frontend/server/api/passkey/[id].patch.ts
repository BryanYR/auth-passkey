import { requireAuth } from '../../utils/session'
import { credentials } from '../../utils/store'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const id = getRouterParam(event, 'id') as string
  const body = await readBody(event)

  const entry = Array.from(credentials.values()).find(
    c => c.id === id && c.userId === user.id
  )
  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'Credencial no encontrada' })
  }

  if (body.friendlyName?.trim()) {
    entry.friendlyName = body.friendlyName.trim()
  }

  return { success: true }
})
