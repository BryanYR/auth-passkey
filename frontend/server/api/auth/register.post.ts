import { randomUUID } from 'node:crypto'
import { hashPassword } from '../../utils/store'
import { setSessionCookie } from '../../utils/session'
import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, password, firstName, lastName, country, city, dni, gender, phone } = body

  if (!email || !password || !firstName || !lastName) {
    throw createError({ statusCode: 400, statusMessage: 'Faltan campos requeridos' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'La contraseña debe tener al menos 8 caracteres' })
  }

  const existing = await db.getUserByEmail(email)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'El correo ya está registrado' })
  }

  const user = await db.createUser({
    id: randomUUID(),
    email: (email as string).toLowerCase().trim(),
    passwordHash: hashPassword(password),
    firstName: (firstName as string).trim(),
    lastName: (lastName as string).trim(),
    country: (country as string | undefined)?.trim() ?? '',
    city: (city as string | undefined)?.trim() ?? '',
    dni: (dni as string | undefined)?.trim() ?? '',
    gender: (gender as string | undefined) ?? '',
    phone: (phone as string | undefined)?.trim() ?? '',
  })

  const sessionId = await db.createSession(user.id)
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
