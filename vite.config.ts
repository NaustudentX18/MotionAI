import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), wasm(), topLevelAwait()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@tiptap') || id.includes('prosemirror') || id.includes('lowlight')) return 'editor';
            if (id.includes('@tldraw')) return 'canvas';
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
            if (id.includes('@xenova') || id.includes('onnxruntime')) return 'ml';
            if (id.includes('yjs') || id.includes('y-webrtc') || id.includes('y-indexeddb')) return 'crdt';
            return 'vendor';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
