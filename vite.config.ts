import { defineConfig } from 'vite'
import path from "path";
import vue from '@vitejs/plugin-vue'
import glsl from "vite-plugin-glsl";

// https://vite.dev/config/
export default defineConfig({
  base: './', // 确保在 GitHub Pages 等环境下资源路径正确
  plugins: [vue(), glsl({
    compress: true,
    watch: true,
  }),],
  server: {
    host: true, // 监听 0.0.0.0，允许局域网通过 IP 访问
    port: 2025,
    strictPort: true,
    allowedHosts: true, // 允许使用 IP / 域名直接访问（绕过 Vite host 检查）
  },
  preview: {
    host: true,
    port: 2025,
    strictPort: true,
    allowedHosts: true,
  },
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
