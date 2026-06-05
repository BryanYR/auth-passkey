const PASSKEY_ERROR_MESSAGES: Record<string, string> = {
  // El usuario canceló o no interactuó (el caso más común)
  NotAllowedError: 'Autenticación cancelada. Inténtalo de nuevo y completa la verificación cuando el navegador la solicite.',
  // El dispositivo no tiene passkeys para este sitio
  NotFoundError: 'No se encontró ninguna passkey para esta cuenta en este dispositivo. Registra una passkey desde Configuración de seguridad.',
  // El passkey ya existe (en registro)
  InvalidStateError: 'Ya tienes una passkey registrada en este dispositivo.',
  // rpID no coincide con el origen (error de configuración)
  SecurityError: 'Error de seguridad: el dominio no coincide. Contacta con soporte.',
  // Operación cancelada por código
  AbortError: 'La operación fue cancelada. Inténtalo de nuevo.',
  // Browser no soporta passkeys
  NotSupportedError: 'Tu navegador no admite passkeys. Usa Chrome, Safari o Edge actualizados.',
  // Timeout
  TimeoutError: 'Tiempo de espera agotado. Inténtalo de nuevo.',
}

const friendlyPasskeyError = (e: any): string => {
  // Errores del servidor (HTTP)
  if (e?.data?.statusMessage) return e.data.statusMessage
  // Errores del browser WebAuthn
  if (e?.name && PASSKEY_ERROR_MESSAGES[e.name]) return PASSKEY_ERROR_MESSAGES[e.name]
  // Fallback genérico
  return e?.message ?? 'No se pudo completar la autenticación con passkey. Inténtalo de nuevo.'
}

export interface PasskeyCredential {
  id: string
  credentialID: string
  friendlyName: string
  deviceType: string
  backedUp: boolean
  transports: string[]
  lastUsedAt: number | null
  createdAt: number
}

export const usePasskey = () => {
  const isSupported = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  onMounted(async () => {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return
    try {
      isSupported.value = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    } catch {
      isSupported.value = false
    }
  })

  const registerPasskey = async (friendlyName = 'Mi Passkey') => {
    isLoading.value = true
    error.value = null
    try {
      const options = await $fetch('/api/passkey/register.begin', { method: 'POST' })
      const { startRegistration } = await import('@simplewebauthn/browser')
      const credential = await startRegistration(options as any)
      return await $fetch('/api/passkey/register.finish', {
        method: 'POST',
        body: { credential, friendlyName },
      })
    } catch (e: any) {
      error.value = friendlyPasskeyError(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const loginWithPasskey = async (email?: string) => {
    isLoading.value = true
    error.value = null
    try {
      const options = await $fetch('/api/passkey/login.begin', {
        method: 'POST',
        body: { email: email || undefined },
      })
      const { startAuthentication } = await import('@simplewebauthn/browser')
      const credential = await startAuthentication(options as any)
      return await $fetch('/api/passkey/login.finish', {
        method: 'POST',
        body: { credential },
      })
    } catch (e: any) {
      error.value = friendlyPasskeyError(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const listPasskeys = () => $fetch<PasskeyCredential[]>('/api/passkey/credentials')

  const deletePasskey = (id: string) =>
    $fetch(`/api/passkey/${id}`, { method: 'DELETE' })

  const renamePasskey = (id: string, friendlyName: string) =>
    $fetch(`/api/passkey/${id}`, { method: 'PATCH', body: { friendlyName } })

  return {
    isSupported,
    isLoading,
    error,
    registerPasskey,
    loginWithPasskey,
    listPasskeys,
    deletePasskey,
    renamePasskey,
  }
}
