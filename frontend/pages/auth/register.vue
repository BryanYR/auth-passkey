<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { register } = useAuth()
const { registerPasskey, isSupported } = usePasskey()

const form = reactive({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  country: '',
  city: '',
  dni: '',
  gender: '',
  phone: '',
  acceptTerms: false,
})

const loading = ref(false)
const error = ref('')
const showPasskeyModal = ref(false)
const passkeyLoading = ref(false)
const passkeyDone = ref(false)

const handleRegister = async () => {
  if (!form.acceptTerms) {
    error.value = 'Debes aceptar los términos y condiciones'
    return
  }
  loading.value = true
  error.value = ''
  try {
    await register({ ...form })
    if (isSupported.value) {
      showPasskeyModal.value = true
    } else {
      await navigateTo('/dashboard')
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Error al registrarse'
  } finally {
    loading.value = false
  }
}

const handleSetupPasskey = async () => {
  passkeyLoading.value = true
  try {
    await registerPasskey(`Passkey de ${form.firstName}`)
    passkeyDone.value = true
    setTimeout(() => navigateTo('/dashboard'), 1200)
  } catch (e: any) {
    if (e?.name !== 'NotAllowedError') console.error(e)
    await navigateTo('/dashboard')
  } finally {
    passkeyLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-900 py-12 px-4">

    <!-- Modal de Passkey post-registro -->
    <Teleport to="body">
      <div v-if="showPasskeyModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div class="card p-8 max-w-sm w-full text-center">
          <div v-if="passkeyDone" class="animate-fade-in">
            <div class="text-4xl mb-4">✅</div>
            <h2 class="text-xl font-bold text-white mb-2">¡Passkey configurada!</h2>
            <p class="text-slate-400 text-sm">Redirigiendo...</p>
          </div>
          <div v-else>
            <div class="text-4xl mb-4">🔑</div>
            <h2 class="text-xl font-bold text-white mb-2">¿Iniciar sesión más rápido?</h2>
            <p class="text-slate-400 text-sm mb-6">
              Configura tu Passkey ahora y la próxima vez entra con Face ID, huella o Windows Hello — sin contraseña.
            </p>
            <div class="space-y-3">
              <button
                @click="handleSetupPasskey"
                :disabled="passkeyLoading"
                class="btn-primary w-full"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
                </svg>
                {{ passkeyLoading ? 'Configurando...' : 'Configurar Passkey' }}
              </button>
              <button
                @click="navigateTo('/dashboard')"
                class="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors py-2"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="max-w-lg mx-auto animate-fade-in">

      <div class="text-center mb-8">
        <NuxtLink to="/auth/login" class="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors mb-6">
          ← Volver al login
        </NuxtLink>
        <h1 class="text-3xl font-bold text-white">Crear cuenta</h1>
        <p class="text-slate-400 mt-2 text-sm">Completa tus datos para registrarte</p>
      </div>

      <div class="card p-8">

        <div v-if="error" class="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-2">
          <span class="mt-0.5">⚠️</span>
          <span>{{ error }}</span>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-5">

          <!-- Correo y contraseña -->
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
              <input v-model="form.email" type="email" required autocomplete="email" placeholder="tu@correo.com" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
              <input v-model="form.password" type="password" required autocomplete="new-password" placeholder="Mínimo 8 caracteres" minlength="8" class="input-field" />
            </div>
          </div>

          <div class="border-t border-slate-700" />

          <!-- Nombre y apellido -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">Nombres</label>
              <input v-model="form.firstName" type="text" required placeholder="Bryan" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">Apellidos</label>
              <input v-model="form.lastName" type="text" required placeholder="García" class="input-field" />
            </div>
          </div>

          <!-- País y ciudad -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">País</label>
              <input v-model="form.country" type="text" required placeholder="Perú" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">Ciudad</label>
              <input v-model="form.city" type="text" required placeholder="Lima" class="input-field" />
            </div>
          </div>

          <!-- DNI, género, teléfono -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">DNI / Documento</label>
              <input v-model="form.dni" type="text" required placeholder="12345678" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-300 mb-1.5">Género</label>
              <select v-model="form.gender" required class="input-field bg-slate-700/50">
                <option value="" disabled>Seleccionar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
                <option value="other">Otro</option>
                <option value="prefer_not">Prefiero no decir</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Teléfono</label>
            <input v-model="form.phone" type="tel" required placeholder="+51 999 999 999" class="input-field" />
          </div>

          <div class="border-t border-slate-700" />

          <!-- TYC -->
          <label class="flex items-start gap-3 cursor-pointer group">
            <div class="relative mt-0.5">
              <input v-model="form.acceptTerms" type="checkbox" class="sr-only peer" />
              <div class="w-5 h-5 rounded border-2 border-slate-600 peer-checked:border-violet-500 peer-checked:bg-violet-500 transition-all flex items-center justify-center">
                <svg v-if="form.acceptTerms" class="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <span class="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Acepto los
              <a href="#" class="text-violet-400 hover:text-violet-300">Términos y Condiciones</a>
              y la
              <a href="#" class="text-violet-400 hover:text-violet-300">Política de Privacidad</a>
            </span>
          </label>

          <button
            type="submit"
            :disabled="loading || !form.acceptTerms"
            class="btn-primary w-full"
          >
            {{ loading ? 'Creando cuenta...' : 'Crear mi cuenta' }}
          </button>

        </form>

        <p class="mt-6 text-center text-slate-400 text-sm">
          ¿Ya tienes cuenta?
          <NuxtLink to="/auth/login" class="text-violet-400 hover:text-violet-300 font-medium ml-1 transition-colors">
            Iniciar sesión
          </NuxtLink>
        </p>

      </div>
    </div>
  </div>
</template>
