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
      error.value = e?.data?.statusMessage ?? e?.message ?? 'Error al registrar passkey'
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
      error.value = e?.data?.statusMessage ?? e?.message ?? 'Error al autenticar con passkey'
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
