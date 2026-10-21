import { defineConfig } from 'vite'
import path from "path";
import vue from '@vitejs/plugin-vue'
import glsl from "vite-plugin-glsl";

// Share host options; older Vite 6 typings predate the allowedHosts option.
const hostOptions = { host: true, port: 2025, strictPort: true, allowedHosts: true as const };

// https://vite.dev/config/
export default defineConfig({
  base: './', // 确保在 GitHub Pages 等环境下资源路径正确
  plugins: [vue(), glsl({
    compress: true,
    watch: true,
  }),],
  server: hostOptions,
  preview: hostOptions,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@static": path.resolve(__dirname, "static"),
      "@assets": path.resolve(__dirname, "src/assets"),
      "@shaders": path.resolve(__dirname, "src/shaders"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@components": path.resolve(__dirname, "src/components"),
    },
  },
})
