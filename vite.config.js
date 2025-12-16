import config from 'aberlaas/configs/vite';
/* eslint-disable import/no-unresolved */
// Those plugins uses the .exports syntax in their package.json, which isn't yet
// supported by eslint-plugin-import
import vitePluginReact from '@vitejs/plugin-react';
/* eslint-enable import/no-unresolved */

export default {
  ...config,
  base: './',
  plugins: [vitePluginReact()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
  build: {
    // PDF libraries (pdf-lib + pdfjs-dist) are large but necessary
    // for client-side PDF manipulation and rendering
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // Suppress "use client" directive warnings from react-pdf
      // These directives are for Next.js and don't affect our build
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
    },
  },
};
