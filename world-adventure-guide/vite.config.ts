import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 部署到 https://kxjzxc.github.io/adventure-guide/ 时，
  // 子路径是 /adventure-guide/，需要把 vite 的资源基准路径配上。
  // 本地 npm run dev / npm run preview 时路径不变。
  base: '/adventure-guide/',
})
