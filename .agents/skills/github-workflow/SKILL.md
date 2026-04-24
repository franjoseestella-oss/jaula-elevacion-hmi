---
name: github-workflow
description: Skill para el manejo de versiones, control de código y buenas prácticas utilizando Git y GitHub en el proyecto.
---

# 🐙 GitHub & Git Workflow Skill

Esta skill define el flujo de trabajo estándar oficial para el control de versiones utilizando **Git** y **GitHub** dentro del proyecto. Asegura que el código se mantenga seguro, organizado y colaborativo.

## ⚙️ 1. Configuración Inicial

Si es la primera vez que utilizas Git en tu máquina o proyecto, asegúrate de configurar tu identidad y comprobar el estado del repositorio:

```bash
# Configurar nombre y correo global (solo se hace una vez)
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Inicializar un nuevo repositorio (si aún no existe)
git init

# Conectar con el repositorio remoto en GitHub
git remote add origin https://github.com/tu-usuario/tu-repositorio.git
```

## 🌿 2. Flujo de Trabajo de Ramas (Branching)

Nunca trabajes directamente en la rama principal (`main` o `master`). Crea siempre una rama secundaria para cada nueva funcionalidad, ajuste o corrección de error.

```bash
# Actualizar tu rama principal antes de empezar
git checkout main
git pull origin main

# Crear y moverte a una nueva rama para tu tarea (ej: feature/conexion-plc)
git checkout -b feature/conexion-plc

# Alternativas de nombres de ramas:
# feature/... -> Para nuevas funcionalidades
# bugfix/...  -> Para solucionar errores
# docs/...    -> Para documentación
```

## 🔄 3. El Ciclo de Guardado (Commit & Push)

A medida que realices cambios, debes agruparlos lógicamente.

```bash
# 1. Ver los archivos modificados
git status

# 2. Añadir los archivos que quieres guardar al "stage"
git add ruta/al/archivo.py   # Archivo específico
git add .                    # Todos los archivos modificados

# 3. Guardar el cambio con un mensaje claro
git commit -m "feat: añade integración con servidor OPC UA"

# 4. Subir la rama a GitHub
git push origin feature/conexion-plc
```

## 💬 4. Buenas Prácticas para Mensajes de Commit (Conventional Commits)

Es altamente recomendable prefijar los mensajes de commit para identificar rápidamente qué tipo de cambio se realizó:

*   **`feat:`** Una nueva característica (ej. `feat: añade visor 3D de modelos obj`)
*   **`fix:`** Corrección de un error (ej. `fix: resuelve caída de la cámara al desconectar`)
*   **`docs:`** Cambios únicamente en documentación (ej. `docs: actualiza README con instrucciones de SQL`)
*   **`style:`** Cambios que no afectan el significado del código (espacios, formato, etc.)
*   **`refactor:`** Un cambio en el código que no arregla un error ni añade una característica
*   **`test:`** Añadir o corregir pruebas

## 🛡️ 5. El archivo `.gitignore`

Es vital asegurar que no subimos archivos innecesarios, compilados, temporales o secretos a GitHub. 
Ejemplo de un buen `.gitignore` para este proyecto (Python):

```text
# Entornos virtuales
venv/
env/
.venv/

# Archivos de caché y compilados
__pycache__/
*.pyc

# Variables de entorno y secretos
.env

# Bases de datos locales
*.db
*.sqlite3

# Artefactos y logs
logs/
*.log
```

## 🔀 6. Pull Requests (PR) y Fusión (Merge)

Una vez que tu rama (`feature/lo-que-sea`) está lista y subida a GitHub:
1. Ve a la interfaz web de GitHub de tu repositorio.
2. Haz clic en el botón **"Compare & pull request"**.
3. Añade un título descriptivo y explica brevemente qué soluciona o aporta tu código.
4. Una vez revisado, acepta el PR (Merge pull request) hacia la rama `main`.
5. Vuelve a tu terminal y actualiza tu proyecto local:
```bash
git checkout main
git pull origin main
```
