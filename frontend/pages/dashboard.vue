<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
const { listPasskeys, isSupported } = usePasskey()

const passkeys = ref<any[]>([])
const loaded = ref(false)

onMounted(async () => {
  try {
    passkeys.value = await listPasskeys()
  } catch { /* ignore */ }
  loaded.value = true
})

const hasPasskeys = computed(() => passkeys.value.length > 0)

const mockTickets = [
  { id: 'TK-001', event: 'Coldplay World Tour 2025', date: '15 Nov 2025', venue: 'Estadio Nacional', status: 'Confirmado' },
  { id: 'TK-002', event: 'Bad Bunny - El Último Tour', date: '22 Ene 2026', venue: 'Arena Lima', status: 'Pendiente' },
  { id: 'TK-003', event: 'Feria Gastronómica Lima', date: '8 Feb 2026', venue: 'Costa Verde', status: 'Confirmado' },
]
</script>

<template>
  <div class="min-h-screen bg-slate-900">
    <AppNav />

    <main class="max-w-5xl mx-auto px-4 py-8">

      <!-- Bienvenida -->
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-white">
          Hola, {{ user?.firstName }} 👋
        </h1>
        <p class="text-slate-400 mt-1 text-sm">Aquí están tus próximos eventos</p>
      </div>

      <!-- Banner Passkey — solo si el browser soporta y no tiene passkeys -->
      <ClientOnly>
        <div
          v-if="loaded && !hasPasskeys && isSupported"
          class="mb-8 p-5 bg-violet-600/10 border border-violet-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in"
        >
          <div class="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0 text-xl">
            🔑
          </div>
          <div class="flex-1">
            <p class="font-semibold text-white">¿Quieres iniciar sesión más rápido?</p>
            <p class="text-sm text-slate-400 mt-0.5">
              Activa tu Passkey y entra con Face ID, huella o Windows Hello — sin contraseña.
            </p>
          </div>
          <NuxtLink
            to="/settings/security"
            class="shrink-0 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Configurar Passkey
          </NuxtLink>
        </div>
      </ClientOnly>

      <!-- Tus tickets -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-white">Mis entradas</h2>
          <span class="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-1 rounded-full">
            {{ mockTickets.length }} entradas
          </span>
        </div>

        <div class="space-y-3">
          <div
            v-for="ticket in mockTickets"
            :key="ticket.id"
            class="card p-5 flex items-center gap-4 hover:border-slate-600 transition-colors"
          >
            <div class="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-lg shrink-0">
              🎟️
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-white truncate">{{ ticket.event }}</p>
              <p class="text-sm text-slate-400 mt-0.5">{{ ticket.date }} · {{ ticket.venue }}</p>
            </div>
            <span
              :class="ticket.status === 'Confirmado'
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'"
              class="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border"
            >
              {{ ticket.status }}
            </span>
          </div>
        </div>
      </div>

    </main>
  </div>
</template>
