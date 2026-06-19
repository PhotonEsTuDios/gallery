import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-06-19',
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  // Prod-Build als AWS-Lambda (Function URL). Lokal: node-server.
  nitro: {
    preset: process.env.NITRO_PRESET || 'node-server',
  },

  // Server-only Secrets — landen NIE im Client-Bundle.
  runtimeConfig: {
    galleryPassword: process.env.GALLERY_PASSWORD || '',
    sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',
    awsRegion: process.env.AWS_REGION || 'eu-west-1',
    photosBucket: process.env.PHOTOS_BUCKET || 'photonestudios-photos',
    photosTable: process.env.PHOTOS_TABLE || 'photonestudios-photos',
  },

  app: {
    head: {
      title: 'PhotonEsTuDios — Gallery',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'robots', content: 'noindex, nofollow' },
      ],
    },
  },
})
