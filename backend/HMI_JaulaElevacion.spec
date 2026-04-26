# -*- mode: python ; coding: utf-8 -*-
"""
HMI_JaulaElevacion.spec
Genera un único ejecutable .exe que incluye:
  - Backend FastAPI (main.py + database/ + erp_sync.py)
  - Frontend compilado (dist/)
  - database.config
"""

import os

block_cipher = None

# Raíz del backend
backend_dir = os.path.abspath('.')

a = Analysis(
    ['launcher.py'],
    pathex=[backend_dir],
    binaries=[],
    datas=[
        # Frontend compilado
        ('dist', 'dist'),
        # Módulo database completo
        ('database', 'database'),
        # Fichero de configuración de BD
        ('database.config', '.'),
        # erp_sync (por si PyInstaller no lo detecta automáticamente)
        ('erp_sync.py', '.'),
    ],
    hiddenimports=[
        # FastAPI / Starlette
        'fastapi',
        'fastapi.staticfiles',
        'fastapi.responses',
        'starlette',
        'starlette.staticfiles',
        'starlette.responses',
        # Uvicorn
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # SQLAlchemy
        'sqlalchemy',
        'sqlalchemy.dialects.sqlite',
        'sqlalchemy.dialects.mssql',
        'sqlalchemy.dialects.mssql.pyodbc',
        # App modules
        'database.database',
        'database.models',
        'database.crud',
        'erp_sync',
        # Misc
        'anyio',
        'anyio._backends._asyncio',
        'email.mime.multipart',
        'email.mime.text',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='HMI_JaulaElevacion',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # True = ventana de consola visible (logs); False = sin consola
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,             # Puedes poner un .ico aquí: icon='ruta\\icono.ico'
)
