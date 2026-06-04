import { randomUUID } from 'node:crypto'
import { users, usersById, hashPassword, createSession } from '../../utils/store'
import { setSessionCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, firstName, lastName, country, city, dni, gender, phone } = body

  if (!email || !password || !firstName || !lastName) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan campos requeridos' })
  }

  if (users.has(email.toLowerCase())) {
    throw createError({ statusCode: 409, statusMessage: 'El correo ya está registrado' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener al menos 8 caracteres' })
  }

  const user = {
    id: randomUUID(),
    email: email.toLowerCase().trim(),
    passwordHash: hashPassword(password),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    country: country?.trim() ?? '',
    city: city?.trim() ?? '',
    dni: dni?.trim() ?? '',
    gender: gender ?? '',
    phone: phone?.trim() ?? '',
    createdAt: Date.now(),
  }

  users.set(user.email, user)
  usersById.set(user.id, user)

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
