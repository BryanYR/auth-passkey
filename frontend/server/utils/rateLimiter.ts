import type { H3Event } from 'h3'
import { getRequestIP } from 'h3'

interface WindowEntry {
  count: number
  resetAt: number
}

const windows = new Map<string, WindowEntry>()

// Limpia entradas expiradas cada 10 minutos
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key)
  }
}, 10 * 60 * 1000).unref?.()

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = windows.get(key)

  if (!entry || now > entry.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.count++
  return { allowed: true, retryAfter: 0 }
}

export function getClientIP(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true })
    ?? event.node.req.socket?.remoteAddress
    ?? 'unknown'
}

/**
 * Aplica rate limiting por IP. Lanza 429 si se supera el límite.
 * @param event   Evento H3
 * @param route   Identificador de la ruta (usado como parte del key)
 * @param max     Máximo de requests permitidos en la ventana
 * @param windowMs Tamaño de la ventana en ms (default: 60_000 = 1 minuto)
 */
export function applyRateLimit(
  event: H3Event,
  route: string,
  max: number,
  windowMs = 60_000,
): { ip: string } {
  const ip = getClientIP(event)
  const key = `${ip}:${route}`
  const { allowed, retryAfter } = checkRateLimit(key, max, windowMs)

  if (!allowed) {
    setResponseHeader(event, 'Retry-After', String(retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: `Demasiadas solicitudes. Intenta en ${retryAfter}s`,
    })
  }

  return { ip }
}
