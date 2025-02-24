// vite.config.ts
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  base: "/tower-defense/",
  plugins: [svgr()],
  server: {
    port: 3011,
  },
});
