export default defineNuxtRouteMiddleware(async (to) => {
  const { user, fetchUser } = useAuth()

  if (!user.value) {
    await fetchUser()
  }

  const publicRoutes = ['/auth/login', '/auth/register']
  const isPublic = publicRoutes.includes(to.path)

  if (!user.value && !isPublic) {
    return navigateTo('/auth/login')
  }

  if (user.value && isPublic) {
    return navigateTo('/dashboard')
  }
})
