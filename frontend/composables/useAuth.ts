export interface AuthUser {
  id: string
  email: string
  firstName: string
  lastName: string
}

export const useAuth = () => {
  const user = useState<AuthUser | null>('auth:user', () => null)

  const fetchUser = async () => {
    try {
      user.value = await $fetch<AuthUser>('/api/auth/me')
    } catch {
      user.value = null
    }
  }

  const login = async (email: string, password: string) => {
    const data = await $fetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data.user
    return data
  }

  const register = async (formData: Record<string, string | boolean>) => {
    const data = await $fetch<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: formData,
    })
    user.value = data.user
    return data
  }

  const logout = async () => {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
    await navigateTo('/auth/login')
  }

  const isLoggedIn = computed(() => !!user.value)

  return { user, isLoggedIn, fetchUser, login, register, logout }
}
