import { getCookie } from 'h3'
import { sessions } from '../../utils/store'
import { SESSION_COOKIE, clearSessionCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (sessionId) sessions.delete(sessionId)
  clearSessionCookie(event)
  return { success: true }
})
