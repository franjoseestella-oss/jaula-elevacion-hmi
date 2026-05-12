"""
launcher.py — Punto de entrada para el ejecutable PyInstaller.

Arranca el servidor FastAPI (uvicorn) en un hilo secundario y abre
automáticamente el navegador apuntando a http://localhost:8001.
"""

import sys
import os
import threading
import time
import webbrowser

# ─── Ajuste de rutas para PyInstaller --onefile ──────────────────────────────
# Cuando PyInstaller extrae el bundle, pone todo en sys._MEIPASS.
# Añadimos esa carpeta al PATH de importación para que "import main" funcione.
if hasattr(sys, '_MEIPASS'):
    bundle_dir = sys._MEIPASS
else:
    bundle_dir = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, bundle_dir)

# Cambiamos el CWD al bundle para que los paths relativos (database.config, etc.) funcionen
os.chdir(bundle_dir)

PORT = 8001
HOST = "0.0.0.0"


def start_server():
    import uvicorn
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=False,
        log_level="info",
    )


def open_browser():
    """Espera a que el servidor arranque y abre el navegador."""
    time.sleep(2)
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    print("=" * 55)
    print("  HMI Jaula de Elevación — Logisnext")
    print(f"  Servidor: http://localhost:{PORT}")
    print("=" * 55)

    # Hilo del servidor (daemon → se cierra al cerrar la consola)
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Abrir navegador tras un breve delay
    if "--no-browser" not in sys.argv:
        browser_thread = threading.Thread(target=open_browser, daemon=True)
        browser_thread.start()

    # Mantener el proceso principal vivo
    try:
        server_thread.join()
    except KeyboardInterrupt:
        print("\n[!] Servidor detenido.")
        sys.exit(0)
