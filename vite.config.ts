import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills()],
  server: {
    host: '127.0.0.1', // loopback only (global rule, checked by scripts/guard.sh)
    port: 5173, // Ensure this is the correct port
  },
});
