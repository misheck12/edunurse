import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const enablePwaInDev = env.VITE_ENABLE_PWA_DEV === 'true';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icons/*.png', 'screenshots/*.png'],
          manifest: false, // Use public/manifest.json
          workbox: {
            navigateFallback: '/index.html',
            navigateFallbackDenylist: [/^\/api\//],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                // NEVER cache binary downloads or export status polls
                urlPattern: /^https?:\/\/[^/]+\/api\/v1\/exports\/.*/i,
                handler: 'NetworkOnly',
              },
              {
                // NEVER cache SSE streaming endpoints
                urlPattern: /^https?:\/\/[^/]+\/api\/v1\/chat$/i,
                handler: 'NetworkOnly',
              },
              {
                // Never cache API responses because they can contain authenticated user data.
                urlPattern: /^https?:\/\/[^/]+\/api\/v1\/.*/i,
                handler: 'NetworkOnly',
              },
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  }
                }
              },
              {
                urlPattern: /^https:\/\/picsum\.photos\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  }
                }
              }
            ]
          },
          devOptions: {
            enabled: enablePwaInDev,
            navigateFallback: '/index.html',
            navigateFallbackAllowlist: [/^\/(?!api\/).*/],
            suppressWarnings: true,
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
