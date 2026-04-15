import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const repoBase = '/accounts_book/';

export default defineConfig({
  base: repoBase,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.png', 'icons/maskable-icon.png'],
      manifest: {
        name: 'Money PWA',
        short_name: 'Money',
        description: '个人消费记录与资产走势 PWA',
        theme_color: '#f4b400',
        background_color: '#f7f1e8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: repoBase,
        scope: repoBase,
        icons: [
          {
            src: `${repoBase}icons/icon.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${repoBase}icons/maskable-icon.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
