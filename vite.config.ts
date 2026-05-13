import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // maplibre + react-map-gl land in the lazy Map chunk automatically
          // via the dynamic import — no need to force them here.
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@tanstack/")) {
            return "vendor-query";
          }
          if (id.includes("node_modules/i18next") || id.includes("node_modules/react-i18next")) {
            return "vendor-i18n";
          }
          if (id.includes("node_modules/gsap") || id.includes("node_modules/@gsap/")) {
            return "vendor-gsap";
          }
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/radix-ui")) {
            return "vendor-ui";
          }
        },
      },
    },
  },
});
