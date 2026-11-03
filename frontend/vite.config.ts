import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// host: true để tablet cùng wifi mở được bằng http://<IP máy tính>:5173
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
})
