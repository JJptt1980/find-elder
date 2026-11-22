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
        background_color: '#05100a',
        theme_color: '#05100a',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // 廣宣頁（/promo/）不進離線快取，也不被 App 首頁攔走
        globIgnores: ['promo/**'],
        navigateFallback: '/find-elder/index.html',
        navigateFallbackDenylist: [/^\/find-elder\/promo\//],
        // 新版一裝好就接手，手機重開 App 就是最新版
        // 好吃的方格資料：用過的存起來，沒網路也看得到；有網路時背景更新
        runtimeCaching: [
          {
            urlPattern: /\/find-elder\/food\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'food-tiles', expiration: { maxEntries: 400 } },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
