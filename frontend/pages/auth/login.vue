<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { login, fetchUser } = useAuth()
const { loginWithPasskey, isSupported } = usePasskey()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handlePasswordLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    await login(email.value, password.value)
    await navigateTo('/dashboard')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Correo o contraseña incorrectos'
  } finally {
    loading.value = false
  }
}

const handlePasskeyLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    await loginWithPasskey(email.value || undefined)
    await fetchUser()
    await navigateTo('/dashboard')
  } catch (e: any) {
    if (e?.name === 'NotAllowedError') {
      error.value = 'Autenticación cancelada'
    } else {
      error.value = e?.data?.statusMessage ?? e?.message ?? 'No se pudo autenticar con passkey'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div class="w-full max-w-md animate-fade-in">

      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 bg-violet-600 rounded-2xl mb-4 text-2xl shadow-lg shadow-violet-600/30">
          🎫
        </div>
        <h1 class="text-3xl font-bold text-white">Bienvenido</h1>
        <p class="text-slate-400 mt-2 text-sm">Inicia sesión en tu cuenta</p>
      </div>

      <div class="card p-8">

        <!-- Error -->
        <div v-if="error" class="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-2">
          <span class="mt-0.5">⚠️</span>
          <span>{{ error }}</span>
        </div>

        <!-- Passkey button — solo si el browser lo soporta (client-only para evitar hydration mismatch) -->
        <ClientOnly>
          <template v-if="isSupported">
            <button
              @click="handlePasskeyLogin"
              :disabled="loading"
              class="btn-primary w-full mb-5"
            >
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
              </svg>
              <span>{{ loading ? 'Verificando...' : 'Iniciar sesión con Passkey' }}</span>
            </button>

            <div class="relative mb-5">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-slate-700" />
              </div>
              <div class="relative flex justify-center">
                <span class="px-3 bg-slate-800 text-slate-500 text-xs uppercase tracking-wider">o continúa con contraseña</span>
              </div>
            </div>
          </template>
        </ClientOnly>

        <!-- Formulario email + password -->
        <form @submit.prevent="handlePasswordLogin" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
            <input
              v-model="email"
              type="email"
              required
              autocomplete="email webauthn"
              placeholder="tu@correo.com"
              class="input-field"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
            <input
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="input-field"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="btn-secondary w-full"
          >
            {{ loading ? 'Ingresando...' : 'Ingresar con contraseña' }}
          </button>
        </form>

        <p class="mt-6 text-center text-slate-400 text-sm">
          ¿No tienes cuenta?
          <NuxtLink to="/auth/register" class="text-violet-400 hover:text-violet-300 font-medium ml-1 transition-colors">
            Regístrate gratis
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
