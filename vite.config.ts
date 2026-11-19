import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/find-elder/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '尋找大長老',
        short_name: '尋找大長老',
        description: '好玩的雷達：尋寶、附近好吃的、私房地圖',
        lang: 'zh-TW',
        start_url: '/find-elder/',
        scope: '/find-elder/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0c0d0f',
        theme_color: '#0c0d0f',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/find-elder/index.html',
        // 新版一裝好就接手，手機重開 App 就是最新版
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
