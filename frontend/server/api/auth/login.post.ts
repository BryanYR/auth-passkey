import { users, verifyPassword, createSession } from '../../utils/store'
import { setSessionCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password } = body

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Correo y contraseña requeridos' })
  }

  const user = users.get(email.toLowerCase().trim())
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Correo o contraseña incorrectos' })
  }

  const sessionId = createSession(user.id)
  setSessionCookie(event, sessionId)

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  }
})
