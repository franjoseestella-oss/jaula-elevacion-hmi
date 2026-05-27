import subprocess
import os
import time
import webbrowser
import sys
import threading

def log_stream(stream, prefix, log_file_path):
    """Lee de un flujo de salida de un proceso y escribe a consola y a un archivo de log."""
    try:
        os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
        with open(log_file_path, "a", encoding="utf-8") as f:
            for line in iter(stream.readline, ''):
                if not line:
                    break
                
                # 1. Intentar escribir en el archivo de log (UTF-8)
                try:
                    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
                    f.write(f"{timestamp} [{prefix}] {line}")
                    f.flush()
                except Exception as e:
                    try:
                        sys.stderr.write(f"[Log File Write Error] No se pudo escribir al archivo de log: {e}\n")
                        sys.stderr.flush()
                    except Exception:
                        pass

                # 2. Intentar escribir en la consola (con soporte de codificación robusto)
                try:
                    sys.stdout.write(f"[{prefix}] {line}")
                    sys.stdout.flush()
                except UnicodeEncodeError:
                    try:
                        enc = sys.stdout.encoding or 'utf-8'
                        sys.stdout.buffer.write(f"[{prefix}] {line}".encode(enc, errors='replace'))
                        sys.stdout.flush()
                    except Exception:
                        pass
                except Exception:
                    pass
    except Exception as e:
        try:
            sys.stderr.write(f"[Logging Fatal Error] Fallo crítico en el hilo de log {prefix}: {e}\n")
            sys.stderr.flush()
        except Exception:
            pass

def log_startup(message, log_file_path):
    """Registra un mensaje de ciclo de vida del startup en consola y en el archivo de log."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    formatted_msg = f"{timestamp} [STARTUP] {message}"
    print(message)
    try:
        os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(formatted_msg + "\n")
            f.flush()
    except Exception:
        pass

def free_port_windows(port, startup_log):
    """Detecta y mata procesos que estén escuchando en el puerto especificado (Solo Windows)."""
    if sys.platform != "win32":
        return
    try:
        # Buscar el PID del proceso escuchando en el puerto
        output = subprocess.check_output(
            f"netstat -ano | findstr LISTENING | findstr :{port}",
            shell=True,
            text=True
        )
        pids = set()
        for line in output.strip().split('\n'):
            parts = line.strip().split()
            if len(parts) >= 5:
                pid = parts[-1]
                if pid.isdigit() and int(pid) > 0:
                    pids.add(pid)
                    
        for pid in pids:
            log_startup(f"[!] Puerto {port} ocupado por PID {pid}. Terminando proceso...", startup_log)
            # Intentar matar el proceso de forma forzada
            subprocess.run(
                f"taskkill /F /PID {pid}", 
                shell=True, 
                stdout=subprocess.DEVNULL, 
                stderr=subprocess.DEVNULL
            )
        if pids:
            time.sleep(1.5) # Esperar a que el puerto se libere en el SO
    except subprocess.CalledProcessError:
        # Coincidencia no encontrada, puerto libre
        pass
    except Exception as e:
        log_startup(f"[WARN] No se pudo liberar el puerto {port}: {e}", startup_log)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")
    log_dir = os.path.join(root_dir, "logs")

    startup_log = os.path.join(log_dir, "startup.log")
    backend_log = os.path.join(log_dir, "backend_dev.log")
    frontend_log = os.path.join(log_dir, "frontend_dev.log")

    log_startup("========================================", startup_log)
    log_startup(" Iniciando HMI Jaula de Elevación (Dev) ", startup_log)
    log_startup("========================================", startup_log)

    # Liberar el puerto del backend si está en uso por alguna ejecución previa colgada
    free_port_windows(8001, startup_log)

    # 1. Iniciar el Backend
    log_startup("\n[+] Iniciando Backend (FastAPI)...", startup_log)
    python_exe = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    if not os.path.exists(python_exe):
        python_exe = "python" # Fallback to system python

    try:
        backend_process = subprocess.Popen(
            [python_exe, "launcher.py", "--no-browser"],
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            encoding='utf-8',
            errors='replace',
            shell=True
        )
        
        # Iniciar hilos para leer salida
        backend_out_thread = threading.Thread(
            target=log_stream, 
            args=(backend_process.stdout, "BACKEND_OUT", backend_log),
            daemon=True
        )
        backend_err_thread = threading.Thread(
            target=log_stream, 
            args=(backend_process.stderr, "BACKEND_ERR", backend_log),
            daemon=True
        )
        backend_out_thread.start()
        backend_err_thread.start()
        log_startup("[OK] Proceso del Backend iniciado.", startup_log)
    except Exception as e:
        log_startup(f"[ERR] Error crítico al lanzar el Backend: {e}", startup_log)
        sys.exit(1)

    # 2. Iniciar el Frontend
    log_startup("[+] Iniciando Frontend (Vite)...", startup_log)
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    try:
        frontend_process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            encoding='utf-8',
            errors='replace',
            shell=True
        )
        
        # Iniciar hilos para leer salida
        frontend_out_thread = threading.Thread(
            target=log_stream, 
            args=(frontend_process.stdout, "FRONTEND_OUT", frontend_log),
            daemon=True
        )
        frontend_err_thread = threading.Thread(
            target=log_stream, 
            args=(frontend_process.stderr, "FRONTEND_ERR", frontend_log),
            daemon=True
        )
        frontend_out_thread.start()
        frontend_err_thread.start()
        log_startup("[OK] Proceso del Frontend iniciado.", startup_log)
    except Exception as e:
        log_startup(f"[ERR] Error crítico al lanzar el Frontend: {e}", startup_log)
        # Detener backend antes de salir
        backend_process.terminate()
        sys.exit(1)

    # 3. Esperar un momento y abrir el navegador apuntando al frontend (5173)
    log_startup("\n[+] Esperando a que los servicios levanten...", startup_log)
    time.sleep(3)
    frontend_url = "http://localhost:5173"
    log_startup(f"[+] Abriendo navegador en: {frontend_url}", startup_log)
    webbrowser.open(frontend_url)

    log_startup("\n[!] Presiona Ctrl+C para detener ambos servicios.", startup_log)
    
    try:
        # Monitorizar activamente ambos procesos
        while True:
            # Comprobar si el backend ha terminado
            backend_code = backend_process.poll()
            if backend_code is not None:
                log_startup(f"\n[ERR] El proceso del Backend (FastAPI) ha terminado inesperadamente con código {backend_code}.", startup_log)
                break
                
            # Comprobar si el frontend ha terminado
            frontend_code = frontend_process.poll()
            if frontend_code is not None:
                log_startup(f"\n[ERR] El proceso del Frontend (Vite) ha terminado inesperadamente con código {frontend_code}.", startup_log)
                break
                
            time.sleep(1.0)
            
    except KeyboardInterrupt:
        log_startup("\n[!] Deteniendo servicios por solicitud del usuario...", startup_log)
    finally:
        # Asegurar que ambos procesos se detengan al salir
        try:
            if backend_process.poll() is None:
                backend_process.terminate()
        except Exception:
            pass
        try:
            if frontend_process.poll() is None:
                frontend_process.terminate()
        except Exception:
            pass
        log_startup("[OK] Aplicación cerrada.", startup_log)

if __name__ == "__main__":
    main()
