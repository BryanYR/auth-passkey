<script setup lang="ts">
const { user } = useAuth()
await navigateTo(user.value ? '/dashboard' : '/auth/login', { replace: true })
</script>
