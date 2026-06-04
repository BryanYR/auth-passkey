<script setup lang="ts">
const { user, logout } = useAuth()
const loggingOut = ref(false)

const handleLogout = async () => {
  loggingOut.value = true
  await logout()
}

const initials = computed(() => {
  if (!user.value) return '?'
  return `${user.value.firstName[0]}${user.value.lastName[0]}`.toUpperCase()
})
</script>

<template>
  <nav class="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-10">
    <div class="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
      <div class="flex items-center gap-6">
        <NuxtLink to="/dashboard" class="flex items-center gap-2 font-bold text-white hover:text-violet-400 transition-colors">
          <span class="text-xl">🎫</span>
          <span class="hidden sm:block">Ticketera</span>
        </NuxtLink>
        <NuxtLink
          to="/dashboard"
          class="text-sm text-slate-400 hover:text-white transition-colors"
          active-class="text-white font-medium"
        >
          Inicio
        </NuxtLink>
        <NuxtLink
          to="/settings/security"
          class="text-sm text-slate-400 hover:text-white transition-colors"
          active-class="text-white font-medium"
        >
          Seguridad
        </NuxtLink>
      </div>

      <div class="flex items-center gap-3">
        <span class="hidden sm:block text-sm text-slate-400">
          {{ user?.firstName }} {{ user?.lastName }}
        </span>
        <div class="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
          {{ initials }}
        </div>
        <button
          @click="handleLogout"
          :disabled="loggingOut"
          class="text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50 ml-1"
        >
          Salir
        </button>
      </div>
    </div>
  </nav>
</template>
