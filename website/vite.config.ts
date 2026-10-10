import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" lets the same build run at journey.etclub.online/ and at a GitHub Pages
// project path. The site has one page and uses #hash links, so relative URLs are safe.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
});
