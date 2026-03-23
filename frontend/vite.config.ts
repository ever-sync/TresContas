import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (!normalizedId.includes('/node_modules/')) {
            return undefined
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'framework-vendor'
          }

          if (
            normalizedId.includes('/node_modules/react-router/') ||
            normalizedId.includes('/node_modules/react-router-dom/') ||
            normalizedId.includes('/node_modules/@tanstack/react-query/') ||
            normalizedId.includes('/node_modules/zustand/')
          ) {
            return 'routing-state-vendor'
          }

          if (normalizedId.includes('/node_modules/recharts/')) {
            return 'charts-vendor'
          }

          if (normalizedId.includes('/node_modules/xlsx/')) {
            return 'spreadsheet-vendor'
          }

          if (normalizedId.includes('/node_modules/jspdf/')) {
            return 'jspdf-vendor'
          }

          if (normalizedId.includes('/node_modules/html2canvas/')) {
            return 'html2canvas-vendor'
          }

          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'icons-vendor'
          }

          if (
            normalizedId.includes('/node_modules/react-hook-form/') ||
            normalizedId.includes('/node_modules/@hookform/resolvers/') ||
            normalizedId.includes('/node_modules/zod/')
          ) {
            return 'forms-vendor'
          }

          if (
            normalizedId.includes('/node_modules/axios/') ||
            normalizedId.includes('/node_modules/react-hot-toast/')
          ) {
            return 'http-ui-vendor'
          }

          if (normalizedId.includes('/node_modules/@supabase/supabase-js/')) {
            return 'supabase-vendor'
          }

          return 'vendor-misc'
        },
      },
    },
  },
})
