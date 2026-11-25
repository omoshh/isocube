import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Config files may hold literals: the manifest needs real hexes (design-system --bg light, #F5F2EA).
// The app name is duplicated from src/ui/strings.ts (APP_NAME); change both when renaming.
const NAME = 'Isocube', BG = '#F5F2EA'

// Shown in Settings → About: build date and short commit, so the owner can tell which upload is live.
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' } })()
const BUILD = `${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${sha}`

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  test: { include: ['tests/**/*.test.ts'] },
  base: '/isocube/',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    workbox: { globPatterns: ['**/*.{js,css,html,json,woff2,png,svg}'] },
    manifest: {
      name: NAME, short_name: NAME, start_url: '/isocube/', scope: '/isocube/', display: 'standalone',
      theme_color: BG, background_color: BG,
      icons: [
        { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  })],
})
