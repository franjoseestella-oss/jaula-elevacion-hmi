import subprocess
import os
import time
import webbrowser
import sys

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("========================================")
    print(" Iniciando HMI Jaula de Elevación (Dev) ")
    print("========================================")

    # 1. Iniciar el Backend
    print("\n[+] Iniciando Backend (FastAPI)...")
    python_exe = os.path.join(backend_dir, "venv", "Scripts", "python.exe")
    if not os.path.exists(python_exe):
        python_exe = "python" # Fallback to system python

    backend_process = subprocess.Popen(
        [python_exe, "launcher.py", "--no-browser"],
        cwd=backend_dir,
        shell=True
    )

    # 2. Iniciar el Frontend
    print("[+] Iniciando Frontend (Vite)...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_process = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=frontend_dir,
        shell=True
    )

    # 3. Esperar un momento y abrir el navegador apuntando al frontend (5173)
    print("\n[+] Esperando a que los servicios levanten...")
    time.sleep(3)
    frontend_url = "http://localhost:5173"
    print(f"[+] Abriendo navegador en: {frontend_url}")
    webbrowser.open(frontend_url)

    print("\n[!] Presiona Ctrl+C para detener ambos servicios.")
    
    try:
        # Monitorizar activamente ambos procesos
        while True:
            # Comprobar si el backend ha terminado
            backend_code = backend_process.poll()
            if backend_code is not None:
                print(f"\n[ERR] El proceso del Backend (FastAPI) ha terminado inesperadamente con código {backend_code}.")
                break
                
            # Comprobar si el frontend ha terminado
            frontend_code = frontend_process.poll()
            if frontend_code is not None:
                print(f"\n[ERR] El proceso del Frontend (Vite) ha terminado inesperadamente con código {frontend_code}.")
                break
                
            time.sleep(1.0)
            
    except KeyboardInterrupt:
        print("\n[!] Deteniendo servicios por solicitud del usuario...")
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
        print("[OK] Aplicación cerrada.")

if __name__ == "__main__":
    main()
