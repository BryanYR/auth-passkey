<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { registerPasskey, listPasskeys, deletePasskey, renamePasskey, isSupported, isLoading } = usePasskey()

const passkeys = ref<any[]>([])
const loading = ref(false)
const showAddModal = ref(false)
const newPasskeyName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')
const successMessage = ref('')

const loadPasskeys = async () => {
  loading.value = true
  try {
    passkeys.value = await listPasskeys()
  } finally {
    loading.value = false
  }
}

onMounted(loadPasskeys)

const handleAdd = async () => {
  try {
    await registerPasskey(newPasskeyName.value.trim() || 'Nueva Passkey')
    successMessage.value = 'Passkey agregada correctamente'
    showAddModal.value = false
    newPasskeyName.value = ''
    await loadPasskeys()
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (e: any) {
    if (e?.name !== 'NotAllowedError') console.error(e)
  }
}

const handleDelete = async (id: string) => {
  if (!confirm('¿Eliminar esta passkey? No podrás usarla para iniciar sesión.')) return
  await deletePasskey(id)
  await loadPasskeys()
}

const startRename = (pk: any) => {
  editingId.value = pk.id
  editingName.value = pk.friendlyName
}

const saveRename = async (id: string) => {
  if (!editingName.value.trim()) return
  await renamePasskey(id, editingName.value.trim())
  editingId.value = null
  await loadPasskeys()
}

const cancelRename = () => { editingId.value = null }

const formatDate = (ts: number | null) => {
  if (!ts) return 'Nunca'
  return new Date(ts).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' })
}

const deviceIcon = (deviceType: string) =>
  deviceType === 'multiDevice' ? '☁️' : '📱'

const deviceLabel = (pk: any) => {
  if (pk.backedUp) return 'Sincronizada (iCloud / Google)'
  if (pk.deviceType === 'singleDevice') return 'Solo este dispositivo'
  return 'Multi-dispositivo'
}
</script>

<template>
  <div class="min-h-screen bg-slate-900">
    <AppNav />

    <!-- Modal agregar passkey -->
    <Teleport to="body">
      <div v-if="showAddModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
        <div class="card p-8 max-w-sm w-full">
          <h2 class="text-xl font-bold text-white mb-1">Agregar Passkey</h2>
          <p class="text-slate-400 text-sm mb-5">Dale un nombre para identificar este dispositivo</p>

          <div class="mb-4">
            <label class="block text-sm font-medium text-slate-300 mb-1.5">Nombre del dispositivo</label>
            <input
              v-model="newPasskeyName"
              type="text"
              placeholder="Ej: iPhone de trabajo, MacBook Pro..."
              class="input-field"
              @keyup.enter="handleAdd"
            />
          </div>

          <div class="flex gap-3">
            <button @click="handleAdd" :disabled="isLoading" class="btn-primary flex-1">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.65 10A5.99 5.99 0 0 0 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6a5.99 5.99 0 0 0 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
              </svg>
              {{ isLoading ? 'Registrando...' : 'Registrar Passkey' }}
            </button>
            <button @click="showAddModal = false" class="btn-secondary px-4">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <main class="max-w-2xl mx-auto px-4 py-8">

      <div class="mb-8">
        <NuxtLink to="/dashboard" class="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors mb-4">
          ← Dashboard
        </NuxtLink>
        <h1 class="text-2xl font-bold text-white">Seguridad</h1>
        <p class="text-slate-400 mt-1 text-sm">Gestiona tus métodos de inicio de sesión</p>
      </div>

      <!-- Success message -->
      <div v-if="successMessage" class="mb-5 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-center gap-2 animate-fade-in">
        ✅ {{ successMessage }}
      </div>

      <!-- Sección Passkeys -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-1">
          <div>
            <h2 class="font-semibold text-white">Passkeys</h2>
            <p class="text-sm text-slate-400 mt-0.5">Inicio de sesión sin contraseña — resistente a phishing</p>
          </div>
          <ClientOnly>
            <button
              v-if="isSupported"
              @click="showAddModal = true"
              class="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <span class="text-base leading-none">+</span>
              Agregar
            </button>
          </ClientOnly>
        </div>

        <!-- Sin passkeys -->
        <div v-if="!loading && passkeys.length === 0" class="mt-6 py-10 text-center">
          <div class="text-4xl mb-3">🔑</div>
          <p class="text-slate-300 font-medium">Sin passkeys configuradas</p>
          <p class="text-slate-500 text-sm mt-1">Agrega una para iniciar sesión con biometría</p>
          <ClientOnly>
            <button
              v-if="isSupported"
              @click="showAddModal = true"
              class="mt-4 btn-primary inline-flex"
            >
              Agregar primera Passkey
            </button>
            <template #fallback>
              <p class="mt-4 text-xs text-slate-600">Este browser no soporta passkeys</p>
            </template>
          </ClientOnly>
        </div>

        <!-- Loading -->
        <div v-else-if="loading" class="mt-6 py-8 text-center text-slate-500 text-sm">
          Cargando...
        </div>

        <!-- Lista -->
        <div v-else class="mt-4 space-y-3">
          <div
            v-for="pk in passkeys"
            :key="pk.id"
            class="flex items-center gap-4 p-4 bg-slate-700/30 border border-slate-700 rounded-xl"
          >
            <div class="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-lg shrink-0">
              {{ deviceIcon(pk.deviceType) }}
            </div>
            <div class="flex-1 min-w-0">
              <!-- Modo edición -->
              <div v-if="editingId === pk.id" class="flex items-center gap-2">
                <input
                  v-model="editingName"
                  type="text"
                  class="input-field py-1.5 text-sm flex-1"
                  @keyup.enter="saveRename(pk.id)"
                  @keyup.escape="cancelRename"
                  autofocus
                />
                <button @click="saveRename(pk.id)" class="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">Guardar</button>
                <button @click="cancelRename" class="text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancelar</button>
              </div>
              <!-- Modo visualización -->
              <div v-else>
                <p class="font-medium text-white text-sm truncate">{{ pk.friendlyName }}</p>
                <div class="flex items-center gap-3 mt-0.5">
                  <span class="text-xs text-slate-500">{{ deviceLabel(pk) }}</span>
                  <span class="text-xs text-slate-600">·</span>
                  <span class="text-xs text-slate-500">Usado: {{ formatDate(pk.lastUsedAt) }}</span>
                  <span class="text-xs text-slate-600">·</span>
                  <span class="text-xs text-slate-500">Creado: {{ formatDate(pk.createdAt) }}</span>
                </div>
              </div>
            </div>
            <!-- Acciones -->
            <div v-if="editingId !== pk.id" class="flex items-center gap-1 shrink-0">
              <button
                @click="startRename(pk)"
                class="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-700"
                title="Renombrar"
              >
                ✏️
              </button>
              <button
                @click="handleDelete(pk.id)"
                class="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-700"
                title="Eliminar"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Info card -->
      <div class="mt-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
        <p class="text-xs text-slate-500 flex items-start gap-2">
          <span class="text-base leading-none mt-0.5">🔒</span>
          <span>
            Las passkeys están vinculadas a este dominio. Nunca funcionarán en un sitio falso que intente robar tus credenciales, protegiéndote contra phishing por diseño.
          </span>
        </p>
      </div>

    </main>
  </div>
</template>
