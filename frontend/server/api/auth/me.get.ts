import { requireAuth } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  }
})
