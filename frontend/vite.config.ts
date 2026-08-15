import path from "path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Only used if VITE_ORCH_API_BASE is unset — workspaceApi.ts normally
    // calls the backend on an absolute URL, which bypasses this proxy.
    // Keep the port in sync with .env.local and start.ps1.
    proxy: {
      "/api": {
        target: "http://localhost:8055",
        changeOrigin: true,
      },
    },
  },
});
