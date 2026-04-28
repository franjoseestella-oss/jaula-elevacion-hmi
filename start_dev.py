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
        [python_exe, "launcher.py"],
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
        # Esperar a que los procesos terminen (o el usuario haga Ctrl+C)
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\n[!] Deteniendo servicios...")
        backend_process.terminate()
        frontend_process.terminate()
        print("[OK] Aplicación cerrada.")

if __name__ == "__main__":
    main()
