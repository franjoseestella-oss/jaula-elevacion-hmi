import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// ── Recuperación automática de pantalla en blanco por cambio de rama (HMR fail) ──
// Cuando Vite no puede aplicar un cambio en caliente (ej. git checkout),
// el runtime del módulo puede fallar antes de que React se monte.
// Este handler detecta ese caso y fuerza un full reload una sola vez.
if (import.meta.hot) {
  import.meta.hot.on('vite:error', () => {
    const key = '__vite_hmr_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    }
  });

  // Limpiar el flag de reload cuando el HMR se estabiliza correctamente
  import.meta.hot.on('vite:afterUpdate', () => {
    sessionStorage.removeItem('__vite_hmr_reload');
  });
}

// Captura de errores de módulo no manejados (ej. import() dinámico fallido)
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || '';
  // Detectar errores típicos de HMR / módulo invalidado
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Importing a module script failed')
  ) {
    const key = '__vite_module_reload';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary name="Aplicación Principal">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

