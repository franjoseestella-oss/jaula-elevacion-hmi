import React from 'react';

/**
 * ErrorBoundary — Captura errores de renderizado de React y evita el pantallazo blanco.
 * Muestra una pantalla de error con detalles y opción de recarga.
 *
 * Uso:
 *   <ErrorBoundary>
 *     <ComponenteVolatil />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<div>Error en este bloque</div>}>
 *     <ComponenteConcreto />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState(prev => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Log detallado en consola para facilitar el diagnóstico
    console.error('[ErrorBoundary] Crash capturado en:', this.props.name || 'componente desconocido');
    console.error('[ErrorBoundary] Error:', error);
    console.error('[ErrorBoundary] Stack del componente:', errorInfo?.componentStack);

    // Intentar notificar al backend si está disponible
    try {
      fetch('http://127.0.0.1:8001/api/logs/frontend-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boundary: this.props.name || 'unknown',
          message: error?.message || String(error),
          stack: error?.stack,
          componentStack: errorInfo?.componentStack,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {}); // silenciar si el backend no está disponible
    } catch (_) {}
  }

  handleReload() {
    window.location.reload();
  }

  handleReset() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  render() {
    if (this.state.hasError) {
      // Si se proporcionó un fallback personalizado, usarlo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo } = this.state;
      const isDev = import.meta.env?.DEV ?? false;

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'linear-gradient(135deg, #0a0f12 0%, #111c24 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            color: '#e2e8f0',
            padding: '2rem',
          }}
        >
          {/* Icono de error */}
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)',
            border: '2px solid rgba(239,68,68,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            boxShadow: '0 0 40px rgba(239,68,68,0.3)',
          }}>
            <span style={{ fontSize: 36 }}>⚠</span>
          </div>

          {/* Título */}
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 900,
            color: '#ef4444',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
            textShadow: '0 0 20px rgba(239,68,68,0.5)',
          }}>
            Error de Aplicación
          </h1>

          <p style={{
            fontSize: '0.875rem',
            color: '#94a3b8',
            marginBottom: '0.25rem',
            textAlign: 'center',
          }}>
            {this.props.name
              ? `Se ha producido un error en el módulo "${this.props.name}".`
              : 'Se ha producido un error inesperado en la aplicación.'}
          </p>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2rem', textAlign: 'center' }}>
            La interfaz se ha detenido para evitar datos incorrectos. Recargue para continuar.
          </p>

          {/* Mensaje de error */}
          {error?.message && (
            <div style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12,
              padding: '0.75rem 1.25rem',
              marginBottom: '2rem',
              maxWidth: 600,
              width: '100%',
              textAlign: 'center',
            }}>
              <code style={{ fontSize: '0.8rem', color: '#fca5a5', wordBreak: 'break-all' }}>
                {error.message}
              </code>
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.75rem 2rem',
                background: 'linear-gradient(135deg, #dd2876, #b01f5e)',
                border: '1px solid rgba(221,40,118,0.4)',
                borderRadius: 10,
                color: 'white',
                fontWeight: 900,
                fontSize: '0.875rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(221,40,118,0.4)',
              }}
            >
              🔄 Recargar Aplicación
            </button>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 2rem',
                background: 'rgba(30,42,51,0.8)',
                border: '1px solid #2e404a',
                borderRadius: 10,
                color: '#94a3b8',
                fontWeight: 700,
                fontSize: '0.875rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              ↩ Intentar Recuperar
            </button>
          </div>

          {/* Stack trace (solo en desarrollo) */}
          {isDev && errorInfo?.componentStack && (
            <details style={{ maxWidth: 700, width: '100%' }}>
              <summary style={{
                cursor: 'pointer',
                color: '#64748b',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '0.5rem',
              }}>
                🛠 Stack Trace (dev)
              </summary>
              <pre style={{
                background: '#0a0f12',
                border: '1px solid #1e2a33',
                borderRadius: 8,
                padding: '1rem',
                fontSize: '0.65rem',
                color: '#64748b',
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {error?.stack}
                {'\n\nComponent Stack:'}
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
