import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { projectBridgePlugin } from './vite-project-bridge';

export default defineConfig({
  plugins: [react(), projectBridgePlugin()],
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
});
