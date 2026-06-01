import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Si el HMR no puede aplicar un cambio en caliente (ej. al cambiar de rama git),
    // fuerza un full-page reload en lugar de dejar la página en blanco.
    hmr: {
      // overlay: false evita que el overlay de error de Vite tape la pantalla
      // cuando ya tenemos nuestro propio ErrorBoundary de React.
      overlay: false,
    },
    watch: {
      // En Windows con OneDrive/rutas de red, el file watcher nativo puede
      // perder eventos. usePolling es más fiable para detectar cambios de rama.
      usePolling: false,
      // Ignorar node_modules y dist para no saturar el watcher
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
})

