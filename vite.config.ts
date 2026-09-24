import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// Variáveis com estes prefixos ficam disponíveis em import.meta.env.
// Apenas chaves públicas/restringíveis devem ser usadas no front-end.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  envPrefix: ['VITE_', 'GOOGLE_', 'SUPABASE_', 'META_'],
  server: { host: true, port: 5173 },
})
