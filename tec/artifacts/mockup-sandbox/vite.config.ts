import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
// Remova estas importações do Replit:
// import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
// import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const rawPort = process.env.PORT || "3000"; // Fallback para Railway
const port = Number(rawPort);

// Railway geralmente não usa BASE_PATH
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [
    // mockupPreviewPlugin(), // Removido se não for essencial
    react(),
    tailwindcss(),
    // runtimeErrorOverlay(), // Removido - específico do Replit
    // Remova todo o bloco do cartographer
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname || __dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname || __dirname),
  build: {
    outDir: path.resolve(import.meta.dirname || __dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});