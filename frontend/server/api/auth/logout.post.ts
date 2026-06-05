import { getCookie } from 'h3'
import { SESSION_COOKIE, clearSessionCookie } from '../../utils/session'
import * as db from '../../utils/db'

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, SESSION_COOKIE)
  if (sessionId) await db.deleteSession(sessionId)
  clearSessionCookie(event)
  return { success: true }
})
