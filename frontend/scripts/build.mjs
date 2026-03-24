import { createRequire } from 'module';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'vite';

const require = createRequire(import.meta.url);
const childProcess = require('node:child_process');

const noopExec = (command, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
  }

  if (typeof callback === 'function') {
    callback(null, '', '');
  }

  return { kill() {} };
};

childProcess.exec = noopExec;
childProcess.execFile = noopExec;

const manualChunks = (id) => {
  const normalizedId = id.replace(/\\/g, '/');

  if (!normalizedId.includes('/node_modules/')) {
    return undefined;
  }

  if (
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('/node_modules/scheduler/')
  ) {
    return 'framework-vendor';
  }

  if (
    normalizedId.includes('/node_modules/react-router/') ||
    normalizedId.includes('/node_modules/react-router-dom/') ||
    normalizedId.includes('/node_modules/@tanstack/react-query/') ||
    normalizedId.includes('/node_modules/zustand/')
  ) {
    return 'routing-state-vendor';
  }

  if (normalizedId.includes('/node_modules/recharts/')) {
    return 'charts-vendor';
  }

  if (normalizedId.includes('/node_modules/xlsx/')) {
    return 'spreadsheet-vendor';
  }

  if (normalizedId.includes('/node_modules/jspdf/')) {
    return 'jspdf-vendor';
  }

  if (normalizedId.includes('/node_modules/html2canvas/')) {
    return 'html2canvas-vendor';
  }

  if (normalizedId.includes('/node_modules/lucide-react/')) {
    return 'icons-vendor';
  }

  if (
    normalizedId.includes('/node_modules/react-hook-form/') ||
    normalizedId.includes('/node_modules/@hookform/resolvers/') ||
    normalizedId.includes('/node_modules/zod/')
  ) {
    return 'forms-vendor';
  }

  if (
    normalizedId.includes('/node_modules/axios/') ||
    normalizedId.includes('/node_modules/react-hot-toast/')
  ) {
    return 'http-ui-vendor';
  }

  if (normalizedId.includes('/node_modules/@supabase/supabase-js/')) {
    return 'supabase-vendor';
  }

  return 'vendor-misc';
};

await build({
  configFile: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react(), tailwindcss()],
  build: {
    minify: false,
    cssMinify: false,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
