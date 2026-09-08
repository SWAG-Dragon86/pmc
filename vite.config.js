import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/output/**'] } },
  preview: { port: 4173, strictPort: true },
  build: { chunkSizeWarningLimit: 1500 },
});
