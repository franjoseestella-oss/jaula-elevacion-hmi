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
import logging

# ─── Configuración de Rutas de Logs ──────────────────────────────────────────
def get_log_dir() -> str:
    """Devuelve una ruta absoluta y persistente para guardar los logs."""
    if getattr(sys, 'frozen', False):
        # Ejecutable compilado con PyInstaller
        base_dir = os.path.dirname(sys.executable)
    else:
        # En modo desarrollo
        script_dir = os.path.dirname(os.path.abspath(__file__))
        # Si estamos dentro de la carpeta 'backend', subimos un nivel a la raíz del proyecto
        if os.path.basename(script_dir) == 'backend':
            base_dir = os.path.dirname(script_dir)
        else:
            base_dir = script_dir
    return os.path.join(base_dir, "logs")

# Inicializar sistema de logs antes de cambiar directorios o importar nada más
log_dir = get_log_dir()
try:
    os.makedirs(log_dir, exist_ok=True)
except Exception:
    pass

log_file_path = os.path.join(log_dir, "backend.log")

# Configurar logging root
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(log_file_path, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("launcher")

# Redirigir loggers de uvicorn y fastapi al archivo de log
file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))

for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"]:
    l = logging.getLogger(logger_name)
    l.addHandler(file_handler)

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
    try:
        import uvicorn
        from uvicorn.config import LOGGING_CONFIG
        import copy
        
        # Clonar LOGGING_CONFIG para no modificar el import global directamente
        custom_logging_config = copy.deepcopy(LOGGING_CONFIG)
        
        # Añadir nuestro FileHandler al config de uvicorn
        custom_logging_config["handlers"]["file"] = {
            "class": "logging.FileHandler",
            "filename": log_file_path,
            "encoding": "utf-8",
            "formatter": "default",
        }
        
        # Registrar el handler en los loggers de uvicorn de forma segura
        if "loggers" in custom_logging_config:
            for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
                if logger_name in custom_logging_config["loggers"]:
                    logger_config = custom_logging_config["loggers"][logger_name]
                    if "handlers" not in logger_config:
                        logger_config["handlers"] = []
                    if "file" not in logger_config["handlers"]:
                        logger_config["handlers"].append("file")
                else:
                    custom_logging_config["loggers"][logger_name] = {"handlers": ["default", "file"], "level": "INFO"}
        
        logger.info("Iniciando uvicorn con configuración de logs de archivo...")
        uvicorn.run(
            "main:app",
            host=HOST,
            port=PORT,
            reload=False,
            log_level="info",
            log_config=custom_logging_config
        )
    except Exception as e:
        logger.exception(f"Excepción crítica en el hilo de uvicorn: {e}")
        # Asegurar escribir el error en un log de emergencia por si acaso
        try:
            with open(os.path.join(log_dir, "backend_fatal.log"), "a", encoding="utf-8") as f:
                f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} FATAL: {str(e)}\n")
        except Exception:
            pass


def open_browser():
    """Espera a que el servidor arranque y abre el navegador."""
    time.sleep(2)
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    logger.info("=" * 55)
    logger.info("  HMI Jaula de Elevación — Logisnext")
    logger.info(f"  Servidor: http://localhost:{PORT}")
    logger.info("=" * 55)

    try:
        # Hilo del servidor (daemon → se cierra al cerrar la consola)
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()

        # Abrir navegador tras un breve delay
        if "--no-browser" not in sys.argv:
            browser_thread = threading.Thread(target=open_browser, daemon=True)
            browser_thread.start()

        # Mantener el proceso principal vivo
        while server_thread.is_alive():
            server_thread.join(timeout=1.0)
            
    except KeyboardInterrupt:
        logger.info("\n[!] Servidor detenido por interrupción del teclado (Ctrl+C).")
        sys.exit(0)
    except Exception as e:
        logger.exception(f"Error inesperado en launcher main: {e}")
        sys.exit(1)
