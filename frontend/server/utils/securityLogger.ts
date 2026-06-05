export type SecurityEventType =
  | 'passkey.registration.success'
  | 'passkey.registration.failure'
  | 'passkey.auth.success'
  | 'passkey.auth.failure'
  | 'passkey.counter_anomaly'
  | 'passkey.rate_limit_exceeded'
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.brute_force'

type Severity = 'info' | 'warn' | 'critical'

interface SecurityLog {
  event: SecurityEventType
  userId?: string
  credentialId?: string
  ip?: string
  reason?: string
  meta?: Record<string, unknown>
}

function getSeverity(event: SecurityEventType): Severity {
  if (event === 'passkey.counter_anomaly') return 'critical'
  if (
    event.endsWith('.failure') ||
    event === 'passkey.rate_limit_exceeded' ||
    event === 'auth.brute_force'
  ) return 'warn'
  return 'info'
}

/**
 * Emite un evento de seguridad estructurado.
 * En producción: redirigir a Datadog, Loki, CloudWatch, etc.
 */
export function logSecurityEvent(log: SecurityLog): void {
  const entry = {
    ...log,
    severity: getSeverity(log.event),
    timestamp: new Date().toISOString(),
  }
  // eslint-disable-next-line no-console
  console.log('[SECURITY]', JSON.stringify(entry))
}
