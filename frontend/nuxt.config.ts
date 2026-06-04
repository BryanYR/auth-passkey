export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    webauthn: {
      rpName: process.env.WEBAUTHN_RP_NAME || 'Ticketera Demo',
      rpID: process.env.WEBAUTHN_RP_ID || 'localhost',
      origin: process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000',
    },
  },
  typescript: {
    strict: true,
  },
})
