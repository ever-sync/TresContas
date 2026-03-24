import { createRequire } from 'module';
import { readdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

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

const replaceProcessEnvInFile = async (filePath) => {
  const source = await readFile(filePath, 'utf8');
  const transformed = source.replaceAll('process.env.NODE_ENV', '"production"');

  if (transformed !== source) {
    await writeFile(filePath, transformed, 'utf8');
  }
};

const replaceProcessEnvInDist = async (distDir) => {
  const entries = await readdir(distDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(distDir, entry.name);

    if (entry.isDirectory()) {
      await replaceProcessEnvInDist(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      await replaceProcessEnvInFile(fullPath);
    }
  }
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

await replaceProcessEnvInDist(path.resolve('dist'));
