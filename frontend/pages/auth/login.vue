<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { login, fetchUser } = useAuth()
const { loginWithPasskey, isSupported } = usePasskey()

// Flujo por pasos: email → passkey | password
type Step = 'email' | 'passkey' | 'password'

const step = ref<Step>('email')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

// Avanzar desde la pantalla de email
const handleContinue = async () => {
  if (!email.value) return
  loading.value = true
  error.value = ''
  try {
    const { hasPasskey } = await $fetch<{ hasPasskey: boolean }>('/api/auth/check-passkey', {
      method: 'POST',
      body: { email: email.value },
    })
    // Si tiene passkey Y el browser la soporta → forzar passkey
    step.value = (hasPasskey && isSupported.value) ? 'passkey' : 'password'
  } catch {
    // Si falla la consulta, caer en password como fallback
    step.value = 'password'
  } finally {
    loading.value = false
  }
}

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
    await loginWithPasskey(email.value)
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

const goBack = () => {
  step.value = 'email'
  password.value = ''
  error.value = ''
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

        <!-- PASO 1: Solo email -->
        <form v-if="step === 'email'" @submit.prevent="handleContinue" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
            <input
              v-model="email"
              type="email"
              required
              autofocus
              autocomplete="email webauthn"
              placeholder="tu@correo.com"
              class="input-field"
            />
          </div>
          <button type="submit" :disabled="loading" class="btn-primary w-full">
            {{ loading ? 'Verificando...' : 'Continuar' }}
          </button>
        </form>

        <!-- PASO 2A: Usuario con passkey → solo passkey -->
        <ClientOnly>
          <div v-if="step === 'passkey'" class="space-y-4">
            <!-- Email readonly -->
            <div class="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl">
              <span class="text-slate-400 text-sm flex-1 truncate">{{ email }}</span>
              <button @click="goBack" class="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors">
                Cambiar
              </button>
            </div>

            <!-- Botón passkey principal -->
            <button @click="handlePasskeyLogin" :disabled="loading" class="btn-primary w-full">
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
              </svg>
              <span>{{ loading ? 'Verificando...' : 'Iniciar sesión con Passkey' }}</span>
            </button>

            <p class="text-center text-xs text-slate-500">
              Usa Face ID, huella o PIN de tu dispositivo
            </p>

            <!-- Escape hatch: si no tiene el dispositivo a mano -->
            <div class="relative my-2">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-slate-700" />
              </div>
              <div class="relative flex justify-center">
                <span class="px-3 bg-slate-800 text-slate-600 text-xs">¿No tienes tu dispositivo?</span>
              </div>
            </div>
            <button
              @click="step = 'password'"
              class="w-full text-slate-400 hover:text-slate-300 text-sm text-center transition-colors py-1"
            >
              Usar contraseña en su lugar →
            </button>
          </div>
        </ClientOnly>

        <!-- PASO 2B: Usuario sin passkey → password -->
        <div v-if="step === 'password'" class="space-y-4">
          <!-- Email readonly -->
          <div class="flex items-center gap-3 p-3 bg-slate-700/50 rounded-xl">
            <span class="text-slate-400 text-sm flex-1 truncate">{{ email }}</span>
            <button @click="goBack" class="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors">
              Cambiar
            </button>
          </div>

          <form @submit.prevent="handlePasswordLogin" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
              <input
                v-model="password"
                type="password"
                required
                autofocus
                autocomplete="current-password"
                placeholder="••••••••"
                class="input-field"
              />
            </div>
            <button type="submit" :disabled="loading" class="btn-primary w-full">
              {{ loading ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>
        </div>

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
