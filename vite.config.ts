import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3000,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        acertar: path.resolve(__dirname, "acertar/index.html"),
        game: path.resolve(__dirname, "game/index.html"),
        programar: path.resolve(__dirname, "eu-vou-programar/index.html"),
        ranking: path.resolve(__dirname, "ranking/index.html"),
        sobre: path.resolve(__dirname, "sobre/index.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
