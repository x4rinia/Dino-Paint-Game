import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    // Erreichbar im Heimnetzwerk (LAN) für Smartphones & Tablets
    host: true,
    allowedHosts: true,
    proxy: { "/api": "http://localhost:3001" },
  },
});
